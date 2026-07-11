-- =====================================================================
-- Fixes de RLS — basados en el dump real de pg_policies (2026-07-10)
-- Auditoría de seguridad §M3. Nombres de policy = los reales de tu DB.
-- =====================================================================
-- ⚠️ Corré PRIMERO el PASO 0 (diagnóstico) y pegame el resultado.
--    Si RLS está ON en esas tablas (casi seguro), corré el PASO 1 entero
--    (está en una transacción: o entra todo o no entra nada).
-- =====================================================================


-- ─── PASO 0 · ¿RLS está activa en las tablas a tocar? (solo lectura) ───
SELECT c.relname AS tabla, c.relrowsecurity AS rls_activa
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN (
    'insumos_base','receta_componentes','opciones_select',
    'inventario_movimientos','inventario_movimiento_items',
    'inventario_fisico_conteo','inventario_fisico_sesiones','audit_log'
  )
ORDER BY c.relname;
-- Si alguna sale rls_activa=false, avisame ANTES de correr el PASO 1
-- (en esas hay que ENABLE ROW LEVEL SECURITY, y eso puede cambiar comportamiento).


-- ─── PASO 1 · Cerrar acceso anónimo a datos de negocio ───
-- Hoy estas tablas tienen policies con rol {public} y USING(true) = cualquiera con
-- la publishable key (anon) puede LEER y ESCRIBIR costos, inventario y recetas.
-- Las pasamos a {authenticated} (los usuarios logueados siguen con acceso total;
-- el anon queda afuera). Donde ya existían policies {authenticated} paralelas,
-- solo borramos la de {public}.

BEGIN;

-- insumos_base: única policy es {public} → reemplazar por authenticated
DROP POLICY IF EXISTS "Acceso total insumos" ON public.insumos_base;
CREATE POLICY "insumos_base_auth_all" ON public.insumos_base
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- receta_componentes: única policy es {public} (mal etiquetada) → authenticated
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.receta_componentes;
CREATE POLICY "receta_componentes_auth_all" ON public.receta_componentes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- opciones_select: SELECT/INSERT/DELETE {public} → una sola authenticated ALL
DROP POLICY IF EXISTS "Permitir lectura pública"     ON public.opciones_select;
DROP POLICY IF EXISTS "Permitir inserción pública"   ON public.opciones_select;
DROP POLICY IF EXISTS "Permitir eliminación pública" ON public.opciones_select;
CREATE POLICY "opciones_select_auth_all" ON public.opciones_select
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- inventario_*: tienen la {public} ALL + policies {authenticated} por comando.
-- Solo borramos la {public} ALL (las authenticated ya cubren el CRUD de la app).
DROP POLICY IF EXISTS "inventario_movimientos_all"      ON public.inventario_movimientos;
DROP POLICY IF EXISTS "inventario_movimiento_items_all" ON public.inventario_movimiento_items;
DROP POLICY IF EXISTS "inventario_fisico_conteo_all"    ON public.inventario_fisico_conteo;
DROP POLICY IF EXISTS "inventario_fisico_sesiones_all"  ON public.inventario_fisico_sesiones;

-- audit_log: el log de auditoría era legible por CUALQUIERA (anon incluido).
-- Lo cerramos a usuarios logueados (mínimo seguro; ver nota admin-only abajo).
DROP POLICY IF EXISTS "Users can read audit logs" ON public.audit_log;
CREATE POLICY "audit_log_read_authenticated" ON public.audit_log
  FOR SELECT TO authenticated USING (true);

COMMIT;

-- (Opcional, más estricto) audit_log solo admin/superadmin — corré esto SOLO si
-- confirmás que nadie que no sea admin necesita leerlo desde la app:
-- DROP POLICY IF EXISTS "audit_log_read_authenticated" ON public.audit_log;
-- CREATE POLICY "audit_log_read_admin" ON public.audit_log
--   FOR SELECT TO authenticated USING ( public.fn_is_admin() );


-- ─── PASO 2 · DECISIONES — ✅ RESUELTO 2026-07-11, NO usar este bloque ───
-- Las 2 decisiones se cerraron: el cotizador NO usa la anon key (va por su
-- server con service_role) y la encuesta pública se migró a RPCs SECURITY
-- DEFINER (fn_encuesta_publica_get / fn_encuesta_publica_responder).
-- ▶ El fix vive en:
--   sql/seguridad_rls_paso2_encuesta_rpc.sql   (RPCs — correr ANTES del pull)
--   sql/seguridad_rls_paso2b_drop_anon.sql     (drops anon — correr DESPUÉS del pull)
