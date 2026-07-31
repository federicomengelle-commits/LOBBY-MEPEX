-- =====================================================================
-- PROPUESTA — acotar el bucket `comprobantes` a quien ve Finanzas
-- =====================================================================
-- ⚠️ NO CORRER SIN DECIDIRLO. Esto cambia quién puede leer archivos que
-- HOY lee cualquier usuario logueado. Se deja escrito, no aplicado.
--
-- POR QUÉ
-- Las policies vigentes (`sql/fase13_comprobantes_bucket.sql`) dan SELECT e
-- INSERT a CUALQUIER usuario autenticado, con el criterio explícito de que
-- "el front gatea por rol". Eso alcanzaba mientras el bucket sólo tuviera las
-- fotos de comprobantes de compra.
--
-- Desde 2026-07-31 el bucket guarda también los CERTIFICADOS DE RETENCIÓN
-- (`retenciones/<uuid>/certificado.*`, referenciados por
-- `creditos_fiscales.archivo_url`). La RLS de `creditos_fiscales` sí exige
-- `fn_role_can('finanzas'|'contabilidad','read')` — pero esa RLS protege LA
-- FILA, no EL ARCHIVO. Un usuario `taller`/`pm`/`venta`, sin acceso a
-- Finanzas, puede hoy listar el prefijo `retenciones/` con la Storage API
-- desde la consola del browser y firmarse las URLs. Los certificados traen
-- CUIT del cliente e importes retenidos.
--
-- BLAST RADIUS — verificado por grep sobre todo el repo JS
-- Los ÚNICOS lugares que tocan este bucket son de Finanzas (admin-level):
-- `carga-comprobante.js` (subir), `finanzas.js` (subir/leer: comprobantes
-- recibidos + cartera de valores), `cobranza.js` (subir certificado) y
-- `creditos-fiscales.js` (leer). La quick-action `cargar-comprobante` de
-- `data.js` sólo está en las listas de superadmin/admin. Ningún módulo de
-- taller/pm/venta lee ni escribe acá, y el OCR del VPS no toca Storage
-- (recibe y devuelve base64). Acotar no debería romper nada.
--
-- LO QUE HAY QUE DECIDIR
--   (a) Aplicarlo tal cual → el bucket queda para Finanzas/Contabilidad.
--   (b) No aplicarlo y asumir el criterio de Fase 13 para toda la empresa.
--   (c) Acotar sólo el prefijo `retenciones/` y dejar el resto abierto — más
--       quirúrgico, pero deja las facturas de compra igual de abiertas, que
--       es el mismo tipo de dato.
-- Este archivo implementa (a).
--
-- ESTADO DE PROD AL ESCRIBIRLO (2026-07-31, consultado, no asumido)
-- 4 policies sobre `storage.objects` gobiernan este bucket:
-- `comprobantes_select` / `_insert` / `_update` / `_delete`, todas PERMISSIVE
-- y para el rol `authenticated`. Ninguna otra policy de `storage.objects`
-- menciona `comprobantes`.
--
-- POR QUÉ NO SE DROPEA POR NOMBRE LITERAL
-- Si el nombre no matchea, `DROP POLICY IF EXISTS` es un no-op SILENCIOSO, el
-- CREATE agrega la policy restrictiva AL LADO de la vieja, y como las dos son
-- PERMISSIVE Postgres las OR-ea → `bucket_id='comprobantes'` (siempre cierto
-- para este bucket) gana y la condición de rol nunca se evalúa. Correría sin
-- un solo error y quedaría "aplicado" sin aplicar nada. Por eso se descubren
-- las policies por su CONTENIDO, se recrean las CUATRO (así el estado final no
-- depende de lo que hubiera antes), y al cierre hay una aserción que hace
-- ROLLBACK si el resultado no es exactamente el esperado.
--
-- Idempotente y transaccional. Reversible: re-correr
-- `sql/fase13_comprobantes_bucket.sql` restaura las policies abiertas.
-- =====================================================================

BEGIN;

DO $$
DECLARE
    pol record;
    n   integer;
