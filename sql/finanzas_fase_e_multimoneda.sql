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
--   Schema real de mapeo_cuentas: tipo_movimiento + campo_origen +
--   valor_origen + cuenta_contable_id + posicion.
--
-- Cuentas de diferencia de cambio (4.2.02 / 5.4.02) y mapeos:
--   NO se crean en esta fase — quedaron diferidos a Fase G cuando definamos
--   el plan de cuentas final. Helper fn_registrar_diferencia_cambio recibe
--   las cuentas como parámetro para no depender de mapeos previos.
--
-- IDEMPOTENTE — re-ejecutar es seguro.
-- =============================================


-- ════════════════════════════════════════════════
--  E1 — ALTER de las 8 tablas
-- ════════════════════════════════════════════════

-- 1) cuentas_financieras: la cuenta misma es de una moneda
ALTER TABLE cuentas_financieras
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cuentas_financieras_moneda') THEN
        ALTER TABLE cuentas_financieras ADD CONSTRAINT chk_cuentas_financieras_moneda
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
        ALTER TABLE ingresos ADD CONSTRAINT chk_ingresos_moneda CHECK (moneda IN ('ARS','USD','EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ingresos_cotizacion_positiva') THEN
        ALTER TABLE ingresos ADD CONSTRAINT chk_ingresos_cotizacion_positiva CHECK (cotizacion > 0);
    END IF;
END $$;

-- 3) egresos
ALTER TABLE egresos
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_egresos_moneda') THEN
        ALTER TABLE egresos ADD CONSTRAINT chk_egresos_moneda CHECK (moneda IN ('ARS','USD','EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_egresos_cotizacion_positiva') THEN
        ALTER TABLE egresos ADD CONSTRAINT chk_egresos_cotizacion_positiva CHECK (cotizacion > 0);
    END IF;
END $$;

-- 4) comprobantes (emitidos)
ALTER TABLE comprobantes
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_comprobantes_moneda') THEN
        ALTER TABLE comprobantes ADD CONSTRAINT chk_comprobantes_moneda CHECK (moneda IN ('ARS','USD','EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_comprobantes_cotizacion_positiva') THEN
        ALTER TABLE comprobantes ADD CONSTRAINT chk_comprobantes_cotizacion_positiva CHECK (cotizacion > 0);
    END IF;
END $$;

-- 5) comprobantes_recibidos
ALTER TABLE comprobantes_recibidos
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_comprobantes_rec_moneda') THEN
        ALTER TABLE comprobantes_recibidos ADD CONSTRAINT chk_comprobantes_rec_moneda CHECK (moneda IN ('ARS','USD','EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_comprobantes_rec_cotizacion_positiva') THEN
        ALTER TABLE comprobantes_recibidos ADD CONSTRAINT chk_comprobantes_rec_cotizacion_positiva CHECK (cotizacion > 0);
    END IF;
END $$;

-- 6) comprobantes_iva_recovery
ALTER TABLE comprobantes_iva_recovery
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_civar_moneda') THEN
        ALTER TABLE comprobantes_iva_recovery ADD CONSTRAINT chk_civar_moneda CHECK (moneda IN ('ARS','USD','EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_civar_cotizacion_positiva') THEN
        ALTER TABLE comprobantes_iva_recovery ADD CONSTRAINT chk_civar_cotizacion_positiva CHECK (cotizacion > 0);
    END IF;
END $$;

-- 7) asientos: moneda + cotizacion meramente informativos (la BD contable va en ARS).
ALTER TABLE asientos
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_asientos_moneda') THEN
        ALTER TABLE asientos ADD CONSTRAINT chk_asientos_moneda CHECK (moneda IN ('ARS','USD','EUR'));
    END IF;
END $$;

