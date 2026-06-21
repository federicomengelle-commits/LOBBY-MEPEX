-- ============================================================
-- FASE 3d.2 — evento_id en comprobantes recibidos
-- ============================================================
-- Hoy los comprobantes recibidos (OCR/manual) solo imputan a proyecto_id.
-- Con evento_id pueden imputar directo a un evento → aparecen en la
-- rentabilidad por evento (algunos costos son del evento sin un proyecto puntual).
-- El egreso ya tiene evento_id; esto da simetría comprobante↔egreso.
-- Idempotente, additivo, sin riesgo.
-- ============================================================

ALTER TABLE public.comprobantes_recibidos ADD COLUMN IF NOT EXISTS evento_id UUID;

CREATE INDEX IF NOT EXISTS idx_comp_rec_evento ON public.comprobantes_recibidos (evento_id);
