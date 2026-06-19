-- ============================================================
-- FIX GLOBAL — IVA en el asiento automático (egreso + ingreso)
-- ============================================================
-- Deuda §9.1: fn_asiento_auto_egreso/ingreso arman solo 2 líneas
-- (DEBE gasto / HABER banco) sin desglosar el IVA. El crédito/débito
-- fiscal entra al Libro IVA pero NO al asiento → el balance no cuadra
-- el IVA cuando hay comprobante con IVA.
--
-- FIX: cuando el movimiento tiene comprobante con IVA>0, se agrega una
-- 3ª línea de IVA y se reduce la línea de gasto/venta por el neto.
--   EGRESO  : DEBE gasto(neto) + DEBE IVA crédito(1.1.09) / HABER banco(total)
--   INGRESO : DEBE banco(total) / HABER venta(neto) + HABER IVA débito(2.1.02)
-- Split PROPORCIONAL (iva_fraction = comp.iva / comp.total) → maneja pagos
-- parciales/adelantos y es currency-safe (la fracción es adimensional).
--
-- ⚠️ AFECTA A TODO FINANZAS. Idempotente (CREATE OR REPLACE). Los triggers
-- NO cambian (siguen AFTER INSERT OR UPDATE OF estado). Avisar a Sofi.
-- Cuentas verificadas en prod 2026-06-18: IVA Crédito Fiscal=1.1.09,
-- IVA Débito Fiscal=2.1.02. Si no existen, el fix degrada a 2 líneas (sin romper).
-- ============================================================

-- ------------------------------------------------------------
-- EGRESO — DEBE gasto(neto) + DEBE IVA crédito / HABER banco(total)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_asiento_auto_egreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo  UUID;
    v_cuenta_gasto   UUID;
    v_cuenta_iva     UUID;
    v_asiento_id     UUID;
    v_desc           TEXT;
    v_monto_asiento  NUMERIC(15,2);
    v_comp_iva       NUMERIC(15,2);
    v_comp_total     NUMERIC(15,2);
    v_iva            NUMERIC(15,2) := 0;
BEGIN
    IF NEW.estado IS DISTINCT FROM 'pagado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'pagado' THEN RETURN NEW; END IF;

    IF NEW.cuenta_id IS NULL THEN
        RAISE NOTICE '[Contabilidad] Egreso % sin cuenta_id — sin asiento.', NEW.id;
        RETURN NEW;
    END IF;

    SELECT id INTO v_cuenta_activo
    FROM plan_cuentas
    WHERE cuenta_financiera_id = NEW.cuenta_id AND _deleted = false
    LIMIT 1;

    IF v_cuenta_activo IS NULL THEN
        RAISE WARNING '[Contabilidad] Egreso %: cuenta financiera % sin vínculo contable.', NEW.id, NEW.cuenta_id;
        RETURN NEW;
    END IF;

    SELECT cuenta_contable_id INTO v_cuenta_gasto
    FROM mapeo_cuentas
    WHERE tipo_movimiento = 'egreso' AND activo = true AND _deleted = false
      AND ((campo_origen = 'categoria' AND valor_origen = NEW.categoria) OR (campo_origen IS NULL))
    ORDER BY CASE WHEN campo_origen IS NOT NULL THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_cuenta_gasto IS NULL THEN
        RAISE NOTICE '[Contabilidad] No hay mapeo para egreso categoria=%. Egreso % sin asiento.', NEW.categoria, NEW.id;
        RETURN NEW;
    END IF;

    v_monto_asiento := COALESCE(NEW.total_en_ars, NEW.monto);

    -- IVA crédito fiscal (split proporcional si hay comprobante recibido con IVA)
    IF NEW.comprobante_recibido_id IS NOT NULL THEN
        SELECT iva, total INTO v_comp_iva, v_comp_total
        FROM comprobantes_recibidos
        WHERE id = NEW.comprobante_recibido_id AND _deleted = false;
        IF COALESCE(v_comp_iva, 0) > 0 AND COALESCE(v_comp_total, 0) > 0 THEN
            SELECT id INTO v_cuenta_iva FROM plan_cuentas WHERE codigo = '1.1.09' AND _deleted = false LIMIT 1;
            IF v_cuenta_iva IS NOT NULL THEN
                v_iva := ROUND(v_monto_asiento * (v_comp_iva / v_comp_total), 2);
            ELSE
                RAISE NOTICE '[Contabilidad] Cuenta IVA crédito 1.1.09 no encontrada — egreso % sin desglose IVA.', NEW.id;
            END IF;
        END IF;
    END IF;

    v_desc := 'Egreso: ' || COALESCE(NEW.concepto, 'Sin concepto');
    IF NEW.moneda IS NOT NULL AND NEW.moneda <> 'ARS' THEN
        v_desc := v_desc || ' [' || NEW.moneda || ' ' || NEW.monto::TEXT || ' @ ' || NEW.cotizacion::TEXT || ']';
    END IF;

    INSERT INTO asientos (fecha, concepto, tipo, egreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'),
            v_monto_asiento, v_monto_asiento, COALESCE(NEW.moneda,'ARS'), COALESCE(NEW.cotizacion,1))
    RETURNING id INTO v_asiento_id;

    -- DEBE gasto (neto = total - iva)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_gasto, 'debe', v_monto_asiento - v_iva, v_desc, 1);

    -- DEBE IVA crédito fiscal (si corresponde)
    IF v_iva > 0 THEN
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_iva, 'debe', v_iva, 'IVA crédito fiscal', 2);
    END IF;

    -- HABER banco (total)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'haber', v_monto_asiento, v_desc, 3);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- INGRESO — DEBE banco(total) / HABER venta(neto) + HABER IVA débito
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_asiento_auto_ingreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo   UUID;
    v_cuenta_ingreso  UUID;
    v_cuenta_iva      UUID;
    v_asiento_id      UUID;
    v_desc            TEXT;
    v_monto_asiento   NUMERIC(15,2);
    v_comp_iva        NUMERIC(15,2);
    v_comp_total      NUMERIC(15,2);
    v_iva             NUMERIC(15,2) := 0;