BEGIN
    -- ── 1) Borrar TODA policy que gobierne este bucket, se llame como se llame ──
    -- Se filtra por contenido (`qual` para SELECT/UPDATE/DELETE, `with_check`
    -- para INSERT), no por nombre. `storage.objects` la comparten todos los
    -- buckets, así que una policy de otro bucket no menciona 'comprobantes'.
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename  = 'objects'
          AND (COALESCE(qual, '') LIKE '%''comprobantes''%'
            OR COALESCE(with_check, '') LIKE '%''comprobantes''%')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
        RAISE NOTICE 'Dropeada policy vieja: %', pol.policyname;
    END LOOP;

    -- ── 2) Recrear las CUATRO, para que el estado final sea determinístico ──

    -- SELECT: sólo quien puede leer Finanzas o Contabilidad.
    EXECUTE $q$
        CREATE POLICY "comprobantes_select" ON storage.objects
            FOR SELECT TO authenticated
            USING (
                bucket_id = 'comprobantes'
                AND (public.fn_role_can('finanzas','read') OR public.fn_role_can('contabilidad','read'))
            )
    $q$;

    -- INSERT: sólo quien puede escribir.
    EXECUTE $q$
        CREATE POLICY "comprobantes_insert" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id = 'comprobantes'
                AND (public.fn_role_can('finanzas','write') OR public.fn_role_can('contabilidad','write'))
            )
    $q$;

    -- UPDATE: idem. El WITH CHECK va explícito aunque Postgres reusaría el
    -- USING: la condición no depende de valores que cambien con el UPDATE, pero
    -- escribirlo evita que el próximo que edite este archivo asuma que basta
    -- con el USING cuando sí sean distintos.
    EXECUTE $q$
        CREATE POLICY "comprobantes_update" ON storage.objects
            FOR UPDATE TO authenticated
            USING (
                bucket_id = 'comprobantes'
                AND (public.fn_role_can('finanzas','write') OR public.fn_role_can('contabilidad','write'))
            )
            WITH CHECK (
                bucket_id = 'comprobantes'
                AND (public.fn_role_can('finanzas','write') OR public.fn_role_can('contabilidad','write'))
            )
    $q$;

    -- DELETE: se recrea IDÉNTICA a la de Fase 13, a propósito.
    -- Queda con un modelo distinto al de las otras tres: chequea `profiles.role`
    -- literal en vez de la matriz `fn_role_can`. Es deliberado — el borrado es
    -- el camino más restringido de los cuatro y no debería aflojarse si alguna
    -- vez se le da `finanzas:write` a otro rol desde el Panel. Consecuencia
    -- asumida: ese rol podría subir y leer, pero nunca borrar.
    EXECUTE $q$
        CREATE POLICY "comprobantes_delete" ON storage.objects
            FOR DELETE TO authenticated
            USING (
                bucket_id = 'comprobantes'
                AND auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
            )
    $q$;

    -- ── 3) Aserción: si no quedaron EXACTAMENTE 4, algo más está gobernando
    --        el bucket y la restricción no serviría. Mejor abortar que mentir.
    SELECT count(*) INTO n
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND (COALESCE(qual, '') LIKE '%''comprobantes''%'
        OR COALESCE(with_check, '') LIKE '%''comprobantes''%');

    IF n <> 4 THEN
        RAISE EXCEPTION 'Esperaba 4 policies para el bucket comprobantes y hay %. Se revierte todo.', n;
    END IF;

    RAISE NOTICE 'OK: 4 policies, bucket comprobantes acotado a finanzas/contabilidad.';
END $$;

COMMIT;


-- ─── Verificación sugerida DESPUÉS de correrlo ───
-- 1) Con sesión de Fede (superadmin): Finanzas → Facturación → Recibidos debe
--    seguir mostrando el clip de los adjuntos, y el libro de Créditos
--    fiscales debe seguir abriendo el certificado.
-- 2) Con sesión de alguien de taller, en la consola del browser:
--      await supabaseClient.storage.from('comprobantes').list('retenciones')
--    tiene que devolver vacío o error, NO la lista de archivos.
--    Este es el único paso que distingue "aplicado" de "parece aplicado":
--    el paso 1 pasa igual aunque la restricción no haya quedado activa.
-- =====================================================================
