-- =============================================
-- MEPEX Lobby — Finanzas Fase C: PLAN DE PAGOS AVANZADO
-- =============================================
-- Soporta:
--   - Cuotas que pueden facturarse individualmente o no
--   - Vínculo cuota ↔ factura (comprobante de venta)
--   - Cobros parciales aplicables a múltiples facturas
--   - Resumen / saldo en vivo via VIEWs
--
-- IMPORTANTE: idempotente. Re-ejecutar es seguro.
-- =============================================


-- ════════════════════════════════════════════════
--  C1 — ALTER plan_cobro_items: facturar + comprobante_id
-- ════════════════════════════════════════════════

ALTER TABLE plan_cobro_items
    ADD COLUMN IF NOT EXISTS facturar BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE plan_cobro_items
    ADD COLUMN IF NOT EXISTS comprobante_venta_id UUID REFERENCES comprobantes(id);

-- Refinar CHECK de estado (agregar 'facturada' y 'anulada' a los existentes)
DO $$
BEGIN
    -- Drop constraint vieja si existe con cualquier nombre conocido
    BEGIN
        ALTER TABLE plan_cobro_items DROP CONSTRAINT IF EXISTS plan_cobro_items_estado_check;
    EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

ALTER TABLE plan_cobro_items
    ADD CONSTRAINT plan_cobro_items_estado_check
    CHECK (estado IN ('pendiente', 'facturada', 'parcial', 'cobrado', 'vencido', 'anulada'));

CREATE INDEX IF NOT EXISTS idx_plan_cobro_items_comprobante
    ON plan_cobro_items(comprobante_venta_id) WHERE _deleted = false;


-- ════════════════════════════════════════════════
--  C2 — Tabla cobro_aplicaciones (junction ingreso ↔ comprobante)
-- ════════════════════════════════════════════════
-- Un ingreso puede aplicarse a múltiples facturas (cobros parciales o cross-factura).
-- Opcionalmente vincula a una cuota del plan (plan_cobro_item_id).

CREATE TABLE IF NOT EXISTS cobro_aplicaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingreso_id UUID NOT NULL REFERENCES ingresos(id) ON DELETE CASCADE,
    comprobante_id UUID NOT NULL REFERENCES comprobantes(id),
    plan_cobro_item_id UUID REFERENCES plan_cobro_items(id),
    monto_aplicado NUMERIC(15,2) NOT NULL CHECK (monto_aplicado > 0),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_cobro_aplic_ingreso     ON cobro_aplicaciones(ingreso_id)     WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_cobro_aplic_comprobante ON cobro_aplicaciones(comprobante_id) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_cobro_aplic_cuota       ON cobro_aplicaciones(plan_cobro_item_id) WHERE _deleted = false;

ALTER TABLE cobro_aplicaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cobro_aplic_admin_only" ON cobro_aplicaciones;
CREATE POLICY "cobro_aplic_admin_only" ON cobro_aplicaciones
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
    );


-- ════════════════════════════════════════════════
--  C3 — VIEW: saldo de comprobante (factura emitida)
-- ════════════════════════════════════════════════
-- total - sum(aplicaciones) = saldo pendiente de cobro por factura.

CREATE OR REPLACE VIEW v_saldo_comprobante AS
SELECT
    c.id                                                        AS comprobante_id,
    c.fecha                                                     AS fecha,
    c.tipo                                                      AS tipo,
    c.cliente_id                                                AS cliente_id,
    c.proyecto_id                                               AS proyecto_id,
    c.total                                                     AS total,
    COALESCE(SUM(ca.monto_aplicado), 0)                         AS total_cobrado,
    c.total - COALESCE(SUM(ca.monto_aplicado), 0)               AS saldo,
    CASE
        WHEN COALESCE(SUM(ca.monto_aplicado), 0) >= c.total - 0.01 THEN 'cobrada'
        WHEN COALESCE(SUM(ca.monto_aplicado), 0) > 0.01            THEN 'parcial'
        ELSE 'pendiente'
    END                                                         AS estado_cobranza,
    c.canal                                                     AS canal,
    c.estado                                                    AS estado_comprobante
FROM comprobantes c
LEFT JOIN cobro_aplicaciones ca
       ON ca.comprobante_id = c.id AND ca._deleted = false
WHERE c._deleted = false
GROUP BY c.id, c.fecha, c.tipo, c.cliente_id, c.proyecto_id, c.total, c.canal, c.estado;


-- ════════════════════════════════════════════════
--  C4 — VIEW: resumen del plan de cobro
-- ════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_plan_cobro_resumen AS
SELECT
    p.id                                                        AS plan_id,
    p.proyecto_id                                               AS proyecto_id,
    p.cotizacion_id                                             AS cotizacion_id,
    p.total_plan                                                AS total_plan,
    COALESCE(SUM(i.monto) FILTER (WHERE i.facturar = true AND i._deleted = false), 0) AS monto_a_facturar,
    COALESCE(SUM(i.monto) FILTER (WHERE i.comprobante_venta_id IS NOT NULL AND i._deleted = false), 0) AS monto_facturado,
    COALESCE(SUM(i.monto_cobrado) FILTER (WHERE i._deleted = false), 0) AS monto_cobrado,
    p.total_plan - COALESCE(SUM(i.monto_cobrado) FILTER (WHERE i._deleted = false), 0) AS saldo_pendiente,
    COUNT(i.id)                FILTER (WHERE i._deleted = false) AS total_cuotas,
    COUNT(i.id)                FILTER (WHERE i.estado = 'cobrado' AND i._deleted = false) AS cuotas_cobradas,
    COUNT(i.id)                FILTER (WHERE i.estado = 'vencido' AND i._deleted = false) AS cuotas_vencidas,
    p.created_at                                                AS created_at
