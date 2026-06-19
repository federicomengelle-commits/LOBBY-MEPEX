# HANDOFF — Construir el módulo "Rendimiento por evento" de un saque (one-shot)

> **Para una sesión NUEVA de Claude Code.** Objetivo: construir el módulo COMPLETO (etapas REND.1→REND.5) en una pasada grande, con el mínimo de idas y vueltas. La spec está **cerrada**: no re-diseñes ni re-preguntes lo ya decidido — ejecutá.
> **Fecha:** 2026-06-18 · Branch `rediseno` · push directo a `origin/main` · Fede pullea en el VPS con `~/pull-lobby.sh`.
> **Arranque de sesión:** preguntá a Fede si hacés `git fetch origin && git reset --hard origin/main` antes de empezar (regla del proyecto).

---

## 0. Leé primero (en orden)
1. **`docs/modulo-rendimiento-evento-blueprint.md`** — la **SPEC MADRE**, autoritativa. DDL completo, flows, UI, etapas, contrato RRHH.5. Todo sale de ahí; este handoff es el plan de ejecución + las convenciones.
2. **`CLAUDE.md`** (raíz) — convenciones del proyecto + arquitectura + tablas Finanzas/Contabilidad (§7).
3. **`docs/schema-prod.md`** — schema REAL de prod (FUENTE DE VERDAD; el SQL del repo puede estar desfasado — regla 12 del CLAUDE.md).
4. **`mockup-rendimiento-evento.html`** (raíz) — base visual aprobada. ⚠️ Su "egreso consolidado" es **OBSOLETO**: la decisión es **N egresos discriminados**. Vale como look & feel, NO como lógica de pagos.
5. Referencias de código a imitar: **`finanzas.js`** (egresos/comprobantes/asientos), **`crm.js`** (módulo moderno con tabs/fichas), **`costos.js`** (planilla + snapshots).

## 1. Qué es (en 3 líneas)
Módulo propio `#rendimiento` en **ADMIN Y FINANZAS** (solo admin/superadmin) que reemplaza el Excel de pagos de Lelean. Una **planilla de costos por evento** (jornales/fletes/proveedores/seguros/comida) cuyos pagos generan egresos + asientos **reusando la plomería de Finanzas**, + un **dashboard de ganancia por evento**. Desbloquea RRHH.5 (Jornales).

## 2. Decisiones CERRADAS (NO re-preguntar)
- **Módulo propio** (no tab de Finanzas). Ruta `#rendimiento`, archivo `rendimiento.js`, categoría `admin` en `data.js` (color `#4A90D9`).
- **Catálogo configurable** (engranaje) que **reusa maestros**: jornales→`personas`, fletes/proveedores→`proveedor`; seguros/comida = ítem libre. Guarda **tarifa/monto default** por ítem.
- **Autocomplete**: al elegir un ítem del catálogo trae su tarifa default, **editable** en la fila; si se pisa → badge **"editado"** (`evento_costos.monto_editado`).
- **5 categorías COLAPSABLES**: Jornales · Fletes · Proveedores · Seguros · Comida.
- **Pagos SIEMPRE discriminados**: cada ítem pagado = **su propio egreso**. "Pagar seleccionados" = comodidad de 1 click que crea **N egresos separados** (NUNCA un consolidado). Soporta **adelantos y tandas** (`pendiente → parcial → pagado`).
- **Proveedores que facturan** → el pago crea un **comprobante recibido** (IVA) + egreso + asiento + Libro IVA. Jornales/comida/seguro = egreso simple sin comprobante.
- **Materiales = insumos/consumibles GASTADOS** (carga **manual** en v1, tabla `evento_rendimiento`), **NO** la receta de Costos (`calcular_receta` = precio de alquiler; la estructura OCTEXA se alquila y vuelve). Imputación auto desde inventario = roadmap.
- **Dashboard**: INGRESOS mostrando **Cobrado** (ingresos confirmados de los proyectos del evento) **y Facturado** (`comprobantes` emitidos al cliente) **lado a lado**, menos Costos (la planilla), menos Materiales = **Ganancia + margen**.
- **3 features**: (1) presupuesto-vs-real (`evento_costos.monto_previsto`), (2) duplicar planilla de otro evento, (3) comparar eventos / ranking de márgenes (vista superadmin).
- **Contrato RRHH.5**: los ítems jornal exponen `persona_id, fase, dias, tarifa, monto_pagado, egreso_id`. RRHH agrega por `SUM` (no asume 1 fila = 1 jornada). Ver blueprint §7.
- **NO incluir** "adelantos a rendir / fondo fijo" (solo idea futura).

