-- =============================================
-- MEPEX Lobby — Circuito de venta, Fase 1c
-- Un solo plan de cobro vivo por venta
-- =============================================
-- Spec:  docs/circuito-venta-blueprint.md  (§3 modelo de datos, D5)
-- Sigue a: sql/ventas_fase1.sql + sql/ventas_fase1b_plan_cobro_nullable.sql
--
-- POR QUÉ
-- La ficha de la venta arma el plan de cobro desde el navegador, y el único
-- candado contra "dos planes para la misma venta" era `VentaDetalle._plan`,
-- que vive EN MEMORIA y por lo tanto es por pestaña. Dos admins con la ficha
-- abierta (o la misma persona en dos pestañas) crean dos cabeceras; después
-- `API.getVentaResumen` suma las cuotas de TODOS los planes de la venta
-- (`.in('plan_cobro_id', planIds)`), así que el facturado y el cobrado de la
-- ficha salen duplicados. Es el mismo TOCTOU que ya cubre `uq_ventas_caso`
-- en sql/ventas_fase1.sql para el par caso↔venta.
--
-- IDEMPOTENTE y ADITIVO. No borra, no altera columnas, no toca datos.
--
-- ALCANCE REAL DEL CANDADO
--   · `venta_id IS NOT NULL` → los planes de antes del circuito (venta_id NULL,
--     que son TODOS los existentes) quedan completamente afuera del índice:
--     pueden seguir siendo varios por proyecto, como hasta hoy.
--   · `_deleted = false` → borrar el plan (soft delete) libera el lugar y se
--     puede armar uno nuevo para la misma venta. Sin esto, un plan descartado
--     dejaría la venta sin poder tener plan nunca más.
--
-- ⚠️ El índice es la red; el mensaje humano lo pone el front (venta-detalle.js
--    traduce el 23505 a "Esta venta ya tiene un plan de cobro"). Correr este
--    SQL ANTES del push del JS: sin el índice el front no rompe (nunca ve el
--    23505), y sin el JS el índice tampoco (solo devuelve el error crudo).
-- =============================================

BEGIN;

-- ════════════════════════════════════════════════
--  0. Pre-chequeo: ¿ya hay duplicados?
-- ════════════════════════════════════════════════
-- Si los hubiera, el CREATE UNIQUE INDEX falla con "could not create unique
-- index" sin decir QUÉ venta. Esto corta antes y con un mensaje que se entiende.
-- El BEGIN de arriba garantiza que no queda nada a medio aplicar.

DO $dup$
DECLARE
    v_dup INT;
BEGIN
    SELECT count(*) INTO v_dup
      FROM (SELECT venta_id
              FROM public.plan_cobro
             WHERE venta_id IS NOT NULL AND _deleted = false
             GROUP BY venta_id
            HAVING count(*) > 1) d;

    IF v_dup > 0 THEN
        RAISE EXCEPTION
            'Hay % venta(s) con más de un plan de cobro vivo. Resolvé los duplicados primero (query de diagnóstico al pie de este archivo).',
            v_dup;
    END IF;
END
$dup$;


-- ════════════════════════════════════════════════
--  1. El índice
-- ════════════════════════════════════════════════
-- Parcial y único: 1 plan vivo por venta. Mismo patrón que uq_ventas_caso.
-- NO va CONCURRENTLY: no se puede dentro de una transacción y la tabla es
-- chica (el lock dura milisegundos).

CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_cobro_venta_viva
    ON public.plan_cobro (venta_id) WHERE venta_id IS NOT NULL AND _deleted = false;

COMMIT;


-- ════════════════════════════════════════════════
--  VERIFICACIÓN — devuelve filas (los RAISE NOTICE no se ven en el SQL Editor)
-- ════════════════════════════════════════════════

SELECT 'índice uq_plan_cobro_venta_viva' AS chequeo,
       (SELECT count(*)::text FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = 'plan_cobro'
           AND indexname = 'uq_plan_cobro_venta_viva')                    AS valor,
       '1'                                                               AS esperado
UNION ALL
SELECT 'ventas con más de un plan vivo',
       (SELECT count(*)::text
          FROM (SELECT venta_id FROM public.plan_cobro
                 WHERE venta_id IS NOT NULL AND _deleted = false
                 GROUP BY venta_id HAVING count(*) > 1) d),
       '0'
UNION ALL
SELECT 'planes colgados de una venta (informativo)',
       (SELECT count(*)::text FROM public.plan_cobro
         WHERE venta_id IS NOT NULL AND _deleted = false),
       'cualquiera'
UNION ALL
SELECT 'planes viejos por proyecto — NO los toca (informativo)',
       (SELECT count(*)::text FROM public.plan_cobro
         WHERE venta_id IS NULL AND _deleted = false),
       'cualquiera';


-- ════════════════════════════════════════════════
--  DIAGNÓSTICO si el pre-chequeo aborta
-- ════════════════════════════════════════════════
-- Lista las ventas con más de un plan vivo y sus planes, para decidir a mano
-- cuál se conserva. NO borrar a ciegas: el plan que tiene cuotas con cobros
-- aplicados o comprobante vinculado es el bueno.
--
-- SELECT p.venta_id,
--        p.id AS plan_id,
--        p.total_plan,
--        p.created_at,
--        (SELECT count(*) FROM public.plan_cobro_items i
--          WHERE i.plan_cobro_id = p.id AND i._deleted = false)                      AS cuotas,
--        (SELECT COALESCE(sum(i.monto_cobrado), 0) FROM public.plan_cobro_items i
--          WHERE i.plan_cobro_id = p.id AND i._deleted = false)                      AS cobrado,
--        (SELECT count(*) FROM public.plan_cobro_items i
--          WHERE i.plan_cobro_id = p.id AND i._deleted = false
--            AND i.comprobante_venta_id IS NOT NULL)                                 AS cuotas_facturadas
--   FROM public.plan_cobro p
--  WHERE p._deleted = false
--    AND p.venta_id IN (SELECT venta_id FROM public.plan_cobro
--                        WHERE venta_id IS NOT NULL AND _deleted = false
--                        GROUP BY venta_id HAVING count(*) > 1)
--  ORDER BY p.venta_id, p.created_at;
--
-- Para descartar el sobrante (soft delete, reversible) — cambiar el id:
-- UPDATE public.plan_cobro       SET _deleted = true WHERE id = '<plan_id_sobrante>';
-- UPDATE public.plan_cobro_items SET _deleted = true WHERE plan_cobro_id = '<plan_id_sobrante>';


-- ════════════════════════════════════════════════
--  ROLLBACK (correr solo si hace falta volver atrás)
-- ════════════════════════════════════════════════
-- Limpio y sin pérdida de datos: un índice no guarda nada. Al sacarlo, la
-- única defensa vuelve a ser la de memoria del front.
--
-- BEGIN;
-- DROP INDEX IF EXISTS public.uq_plan_cobro_venta_viva;
-- COMMIT;
