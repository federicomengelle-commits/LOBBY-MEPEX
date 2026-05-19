-- =============================================
-- MEPEX Lobby — Finanzas Fase E: MULTI-MONEDA
-- =============================================
-- Agrega soporte ARS / USD / EUR con snapshot de cotización.
--
-- Tablas afectadas (8):
--   1. cuentas_financieras    (moneda nativa de la cuenta)
--   2. ingresos               (monto -> total_en_ars)
--   3. egresos                (monto -> total_en_ars)
--   4. comprobantes           (total -> total_en_ars)
--   5. comprobantes_recibidos (total -> total_en_ars)
--   6. comprobantes_iva_recovery (total -> total_en_ars)
--   7. asientos               (total_debe/_haber ya en ARS; moneda informativa)
--   8. transferencias_internas (monto -> total_en_ars)
--
-- Modelo:
--   moneda TEXT NOT NULL DEFAULT 'ARS' CHECK IN (ARS, USD, EUR)
--   cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1 (cuántos ARS = 1 unidad de moneda)
--   total_en_ars NUMERIC(15,2) — snapshot calculado por trigger BEFORE.
--
-- Reglas:
--   - moneda='ARS' → cotizacion siempre 1, total_en_ars = monto (o total).
--   - moneda!='ARS' → total_en_ars = monto * cotizacion.
--
-- Asientos contables:
--   Triggers fn_asiento_auto_ingreso/egreso actualizados para usar
--   total_en_ars (la contabilidad SIEMPRE va en ARS). Si la moneda
--   no es ARS, se agrega nota informativa al concepto.
--
-- Plan de cuentas:
--   Nuevas cuentas 4.2.02 (Diferencia de cambio +) y 5.4.02 (Dif. cambio -).
--   Idempotentes — INSERT solo si codigo no existe.
--   Mapeos 'dif_cambio_positiva' y 'dif_cambio_negativa' en mapeo_cuentas.
--
-- Diferencia de cambio automática:
--   NO se implementa en esta fase. Helper fn_registrar_diferencia_cambio
--   queda disponible para uso desde JS o futura automatización (Fase G).
--   La lógica end-to-end (cobro de factura USD con cotización distinta)
--   se completará cuando esté Fase D (ARCA) y el flujo de cobros maduro.
--
-- IDEMPOTENTE — re-ejecutar es seguro.
-- =============================================


-- ════════════════════════════════════════════════
--  E0 — Pre-check: trigger fn_asiento_auto_* parcheado
-- ════════════════════════════════════════════════
-- Si los triggers de asiento_auto no están en su versión fix
-- (sql/fix_trigger_asiento_auto.sql) los INSERTs en ingresos
-- con estado='confirmado' rompen. Esta fase asume que el fix
-- está aplicado. Sólo emite un NOTICE; no falla.

DO $$
DECLARE
    v_fn_def TEXT;
BEGIN
    SELECT pg_get_functiondef(p.oid) INTO v_fn_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'fn_asiento_auto_ingreso'
      AND n.nspname = 'public'
    LIMIT 1;

    IF v_fn_def IS NULL THEN
        RAISE NOTICE '[Fase E] fn_asiento_auto_ingreso no existe — se creará al final.';
    ELSIF v_fn_def LIKE '%tipo_movimiento%' AND v_fn_def LIKE '%concepto%' THEN
        RAISE NOTICE '[Fase E] fn_asiento_auto_ingreso tiene el fix base aplicado.';
    ELSE
        RAISE WARNING '[Fase E] fn_asiento_auto_ingreso NO tiene el fix base. Ejecutar sql/fix_trigger_asiento_auto.sql primero.';
    END IF;
END $$;


-- ════════════════════════════════════════════════
--  E1 — ALTER de las 8 tablas
-- ════════════════════════════════════════════════
-- Cada tabla recibe: moneda, cotizacion, total_en_ars.
-- Para tablas con columna 'monto'  → total_en_ars = monto * cotizacion.
-- Para tablas con columna 'total'  → total_en_ars = total * cotizacion.
-- cuentas_financieras: solo moneda (es el shape nativo de la cuenta).
-- asientos: moneda informativa; total_debe/_haber ya están en ARS.

