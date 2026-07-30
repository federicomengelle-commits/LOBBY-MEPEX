-- ═══════════════════════════════════════════════════════════════════
-- PUSH · TABLA DE SUSCRIPCIONES                            (Etapa E5)
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-07-29. Ejecuta la Etapa E5 de docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md
-- (spec: docs/jordi/02-PLAN-VAPID-PUSH-NOTIFICATIONS.md §4).
--
-- QUÉ GUARDA
--   Una fila por NAVEGADOR de cada dispositivo. Una misma persona puede tener
--   tres (celu, notebook del trabajo, notebook de casa) y hay que mandarle a
--   las tres. El `endpoint` es la URL que el navegador da para llegar a ese
--   dispositivo; es único y es la clave natural del upsert.
--
-- QUIÉN ESCRIBE
--   El endpoint /api/push/suscribir del VPS, con la service key y tomando el
--   user_id de la SESIÓN DEL SERVIDOR (doc 02 §13). El cliente nunca manda su
--   propio user_id: si lo mandara, cualquiera podría suscribirse en nombre de
--   otro. Las policies de acá protegen el acceso directo desde el navegador.
--
-- Idempotente. Aditiva: no toca nada existente.
-- ═══════════════════════════════════════════════════════════════════

-- ⚠️ ANTES: verificar que `profiles` sea la tabla de usuarios (lo es — profiles.id
--    = auth.uid(), ver sql/rls_capa2_motor.sql). Se referencia `profiles` en vez de
--    `auth.users` para ser consistente con el resto del schema (notifications,
--    tareas, etc. apuntan a profiles).

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada usuario administra ÚNICAMENTE sus propias suscripciones.
-- (El envío desde el servidor usa la service_role key, que saltea RLS.)
DROP POLICY IF EXISTS push_subs_sel ON public.push_subscriptions;
CREATE POLICY push_subs_sel ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subs_ins ON public.push_subscriptions;
CREATE POLICY push_subs_ins ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subs_upd ON public.push_subscriptions;
CREATE POLICY push_subs_upd ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subs_del ON public.push_subscriptions;
CREATE POLICY push_subs_del ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename='push_subscriptions';   -- rowsecurity = true
--
--   SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname='public' AND tablename='push_subscriptions';   -- 4 policies
--
-- Después de activar el toggle en Mi Perfil desde un navegador:
--   SELECT user_id, left(endpoint, 60) AS endpoint, user_agent, created_at
--     FROM public.push_subscriptions ORDER BY created_at DESC;
--   -- el user_id tiene que ser el del usuario logueado (lo pone el SERVIDOR,
--   --  no el cliente). Si aparece otro, hay un bug de seguridad en el endpoint.
--
-- Prueba negativa (consola del navegador, logueado):
--   await supabaseClient.from('push_subscriptions').select('*')
--   // → solo TUS suscripciones, nunca las de otro
-- ═══════════════════════════════════════════════════════════════════
