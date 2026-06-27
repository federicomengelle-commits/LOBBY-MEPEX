# HANDOFF — Compositor de stands (próxima charla)

> Autocontenido para seguir el compositor en un chat nuevo. Leé también, en este orden:
> `docs/octexa/compositor-3d-blueprint.md` (plan), `docs/octexa/octexa-data.json` (motor + `.estructura`),
> memoria `project_stands_predisenos` + `feedback_compositor_vs_3dsmax`, y `CLAUDE.md` raíz.
> Reglas: branch → **push directo a main** (`git push origin HEAD:main`); SQL-first; verificar offline con `node` (el render visual/SVG/PDF NO se puede en headless → lo verifica Fede tras `~/pull-lobby.sh`); árbol compartido (otras charlas tocan `index.html`/`data.js` → `git add` SOLO lo propio, bumpear `?v=`).

---

## 0. Qué es el compositor (la visión, ya consensuada con Fede)

Un **capturador de ideas / distribuidor de espacios** rápido, **todo tuneable** — NO un CAD estructural. Setear superficie → base tuneable → ir agregando elementos redimensionables → distribuir → **plano PDF** + cotizar. El despiece estructural exacto NO es su trabajo (eso es el importador 3ds Max, otro pilar). Vive como tab **🧩 Compositor** dentro de `#stands`.

**Modelo de escena:** `CompositorModule._state.placed[]`, cada elemento `{ uid, kind, x, y, w, d, rot, … }` en **mm**. `kind`:
- `item` → ítem del catálogo (Costos), **facturable** (entra al BOM, tiene `catId`/`precio`).
- `zona` → bloque de espacio (Exhibición/Reunión/…); visual, no factura.
- `pieza` → dibujito de `CompositorPiezas` (mesa/silla/vitrina/puerta/preset); visual, no factura; tiene `glyph`.

## 1. Estado actual — HECHO + PUSHEADO (hasta commit `cde391d`)

Archivos: **`compositor.js?v=15`** · **`compositor-piezas.js?v=1`** · **`plano-pdf.js?v=7`** · `stands.js?v=2` · registrados en `index.html`.

> **⏳ Sesión 2026-06-27 (charla pulido) — §2.1 + §2.2 + §2.3 HECHAS y pusheadas (`2249335`/`4829622`/`2f51d26`), FALTA verificación visual de Fede (el render SVG/PDF no se puede en headless).**
> - **§2.1 Texto libre + Alinear** (`v=10`/`plano v=4`): `kind:'texto'` (botón "＋ Texto", rótulo editable inline, redimensionable, girable, no factura, va al PDF en navy) · "⊹ Centrar" → "⊹ Alinear ▾" (ContextMenu: centrar/pegar a cada borde/centrar por eje).
> - **§2.2 Agrupar / multi-selección** (`v=11`): Shift/Ctrl-clic, drag del grupo junto, Agrupar/Desagrupar (`groupId`, viaja en undo), Distribuir ▾ H/V, Alinear ▾ entre sí, Duplicar/Bloquear/Quitar el set. Modelo `_selUid` (primaria) + `_selSet`.
> - **§2.3 Plano PDF "como la gente"** (`v=12`/`plano v=5`): reescrito al estilo de los planos reales (escuadras navy, logo centrado, carátula CLIENTE/PROYECTO, sin leyenda lateral, rótulos sobre cada pieza, paredes navy, columnas huecas, cotas módulo azul + overall rosa nominal). Nuevo campo "Cliente (carátula)". Spec: `docs/octexa/planos-ref/ESTILO-plano-pdf.md`.
> - **Verificación:** `node --check` + smoke DOM-stub (41 §2.1 / 32 §2.2 / 21 PDF, 0 fails). **Fede: `~/pull-lobby.sh` → verificar visual** (texto, multi-selección+grupos+distribuir, y sobre todo **generar un plano PDF real** y comparar con A.Laciar/Cedent).
> **⏳ Sesión 2026-06-27 (cont.) — B1 (`12ef167`) + B2 (`c37431d`): pulido de versatilidad. `compositor.js?v=14`·`plano-pdf.js?v=7`.**
> - **B1 — Lote + Toggle Líneas/Paneleado:** campo **Lote** en la carátula (CLIENTE/PROYECTO/LOTE) · **`_state.vista`** = `lineas` (solo contorno, para distribuir) | `paneleado` (estructura, producción); aplica a canvas y PDF.
> - **B2 — paneles por lado + módulos variables:** clic en un lado → **`_state.panelOverride`** pone/saca panel (paredes, columnas y estructura se derivan de los lados con panel) · clic en un módulo → **cicla 950/455/660** (`_state.mods` por lado; **"tamaño manda"** = anotación, NO re-tila el footprint → el despiece exacto lo hace el importador 3ds Max). La cota de módulo dejó de ser fija "950": se rotula el ancho real por panel, en canvas y en el PDF (cotas por lado back/front/left/right; la overall rosa se corre si el lado tiene módulos).
> - **Verificación:** node --check + smoke DOM-stub **137/137** (0 regresión). **Fede: verificar visual** — toggle, clic en lados, clic en módulos, y generar un PDF con módulos variables.
> - **B3 — Infra vs Equipamiento ✅ HECHO** (`cde391d`, `compositor.js?v=15`): clasificación por keyword sobre rubro+nombre (infra = panel/columna/perfil/cenefa/estructura/aluminio…; equip = vitrinas/mostradores/estanterías/exhibidores = default) + **flag por pieza** con override (chip 🏗 Infra / 🪑 Equip en el strip) + **BOM en 2 secciones** (Infraestructura / Equipamiento) con subtotal + total. Smoke 20/20.
> - **A confirmar al verificar el PDF:** (a) ¿quiere la **lista de equipamiento** en un rincón? (la saqué para igualar los planos reales; ver mockup); (b) afinar mm de carátula/cotas/rótulos si algo está corrido.