FROM plan_cobro p
LEFT JOIN plan_cobro_items i ON i.plan_cobro_id = p.id
WHERE p._deleted = false
GROUP BY p.id;


-- ════════════════════════════════════════════════
--  C5 — Trigger: sincronizar plan_cobro_items.monto_cobrado
--       desde cobro_aplicaciones
-- ════════════════════════════════════════════════
-- Cuando se aplica un cobro a una cuota (plan_cobro_item_id != null),
-- actualizar monto_cobrado y estado de esa cuota.

CREATE OR REPLACE FUNCTION fn_sync_cuota_desde_aplicacion()
RETURNS TRIGGER AS $$
DECLARE
    v_item_id UUID;
    v_total_aplicado NUMERIC(15,2);
    v_monto_cuota NUMERIC(15,2);
    v_facturar BOOLEAN;
    v_tiene_factura BOOLEAN;
    v_nuevo_estado TEXT;
BEGIN
    -- Determinar la cuota afectada (NEW para INSERT/UPDATE, OLD para DELETE)
    v_item_id := COALESCE(NEW.plan_cobro_item_id, OLD.plan_cobro_item_id);
    IF v_item_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

    -- Recalcular total aplicado a esta cuota (vivas no eliminadas)
    SELECT COALESCE(SUM(monto_aplicado), 0) INTO v_total_aplicado
    FROM cobro_aplicaciones
    WHERE plan_cobro_item_id = v_item_id AND _deleted = false;

    SELECT monto, facturar, comprobante_venta_id IS NOT NULL
    INTO v_monto_cuota, v_facturar, v_tiene_factura
    FROM plan_cobro_items
    WHERE id = v_item_id;

    -- Calcular nuevo estado
    IF v_total_aplicado >= v_monto_cuota - 0.01 THEN
        v_nuevo_estado := 'cobrado';
    ELSIF v_total_aplicado > 0.01 THEN
        v_nuevo_estado := 'parcial';
    ELSIF v_tiene_factura THEN
        v_nuevo_estado := 'facturada';
    ELSE
        -- Mantener 'vencido' si la fecha estimada pasó y sigue sin cobrar
        SELECT CASE WHEN fecha_estimada < CURRENT_DATE THEN 'vencido' ELSE 'pendiente' END
        INTO v_nuevo_estado
        FROM plan_cobro_items WHERE id = v_item_id;
    END IF;

    UPDATE plan_cobro_items
    SET monto_cobrado = v_total_aplicado,
        estado        = v_nuevo_estado,
        updated_at    = NOW()
    WHERE id = v_item_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_cuota_desde_aplicacion ON cobro_aplicaciones;
CREATE TRIGGER trg_sync_cuota_desde_aplicacion
    AFTER INSERT OR UPDATE OR DELETE ON cobro_aplicaciones
    FOR EACH ROW EXECUTE FUNCTION fn_sync_cuota_desde_aplicacion();


-- ════════════════════════════════════════════════
--  C6 — Trigger: marcar cuota como 'facturada'
--       cuando se vincula a un comprobante de venta
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_marcar_cuota_facturada()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.comprobante_venta_id IS NOT NULL
       AND (OLD.comprobante_venta_id IS NULL OR OLD.comprobante_venta_id IS DISTINCT FROM NEW.comprobante_venta_id)
       AND NEW.estado = 'pendiente' THEN
        NEW.estado := 'facturada';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marcar_cuota_facturada ON plan_cobro_items;
CREATE TRIGGER trg_marcar_cuota_facturada
    BEFORE UPDATE OF comprobante_venta_id ON plan_cobro_items
    FOR EACH ROW EXECUTE FUNCTION fn_marcar_cuota_facturada();


-- ════════════════════════════════════════════════
--  Cierre — resumen
-- ════════════════════════════════════════════════
DO $$
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Fase C — Plan de pagos avanzado completada.';
    RAISE NOTICE '  C1 ✓ plan_cobro_items.facturar + comprobante_venta_id';
    RAISE NOTICE '  C2 ✓ Tabla cobro_aplicaciones (admin/superadmin RLS)';
    RAISE NOTICE '  C3 ✓ VIEW v_saldo_comprobante';
    RAISE NOTICE '  C4 ✓ VIEW v_plan_cobro_resumen';
    RAISE NOTICE '  C5 ✓ Trigger sync cuota ← aplicación';
    RAISE NOTICE '  C6 ✓ Trigger auto-marcar cuota facturada';
    RAISE NOTICE '═══════════════════════════════════════════';
END $$;
