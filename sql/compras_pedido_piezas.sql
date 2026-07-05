-- ============================================================
-- Compras → Pedido/OC puede linkear PIEZAS del catálogo (no solo insumos)
-- ============================================================
-- Extiende el circuito comprar→stock (sql/compras_stock_recepcion.sql) para que un
-- ítem de pedido/OC pueda apuntar a una PIEZA del catálogo (catalogo_items), además
-- de a un insumo (insumos_base). Al recibir la OC, el stock se suma a la pieza vía la
-- misma RPC atómica ajustar_stock, que YA soporta catalogo_items
-- (sql/inventario_ajustar_stock.sql: ELSIF p_tabla = 'catalogo_items' → UPDATE stock).
--
-- Caso de uso: MEPEX repone/amplía su parque de alquiler comprando piezas terminadas
-- (sillas, tarimas, etc.) → suma stock a catalogo_items, igual que compra materia prima
-- → suma a insumos_base.
--
-- Aditivo e idempotente (ADD COLUMN IF NOT EXISTS). Sin cambios destructivos y sin
-- tocar la RPC (ya es genérica por tabla con whitelist insumos_base/catalogo_items).
-- ⚠️ SQL-FIRST: correr ESTO antes de pullear el código (api.js/compras.js nuevos
--    escriben esta columna). El código degrada limpio si no está (queda como insumo_id).
-- ============================================================

ALTER TABLE public.compras_orden_items ADD COLUMN IF NOT EXISTS catalogo_item_id bigint;
COMMENT ON COLUMN public.compras_orden_items.catalogo_item_id IS 'FK lógica a catalogo_items.id (pieza del catálogo, sin constraint). Al recibir la OC suma stock a esa pieza vía ajustar_stock(''catalogo_items'', ...). Excluyente con insumo_id.';