## 3. Convenciones OBLIGATORIAS del proyecto
- **SQL-first**: correr el SQL en Supabase **ANTES** de pushear el JS (sino los INSERT con columnas nuevas rompen). Pasale el SQL a Fede para que lo corra y esperá su OK.
- **Push directo a main**: `git push origin HEAD:main` (no PRs, no ramas remotas). Fede pullea con `~/pull-lobby.sh`.
- **Bump `?v=`** de cada archivo tocado en `index.html` (sino el browser cachea la versión vieja).
- **`node --check`** de cada `.js` antes de pushear.
- **Dark theme MEPEX siempre** (tokens en CLAUDE.md §4 / `style.css :root`: bg `#050505`, card `#111111`, input `#1A1A1A`, border `#2a2a2a`, primary `#00A9C1`, accent `#F28D15`, success `#00CC88`; fuentes Outfit + Space Mono para montos). Reusar clases reales, no inventar tokens.
- **RLS por la matriz**: tablas nuevas con `fn_role_can('finanzas',...)` (read opcional también a `contabilidad`).
- **Patrón de módulo**: objeto global, `render()` en `#mainContent`, template literals, `addEventListener` (nunca inline `onclick`), estado en propiedades `_priv`.

## 4. Plan de construcción (one-shot)

**Paso 0 — verificar schema.** Confirmá contra `docs/schema-prod.md` las columnas/FK que vas a usar de: `egresos`, `comprobantes_recibidos`, `ingresos`, `comprobantes` (emitidos), `eventos`, `proyectos`, `personas`, `proveedor`, `asientos`, `mapeo_cuentas`. (El blueprint ya las verificó — confirmá las FK money-path: `egresos.evento_id`/`empleado_id`/`comprobante_recibido_id`, `comprobantes_recibidos.egreso_id`, todas UUID.)

**Paso 1 — SQL (dárselo a Fede para correr en Supabase).** El DDL consolidado del **blueprint §3** (`evento_costo_catalogo` + `evento_costos` + `evento_costo_pagos` + `evento_rendimiento` + RLS + índices, idempotente). **+ Gate `mapeo_cuentas`** (blueprint §REND.1): verificar que existan los mapeos de egreso para las 5 categorías que vas a usar; si falta alguno, seedearlo con su `cuenta_contable_id` (NO crear claves `egreso_*`). Si los egresos se pagan sin ese seed, **quedan sin asiento en silencio** (`fn_asiento_auto_egreso` sale sin error) — es el riesgo más alto.

**Paso 2 — API (`api.js`).**
- **`createEgreso(payload)` genérico NUEVO** (hoy solo existe `generarEgresoDeOC` que hardcodea la categoría). Debe permitir setear `evento_id`, `proyecto_id`, `empleado_id`/persona, `proveedor_id`, `comprobante_recibido_id`, `categoria`, `medio`, `canal`, `cuenta_financiera_id`, `total_en_ars`, `estado`.
- Reusar el `createComprobanteRecibido` existente para el flujo proveedor-con-factura (mirá cómo lo hace `finanzas.js`).
- CRUD de `evento_costo_catalogo` / `evento_costos` / `evento_costo_pagos` / `evento_rendimiento`.
- `getJornalesByPersona(personaId)` (contrato RRHH.5, blueprint §7).
- Queries del dashboard: cobrado, facturado, costos (Σ `evento_costos`), materiales.

**Paso 3 — Módulo (`rendimiento.js`) + registro.**
- Selector de evento → **planilla** (5 categorías colapsables, autocomplete del catálogo con tarifa default editable + badge "editado", `monto_previsto`).
- **Pagos**: modal simple (jornal/comida/seguro) + modal con **comprobante recibido** (proveedor con factura: nº/CUIT/neto/IVA/total). "Pagar ítem" = 1 egreso; "Pagar seleccionados" = **N egresos discriminados**; adelantos/tandas (parcial).
- **Config (engranaje)**: CRUD del catálogo, con su tarifa default por ítem.
- **Dashboard**: KPIs Cobrado + Facturado lado a lado − Costos − Materiales = Ganancia + margen; card de materiales (carga manual); waterfall (como el mockup).
- **Features**: duplicar planilla de otro evento; comparar eventos (ranking de márgenes, superadmin).
- Registrar en `data.js` (categoría admin), `router.js`, `index.html` (`rendimiento.js?v=1`).

