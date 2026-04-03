-- =============================================
-- MEPEX — Módulo Locaciones
-- Tablas: locaciones, locaciones_documentos, locaciones_stock
-- =============================================

-- ─── Tabla: locaciones (lugares físicos) ───
CREATE TABLE IF NOT EXISTS locaciones (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('deposito', 'taller', 'oficina')),
    direccion TEXT,
    superficie NUMERIC(10,2),
    estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    foto_url TEXT,
    notas TEXT,
    _deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tabla: locaciones_documentos ───
CREATE TABLE IF NOT EXISTS locaciones_documentos (
    id BIGSERIAL PRIMARY KEY,
    locacion_id BIGINT NOT NULL REFERENCES locaciones(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo_doc TEXT NOT NULL CHECK (tipo_doc IN ('contrato_alquiler', 'habilitacion', 'seguro', 'plano', 'otro')),
    fecha_vencimiento DATE,
    archivo_url TEXT,
    notas TEXT,
    _deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tabla: locaciones_stock (cruce con inventario) ───
CREATE TABLE IF NOT EXISTS locaciones_stock (
    id BIGSERIAL PRIMARY KEY,
    locacion_id BIGINT NOT NULL REFERENCES locaciones(id) ON DELETE CASCADE,
    insumo_id BIGINT NOT NULL REFERENCES insumos_base(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'asignado', 'en_reparacion')),
    notas TEXT,
    _deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Índices ───
CREATE INDEX IF NOT EXISTS idx_locaciones_deleted ON locaciones(_deleted);
CREATE INDEX IF NOT EXISTS idx_locaciones_docs_locacion ON locaciones_documentos(locacion_id);
CREATE INDEX IF NOT EXISTS idx_locaciones_docs_deleted ON locaciones_documentos(_deleted);
CREATE INDEX IF NOT EXISTS idx_locaciones_docs_vencimiento ON locaciones_documentos(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_locaciones_stock_locacion ON locaciones_stock(locacion_id);
CREATE INDEX IF NOT EXISTS idx_locaciones_stock_insumo ON locaciones_stock(insumo_id);
CREATE INDEX IF NOT EXISTS idx_locaciones_stock_deleted ON locaciones_stock(_deleted);

-- ─── RLS (Row Level Security) ───
ALTER TABLE locaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE locaciones_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE locaciones_stock ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can do everything (permisos se manejan client-side)
CREATE POLICY "locaciones_all" ON locaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "locaciones_documentos_all" ON locaciones_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "locaciones_stock_all" ON locaciones_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Datos iniciales: 3 locaciones de MEPEX ───
INSERT INTO locaciones (nombre, tipo, direccion, estado, notas) VALUES
    ('Depósito MEPEX', 'deposito', NULL, 'activo', 'Depósito principal de materiales y equipamiento'),
    ('Taller MEPEX', 'taller', NULL, 'activo', 'Taller de producción y armado'),
    ('Oficina MEPEX', 'oficina', NULL, 'activo', 'Oficina administrativa y comercial')
ON CONFLICT DO NOTHING;
