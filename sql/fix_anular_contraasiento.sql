-- ============================================================
-- FIX GLOBAL — Contra-asiento automático al ANULAR egreso/ingreso
-- ============================================================
-- Deuda §9.2: el trigger de asiento solo dispara en transición *a* pagado/
-- confirmado; al pasar a 'anulado' el asiento original queda vivo → el
-- balance y los saldos no se revierten. Hoy la reversión es manual.
--
-- FIX: triggers AFTER UPDATE OF estado que, en la transición
--   egreso  pagado     → anulado
--   ingreso confirmado → anulado
-- generan un ASIENTO DE REVERSIÓN (líneas invertidas debe↔haber) ligado
-- al mismo movimiento. Se mantiene el original (audit trail); la cascada
-- de saldos (trg_saldos_lineas) neutraliza el efecto. Guarda anti-doble:
-- no crea reversión si ya existe una para ese movimiento.
--
-- ⚠️ AFECTA A TODO FINANZAS. Idempotente. Avisar a Sofi.
-- ============================================================

-- ------------------------------------------------------------
-- EGRESO anulado → reversión
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_revertir_asiento_egreso()
RETURNS TRIGGER AS $$
DECLARE
    v_asiento  RECORD;
    v_linea    RECORD;
    v_rev_id   UUID;
BEGIN
    IF NOT (TG_OP = 'UPDATE' AND NEW.estado = 'anulado' AND OLD.estado = 'pagado') THEN
        RETURN NEW;
    END IF;

    -- Asiento original (vivo, no es una reversión)
    SELECT * INTO v_asiento
    FROM asientos
    WHERE egreso_id = NEW.id AND _deleted = false AND concepto NOT ILIKE 'Reversión:%'
    ORDER BY numero LIMIT 1;
    IF v_asiento.id IS NULL THEN RETURN NEW; END IF;

    -- Anti-doble: ya hay una reversión para este egreso
    IF EXISTS (SELECT 1 FROM asientos WHERE egreso_id = NEW.id AND _deleted = false AND concepto ILIKE 'Reversión:%') THEN
        RETURN NEW;
    END IF;

    INSERT INTO asientos (fecha, concepto, tipo, egreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (CURRENT_DATE, 'Reversión: ' || v_asiento.concepto, 'automatico', NEW.id, v_asiento.canal,
            v_asiento.total_haber, v_asiento.total_debe, v_asiento.moneda, v_asiento.cotizacion)
    RETURNING id INTO v_rev_id;

    FOR v_linea IN SELECT * FROM asiento_lineas WHERE asiento_id = v_asiento.id ORDER BY orden LOOP
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_rev_id, v_linea.cuenta_id,
                CASE WHEN v_linea.tipo_movimiento = 'debe' THEN 'haber' ELSE 'debe' END,
                v_linea.monto, 'Reversión: ' || COALESCE(v_linea.descripcion, ''), v_linea.orden);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_revertir_asiento_egreso ON egresos;
CREATE TRIGGER trg_revertir_asiento_egreso
    AFTER UPDATE OF estado ON egresos
    FOR EACH ROW EXECUTE FUNCTION fn_revertir_asiento_egreso();

-- ------------------------------------------------------------
-- INGRESO anulado → reversión
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_revertir_asiento_ingreso()
RETURNS TRIGGER AS $$
DECLARE
    v_asiento  RECORD;
    v_linea    RECORD;
    v_rev_id   UUID;
BEGIN
    IF NOT (TG_OP = 'UPDATE' AND NEW.estado = 'anulado' AND OLD.estado = 'confirmado') THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_asiento
    FROM asientos
    WHERE ingreso_id = NEW.id AND _deleted = false AND concepto NOT ILIKE 'Reversión:%'
    ORDER BY numero LIMIT 1;
    IF v_asiento.id IS NULL THEN RETURN NEW; END IF;

    IF EXISTS (SELECT 1 FROM asientos WHERE ingreso_id = NEW.id AND _deleted = false AND concepto ILIKE 'Reversión:%') THEN
        RETURN NEW;
    END IF;

    INSERT INTO asientos (fecha, concepto, tipo, ingreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (CURRENT_DATE, 'Reversión: ' || v_asiento.concepto, 'automatico', NEW.id, v_asiento.canal,
            v_asiento.total_haber, v_asiento.total_debe, v_asiento.moneda, v_asiento.cotizacion)
    RETURNING id INTO v_rev_id;

    FOR v_linea IN SELECT * FROM asiento_lineas WHERE asiento_id = v_asiento.id ORDER BY orden LOOP
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_rev_id, v_linea.cuenta_id,
                CASE WHEN v_linea.tipo_movimiento = 'debe' THEN 'haber' ELSE 'debe' END,
                v_linea.monto, 'Reversión: ' || COALESCE(v_linea.descripcion, ''), v_linea.orden);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_revertir_asiento_ingreso ON ingresos;
CREATE TRIGGER trg_revertir_asiento_ingreso
    AFTER UPDATE OF estado ON ingresos
    FOR EACH ROW EXECUTE FUNCTION fn_revertir_asiento_ingreso();

-- ============================================================
-- TEST (correr a mano; limpiar al final)
-- ============================================================
-- 1) Crear egreso pagado con cuenta → genera asiento original.
-- 2) UPDATE egresos SET estado='anulado' WHERE id='<test>' → genera "Reversión: ...".
-- 3) Verificar par original + reversión y que NETEAN a 0:
--    SELECT concepto, total_debe, total_haber FROM asientos WHERE egreso_id='<test>' AND _deleted=false;
--    -- El saldo de las cuentas afectadas debe volver al previo (revisar saldos_mensuales).
-- 4) Re-ejecutar el UPDATE no debe duplicar la reversión (guarda anti-doble).
