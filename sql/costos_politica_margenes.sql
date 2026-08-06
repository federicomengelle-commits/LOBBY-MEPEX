-- ═══════════════════════════════════════════════════════════════════════════
--  POLÍTICA DE MÁRGENES POR RUBRO  ·  2026-08-06
--  Decidida por Fede en la sesión de diseño del modelo de costos.
--  Insumo: docs/costos-estado-real-y-decisiones.md (decisión 4)
--  Resultado: docs/costos-modelo-decidido.md
-- ═══════════════════════════════════════════════════════════════════════════
--
--  QUÉ HACE
--    1. Deja un respaldo completo de márgenes y precios (tabla _bk_*).
--    2. Aplica el margen que corresponde a cada rubro × tipo de receta.
--    3. Recalcula precio y costos SÓLO de los ítems que tienen receta,
--       usando la RPC `calcular_receta` — la fuente de verdad. Es lo mismo
--       que hace el botón "Recalcular" de la UI (api.js:3902), snapshots
--       incluidos.
--
--  LA POLÍTICA
--    ┌──────────────────┬─────────────┬─────────┐
--    │ rubro            │ propio      │ subalq. │
--    ├──────────────────┼─────────────┼─────────┤
--    │ Infraestructura  │ 100%        │  50%    │
--    │ Equipamiento     │ 100%        │  50%    │
--    │ Iluminación      │ 100%        │  50%    │
--    │ Marketing        │ (sin ítems) │  50%    │
--    │ Pisos · alfombra │      —      │  60%    │
--    │ Pisos · tarima   │      —      │  45%    │
--    │ Más servicios    │  45%        │  45%    │
--    └──────────────────┴─────────────┴─────────┘
--    Ojo: lo que la UI llama "margen" es MARKUP (sobre el costo). 100% de
--    markup = 50% de margen real. Es convención del sistema, no un bug.
--
--  ⛔ EXCLUSIÓN DELIBERADA — ítem 89 "Panel sistema negro h=2,50m"
--    Su costo por uso guardado ($10.197) es MENOR que el del panel blanco
--    ($14.041), lo que es imposible: es el mismo panel con la mitad de vida
--    útil, así que su costo por uso tiene que ser el DOBLE ($28.082). El
--    número guardado quedó viejo. Recalcularlo no corregiría un precio:
--    afirmaría que el panel negro dura 5 usos, que es justamente lo que
--    falta validar con el taller (decisión 2 del documento). Queda congelado.
--
--  IDEMPOTENTE: sí. Correrlo dos veces deja el mismo resultado.
--  ⚠️ PERO NO ES "CORRER UNA VEZ Y LISTO": este archivo ES la política. Si
--     alguien edita un margen a mano por la UI y después se vuelve a correr
--     esto, el cambio manual se pisa en silencio. Las excepciones por ítem van
--     escritas acá, no cargadas a mano.
--  DESTRUCTIVO: no. No borra filas. Reversible con el bloque del pie.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 0) RESPALDO ───────────────────────────────────────────────────────────
-- Se crea una sola vez. Si ya existe, se conserva el respaldo ORIGINAL
-- (que es el que sirve para volver al estado previo a esta política).
CREATE TABLE IF NOT EXISTS _bk_catalogo_margenes_20260806 AS
SELECT id, rubro, tipo_receta, margen_propio, margen_subalquiler,
       costo_fabricacion, costo_por_uso, precio_alquiler,
       snapshot_pct_margen, snapshot_pct_indirectos_fabrica,
       snapshot_hora_taller_ars, snapshot_costos_at
FROM catalogo_items
WHERE COALESCE(_deleted, false) = false;

-- La tabla de respaldo no la lee la app. RLS activada sin policies para que
-- ningún rol del cliente (anon/authenticated) la alcance y para no ensuciar
-- el Security Advisor con un `rls_disabled_in_public`.
ALTER TABLE _bk_catalogo_margenes_20260806 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON _bk_catalogo_margenes_20260806 FROM anon, authenticated;

COMMENT ON TABLE _bk_catalogo_margenes_20260806 IS
  'Respaldo previo a la política de márgenes del 2026-08-06. Se puede dropear '
  'cuando Fede confirme los precios nuevos. Ver sql/costos_politica_margenes.sql.';

-- ─── 1) MÁRGENES ───────────────────────────────────────────────────────────

-- Propios de los tres rubros que van al 100% (el 89 queda afuera).
UPDATE catalogo_items
   SET margen_propio = 1.00
 WHERE COALESCE(_deleted, false) = false
   AND tipo_receta = 'propio'
   AND rubro IN ('Infraestructura', 'Equipamiento', 'Iluminación')
   AND id <> 89;

-- Subalquilados de esos rubros + Marketing → 50%.
UPDATE catalogo_items
   SET margen_subalquiler = 0.50
 WHERE COALESCE(_deleted, false) = false
   AND tipo_receta = 'subalquilado'
   AND rubro IN ('Infraestructura', 'Equipamiento', 'Marketing')
   AND id <> 89;

