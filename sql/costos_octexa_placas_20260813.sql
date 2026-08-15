-- =====================================================================
-- COSTOS OCTEXA — familia de placas + correcciones de código
-- =====================================================================
-- Aplicado en prod el 2026-08-13 vía PostgREST con service key
-- (el MCP de Supabase no estaba disponible en la sesión).
-- Este archivo documenta lo hecho y deja el rollback al pie.
--
-- Diseño: docs/costos-octexa-piezas-y-nomenclatura.md
-- Sin DDL: sólo INSERT/UPDATE sobre catalogo_items y receta_componentes.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 1 · Correcciones de código  (3 UPDATE, verificados sin uso previo)
-- ─────────────────────────────────────────────────────────────────────
-- 1.a  Los dinteles de 4½ módulos tenían cargado el ENTRE-EJES (4455) en
--      lugar del perfil visible (4415). La regla es EE = perfil + 40.
--      DLL-4415 ya estaba bien; sólo DLA y DAA estaban corridos.
--      Verificado antes de tocar: 0 usos en receta_componentes.

UPDATE catalogo_items
   SET codigo = 'DLA-4415', nombre = 'Dintel liso aletado 4415 mm', medida_mm = 4415
 WHERE id = 133 AND codigo = 'DLA-4455';

UPDATE catalogo_items
   SET codigo = 'DAA-4415', nombre = 'Dintel aletado aletado 4415 mm', medida_mm = 4415
 WHERE id = 155 AND codigo = 'DAA-4455';

-- 1.b  SLA-001 estaba repetido en 3 ítems distintos.
UPDATE catalogo_items SET codigo = 'SLA-002' WHERE id = 69;  -- Spot LED orientable con brazo
UPDATE catalogo_items SET codigo = 'SPA-002' WHERE id = 70;  -- Spot LED premier con brazo
-- (id 68 "Spot LED orientable aplicado" conserva SLA-001)

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 2 · Familia de placas — 86 piezas nuevas
-- ─────────────────────────────────────────────────────────────────────
-- Hasta ahora existía UNA sola placa en todo el sistema (PLA-960-2410).
-- Sin familia de placas no hay lista de preparación posible.
--
-- Nomenclatura:  <FAM>-<ancho>x<alto>   todo en milímetros
--   PF3 = Placa Fibroplus 3 mm   (insumo 5, $5.250/m², VU 1, desperdicio 15%)
--   PKH = Placa Karikal 3 mm     (insumo 3, $21.500/m², VU 10, desp 15%, reacond 20%)
--
-- Anchos: los 6 de la grilla modular — placa = n × 990 − 30
--   465 (½ mód) · 960 (1) · 1455 (1½) · 1950 (2) · 2445 (2½) · 2940 (3)
-- Alturas: las 16 de cenefa — placa = altura del módulo − 90
--   210 310 360 410 460 510 610 660 710 810 860 910 960 1010 1110 1210
--
-- Qué se generó:
--   PF3: 5 anchos × 16 alturas = 80   (el 2940 no entra en la plancha de Fibroplus, 2600×1830)
--   PKH: 6 anchos × altura 210 =  6   (la cenefa "general" de expo, la única en Karikal)
--                                 ───
--                                  86
--
-- Cada placa lleva UN componente de receta: los m² del insumo correspondiente.
--   cantidad = ancho × alto / 1.000.000
--
-- mano_obra_minutos = 0 a propósito: los minutos reales de corte están
-- pendientes (ver docs/costos-octexa-lo-que-necesito.md §4.1). Cuando se
-- carguen, el motor recalcula solo.
--
-- Equivalente SQL de lo aplicado (patrón; se corrió ítem por ítem):
--
--   INSERT INTO catalogo_items
--     (codigo, nombre, familia, rubro, categoria, tipo_receta, unidad,
--      nivel, es_cotizable, mano_obra_minutos, activo)
--   VALUES
--     ('PF3-1950x210', 'Placa Fibroplus 3mm 1950 x 210', 'PF3',
--      'Infraestructura', 'Sistema OCTEXA', 'propio', 'Unidad',
--      2, false, 0, true);
--
--   INSERT INTO receta_componentes
--     (item_id, componente_type, componente_id, cantidad, unidad_uso)
--   VALUES (<nuevo_id>, 'insumo', '5', 0.4095, 'm2');
--
-- Y después el recálculo, que persiste lo que devuelve la RPC:
--
--   UPDATE catalogo_items SET
--     costo_fabricacion = r.costo_fabricacion,
--     costo_por_uso     = r.costo_por_uso,
--     precio_alquiler   = r.precio_alquiler,
--     costo_produccion  = r.costo_mp,
--     snapshot_pct_indirectos_fabrica = 0.30,
--     snapshot_pct_margen             = 0.50,
--     snapshot_hora_taller_ars        = 15000,
--     snapshot_costos_at = now(), ultima_recalculacion = now()
--   FROM calcular_receta(<id>) r WHERE catalogo_items.id = <id>;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN aplicada
-- ─────────────────────────────────────────────────────────────────────
-- 86 placas creadas · 86 recalculadas · 0 en $0
-- catalogo_items vivos: 259 → 345 (+86)
-- cotizables: 63 antes y después (no se tocó ninguno)
-- PSB-250 intacto (fab $140.185 / precio $24.634)
-- ítem 89 (panel negro, congelado) intacto — no se recalculó
--
-- Contraste que valida el modelo de costo por uso:
--   PKH-1950x210  fab $10.125  → uso $1.215   (Karikal, VU 10)
--   PF3-1950x210  fab  $2.472  → uso $2.472   (Fibroplus, VU 1)
--   4× más caro de comprar, 2× más barato por uso.

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 3 · Política de márgenes  (hallazgo del sql-reviewer, MEDIUM)
-- ─────────────────────────────────────────────────────────────────────
-- Las 86 placas nacieron sin `margen_propio` y cayeron al fallback 0,50,
-- mientras sus 8 hermanos "Infraestructura / propio" tienen 1,00 por
-- sql/costos_politica_margenes.sql (Decisión 4, 2026-08-06).
-- Impacto hoy nulo (no son cotizables y el margen de un componente no
-- contamina al padre — la cascada usa costo_por_uso, no precio_alquiler),
-- pero deja una inconsistencia latente si alguna se vuelve cotizable.

