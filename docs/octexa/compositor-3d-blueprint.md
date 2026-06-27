# Blueprint — Compositor OCTEXA 3D ("el salto")

> **Decidido con Fede (2026-06-27): vamos por el configurador 3D real (Three.js).** El compositor 2D (Parte B, `compositor.js`) queda **deprecado** — se reemplaza, no se mejora.
> Estado: **diseño, para ejecutar en sesión dedicada.** SQL-first, patrón canónico de LOBBY. Hermano del [importador 3ds Max](#) y de la [biblioteca de prediseños](modulo-base-datos-stands-blueprint.md). Programa: [SUPERPLAN](SUPERPLAN-octexa.md).

---

## 0. Rol — por qué existe (y no pisa a 3ds Max ni a la biblioteca)

Los 3 pilares del circuito de stands, cada uno con su trabajo:

| Pilar | Trabajo | Cuándo |
|---|---|---|
| **Biblioteca de prediseños** (Parte A, hecho) | Reusar/ofrecer un stand que YA existe | Lead pide algo parecido a lo de antes |
| **Importador 3ds Max** (destrabado, a construir) | Traer el BOM de un diseño YA hecho en 3ds Max | Diseño fino terminado → cotizar |
| **Compositor 3D** (este doc) | Armar un stand NUEVO **rápido**, con **precio real al instante** y **preview para el cliente**, sin modelar de cero | Etapa temprana / venta / primer armado |

El diferenciador del compositor = lo que 3ds Max **no** da barato: precio en vivo atado a Costos + preview navegable + base exportable. NO es un segundo diseñador; es el "armado express con número". Para diseño custom fino seguís en 3ds Max (y el GLTF que exporta el compositor sirve de bloque base allá).

**Segundo uso (Fede 2026-06-27) — planos de alquiler de mobiliario, sin AutoCAD.** El mismo compositor sirve para componer **layouts de alquiler de mobiliario** (mesas, sillas, etc. en un área) y **exportar un plano PDF** listo — reemplaza el paso por AutoCAD para esos planitos. Es el **win rápido y de menor dependencia** (no necesita el despiece estructural OCTEXA de C-0): área libre + muebles del catálogo + rotación + plano PDF.

---

## 1. Visión — "LEGO de OCTEXA"

Encastrás **piezas OCTEXA reales** sobre la grilla modular, en **3D navegable**, y sale: BOM exacto + precio + preview para la propuesta + export a 3ds Max.

**Lo que lo hace rico (no el croquis pobre de hoy):**
- 3D real (orbit, alturas reales de la escalera 2,40→5,00 m), no plano.
- **Tipo de stand** seleccionable: **centro/línea · esquina · península · isla** (define frentes abiertos, paredes y retiro).
- **Girar el stand entero** (girador del footprint, para orientarlo al pasillo/entrada) **y girar cada pieza** — no solo 90°: al menos 3 orientaciones (eje 1, eje 2 y **diagonal 45°**), en pasos de 45° por clic.
- Piezas OCTEXA con **geometría real** (vitrina mostrador/alta, mostrador, estantería, panel ranurado, cenefa, columnas ø40) — no cajas genéricas — cada una linkeada a Costos.
- **Paredes** que dibujás en el perímetro, altura por lado, respetando el **retiro 1 m** del vecino según topología; cenefa; **zonas de gráfica** (placeholder de marca).
- **Terminaciones**: color de placa, alfombra/tarima → afectan look + BOM.
- **BOM exacto en vivo**: componentes (catálogo) + **estructura derivada de la geometría** (columnas, m de perfil, m² de placa, vidrios) → precio + total mientras armás.
- **Salidas**: guardar escena editable (alimenta la biblioteca) · preview 3D en la propuesta · cotizar · **plano PDF (top-down)** · **export GLTF** a 3ds Max.

---

## 2. Stack / decisiones técnicas

- **Three.js por CDN con import map** en `index.html` (ESM; el stack no tiene bundler). `OrbitControls` + `GLTFExporter` del mismo CDN. **Lazy-load**: el motor 3D se importa dinámicamente recién al abrir el tab (no infla el resto de la app).
- **Vive como tab `compositor` dentro de `#stands`** (igual que hoy), pero en archivo nuevo **`compositor3d.js`** (`Compositor3D`). Se retira `compositor.js` (2D) cuando C-1 esté navegable.
- **Interacción**: colocar/mover por raycast al plano de piso + **snap a la grilla** (medio módulo 495); **rotar la pieza en pasos de 45°** por clic (3+ orientaciones: eje 1, eje 2, diagonal); **girar el stand entero** (control de rotación del footprint); borrar; configurar (altura/terminación); presets de cámara (**planta / iso / perspectiva** — la vista planta = el plano PDF); undo.
- **Render del cliente**: visor Three.js **read-only** reutilizable (embed en la propuesta y, opcional, en la ficha del prediseño).

---

## 3. Datos (SQL-first)

Reusa `proyectos` + `proyecto_componentes` (Parte A). Se agrega:

```sql
-- A) Escena editable del compositor (para reabrir/editar el stand)
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS compositor_escena JSONB;   -- piezas: [{codigo,x,y,rot,altura,terminacion,...}], paredes, piso, cámara

-- B) Piezas OCTEXA: geometría + despiece, keyed por código (matchea catalogo_items.codigo
--    y el mismo código del importador 3ds Max → una sola convención de códigos para todo)
CREATE TABLE IF NOT EXISTS octexa_piezas (
  codigo TEXT PRIMARY KEY,              -- = catalogo_items.codigo
  tipo TEXT,                            -- vitrina_mostrador / vitrina_alta / estanteria / mostrador / panel / columna / perfil / placa / vidrio / cenefa / piso
  ancho_mm NUMERIC, prof_mm NUMERIC, alto_mm NUMERIC,
  geometria JSONB,                      -- params para el mesh (sub-volúmenes: faldón/vidrio/estante, etc.)
  despiece JSONB,                       -- BOM interno: [{codigo_sub, cantidad}] (P0 OCTEXA)
  _deleted BOOLEAN DEFAULT false
);
-- RLS: 4 políticas con fn_role_can('stands','read'|'write'). octexa_piezas puede ser read-amplio.
```

> **Convención de códigos única:** el mismo `codigo` ata catálogo (precio) ↔ octexa_piezas (geometría/despiece) ↔ export de 3ds Max (importador). Un solo idioma de piezas para los 3 pilares.

---

## 4. Motor de geometría

- Grilla **990 (módulo) / 495 (medio)**, columnas **ø40** en cada cruce, alturas escalera **2400/2900/3400/3900/5000**, prof estándar 500 (de `octexa-data.json`).
- **Dos modos de footprint**: **(a) Stand OCTEXA** = topología + frente×fondo×altura → esqueleto paramétrico (columnas + perfiles de perímetro + paredes según topología y **retiro 1 m**). Topologías: **centro/línea** (3 lados cerrados, 1 frente) · **esquina** (2 cerrados) · **península** (1 cerrado) · **isla** (0). **(b) Área libre** = solo ancho×fondo en m, sin estructura OCTEXA → para layouts de **alquiler de mobiliario** (mesas/sillas/etc.) que terminan en plano PDF.
- **Girar el stand entero** (rotación del footprint completo) + **girar cada pieza** en pasos de 45° (eje 1 / eje 2 / diagonal).
- **Piezas** = meshes paramétricos desde `octexa_piezas.geometria` (no cajas). Muebles = ítems del catálogo con footprint 2D para el plano. Snap a la grilla.

---

## 5. BOM + precio

- **Componentes colocados** → `catalogo_items` por código → `precio_alquiler` (Costos). (exacto desde el día 1).
- **Estructura derivada** de la geometría (columnas, m de perfil, m² de placa, vidrios) → match a ítems de Costos por código.
  - **v1 = estimación** (regla geométrica, como hoy, pero más fina con alturas/paredes reales).
  - **exacto** cuando esté cargado el despiece (`octexa_piezas.despiece` + ítems estructurales en Costos) → **C-0**.
- Total en vivo. Guardar → mirror a `proyecto_componentes` (para la ficha de prediseño y "Usar en cotización" ya existentes).

---

## 6. Salidas

- **Guardar** como `proyecto` (es_prediseno opcional) + `compositor_escena` (reabrir/editar) + `proyecto_componentes` (BOM).
- **Plano PDF (top-down)** — la vista en planta proyectada a PDF con cotas + leyenda/BOM + carátula MEPEX (jsPDF, ya cargado). **Reemplaza el paso por AutoCAD** para los planitos de alquiler de mobiliario. Sirve igual para el plano del stand.
- **Preview 3D** read-only para la propuesta / ficha de prediseño.
- **Cotizar** → reusa `StandsModule._usarEnCotizacion`.
- **Export GLTF** (`.glb`) → bloque base para 3ds Max.

---

## 7. Fases

| Fase | Qué | Entregable | Depende |
|---|---|---|---|
| **C-0** | Datos OCTEXA: cargar `octexa_piezas` (geometría + despiece) + ítems estructurales en Costos. | Piezas con geometría y precio | P0 de `octexa-data.json` (despiece) |
| **C-1** | Motor 3D base (Three.js, lazy): escena, grilla, cámara orbital, **esqueleto paramétrico** (footprint → columnas/perfiles/paredes). | Stand "vacío" 3D navegable | — |
| **C-2** | Colocar/mover/**rotar 45°**/snap en 3D + **girar el stand entero** + modo **área libre**. Paleta de piezas/muebles del catálogo. | Componer con piezas reales | geometría básica |
| **C-2.5 ⭐** | **Alquiler de mobiliario + exportador de plano PDF (top-down, cotas + leyenda + carátula).** Win rápido y de baja dependencia (no necesita C-0 ni la estructura OCTEXA). **Reemplaza AutoCAD** para esos planitos. | Planito PDF de mobiliario sin AutoCAD | C-2 |
| **C-3** | Paredes/cenefa/gráficas/pisos/colores (presentable al cliente). | Stand "vestido" | C-2 |
| **C-4** | BOM exacto + precio (componentes + estructura derivada → Costos). | Diseño→BOM→precio cerrado | C-0 (despiece) |
| **C-5** | Salidas: guardar/editar escena · preview propuesta · cotizar · export GLTF. | Circuito completo | C-1..C-4 |
| **C-6** | Inteligencia (futuro): arrancar de un prediseño y variar · sugerir layout por m²/rubro · validar reglas OCTEXA (alturas/refuerzo/Maxima) · **render IA desde la vista 3D** (pipeline del programa OCTEXA). | — | C-5 |

> **C-1 entrega valor solo** (stand 3D navegable) aunque C-0 no esté. El **único cuello para el BOM estructural exacto = C-0** (los componentes ya tienen precio sin C-0).
> **C-2.5 (mobiliario + plano PDF) es el primer valor entregable real** y no depende de C-0 ni de la estructura OCTEXA → buen candidato a salir primero (reemplaza AutoCAD para alquiler de mobiliario) mientras se completa el dato OCTEXA para el lado stand.

---

## 8. Decisiones abiertas (defaults propuestos)

- **Escena**: JSONB en `proyectos.compositor_escena` (recomendado) vs tabla aparte. → JSONB (simple, reabre fácil).
- **Nivel de BOM estructural v1**: estimación primero, exacto con C-0. → así.
- **Versión Three.js**: fijar una (r1xx) por CDN con importmap. → fijar al construir C-1.
- **Preview cliente**: visor read-only embebible (mismo motor, sin edición). → sí.
- **Pendiente de Fede**: ¿cuántas piezas OCTEXA "tipo" entran en C-0 (las 6 del catálogo data + columnas/perfiles/placas)? ¿Tenemos el despiece de al menos las 6 más usadas para arrancar exacto, o arrancamos con geometría + estimación?

---

## 9. Conexiones

- [Biblioteca de prediseños](modulo-base-datos-stands-blueprint.md) · importador 3ds Max (mismo `codigo`) · **Costos** (precio, fuente de verdad) · [Catálogo/Showroom](#) (ítems codeados) · [programa OCTEXA](SUPERPLAN-octexa.md) (render IA en C-6).
- Memorias: [[project_stands_predisenos]] · [[feedback_compositor_vs_3dsmax]] · [[project_octexa_stand_designer]].
