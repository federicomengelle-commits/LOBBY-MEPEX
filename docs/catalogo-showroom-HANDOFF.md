# 🗂️ Catálogo Showroom — HANDOFF FINAL (2026-06-23)

> Para **retomar en una charla nueva**. El módulo está **HECHO + verificado en prod**. Lo único pendiente grande = **cargar las fotos** (cuando Fede junte el contenido; algunas serán renders). El "sistema" para recibirlas **ya está listo y probado** — no hace falta construir nada, solo ejecutar el runbook de abajo cuando haya carpeta.
>
> Spec técnico detallado: `docs/catalogo-showroom-MONSTER-spec.md`.

---

## ✅ HECHO Y VERIFICADO EN PROD (via Chrome, con cleanup que restauró exacto)

`catalogo.js?v=9` · `api.js?v=55` · `sql/catalogo_showroom_f1.sql` (corrido). Commits: `fae989f` (F1) · `b552727` (F2+F4) · `172c94d` (arquitectura) · `0d78247` (handoff).

| Fase | Qué |
|---|---|
| **F1** | capa `api.js` (10 métodos foto/rich) + **subida real de fotos** (comprime → bucket público → fila) + ficha rica editable |
| **F2** | **galería de cards** + **ficha full-screen** (galería + lightbox + nav) + toggle grid/tabla |
| **F4** | **export PDF propuesta** branded (selección múltiple → A4 con foto + ficha por ítem) |
| **Arq.** | showroom = cara de la lista de precios · **no crea ítems** · filtro cotizables + toggle "Todos" · aire 30px |

**Probado end-to-end en prod (item 60, restaurado exacto):** campos ricos persisten · foto → bucket → **URL pública 200** · ficha muestra los datos · PDF genera OK · filtro default = **9 cotizables** · toggle "Todos" = 226 · sin botón crear · **0 errores de consola**.

---

## 🧭 ARQUITECTURA (decidido con Fede — NO re-litigar)

- **`catalogo_items` ES la tabla de recetas/lista de precios.** Showroom y Costos = **dos vistas de la MISMA fila**. NO hay doble fuente. La "correlación" = el mismo `id`.
- **Costos = el MOTOR** (alta de ítems + receta + `precio_alquiler` + `es_cotizable` + snapshots). **Catálogo = la CARA** (fotos · `descripcion_larga` · `colores` · `ficha_tecnica` · medidas) + muestra + PDF. **El catálogo NUNCA crea ni borra ítems.**
- Muestra `es_cotizable` (lista de precios) por default + toggle "Todos" para enriquecer no-cotizables.
- **Fotos en Supabase Storage** (bucket público `catalogo`), NO hotlink de Drive. Precio read-only desde Costos.

---

## ⏳ EL ÚNICO PENDIENTE GRANDE: las FOTOS

El módulo **ya está listo para recibirlas**; falta el contenido (Fede lo junta después). **El farmeo NO necesita código nuevo** — `API.uploadCatalogoFoto(itemId, file)` y `API.addCatalogoFoto(itemId, {url,...})` ya existen y están probados (upload + URL pública 200 verificados hoy).

### Decisión del farmeo (planeada con DATOS REALES el 2026-06-23):

- ❌ **NO farmeo por código.** Verificado: los códigos están sucios (espacios inconsistentes — `ALF-001` vs `ALF- 003`; **44 ítems + 2 cotizables SIN código**) y las fotos de Drive **no están nombradas por código** (son "DSC_0048.JPG", nombres de cámara/descriptivos). Hacerlo por código = renombrar todas las fotos + limpiar todos los códigos = **mucha config que solo rinde a gran escala**. Descartado.
- ✅ **SÍ: carpeta dedicada + match SEMÁNTICO por nombre (lo hace Claude).** Para pocos ítems es más robusto que el string por código y **casi cero config** para Fede.

### 📋 RUNBOOK del farmeo (ejecuta Claude — plug-and-play cuando Fede dé la carpeta):

1. **Fede:** arma **UNA carpeta dedicada** en Drive con las fotos de producto (algunas serán renders). Nombres **descriptivos libres** ("alfombra nueva.jpg", "panel blanco 2,50.jpg") — **sin código, sin convención estricta.** ⚠️ *Carpeta dedicada por PRIVACIDAD: el Drive de Fede tiene escaneos de DNI y cosas personales mezcladas — Claude solo debe ver la carpeta de productos.*
2. **Claude:** `search_files parentId='<folderId>'` (Drive MCP, ya probado el acceso) → lista las fotos.
3. **Claude:** matchea cada foto al ítem del catálogo **por nombre, semánticamente** → arma tabla `foto → ítem`.
4. **Fede:** confirma/corrige el mapeo.
5. **Claude:** por cada foto → `download_file_content` (Drive, base64) → inyecta al browser (Chrome MCP) → `File` → `API.uploadCatalogoFoto(itemId, file)` (comprime + bucket + fila). Idempotente.
6. **Dry-run con 1 foto primero**, confirmar que se ve, y recién ahí cargar todas.

---

## 🏷️ Tareas paralelas de FEDE (en Costos — independientes, cuando quiera)
- **Tildar más ítems como cotizables** (hoy solo 9 de 226) → así el showroom se puebla.
- (Opcional) **cargar/limpiar códigos** (44 sin código, espacios inconsistentes). **El farmeo NO lo necesita** (va por nombre), pero sirve para el cotizador y el orden general.

## 🔧 Otros pendientes (menores / opcionales)
- **F3 fino:** drag-reorder de fotos en la ficha + editar `alt` (los métodos base `API.reorderCatalogoFotos`/`updateCatalogoFotoAlt` ya existen; falta cablear el drag).
- **Pasada de marca / pulido visual** (skill `pulir-pantallas`).
- **CLAUDE.md §10 + PROGRESO/PLAN:** no se rebalancearon esta sesión (árbol compartido con otras charlas, para no colisionar). El estado canónico vive en este handoff + la memoria `project_catalogo_showroom`.

---

## 🚀 ARRANQUE DE LA CHARLA NUEVA
1. Leer este handoff + memoria `project_catalogo_showroom`.
2. **Si Fede trae la carpeta de Drive → ejecutar el RUNBOOK del farmeo** (pasos 1-6, dry-run con 1 foto primero). Es lo de mayor valor.
3. Si no → F3 fino, pasada de marca, o lo que Fede priorice.
4. **Reglas duras:** NO tocar Costos/costeo · NO reintroducir creación de ítems en el catálogo · fotos siempre a Supabase (no hotlink Drive) · carpeta de Drive dedicada (privacidad).
