-- =====================================================================
-- T0.2 · Que `profiles.active = false` desactive de verdad
-- Auditoría 2026-07-31 · hallazgo C11
-- =====================================================================
--
-- PROBLEMA
--   Dar de baja a alguien en el Panel de Control pone `profiles.active =
--   false` y nada más. Supabase Auth le sigue emitiendo un JWT válido, y
--   NINGUNA función de RLS mira esa columna → la cuenta conserva acceso a
--   los datos vía PostgREST.
--
--   En prod hay 4 cuentas así, y LAS 4 SON `admin`:
--     Ale · Colore · Holis · PRUEBA
--   O sea: hoy leen finanzas, contabilidad, RRHH y todo lo demás.
--
-- ALCANCE REAL — más grande de lo que decía el plan
--   El plan decía "agregar `AND COALESCE(active,true)` en las 5 funciones →
--   arregla las 42 tablas de una". Eso es cierto para las tablas cuyo RLS
--   pasa por `fn_role_can`/`fn_is_admin`, pero se verificó contra prod que
--   hay **18 policies que consultan `profiles` EN LÍNEA**, sin pasar por
--   ninguna función. A esas el fix de las funciones no las toca.
--
--   Sin la Parte B, un admin dado de baja seguiría pudiendo:
--     · EDITAR `parametros_globales` → los globales del costeo
--       (hora_taller, % indirectos, % margen). Toca el precio de todo.
--     · escribir `rutinas` (mantenimiento)
--     · BORRAR cargas, personas, vehículos, asignaciones, conformes,
--       transporte, novedades, notificaciones y valores de cartera
--     · BORRAR archivos de Storage (catálogo, comprobantes, fotos, remitos)
--
--   Dato revelador: `audit_log_select_admin` **sí** tiene `AND profiles.active
--   = true`. Una de 19 lo hace bien → el patrón se conocía, se aplicó
--   inconsistentemente. Por eso la Parte B no repite la condición a mano en
--   cada policy: las apunta todas a `fn_is_admin()`, que ahora la tiene.
--
-- ⚠️ EL EFECTO SECUNDARIO QUE OBLIGA A LAS PARTES C Y D
--   Hacer que `fn_user_role()` devuelva NULL para una cuenta de baja es
--   correcto, pero NULL no se comporta igual en todos lados:
--     · en un `USING` de RLS, NULL deniega → bien.
--     · en `IS DISTINCT FROM 'taller'`, **NULL da TRUE** → concede.
--     · en `IF NOT <null> THEN` de PL/pgSQL, se comporta como `IF false`
--       → el bloque que revierte el cambio NO se ejecuta.
--   O sea: la Parte A sola, sin C y D, en 2 tablas hace lo CONTRARIO de lo
--   que promete. Por eso van las tres en la misma transacción.
--
-- QUÉ HACE ESTE ARCHIVO
--   A. Las 5 funciones de la matriz de permisos filtran por `active`.
--   B. Las 18 policies que leían `profiles` en línea pasan a `fn_is_admin()`.
--   C. Las 4 policies `IS DISTINCT FROM 'taller'` (proyectos y locaciones)
--      se vuelven NULL-safe.
--   D. Las funciones de `tareas` se vuelven NULL-safe.
--   E. De paso: `user_module_permission` era la única SECURITY DEFINER sin
--      `SET search_path` (warning `function_search_path_mutable` del linter
--      de Supabase). Se lo agrega.
--   F. De paso: las 2 policies etiquetadas `TO public` (`audit_admin_read`,
--      `parametros_globales_admin_only`) pasan a `TO authenticated`. Es el
--      backlog anotado el 2026-07-26. Sin cambio de comportamiento: un anon
--      nunca pasaba el chequeo de rol igual.
--
-- QUÉ *NO* HACE — queda anotado en el tracker
--   · `restoreSession` (auth.js) NO chequea `active`. El login sí
--     (`_finishLogin:70`), pero una sesión YA ABIERTA sobrevive a la baja:
--     el usuario sigue viendo la app (vacía, porque el RLS ya lo bloquea).
--     Es JS → va en Tanda 3 (**T3.22**), donde un solo pull cubre todo.
--   · Revocar las sesiones vivas de las 4 cuentas desde el Dashboard de
--     Supabase → acción manual de Fede (**T5.12**).
--
-- VERIFICADO ANTES DE ESCRIBIR ESTO (contra prod):
--   · Las 4 cuentas de baja tienen `active = false` explícito; NO hay ningún
--     `active IS NULL` en toda la tabla. Aun así se usa `COALESCE(active,
--     true)` por si alguna fila futura nace sin el valor.
--   · Las 3 funciones de tareas (`fn_tareas_admin_level`,
--     `fn_tarea_visible`, `fn_tareas_puede_asignar`) rutean por
--     `fn_user_role()` → se arreglan solas con la Parte A.
--   · `permissive`, `roles` y la presencia de USING/WITH CHECK de cada una de
--     las 18 policies se leyeron de `pg_policies` y se reproducen igual.
--
-- IDEMPOTENTE: sí. REVERSIBLE: sí, ver el pie.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- PARTE A · las 5 funciones de la matriz de permisos
-- ---------------------------------------------------------------------

