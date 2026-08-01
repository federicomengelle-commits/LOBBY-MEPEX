-- =====================================================================
-- T0.8 (parcial) + T0.12 · Índices únicos de comprobantes · search_path
-- Auditoría 2026-07-31 · Automatización 2 / H1 · + hallazgo propio de T0.2
-- =====================================================================
--
-- ── T0.8 · Índices únicos como red fiscal ────────────────────────────
--   Hoy no hay NINGÚN índice único sobre comprobantes más allá de la PK.
--   Nada impide cargar dos veces la misma factura — y de hecho ya pasó.
--
--   ⚠️ VA PARCIAL, A PROPÓSITO. Verificado en prod 2026-08-01:
--        comprobantes (punto_venta, tipo, numero) → sin duplicados ✔
--        comprobantes (cae)                       → sin duplicados ✔
--        comprobantes_recibidos (cuit,tipo,numero)→ **1 duplicado x3**
--
--     El de RECIBIDOS no se puede crear todavía: la factura
--     `27124873091 / factura_a / 00002-00005961` está **3 veces**:
--
--       id dfcf79f7…  2026-06-20 18:11  categoria=servicio  egreso_id=NULL
--       id a91fcaef…  2026-06-20 18:12  categoria=material  egreso_id=NULL
--       id eab7d116…  2026-06-21 02:24  categoria=material  egreso_id=141a2c79…  ← el bueno
--
--     Las tres con el mismo importe (neto 360.000 / IVA 75.600 / total
--     435.600) y cada una con su propio archivo en Storage: son tres
--     intentos de la misma carga por OCR. La tercera es la única con
--     `egreso_id`, o sea la única que generó asiento. Las otras dos son
--     huérfanas contablemente **pero sí entran al Libro IVA Compras**
--     (`v_libro_iva_compras_extendido` lee `comprobantes_recibidos`, no los
--     asientos) → **$151.200 de IVA crédito inventado**, esperando a que
--     alguien arme una DDJJ.
--
--     Es un borrado de datos fiscales → **decisión de Fede** (T5.2). El
--     comando queda escrito abajo, comentado, listo para ejecutar.
--
--   ⚠️ El índice de EMITIDOS incluye `tipo` a propósito: en prod hay dos
--      filas con `numero = '00005-00000002'` y es legítimo (una `factura_b`,
--      otra `nota_credito_b`) — los correlativos de AFIP son por
--      (PtoVta, CbteTipo), no por número solo.
--
-- ── T0.12 · search_path en las 4 SECURITY DEFINER que no lo tenían ───
--   Salió del barrido de T0.2. Una función `SECURITY DEFINER` sin
--   `search_path` fijo corre como owner resolviendo nombres por el
--   search_path del CALLER → quien pueda crear objetos en un schema que
--   quede antes puede hacerle sombra a `profiles`, `proyectos`, `audit_logs`
--   y hacerle ejecutar lo suyo con permisos de owner. Es el warning
--   `function_search_path_mutable` del linter de Supabase.
--
--   Se usa `ALTER FUNCTION … SET` en vez de `CREATE OR REPLACE`: no hay que
--   reescribir ningún cuerpo, así que no hay riesgo de transcribir mal.
--   Verificado que las 4 sólo referencian objetos de `public` (más
--   `auth.uid()`, que va calificado con su schema y resuelve igual).
--   ⚠️ El chequeo que importa acá NO es sólo por tablas: `pgcrypto` y
--   `uuid-ossp` **están instaladas en el schema `extensions`** de este
--   proyecto, así que una llamada sin calificar a `crypt()`, `digest()`,
--   `gen_salt()` o `uuid_generate_v4()` dejaría de resolver al fijar el
--   search_path — y `fn_audit_asientos` es AFTER INSERT/UPDATE/DELETE sobre
--   `asientos`: si revienta, se cae TODO ingreso o egreso que se confirme.
--   Verificado contra prod por regex sobre `pg_get_functiondef` de las 4:
--   ninguna las llama.
--   Se incluye `pg_temp` al final: si no se nombra, Postgres lo busca
--   PRIMERO de forma implícita — nombrarlo último es lo que cierra el
--   shadowing por tabla temporal. Mismo patrón que ya usan
--   `fn_avanzar_rutina` y `siguiente_numero_venta`.
--
-- IDEMPOTENTE: sí. REVERSIBLE: sí, ver el pie.
-- NO REQUIERE JS. NO REQUIERE DEPLOY.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- T0.8 · Índices únicos de comprobantes EMITIDOS
-- ---------------------------------------------------------------------
-- Correlativo AFIP: único por (punto de venta, tipo de comprobante, número).
CREATE UNIQUE INDEX IF NOT EXISTS ux_comprobantes_pv_tipo_numero
    ON public.comprobantes (punto_venta, tipo, numero)
    WHERE _deleted = false;

