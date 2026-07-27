-- ═══════════════════════════════════════════════════════════════════
-- SEGURIDAD — Fix advisor "rls_disabled_in_public" (mail Supabase 20/07/2026)
-- Revisado por sql-reviewer 2026-07-24: 2 HIGH aplicados (guard anti-42710
-- + purga de policies anon/public huérfanas antes de prender RLS).
-- ═══════════════════════════════════════════════════════════════════
-- Qué hace: encuentra TODAS las tablas base del schema public que tengan
-- RLS deshabilitado y (a) purga policies anon/public huérfanas (inertes con
-- RLS off, se reactivarían solas al prenderlo), (b) habilita RLS, (c) si no
-- queda ninguna policy para authenticated, crea la authenticated-all estándar
-- del proyecto (mismo patrón que el grupo LOCK de sql/rls_capa2_operativo.sql).
--
-- NO toca: grupo REF (catalogo_items / listas_precio* — ya tienen RLS + anon
-- SELECT intencional para el cotizador y no entran al loop), encuestas_evento,
-- views, ni el schema auth. service_role bypassea RLS siempre (webhooks/VPS
-- siguen andando). Idempotente: re-correrlo no cambia nada.
--
-- ORDEN: 1) diagnóstico  2) DO fix  3) verificación  3.5) auditoría anon (OBLIGATORIA).
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. DIAGNÓSTICO: ¿qué tablas están hoy con RLS apagado? ─────────
-- (esta lista debería coincidir con lo que marca el Security Advisor)
SELECT tablename AS tabla_sin_rls
FROM pg_tables
WHERE schemaname = 'public' AND NOT rowsecurity
ORDER BY tablename;

-- ─── 2. FIX ─────────────────────────────────────────────────────────
DO $fix$
DECLARE
  tbl text;
  has_auth boolean;
  pol record;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND NOT rowsecurity
    ORDER BY tablename
  LOOP
    -- purgar policies anon/public huérfanas ANTES de prender RLS (con RLS
    -- off son inertes, pero al habilitarlo se reactivan solas y dejarían
    -- la tabla igual de abierta — y el paso 3 no lo detectaría)
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
        AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      RAISE NOTICE 'Dropeada policy anon/public huérfana en %: %', tbl, pol.policyname;
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
        AND 'authenticated' = ANY(roles)
    ) INTO has_auth;

    IF NOT has_auth THEN
      -- DROP previo: CREATE POLICY no soporta IF NOT EXISTS y una colisión
      -- de nombre abortaría el DO entero con rollback (42710)
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_rls_auth', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        tbl || '_rls_auth', tbl
      );
      RAISE NOTICE 'RLS ON + authenticated-all creada: %', tbl;
    ELSE
      RAISE NOTICE 'RLS ON (policy authenticated existente preservada): %', tbl;
    END IF;
  END LOOP;
END
$fix$;

-- ─── 3. VERIFICACIÓN: debe devolver 0 filas ─────────────────────────
SELECT tablename AS quedo_sin_rls
FROM pg_tables
WHERE schemaname = 'public' AND NOT rowsecurity;

-- ─── 3.5 AUDITORÍA ANON (OBLIGATORIA — no asumir resuelto sin esto) ─
-- ¿Qué tablas quedan visibles para anon/public?
SELECT tablename, policyname, roles FROM pg_policies
WHERE schemaname = 'public' AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
ORDER BY tablename;
-- Esperado: SOLO catalogo_items / listas_precio / lista_precio_items /
-- lista_precio_rubros / encuestas_evento. Cualquier otra fila = avisarme,
-- NO asumir resuelto solo porque el paso 3 dio 0.

-- Después: Dashboard → Advisors → Security Advisor → "Rerun linter"
-- y el CRITICAL "Table publicly accessible" debe desaparecer.

-- ─── ROLLBACK (solo si un módulo dejara de ver una tabla puntual) ───
-- El síntoma sería 42501 / lista vacía en un módulo tras el fix.
-- Por tabla afectada:
--   ALTER TABLE public.<tbl> DISABLE ROW LEVEL SECURITY;
-- (o mejor: avisarme y ajustamos la policy en vez de re-abrir todo)