-- A1 · fn_role_can — el motor del RLS (fase 9.bis). Los DOS lookups de
--      profiles filtran por active: con la cuenta de baja el primero da NULL
--      (→ no es superadmin) y el segundo no matchea ningún rol (→ false).
CREATE OR REPLACE FUNCTION public.fn_role_can(p_module text, p_need text DEFAULT 'read'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- sin sesión → nada
    WHEN auth.uid() IS NULL THEN false
    -- superadmin → todo (no te bloqueás nunca)
    WHEN (SELECT role FROM public.profiles
           WHERE id = auth.uid() AND COALESCE(active, true)) = 'superadmin' THEN true
    -- resto: leer la matriz del rol
    ELSE COALESCE((
      SELECT CASE
        WHEN (r.permissions ->> p_module) = 'write' THEN true            -- write cubre read y write
        WHEN (r.permissions ->> p_module) = 'read'  THEN (p_need = 'read')
        ELSE false
      END
      FROM public.roles r
      WHERE r.id = (SELECT role FROM public.profiles
                     WHERE id = auth.uid() AND COALESCE(active, true))
    ), false)
  END;
$function$;

-- A2 · fn_is_admin — la usa la Parte B en las 18 policies
CREATE OR REPLACE FUNCTION public.fn_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role IN ('admin','superadmin') FROM public.profiles
      WHERE id = auth.uid() AND COALESCE(active, true)),
    false
  );
$function$;

-- A3 · fn_user_role — devuelve NULL para una cuenta de baja.
--      Arrastra a fn_tareas_admin_level / fn_tarea_visible /
--      fn_tareas_puede_asignar, que rutean por acá.
CREATE OR REPLACE FUNCTION public.fn_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles
   WHERE id = auth.uid() AND COALESCE(active, true);
$function$;

-- A4 · is_admin_or_super
CREATE OR REPLACE FUNCTION public.is_admin_or_super()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('superadmin', 'admin')
          AND COALESCE(active, true)
    );
$function$;

-- A5 · user_module_permission — + el SET search_path que le faltaba (era la
--      única SECURITY DEFINER sin él: search_path mutable en una función que
--      corre como owner es la receta del shadowing de `profiles`/`roles`).
CREATE OR REPLACE FUNCTION public.user_module_permission(p_module text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_role TEXT;
    v_perms JSONB;
BEGIN
    SELECT role INTO v_role FROM profiles
     WHERE id = auth.uid() AND COALESCE(active, true);
    IF v_role IS NULL THEN RETURN 'none'; END IF;

    SELECT permissions INTO v_perms FROM roles WHERE id = v_role;
    IF v_perms IS NULL THEN RETURN 'none'; END IF;

    RETURN COALESCE(v_perms->>p_module, 'none');
END;
$function$;

-- Las 5 se acaban de recrear: reafirmar el cierre a anon de T0.1.
-- (CREATE OR REPLACE preserva el ACL, pero esto lo deja explícito y hace que
--  el archivo sea seguro de correr aunque T0.1 no se hubiera corrido.)
DO $$
DECLARE fn text; fns text[] := ARRAY[
    'public.fn_role_can(text,text)', 'public.fn_is_admin()', 'public.fn_user_role()',
    'public.is_admin_or_super()', 'public.user_module_permission(text)'];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- PARTE B · las 18 policies que leían profiles en línea
-- ---------------------------------------------------------------------
-- Todas tenían la misma forma, en dos variantes:
--    auth.uid() IN (SELECT profiles.id FROM profiles WHERE role = ANY(...))
--    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND role = ANY(...))
-- Se reemplazan por `fn_is_admin()`: una sola definición de "es admin", que
-- ahora incluye el chequeo de `active`. Bonus: `fn_is_admin` es SECURITY
-- DEFINER, así que deja de depender del RLS de `profiles` para resolverse.
-- Cada policy conserva su `permissive`, su `cmd` y su lista de roles.

