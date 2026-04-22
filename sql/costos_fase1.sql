-- =============================================
-- MEPEX Lobby - Costos Fase 1 + 2
-- =============================================
-- Fase 1: Schema base para calculo de precio de alquiler
-- Fase 2: Cascada para subalquilados (UI completa)
--
-- Tablas tocadas:
--   - catalogo_items (ALTER + 12 columnas)
--   - parametros_globales (CREATE + seed)
--
-- Ejecutar manualmente en Supabase SQL Editor.
-- =============================================

-- 1. ALTER catalogo_items
-- ------------------------------------------------

-- Tipo de receta: propio (fabricacion interna) o subalquilado (lo aporta proveedor)
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS tipo_receta VARCHAR(20) NOT NULL DEFAULT 'propio'
    CHECK (tipo_receta IN ('propio', 'subalquilado'));

-- Para tipo SUBALQUILADO
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS margen_subalquiler DECIMAL(5,4) DEFAULT 0.50;

-- Para tipo PROPIO (schema solo; UI completa en Fase 3)
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS mano_obra_minutos INTEGER DEFAULT 0;
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS pct_indirectos_fabrica DECIMAL(5,4) DEFAULT 0.30;
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS pct_indirectos_comercial DECIMAL(5,4) DEFAULT 0.20;
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS vida_util_usos INTEGER DEFAULT 20;
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS pct_reacondicionamiento DECIMAL(5,4) DEFAULT 0.05;
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS margen_propio DECIMAL(5,4) DEFAULT 0.50;

-- Calculos guardados (persistidos para que el cotizador no recalcule)
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS costo_mano_obra DECIMAL(12,2) DEFAULT 0;
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS costo_indirectos DECIMAL(12,2) DEFAULT 0;
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS costo_fabricacion DECIMAL(12,2) DEFAULT 0;
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS costo_por_uso DECIMAL(12,2) DEFAULT 0;
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS precio_alquiler DECIMAL(12,2) DEFAULT 0;

ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS ultima_recalculacion TIMESTAMPTZ;


-- 2. Tabla parametros_globales
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS parametros_globales (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor DECIMAL(12,4) NOT NULL,
    descripcion TEXT,
    unidad VARCHAR(20),
    actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: admin-only (mismo patron que finanzas)
ALTER TABLE parametros_globales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parametros_globales_admin_only" ON parametros_globales
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')
        )
    );


-- 3. Trigger actualizado_at
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION update_parametros_globales_actualizado_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parametros_globales_actualizado_at ON parametros_globales;
CREATE TRIGGER trg_parametros_globales_actualizado_at
    BEFORE UPDATE ON parametros_globales
    FOR EACH ROW EXECUTE FUNCTION update_parametros_globales_actualizado_at();


-- 4. Seed de parametros iniciales
-- ------------------------------------------------
INSERT INTO parametros_globales (clave, valor, descripcion, unidad) VALUES
    ('hora_taller_ars',           12000,  'Hora de mano de obra en taller (con cargas sociales)',     'ARS'),
    ('hora_montajista_ars',       15000,  'Hora de mano de obra de montajista en obra',               'ARS'),
    ('pct_indirectos_fabrica',    0.30,   'Indirectos fabrica como % sobre MO directa',               '%'),
    ('pct_indirectos_comercial',  0.20,   'Indirectos comerciales como % sobre MO directa',           '%'),
    ('pct_desperdicio_aluminio',  0.05,   'Desperdicio al cortar aluminio en barras de 6m',           '%'),
    ('vida_util_default',         20,     'Vida util default en cantidad de usos',                    'usos'),
    ('pct_reacondicionamiento',   0.05,   'Reacondicionamiento por uso como % sobre costo fab',       '%'),
    ('pct_margen_default',        0.50,   'Margen objetivo default sobre costo por uso',              '%'),
    ('dolar_bna_vendedor',        1400,   'Cotizacion dolar BNA vendedor',                            'ARS/USD')
ON CONFLICT (clave) DO NOTHING;


-- 5. Indices
-- ------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_catalogo_items_tipo_receta ON catalogo_items (tipo_receta) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_parametros_globales_clave ON parametros_globales (clave);


-- =============================================
-- NOTAS
-- =============================================
-- * Los 215 items existentes quedan en tipo_receta='propio' por el DEFAULT.
--   Fede revisa y marca manualmente los subalquilados desde la UI.
-- * precio_alquiler arranca en 0 para todos. La Lista de Precios hace fallback
--   al calculo viejo (costo_produccion * (1 + margen)) mientras precio_alquiler=0,
--   asi nada cambia visualmente el dia 1.
-- * Cuando se guarda una receta desde la UI, calcularReceta() del frontend
--   persiste todos los costos_* y precio_alquiler.
