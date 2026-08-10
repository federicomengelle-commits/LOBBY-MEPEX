-- =====================================================================
-- Costos — columna `notas` en catalogo_items
-- =====================================================================
-- 🟥 PENDIENTE DE CORRER A MANO en el SQL Editor de Supabase.
--
-- POR QUÉ: la ficha de receta del módulo Costos tiene un bloque "Notas"
-- desde F.10, pero la columna NUNCA existió en la base (verificado contra
-- prod el 2026-08-09: `column catalogo_items.notas does not exist`).
-- Encima `API.updateCatalogoItem` no mapeaba el campo, así que el payload
-- salía VACÍO, el UPDATE "funcionaba" y la UI toasteaba "Notas guardadas"
-- sin guardar nada. El mapeo ya está agregado en api.js; hasta que se corra
-- este ALTER el bloque se muestra deshabilitado con el motivo a la vista.
--
-- Aditivo e idempotente: sólo AGREGA una columna nullable. No toca costeo,
-- precios, snapshots ni `es_cotizable` (contrato con el Cotizador externo).
-- Tampoco hace falta tocar RLS: hereda las policies de `catalogo_items`.
-- =====================================================================

ALTER TABLE public.catalogo_items
  ADD COLUMN IF NOT EXISTS notas text;

COMMENT ON COLUMN public.catalogo_items.notas IS
  'Observaciones libres del ítem (bloque Notas de la ficha de receta en Costos). No interviene en el cálculo de costos.';

-- Verificación:
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'catalogo_items' AND column_name = 'notas';
