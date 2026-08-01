-- =====================================================================
-- T0.1 · Cerrar las RPC SECURITY DEFINER expuestas a anónimos
-- Auditoría 2026-07-31 · hallazgos C9 / A27
-- =====================================================================
--
-- PROBLEMA
--   PostgREST publica toda función del schema `public` que no devuelva
--   `trigger`. Y en este proyecto TODA función nueva nace con EXECUTE
--   concedido a `anon` (ver §4: está en `pg_default_acl`). Resultado: con la
--   anon key —que vive en config.js, o sea es pública por diseño— cualquiera
--   podía llamar 13 funciones SECURITY DEFINER, que corren como owner y por
--   definición saltean RLS.
--
--   Verificado en prod 2026-08-01: de 14 funciones SECURITY DEFINER
--   invocables, 13 tenían `anon=X`. La única con el REVOKE era
--   `siguiente_numero_venta` (la única escrita después de que se documentara
--   la lección, 2026-07-28).
--
--   Las dos peores:
--     · ajustar_stock(text,bigint,numeric) → un anónimo movía el stock de
--       cualquier insumo o item de catálogo. Sin sesión, sin traza.
--     · fn_avanzar_rutina(uuid,date) → su guard arranca con
--       `auth.uid() IS NULL` para dejar pasar a la consola/service_role,
--       pero un anónimo TAMBIÉN cumple esa condición → pasaba de largo.
--
-- QUÉ HACE ESTE ARCHIVO
--   1. REVOKE ALL … FROM PUBLIC, anon en las 12 funciones invocables.
--   2. Guard de rol adentro de `ajustar_stock`.
--   3. Cierra el bypass de anon en `fn_avanzar_rutina`.
--   4. Corta la CAUSA RAÍZ: el default privilege que reconcede EXECUTE a
--      `anon` en cada función nueva.
--
-- QUÉ *NO* TOCA — y por qué
--   · fn_encuesta_publica_get / fn_encuesta_publica_responder: son públicas
--     A PROPÓSITO. `encuesta.html` es la página sin login que responde el
--     cliente. Son las únicas dos RPC que llama un anónimo en todo el sistema
--     (verificado por grep de `.rpc(` sobre el repo entero).
--   · Las 9 funciones SECURITY DEFINER que devuelven `trigger`
--     (fn_audit_asientos, fn_profiles_guard, fn_tareas_*, handle_new_user,
--     trigger_*). PostgREST filtra por `pg_get_function_result(oid) <>
--     'trigger'` en su introspección → no hay ruta HTTP hacia ellas pase lo
--     que pase con el ACL. Además, disparar un trigger no chequea EXECUTE.
--     Revocarlas no cierra nada y sí toca el camino por el que se disparan.
--   · El default privilege de TABLAS/VIEWS (`pg_default_acl` tipo 'r'), que
--     también concede todo a `anon`. Es la razón de fondo del incidente de
--     las 5 views financieras (2026-07-26). Cerrarlo obliga a un GRANT
--     explícito en cada tabla nueva y toca el contrato del Cotizador
--     (`catalogo_items` la lee con la anon key) → decisión aparte, anotada
--     para Fede. Este archivo cierra sólo el de FUNCIONES.
--
-- REVERSIÓN CONSCIENTE QUE HAY QUE SABER
--   `fn_role_can`, `fn_user_role` y `fn_is_admin` tenían el grant a `anon`
--   ESCRITO A MANO, no heredado: `rls_capa2_motor.sql:66-68` y
--   `rls_capa2_roles_profiles.sql:42`, con el comentario "las policies (que
--   corren como el usuario) necesitan poder ejecutar las funciones".
--   El motivo era correcto en general, pero HOY no aplica: se verificó contra
--   prod que ninguna policy cuyos `roles` incluyan `anon` o `public` invoca
--   ninguna de estas funciones (las 14 que alcanzan a anon usan `true`,
--   `auth.uid() = user_id`, un `IN (SELECT …)` sobre profiles, o
--   `bucket_id = 'catalogo'`). Si algún día se escribe una policy `TO public`
--   que llame a `fn_role_can`, hay que devolverle el grant a anon O —mejor—
--   escribir la policy `TO authenticated`.
--
-- VERIFICADO ANTES DE ESCRIBIR ESTO (todo contra prod):
--   · El Cotizador (repo aparte, misma Supabase) usa
--     `siguiente_numero_cotizacion`, que NO es SECURITY DEFINER → intacta.
--   · Matriz `roles` en prod:
--         inventario → admin=write · superadmin=write · pm=read · taller=read
--         compras    → admin=write · superadmin=write · pm=write · taller=∅
--     Por eso el guard de `ajustar_stock` mira LOS DOS módulos (ver §2).
--   · Los cuerpos de `ajustar_stock` y `fn_avanzar_rutina` acá abajo son copia
--     textual de `pg_get_functiondef` de prod salvo el bloque de autorización.
--
-- IDEMPOTENTE: sí. REVOKE/GRANT, CREATE OR REPLACE y ALTER DEFAULT PRIVILEGES
--   se pueden correr N veces. Todo va en una transacción: si una firma no
--   matchea, revierte entero.
--
-- REVERSIBLE: sí, ver el bloque ROLLBACK al pie.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · REVOKE + GRANT explícito · las 12 invocables
-- ---------------------------------------------------------------------
-- El `FROM anon` NO es redundante con el `FROM PUBLIC`: varias de estas
-- tienen grant explícito a anon (heredado del default privilege y/o escrito
-- a mano), que un REVOKE a PUBLIC no toca.
-- El GRANT a authenticated/service_role es explícito a propósito: hoy ya lo
-- tienen, pero así el permiso deja de depender de PUBLIC y queda declarado.
DO $$
DECLARE
    fn text;
    fns text[] := ARRAY[
        'public.ajustar_stock(text,bigint,numeric)',
        'public.fn_avanzar_rutina(uuid,date)',
        'public.fn_is_admin()',
        'public.fn_role_can(text,text)',
        'public.fn_tarea_visible(uuid,uuid,uuid,text)',
        'public.fn_tarea_visible_por_id(uuid)',
        'public.fn_tareas_admin_level()',
        'public.fn_tareas_puede_asignar()',
        'public.fn_user_role()',
        'public.is_admin_or_super()',
        'public.siguiente_numero_venta()',
        'public.user_module_permission(text)'
    ];
