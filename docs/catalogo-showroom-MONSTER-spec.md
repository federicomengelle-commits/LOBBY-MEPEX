# 🗂️ CATÁLOGO SHOWROOM — SPEC MONSTRUO (one-shot build)

> **Qué es esto:** el plan de construcción COMPLETO y autosuficiente para elevar `catalogo.js` (hoy vitrina vieja) a un **showroom online = fuente de verdad** de los ítems comerciales de MEPEX (fotos múltiples · colores · ficha técnica · medidas · export PDF), consumido por el cotizador externo y un futuro generador de propuestas.
>
> **Cómo se generó:** workflow ultracode — 7 agentes de reconocimiento del código real → 10 secciones cada una pasada por *autor → reviewer adversarial* → crítica de completitud global → resolución verificada a mano. Todo el código está groundeado contra el repo real (sin APIs inventadas).
>
> **Cómo usarlo (one-shot):** pegale a una instancia de Claude Code el **PROMPT DE ARRANQUE de la §9** + este documento entero. Construye F1→F4 en orden. **SQL-first:** el SQL de la F1 (`sql/catalogo_showroom_f1.sql`) ya está escrito y Fede lo corre ANTES de pushear JS.
>
> **Sesión:** 2026-06-22 · branch `rediseno` · 28 agentes · ~3.7M tokens.

---

## ⚠️ §00 — LEER PRIMERO: RESOLUCIONES NORMATIVAS (OVERRIDE)

> Estas resoluciones **prevalecen sobre cualquier contradicción** en las secciones de abajo. Salieron de la auto-crítica de completitud (Apéndice A) + verificación manual contra el código real. Si una sección dice algo distinto a esto, **gana §00.**

### 🔴 R0 (P0-1/P0-2) — COLISIÓN DE NOMBRES EN `api.js` → PASO 0 OBLIGATORIO DE F1 (verificado a mano)

**Hecho verificado contra el código (no asumir, ya confirmado):**
- `api.js` es **un solo** object literal `const API = {` (línea 9) que cierra en `};` (línea 6330). Todo es un mismo objeto.
- `create/update/deleteCatalogoItem` están definidos **DOS VECES** como propiedades hermanas del mismo objeto:
  - **Bloque #1** (líneas ~1681 / 1705 / 1765) → escriben en **`catalogo_items`** (con UndoHelpers + `clearCache()` + mapeo camelCase→snake_case). **Es el que el showroom y Costos QUIEREN.**
  - **Bloque #2** (líneas ~5716 / 5722 / 5726, bloque del módulo Rendimiento) → escriben en **`evento_costo_catalogo`** (raw `update(patch)`).
- Por **last-key-wins** de JS, hoy **gana el bloque #2** → `API.updateCatalogoItem` escribe en `evento_costo_catalogo`. ⇒ **`catalogo.js` y `costos.js` están escribiendo en la tabla equivocada AHORA MISMO** (bug latente desde que se creó Rendimiento, 2026-06-18). Editar el bloque #1 sin arreglar esto = "guardar en código muerto".

**Call-sites verificados (grep ya corrido):**
- `catalogo.js`: 571 (create), 639 (update), 672 (delete) → quieren `catalogo_items`.
- `costos.js`: 470, 901, 1890 (create), 2176, 2224, 3054, 3145, 3163 (delete) → quieren `catalogo_items`.
- `rendimiento.js`: 743 (delete), 789 (update), 790 (create) → quieren `evento_costo_catalogo`.
- `api.js` internos (`this.updateCatalogoItem`): 1912, 1976, 3028, 3353 (snapshots de recetas) → quieren `catalogo_items`.

**FIX — PASO 0 de F1, ANTES de tocar nada más en `api.js`:**
1. Correr `grep -rn "API\.\(create\|update\|delete\)CatalogoItem" *.js` y confirmar que los únicos consumidores son los de arriba (catalogo.js + costos.js + rendimiento.js). Si aparece otro, frenar y reportar.
2. En `api.js`, **renombrar el bloque #2** (≈5716/5722/5726, los de `evento_costo_catalogo`) a `createRendimientoCatalogoItem` / `updateRendimientoCatalogoItem` / `deleteRendimientoCatalogoItem`. (`getRendimientoCatalogo` en 5702 ya tiene nombre único — NO tocar.)
3. En `rendimiento.js`, actualizar los 3 call-sites: 743 `deleteCatalogoItem`→`deleteRendimientoCatalogoItem`, 789 `updateCatalogoItem`→`updateRendimientoCatalogoItem`, 790 `createCatalogoItem`→`createRendimientoCatalogoItem`.
4. Recién ahora las únicas `*CatalogoItem` vivas son las del bloque #1 (`catalogo_items`). **Todos los mapeos de campos ricos van en `updateCatalogoItem` de la línea ~1705 (la de `catalogo_items`), NO en la 5722.**
5. **Bonus real:** esto arregla de paso el bug latente de Costos (sus ediciones volverán a `catalogo_items`). Avisar a Fede — vale como fix propio aunque el showroom no avanzara.
6. Bumpear `api.js?v=52→53` y `rendimiento.js?v=4→5` (verificar el valor real en `index.html` antes — puede haber cambiado por sesión paralela).

### 🟠 R1 (P1-1/P1-2) — CONTRATO ÚNICO DE LA API DE FOTOS (nombres canónicos)

Las secciones de abajo usan nombres distintos para lo mismo. **Nombres canónicos NORMATIVOS** (si una sección usa otro, renombrar a estos):

| Función canónica | Qué hace |
|---|---|
| `getCatalogoFotos(itemId)` | fotos vivas de 1 ítem, **orden canónico `es_principal DESC, orden ASC, id ASC`** |
| `getCatalogoPortadas(itemIds[])` | portada por ítem para la grilla (1 query, misma regla de orden) |
| `uploadCatalogoFoto(itemId, file)` | comprime en canvas + sube al bucket `catalogo` + `getPublicUrl` + inserta fila |
| `addCatalogoFoto(itemId, {url, storage_path, alt})` | inserta fila de foto (orden = max+1; `es_principal=true` si es la 1ª) |
| `setCatalogoFotoPrincipal(itemId, fotoId)` | marca portada (desmarca las otras del ítem) |
| `reorderCatalogoFotos(itemId, orderedIds[])` | persiste `orden` |
| `deleteCatalogoFoto(fotoId)` | soft-delete `_deleted=true` + intenta remover el objeto del storage por `storage_path` |
| `updateCatalogoFotoAlt(fotoId, alt)` | edita la leyenda |

**Orden canónico de fotos en TODAS las lecturas:** `es_principal DESC, orden ASC, id ASC`.

### 🟠 R2 (P0-4) — REGLA DE CACHE (única, central)

- **Fotos = siempre frescas:** las lecturas de `catalogo_item_fotos` (`getCatalogoFotos`/`getCatalogoPortadas`) son query directa, **sin cache**.
- **Ítems = cache 60s:** `getCatalogoItems()` cachea. Tras CRUD de **`catalogo_items`** (crear/editar/borrar ítem) → `clearCache()` + `await getCatalogoItems()` para refrescar `_items`. Tras CRUD de **fotos** → **NO** hace falta `clearCache` de ítems (las fotos son tabla aparte); solo re-leer fotos del ítem afectado.

### 🟠 R3 (P0-3) — ALTA DE ÍTEM = "VACÍA" (decisión explícita)

`createCatalogoItem` (#1) **no** mapea los campos ricos (`descripcion_larga`/`colores`/`ficha_tecnica`/medidas) ni `disponible_publico`/`favorito`. **Decisión:** el alta crea el ítem básico; **los campos ricos se cargan después en la ficha** (F3, vía `updateCatalogoItemRich`). NO extender `createCatalogoItem`. El test de la §8 **no** debe verificar campos ricos a través del alta.

### 🟠 R4 (P1-4) — CONTRATO FICHA F2 ↔ F3 (un solo modelo)

F3 (edición) es la versión final. Para que F2 y F3 no choquen:
- El render de la ficha se llama **`_renderFichaView`** (no `_renderFicha`), y F2 ya expone **`_rerenderFicha()`** desde el arranque (aunque F2 todavía no edite).
- El botón **"Editar"** entra a **modo edición INLINE en la ficha** (`_fichaEditMode`), **NO** abre modal. (El único modal de edición permitido es el de alta "Nuevo ítem" y micro-acciones como editar `alt` de una foto.)
- F2 construye desde ya los hooks que F3 necesita; F3 solo agrega el modo edición.

### 🟢 R5 (P1-3 / P2) — VERSIONES `?v=` REALES (verificadas en `index.html`)

Valores actuales: `api.js?v=52` · `catalogo.js?v=5` · `rendimiento.js?v=4` · `costos.js?v=32`. Ignorar cualquier número distinto en las secciones (ej. el `?v=2` fantasma). Plan de bumps: **F1** api→53, rendimiento→5, catalogo→6 · **F2** catalogo→7 · **F3** catalogo→8 (+api si se agregan métodos) · **F4** catalogo→9. **Siempre re-leer el valor real en `index.html` antes de bumpear** (puede cambiar por sesión paralela). `colores` vacío se guarda como `null` (consistente con la columna sin default); el lectura lo normaliza a `[]`.

---


# ÍNDICE DE SECCIONES

- §0 · Overview, arquitectura y decisiones
- §1 · Modelo de datos + SQL (F1)
- §2 · Capa API (api.js)
- §3 · F2 Showroom UI (galeria + ficha del item)
- §4 · F3 Edicion rica + manejo de fotos
- §5 · F4 Export PDF (catalogo / propuesta branded)
- §6 · Farmeo Drive -> Supabase (migracion puntual)
- §7 · Registro, permisos y gotchas
- §8 · Verificacion end-to-end en prod + plan de pruebas
- §9 · Orden de ejecucion one-shot + commits + PROMPT para Claude Code
- Apéndice A — Auto-crítica de completitud (informe del reviewer global)
- Apéndice B — Ground truth (código real verificado · referencia)


---

# 0 · Overview, arquitectura y decisiones

I have everything I need. Key discrepancies between the borrador and the actual SQL file that must be reconciled (the borrador inlines DDL that differs from the real file Fede will run — e.g. `ficha_tecnica jsonb DEFAULT '[]'` not bare `jsonb`, `orden NOT NULL DEFAULT 0`, policy names `catalogo_item_fotos_auth`/`_anon` not the borrador's invented `_auth_all`/`_anon_select`, and the storage DELETE policy is admin-gated not "any authenticated"). I'll reference the file as the source of truth rather than re-inventing DDL.

Now the corrected section:

---

# 0 · Overview, arquitectura y decisiones

> **Módulo:** Catálogo Showroom · **Archivo:** `catalogo.js` (refactor in-place — objeto global existente `CatalogoModule`, misma ruta `#catalogo`, mismo `module:'catalogo'`)
> **Naturaleza:** elevación de la vitrina vieja (tabla simple) a **fuente de verdad comercial** con galería, ficha rica, media en Storage y export de propuestas PDF.
> **Riesgo a costeo/cotizador/RLS:** cero por diseño (todo aditivo). Ver §0.5 *Qué NO romper*.

---

## 0.1 · Objetivo

Hoy `catalogo.js` (objeto global **`CatalogoModule`**, definido en `catalogo.js:10`) es una **vitrina muerta**: tabla `cat-table` con campos planos (nombre/código/rubro/categoría/origen/unidad), tabs Stands/Eventos que **no filtran nada** (`catalogo.js:184-186`, ambos muestran todo) y un campo `foto` que **apunta a la nada** — la columna no existe en `catalogo_items` (verificado contra schema-prod) y el botón "editar foto" solo dispara `Toast.info('próximamente')` (`catalogo.js:687-689`). Media = greenfield total: nada que migrar.

El objetivo es convertirlo en el **SHOWROOM ONLINE que es la FUENTE DE VERDAD de los items comerciales de MEPEX**: cada item con fotos reales (en Supabase Storage), descripción larga, colores, ficha técnica y medidas, navegable como galería, y desde donde se **exportan propuestas PDF branded por cliente**. El precio sigue saliendo de Costos (read-only); el catálogo agrega la **capa de presentación/media** que hoy no existe.

Esto **no** es un módulo nuevo: es la misma `catalogo_items` (la tabla que ya alimenta costeo y cotizador), enriquecida con columnas aditivas + una tabla satélite de fotos.

---

## 0.2 · Arquitectura: las 3 capas

```
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA 3 — IA EN EL MEDIO                          (FUTURO · OUT)       │
│  Generación asistida de propuestas, redacción de descripciones,       │
│  match item↔necesidad del cliente. Requiere API keys. FUERA de F1-F4. │
└─────────────────────────────────────────────────────────────────────┘
                              ▲ consume
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA 2 — EXPORT / PROPUESTAS                     (F4 · IN)            │
│  Generador de propuestas PDF branded por cliente (jsPDF + autotable). │
│  Reusa la maquinaria PDF de costos.js / finanzas.js / remito-pdf.js.  │
└─────────────────────────────────────────────────────────────────────┘
                              ▲ lee
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA 1 — BACKBONE DE DATOS + SHOWROOM           (F1-F3 · IN)         │
│  catalogo_items enriquecida (descripcion_larga, colores[],            │
│  ficha_tecnica jsonb, frente/profundidad/alto_cm) + tabla             │
│  catalogo_item_fotos + bucket público 'catalogo' en Storage.          │
│  UI: galería, ficha rica, edición admin, manejo de fotos.            │
│  precio_alquiler READ-ONLY (sale de Costos vía RPC calcular_receta).   │
└─────────────────────────────────────────────────────────────────────┘
```

### Consumidores de la fuente de verdad

```
                    ┌──────────────────────────┐
                    │      catalogo_items       │  ← FUENTE DE VERDAD
                    │   (+ catalogo_item_fotos) │
                    └────────────┬─────────────┘
                                 │
          ┌──────────────────────┼───────────────────────┐
          │ lee directo          │ lee (esta iniciativa)  │ lee (futuro)
          ▼                      ▼                        ▼
┌───────────────────┐  ┌──────────────────┐   ┌────────────────────────┐
│ COTIZADOR EXTERNO │  │ SHOWROOM (F2/F3) │   │ GENERADOR DE PROPUESTAS │
│ app Vercel        │  │ catalogo.js      │   │ (Capa 3, FUTURO)        │
│ filtra            │  │ galería + ficha  │   │                         │
│ es_cotizable=TRUE │  │ + export PDF(F4) │   │                         │
│ lee precio_       │  │                  │   │                         │
│ alquiler          │  │                  │   │                         │
│ → NO SE TOCA      │  │                  │   │                         │
│   (consumer)      │  │                  │   │                         │
└───────────────────┘  └──────────────────┘   └────────────────────────┘
```

> **Punto crítico:** el cotizador externo (`cotizador-mepex.vercel.app`) **ya lee** `catalogo_items` directo (filtra `es_cotizable=TRUE`, lee `codigo`/`nombre`/`precio_alquiler` — CLAUDE.md §6.5). MEPEX **no orquesta** esa sync. El showroom es un **consumer paralelo**. Toda columna aditiva es invisible para el cotizador (selecciona columnas puntuales). Cero acoplamiento.

---

## 0.3 · Log de decisiones cerradas

Firmes. No re-litigar en implementación.

### D1 — Modelo de datos: aditivo, satélite para fotos

Una tabla nueva `catalogo_item_fotos` (1:N) + columnas aditivas nullable en `catalogo_items`. **Nada se borra, nada se renombra.** Postgres no rompe lecturas existentes al agregar columnas; las queries de cotizador/costos seleccionan columnas explícitas.

> **El DDL ya está escrito y es la única fuente de verdad del schema: `sql/catalogo_showroom_f1.sql`.** Fede lo corre en el SQL Editor **antes** de pushear JS (SQL-first). No re-tipear el DDL en otra parte: si hay que citarlo, citar el archivo. La forma real que aplica (resumen, no para copy-paste — el archivo manda):
>
> - `ALTER TABLE catalogo_items ADD COLUMN IF NOT EXISTS`: `descripcion_larga text`, `colores text[]`, `ficha_tecnica jsonb DEFAULT '[]'::jsonb`, `frente_cm numeric`, `profundidad_cm numeric`, `alto_cm numeric`. **Ojo:** `ficha_tecnica` tiene `DEFAULT '[]'::jsonb` → un item sin ficha cargada llega como **array vacío `[]`, no `null`** (igual hay que defender contra `null` en items pre-existentes a la migración / inserts crudos; ver §0.4 edge cases).
> - `catalogo_item_fotos`: `id bigint GENERATED ALWAYS AS IDENTITY PK`, `item_id bigint NOT NULL REFERENCES catalogo_items(id) ON DELETE CASCADE`, `url text NOT NULL`, `storage_path text`, `orden int NOT NULL DEFAULT 0`, `es_principal boolean NOT NULL DEFAULT false`, `alt text`, `created_at timestamptz NOT NULL DEFAULT now()`, `_deleted boolean NOT NULL DEFAULT false`. Índice parcial `idx_catalogo_item_fotos_item ON (item_id) WHERE NOT _deleted`.
>
> `catalogo_items.id` es **BIGINT** (verificado). `ON DELETE CASCADE` cubre el hard-delete del item padre; el flujo normal de borrado de fotos es **soft delete** (`_deleted=true`) filtrado en lectura.

### D2 — Supabase Storage (bucket público `catalogo`), NO hotlink de Drive

Las fotos viven en Supabase Storage, bucket **público** `catalogo` (creado por el SQL F1 vía `INSERT INTO storage.buckets ... ON CONFLICT DO UPDATE`, con `file_size_limit=10485760` (10 MB) y `allowed_mime_types = {image/jpeg,image/png,image/webp,image/heic,image/avif}`). **No** se hotlinkean imágenes de Drive en runtime.

**Por qué Drive NO sirve en runtime:** links `uc?id=`/`embeddedfolderview` inestables como `<img>`, rate-limited, y **CORS** al bajarlos a `<canvas>` para el PDF (jsPDF) → el export (F4) **necesita** bytes mismo-origen o CORS abierto. El bucket público resuelve; Drive no.

**Rol de Drive:** fuente de **origen** para un **farmeo Drive→Supabase en lote**, que corre **Claude como migración puntual** (script one-off vía tools MCP de Drive + `supabaseClient.storage`), **NO la app**. Alta suelta diaria = drag-drop dentro del módulo (F3).

> **Regla dura:** ningún código de `catalogo.js` construye, fetchea ni renderiza URLs de `drive.google.com`.

**Patrón de Storage (copy-paste, bucket público) — con validación de mime y tamaño (el bucket los rechaza, pero hay que dar feedback antes de gastar el upload):**

```javascript
// catalogo.js (F1/F3). `blob` es JPEG comprimido en cliente (ver §storage del brief: _downscaleImage → fetch(dataUrl).blob()).
const ALLOWED_MIME = ['image/jpeg','image/png','image/webp','image/heic','image/avif'];
const MAX_BYTES = 10 * 1024 * 1024;

if (!ALLOWED_MIME.includes(blob.type)) { Toast.error('Formato no soportado (usá JPG/PNG/WebP).'); return; }
if (blob.size > MAX_BYTES)            { Toast.error('La imagen supera 10 MB.'); return; }

// Nombre seguro + único: evita colisiones y caracteres raros que rompen el path de Storage.
const safeName = (origName || 'foto.jpg').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
const storagePath = `item_${itemId}/${Date.now()}_${safeName}`;

const { error: upErr } = await supabaseClient.storage
    .from('catalogo')
    .upload(storagePath, blob, { contentType: blob.type || 'image/jpeg', upsert: false, cacheControl: '3600' });
if (upErr) { Toast.error('No se pudo subir la foto: ' + upErr.message); return; }

const { data: pub } = supabaseClient.storage.from('catalogo').getPublicUrl(storagePath);
const publicUrl = pub?.publicUrl || null;   // permanente, sin firma → usable en <img> y en jsPDF
if (!publicUrl) { Toast.error('No se pudo obtener la URL pública.'); return; }
// → recién acá insertás la fila en catalogo_item_fotos (ver F1/F3) usando { item_id, url: publicUrl, storage_path: storagePath, ... }
```

> Bucket público ⇒ `getPublicUrl()` (URL permanente). **No** usar `createSignedUrl()` (eso es para `remitos`/`comprobantes`, que son privados). La URL permanente es lo que habilita el PDF (F4) sin CORS ni expiración.

### D3 — RLS: espejo de `catalogo_items` (ya en el SQL F1)

`catalogo_item_fotos` con RLS habilitado y policies **espejo** (definidas en `sql/catalogo_showroom_f1.sql`, nombres reales **`catalogo_item_fotos_auth`** y **`catalogo_item_fotos_anon`**):

- `authenticated FOR ALL USING(true) WITH CHECK(true)`
- `anon FOR SELECT USING(true)`

Las policies del **bucket** (`storage.objects`, también en el F1) son: read abierto a `anon,authenticated`; INSERT/UPDATE para cualquier `authenticated`; **DELETE solo `admin`/`superadmin`** (`auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','superadmin'))`).

> **Implicancia para el módulo:** un `venta`/`pm` (authenticated) podría técnicamente **insertar** filas/objetos por RLS, pero el gating de escritura es **del frontend** vía `Data.isReadOnly(role, 'catalogo')` — exactamente como ya hace la vitrina vieja (`catalogo.js:59-60`). El **borrado de objetos en Storage** está bloqueado por RLS para no-admins: si un `venta`/`pm` (que igual no debería ver el botón) intentara borrar una foto, el `storage.remove()` fallaría. El soft-delete de la fila en `catalogo_item_fotos` sí lo permite RLS (FOR ALL) → para no-admins esto dejaría un objeto huérfano en Storage. **No es un problema en la práctica** (los controles de borrado se gatean por `isReadOnly` y solo admin los ve), pero el flujo de borrado de fotos (F3) debe asumir que **solo admin lo ejecuta**. **No se agrega grant nuevo** a `roles.permissions`: `catalogo` ya es permiso existente.

### D4 — Read-only en precio (y en todo lo que sea costeo)

El showroom es **READ-ONLY en precio**. `precio_alquiler` se **muestra** pero **nunca se escribe** desde `catalogo.js`. Fuente de verdad: RPC `calcular_receta` invocada desde **Costos**.

**Implicancia concreta en el código (verificada):** `API.updateCatalogoItem(id, data)` (`api.js:1705-1763`) está construido con guardas `if (data.X !== undefined)` campo por campo — **no** hace spread del objeto. Por lo tanto, **mientras el showroom pase un payload con SOLO las claves de vitrina, es estructuralmente imposible que toque columnas de costeo.** El guard de implementación es: **nunca** llamar `updateCatalogoItem(id, {...item})` con el item entero (arrastraría `precioAlquiler`, `esCotizable`, snapshots, etc., que están mapeados en líneas 1721-1755). Siempre payload explícito y acotado a la whitelist de §0.5.

> Si en el futuro se quisiera un precio "de vitrina" distinto, se crea un campo NUEVO (`precio_showroom_override`) — **nunca** se pisa `precio_alquiler`. Fuera de alcance ahora.

### D5 — Refactor in-place, mismo objeto/ruta

Refactor **in-place** de `catalogo.js` (objeto `CatalogoModule`, ruta `#catalogo`, `module:'catalogo'`). **No** se crea archivo ni ruta nueva. Bump de `?v=` en `index.html` en cada toque del `.js`.

### D6 — Tabs Stands/Eventos: cosméticos, se resuelven o eliminan en F2

Los tabs actuales **no filtran nada** (`catalogo.js:184-186`). En F2 se decide: reutilizarlos como agrupador cosmético por `rubro` o eliminarlos a favor de filtros rubro/categoría. **No** se agrega campo `audiencia` a BD (acoplaría el cotizador a un concepto que no necesita). La galería F2 puede arrancar sin tabs. No bloquean nada.

---

## 0.4 · Alcance + cambios de API obligatorios

### Cambios de API que F1 DEBE incluir (gap que el SQL no cubre)

El SQL agrega las columnas, pero `api.js` **no las lee ni las escribe todavía** — sin esto, los campos nuevos son invisibles para el módulo. Es un blocker de one-shot. En F1, además del DDL:

1. **`getCatalogoItems()` (`api.js:1621-1679`):** usa `select('*')` (las columnas crudas llegan), pero el `.map()` a camelCase **no** las incluye. Agregar al objeto mapeado, defendiendo contra `null`:
   ```javascript
   // dentro del .map(i => ({ ... })) de getCatalogoItems
   descripcionLarga: i.descripcion_larga || '',
   colores:          Array.isArray(i.colores) ? i.colores : [],
   fichaTecnica:     Array.isArray(i.ficha_tecnica) ? i.ficha_tecnica : [],  // jsonb default '[]', pero items viejos pueden venir null
   frenteCm:         i.frente_cm ?? null,
   profundidadCm:    i.profundidad_cm ?? null,
   altoCm:           i.alto_cm ?? null,
   ```
2. **`updateCatalogoItem(id, data)` (`api.js:1705-1763`):** agregar el mapeo aditivo de los campos nuevos (manteniendo el patrón `!== undefined`), **sin** tocar nada existente:
   ```javascript
   if (data.descripcionLarga !== undefined) payload.descripcion_larga = data.descripcionLarga || null;
   if (data.colores !== undefined)          payload.colores = Array.isArray(data.colores) ? data.colores : null;
   if (data.fichaTecnica !== undefined)     payload.ficha_tecnica = Array.isArray(data.fichaTecnica) ? data.fichaTecnica : [];
   if (data.frenteCm !== undefined)         payload.frente_cm = (data.frenteCm === '' || data.frenteCm === null) ? null : parseFloat(data.frenteCm);
   if (data.profundidadCm !== undefined)    payload.profundidad_cm = (data.profundidadCm === '' || data.profundidadCm === null) ? null : parseFloat(data.profundidadCm);
   if (data.altoCm !== undefined)           payload.alto_cm = (data.altoCm === '' || data.altoCm === null) ? null : parseFloat(data.altoCm);
   ```
   > `createCatalogoItem` (`api.js:1681-1703`) **no** mapea los campos nuevos hoy. No es obligatorio que el alta de un item nuevo los cargue (se pueden agregar después en la ficha vía update), pero si F3 quiere crear con ficha rica, extender create con el mismo patrón.
3. **Helpers CRUD de fotos (nuevos en `api.js`):** `getFotosByItem(itemId)` (`.from('catalogo_item_fotos').select('*').eq('item_id', itemId).eq('_deleted', false).order('orden', { ascending: true })`), `createFoto(row)`, `updateFoto(id, patch)`, `softDeleteFoto(id)` (`update {_deleted:true}`), `setFotoPrincipal(itemId, fotoId)` (desmarca todas las del item y marca una — ver §concurrencia abajo), y `removeFotoStorage(storagePath)` (`supabaseClient.storage.from('catalogo').remove([storagePath])`, **solo lo invoca admin**). Reusar el patrón de `clearCache()` tras escrituras si la galería se cachea. **Nota:** estos helpers usan `supabaseClient` directo (no `UndoHelpers`) — las fotos no necesitan estar en el stack de undo del sistema, pero el borrado de item sí pasa por `deleteCatalogoItem` que ya es soft-delete con undo.

### IN (esta iniciativa, F1–F4, sin APIs externas)

| Fase | Entrega |
|------|---------|
| **F1** | DDL ya escrito (`sql/catalogo_showroom_f1.sql`) **+ los 3 cambios de `api.js` de arriba** + subida real de fotos (drag-drop → Storage → `catalogo_item_fotos`). Desbloquea cargar las fotos de ejemplo de Fede. |
| **F2** | Showroom: galería de items (cards con foto principal) + ficha (galería con lightbox, descripción larga, colores, ficha técnica, medidas, precio read-only). |
| **F3** | Edición rica (admin): editar campos nuevos + manejo de fotos (subir, borrar, reordenar, marcar portada). |
| **F4** | Export PDF branded por cliente (propuestas v1): seleccionar items → PDF con logo MEPEX, fotos, ficha, medidas, precio opcional. Reusa `_loadLogoForPDF`/autotable. |

### OUT (fuera de alcance ahora)

IA en el medio (Capa 3); integración fina/sync del cotizador; Gmail/WhatsApp; el farmeo Drive→Supabase como feature de la app (es script one-off de Claude); campo `audiencia` en BD; `precio_showroom_override` o cualquier precio editable.

### Edge cases que el módulo DEBE manejar (one-shot-grade)

- **Item sin fotos:** la card de galería muestra placeholder (emoji 📷 / "Sin imagen", como hoy en `catalogo.js:436-445`), **nunca** un `<img>` con `src` vacío/roto. La foto principal se resuelve como `fotos.find(f => f.es_principal) || fotos[0] || null`.
- **`colores` null o `[]`:** no renderizar la sección de chips (no mostrar "Colores:" vacío). Defender con `Array.isArray(item.colores) && item.colores.length`.
- **`ficha_tecnica` null / `[]` / entradas mal formadas:** filtrar entradas sin `label` o sin `valor` antes de renderizar; si queda vacío, ocultar la sección. Nunca `item.fichaTecnica.map(...)` sin checar Array.
- **Medidas null:** si las tres (`frenteCm/profundidadCm/altoCm`) son null, ocultar el bloque de medidas; si hay parciales, mostrar solo las cargadas (no "null cm").
- **Foto pesada / formato no soportado:** validar mime + 10 MB **antes** del upload (D2) y comprimir en cliente (canvas → JPEG, ver brief de storage) para no chocar contra `file_size_limit`.
- **Error de red en upload:** try/catch alrededor de `storage.upload` + `Toast.error`; **no** insertar la fila en `catalogo_item_fotos` si el upload falló (evita filas con `url` rota).
- **Rollback parcial:** si el upload a Storage sale OK pero el `insert` en `catalogo_item_fotos` falla, intentar `storage.remove([storagePath])` para no dejar objetos huérfanos, y avisar con `Toast.error`.
- **Concurrencia de portada (`setFotoPrincipal`):** marcar 1 sola `es_principal` es un read-modify-write (desmarcar todas → marcar una). Dos admins simultáneos podrían dejar 0 o 2 principales; es de bajísimo impacto (la UI resuelve `find(es_principal) || fotos[0]`). Mitigar haciendo el update en orden (primero `update {es_principal:false}` a todas las del item, luego `update {es_principal:true}` a la elegida) y recargando la galería del item tras la operación. No requiere lock.
- **CORS en F4 (PDF):** las imágenes salen del bucket público (mismo proveedor, CORS OK). Aun así, envolver cada `loadImage(url)` del PDF en try/catch y, si una foto falla, **omitirla y seguir** (no abortar el PDF entero) — patrón ya usado en `costos.js:1052-1090` (devuelve `null` y se chequea).
- **jsPDF/autotable/QR no cargados:** chequear `typeof window.jspdf`, `typeof doc.autoTable === 'function'` antes de generar (patrón `costos.js:1037`, `costos.js:1135`) y `Toast.error('Refrescá la página.')`.

---

## 0.5 · QUÉ NO ROMPER (contrato de interfaz — lista explícita)

> **Regla nuclear:** el showroom agrega capa de presentación. **Jamás** toca costeo ni el cotizador ni la RLS existente.

### Columnas de `catalogo_items` que el showroom NUNCA escribe (READ-ONLY absoluto)

Generadas por la RPC `calcular_receta` + snapshots de Costos:
```
precioAlquiler (precio_alquiler)   ← se MUESTRA, nunca se escribe
costoFabricacion (costo_fabricacion) · costoPorUso (costo_por_uso)
snapshotCostosAt (snapshot_costos_at)
snapshotPctIndirectosFabrica · snapshotPctMargen · snapshotHoraTallerArs
```

### Columnas que pertenecen SOLO a Costos (el showroom NUNCA las edita)
```
tipoReceta (tipo_receta)         ← define la fórmula
esCotizable (es_cotizable)       ← TOGGLE del módulo Costos (tab Listas); el cotizador filtra por esto
manoObraMinutos · margenPropio · margenSubalquiler · vidaUtilArmadoOverride
costoProduccion / costoManoObra / costoIndirectos   ← legacy, ignorados por la RPC
```

### La RPC y el cotizador
- **`calcular_receta(p_item_id BIGINT)`** — NO se llama, NO se modifica, NO se replica desde el showroom.
- **Cotizador externo** — lee `catalogo_items` directo (`es_cotizable=TRUE` → `codigo`/`nombre`/`precio_alquiler`). **No** depende de ninguna columna nueva. **No** se construye sync.

### Lo que el showroom SÍ escribe (whitelist de vitrina)
```
nombre, codigo, rubro, categoria, descripcion, origen, unidad,
descripcionLarga, colores, fichaTecnica, frenteCm, profundidadCm, altoCm   (camelCase del módulo)
+ filas en catalogo_item_fotos (CRUD de la galería)
```

> **Guard de implementación:** el update del showroom arma el payload con **whitelist explícita**, nunca con spread del item completo (ver D4). Como `updateCatalogoItem` ya es `undefined`-guarded campo por campo, un payload acotado es estructuralmente seguro — pero un `{...item}` accidental arrastraría READ-ONLYs mapeados en `api.js:1721-1755`. **Prohibido el spread.**

### RLS — no inventar policies ni grants
- Las policies son las del archivo `sql/catalogo_showroom_f1.sql` (`catalogo_item_fotos_auth` / `catalogo_item_fotos_anon` + las de `storage.objects`). **No** crear policies con otros nombres ni reabrir el DELETE del bucket (es admin-only por diseño).
- **No** agregar entradas a `roles.permissions`: `catalogo` ya es permiso existente; el gating fino de escritura es por `Data.isReadOnly(role, 'catalogo')` en el front.

---

## 0.6 · Criterios de éxito (verificado end-to-end en prod con cleanup — F12+screenshot no alcanza)

1. **Backbone (F1):** `catalogo_item_fotos` existe con RLS espejo; bucket `catalogo` público con sus policies; columnas aditivas en `catalogo_items`. `getCatalogoItems` devuelve los campos nuevos en camelCase; `updateCatalogoItem` los persiste. Un admin sube una foto real desde el módulo → persiste en Storage, aparece la fila, se ve en la UI. **Cleanup:** borrar foto de prueba (objeto en Storage + fila).
2. **Costeo intacto:** `calcular_receta` sobre un item con fotos devuelve el **mismo** `precio_alquiler`; el item sigue en Costos→Listas con precio y snapshot sin cambios. **Cero drift.**
3. **Cotizador intacto:** un item `es_cotizable=TRUE` sigue exponiendo `codigo`/`nombre`/`precio_alquiler` sin alteración.
4. **Showroom (F2):** galería con foto principal (placeholder si no hay); ficha con fotos+lightbox, descripción larga, colores, ficha técnica, medidas y precio read-only. `venta`/`pm` ven todo sin controles de edición (`Data.isReadOnly`); `admin`/`superadmin` ven los controles.
5. **Edición rica (F3):** admin edita campos nuevos y gestiona fotos (subir/borrar/reordenar/portada) con persistencia; borrado = soft-delete (`_deleted=true`) en la fila **+** `storage.remove` del objeto (admin); reordenar persiste `orden`; portada deja 1 sola `es_principal`.
6. **Export (F4):** seleccionar N items → PDF branded MEPEX (logo turquesa, fotos, ficha, medidas, precio opcional) sin errores de consola, descargable, con paginación/footer; imágenes embebidas OK (bucket público, sin CORS); una foto rota no aborta el PDF.
7. **Sin regresiones de UX:** `#catalogo` funciona para todos los roles que ya tenían acceso; dark theme MEPEX; cero errores de consola; responsive (galería 1-2 col, ficha/lightbox usables en viewport chico).
8. **Higiene:** `<style>` inyectado 1 vez con guard `_stylesInjected`; CSS prefijo `cat-`; `addEventListener` (cero `onclick` inline salvo `data-modal-close`); soft-delete + `.eq('_deleted', false)` en toda lectura; `?v=` bumpeado en `index.html`.


---

# 1 · Modelo de datos + SQL (F1)

Confirmed both gaps. `getCatalogoItems` uses `select('*')` (so raw rows include the new columns), but the **mapping** drops them — the camelCase object never exposes `descripcion_larga`/`colores`/`ficha_tecnica`/medidas. And `updateCatalogoItem` doesn't persist them. So:

1. The borrador's "READ-WRITE desde el Showroom" table is misleading: through the current API helpers, the new columns are neither read nor written. The spec must either (a) extend the two API helpers, or (b) explicitly state the showroom uses direct `supabaseClient` calls. Since the showroom is greenfield and the new columns are showroom-specific, extending the API is the clean one-shot path — and the spec should include the exact diffs.

2. Also note the `60s cache`: after any write the showroom must `API.clearCache()` (which the helpers already do) before re-reading.

Now I have enough to rewrite the section authoritatively. I'll also fix other adversarial findings: idempotent SQL re-run with `text[]` already-existing-as-different-type edge, the `single()` crash if no items exist in verification, concurrency on portada, missing handling of empty colores/null ficha, and the cleanup using hard `.delete()` (which is fine on the test table since RLS allows authenticated delete on the row, but the storage object isn't created — fine since dummy URL).

Here is the final improved section.

---

## 1 · Modelo de datos + SQL (F1)

Esta sección define el backbone de datos del Showroom. Es **100% aditivo** sobre `catalogo_items` y agrega una sola tabla nueva (`catalogo_item_fotos`) más un bucket de Storage. **No toca una sola columna del modelo de costeo** — `precio_alquiler`, `tipo_receta`, `es_cotizable`, los `snapshot_*` y la RPC `calcular_receta` quedan exactamente como están. El riesgo sobre Costos y sobre el cotizador externo es **cero** por construcción: solo `ADD COLUMN IF NOT EXISTS` + `CREATE TABLE IF NOT EXISTS`.

> **CAMBIO CRÍTICO respecto al supuesto ingenuo "el Showroom escribe las columnas nuevas via `API.updateCatalogoItem`":** **falso hoy.** Verificado en `api.js`: `getCatalogoItems()` mapea a camelCase con una lista **explícita** de campos (no es un passthrough de `select('*')`) y **NO incluye** `descripcion_larga`/`colores`/`ficha_tecnica`/`frente_cm`/`profundidad_cm`/`alto_cm` ni `disponiblePublico`/`favorito` en el `update`. `updateCatalogoItem()` tampoco persiste ninguna de las 6 columnas nuevas. **Por lo tanto, además del SQL, esta fase DEBE extender esos dos helpers** (1.5.bis abajo). Sin eso, las columnas nuevas son invisibles a la app aunque existan en BD. Esto es parte obligatoria de F1, no opcional.

### 1.1 — Filosofía del modelo

El Showroom consume `catalogo_items` en **dos modos distintos**:

- **READ-ONLY (heredado de Costos / cotizador):** todo lo que tiene que ver con precio, costeo y "cotizabilidad" es de **lectura** para el Showroom. La fuente de verdad de esos valores es la RPC `calcular_receta` invocada desde el módulo Costos. El Showroom los muestra, nunca los escribe.
- **READ-WRITE (vitrina pura):** los atributos comerciales/visuales (nombre, código, rubro, descripción, y las **columnas nuevas** de esta fase) son editables desde el Showroom por roles con permiso de escritura (`admin`/`superadmin`).

Las fotos viven en una tabla aparte (`catalogo_item_fotos`) porque un ítem tiene **N fotos** con orden y portada — un modelo 1-a-N no entra en columnas planas de `catalogo_items`.

### 1.2 — Contrato de columnas: qué es READ-ONLY y qué es READ-WRITE

> Regla nuclear (del GROUND TRUTH de Costos): **PROHIBIDO que el Showroom escriba columnas de costeo.** Si en algún momento se necesita un precio editable a mano en el Showroom, se crea una columna nueva (ej. `precio_showroom_override`), nunca se pisa `precio_alquiler`.

**Columnas EXISTENTES que el Showroom usa SOLO en lectura** (ya viven en `catalogo_items`, ya mapeadas a camelCase por `API.getCatalogoItems()`):

| Columna BD | camelCase (API) | Uso en Showroom | Origen real |
|---|---|---|---|
| `precio_alquiler` | `precioAlquiler` | Precio mostrado en ficha / galería / PDF | RPC `calcular_receta` (Costos) — **nunca escribir** |
| `codigo` | `codigo` | Identificador visible, búsqueda, match de farmeo | Editable en Costos/Showroom |
| `nombre` | `nombre` | Título del ítem | Editable en Costos/Showroom |
| `rubro` | `rubro` | Filtro + color de badge | Editable en Costos/Showroom |
| `categoria` | `categoria` | Filtro secundario | Editable |
| `unidad` | `unidad` | "por Unidad / m² / Kit" en ficha | Editable |
| `descripcion` | `descripcion` | Descripción corta (listados) | Editable |
| `favorito` | `favorito` | Destacar en vitrina | **ya se LEE, pero NO se escribe** vía API hoy → ver 1.5.bis |
| `disponiblePublico` | `disponiblePublico` | Visibilidad pública del showroom | **ya se LEE, pero NO se escribe** vía API hoy → ver 1.5.bis |
| `es_cotizable` | `esCotizable` | **Solo display** (badge "cotizable"); el toggle vive en Costos → Listas | Costos — **nunca escribir desde Showroom** |

> `nombre`/`codigo`/`rubro`/`categoria`/`descripcion`/`unidad` **sí** son editables desde el Showroom en F3 (vía `API.updateCatalogoItem`, que ya los mapea). `favorito` y `disponiblePublico` hoy **se leen pero no se pueden escribir** por la API → la extensión de 1.5.bis los agrega al `update`. `precio_alquiler` y `es_cotizable` se muestran y **nunca** se escriben acá.

**Columnas NUEVAS que esta fase agrega (READ-WRITE desde el Showroom, una vez extendida la API):**

| Columna BD | Tipo | Default | Para qué |
|---|---|---|---|
| `descripcion_larga` | `text` | `NULL` | Descripción rica del showroom/propuesta (la corta `descripcion` queda para listados) |
| `colores` | `text[]` | `NULL` | Colores disponibles como chips |
| `ficha_tecnica` | `jsonb` | `'[]'::jsonb` | Specs flexibles: array de `{label, valor}` |
| `frente_cm` | `numeric` | `NULL` | Medida frente en cm |
| `profundidad_cm` | `numeric` | `NULL` | Medida profundidad en cm |
| `alto_cm` | `numeric` | `NULL` | Medida alto en cm |

### 1.3 — Justificación de tipos

- **`colores text[]`:** lista plana de strings sin estructura. El SDK lo devuelve como array JS directo (`item.colores → ['Blanco','Negro']`). Soporta valores con espacios (`{Blanco,Negro,"Madera natural"}`). Un CSV obligaría a parsear a mano; jsonb sería overkill.
- **`ficha_tecnica jsonb DEFAULT '[]'`:** specs **heterogéneas y abiertas**. Modelado como **array de objetos `{label, valor}`** preserva el orden que define el usuario y permite render directo. El `DEFAULT '[]'` evita manejar `NULL` vs `[]` en el front (siempre iterable). Se usa `{label, valor}` (no `{key, value}`) por consistencia con la lectura en JS.
- **`frente_cm / profundidad_cm / alto_cm numeric` (3 columnas, no jsonb):** medidas **estructuradas y fijas** (frente × profundidad × alto). Columnas tipadas permiten ordenar/filtrar por tamaño, validar números, formatear consistente. `numeric` (no `int`) porque puede haber decimales (`87.5`). Separadas de `ficha_tecnica` porque son un eje fijo que el render trata especial.
- **Tabla `catalogo_item_fotos` aparte (1-a-N):** un ítem tiene **múltiples** fotos con `orden` y `es_principal`. FK `item_id → catalogo_items(id) ON DELETE CASCADE`. El campo viejo `item.foto` que leía el `catalogo.js` legacy **apuntaba a una columna inexistente** (verificado: `catalogo_items` no tiene columna de foto) → media es greenfield total, nada que migrar.

### 1.4 — `es_principal`: una sola portada, sin constraint único + lectura defensiva

`es_principal boolean NOT NULL DEFAULT false` marca la **portada**. La regla "**una sola portada por ítem**" se garantiza en el **front**, **no con un constraint de BD**.

**Por qué no un `UNIQUE` parcial:** un índice `UNIQUE ... WHERE es_principal AND NOT _deleted` haría que setear una portada nueva falle si la anterior no se desmarcó **en la misma transacción** — fricción innecesaria desde un front que hace dos updates secuenciales. El orden importaría y un fallo intermedio dejaría al ítem sin portada.

**Cómo se garantiza el invariante (F3):** desmarcar todas primero, marcar la elegida después.

```javascript
// F3 — setear portada. El front asegura "1 sola principal" (no hay constraint en BD).
async _setPortada(itemId, fotoId) {
    const user = Auth.getUser();
    if (!user || Data.isReadOnly(user.role, 'catalogo')) {
        return Toast.warning('No tenés permiso para editar el catálogo');
    }
    try {
        // 1) Desmarcar todas las del ítem (idempotente)
        const { error: e1 } = await supabaseClient
            .from('catalogo_item_fotos')
            .update({ es_principal: false })
            .eq('item_id', itemId)
            .eq('_deleted', false);
        if (e1) throw e1;
        // 2) Marcar la elegida
        const { error: e2 } = await supabaseClient
            .from('catalogo_item_fotos')
            .update({ es_principal: true })
            .eq('id', fotoId);
        if (e2) throw e2;
        Toast.success('Portada actualizada');
    } catch (err) {
        Toast.error('No se pudo cambiar la portada: ' + (err?.message || err));
    }
}
```

**Lectura defensiva de la portada** — nunca asume exactamente 1 principal (si una carrera dejara 0 o 2, no rompe):

```javascript
// Portada con fallback robusto: primera principal, si no hay → primera por orden, si no hay → null.
_portadaDe(fotos) {
    const vivas = (fotos || []).filter(f => f && !f._deleted);
    if (!vivas.length) return null;
    return vivas.find(f => f.es_principal) || vivas.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0))[0];
}
```

### 1.5 — El SQL completo (`sql/catalogo_showroom_f1.sql`)

Idempotente de punta a punta (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE`, `ON CONFLICT DO UPDATE`). Se corre **una sola vez en el SQL Editor de Supabase ANTES de pushear el JS** (regla SQL-first). Re-correrlo no causa daño.

> **Nota de idempotencia sobre tipos:** `ADD COLUMN IF NOT EXISTS` con un tipo distinto al existente **no** cambia el tipo de una columna que ya exista (Postgres ignora el `ADD` si el nombre ya está, sin tocar el tipo). Como estas 6 columnas son greenfield (no existen hoy), no hay conflicto. Si una corrida previa dejó alguna a medias, re-correr es seguro: las que existan se saltan, las que falten se agregan.

```sql
-- =====================================================================
-- Catálogo Showroom — Fase 1: backbone de datos + fotos
-- =====================================================================
-- Eleva catalogo_items a la FUENTE DE VERDAD del showroom comercial:
--   · atributos ricos: descripcion_larga · colores · ficha_tecnica (specs)
--   · medidas fijas: frente / profundidad / alto (en cm)
--   · fotos MÚLTIPLES por ítem (tabla catalogo_item_fotos)
--   · bucket Storage público `catalogo` para servir las imágenes
--
-- NO toca NADA de costeo: precio_alquiler / tipo_receta / snapshots /
-- es_cotizable / la RPC calcular_receta quedan intactos. Solo AGREGA.
-- Idempotente.
--
-- SQL-FIRST: correr esto en el SQL Editor de Supabase ANTES de pushear el JS.
--
-- RLS = espejo EXACTO de catalogo_items:
--   authenticated full + anon SELECT → el showroom, el PDF y el cotizador
--   externo leen las fotos; el front gatea la escritura por rol (admin).
-- =====================================================================

BEGIN;

-- ─── 1. Atributos ricos + medidas en catalogo_items (aditivo) ───
ALTER TABLE public.catalogo_items
  ADD COLUMN IF NOT EXISTS descripcion_larga text,
  ADD COLUMN IF NOT EXISTS colores           text[],
  ADD COLUMN IF NOT EXISTS ficha_tecnica     jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS frente_cm         numeric,
  ADD COLUMN IF NOT EXISTS profundidad_cm    numeric,
  ADD COLUMN IF NOT EXISTS alto_cm           numeric;

COMMENT ON COLUMN public.catalogo_items.descripcion_larga IS 'Descripción rica para showroom/propuesta. La corta `descripcion` queda para listados.';
COMMENT ON COLUMN public.catalogo_items.colores       IS 'Colores disponibles (chips). Ej: {Blanco,Negro,"Madera natural"}';
COMMENT ON COLUMN public.catalogo_items.ficha_tecnica IS 'Specs flexibles: array de {label,valor}. Ej: [{"label":"Material","valor":"Aluminio"}]';

-- ─── 2. Fotos múltiples por ítem ───
CREATE TABLE IF NOT EXISTS public.catalogo_item_fotos (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id      bigint NOT NULL REFERENCES public.catalogo_items(id) ON DELETE CASCADE,
  url          text   NOT NULL,            -- URL pública del objeto (o link externo de migración)
  storage_path text,                       -- path interno en el bucket (para poder borrar el objeto)
  orden        int    NOT NULL DEFAULT 0,  -- orden de la galería
  es_principal boolean NOT NULL DEFAULT false, -- portada (el front asegura 1 sola)
  alt          text,                       -- leyenda / texto alternativo
  created_at   timestamptz NOT NULL DEFAULT now(),
  _deleted     boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_catalogo_item_fotos_item
  ON public.catalogo_item_fotos(item_id) WHERE NOT _deleted;

-- ─── 3. RLS espejo de catalogo_items (auth full + anon read) ───
ALTER TABLE public.catalogo_item_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalogo_item_fotos_auth ON public.catalogo_item_fotos;
CREATE POLICY catalogo_item_fotos_auth ON public.catalogo_item_fotos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS catalogo_item_fotos_anon ON public.catalogo_item_fotos;
CREATE POLICY catalogo_item_fotos_anon ON public.catalogo_item_fotos
  FOR SELECT TO anon USING (true);

COMMIT;

-- ─── 4. Bucket Storage público `catalogo` (corre como service_role en el SQL Editor) ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalogo', 'catalogo', true,            -- PÚBLICO: URLs directas para showroom / PDF / cotizador
  10485760,                                 -- 10 MB por foto
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- read: abierto (bucket público; lo necesitan showroom público, PDF y cotizador)
DROP POLICY IF EXISTS "catalogo_read" ON storage.objects;
CREATE POLICY "catalogo_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'catalogo');

-- escritura: cualquier authenticated (el front gatea por rol, igual que comprobantes/remitos)
DROP POLICY IF EXISTS "catalogo_insert" ON storage.objects;
CREATE POLICY "catalogo_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'catalogo');

DROP POLICY IF EXISTS "catalogo_update" ON storage.objects;
CREATE POLICY "catalogo_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'catalogo');

-- borrado: solo admin/superadmin
DROP POLICY IF EXISTS "catalogo_delete" ON storage.objects;
CREATE POLICY "catalogo_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'catalogo'
    AND auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
  );
```

### 1.5.bis — Extender la API: leer y persistir las columnas nuevas (OBLIGATORIO)

Sin esto, las columnas existen en BD pero la app no las ve ni las puede guardar. Dos parches quirúrgicos en `api.js`, **sin tocar ninguna línea de costeo existente**.

**(a) `getCatalogoItems()` — agregar al objeto `mapped` (dentro del `.map(i => ({ ... }))`, junto al resto de los campos; recomendado justo antes del cierre `}))`):**

```javascript
                // F.SHOWROOM — atributos ricos + medidas (read)
                descripcionLarga: i.descripcion_larga || '',
                colores: Array.isArray(i.colores) ? i.colores : [],          // text[] → array JS, nunca null
                fichaTecnica: Array.isArray(i.ficha_tecnica) ? i.ficha_tecnica : [], // jsonb array {label,valor}
                frenteCm: i.frente_cm != null ? parseFloat(i.frente_cm) : null,
                profundidadCm: i.profundidad_cm != null ? parseFloat(i.profundidad_cm) : null,
                altoCm: i.alto_cm != null ? parseFloat(i.alto_cm) : null,
```

> Nota: `select('*')` ya trae las columnas crudas (incluido `disponible_publico`/`favorito` que ya se mapean), por eso solo hay que sumar las claves al objeto mapeado. `colores`/`fichaTecnica` se normalizan a `[]` para que el front siempre pueda iterar sin chequear null.

**(b) `updateCatalogoItem(id, data)` — agregar los mappings condicionales (junto a los `if (data.x !== undefined) ...` existentes, antes del `await UndoHelpers.updateRecord(...)`):**

```javascript
            // F.SHOWROOM — vitrina (write). NO toca costeo.
            if (data.descripcionLarga !== undefined) payload.descripcion_larga = data.descripcionLarga || null;
            if (data.colores !== undefined) {
                // array de strings limpio; [] o null → null (columna queda vacía)
                const arr = Array.isArray(data.colores) ? data.colores.map(s => String(s).trim()).filter(Boolean) : [];
                payload.colores = arr.length ? arr : null;
            }
            if (data.fichaTecnica !== undefined) {
                // array de {label,valor}; descarta filas sin label
                const ft = Array.isArray(data.fichaTecnica)
                    ? data.fichaTecnica
                        .map(r => ({ label: String(r?.label ?? '').trim(), valor: String(r?.valor ?? '').trim() }))
                        .filter(r => r.label)
                    : [];
                payload.ficha_tecnica = ft;   // jsonb; [] es válido (default de la columna)
            }
            if (data.frenteCm !== undefined) payload.frente_cm = (data.frenteCm === '' || data.frenteCm === null) ? null : parseFloat(data.frenteCm);
            if (data.profundidadCm !== undefined) payload.profundidad_cm = (data.profundidadCm === '' || data.profundidadCm === null) ? null : parseFloat(data.profundidadCm);
            if (data.altoCm !== undefined) payload.alto_cm = (data.altoCm === '' || data.altoCm === null) ? null : parseFloat(data.altoCm);
            // F.SHOWROOM — vitrina flags que hoy se leen pero no se escribían
            if (data.disponiblePublico !== undefined) payload.disponible_publico = data.disponiblePublico === true;
            if (data.favorito !== undefined) payload.favorito = data.favorito === true;
```

> Las fotos (`catalogo_item_fotos`) **no** pasan por estos helpers: tienen su propio CRUD directo contra `supabaseClient.from('catalogo_item_fotos')` (definido en F1 subida / F3 manejo), porque son una tabla aparte y no entran en el modelo de undo de `catalogo_items`.

**Cache:** ambos helpers ya llaman `this.clearCache()` tras escribir. El front, después de cualquier write, debe re-leer con `await API.getCatalogoItems()` (el cache de 60s ya quedó invalidado) para reflejar el cambio.

### 1.6 — Desglose por bloque del SQL

**Bloque 1 — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.** Las 6 columnas nuevas. Aditivo e idempotente. Sin `NOT NULL` salvo donde hay default (`ficha_tecnica` arranca en `'[]'`). Los `COMMENT ON COLUMN` documentan el formato en el propio schema.

**Bloque 2 — `CREATE TABLE catalogo_item_fotos`.** PK `bigint IDENTITY` (consistente con `catalogo_items.id` bigint). FK `ON DELETE CASCADE`. `url NOT NULL`; `storage_path` nullable (las fotos migradas en lote pueden venir solo con URL pública). `_deleted` para soft delete. Índice **parcial** `WHERE NOT _deleted` sobre `item_id` → las queries de galería pegan al índice sin filas borradas.

**Bloque 3 — RLS espejo.** Idéntica a `catalogo_items`: `authenticated FOR ALL` + `anon FOR SELECT`. El gating fino por rol lo hace el front (`Data.isReadOnly`). `DROP POLICY IF EXISTS` antes de cada `CREATE` → re-correr no falla.

**Bloque 4 — Bucket + policies de `storage.objects`.** Bucket **público** (fotos por URL directa a showroom/PDF/cotizador). `ON CONFLICT DO UPDATE` → si ya existe, actualiza límites/MIME. 10 MB/foto, MIME restringido a imágenes. Lectura abierta; insert/update para authenticated (front gatea); **delete solo admin/superadmin** (espejo del Storage de comprobantes/remitos).

> **Por qué el bloque 4 va FUERA del `BEGIN/COMMIT`:** corre contra el schema `storage` (privilegiado, `service_role` en el SQL Editor). Dejarlo fuera evita que un permiso faltante sobre `storage` haga rollback de los `ALTER`/`CREATE` de `public` (lo crítico para que el JS no rompa).

### 1.7 — Verificación post-ejecución del SQL (correr en el SQL Editor)

```sql
-- 1) Las 6 columnas nuevas existen en catalogo_items
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'catalogo_items'
  AND column_name IN ('descripcion_larga','colores','ficha_tecnica','frente_cm','profundidad_cm','alto_cm')
ORDER BY column_name;
-- Esperado: 6 filas. colores=ARRAY, ficha_tecnica=jsonb default '[]'::jsonb, las 3 medidas=numeric.

-- 2) La tabla de fotos existe con sus columnas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'catalogo_item_fotos'
ORDER BY ordinal_position;
-- Esperado: id, item_id, url, storage_path, orden, es_principal, alt, created_at, _deleted.

-- 3) El índice parcial existe
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'catalogo_item_fotos';
-- Esperado: PK + idx_catalogo_item_fotos_item (WHERE NOT _deleted).

-- 4) RLS habilitado + 2 policies de la tabla
SELECT polname, polcmd, roles::regrole[]
FROM pg_policy WHERE polrelid = 'public.catalogo_item_fotos'::regclass;
-- Esperado: catalogo_item_fotos_auth (ALL, authenticated) + catalogo_item_fotos_anon (SELECT, anon).

-- 5) Bucket público + 4 policies de storage
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'catalogo';
SELECT polname, polcmd FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass AND polname LIKE 'catalogo_%';
-- Esperado: catalogo_read/insert/update/delete.

-- 6) Confirmar que costeo sigue intacto
SELECT column_name FROM information_schema.columns
WHERE table_name = 'catalogo_items'
  AND column_name IN ('precio_alquiler','tipo_receta','es_cotizable',
                      'snapshot_costos_at','snapshot_pct_margen','snapshot_hora_taller_ars');
-- Esperado: las 6 siguen presentes.
```

### 1.8 — Verificación funcional end-to-end (con cleanup)

Probar escritura/lectura real contra prod **después** de aplicar el SQL **y** de pushear/pullear la API extendida. Desde la consola del navegador logueado como admin. El cleanup borra la fila de prueba y limpia las columnas.

```javascript
// 0) Tomar un item real (defensivo: maybeSingle por si no hay items)
const { data: items } = await supabaseClient
  .from('catalogo_items').select('id,nombre').eq('_deleted', false).limit(1);
if (!items || !items.length) { console.warn('No hay items para probar'); }
const item = items[0];

// 1) INSERT de foto de prueba (URL dummy; no se sube objeto al bucket)
const { data: foto, error: eIns } = await supabaseClient
  .from('catalogo_item_fotos')
  .insert({ item_id: item.id, url: 'https://example.com/test.jpg', orden: 0, es_principal: true, alt: 'TEST F1' })
  .select().single();
console.log('insert foto', eIns || foto);

// 2) WRITE de columnas nuevas VIA API (prueba que la extensión de 1.5.bis funciona)
const okUpd = await API.updateCatalogoItem(item.id, {
  descripcionLarga: 'TEST F1',
  colores: ['Blanco', 'Negro', ''],                       // el '' debe filtrarse
  fichaTecnica: [{ label: 'Material', valor: 'Aluminio' }, { label: '', valor: 'x' }], // la 2ª se descarta
  frenteCm: 120, profundidadCm: 60, altoCm: 90,
  disponiblePublico: true, favorito: true,
});
console.log('update API', okUpd);   // true

// 3) READ de vuelta VIA API (clearCache ya corrió dentro del update)
const all = await API.getCatalogoItems();
const check = all.find(x => x.id === item.id);
console.log('read API', {
  colores: check.colores,            // ['Blanco','Negro']
  fichaTecnica: check.fichaTecnica,  // [{label:'Material',valor:'Aluminio'}]
  frenteCm: check.frenteCm,          // 120
  disponiblePublico: check.disponiblePublico, // true
});

// 4) CLEANUP — borrar foto + limpiar columnas + flags
await supabaseClient.from('catalogo_item_fotos').delete().eq('id', foto.id);
await API.updateCatalogoItem(item.id, {
  descripcionLarga: '', colores: [], fichaTecnica: [],
  frenteCm: '', profundidadCm: '', altoCm: '',
  disponiblePublico: false, favorito: false,
});
console.log('cleanup OK');
```

> El test del paso 2/3 valida los tres edge cases del mapping: color vacío filtrado, fila de ficha sin label descartada, y `''`→`null` en medidas. Si la API **no** estuviera extendida (1.5.bis), el paso 3 mostraría `colores: []` y `frenteCm: null` (silencioso) — por eso el test va contra la API, no contra `supabaseClient` directo.

### 1.9 — Edge cases y notas de integración

- **Item sin fotos:** `_portadaDe([])` → `null`. El render del showroom (F2) debe mostrar un placeholder (no romper) cuando `portada === null`. La galería itera sobre `[]` sin error.
- **`colores` / `ficha_tecnica` vacíos o null en BD:** la API los normaliza a `[]` en lectura (1.5.bis), así que el front nunca recibe `null` en esos campos. La sección de colores/ficha en la ficha se oculta si el array está vacío.
- **`ficha_tecnica` con forma inesperada** (no array, ej. una migración manual mal hecha): el `Array.isArray(...) ? ... : []` en la lectura lo neutraliza a `[]`.
- **Concurrencia de portada:** dos admins marcando portada a la vez pueden dejar 0 o 2 `es_principal`. No se corrige con constraint (1.4); la lectura defensiva `_portadaDe` tolera el estado inconsistente. Es aceptable para un equipo chico; si molesta, F3 puede re-desmarcar al cargar.
- **Foto pesada (>10 MB) o MIME no permitido:** el bucket rechaza el upload con error de Storage. El handler de subida (F1/F3) debe (a) comprimir client-side con el patrón `_downscaleImage` del GROUND TRUTH antes de subir, y (b) `try/catch` con `Toast.error` si el upload falla — no asumir éxito.
- **Errores de red en cualquier write:** todo handler de escritura va envuelto en `try/catch` con `Toast.error(err?.message || err)`; nada de `.then` sin catch. Los helpers de API ya devuelven `null` ante error (no lanzan), así que el front debe chequear el valor de retorno además del try/catch.
- **Permisos (admin write / venta-pm read-only):** la RLS de BD es permisiva (cualquier authenticated escribe); el gating real lo hace el front. Cada acción de escritura chequea `Data.isReadOnly(user.role, 'catalogo')` y, si es read-only, oculta el botón y aborta el handler. `catalogo` es permiso existente (`superadmin`/`admin`/`venta`/`pm` lo tienen; escriben solo admin/superadmin). **No hace falta grant nuevo.**
- **El cotizador externo no se entera:** lee `catalogo_items WHERE es_cotizable=true` y toma `precio_alquiler`. Esta fase no toca ninguna de las dos → sigue idéntico. Las columnas nuevas le son transparentes (su `select` es explícito sobre las que necesita).
- **Costos no se entera:** la RPC `calcular_receta` y sus snapshots no se mencionan ni en el SQL ni en los parches de API. El recálculo de precios sigue igual. Los parches de `updateCatalogoItem` solo **agregan** mappings nuevos; no modifican los de costeo.
- **Soft delete coherente:** `catalogo_items` (vía `_deleted`/`activo`) y `catalogo_item_fotos` (vía `_deleted`) usan soft delete. Toda lectura del Showroom filtra `.eq('_deleted', false)`.
- **Greenfield de media:** no hay fotos previas (la `foto` del legacy no existía). El farmeo Drive→Supabase (migración puntual de Claude, no de la app) poblará `catalogo_item_fotos` después de esta fase.


---

## 2 · Capa API (`api.js`)

Todos los métodos de fotos y campos ricos del showroom viven en `api.js`, pegados **inmediatamente después** de `deleteCatalogoItem` (línea ~1774) para mantener juntos los CRUD del catálogo. Usan `supabaseClient` directo (lectura/storage) y `UndoHelpers` solo donde aplica un soft-delete reversible (la edición de campos ricos del item). Las fotos NO entran al undo stack (son media, no datos de negocio). Todos devuelven shapes en camelCase coherentes con `getCatalogoItems()`.

> **Permisos:** la API NO chequea rol — eso lo hace el módulo (`Data.isReadOnly(role,'catalogo')` esconde botones de escritura) y la RLS de prod (policies espejo de `catalogo_items`). Si un read-only fuerza una escritura, Supabase devuelve error → los métodos lo capturan, muestran Toast y retornan `null`/`false` — el frontend nunca rompe.

> **UUID sin librerías:** se usa `crypto.randomUUID()` (nativo en contexto seguro HTTPS — el lobby corre sobre HTTPS) con fallback inline. No se agrega ninguna dependencia.

> **Dependencia de orden de carga:** estos métodos usan `Toast` (global de `components.js`) y `UndoHelpers` (global de `undo.js`). Verificado contra el orden de carga del `index.html`: `api.js` se carga en posición 3, **antes** que `components.js` (7) y `undo.js` (9). Por eso **`Toast` y `UndoHelpers` se referencian SOLO dentro de cuerpos `async`** (se resuelven en runtime, cuando el usuario interactúa — mucho después de que todos los scripts cargaron), nunca en el top-level del objeto. Esto ya es el patrón vigente en `api.js` (p.ej. los métodos existentes de catálogo ya llaman `UndoHelpers.*`), así que es seguro.

### 2.1 — Helper privado: normalizar una fila de `catalogo_item_fotos`

```javascript
    // ─── Catálogo Showroom — fotos + campos ricos (F1) ──────────────
    // Helper: normaliza una fila de catalogo_item_fotos a camelCase.
    _mapCatalogoFoto(r) {
        return {
            id: r.id,
            itemId: r.item_id,
            url: r.url || '',
            storagePath: r.storage_path || null,
            orden: r.orden != null ? parseInt(r.orden, 10) : 0,
            esPrincipal: r.es_principal === true,
            alt: r.alt || '',
            createdAt: r.created_at || null,
        };
    },
```

### 2.2 — `listFotos(itemId)`

Devuelve las fotos vivas de un item, ordenadas por `orden` asc, desempate por `id` (estable). Base de las demás lecturas. **No usa cache** (las fotos cambian al editar; no hay clave de cache por item en el `_cache` simple de `api.js`).

```javascript
    async listFotos(itemId) {
        if (itemId == null) return [];
        try {
            const { data, error } = await supabaseClient
                .from('catalogo_item_fotos')
                .select('*')
                .eq('item_id', itemId)
                .eq('_deleted', false)
                .order('orden', { ascending: true })
                .order('id', { ascending: true });
            if (error) throw error;
            return (data || []).map(r => this._mapCatalogoFoto(r));
        } catch (e) {
            console.warn('[API] Error listFotos:', e.message);
            return [];
        }
    },
```

**Edge cases:** `itemId` nulo (incluye `0`, por eso `== null` y no `!itemId`) → `[]` sin tocar la red. Item sin fotos → `[]`. Error de red → `[]` (la galería renderiza empty state).

### 2.3 — `getCatalogoItemFull(id)`

Trae el item completo + sus fotos + parsea `ficha_tecnica` (jsonb array) y `colores` (text[]) a estructuras JS limpias. Consumido por la ficha (F2) y el export PDF (F4). **No usa cache** (debe reflejar ediciones recientes).

> El `.select('*')` trae también `precio_alquiler`, `tipo_receta`, snapshots, etc. — se **leen** y exponen READ-ONLY, nunca se escriben desde este módulo. Mapeamos solo lo que el showroom necesita mostrar.

```javascript
    async getCatalogoItemFull(id) {
        if (id == null) return null;
        try {
            const { data: row, error } = await supabaseClient
                .from('catalogo_items')
                .select('*')
                .eq('id', id)
                .eq('_deleted', false)
                .maybeSingle();
            if (error) throw error;
            if (!row) return null;

            // ficha_tecnica: jsonb array de { label, valor }. Tolerante a null / no-array / string JSON.
            let fichaTecnica = [];
            const ft = row.ficha_tecnica;
            if (Array.isArray(ft)) {
                fichaTecnica = ft;
            } else if (typeof ft === 'string' && ft.trim()) {
                try { const p = JSON.parse(ft); if (Array.isArray(p)) fichaTecnica = p; } catch (_) {}
            }
            fichaTecnica = fichaTecnica
                .filter(x => x && typeof x === 'object' && x.label != null)
                .map(x => ({ label: String(x.label), valor: x.valor != null ? String(x.valor) : '' }));

            // colores: text[]. Tolerante a null / string CSV / array.
            let colores = [];
            const col = row.colores;
            if (Array.isArray(col)) {
                colores = col.filter(c => c != null && String(c).trim()).map(c => String(c).trim());
            } else if (typeof col === 'string' && col.trim()) {
                colores = col.split(',').map(c => c.trim()).filter(Boolean);
            }

            const fotos = await this.listFotos(id);

            return {
                // Base (mismo shape que getCatalogoItems para no mapear distinto en el módulo)
                id: row.id,
                nombre: row.nombre || '',
                codigo: row.codigo || '',
                rubro: row.rubro || '',
                categoria: row.categoria || '',
                descripcion: row.descripcion || '',
                origen: row.origen || '',
                unidad: row.unidad || 'Unidad',
                tipoReceta: row.tipo_receta || 'propio',
                precioAlquiler: parseFloat(row.precio_alquiler) || 0,      // READ-ONLY (RPC Costos)
                costoPorUso: parseFloat(row.costo_por_uso) || 0,           // READ-ONLY
                snapshotCostosAt: row.snapshot_costos_at || null,          // READ-ONLY
                esCotizable: row.es_cotizable === true,                    // READ-ONLY para el showroom
                // Campos ricos (F1) — editables desde el showroom
                descripcionLarga: row.descripcion_larga || '',
                colores,
                fichaTecnica,
                frenteCm: row.frente_cm != null ? parseFloat(row.frente_cm) : null,
                profundidadCm: row.profundidad_cm != null ? parseFloat(row.profundidad_cm) : null,
                altoCm: row.alto_cm != null ? parseFloat(row.alto_cm) : null,
                // Galería
                fotos,
                fotoPrincipal: fotos.find(f => f.esPrincipal) || fotos[0] || null,
            };
        } catch (e) {
            console.warn('[API] Error getCatalogoItemFull:', e.message);
            return null;
        }
    },
```

**Edge cases:** item borrado/inexistente → `null`. `ficha_tecnica`/`colores` con basura, null o formato inesperado → arrays vacíos saneados. `fotoPrincipal` cae al `[0]` si ninguna está marcada (data del farmeo entra `es_principal=false`), y a `null` si no hay fotos.

### 2.4 — `updateCatalogoItemRich(id, fields)`

Actualiza SOLO los campos ricos del showroom. **Por diseño NO toca precio/receta/snapshots/esCotizable** (contrato con Costos). Usa `UndoHelpers.updateRecord` para que sea reversible con Ctrl+Z.

> **Contrato verificado de `UndoHelpers.updateRecord`:** firma `updateRecord(table, id, newValues, description?)`. Internamente lee el registro actual para snapshot del undo, aplica el update y devuelve el resultado. Si esa firma difiere en tu `undo.js`, ajustá la llamada — pero coincide con los `updateCatalogoItem`/`createCatalogoItem` ya existentes en `api.js`, que es la fuente que copiamos.

```javascript
    async updateCatalogoItemRich(id, fields) {
        if (id == null) return null;
        try {
            const f = fields || {};
            const payload = {};

            if (f.descripcionLarga !== undefined) {
                payload.descripcion_larga = (f.descripcionLarga || '').trim() || null;
            }
            // colores: array de strings → text[]. Vacío / null limpia a [].
            if (f.colores !== undefined) {
                payload.colores = Array.isArray(f.colores)
                    ? f.colores.map(c => String(c).trim()).filter(Boolean)
                    : [];
            }
            // ficha_tecnica: array de { label, valor } → jsonb. Se sanea; se descartan filas sin label.
            if (f.fichaTecnica !== undefined) {
                const arr = Array.isArray(f.fichaTecnica) ? f.fichaTecnica : [];
                payload.ficha_tecnica = arr
                    .filter(x => x && typeof x === 'object' && String(x.label || '').trim())
                    .map(x => ({ label: String(x.label).trim(), valor: x.valor != null ? String(x.valor).trim() : '' }));
            }
            // Medidas: numéricas. '' o null → null. NaN se guarda como null (no se omite el campo).
            const numField = (key, col) => {
                if (f[key] === undefined) return;
                const raw = f[key];
                if (raw === '' || raw === null) { payload[col] = null; return; }
                const v = parseFloat(raw);
                payload[col] = Number.isNaN(v) ? null : v;
            };
            numField('frenteCm', 'frente_cm');
            numField('profundidadCm', 'profundidad_cm');
            numField('altoCm', 'alto_cm');

            if (Object.keys(payload).length === 0) return true; // nada que guardar

            await UndoHelpers.updateRecord('catalogo_items', id, payload, 'Edito ficha de showroom');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updateCatalogoItemRich:', e.message);
            Toast.error('No se pudo guardar la ficha: ' + (e.message || 'error'));
            return null;
        }
    },
```

**Por qué `clearCache()`:** `getCatalogoItems()` cachea 60s; la grilla principal podría mostrar campos ricos. Invalidar mantiene coherencia. **Edge cases:** payload vacío → `true` sin red. NaN/'' en medidas → `null`. Read-only → RLS rechaza → catch → Toast + `null`.

### 2.5 — `uploadCatalogoFoto(itemId, file)`

Pipeline: **comprime en canvas** (max ~1600px, JPEG 0.85) → **sube** al bucket público `catalogo` en `{itemId}/{uuid}.jpg` → **getPublicUrl** → **inserta** fila con `orden = max+1` y `es_principal=true` solo si es la primera foto viva. Con **rollback del objeto** si el INSERT falla.

> **Nombre del bucket = `catalogo`.** Coherente con el SQL de F1 (`sql/catalogo_showroom_f1.sql` crea el bucket público `catalogo`). El GROUND TRUTH §storage menciona `catalogo-fotos` como ejemplo genérico — **se ignora; la fuente de verdad es el SQL de la fase**, que usa `catalogo`. Si cambiás el bucket en el SQL, cambialo acá también (es el único string a tocar).

> **Concurrencia (orden / principal):** el cálculo de `max(orden)+1` y "primera foto" se hace leyendo `listFotos` justo antes del INSERT. Si dos uploads del MISMO item corren en paralelo, podrían empatar `orden` o marcar dos principales. Mitigación práctica: el módulo deshabilita el input mientras una subida está en curso (subidas múltiples se procesan **secuencialmente** en F3 — ver capa módulo), y `setFotoPrincipal`/`reorderFotos` reescriben el invariante de todas formas. No se usa transacción porque PostgREST no expone una para multi-statement desde el cliente; el costo de un empate transitorio es cosmético y autocorregible.

```javascript
    // Compresor canvas reutilizable. Devuelve { blob, dataUrl, w, h } o null.
    async _compressImageToJpeg(file, maxDim = 1600, quality = 0.85) {
        if (!file) return null;
        let objUrl = null;
        try {
            objUrl = URL.createObjectURL(file);
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
                i.src = objUrl;
            });
            const ow = img.naturalWidth, oh = img.naturalHeight;
            if (!ow || !oh) throw new Error('Imagen inválida');

            const scale = Math.min(1, maxDim / Math.max(ow, oh));
            const w = Math.round(ow * scale);
            const h = Math.round(oh * scale);

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';   // aplana alpha (PNG/WebP) al pasar a JPEG
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
            if (!blob) throw new Error('No se pudo comprimir la imagen');
            return { blob, dataUrl: canvas.toDataURL('image/jpeg', quality), w, h };
        } catch (e) {
            console.warn('[API] _compressImageToJpeg:', e.message);
            return null;
        } finally {
            if (objUrl) URL.revokeObjectURL(objUrl);
        }
    },

    async uploadCatalogoFoto(itemId, file) {
        if (itemId == null) { Toast.error('Falta el item'); return null; }
        if (!file) { Toast.error('No hay archivo'); return null; }
        if (file.type && !file.type.startsWith('image/')) {
            Toast.warning('El archivo no es una imagen');
            return null;
        }
        try {
            // 1) Comprimir (también convierte HEIC/PNG/WebP → JPEG si el canvas los decodifica;
            //    los que el browser no decodifica caen al catch con Toast claro).
            const compressed = await this._compressImageToJpeg(file, 1600, 0.85);
            if (!compressed || !compressed.blob) { Toast.error('No se pudo procesar la imagen (formato no soportado)'); return null; }

            // 2) UUID sin libs. crypto.randomUUID() nativo en HTTPS; fallback inline si no.
            const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                    const r = Math.random() * 16 | 0;
                    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                  }));
            const storagePath = `${itemId}/${uuid}.jpg`;

            // 3) Subir al bucket público 'catalogo'
            const { error: upErr } = await supabaseClient.storage
                .from('catalogo')
                .upload(storagePath, compressed.blob, {
                    contentType: 'image/jpeg',
                    upsert: false,
                    cacheControl: '3600',
                });
            if (upErr) throw upErr;

            // 4) URL pública permanente
            const { data: pub } = supabaseClient.storage.from('catalogo').getPublicUrl(storagePath);
            const url = pub?.publicUrl || null;
            if (!url) {
                await supabaseClient.storage.from('catalogo').remove([storagePath]).catch(() => {});
                throw new Error('No se pudo obtener la URL pública');
            }

            // 5) orden (max+1) y si es la primera foto viva → principal
            const existentes = await this.listFotos(itemId);
            const maxOrden = existentes.reduce((m, f) => Math.max(m, f.orden || 0), -1);
            const esPrimera = existentes.length === 0;

            // 6) Insertar fila (rollback del objeto si falla)
            const { data: ins, error: insErr } = await supabaseClient
                .from('catalogo_item_fotos')
                .insert({
                    item_id: itemId,
                    url,
                    storage_path: storagePath,
                    orden: maxOrden + 1,
                    es_principal: esPrimera,
                    alt: '',
                    _deleted: false,
                })
                .select()
                .single();
            if (insErr) {
                await supabaseClient.storage.from('catalogo').remove([storagePath]).catch(() => {});
                throw insErr;
            }

            this.clearCache();
            return this._mapCatalogoFoto(ins);
        } catch (e) {
            console.warn('[API] Error uploadCatalogoFoto:', e.message);
            Toast.error('No se pudo subir la foto: ' + (e.message || 'error'));
            return null;
        }
    },
```

**Decisiones / edge cases:** rollback de huérfanos si el INSERT (o la URL) falla; `upsert:false` + UUID → cero colisiones; "primera = principal" evaluado contra fotos vivas; compresión ~1600px/0.85 → ~150-400 KB; mobile (`accept="image/*"` abre cámara) → mismo pipeline; HEIC no decodificable → catch + Toast.

### 2.6 — `reorderFotos(itemId, orderedIds)`

Persiste un nuevo orden (drag & drop F3): escribe `orden = índice`, scope al item.

```javascript
    async reorderFotos(itemId, orderedIds) {
        if (itemId == null || !Array.isArray(orderedIds) || orderedIds.length === 0) return false;
        try {
            const updates = orderedIds.map((fotoId, idx) =>
                supabaseClient
                    .from('catalogo_item_fotos')
                    .update({ orden: idx })
                    .eq('id', fotoId)
                    .eq('item_id', itemId)   // candado de scope
            );
            const results = await Promise.all(updates);
            const firstErr = results.find(r => r && r.error);
            if (firstErr) throw firstErr.error;
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error reorderFotos:', e.message);
            Toast.error('No se pudo reordenar: ' + (e.message || 'error'));
            return false;
        }
    },
```

**Edge cases:** array vacío/inválido → `false` sin red. Update que falle (read-only) → throw → Toast + `false`; el módulo recarga `listFotos` para volver al estado real.

### 2.7 — `setFotoPrincipal(itemId, fotoId)`

Desmarca todas las del item, luego marca la elegida. El invariante "≤1 principal" se garantiza porque el desmarcado va primero.

```javascript
    async setFotoPrincipal(itemId, fotoId) {
        if (itemId == null || fotoId == null) return false;
        try {
            const { error: clearErr } = await supabaseClient
                .from('catalogo_item_fotos')
                .update({ es_principal: false })
                .eq('item_id', itemId)
                .eq('_deleted', false);
            if (clearErr) throw clearErr;

            const { error: setErr } = await supabaseClient
                .from('catalogo_item_fotos')
                .update({ es_principal: true })
                .eq('id', fotoId)
                .eq('item_id', itemId);
            if (setErr) throw setErr;

            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error setFotoPrincipal:', e.message);
            Toast.error('No se pudo marcar la portada: ' + (e.message || 'error'));
            return false;
        }
    },
```

**Edge case:** si el paso 2 falla tras el paso 1, el item queda con 0 principales → la ficha cae al `[0]` (estado válido, autocorregible al volver a marcar).

### 2.8 — `deleteFoto(fotoId)`

Soft-delete (`_deleted=true`) + remove best-effort del objeto en storage. Si era principal, **promueve** la siguiente viva a portada.

```javascript
    async deleteFoto(fotoId) {
        if (fotoId == null) return false;
        try {
            const { data: row, error: getErr } = await supabaseClient
                .from('catalogo_item_fotos')
                .select('id, item_id, storage_path, es_principal')
                .eq('id', fotoId)
                .maybeSingle();
            if (getErr) throw getErr;
            if (!row) return false;

            const { error: delErr } = await supabaseClient
                .from('catalogo_item_fotos')
                .update({ _deleted: true, es_principal: false })
                .eq('id', fotoId);
            if (delErr) throw delErr;

            // Best-effort: liberar el objeto del bucket (no bloquea si falla).
            if (row.storage_path) {
                await supabaseClient.storage.from('catalogo').remove([row.storage_path]).catch(() => {});
            }

            // Si era portada, promover la siguiente viva.
            if (row.es_principal) {
                const restantes = await this.listFotos(row.item_id); // ya ordenadas
                if (restantes.length > 0) {
                    await supabaseClient
                        .from('catalogo_item_fotos')
                        .update({ es_principal: true })
                        .eq('id', restantes[0].id)
                        .catch(() => {});
                }
            }

            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleteFoto:', e.message);
            Toast.error('No se pudo eliminar la foto: ' + (e.message || 'error'));
            return false;
        }
    },
```

**Decisión:** soft-delete (coherente con todo el sistema) **+** liberación del objeto físico (una foto borrada no tiene valor de auditoría y ocupa storage). Para una papelera recuperable, basta quitar el `.remove()`.

### 2.9 — `updateFotoAlt(fotoId, alt)`

```javascript
    async updateFotoAlt(fotoId, alt) {
        if (fotoId == null) return false;
        try {
            const { error } = await supabaseClient
                .from('catalogo_item_fotos')
                .update({ alt: (alt || '').trim() || null })
                .eq('id', fotoId);
            if (error) throw error;
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updateFotoAlt:', e.message);
            Toast.error('No se pudo guardar el texto: ' + (e.message || 'error'));
            return false;
        }
    },
```

### 2.10 — Contrato (lo que el módulo puede llamar)

| Método | Devuelve | Escribe en | Undo |
|---|---|---|---|
| `getCatalogoItemFull(id)` | objeto rico + `fotos[]` + `fotoPrincipal`, o `null` | — (read) | — |
| `updateCatalogoItemRich(id, fields)` | `true` / `null` | `catalogo_items` (solo campos ricos) | ✅ Ctrl+Z |
| `listFotos(itemId)` | `[]` de fotos vivas ordenadas | — (read) | — |
| `uploadCatalogoFoto(itemId, file)` | foto creada (camelCase) o `null` | Storage `catalogo` + `catalogo_item_fotos` | — |
| `reorderFotos(itemId, orderedIds)` | `true` / `false` | `catalogo_item_fotos.orden` | — |
| `setFotoPrincipal(itemId, fotoId)` | `true` / `false` | `catalogo_item_fotos.es_principal` | — |
| `deleteFoto(fotoId)` | `true` / `false` | soft-delete fila + remove objeto | — |
| `updateFotoAlt(fotoId, alt)` | `true` / `false` | `catalogo_item_fotos.alt` | — |

**Invariantes garantizados por la API (el módulo no los reimplementa):**
- Como máximo **una** foto `es_principal` por item.
- La **primera** foto subida se marca principal automáticamente.
- Borrar la portada **promueve** la siguiente; sin fotos → `fotoPrincipal` cae a `null`.
- **Nunca** se tocan `precio_alquiler`, `tipo_receta`, `es_cotizable`, `costo_*` ni `snapshot_*` → contrato con Costos y cotizador externo intacto.
- Todo método de escritura llama `this.clearCache()`.

**Notas de integración:**
- Asumen que `sql/catalogo_showroom_f1.sql` ya corrió en prod (tabla `catalogo_item_fotos`, columnas ricas en `catalogo_items`, bucket público `catalogo` + policies). SQL-first: sin eso, los INSERT/UPDATE rompen.
- `Toast`/`UndoHelpers` son globales ya cargados al momento de ejecutarse cualquiera de estos métodos async (ver nota de orden de carga arriba).
- No se bumpea `?v=` acá; se incrementa una sola vez al cierre de la fase junto con `catalogo.js`.


---

# 3 · F2 Showroom UI (galeria + ficha del item)

I have enough to write the corrected section. Key findings against ground truth that I'm correcting in the rewrite:

1. **`Modal.close()` without id** — ground truth (CLAUDE.md sessions) explicitly says `Modal.close()` requires `instance.id`. The current `catalogo.js` uses bare `Modal.close()` in create/edit (lines 574, 642) — that's a latent bug, but since I'm told to "conserve" the modals I must NOT silently inherit it; the borrador's post-save snippet keeps `Modal.close()`. I'll switch to `Modal.closeAll()` (confirmed in ground truth) to be safe.
2. **`item.foto`** — the borrador's tabla still reads `item.foto` (hallucinated column — verified NOT to exist). Must drop it entirely from tabla/panel and rely on portadas only.
3. **`disponiblePublico` mapping** — `getCatalogoItems` ground truth lists `disponiblePublico` already in the map. The borrador's "add to map" includes it with a risky `??` fallback referencing a camelCase key that won't exist on `row`. Fix.
4. **Comma operator** in `_renderFicha(updated), this._renderFichaGallery()` — works but ugly/fragile; split into braces.
5. **`onerror` with nested quotes** in `_renderFichaGallery` (`this.outerHTML='<div class=\\'...'`) — escaping is fragile inside a template literal already inside an attribute. Replace with a safe DOM-free fallback.
6. **Concurrency/race**: `_openFicha` is async; if user clicks another card while fotos load, the late `_renderFichaGallery()` paints stale fotos into the new ficha. Need a token guard.
7. **`getCatalogoPortadas` with bigint ids + `.in()`** — fine, but must guard empty + the "first wins" ordering comment is correct.
8. **Search includes `descripcionLarga`** but if mapping isn't extended it's `undefined` → `normStr` handles null, OK.

Here is the corrected, one-shot-able section:

---

# 3 · F2 — Showroom UI (galería + ficha del item)

> **Pre-requisito:** F1 corrida (`sql/catalogo_showroom_f1.sql`) → `catalogo_items` ya tiene `descripcion_larga`, `colores text[]`, `ficha_tecnica jsonb`, `frente_cm`/`profundidad_cm`/`alto_cm`, y existe `catalogo_item_fotos` con su RLS espejo + bucket público `catalogo`. En F2 **sólo leemos** los campos ricos y las fotos (el CRUD de fotos/orden/portada es F3); todos pueden venir vacíos (greenfield) y se degradan a placeholder.
>
> Esta sección reescribe `catalogo.js` (prefijo `cat-`) convirtiendo la vitrina-tabla en **showroom galería + ficha full-screen**, conservando el CRUD y el panel lateral existentes. **No toca** `precio_alquiler`, `tipo_receta`, `es_cotizable`, snapshots, la RPC `calcular_receta`, ni el cotizador externo.
>
> **Limpieza obligatoria:** el `catalogo.js` actual lee `item.foto` (columna que **NO existe** en `catalogo_items` — verificado contra schema-prod). F2 **elimina toda referencia a `item.foto`** y usa exclusivamente `catalogo_item_fotos` vía las portadas/fotos de la API.

---

## 3.1 — Decisiones de diseño (cerradas)

| Tema | Decisión | Por qué |
|---|---|---|
| **Galería vs tabla** | Vista **galería** por default + toggle a **tabla**. El modo se persiste en `localStorage` (`mepex_cat_view`). | El showroom es visual; tabla queda como gestión rápida para admin. |
| **Tabs Stands/Eventos** | **Se quitan.** No existe columna de audiencia en `catalogo_items` (verificado: sólo rubro/categoria/familia). Era código muerto (ambos tabs mostraban todo). | Regla 12: no inventar columnas. El filtro real lo dan **rubro** (chips) + **categoría** (select). |
| **`item.foto`** | **Eliminado.** No existe en el schema. Las imágenes salen de `catalogo_item_fotos`. | Hallazgo verificado; era un `<img>` que apuntaba a la nada. |
| **Precio** | **READ-ONLY** desde `precio_alquiler` (RPC de Costos). Si es 0/null → chip "Sin precio" (nunca `$0`). | Contrato de interfaz con Costos + Cotizador. |
| **Foto de portada** | `catalogo_item_fotos` con `es_principal=true`; si no, la de menor `orden`; si no hay ninguna → placeholder. | Greenfield: la mayoría arranca sin fotos. |
| **Ficha** | **Full-screen** (patrón `crm`): reemplaza la grilla, back button, nav anterior/siguiente, galería de fotos + ficha técnica. | Coherencia con la app + espacio visual. |
| **Editar / Nuevo / Eliminar** | Sólo si `!isReadOnly` (`Data.isReadOnly(role,'catalogo')`). venta/pm = read-only puro. | RBAC existente; sin grants nuevos. |

---

## 3.2 — API: lectura de fotos (helper en `api.js`)

F2 sólo **lee** fotos. Agregar al bloque de catálogo de `api.js`, justo después de `getCatalogoItems()` (~línea 1679):

```javascript
// api.js — agregar después de getCatalogoItems()
// ─── CATÁLOGO SHOWROOM — fotos (F2 read-only) ───
async getCatalogoFotos(itemId) {
    if (itemId == null) return [];
    try {
        const { data, error } = await supabaseClient
            .from('catalogo_item_fotos')
            .select('id, item_id, url, storage_path, orden, es_principal, alt')
            .eq('item_id', itemId)
            .eq('_deleted', false)
            .order('es_principal', { ascending: false })
            .order('orden', { ascending: true })
            .order('id', { ascending: true });
        if (error) throw error;
        return (data || []).map(f => ({
            id: f.id,
            itemId: f.item_id,
            url: f.url,
            storagePath: f.storage_path,
            orden: f.orden ?? 0,
            esPrincipal: !!f.es_principal,
            alt: f.alt || '',
        }));
    } catch (e) {
        console.warn('[API] getCatalogoFotos:', e.message);
        return [];
    }
},

// Portada (1 foto) por cada item de una tanda → grilla. 1 sola query.
async getCatalogoPortadas(itemIds) {
    const ids = [...new Set((itemIds || []).filter(x => x != null))];
    if (ids.length === 0) return {};
    try {
        const { data, error } = await supabaseClient
            .from('catalogo_item_fotos')
            .select('item_id, url, orden, es_principal')
            .in('item_id', ids)
            .eq('_deleted', false)
            .order('es_principal', { ascending: false })
            .order('orden', { ascending: true })
            .order('id', { ascending: true });
        if (error) throw error;
        const map = {};
        // Viene ordenado (principal primero, luego menor orden) → la PRIMERA por item gana.
        (data || []).forEach(f => {
            if (map[f.item_id] === undefined) map[f.item_id] = f.url;
        });
        return map; // { [item_id]: url }
    } catch (e) {
        console.warn('[API] getCatalogoPortadas:', e.message);
        return {};
    }
},
```

> **Extender el mapeo de `getCatalogoItems()`** (api.js ~1640) para exponer los campos ricos en camelCase. Agregar al objeto que se retorna por row, **sólo las claves que no existan ya** (`disponiblePublico` ya está mapeado según ground truth — NO duplicar):
> ```javascript
> descripcionLarga: row.descripcion_larga || '',
> colores: Array.isArray(row.colores) ? row.colores : [],
> fichaTecnica: Array.isArray(row.ficha_tecnica) ? row.ficha_tecnica : [],
> frenteCm: row.frente_cm ?? null,
> profundidadCm: row.profundidad_cm ?? null,
> altoCm: row.alto_cm ?? null,
> ```
> `getCatalogoItems` hace `select('*')`, así que las columnas nuevas ya llegan en `row`; sólo falta el mapeo a camelCase. No tocar el mapeo de `precioAlquiler`/snapshots.

---

## 3.3 — `catalogo.js`: state + helpers + lifecycle

Reemplazar el bloque de state y el lifecycle. Se quita `_activeTab` (tabs eliminados) y se agrega `_stylesInjected`, `_viewMode`, portadas, y estado de ficha + un **token anti-race** (`_fichaReqToken`).

```javascript
const CatalogoModule = {

    // ─── State ───
    _items: [],
    _filteredItems: [],
    _sortCol: 'nombre',
    _sortDir: 'asc',
    _searchQuery: '',
    _rubroFilter: null,
    _categoriaFilter: null,
    _viewMode: 'galeria',      // 'galeria' | 'tabla' (persistido en localStorage)
    _activePanel: null,        // panel lateral (modo tabla — fallback)
    _activePanelData: null,
    _panelEscHandler: null,
    _stylesInjected: false,

    // Showroom
    _portadas: {},             // { item_id: url }
    _fichaItemId: null,        // item abierto en ficha full-screen
    _fichaFotos: [],
    _fichaActiveIdx: 0,
    _fichaEscHandler: null,
    _fichaReqToken: 0,         // anti-race de carga async de fotos
    _lightboxBound: false,

    _rubroOptions: ['Equipamiento', 'Iluminación', 'Infraestructura', 'Más servicios', 'Pisos'],

    _RUBRO_COLORS: {
        'Equipamiento': '#F28D15',
        'Iluminación': '#FFCA28',
        'Infraestructura': '#9B7DFF',
        'Más servicios': '#00CC88',
        'Pisos': '#607D8B',
    },

    _formFields: [
        { key: 'nombre', label: 'Nombre del item', type: 'text', required: true, placeholder: 'Ej: Columna C-100' },
        { key: 'codigo', label: 'Código', type: 'text', required: false, placeholder: 'Ej: COL-100' },
        { key: 'rubro', label: 'Rubro', type: 'select', required: false, options: ['', 'Equipamiento', 'Iluminación', 'Infraestructura', 'Más servicios', 'Pisos'] },
        { key: 'categoria', label: 'Categoría', type: 'text', required: false, placeholder: 'Ej: Mobiliario, Tableros, Sistema OCTEXA' },
        { key: 'descripcion', label: 'Descripción', type: 'text', required: false, placeholder: 'Descripción corta' },
        { key: 'origen', label: 'Origen', type: 'select', required: false, options: ['', 'Fabricación propia', 'Compra', 'Sub Alquiler'] },
        { key: 'unidad', label: 'Unidad', type: 'select', required: false, options: ['Unidad', 'Metro', 'm²', 'Kit', 'Juego'] },
    ],

    // ─── Helpers ───
    _rubroColor(r) { return this._RUBRO_COLORS[r] || '#666'; },

    _isRO() {
        const u = Auth.getUser();
        return u ? Data.isReadOnly(u.role, 'catalogo') : true;
    },

    _fmtPrice(val) {
        const n = Number(val);
        if (!n || n <= 0) return null;
        return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
    },

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        this._injectStyles();

        const saved = localStorage.getItem('mepex_cat_view');
        if (saved === 'galeria' || saved === 'tabla') this._viewMode = saved;

        // reset estado volátil de ficha/panel al re-entrar al módulo
        this._fichaItemId = null;
        this._activePanel = null;

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        await this._loadData();
        this._attachEvents();
    },

    async _loadData() {
        try {
            const items = await API.getCatalogoItems();
            this._items = items || [];
        } catch (e) {
            console.warn('[Catalogo] Error loading data:', e.message);
            this._items = [];
        }

        try {
            this._portadas = await API.getCatalogoPortadas(this._items.map(i => i.id));
        } catch (e) {
            console.warn('[Catalogo] Error loading portadas:', e.message);
            this._portadas = {};
        }

        this._applyFilters();
        this._populateCategoriaFilter();
    },
```

---

## 3.4 — Shell: toolbar + toggle de vista + filtros (sin tabs, sin foto-col fantasma)

```javascript
    _buildShell() {
        const isReadOnly = this._isRO();

        return `
            <div class="cat-wrapper">
                <div class="cat-toolbar">
                    <div class="cat-toolbar-left">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #F28D15">COMERCIAL</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Catálogo</span>
                        </div>
                        <h1 class="cat-title">Showroom</h1>
                    </div>
                    <div class="cat-toolbar-right">
                        <div class="cat-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" class="cat-search-input" id="catSearchInput" placeholder="Buscar item…" autocomplete="off">
                        </div>
                        <div class="cat-view-toggle" id="catViewToggle" role="group" aria-label="Cambiar vista">
                            <button class="cat-view-btn ${this._viewMode === 'galeria' ? 'active' : ''}" data-view="galeria" title="Galería" aria-label="Galería">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                            </button>
                            <button class="cat-view-btn ${this._viewMode === 'tabla' ? 'active' : ''}" data-view="tabla" title="Tabla" aria-label="Tabla">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                            </button>
                        </div>
                        ${!isReadOnly ? `
                        <button class="btn btn-primary cat-btn-new" id="catBtnNew">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Nuevo item
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Filters (rubro chips + categoría) -->
                <div class="cat-filters" id="catFilters">
                    <div class="cat-filter-group">
                        <span class="cat-filter-label">Rubro</span>
                        <div class="cat-chips" id="catRubroChips">
                            <button class="cat-chip ${!this._rubroFilter ? 'active' : ''}" data-rubro="">Todos</button>
                            ${this._rubroOptions.map(r => `
                                <button class="cat-chip ${this._rubroFilter === r ? 'active' : ''}" data-rubro="${escAttr(r)}" style="--chip-color:${this._rubroColor(r)}">${escHtml(r)}</button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="cat-filter-group" id="catCategoriaGroup" style="display:none">
                        <span class="cat-filter-label">Categoría</span>
                        <select class="cat-select" id="catFilterCategoria">
                            <option value="">Todas</option>
                        </select>
                    </div>
                </div>

                <!-- Body -->
                <div class="cat-body">
                    <div class="cat-main" id="catMainContent">
                        <div class="cat-loading">
                            <div class="spinner"></div>
                            Cargando showroom…
                        </div>
                    </div>
                    <div class="cat-side-panel" id="catSidePanel">
                        <div class="cat-panel-inner" id="catPanelInner"></div>
                    </div>
                </div>

                <div class="cat-record-count" id="catRecordCount"></div>
            </div>
        `;
    },

    _populateCategoriaFilter() {
        const categorias = [...new Set(this._items.map(i => i.categoria).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'es'));
        const sel = document.getElementById('catFilterCategoria');
        if (!sel) return;
        sel.innerHTML = `<option value="">Todas</option>` +
            categorias.map(c => `<option value="${escAttr(c)}" ${this._categoriaFilter === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('');
        const group = document.getElementById('catCategoriaGroup');
        if (group) group.style.display = categorias.length > 0 ? '' : 'none';
    },
```

---

## 3.5 — Filtrado / sort + router de vista

`_applyFilters` ahora dispara `_renderBody()` (galería **o** tabla). Si la ficha está abierta, recalcula `_filteredItems` (para que la nav prev/next quede consistente) pero **no** repinta el body.

```javascript
    _applyFilters() {
        let data = [...this._items];

        if (this._searchQuery) {
            const q = normStr(this._searchQuery);
            data = data.filter(i =>
                normStr(i.nombre).includes(q) ||
                normStr(i.codigo).includes(q) ||
                normStr(i.rubro).includes(q) ||
                normStr(i.categoria).includes(q) ||
                normStr(i.descripcion).includes(q) ||
                normStr(i.descripcionLarga).includes(q)
            );
        }
        if (this._rubroFilter) data = data.filter(i => (i.rubro || '') === this._rubroFilter);
        if (this._categoriaFilter) data = data.filter(i => (i.categoria || '') === this._categoriaFilter);

        this._filteredItems = this._sortData(data);

        // Si hay ficha abierta no tocamos el body; sólo dejamos _filteredItems al día.
        if (this._fichaItemId != null) return;
        this._renderBody();
    },

    _sortData(data) {
        const col = this._sortCol;
        const dir = this._sortDir === 'asc' ? 1 : -1;
        return data.sort((a, b) => {
            const va = (a[col] || '').toString().toLowerCase();
            const vb = (b[col] || '').toString().toLowerCase();
            const cmp = va.localeCompare(vb, 'es');
            return cmp * dir;
        });
    },

    _renderBody() {
        const countEl = document.getElementById('catRecordCount');
        if (countEl) {
            countEl.style.display = '';
            const n = this._filteredItems.length;
            countEl.textContent = `${n} item${n !== 1 ? 's' : ''}`;
        }
        if (this._viewMode === 'galeria') this._renderGallery();
        else this._renderTable();
    },
```

---

## 3.6 — Vista GALERÍA (cards)

```javascript
    _renderGallery() {
        const container = document.getElementById('catMainContent');
        if (!container) return;
        const data = this._filteredItems;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="cat-empty">
                    <div class="cat-empty-icon">🔩</div>
                    <p>No se encontraron items</p>
                    <p class="cat-empty-sub">Probá ajustar los filtros o la búsqueda</p>
                </div>`;
            return;
        }

        const cards = data.map(item => {
            const rc = this._rubroColor(item.rubro);
            const portada = this._portadas[item.id];
            const price = this._fmtPrice(item.precioAlquiler);
            const pub = item.disponiblePublico;

            const media = portada
                ? `<img class="cat-card-img" src="${escAttr(portada)}" alt="${escAttr(item.nombre)}" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('cat-card-media-empty');this.parentElement.insertAdjacentHTML('afterbegin','<div class=&quot;cat-card-noimg&quot;>📷</div>');">`
                : `<div class="cat-card-noimg">📷</div>`;

            return `
                <button class="cat-card" data-id="${escAttr(item.id)}" type="button">
                    <div class="cat-card-media ${portada ? '' : 'cat-card-media-empty'}">
                        ${media}
                        ${pub ? `<span class="cat-card-pub" title="Disponible públicamente">●</span>` : ''}
                        ${item.rubro ? `<span class="cat-card-rubro" style="background:${rc}">${escHtml(item.rubro)}</span>` : ''}
                    </div>
                    <div class="cat-card-info">
                        <div class="cat-card-name">${escHtml(item.nombre || 'Sin nombre')}</div>
                        <div class="cat-card-sub">
                            ${item.codigo ? `<span class="cat-card-code">${escHtml(item.codigo)}</span>` : ''}
                            ${item.categoria ? `<span class="cat-card-cat">${escHtml(item.categoria)}</span>` : ''}
                        </div>
                        <div class="cat-card-foot">
                            ${price
                                ? `<span class="cat-card-price">${price}</span>`
                                : `<span class="cat-card-noprice">Sin precio</span>`}
                        </div>
                    </div>
                </button>`;
        }).join('');

        container.innerHTML = `<div class="cat-gallery">${cards}</div>`;
        this._attachGalleryEvents();
    },

    _attachGalleryEvents() {
        document.querySelectorAll('.cat-card[data-id]').forEach(card => {
            card.addEventListener('click', () => {
                const item = this._filteredItems.find(i => String(i.id) === card.dataset.id);
                if (item) this._openFicha(item);
            });
        });
    },
```

> **Nota sobre el `onerror` de la card:** usa `&quot;` para las comillas internas (HTML-entity, no backslash) → seguro dentro de un atributo dentro de template literal. Inserta el placeholder 📷 sin reescribir el resto del DOM.

---

## 3.7 — Vista TABLA (conservada) + click → ficha (sin `item.foto`)

Se mantiene la tabla, **pero**: (1) la miniatura sale de la portada (no de `item.foto`, eliminado); (2) se agrega columna PRECIO read-only; (3) el click de fila abre la **ficha** (no el panel lateral). El panel lateral queda vivo como fallback pero ya no se invoca desde la tabla.

```javascript
    _renderTable() {
        const container = document.getElementById('catMainContent');
        if (!container) return;
        const data = this._filteredItems;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="cat-empty">
                    <div class="cat-empty-icon">🔩</div>
                    <p>No se encontraron items</p>
                    <p class="cat-empty-sub">Probá ajustar los filtros o la búsqueda</p>
                </div>`;
            return;
        }

        const sortIcon = (col) => this._sortCol !== col ? ''
            : (this._sortDir === 'asc' ? '<span class="cat-sort-icon">↑</span>' : '<span class="cat-sort-icon">↓</span>');

        const rows = data.map(item => {
            const rc = this._rubroColor(item.rubro);
            const portada = this._portadas[item.id];
            const price = this._fmtPrice(item.precioAlquiler);
            return `
                <tr class="cat-row" data-id="${escAttr(item.id)}">
                    <td class="cat-td cat-td-thumb">
                        ${portada
                            ? `<img src="${escAttr(portada)}" class="cat-thumb-img" alt="" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('cat-thumb-fallback');">`
                            : '<span class="cat-thumb-empty">📷</span>'}
                    </td>
                    <td class="cat-td"><span class="cat-td-code">${escHtml(item.codigo) || '—'}</span></td>
                    <td class="cat-td cat-td-name">${escHtml(item.nombre) || '—'}</td>
                    <td class="cat-td">
                        ${item.rubro ? `<span class="cat-rubro-badge" style="--rubro-color: ${rc}">${escHtml(item.rubro)}</span>` : '<span class="cat-td-muted">—</span>'}
                    </td>
                    <td class="cat-td">${escHtml(item.categoria) || '<span class="cat-td-muted">—</span>'}</td>
                    <td class="cat-td cat-td-price">${price ? `<span class="cat-td-priceval">${price}</span>` : '<span class="cat-td-muted">—</span>'}</td>
                    <td class="cat-td">${escHtml(item.unidad) || '<span class="cat-td-muted">—</span>'}</td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="cat-table-wrapper">
                <table class="cat-table">
                    <thead>
                        <tr>
                            <th class="cat-th">FOTO</th>
                            <th class="cat-th sortable" data-sort="codigo">CÓDIGO${sortIcon('codigo')}</th>
                            <th class="cat-th sortable" data-sort="nombre">NOMBRE${sortIcon('nombre')}</th>
                            <th class="cat-th sortable" data-sort="rubro">RUBRO${sortIcon('rubro')}</th>
                            <th class="cat-th sortable" data-sort="categoria">CATEGORÍA${sortIcon('categoria')}</th>
                            <th class="cat-th">PRECIO</th>
                            <th class="cat-th">UNIDAD</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        this._attachTableEvents();
    },

    _attachTableEvents() {
        document.querySelectorAll('.cat-th.sortable[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._sortCol === col) this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                else { this._sortCol = col; this._sortDir = 'asc'; }
                this._applyFilters();
            });
        });
        document.querySelectorAll('.cat-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                const item = this._filteredItems.find(i => String(i.id) === row.dataset.id);
                if (item) this._openFicha(item);
            });
        });
    },
```

---

## 3.8 — Eventos de shell (toggle de vista, chips, search, lightbox)

Reemplaza `_attachEvents`. Se quita el wiring de tabs (eliminados) y se agrega el toggle galería/tabla + el lightbox delegado.

```javascript
    _attachEvents() {
        const searchInput = document.getElementById('catSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this._searchQuery = searchInput.value.trim();
                this._applyFilters();
            });
        }

        document.querySelectorAll('.cat-chip[data-rubro]').forEach(chip => {
            chip.addEventListener('click', () => {
                this._rubroFilter = chip.dataset.rubro || null;
                document.querySelectorAll('.cat-chip[data-rubro]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this._applyFilters();
            });
        });

        const catSel = document.getElementById('catFilterCategoria');
        if (catSel) {
            catSel.addEventListener('change', () => {
                this._categoriaFilter = catSel.value || null;
                this._applyFilters();
            });
        }

        // View toggle galería/tabla
        document.querySelectorAll('.cat-view-btn[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                const v = btn.dataset.view;
                if (v === this._viewMode) return;
                this._viewMode = v;
                localStorage.setItem('mepex_cat_view', v);
                document.querySelectorAll('.cat-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._closePanel();          // por si venías de la tabla con panel abierto
                if (this._fichaItemId == null) this._renderBody();
            });
        });

        const btnNew = document.getElementById('catBtnNew');
        if (btnNew) btnNew.addEventListener('click', () => this._openCreateModal());

        // Lightbox delegado (1 sola vez en la vida del módulo)
        if (!this._lightboxBound) {
            this._lightboxBound = true;
            document.addEventListener('click', (e) => {
                const a = e.target.closest && e.target.closest('[data-cat-lightbox]');
                if (a && a.dataset.catLightbox) {
                    e.preventDefault();
                    this._openLightbox(a.dataset.catLightbox);
                }
            });
        }
    },
```

---

## 3.9 — FICHA full-screen (galería de fotos + ficha técnica + nav) — con guard anti-race

La ficha se renderiza dentro de `#catMainContent`, oculta filtros + contador, y cierra el panel lateral. Las fotos se cargan on-demand con un **token** que descarta respuestas tardías si el usuario ya cambió de item.

```javascript
    async _openFicha(item) {
        this._closePanel();
        this._fichaItemId = item.id;
        this._fichaActiveIdx = 0;
        this._fichaFotos = [];

        const myToken = ++this._fichaReqToken;   // invalida cargas previas

        const filters = document.getElementById('catFilters');
        if (filters) filters.style.display = 'none';
        const countEl = document.getElementById('catRecordCount');
        if (countEl) countEl.style.display = 'none';

        // Render inmediato (skeleton de fotos), luego hidrata
        this._renderFicha(item);

        let fotos = [];
        try {
            fotos = await API.getCatalogoFotos(item.id);
        } catch (e) {
            console.warn('[Catalogo] fotos ficha:', e.message);
            fotos = [];
        }

        // Si el usuario navegó a otro item mientras cargaban, abortar.
        if (myToken !== this._fichaReqToken) return;

        this._fichaFotos = fotos;
        const pi = fotos.findIndex(f => f.esPrincipal);
        this._fichaActiveIdx = pi >= 0 ? pi : 0;
        this._renderFichaGallery();

        // Esc/flechas — un único handler de ficha
        if (this._fichaEscHandler) document.removeEventListener('keydown', this._fichaEscHandler);
        this._fichaEscHandler = (e) => {
            if (e.key === 'Escape') {
                if (document.querySelector('.cat-lightbox')) return; // el lightbox cierra primero
                this._closeFicha();
            } else if (e.key === 'ArrowLeft') {
                this._navFicha(-1);
            } else if (e.key === 'ArrowRight') {
                this._navFicha(1);
            }
        };
        document.addEventListener('keydown', this._fichaEscHandler);
    },

    _fichaIndex() {
        return this._filteredItems.findIndex(i => String(i.id) === String(this._fichaItemId));
    },

    _navFicha(dir) {
        const list = this._filteredItems;
        if (list.length <= 1) return;
        let idx = this._fichaIndex();
        if (idx < 0) return;
        idx = (idx + dir + list.length) % list.length;   // wrap circular
        this._openFicha(list[idx]);
    },

    _renderFicha(item) {
        const container = document.getElementById('catMainContent');
        if (!container) return;
        const isReadOnly = this._isRO();
        const rc = this._rubroColor(item.rubro);
        const price = this._fmtPrice(item.precioAlquiler);

        const idx = this._fichaIndex();
        const total = this._filteredItems.length;
        const navInfo = idx >= 0 && total > 0 ? `${idx + 1} / ${total}` : '';

        const colores = Array.isArray(item.colores) ? item.colores : [];
        const coloresHtml = colores.length
            ? `<div class="cat-fc-block">
                 <div class="cat-fc-title">Colores</div>
                 <div class="cat-color-chips">
                   ${colores.map(c => `<span class="cat-color-chip">${escHtml(c)}</span>`).join('')}
                 </div>
               </div>` : '';

        const med = [];
        if (item.frenteCm != null) med.push(`${item.frenteCm}`);
        if (item.profundidadCm != null) med.push(`${item.profundidadCm}`);
        if (item.altoCm != null) med.push(`${item.altoCm}`);
        const medidasHtml = med.length
            ? `<div class="cat-fc-block">
                 <div class="cat-fc-title">Medidas (F × P × A)</div>
                 <div class="cat-medidas">${escHtml(med.join(' × '))} cm</div>
               </div>` : '';

        const ft = Array.isArray(item.fichaTecnica) ? item.fichaTecnica : [];
        const ftRows = ft.filter(r => r && (r.label || r.valor)).map(r => `
            <tr><td class="cat-ft-k">${escHtml(r.label || '')}</td><td class="cat-ft-v">${escHtml(r.valor || '')}</td></tr>
        `).join('');
        const fichaTecHtml = ftRows
            ? `<div class="cat-fc-block">
                 <div class="cat-fc-title">Ficha técnica</div>
                 <table class="cat-ft-table"><tbody>${ftRows}</tbody></table>
               </div>` : '';

        const descLarga = item.descripcionLarga || item.descripcion || '';
        const descHtml = descLarga
            ? `<div class="cat-fc-block">
                 <div class="cat-fc-title">Descripción</div>
                 <p class="cat-fc-desc">${escHtml(descLarga)}</p>
               </div>` : '';

        container.innerHTML = `
            <div class="cat-ficha">
                <div class="cat-ficha-bar">
                    <button class="cat-ficha-back" id="catFichaBack">← Volver</button>
                    <div class="cat-ficha-nav">
                        <button class="cat-ficha-navbtn" id="catFichaPrev" title="Anterior (←)" ${total <= 1 ? 'disabled' : ''}>‹</button>
                        <span class="cat-ficha-pos">${navInfo}</span>
                        <button class="cat-ficha-navbtn" id="catFichaNext" title="Siguiente (→)" ${total <= 1 ? 'disabled' : ''}>›</button>
                    </div>
                    ${!isReadOnly ? `<button class="cat-ficha-edit" id="catFichaEdit">✏️ Editar</button>` : '<span></span>'}
                </div>

                <div class="cat-ficha-body">
                    <!-- Columna fotos -->
                    <div class="cat-ficha-media" id="catFichaMedia">
                        <div class="cat-ficha-main-photo cat-card-media-empty" id="catFichaMain">
                            <div class="cat-card-noimg">📷</div>
                        </div>
                        <div class="cat-ficha-thumbs" id="catFichaThumbs"></div>
                    </div>

                    <!-- Columna info -->
                    <div class="cat-ficha-detail">
                        <div class="cat-ficha-head">
                            <h2 class="cat-ficha-name" style="color:${rc}">${escHtml(item.nombre || 'Sin nombre')}</h2>
                            <div class="cat-ficha-meta">
                                ${item.codigo ? `<span class="cat-ficha-code">${escHtml(item.codigo)}</span>` : ''}
                                ${item.rubro ? `<span class="cat-rubro-badge" style="--rubro-color:${rc}">${escHtml(item.rubro)}</span>` : ''}
                                ${item.categoria ? `<span class="cat-ficha-cat">${escHtml(item.categoria)}</span>` : ''}
                            </div>
                        </div>

                        <div class="cat-ficha-price-row">
                            ${price
                                ? `<div class="cat-ficha-price">${price}<span class="cat-ficha-price-unit">/ ${escHtml(item.unidad || 'unidad')}</span></div>`
                                : `<div class="cat-ficha-noprice">Precio no disponible</div>`}
                            <div class="cat-ficha-price-note">Precio de alquiler · definido en Costos</div>
                        </div>

                        ${descHtml}
                        ${medidasHtml}
                        ${coloresHtml}
                        ${fichaTecHtml}

                        <div class="cat-fc-block">
                            <div class="cat-fc-title">Datos</div>
                            <div class="cat-ficha-info-grid">
                                <div class="cat-info-row"><span class="cat-info-label">Origen</span><span class="cat-info-value">${escHtml(item.origen) || '—'}</span></div>
                                <div class="cat-info-row"><span class="cat-info-label">Unidad</span><span class="cat-info-value">${escHtml(item.unidad) || '—'}</span></div>
                                <div class="cat-info-row"><span class="cat-info-label">Público</span><span class="cat-info-value">${item.disponiblePublico ? 'Sí' : 'No'}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        document.getElementById('catFichaBack')?.addEventListener('click', () => this._closeFicha());
        document.getElementById('catFichaPrev')?.addEventListener('click', () => this._navFicha(-1));
        document.getElementById('catFichaNext')?.addEventListener('click', () => this._navFicha(1));
        const editBtn = document.getElementById('catFichaEdit');
        if (editBtn) editBtn.addEventListener('click', () => this._openEditModal(item));
    },

    _renderFichaGallery() {
        const main = document.getElementById('catFichaMain');
        const thumbs = document.getElementById('catFichaThumbs');
        if (!main || !thumbs) return;

        const fotos = this._fichaFotos;
        if (!fotos.length) {
            main.className = 'cat-ficha-main-photo cat-card-media-empty';
            main.innerHTML = `<div class="cat-card-noimg">📷</div>`;
            thumbs.innerHTML = '';
            return;
        }

        const idx = Math.min(this._fichaActiveIdx, fotos.length - 1);
        const active = fotos[idx];
        main.className = 'cat-ficha-main-photo';
        // onerror: cae a placeholder sin nesting de comillas frágil (usa clase + texto plano)
        main.innerHTML = `<img src="${escAttr(active.url)}" alt="${escAttr(active.alt)}" class="cat-ficha-main-img" data-cat-lightbox="${escAttr(active.url)}" onerror="this.removeAttribute('data-cat-lightbox');this.style.display='none';this.parentElement.classList.add('cat-card-media-empty');this.parentElement.insertAdjacentHTML('beforeend','<div class=&quot;cat-card-noimg&quot;>📷</div>');">`;

        thumbs.innerHTML = fotos.map((f, i) => `
            <button class="cat-ficha-thumb ${i === idx ? 'active' : ''}" data-thumb="${i}" type="button">
                <img src="${escAttr(f.url)}" alt="${escAttr(f.alt)}" loading="lazy" onerror="this.parentElement.classList.add('cat-thumb-broken');">
            </button>
        `).join('');

        thumbs.querySelectorAll('.cat-ficha-thumb[data-thumb]').forEach(t => {
            t.addEventListener('click', () => {
                this._fichaActiveIdx = parseInt(t.dataset.thumb, 10) || 0;
                this._renderFichaGallery();
            });
        });
    },

    _closeFicha() {
        this._fichaItemId = null;
        this._fichaFotos = [];
        this._fichaActiveIdx = 0;
        this._fichaReqToken++;   // invalida cualquier carga de fotos en vuelo
        if (this._fichaEscHandler) {
            document.removeEventListener('keydown', this._fichaEscHandler);
            this._fichaEscHandler = null;
        }
        const filters = document.getElementById('catFilters');
        if (filters) filters.style.display = '';
        this._renderBody();   // vuelve a galería/tabla (re-muestra el contador)
    },
```

---

## 3.10 — LIGHTBOX (patrón crm)

```javascript
    _openLightbox(src) {
        if (!src) return;
        const ov = document.createElement('div');
        ov.className = 'cat-lightbox';
        ov.innerHTML = `<img src="${escAttr(src)}" alt=""><button class="cat-lightbox-x" aria-label="Cerrar">✕</button>`;
        const close = () => { ov.remove(); document.removeEventListener('keydown', esc); };
        const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
        ov.addEventListener('click', close);
        document.addEventListener('keydown', esc);
        document.body.appendChild(ov);
    },
```

> El handler de Esc de la ficha hace `return` si hay `.cat-lightbox` abierto. El handler del lightbox hace `stopPropagation`, así que el primer Esc cierra el lightbox y el segundo cierra la ficha.

---

## 3.11 — CRUD modales: `Modal.closeAll()` + refrescar la vista correcta

Los modales create/edit/delete y el panel lateral (`_openPanel`/`_closePanel`/`_editFoto`) se **conservan** del archivo actual, con **tres correcciones**:

**(a) Reemplazar `Modal.close()` por `Modal.closeAll()`** en create y edit. El `Modal.close()` sin argumento **no cierra de forma confiable** (ground truth: requiere `instance.id`). El archivo actual lo usa en las líneas 574 y 642 — corregir ambos.

En `_openCreateModal` (handler de éxito):
```javascript
                const result = await API.createCatalogoItem(values);
                if (result) {
                    Toast.success(`Item "${values.nombre}" creado`);
                    Modal.closeAll();
                    API.clearCache();
                    await this._loadData();
                } else {
                    Toast.error('Error al crear el item');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Crear item';
                }
```

**(b)** En `_openEditModal`, tras éxito, refrescar la **ficha** si está abierta (o el panel lateral si venías de la tabla):
```javascript
                const result = await API.updateCatalogoItem(item.id, values);
                if (result) {
                    Toast.success('Item actualizado');
                    Modal.closeAll();
                    API.clearCache();
                    await this._loadData();   // recarga _items + portadas; _applyFilters NO repinta si ficha abierta
                    const updated = this._items.find(i => i.id === item.id);
                    if (updated) {
                        if (this._fichaItemId === item.id) {
                            this._renderFicha(updated);
                            this._renderFichaGallery();
                        } else if (this._activePanel === item.id) {
                            this._openPanel(updated);
                        }
                    }
                } else {
                    Toast.error('Error al actualizar');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Guardar cambios';
                }
```
> Si el item editado salió del filtro/búsqueda activo, `_loadData()→_applyFilters()` lo saca de `_filteredItems`; con la ficha abierta `_renderFicha(updated)` igual lo muestra (sigue en `_items`), y al cerrar la ficha el body ya no lo lista. Comportamiento aceptable.

**(c)** En `_deleteItem`, tras éxito, cerrar ficha y/o panel:
```javascript
        const result = await API.deleteCatalogoItem(item.id);
        if (result) {
            Toast.success(`"${item.nombre}" eliminado`);
            if (this._fichaItemId === item.id) this._closeFicha();
            this._closePanel();
            API.clearCache();
            await this._loadData();
        } else {
            Toast.error('Error al eliminar');
        }
```

> `_openCreateModal`, `_openPanel`, `_closePanel`, y `_editFoto` (placeholder `Toast.info('Subida de fotos — próximamente')` hasta F3) **no cambian** salvo el `Modal.closeAll()` de (a). El panel lateral sigue vivo como camino alternativo. **El `_renderTable`/`_openPanel` del archivo actual referenciaban `item.foto`** — ya quedaron reemplazados (tabla en §3.7; el panel lateral debe quitar también su sección "Imagen" que lee `item.foto`: o se deja como `Sin imagen` fijo, o —recomendado— se reemplaza esa sección por la portada `this._portadas[item.id]`). Para no romper, basta dejar la sección "Imagen" del panel mostrando `this._portadas[item.id]` o el empty-state, **nunca `item.foto`**.

---

## 3.12 — CSS (`_injectStyles`, prefijo `cat-`, tokens dark)

```javascript
    _injectStyles() {
        if (this._stylesInjected) return;
        this._stylesInjected = true;
        const style = document.createElement('style');
        style.id = 'cat-showroom-styles';
        style.textContent = `
        /* ── View toggle ── */
        .cat-view-toggle { display:flex; gap:2px; background:var(--bg-card-2); border:1px solid var(--border); border-radius:var(--radius-md); padding:2px; }
        .cat-view-btn { display:flex; align-items:center; justify-content:center; width:34px; height:30px; background:transparent; border:none; color:var(--text-muted); border-radius:4px; cursor:pointer; transition:all .2s var(--ease); }
        .cat-view-btn:hover { color:var(--text-primary); }
        .cat-view-btn.active { background:var(--primary); color:#fff; }

        /* ── Chips color hint ── */
        .cat-chip { --chip-color: var(--primary); }
        .cat-chip.active { border-color: var(--chip-color); color: var(--chip-color); box-shadow:0 0 0 1px var(--chip-color) inset; }

        /* ── GALERÍA ── */
        .cat-gallery { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:16px; padding:4px 2px 24px; }
        .cat-card { display:flex; flex-direction:column; text-align:left; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; cursor:pointer; padding:0; transition:border-color .2s var(--ease), transform .15s var(--ease), box-shadow .2s var(--ease); }
        .cat-card:hover { border-color:var(--border-active); transform:translateY(-2px); box-shadow:var(--glow-sm); }
        .cat-card-media { position:relative; width:100%; aspect-ratio:4/3; background:var(--bg-card-2); overflow:hidden; display:flex; align-items:center; justify-content:center; }
        .cat-card-img { width:100%; height:100%; object-fit:cover; display:block; }
        .cat-card-media-empty { background:repeating-linear-gradient(45deg, #141414, #141414 10px, #181818 10px, #181818 20px); }
        .cat-card-noimg { font-size:2rem; opacity:.35; }
        .cat-card-pub { position:absolute; top:8px; left:8px; color:var(--color-success); font-size:.7rem; text-shadow:0 0 6px rgba(0,204,136,.8); }
        .cat-card-rubro { position:absolute; top:8px; right:8px; font-family:var(--font-mono); font-size:.58rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#fff; padding:3px 7px; border-radius:4px; }
        .cat-card-info { padding:11px 12px 13px; display:flex; flex-direction:column; gap:5px; }
        .cat-card-name { font-family:var(--font-main); font-weight:600; font-size:.92rem; color:var(--text-primary); line-height:1.25; }
        .cat-card-sub { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
        .cat-card-code { font-family:var(--font-mono); font-size:.66rem; color:var(--text-muted); }
        .cat-card-cat { font-size:.7rem; color:var(--text-dim); }
        .cat-card-foot { margin-top:3px; }
        .cat-card-price { font-family:var(--font-mono); font-weight:700; font-size:.95rem; color:var(--primary); }
        .cat-card-noprice { font-family:var(--font-mono); font-size:.7rem; color:var(--text-dim); }

        /* ── Tabla: thumb + precio ── */
        .cat-td-thumb { width:54px; }
        .cat-thumb-img { width:42px; height:42px; object-fit:cover; border-radius:4px; display:block; }
        .cat-thumb-empty { opacity:.3; }
        .cat-thumb-fallback::after { content:'📷'; opacity:.3; }
        .cat-td-price { white-space:nowrap; }
        .cat-td-priceval { font-family:var(--font-mono); font-weight:700; color:var(--primary); }

        /* ── Empty ── */
        .cat-empty-sub { color:#555; font-size:13px; }

        /* ── FICHA full-screen ── */
        .cat-ficha { display:flex; flex-direction:column; height:100%; min-height:0; }
        .cat-ficha-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 2px 14px; border-bottom:1px solid var(--border); margin-bottom:18px; }
        .cat-ficha-back, .cat-ficha-edit { background:var(--bg-card-2); border:1px solid var(--border); color:var(--text-primary); padding:7px 13px; border-radius:var(--radius-md); cursor:pointer; font-size:.82rem; transition:all .2s var(--ease); }
        .cat-ficha-back:hover { border-color:var(--border-active); color:var(--primary); }
        .cat-ficha-edit:hover { border-color:var(--primary); color:var(--primary); }
        .cat-ficha-nav { display:flex; align-items:center; gap:10px; }
        .cat-ficha-navbtn { width:30px; height:30px; border-radius:50%; background:var(--bg-card-2); border:1px solid var(--border); color:var(--text-primary); font-size:1.1rem; line-height:1; cursor:pointer; transition:all .2s var(--ease); }
        .cat-ficha-navbtn:hover:not(:disabled) { border-color:var(--primary); color:var(--primary); }
        .cat-ficha-navbtn:disabled { opacity:.3; cursor:default; }
        .cat-ficha-pos { font-family:var(--font-mono); font-size:.74rem; color:var(--text-muted); min-width:54px; text-align:center; }

        .cat-ficha-body { display:grid; grid-template-columns:minmax(0, 1.05fr) minmax(0, 1fr); gap:28px; overflow-y:auto; padding-bottom:24px; align-items:start; }

        .cat-ficha-media { display:flex; flex-direction:column; gap:10px; position:sticky; top:0; }
        .cat-ficha-main-photo { width:100%; aspect-ratio:4/3; background:var(--bg-card-2); border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; display:flex; align-items:center; justify-content:center; }
        .cat-ficha-main-img { width:100%; height:100%; object-fit:contain; cursor:zoom-in; display:block; }
        .cat-ficha-thumbs { display:flex; gap:8px; flex-wrap:wrap; }
        .cat-ficha-thumb { width:62px; height:62px; padding:0; border:2px solid var(--border); border-radius:var(--radius-md); overflow:hidden; cursor:pointer; background:var(--bg-card-2); transition:border-color .2s var(--ease); }
        .cat-ficha-thumb:hover { border-color:var(--border-active); }
        .cat-ficha-thumb.active { border-color:var(--primary); }
        .cat-ficha-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .cat-ficha-thumb.cat-thumb-broken { display:none; }

        .cat-ficha-detail { display:flex; flex-direction:column; gap:18px; min-width:0; }
        .cat-ficha-head { display:flex; flex-direction:column; gap:8px; }
        .cat-ficha-name { font-family:var(--font-main); font-weight:700; font-size:1.5rem; line-height:1.15; margin:0; }
        .cat-ficha-meta { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .cat-ficha-code { font-family:var(--font-mono); font-size:.78rem; color:var(--text-muted); }
        .cat-ficha-cat { font-size:.8rem; color:var(--text-dim); }

        .cat-ficha-price-row { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:13px 16px; }
        .cat-ficha-price { font-family:var(--font-mono); font-weight:700; font-size:1.6rem; color:var(--primary); }
        .cat-ficha-price-unit { font-size:.85rem; color:var(--text-muted); margin-left:6px; font-weight:400; }
        .cat-ficha-noprice { font-family:var(--font-mono); font-size:1rem; color:var(--text-dim); }
        .cat-ficha-price-note { font-size:.68rem; color:var(--text-dim); margin-top:4px; }

        .cat-fc-block { display:flex; flex-direction:column; gap:8px; }
        .cat-fc-title { font-family:var(--font-mono); font-size:.62rem; text-transform:uppercase; letter-spacing:.18em; color:var(--text-muted); }
        .cat-fc-desc { font-size:.9rem; line-height:1.55; color:var(--text-primary); margin:0; white-space:pre-wrap; }
        .cat-medidas { font-family:var(--font-mono); font-size:.95rem; color:var(--text-primary); }
        .cat-color-chips { display:flex; flex-wrap:wrap; gap:6px; }
        .cat-color-chip { font-size:.76rem; color:var(--text-primary); background:var(--bg-card-2); border:1px solid var(--border); border-radius:20px; padding:3px 11px; }
        .cat-ft-table { width:100%; border-collapse:collapse; }
        .cat-ft-table td { padding:7px 0; border-bottom:1px solid var(--border); font-size:.85rem; vertical-align:top; }
        .cat-ft-k { color:var(--text-muted); width:42%; padding-right:12px; }
        .cat-ft-v { color:var(--text-primary); }
        .cat-ficha-info-grid { display:flex; flex-direction:column; gap:2px; }
        .cat-ficha-info-grid .cat-info-row { display:flex; justify-content:space-between; gap:12px; padding:5px 0; border-bottom:1px solid var(--border); }
        .cat-ficha-info-grid .cat-info-label { color:var(--text-muted); font-size:.82rem; }
        .cat-ficha-info-grid .cat-info-value { color:var(--text-primary); font-size:.85rem; text-align:right; }

        /* ── LIGHTBOX ── */
        .cat-lightbox { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,.9); display:flex; align-items:center; justify-content:center; cursor:zoom-out; }
        .cat-lightbox img { max-width:92vw; max-height:92vh; border-radius:8px; box-shadow:0 0 40px rgba(0,0,0,.6); }
        .cat-lightbox-x { position:fixed; top:18px; right:22px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,.12); color:#fff; border:1px solid rgba(255,255,255,.25); font-size:1rem; cursor:pointer; }

        /* ── Mobile ── */
        @media (max-width: 860px) {
            .cat-ficha-body { grid-template-columns:1fr; gap:20px; }
            .cat-ficha-media { position:static; }
            .cat-ficha-name { font-size:1.25rem; }
        }
        @media (max-width: 560px) {
            .cat-gallery { grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:11px; }
            .cat-card-name { font-size:.85rem; }
            .cat-ficha-bar { flex-wrap:wrap; gap:8px; }
        }
        `;
        document.head.appendChild(style);
    },
```

> Estilos heredados de `style.css` (`.cat-wrapper`, `.cat-toolbar`, `.cat-search-box`, `.cat-table`, `.cat-side-panel`, `.cat-panel-*`, `.cat-empty`, `.cat-loading`, `.cat-record-count`, `.cat-info-row/-label/-value`) **se conservan**; lo de arriba sólo **agrega** lo nuevo. Tokens (`--bg-card-2`, `--bg-card-3`, `--border-active`, `--glow-sm`) ya existen en `style.css:12-94`. **Importante:** las reglas viejas de tabs (`.cat-tabs-bar`/`.cat-tab`/`.cat-tab-desc`) en `style.css` quedan huérfanas pero inofensivas — no se borran en F2 (cambio quirúrgico; sólo dejan de usarse en el HTML).

---

## 3.13 — `index.html`: bump de versión

```html
<script src="catalogo.js?v=2"></script>
```
> Subir `?v=` al siguiente número real al integrar todas las fases. Si F1 ya tocó `catalogo.js`, usar el correlativo correspondiente.

---

## 3.14 — Edge cases cubiertos

| Caso | Manejo |
|---|---|
| `item.foto` (columna fantasma) | **Eliminado** de tabla y panel. Imágenes sólo desde `catalogo_item_fotos`. |
| Item sin fotos (greenfield, mayoría) | Card y ficha → placeholder rayado + 📷. `getCatalogoPortadas`/`getCatalogoFotos` devuelven vacío sin romper. |
| URL de foto rota / bucket vacío | `onerror` (entities `&quot;`, sin nesting frágil de comillas) cae a placeholder en card, thumb y foto grande; quita `data-cat-lightbox` del `<img>` roto. |
| Error de red al cargar items/portadas/fotos | `try/catch` en cada query → arrays/objetos vacíos; consola `warn`; UI muestra empty/placeholder, nunca crashea. |
| Foto pesada | F2 sólo muestra (`loading="lazy"` + `object-fit`); la compresión al subir es F3 (canvas, ver brief storage). |
| `precio_alquiler` = 0 / null (sin RPC) | Chip "Sin precio" / "Precio no disponible". Nunca `$0`. **Nunca se escribe** sobre `precio_alquiler`. |
| `colores`/`ficha_tecnica` null o no-array | `Array.isArray()` guard → bloque no se renderiza. |
| `ficha_tecnica` con filas vacías | `.filter(r => r.label || r.valor)`. |
| Concurrencia: clic en otra card mientras cargan fotos | **Token `_fichaReqToken`**: respuesta tardía se descarta si el usuario ya navegó. |
| Nav al borde (primer/último item) | Wrap circular `% length`; deshabilitado si ≤1 item. |
| Filtrar/buscar con ficha abierta | `_applyFilters` recalcula `_filteredItems` (nav prev/next correcto) pero **no** repinta el body. |
| Editar item que sale del filtro activo | Ficha lo sigue mostrando (está en `_items`); al cerrar, el body ya no lo lista. |
| `Modal.close()` sin id (bug latente del archivo actual) | Reemplazado por `Modal.closeAll()` en create/edit. |
| XSS por datos de usuario | Todo interpolado con `escHtml`/`escAttr` (nombre, código, colores, ficha técnica, urls, alt). |
| Permisos | "Nuevo/Editar/Eliminar" sólo si `!this._isRO()`; venta/pm read-only. **No** se tocan `precio_alquiler`/`es_cotizable`/`tipo_receta`/snapshots → cotizador + costeo intactos. |
| Re-entrada al módulo | `render()` resetea `_fichaItemId`/`_activePanel` para no quedar con estado huérfano. |
| RLS | Las queries de fotos usan la policy espejo (`authenticated FOR ALL` / `anon FOR SELECT`); no se crean grants nuevos. |

---

## 3.15 — Verificación end-to-end (post-pull, con cleanup)

1. `#catalogo` → carga en **galería** (default): cada card con portada-o-placeholder, badge de rubro coloreado, chip de precio o "Sin precio", punto verde si `disponible_publico`. **0 errores de consola.**
2. Toggle a **tabla** → columna PRECIO + thumb desde portada; persiste tras recarga (localStorage `mepex_cat_view`).
3. Buscar / chip de rubro / select de categoría → filtran ambas vistas; contador correcto.
4. Click card/fila → **ficha full-screen**: foto grande + miniaturas (si hay), descripción, medidas, colores, ficha técnica, precio **read-only**.
5. Foto grande → **lightbox**; Esc cierra lightbox, segundo Esc cierra ficha; ←/→ y ‹/› navegan con wrap; clic rápido entre cards no pinta fotos cruzadas (token).
6. (admin) "Editar" → modal → guardar → ficha se refresca con el cambio; modal cierra (`Modal.closeAll`). (venta/pm) no ven Nuevo/Editar/Eliminar.
7. Item sin fotos / URL rota → placeholder, **0 errores**.
8. **No-regresión de costeo/cotizador:** abrir Costos → Listas y confirmar que `precio_alquiler`, `es_cotizable` y snapshots de los items tocados están **intactos** (el showroom nunca los escribe).
9. **Cleanup:** si se creó item de prueba, borrarlo (soft delete) y verificar que desaparece de ambas vistas; si se cargó alguna foto de prueba en F3, removerla.

---

**Archivos tocados en F2:** `catalogo.js` (state/lifecycle/shell/galería/ficha/lightbox/CSS reescritos; CRUD y panel lateral conservados con `Modal.closeAll` y sin `item.foto`) · `api.js` (`getCatalogoFotos`, `getCatalogoPortadas` + extensión de mapeo camelCase en `getCatalogoItems`) · `index.html` (bump `?v=`). **No toca:** `precio_alquiler`, `tipo_receta`, `es_cotizable`, snapshots, RPC `calcular_receta`, ni el cotizador externo.


---

# 4 · F3 Edicion rica + manejo de fotos

Confirmed `_rubroOptions` exists. I have all I need. Here is the corrected, complete F3 section.

---

## 4 · F3 — Edición rica + gestor de fotos

> **Pre-requisitos:** la F1 (`sql/catalogo_showroom_f1.sql`) ya corrió en prod (columnas `descripcion_larga`/`colores`/`ficha_tecnica`/`frente_cm`/`profundidad_cm`/`alto_cm` + tabla `catalogo_item_fotos` + bucket público `catalogo` + policies). La F2 (showroom galería + ficha del ítem full-screen) ya existe — esta sección **enchufa el modo edición sobre esa ficha**.
>
> **⚠️ BLOCKER de one-shot que F3 resuelve por sí misma (NO asumir que F1/F2 lo hicieron):** el `getCatalogoItems` verificado en prod (`api.js:1629-1672`) **NO mapea** los campos ricos a camelCase. Si no se agrega ese mapeo, `_buildEditDraft` lee `item.descripcionLarga` / `item.colores` / `item.fichaTecnica` / `item.frenteCm` → **todos `undefined`**, el editor abre vacío y nunca refleja lo guardado. Por eso **4.4.1 agrega TANTO el read-mapping (en `getCatalogoItems`) como el write-mapping (en `updateCatalogoItem`)**. Antes de codear, verificá si F2 ya añadió el read-mapping (grep `descripcionLarga` en `api.js`); si ya existe, no lo dupliques.

### 4.1 Decisión de UI: editor *inline en la ficha full-screen*, NO modal

**Recomendación firme: el editor vive DENTRO de la ficha full-screen de F2** (la misma `catalogo-ficha` que rinde el ítem), conmutando entre modo *vista* y modo *edición* con un botón "✏️ Editar" en el header. **No** se usa modal.

Justificación:
- **Coherencia con F2.** En F2 la ficha ya es full-screen (mismo patrón que la ficha de cliente de `crm.js` / el editor de receta `costos-panel-full` de `costos.js`). Abrir un modal encima de una vista que ya es full-screen es redundante y rompe el flujo.
- **El gestor de fotos necesita aire.** Drag-drop de múltiples archivos + previews + reordenar por drag + barra de progreso no entran cómodos en un `Modal` `lg`. La ficha full-screen da el ancho real.
- **Una sola fuente de DOM.** Editar in-place evita duplicar el render (modal-form vs ficha) y el problema de sincronizar dos vistas del mismo ítem. Al guardar/cancelar, se vuelve al modo vista re-renderizando la misma ficha.
- **El `Modal` global se reserva** para confirms puntuales (`Confirm.delete`, `Modal.confirm`) y el mini-modal de leyenda. El lightbox es overlay propio (no `Modal`).

El estado de modo se guarda en `_fichaEditMode` (boolean). El botón "Editar" solo aparece si el usuario **no** es read-only.

### 4.2 Permisos (gate duro)

```javascript
// En CatalogoModule — helper único de permiso de escritura
_canWrite() {
    const user = Auth.getUser();
    return user ? !Data.isReadOnly(user.role, 'catalogo') : false;
},
```

Reglas:
- `superadmin` / `admin` → `_canWrite() === true` (ven "Editar", el gestor de fotos, drag-drop, borrar).
- `venta` / `pm` → `Data.isReadOnly(role,'catalogo') === true` → `_canWrite() === false`. Ven la ficha en modo vista, **sin** botón Editar, sin gestor de fotos editable (las fotos se ven en galería read-only de F2).
- **Defensa en profundidad:** todo handler de escritura re-chequea `_canWrite()` antes de tocar la BD (no alcanza con ocultar el botón). El borrado de objetos de Storage está además gateado a `admin`/`superadmin` por la policy `catalogo_delete` de F1.

### 4.3 State nuevo (agregar al objeto `CatalogoModule`)

```javascript
    // ─── F3: edición rica + fotos ───
    _fichaEditMode: false,      // ficha en modo edición
    _editDraft: null,           // borrador de campos texto/medidas/colores/specs en edición
    _fotos: [],                 // fotos del ítem activo (catalogo_item_fotos), ordenadas por `orden`
    _uploadQueue: [],           // [{ tmpId, name, progress, error, file }] subidas en curso (UI optimista)
    _fotosStylesInjected: false,
```

`_editDraft` es una copia mutable para no pisar `_activePanelData` hasta confirmar. Defiende contra `null`/`undefined` en TODOS los campos ricos (no asume que el item ya los trae):

```javascript
    _buildEditDraft(item) {
        item = item || {};
        return {
            nombre:           item.nombre || '',
            codigo:           item.codigo || '',
            rubro:            item.rubro || '',
            categoria:        item.categoria || '',
            descripcion:      item.descripcion || '',
            origen:           item.origen || '',
            unidad:           item.unidad || 'Unidad',
            descripcionLarga: item.descripcionLarga || '',
            // colores: text[] que puede llegar null o no-array
            colores:          Array.isArray(item.colores) ? [...item.colores] : [],
            // ficha_tecnica: jsonb que puede llegar null, '[]', o array de {label,valor}
            fichaTecnica:     Array.isArray(item.fichaTecnica)
                                ? item.fichaTecnica.map(r => ({ label: r?.label || '', valor: r?.valor || '' }))
                                : [],
            // medidas: numeric → string para el input ('' si null/undefined)
            frenteCm:         (item.frenteCm ?? '') === null ? '' : (item.frenteCm ?? ''),
            profundidadCm:    (item.profundidadCm ?? '') === null ? '' : (item.profundidadCm ?? ''),
            altoCm:           (item.altoCm ?? '') === null ? '' : (item.altoCm ?? ''),
        };
    },
```

> **Contrato de columnas (GROUND TRUTH — INTOCABLE).** El editor toca **solo** vitrina: `nombre · codigo · rubro · categoria · descripcion · origen · unidad · descripcionLarga · colores · fichaTecnica · frenteCm · profundidadCm · altoCm` + la tabla `catalogo_item_fotos`. **PROHIBIDO** tocar `precioAlquiler`, `tipoReceta`, `esCotizable`, `manoObraMinutos`, `margenPropio`, `margenSubalquiler`, `vidaUtilArmadoOverride`, `costoFabricacion`, `costoPorUso`, `costoProduccion`, `costoManoObra`, `costoIndirectos`, `snapshot*`. Esos pertenecen a Costos / la RPC `calcular_receta` / el cotizador externo (que lee `catalogo_items` directo y filtra `es_cotizable`). El precio se muestra **read-only**. El `_saveEdit` (4.9) pasa **solo** las 13 claves de vitrina a `updateCatalogoItem` → el builder partial de `api.js` ignora todo lo demás (las claves de costo nunca se incluyen) → cero riesgo a costeo.

### 4.4 API — extensiones (agregar a `api.js`)

**4.4.1 — Mapeo de los campos ricos (READ + WRITE). ESTO ES EL FIX DEL BLOCKER.**

**(a) READ — en `getCatalogoItems`**, agregar estas claves al objeto que devuelve `.map(i => ({...}))` (verificar primero que F2 no las haya agregado ya; si ya están, no duplicar):

```javascript
// dentro de getCatalogoItems → el objeto mapeado, agregar:
                // Showroom F1/F3 — atributos ricos + medidas
                descripcionLarga: i.descripcion_larga || '',
                colores: Array.isArray(i.colores) ? i.colores : [],
                fichaTecnica: Array.isArray(i.ficha_tecnica) ? i.ficha_tecnica : [],
                frenteCm: i.frente_cm != null ? parseFloat(i.frente_cm) : null,
                profundidadCm: i.profundidad_cm != null ? parseFloat(i.profundidad_cm) : null,
                altoCm: i.alto_cm != null ? parseFloat(i.alto_cm) : null,
```

> `colores` y `ficha_tecnica` se guardan con `Array.isArray` porque una fila vieja puede traer `null` (text[] sin default) o el jsonb `null`. Nunca dejamos `undefined` ni un no-array.

**(b) WRITE — en `updateCatalogoItem`**, agregar al armado parcial del payload (agregar **solo** estas claves; NO tocar las de costo):

```javascript
// dentro de updateCatalogoItem(id, data) — agregar al builder parcial:
            if (data.descripcionLarga !== undefined) payload.descripcion_larga = data.descripcionLarga;
            if (data.colores          !== undefined) payload.colores          = Array.isArray(data.colores) ? data.colores : [];      // text[]
            if (data.fichaTecnica     !== undefined) payload.ficha_tecnica    = Array.isArray(data.fichaTecnica) ? data.fichaTecnica : []; // jsonb
            if (data.frenteCm         !== undefined) payload.frente_cm        = (data.frenteCm === '' || data.frenteCm === null) ? null : Number(data.frenteCm);
            if (data.profundidadCm    !== undefined) payload.profundidad_cm   = (data.profundidadCm === '' || data.profundidadCm === null) ? null : Number(data.profundidadCm);
            if (data.altoCm           !== undefined) payload.alto_cm          = (data.altoCm === '' || data.altoCm === null) ? null : Number(data.altoCm);
```

> El update sigue pasando por `UndoHelpers.updateRecord()` (que snapshotea solo los campos enviados — el text[]/jsonb round-trip por Supabase sin problema) + `API.clearCache()`. La edición rica entra al undo/audit como cualquier otro cambio de catálogo.

**4.4.2 — CRUD de `catalogo_item_fotos` + upload a Storage** (bloque nuevo en `api.js`):

```javascript
    // ═══════════════════════════════════════════
    //  CATÁLOGO SHOWROOM — FOTOS (F3)
    // ═══════════════════════════════════════════

    async getCatalogoFotos(itemId) {
        if (itemId == null) return [];
        const { data, error } = await supabaseClient
            .from('catalogo_item_fotos')
            .select('*')
            .eq('item_id', itemId)
            .eq('_deleted', false)
            .order('orden', { ascending: true })
            .order('id', { ascending: true });
        if (error) { console.warn('[API] getCatalogoFotos:', error.message); return []; }
        return (data || []).map(f => ({
            id: f.id,
            itemId: f.item_id,
            url: f.url,
            storagePath: f.storage_path,
            orden: f.orden ?? 0,
            esPrincipal: !!f.es_principal,
            alt: f.alt || '',
        }));
    },

    // Sube un Blob/File ya comprimido al bucket público `catalogo` y devuelve { url, storagePath }.
    async uploadCatalogoFoto(itemId, blob, ext = 'jpg', contentType = 'image/jpeg') {
        const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'jpg';
        const storagePath = `item_${itemId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
        const { error } = await supabaseClient.storage
            .from('catalogo')
            .upload(storagePath, blob, { contentType, upsert: false, cacheControl: '3600' });
        if (error) throw error;
        const { data } = supabaseClient.storage.from('catalogo').getPublicUrl(storagePath);
        return { url: data?.publicUrl || null, storagePath };
    },

    // Inserta la fila de la foto (se llama después del upload).
    async createCatalogoFoto({ itemId, url, storagePath, orden = 0, esPrincipal = false, alt = '' }) {
        const { data, error } = await supabaseClient
            .from('catalogo_item_fotos')
            .insert({
                item_id: itemId, url, storage_path: storagePath,
                orden, es_principal: esPrincipal, alt,
            })
            .select()
            .single();
        if (error) throw error;
        return {
            id: data.id, itemId: data.item_id, url: data.url, storagePath: data.storage_path,
            orden: data.orden, esPrincipal: !!data.es_principal, alt: data.alt || '',
        };
    },

    async updateCatalogoFoto(id, patch) {
        const row = {};
        if (patch.orden       !== undefined) row.orden        = patch.orden;
        if (patch.esPrincipal !== undefined) row.es_principal = patch.esPrincipal;
        if (patch.alt         !== undefined) row.alt          = patch.alt;
        if (patch.url         !== undefined) row.url          = patch.url;
        const { error } = await supabaseClient
            .from('catalogo_item_fotos').update(row).eq('id', id);
        if (error) throw error;
        return true;
    },

    // Marca portada: desmarca todas las del ítem y marca la elegida (1 sola portada).
    async setCatalogoFotoPrincipal(itemId, fotoId) {
        const { error: e1 } = await supabaseClient
            .from('catalogo_item_fotos')
            .update({ es_principal: false })
            .eq('item_id', itemId).eq('_deleted', false);
        if (e1) throw e1;
        const { error: e2 } = await supabaseClient
            .from('catalogo_item_fotos')
            .update({ es_principal: true })
            .eq('id', fotoId);
        if (e2) throw e2;
        return true;
    },

    // Persiste un orden completo (array de fotoIds en el orden deseado).
    async reorderCatalogoFotos(orderedIds) {
        const updates = orderedIds.map((fid, idx) =>
            supabaseClient.from('catalogo_item_fotos').update({ orden: idx }).eq('id', fid)
        );
        const results = await Promise.all(updates);
        const err = results.find(r => r.error);
        if (err) throw err.error;
        return true;
    },

    // Soft-delete de la fila + best-effort delete del objeto de Storage.
    async deleteCatalogoFoto(foto) {
        const { error } = await supabaseClient
            .from('catalogo_item_fotos')
            .update({ _deleted: true })
            .eq('id', foto.id);
        if (error) throw error;
        if (foto.storagePath) {
            try {
                await supabaseClient.storage.from('catalogo').remove([foto.storagePath]);
            } catch (e) { console.warn('[API] deleteCatalogoFoto storage remove:', e?.message); }
        }
        return true;
    },
```

> **Por qué soft-delete de la fila + best-effort del objeto:** el borrado de objetos de Storage está gateado a `admin`/`superadmin` (policy `catalogo_delete`). Si un `admin` borra, el objeto se va; pero aunque la `remove()` falle (RLS/permiso), la **fila** queda `_deleted=true` y la foto desaparece del showroom igual (todas las queries filtran `_deleted=false`). Nunca dejamos una foto fantasma visible.
> **Las fotos NO pasan por `UndoHelpers`** (a propósito): son operaciones directas con su propio revert optimista en UI. No ensucian el undo stack de catálogo con cada subida.

### 4.5 Compresión client-side (reusa el patrón verificado de `crm.js`/`remito-pdf.js`)

Helper local en `CatalogoModule` (canvas resize + JPEG ~0.85):

```javascript
    // Devuelve { blob, ext, contentType } comprimido, o null si no es imagen válida.
    async _compressImage(file, maxDim = 1600, quality = 0.85) {
        if (!file || !/^image\//.test(file.type || '')) return null;
        const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
        if (!dataUrl) return null;
        const img = await new Promise((resolve) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => resolve(null);
            i.src = dataUrl;
        });
        if (!img || !img.naturalWidth) return null;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
            const r = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * r); h = Math.round(h * r);
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#FFFFFF';        // fondo blanco (JPEG sin alpha)
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', quality));
        if (!blob) return null;
        return { blob, ext: 'jpg', contentType: 'image/jpeg' };
    },
```

> Límite del bucket = 10 MB (F1). Tras comprimir a ≤1600px JPEG 0.85, una foto de cámara baja a ~200–500 KB → margen de sobra. Igual validamos el blob comprimido contra 10 MB antes de subir (edge case de imágenes gigantes). El bucket acepta `heic`/`avif` para upload directo, pero el canvas siempre **re-encodea a JPEG**, así que las HEIC de iPhone llegan a Storage como JPEG estándar (legibles por el `<img>` del showroom y por jsPDF en F4).

### 4.6 Render del modo edición (dentro de la ficha full-screen de F2)

La ficha de F2 expone una zona de cuerpo (ej. `#catFichaBody`). En modo edición se renderiza el formulario rico + el gestor de fotos. El header de la ficha lleva el toggle y los botones Guardar/Cancelar.

```javascript
    // Se llama desde la ficha de F2 cuando _fichaEditMode === true.
    _renderFichaEdit() {
        const d = this._editDraft;
        if (!this._canWrite() || !d) { this._fichaEditMode = false; return this._renderFichaView(); } // defensa

        const rubroOpts = ['', ...this._rubroOptions]
            .map(r => `<option value="${escAttr(r)}" ${d.rubro === r ? 'selected' : ''}>${escHtml(r || '— sin rubro —')}</option>`).join('');
        const origenOpts = ['', 'Fabricación propia', 'Compra', 'Sub Alquiler']
            .map(o => `<option value="${escAttr(o)}" ${d.origen === o ? 'selected' : ''}>${escHtml(o || '— sin origen —')}</option>`).join('');
        const unidadOpts = ['Unidad', 'Metro', 'm²', 'Kit', 'Juego']
            .map(u => `<option value="${escAttr(u)}" ${d.unidad === u ? 'selected' : ''}>${escHtml(u)}</option>`).join('');

        return `
        <div class="cat-edit">
            <!-- Datos básicos -->
            <div class="cat-edit-block">
                <div class="cat-edit-title">Datos</div>
                <div class="cat-edit-grid">
                    <label class="cat-fg"><span>Nombre *</span>
                        <input type="text" id="catEdNombre" value="${escAttr(d.nombre)}" /></label>
                    <label class="cat-fg"><span>Código</span>
                        <input type="text" id="catEdCodigo" value="${escAttr(d.codigo)}" /></label>
                    <label class="cat-fg"><span>Rubro</span>
                        <select id="catEdRubro">${rubroOpts}</select></label>
                    <label class="cat-fg"><span>Categoría</span>
                        <input type="text" id="catEdCategoria" value="${escAttr(d.categoria)}" /></label>
                    <label class="cat-fg"><span>Origen</span>
                        <select id="catEdOrigen">${origenOpts}</select></label>
                    <label class="cat-fg"><span>Unidad</span>
                        <select id="catEdUnidad">${unidadOpts}</select></label>
                </div>
                <label class="cat-fg cat-fg-full"><span>Descripción corta</span>
                    <input type="text" id="catEdDesc" value="${escAttr(d.descripcion)}" placeholder="Una línea para listados" /></label>
            </div>

            <!-- Descripción larga (autosize) -->
            <div class="cat-edit-block">
                <div class="cat-edit-title">Descripción para showroom / propuesta</div>
                <textarea id="catEdDescLarga" class="cat-autosize" rows="3"
                    placeholder="Descripción rica del item…">${escHtml(d.descripcionLarga)}</textarea>
            </div>

            <!-- Medidas -->
            <div class="cat-edit-block">
                <div class="cat-edit-title">Medidas (cm)</div>
                <div class="cat-medidas">
                    <label class="cat-fg"><span>Frente</span>
                        <input type="number" step="0.1" min="0" id="catEdFrente" value="${escAttr(d.frenteCm)}" /></label>
                    <label class="cat-fg"><span>Profundidad</span>
                        <input type="number" step="0.1" min="0" id="catEdProf" value="${escAttr(d.profundidadCm)}" /></label>
                    <label class="cat-fg"><span>Alto</span>
                        <input type="number" step="0.1" min="0" id="catEdAlto" value="${escAttr(d.altoCm)}" /></label>
                </div>
            </div>

            <!-- Colores (chip-editor) -->
            <div class="cat-edit-block">
                <div class="cat-edit-title">Colores disponibles</div>
                <div class="cat-chips" id="catEdColores">${this._renderColorChips()}</div>
                <div class="cat-chip-add">
                    <input type="text" id="catEdColorInput" placeholder="Agregar color y Enter" maxlength="40" />
                    <button type="button" class="cat-mini-btn" id="catEdColorAdd">+ Agregar</button>
                </div>
                <div class="cat-chip-sugeridos">
                    ${['Blanco', 'Negro', 'Gris', 'Madera natural', 'Aluminio', 'Turquesa']
                        .map(c => `<button type="button" class="cat-chip-sug" data-color="${escAttr(c)}">${escHtml(c)}</button>`).join('')}
                </div>
            </div>

            <!-- Ficha técnica (filas label/valor) -->
            <div class="cat-edit-block">
                <div class="cat-edit-title">Ficha técnica</div>
                <div class="cat-specs" id="catEdSpecs">${this._renderSpecRows()}</div>
                <button type="button" class="cat-mini-btn" id="catEdSpecAdd">+ Agregar especificación</button>
            </div>

            <!-- Gestor de fotos -->
            <div class="cat-edit-block" id="catFotosBlock">
                <div class="cat-edit-title">Fotos</div>
                ${this._renderFotosManager()}
            </div>
        </div>`;
    },
```

**4.6.1 — Sub-renders (chips, specs, fotos):**

```javascript
    _renderColorChips() {
        const cols = this._editDraft?.colores || [];
        if (!cols.length) return `<span class="cat-empty-mini">Sin colores</span>`;
        return cols.map((c, i) => `
            <span class="cat-chip">
                ${escHtml(c)}
                <button type="button" class="cat-chip-x" data-color-idx="${i}" aria-label="Quitar">✕</button>
            </span>`).join('');
    },

    _renderSpecRows() {
        const rows = this._editDraft?.fichaTecnica || [];
        if (!rows.length) return `<div class="cat-empty-mini">Sin especificaciones</div>`;
        return rows.map((r, i) => `
            <div class="cat-spec-row" draggable="true" data-spec-idx="${i}">
                <span class="cat-spec-grip" title="Arrastrar">⋮⋮</span>
                <input type="text" class="cat-spec-label" data-spec-idx="${i}" value="${escAttr(r.label)}" placeholder="Etiqueta (ej: Material)" />
                <input type="text" class="cat-spec-valor" data-spec-idx="${i}" value="${escAttr(r.valor)}" placeholder="Valor (ej: Aluminio)" />
                <button type="button" class="cat-spec-x" data-spec-idx="${i}" aria-label="Quitar">✕</button>
            </div>`).join('');
    },

    _renderFotosManager() {
        const fotos = this._fotos || [];
        const queue = this._uploadQueue || [];
        const tiles = fotos.map((f, i) => `
            <div class="cat-foto-tile ${f.esPrincipal ? 'is-principal' : ''}" draggable="true" data-foto-idx="${i}" data-foto-id="${f.id}">
                <img src="${escAttr(f.url)}" alt="${escAttr(f.alt)}" loading="lazy" />
                ${f.esPrincipal ? '<span class="cat-foto-badge">Portada</span>' : ''}
                <div class="cat-foto-actions">
                    <button type="button" class="cat-foto-act" data-foto-portada="${f.id}" title="Marcar portada" ${f.esPrincipal ? 'disabled' : ''}>★</button>
                    <button type="button" class="cat-foto-act" data-foto-alt="${f.id}" title="Editar leyenda">✎</button>
                    <button type="button" class="cat-foto-act cat-foto-del" data-foto-del="${f.id}" title="Eliminar">🗑</button>
                </div>
            </div>`).join('');
        const pending = queue.map(q => `
            <div class="cat-foto-tile cat-foto-uploading" data-tmp="${q.tmpId}">
                <div class="cat-foto-prog-wrap">
                    <div class="cat-foto-prog-name">${escHtml(q.name)}</div>
                    ${q.error
                        ? `<div class="cat-foto-prog-err">Error · <button type="button" class="cat-foto-retry" data-tmp="${q.tmpId}">reintentar</button></div>`
                        : `<div class="cat-foto-prog-bar"><span style="width:${q.progress || 0}%"></span></div>`}
                </div>
            </div>`).join('');

        return `
            <div class="cat-fotos-grid" id="catFotosGrid">
                ${tiles}${pending}
            </div>
            <div class="cat-foto-drop" id="catFotoDrop">
                <input type="file" id="catFotoInput" accept="image/*" multiple hidden />
                <div class="cat-foto-drop-inner">
                    <span class="cat-foto-drop-ico">＋</span>
                    <span>Arrastrá fotos acá o <button type="button" class="cat-link" id="catFotoBrowse">elegí archivos</button></span>
                    <span class="cat-foto-drop-hint">JPG/PNG/WebP/HEIC · se comprimen automáticamente</span>
                </div>
            </div>`;
    },
```

### 4.7 Handlers — texto, medidas, colores, specs

Se attachean tras renderizar el modo edición (`_attachFichaEditEvents()`). Todos mutan `_editDraft` (no la BD); el persist es atómico en "Guardar".

```javascript
    _attachFichaEditEvents() {
        if (!this._canWrite() || !this._editDraft) return;
        const d = this._editDraft;

        // ── Campos simples → draft ──
        const bind = (id, key) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => { d[key] = el.value; });
        };
        bind('catEdNombre', 'nombre');     bind('catEdCodigo', 'codigo');
        bind('catEdCategoria', 'categoria'); bind('catEdDesc', 'descripcion');
        bind('catEdFrente', 'frenteCm');   bind('catEdProf', 'profundidadCm');
        bind('catEdAlto', 'altoCm');
        document.getElementById('catEdRubro')?.addEventListener('change', e => d.rubro = e.target.value);
        document.getElementById('catEdOrigen')?.addEventListener('change', e => d.origen = e.target.value);
        document.getElementById('catEdUnidad')?.addEventListener('change', e => d.unidad = e.target.value);

        // ── Descripción larga: autosize ──
        const ta = document.getElementById('catEdDescLarga');
        if (ta) {
            const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
            ta.addEventListener('input', () => { d.descripcionLarga = ta.value; grow(); });
            grow();
        }

        // ── Colores: agregar/quitar ──
        const addColor = (raw) => {
            const v = (raw || '').trim();
            if (!v) return;
            if (d.colores.some(c => normStr(c) === normStr(v))) { Toast.info('Ese color ya está'); return; }
            d.colores.push(v);
            this._refreshColorChips();
        };
        document.getElementById('catEdColorAdd')?.addEventListener('click', () => {
            const inp = document.getElementById('catEdColorInput');
            addColor(inp?.value); if (inp) inp.value = '';
        });
        document.getElementById('catEdColorInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addColor(e.target.value); e.target.value = ''; }
        });
        document.querySelectorAll('.cat-chip-sug').forEach(b =>
            b.addEventListener('click', () => addColor(b.dataset.color)));
        this._attachColorChipEvents();

        // ── Ficha técnica: agregar ──
        document.getElementById('catEdSpecAdd')?.addEventListener('click', () => {
            d.fichaTecnica.push({ label: '', valor: '' });
            this._refreshSpecRows();
        });
        this._attachSpecRowEvents();

        // ── Fotos ──
        this._attachFotosEvents();
    },

    _attachColorChipEvents() {
        document.querySelectorAll('#catEdColores .cat-chip-x').forEach(b =>
            b.addEventListener('click', () => {
                this._editDraft.colores.splice(parseInt(b.dataset.colorIdx, 10), 1);
                this._refreshColorChips();
            }));
    },

    _refreshColorChips() {
        const wrap = document.getElementById('catEdColores');
        if (!wrap) return;
        wrap.innerHTML = this._renderColorChips();
        this._attachColorChipEvents();
    },

    _refreshSpecRows() {
        const wrap = document.getElementById('catEdSpecs');
        if (!wrap) return;
        wrap.innerHTML = this._renderSpecRows();
        this._attachSpecRowEvents();
    },

    _attachSpecRowEvents() {
        const d = this._editDraft;
        // editar label/valor en sitio (no re-render por keystroke, para no perder foco)
        document.querySelectorAll('#catEdSpecs .cat-spec-label').forEach(inp =>
            inp.addEventListener('input', () => {
                const i = parseInt(inp.dataset.specIdx, 10);
                if (d.fichaTecnica[i]) d.fichaTecnica[i].label = inp.value;
            }));
        document.querySelectorAll('#catEdSpecs .cat-spec-valor').forEach(inp =>
            inp.addEventListener('input', () => {
                const i = parseInt(inp.dataset.specIdx, 10);
                if (d.fichaTecnica[i]) d.fichaTecnica[i].valor = inp.value;
            }));
        document.querySelectorAll('#catEdSpecs .cat-spec-x').forEach(b =>
            b.addEventListener('click', () => {
                d.fichaTecnica.splice(parseInt(b.dataset.specIdx, 10), 1);
                this._refreshSpecRows();
            }));
        // reordenar specs por drag
        let from = null;
        document.querySelectorAll('#catEdSpecs .cat-spec-row').forEach(row => {
            row.addEventListener('dragstart', () => { from = parseInt(row.dataset.specIdx, 10); row.classList.add('dragging'); });
            row.addEventListener('dragend', () => row.classList.remove('dragging'));
            row.addEventListener('dragover', e => e.preventDefault());
            row.addEventListener('drop', (e) => {
                e.preventDefault();
                const to = parseInt(row.dataset.specIdx, 10);
                if (from === null || from === to || Number.isNaN(to)) { from = null; return; }
                const moved = d.fichaTecnica.splice(from, 1)[0];
                d.fichaTecnica.splice(to, 0, moved);
                from = null;
                this._refreshSpecRows();
            });
        });
    },
```

> **Por qué specs/colores se re-renderan solo al agregar/quitar/reordenar** (no en cada `input`): re-renderizar en cada keystroke mata el foco/caret. Los `input` de label/valor mutan el draft in-place sin re-render.

### 4.8 Handlers — gestor de fotos (subir, reordenar, portada, borrar, alt)

UI **optimista**: la cola de subida (`_uploadQueue`) muestra barra de progreso al instante; al terminar upload + insert, la foto migra a `_fotos` y se reconcilia el grid. Si falla, el tile queda en estado error con "reintentar".

```javascript
    _attachFotosEvents() {
        if (!this._canWrite()) return;

        // ── File picker + drag-drop ──
        const drop = document.getElementById('catFotoDrop');
        const input = document.getElementById('catFotoInput');
        document.getElementById('catFotoBrowse')?.addEventListener('click', () => input?.click());
        input?.addEventListener('change', () => {
            if (input.files?.length) this._handleFiles([...input.files]);
            input.value = '';
        });
        if (drop) {
            ['dragenter', 'dragover'].forEach(ev =>
                drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag-over'); }));
            ['dragleave', 'drop'].forEach(ev =>
                drop.addEventListener(ev, e => {
                    e.preventDefault();
                    if (ev === 'drop' || !drop.contains(e.relatedTarget)) drop.classList.remove('drag-over');
                }));
            drop.addEventListener('drop', (e) => {
                const files = [...(e.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type || ''));
                if (files.length) this._handleFiles(files);
                else Toast.warning('Soltá imágenes (JPG/PNG/WebP/HEIC)');
            });
        }

        // ── Acciones por foto ──
        document.querySelectorAll('[data-foto-portada]').forEach(b =>
            b.addEventListener('click', () => this._setPortada(b.dataset.fotoPortada)));
        document.querySelectorAll('[data-foto-alt]').forEach(b =>
            b.addEventListener('click', () => this._editFotoAlt(b.dataset.fotoAlt)));
        document.querySelectorAll('[data-foto-del]').forEach(b =>
            b.addEventListener('click', () => this._delFoto(b.dataset.fotoDel)));
        document.querySelectorAll('.cat-foto-retry').forEach(b =>
            b.addEventListener('click', () => this._retryUpload(b.dataset.tmp)));

        // ── Lightbox al click en la imagen ──
        document.querySelectorAll('#catFotosGrid .cat-foto-tile img').forEach(img =>
            img.addEventListener('click', () => this._openLightbox(img.src)));

        // ── Reordenar fotos por drag ──
        let from = null;
        document.querySelectorAll('#catFotosGrid .cat-foto-tile[data-foto-idx]').forEach(tile => {
            tile.addEventListener('dragstart', () => { from = parseInt(tile.dataset.fotoIdx, 10); tile.classList.add('dragging'); });
            tile.addEventListener('dragend', () => tile.classList.remove('dragging'));
            tile.addEventListener('dragover', e => e.preventDefault());
            tile.addEventListener('drop', (e) => {
                e.preventDefault();
                const to = parseInt(tile.dataset.fotoIdx, 10);
                if (from === null || from === to || Number.isNaN(to)) { from = null; return; }
                this._reorderFotos(from, to);
                from = null;
            });
        });
    },

    // Procesa N archivos: comprime + sube + inserta, con barra de progreso optimista.
    async _handleFiles(files) {
        if (!this._canWrite()) return;
        const itemId = this._activePanelData?.id;
        if (itemId == null) { Toast.error('Guardá el item antes de subir fotos'); return; }

        for (const file of files) {
            const tmpId = 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
            this._uploadQueue.push({ tmpId, name: file.name, progress: 5, error: false, file });
            this._refreshFotosManager();
            await this._doUpload(tmpId);   // secuencial: el backend/UI no se satura con 20 uploads simultáneos
        }
    },

    async _doUpload(tmpId) {
        const q = this._uploadQueue.find(x => x.tmpId === tmpId);
        if (!q) return;
        const itemId = this._activePanelData?.id;
        if (itemId == null) { Toast.error('Item inválido'); return; }
        try {
            q.error = false; q.progress = 15; this._refreshFotosManager();

            const comp = await this._compressImage(q.file);
            if (!comp) throw new Error('No es una imagen válida');
            if (comp.blob.size > 10 * 1024 * 1024) throw new Error('La foto pesa más de 10 MB');
            q.progress = 55; this._refreshFotosManager();

            const { url, storagePath } = await API.uploadCatalogoFoto(itemId, comp.blob, comp.ext, comp.contentType);
            q.progress = 85; this._refreshFotosManager();

            const esPrincipal = this._fotos.length === 0; // 1ra foto del item = portada automática
            const foto = await API.createCatalogoFoto({
                itemId, url, storagePath, orden: this._fotos.length, esPrincipal, alt: '',
            });

            // reconciliación: sale de la cola, entra a _fotos
            this._uploadQueue = this._uploadQueue.filter(x => x.tmpId !== tmpId);
            this._fotos.push(foto);
            this._refreshFotosManager();
            Toast.success('Foto agregada');
        } catch (err) {
            q.error = true; q.progress = 0;
            this._refreshFotosManager();
            Toast.error('No se pudo subir: ' + (err.message || err));
        }
    },

    _retryUpload(tmpId) {
        const q = this._uploadQueue.find(x => x.tmpId === tmpId);
        if (q) this._doUpload(tmpId);
    },

    async _setPortada(fotoId) {
        if (!this._canWrite()) return;
        const id = parseInt(fotoId, 10);
        const prev = this._fotos.map(f => ({ ...f }));      // snapshot para revert
        this._fotos.forEach(f => f.esPrincipal = (f.id === id)); // optimista
        this._refreshFotosManager();
        try {
            await API.setCatalogoFotoPrincipal(this._activePanelData.id, id);
        } catch (err) {
            this._fotos = prev; this._refreshFotosManager();   // revert
            Toast.error('No se pudo marcar portada: ' + (err.message || err));
        }
    },

    async _reorderFotos(fromIdx, toIdx) {
        if (!this._canWrite()) return;
        const prev = this._fotos.map(f => ({ ...f }));
        const moved = this._fotos.splice(fromIdx, 1)[0];
        if (!moved) { this._fotos = prev; return; }
        this._fotos.splice(toIdx, 0, moved);
        this._fotos.forEach((f, i) => f.orden = i);
        this._refreshFotosManager();                          // optimista
        try {
            await API.reorderCatalogoFotos(this._fotos.map(f => f.id));
        } catch (err) {
            this._fotos = prev; this._refreshFotosManager();
            Toast.error('No se pudo reordenar: ' + (err.message || err));
        }
    },

    async _delFoto(fotoId) {
        if (!this._canWrite()) return;
        const foto = this._fotos.find(f => f.id === parseInt(fotoId, 10));
        if (!foto) return;
        const ok = await Confirm.delete('esta foto');
        if (!ok) return;
        const prev = this._fotos.map(f => ({ ...f }));
        const wasPrincipal = foto.esPrincipal;
        this._fotos = this._fotos.filter(f => f.id !== foto.id);    // optimista
        if (wasPrincipal && this._fotos.length) this._fotos[0].esPrincipal = true;
        this._refreshFotosManager();
        try {
            await API.deleteCatalogoFoto(foto);
            if (wasPrincipal && this._fotos.length) {
                await API.setCatalogoFotoPrincipal(this._activePanelData.id, this._fotos[0].id);
            }
            Toast.success('Foto eliminada');
        } catch (err) {
            this._fotos = prev; this._refreshFotosManager();
            Toast.error('No se pudo eliminar: ' + (err.message || err));
        }
    },

    _editFotoAlt(fotoId) {
        if (!this._canWrite()) return;
        const foto = this._fotos.find(f => f.id === parseInt(fotoId, 10));
        if (!foto) return;
        const inst = Modal.open({
            title: 'Leyenda de la foto',
            size: 'sm',
            body: `<label class="cat-fg cat-fg-full"><span>Texto alternativo / leyenda</span>
                     <input type="text" id="catFotoAltInput" maxlength="160" value="${escAttr(foto.alt)}" /></label>`,
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button>
                     <button class="btn btn-primary" id="catFotoAltSave">Guardar</button>`,
        });
        document.getElementById('catFotoAltSave')?.addEventListener('click', async () => {
            const val = document.getElementById('catFotoAltInput')?.value.trim() || '';
            const prevAlt = foto.alt;
            foto.alt = val; this._refreshFotosManager();
            try {
                await API.updateCatalogoFoto(foto.id, { alt: val });
                Modal.close(inst.id);
                Toast.success('Leyenda actualizada');
            } catch (err) {
                foto.alt = prevAlt; this._refreshFotosManager();
                Toast.error('No se pudo guardar: ' + (err.message || err));
            }
        });
    },

    // Re-render solo del bloque de fotos (preserva el resto del form y su foco).
    _refreshFotosManager() {
        const host = document.getElementById('catFotosBlock');
        if (!host) return;
        host.innerHTML = `<div class="cat-edit-title">Fotos</div>${this._renderFotosManager()}`;
        this._attachFotosEvents();
    },

    // Lightbox (overlay propio, NO Modal) — patrón verificado de crm.js
    _openLightbox(src) {
        if (!src) return;
        const ov = document.createElement('div');
        ov.className = 'cat-lightbox';
        ov.innerHTML = `<img src="${escAttr(src)}" alt=""><button class="cat-lightbox-x" aria-label="Cerrar">✕</button>`;
        const esc = (e) => { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); } };
        ov.addEventListener('click', () => { ov.remove(); document.removeEventListener('keydown', esc); });
        document.addEventListener('keydown', esc);
        document.body.appendChild(ov);
    },
```

> **`_refreshFotosManager` apunta a `#catFotosBlock`** (id fijo en `_renderFichaEdit`), no a `:last-child` — robusto si se reordenan los bloques del editor.

### 4.9 Toggle Editar / Guardar / Cancelar (header de la ficha)

```javascript
    // Entrar a modo edición (botón "✏️ Editar" del header de F2)
    _enterEditMode() {
        if (!this._canWrite()) { Toast.warning('No tenés permiso para editar'); return; }
        if (!this._activePanelData) return;
        this._editDraft = this._buildEditDraft(this._activePanelData);
        this._uploadQueue = [];
        this._fichaEditMode = true;
        this._rerenderFicha();   // F2: re-render → si _fichaEditMode → _renderFichaEdit + _attachFichaEditEvents
    },

    // Cancelar: descarta el draft de texto/medidas/colores/specs.
    // OJO: las fotos se persisten al instante (no son draft) → NO se revierten al cancelar.
    _cancelEditMode() {
        this._editDraft = null;
        this._uploadQueue = [];
        this._fichaEditMode = false;
        this._rerenderFicha();
    },

    async _saveEdit() {
        if (!this._canWrite() || !this._editDraft || !this._activePanelData) return;
        const d = this._editDraft;
        if (!d.nombre.trim()) { Toast.warning('El nombre es obligatorio'); return; }

        // validación de medidas (numéricas ≥ 0 o vacías)
        for (const [k, lbl] of [['frenteCm', 'Frente'], ['profundidadCm', 'Profundidad'], ['altoCm', 'Alto']]) {
            if (d[k] !== '' && d[k] !== null && (isNaN(Number(d[k])) || Number(d[k]) < 0)) {
                Toast.warning(`${lbl}: número inválido`); return;
            }
        }
        // limpiar specs vacías (label Y valor vacíos) + trim
        const specs = d.fichaTecnica
            .map(r => ({ label: (r.label || '').trim(), valor: (r.valor || '').trim() }))
            .filter(r => r.label || r.valor);
        // limpiar colores vacíos / dup defensivo
        const colores = [...new Set(d.colores.map(c => (c || '').trim()).filter(Boolean))];

        const btn = document.getElementById('catFichaSave');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
        const itemId = this._activePanelData.id;
        try {
            // SOLO claves de vitrina — jamás precio/receta/snapshot/cotizable
            const res = await API.updateCatalogoItem(itemId, {
                nombre: d.nombre.trim(), codigo: d.codigo.trim(), rubro: d.rubro,
                categoria: d.categoria.trim(), descripcion: d.descripcion.trim(),
                origen: d.origen, unidad: d.unidad,
                descripcionLarga: d.descripcionLarga.trim(),
                colores,
                fichaTecnica: specs,
                frenteCm: d.frenteCm, profundidadCm: d.profundidadCm, altoCm: d.altoCm,
            });
            if (res === null) throw new Error('La actualización falló'); // updateCatalogoItem devuelve null si hubo error

            API.clearCache();
            await this._loadData();        // refresca _items con lo nuevo (re-mapea ricos por 4.4.1a)
            this._activePanelData = this._items.find(x => x.id === itemId) || this._activePanelData;
            this._fichaEditMode = false;
            this._editDraft = null;
            this._uploadQueue = [];
            this._rerenderFicha();
            Toast.success('Item actualizado');
        } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
            Toast.error('No se pudo guardar: ' + (err.message || err));
        }
    },
```

> **`updateCatalogoItem` devuelve `null` ante error y no relanza** (verificado en `api.js:1759-1762`). Por eso `_saveEdit` chequea `res === null` y trata ese caso como fallo, en vez de asumir que un throw burbujea.

**Header de la ficha (fragmento a integrar en el `_renderFicha*` de F2):**

```javascript
${this._canWrite() ? (
    this._fichaEditMode
        ? `<button class="btn btn-ghost" id="catFichaCancel">Cancelar</button>
           <button class="btn btn-primary" id="catFichaSave">Guardar cambios</button>`
        : `<button class="cat-icon-btn" id="catFichaEdit" title="Editar item">✏️ Editar</button>`
) : ''}
```

```javascript
// en _attachFichaEvents (F2), agregar:
document.getElementById('catFichaEdit')?.addEventListener('click', () => this._enterEditMode());
document.getElementById('catFichaCancel')?.addEventListener('click', () => this._cancelEditMode());
document.getElementById('catFichaSave')?.addEventListener('click', () => this._saveEdit());
```

> **Contrato con F2 (DEPENDENCIAS que F2 debe exponer):**
> 1. `_rerenderFicha()` — re-renderiza el cuerpo de la ficha; si `_fichaEditMode` es `true` inyecta `_renderFichaEdit()` y llama `_attachFichaEditEvents()`, si es `false` inyecta `_renderFichaView()` y llama `_attachFichaEvents()`.
> 2. `_renderFichaView()` — el render de vista (read-only) de F2; el precio se muestra acá **read-only** (`item.precioAlquiler`).
> 3. **Al abrir la ficha** (handler de F2): `this._fotos = await API.getCatalogoFotos(item.id);` y resetear `_fichaEditMode=false`, `_editDraft=null`, `_uploadQueue=[]` ANTES de renderizar (no arrastrar estado de otro ítem).
> 4. **Al cerrar la ficha** (volver a la galería): mismo reset de `_fotos`/`_fichaEditMode`/`_editDraft`/`_uploadQueue`.

### 4.10 Estilos (inyectar 1 vez con guard)

```javascript
    _injectFotosStyles() {
        if (this._fotosStylesInjected) return;
        this._fotosStylesInjected = true;
        const style = document.createElement('style');
        style.id = 'cat-f3-styles';
        style.textContent = `
        /* ── Editor rico ── */
        .cat-edit { display: flex; flex-direction: column; gap: 18px; }
        .cat-edit-block { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; }
        .cat-edit-title { font-family: var(--font-mono); font-size: .62rem; letter-spacing: .18em; text-transform: uppercase; color: var(--primary); margin-bottom: 12px; }
        .cat-edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .cat-fg { display: flex; flex-direction: column; gap: 5px; }
        .cat-fg-full { grid-column: 1 / -1; margin-top: 12px; }
        .cat-fg > span { font-size: .72rem; color: var(--text-muted); }
        .cat-fg input, .cat-fg select, .cat-autosize {
            background: var(--bg-card-2); border: 1px solid var(--border); border-radius: var(--radius);
            color: var(--text-primary); font-family: var(--font-main); font-size: .85rem; padding: 8px 10px; width: 100%;
        }
        .cat-fg input:focus, .cat-fg select:focus, .cat-autosize:focus { outline: none; border-color: var(--border-active); box-shadow: var(--glow-sm); }
        .cat-autosize { resize: none; overflow: hidden; min-height: 70px; line-height: 1.5; }
        .cat-medidas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

        /* ── Chips de color ── */
        .cat-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; min-height: 26px; }
        .cat-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--bg-card-2); border: 1px solid var(--border); border-radius: 999px; padding: 4px 8px 4px 12px; font-size: .8rem; color: var(--text-primary); }
        .cat-chip-x { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: .75rem; padding: 0 2px; }
        .cat-chip-x:hover { color: var(--color-error); }
        .cat-chip-add { display: flex; gap: 8px; margin-bottom: 8px; }
        .cat-chip-add input { flex: 1; background: var(--bg-card-2); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text-primary); padding: 7px 10px; font-size: .82rem; }
        .cat-chip-sugeridos { display: flex; flex-wrap: wrap; gap: 6px; }
        .cat-chip-sug { background: transparent; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 999px; padding: 3px 10px; font-size: .72rem; cursor: pointer; }
        .cat-chip-sug:hover { border-color: var(--primary); color: var(--primary); }
        .cat-empty-mini { color: var(--text-dim); font-size: .78rem; font-style: italic; }

        /* ── Botones ── */
        .cat-mini-btn { background: transparent; border: 1px solid var(--border); color: var(--primary); border-radius: var(--radius); padding: 6px 12px; font-size: .78rem; cursor: pointer; }
        .cat-mini-btn:hover { border-color: var(--primary); box-shadow: var(--glow-sm); }
        .cat-icon-btn { background: transparent; border: 1px solid var(--border); color: var(--text-primary); border-radius: var(--radius); padding: 6px 12px; font-size: .82rem; cursor: pointer; }
        .cat-icon-btn:hover { border-color: var(--primary); color: var(--primary); }
        .cat-link { background: none; border: none; color: var(--primary); cursor: pointer; text-decoration: underline; font-size: inherit; padding: 0; }

        /* ── Ficha técnica ── */
        .cat-specs { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
        .cat-spec-row { display: grid; grid-template-columns: 22px 1fr 1.4fr 28px; gap: 8px; align-items: center; }
        .cat-spec-row.dragging { opacity: .45; }
        .cat-spec-grip { cursor: grab; color: var(--text-dim); text-align: center; user-select: none; }
        .cat-spec-row input { background: var(--bg-card-2); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text-primary); padding: 7px 9px; font-size: .82rem; }
        .cat-spec-x { background: none; border: none; color: var(--text-muted); cursor: pointer; }
        .cat-spec-x:hover { color: var(--color-error); }

        /* ── Gestor de fotos ── */
        .cat-fotos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; margin-bottom: 14px; }
        .cat-foto-tile { position: relative; aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border); background: var(--bg-card-2); cursor: grab; }
        .cat-foto-tile.dragging { opacity: .45; }
        .cat-foto-tile.is-principal { border-color: var(--primary); box-shadow: var(--glow-sm); }
        .cat-foto-tile img { width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; display: block; }
        .cat-foto-badge { position: absolute; top: 6px; left: 6px; background: var(--primary); color: #001; font-family: var(--font-mono); font-size: .58rem; letter-spacing: .08em; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; }
        .cat-foto-actions { position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: center; gap: 4px; padding: 5px; background: linear-gradient(transparent, rgba(0,0,0,.75)); opacity: 0; transition: opacity .2s var(--ease); }
        .cat-foto-tile:hover .cat-foto-actions { opacity: 1; }
        .cat-foto-act { background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2); color: #fff; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: .8rem; }
        .cat-foto-act:hover { background: rgba(255,255,255,.25); }
        .cat-foto-act:disabled { opacity: .4; cursor: default; }
        .cat-foto-act.cat-foto-del:hover { background: var(--color-error); border-color: var(--color-error); }

        /* ── Tile en subida ── */
        .cat-foto-uploading { display: flex; align-items: center; justify-content: center; cursor: default; }
        .cat-foto-prog-wrap { width: 86%; text-align: center; }
        .cat-foto-prog-name { font-size: .68rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px; }
        .cat-foto-prog-bar { height: 5px; background: var(--bg-card-3); border-radius: 3px; overflow: hidden; }
        .cat-foto-prog-bar > span { display: block; height: 100%; background: var(--primary); transition: width .25s var(--ease); }
        .cat-foto-prog-err { font-size: .68rem; color: var(--color-error); }
        .cat-foto-retry { background: none; border: none; color: var(--primary); cursor: pointer; text-decoration: underline; }

        /* ── Drop zone ── */
        .cat-foto-drop { border: 1.5px dashed var(--border); border-radius: var(--radius-md); padding: 22px; text-align: center; transition: all .2s var(--ease); cursor: pointer; }
        .cat-foto-drop.drag-over { border-color: var(--primary); background: rgba(0,169,193,.06); }
        .cat-foto-drop-inner { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--text-muted); font-size: .82rem; }
        .cat-foto-drop-ico { font-size: 1.6rem; color: var(--primary); }
        .cat-foto-drop-hint { font-size: .68rem; color: var(--text-dim); }

        /* ── Lightbox ── */
        .cat-lightbox { position: fixed; inset: 0; z-index: 99999; background: rgba(0,0,0,.88); display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
        .cat-lightbox img { max-width: 92vw; max-height: 92vh; border-radius: 8px; box-shadow: 0 0 40px rgba(0,0,0,.6); }
        .cat-lightbox-x { position: fixed; top: 18px; right: 22px; width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,.12); color: #fff; border: 1px solid rgba(255,255,255,.25); font-size: 1rem; cursor: pointer; }

        /* ── Responsive / mobile ── */
        @media (max-width: 720px) {
            .cat-edit-grid, .cat-medidas { grid-template-columns: 1fr; }
            .cat-spec-row { grid-template-columns: 18px 1fr 28px; }
            .cat-spec-valor { grid-column: 2 / 3; }
            .cat-fotos-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
            /* en mobile no hay hover → mostrar siempre las acciones de foto */
            .cat-foto-actions { opacity: 1; }
        }`;
        document.head.appendChild(style);
    },
```

Llamar `this._injectFotosStyles()` en `render()` (junto al inject de estilos de F2).

### 4.11 Edge cases cubiertos

| Caso | Manejo |
|---|---|
| **`getCatalogoItems` no mapeaba los ricos** | **4.4.1(a) agrega el read-mapping** con `Array.isArray`/`!= null`. Sin esto el editor abría vacío (el blocker principal). |
| **`ficha_tecnica` null / no-array** | `_buildEditDraft` + el mapper usan `Array.isArray(...)` → `[]`. Nunca `.map` sobre null. |
| **`colores` text[] null** | igual: `Array.isArray` → `[]`. Al guardar se normaliza a `[]` si no es array. |
| **Read-only (venta/pm)** | `_canWrite()` oculta "Editar" + el gestor; cada handler de escritura re-chequea y aborta. |
| **Error de red en cualquier op** | Toast claro; las ops optimistas (portada/reorder/delete/alt) revierten al snapshot `prev`; las subidas quedan en estado error con "reintentar". |
| **Foto pesada / no-imagen / corrupta** | `_compressImage` devuelve `null` → tile error + Toast, no rompe el loop de N archivos. |
| **Foto > 10 MB tras comprimir** | Chequeo explícito pre-upload (improbable tras 1600px/0.85). |
| **HEIC de iPhone** | El bucket la acepta, pero el canvas re-encodea a JPEG → siempre legible por `<img>` y jsPDF (F4). |
| **Item sin fotos** | grid vacío + dropzone; showroom/PDF (F2/F4) caen a placeholder. Sin portada huérfana. |
| **1ra foto del ítem** | Se marca portada automática (`esPrincipal = _fotos.length === 0`). |
| **Borrar la portada** | La 1ª restante pasa a portada (optimista + persistido vía `setCatalogoFotoPrincipal`). |
| **Borrar la última foto** | Quedan 0; sin portada huérfana. |
| **Specs vacías / con espacios** | Se trimean y filtran (label y valor vacíos) antes de persistir → jsonb limpio. |
| **Color duplicado** | `normStr` accent/case-insensitive → Toast "ya está"; al guardar, `new Set` defensivo. |
| **Medida inválida / negativa** | Validación numérica ≥0 o vacía; vacío persiste como `null`. |
| **`updateCatalogoItem` falla silencioso (devuelve null)** | `_saveEdit` chequea `res === null` y lo trata como error (no asume throw). |
| **Cancelar edición** | Descarta `_editDraft`. **Las fotos NO se revierten** (se persisten al instante — comportamiento esperado: el gestor opera directo sobre BD, no es draft). |
| **Cambiar/cerrar ítem** | F2 resetea `_fotos`/`_fichaEditMode`/`_editDraft`/`_uploadQueue` al abrir y al cerrar la ficha. |
| **Mobile sin hover** | Acciones de foto siempre visibles (`@media`). |
| **Concurrencia (otro admin edita el mismo ítem)** | `reorderCatalogoFotos` setea `orden` absoluto por índice (no incremental) → el último que guarda gana sin corromper; `setCatalogoFotoPrincipal` desmarca-todas+marca-una → siempre converge a 1 portada. `updateCatalogoItem` es last-write-wins sobre vitrina (sin tocar costo) → sin riesgo cruzado con un recálculo de Costos (campos disjuntos). |
| **Objeto Storage no borrable por RLS** | `deleteCatalogoFoto` soft-deletea la fila igual (best-effort en el objeto) → foto fuera del showroom. |

### 4.12 Integración — checklist (one-shot)

- **F1:** SQL ya corrido (verificar con la query del pie de `catalogo_showroom_f1.sql`).
- **`api.js`:** (1) **read-mapping de ricos en `getCatalogoItems`** [4.4.1a] — verificar antes que F2 no lo haya hecho ya; (2) write-mapping en `updateCatalogoItem` [4.4.1b]; (3) bloque de fotos [4.4.2]. El update sigue por `UndoHelpers.updateRecord` + `clearCache()`.
- **F2 (`catalogo.js`):** la ficha debe (a) cargar `this._fotos = await API.getCatalogoFotos(item.id)` al abrir; (b) renderizar el header con los botones de 4.9; (c) exponer `_rerenderFicha()`/`_renderFichaView()`; (d) resetear estado de F3 al abrir/cerrar; (e) llamar `_injectFotosStyles()` en `render()`.
- **`index.html`:** bump `catalogo.js?v=` y `api.js?v=` tras tocarlos.
- **NO tocar:** `precio_alquiler`, `tipo_receta`, `es_cotizable`, `snapshot_*`, costos, la RPC `calcular_receta`, ni el cotizador externo (lee `catalogo_items` directo; filtra `es_cotizable`; las fotos le son transparentes).
- **RLS:** las policies de F1 (auth full + anon read en `catalogo_item_fotos`; insert/update auth + delete admin en `storage.objects`) son el espejo de `catalogo_items` — no agregar grants.
- **Verificación end-to-end en prod (con cleanup):** como **admin** → abrir ficha → Editar → descripción larga + 1 color + 1 spec + medidas + subir 2 fotos → marcar portada la 2ª → reordenar → Guardar → confirmar en BD (`catalogo_items` con `descripcion_larga`/`colores`/`ficha_tecnica`/`frente_cm` + `catalogo_item_fotos`) y en el bucket `catalogo` → borrar las fotos de prueba + revertir los campos. Como **venta/pm** → confirmar que **no** aparece "Editar" ni gestor de fotos, y que el precio se ve read-only.


---

# 5 · F4 Export PDF (catalogo / propuesta branded)

I've reviewed the borrador against the GROUND TRUTH. Here is the corrected, hardened final section.

## 5 · F4 — Export PDF (catálogo / propuesta branded)

> **Qué hace:** desde el showroom, el usuario activa el modo selección, tilda ítems (esta mesa, estas sillas, esta pantalla), abre un modal con datos del cliente + modo, y descarga un **A4 branded MEPEX** con portada + una sección por ítem (foto de portada, descripción, ficha técnica, medidas, colores, precio según modo). El precio sale **read-only** de `catalogo_items.precio_alquiler` (lo genera Costos vía RPC `calcular_receta` — **acá NO se recalcula nada**). Reusa la maquinaria PDF verificada de `costos.js`/`finanzas.js`/`remito-pdf.js` (jsPDF + autotable + logo con caché + footer con línea naranja).

### 5.1 — Estado y dependencias

Agregar al objeto `CatalogoShowroomModule` el estado del modo selección y el caché del logo (mismo patrón que `finanzas._logoCache`, GROUND TRUTH PDF §2.B):

```javascript
// === F4: export PDF / propuesta ===
_selectMode: false,        // toggle de selección múltiple en la galería
_selected: new Set(),      // ids (bigint) de catalogo_items tildados
_logoCache: null,          // { dataUrl, w, h } — caché del logo (igual que finanzas)
```

Dependencias (todas YA cargadas globalmente — usadas en costos.js/remito-pdf.js, **no agregar `<script>`**):
- `window.jspdf.jsPDF` + `doc.autoTable` (jspdf-autotable)
- `supabaseClient.storage.from('catalogo').getPublicUrl(path)` — bucket público de la F1
- `Toast`, `Modal`, `Auth`, `Data`, `Router`, `window.escHtml`

> **Permisos.** El botón "Seleccionar ítems" y el modo selección se muestran a **todos** los roles que ya tienen acceso a `catalogo` (superadmin/admin/venta/pm — el guard de ruta ya filtró). El export es **read-only por naturaleza** (no escribe en DB), así que **no se gatea** con `Data.isReadOnly` — venta y pm DEBEN poder generar propuestas. Lo único gateado por `Data.isReadOnly(user.role, 'catalogo')` sigue siendo el CRUD de las fases F1–F3 (crear/editar/borrar/subir fotos), no el PDF.

### 5.2 — UI: toggle de selección + barra flotante

En `_buildShell()` (toolbar), agregar el botón que activa el modo selección. En la galería, cada card lleva un checkbox visible solo cuando `_selectMode` está activo (clase `cat-selecting` en el wrapper raíz).

**Botón en la toolbar** (junto a búsqueda/filtros):

```javascript
// dentro del HTML de _buildShell(), en la zona de acciones de la toolbar:
`<button class="cat-btn cat-btn-prop" id="catToggleSelect" type="button">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
    <span id="catToggleSelectLbl">Seleccionar ítems</span>
</button>`
```

**Checkbox por card** — agregar como primer hijo del template de cada tarjeta. El wrapper de la card debe tener `position: relative` (verificar en el CSS de la F2; si no lo tiene, agregarlo). Reemplazar `${item.id}` por el id real del ítem en el loop:

```javascript
// dentro del template de cada card, primer hijo:
`<label class="cat-card-check" title="Seleccionar para propuesta">
    <input type="checkbox" class="cat-card-checkbox" data-id="${item.id}"
           ${this._selected.has(item.id) ? 'checked' : ''}>
    <span class="cat-card-check-box"></span>
</label>`
```

**Barra flotante** — montarla una sola vez en `_buildShell()`, al final del wrapper raíz (**fuera** del contenedor de la galería que se re-renderiza, para que no se destruya al filtrar):

```javascript
`<div class="cat-selbar" id="catSelBar" aria-hidden="true">
    <span class="cat-selbar-count"><strong id="catSelCount">0</strong> ítem(s) seleccionados</span>
    <div class="cat-selbar-actions">
        <button class="cat-btn cat-btn-ghost" id="catSelClear" type="button">Limpiar</button>
        <button class="cat-btn cat-btn-primary" id="catSelGo" type="button">Generar propuesta</button>
    </div>
</div>`
```

> **Importante (concurrencia con re-render).** La galería se re-renderiza cada vez que cambian búsqueda/filtros. Los checkboxes se re-pintan tildados con `this._selected.has(item.id)` (el `Set` es la fuente de verdad). La barra flotante y el botón de toolbar viven **fuera** del nodo que se reemplaza, así sus listeners sobreviven; los listeners de los checkboxes se atan por **delegación** sobre el grid (5.3), no card por card, así que tampoco se pierden al re-renderizar las cards.

### 5.3 — Eventos de selección

En `_attachEvents()`. **Suposición de IDs:** el contenedor de la galería tiene `id="catGrid"` y el wrapper raíz la clase `.cat-wrapper`. Si en la F2 se usaron otros nombres, ajustar estos selectores para que coincidan (no inventar nodos):

```javascript
// Toggle modo selección
document.getElementById('catToggleSelect')?.addEventListener('click', () => {
    this._selectMode = !this._selectMode;
    const wrap = document.querySelector('.cat-wrapper');
    if (wrap) wrap.classList.toggle('cat-selecting', this._selectMode);
    const lbl = document.getElementById('catToggleSelectLbl');
    if (lbl) lbl.textContent = this._selectMode ? 'Cancelar selección' : 'Seleccionar ítems';
    if (!this._selectMode) {
        this._selected.clear();
        document.querySelectorAll('.cat-card-checkbox').forEach(cb => { cb.checked = false; });
        this._syncSelBar();
    }
});

// Checkbox por card — delegado en el grid (sobrevive re-render de cards)
document.getElementById('catGrid')?.addEventListener('change', (e) => {
    const cb = e.target.closest && e.target.closest('.cat-card-checkbox');
    if (!cb) return;
    const id = parseInt(cb.dataset.id, 10);
    if (Number.isNaN(id)) return;
    if (cb.checked) this._selected.add(id); else this._selected.delete(id);
    this._syncSelBar();
});

// Evitar que el click en el checkbox abra la ficha del item — capture corta antes
document.getElementById('catGrid')?.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.cat-card-check')) {
        e.stopPropagation();
    }
}, true);

// Barra flotante
document.getElementById('catSelClear')?.addEventListener('click', () => {
    this._selected.clear();
    document.querySelectorAll('.cat-card-checkbox').forEach(cb => { cb.checked = false; });
    this._syncSelBar();
});
document.getElementById('catSelGo')?.addEventListener('click', () => this._openPropuestaModal());
```

> **Nota — handler de abrir ficha.** El listener que abre la ficha del ítem al clickear una card debe estar atado **a la card** (o delegado de modo que el `stopPropagation` en fase de captura lo intercepte). Si el abrir-ficha estuviera delegado en `document` por fuera de `#catGrid`, el `stopPropagation` con `capture:true` sobre `#catGrid` igual lo corta porque dispara antes de que el evento llegue a `document` en fase de burbuja. Verificado contra el patrón de delegación de GROUND TRUTH.

Helper que mantiene sincronizada la barra:

```javascript
_syncSelBar() {
    const bar = document.getElementById('catSelBar');
    const cnt = document.getElementById('catSelCount');
    if (cnt) cnt.textContent = String(this._selected.size);
    if (bar) {
        bar.classList.toggle('cat-selbar-open', this._selected.size > 0);
        bar.setAttribute('aria-hidden', this._selected.size > 0 ? 'false' : 'true');
    }
}
```

### 5.4 — Modal de datos del cliente + modo

Usa los componentes globales `Modal.open` + clases `form-field`/`form-input`/`form-select`/`form-required` (GROUND TRUTH componentes §2/§7) y el patrón "attachear listeners DESPUÉS de `Modal.open()`" (CLAUDE.md §10 — `Modal.open` no soporta callback `onOpen`):

```javascript
_openPropuestaModal() {
    if (this._selected.size === 0) {
        Toast.warning('Seleccioná al menos un ítem');
        return;
    }
    const n = this._selected.size;
    Modal.open({
        title: 'Generar propuesta',
        size: 'md',
        body: `
            <div class="cat-prop-form">
                <div class="cat-prop-summary">${n} ítem(s) seleccionado(s)</div>

                <div class="form-field">
                    <label class="form-label">Cliente <span class="form-required">*</span></label>
                    <input type="text" class="form-input" id="propCliente" placeholder="Nombre del cliente / empresa">
                </div>

                <div class="form-field">
                    <label class="form-label">Subtítulo / referencia</label>
                    <input type="text" class="form-input" id="propRef" placeholder="Ej: Stand Expo Logística 2026 — Propuesta de equipamiento">
                </div>

                <div class="form-field">
                    <label class="form-label">Modo</label>
                    <select class="form-select" id="propModo">
                        <option value="cliente">Cliente (foto + descripción + ficha + medidas + colores)</option>
                        <option value="interno">Interno (+ código + rubro/unidad/origen)</option>
                    </select>
                </div>

                <label class="cat-prop-toggle">
                    <input type="checkbox" id="propPrecio" checked>
                    <span>Incluir precios</span>
                </label>
                <div class="cat-prop-hint">El precio se toma de la lista vigente (no recalcula costos).</div>
            </div>
        `,
        footer: `
            <button class="btn btn-ghost" data-modal-close>Cancelar</button>
            <button class="btn btn-primary" id="propGenerar" type="button">Generar PDF</button>
        `,
    });

    document.getElementById('propGenerar')?.addEventListener('click', async () => {
        const cliente = (document.getElementById('propCliente')?.value || '').trim();
        if (!cliente) { Toast.warning('El nombre del cliente es obligatorio'); return; }
        const opts = {
            cliente,
            referencia: (document.getElementById('propRef')?.value || '').trim(),
            modo: document.getElementById('propModo')?.value || 'cliente',
            incluirPrecio: !!document.getElementById('propPrecio')?.checked,
        };
        const btn = document.getElementById('propGenerar');
        if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
        try {
            await this._generarPropuestaPDF(opts);
            Modal.closeAll();
        } catch (err) {
            console.error('[Catalogo] PDF error:', err);
            Toast.error('Error al generar el PDF: ' + (err?.message || err));
            if (btn) { btn.disabled = false; btn.textContent = 'Generar PDF'; }
        }
    });
}
```

### 5.5 — Carga del logo (con caché)

Copia exacta del patrón `finanzas._loadLogoForPDF` (GROUND TRUTH PDF §2.B): fetch local `assets/logo_full.png` → canvas → JPEG 0.88. Mismo origen → sin CORS. Devuelve `null` si falla (la portada cae a texto "MEPEX"):

```javascript
async _loadLogoForPDF() {
    if (this._logoCache) return this._logoCache;
    try {
        const res = await fetch('assets/logo_full.png');
        const blob = await res.blob();
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = URL.createObjectURL(blob);
        });
        const maxW = 400;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        this._logoCache = { dataUrl: canvas.toDataURL('image/jpeg', 0.88), w, h };
        URL.revokeObjectURL(img.src);
        return this._logoCache;
    } catch (e) {
        console.warn('[Catalogo] No se pudo cargar logo:', e.message);
        return null;
    }
}
```

### 5.6 — Cargar la foto de portada de cada ítem (bucket público, CORS-safe + límite de peso)

El bucket `catalogo` es **público** → `getPublicUrl()` da URL permanente. jsPDF no toma `<img src>` remoto directo: hay que pasar la foto por `fetch → blob → FileReader → dataURL`. El fetch de un bucket público de Supabase responde con CORS abierto. Helper robusto (devuelve `null` ante cualquier fallo — nunca rompe el PDF) con **guarda de peso** para fotos enormes:

```javascript
// Resuelve la foto de portada de un item → dataURL JPEG/PNG + dims, o null.
// Prefiere es_principal, fallback al menor orden. Defensivo total.
async _loadItemFoto(item) {
    const MAX_BYTES = 8 * 1024 * 1024; // descartar fotos > 8MB (evita reventar memoria del jsPDF)
    try {
        // item.fotos: array que la F2 ya carga. Defensivo: si no viene, query puntual.
        let fotos = Array.isArray(item.fotos) ? item.fotos : null;
        if (!fotos) {
            const { data, error } = await supabaseClient
                .from('catalogo_item_fotos')
                .select('storage_path, url, orden, es_principal')
                .eq('item_id', item.id)
                .eq('_deleted', false)
                .order('es_principal', { ascending: false })
                .order('orden', { ascending: true })
                .limit(1);
            if (error) throw error;
            fotos = data || [];
        }
        if (!fotos.length) return null;

        const portada = fotos.find(f => f.es_principal) ||
            [...fotos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0];
        if (!portada) return null;

        // URL pública: preferir storage_path → getPublicUrl; fallback a url guardada
        let publicUrl = portada.url || null;
        if (portada.storage_path) {
            const { data } = supabaseClient.storage
                .from('catalogo')
                .getPublicUrl(portada.storage_path);
            if (data?.publicUrl) publicUrl = data.publicUrl;
        }
        if (!publicUrl) return null;

        const resp = await fetch(publicUrl);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        if (blob.size > MAX_BYTES) {
            console.warn('[Catalogo] foto item', item.id, 'demasiado pesada, se omite');
            return null;
        }

        const dataUrl = await new Promise((resolve) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result);
            r.onerror = () => resolve(null);
            r.readAsDataURL(blob);
        });
        if (!dataUrl || typeof dataUrl !== 'string') return null;

        const dims = await new Promise((resolve) => {
            const im = new Image();
            im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
            im.onerror = () => resolve(null);
            im.src = dataUrl;
        });
        if (!dims || !dims.w || !dims.h) return null;

        // Formato para addImage. WEBP no es soportado por jsPDF → recomprimir a JPEG vía canvas.
        let fmt = /image\/png/i.test(blob.type) ? 'PNG' : 'JPEG';
        let outDataUrl = dataUrl;
        if (/image\/webp/i.test(blob.type) || /image\/avif/i.test(blob.type)) {
            try {
                const im2 = await new Promise((resolve, reject) => {
                    const x = new Image();
                    x.onload = () => resolve(x);
                    x.onerror = reject;
                    x.src = dataUrl;
                });
                const cv = document.createElement('canvas');
                cv.width = dims.w; cv.height = dims.h;
                const cx = cv.getContext('2d');
                cx.fillStyle = '#FFFFFF';
                cx.fillRect(0, 0, dims.w, dims.h);
                cx.drawImage(im2, 0, 0);
                outDataUrl = cv.toDataURL('image/jpeg', 0.85);
                fmt = 'JPEG';
            } catch (_) {
                return null; // si no se pudo transcodificar, mejor sin foto que reventar addImage
            }
        }

        return { dataUrl: outDataUrl, w: dims.w, h: dims.h, fmt };
    } catch (e) {
        console.warn('[Catalogo] foto item', item.id, 'no cargó:', e.message);
        return null;
    }
}
```

> **WEBP/AVIF.** El bucket de la F1 acepta `image/webp` y `image/avif`, pero **jsPDF NO los soporta en `addImage`** (solo JPEG/PNG). Por eso el helper detecta esos tipos y los recomprime a JPEG vía canvas antes de devolverlos. Sin esto, un ítem con portada `.webp` reventaría el PDF.

### 5.7 — Generador del PDF

A4 portrait, márgenes 18mm, paginación manual por ítem. Footer con línea naranja + paginación pintado al final en todas las páginas. El precio se imprime tal cual `item.precioAlquiler` formateado es-AR — **sin recálculo**:

```javascript
async _generarPropuestaPDF({ cliente, referencia, modo, incluirPrecio }) {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
        Toast.error('jsPDF no está cargado. Refrescá la página.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    // autotable se usa para la ficha técnica → chequeo explícito (GROUND TRUTH PDF §5)
    const hasAutoTable = (typeof doc.autoTable === 'function');

    // --- constantes branding (GROUND TRUTH PDF §4) ---
    const PAGE_W = 210, PAGE_H = 297, M = 18;
    const CONTENT_W = PAGE_W - 2 * M;
    const TURQ = [0, 169, 193];
    const NARANJA = [242, 141, 21];
    const TEXTO = [40, 40, 40];
    const MUTED = [120, 120, 120];
    const isInterno = modo === 'interno';

    const fmtMoney = (v) => '$' + (Number(v) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // --- resolver items seleccionados desde el state ya cargado, en orden de galería ---
    const items = this._items.filter(i => this._selected.has(i.id));
    if (!items.length) { Toast.warning('No hay ítems para exportar'); return; }

    const logo = await this._loadLogoForPDF();

    // ====== PORTADA ======
    doc.setFillColor(...TURQ);
    doc.rect(0, 0, PAGE_W, 6, 'F');

    let y = 40;
    if (logo) {
        const logoW = 70;
        const logoH = logoW * (logo.h / logo.w);
        doc.addImage(logo.dataUrl, 'JPEG', M, y, logoW, logoH);
        y += logoH + 22;
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(26);
        doc.setTextColor(...TURQ);
        doc.text('MEPEX', M, y);
        y += 24;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(...TEXTO);
    doc.text('Propuesta de equipamiento', M, y);
    y += 14;

    if (referencia) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(13);
        doc.setTextColor(...MUTED);
        const refLines = doc.splitTextToSize(referencia, CONTENT_W);
        doc.text(refLines, M, y);
        y += refLines.length * 7 + 6;
    }

    // caja cliente
    y += 8;
    doc.setDrawColor(...TURQ);
    doc.setLineWidth(0.6);
    doc.line(M, y, M + CONTENT_W, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text('PREPARADO PARA', M, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...TEXTO);
    doc.text(doc.splitTextToSize(cliente, CONTENT_W), M, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(`Fecha: ${hoy}`, M, y);

    // ====== SECCIONES POR ÍTEM ======
    const FOTO_W = 70, FOTO_H_MAX = 52, SEC_GAP = 10;

    const newPageHeader = () => {
        doc.addPage();
        doc.setFillColor(...TURQ);
        doc.rect(0, 0, PAGE_W, 6, 'F');
        y = 24;
    };
    const ensureSpace = (need) => {
        if (y + need > PAGE_H - 24) newPageHeader();
    };

    for (const item of items) {
        const foto = await this._loadItemFoto(item);

        ensureSpace(FOTO_H_MAX + 24);

        const secTop = y;
        const textX = M + FOTO_W + 8;
        const textW = CONTENT_W - FOTO_W - 8;

        // --- foto a la izquierda ---
        if (foto) {
            const ratio = foto.w / foto.h;
            let drawW = FOTO_W, drawH = FOTO_W / ratio;
            if (drawH > FOTO_H_MAX) { drawH = FOTO_H_MAX; drawW = FOTO_H_MAX * ratio; }
            doc.setDrawColor(225, 225, 225);
            doc.setLineWidth(0.3);
            doc.rect(M, secTop, FOTO_W, FOTO_H_MAX);
            const fx = M + (FOTO_W - drawW) / 2;
            const fy = secTop + (FOTO_H_MAX - drawH) / 2;
            try { doc.addImage(foto.dataUrl, foto.fmt, fx, fy, drawW, drawH); } catch (_) {}
        } else {
            doc.setFillColor(245, 245, 245);
            doc.rect(M, secTop, FOTO_W, FOTO_H_MAX, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...MUTED);
            doc.text('Sin imagen', M + FOTO_W / 2, secTop + FOTO_H_MAX / 2, { align: 'center' });
        }

        // --- texto a la derecha ---
        let ty = secTop + 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...TEXTO);
        const nombreLines = doc.splitTextToSize(item.nombre || 'Sin nombre', textW);
        doc.text(nombreLines, textX, ty);
        ty += nombreLines.length * 6 + 1;

        if (isInterno && item.codigo) {
            doc.setFont('courier', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            doc.text(`COD ${item.codigo}`, textX, ty);
            ty += 5;
        }

        // descripción larga (fallback a descripcion corta). Limitar líneas junto a la foto.
        const desc = item.descripcionLarga || item.descripcion || '';
        if (desc) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(80, 80, 80);
            const descLines = doc.splitTextToSize(desc, textW).slice(0, 8); // tope defensivo
            doc.text(descLines, textX, ty);
            ty += descLines.length * 5 + 2;
        }

        if (incluirPrecio) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...TURQ);
            doc.text(fmtMoney(item.precioAlquiler), textX, ty + 2);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(...MUTED);
            doc.text('por alquiler', textX + 34, ty + 2);
            ty += 8;
        }

        // bajar el cursor a debajo de lo más alto (foto o texto)
        y = Math.max(secTop + FOTO_H_MAX, ty) + 4;

        // --- ficha técnica + medidas + colores ---
        const fichaRows = [];

        const med = [];
        if (item.frenteCm != null) med.push(`Frente ${item.frenteCm} cm`);
        if (item.profundidadCm != null) med.push(`Profundidad ${item.profundidadCm} cm`);
        if (item.altoCm != null) med.push(`Alto ${item.altoCm} cm`);
        if (med.length) fichaRows.push(['Medidas', med.join(' · ')]);

        if (Array.isArray(item.colores) && item.colores.length) {
            fichaRows.push(['Colores', item.colores.filter(Boolean).join(', ')]);
        }

        if (Array.isArray(item.fichaTecnica)) {
            for (const ft of item.fichaTecnica) {
                if (ft && (ft.label || ft.valor)) {
                    fichaRows.push([String(ft.label || ''), String(ft.valor || '')]);
                }
            }
        }

        if (isInterno) {
            if (item.rubro) fichaRows.push(['Rubro', item.rubro]);
            if (item.unidad) fichaRows.push(['Unidad', item.unidad]);
            if (item.origen) fichaRows.push(['Origen', item.origen]);
        }

        if (fichaRows.length) {
            if (hasAutoTable) {
                ensureSpace(fichaRows.length * 7 + 8);
                doc.autoTable({
                    startY: y,
                    body: fichaRows,
                    theme: 'plain',
                    styles: { fontSize: 8.5, cellPadding: 1.5, textColor: [60, 60, 60] },
                    columnStyles: {
                        0: { cellWidth: 40, fontStyle: 'bold', textColor: [110, 110, 110] },
                        1: { cellWidth: CONTENT_W - 40 },
                    },
                    margin: { left: M, right: M },
                });
                y = doc.lastAutoTable.finalY + 4;
            } else {
                // Fallback sin autotable: imprimir filas a mano (no debería pasar — autotable ya carga)
                doc.setFontSize(8.5);
                for (const [k, v] of fichaRows) {
                    ensureSpace(6);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(110, 110, 110);
                    doc.text(String(k), M, y);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(60, 60, 60);
                    const vLines = doc.splitTextToSize(String(v), CONTENT_W - 42);
                    doc.text(vLines, M + 42, y);
                    y += Math.max(5, vLines.length * 5);
                }
                y += 2;
            }
        }

        // separador entre ítems
        ensureSpace(SEC_GAP);
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.3);
        doc.line(M, y, M + CONTENT_W, y);
        y += SEC_GAP;
    }

    // ====== FOOTER en todas las páginas (GROUND TRUTH PDF §5 patrón) ======
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        const fy = PAGE_H - 12;
        doc.setDrawColor(...NARANJA);
        doc.setLineWidth(0.4);
        doc.line(M, PAGE_H - 16, PAGE_W - M, PAGE_H - 16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(150, 150, 150);
        doc.text('MEPEX — Montaje y Equipamiento para Exposiciones', M, fy);
        doc.text(`Página ${p} de ${total}`, PAGE_W - M, fy, { align: 'right' });
    }

    // ====== guardar ======
    const safe = (s) => (s || '').replace(/[^\wáéíóúñ\s-]/gi, '').trim().replace(/\s+/g, '-').slice(0, 60);
    const fname = `MEPEX_Propuesta_${safe(cliente) || 'cliente'}_${hoy.replace(/\//g, '-')}.pdf`;
    doc.save(fname);
    Toast.success(`Propuesta generada (${items.length} ítem(s))`);
}
```

> **Precio = read-only de la lista.** Se imprime `item.precioAlquiler` (mapeado de `catalogo_items.precio_alquiler` en `API.getCatalogoItems`, GROUND TRUTH costos §2 — ya viene mapeado, **no agregar mapeo nuevo para este campo**). **No se invoca `calcular_receta` ni `recalcularRecetaRPC`** — la propuesta refleja la lista vigente. Si un ítem tiene `precio_alquiler = 0` (sin receta corrida en Costos), modo Cliente imprime `$0`; el usuario destilda "Incluir precios" o pide a Costos que recalcule. Esto respeta el contrato de interfaz: F4 **lee** precio, nunca lo escribe (GROUND TRUTH costos §2/§7).

### 5.8 — Columnas nuevas consumidas (mapeo camelCase en `api.js`)

El generador lee campos que la F1 agregó a `catalogo_items` y la tabla `catalogo_item_fotos`. **`precioAlquiler` ya está mapeado** en `API.getCatalogoItems` (GROUND TRUTH costos §1). Las columnas nuevas de la F1 hay que **agregarlas al mapeo snake→camel existente** (`api.js:1621-1679`); esto NO es DDL (el DDL lo trae el SQL de la F1) y no rompe nada porque son lecturas aditivas:

| Campo PDF (camelCase) | Columna BD (snake_case) | Tipo | Notas |
|---|---|---|---|
| `descripcionLarga` | `descripcion_larga` | text | fallback a `descripcion` (ya mapeado) |
| `colores` | `colores` | text[] | chips → "rojo, azul" |
| `fichaTecnica` | `ficha_tecnica` | jsonb `[{label,valor}]` | filas de la tabla |
| `frenteCm` | `frente_cm` | numeric | medida |
| `profundidadCm` | `profundidad_cm` | numeric | medida |
| `altoCm` | `alto_cm` | numeric | medida |
| `precioAlquiler` | `precio_alquiler` | numeric | **read-only, YA mapeado** |
| `fotos[]` | `catalogo_item_fotos` (embed / 2ª query de F2) | rel | `storage_path/url/orden/es_principal` |

> El mapeo de estas columnas debería hacerlo la **F2** (la galería ya las necesita para la ficha). Si la F2 ya las mapeó, F4 no toca `api.js`. Si por orden de implementación F4 llega primero, agregar las líneas de mapeo aquí (aditivo, sin tocar el resto del objeto retornado por `getCatalogoItems`).

### 5.9 — CSS (prefijo `cat-`, inyectado 1 vez en `_injectStyles` con guard `_stylesInjected`)

```css
/* === F4 selección / propuesta === */
.cat-card { position: relative; } /* asegurar contexto para el checkbox absoluto */
.cat-card-check { display: none; position: absolute; top: 8px; left: 8px; z-index: 5; cursor: pointer; }
.cat-selecting .cat-card-check { display: inline-flex; }
.cat-card-checkbox { position: absolute; opacity: 0; width: 0; height: 0; }
.cat-card-check-box {
    width: 22px; height: 22px; border-radius: 6px;
    border: 2px solid var(--primary, #00A9C1);
    background: rgba(0,0,0,0.55); display: inline-block; position: relative;
    transition: background .15s var(--ease, ease);
}
.cat-card-checkbox:checked + .cat-card-check-box { background: var(--primary, #00A9C1); }
.cat-card-checkbox:checked + .cat-card-check-box::after {
    content: ''; position: absolute; left: 7px; top: 3px;
    width: 5px; height: 10px; border: solid #050505;
    border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.cat-selecting .cat-card { outline: 1px dashed rgba(0,169,193,0.25); outline-offset: -2px; }

/* barra flotante */
.cat-selbar {
    position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 160%);
    display: flex; align-items: center; gap: 18px;
    background: var(--bg-card, #111); border: 1px solid var(--border-active, rgba(0,169,193,0.25));
    border-radius: 12px; padding: 12px 18px; z-index: 200;
    box-shadow: 0 8px 30px rgba(0,0,0,0.6), var(--glow-sm, 0 0 12px rgba(0,169,193,0.2));
    transition: transform .25s var(--ease, cubic-bezier(0.25,0.46,0.45,0.94));
    pointer-events: none;
}
.cat-selbar.cat-selbar-open { transform: translate(-50%, 0); pointer-events: auto; }
.cat-selbar-count { font-family: var(--font-mono, monospace); font-size: 0.85rem; color: var(--text-primary, #E8E8E8); }
.cat-selbar-count strong { color: var(--primary, #00A9C1); }
.cat-selbar-actions { display: flex; gap: 10px; }

/* modal propuesta */
.cat-prop-summary {
    font-family: var(--font-mono, monospace); font-size: 0.75rem; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--primary, #00A9C1); margin-bottom: 14px;
}
.cat-prop-toggle { display: flex; align-items: center; gap: 8px; margin-top: 6px; cursor: pointer; color: var(--text-primary, #E8E8E8); }
.cat-prop-hint { font-size: 0.78rem; color: var(--text-muted, #888); margin-top: 4px; }
.cat-btn-prop svg { vertical-align: -2px; margin-right: 6px; }

/* mobile: barra ancho completo */
@media (max-width: 600px) {
    .cat-selbar { left: 12px; right: 12px; transform: translateY(160%); flex-direction: column; align-items: stretch; gap: 10px; }
    .cat-selbar.cat-selbar-open { transform: translateY(0); }
    .cat-selbar-actions { width: 100%; }
    .cat-selbar-actions .cat-btn { flex: 1; }
}
```

> **`pointer-events: none` cuando está cerrada** evita que la barra invisible (transformada fuera de pantalla pero aún en el viewport en `<600px`) capture clicks fantasma sobre la galería.

### 5.10 — Edge cases y manejo de errores

- **Sin selección.** `_openPropuestaModal` corta con `Toast.warning` si `_selected.size === 0`. La barra solo aparece con ≥1 (clase `cat-selbar-open`).
- **Cliente vacío.** Validación obligatoria; `Toast.warning` + no cierra modal.
- **Error de red / foto inexistente / borrada / CORS.** `_loadItemFoto` devuelve `null` → placeholder gris "Sin imagen". El PDF nunca falla por una foto.
- **Foto pesada (>8MB).** `_loadItemFoto` la descarta (guarda de `blob.size`) → "Sin imagen". Evita reventar la memoria del jsPDF con un base64 gigante.
- **Foto WEBP/AVIF.** Recomprimida a JPEG vía canvas antes de `addImage` (jsPDF no soporta esos formatos). Si la transcodificación falla → `null` → sin foto.
- **`addImage` lanza** (formato raro residual). `try/catch` silencioso por ítem → marco sin foto.
- **jsPDF no cargado.** Chequeo `window.jspdf.jsPDF` con `Toast.error` y `return`. **autotable** chequeado con `hasAutoTable`; si faltara, fallback manual de la ficha (la propuesta sale igual).
- **`colores = []` o `null`.** Se filtra con `Array.isArray && length`; valores falsy se descartan con `.filter(Boolean)`. Fila omitida si queda vacía.
- **`ficha_tecnica = null` o malformado.** `Array.isArray(item.fichaTecnica)` corta; cada entrada se castea con `String(...)` y se saltan las sin `label`/`valor`.
- **Ítem sin nombre.** Fallback `'Sin nombre'`.
- **`precio_alquiler = 0`** (sin receta). Imprime `$0`; el toggle permite ocultarlo. No recalcula.
- **Selección que sobrevive a re-render.** `_selected` es un `Set` en el state; los checkboxes se re-tildan con `this._selected.has(item.id)` y los listeners van por delegación sobre `#catGrid` → no se pierden al filtrar. Al salir del modo selección se limpia el `Set` y se destildan los checkboxes en DOM.
- **Selección de un ítem que dejó de existir** (borrado en otra pestaña entre la selección y el export). `this._items.filter(...)` solo incluye los que siguen en el state cargado → ids fantasma se ignoran silenciosamente; si quedan 0, `Toast.warning` y aborta.
- **Texto largo** (nombre/descripción/referencia/cliente). Todo via `doc.splitTextToSize(...)` con ancho disponible → wrap correcto. Descripción topeada a 8 líneas por ítem (defensivo).
- **Muchos ítems / paginación.** `ensureSpace(need)` salta de página antes de la foto, antes de la tabla de ficha y antes del separador, repintando la banda turquesa del header. El footer se pinta al final en todas las páginas con `getNumberOfPages()`.
- **Doble click en "Generar PDF".** El botón se deshabilita (`disabled` + "Generando…") mientras corre; se re-habilita solo en el `catch`.

### 5.11 — Responsive / mobile

- En `cat-selecting`, el checkbox flotante (esquina sup-izq) tiene tap-target 22px envuelto en `<label>` de área mayor → cómodo en touch.
- La barra flotante en `<600px` pasa a ancho completo (`left/right: 12px`), apilada, botones full-width, con `pointer-events:none` cuando está cerrada.
- El modal usa `Modal` global → fullscreen en mobile por `mobile.css` (GROUND TRUTH componentes).
- El PDF es A4 fijo (se descarga como archivo) → no requiere adaptación viewport.

### 5.12 — Integración con lo existente (qué NO romper)

- **No toca Costos ni el cotizador.** Solo **lee** `precio_alquiler` (read-only) y las columnas de vitrina (F1). Respeta el contrato (GROUND TRUTH costos §2/§7): no escribe `precio_alquiler`, `tipo_receta`, `es_cotizable`, snapshots; no invoca `calcular_receta`. El cotizador externo, que lee `catalogo_items` directo filtrando `es_cotizable=TRUE`, queda intacto — F4 no modifica ninguna fila.
- **No toca RLS.** Todas las queries de F4 son `SELECT` sobre `catalogo_item_fotos` (RLS espejo de la F1: anon SELECT + authenticated FOR ALL) y reads de `catalogo` Storage (bucket público). Sin INSERT/UPDATE/DELETE → ningún policy nuevo, ningún riesgo de escalada.
- **Reusa la maquinaria PDF** verificada de `costos.js`/`finanzas.js`/`remito-pdf.js`: misma instanciación jsPDF, mismo `_loadLogoForPDF` con caché (JPEG 0.88), mismo footer línea naranja + paginación, branding turquesa `[0,169,193]` + naranja `[242,141,21]`.
- **Bucket público `catalogo`** (F1) → `getPublicUrl` + `fetch` CORS-safe; el farmeo Drive→Supabase deja las fotos servibles directo, sin depender de Drive en runtime.
- **Sin DDL propio de F4.** Las columnas/tabla las trae la F1; el mapeo camelCase va en `api.js` (idealmente en la F2). **Bump `?v=` de `catalogo.js`** (y de `api.js` si se tocó el mapeo) en `index.html` al integrar — regla dura.
- **Verificación end-to-end en prod con cleanup** (no alcanza F12+visual): generar una propuesta real con 2–3 ítems (uno con foto, uno sin foto, uno con `precio_alquiler=0`), en ambos modos, con y sin precios; confirmar que el PDF abre, el branding es correcto, las fotos cargan, y que **ninguna fila de `catalogo_items` ni `catalogo_item_fotos` cambió** (F4 es read-only). No deja datos de prueba porque no escribe nada.


---

# 6 · Farmeo Drive -> Supabase (migracion puntual)

Confirmé varios puntos críticos:

1. **`download_file_content`** devuelve base64. Para Google-native pide `exportMimeType` (no aplica a JPG/PNG, son binarios reales). El shape exacto de la respuesta no está garantizado — el borrador maneja esto con `b64.content || b64.data`, razonable defensivo.
2. **`search_files`** query usa `next_page_token` (snake_case en la doc), pero el borrador usa `nextPageToken`. Esto es una **inconsistencia real** — hay que manejar ambos.
3. **El borrador alucina `mimeType = 'application/vnd.google-apps.folder'`** con operador `=` — la doc confirma que `mimeType` soporta `=`, OK. Pero `mimeType contains 'image/'` también OK.
4. **`atob` con binarios**: el borrador usa `Uint8Array.from(atob(raw), c => c.charCodeAt(0))` — correcto para el browser.
5. **`storage.upload` con Uint8Array en el browser** — el SDK acepta `Blob`/`File`/`ArrayBuffer`/`Uint8Array`. Pasar `Uint8Array` directo es frágil entre versiones; envolverlo en `Blob` es más seguro.
6. **Gap importante**: el GROUND TRUTH dice que `colores`, `ficha_tecnica`, medidas son nuevas — pero esta sección (farmeo) solo toca fotos. El borrador NO toca esas columnas, correcto. Sin embargo, **falta verificar que `catalogo_items` se filtra por `_deleted=false`** y el RLS — ya lo hace.
7. **El campo `foto` legacy en `catalogo_items`** — el GROUND TRUTH dice que apunta a la nada (no existe la columna). El borrador NO escribe `foto`, correcto (escribe en `catalogo_item_fotos`).

Ahora reescribo la sección corrigiendo: el shape de paginación, el wrap en Blob, edge cases de `download_file_content` exportMimeType, y robustez del `upsert`.

---

## 6 · Farmeo Drive → Supabase (migración puntual)

> **Qué es esto:** un proceso **one-shot** que corre **Claude** (no la app) para cargar en lote las fotos de ejemplo que Fede ya tiene en Drive al bucket público `catalogo` de Supabase, e insertar una fila por foto en `catalogo_item_fotos`. La app **nunca** depende de Drive en runtime: Drive es solo la *fuente de origen* de esta migración. Una vez farmeadas, las fotos viven en Storage y se sirven por URL pública (showroom F2, PDF F4, cotizador externo).
>
> **Prerrequisito duro (SQL-first, sin excepción):** el SQL de F1 (`sql/catalogo_showroom_f1.sql`) tiene que estar corrido. Eso crea: la tabla `catalogo_item_fotos` (PK `id` bigint identity, FK `item_id`→`catalogo_items(id)` ON DELETE CASCADE, columnas `url` NOT NULL, `storage_path`, `orden` int default 0, `es_principal` bool default false, `alt`, `created_at`, `_deleted` bool default false), el bucket **público** `catalogo` (límite 10 MB, MIMEs `image/jpeg|png|webp|heic|avif`), y las policies de `storage.objects` (read anon+auth, insert/update authenticated, **delete solo admin/superadmin**).
>
> **Este farmeo NO toca** ninguna columna de `catalogo_items` — ni las nuevas de F1 (`descripcion_larga`, `colores`, `ficha_tecnica`, `frente_cm`, `profundidad_cm`, `alto_cm`) ni, sobre todo, las de costeo (`precio_alquiler`, `tipo_receta`, `es_cotizable`, `snapshot_*`, caches). Solo INSERTa filas en `catalogo_item_fotos` y sube objetos al bucket. **Cero riesgo a costeo y cero riesgo al cotizador** (que lee `catalogo_items`, no `catalogo_item_fotos`).

### 6.0 — Supuestos (verificar ANTES de correr)

| # | Supuesto | Cómo verificar (query exacta) |
|---|----------|-------------------------------|
| S1 | F1 aplicado: tabla + bucket + policies existen. | `SELECT id,public FROM storage.buckets WHERE id='catalogo';` → 1 fila `public=true`. `SELECT to_regclass('public.catalogo_item_fotos');` → no null. |
| S2 | Los `catalogo_items` a farmear tienen `codigo` poblado y **único entre los vivos**. El match es por `codigo`. | `SELECT codigo, count(*) FROM catalogo_items WHERE _deleted=false AND codigo IS NOT NULL AND codigo<>'' GROUP BY codigo HAVING count(*)>1;` → **0 filas**. Códigos repetidos = match ambiguo → se saltean. |
| S3 | El MCP de Drive (`mcp__67a10dad-…__*`) está autenticado contra el Drive de Fede y ve la carpeta. | `list_recent_files({pageSize:5})` o `search_files({query:"parentId = '<FOLDER_ID>'", pageSize:5})` devuelve archivos. Si falla → **fallback Node** (§6.5). |
| S4 | El bucket admite el MIME (jpeg/png/webp/heic/avif) y el peso (≤10 MB). | Fijado por F1 en `allowed_mime_types` + `file_size_limit`. Fuera de eso, el `upload` lo rechaza → lo filtramos antes con log. |
| S5 | `catalogo_items.id` es **bigint**; las fotos cuelgan por `item_id` bigint. | Confirmado en GROUND TRUTH (schema-prod). |
| S6 | Esta migración se corre **una sola vez por item**. Si Fede ya curó la galería de un item a mano (orden/portada/borrados), NO re-farmear sobre ese item. | Ver límite conocido en §6.4 (el filtro de idempotencia es `_deleted=false`; una foto borrada a mano se re-subiría). |

> Si S3 falla (lo más común en una sesión cualquiera), saltá directo al **§6.5 (fallback Node + service key)** — algoritmo idéntico, cambia solo el transporte.

---

### 6.1 — Pasos manuales para Fede (una sola vez)

1. **Compartir la carpeta** (necesario para el fallback Node con descarga HTTP; con el MCP autenticado al Drive de Fede no haría falta, pero no cuesta nada y desbloquea ambos caminos): Drive → carpeta raíz de fotos → *Compartir* → "Cualquiera con el enlace" → **Lector**.
2. **Pasar el `folder_id`**: de `https://drive.google.com/drive/folders/<FOLDER_ID>` copiar `<FOLDER_ID>`. (Misma extracción que la app: regex `/\/folders\/([a-zA-Z0-9_-]+)/`.)
3. **Aplicar la convención de nombres** (§6.2) a los archivos **antes** de farmear. Es el único trabajo manual real y define todo el match.

---

### 6.2 — Convención de nombres (la regla del match)

El farmeo matchea cada foto contra `catalogo_items.codigo`. Dos layouts soportados; **elegí uno por carpeta** (no mezclar dentro de la misma carpeta).

**Layout A — código en el nombre del archivo (recomendado, plano):**

```
COD-100_frente.jpg      → item COD-100, portada (es_principal=true), orden 0
COD-100_2.jpg           → item COD-100, orden 2
COD-100_3.webp          → item COD-100, orden 3
PSB-250_frente.png      → item PSB-250, portada
PSB-250_lateral.jpg     → item PSB-250, alt="lateral", orden por aparición
```

Reglas de parseo:
- **Código** = todo lo anterior al **primer `_`** (o el nombre sin extensión si no hay `_`). `COD-100_frente.jpg` → `COD-100`; `PSB-250.jpg` → `PSB-250`.
- **Sufijo** = entre el `_` y la extensión. Decide orden/portada:
  - `frente` / `principal` / `portada` (accent/case-insensitive) → `es_principal=true`, `orden=0`, `alt=null`.
  - numérico (`_2`, `_3`) → `orden = ese número`.
  - cualquier otro (`lateral`, `detalle`) → `orden=1` por defecto, `alt = el sufijo`. (Si hay varios "otros" en el mismo item, todos caen en `orden=1`; la pasada de normalización del §6.3 NO reordena — solo arregla la portada. El orden fino se ajusta en la UI F3. Documentado como límite menor.)
- Si **ningún** archivo del item tiene sufijo de portada, la pasada de normalización marca portada a la foto de **menor `orden`** (desempate: el `id` más bajo).

**Layout B — una carpeta por código:**

```
/showroom-fotos
  /COD-100
     frente.jpg
     2.jpg
     lateral.webp
  /PSB-250
     frente.png
```

El **nombre de la subcarpeta** es el `codigo`; dentro, mismas reglas de sufijo sobre el nombre de archivo sin extensión.

> **Path en Storage (ambos layouts):** `item_<itemId>/<filenameOriginal>` — ej. `item_42/COD-100_frente.jpg`. Agrupa por item, evita colisiones, y guarda `storage_path` para poder borrar el objeto desde la UI (F3).
>
> **Ojo con nombres con caracteres raros:** Supabase Storage acepta paths con `/` como separador de "carpetas" virtuales, pero **rechaza** algunos caracteres en las keys. Para evitar fallos, el filename se **sanitiza** antes de armar el path (ver `safeFilename` abajo): se reemplaza todo lo que no sea `[A-Za-z0-9._-]` por `_`, y se colapsan repetidos. El nombre original (sin sanitizar) va a `alt` solo si no había sufijo.

---

### 6.3 — Algoritmo (idempotente, con DRY-RUN)

Fases: **listar** (MCP) → **parsear** código+sufijo → **resolver `item_id`** por código → **idempotencia** (skip si ya existe fila viva) → **DRY-RUN reporta sin escribir** / **run real** sube+inserta → **normalización** (1 portada por item).

#### 6.3.a — Path del MCP de Drive (verificado contra el schema del tool)

MCP = `mcp__67a10dad-2434-47ae-8e72-7e9db5298ead__*`. Tools:
- **`search_files({ query, pageSize, pageToken })`** — `query` faceted. Carpeta plana: `parentId = '<id>' and mimeType contains 'image/'`. Subcarpetas (Layout B): `parentId = '<id>' and mimeType = 'application/vnd.google-apps.folder'`. **Paginación:** la doc del tool nombra el campo `next_page_token`; otras integraciones devuelven `nextPageToken`. El recolector lee **ambos** (`res.next_page_token || res.nextPageToken`) y el array desde `res.files || res.data?.files || res`.
- **`download_file_content({ fileId })`** — devuelve **base64**. `exportMimeType` es **solo para archivos Google-native** (Docs/Sheets); las fotos JPG/PNG/WebP son binarios reales y **no llevan `exportMimeType`** (si se manda, lo ignora). El payload puede venir como string crudo o envuelto (`{content}` / `{data}`); el decoder cubre los tres casos.

> **Ejecución desde Claude:** este algoritmo **no es un archivo de la app**. Claude lo corre en sesión combinando las tools del MCP de Drive con `supabaseClient` del LOBBY ya logueado (vía `mcp__Claude_in_Chrome__javascript_tool` sobre la pestaña del LOBBY) **o** vía el fallback Node (§6.5). Como las tools MCP no son invocables desde adentro del `javascript_tool`, el patrón real es: **(1)** Claude llama `search_files`/`download_file_content` como tool calls y obtiene los bytes; **(2)** Claude inyecta esos bytes (como base64) en el browser y ahí corre el `upload`+`insert` con `supabaseClient`. El pseudocódigo de abajo es la lógica de referencia; el transporte se adapta a cómo esté la sesión. Si la sesión no tiene el LOBBY abierto/logueado, usar el fallback Node (no requiere browser).

#### 6.3.b — Helpers de referencia (parseo + escritura, browser-side)

```javascript
// ── Sanitiza un nombre de archivo para que sea key válida de Storage ──
function safeFilename(name) {
    const dot = name.lastIndexOf('.');
    const base = (dot === -1 ? name : name.slice(0, dot));
    const ext  = (dot === -1 ? ''   : name.slice(dot)).toLowerCase();
    const cleanBase = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // saca acentos
                          .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_')
                          .replace(/^_+|_+$/g, '') || 'foto';
    const cleanExt = ext.replace(/[^A-Za-z0-9.]+/g, '');
    return cleanBase + cleanExt;
}

// ── Parser de nombre → {codigo, orden, esPrincipal, alt} ──
// Layout A: codigo = antes del primer "_". Layout B: codigo = nombre de subcarpeta.
function parseFotoName(filename, codigoFromFolder = null) {
    const base = filename.replace(/\.[^.]+$/, '');           // sin extensión
    let codigo, sufijo;
    if (codigoFromFolder) {                                  // Layout B
        codigo = codigoFromFolder.trim();
        sufijo = base.trim();
    } else {                                                 // Layout A
        const us = base.indexOf('_');
        codigo = (us === -1 ? base : base.slice(0, us)).trim();
        sufijo = (us === -1 ? '' : base.slice(us + 1)).trim();
    }
    if (!codigo) return null;

    const s = normStr(sufijo);                               // global, accent/case-insensitive
    let orden = 1, esPrincipal = false, alt = sufijo || null;
    if (s === 'frente' || s === 'principal' || s === 'portada') {
        esPrincipal = true; orden = 0; alt = null;
    } else if (/^\d+$/.test(sufijo)) {
        orden = parseInt(sufijo, 10);
    }
    return { codigo, orden, esPrincipal, alt };
}

// ── base64 → Blob (no Uint8Array suelto: el SDK lo acepta pero Blob es lo más estable) ──
function b64ToBlob(b64, mimeType) {
    const raw = (typeof b64 === 'string') ? b64 : (b64?.content || b64?.data || b64?.body || '');
    if (!raw) throw new Error('download_file_content devolvió payload vacío');
    const clean = raw.replace(/^data:[^;]+;base64,/, '');    // por si viene con data-URL prefix
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

// ── Match código → item_id (Supabase). Detecta duplicados (S2). ──
async function resolveItemId(codigo) {
    const { data, error } = await supabaseClient
        .from('catalogo_items')
        .select('id, codigo')
        .eq('codigo', codigo)
        .eq('_deleted', false)
        .limit(2);
    if (error) throw error;
    if (!data || data.length === 0) return null;             // no-match
    if (data.length > 1) { console.warn(`[AMBIG] codigo ${codigo} → ${data.length} items, skip`); return null; }
    return data[0].id;
}

// ── Idempotencia: ¿ya existe fila viva con este item_id + storage_path? ──
async function fotoYaExiste(itemId, storagePath) {
    const { data, error } = await supabaseClient
        .from('catalogo_item_fotos')
        .select('id')
        .eq('item_id', itemId)
        .eq('storage_path', storagePath)
        .eq('_deleted', false)
        .limit(1);
    if (error) throw error;
    return !!(data && data.length);
}

// ── Subir objeto + insertar fila ──
async function uploadFoto(itemId, originalName, blob, mimeType, meta) {
    const fname = safeFilename(originalName);
    const storagePath = `item_${itemId}/${fname}`;

    // 1. Storage (bucket público 'catalogo'). upsert:true → re-correr no falla por objeto duplicado.
    const { error: upErr } = await supabaseClient.storage
        .from('catalogo')
        .upload(storagePath, blob, { contentType: mimeType, upsert: true, cacheControl: '3600' });
    if (upErr) throw upErr;

    // 2. URL pública permanente (bucket público → getPublicUrl, NO signed)
    const { data: pub } = supabaseClient.storage.from('catalogo').getPublicUrl(storagePath);
    const url = pub?.publicUrl;
    if (!url) throw new Error('getPublicUrl devolvió null');

    // 3. Fila en catalogo_item_fotos
    const { error: insErr } = await supabaseClient
        .from('catalogo_item_fotos')
        .insert({
            item_id:      itemId,
            url,
            storage_path: storagePath,
            orden:        meta.orden,
            es_principal: meta.esPrincipal,
            alt:          meta.alt,
        });
    if (insErr) throw insErr;
    return { url, storagePath };
}

// ── Garantiza exactamente 1 es_principal por item (menor orden / menor id si ninguna marcada) ──
async function asegurarUnaPortada(itemId) {
    const { data, error } = await supabaseClient
        .from('catalogo_item_fotos')
        .select('id, orden, es_principal')
        .eq('item_id', itemId).eq('_deleted', false)
        .order('orden', { ascending: true }).order('id', { ascending: true });
    if (error) throw error;
    if (!data || !data.length) return;
    const principal = data.find(r => r.es_principal) || data[0];
    for (const r of data) {
        const should = r.id === principal.id;
        if (r.es_principal !== should) {
            await supabaseClient.from('catalogo_item_fotos')
                .update({ es_principal: should }).eq('id', r.id);
        }
    }
}
```

#### 6.3.c — Orquestador (browser-side)

```javascript
// files = [{ id, name, mimeType, codigoFromFolder? }]  (de search_files del MCP)
// downloadBlob(fileId, mimeType) → Blob  (envuelve download_file_content + b64ToBlob)
async function farmCatalogPhotos(files, downloadBlob, { dryRun = true } = {}) {
    const rep = { matched: [], noMatch: [], skipped: [], errors: [], uploaded: 0, touched: new Set() };
    const OK_MIME = ['image/jpeg','image/png','image/webp','image/heic','image/avif'];

    for (const f of files) {
        try {
            if (!OK_MIME.includes(f.mimeType)) { rep.skipped.push(`${f.name} (mime ${f.mimeType})`); continue; }

            const meta = parseFotoName(f.name, f.codigoFromFolder || null);
            if (!meta) { rep.noMatch.push(`${f.name} (sin codigo)`); continue; }

            const itemId = await resolveItemId(meta.codigo);
            if (itemId == null) { rep.noMatch.push(`${f.name} (codigo ${meta.codigo} sin item)`); continue; }

            const storagePath = `item_${itemId}/${safeFilename(f.name)}`;
            if (await fotoYaExiste(itemId, storagePath)) { rep.skipped.push(`${f.name} (ya existe en item ${itemId})`); continue; }

            rep.matched.push(`${f.name} → item ${itemId} (orden ${meta.orden}${meta.esPrincipal ? ', PORTADA' : ''})`);
            rep.touched.add(itemId);
            if (dryRun) continue;

            const blob = await downloadBlob(f.id, f.mimeType);                 // descarga acá (no antes → DRY no descarga)
            if (blob.size > 10 * 1024 * 1024) { rep.skipped.push(`${f.name} (>10MB)`); continue; }

            await uploadFoto(itemId, f.name, blob, f.mimeType, meta);
            rep.uploaded++;
            console.log(`[OK] ${f.name} → item ${itemId}`);
        } catch (e) {
            rep.errors.push({ archivo: f.name, error: e.message });
            console.error(`[ERR] ${f.name}:`, e.message);                       // NO aborta el lote
        }
    }

    if (!dryRun) for (const itemId of rep.touched) {
        try { await asegurarUnaPortada(itemId); } catch (e) { console.warn(`[PORTADA] item ${itemId}:`, e.message); }
    }

    console.table({
        matched: rep.matched.length, noMatch: rep.noMatch.length,
        skipped: rep.skipped.length, errors: rep.errors.length, uploaded: rep.uploaded,
    });
    if (rep.noMatch.length) console.log('NO-MATCH:', rep.noMatch);
    if (rep.skipped.length) console.log('SKIP:', rep.skipped);
    if (rep.errors.length)  console.log('ERRORES:', rep.errors);
    return rep;
}
```

#### 6.3.d — Recolección de archivos vía MCP (paginación defensiva)

```javascript
// Helpers para leer el shape de search_files sea cual sea (next_page_token | nextPageToken; files anidado o no)
const _filesOf = r => (Array.isArray(r) ? r : (r.files || r.data?.files || []));
const _tokenOf = r => (r.next_page_token || r.nextPageToken || r.data?.nextPageToken || null);

// Layout A: carpeta plana con todas las fotos
async function listFotosLayoutA(folderId) {
    const out = []; let pageToken = null;
    do {
        const res = await /* MCP */ search_files({
            query: `parentId = '${folderId}' and mimeType contains 'image/'`,
            pageSize: 100, ...(pageToken ? { pageToken } : {}),
        });
        for (const f of _filesOf(res)) out.push({ id: f.id, name: f.name, mimeType: f.mimeType });
        pageToken = _tokenOf(res);
    } while (pageToken);
    return out;
}

// Layout B: subcarpeta por código → el nombre de la subcarpeta es el codigo
async function listFotosLayoutB(folderId) {
    const subs = _filesOf(await /* MCP */ search_files({
        query: `parentId = '${folderId}' and mimeType = 'application/vnd.google-apps.folder'`,
        pageSize: 100,
    }));
    const out = [];
    for (const sf of subs) {
        let pageToken = null;
        do {
            const res = await /* MCP */ search_files({
                query: `parentId = '${sf.id}' and mimeType contains 'image/'`,
                pageSize: 100, ...(pageToken ? { pageToken } : {}),
            });
            for (const f of _filesOf(res)) out.push({ id: f.id, name: f.name, mimeType: f.mimeType, codigoFromFolder: sf.name });
            pageToken = _tokenOf(res);
        } while (pageToken);
    }
    return out;
}

// download_file_content → base64 → Blob. SIN exportMimeType (las fotos son binarios, no Google-native).
async function downloadBlobMCP(fileId, mimeType) {
    const resp = await /* MCP */ download_file_content({ fileId });
    return b64ToBlob(resp, mimeType);
}
```

#### 6.3.e — Orden de ejecución que corre Claude

```javascript
// 1. DRY-RUN (no escribe nada) — revisar el reporte con Fede ANTES de subir
const files = await listFotosLayoutA('<FOLDER_ID>');   // o listFotosLayoutB('<FOLDER_ID>')
await farmCatalogPhotos(files, downloadBlobMCP, { dryRun: true });

// 2. Si el reporte está OK (matches esperados, no-match cero o explicables) → run real
await farmCatalogPhotos(files, downloadBlobMCP, { dryRun: false });
```

```sql
-- 3. Verificación en prod (read-only): fotos por item
SELECT ci.codigo, ci.nombre, count(f.id) AS fotos,
       count(f.id) FILTER (WHERE f.es_principal) AS portadas   -- debe ser 0 ó 1
FROM catalogo_items ci
LEFT JOIN catalogo_item_fotos f ON f.item_id = ci.id AND f._deleted = false
WHERE ci._deleted = false
GROUP BY ci.codigo, ci.nombre
ORDER BY fotos DESC;
-- 'portadas' = 2+ en algún item ⇒ re-correr asegurarUnaPortada para ese item.
```

Después de la query, abrir el showroom (F2) y confirmar que las galerías cargan las imágenes desde la URL pública.

---

### 6.4 — Edge cases y manejo de errores

| Caso | Comportamiento |
|------|----------------|
| Archivo sin código parseable | `no-match`, log, skip. No aborta el lote. |
| Código sin item en `catalogo_items` (o item `_deleted`) | `no-match`, log, skip. |
| Código duplicado entre items vivos (rompe S2) | `[AMBIG]`, skip — no adivina. |
| MIME fuera de la lista | skip con log antes de descargar (el bucket lo rechazaría igual). |
| Foto > 10 MB | skip con log **después de descargar** (recién ahí se conoce `blob.size`; el MCP no da el tamaño confiable antes). |
| Fila ya viva para `item_id`+`storage_path` | skip antes de descargar (idempotente, barato). |
| Objeto físico ya en Storage de una corrida a medias | `upload` con **`upsert:true`** → reescribe el objeto sin error; la fila se inserta igual. Idempotencia real a nivel **fila** (chequeo previo), no a nivel objeto. |
| Item con **muchas** fotos sin sufijo de portada | la normalización marca portada a la de menor `orden`/`id`. Si todas son "otro" (orden 1), gana la de `id` más bajo. Orden fino → UI F3. |
| `colores` / `ficha_tecnica` null en el item | **irrelevante para el farmeo** — no se tocan. Quien rinde la ficha (F2/F3/PDF) debe tolerar `null` (galería independiente de specs). |
| Item con **0 fotos** tras el farmeo | normal (no había archivos para ese código). El showroom F2 debe mostrar placeholder "Sin imagen", no romper. |
| `download_file_content` falla (auth caída / Google-native / red) | error capturado **por archivo**, sigue el lote; se reporta en `errors`. Si caen **todos** → S3 roto → fallback Node (§6.5). |
| `getPublicUrl` devuelve null (bucket no público / mal nombre) | `uploadFoto` tira → capturado por archivo. Síntoma de F1 mal corrido (revisar S1). |
| Red intermitente en medio del lote | reanudable: re-correr saltea todo lo ya insertado (idempotencia por fila). Sin estado a limpiar. |
| Re-correr el farmeo entero | seguro: lo cargado se saltea; solo entran fotos nuevas. |
| Foto borrada a mano en la UI (`_deleted=true`) | **se re-subiría** (la idempotencia filtra `_deleted=false`, así que la ve como "no existe"). **Límite conocido:** no re-correr el farmeo sobre items ya curados a mano (S6). |

> **Permisos / RLS:** el farmeo lo corre Claude con la sesión de Fede (superadmin) o con service key (fallback) → escribe sin problema bajo las policies espejo de F1 (`authenticated FOR ALL`). En **runtime** la app respeta el modelo del GROUND TRUTH: `Data.isReadOnly(role,'catalogo')` esconde subir/borrar a `venta`/`pm`; admin/superadmin escriben; la policy `DELETE` en `storage.objects` además bloquea el borrado de objetos a no-admin a nivel DB. El farmeo no altera ese flujo: solo precarga datos. **No toca `catalogo_items`**, así que no hay forma de que afecte costeo ni el cotizador.

---

### 6.5 — Fallback: script Node + service key (si el MCP de Drive no está autenticado)

Cuando S3 falla, se corre el **mismo algoritmo** desde Node, leyendo los archivos del filesystem (Fede baja/sincroniza la carpeta a local con la convención §6.2) y subiendo con la **service key** de Supabase (bypassa RLS; fuera del repo, en `.env` gitignored). Path sugerido: `tools/farm/farm-catalogo-fotos.mjs` (script de migración, **NO se deploya con la app**).

```javascript
// tools/farm/farm-catalogo-fotos.mjs
//   Dry-run:   DRY=1 node tools/farm/farm-catalogo-fotos.mjs ./fotos
//   Run real:        node tools/farm/farm-catalogo-fotos.mjs ./fotos
// Requiere: SUPABASE_URL + SUPABASE_SERVICE_KEY en el entorno (NUNCA commitear la key).
// Layout A: ./fotos/COD-100_frente.jpg     Layout B: ./fotos/COD-100/frente.jpg
import { createClient } from '@supabase/supabase-js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY = process.env.DRY === '1';
const ROOT = process.argv[2];
if (!URL || !KEY || !ROOT) { console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY / carpeta'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const OK_MIME = { '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.heic':'image/heic','.avif':'image/avif' };
const norm = s => (s||'').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function safeFilename(name) {
    const dot = name.lastIndexOf('.');
    const base = (dot === -1 ? name : name.slice(0, dot));
    const ext  = (dot === -1 ? ''   : name.slice(dot)).toLowerCase();
    const cb = base.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'') || 'foto';
    return cb + ext.replace(/[^A-Za-z0-9.]+/g,'');
}
function parseFotoName(filename, codigoFromFolder = null) {
    const base = filename.replace(/\.[^.]+$/, '');
    let codigo, sufijo;
    if (codigoFromFolder) { codigo = codigoFromFolder.trim(); sufijo = base.trim(); }
    else { const us = base.indexOf('_'); codigo = (us===-1?base:base.slice(0,us)).trim(); sufijo = (us===-1?'':base.slice(us+1)).trim(); }
    if (!codigo) return null;
    const s = norm(sufijo); let orden=1, esPrincipal=false, alt=sufijo||null;
    if (s==='frente'||s==='principal'||s==='portada') { esPrincipal=true; orden=0; alt=null; }
    else if (/^\d+$/.test(sufijo)) orden = parseInt(sufijo,10);
    return { codigo, orden, esPrincipal, alt };
}

// Layout A (plano) + Layout B (subcarpeta = codigo)
async function collect(root) {
    const out = [];
    for (const ent of await readdir(root, { withFileTypes: true })) {
        if (ent.isFile() && OK_MIME[extname(ent.name).toLowerCase()])
            out.push({ path: join(root, ent.name), name: ent.name, mime: OK_MIME[extname(ent.name).toLowerCase()], codigoFromFolder: null });
        else if (ent.isDirectory()) {
            for (const f of await readdir(join(root, ent.name), { withFileTypes: true }))
                if (f.isFile() && OK_MIME[extname(f.name).toLowerCase()])
                    out.push({ path: join(root, ent.name, f.name), name: f.name, mime: OK_MIME[extname(f.name).toLowerCase()], codigoFromFolder: ent.name });
        }
    }
    return out;
}
async function resolveItemId(codigo) {
    const { data, error } = await sb.from('catalogo_items').select('id,codigo').eq('codigo', codigo).eq('_deleted', false).limit(2);
    if (error) throw error;
    if (!data?.length) return null;
    if (data.length > 1) { console.warn(`[AMBIG] ${codigo} → ${data.length} items`); return null; }
    return data[0].id;
}
async function fotoYaExiste(itemId, storagePath) {
    const { data, error } = await sb.from('catalogo_item_fotos').select('id').eq('item_id', itemId).eq('storage_path', storagePath).eq('_deleted', false).limit(1);
    if (error) throw error;
    return !!data?.length;
}
async function asegurarUnaPortada(itemId) {
    const { data } = await sb.from('catalogo_item_fotos').select('id,orden,es_principal').eq('item_id', itemId).eq('_deleted', false).order('orden',{ascending:true}).order('id',{ascending:true});
    if (!data?.length) return;
    const principal = data.find(r => r.es_principal) || data[0];
    for (const r of data) { const should = r.id===principal.id; if (r.es_principal!==should) await sb.from('catalogo_item_fotos').update({es_principal:should}).eq('id', r.id); }
}

(async () => {
    const files = await collect(ROOT);
    const rep = { matched:0, noMatch:[], skipped:[], errors:[], touched:new Set() };
    for (const f of files) {
        try {
            const meta = parseFotoName(f.name, f.codigoFromFolder);
            if (!meta) { rep.noMatch.push(`${f.name} (sin codigo)`); continue; }
            const itemId = await resolveItemId(meta.codigo);
            if (itemId == null) { rep.noMatch.push(`${f.name} (codigo ${meta.codigo} sin item)`); continue; }
            const storagePath = `item_${itemId}/${safeFilename(f.name)}`;
            if (await fotoYaExiste(itemId, storagePath)) { rep.skipped.push(`${f.name} (ya existe)`); continue; }
            const sz = (await stat(f.path)).size;
            if (sz > 10*1024*1024) { rep.skipped.push(`${f.name} (>10MB)`); continue; }
            console.log(`${DRY?'[DRY]':'[OK ]'} ${f.name} → item ${itemId} (orden ${meta.orden}${meta.esPrincipal?', PORTADA':''})`);
            rep.matched++; rep.touched.add(itemId);
            if (DRY) continue;
            const bytes = await readFile(f.path);   // Buffer: el SDK Node lo acepta directo
            const up = await sb.storage.from('catalogo').upload(storagePath, bytes, { contentType: f.mime, upsert: true, cacheControl: '3600' });
            if (up.error) throw up.error;
            const { data: pub } = sb.storage.from('catalogo').getPublicUrl(storagePath);
            if (!pub?.publicUrl) throw new Error('getPublicUrl null');
            const ins = await sb.from('catalogo_item_fotos').insert({ item_id:itemId, url:pub.publicUrl, storage_path:storagePath, orden:meta.orden, es_principal:meta.esPrincipal, alt:meta.alt });
            if (ins.error) throw ins.error;
        } catch (e) { rep.errors.push(`${f.name}: ${e.message}`); console.error(`[ERR] ${f.name}:`, e.message); }
    }
    if (!DRY) for (const id of rep.touched) await asegurarUnaPortada(id);
    console.log('\n── RESUMEN ──');
    console.log('matched:', rep.matched, '| no-match:', rep.noMatch.length, '| skip:', rep.skipped.length, '| errores:', rep.errors.length);
    if (rep.noMatch.length) console.log('NO-MATCH:', rep.noMatch);
    if (rep.skipped.length) console.log('SKIP:', rep.skipped);
    if (rep.errors.length)  console.log('ERRORES:', rep.errors);
})();
```

**Pasos del fallback:**
1. Fede baja/sincroniza la carpeta de Drive a local, aplicando la convención §6.2.
2. Crear `.env` (gitignored) con `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (la **service key**, no la anon; el script corre sin sesión, fuera del browser).
3. **Dry-run:** `DRY=1 node tools/farm/farm-catalogo-fotos.mjs ./fotos` → revisar el resumen con Fede (no-match cero o explicables).
4. **Run real:** `node tools/farm/farm-catalogo-fotos.mjs ./fotos`.
5. **Verificar** con la query del §6.3.e + abrir el showroom (F2). Si algo salió mal: las filas son soft-deletables (`UPDATE catalogo_item_fotos SET _deleted=true WHERE item_id=…`) y los objetos borrables por admin desde la UI (F3) o por SQL.

> **Por qué service key y no anon:** el script corre fuera del browser, sin sesión Supabase. La service key bypassa RLS — correcto para una migración puntual administrada. En runtime la app sigue usando anon key + RLS (GROUND TRUTH); el farmeo es back-office, no parte del deploy. El `@supabase/supabase-js` ya es dependencia del proyecto (se carga por CDN en la app; para Node, `npm i @supabase/supabase-js` en `tools/farm/` o en la raíz — no afecta el deploy estático).

---

### 6.6 — Checklist de cierre del farmeo

- [ ] F1 SQL aplicado (S1 verificado con las dos queries).
- [ ] Códigos únicos entre items vivos (S2 → 0 filas).
- [ ] Convención de nombres aplicada a los archivos (§6.2), un solo layout por carpeta.
- [ ] DRY-RUN corrido y revisado con Fede (no-match cero o explicable).
- [ ] Run real corrido (vía MCP o fallback Node).
- [ ] Normalización de portada confirmada: la query del §6.3.e da `portadas ∈ {0,1}` por item.
- [ ] Verificación en prod: query fotos/item + galería del showroom (F2) cargando imágenes públicas.
- [ ] Nota en `CLAUDE.md §10`: farmeo corrido, N fotos cargadas, fecha, layout usado. **No re-correr sobre items ya curados a mano** (S6 / límite §6.4).


---

# 7 · Registro, permisos y gotchas

I have everything needed. The SQL is correct and idempotent. The draft's §7 prose is accurate but **incomplete for one-shotting** — it never warns the builder that the API layer is broken (collision) and missing (new columns + fotos CRUD). A one-shot agent following only §7 would build a module that silently writes to `evento_costo_catalogo` and can't persist any new field.

Now I'll rewrite the section, integrating the verified blocking facts while keeping the accurate registration/permissions content.

---

## 7 · Registro, permisos y gotchas

Esta sección documenta cómo el módulo Catálogo Showroom queda **registrado y gobernado** dentro del sistema (carga de scripts, ruta, permisos) y los **gotchas verificados contra el código real** que hay que respetar para poder one-shotear sin romper nada. La regla de oro de la infraestructura de registro: el módulo `catalogo` **ya existe** (ruta, script, permiso) — no se inventa nada nuevo, sólo se confirma y se bumpea. **Pero la capa de datos (`api.js`) NO está lista** y tiene un bug latente que hay que arreglar como parte de la F1 (ver §7.0, es lo primero y más importante). El SQL ya está escrito (`sql/catalogo_showroom_f1.sql`, verificado presente e idempotente) y lo corre Fede en el SQL Editor **antes** de pushear el JS (SQL-first).

---

### 7.0 — 🚨 BLOCKER VERIFICADO: colisión de nombres en `api.js` (arreglar SÍ o SÍ en F1)

**Este es el gotcha más grave y NO está en ningún brief. Sin arreglarlo, el showroom escribe en la tabla equivocada y nada de lo que se construya funciona.**

`api.js` es **un único object literal** `const API = { … }` (verificado: línea 9, un solo `const` top-level que envuelve todo el archivo). Dentro de ese objeto, los métodos `createCatalogoItem` / `updateCatalogoItem` / `deleteCatalogoItem` están **definidos dos veces**:

| Método | Definición #1 (línea) | Apunta a | Definición #2 (línea) | Apunta a |
|---|---|---|---|---|
| `createCatalogoItem` | 1681 | `catalogo_items` (con Undo) | **5715** | `evento_costo_catalogo` |
| `updateCatalogoItem` | 1705 | `catalogo_items` (con Undo) | **5721** | `evento_costo_catalogo` |
| `deleteCatalogoItem` | 1765 | `catalogo_items` (con Undo) | **5725** | `evento_costo_catalogo` |

En un object literal de JS, **la última clave gana**. Por lo tanto **las versiones #2 (rendimiento, que escriben en `evento_costo_catalogo`) son las que están vivas**, y las #1 (las que el GROUND TRUTH §catalogo describe como "el CRUD del catálogo con Undo") son **código muerto inalcanzable**.

Consecuencia directa, hoy, en prod: `catalogo.js` llama `API.createCatalogoItem(values)` / `updateCatalogoItem` / `deleteCatalogoItem` (verificado: `catalogo.js:571,639,672`) creyendo que toca `catalogo_items`, pero en realidad **toca `evento_costo_catalogo`**. Y `getCatalogoItems` (línea 1621, ese sí único) lee de `catalogo_items` → los items "creados/editados" desde el catálogo nunca aparecen. (Que esto no haya explotado antes sugiere que el alta/edición desde `catalogo.js` casi no se usa; el showroom lo va a usar intensamente, así que **hay que arreglarlo**.)

**Fix obligatorio (parte de la F1, en `api.js`):** renombrar las versiones #2 (las de rendimiento) a un nombre propio del dominio rendimiento, y actualizar sus 3 call-sites en `rendimiento.js`. Es un rename quirúrgico, all-or-nothing, sin cambio de comportamiento para rendimiento:

```javascript
// api.js — RENOMBRAR el bloque de rendimiento (líneas ~5715-5728).
// 'evento_costo_catalogo' es el "engranaje" de Rendimiento, NO el catálogo comercial.
async createRendimientoCatalogoItem(payload) {            // ← era createCatalogoItem
    const row = { ...payload, created_by: this._uid() };
    const { data, error } = await supabaseClient.from('evento_costo_catalogo').insert(row).select('id').single();
    if (error) throw error;
    return data.id;
},
async updateRendimientoCatalogoItem(id, patch) {          // ← era updateCatalogoItem
    const { error } = await supabaseClient.from('evento_costo_catalogo').update(patch).eq('id', id);
    if (error) throw error;
},
async deleteRendimientoCatalogoItem(id) {                 // ← era deleteCatalogoItem
    const { error } = await supabaseClient.from('evento_costo_catalogo').update({ _deleted: true }).eq('id', id);
    if (error) throw error;
},
```

```javascript
// rendimiento.js — actualizar los 3 call-sites (verificados: líneas 743, 789, 790):
await API.deleteRendimientoCatalogoItem(b.dataset.catdel);   // era deleteCatalogoItem
if (isEdit) await API.updateRendimientoCatalogoItem(item.id, payload);  // era updateCatalogoItem
else        await API.createRendimientoCatalogoItem(payload);           // era createCatalogoItem
```

Tras el rename, las versiones #1 (1681/1705/1765, las que escriben en `catalogo_items` con Undo) quedan **vivas y únicas** — que es lo que el showroom necesita. **Bumpear `api.js` y `rendimiento.js` en `index.html`.** Verificar en prod que Rendimiento → catálogo de engranaje sigue creando/editando/borrando OK (no debe cambiar nada), y que el alta de un item desde `#catalogo` ahora sí aparece en la tabla.

> Si por algún motivo se decide NO renombrar (no recomendado), la única alternativa es que `catalogo.js` **no use** `API.create/update/deleteCatalogoItem` y en su lugar llame helpers nuevos con nombre propio (ej. `API.createShowroomItem`) — pero entonces el código muerto de 1681 sigue ahí confundiendo. El rename es más limpio y arregla el bug real.

---

### 7.0.b — La capa de datos del showroom NO existe todavía (hay que escribirla en F1)

Tres faltantes verificados en `api.js`, todos a resolver en la F1 (después del rename de §7.0):

**1. `updateCatalogoItem` (1705) NO mapea ninguna de las columnas nuevas.** Lee/escribe `nombre/codigo/rubro/categoria/descripcion/origen/unidad/...` + todo lo de costos, pero **no** `descripcion_larga`, `colores`, `ficha_tecnica`, `frente_cm`, `profundidad_cm`, `alto_cm` (verificado: ninguna aparece en el método). Hay que agregar el mapeo aditivo:

```javascript
// api.js — DENTRO de updateCatalogoItem #1 (la de catalogo_items, ~línea 1705),
// agregar junto a los demás `if (data.x !== undefined)`. NO tocar nada de costos/precio.
if (data.descripcionLarga !== undefined) payload.descripcion_larga = data.descripcionLarga || null;
if (data.colores !== undefined) {
    // text[] de Postgres. Guardar array JS o null; nunca string suelto.
    payload.colores = Array.isArray(data.colores) && data.colores.length ? data.colores : null;
}
if (data.fichaTecnica !== undefined) {
    // jsonb: array de {label, valor}. Guardar array JS o null.
    payload.ficha_tecnica = Array.isArray(data.fichaTecnica) && data.fichaTecnica.length ? data.fichaTecnica : null;
}
if (data.frenteCm !== undefined)       payload.frente_cm       = (data.frenteCm === '' || data.frenteCm === null) ? null : parseFloat(data.frenteCm);
if (data.profundidadCm !== undefined)  payload.profundidad_cm  = (data.profundidadCm === '' || data.profundidadCm === null) ? null : parseFloat(data.profundidadCm);
if (data.altoCm !== undefined)         payload.alto_cm         = (data.altoCm === '' || data.altoCm === null) ? null : parseFloat(data.altoCm);
```

Y en `getCatalogoItems` (1621), agregar estos campos al mapeo de salida camelCase (hoy no se devuelven). Mapear `colores`/`ficha_tecnica` con default seguro para que el render nunca reciba `undefined`:

```javascript
// api.js — DENTRO de getCatalogoItems (~1621), en el .map(...) de salida, agregar:
descripcionLarga: row.descripcion_larga || '',
colores: Array.isArray(row.colores) ? row.colores : [],          // nunca null → el chip-render itera seguro
fichaTecnica: Array.isArray(row.ficha_tecnica) ? row.ficha_tecnica : [],  // idem
frenteCm: row.frente_cm ?? null,
profundidadCm: row.profundidad_cm ?? null,
altoCm: row.alto_cm ?? null,
```

> **`foto` sigue muerto y se queda muerto.** `catalogo_items` no tiene columna de foto (verificado: no aparece en el mapeo ni en el ALTER de la F1; media = greenfield total en `catalogo_item_fotos`). El render viejo de `item.foto` (`catalogo.js:282,436`) apunta a la nada. En la F2/F3 las fotos salen de `catalogo_item_fotos`, **no** de un campo `foto`. No re-agregar `foto` al mapeo.

**2. No existe NINGÚN método para `catalogo_item_fotos`.** Hay que crearlos. La RLS de la tabla es espejo de `catalogo_items` (`authenticated FOR ALL` + `anon SELECT`), así que se puede usar `supabaseClient` directo. Soft-delete + filtro `_deleted=false` obligatorio:

```javascript
// api.js — NUEVO bloque (junto a getCatalogoItems). Fotos del showroom.
async getCatalogoFotos(itemId) {
    if (!itemId) return [];
    try {
        const { data, error } = await supabaseClient.from('catalogo_item_fotos')
            .select('*')
            .eq('item_id', itemId)
            .eq('_deleted', false)
            .order('es_principal', { ascending: false })   // portada primero
            .order('orden', { ascending: true })
            .order('id', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (e) { console.warn('[API] getCatalogoFotos:', e.message); return []; }
},

async createCatalogoFoto({ itemId, url, storagePath, orden = 0, esPrincipal = false, alt = null }) {
    const row = {
        item_id: itemId, url, storage_path: storagePath || null,
        orden, es_principal: esPrincipal === true, alt: alt || null,
    };
    const { data, error } = await supabaseClient.from('catalogo_item_fotos')
        .insert(row).select('*').single();
    if (error) throw error;
    return data;
},

async updateCatalogoFoto(id, patch) {
    // patch admite: { orden, es_principal, alt }
    const { error } = await supabaseClient.from('catalogo_item_fotos').update(patch).eq('id', id);
    if (error) throw error;
},

// Marca UNA foto como portada y desmarca el resto del mismo ítem (la tabla NO lo enforce).
async setCatalogoFotoPrincipal(itemId, fotoId) {
    // 1) desmarcar todas las del ítem; 2) marcar la elegida. Dos updates simples (volumen chico).
    const { error: e1 } = await supabaseClient.from('catalogo_item_fotos')
        .update({ es_principal: false }).eq('item_id', itemId).eq('_deleted', false);
    if (e1) throw e1;
    const { error: e2 } = await supabaseClient.from('catalogo_item_fotos')
        .update({ es_principal: true }).eq('id', fotoId);
    if (e2) throw e2;
},

// Soft-delete de la fila + intento best-effort de borrar el objeto del bucket.
async deleteCatalogoFoto(id) {
    // Traer el storage_path antes del soft-delete (para limpiar el bucket).
    const { data: row } = await supabaseClient.from('catalogo_item_fotos')
        .select('storage_path').eq('id', id).maybeSingle();
    const { error } = await supabaseClient.from('catalogo_item_fotos')
        .update({ _deleted: true }).eq('id', id);
    if (error) throw error;
    // Limpieza del objeto: best-effort, NO rompas la baja si falla.
    if (row?.storage_path) {
        try { await supabaseClient.storage.from('catalogo').remove([row.storage_path]); }
        catch (e) { console.warn('[API] no se pudo borrar objeto de storage:', e.message); }
    }
    return true;
},
```

**3. No existe precedente de bucket PÚBLICO ni de `getPublicUrl` en `api.js`** (verificado: todo el storage actual — `remitos`, `comprobantes` — usa `createSignedUrl` sobre buckets privados; la línea "5860-5875 getPublicUrl" que cita el GROUND TRUTH §storage en realidad es el `createSignedUrl` de `comprobantes`). El upload al bucket público `catalogo` es **código nuevo**. Patrón verificado de upload (`api.js:4886-4901`/`4906-4931`) + `getPublicUrl` del SDK:

```javascript
// api.js — NUEVO. Sube una imagen ya comprimida (Blob) al bucket PÚBLICO 'catalogo'
// y devuelve { path, publicUrl }. El bucket + policies los crea sql/catalogo_showroom_f1.sql.
async uploadCatalogoFoto(itemId, blob, originalName = 'foto') {
    // path único por ítem + timestamp → evita colisión y permite upsert:false seguro.
    const safe = String(originalName).toLowerCase().replace(/[^a-z0-9.]+/g, '_').slice(-40);
    const path = `item_${itemId}/${Date.now()}_${safe}.jpg`;
    const { error } = await supabaseClient.storage
        .from('catalogo')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
    if (error) throw error;
    const { data } = supabaseClient.storage.from('catalogo').getPublicUrl(path);
    return { path, publicUrl: data?.publicUrl || null };
},
```

> El flujo de alta de foto en el módulo (F1 desbloquea esto): comprimir client-side con el patrón `_downscaleImage` (GROUND TRUTH §storage, `crm.js:3858`, maxDim ~1600 / quality ~0.85) → `fetch(dataUrl).then(r => r.blob())` → `API.uploadCatalogoFoto(itemId, blob, file.name)` → `API.createCatalogoFoto({ itemId, url: publicUrl, storagePath: path, ... })`. **Guard de peso antes de subir** (rechazar Blob > ~3-4 MB tras comprimir con `Toast.warning`) — el bucket tope es 10 MB (ver F1 SQL) pero conviene cortar antes.

---

### 7.1 — `index.html`: orden de carga + bump de versión

Estado actual verificado: `index.html` sirve `api.js?v=52` (línea 44) y `catalogo.js?v=5` (línea 59). El módulo se expone como objeto global `CatalogoModule` (verificado: `catalogo.js:10`, `const CatalogoModule = {`); la ruta lo invoca como `CatalogoModule.render()`.

**Obligatorio en cada fase que toque un `.js`: bumpear su `?v=`.** Sin el bump, el VPS de Fede sirve el archivo cacheado viejo aunque haga el pull (el browser cachea por query-string). Es el bug recurrente más citado del repo.

Como la F1 toca **tres** archivos (`api.js` por el rename + columnas + fotos; `rendimiento.js` por el rename de call-sites; `catalogo.js` por la subida real), **los tres se bumpean**:

```html
<!-- index.html — F1 (estado actual → nuevo) -->
<script src="api.js?v=52"></script>          →  <script src="api.js?v=53"></script>
<script src="rendimiento.js?v=4"></script>   →  <script src="rendimiento.js?v=5"></script>   <!-- confirmar el v actual antes de subir -->
<script src="catalogo.js?v=5"></script>      →  <script src="catalogo.js?v=6"></script>
```

> Antes de subir cualquier `?v=`, **leer el valor actual en `index.html`** (no asumir): el repo bumpea seguido y el número puede haber cambiado en otra sesión. Subir 1 sobre el valor que esté.

**Archivos nuevos:** este plan NO los necesita. Todo vive en `catalogo.js` (módulo) + métodos en `api.js`. El PDF (F4) reusa el patrón inline de `costos.js`/`finanzas.js` (jsPDF + autotable cargan global vía `window.jspdf`; chequear `typeof window.jspdf !== 'undefined'` y `typeof doc.autoTable === 'function'` antes de usar — GROUND TRUTH §pdf). **Recomendación: mantener el PDF como método `_generarPropuestaPDF()` dentro de `catalogo.js`** (patrón `costos.js`), para no tocar el orden de carga. Si igual se extrae a archivo nuevo (`catalogo-propuesta-pdf.js`), declararlo **antes de `app.js`** (que es el último porque hace `App.init → Router.init`), junto a los otros módulos de vista:

```html
<!-- SOLO si F4 extrae un helper a archivo nuevo (opcional, NO recomendado) -->
<script src="remito-pdf.js?v=1"></script>
<script src="catalogo-propuesta-pdf.js?v=1"></script>   <!-- nuevo helper, ANTES de app.js -->
...
<script src="catalogo.js?v=6"></script>
...
<script src="app.js?v=XX"></script>                      <!-- SIEMPRE último -->
```

---

### 7.2 — `router.js`: la ruta YA existe (NO crear)

La ruta `catalogo` **ya está registrada** (verificado, `router.js:83`). **No tocar nada acá.**

```javascript
// router.js:83 — YA EXISTE. NO TOCAR.
'catalogo':  { render: () => CatalogoModule.render(), requiresAuth: true, module: 'catalogo' },
```

Tres cosas que condicionan el código del módulo:

1. **`requiresAuth: true`** → el router exige sesión antes de `render()`. Aun así, el módulo repite el guard `const user = Auth.getUser(); if (!user) return Router.navigate('login');` al inicio de `render()` (defensa en profundidad — patrón canónico de todos los módulos).
2. **`module: 'catalogo'`** → es la **clave de permiso** que el router cruza contra `Data.rolePermissions`, y la misma que usa `Data.isReadOnly(role, 'catalogo')`. Debe coincidir literal en los tres lugares: ruta, permiso y check de read-only.
3. **NO tiene campo `obj`** (a diferencia de `crm`/`calendario`/`proyectos:id`). El router (T1, `router.js?v=12`) usa `obj` para llamar `destroy()` al módulo saliente y limpiar listeners globales en `document`. **Como `catalogo` no declara `obj`, su `destroy()` nunca se invoca automáticamente.** Implicancia: el módulo **no debe dejar handlers colgados en `document`** que sobrevivan a la navegación y se dupliquen al re-entrar. Todo handler global (ESC para lightbox/panel, listener delegado en `document`) debe ser **idempotente** (remove-before-add con la ref guardada en estado, o guard de instancia "bind once"):

```javascript
// Patrón remove-before-add para handlers globales. Necesario porque la ruta 'catalogo'
// no tiene obj→destroy() en el router. Llamar desde _attachEvents().
_bindGlobalHandlers() {
    // ESC: remove-before-add (re-entrar al módulo no acumula handlers).
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    this._escHandler = (e) => {
        if (e.key !== 'Escape') return;
        if (this._lightboxOpen) { this._closeLightbox(); return; }
        if (this._activePanel)  { this._closePanel(); }
    };
    document.addEventListener('keydown', this._escHandler);

    // Lightbox: bind UNA sola vez con guard de instancia (patrón crm.js:177-182).
    if (!this._lightboxBound) {
        this._lightboxBound = true;
        document.addEventListener('click', (e) => {
            const a = e.target.closest && e.target.closest('.cat-foto-thumb');
            if (a && a.dataset.src) { e.preventDefault(); this._openLightbox(a.dataset.src); }
        });
    }
}
```

> Alternativa formal (opcional, NO obligatoria): agregar `obj: typeof CatalogoModule !== 'undefined' ? CatalogoModule : null` a la ruta + un método `destroy()` que remueva `this._escHandler`. Es un cambio de 1 línea en `router.js` + el `destroy()`. Para este plan basta con remove-before-add.

---

### 7.3 — `data.js`: el permiso YA existe (NO hace falta grant nuevo)

El permiso `catalogo` **ya está concedido** (verificado, `data.js:22-25` y `35-36`). **No se agrega ningún grant, no se toca `data.js` por permisos.** Estado real verificado:

```javascript
// data.js — YA EXISTE. NO TOCAR (para permisos).
rolePermissions: {
    superadmin: ['crm', 'cotizador', 'catalogo', ...],          // catalogo ✓
    admin:      ['crm', 'cotizador', 'catalogo', ...],          // catalogo ✓
    venta:      ['crm', 'cotizador', 'catalogo', 'proyectos', 'eventos'],  // catalogo ✓
    pm:         ['crm', 'catalogo', 'proyectos', 'eventos', 'taller', 'logistica', 'inventario', 'flota'],  // catalogo ✓
    // taller: NO tiene catalogo → no ve el módulo (correcto, es vitrina comercial)
},
readOnlyModules: {
    // superadmin/admin: NO aparecen → escriben ✓
    venta:  ['catalogo'],                              // catalogo read-only ✓
    pm:     ['crm', 'catalogo', 'inventario', 'flota'],  // catalogo read-only ✓
    // taller: ...
},
```

**Matriz de permisos definitiva (derivada del estado real):**

| Rol | ¿Ve `#catalogo`? | ¿Escribe (crear/editar/borrar item + subir/ordenar fotos)? | Por qué |
|---|---|---|---|
| `superadmin` | Sí | **Sí** | en `rolePermissions`, **no** en `readOnlyModules` |
| `admin` | Sí | **Sí** | en `rolePermissions`, **no** en `readOnlyModules` |
| `venta` | Sí | **No** (read-only) | en ambos → `Data.isReadOnly('venta','catalogo') === true` |
| `pm` | Sí | **No** (read-only) | en ambos → `Data.isReadOnly('pm','catalogo') === true` |
| `taller` | **No** | — | no está en `rolePermissions` → router bloquea acceso |

**Aplicación en el módulo** (patrón canónico, idéntico a `inventario.js`/`crm.js`):

```javascript
async render() {
    const user = Auth.getUser();
    if (!user) return Router.navigate('login');

    // Fuente única del flag de escritura para TODO el módulo (botones de alta/edición/borrado/subida/orden de fotos).
    this._isRO = Data.isReadOnly(user.role, 'catalogo');

    this._injectStyles();
    const content = document.getElementById('mainContent');
    if (!content) return;
    content.innerHTML = this._buildShell();
    await this._loadData();
    this._attachEvents();
}
```

Gatear cada punto de mutación por `this._isRO`:

```javascript
${!this._isRO ? `<button class="btn btn-primary" id="catBtnNew">+ Nuevo item</button>` : ''}
${!this._isRO ? `<button class="cat-panel-btn" id="catBtnEditInfo">✏️ Editar</button>` : ''}
${!this._isRO ? `<button class="cat-panel-btn cat-btn-upload" id="catBtnUploadFoto">📷 Subir fotos</button>` : ''}
${!this._isRO ? `<button class="cat-panel-btn cat-btn-danger" id="catBtnDelete">Eliminar item</button>` : ''}
${this._isRO  ? '<span class="badge badge-ghost">Solo lectura</span>' : ''}
```

> **No basta con esconder el botón.** El enforcement real es RLS. Las policies de `catalogo_item_fotos` y de las columnas nuevas de `catalogo_items` son **espejo exacto** de `catalogo_items` (`authenticated FOR ALL USING(true) WITH CHECK(true)` + `anon FOR SELECT USING(true)` — ya en `sql/catalogo_showroom_f1.sql`). Esto significa que **a nivel RLS cualquier `authenticated` puede escribir**: el read-only de venta/pm es **sólo UI**, no DB. Es coherente con cómo funciona hoy `catalogo.js` y con la decisión del brief ("espejo EXACTO de catalogo_items"). No se endurece RLS por rol en este plan; hacerlo sería una fase aparte (tipo Fase 9.bis), fuera de alcance.

---

### 7.4 — GOTCHA de permisos: `getAccessLevel` sin bypass de superadmin + `_rolePermissions`

Gotcha transversal del repo (documentado en el skill `lobby-module-builder`). **Acá no es un problema, pero hay que entenderlo para no romperlo:**

- **No existe bypass mágico de superadmin** en la capa de permisos de módulo. `Auth.getAccessLevel(moduleId)` / `Data.isReadOnly(role, moduleId)` **leen la matriz literal** de `Data.rolePermissions` + `Data.readOnlyModules`. El "superadmin ve todo" funciona porque superadmin **está explícitamente listado** en cada array, no por un `if (role === 'superadmin') return true`.
- **`Auth.getUser()` devuelve `_rolePermissions`** (snapshot de permisos efectivos: rol + `customPermissions` del `profiles`). Por eso el read-only puede ser personalizado por usuario sin tocar `data.js`.

**Por qué NO aplica acá:** el showroom **reusa una clave de permiso que ya existe y ya está poblada** para los 4 roles que la necesitan. No es un módulo nuevo (esos sí requieren agregar la clave a `rolePermissions` por rol — como pasó con `rendimiento` y `calendario-adm`, que necesitaron grant explícito, incluso SQL en `roles.permissions` JSONB). Concretamente para `catalogo`:

- **NO** agregar `'catalogo'` a ningún array de `data.js` (ya está en los 4).
- **NO** correr SQL de grant. `catalogo` usa la matriz de `data.js`, **no** la tabla `roles.permissions` de Supabase.
- La única dependencia DB de permisos es la **RLS de las tablas/columnas nuevas**, ya cubierta por el espejo en `sql/catalogo_showroom_f1.sql`.

---

### 7.5 — Anti-patrones a evitar (lista dura)

Verificados contra CLAUDE.md, el GROUND TRUTH y los contratos de interfaz. **Cualquiera rompe el sistema o el contrato con Costos/Cotizador:**

1. **NO reimplementar el precio.** `precio_alquiler` es **READ-ONLY** (sale de la RPC `calcular_receta` invocada desde Costos). El showroom **muestra** `precioAlquiler`; nunca lo calcula, escribe ni "ajusta". Tampoco tocar `costo_fabricacion`, `costo_por_uso`, `snapshot_*`, `tipo_receta`, `es_cotizable`, `mano_obra_minutos`, `margen_*`, `vida_util_armado_override`. (Contrato de interfaz, GROUND TRUTH §costos.) **Refuerzo concreto:** el `updateCatalogoItem` que el showroom invoque debe pasar **sólo** campos de vitrina (`nombre`, `codigo`, `rubro`, `categoria`, `descripcion`, `origen`, `unidad`, `descripcionLarga`, `colores`, `fichaTecnica`, `frenteCm`, `profundidadCm`, `altoCm`). Aunque el método mapea más columnas (es compartido con Costos), el showroom **no debe enviarlas**. Si alguna vez se necesita un precio "de vitrina" distinto, crear **columna nueva** (`precio_showroom_override`) y documentar que NO afecta Listas ni Cotizador.

2. **NO usar `localStorage` para datos de negocio.** Fotos, descripciones, fichas, medidas → **Supabase** (`catalogo_item_fotos` / columnas nuevas). `localStorage` **sólo** para preferencias de UI (último tab, modo galería/tabla). (CLAUDE.md regla 11.)

3. **NO dejar dummy data / mocks.** Prohibido `_getDummyItems()`, fotos placeholder hardcodeadas, arrays de ejemplo. Sin fotos → **empty state real** ("Sin fotos cargadas") + (si `!_isRO`) botón de subida. Las fotos de ejemplo de Fede entran por la subida real (F1) o el farmeo Drive→Supabase (migración puntual de Claude, no la app). (Batch 12.B borró exactamente este tipo de mock.)

4. **NO estilos sin prefijo `cat-`.** Todo el CSS con prefijo `cat-` (`.cat-wrapper`, `.cat-table`, `.cat-side-panel`, `.cat-foto-thumb`, `.cat-galeria`, …) inyectado **una sola vez** con guard `_stylesInjected` + `<style id="catalogo-styles">`. Prohibido pisar selectores globales sin scope (lección del bug `.log-mov-row`/`.fin-subtabs`).

5. **NO `onclick` inline.** Siempre `addEventListener` (delegado cuando aplique). Única excepción del repo: `data-modal-close` en footers de `Modal.open()`.

6. **NO hotlinkear Drive en runtime.** Las fotos viven en el bucket **público `catalogo`** de Supabase Storage y se referencian por su `publicUrl` (`getPublicUrl`). Drive es **sólo fuente de origen** para el farmeo en lote (Claude, no la app). La app **nunca** depende de Drive en runtime (links `uc?id=` inestables, rate-limit, CORS al bajarlos a jsPDF). (Decisión FIRME del brief.)

7. **NO olvidar el soft-delete.** Toda lectura filtra `.eq('_deleted', false)`; toda baja es `_deleted = true`. Aplica a `catalogo_items` (vía `UndoHelpers.deleteRecord`, ya en `deleteCatalogoItem` #1) **y** a `catalogo_item_fotos` (tiene columna `_deleted` — usar `deleteCatalogoFoto`, que además limpia el objeto del bucket best-effort).

8. **NO inventar columnas ni métodos.** `catalogo_items.id` es **bigint** (no UUID). Las columnas nuevas son exactamente las del modelo cerrado del brief (`descripcion_larga`, `colores text[]`, `ficha_tecnica jsonb`, `frente_cm`/`profundidad_cm`/`alto_cm`). **No agregar `audiencia`/`tipo_item`** "porque las tabs lo sugieren": hoy las tabs Stands/Eventos **no filtran nada** (GROUND TRUTH §catalogo, gotcha verificado: `catalogo.js:184-186` lo dice explícito). Decidir su destino es diseño de F2, no una columna no acordada. **No usar `API.getRendimientoCatalogo`** (es el catálogo de engranaje de Rendimiento, otra tabla).

9. **NO romper el cotizador externo.** El cotizador (app Vercel) lee `catalogo_items` directo filtrando `es_cotizable=TRUE` y leyendo `precio_alquiler`. Es un **consumer read-only**, no se toca ni se le orquesta sync. Cualquier cambio que altere `es_cotizable` o `precio_alquiler` lo afecta → por eso ambas son intocables desde el showroom.

10. **NO confiar en `colores`/`fichaTecnica`/medidas sin defensa de null.** Postgres devuelve `null` (no `[]`) cuando el `text[]`/`jsonb` está vacío. El mapeo de `getCatalogoItems` (§7.0.b) ya normaliza a `[]`/`null`, pero el render debe igual blindarse: `(item.colores || []).map(...)`, `(item.fichaTecnica || []).map(...)`, y mostrar las medidas sólo si `frenteCm != null` (no renderizar "null × null × null cm"). Un item sin foto, sin colores, sin ficha y sin medidas es el caso **normal** al arrancar — todos esos bloques deben colapsar a empty-state, nunca tirar `TypeError`.

---

### 7.6 — Workflow de deploy + verificación end-to-end

Cierre de cada fase según el flujo del repo (memorias `feedback_orden_sql_push`, `feedback_git_workflow`):

1. **SQL-first.** Fede corre el SQL idempotente (F1: `sql/catalogo_showroom_f1.sql`, ya escrito y verificado presente) en el SQL Editor de Supabase **antes** de que se pushee el JS. Si el JS con columnas/tablas nuevas llega antes que el ALTER/CREATE, los `insert`/`update`/`select` rompen.
2. **Commit + push directo a `main`** (`git push origin HEAD:main`, sin PR ni rama remota), con los `?v=` ya bumpeados en `index.html` (en F1: `api.js`, `rendimiento.js`, `catalogo.js`).
3. **El deploy lo activa el pull de Fede** (`~/pull-lobby.sh`). Hasta que pullee, prod sirve la versión vieja → la verificación se hace **después** del pull, recargando con cache-buster (`?cb=x#catalogo`) porque el `index.html` viejo puede estar cacheado.
4. **Verificación end-to-end en prod con cleanup.** No alcanza F12 + revisión visual. Probar el circuito real y limpiar al final:
   - **Regresión del rename (§7.0):** Rendimiento → catálogo de engranaje crea/edita/borra OK (no debe cambiar nada). Si esto se rompe, el rename quedó a medias.
   - **Alta de item desde `#catalogo`** → confirmar que aparece en `catalogo_items` (no en `evento_costo_catalogo`) y se ve en la tabla. (Prueba directa de que la colisión quedó resuelta.)
   - **Subir una foto real** → ver objeto en bucket `catalogo`, fila en `catalogo_item_fotos`, foto en la galería/lightbox.
   - **Editar ficha rica** (descripcion_larga, 1-2 colores, 1 spec, medidas) → recargar y confirmar persistencia.
   - **Marcar portada** (si F3) → `es_principal` único por ítem.
   - **Exportar PDF** (si F4).
   - **Cleanup:** soft-delete del item y la foto de prueba + `storage.from('catalogo').remove([path])` del objeto.
   - **Smoke contra costeo/cotizador:** abrir Costos → tab Listas y confirmar que `precio_alquiler`/`es_cotizable` del item tocado **no cambiaron** (el showroom no debe haberlos escrito).

> **Resumen:** la infraestructura de *registro/permisos* = cero trabajo nuevo (ruta, script y permiso ya existen; RLS ya es espejo). Pero la *capa de datos* exige tres cosas en F1, en este orden: **(1)** arreglar la colisión `createCatalogoItem`/`updateCatalogoItem`/`deleteCatalogoItem` renombrando el bloque de rendimiento (§7.0); **(2)** mapear las columnas nuevas en `getCatalogoItems`/`updateCatalogoItem` + crear el CRUD de `catalogo_item_fotos` + el upload al bucket público (§7.0.b); **(3)** bumpear los `?v=` y respetar `this._isRO` + los anti-patrones. Sin (1) y (2), el módulo escribe en la tabla equivocada y no puede persistir nada del showroom.


---

# 8 · Verificacion end-to-end en prod + plan de pruebas

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are globals. The borrador's use of `supabaseClient.supabaseUrl`/`supabaseClient.supabaseKey` is unreliable — I'll use the real globals. Now I have what I need to produce the corrected section.

---

## 8 · Verificación end-to-end en producción + plan de pruebas

> **Por qué esta sección es obligatoria.** En este repo la clase de bug más cara es el *schema/runtime mismatch* — JS con un nombre de columna viejo, una policy RLS que no deja insertar, un bucket que no es público, una columna inexistente. Eso **no se caza con F12 + screenshot**; solo ejecutando el flujo real contra prod, verificando el efecto en DB / Storage / consola, y **limpiando la data de prueba**. El cierre no es "verificado en preview" — el cierre es **prod con cleanup** (regla del proyecto, §10 de CLAUDE.md + memoria `feedback_autonomous_batches`).

### 8.0 Pre-requisitos antes de tocar prod

El SQL de F1 (`sql/catalogo_showroom_f1.sql`) **ya tiene que estar corrido por Fede** (SQL-first). Antes de la verificación funcional, confirmar el schema real contra prod (regla 12 — no asumir que el archivo refleja la DB). Ejecutar en la consola del browser ya logueado como **superadmin** (o vía Chrome `javascript_tool`):

```javascript
// 8.0 — confirmar que F1 está aplicado (columnas + tabla + bucket)
(async () => {
  // a) columnas nuevas en catalogo_items (si falta alguna, el select da error)
  const { data: cols, error: ec } = await supabaseClient
    .from('catalogo_items')
    .select('id, descripcion_larga, colores, ficha_tecnica, frente_cm, profundidad_cm, alto_cm')
    .limit(1);
  console.log('catalogo_items cols nuevas:', !ec ? 'OK' : 'FALTAN', ec?.message || '');

  // b) tabla catalogo_item_fotos existe y es legible con todas sus columnas
  const { data: fotos, error: ef } = await supabaseClient
    .from('catalogo_item_fotos')
    .select('id, item_id, url, storage_path, orden, es_principal, alt, created_at, _deleted')
    .limit(1);
  console.log('catalogo_item_fotos:', !ef ? 'OK' : 'FALTA', ef?.message || '');

  // c) bucket público catalogo existe y es public=true
  const { data: buckets, error: eb } = await supabaseClient.storage.listBuckets();
  const cat = (buckets || []).find(b => b.id === 'catalogo' || b.name === 'catalogo');
  console.log('bucket catalogo público:', cat?.public === true ? 'OK' : 'NO/PRIVADO', cat || 'NO EXISTE', eb?.message || '');
})();
```

> **Nota sobre `listBuckets()` con anon key.** Si por configuración del proyecto `listBuckets()` devolviera vacío o sin permiso desde el cliente anon, no es un fallo del bucket: confirmar (c) de forma alternativa subiendo y bajando un objeto en Flujo A (un `getPublicUrl` que resuelve `200` prueba que el bucket es público igual). El gate duro es (a) y (b).

Los logs (a) y (b) deben dar `OK`. Si alguno falla → **parar**: el SQL no está aplicado o el schema difiere; no seguir.

### 8.1 `node --check` de cada `.js` tocado (gate de sintaxis)

Antes de cualquier verificación en navegador, validar que ningún archivo quedó roto. Desde la raíz del repo (Bash POSIX). Ajustar la lista a los archivos realmente tocados en la fase — como mínimo `catalogo.js`; `api.js` solo si se le agregaron helpers (Flujos A/F.2/F.3 pueden vivir 100% en `catalogo.js` reusando `supabaseClient.storage` directo, en cuyo caso `api.js` **no** se toca):

```bash
node --check catalogo.js && node --check api.js && echo "OK sintaxis"
```

> Si en una fase NO se modificó `api.js`, **no** lo agregues al gate ni le bumpees `?v=` — bumpear un archivo intacto fuerza un re-fetch inútil y enmascara qué cambió realmente. Verificá con `git status` qué `.js` tocaste y corré `node --check` solo sobre esos.

Cache-buster en `index.html` — cada `.js` **efectivamente modificado** debe tener `?v=` subido respecto del commit anterior (si no sube, el VPS sirve el archivo viejo tras el pull y la prueba da falsos resultados):

```bash
git status --porcelain -- '*.js'                 # qué .js cambiaron de verdad
grep -nE 'catalogo\.js\?v=|api\.js\?v=' index.html
```

Confirmar a ojo que el número subió **solo** para los archivos listados por `git status`. **Gate duro:** si `node --check` falla, no se pushea ni se prueba nada más.

### 8.2 Flujos en prod — checklist con cleanup

Cada flujo se corre en prod (el dominio/IP del VPS, ya logueado como **superadmin**), se verifica el efecto real, y al final se ejecuta el bloque de cleanup (§8.4). Usar un **ítem de prueba dedicado** para no ensuciar items reales.

> **Importante sobre `API.createCatalogoItem`.** Según GROUND TRUTH §catalogo, `createCatalogoItem` mapea únicamente `nombre, codigo, rubro, categoria, descripcion, origen, unidad, costo_produccion, precio_cliente, nivel, familia` — **no** mapea las columnas nuevas de F1 (`descripcion_larga, colores, ficha_tecnica, frente_cm…`) ni `foto`. El item de prueba se crea con los campos soportados; los campos ricos se prueban con `updateCatalogoItem` (Flujo B), que en la fase de edición rica **debe** haberse extendido para mapearlos. El valor de retorno de `createCatalogoItem` es el `id` (vía `UndoHelpers.createRecord`).

```javascript
// 8.2.0 — crear un item de prueba aislado (solo campos soportados por createCatalogoItem)
(async () => {
  const id = await API.createCatalogoItem({
    nombre: 'ZZZ_TEST_SHOWROOM', codigo: 'ZZZ-TEST', rubro: 'Equipamiento',
    categoria: 'test', descripcion: 'item de prueba showroom', origen: 'Compra', unidad: 'Unidad',
  });
  window.__TEST_ITEM_ID = id;          // persistir para los pasos siguientes
  API.clearCache();
  console.log('TEST item creado id =', id, typeof id);
  if (id == null) console.error('FALLO: createCatalogoItem no devolvió id');
})();
```

Todos los pasos siguientes operan sobre `window.__TEST_ITEM_ID`, y el cleanup final lo borra. **`catalogo_items.id` es bigint** (no UUID) — al comparar/insertar usar el valor tal cual lo devolvió la API.

#### Flujo A — Subir una foto, verla en la galería, y que su `getPublicUrl` abra

**UI:** abrí el showroom (`#catalogo`), abrí la ficha de `ZZZ_TEST_SHOWROOM`, drag-drop (o file-input) de una imagen JPG/PNG → debe comprimirse (downscale canvas, JPEG), subir al bucket `catalogo`, insertar fila en `catalogo_item_fotos`, y aparecer en la galería **sin recargar**. Si es la primera foto del item, debe quedar `es_principal=true` (portada por defecto).

```javascript
// 8.A — verificar foto subida: fila en DB + objeto en Storage + URL pública 200
(async () => {
  const id = window.__TEST_ITEM_ID;
  const { data: fotos, error } = await supabaseClient
    .from('catalogo_item_fotos')
    .select('*').eq('item_id', id).eq('_deleted', false).order('orden', { ascending: true });
  if (error) return console.error('FALLO query fotos:', error.message);
  console.log('fotos en DB:', fotos.length, fotos);
  if (!fotos.length) return console.error('FALLO: no se insertó fila en catalogo_item_fotos');

  const f = fotos[0];
  console.log('es_principal de la 1ª foto:', f.es_principal, '(esperado true)');

  // a) la URL guardada debe ser la pública del bucket para ese storage_path
  const { data: pub } = supabaseClient.storage.from('catalogo').getPublicUrl(f.storage_path);
  console.log('publicUrl coincide con url guardada:', pub.publicUrl === f.url, pub.publicUrl);

  // b) el objeto realmente resuelve (200 + content-type imagen)
  try {
    const resp = await fetch(f.url, { method: 'GET', cache: 'no-store' });
    console.log('GET publicUrl status:', resp.status, 'ct:', resp.headers.get('content-type'));
  } catch (e) {
    console.error('FALLO fetch publicUrl (CORS/404/bucket privado?):', e.message);
  }
})();
```

**Pass:** `fotos.length >= 1`; primera foto `es_principal === true`; `publicUrl coincide === true`; `status === 200` con content-type `image/...`. Si la URL da 400/404 → el bucket no es público o el `storage_path` está mal armado. Si `publicUrl coincide === false` → el handler guardó una URL distinta a la pública (revisar que use `getPublicUrl(path).data.publicUrl`, no Drive ni una URL armada a mano).

#### Flujo B — Editar colores / ficha técnica / medidas y confirmar persistencia + rehidratación

**UI:** en modo edición (admin), cargar 2-3 chips de color, 2 filas de ficha técnica (`{label, valor}`), y las 3 medidas (frente/profundidad/alto). Guardar.

```javascript
// 8.B — verificar persistencia con el TIPO correcto de cada columna nueva
(async () => {
  const id = window.__TEST_ITEM_ID;
  const { data, error } = await supabaseClient
    .from('catalogo_items')
    .select('descripcion_larga, colores, ficha_tecnica, frente_cm, profundidad_cm, alto_cm')
    .eq('id', id).single();
  if (error) return console.error('FALLO query:', error.message);

  const okColores = Array.isArray(data.colores);
  const okFicha = Array.isArray(data.ficha_tecnica)
    && data.ficha_tecnica.every(r => r && typeof r === 'object' && 'label' in r && 'valor' in r);
  const numOk = v => v === null || typeof v === 'number';
  console.log('colores es array:', okColores, data.colores);
  console.log('ficha_tecnica es array de {label,valor}:', okFicha, data.ficha_tecnica);
  console.log('medidas numéricas o null:', numOk(data.frente_cm) && numOk(data.profundidad_cm) && numOk(data.alto_cm),
    [data.frente_cm, data.profundidad_cm, data.alto_cm]);
})();
```

**Pass:** `colores` es array de strings; `ficha_tecnica` es array de objetos `{label, valor}`; las 3 medidas son numéricas o `null` (nunca string vacío `""` — eso indica que el form no parseó el input vacío a `null`). **Rehidratación:** recargar la ficha (cerrar y reabrir o `#lobby`→`#catalogo`) y confirmar que la UI repinta chips, filas y medidas (no quedan en blanco). Edge importante: guardar con **colores vacíos** y **ficha_tecnica vacía** no debe romper — deben persistir como `[]` (o `null`), y la UI debe mostrar el placeholder correspondiente, no `undefined`/`NaN`.

#### Flujo C — Generar el PDF y confirmar que embebe la imagen

**UI:** desde el showroom, "Exportar propuesta" (PDF branded por cliente) sobre un set que incluya el ítem con foto. El PDF se descarga y muestra la imagen embebida (no cuadro vacío ni "Sin imagen"), con branding MEPEX (logo, turquesa `[0,169,193]`, footer con paginación vía `didDrawPage`).

Como `doc.save()` no es inspeccionable, se verifica en dos planos:

1. **Visual:** abrir el PDF y confirmar a ojo la foto + branding.
2. **Smoke test del pipeline imagen→dataURL** (lo que consume jsPDF; mismo patrón `loadImage` del GROUND TRUTH §PDF). Si da `null`, el PDF saldría sin imagen:

```javascript
// 8.C — smoke test: la foto pública se baja y se convierte a dataURL para jsPDF
(async () => {
  const id = window.__TEST_ITEM_ID;
  const { data: fotos } = await supabaseClient.from('catalogo_item_fotos')
    .select('url').eq('item_id', id).eq('_deleted', false).limit(1);
  if (!fotos.length) return console.error('sin foto para el test de PDF (correr Flujo A antes)');
  try {
    const resp = await fetch(fotos[0].url, { cache: 'no-store' });
    if (!resp.ok) return console.error('FALLO: publicUrl status', resp.status);
    const blob = await resp.blob();
    const dataUrl = await new Promise((res, rej) => {
      const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob);
    });
    const ok = typeof dataUrl === 'string' && dataUrl.startsWith('data:image/');
    console.log('dataURL OK para jsPDF:', ok, 'len:', dataUrl.length);
  } catch (e) {
    console.error('FALLO bajar/convertir foto para PDF (CORS/404?):', e.message);
  }
})();
```

**Pass:** `dataURL OK === true` y empieza con `data:image/`. Esto valida la decisión firme del brief: las fotos en Storage público se bajan a jsPDF **sin CORS** (a diferencia de Drive). Si fallara, alguna foto quedó hotlinkeada de Drive — corregir. **Edge del PDF (ítem sin foto):** generar el PDF de un set que incluya el item de prueba **antes** de subirle foto debe producir un layout con placeholder/sin imagen, sin romper (jsPDF no debe recibir `null` en `addImage`; el código debe saltear el `addImage` si no hay dataURL).

#### Flujo D — No-regresión: Cotizador / Costos siguen leyendo `catalogo_items`

Contrato nuclear: el showroom **no toca** `precio_alquiler`, `es_cotizable`, `tipo_receta`, `margen*`, `costo*`, `snapshot*` ni la RPC `calcular_receta`. Verificar lecturas críticas:

```javascript
// 8.D — no-regresión del contrato con Costos/Cotizador
(async () => {
  // a) lectura del cotizador externo: cotizables con precio (snake_case, lectura directa)
  const { data: cotiz, error: e1 } = await supabaseClient
    .from('catalogo_items')
    .select('codigo, nombre, precio_alquiler')
    .eq('es_cotizable', true).eq('_deleted', false).limit(5);
  console.log('cotizador lee OK:', !e1, 'muestra:', cotiz?.length, e1?.message || '');

  // b) lectura de Costos (camelCase via API): precio + snapshot + receta intactos
  API.clearCache();
  const items = await API.getCatalogoItems();
  const sample = items.find(i => i.precioAlquiler != null && i.id !== window.__TEST_ITEM_ID) || items[0];
  console.log('Costos getCatalogoItems OK:', items.length,
    '| precioAlquiler:', sample?.precioAlquiler,
    '| esCotizable:', sample?.esCotizable,
    '| tipoReceta:', sample?.tipoReceta,
    '| snapshotCostosAt:', sample?.snapshotCostosAt);

  // c) el item de prueba NO alteró ningún campo de costeo
  const id = window.__TEST_ITEM_ID;
  const { data: t } = await supabaseClient.from('catalogo_items')
    .select('precio_alquiler, es_cotizable, tipo_receta, snapshot_costos_at, costo_por_uso, costo_fabricacion')
    .eq('id', id).single();
  console.log('TEST item costeo sin tocar (esperado precio/snapshot null o 0):', t);
})();
```

**Pass:** (a) y (b) sin error y con datos; campos de costeo de la muestra **idénticos** a lo de Costos. Abrir además **Costos → Listas de Precio** en la UI: tabla renderiza, toggle "cotizable" funciona, precios visibles, **0 errores de consola**. **Auditoría estática obligatoria:** confirmar en `catalogo.js` que **ningún** `API.updateCatalogoItem(...)` del showroom incluye en su payload `precioAlquiler`, `esCotizable`, `tipoReceta`, `manoObraMinutos`, `margenPropio`, `margenSubalquiler`, `vidaUtilArmadoOverride`, `costo*` ni `snapshot*`. El showroom solo manda campos de vitrina (`nombre, codigo, rubro, categoria, descripcion, origen, unidad, descripcion_larga, colores, ficha_tecnica, frente_cm, profundidad_cm, alto_cm`) — y la subida/borrado de fotos va contra `catalogo_item_fotos`, **no** contra `catalogo_items`.

```bash
# verificación estática: ningún update de costeo desde catalogo.js
grep -nE "updateCatalogoItem" catalogo.js
grep -nE "precioAlquiler|esCotizable|tipoReceta|margen(Propio|Subalquiler)|snapshot|costo(PorUso|Fabricacion|Produccion)|vidaUtilArmado" catalogo.js
```

El segundo `grep` puede matchear solo lecturas/displays (read-only), nunca dentro de un objeto pasado a `updateCatalogoItem`. Revisar cada hit a ojo.

#### Flujo E — RLS (anon SELECT sí, anon INSERT no · venta/pm read-only en UI)

La policy de F1 es espejo de `catalogo_items`: `anon FOR SELECT USING(true)` + `authenticated FOR ALL USING(true) WITH CHECK(true)`. Verificar con un **cliente anónimo separado**, usando los globals reales `SUPABASE_URL` / `SUPABASE_ANON_KEY` de `config.js` (NO `supabaseClient.supabaseUrl`, que no es API pública y puede ser `undefined`):

```javascript
// 8.E — RLS con cliente anónimo (sin sesión). Usa los globals de config.js.
(async () => {
  const anon = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // NO se hace auth.* → el cliente queda en rol anon

  // a) anon PUEDE leer fotos (showroom público / cotizador)
  const { data: rd, error: er } = await anon
    .from('catalogo_item_fotos').select('id').limit(1);
  console.log('anon SELECT fotos:', !er ? 'PERMITIDO (ok)' : 'BLOQUEADO (MAL)', er?.message || '');

  // b) anon NO puede insertar (espejo: anon solo SELECT)
  const { data: ins, error: ei } = await anon
    .from('catalogo_item_fotos')
    .insert({ item_id: window.__TEST_ITEM_ID, url: 'x', storage_path: 'zzz_test_rls/x.jpg' })
    .select();
  if (!ei && ins && ins.length) {
    console.error('anon INSERT fotos: PERMITIDO (MAL — RLS WITH CHECK floja). Limpiando fila…');
    // si por error entró, borrarla con el cliente autenticado (superadmin)
    await supabaseClient.from('catalogo_item_fotos').delete().eq('id', ins[0].id);
  } else {
    console.log('anon INSERT fotos: BLOQUEADO (ok)', ei?.message || '');
  }
})();
```

**Pass:** (a) anon SELECT **permitido**; (b) anon INSERT **bloqueado** (error de policy, y `ins` vacío). Si (b) entra, hay que limpiar la fila colada (el snippet ya lo hace) y corregir el `WITH CHECK` del SQL. **Storage RLS (bucket público):** confirmar que un cliente anon **no** puede subir al bucket `catalogo` (solo `authenticated`), espejo de las policies de `storage.objects` del SQL F1:

```javascript
// 8.E.storage — anon NO puede subir al bucket (solo authenticated)
(async () => {
  const anon = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const blob = new Blob(['x'], { type: 'text/plain' });
  const { error } = await anon.storage.from('catalogo').upload('zzz_test_rls/anon.txt', blob, { upsert: true });
  console.log('anon UPLOAD bucket:', error ? 'BLOQUEADO (ok)' : 'PERMITIDO (revisar policy storage.objects)', error?.message || '');
  if (!error) await supabaseClient.storage.from('catalogo').remove(['zzz_test_rls/anon.txt']); // cleanup si entró
})();
```

**Gating de UI por rol:** la app gatea por `Data.isReadOnly(role, 'catalogo')`. Verificar la lógica sin re-loguear:

```javascript
// 8.E.2 — gating de UI: venta/pm read-only, admin/superadmin write
['venta','pm','admin','superadmin'].forEach(r =>
  console.log(r, '→ isReadOnly:', Data.isReadOnly(r, 'catalogo')));
// esperado: venta=true, pm=true, admin=false, superadmin=false
```

Confirmar a ojo en `catalogo.js` que botones de subir foto / editar / borrar item / eliminar foto / setear portada se renderizan **solo si** `!isReadOnly` (mismo patrón gated del `catalogo.js` actual). Idealmente, loguear una vez como `venta`: la ficha se ve pero sin acciones de escritura y el drag-drop no hace nada (o avisa solo-lectura).

#### Flujo F — Edge cases

**F.1 — Item sin fotos (placeholder).** Abrir la ficha del item de prueba **antes** de subir cualquier foto: la galería muestra un placeholder limpio (ícono 📷 + "Sin imágenes"), nunca un `<img>` roto. Confirmar conteo:

```javascript
// 8.F.1 — 0 fotos => UI placeholder (verificar a ojo) + PDF no rompe
(async () => {
  const id = window.__TEST_ITEM_ID;
  const { data } = await supabaseClient.from('catalogo_item_fotos')
    .select('id').eq('item_id', id).eq('_deleted', false);
  console.log('fotos del item:', data.length, '(esperado 0 antes del Flujo A)');
})();
```

**F.2 — Foto pesada (compresión).** Subir una imagen grande (p. ej. 4000×3000, varios MB). Debe pasar por el downscale canvas (`maxDim` ~1600, JPEG ~0.85) **antes** de subir:

```javascript
// 8.F.2 — verificar compresión: el objeto subido pesa mucho menos que el original
(async () => {
  const id = window.__TEST_ITEM_ID;
  const { data: fotos } = await supabaseClient.from('catalogo_item_fotos')
    .select('url, storage_path').eq('item_id', id).eq('_deleted', false)
    .order('orden', { ascending: false }).limit(1);
  if (!fotos.length) return console.error('subí la foto pesada por la UI primero');
  const resp = await fetch(fotos[0].url, { cache: 'no-store' });
  const len = Number(resp.headers.get('content-length') || 0);
  console.log('foto subida:', (len/1024).toFixed(0), 'KB', '| ct:', resp.headers.get('content-type'));
  // esperado: image/jpeg y típicamente < ~300 KB para 1600px @0.85
})();
```

**Pass:** `content-type: image/jpeg` y peso reducido. Si subió con el peso original, el downscale no corrió.

**F.3 — Borrar foto (soft-delete fila + objeto removido del bucket).** Borrar una foto desde la UI: debe marcar `_deleted=true` en `catalogo_item_fotos` **y** remover el objeto del bucket público (no dejar basura). La galería la quita sin recargar. Si se borra la portada, otra foto viva debería promoverse a `es_principal` (verificar a ojo en la UI):

```javascript
// 8.F.3 — verificar borrado: fila _deleted=true Y objeto fuera del bucket
(async () => {
  const id = window.__TEST_ITEM_ID;
  const { data: filas } = await supabaseClient.from('catalogo_item_fotos')
    .select('id, storage_path, _deleted, es_principal').eq('item_id', id);
  console.log('estado de filas tras borrar (debe haber >=1 con _deleted=true):', filas);

  const borrada = filas.find(v => v._deleted);
  if (borrada) {
    const { data: pub } = supabaseClient.storage.from('catalogo').getPublicUrl(borrada.storage_path);
    try {
      const resp = await fetch(pub.publicUrl, { cache: 'no-store' });
      console.log('objeto borrado status (esperado 400/404):', resp.status);
    } catch (e) {
      console.log('objeto borrado: fetch falló (consistente con removido):', e.message);
    }
  }
})();
```

**Pass:** la fila quedó `_deleted=true` (soft-delete, regla del proyecto) **y** el objeto físico ya no resuelve (`400/404`). Si el objeto sigue `200`, el handler de borrado no llamó a `supabaseClient.storage.from('catalogo').remove([path])`.

**F.4 — Errores de red / concurrencia (defensivos).** Verificar manejo de fallos sin dejar estado inconsistente:
- **Upload que falla a mitad** (cortar red en DevTools → Network → Offline durante un drag-drop): la UI muestra `Toast.error`, **no** inserta fila en `catalogo_item_fotos`, y no deja un objeto suelto en el bucket. Re-intentar online debe funcionar (idempotencia: usar `upsert:true` o path único por foto para que un re-intento no choque por `Duplicate`).
- **Doble subida rápida del mismo archivo** (dos drag-drop seguidos): cada uno debe generar un `storage_path` distinto (p. ej. con timestamp o índice: `${itemId}/${Date.now()}_<n>.jpg`), nunca pisarse mutuamente ni crear dos filas con el mismo path. Verificar en DB que los `storage_path` son únicos por foto.
- **Carrera de portada:** marcar una foto como principal debe desmarcar las otras del mismo item (el front asegura 1 sola `es_principal`). Verificar:

```javascript
// 8.F.4 — a lo sumo UNA foto principal viva por item
(async () => {
  const id = window.__TEST_ITEM_ID;
  const { data } = await supabaseClient.from('catalogo_item_fotos')
    .select('id, es_principal').eq('item_id', id).eq('_deleted', false);
  const principales = data.filter(f => f.es_principal).length;
  console.log('fotos principales vivas:', principales, '(esperado 0 o 1)');
  if (principales > 1) console.error('FALLO: más de una portada — el set de es_principal no desmarca las otras');
})();
```

### 8.3 Cero errores de consola y Network limpia

Durante **todos** los flujos, vigilar Console y Network:
- Navegar showroom → ficha → modo edición → subir foto → export PDF → borrar foto → volver. **0 errores, 0 warnings nuevos** atribuibles al módulo (vía Chrome `read_console_messages` o F12). Se aceptan solo ruidos preexistentes conocidos (polling Supabase, auth refresh), **nunca** `4xx`/`5xx` de Storage/tabla, `TypeError`, ni `column ... does not exist`.
- **Network:** ningún `4xx`/`5xx` contra `catalogo_item_fotos`, el bucket `catalogo`, ni `catalogo_items`. Un `400`/`403` contra Storage = bucket/policy mal; un `400` contra la tabla = columna/policy mal; un `404` de `getPublicUrl` durante uso normal = path mal armado.

Regla del proyecto (barrido global): el bug valioso acá es el *schema mismatch en runtime* — se caza mirando Network + Console contra prod, no con análisis estático. Ante un `4xx`, **no “arreglar a ciegas”**: leer el mensaje, verificar columna/policy contra `information_schema`, y recién ahí corregir.

### 8.4 Cleanup de la data de prueba

Al terminar **toda** la verificación, dejar prod como estaba (sin ítems `ZZZ_TEST_*`, sin fotos, sin objetos en el bucket). Cleanup completo y robusto:

```javascript
// 8.4 — CLEANUP total: objetos en Storage + filas fotos + item de prueba + filas RLS coladas
(async () => {
  const id = window.__TEST_ITEM_ID;
  if (id == null) return console.warn('no hay __TEST_ITEM_ID, nada que limpiar');

  // a) borrar TODOS los objetos del item en el bucket (vivos y soft-deleted)
  const { data: fotos } = await supabaseClient.from('catalogo_item_fotos')
    .select('id, storage_path').eq('item_id', id);
  const paths = [...new Set((fotos || []).map(f => f.storage_path).filter(Boolean))];
  if (paths.length) {
    const { error: eRm } = await supabaseClient.storage.from('catalogo').remove(paths);
    console.log('objetos removidos del bucket:', paths.length, eRm?.message || 'ok');
  }
  // b) por las dudas, barrer el prefijo de test de RLS
  await supabaseClient.storage.from('catalogo').remove(['zzz_test_rls/x.jpg', 'zzz_test_rls/anon.txt']).catch(() => {});

  // c) hard-delete de filas de fotos del item (data de prueba, no soft-delete)
  const { error: eF } = await supabaseClient.from('catalogo_item_fotos').delete().eq('item_id', id);
  console.log('filas fotos borradas:', eF?.message || 'ok');

  // d) borrar el item de prueba (soft-delete via API = camino real de la app)
  await API.deleteCatalogoItem(id);
  API.clearCache();

  // e) verificación post-cleanup
  const { data: rest } = await supabaseClient.from('catalogo_item_fotos').select('id').eq('item_id', id);
  const { data: itemRest } = await supabaseClient.from('catalogo_items')
    .select('id, _deleted').eq('id', id).single();
  console.log('post-cleanup fotos vivas:', rest.length, '(esperado 0)');
  console.log('post-cleanup item _deleted:', itemRest?._deleted, '(esperado true)');
  console.log('CLEANUP COMPLETO.');
})();
```

> **Soft vs hard delete en cleanup.** Las **filas de fotos de prueba** se hard-deletean (ruido de test, sin valor de historial). El **ítem de prueba** se cierra con `API.deleteCatalogoItem` (soft-delete `_deleted=true`), camino real de la app, que deja audit log coherente; al estar filtrado por `_deleted=false` en todas las lecturas, no reaparece. Nunca dejar `ZZZ_TEST_*` visible en el catálogo. Si se prefiere borrar el ítem de raíz, hacerlo desde el SQL Editor.

### 8.5 Criterio de cierre (Definition of Done)

La sección se aprueba **solo si** todo es verdadero:

- [ ] `node --check` pasa en cada `.js` realmente modificado; `?v=` bumpeado en `index.html` solo para esos (verificado contra `git status`).
- [ ] 8.0: F1 aplicado (columnas + tabla + bucket público) → gates (a) y (b) `OK`.
- [ ] **A:** foto sube → fila en DB (`es_principal=true` si es la 1ª) → `getPublicUrl` resuelve `200 image/*` → aparece en galería sin recargar; `publicUrl` coincide con la `url` guardada.
- [ ] **B:** colores (array), ficha técnica (array de `{label,valor}`) y medidas (numéricas/`null`) persisten y rehidratan tras refresh; vacíos no rompen (`[]`/`null` + placeholder).
- [ ] **C:** PDF embebe la imagen (visual) + smoke test dataURL `data:image/` OK; branding MEPEX presente; ítem sin foto no rompe el PDF.
- [ ] **D:** cotizador y Costos leen `catalogo_items` sin error; precio/cotizable/receta/snapshots **intactos**; Listas de Precio renderiza; `grep` confirma que `catalogo.js` no manda campos de costeo en ningún `updateCatalogoItem`.
- [ ] **E:** anon SELECT permitido, anon INSERT bloqueado (fila colada limpiada si la hubo); anon upload al bucket bloqueado; `Data.isReadOnly` correcto por rol; botones de escritura ocultos para venta/pm.
- [ ] **F.1–F.4:** placeholder sin fotos; compresión efectiva (JPEG, peso reducido); borrado = soft-delete fila + objeto removido del bucket; defensivos de red/concurrencia OK; a lo sumo 1 portada viva por item.
- [ ] **Consola y Network limpias** en todos los flujos (0 `4xx`/`5xx` de Storage/tabla, 0 `TypeError`, 0 `column does not exist`).
- [ ] **Cleanup ejecutado** y verificado: 0 fotos vivas, item de prueba `_deleted=true`, 0 objetos `ZZZ_TEST_*`/`zzz_test_rls` en el bucket.

Si **cualquiera** falla, la fase no está cerrada: diagnosticar contra prod (no a ciegas), corregir, y re-correr el flujo afectado **con su cleanup**.


---

# 9 · Orden de ejecucion one-shot + commits + PROMPT para Claude Code

I now have the full picture. Key findings that the original Section 9 gets right or needs hardening:

1. **`updateCatalogoItem` does NOT currently map the new fields** (`descripcionLarga`, `colores`, `fichaTecnica`, `frenteCm`, etc.) — F1 must add them. The original section says this correctly. But it also says "ampliado" without noting these mappings don't exist yet, and crucially the existing function *already maps* `precioAlquiler`/`tipoReceta`/`esCotizable`/snapshots — so the showroom must never pass those keys. The section should warn the agent NOT to remove those existing mappings (they're used by Costos) but to ensure the showroom's call sites never populate them.

2. **`getPublicUrl` is inferred, not in repo** — the brief is honest about this. The pattern is correct standard SDK. Worth a note.

3. **Storage DELETE policy = hard delete only by admin/superadmin, but app soft-deletes the DB row** — the bucket object is NOT removed on soft delete. The cleanup checklist's "borrar objetos del bucket" must use `supabaseClient.storage.from('catalogo').remove([path])` explicitly during test cleanup (admin session), since the app never does it.

4. **Concrete `?v=` numbers**: catalogo.js is at v=5 → F1=v6, F2=v7, F3=v8, F4=v9.

5. The "BLOQUE 0 no genera commit" claim is correct — the SQL is already committed in the repo.

I have everything needed. Here is the hardened, corrected Section 9.

---

## 9 · Orden de ejecución one-shot · commits · checklist de aceptación · prompt de arranque

> Cierra el doc. Asume que el resto (modelo de datos, API, showroom, ficha, edición, PDF, farmeo) ya está especificado arriba con código copy-paste-grade. Acá va la **secuencia de construcción**, los **commits por bloque**, el **checklist de aceptación end-to-end**, y el **prompt paste-ready**.
>
> **Verificado contra el repo (2026-06-22):** la ruta `#catalogo` ya existe (`router.js:83` → `CatalogoModule.render()`, `module:'catalogo'`); `catalogo.js` está hoy en `?v=5` (`index.html:59`); `sql/catalogo_showroom_f1.sql` ya está commiteado en el repo (idempotente, bigint PK, `ficha_tecnica jsonb DEFAULT '[]'`, `colores text[]`); y `api.js` **NO** tiene aún `getCatalogoFotos / addCatalogoFoto / uploadCatalogoFoto / getPublicUrl / setCatalogoFotoPrincipal / reorderCatalogoFotos` ni el mapeo de los atributos ricos en `updateCatalogoItem` (hay que crearlos). Estos son los números y nombres reales — usalos exactos.

---

### 9.1 — Orden exacto de construcción (one-shot)

6 bloques secuenciales. Cada uno es atómico (compila, no rompe lo anterior) y termina en commit propio. **No saltear el orden:** F1 desbloquea la subida real → cargar las fotos de ejemplo que Fede ya tiene → probar el showroom con contenido real.

```
BLOQUE 0 — SQL (lo corre FEDE, no Claude)
  └─ sql/catalogo_showroom_f1.sql  (YA ESCRITO Y COMMITEADO, idempotente)
     · ALTER catalogo_items: descripcion_larga, colores text[],
       ficha_tecnica jsonb DEFAULT '[]', frente_cm / profundidad_cm / alto_cm
     · CREATE TABLE catalogo_item_fotos (id BIGINT GENERATED ALWAYS AS IDENTITY,
       item_id BIGINT FK ON DELETE CASCADE, url, storage_path, orden, es_principal,
       alt, created_at, _deleted) + index parcial WHERE NOT _deleted
     · RLS espejo: authenticated FOR ALL USING(true) WITH CHECK(true) + anon FOR SELECT
     · bucket público `catalogo` (10 MB, image/jpeg|png|webp|heic|avif)
     · storage.objects policies: read anon+auth · insert/update auth ·
       DELETE solo admin/superadmin
  ⚠ GATE: NO pushear NADA de JS hasta que Fede confirme "SQL corrido OK".
     Verificar con las queries comentadas al pie del .sql
     (information_schema.columns + storage.buckets WHERE id='catalogo').
     El .sql YA EXISTE: NO reescribirlo. Si necesitás verificar schema,
     leelo y consultá information_schema (regla 12: schema real > SQL del repo).
  ⚠ NOTA STORAGE: el bucket NO se borra al hacer soft delete de la foto
     (la policy DELETE es hard-delete manual admin/superadmin). El app solo
     marca _deleted=true en la fila. Esto importa SOLO para el cleanup de prueba
     (ver 9.3) y para una futura tarea de GC de objetos huérfanos (fuera de alcance).

BLOQUE F1 — Backbone JS + subida real de fotos          → catalogo.js?v=6
  ├─ api.js → métodos NUEVOS (no existen hoy; agregarlos junto a getCatalogoItems):
  │   · getCatalogoFotos(itemId): SELECT * FROM catalogo_item_fotos
  │       WHERE item_id=? AND _deleted=false ORDER BY es_principal DESC, orden ASC
  │       (devolver [] ante error; NO cachear con el _cache de 60s para que la
  │        galería refleje cambios al toque)
  │   · uploadCatalogoFoto(itemId, blob, ext='jpg'): path = `${itemId}/${Date.now()}.${ext}`
  │       → supabaseClient.storage.from('catalogo').upload(path, blob,
  │         {contentType:'image/jpeg', upsert:false, cacheControl:'3600'})
  │       → const {data}=supabaseClient.storage.from('catalogo').getPublicUrl(path)
  │       → return {path, url:data.publicUrl}  (lanzar en error de upload)
  │       [getPublicUrl es la API estándar del SDK Supabase; NO hay precedente en
  │        el repo pero es la contraparte pública de createSignedUrl, verificado en docs]
  │   · addCatalogoFoto({itemId, url, storagePath, orden=0, esPrincipal=false, alt=null}):
  │       INSERT en catalogo_item_fotos. Si esPrincipal===true, primero
  │       UPDATE ... SET es_principal=false WHERE item_id=? (1 sola portada).
  │   · setCatalogoFotoPrincipal(itemId, fotoId): UPDATE es_principal=false del item
  │       entero, luego es_principal=true en fotoId.
  │   · reorderCatalogoFotos(updates[{id,orden}]): UPDATE por fila (loop) o upsert.
  │   · deleteCatalogoFoto(fotoId): SOFT delete → UPDATE _deleted=true.
  │       (NO borra el objeto del bucket: el app no tiene permiso de DELETE en
  │        storage salvo admin; el GC de huérfanos queda fuera de alcance.)
  │   · updateCatalogoItem() AMPLIADO con los mapeos NUEVOS, sin tocar los que ya
  │       existen (precio/receta/snapshots/esCotizable siguen mapeados para Costos):
  │         if (data.descripcionLarga !== undefined) payload.descripcion_larga = data.descripcionLarga || null;
  │         if (data.colores !== undefined) payload.colores = Array.isArray(data.colores) ? data.colores : null;
  │         if (data.fichaTecnica !== undefined) payload.ficha_tecnica = Array.isArray(data.fichaTecnica) ? data.fichaTecnica : [];
  │         if (data.frenteCm !== undefined) payload.frente_cm = (data.frenteCm===''||data.frenteCm==null)?null:parseFloat(data.frenteCm);
  │         if (data.profundidadCm !== undefined) payload.profundidad_cm = (data.profundidadCm===''||data.profundidadCm==null)?null:parseFloat(data.profundidadCm);
  │         if (data.altoCm !== undefined) payload.alto_cm = (data.altoCm===''||data.altoCm==null)?null:parseFloat(data.altoCm);
  │   · getCatalogoItems() AMPLIADO en el mapeo de lectura: agregar
  │       descripcionLarga, colores, fichaTecnica, frenteCm, profundidadCm, altoCm
  │       (sin tocar el resto del mapeo).
  └─ index.html → bump catalogo.js?v=5 → ?v=6
  Verificación (consola del navegador, sesión admin): subir 1 foto real a un item
  de prueba, confirmar objeto en bucket + fila en catalogo_item_fotos + que el item
  conserva intactos precio_alquiler/tipo_receta/snapshot_*. Cleanup (ver 9.3).

BLOQUE F2 — Showroom (galería + ficha)                  → catalogo.js?v=7
  └─ catalogo.js → reescritura de la vista:
     · _loadData(): además de getCatalogoItems, NO precargar todas las fotos
       (lazy: la principal por card se resuelve en una sola query bulk si querés,
        o se carga al abrir la ficha). Para el grid, traer la foto principal por
        item con UNA query bulk: SELECT item_id,url FROM catalogo_item_fotos
        WHERE _deleted=false AND es_principal=true  → map por item_id.
     · grid de cards con foto principal (fallback placeholder, NUNCA <img> roto:
       usar onerror para caer al placeholder)
     · search accent-insensitive (normStr) + filtros rubro/categoría (reusar _applyFilters)
     · click card → ficha full-screen: galería (lightbox), atributos ricos, medidas,
       ficha técnica (rows label/valor, default [] si null/malformado), colores chips
       (vacío si colores null), y precio READ-ONLY (sin input editable)
     · venta/pm = read-only (Data.isReadOnly(role,'catalogo')); gatear TODO control
       de escritura/edición/borrado
  index.html → bump ?v=7

BLOQUE F3 — Edición rica + manejo de fotos             → catalogo.js?v=8
  └─ catalogo.js → modo admin:
     · editar descripcion_larga, colores (chips add/remove), ficha_tecnica
       (rows label/valor), medidas (3 inputs cm) → updateCatalogoItem
     · subir fotos: file input + drag-drop → comprimir con _downscaleImage
       (patrón crm.js: canvas → JPEG ~0.85, validar <=10 MB) → uploadCatalogoFoto
       → addCatalogoFoto → recargar galería
     · reordenar galería (reorderCatalogoFotos), marcar portada
       (setCatalogoFotoPrincipal), borrar foto (deleteCatalogoFoto = soft)
     · deshabilitar el control de subida mientras sube (evitar doble-submit)
     · al borrar la portada actual, promover la siguiente por orden a es_principal
     · PROHIBIDO exponer inputs de precio_alquiler/tipo_receta/snapshot_*/margen_*/
       mano_obra_minutos/vida_util_armado_override/es_cotizable
  index.html → bump ?v=8

BLOQUE F4 — Export PDF propuesta branded               → catalogo.js?v=9
  └─ catalogo.js → "Generar propuesta" (jsPDF window.jspdf + autotable):
     · selección de items → PDF A4 branding MEPEX
     · logo cacheado (patrón _loadLogoForPDF, JPEG 0.88), foto principal por item
       embebida (fetch → dataURL; try-catch + fallback a solo texto si falla la red
       o la imagen no carga), nombre/código/descripción/medidas/precio, footer
       paginado (didDrawPage), header turquesa [0,169,193]
  index.html → bump ?v=9

BLOQUE FARMEO — Migración Drive → Supabase (CLAUDE, one-off, NO la app)
  └─ script puntual (MCP Drive + supabaseClient): lista carpeta por folder_id,
     matchea por código (catalogo_items.codigo), baja bytes, comprime si >10 MB
     o salta, sube al bucket `catalogo`, inserta en catalogo_item_fotos con
     idempotencia (skip si ya existe item_id+storage_path con _deleted=false).
     dry-run primero. NO se enchufa a la app. Si se deja traza, va en tools/ con
     commit propio chore(catalogo): script farmeo Drive→Supabase (one-off).
```

**Regla de oro del orden:** cada bloque que toca `catalogo.js` bumpea su `?v=` en `index.html` (5→6→7→8→9). Nunca tocar `catalogo.js` sin bumpear, o el VPS sirve la versión vieja tras el pull. `api.js` no tiene `?v=` propio en el flujo de catálogo, pero si lo tuviera, bumpealo igual (verificá la línea de `api.js` en `index.html` antes de tocar).

---

### 9.2 — Mensajes de commit sugeridos por bloque

Push directo a `main` (branch `rediseno` → `git push origin HEAD:main`). Un commit por bloque, en orden. **El BLOQUE 0 NO genera commit de Claude** (el `.sql` ya está commiteado en el repo; Fede solo lo corre). **El farmeo NO se commitea** como código del módulo (one-off).

```bash
# F1 — backbone + subida
git add api.js index.html
git commit -m "$(cat <<'EOF'
feat(catalogo): F1 backbone showroom — API fotos + atributos ricos + subida real a Storage

- api.js: getCatalogoFotos / addCatalogoFoto / deleteCatalogoFoto (soft) /
  setCatalogoFotoPrincipal / reorderCatalogoFotos + uploadCatalogoFoto
  (bucket publico `catalogo`, getPublicUrl). getCatalogoItems + updateCatalogoItem
  ampliados con descripcionLarga / colores / fichaTecnica / frenteCm / profundidadCm
  / altoCm. NO toca el mapeo de precio_alquiler / tipo_receta / es_cotizable /
  snapshot_* (siguen para Costos).
- index.html: bump catalogo.js?v=6
- Requiere sql/catalogo_showroom_f1.sql corrido (SQL-first, GATE de Fede).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"

# F2 — showroom
git add catalogo.js index.html
git commit -m "$(cat <<'EOF'
feat(catalogo): F2 showroom — galeria de cards + ficha full-screen del item

- catalogo.js reescrito: grid con foto principal (fallback placeholder onerror),
  search accent-insensitive + filtros rubro/categoria, ficha con galeria/lightbox,
  atributos ricos, medidas, ficha tecnica, colores chips y precio READ-ONLY.
- venta/pm read-only (Data.isReadOnly), admin/superadmin escriben.
- index.html: bump catalogo.js?v=7

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"

# F3 — edición rica
git add catalogo.js index.html
git commit -m "$(cat <<'EOF'
feat(catalogo): F3 edicion rica + manejo de fotos (orden/portada/borrado)

- Edicion de descripcion_larga, colores (chips), ficha_tecnica (label/valor), medidas.
- Drag-drop/file input con compresion canvas (~0.85, <=10 MB) -> uploadCatalogoFoto;
  reordenar galeria, marcar portada (1 sola), soft delete con promocion de la
  siguiente portada por orden. Control de subida deshabilitado mientras sube.
- Cero inputs de precio/receta/snapshot/es_cotizable (contrato Costos intacto).
- index.html: bump catalogo.js?v=8

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"

# F4 — PDF propuesta
git add catalogo.js index.html
git commit -m "$(cat <<'EOF'
feat(catalogo): F4 export propuesta PDF branded (jsPDF + autotable)

- "Generar propuesta": seleccion de items -> PDF A4 MEPEX con logo cacheado,
  foto principal por item (try-catch + fallback a texto), datos y precio,
  footer paginado. Branding turquesa [0,169,193].
- index.html: bump catalogo.js?v=9

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### 9.3 — Checklist final de aceptación (end-to-end, en prod, con cleanup)

Marcar cada ítem solo tras **verificarlo en prod** (no alcanza F12 + visual). Crear data de prueba, verificar contra la DB real, y **limpiar**.

**Backbone (F1)**
- [ ] `sql/catalogo_showroom_f1.sql` corrido: las 6 columnas existen en `catalogo_items` y `catalogo_item_fotos` existe (queries del pie del .sql).
- [ ] Bucket `catalogo` existe y `public=true` (`SELECT id,public FROM storage.buckets WHERE id='catalogo'`).
- [ ] `uploadCatalogoFoto` sube un blob real → objeto en el bucket + `getPublicUrl` devuelve URL que abre en el navegador (200, imagen visible).
- [ ] `addCatalogoFoto` inserta fila con `url` / `storage_path` / `orden` / `item_id` correctos; con `esPrincipal:true` deja **1 sola** portada por item.
- [ ] `updateCatalogoItem` persiste `descripcion_larga` / `colores` / `ficha_tecnica` / medidas **SIN** alterar `precio_alquiler` / `tipo_receta` / `snapshot_*` / `es_cotizable` (capturar esas columnas del item de prueba ANTES y DESPUÉS: idénticas).

**Showroom (F2)**
- [ ] Grid renderiza cards con foto principal; items sin foto → placeholder (no `<img>` roto, validar con `onerror`).
- [ ] Search accent-insensitive (`normStr`) + filtros rubro/categoría funcionan.
- [ ] Ficha full-screen: galería/lightbox, atributos ricos, medidas, ficha técnica (vacía sin romper si `ficha_tecnica` es `[]`/null), colores chips (vacío si null), precio **read-only** (sin input editable).
- [ ] Como `venta`/`pm`: NO aparecen controles de edición/borrado.
- [ ] Como `admin`/`superadmin`: aparecen los controles de edición.
- [ ] 0 errores de consola al cargar y navegar.

**Edición (F3)**
- [ ] Editar `descripcion_larga` / colores / ficha_tecnica / medidas → persiste y se refleja en la ficha.
- [ ] Subir foto (drag-drop / file input) → aparece en galería, comprimida (peso razonable); control deshabilitado durante la subida (sin doble-submit).
- [ ] Reordenar galería persiste `orden`; marcar portada actualiza `es_principal` (las otras se desmarcan).
- [ ] Borrar foto = soft delete (`_deleted=true`): deja de mostrarse, la fila queda, **el objeto del bucket NO se borra** (esperado — el app no tiene DELETE en storage).
- [ ] Borrar la portada actual → la siguiente por `orden` queda como portada.
- [ ] **No existe** en toda la UI ningún control que escriba `precio_alquiler` / `tipo_receta` / `margen_*` / `mano_obra_minutos` / `vida_util_armado_override` / `es_cotizable` / `snapshot_*`.

**PDF (F4)**
- [ ] "Generar propuesta" produce un PDF A4 con logo MEPEX, foto principal por item, nombre/código/medidas/precio y footer paginado.
- [ ] Item sin foto o foto que no carga (cortar red) → el PDF se genera igual (fallback a texto, sin throw).
- [ ] El PDF abre sin error y respeta el branding (turquesa `#00A9C1`, fuentes).

**Contrato (no romper)**
- [ ] El **cotizador externo** sigue leyendo `catalogo_items` (`es_cotizable=true`, `precio_alquiler`) sin cambios — ninguna de esas columnas ni la RPC `calcular_receta` fue tocada.
- [ ] El módulo **Costos** sigue OK (abrir Listas de Precio + recalcular una receta + confirmar que `getCatalogoItems` sigue devolviendo los campos de costo que Costos consume — `esCotizable`, `precioAlquiler`, `snapshotCostosAt`, etc.).
- [ ] El RLS de `catalogo_item_fotos` permite leer a anon/authenticated y escribir a authenticated (probar lectura anónima de una foto vía la URL pública).

**Higiene + cleanup**
- [ ] `?v=` de `catalogo.js` bumpeado en `index.html` en cada bloque que tocó el JS (6/7/8/9).
- [ ] `<style>` inyectado 1 sola vez (guard `_stylesInjected`); todo el CSS con prefijo `cat-`.
- [ ] Sin `onclick` inline (salvo `data-modal-close`); todo por `addEventListener`.
- [ ] **Datos de prueba limpiados**, en este orden:
  1. Filas de prueba en `catalogo_item_fotos`: `UPDATE ... SET _deleted=true` o `DELETE` directo (sesión admin) de las filas sembradas.
  2. **Objetos del bucket de prueba**: `supabaseClient.storage.from('catalogo').remove([path1, path2, ...])` con sesión admin/superadmin (el app no lo hace en soft delete — hay que borrarlos a mano para no dejar basura).
  3. Atributos del item de prueba revertidos a sus valores originales (los que capturaste en el check de F1).
- [ ] CLAUDE.md §10 actualizado con el estado del módulo al cierre.

---

### 9.4 — PROMPT DE ARRANQUE (paste-ready para Claude Code)

> Pegar tal cual en una instancia nueva de Claude Code, en la carpeta del repo. Autosuficiente: el agente lee este doc completo y lo ejecuta de punta a punta.

```
Sos Claude Code trabajando en LOBBY-MEPEX, una SPA interna de gestion.
Carpeta: C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX
Stack: Vanilla JS (ES6+), SPA con hash routing, Supabase (DB + Auth + Storage),
deploy estatico sin build step. Branch: rediseno -> se pushea directo a main
(git push origin HEAD:main). Fede pullea en el VPS con pull-lobby.sh.
Dark theme MEPEX SIEMPRE (bg #050505, card #111111, primary turquesa #00A9C1,
accent naranja #F28D15, COMERCIAL=#F28D15; fuentes Outfit + Space Mono; moneda $ es-AR).

ARRANQUE: preguntale a Fede si hago `git fetch origin && git reset --hard origin/main`
antes de empezar (puede haber sesiones paralelas). Esperá la respuesta.

TAREA: construir el CATALOGO SHOWROOM — elevar el modulo `catalogo.js` (hoy vitrina
vieja: tabla simple, ruta #catalogo ya registrada en router.js:83 como
CatalogoModule.render(), module:'catalogo', categoria COMERCIAL) a un showroom
online que es la FUENTE DE VERDAD de los items comerciales. Consumidores: el
cotizador externo (app Vercel, YA lee catalogo_items, NO se toca, es consumer) y
un futuro generador de propuestas. El modulo YA existe y esta ruteado: solo se
REESCRIBE catalogo.js y se AMPLIA api.js. No crear ruta ni grant de permiso nuevo.

DOCUMENTO MAESTRO: lee COMPLETO el doc de diseno one-shot del catalogo showroom
(en docs/, el del GROUND TRUTH con codigo real verificado + fases F1->F4 + farmeo).
Es ONE-SHOT-able. Construi TODO de una, en el ORDEN de la seccion 9.1, sin preguntar
salvo: (a) el GATE del SQL (BLOQUE 0), y (b) si algo del doc contradice el codigo
real del repo (verificalo y avisá, NO improvises).

ESTADO REAL DEL REPO (verificado 2026-06-22, usar EXACTO):
- catalogo.js esta en index.html como catalogo.js?v=5 -> los bumps son F1=v6, F2=v7,
  F3=v8, F4=v9.
- sql/catalogo_showroom_f1.sql YA EXISTE y esta commiteado (idempotente). NO lo
  reescribas. Lo corre FEDE en el SQL Editor ANTES de que pushees JS.
- api.js NO tiene aun: getCatalogoFotos / addCatalogoFoto / uploadCatalogoFoto /
  setCatalogoFotoPrincipal / reorderCatalogoFotos / deleteCatalogoFoto, NI el mapeo
  de los atributos ricos (descripcionLarga/colores/fichaTecnica/medidas) en
  updateCatalogoItem/getCatalogoItems. Hay que CREARLOS. updateCatalogoItem SI mapea
  ya precio_alquiler/tipo_receta/es_cotizable/snapshot_* (son de Costos): NO los
  toques ni los quites; el showroom simplemente NUNCA debe pasar esas keys.
- catalogo_items.id es BIGINT -> parseInt al leer de data- attributes.
- catalogo_item_fotos.id es BIGINT GENERATED ALWAYS AS IDENTITY.

GLOBALS REALES (usar EXACTO, PROHIBIDO inventar metodos/columnas/APIs):
- supabaseClient (global directo: supabaseClient.from(...),
  supabaseClient.storage.from('catalogo').upload(...)/.getPublicUrl(...)/.remove([...]))
- API.* (api.js; helpers API._uid() / API._today() / API.clearCache())
- Auth.getUser() -> {uid, role, name, ...}; Auth.isAdminLevel()/.isSuperAdmin()
- Data.isReadOnly(role, 'catalogo')  <- gating de escritura
- Router.navigate(hash); Toast.success/error/warning/info(msg)
- Modal.open({title,body,size,footer}) [footer con data-modal-close autocierra];
  Modal.confirm({...}); Confirm.action(title,msg)/Confirm.delete(nombre) -> Promise<bool>
- FormBuilder; window.escHtml/escAttr/normStr
- UndoHelpers.createRecord/updateRecord/deleteRecord (updateCatalogoItem ya los usa)
- jsPDF global (window.jspdf) + autotable (ya se usa en costos.js y remito-pdf.js)
- _downscaleImage(file, maxDim, quality) -> patron de crm.js para comprimir antes
  de subir (canvas -> JPEG ~0.85). getPublicUrl es la API estandar del SDK Supabase
  (contraparte publica de createSignedUrl); no hay precedente en el repo pero es correcta.

REGLAS DURAS (no negociables):
1. SQL-FIRST. NO pushees JS hasta que Fede confirme "SQL corrido OK". El .sql ya
   existe y es idempotente: NO lo reescribas (regla 12: schema real > SQL del repo).
2. NO ROMPER COSTEO NI EL COTIZADOR. precio_alquiler / tipo_receta / es_cotizable /
   snapshot_* / margen_* / mano_obra_minutos / vida_util_armado_override / costo_*
   son INTOCABLES desde el showroom (READ-ONLY). El precio sale de la RPC
   calcular_receta via Costos. El showroom solo edita vitrina: nombre, codigo, rubro,
   categoria, descripcion, descripcion_larga, colores, ficha_tecnica, medidas, fotos.
   NO agregues inputs de precio/receta en la UI.
3. STORAGE: fotos al bucket PUBLICO `catalogo` con getPublicUrl. NO hotlinkear de
   Drive en runtime. Soft delete de la foto = UPDATE _deleted=true (NO borra el objeto
   del bucket: el app no tiene DELETE en storage salvo admin). Drive es solo fuente
   de origen para el farmeo en lote (lo corres vos como migracion puntual, NO la app).
4. PERMISOS: admin/superadmin escriben; venta/pm read-only (Data.isReadOnly). Gatear
   TODOS los controles de edicion/borrado.
5. CSS con prefijo cat-; <style> inyectado 1 sola vez con guard _stylesInjected.
6. addEventListener siempre (nunca onclick inline salvo data-modal-close).
7. Soft delete: _deleted + filtrar .eq('_deleted', false) en TODAS las lecturas.
8. Bump ?v= de catalogo.js en index.html CADA vez que toques el .js (6/7/8/9).
9. Verificacion END-TO-END en prod con cleanup (no alcanza F12 + visual): crea data
   de prueba, verifica contra la DB real, y LIMPIA — incluido borrar a mano los
   objetos de prueba del bucket con storage.from('catalogo').remove([...]) (sesion
   admin), porque el soft delete NO los borra.
10. Bisturi: cambios quirurgicos, no rompas lo que funciona.

ENTREGABLES POR BLOQUE (seccion 9.1): F1 (api.js + subida real, ?v=6) ->
F2 (showroom galeria + ficha, ?v=7) -> F3 (edicion rica + fotos, ?v=8) ->
F4 (PDF propuesta, ?v=9) -> farmeo (one-off, NO se enchufa a la app). Un commit por
bloque con el mensaje de la seccion 9.2 (feat(catalogo): ...), terminando con
"Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>".

AL CIERRE: corre el checklist de aceptacion de la seccion 9.3 y actualiza CLAUDE.md §10.

EMPEZA: confirma el plan de los 6 bloques en una linea, hace el pull si Fede dijo que
si, y arranca por F1. Para SOLO en el GATE del SQL (BLOQUE 0) y si encontras una
contradiccion real entre el doc y el codigo del repo.
```

---

### 9.5 — Notas de integración (para el agente que ejecute)

- **El módulo ya existe y está ruteado** (`router.js:83`: `#catalogo` → `CatalogoModule.render()`, `module:'catalogo'`, categoría COMERCIAL). No hay que crear ruta nueva ni grant: `catalogo` ya es un permiso existente (superadmin/admin/venta/pm). Solo se **reescribe** `catalogo.js` y se **amplía** `api.js`.
- **`catalogo_items.id` es BIGINT** — usar `parseInt` al leer de `data-` attributes (como hace el toggle `es_cotizable` en costos.js). `catalogo_item_fotos.id` también es BIGINT IDENTITY.
- **El campo legacy `item.foto`** que la vitrina vieja leía NO existe como columna persistida → ignorarlo. La fuente de fotos pasa a ser `catalogo_item_fotos` (principal = `es_principal=true`, o la de menor `orden`).
- **`updateCatalogoItem` ya mapea precio/receta/snapshots/esCotizable** (api.js:1705-1763) porque lo usa Costos. **NO removas esos mapeos** y **NO pases esas keys desde el showroom.** La ampliación de F1 es puramente aditiva (los 6 campos nuevos). Idem `getCatalogoItems` en su mapeo de lectura.
- **Cache de 60s**: `getCatalogoItems` usa el `_cache` de api.js (key `'catalogo_items'`). Tras cualquier `updateCatalogoItem`/CRUD de foto, la propia función llama `clearCache()`, pero la galería de fotos conviene leerla **sin cache** (query directa a `catalogo_item_fotos`) para reflejar reordenamientos/portada al instante. Si usás `clearCache()`, recordá que borra TODO el cache (full clear, no granular).
- **Compresión de fotos**: reusar `_downscaleImage(file, maxDim≈1600, quality≈0.85)` de crm.js (canvas → JPEG) antes de `uploadCatalogoFoto`. Validar `<= 10 MB` (límite del bucket) como red de seguridad; si excede tras comprimir, `Toast.warning` y abortar.
- **Storage — el objeto NO se borra en soft delete.** La policy `catalogo_delete` solo permite hard-delete a admin/superadmin, y el app marca `_deleted=true` en la fila sin tocar el bucket. Consecuencia 1: el cleanup de prueba debe borrar los objetos a mano (`storage.from('catalogo').remove([...])`, 9.3). Consecuencia 2: con el tiempo se acumulan huérfanos — un GC de objetos sin fila viva queda como tarea futura, **fuera de alcance**.
- **getPublicUrl** es síncrono y NO falla por red (solo arma la URL); la falla real ocurre en `.upload(...)` (que sí devuelve `{error}`) — lanzar/abortar ahí, no en getPublicUrl.
- **PDF**: reusar el patrón de logo cacheado (`_loadLogoForPDF`, JPEG 0.88) y el `didDrawPage` de footer paginado de costos.js. Branding turquesa `[0,169,193]`, header con línea separadora, autotable con `headStyles.fillColor` turquesa. Chequear `typeof window.jspdf !== 'undefined'` y `typeof doc.autoTable === 'function'` con `Toast.error` de fallback.
- **Edge cases a cubrir**: item sin fotos (placeholder, no `<img>` roto → `onerror`); `ficha_tecnica` vacío/null/malformado (default `[]`, no romper el render); `colores` null (chips vacíos); error de red en `uploadCatalogoFoto` (Toast.error + re-habilitar el control); foto que no carga en el PDF (try-catch + fallback a solo texto); borrado de la única portada (promover la siguiente por `orden`, o ninguna si era la última); doble click rápido en subir (deshabilitar el control mientras sube); foto >10 MB tras comprimir (warning + abortar); concurrencia de portada (el `setCatalogoFotoPrincipal` hace UPDATE-all-false → UPDATE-one-true: aceptable para 1 usuario, sin transacción atómica — no es crítico en equipo chico).

---

# Apéndice A — Auto-crítica de completitud

> Informe del reviewer global (las P0/P1 ya están resueltas en §00; queda acá como trazabilidad).

All claims confirmed against real code. The §7.0 collision is real and devastating (today `catalogo.js:571/639/672` call `API.create/update/deleteCatalogoItem` which resolve to the `evento_costo_catalogo` versions — the catalog's own writes go to the wrong table). The rendimiento call-sites (743/789/790) are exactly as the spec says. I have enough to deliver the critique.

---

# Crítica de completitud — Catálogo Showroom spec

Verifiqué contra el código real (`api.js`, `catalogo.js`, `rendimiento.js`, `index.html`, `sql/catalogo_showroom_f1.sql` existe). La colisión de §7.0 es **real y confirmada** — es el hallazgo más importante del doc y está bien diagnosticado. Pero el spec **se contradice a sí mismo** en cómo y cuándo arreglarla, lo que rompe el one-shot. Lista priorizada:

---

## P0 — Bloqueantes (sin esto NO es one-shot / rompe en prod)

### P0-1 · La colisión de §7.0 está enterrada en la sección 7, pero F1 (sección 1/9) la necesita PRIMERO. Contradicción de orden fatal.
- **Confirmado:** `api.js` define `createCatalogoItem`/`updateCatalogoItem`/`deleteCatalogoItem` dos veces en el mismo object literal `API` — versión #1 en 1681/1705/1765 (→ `catalogo_items`, con Undo) y versión #2 en 5716/5722/5726 (→ `evento_costo_catalogo`). **Last-key-wins: las #2 ganan.** Hoy `catalogo.js:639` (`API.updateCatalogoItem`) escribe en `evento_costo_catalogo`, NO en `catalogo_items`.
- **El problema del spec:** secciones 1.5.bis, 3.2, 4.4.1, 7.0.b y 9.1 **todas** dicen "agregar los mapeos de campos ricos a `updateCatalogoItem`/`getCatalogoItems`" — pero la única que menciona que la `updateCatalogoItem` viva es la equivocada está en §7.0/§7.0.b. El plan de fases (§9.1) pone F1 primero y §7 al final. **Un agente que siga F1→F4 en orden editará la versión #1 (línea 1705), que está SHADOWED, y nada funcionará** — los campos ricos "se guardan" en código muerto.
- **Fix:** mover el rename de §7.0 a ser el **paso 0 de F1, antes de cualquier otro cambio en `api.js`**, y declararlo explícitamente en §9.1 BLOQUE F1 como sub-paso ordenado ("0. renombrar las dupes de rendimiento; recién entonces las #1 quedan vivas y se les agregan los mapeos"). Toda mención posterior a "editar `updateCatalogoItem`" debe decir literal: "la de línea 1705 (`catalogo_items`), **después** de haber renombrado las dupes de 5716-5728".

### P0-2 · El rename de §7.0 elige el nombre `createRendimientoCatalogoItem`, pero `getRendimientoCatalogo` (5702) ya existe y NO se renombra — inconsistencia de naming + falta verificar que no haya OTRA dupe.
- **Confirmado:** las 3 dupes de rendimiento (5716/5722/5726) son las únicas con esos nombres; `getRendimientoCatalogo` (5702) es la cuarta del bloque y **no colisiona** (nombre único). Los call-sites en `rendimiento.js` son exactamente 743 (`deleteCatalogoItem`), 789 (`updateCatalogoItem`), 790 (`createCatalogoItem`) — coincide con el spec.
- **Riesgo:** el spec da el código del rename correcto pero NO instruye verificar que no haya un cuarto call-site de las dupes en otros archivos. **Antes de renombrar, el agente debe correr `grep -rn "createCatalogoItem\|updateCatalogoItem\|deleteCatalogoItem" *.js`** y confirmar que solo `catalogo.js` (showroom) y `rendimiento.js` (3 sites) los usan. Si apareciera un site adicional (p.ej. en `eventos.js`/`finanzas.js`), el rename rompería ese consumidor silenciosamente.
- **Fix:** agregar ese grep como gate obligatorio del paso 0 de F1.

### P0-3 · `createCatalogoItem` (#1, línea 1681) NO mapea los campos ricos NI `disponiblePublico`/`favorito` — el spec asume que alta+edición rica funcionan, pero el alta nueva nace sin esos campos.
- **Confirmado:** `createCatalogoItem` (1683-1695) solo mapea nombre/codigo/rubro/categoria/descripcion/origen/unidad/costo_produccion/precio_cliente/nivel/familia. Ni los 6 ricos ni `disponible_publico`/`favorito`.
- **El spec lo menciona de pasada** ("si F3 quiere crear con ficha rica, extender create") pero NO lo pone en el checklist de F1 ni da el código. Como la ficha rica se edita post-creación vía update, **no es estrictamente bloqueante** — pero §3.4 del shell tiene "Nuevo item" y §8.2.0 crea el item de prueba con `createCatalogoItem`; si el test o el flujo real esperan que el alta cargue algún rico, falla silencioso.
- **Fix:** decidir explícito — o (a) documentar que el alta crea "vacío" y los ricos se cargan en la ficha (status quo, aceptable), y que el test de §8 NO debe verificar ricos vía create; o (b) extender `createCatalogoItem` con el mismo patrón aditivo. Elegir (a) y dejarlo escrito para que el agente no se confunda.

### P0-4 · `getCatalogoItems` cachea 60s y el spec da instrucciones contradictorias sobre lectura de fotos.
- **Confirmado:** `getCatalogoItems` usa `_cache` con `_cacheTimeout` (línea 1622-1624, 1673). `updateCatalogoItem`/`createCatalogoItem`/`deleteCatalogoItem` llaman `this.clearCache()` (full clear).
- **Contradicción interna:** §2.2 dice "`listFotos` no usa cache". §3.2 define `getCatalogoFotos`/`getCatalogoPortadas` también sin cache. §7.0.b repite. Pero §3.3 `_loadData` carga `getCatalogoPortadas(this._items.map(i=>i.id))` — y `_items` viene de `getCatalogoItems` que SÍ cachea. Tras subir una foto a un item recién creado, el `_items` puede estar cacheado viejo y no incluir el item. Coherente mientras se llame `clearCache()` + `await getCatalogoItems()` tras cada write — **pero el spec nunca dice explícitamente "tras subir/borrar foto, NO hace falta clearCache de items (las fotos son tabla aparte), pero tras crear/editar item SÍ recargar `_items`"**.
- **Fix:** una nota única y central: "fotos = query directa siempre fresca; items = cache 60s, recargar `_items` solo tras CRUD de `catalogo_items`, no tras CRUD de fotos".

---

## P1 — Importantes (degradan calidad / probable bug, no bloquean el build)

### P1-1 · Nombres de método de fotos INCONSISTENTES entre secciones. El agente no sabe cuál es el canónico.
- §2 usa: `listFotos`, `createFoto`, `updateFoto`, `softDeleteFoto`, `setFotoPrincipal`, `removeFotoStorage`, `uploadCatalogoFoto`, `reorderFotos`, `deleteFoto`, `updateFotoAlt`.
- §3.2 usa: `getCatalogoFotos`, `getCatalogoPortadas`.
- §4.4.2 usa: `getCatalogoFotos`, `uploadCatalogoFoto`, `createCatalogoFoto`, `updateCatalogoFoto`, `setCatalogoFotoPrincipal`, `reorderCatalogoFotos`, `deleteCatalogoFoto`.
- §7.0.b usa: `getCatalogoFotos`, `uploadCatalogoFoto`, `addCatalogoFoto`, `setCatalogoFotoPrincipal`, `reorderCatalogoFotos`, `deleteCatalogoFoto`.
- §9.1 usa: `getCatalogoFotos`, `uploadCatalogoFoto`, `addCatalogoFoto`, `setCatalogoFotoPrincipal`, `reorderCatalogoFotos`, `deleteCatalogoFoto`.
- **Mismo concepto, 3-4 nombres distintos** (`listFotos`/`getCatalogoFotos`, `createFoto`/`createCatalogoFoto`/`addCatalogoFoto`, `softDeleteFoto`/`deleteFoto`/`deleteCatalogoFoto`, `updateFotoAlt`/`updateCatalogoFoto`). Un one-shot agent que copie de §2 y luego de §4 termina con métodos duplicados o llamadas a métodos inexistentes.
- **Fix:** una tabla de contrato ÚNICA y normativa al inicio (la de §2.10 es buena candidata) con los nombres definitivos, y nota en cada sección "los nombres canónicos son los de §2.10; si una sección de abajo usa otro, prevalece §2.10". Sugiero el set de §7.0.b/§9.1 (`getCatalogoFotos`, `uploadCatalogoFoto`, `addCatalogoFoto`, `setCatalogoFotoPrincipal`, `reorderCatalogoFotos`, `deleteCatalogoFoto`) porque es el más repetido.

### P1-2 · `getCatalogoFotos` con dos firmas/ordenamientos distintos según la sección.
- §3.2: ordena `es_principal DESC, orden ASC, id ASC` y selecciona columnas explícitas.
- §4.4.2: ordena `orden ASC, id ASC` (sin es_principal primero), `select('*')`.
- §2.2 `listFotos`: `orden ASC, id ASC`.
- El orden importa para `getCatalogoPortadas` ("la primera por item gana") y para la galería. Inconsistente → portada puede salir distinta según qué versión del método quedó.
- **Fix:** fijar un único orden canónico (`es_principal DESC, orden ASC, id ASC`) y usarlo en TODAS las lecturas de fotos.

### P1-3 · `?v=` de F1: el spec dice bumpear 3 archivos (api/rendimiento/catalogo) pero la numeración real difiere de lo escrito.
- **Confirmado en `index.html`:** `api.js?v=52`, `catalogo.js?v=5`, `rendimiento.js?v=4`.
- §7.1 dice `api.js?v=52→53`, `rendimiento.js?v=4→5`, `catalogo.js?v=5→6`. **Correcto.**
- Pero §3.13 dice `catalogo.js?v=2` (inventado), §9.1 dice catalogo 5→6→7→8→9 (correcto). §3.13 contradice. Y §9.4 (el prompt) dice "F1=v6...v9" sin mencionar el bump de `api.js?v=53` ni `rendimiento.js?v=5` en F1.
- **Fix:** borrar el `?v=2` de §3.13. En el prompt §9.4 agregar: "F1 también bumpea `api.js` (52→53) y `rendimiento.js` (4→5) por el rename + métodos nuevos". Recordar la regla del propio doc: leer el valor real antes de bumpear (puede haber cambiado por sesión paralela).

### P1-4 · F2 vs F3: dos modelos de "ficha + edición" incompatibles. El agente no sabe cuál implementar.
- §3 (F2) implementa la ficha con `_renderFicha`/`_renderFichaView` y un botón "Editar" que abre `_openEditModal` (modal). El estado es `_fichaItemId`/`_fichaFotos`/`_fichaActiveIdx`.
- §4 (F3) reemplaza eso por edición **inline en la ficha** con `_fichaEditMode`, `_editDraft`, `_rerenderFicha`/`_renderFichaEdit`, y dice explícitamente "NO modal". Además §4.9 depende de que F2 exponga `_rerenderFicha()`/`_renderFichaView()` — **que §3 NO define con esos nombres** (§3 usa `_renderFicha`).
- **Contradicción de contrato:** §4 lista "DEPENDENCIAS que F2 debe exponer: `_rerenderFicha()`, `_renderFichaView()`" pero §3 nunca las crea. Un agente que construya F2 según §3 y luego F3 según §4 encuentra los hooks faltantes.
- **Fix:** alinear. O (a) §3 debe nombrar su render `_renderFichaView` y proveer `_rerenderFicha` desde el arranque (aunque F2 no edite), o (b) §4 debe decir "renombrar el `_renderFicha` de F2 a `_renderFichaView` y agregar `_rerenderFicha`". Y decidir UNA: el botón "Editar" de F2 abre modal (§3) o entra a modo inline (§4) — no ambos. Dado que F3 es la versión final, F2 debería construir ya los hooks de F3.

### P1-5 · `Modal.close()` sin id: el spec dice arreglarlo pero el código actual de `catalogo.js` lo tiene en 2 sitios y el spec solo parcha el camino de F2.
- **Confirmado:** `catalogo.js:574` y `:642` usan `Modal.close()` sin args. §3.11 dice reemplazar por `Modal.closeAll()` en create y edit — correcto. Pero §4.8 (`_editFotoAlt`) usa `Modal.close(inst.id)` (con id, correcto). Coherente, pero el agente debe entender que **el bug viejo está en el código que se está reescribiendo**, no introducirlo de nuevo.
- **Fix:** menor — ya cubierto, solo asegurar que la reescritura de F2 no copie los `Modal.close()` viejos.

### P1-6 · §6 (farmeo) asume `match por codigo` único, pero el doc nunca verifica que los items reales tengan `codigo` poblado/único; y el `safeFilename` cambia el `storage_path`, rompiendo la idempotencia entre MCP y Node.
- §6.3.b `safeFilename` sanitiza el nombre → `storage_path = item_<id>/<safeFilename>`. El chequeo de idempotencia `fotoYaExiste(itemId, storagePath)` usa el path sanitizado. **OK si ambos caminos (MCP §6.3 y Node §6.5) usan el mismo `safeFilename`** — y lo hacen. Pero el path del §2.5/§4.4.2 (`uploadCatalogoFoto` de la app) usa `Date.now()` → distinto esquema. **No colisiona** (la app y el farmeo nunca comparten path), pero el spec debería notar que el farmeo y la subida manual generan paths con convenciones distintas (farmeo = nombre legible, app = timestamp) — está bien, solo documentarlo para que nadie "unifique" y rompa idempotencia.
- **Fix:** nota menor en §6: "el farmeo usa nombre-de-archivo como path (idempotencia por nombre); la subida de la app usa timestamp (sin colisión posible). No unificar."

---

## P2 — Nice (pulido, no afecta correctitud)

### P2-1 · §3.13 número de versión fantasma (`?v=2`) — ya cubierto en P1-3, borrarlo.

### P2-2 · `getPublicUrl` sin precedente en el repo: el spec lo dice honestamente (§7.0.b), pero podría agregar un micro-test de humo (subir 1 byte → getPublicUrl → fetch 200) en el §8.0 para descartar de entrada que el bucket no quedó público. §8.A ya lo cubre tarde; adelantarlo a §8.0 ahorra una fase entera si el SQL del bucket falló.

### P2-3 · `colores`/`ficha_tecnica` default: §1 dice `ficha_tecnica jsonb DEFAULT '[]'` pero `colores text[]` SIN default (→ null). El mapeo de lectura normaliza a `[]`, bien. Pero §1.5.bis write hace `payload.colores = arr.length ? arr : null` mientras §4.4.1(b) hace `Array.isArray(data.colores) ? data.colores : []`. Uno guarda `null`, otro `[]`. Inconsistencia cosmética (ambos se leen como `[]`), pero elegir uno evita confusión. Sugiero `null` cuando vacío (consistente con "columna sin default").

### P2-4 · El prompt §9.4 no menciona el rename de §7.0 explícitamente como paso 0 de F1 (relacionado con P0-1). Agregar al prompt: "F1 ARRANCA renombrando las 3 dupes `create/update/deleteCatalogoItem` de api.js:5716-5728 a `*RendimientoCatalogoItem` y actualizando rendimiento.js:743/789/790, ANTES de tocar nada más; sin eso el showroom escribe en la tabla equivocada."

---

## Veredicto

El spec es **muy fuerte en código copy-paste-grade y en el contrato con costeo/cotizador/RLS** (esa parte no rompe nada: el showroom solo manda whitelist de vitrina, las dupes de rendimiento van a otra tabla, RLS es espejo). Pero **NO es one-shot todavía** por dos razones estructurales:

1. **P0-1 + P0-2** — el fix de la colisión está físicamente al final del doc (§7) pero es prerequisito del primer cambio de código (F1). Un agente disciplinado que siga el orden de fases edita la `updateCatalogoItem` shadowed y entrega un módulo que "guarda" en código muerto. **Hay que promover el rename a paso 0 explícito de F1 en §9.1 y en el prompt §9.4.**
2. **P1-1 + P1-4** — los nombres de métodos de fotos y el contrato F2↔F3 (`_rerenderFicha`/`_renderFichaView`) divergen entre secciones; copiar de distintas secciones produce métodos duplicados o hooks faltantes.

Arreglando los 4 P0 + P1-1 + P1-4, queda one-shot. El resto es pulido.

---

# Apéndice B — Ground truth (código real verificado)

> Reconocimiento del repo real que groundeó todas las secciones. Referencia; ya destilado arriba.

### GROUND TRUTH — patron
Perfecto. Tengo toda la información necesaria. Ahora voy a armar un brief técnico conciso y completo con file:line references:

## PATRÓN CANÓNICO DE MÓDULO LOBBY-MEPEX — Catalogo Showroom

### LIFECYCLE: render() → Auth Guard → _injectStyles → _buildShell → _loadData → _attachEvents

**crm.js:172-191** Patrón estándar:
```javascript
async render() {
    const user = Auth.getUser();
    if (!user) return Router.navigate('login');  // Auth guard
    
    this._injectStyles();  // _stylesInjected flag + once-only injection (line 4516)
    const content = document.getElementById('mainContent');
    if (!content) return;
    content.innerHTML = this._buildShell();  // HTML + inline styles
    
    await this._loadData();  // Parallel API calls (line 288)
    this._attachEvents();  // All listeners via delegation
}
```

**inventario.js:76-88** Simpler version:
```javascript
async render() {
    const user = Auth.getUser();
    if (!user) return Router.navigate('login');
    
    this._isRO = Data.isReadOnly(user.role, 'inventario');
    const content = document.getElementById('mainContent');
    if (!content) return;
    
    content.innerHTML = this._buildShell();  // HTML + embedded styles
    this._attachEvents();
    await this._renderTabContent();  // Render active tab after events
}
```

**rendimiento.js:38-56** Con localStorage + event selector:
```javascript
async render() {
    const user = Auth.getUser();
    if (!user) return Router.navigate('login');
    
    this._injectStyles();  // Guard _stylesInjected
    const content = document.getElementById('mainContent');
    if (!content) return;
    content.innerHTML = this._buildShell();
    
    this._eventos = await API.getEventosLite();
    const last = localStorage.getItem('mepex_rend_evento');  // Restore UI state
    this._eventoId = last && this._eventos.some(e => e.id === last) ? last : this._eventos[0]?.id;
    
    this._renderEventOptions();
    this._attachShellEvents();
    await this._loadEvento();  // Load data based on selection
}
```

---

### HEADER + BREADCRUMB + TOOLBAR + TABS

**crm.js:203-279** Full structure:
```javascript
_buildShell() {
    const user = Auth.getUser();
    const isReadOnly = user ? Data.isReadOnly(user.role, 'crm') : false;
    
    return `
        <div class="crm-wrapper">
            <!-- Breadcrumb -->
            <div class="crm-header">
                <div class="crm-header-top">
                    <div class="module-breadcrumb">
                        <a href="#lobby" class="breadcrumb-link">🏠 Lobby</a>
                        <span class="breadcrumb-sep">›</span>
                        <span class="breadcrumb-cat" style="color: #F28D15">COMERCIAL</span>
                        <span class="breadcrumb-sep">›</span>
                        <span class="breadcrumb-current">CRM</span>
                    </div>
                </div>
                
                <!-- Title + actions -->
                <div class="crm-header-bottom">
                    <div class="crm-title-row">
                        <span class="crm-title-icon">🔶</span>
                        <h2 class="title-2">CRM</h2>
                        ${isReadOnly ? '<span class="badge badge-ghost">Solo lectura</span>' : ''}
                    </div>
                    <div class="crm-header-actions" id="crmHeaderActions">
                        ${!isReadOnly ? this._renderHeaderActionBtn() : ''}
                    </div>
                </div>
            </div>
            
            <!-- Tabs (5 planas, algunos gateados por rol) -->
            <div class="crm-tabs">
                ${this._visibleTabs().map(t => `
                    <button class="crm-tab ${t.id === this._activeTab ? 'active' : ''}" data-tab="${t.id}">
                        <span class="crm-tab-icon">${t.icon}</span>
                        <span class="crm-tab-label">${t.label}</span>
                        <span class="crm-tab-count" id="crmCount_${t.id}">0</span>
                    </button>
                `).join('')}
            </div>
```

**Guardias por rol (crm.js:441-444)**:
```javascript
_visibleTabs() {
    const isSuper = Auth.isSuperAdmin?.() || false;
    return this._tabs.filter(t => t.id !== 'analitica' || isSuper);  // Analítica solo superadmin
}

_switchTab(tab) {
    if (!this._visibleTabs().some(t => t.id === tab)) {
        tab = 'clientes';  // Reset a default si no tiene perms
    }
    // ...
}
```

**inventario.js:127-157** Tab click handler:
```javascript
document.querySelectorAll('.inv-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        this._activeTab = btn.dataset.tab;
        document.querySelectorAll('.inv-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderTabContent();  // Re-render body
    });
});
```

---

### TOOLBAR + FILTERS + SEARCH

**crm.js:244-265** Clientes tab toolbar:
```html
<div class="crm-toolbar" id="crmToolbar">
    <div class="crm-toolbar-left">
        <div class="crm-search-wrap">
            <svg>...</svg>
            <input type="text" class="crm-search" id="crmSearch" placeholder="Buscar cliente..." />
        </div>
    </div>
    <div class="crm-toolbar-right" id="crmFilters">
        <select class="crm-filter-select" id="crmFilterTipo">
            <option value="">Todos los tipos</option>
            ${this._clientTypes.map(...).join('')}
        </select>
        <!-- 3 filtros: Tipo, Rubro (populated dynamically), Estado -->
    </div>
</div>
```

**crm.js:378-434** Filtering logic:
```javascript
_applyFilters() {
    let filtered = [...this._clients];
    
    // Search (normStr = función global para case-insensitive)
    if (this._searchQuery) {
        const q = normStr(this._searchQuery);
        filtered = filtered.filter(c =>
            normStr(c.name).includes(q) ||
            normStr(c.contactName).includes(q) ||
            normStr(c.email).includes(q) ||
            normStr(c.rubro).includes(q) ||
            normStr(c.tipo).includes(q)
        );
    }
    
    // Filters: Tipo, Rubro, Estado
    if (this._tipoFilter) filtered = filtered.filter(c => c.tipo === this._tipoFilter);
    if (this._rubroFilter) filtered = filtered.filter(c => {
        const rubros = Array.isArray(c.rubro) ? c.rubro : [c.rubro || ''];
        return rubros.includes(this._rubroFilter);
    });
    if (this._estadoFilter) filtered = filtered.filter(c => (c.estado || 'activo') === this._estadoFilter);
    
    // Sort (multicolumna support: name, tipo, rubro, contacto, email, telefono, estado, score, proyectos)
    filtered.sort((a, b) => {
        let va, vb;
        switch (this._sortCol) {
            case 'name': va = a.name || ''; vb = b.name || ''; break;
            // ...más columnas
        }
        if (typeof va === 'number') {
            return this._sortDir === 'asc' ? va - vb : vb - va;
        }
        const cmp = va.localeCompare(vb, 'es');  // Español-aware sort
        return this._sortDir === 'asc' ? cmp : -cmp;
    });
    
    this._filteredClients = filtered;
}
```

**Eventos attachados (crm.js en _attachEvents)**:
```javascript
document.getElementById('crmSearch')?.addEventListener('input', (e) => {
    this._searchQuery = e.target.value;
    this._applyFilters();
    this._renderTabContent();
});
document.getElementById('crmFilterTipo')?.addEventListener('change', (e) => {
    this._tipoFilter = e.target.value || null;
    this._applyFilters();
    this._renderTabContent();
});
// Idem para rubro y estado
```

---

### FICHA FULL-SCREEN (Cliente + Caso)

**crm.js:4371-4377** Abrir ficha de cliente (reemplaza tabla):
```javascript
async _openCliente(id) {
    this._clienteActivoId = id;
    this._clienteContactos = await API.getCrmContactos(id);  // Carga async
    const tb = document.getElementById('crmToolbar');
    if (tb) tb.style.display = 'none';  // Hide toolbar
    this._closePanel();
    if (this._activeTab !== 'clientes') this._activeTab = 'clientes';
    this._renderTabContent();  // Re-render → llamará a _renderClienteFicha() si _clienteActivoId está seteado
}
```

**crm.js:4398-4468** Renderizar ficha cliente full-screen:
```javascript
_renderClienteFicha() {
    const c = this._clients.find(x => x.id === this._clienteActivoId);
    if (!c) { this._clienteActivoId = null; return this._renderClientesTable(); }  // Fallback
    
    const casos = this._casos.filter(k => k.clienteId === c.id);  // Related data
    const cots = this._cotizaciones.filter(q => q.clienteId === c.id || (q.clienteNombre && q.clienteNombre.toLowerCase() === c.name.toLowerCase()));
    
    return `<div class="caso-ficha">  <!-- Reutiliza CSS de CASO, estructura flex -->
        <div class="caso-ficha-main">
            <div class="caso-ficha-header">
                <button class="caso-back" id="cliBack">← Clientes</button>  <!-- Back button -->
                <div class="caso-head-row">
                    <h2 class="caso-titulo">${this._escHtml(c.name)}</h2>
                    <div class="caso-head-actions">
                        ${!isReadOnly ? `<button class="caso-conv-btn" id="cliNuevoCaso">+ Nuevo caso</button>` : ''}
                        ${!isReadOnly ? `<button class="caso-icon-btn" id="cliEdit" title="Editar cliente">✏️</button>` : ''}
                    </div>
                </div>
                <div class="caso-head-meta">
                    ${typeCfg ? `<span class="caso-meta-chip" style="color:${typeCfg.color}">${c.tipo}</span>` : ''}
                    <!-- Estado, rubro, contador de casos activos -->
                </div>
            </div>
            <div class="caso-timeline" id="cliCasos">
                <div class="tl-date">Casos (${casos.length})</div>
                <div class="casos-list">
                    ${casos.map(k => `<div class="caso-row" data-caso-id="${k.id}">
                        <div class="caso-row-temp">${t ? t.icon : '•'}</div>
                        <div class="caso-row-main">...</div>
                        <div class="caso-row-right">$${k.montoEstimado}...</div>
                    </div>`).join('')}
                </div>
            </div>
        </div>
        <aside class="caso-ficha-aside">  <!-- Sidebar 300px, scrollable -->
            <div class="aside-block">
                <div class="aside-title">Contacto</div>
                <div class="aside-row"><span class="aside-k">Persona</span><span class="aside-v">${c.contactName}</span></div>
                <div class="aside-row"><span class="aside-k">Tel</span><span class="aside-v"><a href="https://wa.me/...">...</a></span></div>
                <!-- Email, CUIT, razón social -->
            </div>
            <div class="aside-block">
                <div class="aside-title">Personas de contacto (${contactos.length})</div>
                ${contactosHtml}
            </div>
            <div class="aside-block">
                <div class="aside-title">Cotizaciones (${cots.length})</div>
                ${cotsHtml}
            </div>
            <div class="aside-block">
                <div class="aside-title">Proyectos (${projs.length})</div>
                ${projsHtml}
            </div>
        </aside>
    </div>`;
}

_attachClienteFichaEvents() {
    const back = document.getElementById('cliBack');
    if (back) back.addEventListener('click', () => this._closeCliente());
    
    const edit = document.getElementById('cliEdit');
    if (edit) edit.addEventListener('click', () => {
        const c = this._clients.find(x => x.id === this._clienteActivoId);
        if (c) this._openEditModal(c);
    });
    
    document.querySelectorAll('#cliCasos [data-caso-id]').forEach(el =>
        el.addEventListener('click', () => this._gotoCaso(el.dataset.casoId)));
}

_closeCliente() {
    this._clienteActivoId = null;
    const tb = document.getElementById('crmToolbar');
    if (tb) tb.style.display = '';  // Show toolbar again
    this._renderTabContent();  // Back to table
}
```

**CSS (crm.js:6580-6582)**:
```css
.caso-ficha { display: flex; gap: 18px; height: 100%; overflow: hidden; }
.caso-ficha-main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.caso-ficha-aside { width: 300px; flex-shrink: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
```

---

### PANEL LATERAL CRUD (inventario.js: _openPanel / _closePanel)

**inventario.js:1410-1459** Abrir panel:
```javascript
async _openPanel(item, type) {  // type: 'pieza' | 'material'
    this._activePanel = item.id;
    this._activePanelData = item;
    this._activePanelType = type;
    
    const panelId = type === 'pieza' ? 'invPiezasPanel' : 'invMatPanel';
    const innerId = type === 'pieza' ? 'invPiezasPanelInner' : 'invMatPanelInner';
    const panel = document.getElementById(panelId);
    const inner = document.getElementById(innerId);
    if (!panel || !inner) return;
    
    // Build content (header + sections + async data)
    inner.innerHTML = this._buildPiezaPanelHTML(item, v, accentColor);
    panel.classList.add('open');  // CSS: transform: translateX(0)
    
    // Highlight row
    document.querySelectorAll('.inv-row').forEach(r => r.classList.remove('active'));
    const activeRow = document.querySelector(`.inv-row[data-id="${item.id}"][data-type="${type}"]`);
    if (activeRow) activeRow.classList.add('active');
    
    // Close button + ESC key handler
    const closeBtn = panel.querySelector('.inv-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this._closePanel());
    
    if (this._panelEscHandler) document.removeEventListener('keydown', this._panelEscHandler);
    this._panelEscHandler = (e) => {
        if (e.key === 'Escape') this._closePanel();
    };
    document.addEventListener('keydown', this._panelEscHandler);
    
    // Load async data (stock por locación + historial)
    await this._loadPanelAsyncData(item, type, inner);
}
```

**inventario.js:3096-3110** Cerrar panel:
```javascript
_closePanel() {
    const panels = document.querySelectorAll('.inv-side-panel');
    panels.forEach(p => p.classList.remove('open'));
    
    this._activePanel = null;
    this._activePanelData = null;
    this._activePanelType = null;
    
    document.querySelectorAll('.inv-row').forEach(r => r.classList.remove('active'));
    
    if (this._panelEscHandler) {
        document.removeEventListener('keydown', this._panelEscHandler);
        this._panelEscHandler = null;
    }
}
```

**Panel HTML (inventario.js:1478-1515)**:
```javascript
_buildPiezaPanelHTML(item, v, color) {
    const stock = item.stock || 0;
    const badgeCls = stock > 5 ? 'inv-badge-ok' : stock >= 1 ? 'inv-badge-bajo' : 'inv-badge-critico';
    
    return `
        <div class="inv-panel-header">
            <div class="inv-panel-color-bar" style="background: ${color}"></div>
            <button class="inv-panel-close">&times;</button>
            <div class="inv-panel-name" style="color: ${color}">${item.nombre}</div>
            <div class="inv-panel-subtitle">
                ${item.codigo ? `<span class="inv-panel-code">${item.codigo}</span>` : ''}
                ${item.rubro ? `<span class="inv-rubro-badge">...</span>` : ''}
            </div>
        </div>
        
        <div class="inv-panel-section">
            <h3 class="inv-section-title">Información</h3>
            <div class="inv-info-grid">
                ${infoRows.map(r => `
                    <div class="inv-info-row">
                        <span class="inv-info-label">${r.label}</span>
                        <span class="inv-info-value">${r.value}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="inv-panel-section" id="invPanelLocaciones">
            <h3 class="inv-section-title">Stock por locación</h3>
            <div class="inv-panel-empty">Cargando…</div>
        </div>
        
        <div class="inv-panel-section" id="invPanelHistorial">
            <h3 class="inv-section-title">Historial de movimientos</h3>
            <div class="inv-panel-empty">Cargando…</div>
        </div>
        
        <div class="inv-panel-section">
            <button class="inv-panel-btn inv-btn-mov">
                <svg>...</svg> Registrar movimiento
            </button>
        </div>
    `;
}
```

**CSS Panel Lateral (inventario.js:349-364)**:
```css
.inv-side-panel {
    position: absolute;
    top: 0; right: 0; bottom: 0;
    width: 420px;
    max-width: 90vw;
    background: #0a0a0a;
    border-left: 1px solid rgba(255,255,255,0.06);
    transform: translateX(100%);  /* Off-screen */
    transition: transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    z-index: 100;
    overflow-y: auto;
}
.inv-side-panel.open { transform: translateX(0); }  /* Slide in */
```

---

### MODAL CRUD (Add/Edit)

**rendimiento.js:331-450** Patrón Modal CRUD (edit costo):
```javascript
_openLineModal(categoria, costo) {
    const isEdit = !!costo;  // Detectar si es Add o Edit
    const cat = this.CATS.find(c => c.id === categoria);
    
    const inst = Modal.open({
        title: `${isEdit ? 'Editar' : 'Agregar'} ${cat.label.toLowerCase()}`,
        size: 'md',
        body: `
            <div class="rend-form">
                <div class="rend-fg">
                    <label>Ítem del catálogo</label>
                    <select id="rendLineCat">${catOpts}</select>
                </div>
                <div class="rend-fg">
                    <label>Descripción *</label>
                    <input type="text" id="rendLineDesc" value="${this._esc(costo?.descripcion || '')}" />
                </div>
                ${isJornal ? `
                    <div class="rend-fg"><label>Persona</label><select id="rendLinePersona">${personaOpts}</select></div>
                    <div class="rend-form-row">
                        <div class="rend-fg"><label>Fase</label><select id="rendLineFase">${faseOpts}</select></div>
                        <div class="rend-fg"><label>Días</label><input type="number" step="0.5" id="rendLineDias" value="${costo?.dias ?? ''}" /></div>
                        <div class="rend-fg"><label>Tarifa/día</label><input type="number" step="0.01" id="rendLineTarifa" value="${costo?.tarifa ?? ''}" /></div>
                    </div>
                    <div class="rend-hint" id="rendLineMontoHint"></div>
                ` : `
                    <div class="rend-fg"><label>Monto *</label><input type="number" step="0.01" id="rendLineMonto" value="${costo?.monto ?? ''}" /></div>
                `}
            </div>
        `,
        footer: `
            ${isEdit ? '<button class="btn btn-ghost" id="rendLineAnular" style="margin-right:auto;color:var(--color-error)">Anular línea</button>' : ''}
            <button class="btn btn-ghost" data-modal-close>Cancelar</button>
            <button class="btn btn-primary" id="rendLineSave">${isEdit ? 'Guardar' : 'Agregar'}</button>
        `,
    });
    
    // Prefill logic: catálogo → campos
    document.getElementById('rendLineCat')?.addEventListener('change', (e) => {
        const item = this._catalogo.find(c => c.id === e.target.value);
        if (!item) return;
        const descEl = document.getElementById('rendLineDesc');
        if (descEl && !descEl.value) descEl.value = item.nombre;
        if (isJornal) {
            const tEl = document.getElementById('rendLineTarifa');
            if (tEl) { tEl.value = item.tarifa_default || ''; recompute(); }
        } else {
            const mEl = document.getElementById('rendLineMonto');
            if (mEl) mEl.value = item.tarifa_default || '';
        }
    });
    
    // Save handler
    document.getElementById('rendLineSave')?.addEventListener('click', async () => {
        const descripcion = document.getElementById('rendLineDesc')?.value.trim();
        if (!descripcion) { Toast.warning('La descripción es obligatoria'); return; }
        
        const payload = { evento_id: this._eventoId, categoria, descripcion, ... };
        
        try {
            if (isEdit) {
                await API.updateEventoCosto(costo.id, payload);
                Toast.success('Línea actualizada');
            } else {
                await API.createEventoCosto(payload);
                Toast.success('Línea agregada');
            }
            Modal.closeAll();
            await this._loadEvento();  // Reload data
        } catch (err) {
            Toast.error('Error: ' + err.message);
        }
    });
}
```

---

### DRAG & DROP (Pipeline Kanban)

**crm.js:1707-1770** Drag & drop cotizaciones:
```javascript
_attachKanbanEvents() {
    const cards = document.querySelectorAll('.pip-card[draggable]');
    
    // Card drag handlers
    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            this._dragData = { id: card.dataset.id, estado: card.dataset.estado };
            card.classList.add('pip-card-dragging');
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        });
        
        card.addEventListener('dragend', () => {
            card.classList.remove('pip-card-dragging');
            document.querySelectorAll('.pip-col-body').forEach(c => c.classList.remove('pip-col-dragover'));
            this._dragData = null;
        });
    });
    
    // Column drop zones
    document.querySelectorAll('.pip-col-body').forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            col.classList.add('pip-col-dragover');
        });
        
        col.addEventListener('dragleave', (e) => {
            if (e.target === col || !col.contains(e.relatedTarget))
                col.classList.remove('pip-col-dragover');
        });
        
        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.classList.remove('pip-col-dragover');
            
            if (!this._dragData) return;
            const { id, estado: oldEstado } = this._dragData;
            const newEstado = col.dataset.estado;
            
            if (oldEstado === newEstado) return;
            
            try {
                const cot = this._cotizaciones.find(c => c.id === id);
                if (!cot) return;
                
                await API.updateCotizacion(id, { estado: newEstado });
                cot.estado = newEstado;
                
                this._applyPipelineFilters();
                this._renderPipelineTab();  // Re-render pipeline
                Toast.success(`Cotización movida a ${newEstado}`);
            } catch (err) {
                Toast.error('Error: ' + err.message);
                this._renderPipelineTab();
            }
        });
    });
}
```

**Casos pipeline similar (crm.js:3562-3590)**:
```javascript
document.querySelectorAll('.caso-pcard[draggable]').forEach(card => {
    card.addEventListener('dragstart', (e) => {
        this._casoDrag = { id: card.dataset.casoId, estado: card.dataset.estado };
        card.classList.add('dragging');
    });
    
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.caso-pcol-body.drop-over').forEach(z => z.classList.remove('drop-over'));
    });
});

document.querySelectorAll('.caso-pcol-body').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drop-over');
    });
    
    zone.addEventListener('dragleave', () => zone.classList.remove('drop-over'));
    
    zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('drop-over');
        
        if (!this._casoDrag) return;
        const { id, estado: oldEstado } = this._casoDrag;
        const newEstado = zone.dataset.estado;
        
        // Update estado del caso
        const caso = this._casos.find(c => c.id === id);
        if (caso) {
            await API.updateCaso(id, { estado: newEstado });
            caso.estado = newEstado;
            this._renderPipelineTab();
            Toast.success(`Caso movido a ${newEstado}`);
        }
    });
});
```

**CSS Drag states (crm.js:5473, 5500, 6569-6571)**:
```css
.pip-col-dragover {
    background: rgba(242,141,21,0.08);
    outline: 1px dashed rgba(242,141,21,0.4);
    outline-offset: -3px;
}

.pip-card-dragging {
    opacity: 0.45;
}

.caso-pcard[draggable] { cursor: grab; }
.caso-pcard.dragging { opacity: 0.45; }
.caso-pcol-body.drop-over {
    background: rgba(0,169,193,0.08);
    outline: 1px dashed rgba(0,169,193,0.5);
    outline-offset: -3px;
    border-radius: 6px;
}
```

---

### LIGHTBOX + ADJUNTOS (Composer)

**crm.js:177-182** Event listener delegado (render):
```javascript
if (!this._lightboxBound) {
    this._lightboxBound = true;
    document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('.tl-adj');
        if (a && a.dataset.src) {
            e.preventDefault();
            this._openLightbox(a.dataset.src);
        }
    });
}
```

**crm.js:3736-3745** Lightbox render:
```javascript
_openLightbox(src) {
    if (!src) return;
    const ov = document.createElement('div');
    ov.className = 'crm-lightbox';
    ov.innerHTML = `<img src="${src}" alt=""><button class="crm-lightbox-x" aria-label="Cerrar">✕</button>`;
    const esc = (e) => {
        if (e.key === 'Escape') {
            ov.remove();
            document.removeEventListener('keydown', esc);
        }
    };
    ov.addEventListener('click', () => {
        ov.remove();
        document.removeEventListener('keydown', esc);
    });
    document.addEventListener('keydown', esc);
    document.body.appendChild(ov);  // Overlay full-screen
}
```

**CSS Lightbox (crm.js:6634-6636)**:
```css
.crm-lightbox {
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.88);
    display: flex; align-items: center; justify-content: center;
    cursor: zoom-out;
}
.crm-lightbox img {
    max-width: 92vw; max-height: 92vh;
    border-radius: 8px;
    box-shadow: 0 0 40px rgba(0,0,0,0.6);
}
.crm-lightbox-x {
    position: fixed; top: 18px; right: 22px;
    width: 38px; height: 38px; border-radius: 50%;
    background: rgba(255,255,255,0.12);
    color: #fff; border: 1px solid rgba(255,255,255,0.25);
    font-size: 1rem; cursor: pointer;
}
```

**Adjuntos pendientes (crm.js:3848-3856)**:
```javascript
_renderPendingAdjuntos() {
    const wrap = document.getElementById('cmpAdjuntos');
    if (!wrap) return;
    wrap.innerHTML = this._pendingAdjuntos.map((a, i) => `
        <div class="cmp-adj">
            <img src="${a.dataUrl}">
            <button class="cmp-adj-rm" data-idx="${i}">✕</button>
        </div>
    `).join('');
    wrap.querySelectorAll('.cmp-adj-rm').forEach(btn => btn.addEventListener('click', () => {
        this._pendingAdjuntos.splice(parseInt(btn.dataset.idx, 10), 1);
        this._renderPendingAdjuntos();
    }));
}
```

**Paste handling (crm.js approx 3900-3950)** — on paste en textarea, extract images:
```javascript
document.getElementById('cmpText')?.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            const file = item.getAsFile();
            if (file) await this._addImageFile(file);
        }
    }
    this._renderPendingAdjuntos();
});
```

---

### SNIPPETS REUSABLES

**Esc to close handler (generic)**:
```javascript
_escHandler = (e) => {
    if (e.key === 'Escape') {
        if (this._panelEscHandler) document.removeEventListener('keydown', this._panelEscHandler);
        this._panelEscHandler = null;
        this._closePanel();
    }
};
document.addEventListener('keydown', this._escHandler);
```

**Delegated event pattern**:
```javascript
document.getElementById('container').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        // Handle action
    }
});
```

**Async data loading + UI state**:
```javascript
async _loadPanelAsyncData(item, type, inner) {
    const section = inner.querySelector('#sectionId');
    if (!section) return;
    try {
        const { data } = await supabaseClient.from('table').select(...).eq('id', item.id);
        if (data && data.length > 0) {
            section.innerHTML = `<h3>...</h3><table>...${rows}...</table>`;
        } else {
            section.innerHTML = `<h3>...</h3><div class="inv-panel-empty">Sin datos</div>`;
        }
    } catch (e) {
        console.warn('[Module] Error:', e);
        section.innerHTML = `<h3>...</h3><div class="inv-panel-empty">Error al cargar</div>`;
    }
}
```

**Global styles injection (once)**:
```javascript
_injectStyles() {
    if (this._stylesInjected) return;
    this._stylesInjected = true;
    
    const style = document.createElement('style');
    style.id = 'module-styles';
    style.textContent = `
        /* All CSS rules here */
        .selector { ... }
    `;
    document.head.appendChild(style);
}
```

---

## PARA CATALOGO SHOWROOM

**Aplicar patrón:**
1. **render()**: Auth guard → _injectStyles → _buildShell → _loadData → _attachEvents
2. **_buildShell()**: Breadcrumb + Title + Tabs (stands/eventos) + Filters (rubro, categoría) + Toolbar (search, botón nuevo) + Main body + Side panel
3. **_loadData()**: API.getCatalogoItems() → filtros iniciales
4. **Tab switching**: _activeTab → _renderTabContent() (filtra items por audiencia si DB lo permite)
5. **Row click**: _openPanel(item) → panel lateral 420px con header colorado + info grid + acciones (agregar a carro, ver detalles, editar si admin)
6. **Panel close**: ESC key + close button (× en header)
7. **Modal CRUD**: Nuevo item / Editar (admin solo) → Modal.open() con form + save handler → API.createCatalogoItem() / updateCatalogoItem() → reload
8. **Styles**: Inline en _buildShell + _injectStyles() para media queries + animaciones
9. **Events**: Delegación via document.addEventListener + data attributes

**Particularidades Catalogo:**
- Dos tabs (Stands vs Eventos) — filtrar por `audiencia` o `categoria_principal` si existe
- Panel info: nombre + código + rubro + descripción + origen + unidad + precio (read-only desde costos)
- Admin puede crear/editar items (gated por Data.isReadOnly)
- Search + filters (rubro + categoría) → normStr() + Array.filter()
- Sort by nombre (monocolumna es suficiente)
- Lightbox para imágenes si hay `imagen_url` field

---

**Conclusión**: El patrón es altamente estandarizado. Cualquier módulo nuevo sigue: State object → render() (Auth+inject+build+load+attach) → Shell (header+tabs+filters+body+panel) → Tab content renderer → Panel opener/closer → CRUD modals → Event attachment. Reusable snippets: ESC handlers, delegated listeners, async loaders, style injection.

### GROUND TRUTH — catalogo
Perfecto. Ahora tengo toda la información necesaria para hacer el brief técnico. Voy a compilar el resultado:

---

## BRIEF TÉCNICO: MÓDULO CATÁLOGO SHOWROOM (estado actual)

### ESTRUCTURA GENERAL

**Archivo principal**: `catalogo.js` (líneas 1-691)
**API methods**: `api.js` (getCatalogoItems:1621-1679, createCatalogoItem:1681-1703, updateCatalogoItem:1705-1763, deleteCatalogoItem:1765-1774)
**Soft-delete/Undo**: `undo.js` (UndoHelpers:227-405, con deleteRecord soft-delete en 359-396)
**Cache**: `api.js` _cache + _cacheTimeout (60s), clearCache en 2818-2820

---

### STATE ACTUAL (catalogo.js)

| Estado | Línea | Descripción |
|--------|-------|-------------|
| `_items[]` | 13 | Todos los items de BD (sin filtros) |
| `_filteredItems[]` | 14 | Items después de aplicar búsqueda/rubro/categoría |
| `_sortCol`, `_sortDir` | 15-16 | Orden actual de tabla (defecto: 'nombre' ASC) |
| `_searchQuery` | 17 | Buffer de búsqueda texto libre |
| `_rubroFilter`, `_categoriaFilter` | 18-19 | Filtros activos (null = sin filtro) |
| `_activeTab` | 20 | 'stands' \| 'eventos' (HOY INÚTIL: ambos muestran todo) |
| `_activePanel`, `_activePanelData` | 21-22 | Item abierto en panel lateral derecho |

---

### FORM FIELDS (_formFields, catalogo.js:28-36)

Campos editables en CREATE/EDIT modal:
- `nombre` (text, required)
- `codigo` (text, opcional)
- `rubro` (select → 'Equipamiento', 'Iluminación', 'Infraestructura', 'Más servicios', 'Pisos')
- `categoria` (text, opcional)
- `descripcion` (text, opcional)
- `origen` (select → 'Fabricación propia', 'Compra', 'Sub Alquiler')
- `unidad` (select → 'Unidad', 'Metro', 'm²', 'Kit', 'Juego')

**Nota**: campo `foto` NO editable (línea 687-689, placeholder: "próximamente")

---

### RUBROPTIONS (_rubroOptions, catalogo.js:25)

```js
['Equipamiento', 'Iluminación', 'Infraestructura', 'Más servicios', 'Pisos']
```

Usado en:
- Chips filtro (línea 115-120)
- Colores badge rubro en tabla (línea 259-268)
- Colores badge rubro en panel (línea 405-414)

Colores:
- Equipamiento: #F28D15 (naranja)
- Iluminación: #FFCA28 (amarillo)
- Infraestructura: #9B7DFF (púrpura)
- Más servicios: #00CC88 (verde)
- Pisos: #607D8B (gris-azul)

---

### TABS STANDS VS EVENTOS (catalogo.js:20, 92-108, 366-380)

**Estructura HTML**: dos botones con data-tab='stands'|'eventos'
**Cambio visual**: sólo cambia descripción en `catTabDesc` (línea 104-108)

**GOTCHA CRÍTICO**: línea 184-186
```js
// Tab filter — for now both tabs show all items
// When the DB has a "audiencia" field, filter by stands/eventos here
```

**REALIDAD**: 
- `_applyFilters()` (línea 181) ignora completamente `_activeTab`
- Ambos tabs devuelven EXACTAMENTE LOS MISMOS ITEMS
- NO hay diferenciación en BD (tabla `catalogo_items` no tiene campo `audiencia` ni similar)
- Refactorización debe decidir: agregar campo `audiencia`/`tipo_item` o usar `rubro` como proxy

---

### FOTO (item.foto) — MUERTO

- Renderizado en tabla: línea 282-284 (muestra thumbnail o emoji 📷)
- Renderizado en panel: línea 436-445 (imagen o "Sin imagen")
- **Función edit**: línea 687-689, solo abre Toast "Subida de fotos — próximamente"
- **NO hay** campo en `_formFields` para editar foto
- **NO hay** API para almacenar `foto` en BD (visible en api.js createCatalogoItem y updateCatalogoItem, lineas 1681-1763: ningún mapping para `foto`)
- **Suposición**: campo `foto` existe en tabla pero no es usado

---

### FILTROS & BÚSQUEDA

**Implementación**: `_applyFilters()` (línea 181-215)

1. **Search** (línea 188-198): `normStr()` sobre nombre/código/rubro/categoría/descripción
2. **Rubro** (línea 200-203): exact match si `_rubroFilter !== null`
3. **Categoría** (línea 205-208): exact match si `_categoriaFilter !== null`
4. **Sort** (línea 210-211): llama `_sortData()`

**Categorías**: auto-pobladas desde items únicos (línea 165-175), select dinámico

---

### SORT

Método `_sortData()` (línea 217-228):
- Soporta cualquier columna por clave
- Case-insensitive string compare
- Reverse en `_sortDir` toggle (línea 314-318)

Columnas sortables en tabla (línea 293-298):
- CÓDIGO, NOMBRE, RUBRO, CATEGORÍA, ORIGEN

**Defecto**: `_sortCol: 'nombre'`, `_sortDir: 'asc'` (línea 15-16)

---

### TABLA (catalogo.js:234-307)

**Estructura**: `<table class="cat-table">`
- Headers sortables (th.sortable): codigo, nombre, rubro, categoria, origen, unidad (no sortable), foto (no sortable)
- Rows: clonación de `_filteredItems` a HTML (línea 270-286)
- Clases activas: row.active cuando item abierto en panel

**Colores rubro**: badge inline con `--rubro-color` CSS var (línea 277)

**Empty state** (línea 242-249): icono 🔩 + "No se encontraron items"

**Render** dispara `_attachTableEvents()` (línea 306):
- Click header → sort toggle
- Click row → `_openPanel(item)`

---

### PANEL LATERAL DERECHO (catalogo.js:393-517)

**Trigger**: click en fila tabla → `_openPanel(item)` (línea 325-329)
**Posición**: `.cat-side-panel` (style.css 10511-10538, width:420px, transform translateX(100%) → 0 on open)
**Z-index**: 100
**Contenido**:

1. **Header** (línea 418-425):
   - Color bar (top 3px, rubro color)
   - Close button (× top-right)
   - Nombre (grande, rubro color)
   - Código + rubro badge

2. **Foto section** (línea 428-445):
   - Thumbnail si existe, else "Sin imagen" + 📷
   - Edit button (si no read-only)
   - `id="catBtnEditFoto"` → `_editFoto()` (muerto, solo Toast)

3. **Info section** (línea 447-464):
   - Grid readonly: nombre, código, rubro, categoría, descripción, origen, unidad
   - Edit button (si no read-only)
   - `id="catBtnEditInfo"` → `_openEditModal(item)` (abre modal CRUD)

4. **Actions section** (línea 466-474, solo si no read-only):
   - Botón "Eliminar item" rojo
   - `id="catBtnDelete"` → `_deleteItem(item)` (soft-delete via API)

**Close**: botón × o Esc key (listener en línea 498-501)
**Highlight**: fila tabla se marca `.active` mientras panel abierto (línea 480-482)

---

### CRUD LIFECYCLE

#### CREATE (catalogo.js:523-584)

1. Click "Nuevo item" (línea 84-86)
2. `_openCreateModal()` (línea 523):
   - Modal con form (todos campos vacíos)
   - Validación: `nombre` obligatorio (línea 563-566)
3. Clic "Crear item":
   - `API.createCatalogoItem(values)` (api.js 1681)
   - UndoHelpers.createRecord() (undo.js 323-356, retorna data.id)
   - `API.clearCache()` (invalida cache 60s)
   - `_loadData()` (re-fetch desde BD)

#### EDIT (catalogo.js:590-657)

1. Click edit-btn en panel info
2. `_openEditModal(item)` (línea 590):
   - Modal con form pre-llenado
   - Validación: `nombre` obligatorio
3. Clic "Guardar cambios":
   - `API.updateCatalogoItem(id, values)` (api.js 1705)
   - UndoHelpers.updateRecord() (undo.js 279-320)
   - `API.clearCache()`
   - Re-fetch y refresh panel si abierto (línea 646-649)

#### DELETE (catalogo.js:663-681)

1. Click "Eliminar item" en panel actions
2. `_deleteItem(item)` (línea 663):
   - Modal.confirm() con peligro
3. Clic confirmar:
   - `API.deleteCatalogoItem(id)` (api.js 1765)
   - UndoHelpers.deleteRecord() (undo.js 359-396, soft-delete _deleted:true)
   - `API.clearCache()`
   - Re-fetch y cierra panel

---

### API METHODS (api.js)

#### getCatalogoItems() (1621-1679)

- **Cache**: 60s, key: 'catalogo_items'
- **Query**: `select('*').eq('_deleted', false).order('nombre', asc)`
- **Mapeo**: camelCase (costo_produccion → costoProduccion)
- **Campos retornados**: id, nombre, codigo, rubro, categoria, descripcion, origen, unidad, costoProduccion, precioCliente, nivel, favorito, disponiblePublico, stock, familia, margenOverride, tipoReceta, margenSubalquiler, manoObraMinutos, pct\*, vida\*, margen\*, costo\*, precio\*, snapshot\* (costos fase 1+2 y F.2), esCotizable

#### createCatalogoItem(data) (1681-1703)

- **Payload mapeado**: nombre, codigo, rubro, categoria, descripcion, origen, unidad, costo_produccion, precio_cliente, nivel (default 3), familia
- **NO mapea**: foto, disponiblePublico, margenOverride, campos costos
- **Retorno**: UndoHelpers.createRecord() result (data.id)
- **Undo**: soft-delete (_deleted:true)

#### updateCatalogoItem(id, data) (1705-1763)

- **Partial update**: solo campos en payload si definidos
- **Mapeos**: similar a create + margenOverride + todos campos costos/snapshots + esCotizable
- **Nota foto**: NO mapeado (nunca puede actualizarse)
- **Undo/Redo**: via UndoHelpers.updateRecord() (snapshot valores anteriores)

#### deleteCatalogoItem(id) (1765-1774)

- **Implementación**: UndoHelpers.deleteRecord() → soft-delete (_deleted:true)
- **Snapshot**: se almacena registro completo para undo
- **Undo**: restaura _deleted:false

---

### CACHE & UNDO

**Cache**:
- Location: `API._cache` object (inicializado vacío)
- Timeout: 60s (API._cacheTimeout)
- Invalidación: `API.clearCache()` borra TODO el cache object
- Estrategia: simple dict con `{ key: {data, ts} }`

**Undo**:
- Soft-delete (nunca hard-delete)
- createRecord undo → soft-delete, redo → restore (_deleted:false)
- deleteRecord undo → restore, redo → soft-delete
- updateRecord undo/redo → snapshot valores anteriores
- AuditLog llamadas en cada operación (undo.js 261, 268, etc)

---

### QUÉ CONSERVAR VS REFACTORIZAR (para Showroom)

#### CONSERVAR (funciona, patrones válidos):

1. **State management**: `_items`, `_filteredItems`, `_sortCol`, `_sortDir` → patrón limpio
2. **Search**: `normStr()` accent-insensitive sobre múltiples campos
3. **Rubro system**: colores hardcoded por rubro, chips filtro
4. **Tabla renderizado**: estructura HTML simple, row highlight, sortable headers
5. **Panel lateral**: slide-in derecha 420px, modal CRUD, undo integration
6. **API mapping**: camelCase internal, snake_case BD, selectivos en update
7. **Soft-delete**: via UndoHelpers, _deleted field, transparent undo
8. **Permisos**: Data.isReadOnly(user.role, 'catalogo') → hide buttons

#### REFACTORIZAR (muerto/incompleto):

1. **Foto field**:
   - NO tiene upload UI real
   - NO está en _formFields
   - NO mapeado en API
   - **Decisión**: eliminar renderizado hasta que Storage real exista, O agregar upload simple

2. **Tabs Stands/Eventos**:
   - NO filtran nada (ambos muestran TODOS items)
   - Sin campo `audiencia` en BD
   - **Decisión**: 
     - Opción A: agregar `audiencia` field a tabla, filtrar en _applyFilters()
     - Opción B: eliminar tabs si no hay requisito real
     - Opción C: usar `rubro` como proxy (ej: ciertos rubros → stands, otros → eventos)

3. **Categoría filter**:
   - Auto-poblado pero sin UI clara (select oculto si lista vacía)
   - Funcionalmente OK pero UX confusa
   - **Consideración**: mantener si hay datos, pero aclarar que es derivado

4. **Panel foto section**:
   - Botón edit no hace nada
   - Renderizado foto muestra imagen rota si URL inválida
   - **Decisión**: remover edit-btn foto o implementar Supabase Storage real

---

### GOTCHAS VERIFICADOS

1. **Tab filter inoperante** (línea 184-186 comentario): código escrito pero lógica ausente
2. **Foto muerto**: UI renderiza pero sin funcionalidad backend
3. **Cache simple**: invalidación es full clear, sin granularidad
4. **Panel sync**: si item se edita externamente mientras panel abierto, no se actualiza (refresh manual con click)
5. **Permisos**: check una sola vez al load (línea 59-60), no reactivo si role cambia

---

### UBICACIÓN FILE:LINE CRÍTICA

| Elemento | File | Línea(s) |
|----------|------|----------|
| State vars | catalogo.js | 10-22 |
| _formFields | catalogo.js | 28-36 |
| _rubroOptions | catalogo.js | 25 |
| _buildShell() | catalogo.js | 58-146 |
| _loadData() | catalogo.js | 152-163 |
| _applyFilters() | catalogo.js | 181-215 |
| _renderTable() | catalogo.js | 234-307 |
| _openPanel() | catalogo.js | 393-502 |
| getCatalogoItems() | api.js | 1621-1679 |
| createCatalogoItem() | api.js | 1681-1703 |
| updateCatalogoItem() | api.js | 1705-1763 |
| deleteCatalogoItem() | api.js | 1765-1774 |
| UndoHelpers | undo.js | 227-405 |
| Estilos | style.css | 10182-10660+ |

### GROUND TRUTH — costos
Perfecto. Ahora tengo todo lo necesario. Voy a compilar el brief técnico.

---

## BRIEF TECNICO: ACOPLAMIENTO CATALOGO_ITEMS ↔ COSTOS + COTIZADOR

**Repositorio:** `C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX`  
**Branch:** `rediseno`  
**Fecha:** 2026-06-22

---

### 1. COLUMNAS DE CATALOGO_ITEMS LEÍDAS POR COSTOS

#### Lectura en Tab "Listas de Precio" (`costos.js:551-975`)
| Columna (camelCase) | Columna BD (snake_case) | Uso | Read-Only? |
|---|---|---|---|
| `esCotizable` | `es_cotizable` | Filtro: "solo cotizables" / toggle inline para marcar cotizable | **NO** — se actualiza en línea |
| `precioAlquiler` | `precio_alquiler` | Columna PRECIO (sortable), KPI "sin precio", exportar PDF 3 modos | **SÍ** — READ-ONLY, originado de RPC |
| `snapshotCostosAt` | `snapshot_costos_at` | Filtro "última actualización" (min/max días), sort, indicador "⚠ sin snapshot" | **SÍ** — READ-ONLY, timestamp del recálculo |
| `nombre` | `nombre` | Búsqueda y tabla | **NO** — editable en panel ficha |
| `codigo` | `codigo` | Búsqueda y tabla | **NO** — editable en panel ficha |
| `rubro` | `rubro` | Filtro multi-chip, tabla | **NO** — editable via quick-edit popover |

#### Lectura en Tab "Recetas y Costos" (costeo)
| Columna (camelCase) | Columna BD | Uso | Read-Only? |
|---|---|---|---|
| `tipoReceta` | `tipo_receta` | Define fórmula (propio/subalquilado), UI distinta | **NO** — toggle compacto en panel |
| `precioAlquiler` | `precio_alquiler` | Display en tabla y panel resultado | **SÍ** — READ-ONLY |
| `costoFabricacion` | `costo_fabricacion` | Display costo fabricación en panel | **SÍ** — READ-ONLY (cache) |
| `costoPorUso` | `costo_por_uso` | Display costo/uso en panel | **SÍ** — READ-ONLY (cache) |
| `manoObraMinutos` | `mano_obra_minutos` | Input editable en ficha, factor cálculo | **NO** — editable |
| `margenPropio` | `margen_propio` | Override margen global, input opcional | **NO** — editable |
| `margenSubalquiler` | `margen_subalquiler` | Override para subalquilados, input | **NO** — editable |
| `vidaUtilArmadoOverride` | `vida_util_armado_override` | Regla 1:N "duro" — input opcional | **NO** — editable |
| `snapshotPctIndirectosFabrica` | `snapshot_pct_indirectos_fabrica` | Cacheado en panel, no editable | **SÍ** — READ-ONLY |
| `snapshotPctMargen` | `snapshot_pct_margen` | Cacheado en panel, no editable | **SÍ** — READ-ONLY |
| `snapshotHoraTallerArs` | `snapshot_hora_taller_ars` | Cacheado en panel, no editable | **SÍ** — READ-ONLY |

#### Lectura en PDF export (`costos.js:1036-1130`)
| Columna | Modo Cliente | Modo Socio | Modo Interno |
|---|---|---|---|
| `codigo` | ✓ | ✓ | ✓ |
| `nombre` | ✓ | ✓ | ✓ |
| `precioAlquiler` | ✓ | ✓ | ✓ |
| `rubro` | — | ✓ | ✓ |
| `snapshotCostosAt` | — | — | ✓ |
| `costoPorUso` | — | — | ✓ (cost/uso) |

---

### 2. COLUMNAS INTOCABLES (CONTRATO DE INTERFAZ)

**LISTA EXPLÍCITA de columnas que el Catálogo Showroom NUNCA debe modificar:**

```javascript
// READ-ONLY absoluto — generadas por RPC calcular_receta() en Costos
precioAlquiler              // → PRECIO que mostrará el showroom
costoFabricacion            // → cache del costo de fabricación
costoPorUso                 // → cache del costo por uso
snapshotCostosAt            // → timestamp del último recálculo

// READ-ONLY absoluto — snapshots de parámetros al recalcular
snapshotPctIndirectosFabrica
snapshotPctMargen
snapshotHoraTallerArs

// PERMITIDO editar en Showroom pero con advertencia:
// Solo cambios de vitrina = nombre, código, rubro, descripción, foto
nombre
codigo
rubro
categoria
descripcion
origen
unidad
disponiblePublico
stock
favorito
familia
foto
```

**PROHIBIDO editar en Showroom** (pertenecen SOLO a Costos):
- `tipoReceta` — define la fórmula (propio/subalquilado)
- `manoObraMinutos` — factor del costo de MO
- `margenPropio`, `margenSubalquiler` — override de márgenes
- `vidaUtilArmadoOverride` — regla 1:N "duro"
- `esCotizable` — toggle en Listas (read-only para Showroom)
- `costoProduccion`, `costoManoObra`, `costoIndirectos` — legacy, ignorados por RPC

---

### 3. COTIZADOR EXTERNO — LECTURA DIRECTA DE CATALOGO_ITEMS

**Fuente:** CLAUDE.md §6.5, Decisiones tomadas, línea 405:  
> **Cotizador externo lee Listas directo** (no sync) → MEPEX no orquesta esa sync, el cotizador filtra `es_cotizable=TRUE` y lee `precio_alquiler` de `catalogo_items`.

**Implementación actual:** `costos.js:895-917` — toggle inline `esCotizable` en Tab Listas:
```javascript
// costos.js:896-916
document.querySelectorAll('input[data-toggle-id]').forEach(cb => {
    cb.addEventListener('change', async (ev) => {
        const id = parseInt(cb.dataset.toggleId);
        const newVal = cb.checked;
        cb.disabled = true;
        const ok = await API.updateCatalogoItem(id, { esCotizable: newVal });
        // ... update visual y _catalogoItems in-memory
    });
});
```

**Contrato con cotizador:**
1. Lee tabla `catalogo_items` directamente (sin API intermediaria)
2. Filtra `es_cotizable = true`
3. Lee SOLO: `codigo`, `nombre`, `precio_alquiler`
4. **No depende de snapshots** — usa `precio_alquiler` como fuente única de precios

**URL cotizador:** `cotizador-mepex.vercel.app` (Vercel + Railway)

---

### 4. RECÁLCULO DE PRECIOS — RPC CALCULAR_RECETA

**Fuente de verdad:** `calcular_receta(p_item_id BIGINT)` en Supabase PL/pgSQL

**Flujo:**
1. `costos.js` → panel Recetas → botón "Recalcular" (turquesa→naranja con animación)
2. Invoca `API.recalcularRecetaRPC(itemId)` (`api.js:3312-3366`)
3. RPC devuelve `{ costo_mp, costo_fabricacion, costo_por_uso, precio_alquiler }`
4. Frontend snapshots los parámetros globales actuales:
   - `snapshot_pct_indirectos_fabrica`
   - `snapshot_pct_margen` (ó `margen_subalquiler` si subalq)
   - `snapshot_hora_taller_ars`
   - `snapshot_costos_at` = NOW()
5. `updateCatalogoItem()` persiste todos los campos juntos (`api.js:3343-3353`)

**Columnas actualizadas atómicamente:**
```javascript
// api.js:3343-3351
{
  costoFabricacion,           // costo_fabricacion
  costoPorUso,                // costo_por_uso
  precioAlquiler,             // precio_alquiler ← VISIBLE EN SHOWROOM
  snapshotPctIndirectosFabrica,
  snapshotPctMargen,
  snapshotHoraTallerArs,
  snapshotCostosAt,           // timestamp
}
```

**GOTCHA:** El snapshot y el precio se guardan JUNTOS. Si `snapshotCostosAt` está pero faltan los snapshot_pct_*, hay datos inconsistentes. Frontend detecta esto con indicador `⚠` en panel.

---

### 5. CONSUMO POR COLUMNA EN COSTOS

| Columna | Lectura | Escritura | Fuente | Destino |
|---|---|---|---|---|
| `esCotizable` | `_applyListasFilters()` (601) | Botón inline (901) | Admin → Costos | Cotizador externo |
| `precioAlquiler` | En 13 lugares | RPC recalcular (3346) | `calcular_receta()` RPC | Showroom + PDF + KPIs |
| `snapshotCostosAt` | En 6 lugares (filtros, sort) | RPC recalcular (3350) | RPC | Timestamp validación |
| `tipoReceta` | En 3 lugares (toggle, visibilidad) | Panel edición | Showroom/Admin | RPC parámetro |
| `manoObraMinutos` | En 2 lugares (cálculo, display) | Panel edición | Showroom/Admin | RPC parámetro |
| `margenPropio` | En 1 lugar (selector) | Panel edición | Admin | Cálculo snapshot |
| `margenSubalquiler` | En 1 lugar (panel subalq) | Panel edición | Admin | RPC (si aplica) |

---

### 6. ADVERTENCIA: COLUMNAS CACHEADAS vs RPC

**Las columnas de caché NUNCA deben ser la fuente de verdad** para precios mostrados al cliente:

- `costoFabricacion` = Sumarizador de componentes (legacy antes de RPC). **Ignorado por RPC moderno.**
- `costoPorUso` = Resultado anterior del RPC, cacheado para UI. **No se usa en cálculos internos.**
- `precioAlquiler` = Resultado final del RPC, **ES el precio mostrado** en Showroom y Listas.

Si la RPC no se corrió (item nuevo sin receta), `precioAlquiler = 0`. Costos lo indica con `⚠ sin precio` en Listas.

---

### 7. RESUMEN: QUÉ NO ROMPER EN CATALOGO SHOWROOM

**Regla nuclear:** Si tocás columnas de costo/precio/receta en el Showroom, coordiná CON Costos.

**Seguro tocar:**
- ✓ nombre, código, descripción, rubro, categoría, origen, unidad
- ✓ foto, disponiblePublico, stock, favorito, familia

**NO tocar sin avisar:**
- ✗ precioAlquiler (es READ-ONLY, originado de RPC)
- ✗ esCotizable (es toggle del módulo Costos Tab Listas)
- ✗ tipoReceta, manoObraMinutos, margenPropio, margenSubalquiler, vidaUtilArmadoOverride
- ✗ costoFabricacion, costoPorUso, costoProduccion, costoManoObra, costoIndirectos
- ✗ snapshot* (READ-ONLY, tokens de validez del recálculo)

**Si necesitás editar precio en Showroom:** Crea un campo NUEVO (ej `precioShowroomOverride`) y documentá que NO afecta a Listas ni Cotizador.

### GROUND TRUTH — storage
Perfecto. Tengo toda la información. Voy a generar el brief técnico conciso y completo.

---

## BRIEF TÉCNICO: Patrón Storage + Compresión para Catálogo Showroom

### 1. MÉTODOS DE STORAGE EN API.JS

#### A. Upload a bucket privado (Remitos)
**Archivo:** `api.js:4886-4901` (uploadRemitoPDF)

```javascript
async uploadRemitoPDF(cargaId, blob) {
    const path = `${cargaId}/remito.pdf`;
    const { error } = await supabaseClient.storage
        .from('remitos')
        .upload(path, blob, {
            contentType: 'application/pdf',
            upsert: true,
            cacheControl: '60',
        });
    if (error) throw error;
    return path;  // Devuelve path, NO URL pública
}
```

**Variante para archivos de imagen/firma** (api.js:4906-4931):
```javascript
async uploadRemitoFirmado(cargaId, file) {
    const ext = (() => {
        const fromType = (file.type || '').split('/')[1];
        if (fromType && ['jpeg','png','webp'].includes(fromType)) 
            return fromType === 'jpeg' ? 'jpg' : fromType;
        return 'jpg';
    })();
    const path = `${cargaId}/firmado.${ext}`;
    const { error } = await supabaseClient.storage
        .from('remitos')
        .upload(path, file, {
            contentType: file?.type || 'image/jpeg',
            upsert: true,
            cacheControl: '60',
        });
    if (error) throw error;
    return path;
}
```

**Patrón:** `.from('bucket').upload(path, file, { contentType, upsert: true, cacheControl })` → devuelve `path` (string).

---

#### B. Obtener URL (Signed vs Public)

**Para bucket PRIVADO** — usa signed URL (api.js:4935-4947):
```javascript
async getRemitoSignedUrl(path, expiresInSec = 3600) {
    const { data, error } = await supabaseClient.storage
        .from('remitos')
        .createSignedUrl(path, expiresInSec);
    if (error) throw error;
    return data?.signedUrl || null;  // URL válida 1h (por defecto)
}
```

**Para bucket PÚBLICO** — usa getPublicUrl (api.js:5860-5875, patrón inferido de Supabase SDK):
```javascript
// Patrón copy-paste para catálogo (bucket público 'catalogo-fotos'):
const { data } = supabaseClient.storage
    .from('catalogo-fotos')
    .getPublicUrl(path);
return data?.publicUrl || null;  // URL pública permanente
```

**Diferencia clave:**
- **Privado (remitos, comprobantes):** `createSignedUrl()` → URL con firma temporal
- **Público (catálogo fotos):** `getPublicUrl()` → URL permanente, sin firma

---

### 2. COMPRESIÓN CANVAS EN CLIENT-SIDE

#### A. Patrón Logo (RemitoPDF)
**Archivo:** `remito-pdf.js:22-61` (_loadLogo)

```javascript
async _loadLogo() {
    const res = await fetch('assets/logo_full.png');
    const blob = await res.blob();
    
    // Cargar como Image
    const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.src = URL.createObjectURL(blob);
    });
    
    // Resize a max 400px ancho, aspect ratio
    const maxW = 400;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    
    // Canvas: fondo blanco (PNG → JPEG opaco)
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    
    // JPEG 0.88 quality (~30-60KB vs ~5MB PNG)
    return canvas.toDataURL('image/jpeg', 0.88);
}
```

**Resultado:** ~5MB PNG → ~30-60KB JPEG sin pérdida visible.

---

#### B. Patrón Imagen Genérica (CRM, reutilizable)
**Archivo:** `crm.js:3858-3875` (_downscaleImage)

```javascript
_downscaleImage(file, maxDim = 1400, quality = 0.82) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                // Scale down si excede maxDim
                if (w > maxDim || h > maxDim) {
                    const r = Math.min(maxDim / w, maxDim / h);
                    w = Math.round(w * r);
                    h = Math.round(h * r);
                }
                const cv = document.createElement('canvas');
                cv.width = w;
                cv.height = h;
                cv.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(cv.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => resolve(null);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}
```

**Uso en CRM:**
```javascript
const compressedDataUrl = await this._downscaleImage(file, 1400, 0.82);
if (compressedDataUrl.length > 1400000) 
    return Toast.warning('Imagen muy grande');
```

**Parámetros tunables:**
- `maxDim`: máximo ancho/alto (default 1400px)
- `quality`: 0-1 JPEG quality (default 0.82; remito usa 0.88)

---

### 3. PATRÓN INTEGRADO PARA CATÁLOGO SHOWROOM

**Flujo copy-paste:**

```javascript
// 1. Seleccionar archivo (input type="file")
const file = inputElement.files[0];

// 2. Comprimir (opcional, recomendado para fotos grandes)
const dataUrl = await this._downscaleImage(file, 1600, 0.85);
const compressedBlob = await fetch(dataUrl).then(r => r.blob());

// 3. Subir a bucket público 'catalogo-fotos'
const path = `${itemId}/foto.jpg`;
const { error } = await supabaseClient.storage
    .from('catalogo-fotos')
    .upload(path, compressedBlob, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',  // Cache 1h
    });

// 4. Obtener URL pública (permanente)
const { data } = supabaseClient.storage
    .from('catalogo-fotos')
    .getPublicUrl(path);
const publicUrl = data?.publicUrl;

// 5. Guardar publicUrl en DB
await API.updateCatalogoItem(itemId, { foto: publicUrl });
```

---

### 4. DIFERENCIAS BUCKET: Remitos vs Comprobantes vs Catálogo

| Bucket | Visibilidad | Upload Method | URL | Expiración | Uso |
|--------|------------|---|---|---|---|
| `remitos` | Privado | `.upload()` | `.createSignedUrl()` | 1h (config) | PDF/firma de cargas |
| `comprobantes` | Privado | `.upload()` | `.createSignedUrl()` | 1h (config) | Recibos gastos |
| `catalogo-fotos` | **Público** | `.upload()` | `.getPublicUrl()` | Permanente | Fotos items showroom |

---

### 5. NOTAS CRÍTICAS

1. **Canvas resize:** Siempre usar `Math.min()` para aspect ratio; no distorsionar.
2. **JPEG quality:** 0.82-0.88 es rango óptimo (visible vs peso).
3. **Bucket público:** Usar **solo** para contenido que no requiera auth (fotos catálogo, logos). Factura/remito → privado + signed.
4. **DataURL → Blob:** `fetch(dataUrl).then(r => r.blob())` para convertir canvas.toDataURL a File uploadable.
5. **Path structure:** `${id}/nombre.ext` permite agrupar archivos por item sin conflictos.

---

**Archivos referenciados:**
- `api.js:4886-4947` — uploadRemitoPDF, uploadRemitoFirmado, getRemitoSignedUrl
- `api.js:5860-5874` — uploadComprobante, getComprobanteSignedUrl
- `remito-pdf.js:22-61` — _loadLogo (canvas resize + JPEG 0.88)
- `crm.js:3858-3875` — _downscaleImage (patrón genérico maxDim + quality)

### GROUND TRUTH — pdf
Perfecto. Ahora tengo todo. Voy a generar el brief técnico consolidado.

## BRIEF TÉCNICO: MAQUINARIA PDF + BRANDING MEPEX

**Archivos base:** costos.js:1036-1198 | remito-pdf.js:14-311 | finanzas.js:5428-8019

---

### 1. INSTANCIACIÓN jsPDF

```javascript
// Patrón canónico en LOBBY-MEPEX
if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
    Toast.error('jsPDF no está cargado. Refrescá la página.');
    return;
}
const { jsPDF } = window.jspdf;
const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
```

**Ubicaciones verificadas:**
- costos.js:1037-1042 (generación catálogo)
- remito-pdf.js:68-82 (remito carga)
- finanzas.js:5463, 5501 (factura + plan)

---

### 2. CARGA DEL LOGO

Dos patrones paralelos según contexto:

#### A) RemitoPDF._loadLogo (remito-pdf.js:22-61)
**Optimización canvas + JPEG:**
```javascript
async _loadLogo() {
    if (this._logoDataUrl) return this._logoDataUrl;
    try {
        const res = await fetch('assets/logo_full.png');
        const blob = await res.blob();
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = URL.createObjectURL(blob);
        });
        const maxW = 400;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';  // fondo blanco para JPEG sin alpha
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        
        this._logoDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        this._logoFormat = 'JPEG';
        URL.revokeObjectURL(img.src);
        return this._logoDataUrl;
    } catch (e) {
        console.warn('[RemitoPDF] No se pudo cargar logo:', e.message);
        return null;
    }
}
```
**Uso:** `doc.addImage(this._logoDataUrl, 'JPEG', MARGIN, y, 45, 14);`

#### B) Finanzas._loadLogoForPDF (finanzas.js:5428-5458)
**Caching con dimensiones:**
```javascript
async _loadLogoForPDF() {
    if (this._logoCache) return this._logoCache;
    try {
        const res = await fetch('assets/logo_full.png');
        const blob = await res.blob();
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = URL.createObjectURL(blob);
        });
        const maxW = 400;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        
        this._logoCache = { dataUrl: canvas.toDataURL('image/jpeg', 0.88), w, h };
        URL.revokeObjectURL(img.src);
        return this._logoCache;
    } catch (e) {
        console.warn('[Finanzas] No se pudo cargar logo:', e.message);
        return null;
    }
}
```

**CORS sin problema:** `assets/logo_full.png` se sirve desde la SPA (origen local, no fetch remoto).

---

### 3. INCRUSTACIÓN DE IMÁGENES

#### A) Embeber con aspect ratio (costos.js:1052-1090)
```javascript
const loadImage = async (url) => {
    try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
        const dims = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => resolve(null);
            img.src = dataUrl;
        });
        if (!dims || !dims.w) return null;
        return { dataUrl, ...dims };
    } catch (_) { return null; }
};

const logoFull = await loadImage('assets/logo_full.png');
// Preservar aspect ratio al colocar
if (logoFull) {
    const targetW = 38;  // mm
    const targetH = targetW * (logoFull.h / logoFull.w);
    doc.addImage(logoFull.dataUrl, 'PNG', 14, 12, targetW, targetH);
}
```

#### B) SVG → PNG dataURL (finanzas.js:7022-7034)
**Para logos vectoriales que jsPDF no soporta nativamente:**
```javascript
async _svgToPng(kind, wPx, hPx, color, vbOverride) {
    const c = color || '#00abc8';
    const vb = vbOverride || (kind === 'iso' ? this._ISO_VB : this._LOGO_VB);
    const paths = kind === 'iso' ? this._ISO_PATHS : this._LOGO_PATHS;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx}" height="${hPx}" viewBox="${vb}" fill="${c}">${paths}</svg>`;
    
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
        const img = await new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = url;
        });
        const cv = document.createElement('canvas');
        cv.width = wPx;
        cv.height = hPx;
        cv.getContext('2d').drawImage(img, 0, 0, wPx, hPx);
        return cv.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(url);
    }
}
```
**Uso:** `const logoPng = await this._svgToPng('logo', 620, 279);`

#### C) QR AFIP (finanzas.js:8003-8019)
```javascript
async _qrDataUrl(text) {
    if (typeof QRCode === 'undefined') return null;
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.left = '-9999px';
    div.style.top = '0';
    document.body.appendChild(div);
    try {
        new QRCode(div, {
            text,
            width: 240,
            height: 240,
            correctLevel: (QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0)
        });
        await new Promise(r => setTimeout(r, 30));
        const canvas = div.querySelector('canvas');
        if (canvas) return canvas.toDataURL('image/png');
        const img = div.querySelector('img');
        return img ? img.src : null;
    } finally {
        document.body.removeChild(div);
    }
}
```

---

### 4. COLORES Y FUENTES BRANDING MEPEX

**Paleta turquesa canónica:**
```javascript
const TURQUESA = [0, 169, 193];      // RGB decimal (alias: #00A9C1)
// O en hex para setTextColor: '#00ACC9', '#00abc8', '#00BCD4'

// Tipografía estándar jsPDF:
doc.setFont('helvetica', 'bold');   // Títulos
doc.setFontSize(16);
doc.setTextColor(...TURQUESA);      // RGB o hex

// Colores auxiliares:
const TEXTO = [40, 40, 40];          // oscuro para cuerpo
const MUTED = [120, 120, 120];       // gris medio para labels
const GRAY = [150, 150, 150];        // líneas
```

**Header estándar (costos.js:1092-1106):**
```javascript
doc.setFont('helvetica', 'bold');
doc.setFontSize(16);
doc.setTextColor('#00ACC9');
doc.text('Lista de Precios', 14, 36);

doc.setFont('helvetica', 'normal');
doc.setFontSize(10);
doc.setTextColor('#444444');
doc.text(`Versión: ${subTitleByMode} · Generado: ${today}`, 14, 42);

// Línea separadora
doc.setDrawColor('#00ACC9');
doc.setLineWidth(0.6);
doc.line(14, 45, 196, 45);
```

---

### 5. AUTOTABLE + PAGINACIÓN

**Comprobación y uso (costos.js:1135-1193):**
```javascript
if (typeof doc.autoTable !== 'function') {
    Toast.error('jspdf-autotable no está cargado.');
    return;
}

doc.autoTable({
    head: [['Código', 'Nombre', 'Precio']],
    body: items.map(i => [i.codigo || '', i.nombre || '', formatCurrency(i.precioAlquiler)]),
    startY: 50,
    theme: 'grid',
    headStyles: {
        fillColor: [0, 172, 201],      // turquesa RGB
        textColor: 255,                  // blanco
        fontStyle: 'bold',
        fontSize: 10
    },
    bodyStyles: { fontSize: 9, textColor: 30 },
    alternateRowStyles: { fillColor: [245, 245, 245] },  // rayas alternadas
    tableLineColor: [224, 224, 224],
    tableLineWidth: 0.1,
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
        // CALLBACK por página → footer con logo + paginación
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const footerY = pageHeight - 14;
        
        // Línea naranja
        doc.setDrawColor('#FF7200');
        doc.setLineWidth(0.4);
        doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);
        
        // Paginación derecha
        doc.setFontSize(8);
        doc.setTextColor('#888888');
        const pageNum = `Página ${doc.internal.getNumberOfPages()}`;
        doc.text(pageNum, pageWidth - 14, footerY, { align: 'right' });
    },
});
```

---

### 6. NOMENCLATURA DEL ARCHIVO

**Patrón estándar costos:**
```javascript
const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const filename = `lista-precios-${mode}-${today.replace(/\//g, '-')}.pdf`;
doc.save(filename);
// Ejemplo: lista-precios-cliente-22-06-2026.pdf
```

**Patrón finanzas (factura):**
```javascript
const fname = `MEPEX_${tipo.short}_${numero}.pdf`;
// Ejemplo: MEPEX_FC_0005-00000123.pdf
```

**Patrón remito:**
```javascript
// Sin nombre explícito en output, se genera como blob y se sube a Storage
return doc.output('blob');
```

---

### 7. CONSTANTES A4 + MÁRGENES

```javascript
const PAGE_W = 210;      // mm
const PAGE_H = 297;      // mm
const MARGIN = 18;       // mm (margen estándar MEPEX)

// Para textos
const LABEL_W = 50;      // ancho columna labels
const MAX_W = PAGE_W - 2 * MARGIN;  // ancho disponible

// Líneas separadoras
const hr = (y, color = [220, 220, 220]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
};
```

---

### 8. GOTCHAS Y PATRONES VERIFICADOS

1. **Carga de logo con try-catch:** siempre fallback a texto si la imagen no carga
   ```javascript
   if (logoFull) {
       doc.addImage(logoFull.dataUrl, 'PNG', 14, 12, targetW, targetH);
   } else {
       doc.setFont('helvetica', 'bold');
       doc.setFontSize(18);
       doc.text('MEPEX', 14, 22);
   }
   ```

2. **Aspect ratio preservado:** multiplicar por relación h/w
   ```javascript
   const targetH = targetW * (logoFull.h / logoFull.w);
   ```

3. **CORS no es problema:** se fetching de `assets/` (mismo origen)

4. **SVG nativo no soportado en jsPDF → convertir a PNG vía canvas**

5. **QRCode requiere librería externa (qrcodejs)** → chequear disponibilidad

6. **autoTable necesita chequeo explícito:** `typeof doc.autoTable !== 'function'`

7. **Paginación automática:** confiar en `didDrawPage` del callback de autoTable

8. **Formato JPEG para logos:** mejor tamaño (~30-60KB vs ~5MB PNG)

---

### 9. UBICACIONES ARCHIVO PARA REUSAR

| Función | Archivo | Líneas | Uso |
|---------|---------|--------|-----|
| `_loadLogo()` | remito-pdf.js | 22-61 | Logo optimizado JPEG |
| `_loadLogoForPDF()` | finanzas.js | 5428-58 | Logo con caching + dims |
| `_svgToPng()` | finanzas.js | 7022-34 | SVG → PNG (isologo) |
| `_qrDataUrl()` | finanzas.js | 8003-19 | QR AFIP generado |
| `_generatePdf()` (lista) | costos.js | 1036-98 | Full template con autotable |
| `RemitoPDF.generate()` | remito-pdf.js | 63-286 | Remito A4 completo |

---

**PARA CATALOGO SHOWROOM:** copiar patrón costos.js lineas 1036-1198 (3 modos: cliente/socio/interno), substituir items con productos showroom, reusar carga de logo de finanzas._loadLogoForPDF (con caching), mantener footer con didDrawPage callback.

### GROUND TRUTH — componentes
Excelente. Ahora voy a recolectar todo en un brief conciso. Tengo toda la información necesaria:

---

## BRIEF TECNICO: CATALOGO SHOWROOM MÓDULO

**Cwd:** `C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX`

### 1. HELPERS GLOBALES (components.js)

```javascript
// components.js:12-15
window.normStr(s: string|null) → string
  Normaliza para búsquedas accent-insensitive.
  Ej: "guía" → "guia", null → ""
  
// components.js:22-27
window.escHtml(s: any) → string
window.escAttr(s: any) → string  // alias a escHtml
  Escapan &<>"' antes de interpolar en innerHTML/atributos.
  USO: `<td>${escHtml(item.nombre)}</td>` | `value="${escAttr(val)}"`
```

---

### 2. COMPONENTES UI (components.js)

**Toast** (components.js:30-82)
```javascript
Toast.show(message: string, type?: 'success'|'error'|'warning'|'info', duration?: number)
Toast.success(msg: string, duration?: number)  // 3000ms default
Toast.error(msg: string, duration?: number)    // 5000ms
Toast.warning(msg: string, duration?: number)  // 4000ms
Toast.info(msg: string, duration?: number)     // 3000ms
```

**Modal** (components.js:86-206)
```javascript
// Retorna instance con { id, overlay, onClose }
Modal.open({ 
  title: string,
  body: string,           // innerHTML
  size?: 'sm'|'md'|'lg',  // default 'md'
  footer?: string,        // innerHTML
  onClose?: Function,
  closable?: boolean      // default true, Esc + backdrop
}) → instance

Modal.confirm({
  title?: string,          // default 'Confirmar'
  message: string,         // required
  confirmText?: string,    // default 'Confirmar'
  cancelText?: string,     // default 'Cancelar'
  danger?: boolean         // true → btn-danger (rojo)
}) → Promise<boolean>      // resolve(true|false)

Modal.close(id?: number)   // sin id → cierra topmost
Modal.closeAll()
```
Nota: Buttons con `data-modal-close` cierran automáticamente.

**Confirm** (components.js:296-310)
```javascript
await Confirm.delete(entityName: string) → Promise<boolean>
  Modal pre-armado con danger=true

await Confirm.action(title: string, message: string) → Promise<boolean>
  Modal genérico para confirmaciones
```

**FormBuilder** (components.js:314-405)
```javascript
FormBuilder.render(fields: Array, values?: Object) → string (HTML)
  fields = [
    { 
      key: string,
      label: string,
      type: 'text'|'select'|'textarea'|'date'|'number'|'email'|'tel',
      required?: boolean,
      placeholder?: string,
      options?: string[],        // para select
      list?: string              // datalist id (para number|text)
    }
  ]
  Retorna <form class="mepex-form"> con .form-field>.form-input, .form-error, .form-required

FormBuilder.getValues(formEl: HTMLFormElement) → Object
  { [key]: trimmedValue }

FormBuilder.validate(formEl: HTMLFormElement, fields: Array) → { valid: boolean, errors: Object }
  Marca .form-field--error, rellena .form-error con mensajes

FormBuilder.clearErrors(formEl: HTMLFormElement)
```

---

### 3. DESIGN TOKENS (style.css:12-94)

**Colores primarios**
```css
--primary:        #00A9C1  (cian, botones, highlights)
--accent:         #F28D15  (naranja, warnings)
--bg:             #050505  (negro profundo, fondo base)
--bg-card:        #111111  (superficies)
--bg-card-2:      #1A1A1A  (secondary surfaces)
--bg-card-3:      #222222  (tertiary)
--bg-hover:       #1e1e1e
```

**Texto**
```css
--text-primary:   #E8E8E8  (gris claro)
--text-muted:     #888888  (gris medio)
--text-dim:       #555555  (gris oscuro)
```

**Bordes & Efectos**
```css
--border:         #2a2a2a
--border-subtle:  rgba(0, 169, 193, 0.08)
--border-active:  rgba(0, 169, 193, 0.25)
--radius:         4px
--radius-md:      6px
--radius-lg:      10px
--ease:           cubic-bezier(0.25, 0.46, 0.45, 0.94)
--glow:           0 0 25px rgba(0, 169, 193, 0.3)
--glow-sm:        0 0 12px rgba(0, 169, 193, 0.2)
--shadow:         0 2px 12px rgba(0,0,0,0.4)
```

**Tipografía**
```css
--font-main:      'Outfit', sans-serif
--font-mono:      'Space Mono', monospace
```

**Estados & Semántica** (style.css:75-78)
```css
--color-success:  #00CC88
--color-warning:  #F28D15
--color-error:    #ff4444
--color-info:     #00A9C1
```

---

### 4. ARQUITECTURA MODULAR - INYECCIÓN DE ESTILOS

**Patrón** (verificado en crm.js:26, 172, 4516-4533):

1. **State flag** en módulo
   ```javascript
   const MiModulo = {
     _stylesInjected: false,
     ...
   }
   ```

2. **En render() → _injectStyles() 1 vez** (crm.js:172-176)
   ```javascript
   async render() {
     const user = Auth.getUser();
     if (!user) return Router.navigate('login');
     
     this._injectStyles();  // ← deduplicado por flag
     const content = document.getElementById('mainContent');
     if (!content) return;
     content.innerHTML = this._buildShell();  // solo HTML, NO <style>
     await this._loadData();
     this._attachEvents();
   }
   ```

3. **_injectStyles() crea <style id="module-id">** (crm.js:4516-4522)
   ```javascript
   _injectStyles() {
     if (this._stylesInjected) return;
     this._stylesInjected = true;
     
     const style = document.createElement('style');
     style.id = 'crm-styles';  // id único ← evita duplicación DOM
     style.textContent = `
       /* CSS aquí */
       .crm-wrapper { ... }
     `;
     document.head.appendChild(style);  // o document.body
   }
   ```

**NO hacer:**
- ❌ Inyectar `<style>` en `_buildShell()` cada render
- ❌ Sin id de `<style>` (riesgo de duplicación)
- ❌ Sin flag `_stylesInjected` (re-inyecta)

---

### 5. ACCESO A DATOS (Global APIs)

```javascript
const API = { ... }      // api.js:9
const Auth = { ... }     // auth.js:9
const Data = { ... }     // data.js:11
const Router = { ... }   // router.js:11
```

**Patrón típico en módulo:**
```javascript
async render() {
  const user = Auth.getUser();
  if (!user) return Router.navigate('login');
  // ...
  const isReadOnly = Data.isReadOnly(user.role, 'nombreModulo');
}

async _loadData() {
  const items = await API.getCatalogoItems();  // llamada específica
  this._items = items || [];
}
```

---

### 6. ESTRUCTURA HTML (patrón inventario.js:95-145)

```javascript
_buildShell() {
  return `
    <div class="xxx-wrapper">               // contenedor root
      <div class="xxx-toolbar">             // header con título
        <h1 class="xxx-title">...</h1>
        <button class="btn btn-primary">...</button>
      </div>
      <div class="xxx-filters">             // filtros/búsqueda
        <div class="xxx-filter-group">
          <button class="xxx-chip active">Todos</button>
        </div>
      </div>
      <div class="xxx-body">               // main content area
        <div class="xxx-main" id="xxxMainContent"></div>
        <div class="xxx-side-panel" id="xxxSidePanel"></div>  // opcional
      </div>
    </div>
  `;
}
```

---

### 7. CLASES CSS GLOBALES DISPONIBLES

**Botones** (style.css:163-198)
```css
.btn                    /* base */
.btn-primary            /* #00A9C1, fuente blanca */
.btn-secondary          /* transparent, border, color primary */
.btn-ghost              /* transparent, text-muted */
.btn-danger             /* rojo, para destructivos */
```

**Tipografía**
```css
.title-1                /* 1.6rem, 800 weight */
.title-2                /* 1.2rem, 700, color primary */
.title-3                /* 0.95rem, 600 */
.label                  /* mono, 0.6rem, uppercase, letter-spacing 0.2em */
.subtitle               /* 0.85rem, 300, text-muted */
.text-muted
.amount                 /* mono, 24px, 700 */
.amount-sm              /* mono, 16px, 700 */
```

**Inputs**
```css
.form-input             /* text, select, textarea base */
.form-select
.form-textarea
.form-field             /* wrapper */
.form-label
.form-error             /* color error, oculto por defecto */
.form-field--error      /* visible si hay error */
.form-required          /* span * */
```

---

### 8. REFERENCIA RÁPIDA: IMPORTS AL MÓDULO CATALOGO SHOWROOM

```javascript
// Ya disponibles globalmente (cargados antes):
// - Toast, Modal, Confirm, FormBuilder (components.js)
// - window.normStr, window.escHtml, window.escAttr (components.js)
// - API, Auth, Data, Router (módulos globales)
// - CSS: style.css (tokens :root + clases globales)

const CatalogoShowroomModule = {
  _stylesInjected: false,
  // ... resto del módulo
}
```

---

**Conclusión:** Para implementar Catalogo Showroom, inyecta estilos 1 vez en `render()` con flag. Usa componentes via `Modal.open/confirm`, `Toast.show*()`, `FormBuilder.render/getValues/validate()`. Escapa datos con `escHtml/escAttr`. Tokens disponibles como CSS vars `:root`. Cero inventar APIs.

### GROUND TRUTH — drive
Perfecto. Ahora tengo toda la info. Voy a compilar el brief técnico CONCISO pero COMPLETO:

---

## BRIEF TÉCNICO: FARMEO DRIVE→SUPABASE CATÁLOGO SHOWROOM

### 1. CÓMO EMBEBE DRIVE LA APP HOY

**Referencia**: `proyecto-detalle.js:508, 1130, 1493-1504`

- **Campos en tabla `proyectos`**:
  - `drive_folder_url` (text): URL pública completa
  - `drive_folder_id` (text): ID extraído de la URL
  
- **Extracción del ID** (`_extractDriveFolderId`, línea 1493):
  ```javascript
  // Soporta 3 formatos:
  // 1. drive.google.com/drive/folders/<ID>
  // 2. drive.google.com/open?id=<ID>
  // 3. drive.google.com/.../?id=<ID>
  const m1 = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
  ```

- **Uso**: Embebido en iframe (línea 509-511): `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`
  - No hay lectura programática de archivos hoy: es solo visor para usuarios.

---

### 2. HERRAMIENTAS MCP GOOGLE DRIVE DISPONIBLES

Schema cargado. Capacidades:

| Tool | Parámetros clave | Qué hace |
|------|-----------------|----------|
| **search_files** | `query` (sintaxis faceted: `title contains 'x'`, `parentId = 'ID'`), `pageSize`, `pageToken` | Busca en Drive por query. Devuelve metadatos (id, name, mimeType, parents, modifiedTime, etc). Paginado. **Crítico para listar carpeta sin walk recursivo.** |
| **list_recent_files** | `orderBy` (recency\|lastModified\|lastModifiedByMe), `pageSize`, `pageToken` | Devuelve archivos recientes del usuario. NO filtra por parentId. |
| **download_file_content** | `fileId` (requerido), `exportMimeType` (si es Google native) | Baja bytes codificados en base64. **Forma de obtener imagen.** |
| **get_file_metadata** | `fileId` (requerido) | Metadatos completos: tamaño, MIME, permisos, owner, timestamps. |
| **get_file_permissions** | `fileId` (requerido) | Lista permisos del archivo (viewers, editors, etc). |
| **read_file_content** | `fileId`, `includeComments` (bool) | NL representation (MIME soportados: Docs, PDF, imágenes PNG/JPEG, Sheets, etc). Para imágenes → texto OCR/leyenda, NO bytes. |

**Crítico**: `search_files` con `parentId = '<folder-id>'` lista contenido directo sin recursión. MimeType `'image/jpeg'` o `'image/png'` distingue imágenes.

---

### 3. PLAN FACTIBLE DE FARMEO (RUN CLAUDE, NOT APP)

**Scope**: Claude corre un script que:
1. Lista carpeta Drive por `folder_id`
2. Matchea archivo→item por código en nombre o jerarquía carpeta
3. Baja bytes, sube a Supabase `catalogo` bucket
4. Inserta en `catalogo_item_fotos`
5. Idempotencia: salta ya existentes
6. Dry-run mode

#### **Flujo**:

```
┌─ Input: Drive folder_id, CSV/mapping de item_codes (ej: {"COL-100":"colId", "MOB-50":"mobId"})
├─ Step 1: search_files(parentId=folder_id) → lista archivos + carpetas
├─ Step 2: Para cada imagen JPG/PNG
│   ├─ Match: busca en nombre o padre-carpeta un código que esté en mapping
│   ├─ Si no match → log + skip
│   ├─ Si match + ya existe en catalogo_item_fotos → skip (idempotencia)
│   └─ Si match + nuevo → 
│       ├─ download_file_content(fileId, exportMimeType='image/jpeg')
│       ├─ base64_string → bytes
│       ├─ Supabase.storage.from('catalogo').upload(`item_<itemId>/<filename>`, bytes)
│       ├─ Insert en catalogo_item_fotos(item_id, url, storage_path, orden)
│       └─ Log: "Farmé COL-100: foto1.jpg"
├─ Step 3: Dry-run: solo log, sin uploads
└─ Output: reporte (cuántas farmeadas, salteadas, errores)
```

#### **Schema Destino** (`catalogo_item_fotos`):

- `item_id` (bigint, FK `catalogo_items.id`)
- `url` (text): URL pública `https://storage.supabase.co/...`
- `storage_path` (text): path interno `item_<itemId>/foto_01.jpg`
- `orden` (int): posición en galería (default 0)
- `es_principal` (boolean): portada (default false → puede setearse en UI luego)
- `alt` (text): leyenda/alt text

#### **Idempotencia**:
- Query before insert:
  ```sql
  SELECT id FROM catalogo_item_fotos 
  WHERE item_id = ? 
    AND storage_path = ?
    AND NOT _deleted
  ```
- Si existe → log skip
- Si no existe → insert

#### **Dry-run**:
```javascript
const dryRun = true;
if (dryRun) {
  console.log(`[DRY] Sumaría ${fileId} a item ${itemId}`);
  return; // sin hacer upload ni insert
}
// ... else: real upload/insert
```

---

### 4. SUPUESTOS CLAVE (VERIFICAR)

1. **MCP está autenticado al Drive de Fede**
   - Se asume que `mcp__67a10dad...` tiene credenciales OAuth2 válidas para el Drive personal
   - `search_files` tiene acceso a todas las carpetas que Fede puede ver
   - ❓ **Verificar**: Está el token vigente y tiene scope `drive.readonly`?

2. **Estructura Drive está clara**
   - Ej: carpeta `/showroom-fotos` → subcarpetas por código (`COL-100/`, `MOB-50/`) o archivos con código en nombre
   - ❓ **Verificar**: Cómo está organizada la carpeta de Fede?

3. **Mapping códigos→item_ids**
   - Script necesita tabla/CSV que diga "COL-100" → item.id = 42
   - Alternativa: query en Supabase: `SELECT id, codigo FROM catalogo_items WHERE codigo = ?`
   - ❓ **Verificar**: Todos los items tienen `codigo` populated?

4. **Supabase Storage `catalogo` está público**
   - Schema SQL línea 66-75: bucket ya existe + RLS abierto para anon read
   - ❓ **Verificar**: `SELECT * FROM storage.buckets WHERE id='catalogo'` → debe existir y `public=true`

5. **No hay colisiones de nombres en Supabase Storage**
   - Path propuesto: `item_<itemId>/<original_filename>`
   - ❓ **Verificar**: Si dos items farman la misma foto (copy en Drive) → distintos paths en storage (ok)

---

### 5. GOTCHAS & VALIDACIONES

1. **MIME types**: Solo `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/avif` permitidos en bucket (schema línea 70)
   - `download_file_content` baja en base64; decodificar a bytes antes de upload

2. **Errores de auth**: Si el MCP pierde credenciales → `download_file_content` fallará
   - Meter try-catch + retry logic con backoff

3. **Tamaño**: Max 10 MB por foto (línea 69)
   - Validar antes de upload: `bytes.length <= 10 * 1024 * 1024`

4. **`es_principal` = true solo 1 por item**
   - Schema comment (línea 43): "el front asegura 1 sola: desmarca las otras"
   - Farmeo: meter todas con `es_principal=false`; UI las ordena luego

5. **Soft delete**: Columna `_deleted` en tabla (línea 46)
   - Query de idempotencia: `WHERE ... AND NOT _deleted`
   - Si user marca deletedo manually → no re-farmear

---

### 6. CÓDIGO PSEUDO (ESTRUCTURA)

```javascript
async function harvestCatalogPhotos(driveFolderId, mapping = null, dryRun = true) {
  const results = { farmeadas: 0, salteadas: 0, errores: [] };

  // 1. Listar todo
  const files = await search_files({
    query: `parentId = '${driveFolderId}' and (mimeType contains 'image/')`,
    pageSize: 100,
  });

  for (const file of files) {
    try {
      // 2. Match código
      let itemId = null;
      if (mapping) {
        const code = extractCodeFromName(file.name);
        itemId = mapping[code];
      } else {
        // Query Supabase: SELECT id FROM catalogo_items WHERE codigo = ?
        const code = extractCodeFromName(file.name);
        const item = await supabaseClient
          .from('catalogo_items')
          .select('id')
          .eq('codigo', code)
          .maybeSingle();
        itemId = item?.data?.id;
      }
      if (!itemId) {
        results.salteadas++;
        console.log(`[SKIP] ${file.name}: no match código`);
        continue;
      }

      // 3. Idempotencia
      const existing = await supabaseClient
        .from('catalogo_item_fotos')
        .select('id')
        .eq('item_id', itemId)
        .eq('storage_path', `item_${itemId}/${file.name}`)
        .eq('_deleted', false)
        .maybeSingle();
      if (existing.data) {
        results.salteadas++;
        console.log(`[SKIP] ${file.name}: ya existe en item ${itemId}`);
        continue;
      }

      // 4. Download + Upload
      if (!dryRun) {
        const b64 = await download_file_content({ fileId: file.id, exportMimeType: 'image/jpeg' });
        const bytes = Buffer.from(b64, 'base64');
        if (bytes.length > 10 * 1024 * 1024) {
          throw new Error('Archivo > 10 MB');
        }
        const storagePath = `item_${itemId}/${file.name}`;
        await supabaseClient.storage
          .from('catalogo')
          .upload(storagePath, bytes, { contentType: file.mimeType, upsert: false });

        // 5. Insert DB
        await supabaseClient
          .from('catalogo_item_fotos')
          .insert({
            item_id: itemId,
            url: `https://storage.supabase.co/.../catalogo/${storagePath}`,
            storage_path: storagePath,
            orden: 0,
            es_principal: false,
          });
        results.farmeadas++;
        console.log(`[OK] ${file.name} → item ${itemId}`);
      } else {
        results.farmeadas++;
        console.log(`[DRY] ${file.name} → item ${itemId}`);
      }
    } catch (e) {
      results.errores.push({ archivo: file.name, error: e.message });
      console.error(`[ERR] ${file.name}:`, e.message);
    }
  }

  return results;
}
```

---

### 7. SIGUIENTE PASO

Antes de ejecutar:
1. ✓ Confirmar folder_id de Fede (ej: `1A2B3C4D5E...`)
2. ✓ Verificar MCP está autenticado (try: `list_recent_files()` → debe listar algo)
3. ✓ Confirmar estructura Drive (ej: archivos con código en nombre, o en carpetas padre)
4. ✓ Confirmar todos los items en `catalogo_items` tienen `codigo` poblado
5. ✓ Correr en dry-run primero: `dryRun=true` → ver qué se farmearía sin hacer cambios

---

**Archivos relevantes:**
- `proyecto-detalle.js` (líneas 1493-1504: extracción ID)
- `sql/catalogo_showroom_f1.sql` (líneas 37-47: schema `catalogo_item_fotos`)
- `api.js` (líneas 1621-1729: CRUD catálogo; línea 5865: ejemplo upload Storage)
- `catalogo.js` (líneas 282-284: cómo se renderizan fotos hoy)
