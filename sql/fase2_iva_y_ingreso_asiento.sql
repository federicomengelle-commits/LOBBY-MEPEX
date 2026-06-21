-- ============================================================
-- FASE 2 — IVA en el asiento + arreglo del asiento de INGRESO
-- ============================================================
-- Construido sobre la lógica VIVA de prod (pg_get_functiondef 2026-06-20),
-- NO sobre sql/fix_iva_asiento.sql (que tenía el lookup de ingreso por
-- medio/canal — incompatible con los mapeos vivos por servicio).
--
-- DOS cosas en una pasada (mismas funciones, una sola charla con Sofi):
--   1) IVA desglosado en el asiento (3ª línea) cuando hay comprobante con IVA.
--      EGRESO : DEBE gasto(neto) + DEBE IVA crédito 1.1.09 / HABER banco(total)
--      INGRESO: DEBE banco(total) / HABER venta(neto) + HABER IVA débito 2.1.02
--   2) ARREGLO del asiento de ingreso (estaba DORMIDO): la función viva busca
--      el mapeo por medio/canal, pero los únicos mapeos son por `servicio`
--      (SRV-*) y `ingresos` no tiene columna servicio → ningún ingreso generaba
--      asiento. Fix: clasificar por el `servicio` del COMPROBANTE vinculado
--      (revive los 4 mapeos SRV-*) y el cobro SIN factura va a Anticipos de
--      clientes (pasivo 2.1.06), NO a ventas. Se siembra ese mapeo (sección C).
--
-- Verificado contra recon: códigos IVA 1.1.09/2.1.02 OK · universo histórico
-- afectado = 0 (sin backfill) · 0 desbalances (VALIDATE pasará).
-- Idempotente (CREATE OR REPLACE). Los triggers NO cambian. Silencio defensivo
-- preservado (sin cuenta/sin mapeo → NOTICE, no rompe el INSERT del movimiento).
-- ⚠️ AFECTA A TODO FINANZAS. AVISAR A SOFI (asientos 2→3 líneas; por primera
--    vez los cobros confirmados impactan contabilidad).
-- ============================================================

-- ------------------------------------------------------------
-- A. EGRESO — lógica viva (lookup por categoria) + 3ª línea IVA crédito
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_asiento_auto_egreso()
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

    -- Match por categoría primero, después genérico (lógica viva, intacta)
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

    -- IVA crédito fiscal: split proporcional si el comprobante recibido tiene IVA.
    -- NOTA SOFI: para categoria='credito_fiscal' (cuenta 5.2.10) revisar si
    -- corresponde desglosar IVA o si el monto entero ya es crédito fiscal.
    -- Hoy hay 0 egresos así (recon C=0) → no urgente, pero confirmar semántica.
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
-- B. INGRESO — lógica viva + clasificación por servicio del comprobante
--    (revive SRV-*) + fallback a Anticipos de clientes + 3ª línea IVA débito
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_asiento_auto_ingreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo   UUID;
    v_cuenta_ingreso  UUID;
    v_cuenta_iva      UUID;
    v_asiento_id      UUID;
    v_desc            TEXT;
    v_monto_asiento   NUMERIC(15,2);
    v_servicio        TEXT := NULL;
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

    -- Comprobante emitido vinculado: da el servicio (clasificación) y el IVA débito
    IF NEW.comprobante_id IS NOT NULL THEN
        SELECT servicio, iva, total INTO v_servicio, v_comp_iva, v_comp_total
        FROM comprobantes
        WHERE id = NEW.comprobante_id AND _deleted = false;
    END IF;

    -- Cuenta de ingreso: por servicio del comprobante si matchea, si no el
    -- fallback 'default' (Anticipos de clientes, sembrado en sección C).
    -- Sentinel 'default' porque campo_origen es NOT NULL.
    SELECT cuenta_contable_id INTO v_cuenta_ingreso
    FROM mapeo_cuentas
    WHERE tipo_movimiento = 'ingreso' AND activo = true AND _deleted = false
      AND ((campo_origen = 'servicio' AND valor_origen = v_servicio) OR (campo_origen = 'default'))
    ORDER BY CASE WHEN campo_origen = 'servicio' AND valor_origen = v_servicio THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_cuenta_ingreso IS NULL THEN
        RAISE NOTICE '[Contabilidad] No hay mapeo (ni default) para ingreso %. Sin asiento.', NEW.id;
        RETURN NEW;
    END IF;

    v_monto_asiento := COALESCE(NEW.total_en_ars, NEW.monto);

    -- IVA débito fiscal: split proporcional si el comprobante tiene IVA
    IF COALESCE(v_comp_iva, 0) > 0 AND COALESCE(v_comp_total, 0) > 0 THEN
        SELECT id INTO v_cuenta_iva FROM plan_cuentas WHERE codigo = '2.1.02' AND _deleted = false LIMIT 1;
        IF v_cuenta_iva IS NOT NULL THEN
            v_iva := ROUND(v_monto_asiento * (v_comp_iva / v_comp_total), 2);
        ELSE
            RAISE NOTICE '[Contabilidad] Cuenta IVA débito 2.1.02 no encontrada — ingreso % sin desglose IVA.', NEW.id;
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

