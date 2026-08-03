-- ═══════════════════════════════════════════════════════════════════════════
--  T4.5 (A2) — El signo de las notas de crédito
--  Auditoría 2026-07-31 · escrito 2026-08-02
-- ═══════════════════════════════════════════════════════════════════════════
--
--  EL BUG, con los números de prod:
--  junio 2026 tiene una FC B de $1.000 (IVA $173,55) y su NC B que la anula
--  (IVA $173,55). `v_posicion_iva_mes` hace `sum(iva)` sin mirar el tipo →
--  devuelve **IVA débito $347,10 cuando la posición real del mes es $0,00**.
--  Una nota de crédito RESTA; hoy suma. Es el único par de comprobantes reales
--  que hay en la base y ya sale mal.
--
--  Y el mismo error tiene una segunda cara en `v_saldo_comprobante`: la NC
--  figura con `saldo = $1.000` y la pantalla de cobranza (`cobranza.js`) la
--  lista como una factura cobrable. Aplicarle un cobro a una nota de crédito
--  mete plata contra un documento que no es un crédito a cobrar.
--
--  LA REGLA, EN UN SOLO LUGAR: `fn_signo_comprobante(tipo)`.
--  Las notas de DÉBITO no entran: aumentan la deuda igual que una factura, así
--  que su signo es +1 (la rama por defecto).
--
--  ⚠️ ESTE ARCHIVO SOLO NO ARREGLA NINGUNA PANTALLA. Lo destapó el sql-reviewer:
--  las tres pantallas donde se ve la Posición IVA —Contabilidad → Libros IVA,
--  Finanzas → Reportes → IVA, y el widget del lobby— **no leen estas views**.
--  Consultan `comprobantes` / `comprobantes_recibidos` directo y suman en el
--  cliente; `API.getPosicionIvaMes` y `getLibroIvaComprasExtendido`, que sí las
--  leen, **no tienen ningún caller** (código muerto). Correr sólo este SQL
--  habría dado "self-audit OK" dejando los $347,10 intactos en pantalla.
--  Por eso va junto con `window.signoComprobante()` (components.js) aplicado en
--  los ~12 puntos del JS que suman comprobantes. **Los dos, o ninguno.**
--
--  ⚠️ POR QUÉ TAMBIÉN SE FIRMA EL LADO DE COMPRAS, que el plan no pedía:
--  `v_posicion_iva_mes` es **débito − crédito**, y el crédito sale de
--  `v_libro_iva_compras_extendido`. Firmar sólo el débito dejaría los dos lados
--  de la misma resta con reglas distintas — exactamente el error que ya se
--  cometió en T3.24 ("convertir la mitad de una comparación es peor que no
--  convertir nada"). Hoy no hay ninguna NC de proveedor cargada (los 5
--  comprobantes recibidos son factura_a), así que el cambio no mueve ningún
--  número: entra como red para la primera que llegue. La rama 'virtual' del
--  libro (comprobantes_iva_recovery) hardcodea `tipo='factura'` → signo +1
--  siempre, no hace falta tocarla.
--
--  ⚠️ POR QUÉ LAS TRES VIEWS VAN CON `CREATE OR REPLACE` Y NINGUNA CON DROP:
--  `CREATE OR REPLACE` preserva los grants; `DROP` + `CREATE` no. Y el
--  `pg_default_acl` de TABLAS/VIEWS del schema `public` sigue abierto a `anon`
--  (es T0.11, pendiente de decisión de Fede) → una view recreada con DROP
--  nacería con **SELECT para anon**, reabriendo en silencio justo el agujero
--  que se cerró el 26/07 (las 5 views financieras le contestaban a cualquier
--  anónimo). Por eso, además, el self-audit del final verifica que anon siga
--  sin SELECT en las tres.
--  Por lo mismo `signo` se agrega como **última** columna de
--  `v_saldo_comprobante`: CREATE OR REPLACE sólo admite columnas nuevas al
--  final.
--
--  ⚠️ `security_invoker = true` se re-declara explícito en las tres. Sin eso la
--  view bypassea el RLS del que consulta (fue el incidente del 26/07).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) La regla, en un solo lugar
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_signo_comprobante(p_tipo TEXT)
RETURNS SMALLINT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
    -- 'nota_credito', 'nota_credito_a', 'nota_credito_b', 'nota_credito_c'…
    -- Las notas de DÉBITO caen en la rama por defecto (+1): suman, no restan.
    SELECT (CASE WHEN COALESCE(p_tipo, '') LIKE 'nota_credito%' THEN -1 ELSE 1 END)::SMALLINT;
