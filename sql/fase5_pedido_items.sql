-- ════════════════════════════════════════════════════════════════════
-- FASE 5 — Pedido multi-ítem
-- ════════════════════════════════════════════════════════════════════
-- Un pedido puede tener varias cosas (ej. cable 2x1 + cable 3x1), todas
-- juntas para un mismo proveedor. Se guardan en JSONB `items`:
--   [{ "descripcion": "...", "insumo_id": 8|null, "cantidad": 10, "unidad": "m" }, ...]
-- Los campos single existentes (descripcion/insumo_id/cantidad/unidad) quedan
-- como RESUMEN/compat (el 1er ítem). Al convertir a OC, cada ítem se inserta
-- en compras_orden_items (la OC los muestra en "Items de la Orden").
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE compras_pedidos ADD COLUMN IF NOT EXISTS items jsonb;

-- Verificación (opcional):
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name='compras_pedidos' AND column_name='items';
