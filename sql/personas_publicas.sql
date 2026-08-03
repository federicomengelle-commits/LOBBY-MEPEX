-- ════════════════════════════════════════════════════════════════════════
-- T4.7 · cerrar los datos sensibles de `personas`   (auditoría 2026-07-31)
-- ════════════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA (hallazgo A15). La RLS de `personas` es `USING(true)` para
-- cualquier autenticado, en SELECT, UPDATE e INSERT. El único control es
-- `Auth.isAdminLevel()` en `rrhh.js`, que se saltea desde la consola:
--
--     await supabaseClient.from('personas').select('*')
--
-- le devuelve a un `taller` o a un `venta` el CUIL, el DNI, el CBU, el banco,
-- la dirección, el contacto de emergencia, la situación previsional y el
-- jornal de sus 25 compañeros. Y con `.update()` puede cambiarle el CBU a
-- cualquiera — o sea, redirigir a dónde se le paga. `personas_delete` SÍ está
-- cerrada a admin/superadmin, lo que muestra que fue descuido, no decisión.
--
-- ⚠️ POR QUÉ NO SE HACE LO QUE PEDÍA EL PLAN (view + cerrar la RLS de filas).
-- El plan proponía una view `personas_publicas` con `security_invoker = true`
-- y cerrar la tabla base. Se descartó por dos razones, las dos verificadas
-- contra prod:
--
--   1. `security_invoker = true` evalúa la RLS de la tabla base con los
--      permisos de QUIEN CONSULTA. Con `personas` cerrada a `rrhh`, un pm
--      consultando la view recibiría **cero filas**: la view no serviría para
--      nada, que es justo lo que venía a resolver.
--   2. Y sobre todo: **hay 11 FKs apuntando a `personas`** (asignaciones_evento,
--      cargas ×2, carga_personas, evento_transporte, vehiculos, evento_costos,
--      ausencias, persona_documentos, vacaciones_saldos, evento_costo_catalogo)
--      y el JS las usa como **embeds** de PostgREST — `persona:personas!persona_id(…)`,
--      `chofer:personas!chofer_persona_id(…)`. Un embed es un join contra la
--      tabla base y lo filtra su RLS. Cerrar la RLS de filas le apaga a un pm
--      el chofer de la carga, el encargado, y la persona de cada asignación.
--      El hallazgo original nombraba 3 consumidores; son 8 usos directos más
--      8 embeds.
--
-- LO QUE SE HACE EN LUGAR DE ESO. El problema real no es a qué FILAS se
-- accede —todos pueden ver a todos, eso está bien y el sistema lo necesita—
-- sino a qué COLUMNAS. Y para columnas la herramienta es el GRANT, no la RLS:
--
--   · SELECT queda abierto a nivel fila (los 8 embeds siguen andando intactos)
--     pero se revoca el privilegio sobre las columnas sensibles. Un
--     `select('*')` de un rol cualquiera pasa a fallar con 42501, y pedir
--     `cuil` o `cbu_alias` también.
--   · UPDATE e INSERT sí se cierran por RLS a `fn_role_can('rrhh','write')`.
--     Ésta es la mitad más grave del hallazgo: que un taller pueda cambiar
--     un CBU. Acá no hay caso legítimo fuera de RRHH — se verificó que las
--     únicas escrituras a `personas` en todo el repo salen de `rrhh.js`.
--   · RRHH lee el legajo completo por la view `personas_legajo`, que lleva el
--     guard de rol adentro.
--
-- ⚠️ ORDEN DE DEPLOY — la PARTE 2 va DESPUÉS del pull del JS:
--   1. correr la PARTE 1 (crea la view; no cambia nada de lo que ya anda)
--   2. `~/pull-lobby.sh`  → el JS deja de pedir `select('*')` sobre personas
--   3. recién ahí correr la PARTE 2 (revoca las columnas y cierra la escritura)
-- Al revés, entre el paso 1 y el 2 RRHH queda sin poder abrir la nómina.
--
-- El paso 2 NO es un acto de fe: son estos 7 puntos, y están en el commit de
-- T4.7. Si alguno no está en el código que sirve prod, la PARTE 2 rompe algo.
--   · api.js  `PERSONA_COLS_PUBLICAS`            (la lista, en un solo lugar)
--   · api.js  `getPersonas`                      select('*') → columnas públicas
--   · api.js  `getPersonasOperativas`            select('*') → columnas públicas
--   · api.js  `getCargaById`  `chofer:personas!chofer_persona_id(*)` → explícito
--   · api.js  `_getPersonasJornalMap`            → `personas_legajo`
--   · rrhh.js ×4 `select('*')` de la nómina      → `personas_legajo`
--   · (los ~8 embeds `persona:personas!…(id, nombre, …)` NO se tocan: piden
--      columnas públicas y siguen andando igual — ésa es la gracia del enfoque)
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 1 · La view del legajo  (aditiva — se puede correr sin tocar nada más)
-- ─────────────────────────────────────────────────────────────────────────
BEGIN;