-- 1) cuentas_financieras: la cuenta misma es de una moneda
ALTER TABLE cuentas_financieras
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_cuentas_financieras_moneda'
    ) THEN
        ALTER TABLE cuentas_financieras
            ADD CONSTRAINT chk_cuentas_financieras_moneda
            CHECK (moneda IN ('ARS', 'USD', 'EUR'));
    END IF;
END $$;

-- 2) ingresos
ALTER TABLE ingresos
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ingresos_moneda') THEN
        ALTER TABLE ingresos ADD CONSTRAINT chk_ingresos_moneda
            CHECK (moneda IN ('ARS', 'USD', 'EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ingresos_cotizacion_positiva') THEN
        ALTER TABLE ingresos ADD CONSTRAINT chk_ingresos_cotizacion_positiva
            CHECK (cotizacion > 0);
    END IF;
END $$;

-- 3) egresos
ALTER TABLE egresos
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_egresos_moneda') THEN
        ALTER TABLE egresos ADD CONSTRAINT chk_egresos_moneda
            CHECK (moneda IN ('ARS', 'USD', 'EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_egresos_cotizacion_positiva') THEN
        ALTER TABLE egresos ADD CONSTRAINT chk_egresos_cotizacion_positiva
            CHECK (cotizacion > 0);
    END IF;
END $$;

-- 4) comprobantes (emitidos)
ALTER TABLE comprobantes
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_comprobantes_moneda') THEN
        ALTER TABLE comprobantes ADD CONSTRAINT chk_comprobantes_moneda
            CHECK (moneda IN ('ARS', 'USD', 'EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_comprobantes_cotizacion_positiva') THEN
        ALTER TABLE comprobantes ADD CONSTRAINT chk_comprobantes_cotizacion_positiva
            CHECK (cotizacion > 0);
    END IF;
END $$;

-- 5) comprobantes_recibidos
ALTER TABLE comprobantes_recibidos
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_comprobantes_rec_moneda') THEN
        ALTER TABLE comprobantes_recibidos ADD CONSTRAINT chk_comprobantes_rec_moneda
            CHECK (moneda IN ('ARS', 'USD', 'EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_comprobantes_rec_cotizacion_positiva') THEN
        ALTER TABLE comprobantes_recibidos ADD CONSTRAINT chk_comprobantes_rec_cotizacion_positiva
            CHECK (cotizacion > 0);
    END IF;
END $$;

-- 6) comprobantes_iva_recovery
ALTER TABLE comprobantes_iva_recovery
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_civar_moneda') THEN
        ALTER TABLE comprobantes_iva_recovery ADD CONSTRAINT chk_civar_moneda
            CHECK (moneda IN ('ARS', 'USD', 'EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_civar_cotizacion_positiva') THEN
        ALTER TABLE comprobantes_iva_recovery ADD CONSTRAINT chk_civar_cotizacion_positiva
            CHECK (cotizacion > 0);
    END IF;
END $$;

-- 7) asientos: moneda + cotizacion meramente informativos (la BD contable va en ARS).
ALTER TABLE asientos
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_asientos_moneda') THEN
        ALTER TABLE asientos ADD CONSTRAINT chk_asientos_moneda
            CHECK (moneda IN ('ARS', 'USD', 'EUR'));
    END IF;
END $$;