**Paso 4 — Verificar.** `node --check rendimiento.js api.js`. El módulo necesita login → **no se puede ejercitar en el preview local** sin credenciales y escribiría en PROD; verificá sintaxis + lógica, NO crees data de prueba desde el preview.

**Paso 5 — Push.** Bump versions, commit (uno grande o por etapa), `git push origin HEAD:main`. Avisar a Fede: correr el SQL + `~/pull-lobby.sh` + verificación end-to-end (§8).

## 5. Gotchas / gates (blueprint §8-9)
- **mapeo_cuentas**: sin las categorías seedeadas → egresos sin asiento en silencio. Verificar antes de habilitar pagos.
- **Pagos SIEMPRE discriminados** (N egresos). El mockup dice "consolidado" → ignoralo.
- **Multimoneda**: v1 **ARS-only** (`evento_costos.monto` sin `total_en_ars`). USD/EUR = roadmap.
- **Materiales**: carga **manual** v1 (`evento_rendimiento`). Imputación auto desde inventario = roadmap (la tabla de movimientos está sub-poblada en prod → no confiable).

## 6. Fix global IVA (paso SEPARADO, recomendado, NO bloquea el módulo)
`fn_asiento_auto_egreso` (en `sql/finanzas_fase_e_multimoneda.sql`) arma solo **2 líneas**: DEBE gasto / HABER banco, **sin** línea de IVA crédito fiscal. Cuando se paga un proveedor con factura, el IVA entra al **Libro IVA** pero **NO al asiento** → el balance no cuadra el crédito fiscal. **Es una deuda GLOBAL de Finanzas (no del módulo).**
- **Fix (aislado, su propio SQL + test):** `CREATE OR REPLACE FUNCTION fn_asiento_auto_egreso` agregando una 3ª línea `DEBE 1.1.04.01 IVA crédito fiscal` por `comprobantes_recibidos.iva` **solo cuando el egreso tiene `comprobante_recibido_id`**.
- **Afecta a TODO Finanzas** → idempotente + **test obligatorio**: egresos SIN comprobante siguen con 2 líneas balanceadas; egresos CON comprobante ahora balancean con la línea de IVA. Avisar a Fede/Sofi.
- **Hacelo DESPUÉS** de que el módulo ande, como paso separado. El módulo es funcional sin esto (registra comprobante + egreso + Libro IVA; solo falta la 3ª línea del asiento).
- **Relacionado (NO tocar en este módulo):** anular un egreso **no revierte** el asiento (reversa manual hoy, §9.2). El módulo solo avisa en la UI.

## 7. Definition of done
- `#rendimiento` carga (admin/superadmin), catálogo CRUD anda.
- Planilla: cargar ítems de las 5 categorías con autocomplete + badge "editado" + `monto_previsto`.
- Pagos: "pagar ítem" y "pagar seleccionados" generan **N egresos discriminados**; proveedor-con-factura crea comprobante recibido; el egreso dispara el asiento (verificable en Contabilidad).
- Dashboard: ganancia por evento (Cobrado + Facturado − Costos − Materiales) + margen; comparar eventos; duplicar planilla.
- RRHH.5: `getJornalesByPersona` devuelve los jornales por persona.
- Cero errores de consola.

## 8. Verificación end-to-end (Fede, en prod)
Crear un evento de prueba → cargar costos (un jornal, un proveedor con factura, una comida) → pagar (simple + con comprobante) → ver el asiento generado en Contabilidad → ver el dashboard con la ganancia → limpiar la data de prueba.

## 9. Al cierre
- Mover lo construido a `PROGRESO.md` con su %, bajar el % de `PLAN-MAESTRO` (regla de los 2 archivos).
- Actualizar el blueprint si algo cambió en la ejecución.
- Si quedaron deudas (IVA trigger, anulación, materiales auto), dejarlas claras en PROGRESO + PLAN.
- **Repaso pendiente que pidió Fede (aparte):** auditoría de integridad de Finanzas/Contabilidad — "la consecución de cosas (egreso→comprobante→asiento→saldos→libro) no pasa en todos lados, hay cabos sueltos". Es la Fase 8 "auditoría de integridad" del plan; este módulo + el fix de IVA son un primer paso, pero falta el barrido completo.
