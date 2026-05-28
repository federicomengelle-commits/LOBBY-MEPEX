-- ════════════════════════════════════════════════════════════════════════════
--  FASE G.5 — Planes de pagos y vencimientos recurrentes en moneda extranjera
-- ════════════════════════════════════════════════════════════════════════════
--
-- Extiende plan_cobro / plan_cobro_items / vencimientos_recurrentes /
-- vencimientos_generados con `moneda` + `cotizacion` + `total_en_ars`
-- siguiendo el mismo patrón que Fase E (ingresos/egresos/comprobantes).
--
-- Reglas:
--   - Un plan_cobro tiene UNA moneda. Las cuotas (plan_cobro_items) heredan
--     moneda + cotización del plan al INSERT si no se especifican.
--   - total_en_ars se materializa por trigger: monto * cotizacion. La
--     contabilidad sigue trabajando siempre en ARS via este snapshot.
--   - Cuando se aplica un cobro (ingreso vinculado a una cuota) con cotización
--     distinta a la del plan, el flujo G.3 (dif. cambio automática) ya
--     dispara el asiento de diferencia sin tocar este schema.
--   - vencimientos_recurrentes/generados también soportan ME para alquileres
--     o servicios facturados en USD.
--
-- Idempotente. Backfill con moneda='ARS' / cotizacion=1 / total_en_ars=monto.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── G5.1 ALTER plan_cobro ──────────────────────────────────────────────
ALTER TABLE plan_cobro
    ADD COLUMN IF NOT EXISTS moneda      TEXT          NOT NULL DEFAULT 'ARS'
        CHECK (moneda IN ('ARS', 'USD', 'EUR'));
ALTER TABLE plan_cobro
    ADD COLUMN IF NOT EXISTS cotizacion  NUMERIC(15,4) NOT NULL DEFAULT 1
        CHECK (cotizacion > 0);
ALTER TABLE plan_cobro
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);


-- ─── G5.2 ALTER plan_cobro_items ────────────────────────────────────────
ALTER TABLE plan_cobro_items
    ADD COLUMN IF NOT EXISTS moneda      TEXT          NOT NULL DEFAULT 'ARS'
        CHECK (moneda IN ('ARS', 'USD', 'EUR'));
ALTER TABLE plan_cobro_items
    ADD COLUMN IF NOT EXISTS cotizacion  NUMERIC(15,4) NOT NULL DEFAULT 1
        CHECK (cotizacion > 0);
ALTER TABLE plan_cobro_items
    ADD COLUMN IF NOT EXISTS total_en_ars NUMERIC(15,2);


-- ─── G5.3 Trigger snapshot total_en_ars para plan_cobro ─────────────────
CREATE OR REPLACE FUNCTION fn_plan_cobro_snapshot_ars()
RETURNS TRIGGER AS $$
BEGIN
    -- Si no vino cotización (raro, pero defensivo), default a 1
    IF NEW.cotizacion IS NULL OR NEW.cotizacion <= 0 THEN
        NEW.cotizacion := 1;
    END IF;
    NEW.total_en_ars := COALESCE(NEW.total_plan, 0) * NEW.cotizacion;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plan_cobro_snapshot_ars ON plan_cobro;
CREATE TRIGGER trg_plan_cobro_snapshot_ars
    BEFORE INSERT OR UPDATE OF total_plan, cotizacion, moneda ON plan_cobro
    FOR EACH ROW EXECUTE FUNCTION fn_plan_cobro_snapshot_ars();


-- ─── G5.4 Trigger snapshot total_en_ars + herencia para plan_cobro_items ─
CREATE OR REPLACE FUNCTION fn_plan_cobro_item_snapshot_ars()
RETURNS TRIGGER AS $$
DECLARE
    v_plan_moneda     TEXT;
    v_plan_cotizacion NUMERIC(15,4);
BEGIN
    -- Si el item no trae moneda/cotización (o vienen con default ARS/1 y el
    -- plan padre tiene otra moneda), heredar del plan.
    -- Solo aplicamos herencia en INSERT — en UPDATE asumimos que el cambio
    -- de moneda/cotización es deliberado.
    IF TG_OP = 'INSERT' THEN
        SELECT moneda, cotizacion
          INTO v_plan_moneda, v_plan_cotizacion
        FROM plan_cobro WHERE id = NEW.plan_cobro_id;

        IF v_plan_moneda IS NOT NULL AND v_plan_moneda <> 'ARS'
           AND (NEW.moneda IS NULL OR NEW.moneda = 'ARS') THEN
            NEW.moneda     := v_plan_moneda;
            NEW.cotizacion := v_plan_cotizacion;
        END IF;
    END IF;

    IF NEW.cotizacion IS NULL OR NEW.cotizacion <= 0 THEN
        NEW.cotizacion := 1;
    END IF;
    NEW.total_en_ars := COALESCE(NEW.monto, 0) * NEW.cotizacion;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plan_cobro_item_snapshot_ars ON plan_cobro_items;
