-- ═══════════════════════════════════════════════════════════════════
-- REORG · FASE A — Roles (RBAC) + RLS de proyectos (capa operativa física)
-- ═══════════════════════════════════════════════════════════════════
-- Companion: docs/capa-operativa-blueprint.md §3.F / §4 (Fase A).
--
-- QUÉ HACE: el rol `taller` pasa a ver Proyectos (read-only, SOLO los que están
-- en producción: estado='en_taller') y pierde los módulos taller/logistica (que
-- se disuelven). El rol `pm` pierde taller/logistica. Oficina (todo el resto)
-- queda EXACTAMENTE como hoy.
--
-- ⚠ REVIERTE sql/taller_rol_sin_proyectos.sql (SB4) — decisión Fede 2026-06-24 (Q1.bis):
--   antes el taller NO entraba a Proyectos; ahora SÍ, filtrado a "en_taller".
--
-- ⚠ DESVIACIONES DELIBERADAS del borrador del blueprint (todas MÁS seguras):
--   1) Las policies de OFICINA NO usan fn_role_can('proyectos',...) sino "no soy
--      taller". Así se preserva EXACTO el comportamiento actual de oficina (todo
--      authenticated no-taller accede igual que hoy) y se respeta el invariante de
--      Fase 9.bis "RLS NO esconde filas entre oficina". Evita el riesgo de dejar
--      sin acceso a admin si su roles.permissions no tuviera 'proyectos'. El gate
--      de módulo (quién ve el menú) sigue en data.js + RBAC, no en esta RLS.
--   2) Se DROPEAN DINÁMICAMENTE TODAS las policies actuales de `proyectos`. Hoy
--      tiene proyectos_auth_select/insert/update/delete USING(true) (de
--      rls_eventos_proyectos.sql); el DROP por nombre fijo del borrador NO las
--      sacaba → el filtro de taller se anulaba por OR. Drop dinámico = robusto.
--   3) Locaciones (filtro taller por `tipo`) se DIFIERE a Fase E (ahí se resuelve
--      Q2 = valores reales de locaciones.tipo + se construye la cara operativa).
--      En Fase A el taller todavía NO gana 'locaciones'.
--   4) taller_proyecto_checklist queda como está (blanket authenticated): el
--      "tildar" del taller funciona; el lock fino es UI/API (Q15 v1).
--
-- VERIFICADO CONTRA (2026-06-24):
--   · sql/rls_capa2_motor.sql      → fn_user_role()/fn_role_can() (SECURITY DEFINER,
--                                     granted a authenticated; superadmin short-circuit).
--   · sql/rls_capa2_operativo.sql  → el LOCK ya cerró anon en proyectos.
--   · sql/rls_eventos_proyectos.sql→ policies vigentes proyectos_auth_* USING(true).
--   · docs/schema-prod.md          → proyectos(estado text NN · _deleted bool NN ·
--                                     estado_taller varchar) · roles(id text ·
--                                     permissions jsonb NN · updated_at tstz).
--
-- Idempotente / transaccional. SQL-FIRST: correr ANTES de pullear el JS de Fase A.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ===== A.1 · RBAC (tabla `roles` = fuente de verdad de Capa 2 en runtime) =====
-- taller: pierde taller/logistica, gana proyectos (read). (Revierte SB4.)
UPDATE public.roles
   SET permissions = (permissions - 'taller' - 'logistica')
                     || jsonb_build_object('proyectos', 'read'),
       updated_at  = now()
 WHERE id = 'taller';

-- pm: pierde taller/logistica (módulos disueltos). Conserva el resto.
UPDATE public.roles
   SET permissions = (permissions - 'taller' - 'logistica'),
       updated_at  = now()
 WHERE id = 'pm';

-- admin/superadmin: se dejan INTACTOS (si tienen 'taller'/'logistica' queda inerte
-- al desaparecer el módulo). Descomentar SOLO si querés limpiarlos:
-- UPDATE public.roles SET permissions = permissions - 'taller' - 'logistica', updated_at = now()
--   WHERE id = 'admin' AND (permissions ? 'taller' OR permissions ? 'logistica');

-- ===== A.2 · RLS de proyectos: oficina = como hoy · taller = solo 'en_taller' =====
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;

-- Drop dinámico de TODAS las policies actuales de proyectos (robusto vs nombres
-- desconocidos: proyectos_auth_select/insert/update/delete de rls_eventos_proyectos, etc.).
DO $drop_proy$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proyectos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.proyectos', pol.policyname);
  END LOOP;
END
$drop_proy$;

-- OFICINA (cualquier authenticated que NO sea taller): ve y escribe TODO, igual que hoy.
CREATE POLICY proyectos_oficina_select ON public.proyectos
  FOR SELECT TO authenticated
  USING (public.fn_user_role() IS DISTINCT FROM 'taller');

CREATE POLICY proyectos_oficina_write ON public.proyectos
  FOR ALL TO authenticated
  USING      (public.fn_user_role() IS DISTINCT FROM 'taller')
  WITH CHECK (public.fn_user_role() IS DISTINCT FROM 'taller');

-- TALLER: ve SOLO los proyectos en producción (gate Q1 = estado='en_taller'), lectura.
CREATE POLICY proyectos_taller_select ON public.proyectos
  FOR SELECT TO authenticated
  USING (public.fn_user_role() = 'taller'
         AND estado = 'en_taller'
         AND _deleted = false);

-- TALLER: puede UPDATE de esos mismos proyectos (para "Marcar listo / Despachar" =
-- escribir estado_taller; el blindaje a esa columna es UI/API, Q15 v1). Sin INSERT/DELETE.
CREATE POLICY proyectos_taller_update ON public.proyectos
  FOR UPDATE TO authenticated
  USING      (public.fn_user_role() = 'taller'
              AND estado = 'en_taller'
              AND _deleted = false)
  WITH CHECK (public.fn_user_role() = 'taller'
              AND estado = 'en_taller');

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- TEST OBLIGATORIO (R2) — logueado EN LA APP como cada rol (en el SQL editor
-- corrés como postgres y BYPASSás RLS → no sirve para testear):
--   (a) ADMIN / SUPERADMIN / PM / VENTA (oficina): ven y editan TODOS los
--       proyectos igual que antes (crear/editar/borrar OK). ← si falla, ROLLBACK.
--   (b) TALLER: en #proyectos ve SOLO los de estado 'en_taller'; NO ve el resto;
--       NO puede crear ni borrar proyectos.
-- Listar las policies resultantes (deben quedar SOLO estas 4):
--   SELECT policyname, cmd, roles FROM pg_policies WHERE tablename='proyectos' ORDER BY policyname;
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK de emergencia (re-abre proyectos a todos los authenticated, como antes):
--   DROP POLICY IF EXISTS proyectos_oficina_select ON public.proyectos;
--   DROP POLICY IF EXISTS proyectos_oficina_write  ON public.proyectos;
--   DROP POLICY IF EXISTS proyectos_taller_select  ON public.proyectos;
--   DROP POLICY IF EXISTS proyectos_taller_update  ON public.proyectos;
--   CREATE POLICY proyectos_auth_select ON public.proyectos FOR SELECT TO authenticated USING (true);
--   CREATE POLICY proyectos_auth_insert ON public.proyectos FOR INSERT TO authenticated WITH CHECK (true);
--   CREATE POLICY proyectos_auth_update ON public.proyectos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY proyectos_auth_delete ON public.proyectos FOR DELETE TO authenticated USING (true);
-- Y para revertir el RBAC: re-correr sql/taller_rol_sin_proyectos.sql + sacar pm.
-- ───────────────────────────────────────────────────────────────────