-- ── public ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS asignaciones_evento_delete ON public.asignaciones_evento;
CREATE POLICY asignaciones_evento_delete ON public.asignaciones_evento
  FOR DELETE TO authenticated USING (public.fn_is_admin());

DROP POLICY IF EXISTS cargas_delete ON public.cargas;
CREATE POLICY cargas_delete ON public.cargas
  FOR DELETE TO authenticated USING (public.fn_is_admin());

DROP POLICY IF EXISTS cv_delete ON public.cartera_valores;
CREATE POLICY cv_delete ON public.cartera_valores
  FOR DELETE TO authenticated USING (public.fn_is_admin());

DROP POLICY IF EXISTS et_delete ON public.evento_transporte;
CREATE POLICY et_delete ON public.evento_transporte
  FOR DELETE TO authenticated USING (public.fn_is_admin());

DROP POLICY IF EXISTS eti_delete ON public.evento_transporte_items;
CREATE POLICY eti_delete ON public.evento_transporte_items
  FOR DELETE TO authenticated USING (public.fn_is_admin());

DROP POLICY IF EXISTS notifications_delete ON public.notifications;
CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE TO authenticated USING (public.fn_is_admin());

DROP POLICY IF EXISTS personas_delete ON public.personas;
CREATE POLICY personas_delete ON public.personas
  FOR DELETE TO authenticated USING (public.fn_is_admin());

DROP POLICY IF EXISTS pc_delete ON public.proyecto_conformes;
CREATE POLICY pc_delete ON public.proyecto_conformes
  FOR DELETE TO authenticated USING (public.fn_is_admin());

DROP POLICY IF EXISTS vehiculos_delete ON public.vehiculos;
CREATE POLICY vehiculos_delete ON public.vehiculos
  FOR DELETE TO authenticated USING (public.fn_is_admin());

-- El autor sigue pudiendo tocar lo suyo (se preserva tal cual).
DROP POLICY IF EXISTS proyecto_novedades_delete ON public.proyecto_novedades;
CREATE POLICY proyecto_novedades_delete ON public.proyecto_novedades
  FOR DELETE TO authenticated USING (autor_id = auth.uid() OR public.fn_is_admin());

DROP POLICY IF EXISTS proyecto_novedades_update ON public.proyecto_novedades;
CREATE POLICY proyecto_novedades_update ON public.proyecto_novedades
  FOR UPDATE TO authenticated USING (autor_id = auth.uid() OR public.fn_is_admin());

-- rutinas_write es la única con WITH CHECK además de USING.
DROP POLICY IF EXISTS rutinas_write ON public.rutinas;
CREATE POLICY rutinas_write ON public.rutinas
  FOR ALL TO authenticated
  USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

-- ⚠️ La más importante de esta parte: `parametros_globales` define
--    hora_taller_ars, pct_indirectos_fabrica y pct_margen_default → el precio
--    de TODO el catálogo. Estaba `TO public` (se normaliza a authenticated:
--    un anon nunca pasaba el chequeo de rol igual).
DROP POLICY IF EXISTS parametros_globales_admin_only ON public.parametros_globales;
CREATE POLICY parametros_globales_admin_only ON public.parametros_globales
  FOR ALL TO authenticated USING (public.fn_is_admin());

-- audit_logs: sólo el chequeo de lectura. Las policies de INSERT de esta
-- tabla y de `audit_log` las toca T0.5.
DROP POLICY IF EXISTS audit_admin_read ON public.audit_logs;
CREATE POLICY audit_admin_read ON public.audit_logs
  FOR SELECT TO authenticated USING (public.fn_is_admin());

-- audit_log_select_admin NO se toca: es la única de las 19 que YA chequeaba
-- `active = true`. Queda como estaba (T0.5 la revisa junto con el resto).

-- ── storage.objects ─────────────────────────────────────────────────
DROP POLICY IF EXISTS catalogo_delete ON storage.objects;
CREATE POLICY catalogo_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'catalogo' AND public.fn_is_admin());

DROP POLICY IF EXISTS comprobantes_delete ON storage.objects;
CREATE POLICY comprobantes_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'comprobantes' AND public.fn_is_admin());

DROP POLICY IF EXISTS remitos_delete ON storage.objects;
CREATE POLICY remitos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'remitos' AND public.fn_is_admin());