-- 8) transferencias_internas
ALTER TABLE transferencias_internas
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transfer_moneda') THEN
        ALTER TABLE transferencias_internas ADD CONSTRAINT chk_transfer_moneda
            CHECK (moneda IN ('ARS', 'USD', 'EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transfer_cotizacion_positiva') THEN
        ALTER TABLE transferencias_internas ADD CONSTRAINT chk_transfer_cotizacion_positiva
            CHECK (cotizacion > 0);
    END IF;
END $$;


-- ════════════════════════════════════════════════
--  E2 — Función helper de cálculo
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_calcular_total_ars(
    p_monto NUMERIC,
    p_moneda TEXT,
    p_cotizacion NUMERIC
)
RETURNS NUMERIC AS $$
BEGIN
    -- Convención: cotización = cuántos ARS por 1 unidad de moneda extranjera.
    -- Si la moneda es ARS, la cotización debe ser 1 (lo forzamos defensivamente).
    IF p_monto IS NULL THEN RETURN NULL; END IF;
    IF p_moneda IS NULL OR p_moneda = 'ARS' THEN
        RETURN p_monto;
    END IF;
    IF p_cotizacion IS NULL OR p_cotizacion <= 0 THEN
        RETURN p_monto;  -- fallback defensivo: no romper
    END IF;
    RETURN ROUND(p_monto * p_cotizacion, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ════════════════════════════════════════════════
--  E3 — Triggers BEFORE INSERT/UPDATE para snapshot total_en_ars
-- ════════════════════════════════════════════════
-- Un trigger por tabla (los nombres de columna de monto difieren).
-- Todos: si moneda=ARS → cotizacion forzada a 1 y total_en_ars = monto base.

-- 3.1 — ingresos / egresos / transferencias_internas (columna 'monto')

CREATE OR REPLACE FUNCTION fn_snapshot_total_ars_monto()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.moneda IS NULL THEN NEW.moneda := 'ARS'; END IF;
    IF NEW.moneda = 'ARS' THEN NEW.cotizacion := 1; END IF;
    IF NEW.cotizacion IS NULL OR NEW.cotizacion <= 0 THEN NEW.cotizacion := 1; END IF;
    NEW.total_en_ars := fn_calcular_total_ars(NEW.monto, NEW.moneda, NEW.cotizacion);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_total_ars_ingresos ON ingresos;
CREATE TRIGGER trg_snapshot_total_ars_ingresos
    BEFORE INSERT OR UPDATE OF monto, moneda, cotizacion ON ingresos
    FOR EACH ROW EXECUTE FUNCTION fn_snapshot_total_ars_monto();

DROP TRIGGER IF EXISTS trg_snapshot_total_ars_egresos ON egresos;
CREATE TRIGGER trg_snapshot_total_ars_egresos
    BEFORE INSERT OR UPDATE OF monto, moneda, cotizacion ON egresos
    FOR EACH ROW EXECUTE FUNCTION fn_snapshot_total_ars_monto();

DROP TRIGGER IF EXISTS trg_snapshot_total_ars_transfer ON transferencias_internas;
CREATE TRIGGER trg_snapshot_total_ars_transfer
    BEFORE INSERT OR UPDATE OF monto, moneda, cotizacion ON transferencias_internas
    FOR EACH ROW EXECUTE FUNCTION fn_snapshot_total_ars_monto();

-- 3.2 — comprobantes / comprobantes_recibidos / comprobantes_iva_recovery (columna 'total')

CREATE OR REPLACE FUNCTION fn_snapshot_total_ars_total()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.moneda IS NULL THEN NEW.moneda := 'ARS'; END IF;
    IF NEW.moneda = 'ARS' THEN NEW.cotizacion := 1; END IF;
    IF NEW.cotizacion IS NULL OR NEW.cotizacion <= 0 THEN NEW.cotizacion := 1; END IF;
    NEW.total_en_ars := fn_calcular_total_ars(NEW.total, NEW.moneda, NEW.cotizacion);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_total_ars_comprobantes ON comprobantes;
CREATE TRIGGER trg_snapshot_total_ars_comprobantes
    BEFORE INSERT OR UPDATE OF total, moneda, cotizacion ON comprobantes
    FOR EACH ROW EXECUTE FUNCTION fn_snapshot_total_ars_total();

DROP TRIGGER IF EXISTS trg_snapshot_total_ars_comprobantes_rec ON comprobantes_recibidos;
CREATE TRIGGER trg_snapshot_total_ars_comprobantes_rec
    BEFORE INSERT OR UPDATE OF total, moneda, cotizacion ON comprobantes_recibidos
    FOR EACH ROW EXECUTE FUNCTION fn_snapshot_total_ars_total();

DROP TRIGGER IF EXISTS trg_snapshot_total_ars_civar ON comprobantes_iva_recovery;
CREATE TRIGGER trg_snapshot_total_ars_civar
    BEFORE INSERT OR UPDATE OF total, moneda, cotizacion ON comprobantes_iva_recovery
    FOR EACH ROW EXECUTE FUNCTION fn_snapshot_total_ars_total();

-- 3.3 — Backfill: filas existentes que tengan total_en_ars=NULL
UPDATE ingresos
    SET total_en_ars = fn_calcular_total_ars(monto, moneda, cotizacion)
    WHERE total_en_ars IS NULL;

UPDATE egresos
    SET total_en_ars = fn_calcular_total_ars(monto, moneda, cotizacion)
    WHERE total_en_ars IS NULL;

UPDATE transferencias_internas
    SET total_en_ars = fn_calcular_total_ars(monto, moneda, cotizacion)
    WHERE total_en_ars IS NULL;

UPDATE comprobantes
    SET total_en_ars = fn_calcular_total_ars(total, moneda, cotizacion)
    WHERE total_en_ars IS NULL;

UPDATE comprobantes_recibidos
    SET total_en_ars = fn_calcular_total_ars(total, moneda, cotizacion)
    WHERE total_en_ars IS NULL;

UPDATE comprobantes_iva_recovery
    SET total_en_ars = fn_calcular_total_ars(total, moneda, cotizacion)
    WHERE total_en_ars IS NULL;


-- ════════════════════════════════════════════════
--  E4 — Plan de cuentas: cuentas de diferencia de cambio
-- ════════════════════════════════════════════════
-- Estructura argentina típica:
--   4 — Resultados positivos (Ingresos)
--     4.2 — Resultados financieros positivos
--       4.2.02 — Diferencia de cambio positiva (ganancia)
--   5 — Resultados negativos (Egresos)
--     5.4 — Resultados financieros negativos
--       5.4.02 — Diferencia de cambio negativa (pérdida)
--
-- Idempotente: solo inserta si el codigo no existe.
-- Asume que ya existen 4, 4.2, 5, 5.4 como cuentas padre.
-- Si no existen, las crea como grupo no imputable.

-- IMPORTANTE: heredamos `tipo` de las cuentas raíz 4 y 5 — NO hardcodeamos.
-- El CHECK de plan_cuentas.tipo en prod puede usar enums distintos a
-- 'resultado_positivo' / 'resultado_negativo'. Leemos el valor real del padre.
DO $$
DECLARE
    v_id_42       UUID;
    v_id_54       UUID;
    v_id_4        UUID;
    v_id_5        UUID;
    v_tipo_pos    TEXT;
    v_tipo_neg    TEXT;
    v_existe      BOOLEAN;
BEGIN
    -- 4 — Resultados positivos (debe existir; si no, abort y avisar)
    SELECT id, tipo INTO v_id_4, v_tipo_pos
    FROM plan_cuentas WHERE codigo = '4' AND _deleted = false LIMIT 1;
    IF v_id_4 IS NULL THEN
        RAISE WARNING '[Fase E] Cuenta raíz "4" no existe. Skip seed de diferencias de cambio +.';
        v_tipo_pos := NULL;
    END IF;

    -- 5 — Resultados negativos (debe existir; si no, abort y avisar)
    SELECT id, tipo INTO v_id_5, v_tipo_neg
    FROM plan_cuentas WHERE codigo = '5' AND _deleted = false LIMIT 1;
    IF v_id_5 IS NULL THEN
        RAISE WARNING '[Fase E] Cuenta raíz "5" no existe. Skip seed de diferencias de cambio -.';
        v_tipo_neg := NULL;
    END IF;

    -- 4.2 — Resultados financieros positivos
    IF v_tipo_pos IS NOT NULL THEN
        SELECT id INTO v_id_42 FROM plan_cuentas WHERE codigo = '4.2' AND _deleted = false LIMIT 1;
        IF v_id_42 IS NULL THEN
            INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, codigo_padre, es_grupo, naturaleza, activa, imputable, orden)
            VALUES ('4.2', 'Resultados financieros positivos', v_tipo_pos, 2, '4', true, 'acreedora', true, false, 420)
            RETURNING id INTO v_id_42;
            RAISE NOTICE '[Fase E] Cuenta 4.2 creada (tipo=%)', v_tipo_pos;
        END IF;

        -- 4.2.02 — Diferencia de cambio positiva
        SELECT EXISTS (SELECT 1 FROM plan_cuentas WHERE codigo = '4.2.02' AND _deleted = false) INTO v_existe;
        IF NOT v_existe THEN
            INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, codigo_padre, es_grupo, naturaleza, activa, imputable, orden, notas)
            VALUES ('4.2.02', 'Diferencia de cambio positiva', v_tipo_pos, 3, '4.2', false, 'acreedora', true, true, 422,
                    'Ganancia por variación cotización USD/EUR entre emisión y cobro/pago.');
            RAISE NOTICE '[Fase E] Cuenta 4.2.02 creada.';
        ELSE
            RAISE NOTICE '[Fase E] Cuenta 4.2.02 ya existe — skip.';
        END IF;
    END IF;

    -- 5.4 — Resultados financieros negativos
    IF v_tipo_neg IS NOT NULL THEN
        SELECT id INTO v_id_54 FROM plan_cuentas WHERE codigo = '5.4' AND _deleted = false LIMIT 1;
        IF v_id_54 IS NULL THEN
            INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, codigo_padre, es_grupo, naturaleza, activa, imputable, orden)
            VALUES ('5.4', 'Resultados financieros negativos', v_tipo_neg, 2, '5', true, 'deudora', true, false, 540)
            RETURNING id INTO v_id_54;
            RAISE NOTICE '[Fase E] Cuenta 5.4 creada (tipo=%)', v_tipo_neg;
        END IF;

        -- 5.4.02 — Diferencia de cambio negativa
        SELECT EXISTS (SELECT 1 FROM plan_cuentas WHERE codigo = '5.4.02' AND _deleted = false) INTO v_existe;
        IF NOT v_existe THEN
            INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, codigo_padre, es_grupo, naturaleza, activa, imputable, orden, notas)
            VALUES ('5.4.02', 'Diferencia de cambio negativa', v_tipo_neg, 3, '5.4', false, 'deudora', true, true, 542,
                    'Pérdida por variación cotización USD/EUR entre emisión y cobro/pago.');
            RAISE NOTICE '[Fase E] Cuenta 5.4.02 creada.';
        ELSE
            RAISE NOTICE '[Fase E] Cuenta 5.4.02 ya existe — skip.';
        END IF;
    END IF;
