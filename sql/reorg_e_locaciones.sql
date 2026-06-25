-- ═══════════════════════════════════════════════════════════════════
-- REORG · FASE E — Locaciones = espacios físicos (alquiler + vistas por rol)
-- ═══════════════════════════════════════════════════════════════════
-- Companion: docs/capa-operativa-blueprint.md §3.B / §4 (Fase E).
--
-- QUÉ HACE (ADITIVO):
--   · ALTER locaciones: bloque ALQUILER/CONTRATO (6 columnas, additivo).
--   · RBAC: el rol taller GANA 'locaciones' (read) — la cara operativa.
--   · RLS locaciones: oficina = como hoy (no-taller); taller = SOLO
--     tipo IN ('taller','deposito') (Q2 verificado contra prod 2026-06-25:
--     los valores reales son taller/deposito/oficina) → el taller ve el Taller
--     y el Depósito, NUNCA la Oficina. Mismo patrón seguro que reorg_a (sin
--     fn_role_can en oficina → cero riesgo de lockout de admin; drop dinámico).
--
-- ⚠ NO se toca `tipo` (ya existe text NOT NULL). NO se migra a UUID (arrastra
--   locaciones_stock). NO se crean tablas de rutinas (van a la tabla global
--   `rutinas`, Fase F). Inventario / locaciones_stock NO se tocan.
--
-- VERIFICADO CONTRA docs/schema-prod.md + prod: locaciones.id bigint · tipo text
--   NOT NULL · _deleted bool NOT NULL · fn_user_role() existe (rls_capa2_motor).
-- Idempotente. SQL-FIRST: correr ANTES de pullear el JS de Fase E.
-- ═══════════════════════════════════════════════════════════════════

-- ===== E.0 · bloque alquiler/contrato (additivo) ====================
ALTER TABLE public.locaciones ADD COLUMN IF NOT EXISTS alquiler_monto        numeric;
ALTER TABLE public.locaciones ADD COLUMN IF NOT EXISTS alquiler_moneda       text NOT NULL DEFAULT 'ARS';
ALTER TABLE public.locaciones ADD COLUMN IF NOT EXISTS alquiler_dia_pago     int;
ALTER TABLE public.locaciones ADD COLUMN IF NOT EXISTS contrato_vence        date;
ALTER TABLE public.locaciones ADD COLUMN IF NOT EXISTS propietario           text;
ALTER TABLE public.locaciones ADD COLUMN IF NOT EXISTS propietario_contacto  text;

-- ===== E.1 · RBAC: taller gana 'locaciones' (read, cara operativa) ===
UPDATE public.roles
   SET permissions = permissions || jsonb_build_object('locaciones', 'read'),
       updated_at  = now()
 WHERE id = 'taller';

-- ===== E.2 · RLS locaciones: oficina = como hoy · taller = taller/deposito ===
ALTER TABLE public.locaciones ENABLE ROW LEVEL SECURITY;

-- Drop dinámico de TODAS las policies actuales (robusto; hoy tiene locaciones_rls_auth de rls_capa2).
DO $drop_loc$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname='public' AND tablename='locaciones'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.locaciones', pol.policyname);
  END LOOP;
END
$drop_loc$;

-- OFICINA (cualquier authenticated que NO sea taller): ve y escribe TODO, igual que hoy.
CREATE POLICY locaciones_oficina_select ON public.locaciones
  FOR SELECT TO authenticated
  USING (public.fn_user_role() IS DISTINCT FROM 'taller');

CREATE POLICY locaciones_oficina_write ON public.locaciones
  FOR ALL TO authenticated
  USING      (public.fn_user_role() IS DISTINCT FROM 'taller')
  WITH CHECK (public.fn_user_role() IS DISTINCT FROM 'taller');

-- TALLER: ve SOLO taller + depósito (Q2), lectura. Sin la oficina, sin escritura.
CREATE POLICY locaciones_taller_select ON public.locaciones
  FOR SELECT TO authenticated
  USING (public.fn_user_role() = 'taller'
         AND tipo IN ('taller','deposito')
         AND _deleted = false);

-- ═══════════════════════════════════════════════════════════════════
-- TEST (logueado en la app como cada rol):
--   (a) ADMIN/SUPERADMIN/PM/VENTA: Locaciones igual que antes (3 lugares, editan).
--   (b) TALLER: ve SOLO Taller MEPEX + Depósito MEPEX (NO Oficina MEPEX); read-only.
--   SELECT policyname,cmd,roles FROM pg_policies WHERE tablename='locaciones';  -- las 3 de arriba.
-- ROLLBACK: drop las 3 locaciones_* + CREATE POLICY locaciones_rls_auth ON public.locaciones
--           FOR ALL TO authenticated USING(true) WITH CHECK(true);  + sacar 'locaciones' del rol taller.
--           (Las columnas de alquiler quedan; son additivas e inertes.)
-- ═══════════════════════════════════════════════════════════════════