$$;

COMMENT ON FUNCTION public.fn_signo_comprobante(TEXT) IS
  'T4.5: +1 para facturas y notas de débito, -1 para notas de crédito. Única definición del signo del lado SQL; su espejo en el cliente es window.signoComprobante() de components.js. Si cambia una, cambia la otra.';

-- El default para funciones ya nace sin anon desde T0.1, pero explícito es mejor:
-- esta función la ejecuta el que consulta las views (security_invoker).
REVOKE ALL ON FUNCTION public.fn_signo_comprobante(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_signo_comprobante(TEXT) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Libro IVA Compras — el lado del crédito
--     Mismas columnas, mismo orden, mismos tipos (numeric(15,2) explícito para
--     que CREATE OR REPLACE no rechace el cambio de tipo).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_libro_iva_compras_extendido
WITH (security_invoker = true) AS
 SELECT 'oficial'::text AS origen,
    cr.id,
    cr.fecha,
    cr.tipo,
    cr.numero,
    cr.cuit,
    COALESCE(cr.proveedor_nombre, ''::text) AS razon_social,
    COALESCE(cr.concepto, ''::text) AS descripcion,
    (cr.neto  * public.fn_signo_comprobante(cr.tipo))::numeric(15,2) AS subtotal,
    (0)::numeric(15,2) AS iva_21,
    (0)::numeric(15,2) AS iva_10_5,
    (0)::numeric(15,2) AS iva_otros,
    (cr.iva   * public.fn_signo_comprobante(cr.tipo))::numeric(15,2) AS iva_total,
    (cr.total * public.fn_signo_comprobante(cr.tipo))::numeric(15,2) AS total,
    to_char((cr.fecha)::timestamp with time zone, 'YYYY-MM'::text) AS periodo,
    NULL::text AS traido_por,
    cr.created_at
   FROM comprobantes_recibidos cr
  WHERE (cr._deleted = false)
UNION ALL
 SELECT 'virtual'::text AS origen,
    civar.id,
    civar.fecha,
    'factura'::text AS tipo,          -- hardcodeado → signo +1 siempre
    NULL::text AS numero,
    civar.cuit,
    COALESCE(civar.razon_social, ''::text) AS razon_social,
    COALESCE(civar.descripcion, ''::text) AS descripcion,
    civar.subtotal,
    civar.iva_21,
    civar.iva_10_5,
    civar.iva_otros,
    civar.iva_total,
    civar.total,
    civar.periodo,
    civar.traido_por,
    civar.created_at
   FROM comprobantes_iva_recovery civar
  WHERE (civar._deleted = false);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Posición IVA del mes — el lado del débito
--     El crédito ya viene firmado por la view de arriba.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_posicion_iva_mes
WITH (security_invoker = true) AS
 WITH credito AS (
         SELECT v.periodo,
            sum(CASE WHEN v.origen = 'oficial'::text THEN v.iva_total ELSE (0)::numeric END) AS iva_credito_oficial,
            sum(CASE WHEN v.origen = 'virtual'::text THEN v.iva_total ELSE (0)::numeric END) AS iva_credito_virtual,
            sum(v.iva_total) AS iva_credito_total
           FROM v_libro_iva_compras_extendido v
          GROUP BY v.periodo
        ), debito AS (
         SELECT to_char((c.fecha)::timestamp with time zone, 'YYYY-MM'::text) AS periodo,
            -- T4.5: era `sum(c.iva)` — la NC sumaba en vez de restar.
            sum(c.iva * public.fn_signo_comprobante(c.tipo)) AS iva_debito
           FROM comprobantes c
          WHERE ((c._deleted = false) AND (c.estado = ANY (ARRAY['aprobada'::text, 'emitida'::text, 'autorizada'::text])))
          GROUP BY (to_char((c.fecha)::timestamp with time zone, 'YYYY-MM'::text))
        )
 SELECT COALESCE(c.periodo, d.periodo) AS periodo,
    COALESCE(d.iva_debito, (0)::numeric) AS iva_debito,
    COALESCE(c.iva_credito_oficial, (0)::numeric) AS iva_credito_oficial,
    COALESCE(c.iva_credito_virtual, (0)::numeric) AS iva_credito_virtual,
    COALESCE(c.iva_credito_total, (0)::numeric) AS iva_credito_total,
    (COALESCE(d.iva_debito, (0)::numeric) - COALESCE(c.iva_credito_oficial, (0)::numeric)) AS saldo_solo_oficial,
    (COALESCE(d.iva_debito, (0)::numeric) - COALESCE(c.iva_credito_total, (0)::numeric)) AS saldo_con_virtual
   FROM (credito c
     FULL JOIN debito d ON ((c.periodo = d.periodo)))
  ORDER BY COALESCE(c.periodo, d.periodo) DESC;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Saldo por comprobante — que una NC deje de parecer un crédito a cobrar
--
--     `total` y `saldo` pasan a venir FIRMADOS. Eso arregla solo el consumidor
--     que importa sin tocarle una línea: `getSaldosComprobantesPorCliente`
--     filtra con `.gt('saldo', 0.01)`, así que una NC (saldo negativo) queda
--     fuera de la lista de facturas de la pantalla de cobranza.
--     `estado_cobranza` gana el valor 'nota_credito' para que la UI la pueda
--     etiquetar; no hay ningún consumidor de esa columna en el JS de hoy
--     (verificado por grep), así que sumar un valor no rompe nada.
--     `signo` va al final porque CREATE OR REPLACE sólo acepta columnas nuevas
--     ahí — ver la nota de la cabecera.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_saldo_comprobante
WITH (security_invoker = true) AS
 SELECT c.id AS comprobante_id,
    c.fecha,
    c.tipo,
    c.cliente_id,
    c.proyecto_id,
    (c.total * public.fn_signo_comprobante(c.tipo))::numeric(15,2) AS total,
    COALESCE(sum(ca.monto_aplicado), (0)::numeric) AS total_cobrado,
    ((c.total * public.fn_signo_comprobante(c.tipo)) - COALESCE(sum(ca.monto_aplicado), (0)::numeric)) AS saldo,
        CASE
            WHEN public.fn_signo_comprobante(c.tipo) < 0 THEN 'nota_credito'::text
            WHEN (COALESCE(sum(ca.monto_aplicado), (0)::numeric) >= (c.total - 0.01)) THEN 'cobrada'::text
            WHEN (COALESCE(sum(ca.monto_aplicado), (0)::numeric) > 0.01) THEN 'parcial'::text
            ELSE 'pendiente'::text
        END AS estado_cobranza,
    c.canal,
    c.estado AS estado_comprobante,
    public.fn_signo_comprobante(c.tipo) AS signo
   FROM (comprobantes c
     LEFT JOIN cobro_aplicaciones ca ON (((ca.comprobante_id = c.id) AND (ca._deleted = false))))
  WHERE (c._deleted = false)
  GROUP BY c.id, c.fecha, c.tipo, c.cliente_id, c.proyecto_id, c.total, c.canal, c.estado;

-- ─────────────────────────────────────────────────────────────────────────
-- Self-audit — aborta todo si algo no quedó como debía
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_n        INT;
    v_debito   NUMERIC;
    v_saldo_nc NUMERIC;
BEGIN
    -- (a) la función existe y da lo que tiene que dar
    IF public.fn_signo_comprobante('factura_b') <> 1
       OR public.fn_signo_comprobante('nota_credito_b') <> -1
       OR public.fn_signo_comprobante('nota_credito') <> -1
       OR public.fn_signo_comprobante('nota_debito_a') <> 1
       OR public.fn_signo_comprobante(NULL) <> 1 THEN
        RAISE EXCEPTION 'T4.5: fn_signo_comprobante no devuelve los signos esperados — abortando';
    END IF;

    -- (b) las 3 views conservan security_invoker
    SELECT count(*) INTO v_n
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'v'
       AND c.relname IN ('v_libro_iva_compras_extendido','v_posicion_iva_mes','v_saldo_comprobante')
       AND 'security_invoker=true' = ANY (c.reloptions);
    IF v_n <> 3 THEN
        RAISE EXCEPTION 'T4.5: sólo % de 3 views quedaron con security_invoker=true — abortando (sin eso bypassean el RLS del que consulta, que fue el incidente del 26/07)', v_n;
    END IF;

    -- (c) anon sigue SIN poder leerlas (el pg_default_acl de views está abierto: T0.11)
    SELECT count(*) INTO v_n
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND grantee = 'anon' AND privilege_type = 'SELECT'
       AND table_name IN ('v_libro_iva_compras_extendido','v_posicion_iva_mes','v_saldo_comprobante');
    IF v_n <> 0 THEN
        RAISE EXCEPTION 'T4.5: anon recuperó SELECT sobre % view(s) financieras — abortando (regresión del fix del 26/07)', v_n;
    END IF;

    -- (d) el número que motivó el ítem: junio 2026 tiene FC B + su NC B → débito 0
    SELECT COALESCE(iva_debito, 0) INTO v_debito
      FROM public.v_posicion_iva_mes WHERE periodo = '2026-06';
    IF v_debito IS NULL OR ABS(v_debito) > 0.01 THEN
        RAISE EXCEPTION 'T4.5: el IVA débito de 2026-06 quedó en % y tendría que dar 0,00 (FC B $1.000 + su NC B) — abortando', v_debito;
    END IF;

    -- (e) la NC dejó de figurar como crédito a cobrar
    SELECT saldo INTO v_saldo_nc
      FROM public.v_saldo_comprobante
     WHERE tipo = 'nota_credito_b' AND fecha = DATE '2026-06-22';
    IF v_saldo_nc IS NULL OR v_saldo_nc > 0 THEN
        RAISE EXCEPTION 'T4.5: la nota de crédito sigue con saldo positivo (%) — abortando', v_saldo_nc;
    END IF;

    RAISE NOTICE 'T4.5 OK: signo único aplicado. IVA débito 2026-06 = % (antes 347,10). NC con saldo % (antes +1000).', v_debito, v_saldo_nc;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK: recrear las 3 views con la definición previa (está íntegra en el
-- comentario de cabecera de cada bloque de este archivo y en pg_views antes de
-- correrlo) y `DROP FUNCTION public.fn_signo_comprobante(TEXT);`.
-- ⚠️ Si se recrean, usar CREATE OR REPLACE, NUNCA DROP + CREATE: ver la nota de
-- la cabecera sobre el pg_default_acl abierto a anon.
-- Sin datos que revertir: este archivo no escribe una sola fila.
--
-- QUÉ CAMBIA EN PANTALLA (lo de este archivo + el JS del mismo commit):
--   · Cobranza: la nota de crédito desaparece de la lista de facturas
--     aplicables del cliente. **Esto sí es mérito del SQL solo**: la vista
--     firmada hace que `.gt('saldo', 0.01)` la excluya sin tocar el filtro.
--   · Reportes → IVA · Contabilidad → Libros IVA y Posición · widget del
--     lobby: junio 2026 pasa de $347,10 de débito a $0,00. **Eso lo hace el
--     JS**, no este archivo — esas pantallas suman las tablas base.
--   · Facturación → Emitidos: los KPIs y el total del pie dejan de contar la
--     NC como venta. También JS.
--   · Los dos CSV del Libro IVA (ventas y compras), que van al contador,
--     salen con el mismo signo que la pantalla.
-- ─────────────────────────────────────────────────────────────────────────────