- **Dos modos:** 🏗️ Stand OCTEXA (topología centro/esquina/península/isla + grilla 990/495 + columnas en los **nodos de las paredes** + paredes) · 🪑 Área libre (m, para alquiler de mobiliario). m² **nominal** (1 módulo = 1 m → 6×3 = 18 m²).
- **Colocar/mover** con snap (495 OCTEXA / 250 área), **redimensionar arrastrando** un handle (esquina inf-der; re-render al soltar para que el glyph escale).
- **Zonas** (chips por color) + **Piezas con dibujitos** (`CompositorPiezas`: 23 piezas en 7 rubros — Mesas/Asientos/Living/Aberturas/Stand/Deco/Conjuntos; mesa Ø70=círculo, banqueta 50×50, puertas pivotante con arco de barrido y plegadiza acordeón, presets mesa+3 banquetas / juego living / mesa reunión+4 sillas) + **Catálogo** (Costos, facturable).
- **Botones por pieza** (barra del seleccionado): ⧉ Duplicar · ⊞ Fila (×N, modal) · ↻ 45° · ⊹ Centrar · ⤒/⤓ z-order · 🔒 Bloquear · ✕ Quitar. **Globales:** ↶/↷ Deshacer/Rehacer (+ Ctrl+Z/Ctrl+Y) · ⟳ Girar todo 90° · ⇋ Espejar · Vaciar.
- **Plano PDF** (`PlanoPDF.generate`, jsPDF) + **Guardar** como `proyecto` (STAND/MOBILIARIO) + `proyecto_componentes` + **Cotizar** (reusa `StandsModule._usarEnCotizacion`).
- **Undo:** `_pushHist()` (snapshot JSON via `_capture()`) al inicio de cada mutador; drag/resize pushean en el 1er move.

**Bugs ya arreglados (no repetir):** `proyectos.created_from` tiene CHECK `proyectos_created_from_check` que **rechaza `'compositor'`/`'stands'`** → usar **`'manual'`** (válidos: manual/crm/crm_caso). · `_placePieza` no seteaba x/y (piezas en NaN) → arreglado. · resize crasheaba en piezas (no tienen `.cmp-comp-rect`) → guardas + re-render al soltar.

## 2. COLA DE TRABAJO (en orden)

### 2.1 ✅ HECHO (2026-06-27) — Texto/etiqueta libre + Alinear
**Texto libre** (nuevo `kind:'texto'`):
- Botón "＋ Texto" (global). `_placeTexto()` → push `{uid, kind:'texto', texto:'Texto', x,y,w:1500,d:400, rot:0}`.
- Render en `_renderPlanta`: rama `kind==='texto'` → `<rect transparent class="cmp-hit"/>` + `<text font-size≈d*0.6 anchor=middle>` + selbox/handle si seleccionado.
- Editar: en `_renderSelStrip`, si `kind==='texto'`, mostrar un input de texto (además del size) que setea `p.texto` (+ `p.nombre`) y re-renderiza.
- PDF: en `plano-pdf.js` loop de `pieces`, si `kind==='texto'` dibujar `doc.text` (navy) escalado; pasar `kind`+`texto` en el map de `_exportPlano`. No entra al BOM (ya `kind!=='item'`).

**Alinear** (pieza única; *distribuir* va con Agrupar — necesita multi-selección):
- Reemplazar el botón "⊹ Centrar" por "⊹ Alinear ▾" que abre `ContextMenu.show(x, y, items)` con: Centrar · Pegar izquierda/derecha/arriba/abajo (set `p.x`/`p.y` a 0 o `W-w`/`D-d`). Cada uno: `_pushHist()` + set + `_clampAll()` + `_afterChange(false)`.
- **API de ContextMenu** (ya verificada en `crm.js`): `ContextMenu.show(clientX, clientY, items)`. Mirar el shape exacto de `items` en `components.js` antes de usar (label + handler).