-- Ésta incluía 'pm' además de admin/superadmin → se preserva.
DROP POLICY IF EXISTS proyecto_fotos_delete ON storage.objects;
CREATE POLICY proyecto_fotos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'proyecto-fotos'
         AND (public.fn_is_admin() OR public.fn_user_role() = 'pm'));

-- ---------------------------------------------------------------------
-- PARTE C · las 4 policies que EXCLUYEN por rol  ⚠️ sin esto, A empeora
-- ---------------------------------------------------------------------
-- `proyectos` y `locaciones` se dividen en dos caras: la de oficina (todo
-- el que NO es taller) y la del galpón (sólo taller, acotada). La de oficina
-- se escribió como `fn_user_role() IS DISTINCT FROM 'taller'`.
--
-- Con `fn_user_role()` devolviendo NULL, `NULL IS DISTINCT FROM 'taller'` es
-- **TRUE** → la cuenta de baja conserva TODO el acceso de oficina. Y peor:
-- si el que se da de baja es del rol `taller` —el caso más probable de este
-- ticket, alguien del galpón que se va— pasa de ver sólo sus proyectos
-- `en_taller` en read-only a **leer y escribir todos los proyectos y todas
-- las locaciones**. Dar de baja a alguien lo ascendería.
--
-- El `IS NOT NULL` adelante lo cierra. Las policies gemelas del taller
-- (`proyectos_taller_select/update`, `locaciones_taller_select`) NO se tocan:
-- usan `= 'taller'`, y `NULL = 'taller'` da NULL → deniega. Ya son correctas.
DROP POLICY IF EXISTS proyectos_oficina_select ON public.proyectos;
CREATE POLICY proyectos_oficina_select ON public.proyectos
  FOR SELECT TO authenticated
  USING (public.fn_user_role() IS NOT NULL
         AND public.fn_user_role() IS DISTINCT FROM 'taller');

DROP POLICY IF EXISTS proyectos_oficina_write ON public.proyectos;
CREATE POLICY proyectos_oficina_write ON public.proyectos
  FOR ALL TO authenticated
  USING (public.fn_user_role() IS NOT NULL
         AND public.fn_user_role() IS DISTINCT FROM 'taller');

DROP POLICY IF EXISTS locaciones_oficina_select ON public.locaciones;
CREATE POLICY locaciones_oficina_select ON public.locaciones
  FOR SELECT TO authenticated
  USING (public.fn_user_role() IS NOT NULL
         AND public.fn_user_role() IS DISTINCT FROM 'taller');

DROP POLICY IF EXISTS locaciones_oficina_write ON public.locaciones;
CREATE POLICY locaciones_oficina_write ON public.locaciones
  FOR ALL TO authenticated
  USING (public.fn_user_role() IS NOT NULL
         AND public.fn_user_role() IS DISTINCT FROM 'taller');

-- ---------------------------------------------------------------------
-- PARTE D · las funciones de `tareas`, NULL-safe
-- ---------------------------------------------------------------------
-- Los guards de `tareas` son triggers PL/pgSQL con la forma
-- `IF NOT fn_tareas_puede_asignar() THEN <revertir el cambio> END IF`.
-- `fn_tareas_*` es `fn_user_role() IN (...)`, y `NULL IN (...)` = NULL →
-- `NOT NULL` = NULL → **`IF NULL` no ejecuta el bloque**. El guard se saltea
-- justo para el usuario que queremos frenar. Con COALESCE a false, `IF NOT
-- false` = `IF true` → el guard sí revierte.

-- D1/D2 · devuelven false en vez de NULL. Arregla de una los 3 call-sites de
--         los triggers y las policies tareas_del / tarea_asignados_ins|del.
CREATE OR REPLACE FUNCTION public.fn_tareas_admin_level()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(public.fn_user_role() IN ('superadmin','admin'), false);
$function$;

CREATE OR REPLACE FUNCTION public.fn_tareas_puede_asignar()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(public.fn_user_role() IN ('superadmin','admin','pm'), false);
$function$;

