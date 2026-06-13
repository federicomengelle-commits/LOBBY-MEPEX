# Rediseño UX — Módulo Costos (blueprint aprobado)

> **Estado:** diseño cerrado y validado con Fede vía renders interactivos (sesión 2026-06-12, "análisis e ideas").
> **Pendiente:** implementar en la próxima sesión. Nada de esto está codeado todavía.
> **Regla de oro:** son cambios **solo de presentación**. La RPC `calcular_receta` sigue siendo la única que calcula precios. Ver `CLAUDE.md` §6.5.

---

## 1. Qué pidió Fede

- El módulo Costos "más amigable", sobre todo el **panel de edición**.
- **Edición inline desde la tabla** (sin abrir panel): clic en un badge de Clasificación / Categoría / Tipo amort. → desplegable → cambia en 2 clics.
- El panel lateral de 560px es incómodo ("feo, no lo veo entero"). Prefiere un **editor a pantalla completa**.
- Editar componentes cómodo: **agregar / quitar / editar inline**, tipo planilla.
- La **fórmula más clara**, que se entienda el proceso de una mirada.
- Verificado en vivo (Vitrina mostrador 1,00m): hoy los nombres de componentes se parten en 3 renglones, inputs pegados a la derecha, todo en una columna que obliga a scrollear ~3 pantallas, y la fórmula es una línea apretada.

## 2. Decisiones aprobadas

1. **Editor de receta a pantalla completa**, 2 columnas (reemplaza/convive con el panel lateral).
2. **Fila fantasma inline** para agregar componentes: escribís → busca insumo/receta → Enter → cantidad → Enter. Sin modales.
3. **Recibo real + marcador "pendiente"** (cero cálculo en el front):
   - El recibo muestra siempre los números del **último Recalcular** (cache del item).
   - Al tocar cantidad/MO/VU/margen o agregar/quitar componente → los pasos `Costo fab` en adelante se marcan "pendiente" (atenuados), el headline de precio se atenúa y el botón Recalcular se pone naranja (`showDirty()` ya existe).
   - El **Costo MP** total SÍ se actualiza en vivo (es una suma de subtotales — `recalcTotal` ya lo hace).
   - Al apretar **Recalcular** corre la RPC (`_recalcularUnaReceta`) y el recibo se completa. **Ninguna multiplicación de precio en JS.**
4. **Quick-edits de 2 clics** en la tabla vía popover (reusa el patrón de `.costos-mf-dropdown`):
   - Insumos: Clasificación · Categoría · Tipo amort.
   - Recetas: Rubro · Tipo (propio/subalq, con su confirmación) · Cotizable.
5. **Convivencia:** dejar el panel lateral actual funcionando hasta validar el editor nuevo en prod; después bajar el que sobre. Cero riesgo de quedarse sin edición.

## 3. Layout — editor PROPIO (cascada completa)

- **Header (ancho completo):** nombre editable (grande) · meta row (código, rubro, toggle Propio/Subalq.) · a la derecha "PRECIO ACTUAL" grande en turquesa + botón cerrar.
- **Columna izquierda (1.22fr):** "Componentes de la receta" — tabla con nombre completo en un renglón + badge tipo (🔹 insumo / ⚛️ sub-receta violeta) + código, cantidad inline, costo unit., subtotal, quitar. **Fila fantasma** al final. Barra "Costo MP (con desperdicio)" + nota "(sin desp: …)".
- **Columna derecha (1fr):**
  - "Mano de obra y amortización": Minutos de fabricación · VU del armado (regla 1:N) · Margen % (override).
  - "Resultado" = **recibo vertical** (el hero), un paso por renglón:
    `Costo MP → + Mano de obra (min × hora taller) → = Costo fabricación → ÷ VU armado → + indirectos (30% s/ MO) → = Costo por uso → × margen (1 + n%) → Precio alquiler`.
  - "Snapshot al recalcular" colapsable (indirectos / margen global / hora taller, con marcador ● desfasado).
- **Footer:** Recalcular precio (turquesa → naranja si dirty) + "● cambios sin recalcular" + Eliminar (zona peligro).

## 4. Layout — editor SUBALQUILADO (simple)