BEGIN
    IF NEW.estado IS DISTINCT FROM 'confirmado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'confirmado' THEN RETURN NEW; END IF;

    IF NEW.cuenta_id IS NULL THEN
        RAISE NOTICE '[Contabilidad] Ingreso % sin cuenta_id — sin asiento.', NEW.id;
        RETURN NEW;
    END IF;

    SELECT id INTO v_cuenta_activo
    FROM plan_cuentas
    WHERE cuenta_financiera_id = NEW.cuenta_id AND _deleted = false
    LIMIT 1;

    IF v_cuenta_activo IS NULL THEN
        RAISE WARNING '[Contabilidad] Ingreso %: cuenta financiera % sin vínculo contable.', NEW.id, NEW.cuenta_id;
        RETURN NEW;
    END IF;

    SELECT cuenta_contable_id INTO v_cuenta_ingreso
    FROM mapeo_cuentas
    WHERE tipo_movimiento = 'ingreso' AND activo = true AND _deleted = false
      AND ((campo_origen = 'medio' AND valor_origen = NEW.medio)
        OR (campo_origen = 'canal' AND valor_origen = NEW.canal)
        OR (campo_origen IS NULL))
    ORDER BY CASE WHEN campo_origen IS NOT NULL THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_cuenta_ingreso IS NULL THEN
        RAISE NOTICE '[Contabilidad] No hay mapeo para ingreso. Ingreso % sin asiento.', NEW.id;
        RETURN NEW;
    END IF;

    v_monto_asiento := COALESCE(NEW.total_en_ars, NEW.monto);

    -- IVA débito fiscal (split proporcional si hay comprobante emitido con IVA)
    IF NEW.comprobante_id IS NOT NULL THEN
        SELECT iva, total INTO v_comp_iva, v_comp_total
        FROM comprobantes
        WHERE id = NEW.comprobante_id AND _deleted = false;
        IF COALESCE(v_comp_iva, 0) > 0 AND COALESCE(v_comp_total, 0) > 0 THEN
            SELECT id INTO v_cuenta_iva FROM plan_cuentas WHERE codigo = '2.1.02' AND _deleted = false LIMIT 1;
            IF v_cuenta_iva IS NOT NULL THEN
                v_iva := ROUND(v_monto_asiento * (v_comp_iva / v_comp_total), 2);
            ELSE
                RAISE NOTICE '[Contabilidad] Cuenta IVA débito 2.1.02 no encontrada — ingreso % sin desglose IVA.', NEW.id;
            END IF;
        END IF;
    END IF;

    v_desc := 'Ingreso: ' || COALESCE(NEW.concepto, 'Sin concepto');
    IF NEW.moneda IS NOT NULL AND NEW.moneda <> 'ARS' THEN
        v_desc := v_desc || ' [' || NEW.moneda || ' ' || NEW.monto::TEXT || ' @ ' || NEW.cotizacion::TEXT || ']';
    END IF;

    INSERT INTO asientos (fecha, concepto, tipo, ingreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'),
            v_monto_asiento, v_monto_asiento, COALESCE(NEW.moneda,'ARS'), COALESCE(NEW.cotizacion,1))
    RETURNING id INTO v_asiento_id;

    -- DEBE banco (total)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'debe', v_monto_asiento, v_desc, 1);

    -- HABER venta (neto = total - iva)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_ingreso, 'haber', v_monto_asiento - v_iva, v_desc, 2);

    -- HABER IVA débito fiscal (si corresponde)
    IF v_iva > 0 THEN
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_iva, 'haber', v_iva, 'IVA débito fiscal', 3);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TEST (correr a mano y verificar; limpiar al final)
-- ============================================================
-- A) Egreso SIN comprobante → debe seguir con 2 líneas balanceadas.
-- B) Egreso CON comprobante (neto 100k / iva 21k / total 121k) + cuenta →
--    asiento con 3 líneas: DEBE gasto 100k + DEBE IVA 21k / HABER banco 121k.
-- Verificación rápida tras una prueba:
--   SELECT a.numero, a.total_debe, a.total_haber,
--          (SELECT count(*) FROM asiento_lineas l WHERE l.asiento_id=a.id) AS n_lineas
--     FROM asientos a WHERE a.egreso_id = '<egreso_test>' AND a._deleted=false;
--   -- n_lineas=3 y total_debe=total_haber para el caso con IVA.
-- Chequear que NINGÚN asiento histórico quedó desbalanceado:
--   SELECT numero FROM asientos WHERE _deleted=false AND ABS(total_debe-total_haber)>0.01;
