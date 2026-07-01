# COTIZADOR-MEPEX — Respuestas de contexto (para el LOBBY)

> **Quién responde:** la sesión de Claude que trabaja dentro del código del **Cotizador**.
> **Cómo:** leyendo el código real del repo (no de memoria). Cada punto está marcado **[real]**
> (implementado y verificado en el código hoy) o **[planeado]** (idea/roadmap, aún no existe).
> **Fecha:** 2026-07-01. **Commit base:** `main` (último handoff `6171705` + trabajo de propuestas).
> **Convención:** cito archivos como `archivo.js:línea`. Los ejemplos de clientes van anonimizados.

⚠️ **Nota de reconciliación importante para el LOBBY:** el doc de auditoría `.audit/schema_dump.md`
(20-may-2026) dice que el cotizador "IGNORA `precio_alquiler` y `es_cotizable`". **Eso ya NO es
cierto** (era verdad en mayo). Hoy el server filtra `es_cotizable=true` y usa `precio_alquiler`
como precio (`server/index.js:93` y `:238`). Donde el schema_dump y el código difieran, **manda el
código** y lo aclaro abajo.

---

## 0. Identidad rápida

- **[real] Nombre/repo:** `COTIZADOR-MEPEX` — `github.com/federicomengelle-commits/COTIZADOR-MEPEX` (privado).
  SPA vanilla JS para cotizar **stands / expos / alquiler** de estructuras para ferias y eventos.
- **[real] Stack real** (NO es "Notion + Railway/Vercel" — eso es legacy ya removido):
  - **Frontend:** Vanilla JS ES6+, SPA de una sola página (`index.html`, 3 columnas). Sin framework.
  - **PDF cotización:** jsPDF 2.5.1 (CDN), tema dark turquesa. `script.js` `exportPDF`.
  - **PDF propuesta comercial:** motor **weasyprint (Python/HTML+CSS)** desacoplado, servicio aparte
    `/propuesta-api` (ver §4/§5).
  - **Backend:** Express (`server/index.js`, ~1200 líneas). Node 18+ (usa `fetch` nativo).
  - **DB/Auth/Storage:** **Supabase** (`selnevalaeykdrgycvdz.supabase.co`) — **la misma del LOBBY**.
  - **IA:** Claude **Haiku 4.5** vía backend (`ANTHROPIC_MODEL` default `claude-haiku-4-5`,
    `server/index.js:1023`). Nunca desde el front.
  - **Infra:** VPS Hostinger `195.200.1.250` (Ubuntu 24.04), proceso `cotizador-api` bajo **pm2**.
  - Legacy eliminado/por-eliminar: Notion (`migrate-notion-to-supabase.js`, `NOTION_INTEGRATION.md`).
- **[real] URLs:**
  - Producción: **`http://195.200.1.250/cotizador/`** (front) + `/cotizador-api/api` (backend).
  - **No existe** deploy en Vercel/Railway. `cotizador-mepex.vercel.app` **no aplica**. Hay un solo
    deploy real (el del VPS). En local el front pega a `http://localhost:3001/api` (`api.js:9-11`).
- **[real] Login/usuarios:** el SPA **carga directo al cotizador**, sin pantalla de login propia
  (`index.html` no tiene gate de auth). Comparte la instancia Supabase con el LOBBY. Hay un objeto
  `Auth` referenciado para `vendedor_id`, pero **hoy `vendedor_id` está NULL en todas las
  cotizaciones** (el uid no se está poblando — ver §9). Es una herramienta **interna** (la usa el
  equipo comercial de MEPEX), no pública.

---

## 1. Para qué es (visión y límites)

**1.1 [real] Qué problema resuelve y cuándo se usa.**
El Cotizador es la herramienta con la que el **equipo comercial de MEPEX** arma el **presupuesto y
la propuesta comercial** de un stand/expo. Se usa en el momento **pre-venta**: llega un pedido
(cliente + evento + necesidades), y el vendedor selecciona ítems del catálogo (paneles OCTEXA,
piso, iluminación, mobiliario, gráfica, servicios), define parámetros (superficie, tipo de stand,
altura), y el sistema calcula precios y produce dos documentos en PDF (el **presupuesto** con
números y la **propuesta comercial** linda para mandar al cliente). Lo usan **vendedores/PMs**; Fede
es el dueño que define las reglas.

**1.2 [real] Qué NO hace (los límites):**
- **No diseña el stand en 3D.** No genera planos, layouts ni renders. El diseño "lindo" lo hace Fede
  en **3ds Max**; el cotizador solo **consume** imágenes que se le suben (ver §4/§8).
- **No administra el catálogo ni los costos.** El cotizador **solo lee** `catalogo_items`. El alta/
  edición de ítems, márgenes y precios vive en el módulo **Costos del LOBBY** (`es_cotizable`,
  `precio_alquiler`, `tipo_receta`, `margen_*`, etc. son de LOBBY).
- **No gestiona el ciclo de vida comercial** (estados de la cotización, seguimiento, facturación,
  asignación a proyecto/evento). Eso es el **CRM del LOBBY**. El cotizador escribe la cotización y
  listo; el LOBBY la asigna a proyecto/evento después.
- **No hace facturación** (las columnas `pyme_*` de `cotizaciones` son de la integración de
  facturación del LOBBY; el cotizador no las toca).
