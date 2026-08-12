-- =====================================================================
-- RECÁLCULO PUNTUAL DE LOS 9 ÍTEMS DESFASADOS (los Dinteles)
-- =====================================================================
-- Fecha: 2026-08-11
-- Pedido de Fede al cerrar la sesión de pulido: "recalculalos y dejalo
-- todo bien".
--
-- QUÉ ES UN ÍTEM "DESFASADO"
-- `catalogo_items` cachea el resultado del costeo (costo_fabricacion /
-- costo_por_uso / precio_alquiler). La view `v_catalogo_precio_desfasado`
-- compara ese cache contra `calcular_receta(id)` —la fuente de verdad,
-- CLAUDE.md §6.5— y lista los que no coinciden. El chip "⚠ N
-- desactualizados" del tab Recetas es esa view.
--
-- POR QUÉ ESTOS 9 Y NO "RECALCULAR TODOS"
-- El botón "Recalcular todos" de la UI recorre los 258 ítems, y entre
-- ellos está el **89**, que está CONGELADO A PROPÓSITO (CLAUDE.md §10,
-- sesión 2026-08-06b: su costo/uso guardado es la mitad del real y quedó
-- excluido de la política de márgenes hasta la sesión con Diego).
-- Recalcularlo por accidente le movería el precio sin decisión de nadie.
-- Por eso se toca la lista exacta.
--
-- IMPACTO MEDIDO ANTES DE ESCRIBIR (verificado contra prod, 2026-08-11)
--   · Los 9 son Dinteles, `tipo_receta='propio'`, `rubro='Infraestructura'`.
--   · Los 9 tienen `es_cotizable = false` → el Cotizador NO los lee
--     (su contrato filtra `es_cotizable=true`).
--   · NINGÚN otro ítem los tiene en su receta: se corrió un SELECT sobre
--     `receta_componentes` por `componente_type='item'` y devolvió 0 filas.
--     O sea son hojas del árbol: recalcularlos no arrastra a ningún padre.
--   · La diferencia es +$26 uniforme (el sub-ítem 67 que llevan los 9
--     cambió después de que se cachearon estos precios).
--   → Conclusión: no se mueve ningún precio que alguien esté cotizando.
--
-- QUÉ ESCRIBE
-- Lo mismo que `API.recalcularRecetaRPC` (api.js): los 3 importes + los
-- 4 snapshots. Para estos 9 los snapshots ya coinciden con los globales
-- vigentes (hora_taller 15000 · indirectos 0.30 · margen_propio 1.00),
-- así que en valor sólo se mueven los importes; se escriben igual para
-- no divergir del camino del front.
--
-- IDEMPOTENTE: correrlo dos veces no cambia nada la segunda vez (la
-- segunda pasada escribe los mismos valores que ya están). Lo único que
-- se mueve es `snapshot_costos_at`, igual que el botón del front.
--
-- TRIGGER EN LA TABLA (verificado en prod, NO está en ningún sql/ del
-- repo — regla 12: schema real > SQL del repo):
--   `trg_catalogo_updated` BEFORE UPDATE → `update_timestamp()`, que sólo
--   hace `NEW.updated_at = now()`. No escribe en otras tablas ni recalcula
--   nada, así que este UPDATE no dispara efectos laterales.
-- =====================================================================

BEGIN;

-- ── Respaldo ────────────────────────────────────────────────────────
-- Mismo patrón que `_bk_catalogo_margenes_20260806`: tabla propia, RLS
-- encendida y sin grants, para que no quede legible por la anon key.
CREATE TABLE IF NOT EXISTS _bk_catalogo_dinteles_20260811 AS
SELECT id, nombre, costo_fabricacion, costo_por_uso, precio_alquiler,
       snapshot_pct_indirectos_fabrica, snapshot_pct_margen,
       snapshot_hora_taller_ars, snapshot_costos_at
FROM catalogo_items
WHERE id IN (114, 116, 117, 118, 140, 192, 193, 195, 196);

