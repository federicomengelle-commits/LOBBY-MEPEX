-- ═══════════════════════════════════════════════════════════════════
-- FASE 1C — RLS para las tablas recreadas en fase1
-- ═══════════════════════════════════════════════════════════════════
-- CORRER DESPUÉS de fase1_unificacion_uuid.sql.
--
-- El DROP TABLE CASCADE borra también las policies viejas, así que
-- estas tablas quedan con RLS habilitado por default-deny: cualquier
-- INSERT/UPDATE/SELECT desde la app falla con
--    "new row violates row-level security policy"
-- hasta que se ejecuten estas policies.
--
-- Patrón: authenticated puede CRUD libre, anon solo SELECT.
-- Mismo criterio que sql/rls_eventos_proyectos.sql.
-- Idempotente: drop antes de cada create.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── rrhh_personal ─────────────────────────────────────────────
ALTER TABLE public.rrhh_personal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rrhh_personal_auth_select" ON public.rrhh_personal;
DROP POLICY IF EXISTS "rrhh_personal_auth_insert" ON public.rrhh_personal;
DROP POLICY IF EXISTS "rrhh_personal_auth_update" ON public.rrhh_personal;
DROP POLICY IF EXISTS "rrhh_personal_auth_delete" ON public.rrhh_personal;
DROP POLICY IF EXISTS "rrhh_personal_anon_select" ON public.rrhh_personal;

CREATE POLICY "rrhh_personal_auth_select" ON public.rrhh_personal FOR SELECT TO authenticated USING (true);
CREATE POLICY "rrhh_personal_auth_insert" ON public.rrhh_personal FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rrhh_personal_auth_update" ON public.rrhh_personal FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rrhh_personal_auth_delete" ON public.rrhh_personal FOR DELETE TO authenticated USING (true);
CREATE POLICY "rrhh_personal_anon_select" ON public.rrhh_personal FOR SELECT TO anon USING (true);

-- ─── rrhh_vacaciones ───────────────────────────────────────────
ALTER TABLE public.rrhh_vacaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rrhh_vacaciones_auth_select" ON public.rrhh_vacaciones;
DROP POLICY IF EXISTS "rrhh_vacaciones_auth_insert" ON public.rrhh_vacaciones;
DROP POLICY IF EXISTS "rrhh_vacaciones_auth_update" ON public.rrhh_vacaciones;
DROP POLICY IF EXISTS "rrhh_vacaciones_auth_delete" ON public.rrhh_vacaciones;
DROP POLICY IF EXISTS "rrhh_vacaciones_anon_select" ON public.rrhh_vacaciones;

CREATE POLICY "rrhh_vacaciones_auth_select" ON public.rrhh_vacaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "rrhh_vacaciones_auth_insert" ON public.rrhh_vacaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rrhh_vacaciones_auth_update" ON public.rrhh_vacaciones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rrhh_vacaciones_auth_delete" ON public.rrhh_vacaciones FOR DELETE TO authenticated USING (true);
CREATE POLICY "rrhh_vacaciones_anon_select" ON public.rrhh_vacaciones FOR SELECT TO anon USING (true);

-- ─── rrhh_asignaciones ─────────────────────────────────────────
ALTER TABLE public.rrhh_asignaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rrhh_asignaciones_auth_select" ON public.rrhh_asignaciones;
DROP POLICY IF EXISTS "rrhh_asignaciones_auth_insert" ON public.rrhh_asignaciones;
DROP POLICY IF EXISTS "rrhh_asignaciones_auth_update" ON public.rrhh_asignaciones;
DROP POLICY IF EXISTS "rrhh_asignaciones_auth_delete" ON public.rrhh_asignaciones;
DROP POLICY IF EXISTS "rrhh_asignaciones_anon_select" ON public.rrhh_asignaciones;

CREATE POLICY "rrhh_asignaciones_auth_select" ON public.rrhh_asignaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "rrhh_asignaciones_auth_insert" ON public.rrhh_asignaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rrhh_asignaciones_auth_update" ON public.rrhh_asignaciones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rrhh_asignaciones_auth_delete" ON public.rrhh_asignaciones FOR DELETE TO authenticated USING (true);
CREATE POLICY "rrhh_asignaciones_anon_select" ON public.rrhh_asignaciones FOR SELECT TO anon USING (true);

-- ─── rrhh_vacaciones_solicitudes ───────────────────────────────
ALTER TABLE public.rrhh_vacaciones_solicitudes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rrhh_vac_sol_auth_select" ON public.rrhh_vacaciones_solicitudes;
DROP POLICY IF EXISTS "rrhh_vac_sol_auth_insert" ON public.rrhh_vacaciones_solicitudes;
DROP POLICY IF EXISTS "rrhh_vac_sol_auth_update" ON public.rrhh_vacaciones_solicitudes;
DROP POLICY IF EXISTS "rrhh_vac_sol_auth_delete" ON public.rrhh_vacaciones_solicitudes;
DROP POLICY IF EXISTS "rrhh_vac_sol_anon_select" ON public.rrhh_vacaciones_solicitudes;