-- El CAE lo emite ARCA y es único por comprobante en todo el país.
-- Dos filas con el mismo CAE = la misma factura cargada dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS ux_comprobantes_cae
    ON public.comprobantes (cae)
    WHERE cae IS NOT NULL;

-- ---------------------------------------------------------------------
-- T0.12 · search_path fijo
-- ---------------------------------------------------------------------
ALTER FUNCTION public.handle_new_user()                          SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.fn_audit_asientos()                        SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.trigger_log_proyecto_actividad()           SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.trigger_cotizacion_aprobada_crea_proyecto() SET search_path TO 'public', 'pg_temp';

-- Auto-verificación: que no quede ninguna SECURITY DEFINER sin search_path.
DO $$
DECLARE n int; faltan text;
BEGIN
    -- Se mira que TENGA search_path, no que `proconfig` sea NULL: proconfig es
    -- el array de todos los SET de la función, así que una con
    -- `statement_timeout` pero sin search_path pasaría el chequeo ingenuo.
    SELECT count(*), COALESCE(string_agg(p.proname, ', '), '')
      INTO n, faltan
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.prosecdef
       AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c
                        WHERE c LIKE 'search\_path=%');
    IF n <> 0 THEN
        RAISE EXCEPTION 'T0.12: quedaron % SECURITY DEFINER sin search_path: %', n, faltan;
    END IF;
    RAISE NOTICE 'T0.12 OK: 0 SECURITY DEFINER sin search_path.';
END $$;

COMMIT;

-- =====================================================================
-- ⛔ PENDIENTE DE FEDE · T5.2 → después el índice de RECIBIDOS
-- =====================================================================
-- PASO 1 · Mirar los tres y confirmar cuál se queda (el que tiene egreso):
--
-- SELECT id, created_at, categoria, egreso_id, archivo_url
--   FROM comprobantes_recibidos
--  WHERE cuit = '27124873091' AND numero = '00002-00005961'
--    AND NOT COALESCE(_deleted, false)
--  ORDER BY created_at;
--
-- PASO 2 · Soft-delete de los DOS huérfanos (reversible: es `_deleted`, no
--          un DELETE físico; para volver atrás, `SET _deleted = false`):
--
-- UPDATE comprobantes_recibidos SET _deleted = true
--  WHERE id IN ('dfcf79f7-a605-4696-8ccf-bb985753c333',
--               'a91fcaef-6aed-48d4-acd4-bfc045bc2b75');
--
-- PASO 3 · Recién ahí, el índice único de recibidos.
--          Va por CUIT y NO por proveedor_id: los 5 comprobantes vivos
--          tienen `proveedor_id` en NULL, así que un índice por proveedor
--          no restringiría nada.
--
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_comprobantes_recibidos_cuit_tipo_numero
--     ON public.comprobantes_recibidos (COALESCE(cuit, ''), tipo, numero)
--     WHERE _deleted = false AND numero IS NOT NULL;
--
--   El `COALESCE(cuit,'')` no es cosmético: a diferencia de los emitidos
--   (donde `punto_venta` siempre viene con default), en un recibido cargado a
--   mano o por foto el CUIT puede faltar — y dos NULLs no chocan entre sí en
--   un índice único. Sin el COALESCE, dos comprobantes informales duplicados
--   se colarían igual.
--
-- PASO 4 · Confirmar que el Libro IVA Compras del período bajó $151.200 de
--          crédito fiscal (Contabilidad → Libros IVA → Compras, junio 2026).

-- =====================================================================
-- ROLLBACK de emergencia
-- =====================================================================
-- DROP INDEX IF EXISTS public.ux_comprobantes_pv_tipo_numero;
-- DROP INDEX IF EXISTS public.ux_comprobantes_cae;
-- ALTER FUNCTION public.handle_new_user() RESET search_path;   -- ídem las otras 3
--
-- Si el índice de emitidos empieza a rechazar una carga legítima, el
-- síntoma es un error 23505 al guardar una factura. Antes de dropearlo,
-- mirar si de verdad es un duplicado: casi siempre lo es.
