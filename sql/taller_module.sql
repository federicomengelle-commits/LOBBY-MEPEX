-- =============================================
-- MEPEX — Módulo Taller: tablas
-- Fecha: 2026-04-03
-- =============================================

-- Checklist de preparación por proyecto
CREATE TABLE IF NOT EXISTS taller_checklist (
    id            BIGSERIAL PRIMARY KEY,
    proyecto_id   BIGINT NOT NULL,
    item_key      TEXT NOT NULL,
    checked       BOOLEAN DEFAULT FALSE,
    checked_by    TEXT,
    checked_at    TIMESTAMPTZ,
    _deleted      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proyecto_id, item_key)
);

-- Lista de materiales por proyecto
CREATE TABLE IF NOT EXISTS taller_materiales (
    id            BIGSERIAL PRIMARY KEY,
    proyecto_id   BIGINT NOT NULL,
    item_nombre   TEXT NOT NULL,
    cantidad      INTEGER,
    notas         TEXT,
    _deleted      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Notas/comentarios del equipo por proyecto
CREATE TABLE IF NOT EXISTS taller_notas (
    id            BIGSERIAL PRIMARY KEY,
    proyecto_id   BIGINT NOT NULL,
    usuario       TEXT NOT NULL,
    texto         TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Mantenimiento de herramientas, matafuegos, equipos
CREATE TABLE IF NOT EXISTS produccion_mantenimiento (
    id                          BIGSERIAL PRIMARY KEY,
    nombre                      TEXT NOT NULL,
    tipo                        TEXT DEFAULT 'herramienta',
    estado                      TEXT DEFAULT 'ok',
    fecha_ultimo_service        DATE,
    fecha_proximo_vencimiento   DATE,
    notas                       TEXT,
    _deleted                    BOOLEAN DEFAULT FALSE,
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_taller_checklist_proyecto ON taller_checklist(proyecto_id) WHERE _deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_taller_materiales_proyecto ON taller_materiales(proyecto_id) WHERE _deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_taller_notas_proyecto ON taller_notas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_produccion_mant_deleted ON produccion_mantenimiento(_deleted) WHERE _deleted = FALSE;

-- RLS: permitir acceso a usuarios autenticados
ALTER TABLE taller_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE taller_materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE taller_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE produccion_mantenimiento ENABLE ROW LEVEL SECURITY;

-- Policies: acceso total para authenticated
CREATE POLICY "taller_checklist_all" ON taller_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "taller_materiales_all" ON taller_materiales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "taller_notas_all" ON taller_notas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "produccion_mantenimiento_all" ON produccion_mantenimiento FOR ALL TO authenticated USING (true) WITH CHECK (true);
