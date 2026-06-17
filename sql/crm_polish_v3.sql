-- ═══════════════════════════════════════════════════════════════════
-- CRM POLISH v3 — temperatura override + lecturas por usuario (Fase 7)
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-06-17. Idempotente. Correr en Supabase SQL Editor ANTES del push del JS.
--  · Temperatura: la AUTO se calcula por recencia en el front (Hot ≤5d / Warm 6-12d /
--    Cold >12d desde el último mensaje). Acá solo guardamos el OVERRIDE manual.
--  · Lecturas: leído/no-leído por usuario en la Bandeja.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Override manual de temperatura (true = la fijó una persona → no la pisa la regla)
ALTER TABLE public.crm_casos
  ADD COLUMN IF NOT EXISTS temperatura_manual boolean NOT NULL DEFAULT false;

-- 2) Lecturas por usuario (leído / no leído)
CREATE TABLE IF NOT EXISTS public.crm_caso_lecturas (
  caso_id      uuid NOT NULL REFERENCES public.crm_casos(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (caso_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_lecturas_user ON public.crm_caso_lecturas(user_id);

-- RLS: cada usuario solo ve/escribe sus propias lecturas
ALTER TABLE public.crm_caso_lecturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_lecturas_all ON public.crm_caso_lecturas;
CREATE POLICY crm_lecturas_all ON public.crm_caso_lecturas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ✅ Verificación:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='crm_casos' AND column_name='temperatura_manual';
--   SELECT count(*) FROM public.crm_caso_lecturas;