-- D3 · fn_tarea_visible — es el embudo de TODA la visibilidad de tareas
--      (tareas_sel, tareas_upd, y vía fn_tarea_visible_por_id también
--      tarea_asignados_* y tarea_actividad_sel). Se cambia la primera rama
--      `auth.uid() IS NULL` por `fn_user_role() IS NULL`, que cubre los dos
--      casos: sin sesión Y dado de baja. (Verificado: no hay ningún perfil
--      con `role` NULL, así que ningún usuario vivo cae en esta rama.)
CREATE OR REPLACE FUNCTION public.fn_tarea_visible(p_tarea_id uuid, p_created_by uuid, p_responsable_id uuid, p_target_role text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- sin sesión, o cuenta dada de baja (fn_user_role filtra por active) → nada
    WHEN public.fn_user_role() IS NULL THEN false
    -- [D6] superadmin + admin ven todo. Para restringir a solo superadmin,
    --      cambiar fn_tareas_admin_level() por (fn_user_role() = 'superadmin').
    WHEN public.fn_tareas_admin_level() THEN true
    -- 3. la creó
    WHEN p_created_by = auth.uid() THEN true
    -- 2. es su responsable (incluye el claim de una tarea de pool)
    WHEN p_responsable_id = auth.uid() THEN true
    -- 1.bis pool legacy de fase11: target_role = su rol
    WHEN p_target_role IS NOT NULL AND p_target_role = public.fn_user_role() THEN true
    -- 1. asignada a su rol o a él en particular (tabla nueva)
    ELSE EXISTS (
      SELECT 1 FROM public.tarea_asignados a
       WHERE a.tarea_id = p_tarea_id
         AND (a.usuario_id = auth.uid() OR a.rol = public.fn_user_role())
    )
  END;
$function$;

-- D4 · guard de UPDATE. Cambio ÚNICO: `fn_user_role() <> 'superadmin'` →
--      `COALESCE(fn_user_role(),'') <> 'superadmin'`. Sin eso, una cuenta de
--      baja marcaba una tarea como urgente — que es lo que dispara el push a
--      todos los celulares.
CREATE OR REPLACE FUNCTION public.fn_tareas_guard_campos()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Sin sesión = service_role / SQL editor / job del servidor → no se toca nada.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  -- `created_by` es INMUTABLE para todos, siempre.
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    NEW.created_by := OLD.created_by;
  END IF;

  -- Marcar urgente (= disparar push a celulares) = SOLO superadmin. [D3]
  IF NEW.is_urgent IS DISTINCT FROM OLD.is_urgent
     AND COALESCE(public.fn_user_role(), '') <> 'superadmin' THEN
    NEW.is_urgent := OLD.is_urgent;
  END IF;

  IF NOT public.fn_tareas_puede_asignar() THEN
    -- No puede mover el pool de rol.
    NEW.target_role := OLD.target_role;
    -- Sí puede TOMAR una tarea LIBRE para sí (el claim) o soltar la propia;
    -- no puede endosársela a otro ni robársela a un compañero.
    IF NEW.responsable_id IS DISTINCT FROM OLD.responsable_id
       AND NEW.responsable_id IS NOT NULL
       AND (NEW.responsable_id <> auth.uid()
            OR (OLD.responsable_id IS NOT NULL AND OLD.responsable_id <> auth.uid())) THEN
      NEW.responsable_id := OLD.responsable_id;
    END IF;
  END IF;

  -- Borrado lógico: admin-level o el que la creó. Rechazo explícito.
  IF NEW._deleted IS DISTINCT FROM OLD._deleted
     AND NOT public.fn_tareas_admin_level()
     AND OLD.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'No tenés permiso para eliminar o restaurar esta tarea'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $function$;

-- D5 · guard de INSERT. Mismo cambio puntual.
CREATE OR REPLACE FUNCTION public.fn_tareas_guard_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;   -- service_role / SQL editor

  -- Nacer urgente (= push a celulares) = solo superadmin. [D3]
  IF NEW.is_urgent AND COALESCE(public.fn_user_role(), '') <> 'superadmin' THEN
    NEW.is_urgent := false;
  END IF;

  IF NOT public.fn_tareas_puede_asignar() THEN
    NEW.target_role := NULL;                       -- no puede sembrar en pool ajeno
    IF NEW.responsable_id IS NOT NULL AND NEW.responsable_id <> auth.uid() THEN
      NEW.responsable_id := auth.uid();            -- se la queda él, no la endosa
    END IF;
    -- Tampoco puede fabricar una tarea "ya completada por" otro.
    IF NEW.completada_por IS NOT NULL AND NEW.completada_por <> auth.uid() THEN
      NEW.completada_por := NULL;
      NEW.completada_at  := NULL;
    END IF;
  END IF;

  RETURN NEW;
END $function$;

-- D6 · `tareas_ins` dejaba pasar por `created_by = auth.uid()`, sin mirar rol
--      → una cuenta de baja podía seguir creando tareas para sí misma.
DROP POLICY IF EXISTS tareas_ins ON public.tareas;
CREATE POLICY tareas_ins ON public.tareas
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_user_role() IS NOT NULL
              AND ((created_by IS NULL) OR (created_by = auth.uid())
                   OR public.fn_tareas_puede_asignar()));

