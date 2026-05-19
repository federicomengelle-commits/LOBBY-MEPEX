-- =============================================
-- FIX: Triggers fn_asiento_auto_ingreso y _egreso
-- =============================================
-- El trigger en producción referencia 'cuenta_id' de forma que falla
-- con: column "cuenta_id" does not exist al insertar un ingreso con
-- estado='confirmado'. Síntoma: imposible registrar cobros.
--
-- Este SQL recrea ambos triggers contra el schema REAL verificado:
--   asientos:       id, numero, fecha, concepto, tipo, canal,
--                   ingreso_id, egreso_id, ..., total_debe, total_haber, _deleted
--                   (NO tiene 'estado' ni 'descripcion' ni 'origen_*')
--   asiento_lineas: id, asiento_id, cuenta_id, tipo_movimiento ('debe'|'haber'),
--                   monto, descripcion, orden
--   plan_cuentas:   id, ..., cuenta_financiera_id (FK a cuentas_financieras)
--   mapeo_cuentas:  clave, cuenta_id (la cuenta contable mapeada), _deleted
--
-- Mapeo de finanzas → contabilidad:
--   Ingresos.cuenta_id (cuenta financiera) → plan_cuentas.cuenta_financiera_id
--   Egresos análogo.
--
-- Idempotente.
-- =============================================


-- ════════════════════════════════════════════════
--  fn_asiento_auto_ingreso (corregida)
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_asiento_auto_ingreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo   UUID;
    v_cuenta_ingreso  UUID;
    v_asiento_id      UUID;
    v_desc            TEXT;
    v_clave_mapeo     TEXT;
BEGIN
    -- Solo disparar cuando pasa a 'confirmado'
    IF NEW.estado IS DISTINCT FROM 'confirmado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'confirmado' THEN RETURN NEW; END IF;

    -- Si no hay cuenta financiera, no podemos asentar contra ningún activo.
    -- Salimos en silencio (el ingreso queda registrado pero sin asiento).
    IF NEW.cuenta_id IS NULL THEN
        RAISE NOTICE '[Contabilidad] Ingreso % sin cuenta_id, no se generó asiento automático.', NEW.id;
        RETURN NEW;
    END IF;

    -- Buscar cuenta contable de activo (la que está vinculada a la cuenta financiera)
    SELECT id INTO v_cuenta_activo
    FROM plan_cuentas
    WHERE cuenta_financiera_id = NEW.cuenta_id
      AND _deleted = false
    LIMIT 1;

    IF v_cuenta_activo IS NULL THEN
        RAISE WARNING '[Contabilidad] Ingreso %: cuenta financiera % no tiene cuenta contable vinculada.', NEW.id, NEW.cuenta_id;
        RETURN NEW;
    END IF;

    -- Buscar cuenta de ingreso vía mapeo_cuentas
    -- Clave compuesta: 'ingreso_alquiler' o fallback a 'ingreso_otros'
    v_clave_mapeo := 'ingreso_otros';  -- default

    SELECT cuenta_id INTO v_cuenta_ingreso
    FROM mapeo_cuentas
    WHERE clave = v_clave_mapeo
      AND _deleted = false
    LIMIT 1;

    IF v_cuenta_ingreso IS NULL THEN
        RAISE WARNING '[Contabilidad] No hay mapeo "ingreso_otros" en mapeo_cuentas. Ingreso % sin asiento.', NEW.id;
        RETURN NEW;
    END IF;

    -- Descripción del asiento
    v_desc := 'Ingreso: ' || COALESCE(NEW.concepto, 'Sin concepto');

    -- Crear cabecera del asiento (schema real: 'concepto' NOT 'descripcion', NO 'estado')
    INSERT INTO asientos (fecha, concepto, tipo, ingreso_id, canal, total_debe, total_haber)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'), NEW.monto, NEW.monto)
    RETURNING id INTO v_asiento_id;

    -- Línea DEBE (activo: entra plata en la cuenta financiera)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'debe', NEW.monto, v_desc, 1);

    -- Línea HABER (ingreso)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_ingreso, 'haber', NEW.monto, v_desc, 2);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════
--  fn_asiento_auto_egreso (corregida)
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_asiento_auto_egreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo  UUID;
    v_cuenta_gasto   UUID;
    v_asiento_id     UUID;
    v_desc           TEXT;
    v_clave_mapeo    TEXT;
BEGIN
    -- Solo disparar cuando pasa a 'pagado'
    IF NEW.estado IS DISTINCT FROM 'pagado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'pagado' THEN RETURN NEW; END IF;

    IF NEW.cuenta_id IS NULL THEN
        RAISE NOTICE '[Contabilidad] Egreso % sin cuenta_id, no se generó asiento automático.', NEW.id;
        RETURN NEW;
    END IF;

    -- Cuenta contable de activo (financiera)
    SELECT id INTO v_cuenta_activo
    FROM plan_cuentas
    WHERE cuenta_financiera_id = NEW.cuenta_id
      AND _deleted = false
    LIMIT 1;

    IF v_cuenta_activo IS NULL THEN
        RAISE WARNING '[Contabilidad] Egreso %: cuenta financiera % no tiene cuenta contable vinculada.', NEW.id, NEW.cuenta_id;
        RETURN NEW;
    END IF;

    -- Cuenta de gasto: por categoría con fallback a 'egreso_otros'
    v_clave_mapeo := 'egreso_' || COALESCE(NEW.categoria, 'otros');

    SELECT cuenta_id INTO v_cuenta_gasto
    FROM mapeo_cuentas
    WHERE clave = v_clave_mapeo AND _deleted = false
    LIMIT 1;

    IF v_cuenta_gasto IS NULL THEN
        SELECT cuenta_id INTO v_cuenta_gasto
        FROM mapeo_cuentas
        WHERE clave = 'egreso_otros' AND _deleted = false
        LIMIT 1;
    END IF;

    IF v_cuenta_gasto IS NULL THEN
        RAISE WARNING '[Contabilidad] No hay mapeo "egreso_*" en mapeo_cuentas. Egreso % sin asiento.', NEW.id;
        RETURN NEW;
    END IF;

    v_desc := 'Egreso: ' || COALESCE(NEW.concepto, 'Sin concepto');

    INSERT INTO asientos (fecha, concepto, tipo, egreso_id, canal, total_debe, total_haber)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'), NEW.monto, NEW.monto)
    RETURNING id INTO v_asiento_id;

    -- DEBE (gasto)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_gasto, 'debe', NEW.monto, v_desc, 1);

    -- HABER (activo: sale plata)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'haber', NEW.monto, v_desc, 2);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════
--  Recrear los triggers (por si se perdió la binding)
-- ════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_asiento_auto_ingreso ON ingresos;
CREATE TRIGGER trg_asiento_auto_ingreso
    AFTER INSERT OR UPDATE OF estado ON ingresos
    FOR EACH ROW EXECUTE FUNCTION fn_asiento_auto_ingreso();

DROP TRIGGER IF EXISTS trg_asiento_auto_egreso ON egresos;
CREATE TRIGGER trg_asiento_auto_egreso
    AFTER INSERT OR UPDATE OF estado ON egresos
    FOR EACH ROW EXECUTE FUNCTION fn_asiento_auto_egreso();


-- ════════════════════════════════════════════════
--  Cierre
-- ════════════════════════════════════════════════
DO $$
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Triggers fn_asiento_auto_* recreados contra schema real.';
    RAISE NOTICE 'Probar: INSERT INTO ingresos con estado=confirmado debe funcionar.';
    RAISE NOTICE '═══════════════════════════════════════════';
END $$;