ALTER TABLE _bk_catalogo_dinteles_20260811 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON _bk_catalogo_dinteles_20260811 FROM anon, authenticated;

-- ── Recálculo ───────────────────────────────────────────────────────
-- El LATERAL va en una CTE y no en el UPDATE ... FROM directo: la CTE ve
-- la foto del inicio de la sentencia, así que `calcular_receta` se evalúa
-- sobre los valores previos y no sobre los que la propia sentencia está
-- escribiendo.
WITH nuevos AS (
    SELECT ci.id,
           round(r.costo_fabricacion, 2) AS costo_fabricacion,
           round(r.costo_por_uso,     2) AS costo_por_uso,
           round(r.precio_alquiler,   2) AS precio_alquiler,
           -- margen efectivo, igual que api.js: propio → margen_propio si
           -- está cargado, si no el global.
           COALESCE(ci.margen_propio,
                    (SELECT valor::numeric FROM parametros_globales
                      WHERE clave = 'pct_margen_default')) AS margen_efectivo
    FROM catalogo_items ci
    CROSS JOIN LATERAL calcular_receta(ci.id) r
    WHERE ci.id IN (114, 116, 117, 118, 140, 192, 193, 195, 196)
)
UPDATE catalogo_items ci
SET costo_fabricacion               = n.costo_fabricacion,
    costo_por_uso                   = n.costo_por_uso,
    precio_alquiler                 = n.precio_alquiler,
    snapshot_pct_margen             = n.margen_efectivo,
    snapshot_pct_indirectos_fabrica = (SELECT valor::numeric FROM parametros_globales
                                        WHERE clave = 'pct_indirectos_fabrica'),
    snapshot_hora_taller_ars        = (SELECT valor::numeric FROM parametros_globales
                                        WHERE clave = 'hora_taller_ars'),
    snapshot_costos_at              = now()
FROM nuevos n
WHERE n.id = ci.id;

-- ── Aserción: los 9 que tocamos tienen que quedar al día ────────────
-- ⚠️ El WHERE acota a NUESTROS 9 a propósito (lo marcó el sql-reviewer).
-- Chequear que la view entera quede vacía suena más estricto y es peor:
--   (a) el ítem 89 está desfasado A PROPÓSITO y puede volver a la view
--       en cualquier momento;
--   (b) el catálogo se está tocando en paralelo, así que otro ítem puede
--       desfasarse entre que se escribe esto y se corre.
-- En cualquiera de los dos casos la transacción se revertiría entera
-- —perdiendo el recálculo correcto— con un error que culpa a algo ajeno.
-- Y el arreglo intuitivo sería recalcular el 89: justo lo que este script
-- existe para no hacer.
DO $$
DECLARE v_quedan int;
BEGIN
    SELECT count(*) INTO v_quedan
      FROM v_catalogo_precio_desfasado
     WHERE id IN (114, 116, 117, 118, 140, 192, 193, 195, 196);
    IF v_quedan <> 0 THEN
        RAISE EXCEPTION 'Quedaron % de los 9 dinteles desfasados; se revierte', v_quedan;
    END IF;
    RAISE NOTICE 'OK: los 9 dinteles quedaron al dia';
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK  (transaccional, como en costos_politica_margenes.sql)
-- =====================================================================
-- BEGIN;
-- UPDATE catalogo_items ci
-- SET costo_fabricacion               = b.costo_fabricacion,
--     costo_por_uso                   = b.costo_por_uso,
--     precio_alquiler                 = b.precio_alquiler,
--     snapshot_pct_indirectos_fabrica = b.snapshot_pct_indirectos_fabrica,
--     snapshot_pct_margen             = b.snapshot_pct_margen,
--     snapshot_hora_taller_ars        = b.snapshot_hora_taller_ars,
--     snapshot_costos_at              = b.snapshot_costos_at
-- FROM _bk_catalogo_dinteles_20260811 b
-- WHERE b.id = ci.id;
-- DROP TABLE _bk_catalogo_dinteles_20260811;
-- COMMIT;
-- =====================================================================
