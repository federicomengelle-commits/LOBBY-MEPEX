-- =============================================
-- RRHH.1 — Ficha completa de personas
-- =============================================
-- Blueprint: docs/modulo-rrhh-v2-blueprint.md §5
-- Verificado contra prod 2026-06-12 vía REST: las 7 columnas NO existen;
-- cuil y fecha_nacimiento YA existen (no se tocan).
-- Idempotente (IF NOT EXISTS). Correr en Supabase SQL Editor ANTES
-- del push del JS (regla SQL-first).
-- =============================================

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS dni TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre TEXT,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono TEXT,
  ADD COLUMN IF NOT EXISTS cbu_alias TEXT,
  ADD COLUMN IF NOT EXISTS banco TEXT,
  ADD COLUMN IF NOT EXISTS situacion_previsional TEXT; -- monotributo / relacion_dependencia / otro

-- Verificación post-run (debe listar las 7 columnas nuevas):
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'personas'
  AND column_name IN ('dni','direccion','contacto_emergencia_nombre',
                      'contacto_emergencia_telefono','cbu_alias','banco','situacion_previsional')
ORDER BY column_name;
