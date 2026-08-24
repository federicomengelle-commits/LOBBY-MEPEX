-- ═══════════════════════════════════════════════════════════════════════════
--  H7 · UNA NOTA DE CRÉDITO TIENE QUE ANULAR SU FACTURA
--  Fecha: 2026-08-24
--
--  EL BUG, con los números de prod:
--  el cliente 82322a7a tiene una FC B de $1.000 (21/6) y su NC B que la anula
--  (22/6). Hoy `v_saldo_comprobante` devuelve la factura con **saldo $1.000 y
--  estado 'pendiente'**, o sea COBRABLE, y la NC con saldo −$1.000. Como
--  `API.getSaldosComprobantesPorCliente` filtra `.gt('saldo', 0.01)`, la
--  pantalla de cobranza muestra la factura entera y **la NC en ningún lado**:
--  se le puede registrar un cobro a una factura anulada.
--
--  ⚠️ LO QUE SE CREÍA Y NO ERA. `PENDIENTES.md` §H7 proponía mostrar la NC en
--  la grilla "para que se aplique como cualquier otro movimiento". Eso NO cierra
--  el agujero, por dos razones que aparecieron al leer el código:
--    (a) aplicarle un cobro a una NC no significa nada — una NC no se cobra,
--        descuenta;
--    (b) el candado de `cobranza.js:682-690` re-lee con `soloPendientes:false`
--        —o sea que SÍ ve la NC— pero compara **factura por factura**
--        (`aplicado <= saldo de esa factura`). Una factura anulada conserva su
--        saldo intacto, así que el candado la deja cobrar igual.
--  El arreglo tiene que estar en el SALDO de la factura, no en la grilla.
--
--  ★ POR QUÉ ESTO SALE BARATO: EL SISTEMA YA SABE CUÁL FACTURA ANULA CADA NC.
--  El wizard de emisión pide el comprobante asociado y **es obligatorio**
--  (`finanzas.js:7430`, validado en `:7937`), lo resuelve a un UUID local
--  (`d.cbte_asoc_id`), arma con él el `CbtesAsoc` que exige AFIP… y
--  `_buildComprobanteRecord` (`finanzas.js:8458`) **no lo guarda**. Verificado
--  en prod: el `lapyme_response` de la única NC no tiene `CbtesAsoc` por ningún
--  lado. O sea que no hay que pedirle nada nuevo al usuario ni cambiar el flujo:
--  el dato ya está en la mano, validado, y se descarta.
--
--  QUÉ HACE ESTE ARCHIVO
--    1. Columna `comprobantes.comprobante_asociado_id` (auto-FK) + índice.
--    2. Backfill de la única NC existente. Es inequívoco: ese cliente tiene
--       exactamente 2 comprobantes (FC B del 21/6 y NC B del 22/6, mismo
--       importe), verificado el 24/8.
--    3. `v_saldo_comprobante` netea: la factura descuenta las NC que la apuntan,
--       y una NC ya imputada pasa a saldo 0 para no restar dos veces en el total
--       del cliente. Una NC SIN asociar conserva su saldo negativo — es un
--       crédito flotante del cliente, que es lo que realmente es.
--
--  ⚠️ EL CANDADO Y LA GRILLA SE ARREGLAN SOLOS, sin tocar `cobranza.js`:
--  con el saldo neteado, una factura anulada queda en 0 → sale del filtro
--  `> 0.01` (no se ofrece) y el candado rechaza cualquier aplicación > 0.
--  Una NC parcial deja la factura con su saldo remanente, que es cobrable y
--  correcto.
--
--  ⚠️ REGLAS HEREDADAS de `sql/auditoria_t4_5_signo_nota_credito.sql`, que hay
--  que respetar sí o sí:
--    · `CREATE OR REPLACE`, **NUNCA `DROP`**: preserva los grants, y el
--      `pg_default_acl` de public sigue abierto a `anon` (T0.11) → una view
--      recreada con DROP nacería con SELECT para anon, reabriendo el agujero
--      que se cerró el 26/07.
--    · Por lo mismo, las columnas nuevas van **al final**: CREATE OR REPLACE no
--      admite reordenar ni cambiar tipos de las existentes.
--    · `security_invoker = true` se re-declara explícito. Sin eso la view
--      bypassea el RLS del que consulta.
--
--  ★ SEGUNDO AGUJERO, ENCONTRADO DE PASO Y CERRADO ACÁ MISMO: la view no
--  miraba `comprobantes.estado`. Un intento FALLIDO de emisión se registra como
--  fila con `estado='error'` (finanzas.js:8210) conservando total y cliente →
--  **la grilla de cobranza lo ofrecía como una factura cobrable**. No hay ninguno
--  hoy, pero se produce solo: cada caída de ARCA deja uno (el 16/7 fallaron todos
--  los POST a /api/ durante horas). Los estados `anulada` y `pendiente` del CHECK
--  tenían el mismo problema. Ahora sólo `emitida` es cobrable.
--
--  NO TOCA CONTABILIDAD: una factura emitida no genera asiento (el asiento nace
--  del cobro), así que esto no mueve ni un peso de la partida doble.
--
--  IDEMPOTENTE.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · La columna que faltaba ─────────────────────────────────────────────
ALTER TABLE public.comprobantes
    ADD COLUMN IF NOT EXISTS comprobante_asociado_id UUID
    REFERENCES public.comprobantes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.comprobantes.comprobante_asociado_id IS
    'Sólo NC/ND: la factura que este comprobante ajusta. Es el mismo dato que '
    'el wizard ya exige para armar el CbtesAsoc de AFIP y que hasta el 2026-08-24 '
    'se descartaba. Lo usa v_saldo_comprobante para netear.';

