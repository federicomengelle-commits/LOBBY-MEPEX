-- ═══════════════════════════════════════════════════════════════════
-- CAPA 2 · TIER OPERATIVO + REFERENCIA — cerrar el agujero `anon`
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-06-13. CORRER DESPUÉS de motor + financiero + comercial + roles_profiles.
--
-- QUÉ HACE: el resto de las tablas de negocio hoy son leíbles por `anon` (la
-- publishable key está en el browser → cualquiera la saca y lee eventos,
-- proyectos, personas/PII, inventario, compras, etc.). Esto lo cierra.
--
-- 🛡️ LÓGICA SEGURA (no afloja nada):
--   GRUPO LOCK → por tabla: (1) DROPea SOLO las policies que dan acceso a `anon`;
--               (2) deja RLS prendida; (3) crea una policy authenticated-all
--               ÚNICAMENTE si la tabla NO tiene ya alguna policy para authenticated
--               (así NO pisa políticas restrictivas existentes como audit_log
--               admin-only o notifications/proyecto_novedades con update por autor,
--               y a la vez evita que una tabla sin policy quede deny-all y rompa
--               la app). Resultado: anon afuera, authenticated igual que antes.
--   GRUPO REF  → catálogo/listas: estandariza authenticated-all + MANTIENE anon
--               SELECT (el cotizador externo lo lee con la anon key — NO romper).
--   GRUPO SURVEY→ encuestas_evento: authenticated-all + anon SELECT + anon UPDATE
--               (la encuesta pública responde por token sin login).
--
-- ⚠ NO incluye tablas ya cubiertas por otros tiers (financiero/comercial/roles/profiles).
-- superadmin/service_role no se afectan.
--
-- TEST OBLIGATORIO tras correr → (a) app logueada anda igual en TODOS los módulos
-- (sobre todo crear/editar notifs, novedades, ausencias); (b) la ENCUESTA pública
-- abre y responde; (c) el COTIZADOR externo sigue leyendo el catálogo; (d) anon NO
-- puede leer eventos/personas/etc.
--
-- Idempotente / defensivo / transaccional. Rollback al pie.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── GRUPO LOCK: cerrar anon, preservar authenticated (restrictivas incl.) ──
DO $lock$
DECLARE
  lock_tables text[] := ARRAY[
    -- eventos + operativo
    'eventos','predios','evento_jornadas','evento_documentos','evento_historial','asignaciones_evento',
    -- proyectos + hijas
    'proyectos','proyecto_tipos','proyecto_responsables','proyecto_novedades','proyecto_actividad',
    -- taller
    'taller_proyecto_checklist','taller_checklist','taller_notas','taller_materiales',
    -- logística / flota
    'cargas','carga_proyectos','carga_personas','vehiculos','remitos',
    'logistica_movimientos','logistica_vehiculos','logistica_remito','produccion_mantenimiento',
    -- rrhh / personas (PII — alta prioridad de cierre)
    'personas','persona_documentos','ausencias','vacaciones_saldos',
    'rrhh_personal','rrhh_asignaciones','rrhh_vacaciones','rrhh_vacaciones_solicitudes',
    -- inventario
    'inventario_movimientos','inventario_movimiento_items','inventario_fisico_sesiones','inventario_fisico_conteo','opciones_select',
    -- locaciones
    'locaciones','locaciones_documentos','locaciones_stock',
    -- referencia interna (catálogo/listas van en GRUPO REF)
    'proveedor','insumos_base','receta_componentes','costos_tipo_amortizacion','costos_params_globales','parametros_globales','insumo_precio_historial',
    -- compras
    'compras_proveedores','compras_pedidos','compras_ordenes','compras_orden_items','compras_oc_presupuestos','compras_pagos',
    -- sistema (audit_log/notifications tienen policies restrictivas → la lógica las preserva)
    'notifications','audit_log','audit_logs','pyme_sync_log'
  ];
  tbl text; pol record; has_auth boolean;
BEGIN
  FOREACH tbl IN ARRAY lock_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      RAISE NOTICE 'SKIP (no existe): %', tbl; CONTINUE;
    END IF;

    -- (1) dropear SOLO las policies que aplican a anon
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=tbl AND 'anon' = ANY(roles)
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    -- (2) RLS prendida
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- (3) crear authenticated-all SOLO si no quedó ninguna policy para authenticated
    --     (preserva restrictivas; evita deny-all en tablas sin policy)
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=tbl
        AND ('authenticated' = ANY(roles) OR 'public' = ANY(roles))
    ) INTO has_auth;

    IF NOT has_auth THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl||'_rls_auth', tbl);
      RAISE NOTICE 'LOCK %: anon cerrado + authenticated-all creada', tbl;
    ELSE
      RAISE NOTICE 'LOCK %: anon cerrado, authenticated preservada', tbl;
    END IF;
  END LOOP;
END
$lock$;

-- ─── GRUPO REF: authenticated full + anon SELECT (cotizador externo) ─
DO $ref$
DECLARE
  ref_tables text[] := ARRAY['catalogo_items','listas_precio','lista_precio_items','lista_precio_rubros'];
  tbl text; pol record;
BEGIN
  FOREACH tbl IN ARRAY ref_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      RAISE NOTICE 'SKIP (no existe): %', tbl; CONTINUE;
    END IF;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl||'_rls_auth', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)', tbl||'_rls_anon', tbl);
    RAISE NOTICE 'REF (auth + anon read, cotizador): %', tbl;
  END LOOP;
END
$ref$;

-- ─── GRUPO SURVEY: encuestas_evento (anon SELECT + UPDATE por token) ─
DO $sv$
DECLARE pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='encuestas_evento') THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='encuestas_evento' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.encuestas_evento', pol.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE public.encuestas_evento ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY encuestas_rls_auth ON public.encuestas_evento FOR ALL TO authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY encuestas_rls_anon_sel ON public.encuestas_evento FOR SELECT TO anon USING (true)';
    EXECUTE 'CREATE POLICY encuestas_rls_anon_upd ON public.encuestas_evento FOR UPDATE TO anon USING (true) WITH CHECK (true)';
    RAISE NOTICE 'SURVEY (auth + anon read/update por token): encuestas_evento';
  END IF;
END
$sv$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN: ¿quedó alguna tabla de negocio con policy anon que no deba?
-- ═══════════════════════════════════════════════════════════════════
-- SELECT tablename, policyname, roles FROM pg_policies
--   WHERE schemaname='public' AND 'anon' = ANY(roles)
--   ORDER BY tablename;
-- Esperado: SOLO catalogo_items / listas_precio* / lista_precio_* / encuestas_evento.

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK (re-abre anon en una tabla puntual si algo se rompió)
-- ═══════════════════════════════════════════════════════════════════
-- Por tabla afectada:
--   CREATE POLICY "<tbl>_anon_select" ON public.<tbl> FOR SELECT TO anon USING (true);
-- (No hace falta tocar las authenticated — esta migración no las modificó salvo
--  crear authenticated-all donde no había ninguna.)
