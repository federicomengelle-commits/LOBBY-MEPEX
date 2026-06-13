-- =============================================
-- RRHH.4 — Documentación de personas (semáforo de vencimientos)
-- =============================================
-- Blueprint: docs/modulo-rrhh-v2-blueprint.md §3.2/§5/§7
-- Schema verificado contra prod (docs/schema-prod.md, 2026-06-13).
-- Correr en Supabase SQL Editor ANTES del push del JS (regla SQL-first).
-- Idempotente. Solo fechas + semáforo: SIN archivos adjuntos (decisión Fede).
-- =============================================

CREATE TABLE IF NOT EXISTS persona_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES personas(id),
    tipo TEXT NOT NULL,            -- dni / licencia_conducir / art_seguro / examen_medico / otro
    numero TEXT,
    fecha_emision DATE,
    fecha_vencimiento DATE,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    _deleted BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_persona_docs_persona ON persona_documentos(persona_id) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_persona_docs_venc ON persona_documentos(fecha_vencimiento) WHERE _deleted = false;

-- RLS: módulo admin/superadmin a nivel UI; CRUD para authenticated.
ALTER TABLE persona_documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS persona_documentos_all ON persona_documentos;
CREATE POLICY persona_documentos_all ON persona_documentos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Verificación post-run:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'persona_documentos'
ORDER BY ordinal_position;