-- ------------------------------------------------------------
-- C. Mapeo de ingreso GENÉRICO (fallback cuando el cobro no tiene factura)
-- ------------------------------------------------------------
-- Cobro SIN factura = ANTICIPO DE CLIENTES (pasivo 2.1.06), NO venta.
-- Criterio profesional: no se devenga venta sobre plata no facturada; se
-- reclasifica anticipo→venta al emitir la factura (Fase 3).
-- Sentinel campo_origen='default' (la columna es NOT NULL → el branch IS NULL
-- de las funciones vivas era código muerto, nunca matcheaba).
INSERT INTO mapeo_cuentas (tipo_movimiento, campo_origen, valor_origen, posicion, cuenta_contable_id, activo, descripcion)
SELECT 'ingreso', 'default', 'default', 'haber',
       (SELECT id FROM plan_cuentas WHERE codigo = '2.1.06' AND _deleted = false LIMIT 1),
       true, 'Cobro sin factura -> Anticipos de clientes (se reclasifica a venta al facturar)'
WHERE NOT EXISTS (
    SELECT 1 FROM mapeo_cuentas
    WHERE tipo_movimiento = 'ingreso' AND campo_origen = 'default' AND _deleted = false
);

-- ------------------------------------------------------------
-- D. Validar el CHECK de partida doble (0 desbalances en el recon → pasa)
-- ------------------------------------------------------------
ALTER TABLE asientos VALIDATE CONSTRAINT chk_partida_doble;

-- ============================================================
-- TEST (correr a mano por la UI; limpiar al final)
-- ============================================================
-- 1) Egreso pagado CON comprobante recibido (neto 100k / iva 21k / total 121k)
--    + cuenta → asiento de 3 líneas: DEBE 5.x 100k + DEBE 1.1.09 21k / HABER banco 121k.
-- 2) Egreso pagado SIN comprobante → 2 líneas balanceadas (sin regresión).
-- 3) Ingreso confirmado SIN comprobante + cuenta → AHORA genera asiento de 2 líneas
--    (DEBE banco / HABER 2.1.06 Anticipos de clientes) — antes NO generaba ninguno.
-- 4) Ingreso confirmado CON comprobante emitido (servicio SRV-ALQUILER, iva>0) →
--    3 líneas: DEBE banco / HABER 4.1.02 neto + HABER 2.1.02 iva.
-- 5) Anular un egreso pagado → la reversión (ya viva) netea a 0.
-- Verificación rápida:
--   SELECT a.numero, a.total_debe, a.total_haber,
--          (SELECT count(*) FROM asiento_lineas l WHERE l.asiento_id=a.id) n
--   FROM asientos a WHERE a._deleted=false ORDER BY a.numero DESC LIMIT 10;
--   SELECT numero FROM asientos WHERE _deleted=false AND ABS(total_debe-total_haber)>0.01; -- debe dar 0 filas
