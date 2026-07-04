-- ============================================================
-- SEAM Compras → Stock: recepción de OC que actualiza el inventario
-- ============================================================
-- Cierra el agujero: hoy marcar una OC como 'recibida' NO mueve el inventario.
-- Estructura el link ítem-de-OC → insumo (para saber qué stock sumar) + un modo
-- de recepción INCOMPLETA con nota y flag de seguimiento del caso, y un guard de
-- idempotencia para no doblar el stock si se re-marca.
--
-- Aditivo e idempotente (ADD COLUMN IF NOT EXISTS). La RPC atómica ajustar_stock
-- ya existe (sql/inventario_ajustar_stock.sql). Sin cambios destructivos.
-- ⚠️ SQL-FIRST: correr ESTO antes de pullear el código (api.js/compras.js nuevos
--    escriben estas columnas). Sofi puede revisar el circuito antes de usarlo en serio.
-- ============================================================

-- Ítems de OC: link estructurado al insumo + cantidad realmente recibida
ALTER TABLE public.compras_orden_items ADD COLUMN IF NOT EXISTS insumo_id bigint;
ALTER TABLE public.compras_orden_items ADD COLUMN IF NOT EXISTS cantidad_recibida numeric;
COMMENT ON COLUMN public.compras_orden_items.insumo_id IS 'FK lógica a insumos_base.id (sin constraint). Define qué insumo suma stock al recibir la OC.';
COMMENT ON COLUMN public.compras_orden_items.cantidad_recibida IS 'Cantidad realmente recibida (puede ser < cantidad si la recepción fue incompleta). Es lo que suma al stock.';

-- OC: estado de recepción + seguimiento del caso + guard de doble-conteo
ALTER TABLE public.compras_ordenes ADD COLUMN IF NOT EXISTS recepcion_estado text;                                   -- 'completa' | 'incompleta'
ALTER TABLE public.compras_ordenes ADD COLUMN IF NOT EXISTS recepcion_nota text;
ALTER TABLE public.compras_ordenes ADD COLUMN IF NOT EXISTS recepcion_pendiente boolean NOT NULL DEFAULT false;      -- "activable para seguir el caso" (recepción incompleta)
ALTER TABLE public.compras_ordenes ADD COLUMN IF NOT EXISTS stock_aplicado boolean NOT NULL DEFAULT false;           -- idempotencia: el stock ya se sumó
ALTER TABLE public.compras_ordenes ADD COLUMN IF NOT EXISTS recibida_at timestamptz;
COMMENT ON COLUMN public.compras_ordenes.recepcion_pendiente IS 'true = recepción incompleta pendiente de seguimiento (llegó parte, falta el resto).';
COMMENT ON COLUMN public.compras_ordenes.stock_aplicado IS 'true = el stock de esta OC ya se aplicó al inventario. Evita doble conteo si se re-marca recibida.';

-- ============================================================
-- Verificación rápida:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='compras_orden_items' AND column_name IN ('insumo_id','cantidad_recibida');
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='compras_ordenes' AND column_name LIKE 'recepcion%' OR column_name IN ('stock_aplicado','recibida_at');
-- ============================================================