UPDATE catalogo_items
   SET margen_propio = 1.00, snapshot_pct_margen = 1.00
 WHERE familia IN ('PF3','PKH') AND tipo_receta = 'propio';
-- + recálculo con calcular_receta (se corrió: 86/86, 0 en $0)

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 4 · Los 83 perfiles costeados  (2ª tanda, mismo día)
-- ─────────────────────────────────────────────────────────────────────
-- Decisión de Fede (2026-08-13): "el dintel y las columnas siempre van en
-- aluminio pintado; el crudo es para los cerrojos nada más."
-- Y confirmó el peso: 0,789 kg/m, que es lo que ya estaba cargado.
--
-- Receta uniforme por pieza:
--   aluminio pintado (insumo 1, $18.000/kg) · cantidad = kg/m × largo/1000
--   + 2 × CER-PER (item 67)   ← sólo los dinteles; la columna no lleva
--   mano_obra_minutos = 3 · vida_util_armado_override = 20 · margen_propio = 1.00
--     (los tres calcados de DLL-950 y COC-2500, las dos piezas que ya funcionaban)
--
-- kg/m aplicados:
--   DLL 0,789   ← medido en la receta viva del DLL-950, coincide con la estimación de Fede
--   COC 1,000   ← ídem COC-2500 (2,5 kg / 2500 mm)
--   DLA 0,941 y DAA 0,900  ← la MAGNITUD de arriba escalada por la PROPORCIÓN del
--     catálogo OCTEXA 2021 entre perfiles (0,68 y 0,65 sobre 0,57 del liso).
--     ⚠️ Es lo más defendible sin balanza, pero es una derivación, no una medición.
--     Las 3 pesadas de docs/costos-octexa-lo-que-necesito.md §1 lo cierran.
--
-- Patrón aplicado por pieza:
--   DELETE FROM receta_componentes WHERE item_id = <id> AND _deleted = false;
--   INSERT INTO receta_componentes (item_id, componente_type, componente_id, cantidad, unidad_uso)
--        VALUES (<id>, 'insumo', '1', <kg>, 'Kg');
--   INSERT ... VALUES (<id>, 'item', '67', 2, 'Unidad');        -- sólo dinteles
--   UPDATE catalogo_items SET mano_obra_minutos = 3,
--          vida_util_armado_override = 20, margen_propio = 1.00 WHERE id = <id>;
--   -- + recálculo con calcular_receta
--
-- Cobertura final: DLL 22/22 · DLA 22/22 · DAA 22/22 · COC 17/17 = 83 piezas, 0 en $0.
-- CMO (6) · CCO (5) · CDO (4) · CHE (1) quedan SIN costear: no hay kg/m para
-- media columna, esquinera, doble ni hexagonal. Esperan la balanza.
--
-- ⚠️ EFECTO SOBRE UN PRECIO VIVO — NO APLICADO:
-- El DLL-950 pasó de aluminio crudo a pintado: fab $16.412 → $18.766.
-- El panel PSB-250 (2.247 unidades cotizadas) lleva 2 dinteles, así que su
-- receta corregida da fab $144.895 y precio $25.164 contra los $140.185 /
-- $24.634 que tiene guardados: **+3,4% de costo, +$530 de precio**.
-- El cache del panel NO se recalculó a propósito — es decisión de Fede.
-- Para aplicarlo alcanza con recalcular el ítem 88 desde la UI de Costos.
--
-- PARTE 5 · Cortes calientes de Karikal (6 placas nuevas + 1 normalizada)
--   PKH-465x2410 · PKH-670x2410 · PKH-960x660 · PKH-960x910 · PKH-465x660 · PKH-490x640
--   y PLA-960-2410 → PKH-960x2410 (nivel 3 → 2, familia PKH)
-- El 670 sale del perfil 660 + 10 de encastre (la diagonal de medio módulo
-- reusada como perfil recto).

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 6 · Se quita el vida_util_armado_override  (2026-08-15)
-- ─────────────────────────────────────────────────────────────────────
-- Criterio del dueño, traído por el handoff del Cotizador:
--   "el panel no tendría que tener aguante de usos; cada material lo tiene.
--    El panel tiene M.O. para el armado."
-- Confirmado por Fede el 15/8 y extendido a la regla general:
--
--   ► El override se usa SÓLO cuando el ensamble se destruye antes que sus
--     materiales. Si se desarma y las piezas vuelven al galpón, va SIN
--     override y cada material se amortiza por su cuenta.
--
-- La PARTE 4 (13/8) le había puesto override 20 a las 83 piezas de perfil,
-- copiando el criterio de DLL-950 y COC-2500 — que eran justamente 2 de los
-- 10 ítems que el handoff había marcado como pendientes de revisar. Se revierte.