- **No importa CSV/BOM** todavía (ver §3 — es [planeado]).

**1.3 [real] El corte en una frase:**
> **"Yo (Cotizador) convierto una necesidad + un catálogo de piezas en precios y en los dos PDFs
> (presupuesto y propuesta). Vos (LOBBY) sos el dueño del catálogo/costos, del CRM (clientes,
> proyectos, eventos, estados) y de la facturación."**

---

## 2. Inputs — BRIEFS

**2.1 [real] Qué es un "brief" acá.**
Hay dos formas de "entrada" al cotizador:
1. **Carga directa** (lo normal): el vendedor elige ítems y setea parámetros a mano en la UI.
2. **Brief Express** (`brief.js`): un modal de **10 preguntas** tipo ping-pong (chips de opción) +
   un campo libre de "Notas de la reunión". Es un **formulario estructurado + texto libre opcional**.

Los 10 campos del Brief Express (`brief.js:12-32`):

| # | Campo | Tipo | Opciones |
|---|---|---|---|
| 1 | Cliente y evento | texto | (libre) |
| 2 | Superficie (m²) | single + "Otro…" | 9 / 18 / 36 / 54 |
| 3 | Ubicación | single | Isla / Esquina / Península / Contra pared |
| 4 | Altura | single | 2,5m / 3,0m / Plus 3,5m / 4,0m / 5,0m |
| 5 | Piso | single | Alfombra ferial / Tarima / Vinílico símil madera / Tarima alta |
| 6 | Gráfica | single | Poca ~30% / Media ~60% / Full ~100% |
| 7 | Iluminación | single | Básica / Destacada / Premium |
| 8 | Atención al público | multi | Mostrador / Banquetas / Mesa reunión / Exhibidores / Depósito cerrado |
| 9 | Electrónica | multi | Smart TV / Pantalla LED / Heladera / Dispenser / Cargadores |
| 10 | Servicios y logística | multi | Diseño 3D+render / Azafatas / AV / Flete / Catering / Sonido / Plantas / Limpieza / Seguridad |
| + | Notas de la reunión | textarea | (libre, opcional) |

**2.2 [real] Un brief de ejemplo real (anonimizado), tal cual se compila para la IA.**
Las respuestas se compilan a **texto en lenguaje natural** (`brief.js:130-147` `_briefText`) que es
lo que entra a `/api/ai/brief`:

```text
Cliente: Laboratorios Acme.
Evento: Expo Salud 2026.
Superficie: 36 m².
Ubicación: esquina (2 lados).
Altura: 3,5m.
Piso: Vinílico símil madera.
Cobertura de gráfica: 60% de la superficie.
Iluminación: Destacada.
Atención al público: Mostrador, Banquetas, Depósito cerrado.
Electrónica/electrodomésticos: Smart TV, Heladera.
Servicios y logística: Diseño 3D + render, Flete / logística, Limpieza.
Notas de la reunión: Quieren look premium, marca muy presente. Presupuesto acotado. Fecha ajustada.
```

**2.3 [real] Cómo se procesa el brief para volverse cotización.**
Sí hay IA. **Proveedor/modelo:** Claude **Haiku 4.5** (backend). Flujo:
1. El front manda el texto del brief **+ el catálogo real** (id·nombre·rubro·unidad) a
   `POST /api/ai/brief` (`brief.js:181`, `api.js:92`).
2. El backend (`server/index.js:1159-1179`) le pide a Haiku **exclusivamente un JSON**. Prompt system
   (verbatim):
   ```text
   Sos un asistente de cotización de MEPEX. A partir de un brief de reunión y un catálogo de ítems,
   devolvés EXCLUSIVAMENTE un JSON válido (sin texto extra) con esta forma:
   {"params":{"tipo":"stand|expo|alquiler","superficie":number,
     "standType":"centro|esquina|peninsula|isla","altura":"standard|media|plus|extra|maxima"},
    "items":[{"id":"<id del catalogo>","cantidad":number,"confianza":0a1}],"notas":"string"}.
   Elegí SOLO ids que existan en el catálogo provisto. Si dudás de un ítem, incluilo igual con
   confianza baja (<0.5). No inventes ids ni cantidades absurdas.
   ```