END $$;


-- Mapeos en mapeo_cuentas para uso desde JS / triggers
DO $$
DECLARE
    v_cuenta_id UUID;
BEGIN
    -- dif_cambio_positiva → 4.2.02
    SELECT id INTO v_cuenta_id FROM plan_cuentas WHERE codigo = '4.2.02' AND _deleted = false LIMIT 1;
    IF v_cuenta_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM mapeo_cuentas WHERE clave = 'dif_cambio_positiva' AND _deleted = false) THEN
            INSERT INTO mapeo_cuentas (clave, cuenta_id, descripcion)
            VALUES ('dif_cambio_positiva', v_cuenta_id, 'Ganancia por diferencia de cambio (moneda extranjera).');
            RAISE NOTICE '[Fase E] Mapeo "dif_cambio_positiva" → 4.2.02 creado.';
        END IF;
    END IF;

    -- dif_cambio_negativa → 5.4.02
    SELECT id INTO v_cuenta_id FROM plan_cuentas WHERE codigo = '5.4.02' AND _deleted = false LIMIT 1;
    IF v_cuenta_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM mapeo_cuentas WHERE clave = 'dif_cambio_negativa' AND _deleted = false) THEN
            INSERT INTO mapeo_cuentas (clave, cuenta_id, descripcion)
            VALUES ('dif_cambio_negativa', v_cuenta_id, 'Pérdida por diferencia de cambio (moneda extranjera).');
            RAISE NOTICE '[Fase E] Mapeo "dif_cambio_negativa" → 5.4.02 creado.';
        END IF;
    END IF;
