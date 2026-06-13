-- ═══════════════════════════════════════════════════════════════════
-- CAPA 2 · MOTOR DE RLS MANEJADA POR LA MATRIZ DE ROLES
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-06-13. Fuente única = tabla `roles` (columna `permissions` JSONB,
-- la MISMA que edita el Panel > Roles y Permisos).
--
-- Idea: en vez de hardcodear "finanzas = admin" en cada policy, las policies
-- preguntan a estas funciones "¿el rol de este usuario puede read/write el
-- módulo X?" — leyendo `roles.permissions`. Resultado: cambiás un permiso en
-- el Panel y la RLS lo respeta AL INSTANTE, sin redeploy de SQL.
--
-- Formato de roles.permissions:  { "finanzas": "write", "crm": "read", ... }
--   (claves = ids de módulo; valores = 'write' | 'read' | ausente/none)
--   SELECT  ⇒ requiere 'read'  (read o write sirven)
--   I/U/D   ⇒ requiere 'write'
--   ausente ⇒ sin acceso
--
-- SEGURIDAD:
--   - SECURITY DEFINER → la función corre como su dueño (postgres) y BYPASSA
--     RLS al leer profiles/roles. Esto evita recursión (una policy de profiles
--     que llame a la función no vuelve a disparar policies) y permite leer la
--     matriz sin darle al usuario acceso directo a `roles`.
--   - superadmin = SIEMPRE true (short-circuit) → nunca te quedás afuera.
--   - profiles.id = auth.uid()  (verificado: auth.js _fetchProfile usa .eq('id', session.user.id))
--
-- Idempotente (CREATE OR REPLACE). Correr ANTES de los archivos de tiers.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Rol del usuario actual ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ─── ¿El rol actual puede (read|write) el módulo? ───────────────────
CREATE OR REPLACE FUNCTION public.fn_role_can(p_module text, p_need text DEFAULT 'read')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- sin sesión → nada
    WHEN auth.uid() IS NULL THEN false
    -- superadmin → todo (no te bloqueás nunca)
    WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' THEN true
    -- resto: leer la matriz del rol
    ELSE COALESCE((
      SELECT CASE
        WHEN (r.permissions ->> p_module) = 'write' THEN true            -- write cubre read y write
        WHEN (r.permissions ->> p_module) = 'read'  THEN (p_need = 'read')
        ELSE false
      END
      FROM public.roles r
      WHERE r.id = (SELECT role FROM public.profiles WHERE id = auth.uid())
    ), false)
  END;
$$;

-- Las policies (que corren como el usuario) necesitan poder ejecutar las funciones.
GRANT EXECUTE ON FUNCTION public.fn_user_role()              TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_role_can(text, text)     TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (correr aparte, logueado como cada rol desde la app o con
-- un JWT de ese usuario; en el SQL editor corrés como postgres → da NULL/true).
-- ═══════════════════════════════════════════════════════════════════
-- SELECT public.fn_user_role();                       -- tu rol
-- SELECT public.fn_role_can('finanzas','read');       -- ¿ves finanzas?
-- SELECT public.fn_role_can('finanzas','write');      -- ¿editás finanzas?
-- SELECT public.fn_role_can('crm','read');            -- ¿ves comercial?
