-- ═══════════════════════════════════════════════════════════════════
-- Migración: FKs reales en cotizaciones para event_id y project_id
-- ═══════════════════════════════════════════════════════════════════
-- Fase 2 CRM — branch: rediseno-modulos
--
-- Las columnas event_id y project_id ya existen como uuid nullable
-- (creadas por el cotizador externo: http://195.200.1.250/cotizador/).
-- Hay project_id huérfanos (apuntan a proyectos inexistentes tras el
-- rename de Fase 1). Se setean a NULL antes de agregar la FK.
--
-- Idempotente: DROP CONSTRAINT IF EXISTS antes de cada ADD CONSTRAINT
-- (Postgres no soporta ADD CONSTRAINT IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Limpiar event_id huérfanos (defensivo)
UPDATE public.cotizaciones
   SET event_id = NULL
 WHERE event_id IS NOT NULL
   AND event_id NOT IN (SELECT id FROM public.eventos);

-- 2. Limpiar project_id huérfanos
UPDATE public.cotizaciones
   SET project_id = NULL
 WHERE project_id IS NOT NULL
   AND project_id NOT IN (SELECT id FROM public.proyectos);

-- 3. Agregar FK event_id → eventos.id (idempotente)
ALTER TABLE public.cotizaciones
  DROP CONSTRAINT IF EXISTS fk_cotizaciones_evento;
ALTER TABLE public.cotizaciones
  ADD CONSTRAINT fk_cotizaciones_evento
  FOREIGN KEY (event_id)
  REFERENCES public.eventos(id)
  ON DELETE SET NULL;

-- 4. Agregar FK project_id → proyectos.id (idempotente)
ALTER TABLE public.cotizaciones
  DROP CONSTRAINT IF EXISTS fk_cotizaciones_proyecto;
ALTER TABLE public.cotizaciones
  ADD CONSTRAINT fk_cotizaciones_proyecto
  FOREIGN KEY (project_id)
  REFERENCES public.proyectos(id)
  ON DELETE SET NULL;

-- 5. Índices parciales para joins
CREATE INDEX IF NOT EXISTS idx_cotizaciones_event_id
  ON public.cotizaciones(event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_project_id
  ON public.cotizaciones(project_id)
  WHERE project_id IS NOT NULL;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr aparte después del COMMIT
-- ═══════════════════════════════════════════════════════════════════
-- SELECT
--     count(*) FILTER (WHERE event_id IS NOT NULL)   AS con_event,
--     count(*) FILTER (WHERE project_id IS NOT NULL) AS con_project,
--     count(*) AS total
--   FROM public.cotizaciones;
--
-- SELECT conname, conrelid::regclass, confrelid::regclass
--   FROM pg_constraint
--  WHERE conrelid = 'public.cotizaciones'::regclass
--    AND contype  = 'f';