BEGIN
    FOREACH fn IN ARRAY fns LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
        RAISE NOTICE 'T0.1 · cerrada a anon: %', fn;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2 · ajustar_stock · guard de rol
-- ---------------------------------------------------------------------
-- Cambio ÚNICO respecto de la versión en prod: el bloque de autorización de
-- arriba. El resto (whitelist de tablas, UPDATE, chequeo de NULL) es copia
-- textual de `sql/inventario_ajustar_stock.sql`.
--
-- ⚠️ EL GUARD MIRA DOS MÓDULOS, NO UNO. La función tiene dos llamadores
--    legítimos y NO comparten permiso:
--      · Inventario → Entrada/Consumo/Transformación  (inventario.js:2448)
--        gateado por el módulo `inventario`
--      · Compras → "Confirmar recepción" de una OC     (compras.js:1764 →
--        API.recibirOrdenCompra → api.js:5137)
--        gateado por el módulo `compras`, que incluye a `pm`
--    Con sólo `inventario:write`, un PM (Meli/Leo) recibiendo mercadería
--    comería un 403 — y `api.js:ajustarStock` tiene un catch-all que lo
--    taparía cayendo al read-modify-write NO atómico, reabriendo en silencio
--    justo la race condition que esta RPC existe para evitar.
--    (Ese catch-all de api.js queda anotado como T3.21 del tracker: acá no se
--    toca JS, y con el guard cubriendo los dos módulos ningún usuario legítimo
--    llega a dispararlo.)
--
-- Por qué `fn_role_can` y no un IN ('admin','superadmin') hardcodeado: es la
-- misma matriz que lee el RLS del resto del sistema (fase 9.bis) y la que
-- edita el Panel de Control. Un rol nuevo con inventario/compras write
-- funciona sin volver a tocar esta función.
CREATE OR REPLACE FUNCTION public.ajustar_stock(p_tabla text, p_id bigint, p_delta numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_stock numeric;
BEGIN
    -- Autorización: la función es SECURITY DEFINER (saltea RLS por diseño,
    -- para que el ajuste sea atómico), así que la validación de permiso tiene
    -- que estar acá adentro. `fn_role_can` ya devuelve false sin sesión.
    --
    -- Sobre `COALESCE(auth.role(), current_user)`: en un request HTTP,
    -- `auth.role()` es el claim del JWT ('anon' | 'authenticated' |
    -- 'service_role') → decide él. Sin request (SQL Editor, psql) devuelve
    -- NULL y cae a `current_user`, que adentro de una SECURITY DEFINER es
    -- SIEMPRE el owner de la función — hoy `postgres` (verificado). O sea:
    -- la rama de escape sólo se alcanza por SQL directo, donde el que corre
    -- ya es superusuario y saltea todo esto igual.
    IF NOT (
        COALESCE(auth.role(), current_user) IN ('service_role', 'postgres', 'supabase_admin')
        OR fn_role_can('inventario', 'write')
        OR fn_role_can('compras', 'write')
    ) THEN
        RAISE EXCEPTION 'ajustar_stock: sin permiso para mover stock'
            USING ERRCODE = '42501';
    END IF;

    -- Whitelist: solo las 2 tablas de stock de inventario.
    IF p_tabla = 'insumos_base' THEN
        UPDATE insumos_base
           SET stock = COALESCE(stock, 0) + p_delta
         WHERE id = p_id
        RETURNING stock INTO v_stock;
    ELSIF p_tabla = 'catalogo_items' THEN
        UPDATE catalogo_items
           SET stock = COALESCE(stock, 0) + p_delta
         WHERE id = p_id
        RETURNING stock INTO v_stock;
    ELSE
        RAISE EXCEPTION 'ajustar_stock: tabla no permitida (%)', p_tabla;
    END IF;

    IF v_stock IS NULL THEN
        RAISE EXCEPTION 'ajustar_stock: id % no encontrado en %', p_id, p_tabla;
    END IF;

    RETURN v_stock;
END;
$function$;

REVOKE ALL ON FUNCTION public.ajustar_stock(text,bigint,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_stock(text,bigint,numeric) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3 · fn_avanzar_rutina · sacar el bypass que cumplía el anónimo
-- ---------------------------------------------------------------------
-- Cambio ÚNICO respecto de prod: `auth.uid() IS NULL` →
-- `COALESCE(auth.role(), current_user) IN (...)`. El resto es copia textual
-- de `sql/reorg_f_rutinas.sql`.
--
-- El original quería decir "contexto privilegiado (consola/service)", pero
-- `auth.uid() IS NULL` también es cierto para un anónimo con la anon key, que
-- así avanzaba cualquier rutina de mantenimiento sin estar logueado.
CREATE OR REPLACE FUNCTION public.fn_avanzar_rutina(p_rutina_id uuid, p_fecha date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r      public.rutinas%ROWTYPE;
  v_role text;
  v_base date;
  v_next date;
  v_done date := COALESCE(p_fecha, current_date);
BEGIN
  SELECT * INTO r FROM public.rutinas WHERE id = p_rutina_id AND NOT _deleted;
  IF NOT FOUND THEN RETURN; END IF;

  -- Autorización: la RPC es SECURITY DEFINER y se concede a todo authenticated,
  -- así que DEBE validar acá que el caller pueda cerrar ESTA rutina (sino
  -- cualquiera avanzaría cualquier rutina, sorteando rutinas_write=admin).
  -- Mismo ruteo que el front (tareas.js _gen.rutinas): admin/superadmin
  -- siempre; el resto sólo la suya (por responsable o por rol).
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF NOT (
       COALESCE(auth.role(), current_user) IN ('service_role', 'postgres', 'supabase_admin')
       OR v_role IN ('admin','superadmin')
       OR (r.responsable_id IS NOT NULL AND r.responsable_id = auth.uid())
       OR (r.target_role  IS NOT NULL AND r.target_role  = v_role)
     ) THEN
    RETURN;  -- no autorizado: no toca nada
  END IF;

  v_base := CASE WHEN r.reprog_desde = 'programada' THEN r.proxima_fecha ELSE v_done END;
  v_next := (CASE r.frecuencia
               WHEN 'mensual'    THEN v_base + interval '1 month'
               WHEN 'trimestral' THEN v_base + interval '3 month'
               WHEN 'semestral'  THEN v_base + interval '6 month'
               WHEN 'anual'      THEN v_base + interval '1 year'
               WHEN 'dias'       THEN v_base + (COALESCE(r.intervalo_dias,30) || ' days')::interval
               ELSE                   v_base + interval '1 month'
             END)::date;

  UPDATE public.rutinas
     SET ultima_ejecucion = v_done, proxima_fecha = v_next, updated_at = now()
   WHERE id = p_rutina_id;

  -- Sello best-effort del activo (ej. produccion_mantenimiento.fecha_proximo_vencimiento
  -- de un vehículo). %I escapa identificadores; id::text = sello_id cubre uuid y
  -- bigint. Nunca rompe el avance.
  IF r.sello_tabla IS NOT NULL AND r.sello_columna IS NOT NULL AND r.sello_id IS NOT NULL THEN
    BEGIN
      EXECUTE format('UPDATE public.%I SET %I = $1 WHERE id::text = $2', r.sello_tabla, r.sello_columna)
        USING v_next, r.sello_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.fn_avanzar_rutina(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_avanzar_rutina(uuid,date) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4 · LA CAUSA RAÍZ · que la próxima función no nazca abierta
-- ---------------------------------------------------------------------
-- Sin esto, los §1-§3 son un parche con fecha de vencimiento: la próxima
-- `CREATE FUNCTION` reabre exactamente el mismo agujero.
--
-- Verificado en prod (`pg_default_acl` en el schema public, objtype 'f'):
--     postgres       → {postgres=X, anon=X, authenticated=X, service_role=X}
--     supabase_admin → {postgres=X, anon=X, authenticated=X, service_role=X}
-- O sea: Supabase dejó configurado que TODA función nueva de `public` reciba
-- EXECUTE para `anon`, sin importar qué GRANT escriba el que la crea.
-- La prueba está en el repo: `fix_rls_profiles.sql:31-45` crea
-- `is_admin_or_super()` concediendo ÚNICAMENTE a `authenticated`… y en prod
-- terminó con `anon=X`. La disciplina manual ya falló 13 de 14 veces.
--
-- Se cambia sólo el default de `postgres`, que es el rol con el que corren
-- TODAS las migraciones de este proyecto (verificado: `current_user`=postgres
-- tanto en el SQL Editor como vía MCP). El de `supabase_admin` sólo aplica a
-- lo que crea Supabase internamente, y no se puede tocar sin ser miembro de
-- ese rol.
--
-- Efecto: una función nueva nace con {postgres=X, authenticated=X,
-- service_role=X} — exactamente la forma de `siguiente_numero_venta`.
-- No toca ninguna función existente.
-- Consecuencia a tener presente: si algún día hace falta otra RPC pública
-- (estilo `fn_encuesta_publica_*`), hay que concederla A MANO:
--     GRANT EXECUTE ON FUNCTION public.mi_funcion(...) TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- (a) Ninguna SECURITY DEFINER invocable con anon, salvo las 2 de la encuesta.
--     Debe devolver CERO filas:
--
-- SELECT p.proname, p.proacl::text
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.prosecdef
--    AND pg_get_function_result(p.oid) <> 'trigger'
--    AND p.proacl::text LIKE '%anon=X%'
--    AND p.proname NOT LIKE 'fn_encuesta_publica%';
--
-- (b) Las 2 públicas siguen abiertas. Debe devolver 2 filas:
--
-- SELECT proname FROM pg_proc WHERE proname LIKE 'fn_encuesta_publica%'
--   AND proacl::text LIKE '%anon=X%';
--
-- (c) El default ya no reparte a anon. La fila de `postgres` no debe tener anon:
--
-- SELECT defaclrole::regrole::text, defaclacl::text
--   FROM pg_default_acl WHERE defaclnamespace='public'::regnamespace AND defaclobjtype='f';
--
-- (d) Smoke con la ANON key — hoy da 200, debe pasar a 403:
--
-- curl -s -o /dev/null -w '%{http_code}\n' \
--   -X POST 'https://selnevalaeykdrgycvdz.supabase.co/rest/v1/rpc/ajustar_stock' \
--   -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>" \
--   -H 'Content-Type: application/json' \
--   -d '{"p_tabla":"insumos_base","p_id":1,"p_delta":0}'
--
-- (e) Smoke con la ANON key sobre la encuesta — debe SEGUIR funcionando:
--     abrir /encuesta.html?t=<token de una encuesta viva> sin login.
--
-- (f) Smoke del Cotizador — sigue leyendo el catálogo con la anon key:
--
-- curl -s 'https://selnevalaeykdrgycvdz.supabase.co/rest/v1/catalogo_items?select=id&limit=1' \
--   -H "apikey: <ANON>"
--
-- (g) Logueado como admin/superadmin, en la consola del navegador — debe
--     devolver el stock sin cambiarlo:
--
-- await supabaseClient.rpc('ajustar_stock',{p_tabla:'insumos_base',p_id:<id>,p_delta:0})
--
-- (h) ⚠️ EL QUE NO PUEDE FALTAR — logueado como un usuario `pm` real:
--     Compras → una OC → "Confirmar recepción". Tiene que sumar el stock
--     igual que antes. Es el único camino que el guard nuevo podría haber
--     roto, y el que `api.js` taparía en silencio.

-- =====================================================================
-- ROLLBACK de emergencia
-- =====================================================================
-- Permisos (por función):
--   GRANT EXECUTE ON FUNCTION public.ajustar_stock(text,bigint,numeric) TO anon;
--   … ídem para las otras 11.
-- Default privilege:
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
-- Cuerpos anteriores, completos y listos para pegar:
--   ajustar_stock      → sql/inventario_ajustar_stock.sql
--   fn_avanzar_rutina  → sql/reorg_f_rutinas.sql
