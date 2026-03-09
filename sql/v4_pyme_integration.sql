-- ═══════════════════════════════════════════
-- V4 — Integración La PyME
-- Ejecutar DESPUÉS de pipeline_comercial.sql
-- ═══════════════════════════════════════════

-- 1. Expandir CHECK constraint para incluir 'facturada'
ALTER TABLE public.cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_estado_check CHECK (
    estado IN ('borrador','enviada','vista','en_negociacion','aprobada',
               'cerrada_ganada','cerrada_perdida','facturada')
);

-- 2. Columnas de sync con La PyME
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS pyme_venta_id uuid;
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS pyme_factura_numero text;
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS pyme_factura_fecha date;
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS pyme_total numeric(12,2);
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS pyme_balance numeric(12,2);
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS pyme_estado_cobro text DEFAULT NULL;
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS pyme_last_sync timestamptz;

COMMENT ON COLUMN public.cotizaciones.pyme_venta_id IS 'ID de la venta en La PyME';
COMMENT ON COLUMN public.cotizaciones.pyme_balance IS 'Saldo pendiente de cobro (0 = cobrada)';
COMMENT ON COLUMN public.cotizaciones.pyme_estado_cobro IS 'pendiente | parcial | cobrada';

-- 3. Tabla de log de sincronización
CREATE TABLE IF NOT EXISTS public.pyme_sync_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo            text NOT NULL DEFAULT 'manual',  -- manual | auto
    ventas_synced   int DEFAULT 0,
    ventas_total    int DEFAULT 0,
    errores         jsonb DEFAULT '[]'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pyme_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pyme_sync_log_auth_select" ON public.pyme_sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "pyme_sync_log_auth_insert" ON public.pyme_sync_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pyme_sync_log_anon_select" ON public.pyme_sync_log FOR SELECT TO anon USING (true);
CREATE POLICY "pyme_sync_log_anon_insert" ON public.pyme_sync_log FOR INSERT TO anon WITH CHECK (true);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_cotizaciones_pyme_venta ON public.cotizaciones(pyme_venta_id);
CREATE INDEX IF NOT EXISTS idx_pyme_sync_created ON public.pyme_sync_log(created_at DESC);

-- ═══════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════
DO $$
BEGIN
    RAISE NOTICE '══════════════════════════════════════';
    RAISE NOTICE '  V4 PYME INTEGRATION — APLICADO OK';
    RAISE NOTICE '══════════════════════════════════════';
    RAISE NOTICE '  - CHECK constraint expandido (+ facturada)';
    RAISE NOTICE '  - Columnas pyme_* agregadas a cotizaciones';
    RAISE NOTICE '  - Tabla pyme_sync_log creada';
    RAISE NOTICE '  - Índices creados';
    RAISE NOTICE '══════════════════════════════════════';
END $$;