-- 8) transferencias_internas
ALTER TABLE transferencias_internas
    ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS',
    ADD COLUMN IF NOT EXISTS cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transfer_moneda') THEN
        ALTER TABLE transferencias_internas ADD CONSTRAINT chk_transfer_moneda CHECK (moneda IN ('ARS','USD','EUR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transfer_cotizacion_positiva') THEN
        ALTER TABLE transferencias_internas ADD CONSTRAINT chk_transfer_cotizacion_positiva CHECK (cotizacion > 0);
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
    IF p_monto IS NULL THEN RETURN NULL; END IF;
    IF p_moneda IS NULL OR p_moneda = 'ARS' THEN
        RETURN p_monto;
    END IF;
    IF p_cotizacion IS NULL OR p_cotizacion <= 0 THEN
        RETURN p_monto;  -- fallback defensivo
    END IF;
    RETURN ROUND(p_monto * p_cotizacion, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ════════════════════════════════════════════════
--  E3 — Triggers BEFORE INSERT/UPDATE para snapshot total_en_ars
-- ════════════════════════════════════════════════

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

-- 3.3 — Backfill: filas existentes con total_en_ars=NULL
UPDATE ingresos                SET total_en_ars = fn_calcular_total_ars(monto, moneda, cotizacion) WHERE total_en_ars IS NULL;
UPDATE egresos                 SET total_en_ars = fn_calcular_total_ars(monto, moneda, cotizacion) WHERE total_en_ars IS NULL;
UPDATE transferencias_internas SET total_en_ars = fn_calcular_total_ars(monto, moneda, cotizacion) WHERE total_en_ars IS NULL;
UPDATE comprobantes            SET total_en_ars = fn_calcular_total_ars(total, moneda, cotizacion) WHERE total_en_ars IS NULL;
UPDATE comprobantes_recibidos  SET total_en_ars = fn_calcular_total_ars(total, moneda, cotizacion) WHERE total_en_ars IS NULL;
UPDATE comprobantes_iva_recovery SET total_en_ars = fn_calcular_total_ars(total, moneda, cotizacion) WHERE total_en_ars IS NULL;


-- ════════════════════════════════════════════════
--  E4 — Plan de cuentas de diferencia de cambio
-- ════════════════════════════════════════════════
-- DEFERIDO A FASE G. Las cuentas 4.2 y 4.2.02 ya existen en prod con
-- otro significado ("Otros ingresos"); los códigos finales se definirán
-- al diseñar el plan contable definitivo. Por ahora dejamos pendiente.
--
-- Cuando se necesiten, crear manualmente desde el módulo Contabilidad
-- (UI plan_cuentas) o con un SQL ad-hoc. fn_registrar_diferencia_cambio
-- (E6 abajo) recibe las cuentas como parámetros para no depender de
-- mapeos pre-existentes.


-- ════════════════════════════════════════════════
--  E5 — fn_asiento_auto_ingreso/egreso actualizados
-- ════════════════════════════════════════════════
-- Reemplaza versiones previas. Cambios respecto al fix_trigger_asiento_auto:
--   1. Schema REAL de mapeo_cuentas (tipo_movimiento + campo_origen +
--      valor_origen + cuenta_contable_id + posicion). NO `clave`/`cuenta_id`.
--   2. Monto del asiento usa total_en_ars (siempre ARS).
--   3. Si moneda extranjera, nota en concepto: "[USD 100 @ 1420]".
--   4. Si los mapeos no existen, sale en silencio sin romper (mismo
--      comportamiento anterior — el ingreso queda registrado sin asiento).
--
-- Estrategia de búsqueda de cuenta contable:
--   a) Match específico: tipo_movimiento + campo_origen='categoria'/'medio' + valor_origen
--   b) Fallback: tipo_movimiento sin filtro de campo (mapeo genérico)
--
-- Si nada matchea, no se genera asiento.

CREATE OR REPLACE FUNCTION fn_asiento_auto_ingreso()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_activo   UUID;
    v_cuenta_ingreso  UUID;
    v_asiento_id      UUID;
    v_desc            TEXT;
    v_monto_asiento   NUMERIC(15,2);
