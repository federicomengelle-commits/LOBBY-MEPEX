-- ═══════════════════════════════════════════════════════════════════════════
--  VIEW  v_catalogo_precio_desfasado   ·  2026-08-06
--  Detecta ítems cuyo precio GUARDADO ya no coincide con lo que daría su
--  receta hoy.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  EL PROBLEMA QUE RESUELVE
--    `catalogo_items.precio_alquiler` es un valor cacheado: se escribe al
--    apretar "Recalcular" y ahí queda. Si después cambia el costo de un insumo
--    o el margen del ítem, el precio guardado queda viejo — y es el que lee el
--    Cotizador para cotizarle a un cliente.
--
--    Hoy el único aviso vive DENTRO del panel del ítem abierto (`costos.js`
--    línea ~2089, el ⚠ naranja) y se pierde al cerrarlo. Además ese aviso
--    dispara por *falta de snapshot*, que es otra cosa: el ítem 89 tenía
--    snapshot y aun así su precio estaba **$40.240 por debajo** de su receta
--    durante meses, sin que nadie lo viera. Está anotado como pendiente en el
--    propio código, en `costos.js` línea ~2444.
--
--    Esta view expone el desfase para que el módulo pueda mostrarlo de forma
--    persistente, sin abrir ítem por ítem.
--
--  ALCANCE
--    Sólo ítems CON receta. Los que no tienen componentes dan $0 contra $0 y
--    serían ruido: su problema no es estar desfasados, es estar vacíos, y eso
--    ya lo muestra el chip "Sin receta".
--
--  ⚠️ PERFORMANCE — leer antes de que crezca el catálogo
--    La view ejecuta la RPC `calcular_receta` (recursiva, por el BOM
--    jerárquico) una vez por ítem con receta. Hoy son 28 ítems y responde al
--    instante. Cuando la carga masiva del catálogo lleve esto a ~200 recetas,
--    conviene medirla de nuevo; si molesta, la salida es materializarla o
--    calcular el desfase en un job en vez de al vuelo.
--
--  SEGURIDAD
--    `security_invoker = true` — regla de facto del repo desde el 2026-07-26,
--    cuando cinco views financieras resultaron estar sirviéndole datos reales a
--    cualquier anónimo por ser SECURITY DEFINER. Con invoker, la view hereda la
--    RLS de `catalogo_items`: nadie ve por acá nada que no pueda ver por la
--    tabla. Más un REVOKE explícito de `anon`.
--
--  IDEMPOTENTE: sí (CREATE OR REPLACE).  DESTRUCTIVO: no. Sólo lectura.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE VIEW public.v_catalogo_precio_desfasado
WITH (security_invoker = true) AS
SELECT
    ci.id,
    ci.nombre,
    ci.rubro,
    ci.tipo_receta,
    ci.es_cotizable,
    ci.precio_alquiler                                              AS precio_guardado,
    round(r.precio_alquiler, 2)                                     AS precio_receta,
    round(r.precio_alquiler - COALESCE(ci.precio_alquiler, 0), 2)   AS diferencia,
    ci.snapshot_costos_at
FROM catalogo_items ci
CROSS JOIN LATERAL calcular_receta(ci.id) r
WHERE COALESCE(ci._deleted, false) = false
  -- El componente borrado NO cuenta. Sin esto, un ítem al que le vaciaron la
  -- receta (todos sus componentes soft-deleted) entraría como "con receta" y
  -- aparecería desfasado sin serlo — justo el ruido que esta view evita. Es el
  -- mismo criterio que usa el resto de la app: `api.js` filtra componentes
  -- activos para el recálculo masivo, y los índices de `costos_fase3.sql` son
  -- parciales sobre `_deleted = false`.
  AND EXISTS (SELECT 1 FROM receta_componentes rc
               WHERE rc.item_id = ci.id AND COALESCE(rc._deleted, false) = false)
  AND abs(COALESCE(r.precio_alquiler, 0) - COALESCE(ci.precio_alquiler, 0)) > 0.01;

-- REVOKE a los DOS roles, no sólo a anon: Supabase todavía tiene abierto el
-- default privilege de tablas/vistas, así que una view nueva nace con los 7
-- privilegios (INSERT, UPDATE, DELETE…) para `authenticated`. Sobre esta view
-- no son explotables —con un CROSS JOIN LATERAL no es auto-actualizable y un
-- INSERT fallaría igual— pero dejar sólo SELECT es gratis y es la superficie
-- que corresponde. Verificado en prod: authenticated venía con los 7.
REVOKE ALL ON public.v_catalogo_precio_desfasado FROM anon, authenticated;
GRANT SELECT ON public.v_catalogo_precio_desfasado TO authenticated;

COMMENT ON VIEW public.v_catalogo_precio_desfasado IS
  'Items cuyo precio_alquiler guardado no coincide con el que daria su receta hoy. '
  'Alimenta el chip "desactualizados" del modulo Costos. security_invoker=true a proposito: '
  'hereda la RLS de catalogo_items. Ver sql/costos_view_precio_desfasado.sql.';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
--  VERIFICACIÓN (consulta aparte, después de aplicar)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- SELECT * FROM v_catalogo_precio_desfasado ORDER BY es_cotizable DESC, abs(diferencia) DESC;
-- -- Esperado el 2026-08-06: exactamente 1 fila, el item 89 (panel negro,
-- -- congelado a proposito), con diferencia +40240.70.
--
-- -- Que la RPC del otro extremo de la cadena tampoco sea DEFINER —  si lo
-- -- fuera, correría con los permisos de su dueño y el security_invoker de la
-- -- view dejaría de acotar lo que se ve. Esperado: false.
-- SELECT prosecdef FROM pg_proc WHERE proname = 'calcular_receta';
--
-- -- Que la view sea invoker y no definer:
-- SELECT c.relname, (SELECT option_value FROM pg_options_to_table(c.reloptions)
--                     WHERE option_name = 'security_invoker') AS invoker
--   FROM pg_class c WHERE c.relname = 'v_catalogo_precio_desfasado';
--
-- ═══════════════════════════════════════════════════════════════════════════
--  ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DROP VIEW IF EXISTS public.v_catalogo_precio_desfasado;