3. El front **muestra un PREVIEW** (parámetros + ítems, marcando los de baja confianza con ◇) y un
   total estimado con el mismo motor `Pricing.compute`. **El humano confirma** ("Aplicar al
   cotizador"), que dispara los controles reales de la UI (`brief.js:236-270`).
4. **Si la IA está apagada** (`ANTHROPIC_API_KEY` ausente) el brief **degrada**: aplica solo los
   parámetros (superficie/tipo/altura), sin autocompletar ítems. El endpoint devuelve 503 y el front
   lo tolera.

> Es decir: la IA **mapea texto → ítems del catálogo real** (no inventa), y **un humano siempre
> revisa** antes de aplicar. No hay plantillas rígidas; la "plantilla" es el catálogo + las reglas
> de pricing.

---

## 3. Inputs — CSVs

**3.1 / 3.2 / 3.3 — [real] Aclaración honesta: el cotizador NO carga ningún CSV.**
Busqué `FileReader`/`csv`/`parse` de CSV en el front: **no existe importador de CSV** en `script.js`
ni en ningún módulo. El único CSV del sistema es de **salida** (export), no de entrada:

- **CSV = OUTPUT [real]:** `script.js` `handleExportCSV` (~`:3418`). Exporta la cotización actual a
  un `.csv` (RFC-4180 + BOM UTF-8 para Excel). Columnas:
  `Espacio | Categoría | Código | Item | Unidad | Cantidad | Precio Base | Precio c/ajustes | Subtotal`,
  con bloque de metadata arriba (cliente/proyecto/evento/tipo/superficie) y 3 filas de total
  (Subtotal / IVA 21% / TOTAL). Filename `MEPEX_<cliente>_<AAAA-MM-DD>.csv`.

  Ejemplo (2-3 filas, anonimizado):
  ```csv
  MEPEX — Cotización
  Cliente,Laboratorios Acme
  Tipo,STAND
  Superficie,36m²
  Espacio,Categoría,Código,Item,Unidad,Cantidad,Precio Base,Precio c/ajustes,Subtotal
  ,Infraestructura,PAN-100,Panel modular OCTEXA 1x2m,unidad,24,27650.00,30415.00,729960.00
  ,Pisos,ALF-003,Alfombra ferial,m²,36,6900.00,6900.00,248400.00
  ,,,,,,,Subtotal,978360.00
  ,,,,,,,IVA (21%),205455.60
  ,,,,,,,TOTAL,1183815.60
  ```

- **CSV/BOM = INPUT → [planeado].** El propio doc de auditoría lo lista como mejora estratégica
  ("importador CSV", `.audit/01_mapa_arquitectonico.md:114`). **Hoy no existe.** Si el LOBBY imagina
  un "3ds Max → CSV/BOM → cotización", ese importador **habría que construirlo** (ver §8.3).

> **Para el LOBBY:** no hay un formato CSV que el cotizador espere hoy. Si se define uno (BOM desde
> 3ds Max), conviene diseñarlo de cero y de forma compartida.

---

## 4. El motor de AUTO-DISEÑO / AUTO-PROPUESTA

**4.1 [real] Qué genera "solo" vs. qué es manual.**
El cotizador **no auto-diseña un stand**. Lo que automatiza es la **construcción del presupuesto y
de la propuesta comercial**. Reparto real:

| Pieza | ¿Automático? | Dónde |
|---|---|---|
| Selección de ítems desde un brief | **Semi** (IA sugiere, humano confirma) | `/api/ai/brief` |
| Sugerencias "fantasma" de cross-sell | **Sí** (reglas de afinidad + refina IA) | `script.js` `_renderGhosts`/`_ruleGhosts` + `/api/ai/ghosts` |
| Cantidades por m² (piso, alfombra…) | **Sí** (cantidad = superficie) | `State._autoQuantityFor` + `DB.isAreaItem` |
| Precios (altura, modificador, fee, IVA, redondeo) | **Sí** (fórmula única) | `pricing.js` |
| Texto comercial de la propuesta ("sanata") | **Sí** (IA, editable) | `/api/ai/sanata` |
| Los dos PDFs (presupuesto + propuesta) | **Sí** (armado y layout) | jsPDF / weasyprint |
| **Diseño 3D, plano, render visual** | **NO** — lo hace Fede en 3ds Max | (externo, ver §8) |
| Datos del cliente/evento | Manual (autocomplete desde LOBBY) | `autocomplete.js` |

**4.2 [real] ¿Genera imágenes/renders/planos? NO.**
No hay IA generativa de imágenes ni motor de layout. Los **renders son fotos que Fede sube** (JPG/
PNG desde 3ds Max) en el paso previo a "Exportar propuesta" (`propuesta.js` `openRenderStep`). Sobre
cada render subido el usuario puede:
- reordenarlos (la 1ª va en la **carátula**),
- **"acotar"**: marcar features con líneas guía tipo plano (`openAcotar`, guarda
  `anotaciones[{label, tx, ty, lx, ly}]` en %), eligiendo el título de un chip
  (`_RENDER_PHRASES`: "Mostrador de atención", "Sistema modular OCTEXA", etc.) o escribiéndolo.

Las imágenes se **downscalean a JPEG** (con relleno blanco para PNG transparentes) y se mandan como
data-URI dentro del JSON al motor de propuestas. Hay además un endpoint de **visión**
`POST /api/ai/render-caption` (Haiku mirando la imagen, `server/index.js:1071`) que puede sugerir un
epígrafe — pero el **autocaption-al-subir se removió** (generaba textos repetidos); hoy los acotes
son manuales con chips.

**4.3 [real] Dónde viven las reglas de negocio y de costeo (el "cerebro").**
Repartidas en 3 lugares:
1. **Precios y catálogo → Supabase `catalogo_items`** (lo administra **Costos del LOBBY**). El
   cotizador lee `precio_alquiler` (redondeado a entero), `rubro`, `categoria`, `unidad`, `codigo`,
   `familia`/`medida_mm`. **No es un cerebro del cotizador; es del LOBBY.**
2. **La fórmula → `pricing.js`** (fuente única). Ajustes (modificador + fee) **sumados** sobre el
   subtotal, altura solo en Infraestructura+Iluminación, IVA 21% al final, **redondeo al peso por
   línea**. (Detalle en §5.2.)
3. **Multiplicadores/afinidades → `database.js`** (hardcodeado en el front): multiplicadores de
   altura (Estándar 1.0 → Máxima 1.35), categorías afectadas por altura, fee default 10%, y el mapeo
   de rubros a 6 keys internas.

**4.4 [real] Qué tan "diseñada" queda la propuesta.**
Es una **plantilla comercial linda con los ítems + el precio + los renders que subió Fede**, NO un
diseño real de stand. La propuesta (weasyprint) tiene carátula membretada MEPEX, reseña, detalle por
rubro/espacio y los renders acotados. El "diseño real" (geometría, materiales) siempre vive afuera,
en 3ds Max.

---

## 5. Outputs — la PROPUESTA / cotización

**5.1 [real] Qué entrega al final.** Cuatro cosas, no una:
1. **PDF "Presupuesto"** (jsPDF, `script.js` `exportPDF`): el documento con números, tema dark
   turquesa. Botón "Exportar presupuesto".
2. **PDF "Propuesta"** (weasyprint `/propuesta-api`, `propuesta.js`): el documento comercial lindo a
   sangre con carátula + renders. Botón "Exportar propuesta".
3. **Fila en Supabase**: `cotizaciones` (+ tablas normalizadas `cotizacion_items` /
   `cotizacion_espacios`) y, si se guarda la propuesta, `cotizacion_propuestas`.
4. **PDFs en Storage**: buckets públicos `cotizaciones-pdf` y `propuestas-pdf` (URL en `pdf_url`).

**5.2 [real] Estructura de una propuesta (los 3 modos son distintos).**

Tres modos de cotización, con reglas distintas (premisa del dueño):
- **Stand:** stand único. Parámetros: superficie, frente, profundidad, tipo (centro/esquina/
  península/isla), **altura** (único modo con multiplicador de altura), modificador. Ítems en lista
  plana. En el PDF, el detalle va **sin precios por ítem** (Infraestructura se muestra como
  "estructura / sistema modular OCTEXA"), y solo aparece el **total**.
- **Expo:** multi-espacio. Ítems **por espacio**. En el PDF, detalle **por espacio con precios** +
  subtotal por espacio.
- **Alquiler:** misma estructura que Expo.

**Fórmula (única, `pricing.js`)** — la comparten summary, PDF, CSV y compare:
```
loadedUnit = precio_base × (altura si categoría afectada) × (1 + modificador% + fee%)
lineLoaded = round(loadedUnit × cantidad)         ← redondeo al peso por línea
subtotal   = Σ lineLoaded                          ← el desglose cierra exacto
iva        = round(subtotal × 0.21)   |   total = subtotal + iva
```
Modificador y fee se **suman entre sí** (nunca encadenados, nunca sobre impuestos). Altura solo en
`infrastructure` + `lighting`.

**Secciones del PDF presupuesto** (jsPDF): header MEPEX + badge de modo + fecha → **Datos del
proyecto** (Cliente, Proyecto*, Evento*, superficie/tipo/altura o nº espacios, fechas*, lugar*) →
título → **texto de la propuesta** (sanata, editable) → **rubros/ítems** (por los 6 rubros:
Pisos, Infraestructura, Iluminación, Equipamiento, Marketing, Más Servicios) → **caja de total**
(Subtotal + IVA 21% + Total) → footer (condiciones + `Ref: COT-AAAA-NNNN` + contacto).
(*) Proyecto/Evento/fechas/lugar se omiten si están vacíos.

**5.3 [real] Ejemplos reales (anonimizados).**

**(a) El JSON que representa el presupuesto internamente** (`cotizaciones.full_state`, generado por
`quotation-storage.js:240` `_collectCurrentState`). Modo Stand:
```jsonc
{
  "id": "b3f1…-uuid-front",
  "cotNumber": "COT-2026-0014",
  "date": "2026-07-01",
  "type": "stand",                       // 'stand' | 'expo' | 'alquiler'
  "proposalText": "Propuesta para Laboratorios Acme para Expo Salud 2026. La solución combina…",
  "params": {
    "client":  { "id": "uuid", "name": "Laboratorios Acme", "cuit": "30xxxxxxxx", "email": "…" },
    "project": { "id": null, "name": "" },              // opcional
    "event":   { "id": "uuid", "name": "Expo Salud 2026", "dates": "", "venue": "La Rural",
                 "eventStartDate": "2026-09-10", "eventEndDate": "2026-09-13" },
    "surface": 36, "frontal": 6, "profundidad": 6,
    "standType": "esquina",
    "height":   { "label": "Plus", "value": 3.5, "multiplier": 1.10 },
    "modifier": { "name": "", "percentage": 0 },
    "fee":      { "enabled": true, "percentage": 10 }   // entero en el snapshot guardado
  },
  "items": [                                            // Stand: lista plana
    { "id": "item_pan_100", "name": "Panel modular OCTEXA 1x2m", "unit": "unidad",
      "price": 27650, "category": "infrastructure", "quantity": 24 },
    { "id": "item_alf_003", "name": "Alfombra ferial", "unit": "m²",
      "price": 6900, "category": "flooring", "quantity": 36 }
  ],
  "spaces": [],                                         // vacío en Stand; en Expo/Alquiler va poblado
  "totals": { "subtotal": 978360, "tax": 205455, "total": 1183815 },
  "savedAt": "2026-07-01T13:20:00.000Z"
}
```
> Ojo (identidad del ítem): `items[].id` es un **slug del front** (`item_pan_100`), no el id entero
> del catálogo. **PERO** la tabla normalizada `cotizacion_items` sí guarda el id entero real en
> `catalogo_item_id` (vía `sourceId`). Ver §7.5.

**(b) El JSON que el cotizador manda al motor de la propuesta** (`propuesta.js` `buildPayload` →
`POST /propuesta-api/render-propuesta`). Modo Stand (detalle sin precios):
```jsonc
{
  "modo": "STAND",
  "fecha_emision": "1 de julio de 2026",
  "ref": "COT-2026-0014",
  "incluye_diseno": true,
  "proyecto": {
    "cliente": "Laboratorios Acme", "descripcion": "", "evento": "Expo Salud 2026",
    "lugar": "La Rural", "fecha_evento": "10 al 13 de septiembre de 2026",
    "superficie": "36 m²", "tipo": "Esquina", "altura": "Plus (3,50m)"
  },
  "resena": "Propuesta para Laboratorios Acme para Expo Salud 2026. …",   // = proposalText
  "detalle": {
    "rubros": [
      { "nombre": "Infraestructura",
        "descripcion": ["Superficie: 36 m² — Altura: Plus (3,50m)",
                        "Construcción modular con sistema OCTEXA"], "items": [] },
      { "nombre": "Pisos", "items": [ { "desc": "Alfombra ferial", "cant": "36" } ] }
    ],
    "subtotal": "978.360,00", "iva_pct": 21, "iva": "205.455,00", "total": "1.183.815,00"
  },
  "renders": [ { "src": "data:image/jpeg;base64,…", "comentario": "",
                 "anotaciones": [ { "label": "Mostrador de atención", "tx": 40, "ty": 62, "lx": 58, "ly": 62 } ] } ],
  "distribucion": null
}
```
(En Expo/Alquiler, `detalle` no lleva `rubros` sino `espacios[]`, cada uno con `rubros` **con
precios** — `desc/cant/unitario/parcial` — y `subtotal` por espacio.)

**5.4 [real] Numeración, estados, versiones.**
- **Numeración:** `COT-AAAA-NNNN` (`server/index.js:578`, `padStart(4)`). El número lo da una función
  SQL atómica `siguiente_numero_cotizacion(anio)` sobre `cotizacion_numerador` (contador por año, sin
  race conditions). **Reserva diferida:** en modo *preview* NO se consume número (placeholder
  `COT-AAAA-XXXX`); recién se reserva al confirmar "Descargar y guardar". Cancelar un preview no quema
  número.
- **Estados:** la columna `cotizaciones.estado` existe (`borrador`/`aprobada`/`rechazada`) pero **la
  gestiona el CRM del LOBBY**, no el cotizador. El cotizador crea la fila (default `borrador`) y no
  administra transiciones.
- **Versiones/revisiones:** **no hay** modelo de versiones. Existe `PUT /api/quotations/:id`
  (actualiza en lugar), pero el flujo normal es crear una fila nueva por export. Guardar de nuevo
  re-inserta las filas normalizadas.

---

## 6. Modelo de datos / almacenamiento

**6.1 [real] Dónde vive la data.** Fuente de verdad = **Supabase** (PostgreSQL + Auth + Storage). No
hay Notion (legacy). `localStorage` se usa **solo** para drafts/autosave y preferencias de UI, y como
backup de las cotizaciones — **nunca** como fuente de negocio.

**6.2 [real] Esquema de las entidades principales.**

**Tablas COMPARTIDAS con el LOBBY (el cotizador solo LEE):**
- `catalogo_items` (~226 filas; la administra Costos del LOBBY, 40+ columnas). El cotizador usa:
  `id` (int), `codigo`, `nombre`, `rubro`, `categoria`, `descripcion`, `unidad`, **`precio_alquiler`**,
  `favorito`, `parametrico`, `familia`, `medida_mm`, `activo`, **`es_cotizable`**. Ignora todo el
  costing (`margen_*`, `pct_*`, `costo_*`, `snapshot_*`, `precio_cliente` legacy, `tipo_receta`, etc.).
- `clientes` (`id`, `nombre_empresa`, `razon_social`, `cuit`, `contacto_empresa`, `telefono`, `rubro`…).
- `proyectos` (renombrada de `proyectos_2026`): `id`, `nombre`, `cliente_id`, `evento_id`,
  `cotizacion_id`, `estado`, fechas…
- `eventos` (renombrada de `eventos_2026`): `id`, `nombre`, `fecha_evento_inicio/fin`,
  `fecha_armado_*`, `fecha_desarme_*`, `predio`… ⚠️ (ver §9: el mapeo de este endpoint tuvo nombres
  viejos; verificar campo a campo antes de confiar en `venue`/fechas).

**Tabla `cotizaciones` (compartida, extendida por el cotizador con ALTERs):**
Columnas propias del cotizador (`server/supabase-setup.sql`): `project_id`, `event_id`,
`tipo_cotizacion` ("Stand"/"Expo"/"Alquiler"), `superficie`, `tipo_stand`, `altura`, `subtotal`,
`iva`, `fecha_emision`, `full_state` (JSONB), `pdf_url`. Columnas base/CRM: `numero`, `cliente_id`,
`monto_total`, `estado`, `vendedor_id` (NULL hoy), `notas_internas`. Columnas de facturación del
LOBBY: `pyme_*` (el cotizador **no** las toca).

**Tablas PROPIAS del cotizador** (creadas en `server/migrations/`, referencian pero **no modifican**
las compartidas):
- `cotizacion_espacios` — `id`, `cotizacion_id`(FK), `nombre`, `superficie`, `posicion`. (Solo
  Expo/Alquiler.)
- `cotizacion_items` — una fila por línea; **snapshot inmutable del precio**. Columnas:
  `id`, `cotizacion_id`(FK), `espacio_id`(FK, NULL en Stand), **`catalogo_item_id`(FK int al
  catálogo, SET NULL si se borra)**, `nombre`, `codigo`, `unidad`, `rubro`, `categoria`,
  `precio_unitario_base`, `precio_unitario_ajustado`, `cantidad`, `subtotal_linea`,
  `height_multiplier_aplicado`, `modifier_pct_aplicado`, `fee_pct_aplicado`, `posicion`.
- `cotizacion_numerador` — `anio` (PK), `ultimo_numero`. + función `siguiente_numero_cotizacion(anio)`.
- `cotizacion_propuestas` — panel de propuestas comerciales: `id`, `cliente`, `evento`, `modo`,
  `total`, `ref`, `cotizacion_id`(FK SET NULL), `pdf_url`, `pdf_path`, `payload`(jsonb), `created_at`.

**Storage buckets** (públicos): `cotizaciones-pdf`, `propuestas-pdf`.

**6.3 ⭐ [real] Misma Supabase que el LOBBY.**
**SÍ**, es exactamente la misma instancia: **`selnevalaeykdrgycvdz.supabase.co`**
(`.audit/schema_dump.md:5`, y el server usa `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`,
`server/index.js:22-25`). No hay DB propia. Por eso la coordinación de esquema es crítica.

---

## 7. Integración con el LOBBY (el punto más crítico)

**7.1 [real] Precios.**
El cotizador **lee el catálogo del LOBBY** vía su propio backend (no lee Supabase directo desde el
browser; el server sí, con la service key). `GET /api/catalog` (`server/index.js:228`):
```javascript
supabase.from('catalogo_items').select('*')
  .eq('es_cotizable', true)
  .or('activo.eq.true,activo.is.null')
  .or('_deleted.eq.false,_deleted.is.null')
  .order('nombre');
```
Y el precio sale de **`precio_alquiler`** redondeado a entero (`formatCatalogItem`, `server/index.js:93`):
```javascript
price: Math.round(parseFloat(row.precio_alquiler) || 0)   // NO precio_cliente (legacy)
```
Los 3 modos (incluido Alquiler y Stand) usan `precio_alquiler` como base. El match con el catálogo es
por **`id` entero** (se guarda como `sourceId` en el front y como `catalogo_item_id` en
`cotizacion_items`); el `codigo` se arrastra como snapshot. **No hay lista de precios propia ni
Notion.**

> Corrección al schema_dump (mayo): decía que el cotizador usaba `precio_cliente` e ignoraba
> `es_cotizable`/`precio_alquiler`. **Hoy es al revés** (arriba el código actual).

**7.2 [real] Cotizaciones (escritura).**
Sí, el cotizador **escribe** en `cotizaciones` (la que lee el CRM del LOBBY) vía
`POST /api/quotations` (`server/index.js:708`). Mapeo exacto (request → columnas):
```javascript
{ numero, tipo_cotizacion, cliente_id, project_id, event_id, superficie, tipo_stand,
  altura, subtotal, iva, monto_total, fecha_emision, full_state }
```
Además, **de forma aditiva**, inserta las filas normalizadas (`insertNormalized`,
`server/index.js:653`): `cotizacion_espacios` (`cotizacion_id, nombre, superficie, posicion`) y
`cotizacion_items` (las 16 columnas del §6.2). Si esa parte falla, el guardado de `full_state` sigue
funcionando. El `full_state` JSONB **se guarda completo** como snapshot/respaldo.

**7.3 [real] Clientes.**
Comparte la tabla `clientes` del LOBBY (solo lectura + autocomplete). `GET /api/clients` y
`/api/clients/search?q=` (ilike sobre `nombre_empresa`). Al guardar, la cotización referencia
`cliente_id` (el uuid que vino del autocomplete). **El cotizador NO crea clientes** (no hay POST a
`clientes`). Si el cliente no existe en el LOBBY, hoy no se puede dar de alta desde el cotizador.
Único dato **obligatorio** para exportar = **Cliente** (Proyecto y Evento son opcionales; se asignan
después en el CRM).

**7.4 [real] El "contrato" — qué lee y qué escribe el cotizador en Supabase.**

| Tabla / recurso | Lee | Escribe | Notas |
|---|:--:|:--:|---|
| `catalogo_items` | ✅ | ❌ | Solo `es_cotizable=true`. Usa `precio_alquiler`. **No tocar** (es de Costos/LOBBY). |
| `clientes` | ✅ | ❌ | Autocomplete + `cliente_id`. No crea. |
| `proyectos` | ✅ | ❌ | Autocomplete + `project_id` (opcional). |
| `eventos` | ✅ | ❌ | Autocomplete + `event_id` (opcional). ⚠️ verificar nombres de columnas. |
| `cotizaciones` | ✅ | ✅ | Escribe columnas propias (§7.2). **No** toca `pyme_*` ni `vendedor_id` (NULL). |
| `cotizacion_espacios` | ✅ | ✅ | **Propia del cotizador.** |
| `cotizacion_items` | ✅ | ✅ | **Propia.** Snapshot inmutable con FK `catalogo_item_id`. |
| `cotizacion_numerador` (+ RPC) | — | ✅ (RPC) | **Propia.** `siguiente_numero_cotizacion(anio)`. |
| `cotizacion_propuestas` | ✅ | ✅ | **Propia.** Panel de propuestas. |
| Storage `cotizaciones-pdf` | ✅ | ✅ | PDF del presupuesto. |
| Storage `propuestas-pdf` | ✅ | ✅ | PDF de la propuesta. |

**Regla de oro para no romperse mutuamente:** el LOBBY es dueño de `catalogo_items`, `clientes`,
`proyectos`, `eventos` y de las columnas base/`pyme_*` de `cotizaciones`. El cotizador es dueño de
las columnas ALTER de `cotizaciones` y de las 4 tablas `cotizacion_*`. **Cualquier columna nueva en
las compartidas se coordina.** El cotizador nunca hace DDL en runtime (las migraciones se corren a
mano en el editor SQL de Supabase).

**7.5 [real+planeado] Import más limpio (clave para el LOBBY).**
Hoy el LOBBY importa pegando el **texto del PDF** (`importar-cotizacion.js` parsea texto) — frágil.
**Ya existe una forma estructurada, sin parsear PDF:**
- **[real] Opción A — leer `cotizaciones.full_state`** (JSONB): tenés el objeto completo (params,
  items con category/price/quantity, spaces, totals). Ver ejemplo §5.3(a).
- **[real] Opción B (mejor) — leer las tablas normalizadas** `cotizacion_items` + `cotizacion_espacios`:
  columnas reales, una fila por línea, con **`catalogo_item_id` (FK entero al catálogo)**, `rubro`,
  `categoria`, `cantidad`, `precio_unitario_base/ajustado`, `subtotal_linea`, y los multiplicadores
  aplicados. Es la vía ideal para "item más vendido / rubro más cotizado / reconstruir el BOM".
- **[planeado] Opción C — un endpoint dedicado** (ej. `GET /api/quotations/:id` ya devuelve
  `full_state`; se podría exponer uno pensado para el LOBBY). No es necesario: A y B ya sirven.

> **Recomendación al LOBBY:** dejá de parsear el texto del PDF. Leé `cotizacion_items` por
> `cotizacion_id` (2-query pattern de PostgREST). Es la representación estructurada y estable.

---

## 8. Relación con el diseño en 3ds Max y OCTEXA

**8.1 [real] ¿El cotizador toma los diseños de 3ds Max? No automáticamente.**
El diseño "lindo" lo hace Fede en **3ds Max** por fuera. El cotizador arma su propuesta por separado
y **solo consume imágenes** que se le suben a mano (renders JPG/PNG) en el paso de "Exportar
propuesta" (`propuesta.js`). No hay pipeline 3ds Max → cotizador; hay **subida manual de renders**.

**8.2 [real+planeado] Cómo encajaría un futuro "diseñador con IA".**
Hoy: el cotizador es el **consumidor** de lo visual (renders subidos) y el **generador** de precios/
documentos. El Brief Express ya hace una versión **textual** de "brief → ítems" (no geométrica).
Un futuro "diseñador IA (brief → 3D fiel → render → propuesta)" [planeado] encajaría como un
**productor upstream**: generaría el diseño y los renders, y el cotizador seguiría siendo el
**consumidor** que pone precio y arma el PDF. Son **cosas distintas**: el cotizador **no** debería
convertirse en el motor de diseño 3D.

**8.3 [real+planeado] ¿"Piezas codeadas" que salgan del diseño y alimenten la cotización?**
- **[real] El concepto de pieza codeada ya existe en los datos:** `catalogo_items` tiene `codigo`,
  `rubro`, `familia` y `medida_mm`, con **familias paramétricas OCTEXA** (`COC` columna octogonal,
  `CHE` hexagonal, `CMO`, `CCO`, `CDO`, dinteles `DAA`/`DLL`, etc.). Es exactamente el vocabulario que
  saldría de un despiece.
- **[planeado] Pero NO existe un importador 3ds Max → BOM.** El cotizador hoy **no lee `parametrico`/
  `familia`/`medida_mm` para armar variantes** (están inertes). Si el LOBBY quiere un "3ds Max → BOM
  (rubro/código/nombre/cantidad) → cotización", hay que construir el puente (formato de despiece +
  matcher por `codigo`/`familia`+`medida_mm` contra el catálogo). El cotizador está bien posicionado
  para ser el destino de ese BOM (ya matchea por id/código), pero la pieza no está hecha.