Igual al propio pero **anula** MO, amortización, indirectos y hora taller. Columna derecha liviana:
- "Subalquilado · margen + proveedor": Margen sobre costo (%) + Proveedor (combobox catálogo `proveedor`).
- Recibo reducido: `Costo MP → × margen (1 + n%) → Precio alquiler`.
- El margen es `item.margenSubalquiler` (NO el global). Costo MP = suma componentes **sin desperdicio**.
- Bloque que tacha explícitamente lo que no aplica (didáctico).
- Snapshot mínimo (solo margen aplicado).

## 5. Ficha de Insumos

Mismo tratamiento visual (bloques, recibo no aplica). Quick-edits desde la tabla cubren lo más usado; la ficha completa (a pantalla completa o panel) para datos/costo/proveedor/amortización/notas/historial.

## 6. Mecánicas (reuso de lo existente)

- **Popover quick-edit:** reusa la mecánica de `_attachFilterListeners` / `.costos-mf-dropdown`. Guarda con `API.updateInsumo` / `API.updateCatalogoItem`, flash de confirmación, sin recargar la tabla. El precio inline de insumos (`.costos-price-cell`) ya existe.
- **Fila fantasma:** reusa `API.addRecetaComponente` + validación anti-ciclo (`API.validarNoCiclo`) + aviso de insumo sin VU (`_insumoSinVU`). Solo cambia el envoltorio (inline en vez de modal). Los modales actuales (`_openAddInsumoModal` / `_openAddRecetaModal`) pueden quedar como fallback.
- **Editor full-screen:** montar el mismo HTML de `_loadRecetaContent` / `_openRecetaFicha` en el body de un modal en vez de `#costosPanelInner`. Los handlers buscan por **ID global** (`getElementById`) → funcionan igual sin tocar lógica. Nunca hay 2 fichas abiertas a la vez → no colisionan los IDs.
- **Pending:** reusar `showDirty()` + botón naranja existentes. El recibo no recalcula precio; solo marca pasos. `_recalcularUnaReceta` (RPC) es el único que cierra el ciclo.

## 7. Cambios técnicos

- **`MEPEX_COMPONENTS.css`:** agregar `.modal--xl` y/o `.modal--full` (hoy solo `sm 400 / md 560 / lg 780`). `Modal.open({ size })` ya soporta cualquier sufijo.
- **`costos.js`:**
  - Popovers en `_renderInsumosTable` y `_renderRecetasTable` (celdas badge → menú flotante).
  - Editor montado en modal (reusar `_loadRecetaContent`).
  - Fila fantasma en el render de componentes de `_loadRecetaContent`.
  - Estado "pendiente" en el recibo (`_renderCacheResultBlock`).
- **`style.css`:** clases nuevas del editor 2-col, recibo vertical, popover quick-edit.
- Bump `costos.js?v=` en `index.html`.

## 8. Reglas a preservar (checklist)

RPC `calcular_receta` única fuente de cálculo · snapshots por item · propio vs subalquilado · VU armado duro 1:N · margen propio / margen subalquiler override · overrides nullables (vacío → null, no 0) · cambio de tipo con confirmación (no recalcula) · cascada al cambiar precio de insumo (`_confirmAndCascadeInsumo`) · BOM jerárquico expandible · aviso insumo sin VU · markup vs margen (convención). **Todo vive en `persist()` / `_recalcularUnaReceta()` / la RPC — independiente de dónde esté el DOM.**

## 9. Orden de implementación

- **F1 — Quick-edits inline en la tabla** (popovers). Validar con Fede.
- **F2 — Editor de receta a pantalla completa** + fila fantasma + recibo pendiente (propio). Validar.
- **F3 — Variante subalquilado** + ficha de Insumos + pulido visual transversal. Validar.

## 10. Referencias

- Renders interactivos aprobados: sesión 2026-06-12 (mockups `costos_redesign_mockup`, `costos_editor_receta_v2`, `costos_editor_subalquilado`).
- Estado real verificado en prod (`http://195.200.1.250/#costos`): tab Insumos (79), Recetas (226), editor de "Vitrina mostrador 1,00m" (propio, VU armado 5).
- Modelo de costeo: `CLAUDE.md` §6.5. Código actual: `costos.js` (~4010 líneas).
