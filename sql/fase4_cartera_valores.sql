-- ============================================================
-- FASE 4 — Tesorería real + CARTERA DE VALORES (cheques diferidos)
-- ============================================================
-- Diseño: docs/finanzas-fase4-cartera-valores-DISENO.md
-- Recon vivo 2026-06-21: 1.1.07 "Cheques a cobrar" (activo) y 2.1.07
-- "Cheques emitidos (diferidos)" (pasivo) YA EXISTEN → 0 cuentas nuevas.
--
-- MODELO: el cheque es un MEDIO DIFERIDO del circuito único.
--   Entrada (la genera el trigger de egreso/ingreso, +1 IF): la pata de
--     tesorería va al valor account (2.1.07/1.1.07) en vez del banco.
--   Clearing (trigger NUEVO de cartera_valores, en la fecha real): mueve
--     valor ↔ banco. El banco solo se toca al cobrar/debitar.
--
-- Idempotente (CREATE OR REPLACE / IF NOT EXISTS / DROP POLICY IF EXISTS).
-- Silencio defensivo preservado (sin cuenta/sin mapeo → NOTICE, no rompe).
-- ⚠️ Las secciones C y D REEMPLAZAN fn_asiento_auto_egreso/_ingreso (como
--    Fase 2) → AVISAR A SOFI. El cuerpo es el VIVO de Fase 2 + 1 IF (marcado
--    "FASE 4"). Si alguien editó esas funciones a mano desde Fase 2, mergear
--    el IF en vez de reemplazar (confirmar con pg_get_functiondef).
-- Cambio forward-only: cheques nuevos se difieren; histórico ya posteado queda.
-- ============================================================

