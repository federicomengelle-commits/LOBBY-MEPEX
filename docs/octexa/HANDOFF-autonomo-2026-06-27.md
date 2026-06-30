# Handoff — Sesión autónoma OCTEXA (2026-06-27)

> Construido por Claude trabajando **solo y en paralelo** con la otra charla (que tocaba `stands.js` / `index.html` / `importar-3dsmax.js`). **Regla cumplida:** SOLO archivos nuevos + `tools/octexa/` + `octexa-data.json`. **Cero archivos compartidos tocados.** Commits **locales** a `pulido-proyectos` (sin push). Este doc = lo que falta para activar todo en una pasada.

## 1. Qué se construyó (todo verificado en Node, conflict-free)

| Pieza | Archivo(s) | Verificación | Commit |
|---|---|---|---|
| Validador del cerebro | `tools/octexa/validate-cerebro.js` | 64/64 OK | `11f4f36` |
| Premisas + esquema extensible | `octexa-data.json` (`premisas_diseno`, `_schema`) | validado | `11f4f36` |
| Motor BOM (UMD) | `tools/octexa/octexa-bom.js` | self-test 13/13 | `f08d097`/`4f8659a` |
| Motor de diseño (variantes/rearmado/zonas) | `tools/octexa/octexa-design.js` | self-test 10/10 | `4f8659a` |
| Módulo Diseñador (lobby) | `disenador.js` | `node --check` OK | `d95fcad` |
| Asistente OCTEXA (VPS) | `tools/vps/octexa-ia.js` | capa verdad == BOM | `b661510` |
| SQL ítems estructurales | `sql/octexa_costos_estructural.sql` | borrador (verificar schema) | *(este)* |

Correr los tests cuando quieras: `node tools/octexa/validate-cerebro.js && node tools/octexa/octexa-bom.js && node tools/octexa/octexa-design.js`

## 2. ⚠ WIRING PATCH — activar el Diseñador en el lobby (toca shared files)

**No lo hice yo** (los tenía abiertos la otra charla). Aplicar DESPUÉS de mergear, en una pasada:

**a) `index.html`** — agregar 3 `<script>` ANTES de `app.js` (orden importa: bom → design → disenador):
```html
<script src="tools/octexa/octexa-bom.js"></script>
<script src="tools/octexa/octexa-design.js"></script>
<script src="disenador.js?v=1"></script>
```

**b) `router.js`** — registrar la ruta igual que `#stands` (buscá cómo está `stands` y calcá):
```js
'disenador': { obj: DisenadorOctexa, render: () => DisenadorOctexa.render(), adminLevel: true },
```
(o el shape que use el router; el módulo expone `DisenadorOctexa.render()`).

**c) `data.js`** — module-def + permisos, **idéntico a `stands`** (Comercial, super/admin/venta/pm; taller NO):
- agregar `disenador` a `Data.categories` (categoría Comercial) y a `Data.rolePermissions` para super/admin/venta/pm.
- icono/label: "Diseñador" / "🤖".

> Como `disenador` es análogo a `stands`, lo más rápido = copiar las 3 líneas donde aparece `stands` y duplicarlas para `disenador`.

## 3. Deploy del asistente VPS (igual que crm-digest)

En `195.200.1.250` (`/home/mepex/api/`):
```bash
cp /home/mepex/lobby/tools/vps/octexa-ia.js /home/mepex/api/
# en server.js:
#   const octexaIa = require('./octexa-ia');
#   app.post('/api/octexa/ask', express.json({limit:'1mb'}), octexaIa.handler);
pm2 restart mepex-api
curl -s -X POST localhost:3000/api/octexa/ask -H 'Content-Type: application/json' \
  -d '{"pregunta":"¿cuántas columnas para un 6x3 esquina?","spec":{"frente_modulos":6,"fondo_modulos":3,"topologia":"esquina"}}'
```
Reusa `GEMINI_API_KEY`/`MODEL_PROVIDER` que ya tiene crm-digest. El front llamaría a `/api/octexa/ask` (relativo, ya ruteado por nginx) pasando `{ pregunta, cerebro: <octexa-data.json>, spec? }`.

## 4. SQL (cuando quieras precio en la estructura)

`sql/octexa_costos_estructural.sql` — **verificá el schema de `insumos_base` (PASO 1) antes de correr el INSERT (PASO 3)**. Carga los 12 perfiles como insumos con costo 0 (placeholder). Los precios los ponés vos.

## 5. Estado: verificado vs pendiente

**Verificado (Node):** toda la lógica pura — validador, motor BOM (columnas EXACTAS por topología, matchea el compositor), motor de diseño (variantes/rearmado/zonas), capa verdad del asistente.

**Pendiente (necesita el merge / DB / deploy / vos):**
- Wiring §2 → el Diseñador renderiza en el browser (verificar DOM logueado).
- Guardar/cotizar de `disenador.js` → hits a Supabase (`proyectos`/`proyecto_componentes`) + delega a `StandsModule._usarEnCotizacion`. **Verificar end-to-end logueado** (patrón calcado del compositor, pero no probado en vivo).
- Deploy §3 → asistente andando.
- SQL §4 + **precios** → precio del estructural en el BOM (hoy: estructura sin precio, componentes ya cotizan).
- BOM v2: despiece vertical fino (hoy perfiles/placas = estimación de perímetro de 1 banda).

## 6. Merge con la otra charla

- Mis commits tocan SOLO: `tools/octexa/*`, `tools/vps/octexa-ia.js`, `disenador.js` (nuevo), `octexa-data.json`, `sql/octexa_*`, `docs/octexa/*`. **No hay overlap** con `stands.js`/`index.html`/`importar-3dsmax.js`.
- → el merge es trivial salvo `index.html` (ahí van los 3 `<script>` del §2a, que se agregan a mano, no chocan con lo de la otra charla salvo que ambas editen la misma línea).
- Orden sugerido al volver: 1) reconciliar/commitear lo de la otra charla · 2) aplicar wiring §2 · 3) pull en el server · 4) verificar el Diseñador logueado · 5) (cuando haya precios) SQL §4 + deploy §3.

— Memoria: `project_octexa_stand_designer`. Plan: `SUPERPLAN-octexa.md §PLAN OFICIAL`. Visión: `disenador-IA-vision.md`.