BEGIN
    -- Solo cuando pasa a 'confirmado'
    IF NEW.estado IS DISTINCT FROM 'confirmado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'confirmado' THEN RETURN NEW; END IF;

    IF NEW.cuenta_id IS NULL THEN
        RAISE NOTICE '[Contabilidad] Ingreso % sin cuenta_id — sin asiento.', NEW.id;
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

    -- Cuenta de ingreso vía mapeo_cuentas (schema real)
    -- Buscamos por tipo_movimiento='ingreso' + match específico por medio o genérico.
    SELECT cuenta_contable_id INTO v_cuenta_ingreso
    FROM mapeo_cuentas
    WHERE tipo_movimiento = 'ingreso'
      AND activo = true
      AND _deleted = false
      AND (
          (campo_origen = 'medio'   AND valor_origen = NEW.medio)
       OR (campo_origen = 'canal'   AND valor_origen = NEW.canal)
       OR (campo_origen IS NULL)
      )
    ORDER BY CASE WHEN campo_origen IS NOT NULL THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_cuenta_ingreso IS NULL THEN
        RAISE NOTICE '[Contabilidad] No hay mapeo para ingreso. Ingreso % sin asiento.', NEW.id;
        RETURN NEW;
    END IF;

    -- Monto del asiento: SIEMPRE en ARS (snapshot)
    v_monto_asiento := COALESCE(NEW.total_en_ars, NEW.monto);

    -- Descripción
    v_desc := 'Ingreso: ' || COALESCE(NEW.concepto, 'Sin concepto');
    IF NEW.moneda IS NOT NULL AND NEW.moneda <> 'ARS' THEN
        v_desc := v_desc || ' [' || NEW.moneda || ' ' || NEW.monto::TEXT
               || ' @ ' || NEW.cotizacion::TEXT || ']';
    END IF;

    INSERT INTO asientos (fecha, concepto, tipo, ingreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'),
            v_monto_asiento, v_monto_asiento,
            COALESCE(NEW.moneda, 'ARS'), COALESCE(NEW.cotizacion, 1))
    RETURNING id INTO v_asiento_id;

    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'debe', v_monto_asiento, v_desc, 1);

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
BEGIN
    IF NEW.estado IS DISTINCT FROM 'pagado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'pagado' THEN RETURN NEW; END IF;

    IF NEW.cuenta_id IS NULL THEN
        RAISE NOTICE '[Contabilidad] Egreso % sin cuenta_id — sin asiento.', NEW.id;
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

    -- Match por categoría primero, después genérico
    SELECT cuenta_contable_id INTO v_cuenta_gasto
    FROM mapeo_cuentas
    WHERE tipo_movimiento = 'egreso'
      AND activo = true
      AND _deleted = false
      AND (
          (campo_origen = 'categoria' AND valor_origen = NEW.categoria)
       OR (campo_origen IS NULL)
      )
    ORDER BY CASE WHEN campo_origen IS NOT NULL THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_cuenta_gasto IS NULL THEN
        RAISE NOTICE '[Contabilidad] No hay mapeo para egreso categoria=%. Egreso % sin asiento.', NEW.categoria, NEW.id;
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
--  E6 — Helper de diferencia de cambio (uso futuro)
-- ════════════════════════════════════════════════
-- Recibe las cuentas como parámetros (NO depende de mapeo_cuentas).
-- Pensado para que el JS lo invoque cuando aplica un cobro a una factura
-- con cotización distinta. Automatización en Fase G.
--
-- Args:
--   p_ingreso_id      → ingreso de referencia
--   p_monto_ars       → monto signed (+ ganancia, − pérdida)
--   p_cuenta_pos_id   → cuenta contable para ganancia (uuid)
--   p_cuenta_neg_id   → cuenta contable para pérdida (uuid)
--   p_actor           → quién lo dispara
-- Devuelve: asiento_id

CREATE OR REPLACE FUNCTION fn_registrar_diferencia_cambio(
    p_ingreso_id    UUID,
    p_monto_ars     NUMERIC,
    p_cuenta_pos_id UUID,
    p_cuenta_neg_id UUID,
    p_actor         UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_ingreso        RECORD;
    v_cuenta_activo  UUID;
    v_cuenta_dif     UUID;
    v_asiento_id     UUID;
    v_desc           TEXT;
    v_monto_abs      NUMERIC(15,2);
BEGIN
    IF p_monto_ars IS NULL OR p_monto_ars = 0 THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_ingreso FROM ingresos WHERE id = p_ingreso_id LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ingreso % no encontrado.', p_ingreso_id;
    END IF;

    SELECT id INTO v_cuenta_activo
    FROM plan_cuentas
    WHERE cuenta_financiera_id = v_ingreso.cuenta_id AND _deleted = false
    LIMIT 1;

    IF v_cuenta_activo IS NULL THEN
        RAISE EXCEPTION 'Ingreso %: cuenta financiera sin vínculo contable.', p_ingreso_id;
    END IF;

    v_cuenta_dif := CASE WHEN p_monto_ars > 0 THEN p_cuenta_pos_id ELSE p_cuenta_neg_id END;
    IF v_cuenta_dif IS NULL THEN
        RAISE EXCEPTION 'fn_registrar_diferencia_cambio: cuenta % requerida.',
            CASE WHEN p_monto_ars > 0 THEN 'positiva' ELSE 'negativa' END;
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
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_activo, 'debe', v_monto_abs, v_desc, 1);
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_dif, 'haber', v_monto_abs, v_desc, 2);
    ELSE
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
    RAISE NOTICE '  E3 ✓ Triggers BEFORE INSERT/UPDATE para snapshot + backfill';
    RAISE NOTICE '  E4 ⏸ Plan cuentas dif. cambio — diferido a Fase G';
    RAISE NOTICE '  E5 ✓ fn_asiento_auto_ingreso/egreso → schema real mapeo_cuentas + total_en_ars';
    RAISE NOTICE '  E6 ✓ fn_registrar_diferencia_cambio (recibe cuentas como params)';
    RAISE NOTICE '  E7 ✓ Índices parciales por moneda';
    RAISE NOTICE '  → Movimientos en moneda extranjera actuales: % ing / % egr / % comp', v_ing_extranjeros, v_egr_extranjeros, v_comp_extranjeros;
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Para que se generen asientos automáticos, falta seedear';
    RAISE NOTICE 'mapeo_cuentas con tipo_movimiento=ingreso/egreso. Mientras';
    RAISE NOTICE 'no haya mapeos, los ingresos/egresos se guardan sin asiento';
    RAISE NOTICE '(mismo comportamiento que antes de Fase E).';
END $$;
