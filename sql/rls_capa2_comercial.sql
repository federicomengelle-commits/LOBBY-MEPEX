-- ═══════════════════════════════════════════════════════════════════
-- CAPA 2 · TIER COMERCIAL — RLS manejada por la matriz
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-06-13. CORRER DESPUÉS de sql/rls_capa2_motor.sql.
--
-- PRE-FLIGHT verificado contra el código:
--   - taller.js LEE `clientes` (join cliente:clientes en el tablero, para mostrar
--     el nombre de cada stand) → clientes NO se bloquea a taller (lectura amplia).
--   - taller NO lee `cotizaciones` ni sus hijas → se gatean a `crm` sin romper taller.
--   - `proyectos` NO está acá (es operativo: taller lo lee y escribe estado_taller).
--
-- DOS GRUPOS:
--   A) Comercial sensible (cotizaciones + hijas + interacciones + templates):
--      read  = crm OR proyectos   (oficina; taller no tiene ninguno → bloqueado)
--      write = crm
--      SIN anon (no hay consumidor público de cotizaciones).
--   B) clientes: lectura amplia (authenticated, taller incluido) + anon (por las
--      dudas el cotizador externo los lea — TODO auditar); escritura solo crm.
--
-- Idempotente / defensivo / transaccional, igual que el tier financiero.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── GRUPO A · comercial sensible (gate crm, sin anon) ──────────────
DO $a$
DECLARE
  com_tables text[] := ARRAY[
    'cotizaciones','cotizacion_items','cotizacion_espacios','cotizacion_notas',
    'cotizacion_timeline','cotizacion_envios','cotizacion_numerador',
    'email_templates','interacciones'
  ];
  tbl text;
  pol record;
  v_read  text := '(public.fn_role_can(''crm'',''read'') OR public.fn_role_can(''proyectos'',''read''))';
  v_write text := 'public.fn_role_can(''crm'',''write'')';
BEGIN
  FOREACH tbl IN ARRAY com_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'SKIP (no existe en prod): %', tbl;
      CONTINUE;
    END IF;

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
                   tbl||'_rls_sel', tbl, v_read);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
                   tbl||'_rls_ins', tbl, v_write);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
                   tbl||'_rls_upd', tbl, v_write, v_write);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
                   tbl||'_rls_del', tbl, v_write);

    RAISE NOTICE 'RLS comercial (estricto, gate crm): %', tbl;
  END LOOP;
END
$a$;

-- ─── GRUPO B · clientes (lectura amplia, escritura crm) ─────────────
DO $b$
DECLARE
  pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clientes'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'clientes'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.clientes', pol.policyname);
    END LOOP;

    EXECUTE 'ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY';

    -- lectura: cualquier logueado (taller muestra el nombre del cliente)
    EXECUTE 'CREATE POLICY clientes_rls_sel ON public.clientes FOR SELECT TO authenticated USING (true)';
    -- anon: SE MANTIENE por las dudas el cotizador externo lo lea.
    -- TODO auditoría: si el cotizador NO lee clientes con la anon key, borrar esta policy.
    EXECUTE 'CREATE POLICY clientes_rls_anon ON public.clientes FOR SELECT TO anon USING (true)';
    -- escritura: solo roles con crm (taller no edita clientes)
    EXECUTE 'CREATE POLICY clientes_rls_ins ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.fn_role_can(''crm'',''write''))';
    EXECUTE 'CREATE POLICY clientes_rls_upd ON public.clientes FOR UPDATE TO authenticated USING (public.fn_role_can(''crm'',''write'')) WITH CHECK (public.fn_role_can(''crm'',''write''))';
    EXECUTE 'CREATE POLICY clientes_rls_del ON public.clientes FOR DELETE TO authenticated USING (public.fn_role_can(''crm'',''write''))';

    RAISE NOTICE 'RLS comercial (clientes, lectura amplia): clientes';
  END IF;
END
$b$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (correr aparte)
-- ═══════════════════════════════════════════════════════════════════
-- SELECT tablename, COUNT(*) FROM pg_policies WHERE schemaname='public'
--   AND tablename IN ('cotizaciones','cotizacion_items','cotizacion_espacios','cotizacion_notas',
--     'cotizacion_timeline','cotizacion_envios','cotizacion_numerador','email_templates',
--     'interacciones','clientes')
--   GROUP BY tablename ORDER BY tablename;
--
-- Prueba REAL en la app:
--   - admin/venta/pm: CRM y Cotizaciones andan igual.
--   - taller: el tablero sigue mostrando el NOMBRE del cliente (clientes lectura amplia)
--     pero NO puede traer cotizaciones ni por query directa.

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK (revierte a permisivo como estaba)
-- ═══════════════════════════════════════════════════════════════════
-- BEGIN;
-- DO $rb$
-- DECLARE
--   all_tables text[] := ARRAY['cotizaciones','cotizacion_items','cotizacion_espacios','cotizacion_notas',
--     'cotizacion_timeline','cotizacion_envios','cotizacion_numerador','email_templates','interacciones','clientes'];
--   tbl text; pol record;
-- BEGIN
--   FOREACH tbl IN ARRAY all_tables LOOP
--     IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN CONTINUE; END IF;
--     FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
--       EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
--     END LOOP;
--     EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl||'_auth_all', tbl);
--     EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)', tbl||'_anon_select', tbl);
--   END LOOP;
-- END $rb$;
-- COMMIT;
