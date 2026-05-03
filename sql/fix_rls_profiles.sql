-- ═══════════════════════════════════════════
--  RLS policies para tabla profiles
-- ═══════════════════════════════════════════
-- CONTEXTO:
--   Editar usuario desde Admin Panel no actualizaba el name (silent fail).
--   Causa: la tabla profiles tiene RLS habilitado, SELECT policy presente
--   (por eso la lista carga), pero UPDATE/INSERT/DELETE policies no existen
--   o estan mal definidas. Supabase devuelve data=[] sin error cuando RLS
--   bloquea UPDATE => la app no detectaba el fallo.
--
-- DECISION: policies abiertas a authenticated (todo usuario logueado puede
-- leer/escribir profiles). El control fino de "solo superadmin puede crear/
-- borrar usuarios" se hace en el backend lobby-api con service-role, asi
-- que aca no necesitamos restricciones por rol.
--
-- IDEMPOTENTE: drop si existe + create.
-- ═══════════════════════════════════════════

-- Asegurar RLS habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ─── SELECT (leer todos los profiles) ──────
DROP POLICY IF EXISTS "profiles_auth_select" ON public.profiles;
CREATE POLICY "profiles_auth_select" ON public.profiles
    FOR SELECT TO authenticated USING (true);

-- ─── INSERT (crear profile propio o ajeno desde admin) ──
DROP POLICY IF EXISTS "profiles_auth_insert" ON public.profiles;
CREATE POLICY "profiles_auth_insert" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (true);

-- ─── UPDATE (editar nombre, role, telefono, etc.) ──
DROP POLICY IF EXISTS "profiles_auth_update" ON public.profiles;
CREATE POLICY "profiles_auth_update" ON public.profiles
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─── DELETE (soft delete real, aunque normalmente solo marcamos _deleted) ──
DROP POLICY IF EXISTS "profiles_auth_delete" ON public.profiles;
CREATE POLICY "profiles_auth_delete" ON public.profiles
    FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════
-- VERIFICACION:
-- Despues de correr este SQL, ejecutar en SQL Editor:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';
-- Deberian aparecer 4 rows: profiles_auth_select / insert / update / delete.
-- ═══════════════════════════════════════════
