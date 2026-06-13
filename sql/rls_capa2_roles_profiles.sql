-- ═══════════════════════════════════════════════════════════════════
-- CAPA 2 · LOCK de `roles` y `profiles` — PRIORIDAD #1 de la auditoría
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-06-13. CORRER DESPUÉS de sql/rls_capa2_motor.sql.
--
-- POR QUÉ: hoy `roles` y `profiles` son escribibles por cualquier logueado
-- (policies permisivas). Eso significa que en teoría un `venta` podría:
--   - editar `roles.permissions` (la matriz) y darse finanzas, o
--   - hacer UPDATE de su propio `profiles.role` = 'superadmin'
-- y saltear TODA la RLS-por-matriz. Esto lo cierra.
--
-- DISEÑO:
--   - `roles`: SELECT authenticated (login + fn_role_can lo necesitan). Escritura
--     SOLO superadmin (el Panel de Roles es superadmin-only). Sin anon.
--   - `profiles`: SELECT authenticated (los nombres se usan en toda la app).
--     UPDATE = uno puede editar SU PROPIA fila O un admin cualquiera.
--     INSERT/DELETE = solo admin.
--     + TRIGGER anti-escalada: aunque la policy te deje tocar tu propia fila,
--       NO podés cambiar role/active/custom_permissions salvo que seas admin
--       (o el backend service_role). Así el self-edit de nombre/iniciales/tel
--       sigue andando, pero nadie se auto-ascala.
--
-- service_role (backend lobby-api) bypassa RLS y el trigger lo deja pasar.
-- superadmin nunca se bloquea (short-circuit del motor + fn_is_admin).
--
-- Idempotente / defensivo / transaccional.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Helper: ¿el usuario actual es admin o superadmin? ──────────────
CREATE OR REPLACE FUNCTION public.fn_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin','superadmin') FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.fn_is_admin() TO authenticated, anon;

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1) tabla `roles` — lectura authenticated, escritura superadmin
-- ═══════════════════════════════════════════════════════════════════
DO $r$
DECLARE pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='roles') THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='roles' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.roles', pol.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY';
    -- todos los logueados leen (login + helpers); anon NO
    EXECUTE 'CREATE POLICY roles_rls_sel ON public.roles FOR SELECT TO authenticated USING (true)';
    -- escribir la matriz = superadmin (fn_role_can de admin-panel = solo superadmin)
    EXECUTE 'CREATE POLICY roles_rls_ins ON public.roles FOR INSERT TO authenticated WITH CHECK (public.fn_role_can(''admin-panel'',''write''))';
    EXECUTE 'CREATE POLICY roles_rls_upd ON public.roles FOR UPDATE TO authenticated USING (public.fn_role_can(''admin-panel'',''write'')) WITH CHECK (public.fn_role_can(''admin-panel'',''write''))';
    EXECUTE 'CREATE POLICY roles_rls_del ON public.roles FOR DELETE TO authenticated USING (public.fn_role_can(''admin-panel'',''write''))';
    RAISE NOTICE 'RLS roles: lectura authenticated / escritura superadmin';
  END IF;
END
$r$;

-- ═══════════════════════════════════════════════════════════════════
-- 2) tabla `profiles` — lectura authenticated, update self|admin, +guard
-- ═══════════════════════════════════════════════════════════════════
DO $p$
DECLARE pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
    -- lectura: cualquier logueado (los nombres/iniciales se muestran en toda la app)
    EXECUTE 'CREATE POLICY profiles_rls_sel ON public.profiles FOR SELECT TO authenticated USING (true)';
    -- alta/baja de usuarios: solo admin
    EXECUTE 'CREATE POLICY profiles_rls_ins ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.fn_is_admin())';
    EXECUTE 'CREATE POLICY profiles_rls_del ON public.profiles FOR DELETE TO authenticated USING (public.fn_is_admin())';
    -- update: tu propia fila O admin (el guard de abajo impide auto-escalarse)
    EXECUTE 'CREATE POLICY profiles_rls_upd ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.fn_is_admin()) WITH CHECK (id = auth.uid() OR public.fn_is_admin())';
    RAISE NOTICE 'RLS profiles: lectura authenticated / update self|admin';
  END IF;
END
$p$;

-- ─── TRIGGER anti-escalada en profiles ──────────────────────────────
-- Bloquea cambios a role / active / custom_permissions salvo admin o service_role.
-- Permite que cada usuario siga editando su nombre/iniciales/teléfono/last_seen.
CREATE OR REPLACE FUNCTION public.fn_profiles_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (backend) o admin/superadmin → pasa libre
  IF COALESCE(auth.role(), '') = 'service_role' OR public.fn_is_admin() THEN
    RETURN NEW;
  END IF;
  -- resto: NO puede tocar campos sensibles (ni en su propia fila)
  IF (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.active IS DISTINCT FROM OLD.active)
     OR (NEW.custom_permissions IS DISTINCT FROM OLD.custom_permissions) THEN
    RAISE EXCEPTION 'No autorizado: solo un admin puede cambiar role/active/custom_permissions';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard ON public.profiles;
CREATE TRIGGER trg_profiles_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_guard();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN / TEST (correr aparte, logueado por rol desde la app)
-- ═══════════════════════════════════════════════════════════════════
-- 1. superadmin: edita la matriz en el Panel → OK. Cambia rol de un usuario en
--    Settings>Usuarios → OK.
-- 2. admin: cambia rol de un usuario en Settings → OK. NO ve el Panel de roles
--    (es superadmin-only) → no escribe `roles`.
-- 3. venta/pm/taller: editan su propio perfil (nombre/iniciales/tel) → OK.
--    Intentar (consola) UPDATE profiles SET role='superadmin' WHERE id=<propio>
--    → DEBE FALLAR con "No autorizado..." (trigger). Intentar UPDATE roles → 0 filas.
-- 4. La app sigue logueando normal (lectura de roles/profiles authenticated OK).

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK (revierte a permisivo)
-- ═══════════════════════════════════════════════════════════════════
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_profiles_guard ON public.profiles;
-- DO $rb$
-- DECLARE pol record; t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['roles','profiles'] LOOP
--     FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
--       EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
--     END LOOP;
--     EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t||'_auth_all', t);
--   END LOOP;
-- END $rb$;
-- COMMIT;
