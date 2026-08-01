-- =====================================================================
-- T0.10 · Las policies abiertas de Storage
-- Auditoría 2026-07-31 · EL CRÍTICO
-- =====================================================================
--
-- PROBLEMA
--   `storage.objects` tiene una policy `allow-service-uploads`:
--       FOR ALL  TO public  USING (true)  WITH CHECK (true)
--   `public` incluye a `anon`. O sea: **con la anon key —que está en
--   config.js, es pública por diseño— cualquiera lee, sube, modifica y borra
--   cualquier archivo de cualquier bucket.**
--
--   Verificado en prod 2026-08-01, con la anon key, sin sesión:
--       POST /storage/v1/object/list/comprobantes    → 5 archivos
--       POST /storage/v1/object/list/remitos         → 3 archivos
--       POST /storage/v1/object/list/stands          → 1 archivo
--       POST /storage/v1/object/list/cotizaciones-pdf→ 25 archivos
--   `comprobantes` son las facturas de proveedores; `remitos`, los remitos
--   firmados. Y no es sólo lectura: la policy es `FOR ALL`, así que también
--   se pueden **borrar**.
--
--   Además, `storage.buckets` tiene otras 3 policies `TO public USING(true)`
--   (`allow-all-updates`, `allow-all-uploads`, `allow-aññ-uploads` — sí, con
--   la ñ) que dejan **crear y modificar buckets** a cualquiera.
--
-- ⚠️ CORRECCIÓN AL PLAN
--   El plan dice "las 4 policies de `storage.objects`". Son 1 en `objects` y
--   3 en `buckets`. Este archivo las trata donde realmente están.
--
-- ⚠️ POR QUÉ NO ALCANZA CON DROPEAR
--   `allow-service-uploads` es hoy lo ÚNICO que hace funcionar 3 buckets que
--   no tienen policies propias:
--       stands            (2 objetos)  → lo usa el LOBBY (stands.js)
--       cotizaciones-pdf  (25 objetos) → lo usa el COTIZADOR (repo aparte)
--       propuestas-pdf    (5 objetos)  → lo usa el COTIZADOR (repo aparte)
--   Dropear sin reponer los deja mudos. Por eso el DROP y los CREATE van en
--   la misma transacción.
--
--   Verificado por grep sobre todo el repo del lobby: sólo referencia
--   `catalogo`, `comprobantes`, `proyecto-fotos`, `remitos` y `stands`.
--   `cotizaciones-pdf` y `propuestas-pdf` NO los toca el lobby → son 100%
--   del Cotizador.
--
-- 🔶 DECISIÓN CONSERVADORA CON LOS 2 BUCKETS DEL COTIZADOR
--   No sé con qué clave sube el Cotizador (es otro repo y no puedo probarlo),
--   y romper la generación de PDFs de presupuestos de un día para el otro es
--   peor que el riesgo residual. Así que a esos dos buckets se les preserva
--   **exactamente** lo que tienen hoy (anon + authenticated, FOR ALL), sólo
--   que acotado a esos dos buckets en vez de a todos.
--   Son buckets `public = true`: cualquiera con la URL ya podía leerlos, así
--   que en confidencialidad no se pierde nada.
--   👉 Apretar esto queda como parte de **T4.8** (coordinar con el repo del
--      Cotizador): averiguar si sube con anon o con service key y, si es
--      service key, sacarle el anon a estas dos policies.
--
-- QUÉ QUEDA CERRADO IGUAL (que es el 90% del riesgo)
--   anon deja de poder tocar `comprobantes`, `remitos`, `stands`,
--   `proyecto-fotos` y de escribir en `catalogo`.
--
-- IDEMPOTENTE: sí. REVERSIBLE: sí, ver el pie.
-- NO REQUIERE JS. NO REQUIERE DEPLOY.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · Reponer PRIMERO lo que hoy depende de la policy abierta
-- ---------------------------------------------------------------------
-- (dentro de la misma transacción el orden da igual, pero se lee mejor así:
--  primero se construye el reemplazo, después se saca el andamio)

-- stands · lo usa el lobby (stands.js). Mismo patrón que `remitos`.
DROP POLICY IF EXISTS stands_select ON storage.objects;
CREATE POLICY stands_select ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'stands');
DROP POLICY IF EXISTS stands_insert ON storage.objects;
CREATE POLICY stands_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'stands');
DROP POLICY IF EXISTS stands_update ON storage.objects;
CREATE POLICY stands_update ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'stands');
DROP POLICY IF EXISTS stands_delete ON storage.objects;
CREATE POLICY stands_delete ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'stands' AND public.fn_is_admin());

-- cotizaciones-pdf y propuestas-pdf · del Cotizador. Se preserva el
-- comportamiento actual tal cual (ver "DECISIÓN CONSERVADORA" arriba).
DROP POLICY IF EXISTS cotizador_pdf_all ON storage.objects;
CREATE POLICY cotizador_pdf_all ON storage.objects
  FOR ALL TO anon, authenticated
  USING      (bucket_id IN ('cotizaciones-pdf', 'propuestas-pdf'))
  WITH CHECK (bucket_id IN ('cotizaciones-pdf', 'propuestas-pdf'));

