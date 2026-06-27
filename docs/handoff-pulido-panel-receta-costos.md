# Handoff — Pulido del panel de Receta (módulo Costos)

> Sesión aparte. Pantalla: **Costos → tab "Recetas y Costos" → panel de un ítem** (ej. `Vitrina mostrador 1,00m / VMB-080`). Método: skill `pulir-pantallas` (mostrar render real → indicación → aplicar en vivo → verificar por `preview_eval` → commit). **JS puro, sin SQL.** Bumpear `costos.js?v=` en `index.html` al cerrar.

## Estado actual
El panel está **bien** (≈85%): facha MEPEX clavada (dark + turquesa + mono), receta a la izquierda, "armado del ítem" a la derecha (MO/amortización → snapshot → fórmula), CTA naranja cuando hay cambios. **No es un rediseño** — es pulido + 1 fix de UX real.

## Dónde vive el código (`costos.js`)
| Pieza | Función | Línea aprox. |
|---|---|---|
| Panel full-screen (contenedor) | render del ítem, `panel.classList.add('costos-panel-full')` | ~2124 |
| Label izquierdo "Costo MP (con desperdicio)" (VIVO) | tabla de componentes | ~2369 |
| Bloques config derecha (MO + Recalcular) | `_renderRecetaConfigBlocks` | ~2716 |
| Botón "Recalcular precio" | dentro de config | ~2728 |
| Snapshot card + `● desfasado` | `_renderSnapshotsBlock` | ~2846 / ~2929 |
| **Fórmula / recibo (NÚMEROS STALE)** | `_renderCacheResultBlock` | ~2958 |
| Header recibo `● pendiente de recalcular` | dentro de `_renderCacheResultBlock` | ~2962 |
| Lógica `showDirty()` (tag + botón naranja) | `_attachRecetaConfigEvents` | ~3021 |
| Marcar pendiente al cambiar cantidad | handler de cantidad | ~3347 |

Los valores del recibo salen del **cache de la RPC `calcular_receta`** (`item.costoFabricacion`, `item.costoPorUso`, `item.precioAlquiler`). El "vivo" de la izquierda se recomputa en JS desde los componentes. Por eso pueden diferir cuando hay edits sin recalcular.

## Cambios propuestos (priorizados)

### 1. ⭐ Unificar el estado "desactualizado" (el fix real)
Hoy: cuando está *dirty*, la Fórmula muestra números viejos (ej. `Costo MP $234.700,75` vs vivo `$18.498,59`) y el `PRECIO ACTUAL` del header sigue mostrándose firme. Confuso y riesgoso.
- Cuando hay cambios sin recalcular: **atenuar/blur toda la caja `#costosRecibo`** (opacity ~0.4 + `pointer-events` off) con un overlay chico "Valores del último recálculo — apretá Recalcular para actualizar".
- Un **único banner de estado** arriba del panel ("⚠ Precio desactualizado — Recalcular") que sea la fuente de la verdad del estado y enlace/scrollee al botón. Que las 3 señales actuales (`● desfasado`, `● pendiente`, botón naranja) deriven de ese mismo estado, no convivan sueltas.
- Engancha con `showDirty()` (~3024): hoy muestra el tag y pinta el botón; sumarle el blur del recibo + el banner.

### 2. Marcar el `PRECIO ACTUAL` del header cuando está stale
El `$93.880,30` del header es el cache. Si está pendiente de recalcular, mostrarlo **tenue/tachado** o con chip "sin recalcular" para que no se lea como precio firme.

### 3. Desambiguar los dos "Costo MP"
Izquierda "Costo MP (con desperdicio)" = vivo; derecha (Fórmula, ~2972/3010) "Costo MP" = del último recálculo. Mismo label, números distintos. Renombrar el de la Fórmula a **"Costo MP (último recálculo)"** o unificar criterio.

### 4. Consistencia de filas de componente
La fila "Cerradura serrucho" trae badges inline (`VU·d·r`) que las demás no muestran → o se muestran en todas (colapsados) o se sacan de esa. Que el patrón de fila sea uniforme.

### 5. (Menor) Mini-breadcrumb del precio en el header
El desglose MP → fab → uso → ×margen → precio vive abajo a la derecha. Un mini-resumen del precio en el header ayuda a leerlo de un vistazo. Opcional.

## Fuera de alcance (son DATOS/operación, no UI)
- `Minutos de fabricación = 0` en la vitrina mostrador (raro para algo con puertas/vidrio/cerradura) → cargar MO real.
- Cache stale `$234.700,75` → apretar Recalcular precio. Verifica que post-recalc el recibo iguale al vivo.

## Verificación
`preview_eval` (los screenshots/PDF cuelgan el headless — verificar por DOM/estado, no por captura). Casos: ítem limpio (sin blur, sin banner), editar cantidad → aparece banner + blur del recibo + header marcado, Recalcular → todo vuelve a firme y los dos Costo MP coinciden.
