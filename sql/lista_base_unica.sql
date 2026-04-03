-- ================================================
-- MEPEX: Lista Base única + precio_cliente para Cotizador
-- Fecha: 2026-04-03
-- ================================================

-- 1. Agregar columna precio_cliente a catalogo_items
--    El Cotizador externo lee este campo para armar cotizaciones
ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS precio_cliente NUMERIC(12,2) DEFAULT 0;

-- 2. Eliminar la lista de tipo "agencias" (ya no se usan múltiples listas)
DELETE FROM listas_precio WHERE tipo = 'agencias';

-- 3. Eliminar listas custom si existieran
DELETE FROM listas_precio WHERE tipo = 'custom';

-- 4. Asegurar que la lista general existe y está activa
UPDATE listas_precio SET estado = 'activa' WHERE tipo = 'general';
