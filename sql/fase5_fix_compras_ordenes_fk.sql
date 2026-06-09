-- ════════════════════════════════════════════════════════════════════
-- FIX Fase 5 — compras_ordenes.proyecto_id / evento_id eran BIGINT
-- ════════════════════════════════════════════════════════════════════
-- La tabla vieja compras_ordenes tenía proyecto_id y evento_id en BIGINT,
-- pero proyectos.id y eventos.id son UUID. Por eso, crear una OC desde un
-- pedido CON proyecto rompía con:
--   "invalid input syntax for type bigint: <uuid>"
--
-- compras_ordenes está VACÍA (0 filas) → el ALTER a uuid es seguro
-- (sin conversión de datos). Arregla la conversión pedido→OC, las OCs
-- manuales con proyecto y la imputación del egreso al proyecto.
--
-- Verificado 2026-06-08 vía PostgREST: ambos columnas aceptan int y
-- rechazan uuid; compras_ordenes count = 0.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE compras_ordenes ALTER COLUMN proyecto_id TYPE uuid USING proyecto_id::text::uuid;
ALTER TABLE compras_ordenes ALTER COLUMN evento_id   TYPE uuid USING evento_id::text::uuid;

-- Verificación (opcional):
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name='compras_ordenes' AND column_name IN ('proyecto_id','evento_id');