-- Pisos se parte en dos: las alfombras al 60%, las tarimas al 45%.
-- Se identifican por nombre y no por id para que siga valiendo si se agregan
-- alfombras o tarimas nuevas.
UPDATE catalogo_items
   SET margen_subalquiler = 0.60
 WHERE COALESCE(_deleted, false) = false
   AND rubro = 'Pisos' AND tipo_receta = 'subalquilado'
   AND nombre ILIKE '%alfombra%'
   AND id <> 89;

UPDATE catalogo_items
   SET margen_subalquiler = 0.45
 WHERE COALESCE(_deleted, false) = false
   AND rubro = 'Pisos' AND tipo_receta = 'subalquilado'
   AND nombre ILIKE '%tarima%'
   AND id <> 89;

-- Más servicios, ambos tipos, al 45%.
UPDATE catalogo_items
   SET margen_propio = 0.45
 WHERE COALESCE(_deleted, false) = false
   AND rubro = 'Más servicios' AND tipo_receta = 'propio'
   AND id <> 89;

UPDATE catalogo_items
   SET margen_subalquiler = 0.45
 WHERE COALESCE(_deleted, false) = false
   AND rubro = 'Más servicios' AND tipo_receta = 'subalquilado'
   AND id <> 89;

-- ─── 2) RECALCULAR PRECIOS ─────────────────────────────────────────────────
-- Sólo los ítems que TIENEN receta. A los ~198 que están vacíos se les deja
-- el margen puesto pero no se les escribe snapshot: marcarlos como
-- "recalculados hoy" mentiría, no tienen nada que calcular.
WITH params AS (
    SELECT
      MAX(valor) FILTER (WHERE clave = 'pct_indirectos_fabrica') AS ind,
      MAX(valor) FILTER (WHERE clave = 'hora_taller_ars')        AS hora
    FROM parametros_globales
),
objetivo AS (
    SELECT DISTINCT ci.id
      FROM catalogo_items ci
      JOIN receta_componentes rc ON rc.item_id = ci.id
     WHERE COALESCE(ci._deleted, false) = false
       AND ci.id <> 89
),
calc AS (
    SELECT o.id, r.costo_fabricacion, r.costo_por_uso, r.precio_alquiler
      FROM objetivo o, LATERAL calcular_receta(o.id) r
)
UPDATE catalogo_items ci
   SET costo_fabricacion = calc.costo_fabricacion,
       costo_por_uso     = calc.costo_por_uso,
       precio_alquiler   = calc.precio_alquiler,
       snapshot_pct_margen = COALESCE(
           CASE WHEN ci.tipo_receta = 'subalquilado'
                THEN ci.margen_subalquiler ELSE ci.margen_propio END, 0.50),
       snapshot_pct_indirectos_fabrica = (SELECT ind  FROM params),
       snapshot_hora_taller_ars        = (SELECT hora FROM params),
       snapshot_costos_at              = now()
  FROM calc
 WHERE ci.id = calc.id;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
--  VERIFICACIÓN (correr después, en consulta aparte —  una CTE ve la foto
--  del inicio de la sentencia y devolvería los valores viejos)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- -- Qué se movió, y cuánto:
-- SELECT ci.id, ci.nombre, ci.es_cotizable,
--        b.precio_alquiler AS antes, ci.precio_alquiler AS ahora,
--        round(ci.precio_alquiler - b.precio_alquiler, 2) AS dif
--   FROM catalogo_items ci
--   JOIN _bk_catalogo_margenes_20260806 b ON b.id = ci.id
--  WHERE COALESCE(ci.precio_alquiler,0) <> COALESCE(b.precio_alquiler,0)
--  ORDER BY ci.es_cotizable DESC, abs(ci.precio_alquiler - b.precio_alquiler) DESC;
--
-- -- Que ningún precio quede fuera de la política:
-- SELECT rubro, tipo_receta,
--        array_agg(DISTINCT CASE WHEN tipo_receta='subalquilado'
--                                THEN margen_subalquiler ELSE margen_propio END) AS margenes
--   FROM catalogo_items WHERE COALESCE(_deleted,false)=false
--  GROUP BY 1,2 ORDER BY 1,2;
--
-- -- Que el 89 no se haya tocado (tiene que seguir en 1.25 y $22.943,80):
-- SELECT margen_propio, precio_alquiler FROM catalogo_items WHERE id = 89;

-- ═══════════════════════════════════════════════════════════════════════════
--  ROLLBACK  —  vuelve exactamente al estado previo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
-- UPDATE catalogo_items ci
--    SET margen_propio      = b.margen_propio,
--        margen_subalquiler = b.margen_subalquiler,
--        costo_fabricacion  = b.costo_fabricacion,
--        costo_por_uso      = b.costo_por_uso,
--        precio_alquiler    = b.precio_alquiler,
--        snapshot_pct_margen             = b.snapshot_pct_margen,
--        snapshot_pct_indirectos_fabrica = b.snapshot_pct_indirectos_fabrica,
--        snapshot_hora_taller_ars        = b.snapshot_hora_taller_ars,
--        snapshot_costos_at              = b.snapshot_costos_at
--   FROM _bk_catalogo_margenes_20260806 b
--  WHERE ci.id = b.id;
-- COMMIT;
--
-- -- Y cuando ya no haga falta el respaldo:
-- -- DROP TABLE _bk_catalogo_margenes_20260806;
