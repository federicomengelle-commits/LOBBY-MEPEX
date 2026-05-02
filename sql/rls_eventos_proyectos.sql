-- ═══════════════════════════════════════════════════════════════════
-- RLS policies para las tablas creadas por rename_proyectos_eventos.sql
--
-- Sin estas policies, INSERT/UPDATE/DELETE fallan con
--    "new row violates row-level security policy for table ..."
--
-- Patrón: authenticated puede CRUD libremente, anon solo SELECT.
-- Mismo criterio que sql/calendario_operativo_v2.sql.
--
-- Idempotente: drop antes de cada create.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── eventos ───
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eventos_auth_select" ON public.eventos;
DROP POLICY IF EXISTS "eventos_auth_insert" ON public.eventos;
DROP POLICY IF EXISTS "eventos_auth_update" ON public.eventos;
DROP POLICY IF EXISTS "eventos_auth_delete" ON public.eventos;
DROP POLICY IF EXISTS "eventos_anon_select" ON public.eventos;

CREATE POLICY "eventos_auth_select" ON public.eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "eventos_auth_insert" ON public.eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "eventos_auth_update" ON public.eventos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "eventos_auth_delete" ON public.eventos FOR DELETE TO authenticated USING (true);
CREATE POLICY "eventos_anon_select" ON public.eventos FOR SELECT TO anon USING (true);

-- ─── proyectos ───
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proyectos_auth_select" ON public.proyectos;
DROP POLICY IF EXISTS "proyectos_auth_insert" ON public.proyectos;
DROP POLICY IF EXISTS "proyectos_auth_update" ON public.proyectos;
DROP POLICY IF EXISTS "proyectos_auth_delete" ON public.proyectos;
DROP POLICY IF EXISTS "proyectos_anon_select" ON public.proyectos;

CREATE POLICY "proyectos_auth_select" ON public.proyectos FOR SELECT TO authenticated USING (true);
CREATE POLICY "proyectos_auth_insert" ON public.proyectos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "proyectos_auth_update" ON public.proyectos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "proyectos_auth_delete" ON public.proyectos FOR DELETE TO authenticated USING (true);
CREATE POLICY "proyectos_anon_select" ON public.proyectos FOR SELECT TO anon USING (true);

-- ─── evento_equipo ───
ALTER TABLE public.evento_equipo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evento_equipo_auth_select" ON public.evento_equipo;
DROP POLICY IF EXISTS "evento_equipo_auth_insert" ON public.evento_equipo;
DROP POLICY IF EXISTS "evento_equipo_auth_update" ON public.evento_equipo;
DROP POLICY IF EXISTS "evento_equipo_auth_delete" ON public.evento_equipo;
DROP POLICY IF EXISTS "evento_equipo_anon_select" ON public.evento_equipo;

CREATE POLICY "evento_equipo_auth_select" ON public.evento_equipo FOR SELECT TO authenticated USING (true);
CREATE POLICY "evento_equipo_auth_insert" ON public.evento_equipo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "evento_equipo_auth_update" ON public.evento_equipo FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "evento_equipo_auth_delete" ON public.evento_equipo FOR DELETE TO authenticated USING (true);
CREATE POLICY "evento_equipo_anon_select" ON public.evento_equipo FOR SELECT TO anon USING (true);

-- ─── evento_transporte ───
ALTER TABLE public.evento_transporte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evento_transporte_auth_select" ON public.evento_transporte;
DROP POLICY IF EXISTS "evento_transporte_auth_insert" ON public.evento_transporte;
DROP POLICY IF EXISTS "evento_transporte_auth_update" ON public.evento_transporte;
DROP POLICY IF EXISTS "evento_transporte_auth_delete" ON public.evento_transporte;
DROP POLICY IF EXISTS "evento_transporte_anon_select" ON public.evento_transporte;

CREATE POLICY "evento_transporte_auth_select" ON public.evento_transporte FOR SELECT TO authenticated USING (true);
CREATE POLICY "evento_transporte_auth_insert" ON public.evento_transporte FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "evento_transporte_auth_update" ON public.evento_transporte FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "evento_transporte_auth_delete" ON public.evento_transporte FOR DELETE TO authenticated USING (true);
CREATE POLICY "evento_transporte_anon_select" ON public.evento_transporte FOR SELECT TO anon USING (true);

-- ─── evento_documentos ───
ALTER TABLE public.evento_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evento_documentos_auth_select" ON public.evento_documentos;
DROP POLICY IF EXISTS "evento_documentos_auth_insert" ON public.evento_documentos;
DROP POLICY IF EXISTS "evento_documentos_auth_update" ON public.evento_documentos;
DROP POLICY IF EXISTS "evento_documentos_auth_delete" ON public.evento_documentos;
DROP POLICY IF EXISTS "evento_documentos_anon_select" ON public.evento_documentos;

CREATE POLICY "evento_documentos_auth_select" ON public.evento_documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "evento_documentos_auth_insert" ON public.evento_documentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "evento_documentos_auth_update" ON public.evento_documentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "evento_documentos_auth_delete" ON public.evento_documentos FOR DELETE TO authenticated USING (true);
CREATE POLICY "evento_documentos_anon_select" ON public.evento_documentos FOR SELECT TO anon USING (true);

-- ─── evento_historial ───
ALTER TABLE public.evento_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evento_historial_auth_select" ON public.evento_historial;
DROP POLICY IF EXISTS "evento_historial_auth_insert" ON public.evento_historial;
DROP POLICY IF EXISTS "evento_historial_auth_update" ON public.evento_historial;
DROP POLICY IF EXISTS "evento_historial_auth_delete" ON public.evento_historial;
DROP POLICY IF EXISTS "evento_historial_anon_select" ON public.evento_historial;

CREATE POLICY "evento_historial_auth_select" ON public.evento_historial FOR SELECT TO authenticated USING (true);
CREATE POLICY "evento_historial_auth_insert" ON public.evento_historial FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "evento_historial_auth_update" ON public.evento_historial FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "evento_historial_auth_delete" ON public.evento_historial FOR DELETE TO authenticated USING (true);
CREATE POLICY "evento_historial_anon_select" ON public.evento_historial FOR SELECT TO anon USING (true);

COMMIT;