END $$;


-- ════════════════════════════════════════════════
--  E5 — Actualizar fn_asiento_auto_ingreso/egreso para usar total_en_ars
-- ════════════════════════════════════════════════
-- La contabilidad SIEMPRE va en ARS. Si el ingreso/egreso es en moneda
-- extranjera, el asiento toma el valor convertido (total_en_ars) y se
-- agrega nota al concepto con la moneda original.

CREATE OR REPLACE FUNCTION fn_asiento_auto_ingreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo   UUID;
    v_cuenta_ingreso  UUID;
    v_asiento_id      UUID;
    v_desc            TEXT;
    v_monto_asiento   NUMERIC(15,2);
    v_clave_mapeo     TEXT;
BEGIN
    -- Solo cuando pasa a 'confirmado'
    IF NEW.estado IS DISTINCT FROM 'confirmado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'confirmado' THEN RETURN NEW; END IF;

    IF NEW.cuenta_id IS NULL THEN
        RAISE NOTICE '[Contabilidad] Ingreso % sin cuenta_id, no se generó asiento.', NEW.id;
        RETURN NEW;
    END IF;

    -- Cuenta contable de activo vinculada a la cuenta financiera
    SELECT id INTO v_cuenta_activo
    FROM plan_cuentas
    WHERE cuenta_financiera_id = NEW.cuenta_id
      AND _deleted = false
    LIMIT 1;

    IF v_cuenta_activo IS NULL THEN
        RAISE WARNING '[Contabilidad] Ingreso %: cuenta financiera % sin vínculo contable.', NEW.id, NEW.cuenta_id;
        RETURN NEW;
    END IF;

    -- Cuenta de ingreso vía mapeo
    v_clave_mapeo := 'ingreso_otros';
    SELECT cuenta_id INTO v_cuenta_ingreso
    FROM mapeo_cuentas
    WHERE clave = v_clave_mapeo AND _deleted = false
    LIMIT 1;

    IF v_cuenta_ingreso IS NULL THEN
        RAISE WARNING '[Contabilidad] No hay mapeo "ingreso_otros". Ingreso % sin asiento.', NEW.id;
        RETURN NEW;
    END IF;

    -- Monto del asiento: SIEMPRE en ARS (usa el snapshot)
    v_monto_asiento := COALESCE(NEW.total_en_ars, NEW.monto);

    -- Descripción: si es moneda extranjera, anotarlo
    v_desc := 'Ingreso: ' || COALESCE(NEW.concepto, 'Sin concepto');
    IF NEW.moneda IS NOT NULL AND NEW.moneda <> 'ARS' THEN
        v_desc := v_desc || ' [' || NEW.moneda || ' ' || NEW.monto::TEXT
               || ' @ ' || NEW.cotizacion::TEXT || ']';
    END IF;

    -- Cabecera (asientos: 'concepto', NO 'estado')
    INSERT INTO asientos (fecha, concepto, tipo, ingreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'),
            v_monto_asiento, v_monto_asiento,
            COALESCE(NEW.moneda, 'ARS'), COALESCE(NEW.cotizacion, 1))
    RETURNING id INTO v_asiento_id;

    -- DEBE: cuenta financiera (activo)
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'debe', v_monto_asiento, v_desc, 1);

    -- HABER: ingreso
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_ingreso, 'haber', v_monto_asiento, v_desc, 2);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION fn_asiento_auto_egreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo  UUID;
    v_cuenta_gasto   UUID;
    v_asiento_id     UUID;
    v_desc           TEXT;
    v_monto_asiento  NUMERIC(15,2);
    v_clave_mapeo    TEXT;