---

## 9. Dolores y roadmap

**9.1 [real] Qué falta o duele hoy.**
- **Catálogo casi vacío de precios:** de ~226 ítems, muy pocos son `es_cotizable=true` con
  `precio_alquiler>0` (el handoff habla de ~9). Hasta que Costos/LOBBY lo llene, brief y ghosts
  rinden poco y las cotizaciones salen con totales bajos.
- **`vendedor_id` NULL:** el cotizador no está poblando el uid de Auth → no hay trazabilidad de quién
  cotizó.
- **Endpoint `/api/events` frágil:** el schema_dump marcó nombres de columnas viejos (`lugar` vs
  `predio`, `fecha_desarme` vs `fecha_desarme_inicio`). Verificar campo a campo; es la lectura más
  riesgosa.
- **Datos ruidosos heredados del LOBBY:** samples de `clientes` con columnas corridas (CUIT con texto,
  etc.). El cotizador hereda ese ruido.
- **Variantes paramétricas sin usar:** `familia`/`medida_mm` inertes (no hay selector de medida).
- **Favoritos sin sentido:** ~95% de los ítems tienen `favorito=true` → el orden "favoritos primero"
  no discrimina.
- **Sin importador CSV/BOM** (§3, §8.3).

**9.2 [real] Qué me gustaría que el LOBBY haga por mí (o deje de intentar).**
- **Que haga:** ser dueño real del **catálogo + precios** (llenar `es_cotizable`/`precio_alquiler`,
  mantener `rubro`/`unidad` limpios); dueño del **CRM** (estados de cotización, asignación a
  proyecto/evento, seguimiento) y de la **facturación** (`pyme_*`); limpiar el ruido de `clientes`/
  `eventos`. Idealmente, permitir **crear cliente** desde el flujo (hoy el cotizador no puede).
