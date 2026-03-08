-- ============================================
--  FIX: Agregar policies para role "authenticated"
--
--  Las policies originales solo cubren "anon".
--  La app usa supabase.auth.signInWithPassword()
--  → el role pasa a "authenticated" → sin policies
--  → retorna array vacío.
-- ============================================

-- COTIZACIONES
CREATE POLICY "cotizaciones_auth_select" ON public.cotizaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "cotizaciones_auth_insert" ON public.cotizaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cotizaciones_auth_update" ON public.cotizaciones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cotizaciones_auth_delete" ON public.cotizaciones FOR DELETE TO authenticated USING (true);

-- COTIZACION_TIMELINE
CREATE POLICY "timeline_auth_select" ON public.cotizacion_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "timeline_auth_insert" ON public.cotizacion_timeline FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "timeline_auth_update" ON public.cotizacion_timeline FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "timeline_auth_delete" ON public.cotizacion_timeline FOR DELETE TO authenticated USING (true);

-- COTIZACION_ENVIOS
CREATE POLICY "envios_auth_select" ON public.cotizacion_envios FOR SELECT TO authenticated USING (true);
CREATE POLICY "envios_auth_insert" ON public.cotizacion_envios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "envios_auth_update" ON public.cotizacion_envios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "envios_auth_delete" ON public.cotizacion_envios FOR DELETE TO authenticated USING (true);

-- EMAIL_TEMPLATES
CREATE POLICY "templates_auth_select" ON public.email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_auth_insert" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "templates_auth_update" ON public.email_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "templates_auth_delete" ON public.email_templates FOR DELETE TO authenticated USING (true);

-- COTIZACION_NOTAS
CREATE POLICY "notas_auth_select" ON public.cotizacion_notas FOR SELECT TO authenticated USING (true);
CREATE POLICY "notas_auth_insert" ON public.cotizacion_notas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notas_auth_update" ON public.cotizacion_notas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notas_auth_delete" ON public.cotizacion_notas FOR DELETE TO authenticated USING (true);
