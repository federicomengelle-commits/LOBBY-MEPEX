-- =============================================
-- MEPEX — Fix trigger completitud_pct (bug detectado en verificación)
-- Fecha: 2026-05-16
-- =============================================
-- Bug original: la función trg_proyectos_completitud_fn llamaba a
-- calc_completitud_pct(NEW.id) que hace SELECT de la tabla proyectos.
-- En un BEFORE UPDATE el SELECT lee el valor OLD (la fila aún no fue
-- updateada), entonces el cálculo era con estado_taller viejo.
--
-- Fix: la función trigger ahora calcula directamente con NEW.estado_taller
-- sin pasar por calc_completitud_pct (que sigue válida para llamadas
-- externas / backfill).
-- =============================================

CREATE OR REPLACE FUNCTION public.trg_proyectos_completitud_fn()
RETURNS TRIGGER AS $$
DECLARE
    v_encuesta_respondida BOOLEAN := FALSE;
BEGIN
    IF NEW.estado_taller IS DISTINCT FROM OLD.estado_taller THEN
        -- Si hay encuesta respondida del evento, forzar a 100
        IF NEW.evento_id IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.encuestas_evento
                WHERE evento_id = NEW.evento_id AND respondida_at IS NOT NULL
            ) INTO v_encuesta_respondida;
        END IF;

        IF v_encuesta_respondida THEN
            NEW.completitud_pct := 100;
        ELSE
            NEW.completitud_pct := CASE COALESCE(NEW.estado_taller, 'pendiente')
                WHEN 'pendiente'  THEN 0
                WHEN 'en_armado'  THEN 25
                WHEN 'listo'      THEN 50
                WHEN 'despachado' THEN 75
                WHEN 'cerrado'    THEN 100
                ELSE 0
            END;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
