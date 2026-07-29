-- =============================================
-- MEPEX Lobby — Circuito de venta, Fase 1b (parche)
-- =============================================
-- Spec: docs/circuito-venta-blueprint.md §3.2, decisión D5
-- Corre DESPUÉS de sql/ventas_fase1.sql
--
-- POR QUÉ:
-- `ventas_fase1.sql` agregó `plan_cobro.venta_id` pero dejó `proyecto_id` en
-- NOT NULL. Verificado contra prod 2026-07-29 con una sonda de INSERT:
--   23502 · null value in column "proyecto_id" ... violates not-null constraint
--
-- Consecuencia: una venta que cubre 3 proyectos (D5) no puede tener UN plan de
-- cobro — habría que elegir un proyecto arbitrario y el dato quedaría mintiendo.
-- El plan tiene que poder colgar de la venta sola.
--
-- ADITIVO Y REVERSIBLE. Relajar un NOT NULL nunca rechaza filas existentes:
-- los 3 planes de prod tienen proyecto_id cargado y no los toca. El CHECK que
-- lo reemplaza es MÁS permisivo que el estado actual, así que tampoco puede
-- rebotar nada de lo que ya está.
-- =============================================

BEGIN;

-- 1. Relajar el NOT NULL
ALTER TABLE public.plan_cobro ALTER COLUMN proyecto_id DROP NOT NULL;

-- 2. Reemplazarlo por la regla que de verdad queremos: un plan cuelga de algo.
--    De una venta, de un proyecto, o de los dos — pero nunca de nada.
--    Los 3 planes existentes tienen proyecto_id => lo cumplen.
ALTER TABLE public.plan_cobro DROP CONSTRAINT IF EXISTS chk_plan_cobro_tiene_dueno;
ALTER TABLE public.plan_cobro ADD CONSTRAINT chk_plan_cobro_tiene_dueno
    CHECK (proyecto_id IS NOT NULL OR venta_id IS NOT NULL);

COMMIT;


-- ════════════════════════════════════════════════
--  VERIFICACIÓN (devuelve filas; los RAISE NOTICE no se ven en el SQL Editor)
-- ════════════════════════════════════════════════

SELECT 'proyecto_id nullable' AS chequeo,
       (SELECT is_nullable FROM information_schema.columns
         WHERE table_schema='public' AND table_name='plan_cobro'
           AND column_name='proyecto_id')                          AS valor,
       'YES'                                                        AS esperado
UNION ALL
SELECT 'constraint de dueño',
       (SELECT count(*)::text FROM pg_constraint
         WHERE conrelid='public.plan_cobro'::regclass
           AND conname='chk_plan_cobro_tiene_dueno'), '1'
UNION ALL
SELECT 'planes existentes intactos',
       (SELECT count(*)::text FROM public.plan_cobro WHERE _deleted = false), '3'
UNION ALL
SELECT 'planes huerfanos (deberia ser 0)',
       (SELECT count(*)::text FROM public.plan_cobro
         WHERE proyecto_id IS NULL AND venta_id IS NULL), '0';


-- ════════════════════════════════════════════════
--  ROLLBACK
-- ════════════════════════════════════════════════
-- ⚠️ Solo funciona si NO se creó ningún plan colgado de una venta sola.
--    Si los hay, el ALTER ... SET NOT NULL los rebota: hay que decidir qué
--    hacer con ellos ANTES (asignarles proyecto o borrarlos).
--
-- BEGIN;
-- ALTER TABLE public.plan_cobro DROP CONSTRAINT IF EXISTS chk_plan_cobro_tiene_dueno;
-- ALTER TABLE public.plan_cobro ALTER COLUMN proyecto_id SET NOT NULL;
-- COMMIT;
