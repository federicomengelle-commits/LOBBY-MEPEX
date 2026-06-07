-- =============================================
-- FASE 4.2 — Gente por jornada
-- =============================================
-- Liga una asignación de persona a una JORNADA puntual (día), no solo a un
-- rango por fase. Reusa `asignaciones_evento` (un solo sistema):
--   · jornada_id NULL  = asignación "general" del evento (las 16 viejas, por rango).
--   · jornada_id SET   = persona citada a esa jornada (día) con su rol.
--
-- Idempotente. Correr en Supabase SQL Editor (SQL-first, antes del JS).
-- =============================================

ALTER TABLE public.asignaciones_evento
    ADD COLUMN IF NOT EXISTS jornada_id UUID REFERENCES public.evento_jornadas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_asignaciones_jornada
    ON public.asignaciones_evento (jornada_id) WHERE jornada_id IS NOT NULL;

-- =============================================
-- Nota IMPORTANTE para el JS (4.2b):
-- ON DELETE CASCADE borra las asignaciones de una jornada si la jornada se borra.
-- Por eso `API.setJornadas` deja de hacer delete-all+insert y pasa a UPSERT
-- (mantiene los id de las jornadas existentes), para que editar horarios NO
-- borre la gente ya citada. Solo las jornadas realmente eliminadas arrastran
-- sus asignaciones (correcto: si sacás el día, sacás la gente de ese día).
-- =============================================
