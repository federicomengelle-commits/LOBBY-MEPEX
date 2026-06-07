-- =============================================
-- FASE 4.1 — EVENTO_JORNADAS (constructor de jornadas)
-- =============================================
-- Por fase (armado/evento/desarme) un evento tiene MÚLTIPLES jornadas:
-- cada jornada = fecha + hora_inicio + hora_fin. Tiempo continuo/lineal.
--
-- Compat (bisturí): un trigger DERIVA las columnas viejas de `eventos`
-- (fecha_*_inicio/fin + hora_*_apertura/cierre) desde las jornadas, así
-- calendario / lobby / badges / KPIs siguen andando sin tocarse.
-- Solo se tocan las columnas de una fase si esa fase TIENE jornadas
-- (los eventos viejos sin jornadas conservan sus fechas hasta migrarse).
--
-- Idempotente. Correr en Supabase SQL Editor (SQL-first, antes del JS).
-- =============================================

CREATE TABLE IF NOT EXISTS public.evento_jornadas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id   UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
    fase        TEXT NOT NULL CHECK (fase IN ('armado','evento','desarme')),
    fecha       DATE NOT NULL,
    hora_inicio TIME,
    hora_fin    TIME,
    orden       INTEGER DEFAULT 0,
    notas       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evento_jornadas_evento
    ON public.evento_jornadas (evento_id, fase, fecha, orden);

ALTER TABLE public.evento_jornadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evento_jornadas_all" ON public.evento_jornadas;
CREATE POLICY "evento_jornadas_all" ON public.evento_jornadas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────
-- Trigger: deriva fecha_*/hora_* de `eventos` desde las jornadas.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_evento_jornadas_sync()
RETURNS TRIGGER AS $$
DECLARE
    v UUID := COALESCE(NEW.evento_id, OLD.evento_id);
BEGIN
    -- ARMADO
    UPDATE public.eventos e SET
        fecha_armado_inicio  = s.fmin,
        fecha_armado_fin     = s.fmax,
        hora_armado_apertura = s.hini,
        hora_armado_cierre   = s.hfin
    FROM (
        SELECT MIN(fecha) fmin, MAX(fecha) fmax,
            (SELECT hora_inicio FROM public.evento_jornadas WHERE evento_id=v AND fase='armado' ORDER BY fecha ASC,  orden ASC  LIMIT 1) hini,
            (SELECT hora_fin    FROM public.evento_jornadas WHERE evento_id=v AND fase='armado' ORDER BY fecha DESC, orden DESC LIMIT 1) hfin
        FROM public.evento_jornadas WHERE evento_id=v AND fase='armado'
    ) s
    WHERE e.id=v AND s.fmin IS NOT NULL;

    -- EVENTO
    UPDATE public.eventos e SET
        fecha_evento_inicio  = s.fmin,
        fecha_evento_fin     = s.fmax,
        hora_evento_apertura = s.hini,
        hora_evento_cierre   = s.hfin
    FROM (
        SELECT MIN(fecha) fmin, MAX(fecha) fmax,
            (SELECT hora_inicio FROM public.evento_jornadas WHERE evento_id=v AND fase='evento' ORDER BY fecha ASC,  orden ASC  LIMIT 1) hini,
            (SELECT hora_fin    FROM public.evento_jornadas WHERE evento_id=v AND fase='evento' ORDER BY fecha DESC, orden DESC LIMIT 1) hfin
        FROM public.evento_jornadas WHERE evento_id=v AND fase='evento'
    ) s
    WHERE e.id=v AND s.fmin IS NOT NULL;

    -- DESARME
    UPDATE public.eventos e SET
        fecha_desarme_inicio  = s.fmin,
        fecha_desarme_fin     = s.fmax,
        hora_desarme_apertura = s.hini,
        hora_desarme_cierre   = s.hfin
    FROM (
        SELECT MIN(fecha) fmin, MAX(fecha) fmax,
            (SELECT hora_inicio FROM public.evento_jornadas WHERE evento_id=v AND fase='desarme' ORDER BY fecha ASC,  orden ASC  LIMIT 1) hini,
            (SELECT hora_fin    FROM public.evento_jornadas WHERE evento_id=v AND fase='desarme' ORDER BY fecha DESC, orden DESC LIMIT 1) hfin
        FROM public.evento_jornadas WHERE evento_id=v AND fase='desarme'
    ) s
    WHERE e.id=v AND s.fmin IS NOT NULL;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evento_jornadas_sync ON public.evento_jornadas;
CREATE TRIGGER trg_evento_jornadas_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.evento_jornadas
    FOR EACH ROW EXECUTE FUNCTION public.fn_evento_jornadas_sync();

-- =============================================
-- Notas:
-- * Las jornadas se borran en duro (no _deleted); el trigger re-deriva al borrar.
-- * El `teardownEndDate` que vivía en localStorage queda absorbido: al cargar
--   jornadas de desarme, fecha_desarme_fin = max(fecha) automáticamente.
-- * 2º pase del calendario (mostrar jornadas por día) = más adelante en Fase 4.
-- =============================================
