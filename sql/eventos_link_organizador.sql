-- ============================================================
-- Eventos — Link del evento + Organizador (reusa `clientes` con flag)
-- 2026-06-30. Aditivo e idempotente. SQL-FIRST: correr ANTES de pullear
-- (api.js / eventos.js nuevos). El código degrada si no está, pero el
-- alta de organizador/link no persiste hasta correr esto.
-- ============================================================

-- Link único del evento (web / Instagram / etc.) — fuente de verdad del evento.
ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS link_url TEXT;

-- Organizador del evento = una empresa de `clientes` (los organizadores pueden
-- ser clientes; reusamos esa tabla en vez de crear `organizadores`).
ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS organizador_id UUID REFERENCES clientes(id);

-- Rol: marca qué clientes son organizadores → permite filtrarlos/priorizarlos
-- en el picker del modal sin separar la base de empresas.
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS es_organizador BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_eventos_organizador
  ON eventos(organizador_id) WHERE organizador_id IS NOT NULL;

-- Verificación:
--   SELECT column_name FROM information_schema.columns
--    WHERE (table_name='eventos'   AND column_name IN ('link_url','organizador_id'))
--       OR (table_name='clientes'  AND column_name='es_organizador');   -- → 3 filas