BEGIN
    IF NEW.estado IS DISTINCT FROM 'pagado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'pagado' THEN RETURN NEW; END IF;

    IF NEW.cuenta_id IS NULL THEN
        RAISE NOTICE '[Contabilidad] Egreso % sin cuenta_id, no se generó asiento.', NEW.id;
        RETURN NEW;
    END IF;

    SELECT id INTO v_cuenta_activo
    FROM plan_cuentas
    WHERE cuenta_financiera_id = NEW.cuenta_id
      AND _deleted = false
    LIMIT 1;

    IF v_cuenta_activo IS NULL THEN
        RAISE WARNING '[Contabilidad] Egreso %: cuenta financiera % sin vínculo contable.', NEW.id, NEW.cuenta_id;
        RETURN NEW;
    END IF;

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
        RAISE WARNING '[Contabilidad] No hay mapeo "egreso_*". Egreso % sin asiento.', NEW.id;
        RETURN NEW;
    END IF;

    v_monto_asiento := COALESCE(NEW.total_en_ars, NEW.monto);

    v_desc := 'Egreso: ' || COALESCE(NEW.concepto, 'Sin concepto');
    IF NEW.moneda IS NOT NULL AND NEW.moneda <> 'ARS' THEN
        v_desc := v_desc || ' [' || NEW.moneda || ' ' || NEW.monto::TEXT
               || ' @ ' || NEW.cotizacion::TEXT || ']';
    END IF;

    INSERT INTO asientos (fecha, concepto, tipo, egreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'),
            v_monto_asiento, v_monto_asiento,
            COALESCE(NEW.moneda, 'ARS'), COALESCE(NEW.cotizacion, 1))
    RETURNING id INTO v_asiento_id;

    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_gasto, 'debe', v_monto_asiento, v_desc, 1);

    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'haber', v_monto_asiento, v_desc, 2);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (idempotente)