-- Las 4 funciones de tareas se acaban de recrear → reafirmar el cierre a anon.
DO $$
DECLARE fn text; fns text[] := ARRAY[
    'public.fn_tareas_admin_level()', 'public.fn_tareas_puede_asignar()',
    'public.fn_tarea_visible(uuid,uuid,uuid,text)'];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- (a) Ninguna policy consulta `profiles` en línea, salvo la que ya estaba
--     bien. Debe devolver SÓLO `audit_log_select_admin`:
--
-- SELECT tablename, policyname FROM pg_policies
--  WHERE (COALESCE(qual,'')||COALESCE(with_check,'')) ~ 'profiles';
--
-- (b) Las 5 funciones filtran por active. Debe devolver 5:
--
-- SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--  WHERE n.nspname='public' AND pg_get_functiondef(p.oid) ~ 'active'
--    AND proname IN ('fn_role_can','fn_is_admin','fn_user_role',
--                    'is_admin_or_super','user_module_permission');
--
-- (c) Ninguna policy queda con el patrón `IS DISTINCT FROM` sin el IS NOT NULL
--     adelante. Debe devolver CERO filas:
--
-- SELECT tablename, policyname FROM pg_policies
--  WHERE COALESCE(qual,with_check,'') ~ 'IS DISTINCT FROM'
--    AND COALESCE(qual,with_check,'') !~ 'IS NOT NULL';
--
-- (d) Simulación por rol (ver la corrida real en el tracker): una cuenta de
--     baja debe dar fn_is_admin=false · fn_user_role=NULL ·
--     fn_role_can('finanzas','read')=false · 0 proyectos · 0 locaciones ·
--     0 tareas; y una cuenta VIVA del mismo rol, todo lo contrario.
--     Y el caso que motiva la Parte C: un `taller` dado de baja debe pasar a
--     ver 0 proyectos, NO todos.
--
-- (e) Smoke logueado como Fede (superadmin): Costos → Parámetros sigue
--     dejando editar, el Panel de Control sigue listando usuarios, y
--     Proyectos / Locaciones / Tareas siguen mostrando todo.
--
-- (f) Smoke logueado como un `taller` real: sigue viendo sus proyectos
--     `en_taller` y las locaciones taller/depósito, ni más ni menos.

-- =====================================================================
-- ROLLBACK de emergencia
-- =====================================================================
-- ATAJO QUE SIEMPRE FUNCIONA, si alguien queda bloqueado por error (corre
-- como `postgres` desde el SQL Editor, ajeno a todo el RLS que se tocó acá):
--   UPDATE profiles SET active = true WHERE id = '<uuid>';
--
-- Reversión completa, por parte:
--  A · sacar `AND COALESCE(active, true)` de las 5 funciones. Cuerpos previos:
--        fn_role_can, fn_user_role → sql/rls_capa2_motor.sql
--        fn_is_admin              → sql/rls_capa2_roles_profiles.sql
--        is_admin_or_super        → sql/fix_rls_profiles.sql
--        user_module_permission   → NO está versionada en el repo; su cuerpo
--          previo es el de este archivo menos el `AND COALESCE(active,true)`
--          y menos el `SET search_path`.
--  B · volver cada policy a
--        USING (auth.uid() IN (SELECT id FROM profiles WHERE role = ANY(ARRAY['admin','superadmin'])))
--      ⚠️ con 4 excepciones que NO siguen esa forma genérica:
--        proyecto_novedades_delete/update → llevan `autor_id = auth.uid() OR …`
--        rutinas_write                    → lleva WITH CHECK además de USING
--        proyecto_fotos_delete            → incluye 'pm' en la lista de roles
--      y con el `TO` original: `public` en audit_admin_read y
--      parametros_globales_admin_only, `authenticated` en el resto.
--  C · sacar el `fn_user_role() IS NOT NULL AND` de las 4 policies de
--      proyectos/locaciones → sql/reorg_a_nav_roles_rls.sql y
--      sql/reorg_e_locaciones.sql tienen los originales.
--  D · sacar los COALESCE → sql/tareas_v2_asignados_rls.sql tiene los originales.
--
-- ⚠️ Revertir SÓLO la Parte A dejando C y D es inofensivo. Revertir C o D
--    dejando A puesta reabre la escalada de privilegios descrita arriba.
