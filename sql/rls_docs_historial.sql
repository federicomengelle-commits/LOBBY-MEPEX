-- ═══════════════════════════════════════════════════════════════════
-- RLS — evento_documentos + evento_historial (Fase 4)
-- ═══════════════════════════════════════════════════════════════════
-- Reemplaza a rls_eventos_proyectos.sql para estas 2 tablas: ese script
-- moría en `evento_equipo` (42P01: no existe en prod — se eliminó a favor
-- de asignaciones_evento) y, por estar en una sola transacción, abortaba
-- TODO sin aplicar las policies de documentos/historial.
--
-- Acá sólo tocamos las 2 tablas que SÍ existen (verificado vía PostgREST).
-- Idempotente: DROP POLICY IF EXISTS + CREATE. Correr en Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

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