- **Que deje de intentar:** **NO** construir un "diseñador de stands" ni un motor de propuesta que
  dupliquen al cotizador; **NO** importar cotizaciones parseando el texto del PDF (usar
  `cotizacion_items`/`full_state`).

**9.3 [real] Qué features del LOBBY pisan/duplican al cotizador (para desactivar del lado LOBBY).**
- Un **"diseñador de stands"** en el LOBBY → duplica la selección de ítems + armado de propuesta.
  (Este es el caso que Fede ya frenó.)
- **Importar cotización pegando texto del PDF** (`importar-cotizacion.js`) → reemplazable por lectura
  estructurada de `cotizacion_items`/`full_state` (§7.5).
- Cualquier **cálculo de precio de alquiler** que el LOBBY haga por su cuenta → la fórmula canónica
  vive en `pricing.js`; si el LOBBY necesita el total de una cotización, que lo lea de
  `cotizaciones.monto_total`/`subtotal`/`iva` en vez de recomputar.

---

## 10. Artefactos adjuntos (checklist del pedido)

- [x] **Esquema de DB** → §6.2 (tablas compartidas + propias, columnas reales).
- [x] **1 brief de ejemplo** → §2.2 (texto compilado que entra a `/api/ai/brief`).
- [x] **1 CSV de ejemplo** con encabezados y filas → §3 (es un **output**; no hay CSV de input).
- [x] **1 propuesta/cotización de ejemplo** → §5.3 (JSON `full_state` + JSON del motor de propuesta).
- [x] **Contrato de integración Supabase** (lee/escribe) → §7.4.