-- ------------------------------------------------------------
-- A. DDL — tabla cartera_valores
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cartera_valores (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sentido                  TEXT NOT NULL CHECK (sentido IN ('recibido','emitido')),
    tipo                     TEXT NOT NULL DEFAULT 'cheque' CHECK (tipo IN ('cheque','echeq','pagare','otro')),
    propio                   BOOLEAN NOT NULL DEFAULT false,   -- cheque propio (chequera MEPEX) vs tercero
    banco                    TEXT,
    numero                   TEXT,
    titular                  TEXT,                              -- librador (recibido) / beneficiario (emitido)
    cuit_titular             TEXT,
    monto                    NUMERIC(15,2) NOT NULL CHECK (monto > 0),
    moneda                   TEXT NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS','USD','EUR')),
    cotizacion               NUMERIC(15,4) NOT NULL DEFAULT 1 CHECK (cotizacion > 0),
    total_en_ars             NUMERIC(15,2),                     -- materializado por trigger
    fecha_emision            DATE,
    fecha_cobro              DATE NOT NULL,                     -- fecha de pago/acreditación esperada
    fecha_realizado          DATE,                              -- cuándo se cobró/debitó efectivamente
    estado                   TEXT NOT NULL DEFAULT 'en_cartera'
                                CHECK (estado IN ('en_cartera','depositado','cobrado','debitado','rechazado','endosado','entregado','anulado')),
    cuenta_id                UUID REFERENCES public.cuentas_financieras(id),   -- banco depósito/pago
    canal                    TEXT NOT NULL DEFAULT 'oficial' CHECK (canal IN ('oficial','interno')),
    proyecto_id              UUID,
    evento_id                UUID,
    cliente_id               UUID,
    proveedor_id             UUID,
    ingreso_id               UUID REFERENCES public.ingresos(id),  -- cobro que lo originó (recibido)
    egreso_id                UUID REFERENCES public.egresos(id),   -- pago que lo originó (emitido)
    endosado_a_proveedor_id  UUID,                              -- v1.1
    endoso_egreso_id         UUID,                              -- v1.1
    asiento_clearing_id      UUID,                              -- asiento de acreditación/débito (traza/anti-doble)
    asiento_rechazo_id       UUID,                              -- asiento de rebote/anulación
    notas                    TEXT,
    created_by               UUID,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted                 BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_cv_estado       ON public.cartera_valores (estado)      WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_cv_sentido      ON public.cartera_valores (sentido)     WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_cv_fecha_cobro  ON public.cartera_valores (fecha_cobro) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_cv_ingreso      ON public.cartera_valores (ingreso_id);
CREATE INDEX IF NOT EXISTS idx_cv_egreso       ON public.cartera_valores (egreso_id);

-- ------------------------------------------------------------
-- B. ALTER asientos — link del asiento de clearing del valor
-- ------------------------------------------------------------
ALTER TABLE public.asientos ADD COLUMN IF NOT EXISTS cartera_valor_id UUID;

-- ------------------------------------------------------------
-- B.2 total_en_ars del valor (reusa fn_snapshot_total_ars_monto de Fase E)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_total_ars_valor ON public.cartera_valores;
CREATE TRIGGER trg_total_ars_valor
    BEFORE INSERT OR UPDATE ON public.cartera_valores
    FOR EACH ROW EXECUTE FUNCTION public.fn_snapshot_total_ars_monto();

-- ------------------------------------------------------------
-- B.3 RLS — authenticated R/W; DELETE admin/superadmin (sin esconder filas)
-- ------------------------------------------------------------
ALTER TABLE public.cartera_valores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cv_select ON public.cartera_valores;
DROP POLICY IF EXISTS cv_insert ON public.cartera_valores;
DROP POLICY IF EXISTS cv_update ON public.cartera_valores;
DROP POLICY IF EXISTS cv_delete ON public.cartera_valores;
CREATE POLICY cv_select ON public.cartera_valores FOR SELECT TO authenticated USING (true);
CREATE POLICY cv_insert ON public.cartera_valores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY cv_update ON public.cartera_valores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY cv_delete ON public.cartera_valores FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','superadmin')));

-- ------------------------------------------------------------
-- C. EGRESO — cuerpo VIVO (Fase 2) + IF Fase 4 (cheque → 2.1.07)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_asiento_auto_egreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo  UUID;
    v_cuenta_gasto   UUID;
    v_cuenta_iva     UUID;
    v_cuenta_valor   UUID;                 -- FASE 4
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

    -- ── FASE 4: pago con cheque/echeq → la pata de tesorería se DIFIERE al
    --    valor account 2.1.07 (no al banco). El banco se mueve en el clearing
    --    del valor (fn_asiento_auto_valor). Todo lo demás queda IGUAL.
    IF NEW.medio IN ('cheque','echeq') THEN
        SELECT id INTO v_cuenta_valor FROM plan_cuentas
        WHERE codigo = '2.1.07' AND _deleted = false LIMIT 1;
        IF v_cuenta_valor IS NOT NULL THEN v_cuenta_activo := v_cuenta_valor; END IF;
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
    IF NEW.medio IN ('cheque','echeq') THEN v_desc := v_desc || ' [cheque diferido]'; END IF;  -- FASE 4
    IF NEW.moneda IS NOT NULL AND NEW.moneda <> 'ARS' THEN
        v_desc := v_desc || ' [' || NEW.moneda || ' ' || NEW.monto::TEXT || ' @ ' || NEW.cotizacion::TEXT || ']';
    END IF;

    INSERT INTO asientos (fecha, concepto, tipo, egreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'),
            v_monto_asiento, v_monto_asiento, COALESCE(NEW.moneda,'ARS'), COALESCE(NEW.cotizacion,1))
    RETURNING id INTO v_asiento_id;

    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_gasto, 'debe', v_monto_asiento - v_iva, v_desc, 1);

    IF v_iva > 0 THEN
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_iva, 'debe', v_iva, 'IVA crédito fiscal', 2);
    END IF;

    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'haber', v_monto_asiento, v_desc, 3);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- D. INGRESO — cuerpo VIVO (Fase 2) + IF Fase 4 (cheque → 1.1.07)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_asiento_auto_ingreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo   UUID;
    v_cuenta_ingreso  UUID;
    v_cuenta_iva      UUID;
    v_cuenta_valor    UUID;                -- FASE 4
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

    -- ── FASE 4: cobro con cheque/echeq → la pata de tesorería se DIFIERE al
    --    valor account 1.1.07 (no al banco). El banco entra en el clearing.
    IF NEW.medio IN ('cheque','echeq') THEN
        SELECT id INTO v_cuenta_valor FROM plan_cuentas
        WHERE codigo = '1.1.07' AND _deleted = false LIMIT 1;
        IF v_cuenta_valor IS NOT NULL THEN v_cuenta_activo := v_cuenta_valor; END IF;
    END IF;

    IF NEW.comprobante_id IS NOT NULL THEN
        SELECT servicio, iva, total INTO v_servicio, v_comp_iva, v_comp_total
        FROM comprobantes
        WHERE id = NEW.comprobante_id AND _deleted = false;
    END IF;

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

    IF COALESCE(v_comp_iva, 0) > 0 AND COALESCE(v_comp_total, 0) > 0 THEN
        SELECT id INTO v_cuenta_iva FROM plan_cuentas WHERE codigo = '2.1.02' AND _deleted = false LIMIT 1;
        IF v_cuenta_iva IS NOT NULL THEN
            v_iva := ROUND(v_monto_asiento * (v_comp_iva / v_comp_total), 2);
        ELSE
            RAISE NOTICE '[Contabilidad] Cuenta IVA débito 2.1.02 no encontrada — ingreso % sin desglose IVA.', NEW.id;
        END IF;
    END IF;

    v_desc := 'Ingreso: ' || COALESCE(NEW.concepto, 'Sin concepto');
    IF NEW.medio IN ('cheque','echeq') THEN v_desc := v_desc || ' [cheque en cartera]'; END IF;  -- FASE 4
    IF NEW.moneda IS NOT NULL AND NEW.moneda <> 'ARS' THEN
        v_desc := v_desc || ' [' || NEW.moneda || ' ' || NEW.monto::TEXT || ' @ ' || NEW.cotizacion::TEXT || ']';
    END IF;

    INSERT INTO asientos (fecha, concepto, tipo, ingreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'),
            v_monto_asiento, v_monto_asiento, COALESCE(NEW.moneda,'ARS'), COALESCE(NEW.cotizacion,1))
    RETURNING id INTO v_asiento_id;

    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'debe', v_monto_asiento, v_desc, 1);

    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_ingreso, 'haber', v_monto_asiento - v_iva, v_desc, 2);

    IF v_iva > 0 THEN
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_iva, 'haber', v_iva, 'IVA débito fiscal', 3);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- E. VALOR — trigger NUEVO: pata de clearing / rebote / anulación
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_asiento_auto_valor()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_valor   UUID;      -- 1.1.07 (recibido) / 2.1.07 (emitido)
    v_cuenta_banco   UUID;
    v_cuenta_contra  UUID;
    v_asiento_id     UUID;
    v_monto          NUMERIC(15,2);
    v_desc           TEXT;
    v_codigo_valor   TEXT;
    v_fecha          DATE;
