-- ============================================================
-- CRM — Bandeja v2 (2026-06-26)
-- Rediseño de la Bandeja: triage + acciones rápidas + snooze + línea de negocio.
-- Aditivo e idempotente. Correr ANTES de pullear el JS (api.js?v= / crm.js?v=).
-- ============================================================

-- 1) SNOOZE por usuario ──────────────────────────────────────
-- "Posponer" un caso saca el caso de la cola de trabajo del usuario hasta una fecha.
-- Es PERSONAL (por usuario), por eso cuelga de la tabla de estado por-usuario del caso,
-- no de crm_casos. Reusa la fila (caso_id,user_id) que ya existe para leído/no-leído.
ALTER TABLE crm_caso_lecturas
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- 2) LÍNEA DE NEGOCIO del caso ────────────────────────────────
-- Separa los dos negocios de MEPEX en la Bandeja:
--   'stand' = diseño y construcción de stands (PMs)
--   'expo'  = equipamiento / alquiler / subalquileres (comercial)
--   NULL    = sin clasificar (casos viejos hasta que se toquen)
-- Sin CHECK estricto para no romper inserts existentes; la UI escribe solo 'stand'|'expo'.
ALTER TABLE crm_casos
  ADD COLUMN IF NOT EXISTS linea text;

-- Índice parcial liviano para filtrar por línea sin escanear los sin-clasificar.
CREATE INDEX IF NOT EXISTS idx_crm_casos_linea ON crm_casos (linea) WHERE linea IS NOT NULL;