DROP TRIGGER IF EXISTS trg_asiento_auto_ingreso ON ingresos;
CREATE TRIGGER trg_asiento_auto_ingreso
    AFTER INSERT OR UPDATE OF estado ON ingresos
    FOR EACH ROW EXECUTE FUNCTION fn_asiento_auto_ingreso();

DROP TRIGGER IF EXISTS trg_asiento_auto_egreso ON egresos;
CREATE TRIGGER trg_asiento_auto_egreso
    AFTER INSERT OR UPDATE OF estado ON egresos
    FOR EACH ROW EXECUTE FUNCTION fn_asiento_auto_egreso();


-- ════════════════════════════════════════════════
--  E6 — Helper de diferencia de cambio (opcional, uso futuro)
-- ════════════════════════════════════════════════
-- No se invoca automáticamente desde los triggers. Pensado para que
-- el JS lo llame manualmente cuando aplica un cobro a una factura con
-- cotización diferente. El asiento generado es manual (tipo='manual').
--
-- Argumentos:
--   p_ingreso_id  → ingreso que genera el ajuste
--   p_monto       → monto de la diferencia en ARS (signed: + ganancia, − pérdida)
--   p_actor       → quién lo dispara (auditoría)

CREATE OR REPLACE FUNCTION fn_registrar_diferencia_cambio(
    p_ingreso_id UUID,
    p_monto_ars NUMERIC,
    p_actor UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_ingreso        RECORD;
    v_cuenta_activo  UUID;
    v_cuenta_dif     UUID;
    v_clave          TEXT;
    v_asiento_id     UUID;
    v_desc           TEXT;
    v_monto_abs      NUMERIC(15,2);
BEGIN
    IF p_monto_ars IS NULL OR p_monto_ars = 0 THEN
        RAISE NOTICE 'fn_registrar_diferencia_cambio: monto 0, skip.';
        RETURN NULL;
    END IF;

    SELECT * INTO v_ingreso FROM ingresos WHERE id = p_ingreso_id LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ingreso % no encontrado.', p_ingreso_id;
    END IF;

    -- Cuenta del activo (la cuenta financiera del cobro)
    SELECT id INTO v_cuenta_activo
    FROM plan_cuentas
    WHERE cuenta_financiera_id = v_ingreso.cuenta_id AND _deleted = false
    LIMIT 1;

    IF v_cuenta_activo IS NULL THEN
        RAISE EXCEPTION 'Ingreso %: cuenta financiera sin vínculo contable.', p_ingreso_id;
    END IF;

    -- Cuenta de diferencia según signo
    v_clave := CASE WHEN p_monto_ars > 0 THEN 'dif_cambio_positiva' ELSE 'dif_cambio_negativa' END;
    SELECT cuenta_id INTO v_cuenta_dif
    FROM mapeo_cuentas
    WHERE clave = v_clave AND _deleted = false
    LIMIT 1;

    IF v_cuenta_dif IS NULL THEN
        RAISE EXCEPTION 'Mapeo % no existe en mapeo_cuentas.', v_clave;
    END IF;

    v_monto_abs := ABS(p_monto_ars);
    v_desc := 'Dif. cambio sobre ingreso ' || COALESCE(v_ingreso.concepto, p_ingreso_id::TEXT)
           || ' (' || v_ingreso.moneda || ' @ ' || v_ingreso.cotizacion::TEXT || ')';

    INSERT INTO asientos (fecha, concepto, tipo, ingreso_id, canal,
                          total_debe, total_haber, moneda, cotizacion, created_by)
    VALUES (v_ingreso.fecha, v_desc, 'manual', p_ingreso_id, COALESCE(v_ingreso.canal,'oficial'),
            v_monto_abs, v_monto_abs, 'ARS', 1, p_actor)
    RETURNING id INTO v_asiento_id;

    IF p_monto_ars > 0 THEN
        -- Ganancia: DEBE activo, HABER 4.2.02
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_activo, 'debe', v_monto_abs, v_desc, 1);
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_dif, 'haber', v_monto_abs, v_desc, 2);
    ELSE
        -- Pérdida: DEBE 5.4.02, HABER activo
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_dif, 'debe', v_monto_abs, v_desc, 1);
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_activo, 'haber', v_monto_abs, v_desc, 2);
    END IF;

    RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════
