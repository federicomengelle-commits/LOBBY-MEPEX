-- =============================================
-- Encuesta de satisfacción POR PROYECTO (2026-07-01)
-- Mueve la encuesta NPS de Eventos a Proyectos y la vuelve MULTI-DIMENSIONAL.
-- La tabla sigue llamándose `encuestas_evento` (no se renombra para no romper nada),
-- pero ahora cuelga del PROYECTO (el stand entregado). Idempotente.
-- =============================================

-- 1. Nuevas columnas
ALTER TABLE public.encuestas_evento
    ADD COLUMN IF NOT EXISTS proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE;

-- Valoración por aspecto: {calidad:5, tiempos:4, atencion:5, armado:3} (1..5, opcional)
ALTER TABLE public.encuestas_evento
    ADD COLUMN IF NOT EXISTS respuestas JSONB;

-- Contexto denormalizado que ve el cliente en el link público. Se guarda al crear
-- la encuesta (lado autenticado) para que la página pública NO tenga que joinear
-- proyectos/eventos (la RLS de encuestas_evento es SELECT USING(true) para anon →
-- joinear expondría esas tablas). titulo = stand/proyecto; subtitulo = cliente · evento.
ALTER TABLE public.encuestas_evento
    ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE public.encuestas_evento
    ADD COLUMN IF NOT EXISTS subtitulo TEXT;

-- 2. evento_id deja de ser obligatorio (la encuesta ahora puede colgar solo del proyecto)
ALTER TABLE public.encuestas_evento
    ALTER COLUMN evento_id DROP NOT NULL;

-- 3. Índice por proyecto
CREATE INDEX IF NOT EXISTS idx_encuestas_proyecto
    ON public.encuestas_evento (proyecto_id);

-- 4. Trigger de notif (AFTER UPDATE, ya existente): ahora linkea al PROYECTO si
--    corresponde y usa el contexto denormalizado. Solo reemplaza la FUNCIÓN;
--    el trigger `trg_encuesta_notif` sigue apuntando a ella.
CREATE OR REPLACE FUNCTION public.trg_encuesta_notif_fn()
RETURNS TRIGGER AS $$
DECLARE
    v_evento_nombre TEXT;
    v_cliente_nombre TEXT;
    v_ctx TEXT;
    v_link TEXT;
    v_nps_label TEXT;
BEGIN
    -- Solo si recién se respondió (pasó de NULL a NOT NULL)
    IF NEW.respondida_at IS NULL OR OLD.respondida_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Contexto para el mensaje: preferir el denormalizado; si no, buscar evento/cliente.
    IF NEW.titulo IS NOT NULL OR NEW.subtitulo IS NOT NULL THEN
        v_ctx := COALESCE(NEW.titulo, '')
                 || CASE WHEN NEW.subtitulo IS NOT NULL THEN ' · ' || NEW.subtitulo ELSE '' END;
    ELSE
        SELECT nombre INTO v_evento_nombre FROM public.eventos WHERE id = NEW.evento_id;
        SELECT COALESCE(nombre_empresa, razon_social) INTO v_cliente_nombre
            FROM public.clientes WHERE id = NEW.cliente_id;
        v_ctx := COALESCE(v_cliente_nombre, '') || ' · ' || COALESCE(v_evento_nombre, '');
    END IF;

    v_nps_label := CASE
        WHEN NEW.nps >= 9 THEN 'Promotor'
        WHEN NEW.nps >= 7 THEN 'Pasivo'
        ELSE 'Detractor'
    END;

    -- Link: al proyecto si la encuesta es de un proyecto; si no, al evento (legacy).
    v_link := CASE
        WHEN NEW.proyecto_id IS NOT NULL THEN '#proyectos/' || NEW.proyecto_id
        ELSE '#eventos?ev=' || COALESCE(NEW.evento_id::text, '')
    END;

    -- Notif PM
    INSERT INTO public.notifications (tipo, titulo, mensaje, target_role, entidad_tipo, entidad_id, link, prioridad)
    VALUES (
        'encuesta_respondida',
        '⭐ Cliente respondió encuesta: NPS ' || NEW.nps || ' (' || v_nps_label || ')',
        v_ctx, 'pm', 'encuesta', NEW.id, v_link,
        CASE WHEN NEW.nps < 7 THEN 'alta' ELSE 'normal' END
    );

    -- Notif admin (mismo contenido)
    INSERT INTO public.notifications (tipo, titulo, mensaje, target_role, entidad_tipo, entidad_id, link, prioridad)
    VALUES (
        'encuesta_respondida',
        '⭐ Cliente respondió encuesta: NPS ' || NEW.nps || ' (' || v_nps_label || ')',
        v_ctx, 'admin', 'encuesta', NEW.id, v_link,
        CASE WHEN NEW.nps < 7 THEN 'alta' ELSE 'normal' END
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Fin: encuesta por proyecto ───
