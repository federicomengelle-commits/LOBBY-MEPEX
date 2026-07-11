-- =====================================================================
-- Seguridad — PASO 2 de la revisión RLS (auditoría JordiGPT §M3)
-- Cierra las 2 decisiones pendientes de sql/seguridad_rls_fixes.sql:
--   2.a  clientes legible por anon   (PII: toda la base de clientes)
--   2.b  encuestas_evento editable por anon (BOLA: pisar cualquier encuesta)
--
-- CÓMO: la encuesta pública (encuesta.html) era el ÚNICO consumidor anon de
-- clientes / eventos / encuestas_evento (verificado 2026-07-11: el cotizador
-- va por su backend con service_role; WEB-MEPEX y el generador de propuestas
-- no usan Supabase). Se mueve todo el flujo público a 2 RPCs SECURITY DEFINER
-- que validan el token server-side, y se dropean las 4 policies anon.
--
-- ⚠️ ORDEN DE DEPLOY (para no romper la encuesta en el medio):
--   1. Correr ESTE archivo entero (crea los RPCs — inofensivo, el flujo viejo sigue andando).
--   2. ~/pull-lobby.sh  (encuesta.html nuevo, que usa los RPCs).
--   3. Smoke test: abrir un link de encuesta real → carga y (si querés) responder una de prueba.
--   4. Correr sql/seguridad_rls_paso2b_drop_anon.sql (dropea las policies anon + verifica).
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- RPCs públicos de la encuesta (correr ANTES del pull)
-- ─────────────────────────────────────────────────────────────────────

-- A.1 — Cargar la encuesta por token. Devuelve SOLO los campos que la página
--       pública necesita (nada de ids internos, enviada_por, etc.). Los joins a
--       eventos/clientes (fallback para encuestas viejas sin titulo/subtitulo)
--       se resuelven ACÁ ADENTRO → anon ya no necesita leer esas tablas.
CREATE OR REPLACE FUNCTION public.fn_encuesta_publica_get(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb;
BEGIN
    IF p_token IS NULL OR length(p_token) < 8 THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
        'titulo',         e.titulo,
        'subtitulo',      e.subtitulo,
        'nps',            e.nps,
        'respondida_at',  e.respondida_at,
        'evento_nombre',  ev.nombre,
        'cliente_nombre', COALESCE(c.nombre_empresa, c.razon_social)
    )
    INTO v
    FROM public.encuestas_evento e
    LEFT JOIN public.eventos  ev ON ev.id = e.evento_id
    LEFT JOIN public.clientes c  ON c.id = e.cliente_id
    WHERE e.token = p_token
    LIMIT 1;

    RETURN v;   -- NULL si el token no existe → la página muestra "link no válido"
END;
$$;

-- A.2 — Responder la encuesta. Valida token + NPS server-side, sanitiza las
--       respuestas por aspecto (solo keys conocidas, valores 1..5) y capea el
--       comentario. UN SOLO USO: solo actualiza si respondida_at IS NULL →
--       nadie puede pisar una respuesta existente (el fix del BOLA).
--       El UPDATE dispara los triggers existentes (notif PM/admin + completitud)
--       igual que antes: solo saltan en la transición NULL→NOT NULL.
CREATE OR REPLACE FUNCTION public.fn_encuesta_publica_responder(
    p_token      text,
    p_nps        int,
    p_respuestas jsonb DEFAULT NULL,
    p_comentario text  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id   uuid;
    v_resp jsonb := NULL;
    k      text;
    val    jsonb;
BEGIN
    IF p_token IS NULL OR length(p_token) < 8 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
    END IF;
    IF p_nps IS NULL OR p_nps < 0 OR p_nps > 10 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'nps_invalido');
    END IF;

    -- Sanitizar respuestas por aspecto: whitelist de keys + valores numéricos 1..5.
    IF p_respuestas IS NOT NULL AND jsonb_typeof(p_respuestas) = 'object' THEN
        FOR k, val IN SELECT * FROM jsonb_each(p_respuestas) LOOP
            IF k IN ('calidad', 'tiempos', 'atencion', 'armado')
               AND jsonb_typeof(val) = 'number'
               AND (val #>> '{}')::numeric BETWEEN 1 AND 5 THEN
                v_resp := COALESCE(v_resp, '{}'::jsonb)
                          || jsonb_build_object(k, round((val #>> '{}')::numeric)::int);
            END IF;
        END LOOP;
    END IF;

    UPDATE public.encuestas_evento
       SET nps           = p_nps,
           respuestas    = v_resp,
           comentario    = NULLIF(left(btrim(p_comentario), 2000), ''),
           respondida_at = now()
     WHERE token = p_token
       AND respondida_at IS NULL
     RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.encuestas_evento WHERE token = p_token) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'ya_respondida');
        END IF;
        RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Permisos: solo anon + authenticated pueden ejecutarlos.
REVOKE ALL ON FUNCTION public.fn_encuesta_publica_get(text)                        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_encuesta_publica_responder(text, int, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_encuesta_publica_get(text)                        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_encuesta_publica_responder(text, int, jsonb, text) TO anon, authenticated;