### 2.2 ✅ HECHO (2026-06-27) — Agrupar (multi-selección)
Cambia el modelo de selección: `_selUid` → `_selSet` (array). Shift/Ctrl-clic agrega/saca; drag mueve todo el set junto; "Agrupar" asigna `groupId` (clic en un miembro selecciona todo el grupo); "Desagrupar". Con multi-selección habilitar **Distribuir** (repartir parejo N piezas, ej. vitrinas equiespaciadas). Es la más invasiva → hacerla sola y testear bien en `node`.

### 2.3 ✅ HECHO (2026-06-27, ⏳ falta verificación visual de Fede) — Plano PDF "como la gente"
Fede mandó sus **planos reales** (A.Laciar v53, Cedent V83/84) → estilo extraído en `docs/octexa/planos-ref/ESTILO-plano-pdf.md` y aplicado en `plano-pdf.js?v=5`. Lo construido (todo line-art, A4 apaisado):
- **Marco** con corchetes en L en las 4 esquinas de la hoja (navy).
- **Logo MEPEX centrado arriba** (turquesa); bloque **`CLIENTE: …` / `PROYECTO: …`** abajo-izquierda (pasar `cliente` en opts; hoy no se setea → agregar campo o usar el nombre).
- Plan centrado, **sin** la leyenda lateral grande (los planos reales no la tienen); lista de equipamiento compacta opcional en un rincón.
- **Paredes en DOBLE LÍNEA** (espesor) sobre los lados cerrados; **columnas = circulitos** en los nodos (ya tengo `_columnsXY`); **cotas por módulo** (950/455) entre nodos + **cotas overall** (W×D, estilo magenta con flechas/ticks).
- Vitrinas/mostradores **rotulados sobre la pared** (texto rotado), mobiliario como símbolo (ya hay glyphs), zonas sutiles.
- Paleta de líneas: navy estructura, azul labels, magenta cotas, turquesa logo.

### 2.4 "Las 3 sirven" (Fede) — base del MVP
(A) lienzo libre + zonas/piezas resizables = HECHO. Faltan: **(B) plantillas base tuneables** (arrancar de un stand base ya armado y ajustarlo; guardar escena como plantilla — requiere `proyectos.compositor_escena JSONB`, ALTER del blueprint §3, aún sin correr) · **(C) desde el brief** (m²+rubro+necesidades → propone base).

## 3. Pendientes de Fede (infra / datos)
- **Parte A (Prediseñados):** correr `sql/stands_predisenos.sql` (RLS de `proyecto_componentes`) + crear bucket privado `stands` + `~/pull-lobby.sh`. (El compositor NO depende de esto; sí el alta de prediseños con render.)
- **Compositor:** `~/pull-lobby.sh` para ver lo último (`compositor.js?v=9`). Pasar **tamaños/piezas faltantes** para `CompositorPiezas.LIB`. ¿Piezas facturables (link a Costos)? = decisión.
- **Plano PDF:** si querés que arranque por el pro-template, dejar 1-2 planos reales en `docs/octexa/planos-ref/` (o describir el bloque de carátula exacto: qué campos van).

## 4. Contexto técnico clave (no re-descubrir)
- **Globals:** `supabaseClient` · `API.*` · `Auth` · `Modal`/`ContextMenu`/`Toast`/`Confirm` · `Router` · `StandsModule` · `CompositorPiezas` · `PlanoPDF` · `escHtml/escAttr`.
- **OCTEXA (de Fede):** sistema mecano = grafo de paños. Paño = 1 placa + 2 perfiles + columnas ø40 en los **nodos** (donde hay panelería, NO en cada cruce). entre ejes = perfil 950 + columna 40 = 990. Pared N módulos → N placas/2N perfiles/N+1 columnas. Cruz → 5 col/4 placas/8 perfiles. (Detalle en `octexa-data.json.estructura` + blueprint §4.0.)
- **Render:** `_renderPlanta()` arma el `<svg>` (coords en mm, viewBox + margen 700) y `_attachDrag()` re-bindea pointer events. Cada elemento = `<g class="cmp-comp …" data-uid transform="translate(x,y) rotate(rot, w/2,d/2)">`. **Re-render destruye el pointer capture** → por eso el resize hace update directo de atributos y re-render solo al soltar.
- **Verificación:** `node --check` + tests con **DOM-stub** (ver el patrón en los smoke tests de esta sesión: stub de `document`/`escHtml`/`Toast`/`CompositorPiezas` y llamar métodos). Cazó bugs reales (x/y NaN). El PDF/SVG visual lo valida Fede.

## 5. Cómo empezar el chat nuevo
1. `git fetch origin && git status` (asegurá `8b18baa`+ y árbol limpio; otras charlas pueden haber avanzado).
2. Leé este handoff + los docs del encabezado.
3. **2.1 + 2.2 + 2.3 ya están** (ver §1). Lo próximo: **verificación visual de Fede del plano PDF** (generar uno real y comparar con A.Laciar/Cedent; afinar lo que marque), y después **2.4 (plantillas base + brief)**.
4. Cada feature: construir → `node --check` + smoke DOM-stub → bump `?v=` → commit → push main → avisar a Fede que pullee y verifique visual.
