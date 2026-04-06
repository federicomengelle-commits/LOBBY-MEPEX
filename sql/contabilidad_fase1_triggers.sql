-- =============================================
-- MEPEX Lobby - Contabilidad Fase 1 — TRIGGERS
-- =============================================
-- Triggers para generar asientos contables
-- automáticos cuando se confirman ingresos
-- o egresos en el módulo Finanzas.
-- =============================================

-- ═══════════════════════════════════════════
--  FUNCIÓN: Asiento automático por INGRESO
-- ═══════════════════════════════════════════
-- Se dispara cuando un ingreso pasa a estado 'confirmado'.
-- Busca la cuenta contable vinculada a la cuenta financiera
-- del ingreso (via plan_cuentas.cuenta_financiera_id).
-- Genera:
--   DEBE  → cuenta de activo (la cuenta financiera)
--   HABER → cuenta de ingreso (via mapeo_cuentas)

CREATE OR REPLACE FUNCTION fn_asiento_auto_ingreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo UUID;
    v_cuenta_ingreso UUID;
    v_asiento_id UUID;
    v_desc TEXT;
BEGIN
    -- Solo disparar cuando cambia a 'confirmado'
    IF NEW.estado != 'confirmado' THEN RETURN NEW; END IF;
    IF OLD IS NOT NULL AND OLD.estado = 'confirmado' THEN RETURN NEW; END IF;

    -- Buscar cuenta contable vinculada a la cuenta financiera
    SELECT id INTO v_cuenta_activo
    FROM plan_cuentas
    WHERE cuenta_financiera_id = NEW.cuenta_id
      AND _deleted = false
      AND nivel = 3
    LIMIT 1;

    IF v_cuenta_activo IS NULL THEN
        RAISE WARNING '[Contabilidad] Ingreso % sin cuenta contable vinculada a cuenta financiera %',
            NEW.id, NEW.cuenta_id;
        RETURN NEW;
    END IF;

    -- Buscar cuenta de ingreso via mapeo (fallback a ingreso_otros)
    SELECT cuenta_id INTO v_cuenta_ingreso
    FROM mapeo_cuentas
    WHERE clave = COALESCE('ingreso_' || NEW.categoria, 'ingreso_otros')
      AND _deleted = false;

    IF v_cuenta_ingreso IS NULL THEN
        SELECT cuenta_id INTO v_cuenta_ingreso
        FROM mapeo_cuentas WHERE clave = 'ingreso_otros' AND _deleted = false;
    END IF;

    IF v_cuenta_ingreso IS NULL THEN
        RAISE WARNING '[Contabilidad] No se encontró mapeo para ingreso %', NEW.id;
        RETURN NEW;
    END IF;

    v_desc := 'Ingreso: ' || COALESCE(NEW.concepto, NEW.descripcion, 'Sin descripción');

    -- Crear asiento
    INSERT INTO asientos (fecha, descripcion, tipo, origen_tipo, origen_id, canal, estado, total_debe, total_haber)
    VALUES (NEW.fecha, v_desc, 'automatico', 'ingreso', NEW.id, NEW.canal, 'confirmado', NEW.monto, NEW.monto)
    RETURNING id INTO v_asiento_id;

    -- Línea DEBE (activo: entra dinero)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, debe, haber, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, NEW.monto, 0, v_desc, 1);

    -- Línea HABER (ingreso)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, debe, haber, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_ingreso, 0, NEW.monto, v_desc, 2);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════
--  FUNCIÓN: Asiento automático por EGRESO
-- ═══════════════════════════════════════════
-- Se dispara cuando un egreso pasa a estado 'pagado'.
-- Genera:
--   DEBE  → cuenta de gasto (via mapeo_cuentas)
--   HABER → cuenta de activo (la cuenta financiera)

CREATE OR REPLACE FUNCTION fn_asiento_auto_egreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo UUID;
    v_cuenta_gasto UUID;
    v_asiento_id UUID;
    v_desc TEXT;
BEGIN
    -- Solo disparar cuando cambia a 'pagado'
    IF NEW.estado != 'pagado' THEN RETURN NEW; END IF;
    IF OLD IS NOT NULL AND OLD.estado = 'pagado' THEN RETURN NEW; END IF;

    -- Buscar cuenta contable vinculada
    SELECT id INTO v_cuenta_activo
    FROM plan_cuentas
    WHERE cuenta_financiera_id = NEW.cuenta_id
      AND _deleted = false
      AND nivel = 3
    LIMIT 1;

    IF v_cuenta_activo IS NULL THEN
        RAISE WARNING '[Contabilidad] Egreso % sin cuenta contable vinculada a cuenta financiera %',
            NEW.id, NEW.cuenta_id;
        RETURN NEW;
    END IF;

    -- Buscar cuenta de gasto via mapeo
    SELECT cuenta_id INTO v_cuenta_gasto
    FROM mapeo_cuentas
    WHERE clave = COALESCE('egreso_' || NEW.categoria, 'egreso_otros')
      AND _deleted = false;

    IF v_cuenta_gasto IS NULL THEN
        SELECT cuenta_id INTO v_cuenta_gasto
        FROM mapeo_cuentas WHERE clave = 'egreso_otros' AND _deleted = false;
    END IF;

    IF v_cuenta_gasto IS NULL THEN
        RAISE WARNING '[Contabilidad] No se encontró mapeo para egreso %', NEW.id;
        RETURN NEW;
    END IF;

    v_desc := 'Egreso: ' || COALESCE(NEW.concepto, NEW.descripcion, 'Sin descripción');

    -- Crear asiento
    INSERT INTO asientos (fecha, descripcion, tipo, origen_tipo, origen_id, canal, estado, total_debe, total_haber)
    VALUES (NEW.fecha, v_desc, 'automatico', 'egreso', NEW.id, NEW.canal, 'confirmado', NEW.monto, NEW.monto)
    RETURNING id INTO v_asiento_id;

    -- Línea DEBE (gasto)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, debe, haber, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_gasto, NEW.monto, 0, v_desc, 1);

    -- Línea HABER (activo: sale dinero)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, debe, haber, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 0, NEW.monto, v_desc, 2);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════
--  CREAR TRIGGERS
-- ═══════════════════════════════════════════

-- Trigger en ingresos (INSERT OR UPDATE)
DROP TRIGGER IF EXISTS trg_asiento_auto_ingreso ON ingresos;
CREATE TRIGGER trg_asiento_auto_ingreso
    AFTER INSERT OR UPDATE OF estado ON ingresos
    FOR EACH ROW
    EXECUTE FUNCTION fn_asiento_auto_ingreso();

-- Trigger en egresos (INSERT OR UPDATE)
DROP TRIGGER IF EXISTS trg_asiento_auto_egreso ON egresos;
CREATE TRIGGER trg_asiento_auto_egreso
    AFTER INSERT OR UPDATE OF estado ON egresos
    FOR EACH ROW
    EXECUTE FUNCTION fn_asiento_auto_egreso();