UPDATE catalogo_items SET vida_util_armado_override = NULL
 WHERE familia IN ('DLL','DLA','DAA','COC')       -- las 83 piezas de perfil
    OR id IN (67, 217);                            -- cerrojo y placa Karikal del panel
-- + recálculo de las 85 y de los paneles 88/89 que las consumen

-- NO se tocaron, por decisión explícita:
--   id 221 (Tapa vidrio 6mm, override 10) — Fede: "dejala por ahora".
--     Sacarlo la lleva de $2.617 a $5.752 (+120%), porque el vidrio dura 5 y
--     el override le pone 10.
--   id 49 (VMB-080 Vitrina, override 5) — se desarma, así que le CORRESPONDE
--     ir sin override, pero está bloqueada por otra cosa: ver PARTE 7.

-- ── Qué pasó con cada uno, medido ──
--   perfiles      el override los acortaba: el aluminio pintado dura 30, no 20  → −26%
--   placa Karikal mismo divisor (10), pero el override OMITÍA el 20% de
--                 reacondicionamiento — que es despegarle el vinilo         → +19%
--   cerrojo       20 ≈ la vida real de su aluminio crudo                    →  +3%
--
-- ── El resultado sobre el precio final ──
--   panel PSB-250 antes  $25.164,21   (con override en las piezas)
--   panel PSB-250 ahora  $25.183,27   (sin override, placa cobrando reacond.)
--   diferencia           +$19,06  = +0,08%   ·   contra la moda real de $25.000: +0,7%
--
-- Los dos efectos se compensaron: el override no estaba cambiando el precio,
-- estaba repartiendo mal el costo entre las piezas. El margen 1,25 que los
-- paneles ya tenían era el correcto (se probó 1,50 y daba $27.981; se revirtió).

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 7 · La vitrina VMB-080 — pendiente, no tocada
-- ─────────────────────────────────────────────────────────────────────
-- Fede confirmó que "siempre se desarma y se arma", así que le corresponde ir
-- sin override. Pero al medirlo aparece que NO SE PUEDE todavía:
--
--   mano_obra_minutos = 0     ← la vitrina no tiene tiempo de armado cargado
--
--   sin override             $52.886     ← se desploma a la mitad
--   guardado (con override)  $93.880
--
-- La cuenta al revés: para llegar a $93.880 con su margen de 1,00, faltan
-- $20.497 de costo, que en mano de obra + 30% de indirectos son ≈ 63 minutos.
-- El override de 5 estaba haciendo de reemplazo de una hora de taller que
-- nunca se cargó.
--
-- ⛔ Espera el dato real de cuánto lleva armarla. Con eso entra sin override,
--    con su MO propia, y el precio queda donde está diciendo la verdad.
--
-- Aparte: la vitrina arrastra un +18% sin recalcular (guardado $93.880 vs
-- motor $110.794) porque sus 12 dinteles pasaron a aluminio pintado el 13/8.
-- Se resuelve en la misma pasada que la MO.