-- `CREATE OR REPLACE` y no DROP+CREATE: en las corridas siguientes preserva el
-- ACL ya cerrado, mientras que un DROP haría renacer la view legible por `anon`
-- vía el pg_default_acl, que sigue abierto (T0.11 — el incidente de las 5 views
-- financieras del 26/07). Ojo: en ESTA primera corrida no hay ACL que preservar,
-- así que lo que cierra el agujero es el `REVOKE` explícito de más abajo — no el
-- verbo. Si alguien saca ese REVOKE creyendo que el REPLACE ya lo cubre, reabre.
-- No hay ventana: todo va en una transacción y el DDL de Postgres es transaccional.
--
-- SECURITY DEFINER (el default) a propósito, y por eso el guard de rol va
-- EN EL WHERE: con `security_invoker = true` esta view heredaría la RLS de
-- `personas`, que para SELECT queda abierta — o sea que no filtraría nada y
-- expondría el legajo entero a cualquier autenticado, que es el bug que
-- estamos cerrando. Acá el filtro es explícito y se lee.
CREATE OR REPLACE VIEW public.personas_legajo AS
SELECT *
FROM public.personas
WHERE fn_role_can('rrhh', 'read');

COMMENT ON VIEW public.personas_legajo IS
    'Legajo completo de personas (CUIL, DNI, CBU, dirección, jornal, contacto de '
    'emergencia). Sólo devuelve filas a quien tiene rrhh:read — el guard está en el '
    'WHERE, no en la RLS. Los flujos operativos NO usan esta view: leen las columnas '
    'públicas de `personas` directo. '
    '⚠️ El Advisor de Supabase va a marcarla como security_definer_view: es a '
    'propósito y está auditado. NO ponerle security_invoker=true — heredaría la RLS '
    'de personas, que para SELECT queda abierta, y expondría el legajo entero a '
    'cualquier autenticado. '
    '⚠️ El `SELECT *` se CONGELA: Postgres lo expande a la lista de columnas al crear '
    'la view. Todo `ALTER TABLE personas ADD COLUMN` tiene que venir con un re-run de '
    'la PARTE 1 de este archivo, si no la columna nueva queda invisible para RRHH sin '
    'un solo error. Ver sql/personas_publicas.sql (T4.7).';

REVOKE ALL ON public.personas_legajo FROM PUBLIC, anon;
GRANT SELECT ON public.personas_legajo TO authenticated;

DO $$
DECLARE v_anon boolean; v_auth boolean; v_invoker text;
BEGIN
    v_anon := has_table_privilege('anon', 'public.personas_legajo', 'SELECT');
    v_auth := has_table_privilege('authenticated', 'public.personas_legajo', 'SELECT');
    IF v_anon THEN RAISE EXCEPTION 'personas_legajo quedó legible por anon'; END IF;
    IF NOT v_auth THEN RAISE EXCEPTION 'authenticated no puede leer personas_legajo'; END IF;

    SELECT coalesce((SELECT option_value FROM pg_options_to_table(c.reloptions)
                      WHERE option_name = 'security_invoker'), 'false')
      INTO v_invoker
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'personas_legajo';
    IF v_invoker = 'true' THEN
        RAISE EXCEPTION 'personas_legajo con security_invoker=true → heredaría la RLS abierta de personas y expondría el legajo';
    END IF;

    RAISE NOTICE 'PARTE 1 OK · personas_legajo creada, anon revocado.';
END $$;

COMMIT;


