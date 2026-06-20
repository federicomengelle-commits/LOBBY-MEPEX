-- ============================================================
-- Fase 12.D — RPC ajustar_stock (ajuste ATÓMICO de stock)
-- ============================================================
-- Reemplaza el read-modify-write no atómico del front
-- (inventario.js: leía item.stock cacheado y escribía current ± qty →
-- race si dos usuarios mueven el mismo ítem + sin rollback ni chequeo de error).
-- Acá el incremento es atómico en una sola sentencia UPDATE.
--
-- Idempotente (CREATE OR REPLACE). Whitelist de tablas (solo stock de inventario).
-- El front (api.js?v / inventario.js) la usa con fallback: si la RPC todavía
-- no existe, cae al read-modify-write legacy → seguro correr este SQL DESPUÉS
-- de pushear el JS (o antes, da igual).
--
-- Correr en Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION ajustar_stock(p_tabla text, p_id bigint, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stock numeric;
BEGIN
    -- Whitelist: solo las 2 tablas de stock de inventario.
    IF p_tabla = 'insumos_base' THEN
        UPDATE insumos_base
           SET stock = COALESCE(stock, 0) + p_delta
         WHERE id = p_id
        RETURNING stock INTO v_stock;
    ELSIF p_tabla = 'catalogo_items' THEN
        UPDATE catalogo_items
           SET stock = COALESCE(stock, 0) + p_delta
         WHERE id = p_id
        RETURNING stock INTO v_stock;
    ELSE
        RAISE EXCEPTION 'ajustar_stock: tabla no permitida (%)', p_tabla;
    END IF;

    IF v_stock IS NULL THEN
        RAISE EXCEPTION 'ajustar_stock: id % no encontrado en %', p_id, p_tabla;
    END IF;

    RETURN v_stock;
END;
$$;

GRANT EXECUTE ON FUNCTION ajustar_stock(text, bigint, numeric) TO authenticated;

-- Verificación rápida (no muta — delta 0):
--   SELECT ajustar_stock('insumos_base', <id>, 0);