-- ─────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ─────────────────────────────────────────────────────────────────────
-- PARTE 6: restaurar el override (y recalcular)
--   UPDATE catalogo_items SET vida_util_armado_override = 20
--    WHERE familia IN ('DLL','DLA','DAA','COC') OR id = 67;
--   UPDATE catalogo_items SET vida_util_armado_override = 10 WHERE id = 217;
--
-- Perfiles (PARTE 4): el backup de las recetas anteriores quedó en el
-- scratchpad de la sesión (backup_recetas_perfiles.json, 15,7 KB, los
-- componentes vivos de las 83 piezas antes de tocarlas). Si hay que
-- revertir, reinsertar desde ahí y recalcular.
-- Nota: 76 de las 83 no tenían receta alguna, así que revertir es
-- básicamente borrar la receta nueva. Las que sí tenían: los 6 DLL, 6 DLA,
-- 6 DAA y 1 COC que ya estaban costeados.
--
-- Las placas son piezas nuevas: al momento de aplicarse no estaban en
-- ninguna receta, así que borrarlas no afecta ningún costo existente.
--
-- ⚠️ Se acota por RANGO DE ID, no sólo por familia: el roadmap prevé
-- variantes de acabado sobre las MISMAS familias (`PKH-960x210-N`), y un
-- DELETE por familia se las llevaría puestas.
--
--   BEGIN;
--     DELETE FROM receta_componentes WHERE item_id BETWEEN 273 AND 358;
--     DELETE FROM catalogo_items     WHERE id      BETWEEN 273 AND 358;
--   COMMIT;
--
-- Correcciones de código — con guarda de precondición, para no pisar
-- ediciones hechas por la UI de Costos entremedio:
--   UPDATE catalogo_items SET codigo='DLA-4455', nombre='Dintel liso aletado 4455 mm',    medida_mm=4455 WHERE id=133 AND codigo='DLA-4415';
--   UPDATE catalogo_items SET codigo='DAA-4455', nombre='Dintel aletado aletado 4455 mm', medida_mm=4455 WHERE id=155 AND codigo='DAA-4415';
--   UPDATE catalogo_items SET codigo='SLA-001' WHERE id=69 AND codigo='SLA-002';
--   UPDATE catalogo_items SET codigo='SLA-001' WHERE id=70 AND codigo='SPA-002';
