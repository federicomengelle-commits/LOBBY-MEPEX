-- ═══════════════════════════════════════════════════════════════════
-- CAPA 2 · TIER FINANCIERO — RLS manejada por la matriz
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-06-13. CORRER DESPUÉS de sql/rls_capa2_motor.sql.
--
-- Cierra el agujero: hoy estas tablas tienen policies permisivas (USING(true))
-- + anon SELECT → cualquiera con la anon key lee la contabilidad. Tras esto:
--   read/write  ⇒  fn_role_can('finanzas'|'contabilidad', ...)  (lee la matriz)
--   anon        ⇒  sin policy = denegado
--   superadmin  ⇒  siempre (short-circuit del motor)
--   service_role (backend lobby-api) ⇒ bypassa RLS → ops admin server-side OK
--
-- De facto hoy = admin + superadmin (son los únicos con finanzas/contabilidad
-- en la matriz), pero queda TUNEABLE desde el Panel sin tocar SQL.
--
-- Diseño:
--   - Borra TODAS las policies existentes de cada tabla (las viejas permisivas)
--     y crea 4 estandarizadas. Así no hay que adivinar nombres viejos.
--   - DEFENSIVO: saltea tablas que no existan (el schema del repo puede no
--     coincidir 1:1 con prod — regla 12 del CLAUDE.md).
--   - TRANSACCIONAL: si una sentencia falla, rollback total (estado consistente).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

DO $rls$
DECLARE
  fin_tables text[] := ARRAY[
    -- tesorería / movimientos / cobranzas (módulo finanzas)
    'ingresos','egresos','cuentas_financieras','transferencias_internas',
    'plan_cobro','plan_cobro_items','cobro_aplicaciones',
    'comprobantes','comprobantes_recibidos','comprobantes_iva_recovery',
    'conciliaciones','extracto_bancario_lineas',
    'vencimientos_recurrentes','vencimientos_generados',
    -- libro / plan de cuentas / saldos (módulo contabilidad)
    'asientos','asiento_lineas','plan_cuentas',
    'saldos_mensuales','saldos_apertura','mapeo_cuentas'
  ];
  tbl text;
  pol record;
  -- read = finanzas OR contabilidad (cross-read entre los 2 módulos de finanzas)
  v_read  text := '(public.fn_role_can(''finanzas'',''read'')  OR public.fn_role_can(''contabilidad'',''read''))';
  v_write text := '(public.fn_role_can(''finanzas'',''write'') OR public.fn_role_can(''contabilidad'',''write''))';
BEGIN
  FOREACH tbl IN ARRAY fin_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'SKIP (no existe en prod): %', tbl;
      CONTINUE;
    END IF;

    -- 1) borrar todas las policies actuales (permisivas viejas + anon)
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    -- 2) asegurar RLS prendida (sin policy + RLS on = deny → anon queda afuera)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- 3) policies nuevas manejadas por la matriz (solo authenticated)
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
                   tbl||'_rls_sel', tbl, v_read);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
                   tbl||'_rls_ins', tbl, v_write);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
                   tbl||'_rls_upd', tbl, v_write, v_write);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
                   tbl||'_rls_del', tbl, v_write);

    RAISE NOTICE 'RLS financiero aplicada: %', tbl;
  END LOOP;
END
$rls$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (correr aparte)
-- ═══════════════════════════════════════════════════════════════════
-- Esperado: 4 policies por tabla existente (_rls_sel/_ins/_upd/_del), 0 anon.
-- SELECT tablename, COUNT(*) AS policies
--   FROM pg_policies
--   WHERE schemaname='public'
--     AND tablename IN ('ingresos','egresos','cuentas_financieras','transferencias_internas',
--       'plan_cobro','plan_cobro_items','cobro_aplicaciones','comprobantes','comprobantes_recibidos',
--       'comprobantes_iva_recovery','conciliaciones','extracto_bancario_lineas',
--       'vencimientos_recurrentes','vencimientos_generados','asientos','asiento_lineas',
--       'plan_cuentas','saldos_mensuales','saldos_apertura','mapeo_cuentas')
--   GROUP BY tablename ORDER BY tablename;
--
-- Prueba REAL: logueá en la app como admin (ve/edita Finanzas OK) y como venta/pm
-- (Finanzas no debe traer NADA ni por query directa). superadmin = todo.

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK (si algo se rompe — revierte a permisivo como estaba antes)
-- ═══════════════════════════════════════════════════════════════════
-- BEGIN;
-- DO $rb$
-- DECLARE
--   fin_tables text[] := ARRAY['ingresos','egresos','cuentas_financieras','transferencias_internas',
--     'plan_cobro','plan_cobro_items','cobro_aplicaciones','comprobantes','comprobantes_recibidos',
--     'comprobantes_iva_recovery','conciliaciones','extracto_bancario_lineas',
--     'vencimientos_recurrentes','vencimientos_generados','asientos','asiento_lineas',
--     'plan_cuentas','saldos_mensuales','saldos_apertura','mapeo_cuentas'];
--   tbl text; pol record;
-- BEGIN
--   FOREACH tbl IN ARRAY fin_tables LOOP
--     IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN CONTINUE; END IF;
--     FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
--       EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
--     END LOOP;
--     EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl||'_auth_all', tbl);
--     EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)', tbl||'_anon_select', tbl);
--   END LOOP;
-- END $rb$;
-- COMMIT;
