-- =============================================
-- MEPEX — Triggers de completitud_pct (Tanda 3.C)
-- Fecha: 2026-05-16
-- =============================================
-- Mantiene `proyectos.completitud_pct` actualizado automáticamente.
--
-- Mapeo (del blueprint §F12):
--   pendiente             →   0%
--   en_armado             →  25%
--   listo                 →  50%
--   despachado            →  75%
--   cerrado               → 100%
--   Encuesta respondida   → 100% (también pasa estado_taller a 'cerrado')
--
-- Dos triggers:
--   1. BEFORE UPDATE ON proyectos: cuando cambia estado_taller, recalcula pct.
--   2. AFTER UPDATE ON encuestas_evento: cuando se responde la encuesta,
--      todos los proyectos del evento pasan a estado='cerrado' + 100%.
-- =============================================


-- ─── Función helper: calcula el % para un proyecto dado ───
CREATE OR REPLACE FUNCTION public.calc_completitud_pct(p_proyecto_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_estado VARCHAR;
    v_evento_id UUID;
    v_encuesta_respondida BOOLEAN := FALSE;
BEGIN
    SELECT estado_taller, evento_id
        INTO v_estado, v_evento_id
        FROM public.proyectos
        WHERE id = p_proyecto_id;

    IF v_evento_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.encuestas_evento
            WHERE evento_id = v_evento_id AND respondida_at IS NOT NULL
        ) INTO v_encuesta_respondida;
    END IF;

    IF v_encuesta_respondida THEN
        RETURN 100;
    END IF;

    RETURN CASE COALESCE(v_estado, 'pendiente')
        WHEN 'pendiente'  THEN 0
        WHEN 'en_armado'  THEN 25
        WHEN 'listo'      THEN 50
        WHEN 'despachado' THEN 75
        WHEN 'cerrado'    THEN 100
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql STABLE;


-- ─── Trigger 1: proyectos BEFORE UPDATE ───
-- Cuando cambia estado_taller, recalcula completitud_pct en la misma fila
-- antes de guardar.
CREATE OR REPLACE FUNCTION public.trg_proyectos_completitud_fn()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular si cambió el estado_taller
    IF NEW.estado_taller IS DISTINCT FROM OLD.estado_taller THEN
        NEW.completitud_pct := public.calc_completitud_pct(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proyectos_completitud ON public.proyectos;
CREATE TRIGGER trg_proyectos_completitud
    BEFORE UPDATE ON public.proyectos
    FOR EACH ROW EXECUTE FUNCTION public.trg_proyectos_completitud_fn();


-- ─── Trigger 2: encuestas_evento AFTER UPDATE ───
-- Cuando se responde una encuesta (respondida_at pasa de NULL a algo),
-- todos los proyectos del evento se cierran al 100%.
CREATE OR REPLACE FUNCTION public.trg_encuesta_respondida_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.respondida_at IS NOT NULL
       AND (OLD.respondida_at IS NULL OR OLD.respondida_at IS DISTINCT FROM NEW.respondida_at)
    THEN
        UPDATE public.proyectos
        SET estado_taller = 'cerrado',
            completitud_pct = 100,
            estado_taller_updated_at = NOW()
        WHERE evento_id = NEW.evento_id
          AND _deleted = FALSE
          AND estado_taller IS DISTINCT FROM 'cerrado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_encuesta_respondida ON public.encuestas_evento;
CREATE TRIGGER trg_encuesta_respondida
    AFTER UPDATE ON public.encuestas_evento
    FOR EACH ROW EXECUTE FUNCTION public.trg_encuesta_respondida_fn();


-- ─── Backfill ───
-- Recalcular completitud_pct para todos los proyectos existentes para que
-- la columna refleje el estado real al momento de aplicar esta migración.
UPDATE public.proyectos
SET completitud_pct = public.calc_completitud_pct(id)
WHERE _deleted = FALSE;


-- ─── Verificación ───
-- SELECT id, nombre, estado_taller, completitud_pct
-- FROM proyectos WHERE _deleted = FALSE LIMIT 10;
