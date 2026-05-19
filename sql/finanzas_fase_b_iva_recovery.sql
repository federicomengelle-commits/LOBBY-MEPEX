-- =============================================
-- MEPEX Lobby — Finanzas Fase B: IVA RECOVERY
-- =============================================
-- Tabla auxiliar para "compras de familiares con CUIT MEPEX":
-- facturas reales que aprovechamos para descontar IVA, pero
-- el gasto NO es de MEPEX. NO genera asiento contable.
--
-- Una VIEW une comprobantes_recibidos (oficiales) + esta tabla
-- (virtuales) para construir el Libro IVA Compras real.
--
-- Solo admin/superadmin.
-- Ejecutar en Supabase SQL Editor. Idempotente.
-- =============================================


-- ════════════════════════════════════════════════
--  B1 — Tabla comprobantes_iva_recovery
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS comprobantes_iva_recovery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    cuit TEXT,
    razon_social TEXT,
    descripcion TEXT,
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
    iva_21 NUMERIC(15,2) NOT NULL DEFAULT 0,
    iva_10_5 NUMERIC(15,2) NOT NULL DEFAULT 0,
    iva_otros NUMERIC(15,2) NOT NULL DEFAULT 0,
    iva_total NUMERIC(15,2) GENERATED ALWAYS AS (iva_21 + iva_10_5 + iva_otros) STORED,
    total NUMERIC(15,2) NOT NULL DEFAULT 0,
    periodo TEXT NOT NULL,                -- 'YYYY-MM' — mes de imputación a DDJJ IVA
    traido_por TEXT,                       -- 'Cuñada de Pedro', 'Hermano Mariela', etc.
    archivo_url TEXT,                      -- opcional: PDF de la factura
    notas TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_civar_periodo
    ON comprobantes_iva_recovery(periodo) WHERE _deleted = false;

CREATE INDEX IF NOT EXISTS idx_civar_fecha
    ON comprobantes_iva_recovery(fecha) WHERE _deleted = false;

ALTER TABLE comprobantes_iva_recovery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "civar_admin_only" ON comprobantes_iva_recovery;
CREATE POLICY "civar_admin_only" ON comprobantes_iva_recovery
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
    );

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_updated_at_civar ON comprobantes_iva_recovery;
CREATE TRIGGER trg_updated_at_civar
    BEFORE UPDATE ON comprobantes_iva_recovery
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ════════════════════════════════════════════════
--  B2 — VIEW: Libro IVA Compras extendido
-- ════════════════════════════════════════════════
-- Une comprobantes_recibidos (oficiales) con comprobantes_iva_recovery
-- (virtuales) presentándolos con el mismo shape de columnas para
-- que el frontend los pueda mostrar juntos.

CREATE OR REPLACE VIEW v_libro_iva_compras_extendido AS
SELECT
    'oficial'::TEXT                          AS origen,
    cr.id                                    AS id,
    cr.fecha                                 AS fecha,
    cr.tipo                                  AS tipo,
    cr.numero                                AS numero,
    cr.cuit                                  AS cuit,
    COALESCE(cr.proveedor_nombre, '')        AS razon_social,
    COALESCE(cr.concepto, '')                AS descripcion,
    cr.neto                                  AS subtotal,
    0::NUMERIC(15,2)                         AS iva_21,
    0::NUMERIC(15,2)                         AS iva_10_5,
    0::NUMERIC(15,2)                         AS iva_otros,
    cr.iva                                   AS iva_total,
    cr.total                                 AS total,
    TO_CHAR(cr.fecha, 'YYYY-MM')             AS periodo,
    NULL::TEXT                               AS traido_por,
    cr.created_at                            AS created_at
FROM comprobantes_recibidos cr
WHERE cr._deleted = false

UNION ALL

SELECT
    'virtual'::TEXT                          AS origen,
    civar.id                                 AS id,
    civar.fecha                              AS fecha,
    'factura'::TEXT                          AS tipo,
    NULL::TEXT                               AS numero,
    civar.cuit                               AS cuit,
    COALESCE(civar.razon_social, '')         AS razon_social,
    COALESCE(civar.descripcion, '')          AS descripcion,
    civar.subtotal                           AS subtotal,
    civar.iva_21                             AS iva_21,
    civar.iva_10_5                           AS iva_10_5,
    civar.iva_otros                          AS iva_otros,
    civar.iva_total                          AS iva_total,
    civar.total                              AS total,
    civar.periodo                            AS periodo,
    civar.traido_por                         AS traido_por,
    civar.created_at                         AS created_at
FROM comprobantes_iva_recovery civar
WHERE civar._deleted = false;


-- ════════════════════════════════════════════════
--  B3 — VIEW: Posición IVA mensual
-- ════════════════════════════════════════════════
-- IVA crédito = todos los comprobantes recibidos (oficial+virtual)
-- IVA débito = comprobantes emitidos (lado venta — solo oficial; el "interno"
--              en circuito B también suma para AFIP si está facturado en La PyME)
-- Resultado: a pagar a AFIP (>0) o a favor (<0)

CREATE OR REPLACE VIEW v_posicion_iva_mes AS
WITH credito AS (
    SELECT
        periodo,
        SUM(CASE WHEN origen = 'oficial' THEN iva_total ELSE 0 END) AS iva_credito_oficial,
        SUM(CASE WHEN origen = 'virtual' THEN iva_total ELSE 0 END) AS iva_credito_virtual,
        SUM(iva_total) AS iva_credito_total
    FROM v_libro_iva_compras_extendido
    GROUP BY periodo
),
debito AS (
    SELECT
        TO_CHAR(fecha, 'YYYY-MM') AS periodo,
        SUM(iva) AS iva_debito
    FROM comprobantes
    WHERE _deleted = false
      AND estado IN ('aprobada', 'emitida', 'autorizada')
    GROUP BY TO_CHAR(fecha, 'YYYY-MM')
)
SELECT
    COALESCE(c.periodo, d.periodo)                                AS periodo,
    COALESCE(d.iva_debito, 0)                                     AS iva_debito,
    COALESCE(c.iva_credito_oficial, 0)                            AS iva_credito_oficial,
    COALESCE(c.iva_credito_virtual, 0)                            AS iva_credito_virtual,
    COALESCE(c.iva_credito_total, 0)                              AS iva_credito_total,
    COALESCE(d.iva_debito, 0) - COALESCE(c.iva_credito_oficial,0) AS saldo_solo_oficial,
    COALESCE(d.iva_debito, 0) - COALESCE(c.iva_credito_total,0)   AS saldo_con_virtual
FROM credito c
FULL OUTER JOIN debito d ON c.periodo = d.periodo
ORDER BY 1 DESC;


-- ════════════════════════════════════════════════
--  Cierre — resumen
-- ════════════════════════════════════════════════
DO $$
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Fase B — IVA Recovery completada.';
    RAISE NOTICE '  ✓ Tabla comprobantes_iva_recovery (admin/superadmin)';
    RAISE NOTICE '  ✓ VIEW v_libro_iva_compras_extendido (unión oficial + virtual)';
    RAISE NOTICE '  ✓ VIEW v_posicion_iva_mes (débito - crédito por periodo)';
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Si la VIEW v_posicion_iva_mes falla por valores de estado en';
    RAISE NOTICE 'comprobantes, ajustar el CHECK IN al schema real:';
    RAISE NOTICE '  SELECT DISTINCT estado FROM comprobantes;';
END $$;