-- ---------------------------------------------------------------------
-- 2 · Sacar las 4 policies abiertas
-- ---------------------------------------------------------------------
-- storage.objects · la que dejaba a cualquiera hacer cualquier cosa
-- en cualquier bucket.
DROP POLICY IF EXISTS "allow-service-uploads" ON storage.objects;

-- storage.buckets · las que dejaban CREAR y MODIFICAR buckets a cualquiera.
-- Nadie las necesita: no hay ni un `createBucket()` en el código de la app
-- (verificado por grep; los únicos hits son dentro de node_modules). Los
-- buckets se crean desde el Dashboard o con la service key.
DROP POLICY IF EXISTS "allow-all-updates" ON storage.buckets;
DROP POLICY IF EXISTS "allow-all-uploads" ON storage.buckets;
DROP POLICY IF EXISTS "allow-aññ-uploads" ON storage.buckets;

-- ---------------------------------------------------------------------
-- 3 · Que el archivo se audite a sí mismo antes de darse por bueno
-- ---------------------------------------------------------------------
-- `DROP POLICY IF EXISTS` con un nombre que no matchea es un NO-OP SILENCIOSO:
-- la transacción commitea igual, el archivo "corre bien", y el agujero
-- —el crítico de toda la auditoría— sigue abierto. Ojo con
-- `allow-aññ-uploads`, que tiene una ñ en el nombre y viaja por el chat.
-- Si algo no da, esto aborta y revierte TODO.
DO $$
DECLARE n_open int; n_stands int; n_cotiz int;
BEGIN
  SELECT count(*) INTO n_open FROM pg_policies
   WHERE schemaname = 'storage'
     AND ((tablename = 'objects' AND policyname = 'allow-service-uploads')
       OR (tablename = 'buckets' AND policyname IN ('allow-all-updates','allow-all-uploads','allow-aññ-uploads')));
  SELECT count(*) INTO n_stands FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'stands\_%';
  SELECT count(*) INTO n_cotiz FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects' AND policyname='cotizador_pdf_all';

  IF n_open   <> 0 THEN RAISE EXCEPTION 'T0.10: quedaron % policies abiertas sin dropear (¿nombre mal escrito?)', n_open; END IF;
  IF n_stands <> 4 THEN RAISE EXCEPTION 'T0.10: esperaba 4 policies stands_*, hay %', n_stands; END IF;
  IF n_cotiz  <> 1 THEN RAISE EXCEPTION 'T0.10: esperaba 1 policy cotizador_pdf_all, hay %', n_cotiz; END IF;

  RAISE NOTICE 'T0.10 OK: allow-service-uploads + las 3 de buckets fuera; stands_* (4) y cotizador_pdf_all (1) en pie.';
END $$;

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- (a) EL CHEQUEO QUE IMPORTA — con la ANON key, sin sesión.
--     Los tres primeros hoy devuelven archivos; después tienen que dar [].
--     Los dos del Cotizador tienen que SEGUIR devolviendo sus archivos.
--
-- for B in comprobantes remitos stands proyecto-fotos cotizaciones-pdf; do
--   curl -s -X POST "https://selnevalaeykdrgycvdz.supabase.co/storage/v1/object/list/$B" \
--     -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>" \
--     -H 'Content-Type: application/json' -d '{"prefix":"","limit":100}'
-- done
--
-- (b) Ningún bucket queda sin policies (salvo los que no se usan). Y ninguna
--     policy de storage con `USING(true)` a secas:
--
-- SELECT tablename, policyname, roles::text, cmd FROM pg_policies
--  WHERE schemaname='storage' AND COALESCE(qual,with_check,'')='true';
--
-- (c) SMOKE OBLIGATORIO, logueado (lo hace Fede):
--       · Finanzas → subir un comprobante (foto o PDF) → tiene que subir y
--         después poder abrirse desde el clip.
--       · Stands → subir una imagen a un prediseño.
--       · Proyectos → una foto del armado.
--       · Y, del lado del Cotizador: generar un presupuesto y que el PDF
--         quede guardado (es la prueba de que los 2 buckets siguen vivos).

-- =====================================================================
-- ROLLBACK de emergencia
-- =====================================================================
-- Si algo dejó de subir y hay que volver atrás YA:
--   CREATE POLICY "allow-service-uploads" ON storage.objects
--     FOR ALL TO public USING (true) WITH CHECK (true);
-- ⚠️ Eso reabre el agujero entero. Preferible primero mirar QUÉ bucket
--    falló y crearle su policy propia, calcada de las de `stands` de arriba.
-- Las 3 de storage.buckets:
--   CREATE POLICY "allow-all-updates" ON storage.buckets FOR UPDATE TO public USING (true);
--   CREATE POLICY "allow-all-uploads" ON storage.buckets FOR INSERT TO public WITH CHECK (true);
