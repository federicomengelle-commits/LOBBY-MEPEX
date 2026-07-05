-- ============================================================
-- Circuito de gastos de evento: Rendimiento como STAGING → migración + conciliación a Egresos
-- ============================================================
-- Idea Fede + Sofi (2026-07-05). En vez de cargar los gastos de un evento directo en
-- Egresos (Finanzas), se cargan PRIMERO en la planilla de Rendimiento (evento_costos)
-- mientras el evento está en curso; al CERRAR el evento (botón manual) se migran en lote
-- a Egresos, con una conciliación semi-manual contra lo que ya estuviera cargado directo.
--
-- Aditivo e idempotente. SQL-FIRST: el JS nuevo escribe estas columnas; degrada limpio
-- si el SQL no corrió (la carga a Rendimiento y el cierre quedan deshabilitados, el resto
-- del módulo anda igual).
-- ============================================================

-- 1) La línea de planilla puede nacer de un COMPROBANTE cargado (staging, sin pago aún).
--    Al migrar/pagar, el pago hereda este comprobante (no se duplica).
ALTER TABLE public.evento_costos ADD COLUMN IF NOT EXISTS comprobante_recibido_id UUID REFERENCES comprobantes_recibidos(id);
COMMENT ON COLUMN public.evento_costos.comprobante_recibido_id IS 'Comprobante que originó la línea (carga de gasto de evento desde el modal de comprobantes). Al migrar/pagar, el egreso reusa este comprobante en vez de crear otro.';

-- 2) La línea se MIGRA a un egreso al cerrar el evento (pagado O pendiente). Link directo,
--    independiente de evento_costo_pagos (que solo existe si hubo un pago real).
--    El dashboard excluye este egreso de "costos directos" para no duplicar.
ALTER TABLE public.evento_costos ADD COLUMN IF NOT EXISTS egreso_id UUID REFERENCES egresos(id);
COMMENT ON COLUMN public.evento_costos.egreso_id IS 'Egreso al que se migró la línea al cerrar el evento (estado pagado o pendiente). NULL = todavía en staging. El dashboard lo excluye de costos_directo para no duplicar planilla vs Finanzas.';

CREATE INDEX IF NOT EXISTS idx_evento_costos_egreso ON public.evento_costos(egreso_id) WHERE egreso_id IS NOT NULL;

-- 3) CIERRE / migración del evento (disparado a mano desde Rendimiento).
ALTER TABLE public.evento_rendimiento ADD COLUMN IF NOT EXISTS cerrado_at TIMESTAMPTZ;
ALTER TABLE public.evento_rendimiento ADD COLUMN IF NOT EXISTS cerrado_by UUID REFERENCES profiles(id);
COMMENT ON COLUMN public.evento_rendimiento.cerrado_at IS 'Cuándo se cerró/migró el evento (planilla → egresos). NULL = abierto/en staging.';

-- Nota: RLS de evento_costos / evento_rendimiento ya está (sql/rendimiento_evento.sql §6,
-- por fn_role_can(''finanzas'', ...)). Las columnas nuevas heredan esas policies.
