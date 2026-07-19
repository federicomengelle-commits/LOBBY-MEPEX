-- ════════════════════════════════════════════════════════════════
-- CRM Ficha de Caso v3 — columnas nuevas (2026-07-19)
-- Aditivo e idempotente. Correr ANTES del pull del JS (orden SQL-first).
-- El JS degrada limpio sin esto (Drive/resumen no persisten, no rompe).
-- ════════════════════════════════════════════════════════════════

-- 1) Vínculo Drive del caso (clonado del patrón de `proyectos`:
--    la carpeta nace en cotizado/negociación y el proyecto la hereda)
ALTER TABLE crm_casos ADD COLUMN IF NOT EXISTS drive_folder_url  TEXT;
ALTER TABLE crm_casos ADD COLUMN IF NOT EXISTS drive_folder_id   TEXT;

-- 2) Resumen IA a nivel CASO (el de crm_mensajes.resumen_ia es por mensaje)
ALTER TABLE crm_casos ADD COLUMN IF NOT EXISTS resumen_ia        TEXT;
ALTER TABLE crm_casos ADD COLUMN IF NOT EXISTS resumen_ia_at     TIMESTAMPTZ;

-- Verificación (read-only): deben aparecer las 4 columnas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'crm_casos'
  AND column_name IN ('drive_folder_url','drive_folder_id','resumen_ia','resumen_ia_at')
ORDER BY column_name;
