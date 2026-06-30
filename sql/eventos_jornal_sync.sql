-- ============================================================
-- Eventos → Rendimiento: tarifa de jornal por persona (puente)
-- 2026-06-30. SQL-FIRST, aditivo/idempotente. Correr ANTES de pullear.
--
-- El puente "asignar gente por día → jornales del Rendimiento" necesita una
-- tarifa diaria por persona (el "preset" del híbrido que eligió Fede:
-- preseteado desde RRHH, editable inline en Rendimiento vía evento_costos.tarifa
-- + monto_editado, que YA existen). Esta columna es ese preset.
-- ============================================================

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS jornal_diario NUMERIC(15,2) DEFAULT 0;

-- Verificación:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='personas' AND column_name='jornal_diario';   -- → 1 fila