CREATE TRIGGER trg_plan_cobro_item_snapshot_ars
    BEFORE INSERT OR UPDATE OF monto, cotizacion, moneda ON plan_cobro_items
    FOR EACH ROW EXECUTE FUNCTION fn_plan_cobro_item_snapshot_ars();


-- ─── G5.5 ALTER vencimientos_recurrentes ───────────────────────────────
ALTER TABLE vencimientos_recurrentes
    ADD COLUMN IF NOT EXISTS moneda      TEXT          NOT NULL DEFAULT 'ARS'
        CHECK (moneda IN ('ARS', 'USD', 'EUR'));
ALTER TABLE vencimientos_recurrentes
    ADD COLUMN IF NOT EXISTS cotizacion  NUMERIC(15,4) NOT NULL DEFAULT 1
        CHECK (cotizacion > 0);
ALTER TABLE vencimientos_recurrentes
    ADD COLUMN IF NOT EXISTS monto_estimado_ars NUMERIC(15,2);


-- ─── G5.6 ALTER vencimientos_generados (heredan del recurrente) ────────
ALTER TABLE vencimientos_generados
    ADD COLUMN IF NOT EXISTS moneda      TEXT          NOT NULL DEFAULT 'ARS'
        CHECK (moneda IN ('ARS', 'USD', 'EUR'));
ALTER TABLE vencimientos_generados
    ADD COLUMN IF NOT EXISTS cotizacion  NUMERIC(15,4) NOT NULL DEFAULT 1
        CHECK (cotizacion > 0);
ALTER TABLE vencimientos_generados
    ADD COLUMN IF NOT EXISTS monto_estimado_ars NUMERIC(15,2);


-- ─── G5.7 Trigger snapshot para vencimientos_recurrentes ───────────────
CREATE OR REPLACE FUNCTION fn_venc_rec_snapshot_ars()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cotizacion IS NULL OR NEW.cotizacion <= 0 THEN
        NEW.cotizacion := 1;
    END IF;
    NEW.monto_estimado_ars := COALESCE(NEW.monto_estimado, 0) * NEW.cotizacion;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venc_rec_snapshot_ars ON vencimientos_recurrentes;
CREATE TRIGGER trg_venc_rec_snapshot_ars
    BEFORE INSERT OR UPDATE OF monto_estimado, cotizacion, moneda ON vencimientos_recurrentes
    FOR EACH ROW EXECUTE FUNCTION fn_venc_rec_snapshot_ars();


-- ─── G5.8 Trigger snapshot + herencia para vencimientos_generados ──────
CREATE OR REPLACE FUNCTION fn_venc_gen_snapshot_ars()
RETURNS TRIGGER AS $$
DECLARE
    v_rec_moneda     TEXT;
    v_rec_cotizacion NUMERIC(15,4);
BEGIN
    IF TG_OP = 'INSERT' AND NEW.recurrente_id IS NOT NULL THEN
        SELECT moneda, cotizacion
          INTO v_rec_moneda, v_rec_cotizacion
        FROM vencimientos_recurrentes WHERE id = NEW.recurrente_id;

        IF v_rec_moneda IS NOT NULL AND v_rec_moneda <> 'ARS'
           AND (NEW.moneda IS NULL OR NEW.moneda = 'ARS') THEN
            NEW.moneda     := v_rec_moneda;
            NEW.cotizacion := v_rec_cotizacion;
        END IF;
    END IF;

    IF NEW.cotizacion IS NULL OR NEW.cotizacion <= 0 THEN
        NEW.cotizacion := 1;
    END IF;
    NEW.monto_estimado_ars := COALESCE(NEW.monto_estimado, 0) * NEW.cotizacion;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venc_gen_snapshot_ars ON vencimientos_generados;
CREATE TRIGGER trg_venc_gen_snapshot_ars
    BEFORE INSERT OR UPDATE OF monto_estimado, cotizacion, moneda ON vencimientos_generados
    FOR EACH ROW EXECUTE FUNCTION fn_venc_gen_snapshot_ars();


-- ─── G5.9 Backfill — disparar triggers en filas existentes ─────────────
-- UPDATE ... SET cotizacion = cotizacion no dispara si el trigger es ON UPDATE OF.
-- Pero como total_en_ars puede estar NULL en filas existentes, hago un touch.
UPDATE plan_cobro             SET cotizacion = cotizacion WHERE total_en_ars IS NULL;
UPDATE plan_cobro_items       SET cotizacion = cotizacion WHERE total_en_ars IS NULL;
UPDATE vencimientos_recurrentes SET cotizacion = cotizacion WHERE monto_estimado_ars IS NULL;
UPDATE vencimientos_generados   SET cotizacion = cotizacion WHERE monto_estimado_ars IS NULL;