CREATE INDEX IF NOT EXISTS idx_comprobantes_asociado
    ON public.comprobantes(comprobante_asociado_id)
    WHERE comprobante_asociado_id IS NOT NULL;

-- ── 2 · Backfill de las NC que ya existen ──────────────────────────────────
-- Sólo cuando el candidato es ÚNICO e inequívoco: misma letra, mismo cliente,
-- mismo importe, fecha anterior o igual, y una sola factura que cumpla todo.
-- Si mañana hay ambigüedad, esta NC simplemente no se ata y queda como crédito
-- flotante — que es el comportamiento seguro, no uno inventado.
-- Sólo se ata cuando el match es 1-a-1 en LOS DOS SENTIDOS:
--   · una sola factura candidata para esta NC, y
--   · esa factura no está siendo reclamada por ninguna otra NC del lote.
-- ⚠️ El segundo candado no es paranoia: un UPDATE evalúa TODAS sus filas contra
-- el mismo snapshot (MVCC), así que sin él dos NC gemelas del mismo cliente,
-- mismo importe y misma letra verían cada una "hay exactamente 1 candidata" y
-- se atarían LAS DOS a la misma factura. La factura quedaría bien (no cobrable),
-- pero el crédito de la NC sobrante desaparecería en silencio: pasa a la rama
-- "atada" → saldo 0, en vez de quedar como crédito flotante del cliente.
-- Es la misma trampa que ya mordió el 2026-08-06 ("una CTE ve la foto del inicio
-- de la sentencia"), y el archivo se declara idempotente justamente para poder
-- re-correrse con más historia cargada, que es cuando esto se activa.
--
-- ⚠️ `fn_signo_comprobante > 0` NO alcanza para decir "es una factura": una
-- nota de DÉBITO también da +1. Sin el `LIKE 'factura%'`, una ND del mismo
-- cliente/importe/letra podía quedar como la "única candidata" de una NC.
WITH candidatas AS (
    SELECT nc.id AS nc_id,
           (SELECT f.id FROM public.comprobantes f
             WHERE f._deleted = FALSE
               AND f.tipo LIKE 'factura%'
               AND f.cliente_id = nc.cliente_id
               AND f.total      = nc.total
               AND f.fecha     <= nc.fecha
               AND right(f.tipo, 2) = right(nc.tipo, 2)   -- factura_b <-> nota_credito_b
             LIMIT 1) AS factura_id,
           (SELECT count(*) FROM public.comprobantes f2
             WHERE f2._deleted = FALSE
               AND f2.tipo LIKE 'factura%'
               AND f2.cliente_id = nc.cliente_id
               AND f2.total      = nc.total
               AND f2.fecha     <= nc.fecha
               AND right(f2.tipo, 2) = right(nc.tipo, 2)) AS n_facturas
      FROM public.comprobantes nc
     WHERE nc._deleted = FALSE
       AND fn_signo_comprobante(nc.tipo) < 0
       AND nc.comprobante_asociado_id IS NULL
), unicas AS (
    SELECT nc_id, factura_id
      FROM candidatas
     WHERE n_facturas = 1 AND factura_id IS NOT NULL
       -- ...y esa factura no la reclama ninguna otra NC de este mismo lote:
       AND factura_id NOT IN (
           SELECT factura_id FROM candidatas
            WHERE n_facturas = 1 AND factura_id IS NOT NULL
            GROUP BY factura_id HAVING count(*) > 1)
)
UPDATE public.comprobantes nc
SET comprobante_asociado_id = u.factura_id
FROM unicas u
WHERE nc.id = u.nc_id;

-- ── 2.bis · La foto de ANTES, para poder afirmar que el total no se movió ──
-- Netear REPARTE el saldo entre la factura y su nota; no crea ni destruye plata.
-- El invariante se mide sobre los comprobantes EMITIDOS: los que están en
-- 'error' sí pierden su saldo a propósito (dejan de ser facturas fantasma), así
-- que incluirlos haría fallar una aserción que en realidad está bien.
CREATE TEMP TABLE _h7_antes ON COMMIT DROP AS
SELECT COALESCE(sum(v.saldo), 0) AS total
  FROM v_saldo_comprobante v
  JOIN comprobantes c ON c.id = v.comprobante_id
 WHERE c.estado = 'emitida';

-- ── 3 · La view que netea ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_saldo_comprobante
WITH (security_invoker = true) AS
SELECT
    c.id                                                   AS comprobante_id,
    c.fecha,
    c.tipo,
    c.cliente_id,
    c.proyecto_id,
    (c.total * fn_signo_comprobante(c.tipo)::numeric)::numeric(15,2) AS total,
    COALESCE(sum(ca.monto_aplicado), 0::numeric)           AS total_cobrado,

    -- SALDO NETO. Tres casos, y el del medio es el que arregla H7:
    --   · NC ya imputada a su factura  → 0 (su efecto vive en el saldo de la
    --     factura; contarlo acá también lo restaría dos veces del cliente)
    --   · NC suelta                    → negativo: es un crédito flotante
    --   · factura                      → total − cobrado − NC que la apuntan
    CASE
        -- Sólo un comprobante EMITIDO es cobrable. Un intento fallido de emisión
        -- queda como fila con `estado='error'` (finanzas.js:8210) con su total y su
        -- cliente, y hasta hoy la grilla de cobranza lo ofrecía como si fuera una
        -- factura: cada caída de ARCA dejaba una factura fantasma cobrable. Se
        -- compara por IGUALDAD y no enumerando los malos, para que un estado nuevo
        -- nazca del lado seguro.
        WHEN c.estado IS DISTINCT FROM 'emitida' THEN 0::numeric
        WHEN fn_signo_comprobante(c.tipo) < 0 AND c.comprobante_asociado_id IS NOT NULL
            THEN 0::numeric
        WHEN fn_signo_comprobante(c.tipo) < 0
            THEN c.total * fn_signo_comprobante(c.tipo)::numeric
                 - COALESCE(sum(ca.monto_aplicado), 0::numeric)
        ELSE c.total
             - COALESCE(sum(ca.monto_aplicado), 0::numeric)
             - COALESCE((SELECT sum(n.total) FROM public.comprobantes n
                         WHERE n.comprobante_asociado_id = c.id
                           AND n._deleted = FALSE
                           AND n.estado = 'emitida'
                           AND fn_signo_comprobante(n.tipo) < 0), 0::numeric)
    END                                                    AS saldo,

    CASE
        WHEN c.estado IS DISTINCT FROM 'emitida' THEN 'no_vigente'::text
        WHEN fn_signo_comprobante(c.tipo) < 0 THEN 'nota_credito'::text
        -- 'anulada_nc' es un estado NUEVO. Se agrega, no reemplaza a ninguno:
        -- verificado el 24/8 que ningún JS lee esta columna todavía.
        WHEN COALESCE((SELECT sum(n.total) FROM public.comprobantes n
                       WHERE n.comprobante_asociado_id = c.id AND n._deleted = FALSE
                         AND n.estado = 'emitida'
                         AND fn_signo_comprobante(n.tipo) < 0), 0::numeric)
             >= c.total - 0.01
            THEN 'anulada_nc'::text
        WHEN COALESCE(sum(ca.monto_aplicado), 0::numeric)
             >= (c.total - COALESCE((SELECT sum(n.total) FROM public.comprobantes n
                                     WHERE n.comprobante_asociado_id = c.id AND n._deleted = FALSE
                                       AND n.estado = 'emitida'
                                       AND fn_signo_comprobante(n.tipo) < 0), 0::numeric)) - 0.01
            THEN 'cobrada'::text
        WHEN COALESCE(sum(ca.monto_aplicado), 0::numeric) > 0.01 THEN 'parcial'::text
        ELSE 'pendiente'::text
    END                                                    AS estado_cobranza,

    c.canal,
    c.estado                                               AS estado_comprobante,
    fn_signo_comprobante(c.tipo)                           AS signo,
    -- ── columnas nuevas, al final (CREATE OR REPLACE no admite otra cosa) ──
    c.comprobante_asociado_id,
    COALESCE((SELECT sum(n.total) FROM public.comprobantes n
              WHERE n.comprobante_asociado_id = c.id
                AND n._deleted = FALSE
                AND n.estado = 'emitida'
                AND fn_signo_comprobante(n.tipo) < 0), 0::numeric)::numeric(15,2) AS nc_aplicada
FROM public.comprobantes c
LEFT JOIN public.cobro_aplicaciones ca
       ON ca.comprobante_id = c.id AND ca._deleted = FALSE
WHERE c._deleted = FALSE
GROUP BY c.id, c.fecha, c.tipo, c.cliente_id, c.proyecto_id, c.total, c.canal,
         c.estado, c.comprobante_asociado_id;

-- ── 4 · La red: un vínculo imposible de escribir mal ───────────────────────
-- ⚠️ POR QUÉ ESTE TRIGGER EXISTE, Y POR QUÉ VA EN EL MISMO ARCHIVO QUE LA VIEW.
-- El combo "Comprobante asociado" del wizard se arma sobre `_factEmitidos`
-- (finanzas.js:9036), que es el caché de TODOS los comprobantes emitidos de
-- TODOS los clientes, y filtra sólo por tipo/estado/CAE — ni siquiera se
-- re-renderiza al cambiar el cliente (finanzas.js:7897). Hasta hoy elegir mal
-- ahí era inofensivo porque el dato se descartaba. **Desde que esta view usa
-- `comprobante_asociado_id` para bajar el saldo, un solo click equivocado
-- dejaría la factura de OTRO cliente en $0, sin un error ni un aviso.**
-- El filtro del combo se corrige en el JS (mismo commit), pero eso es la puerta;
-- esto es la cerradura: ningún flujo —importador, carga masiva, agente, SQL a
-- mano— puede escribir un vínculo inválido.
CREATE OR REPLACE FUNCTION public.fn_validar_comprobante_asociado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_tipo TEXT; v_cliente UUID;
BEGIN
    IF NEW.comprobante_asociado_id IS NULL THEN RETURN NEW; END IF;

    IF NEW.comprobante_asociado_id = NEW.id THEN
        RAISE EXCEPTION 'Un comprobante no puede ajustarse a sí mismo.';
    END IF;

    SELECT tipo, cliente_id INTO v_tipo, v_cliente
      FROM public.comprobantes WHERE id = NEW.comprobante_asociado_id;

    IF v_tipo IS NULL THEN
        RAISE EXCEPTION 'El comprobante asociado % no existe.', NEW.comprobante_asociado_id;
    END IF;

    -- Sólo se ajusta una FACTURA. Una nota de débito también tiene signo +1,
    -- así que el signo por sí solo no alcanza; y encadenar NC→NC daría una NC
    -- con saldo 0 sin haber anulado ninguna factura real.
    IF v_tipo NOT LIKE 'factura%' THEN
        RAISE EXCEPTION 'Una nota sólo puede ajustar una factura (el asociado es %).', v_tipo;
    END IF;

    -- Y sobre todo: tienen que ser del mismo cliente. Si a alguno le falta el
    -- cliente (comprobante a consumidor final por CUIT suelto) no se puede
    -- afirmar que esté mal, así que se deja pasar en vez de inventar una regla.
    IF NEW.cliente_id IS NOT NULL AND v_cliente IS NOT NULL
       AND NEW.cliente_id <> v_cliente THEN
        RAISE EXCEPTION 'La nota es de un cliente y la factura que ajusta es de otro.';
    END IF;

    RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_validar_comprobante_asociado ON public.comprobantes;
CREATE TRIGGER trg_validar_comprobante_asociado
    BEFORE INSERT OR UPDATE OF comprobante_asociado_id ON public.comprobantes
    FOR EACH ROW EXECUTE FUNCTION public.fn_validar_comprobante_asociado();

-- ── SELF-AUDIT ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_col INT; v_link INT; v_anuladas INT; v_neto NUMERIC; v_antes NUMERIC; v_anon INT;
BEGIN
    SELECT count(*) INTO v_col FROM information_schema.columns
     WHERE table_schema='public' AND table_name='comprobantes'
       AND column_name='comprobante_asociado_id';
    IF v_col <> 1 THEN RAISE EXCEPTION 'Falta la columna comprobante_asociado_id.'; END IF;

    -- Toda NC viva tiene que haber quedado atada, o quedar explícitamente suelta.
    SELECT count(*) INTO v_link FROM comprobantes
     WHERE _deleted=FALSE AND fn_signo_comprobante(tipo) < 0
       AND comprobante_asociado_id IS NOT NULL;
    RAISE NOTICE 'Notas de credito atadas a su factura: %', v_link;

    -- El arreglo, medido: facturas que quedaron anuladas por una NC.
    SELECT count(*) INTO v_anuladas FROM v_saldo_comprobante WHERE estado_cobranza='anulada_nc';
    RAISE NOTICE 'Facturas anuladas por nota de credito: %', v_anuladas;

    -- Y lo que importa: ninguna factura anulada puede seguir siendo cobrable.
    IF EXISTS (SELECT 1 FROM v_saldo_comprobante
               WHERE estado_cobranza='anulada_nc' AND saldo > 0.01) THEN
        RAISE EXCEPTION 'Hay una factura anulada por NC que sigue con saldo cobrable. Abortado.';
    END IF;

    -- Ningún comprobante que no esté emitido puede ser cobrable.
    IF EXISTS (SELECT 1 FROM v_saldo_comprobante v JOIN comprobantes c ON c.id=v.comprobante_id
               WHERE c.estado IS DISTINCT FROM 'emitida' AND v.saldo > 0.01) THEN
        RAISE EXCEPTION 'Hay un comprobante no emitido con saldo cobrable. Abortado.';
    END IF;

    -- El total NO puede haberse movido: netear reparte, no crea ni borra plata.
    -- Es una aserción, no un NOTICE: si algún día alguien toca una rama del CASE
    -- sin tocar la otra, esto lo caza en el momento en vez de dejar el descuadre.
    SELECT COALESCE(sum(v.saldo),0) INTO v_neto
      FROM v_saldo_comprobante v JOIN comprobantes c ON c.id=v.comprobante_id
     WHERE c.estado='emitida';
    SELECT total INTO v_antes FROM _h7_antes;
    IF abs(v_neto - v_antes) > 0.01 THEN
        RAISE EXCEPTION 'El saldo total de los emitidos cambio de % a %. Netear no puede mover plata. Abortado.',
              v_antes, v_neto;
    END IF;
    RAISE NOTICE 'Saldo neto de los emitidos: % (sin cambios, correcto)', v_neto;

    -- La regla del 26/07: anon no lee esta view.
    SELECT count(*) INTO v_anon FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='v_saldo_comprobante'
       AND grantee IN ('anon','public') AND privilege_type='SELECT';
    IF v_anon > 0 THEN RAISE EXCEPTION 'anon recupero SELECT sobre v_saldo_comprobante. Abortado.'; END IF;

    RAISE NOTICE 'OK: H7 aplicado.';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ El rollback CONSERVA las 14 columnas y revierte sólo la LÓGICA de `saldo`
-- y `estado_cobranza`. No es una elección estética: `CREATE OR REPLACE VIEW` **no
-- puede eliminar columnas**, así que un rollback que volviera a las 12 originales
-- fallaría con "cannot drop columns from view" — y la única salida sería `DROP`,
-- que es justo lo que no se puede hacer acá (reabre el SELECT de anon, ver arriba).
-- La columna de la tabla se deja: es aditiva, nadie más la lee, y dropearla
-- perdería el vínculo backfilleado.
--
-- BEGIN;
-- CREATE OR REPLACE VIEW public.v_saldo_comprobante
-- WITH (security_invoker = true) AS
-- SELECT c.id AS comprobante_id, c.fecha, c.tipo, c.cliente_id, c.proyecto_id,
--        (c.total * fn_signo_comprobante(c.tipo)::numeric)::numeric(15,2) AS total,
--        COALESCE(sum(ca.monto_aplicado), 0::numeric) AS total_cobrado,
--        c.total * fn_signo_comprobante(c.tipo)::numeric
--          - COALESCE(sum(ca.monto_aplicado), 0::numeric) AS saldo,
--        CASE WHEN fn_signo_comprobante(c.tipo) < 0 THEN 'nota_credito'::text
--             WHEN COALESCE(sum(ca.monto_aplicado), 0::numeric) >= (c.total - 0.01) THEN 'cobrada'::text
--             WHEN COALESCE(sum(ca.monto_aplicado), 0::numeric) > 0.01 THEN 'parcial'::text
--             ELSE 'pendiente'::text END AS estado_cobranza,
--        c.canal, c.estado AS estado_comprobante, fn_signo_comprobante(c.tipo) AS signo,
--        c.comprobante_asociado_id,                      -- se conservan (ver arriba)
--        0::numeric(15,2) AS nc_aplicada                 -- neutralizada
--   FROM public.comprobantes c
--   LEFT JOIN public.cobro_aplicaciones ca ON ca.comprobante_id = c.id AND ca._deleted = false
--  WHERE c._deleted = false
--  GROUP BY c.id, c.fecha, c.tipo, c.cliente_id, c.proyecto_id, c.total, c.canal,
--           c.estado, c.comprobante_asociado_id;
-- COMMIT;