-- ═════════════════════════════════════════════════════════════════════════
-- PARTE 2 · Revocar las columnas sensibles + cerrar la escritura
-- ⚠️ CORRER RECIÉN DESPUÉS DE `~/pull-lobby.sh` (ver ORDEN DE DEPLOY arriba).
--    Descomentar el bloque entero.
-- ═════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--
-- -- ── 2.a · Columnas ──────────────────────────────────────────────────
-- -- Quedan legibles sólo las 9 que necesitan los flujos operativos. Se
-- -- verificó uno por uno que los 8 consumidores de afuera de RRHH y los 8
-- -- embeds usan exclusivamente estas.
-- REVOKE SELECT ON public.personas FROM authenticated, anon, PUBLIC;
-- GRANT SELECT (
--     id, nombre, apellido, telefono, tipo, roles_operativos, rol_legacy,
--     activo, _deleted
-- ) ON public.personas TO authenticated;
--
-- -- Fuera quedan: cuil, dni, documento, direccion, email, contacto,
-- -- cbu_alias, banco, situacion_previsional, contacto_emergencia_nombre,
-- -- contacto_emergencia_telefono, fecha_nacimiento, fecha_ingreso,
-- -- documentacion, notas, profile_id, cantidad_personas, created_at,
-- -- costo_dia_referencial y jornal_diario (los dos últimos son el salario).
--
-- -- ── 2.b · Escritura ─────────────────────────────────────────────────
-- -- La mitad más grave del hallazgo: hoy cualquier autenticado puede
-- -- cambiarle el CBU a un compañero. Postgres no tiene CREATE POLICY IF NOT EXISTS.
-- DROP POLICY IF EXISTS personas_insert ON public.personas;
-- DROP POLICY IF EXISTS personas_update ON public.personas;
--
-- CREATE POLICY personas_insert ON public.personas
--     FOR INSERT TO authenticated WITH CHECK (fn_role_can('rrhh', 'write'));
-- CREATE POLICY personas_update ON public.personas
--     FOR UPDATE TO authenticated USING (fn_role_can('rrhh', 'write'))
--                                 WITH CHECK (fn_role_can('rrhh', 'write'));
--
-- -- `personas_select` NO se toca: queda USING(true) a propósito. La contención
-- -- de este ítem es por columna (2.a), y los embeds necesitan ver las filas.
-- -- `personas_delete` ya está en admin/superadmin.
--
-- DO $$
-- DECLARE v_extra text; v_esc int; v_pol int;
-- BEGIN
--     -- Whitelist, no blacklist: se verifica que lo legible sea EXACTAMENTE la lista
--     -- de 9, en vez de enumerar las prohibidas. Una lista negra sólo protege de las
--     -- columnas que hoy conocemos — la próxima que alguien agregue a `personas`
--     -- pasaría el chequeo sin que nadie se entere.
--     --
--     -- Por `has_column_privilege` y no por `information_schema.column_privileges`:
--     -- esa vista sólo muestra los privilegios otorgados a —o POR— un rol habilitado,
--     -- así que es una foto filtrada por quién pregunta. Hoy pasaría igual (corre como
--     -- postgres, que es el grantor), pero re-corriendo esto desde otro contexto podría
--     -- reportar "limpio" sin serlo. `has_column_privilege` resuelve el ACL de verdad.
--     SELECT string_agg(c.column_name, ', ') INTO v_extra
--       FROM information_schema.columns c
--      WHERE c.table_schema='public' AND c.table_name='personas'
--        AND c.column_name NOT IN ('id','nombre','apellido','telefono','tipo',
--                                  'roles_operativos','rol_legacy','activo','_deleted')
--        AND (has_column_privilege('authenticated','public.personas',c.column_name,'SELECT')
--          OR has_column_privilege('anon','public.personas',c.column_name,'SELECT'));
--     IF v_extra IS NOT NULL THEN
--         RAISE EXCEPTION 'quedaron columnas de más legibles en personas: %', v_extra;
--     END IF;
--
--     -- Exactamente una policy de cada una: dos permisivas se combinan por OR, así que
--     -- una segunda con otra condición abriría por la ventana sin ser literalmente 'true'.
--     SELECT count(*) INTO v_pol FROM pg_policies
--      WHERE tablename='personas' AND cmd IN ('INSERT','UPDATE');
--     IF v_pol <> 2 THEN
--         RAISE EXCEPTION 'personas tiene % policies de escritura, esperaba 2 (1 insert + 1 update)', v_pol;
--     END IF;
--
--     -- Y la escritura quedó cerrada de verdad.
--     SELECT count(*) INTO v_esc FROM pg_policies
--      WHERE tablename='personas' AND cmd IN ('INSERT','UPDATE')
--        AND coalesce(qual, with_check) = 'true';
--     IF v_esc > 0 THEN
--         RAISE EXCEPTION 'quedaron % policies de escritura abiertas en personas', v_esc;
--     END IF;
--
--     RAISE NOTICE 'PARTE 2 OK · columnas sensibles revocadas y escritura cerrada a rrhh.';
-- END $$;
--
-- COMMIT;
--
-- ─── Para volver atrás (si algo operativo se rompe) ──────────────────────
-- GRANT SELECT ON public.personas TO authenticated;
-- DROP POLICY IF EXISTS personas_update ON public.personas;
-- CREATE POLICY personas_update ON public.personas FOR UPDATE TO authenticated USING (true);
-- DROP POLICY IF EXISTS personas_insert ON public.personas;
-- CREATE POLICY personas_insert ON public.personas FOR INSERT TO authenticated WITH CHECK (true);
