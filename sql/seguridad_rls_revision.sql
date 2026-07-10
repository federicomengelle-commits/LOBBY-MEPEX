-- =====================================================================
-- Revisión de RLS — auditoría de seguridad 2026-07 (docs/auditoria-seguridad-2026-07.md §M3)
-- =====================================================================
-- ⚠️ NO correr entero de un saque. Es un archivo de DIAGNÓSTICO + fixes
--    GUARDADOS por decisión de producto. Leé cada bloque antes de ejecutar.
--    Corré primero la PARTE 1 (solo lectura) y mirá el resultado.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- PARTE 1 · DIAGNÓSTICO (solo lectura, corré esto primero)
-- ─────────────────────────────────────────────────────────────────────

-- 1.a — Tablas del schema public SIN RLS activada (= la publishable key lee/escribe todo).
--       Cualquier tabla acá con datos de negocio es un agujero.
SELECT c.relname AS tabla, c.relrowsecurity AS rls_activa
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false
ORDER BY c.relname;

-- 1.b — Tablas con RLS activada pero SIN ninguna policy (= con RLS on y 0 policies,
--       nadie pasa salvo service_role; puede romper features si falta una policy).
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = t.tablename
  )
ORDER BY t.tablename;

-- 1.c — Policies abiertas a anon (rol público). Revisá que cada una sea a propósito.
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])
ORDER BY tablename, policyname;

-- 1.d — Policies con qual/with_check permisivo "true" (dejan pasar a todos en ese comando).
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
ORDER BY tablename, policyname;


-- ─────────────────────────────────────────────────────────────────────
-- PARTE 2 · FIX — clientes legibles por anon (PII expuesta)
-- ─────────────────────────────────────────────────────────────────────
-- La policy `clientes_rls_anon` (SELECT TO anon USING(true)) deja que CUALQUIERA
-- con la publishable key baje TODA la base de clientes (nombres/teléfonos/emails).
-- El SQL original (rls_capa2_comercial.sql) ya tenía un TODO al respecto.
--
-- ⚠️ DECISIÓN: ¿El COTIZADOR (app separada) lee `clientes` con la anon key?
--    - Si NO → descomentá el DROP de abajo y listo (la app interna sigue leyendo
--      clientes porque los usuarios van logueados = rol authenticated).
--    - Si SÍ → NO borres la policy; en su lugar restringí las columnas que el
--      cotizador necesita a una VIEW pública, o dejá la policy pero documentá el
--      riesgo asumido. Confirmá con el equipo del cotizador antes de tocar.
--
-- Para ver el nombre exacto de la policy corré la PARTE 1.c y filtrá tablename='clientes'.

-- DROP POLICY IF EXISTS "clientes_rls_anon" ON public.clientes;


-- ─────────────────────────────────────────────────────────────────────
-- PARTE 3 · FIX — encuestas_evento editable por anon (BOLA)
-- ─────────────────────────────────────────────────────────────────────
-- La policy de UPDATE `TO anon USING(true) WITH CHECK(true)` deja que cualquiera
-- con la anon key SOBRESCRIBA cualquier respuesta de encuesta (el filtro por token
-- vive solo en el JS del formulario público, no en la policy).
--
-- Fix correcto: mover el "responder encuesta" a un RPC SECURITY DEFINER que reciba
-- el token + las respuestas, valide el token server-side y haga el UPDATE de la
-- fila que corresponde. Luego quitar el UPDATE directo de anon.
--
-- ⚠️ Esto toca el flujo de la encuesta pública (encuesta.html). Requiere:
--    (1) crear el RPC, (2) cambiar encuesta.html/api para llamar al RPC en vez del
--    UPDATE directo, (3) recién ahí dropear la policy de UPDATE anon.
--    NO lo dropees suelto o rompés la encuesta. Lo armamos juntos cuando digas.
--
-- Esbozo del RPC (revisar nombres de columnas reales antes de correr):
--
-- CREATE OR REPLACE FUNCTION public.responder_encuesta(
--     p_token text, p_nps int, p_comentario text
-- ) RETURNS boolean
-- LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- DECLARE v_ok boolean;
-- BEGIN
--     UPDATE public.encuestas_evento
--        SET nps = p_nps, comentario = p_comentario, respondida_at = now()
--      WHERE token = p_token AND respondida_at IS NULL   -- un solo uso
--      RETURNING true INTO v_ok;
--     RETURN COALESCE(v_ok, false);
-- END; $$;
-- REVOKE ALL ON FUNCTION public.responder_encuesta(text,int,text) FROM public;
-- GRANT EXECUTE ON FUNCTION public.responder_encuesta(text,int,text) TO anon;
-- -- y después: DROP POLICY IF EXISTS "<nombre_policy_update_anon>" ON public.encuestas_evento;


-- ─────────────────────────────────────────────────────────────────────
-- PARTE 4 · PII operativa sin aislar (opcional, endurecimiento)
-- ─────────────────────────────────────────────────────────────────────
-- Tablas como personas/persona_documentos/ausencias están en
-- `FOR ALL TO authenticated USING(true)` → cualquier logueado (incl. rol taller)
-- puede leer/escribir la PII de RRHH por consola del browser.
-- Si querés cerrarlo, gatear por el módulo rrhh como el tier financiero, ej:
--
-- DROP POLICY IF EXISTS "<policy_personas_all>" ON public.personas;
-- CREATE POLICY "personas_rrhh_read"  ON public.personas FOR SELECT
--   USING ( public.fn_role_can('rrhh','read') );
-- CREATE POLICY "personas_rrhh_write" ON public.personas FOR ALL
--   USING ( public.fn_role_can('rrhh','write') )
--   WITH CHECK ( public.fn_role_can('rrhh','write') );
--
-- (Verificá el nombre real de la policy actual con la PARTE 1 antes de dropear.)
