-- =====================================================================
-- AUDITORÍA 2026-07-31 · T0.8 (tramo RECIBIDOS) — el índice que faltaba
-- Fecha: 2026-08-05
-- =====================================================================
-- Este archivo es el PASO 3 del plan que quedó comentado al pie de
-- `sql/auditoria_t0_8_12_indices_y_search_path.sql` (donde ya pasó por el
-- sql-reviewer). Los pasos 1 y 2 ya se ejecutaron el 2026-08-05:
--
--   PASO 1 · Los tres se miraron contra prod. Confirmado: sólo
--            `eab7d116-a906-4780-9e9a-0040aef22021` (21/06 02:24) tiene
--            `egreso_id` y por lo tanto asiento.
--   PASO 2 · Soft-delete de las dos copias sin pago:
--              dfcf79f7-a605-4696-8ccf-bb985753c333  (20/06 18:11, servicio)
--              a91fcaef-6aed-48d4-acd4-bfc045bc2b75  (20/06 18:12, material)
--            Verificado: el IVA crédito vivo de `comprobantes_recibidos`
--            bajó de $374.010 a $222.810 — exactamente los $151.200 que
--            el Libro IVA Compras estaba computando de más.
--
-- ✅ APLICADO A PROD EL 2026-08-05 por MCP (migración
--    `auditoria_t0_8_indice_unico_comprobantes_recibidos`). El MCP de
--    Supabase apareció a mitad de sesión; hasta entonces sólo había
--    service key, que alcanza para datos pero no para DDL.
--
-- Precondición verificada antes: grupos (cuit, tipo, numero) duplicados
-- entre los vivos = 0.
--
-- Verificado después:
--   · el índice existe en `pg_indexes` con el predicado parcial correcto
--   · prueba funcional con rollback: dos INSERT idénticos → el segundo
--     rebota con **23505**, y no quedó residuo (0 filas con el número
--     de prueba). Ojo al reproducirla: `concepto` es NOT NULL y no
--     estaba en el INSERT de ejemplo original.
-- =====================================================================

BEGIN;

-- Chequeo previo: aborta si hay duplicados vivos (no crea un índice a medias)
DO $$
DECLARE v_dups INT;
BEGIN
    SELECT COUNT(*) INTO v_dups FROM (
        SELECT COALESCE(cuit, ''), tipo, numero
          FROM public.comprobantes_recibidos
         WHERE NOT COALESCE(_deleted, false) AND numero IS NOT NULL
         GROUP BY 1, 2, 3 HAVING COUNT(*) > 1
    ) d;
    IF v_dups > 0 THEN
        RAISE EXCEPTION 'Hay % grupo(s) duplicado(s) vivos. Resolverlos antes de crear el índice.', v_dups;
    END IF;
    RAISE NOTICE 'Sin duplicados vivos — se puede crear el índice.';
END $$;

-- El índice va por CUIT y NO por proveedor_id: los comprobantes vivos tienen
-- `proveedor_id` en NULL, así que un índice por proveedor no restringiría nada.
--
-- El COALESCE(cuit,'') no es cosmético: a diferencia de los emitidos (donde
-- `punto_venta` siempre viene con default), en un recibido cargado a mano o
-- por foto el CUIT puede faltar — y dos NULLs no chocan entre sí en un índice
-- único. Sin el COALESCE, dos comprobantes informales duplicados se colarían.
CREATE UNIQUE INDEX IF NOT EXISTS ux_comprobantes_recibidos_cuit_tipo_numero
    ON public.comprobantes_recibidos (COALESCE(cuit, ''), tipo, numero)
    WHERE _deleted = false AND numero IS NOT NULL;

COMMIT;

-- =====================================================================
-- Verificación posterior
-- =====================================================================
-- SELECT indexname FROM pg_indexes
--  WHERE tablename = 'comprobantes_recibidos'
--    AND indexname = 'ux_comprobantes_recibidos_cuit_tipo_numero';
--
-- Y la prueba funcional, con rollback (tiene que dar 23505):
--   BEGIN;
--     INSERT INTO comprobantes_recibidos (cuit, tipo, numero, neto, iva, total, categoria, fecha)
--     SELECT cuit, tipo, numero, neto, iva, total, categoria, fecha
--       FROM comprobantes_recibidos WHERE NOT COALESCE(_deleted,false) LIMIT 1;
--   ROLLBACK;

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- DROP INDEX IF EXISTS public.ux_comprobantes_recibidos_cuit_tipo_numero;
--
-- Y para revertir el soft-delete del PASO 2 (vuelven los $151.200 al Libro IVA):
-- UPDATE comprobantes_recibidos SET _deleted = false
--  WHERE id IN ('dfcf79f7-a605-4696-8ccf-bb985753c333',
--               'a91fcaef-6aed-48d4-acd4-bfc045bc2b75');
