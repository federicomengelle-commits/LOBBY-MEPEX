-- ═══════════════════════════════════════════
--  RLS policies para tabla profiles
-- ═══════════════════════════════════════════
-- CONTEXTO:
--   Editar usuario desde Admin Panel no actualizaba el name (silent fail).
--   Causa: la policy de UPDATE existente "Usuario edita su propio perfil"
--   solo permite UPDATE cuando auth.uid() = id. Cuando Fede (superadmin)
--   intenta editar a Noelia, la condicion no matchea -> 0 filas afectadas
--   sin error. La app creia que habia guardado.
--
-- POLICIES EXISTENTES (no las tocamos):
--   "Usuarios autenticados leen perfiles" -> SELECT
--   "Usuario edita su propio perfil"      -> UPDATE (auth.uid() = id)
--
-- AGREGADO:
--   - Funcion SECURITY DEFINER is_admin_or_super() que chequea si el
--     auth.uid() actual tiene role admin/superadmin SIN disparar
--     recursion RLS sobre profiles.
--   - Policy adicional de UPDATE para que superadmin/admin edite a cualquiera.
--   - Policy de INSERT (necesaria si alguna vez se inserta desde el cliente;
--     el lobby-api usa service-role asi que la bypassea).
--   - Policy de DELETE (idem; soft delete via UPDATE _deleted ya cubre el
--     caso real, asi que esta es solo para admins).
--
-- IDEMPOTENTE: drop si existe + create.
-- ═══════════════════════════════════════════

-- ─── Helper: chequea si auth.uid() es admin o superadmin ──────
-- SECURITY DEFINER => corre con permisos del owner (postgres) y bypassea
-- RLS de profiles, evitando recursion infinita.
CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('superadmin', 'admin')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_super() TO authenticated;

-- ─── UPDATE: superadmin/admin edita cualquier perfil ──
-- (la policy existente "Usuario edita su propio perfil" ya cubre el caso
--  de un usuario editandose a si mismo, asi que NO la tocamos)
DROP POLICY IF EXISTS "profiles_admin_update_any" ON public.profiles;
CREATE POLICY "profiles_admin_update_any" ON public.profiles
    FOR UPDATE TO authenticated
    USING (public.is_admin_or_super())
    WITH CHECK (public.is_admin_or_super());

-- ─── INSERT: superadmin/admin crea perfiles ──
-- (en la practica el lobby-api usa service-role y bypassea RLS; esto es
--  por si alguna vez se hace desde el cliente directo)
DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
CREATE POLICY "profiles_admin_insert" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_or_super());

-- ─── DELETE: superadmin/admin borra perfiles ──
-- (el flujo real usa soft delete via UPDATE _deleted=true, asi que esto
--  es para casos extremos)
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
    FOR DELETE TO authenticated
    USING (public.is_admin_or_super());

-- ═══════════════════════════════════════════
-- VERIFICACION:
-- Despues de correr este SQL, en SQL Editor:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';
-- Deberian aparecer 5 rows:
--   "Usuarios autenticados leen perfiles"  SELECT
--   "Usuario edita su propio perfil"       UPDATE
--   "profiles_admin_update_any"            UPDATE
--   "profiles_admin_insert"                INSERT
--   "profiles_admin_delete"                DELETE
--
-- Y verificar que la funcion exista:
--   SELECT public.is_admin_or_super();  -- te tiene que devolver true (sos superadmin)
-- ═══════════════════════════════════════════