BEGIN
    IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
    IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;

    v_monto := COALESCE(NEW.total_en_ars, NEW.monto);
    v_codigo_valor := CASE WHEN NEW.sentido = 'recibido' THEN '1.1.07' ELSE '2.1.07' END;
    SELECT id INTO v_cuenta_valor FROM plan_cuentas WHERE codigo = v_codigo_valor AND _deleted = false LIMIT 1;
    IF v_cuenta_valor IS NULL THEN
        RAISE NOTICE '[Contab] Valor %: cuenta % no encontrada — sin asiento.', NEW.id, v_codigo_valor;
        RETURN NEW;
    END IF;
    v_fecha := COALESCE(NEW.fecha_realizado, NEW.fecha_cobro, CURRENT_DATE);

    -- 1) CLEARING: recibido→cobrado/depositado · emitido→debitado
    IF ((NEW.sentido = 'recibido' AND NEW.estado IN ('cobrado','depositado'))
        OR (NEW.sentido = 'emitido' AND NEW.estado = 'debitado'))
       AND NEW.asiento_clearing_id IS NULL THEN

        IF NEW.cuenta_id IS NULL THEN
            RAISE NOTICE '[Contab] Valor % sin cuenta_id — clearing sin asiento.', NEW.id;
            RETURN NEW;
        END IF;
        SELECT id INTO v_cuenta_banco FROM plan_cuentas WHERE cuenta_financiera_id = NEW.cuenta_id AND _deleted = false LIMIT 1;
        IF v_cuenta_banco IS NULL THEN
            RAISE WARNING '[Contab] Valor %: cuenta financiera % sin vínculo contable.', NEW.id, NEW.cuenta_id;
            RETURN NEW;
        END IF;

        v_desc := 'Acreditación valor: ' || COALESCE(NEW.banco,'') || ' ' || COALESCE(NEW.numero,'');
        INSERT INTO asientos (fecha, concepto, tipo, cartera_valor_id, canal, total_debe, total_haber, moneda, cotizacion)
        VALUES (v_fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'),
                v_monto, v_monto, COALESCE(NEW.moneda,'ARS'), COALESCE(NEW.cotizacion,1))
        RETURNING id INTO v_asiento_id;

        IF NEW.sentido = 'recibido' THEN   -- DEBE banco / HABER 1.1.07
            INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
            VALUES (v_asiento_id, v_cuenta_banco, 'debe', v_monto, v_desc, 1);
            INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
            VALUES (v_asiento_id, v_cuenta_valor, 'haber', v_monto, v_desc, 2);
        ELSE                                -- DEBE 2.1.07 / HABER banco
            INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
            VALUES (v_asiento_id, v_cuenta_valor, 'debe', v_monto, v_desc, 1);
            INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
            VALUES (v_asiento_id, v_cuenta_banco, 'haber', v_monto, v_desc, 2);
        END IF;
        NEW.asiento_clearing_id := v_asiento_id;
        RETURN NEW;
    END IF;

    -- 2) REBOTE recibido: DEBE 1.1.08 Clientes / HABER 1.1.07 (la deuda vuelve)
    IF NEW.sentido = 'recibido' AND NEW.estado = 'rechazado' AND NEW.asiento_rechazo_id IS NULL THEN
        SELECT id INTO v_cuenta_contra FROM plan_cuentas WHERE codigo = '1.1.08' AND _deleted = false LIMIT 1;
        IF v_cuenta_contra IS NULL THEN RAISE NOTICE '[Contab] 1.1.08 no encontrada — rechazo % sin asiento.', NEW.id; RETURN NEW; END IF;
        v_desc := 'Cheque rechazado: ' || COALESCE(NEW.banco,'') || ' ' || COALESCE(NEW.numero,'');
        INSERT INTO asientos (fecha, concepto, tipo, cartera_valor_id, canal, total_debe, total_haber, moneda, cotizacion)
        VALUES (v_fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'), v_monto, v_monto, COALESCE(NEW.moneda,'ARS'), COALESCE(NEW.cotizacion,1))
        RETURNING id INTO v_asiento_id;
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden) VALUES (v_asiento_id, v_cuenta_contra, 'debe', v_monto, v_desc, 1);
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden) VALUES (v_asiento_id, v_cuenta_valor, 'haber', v_monto, v_desc, 2);
        NEW.asiento_rechazo_id := v_asiento_id;
        RETURN NEW;
    END IF;

    -- 3) ANULACIÓN emitido: DEBE 2.1.07 / HABER 2.1.01 Proveedores (la deuda vuelve a CxP)
    IF NEW.sentido = 'emitido' AND NEW.estado = 'anulado' AND NEW.asiento_rechazo_id IS NULL THEN
        SELECT id INTO v_cuenta_contra FROM plan_cuentas WHERE codigo = '2.1.01' AND _deleted = false LIMIT 1;
        IF v_cuenta_contra IS NULL THEN RAISE NOTICE '[Contab] 2.1.01 no encontrada — anulación % sin asiento.', NEW.id; RETURN NEW; END IF;
        v_desc := 'Cheque emitido anulado: ' || COALESCE(NEW.banco,'') || ' ' || COALESCE(NEW.numero,'');
        INSERT INTO asientos (fecha, concepto, tipo, cartera_valor_id, canal, total_debe, total_haber, moneda, cotizacion)
        VALUES (v_fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'), v_monto, v_monto, COALESCE(NEW.moneda,'ARS'), COALESCE(NEW.cotizacion,1))
        RETURNING id INTO v_asiento_id;
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden) VALUES (v_asiento_id, v_cuenta_valor, 'debe', v_monto, v_desc, 1);
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden) VALUES (v_asiento_id, v_cuenta_contra, 'haber', v_monto, v_desc, 2);
        NEW.asiento_rechazo_id := v_asiento_id;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asiento_auto_valor ON public.cartera_valores;