### Prompts de IA (verbatim, por si el LOBBY reusa el mismo backend)
- **Sanata** (texto comercial): `server/index.js:1108`, Haiku, `temperature 0.4`, 2-4 oraciones,
  reglas por rubro (paneles→"sistema modular OCTEXA", vinilos→"vinilo impreso y colocado", etc.),
  "NO inventes". Devuelve `{ success, text }`.
- **Brief** (texto → params + ids): `server/index.js:1159`, devuelve JSON `{params, items[], notas}`,
  solo ids del catálogo provisto.
- **Ghosts** (cross-sell): `server/index.js:1184`, hasta 4 sugerencias `{id, motivo}`, solo ids de
  `candidates`, valida contra el catálogo (sin alucinaciones).
- **Render-caption** (visión): `server/index.js:1071`, epígrafe de un render (hoy no se auto-invoca
  al subir; acotes manuales).

### Punteros de código (para verificar cualquier afirmación)
- Fórmula: [pricing.js](pricing.js) · Catálogo/altura/fees: [database.js](database.js) ·
  Mapeo rubro→key + precio: [api.js](api.js) `convertToLocalFormat`, [server/index.js](server/index.js) `formatCatalogItem`.
- Guardado: [quotation-storage.js](quotation-storage.js) `_collectCurrentState`/`_buildNormalized` +
  [server/index.js](server/index.js) `POST /api/quotations`.
- Brief: [brief.js](brief.js) · Propuesta (renders + motor): [propuesta.js](propuesta.js) +
  `/propuesta-api` (weasyprint, ver [HANDOFF-generador-presupuesto-mepex.md](HANDOFF-generador-presupuesto-mepex.md)).
- Migraciones: [server/migrations/002_cotizacion_items.sql](server/migrations/002_cotizacion_items.sql),
  [003_numerador_secuencial.sql](server/migrations/003_numerador_secuencial.sql),
  [004_propuestas.sql](server/migrations/004_propuestas.sql).
```
