-- =====================================================================
-- Seguridad — PASO 2b: dropear las policies anon (cierre de 2.a + 2.b)
--
-- ⚠️ Correr SOLO DESPUÉS de:
--   1. sql/seguridad_rls_paso2_encuesta_rpc.sql (crea los RPCs), y
--   2. ~/pull-lobby.sh (encuesta.html nuevo que usa los RPCs), y
--   3. smoke test de un link de encuesta real (que cargue).
-- Si lo corrés antes del pull, la encuesta pública queda rota hasta el pull
-- (nada más se rompe: la app interna va logueada = rol authenticated).
-- =====================================================================

BEGIN;

-- 2.a — clientes: el cotizador NO usa la anon key (va por su server con
--       service_role — verificado 2026-07-11) y la encuesta ya no joinea
--       desde el browser → cualquiera con la publishable key dejaba de poder
--       bajarse TODA la base de clientes.
DROP POLICY IF EXISTS "clientes_rls_anon" ON public.clientes;

-- 2.b — encuestas_evento: el flujo público ahora pasa por los RPCs → cerrar
--       tanto el UPDATE (el BOLA: pisar cualquier respuesta) como el SELECT
--       (leakeaba todas las encuestas con sus tokens y comentarios).
DROP POLICY IF EXISTS "encuestas_rls_anon_upd" ON public.encuestas_evento;
DROP POLICY IF EXISTS "encuestas_rls_anon_sel" ON public.encuestas_evento;

-- eventos: su único consumidor anon era el embed de la encuesta (verificado:
-- cotizador = service_role; WEB-MEPEX y generador de propuestas no usan Supabase).
DROP POLICY IF EXISTS "eventos_anon_select" ON public.eventos;

COMMIT;


-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN — esperado: 0 filas
-- ─────────────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('clientes', 'encuestas_evento', 'eventos')
  AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])
ORDER BY tablename, policyname;