CREATE TRIGGER trg_asiento_auto_valor
    BEFORE UPDATE ON public.cartera_valores
    FOR EACH ROW EXECUTE FUNCTION public.fn_asiento_auto_valor();

-- ============================================================
-- TEST (correr por la UI cuando esté la pieza JS; limpiar al final)
-- ============================================================
-- A) Cobro con cheque (ingreso medio=cheque confirmado) → entrada DEBE 1.1.07 /
--    HABER 2.1.06 (o venta). El valor queda 'en_cartera'.
-- B) Valor recibido → 'cobrado' (con cuenta_id) → clearing DEBE banco / HABER 1.1.07.
--    1.1.07 neto = 0. Banco sube en fecha_realizado.
-- C) Pago con cheque (egreso medio=cheque pagado) → entrada DEBE gasto(+IVA) /
--    HABER 2.1.07. Valor 'en_cartera'.
-- D) Valor emitido → 'debitado' → clearing DEBE 2.1.07 / HABER banco. 2.1.07 = 0.
-- E) Cheque recibido → 'rechazado' → DEBE 1.1.08 / HABER 1.1.07.
-- Verificación:
--   SELECT codigo, sum(CASE WHEN tipo_movimiento='debe' THEN monto ELSE -monto END)
--   FROM asiento_lineas l JOIN plan_cuentas c ON c.id=l.cuenta_id
--   JOIN asientos a ON a.id=l.asiento_id WHERE a._deleted=false AND codigo IN ('1.1.07','2.1.07')
--   GROUP BY codigo;   -- ambos deben tender a 0 cuando todo cierra.