-- ─── G5.10 Recrear VIEW v_plan_cobro_resumen con totales ARS ───────────
-- Mantengo el contrato actual de la VIEW pero agrego total_plan_en_ars y
-- una columna moneda para que el front pueda mostrar chip + tooltip.
--
-- CREATE OR REPLACE VIEW no permite cambiar orden ni nombre de columnas
-- existentes — solo permite AGREGAR al final. Como la VIEW de Fase C tenía
-- otro orden de columnas, hacemos DROP + CREATE limpio. CASCADE por si hay
-- dependientes (no debería — esta VIEW se consume solo desde el JS).
DROP VIEW IF EXISTS v_plan_cobro_resumen CASCADE;

CREATE VIEW v_plan_cobro_resumen AS
SELECT
    p.id AS plan_id,
    p.proyecto_id,
    p.total_plan,
    p.moneda,
    p.cotizacion,
    p.total_en_ars AS total_plan_en_ars,
    COUNT(i.id)                FILTER (WHERE i._deleted = false)                         AS cuotas_total,
    COUNT(i.id)                FILTER (WHERE i._deleted = false AND i.estado = 'cobrado') AS cuotas_cobradas,
    COALESCE(SUM(i.monto)         FILTER (WHERE i._deleted = false), 0)                AS monto_cuotas,
    COALESCE(SUM(i.total_en_ars)  FILTER (WHERE i._deleted = false), 0)                AS monto_cuotas_ars,
    COALESCE(SUM(i.monto)         FILTER (WHERE i.comprobante_venta_id IS NOT NULL AND i._deleted = false), 0) AS monto_facturado,
    COALESCE(SUM(i.monto_cobrado) FILTER (WHERE i._deleted = false), 0)                AS monto_cobrado
FROM plan_cobro p
LEFT JOIN plan_cobro_items i ON i.plan_cobro_id = p.id
WHERE p._deleted = false
GROUP BY p.id;


-- ─── G5.11 Índices parciales (filtran ARS) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plan_cobro_moneda
    ON plan_cobro(moneda) WHERE _deleted = false AND moneda <> 'ARS';
CREATE INDEX IF NOT EXISTS idx_plan_cobro_items_moneda
    ON plan_cobro_items(moneda) WHERE _deleted = false AND moneda <> 'ARS';


-- ─── G5.12 Diagnóstico de cierre ───────────────────────────────────────
DO $$
DECLARE
    v_planes_total      INT;
    v_planes_me         INT;
    v_items_total       INT;
    v_items_me          INT;
    v_venc_rec_total    INT;
    v_venc_rec_me       INT;
BEGIN
    SELECT COUNT(*)                                INTO v_planes_total      FROM plan_cobro             WHERE _deleted = false;
    SELECT COUNT(*) FILTER (WHERE moneda <> 'ARS') INTO v_planes_me         FROM plan_cobro             WHERE _deleted = false;
    SELECT COUNT(*)                                INTO v_items_total       FROM plan_cobro_items       WHERE _deleted = false;
    SELECT COUNT(*) FILTER (WHERE moneda <> 'ARS') INTO v_items_me          FROM plan_cobro_items       WHERE _deleted = false;
    SELECT COUNT(*)                                INTO v_venc_rec_total    FROM vencimientos_recurrentes WHERE _deleted = false;
    SELECT COUNT(*) FILTER (WHERE moneda <> 'ARS') INTO v_venc_rec_me       FROM vencimientos_recurrentes WHERE _deleted = false;

    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Fase G.5 — Planes y vencimientos multi-moneda listos.';
    RAISE NOTICE '  plan_cobro:             % filas (% en ME)', v_planes_total, v_planes_me;
    RAISE NOTICE '  plan_cobro_items:       % filas (% en ME)', v_items_total, v_items_me;
    RAISE NOTICE '  vencimientos_recurrentes: % filas (% en ME)', v_venc_rec_total, v_venc_rec_me;
    RAISE NOTICE '  Triggers: trg_plan_cobro_snapshot_ars, trg_plan_cobro_item_snapshot_ars,';
    RAISE NOTICE '            trg_venc_rec_snapshot_ars, trg_venc_gen_snapshot_ars.';
    RAISE NOTICE '  VIEW v_plan_cobro_resumen recreada con total_plan_en_ars + moneda.';
    RAISE NOTICE '═══════════════════════════════════════════';
END $$;