--  E7 — Índices útiles para filtros por moneda
-- ════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_ingresos_moneda
    ON ingresos(moneda) WHERE _deleted = false AND moneda <> 'ARS';
CREATE INDEX IF NOT EXISTS idx_egresos_moneda
    ON egresos(moneda) WHERE _deleted = false AND moneda <> 'ARS';
CREATE INDEX IF NOT EXISTS idx_comprobantes_moneda
    ON comprobantes(moneda) WHERE _deleted = false AND moneda <> 'ARS';
CREATE INDEX IF NOT EXISTS idx_comprobantes_rec_moneda
    ON comprobantes_recibidos(moneda) WHERE _deleted = false AND moneda <> 'ARS';


-- ════════════════════════════════════════════════
--  Cierre — resumen
-- ════════════════════════════════════════════════
DO $$
DECLARE
    v_ing_extranjeros  INT;
    v_egr_extranjeros  INT;
    v_comp_extranjeros INT;
BEGIN
    SELECT COUNT(*) INTO v_ing_extranjeros  FROM ingresos                WHERE moneda <> 'ARS' AND _deleted = false;
    SELECT COUNT(*) INTO v_egr_extranjeros  FROM egresos                 WHERE moneda <> 'ARS' AND _deleted = false;
    SELECT COUNT(*) INTO v_comp_extranjeros FROM comprobantes            WHERE moneda <> 'ARS' AND _deleted = false;

    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Fase E — Multi-moneda completada.';
    RAISE NOTICE '  E1 ✓ 8 tablas con moneda/cotizacion/total_en_ars';
    RAISE NOTICE '  E2 ✓ fn_calcular_total_ars';
    RAISE NOTICE '  E3 ✓ Triggers BEFORE INSERT/UPDATE para snapshot';
    RAISE NOTICE '  E4 ✓ Plan de cuentas 4.2.02 + 5.4.02 + mapeos';
    RAISE NOTICE '  E5 ✓ fn_asiento_auto_ingreso/egreso → usan total_en_ars';
    RAISE NOTICE '  E6 ✓ fn_registrar_diferencia_cambio (helper, uso futuro)';
    RAISE NOTICE '  E7 ✓ Índices parciales por moneda';
    RAISE NOTICE '  → Movimientos en moneda extranjera actuales: % ing / % egr / % comp', v_ing_extranjeros, v_egr_extranjeros, v_comp_extranjeros;
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Próximos pasos:';
    RAISE NOTICE '  • UI selector de moneda en wizards Finanzas (finanzas.js)';
    RAISE NOTICE '  • Diferencia de cambio AUTOMÁTICA (cobro con cot. distinta) — Fase G';
    RAISE NOTICE '  • Cotización sugerida BCRA — opcional cachear en api.js';
END $$;