CREATE POLICY "rrhh_vac_sol_auth_select" ON public.rrhh_vacaciones_solicitudes FOR SELECT TO authenticated USING (true);
CREATE POLICY "rrhh_vac_sol_auth_insert" ON public.rrhh_vacaciones_solicitudes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rrhh_vac_sol_auth_update" ON public.rrhh_vacaciones_solicitudes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rrhh_vac_sol_auth_delete" ON public.rrhh_vacaciones_solicitudes FOR DELETE TO authenticated USING (true);
CREATE POLICY "rrhh_vac_sol_anon_select" ON public.rrhh_vacaciones_solicitudes FOR SELECT TO anon USING (true);

-- ─── logistica_vehiculos ───────────────────────────────────────
ALTER TABLE public.logistica_vehiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logistica_vehiculos_auth_select" ON public.logistica_vehiculos;
DROP POLICY IF EXISTS "logistica_vehiculos_auth_insert" ON public.logistica_vehiculos;
DROP POLICY IF EXISTS "logistica_vehiculos_auth_update" ON public.logistica_vehiculos;
DROP POLICY IF EXISTS "logistica_vehiculos_auth_delete" ON public.logistica_vehiculos;
DROP POLICY IF EXISTS "logistica_vehiculos_anon_select" ON public.logistica_vehiculos;

CREATE POLICY "logistica_vehiculos_auth_select" ON public.logistica_vehiculos FOR SELECT TO authenticated USING (true);
CREATE POLICY "logistica_vehiculos_auth_insert" ON public.logistica_vehiculos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logistica_vehiculos_auth_update" ON public.logistica_vehiculos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logistica_vehiculos_auth_delete" ON public.logistica_vehiculos FOR DELETE TO authenticated USING (true);
CREATE POLICY "logistica_vehiculos_anon_select" ON public.logistica_vehiculos FOR SELECT TO anon USING (true);

-- ─── logistica_movimientos ─────────────────────────────────────
ALTER TABLE public.logistica_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logistica_movimientos_auth_select" ON public.logistica_movimientos;
DROP POLICY IF EXISTS "logistica_movimientos_auth_insert" ON public.logistica_movimientos;
DROP POLICY IF EXISTS "logistica_movimientos_auth_update" ON public.logistica_movimientos;
DROP POLICY IF EXISTS "logistica_movimientos_auth_delete" ON public.logistica_movimientos;
DROP POLICY IF EXISTS "logistica_movimientos_anon_select" ON public.logistica_movimientos;

CREATE POLICY "logistica_movimientos_auth_select" ON public.logistica_movimientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "logistica_movimientos_auth_insert" ON public.logistica_movimientos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logistica_movimientos_auth_update" ON public.logistica_movimientos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logistica_movimientos_auth_delete" ON public.logistica_movimientos FOR DELETE TO authenticated USING (true);
CREATE POLICY "logistica_movimientos_anon_select" ON public.logistica_movimientos FOR SELECT TO anon USING (true);

-- ─── logistica_remito ──────────────────────────────────────────
ALTER TABLE public.logistica_remito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logistica_remito_auth_select" ON public.logistica_remito;
DROP POLICY IF EXISTS "logistica_remito_auth_insert" ON public.logistica_remito;
DROP POLICY IF EXISTS "logistica_remito_auth_update" ON public.logistica_remito;
DROP POLICY IF EXISTS "logistica_remito_auth_delete" ON public.logistica_remito;
DROP POLICY IF EXISTS "logistica_remito_anon_select" ON public.logistica_remito;

CREATE POLICY "logistica_remito_auth_select" ON public.logistica_remito FOR SELECT TO authenticated USING (true);
CREATE POLICY "logistica_remito_auth_insert" ON public.logistica_remito FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logistica_remito_auth_update" ON public.logistica_remito FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logistica_remito_auth_delete" ON public.logistica_remito FOR DELETE TO authenticated USING (true);
CREATE POLICY "logistica_remito_anon_select" ON public.logistica_remito FOR SELECT TO anon USING (true);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr aparte después del COMMIT
-- ═══════════════════════════════════════════════════════════════════
-- Esperado: 5 policies por tabla (4 auth + 1 anon select), 7 tablas = 35 filas.
-- SELECT tablename, COUNT(*)
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN (
--         'rrhh_personal', 'rrhh_vacaciones', 'rrhh_asignaciones',
--         'rrhh_vacaciones_solicitudes', 'logistica_vehiculos',
--         'logistica_movimientos', 'logistica_remito'
--     )
--   GROUP BY tablename
--   ORDER BY tablename;
