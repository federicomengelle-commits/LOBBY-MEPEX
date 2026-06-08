# PROGRESO — Rediseño LOBBY-MEPEX  ·  AVANCE ≈ 31%

> **Registro de lo YA HECHO.** Lo que FALTA vive en `PLAN-MAESTRO-rediseno-lobby.md` (≈85%).
> **Regla de los 2 archivos (Fede, 2026-06-07):** al cierre de cada sesión → mover lo completado de PLAN-MAESTRO acá y **rebalancear los %** (PROGRESO sube, PLAN-MAESTRO baja). Las ideas para fases futuras se suman al PLAN-MAESTRO, no acá.
> **Workflow:** desarrollar en branch `rediseno`; commit por sub-bloque; merge `--ff-only` a `main` + `git push origin main` → Fede pullea en el server y prueba. SQL-first en fases con DDL.
> **Baseline:** `origin/main` @ `c2439fc`.
> Companions: `PLAN-MAESTRO` (lo que falta), `BRIEF-ARRANQUE-CODE.md` (protocolo), `RECONOCIMIENTO-LOBBY.md` (estado del código).

---

## Estado general — AVANCE ≈ 35%
- **Hecho:** Fase 1 ✅ · Fase 2 ✅ · **Fase 3** (Flota + Locaciones) ✅ · **Fase 4 — EVENTOS** completa (jornadas + gente por jornada + vehículos + UX + alta multi-select) · **historial + docs a Supabase ✅** · **2º pase del calendario ✅** · **Taller dashboard dinámico — checklist editable (SB1+SB2) ✅**.
- **En curso (Fase 4 — Taller):** falta **SB3** (gatillo "Pasar a Taller" + filtrar el dashboard por `en_taller`) y **SB4** (detalle del stand read-only + sacar `proyectos` del rol taller). Después: subalquileres por proveedor · 3.1b legacy + repensar Logística. Ver `PLAN-MAESTRO` y §"FASE 4 — Taller" abajo.
- **Baseline:** `origin/main` al día (`d925d5f`). Branch dev: `rediseno` (= main).
- **⚠ Pendiente de Fede (en server logueado):**
  - (a) **SQL a correr:** `sql/rls_docs_historial.sql` (RLS docs/historial) + `sql/taller_checklist_editable.sql` (checklist editable). El `rls_eventos_proyectos.sql` completo NO sirve (muere en `evento_equipo`).
  - (b) `git pull` + **hard refresh** (importante: el bump de api venía mal, ahora **api v31** trae historial/docs Y checklist).
  - (c) **Eventos:** Documentos (con link) e Historial cargan y persisten (ficha + calendario). **Calendario:** tab Info "Jornadas y personal" por día + tab Logística chips de vehículos.
  - (d) **Taller:** abrir un stand → 6 pasos como pills, tildar (barra sube, estado pasa a "En armado" solo), ✎ editar (agregar/renombrar/quitar), con todo tildado el botón "Listo" pulsa. Chip de urgencia por fecha de armado.
- **Última actualización:** 2026-06-08.

---

## FASE 1 — Cimientos: navegación + roles

Decisiones tomadas con Fede (2026-06-07) para 1B:
- **Catálogo:** queda en COMERCIAL (catalogo.js = catálogo vendible). El catálogo OCTEXA de piezas será módulo nuevo en Fase 3.
- **RRHH:** queda en ADMIN & FINANZAS.
- **GLOBAL:** NO se crea en Fase 1 (se arma entero en Fase 9 con el centro de notif).
- **Flota:** NO se crea en Fase 1 (es Fase 3).

### 1A — Matar SidebarEditor (desacople localStorage → Data) ✅ HECHO
Refactor puro, sin cambio visible de estructura.
- Sidebar se construye directo de `Data.categories` filtrado por permisos (`App._buildSidebarSections` + `App._renderSidebar`). Sin editor, sin localStorage.
- Eliminado `sidebar-editor.js` (objeto `SidebarEditor` + `CategoryIcons` + `EditorIcons` + `UndoSystem` interno) y su `<script>` en `index.html`.
- En `app.js`: sacado `SidebarEditor.init()` (reemplazado por limpieza one-time de `mepex_sidebar_config`/`_version`), modo edición completo (drag&drop, rename, color, add/delete, botón "Editar sidebar", undo de sidebar en Ctrl+Z), `className` de `toggleSidebar`. Ícono chevron movido a const `SIDEBAR_CHEVRON`. Icono de sección ahora sale de `cat.icon` (ya estaba en Data). Accordion = toggle DOM puro (sin persistir).
- Bump `app.js?v=6` en `index.html`.
- Se preservaron clases/`data-route` que usan `Badges`, `updateSidebarActive` y los flyouts.
- **Verificado** (preview, pre-login, corriendo el código real): superadmin 16 / pm 9 / venta 7 / taller 7 módulos; sin botón editar; sin edit-mode; flyouts OK; sin errores de consola.
- **Pendiente de Fede:** confirmar en browser logueado (hard refresh `Ctrl+Shift+R`, F12 sin rojos, navegar, flyouts de sidebar colapsada).

### 1B — Estructura de menú canónica (árbol destino) ✅ HECHO
- `recursos` → `activos` (id + nombre) en `Data.categories` (`data.js`).
- OPERACIONES reordenado: Calendario · Eventos · Proyectos · Taller · Logística.
- ACTIVOS = Inventario · Locaciones · Compras.
- COMERCIAL [crm, cotizador, catalogo] y ADMIN & FINANZAS [rrhh, finanzas, contabilidad, costos] sin cambios.
- Breadcrumbs "RECURSOS" → "ACTIVOS" en `inventario.js`, `locaciones.js`, `compras.js`. `rrhh.js`: el breadcrumb decía RECURSOS pero RRHH vive en ADMIN & FINANZAS → corregido a "ADMIN & FINANZAS" (#4A90D9).
- `admin-panel.js` grilla de permisos (`_permModules`): grupo RECURSOS → ACTIVOS [inventario, locaciones, compras]; rrhh movido al grupo ADMIN & FINANZAS. **Solo etiquetas/agrupación visual — CERO valores de permiso, CERO roles tocados.**
- Bumps: `data.js?v=7`, `inventario.js?v=7`, `locaciones.js?v=2`, `compras.js?v=3`, `rrhh.js?v=7`, `admin-panel.js?v=7`.
- **Verificado** (preview, reload): categorías = PRINCIPAL/COMERCIAL/OPERACIONES/ACTIVOS/ADMIN&FINANZAS; sin RECURSOS; orden correcto; sintaxis OK en los 6 archivos.
- **Stale menor (no tocado, invisible):** `admin-panel._getModuleColor` (var local `recursos` que colorea los dots del audit log) + comentarios de cabecera en locaciones/compras/rrhh dicen "RECURSOS". Sin efecto visible; limpiar en pasada futura.
- **Pendiente de Fede:** confirmar en server (pull + hard refresh `Ctrl+Shift+R`).

---

## ✅ FASE 1 COMPLETA (pendiente confirmación de Fede en server)
Sidebar desacoplado de localStorage + estructura al árbol destino.

---

## FASE 2 — Saneamiento de datos ✅ COMPLETA (2026-06-07)

**Hallazgo clave del reconocimiento:** el problema "calendario no multiusuario" NO es falta de tablas. `eventos.js` YA usa tablas reales (proyectos.evento_id, `asignaciones_evento`, `getEventoTransporte`, `evento_documentos`, notas con dual-write a `eventos`). El que quedó atrás es **`calendario-operativo.js`**, que enriquece leyendo localStorage (`ev_proyectos_/ev_equipo_/ev_transporte_/ev_notas_/ev_docs_`). Las claves `ev_proyectos_/ev_equipo_/ev_transporte_` **no tienen escritor** → lecturas huérfanas (data vacía/vieja). ⇒ Fase 2 es más **rewiring/consolidación** que crear tablas; la DDL real es chica.

Mapa localStorage de negocio:
- `eventos.js`: `ev_ext_<id>` (incluye `teardownEndDate`, sin columna), `ev_docs_<id>` (existe tabla real `evento_documentos`), `ev_notas_<id>` (ya dual-write a `eventos`).
- `calendario-operativo.js`: lee `ev_proyectos_/ev_equipo_/ev_transporte_/ev_notas_/ev_docs_` (huérfanas) + `co_events_cache` (solo cache UI, no es dato de negocio).
- `crm.js`: `crm_campanias` (no existe tabla; hay TODO para `marketing_campanias`).

Sub-bloques:
- **2.0 — Cleanup:** matar `calendar.js` (muerto, confirmado: `Calendar` nunca referenciado). ✅ HECHO (archivo ya no existe en disco ni en index.html). (⚠️ **Corrección 2C:** el CSS `cal-*` de style.css **NO es huérfano** — lo usa el mini-calendario del Lobby (`lobby.js`: `cal-cell`/`cal-day-name`/`cal-dot`/`cal-dots`). **NO borrar.**)
- **2.1 — calendario-operativo.js → Supabase:** ✅ HECHO. El enrich de la grilla usa data REAL en 3 bulk queries (`API.getProyectosByEventos / getAsignacionesByEventos / getCargasByEventos`) en vez de localStorage huérfano. `projectCount` real (antes siempre 0); detección de conflictos real (equipo/transporte). Notas y teardownEndDate ya venían reales de `getEvents`. Removidas las claves huérfanas `ev_proyectos_/ev_equipo_/ev_transporte_/ev_notas_`. **Docs siguen en localStorage (`ev_docs_`) → bloqueado por Fase 6** (`evento_documentos` existe pero su API está comentada por schema desalineado). `co_events_cache` queda como fallback offline. Bumps `api.js?v=25`, `calendario-operativo.js?v=9`. Verificado en preview (métodos OK, sin errores). **Pendiente de Fede:** ver el calendario con data real en el server.
- **2.2 — eventos.js cerrar localStorage:** ✅ **Notas → columna** (`notas_operativas`): `_saveNotas` persiste solo a Supabase (sin localStorage); el panel lee `ev.notasOperativas`; eliminado `_getNotas` + la clave `ev_notas_` del cleanup. Bump `eventos.js?v=8`. **Teardown DIFERIDO:** el `teardownEndDate→columna` se absorbe en el **constructor de fechas/jornadas** (no se hace ahora para no rehacerlo). **Docs** (`ev_docs_`) → Fase 6. Sin DDL.
- **2.3 — CRM marketing → Supabase:** ✅ **resuelto por eliminación** — Marketing se sacó entero del CRM (no se crea `marketing_campanias`, se descarta `crm_campanias`). Ver sección CRM abajo.
- **Calendario UI (pedido de Fede):** ⏳ EN CURSO.
  - ✅ **Fix bug fases:** cada fase (armado/evento/desarme) se posiciona por su FECHA REAL dentro del bloque; antes se apilaban contiguas y si había gap (ej. desarme un día después del evento) el desarme caía un día antes y el día real quedaba vacío. Verificado: desarme en su día correcto, gap respetado.
  - ✅ **Cuadro rediseñado:** cada fase muestra etiqueta + hora de inicio (`ARMADO 08:00 / EVENTO 10:00 / DESARME 18:00`), labels más visibles, base con color tenue del evento. Bumps `calendario-operativo.js?v=10`, `style.css?v=13`.
  - ⏳ **Falta (corrección Fede 2026-06-07):** el calendario es **SOLO visualización** — la edición de eventos vive en el módulo Eventos, NO en el calendario. Por lo tanto:
    - (a) ✅ El **panel lateral del calendario** ya replica (read-only) la info de Eventos: header con las 3 fases (fechas+horas), conflictos, notas, cargas, asignaciones, docs + "Abrir ficha →". **Fix aplicado:** la tabla de Proyectos leía el shape viejo de localStorage (`p.client`/`p.type` → vacío); ahora usa el shape real del enrich 2.1 (Cliente / Proyecto / Estado). Bump `calendario-operativo.js?v=13`.
    - (b) ✅ **Toolbar + leyenda limpias** (feedback Fede sobre captura): quitado el filtro "Todos los PM" (no hay data de PM, no andaba); zoom muestra **lupita + %** (100% = 48px) en vez de "48px"; leyenda de abajo rediseñada con íconos (`🔧 Armado · 📅 Evento · 🔽 Desarme`) que matchean los chips del cuadro (antes eran swatches que quedaban mal). Filtro de predios queda. Bump `calendario-operativo.js?v=14`.
  - ✅ **Calendario terminado ("moño").** El cuadro lee bien (fases por fecha, header con armado+venue, chips evento/desarme sin pisarse), panel espejo de Eventos, toolbar/leyenda prolijas. Editar = en Eventos.
    - ❌ **Descartado:** modal de edición en el calendario (era la dirección anterior; Fede aclaró que NO).
  - **Visión futura (Fede):** los eventos se crean en la nube (Supabase) y el server hace backup. Refuerza Supabase = única fuente de verdad.

**Principio rector (Fede, 2026-06-07):** data real única, **coherente entre módulos, en tiempo real**. Toda la data de eventos es importante porque alimenta el calendario operativo Y la logística (los viajes se programan desde ahí). Una sola fuente de verdad consumida por todos los módulos. Aplicar este criterio a TODO el rediseño (= "un dato maestro, vistas por rol" del PLAN-MAESTRO).

**Decisión sobre data vieja:** arrancar con data real únicamente. Lo importante ya está en Supabase (notas dual-write, proyectos/equipo/transporte en tablas reales, teardown en `fecha_desarme_fin`). Las claves localStorage huérfanas se descartan. Único pendiente real = docs (Fase 6).

### 2C — Limpieza final ✅ HECHO (commit `5687973`)
- `crm.js`: eliminado el bloque CSS `.mkt-*` (274 líneas) que quedó huérfano al sacar Marketing.
- `admin-panel.js`: `_getModuleColor` `recursos`→`activos`; `rrhh` y `contabilidad` movidos al azul Admin&Finanzas (los dots del audit-log ahora matchean el árbol canónico).
- Comentarios header "RECURSOS" → categoría correcta: `compras.js`/`locaciones.js` (ACTIVOS), `rrhh.js` (ADMIN & FINANZAS), banner de `data.js`.
- `undo.js`: **verificado VIVO** (index.html + app.js + proyectos/proyecto-detalle/modules/audit-log lo usan). Nada que borrar.
- Bumps: `crm.js?v=13`, `data.js?v=8`, `compras.js?v=4`, `locaciones.js?v=3`, `rrhh.js?v=8`, `admin-panel.js?v=8`. `node --check` OK en los 6.
- **NO tocado** (bisturí): CSS `.cal-*` de style.css (lo usa el Lobby) + placeholders de badges finanzas/inventario en 0 (su arreglo es scope Fase 8/9).

### 2B — Consolidación de duplicados → AUDITADA y DIFERIDA ✅
Auditoría read-only en **`AUDITORIA-2B-duplicados.md`**. Veredicto: **NO se consolida nada en Fase 2** (los 3 duplicados caen en el camino de Fases 3/4 → consolidar ahora = retrabajo). Diferidos:
- `personas` vs `rrhh_*` → **mini-fase RRHH dedicada** (Nómina ya migró; Vacaciones/Asignación siguen legacy).
- `logistica_vehiculos`/`logistica_movimientos` → **Fase 3** (Flota=`vehiculos`) + **Fase 4** (transporte=`cargas`).
- `taller_proyecto_checklist` vs `taller_checklist` → **Fase 4**. 1 fix chico candidato (el badge de Taller cuenta de la tabla vieja), pendiente de OK de Fede + verificación de schema.

## ✅ FASE 2 COMPLETA (2026-06-07)
Saneamiento localStorage→Supabase + limpieza cosmética + auditoría de duplicados con plan de diferimiento. **Pendiente de Fede:** pull + hard refresh `Ctrl+Shift+R`, F12 sin rojos, navegar (CRM anda, dots del audit-log con color correcto, mini-calendario del Lobby intacto).

---

## PENDIENTES — Reformulación de EVENTOS (se hace cuando el plan llegue a Eventos; el calendario lo refleja después)

> Anotado por Fede (2026-06-07). El criterio: la data de asignaciones/logística se carga y estructura en **Eventos**; el **calendario solo la refleja** (read-only). Cuando reformulemos Eventos hay que **volver a pasar por el calendario** para reflejar la nueva estructura.
>
> **⭐ Calendario ACEPTADO como está (2026-06-07).** Su **segundo pase** (reflejar historial real + asignaciones por día + vehículos) es **POST-arreglo de Eventos**. No volver a tocar el calendario hasta entonces.

### ⭐⭐ Constructor de FECHAS/HORARIOS tipo TABLA (jornadas) — eventos.js (spec Fede 2026-06-07)
Reemplaza el form actual de fechas (que tiene 1 fecha + 1 hora apertura/cierre por fase). El nuevo:
- Por fase (**armado / evento / desarme**): **MÚLTIPLES días = jornadas**. Cada jornada = fecha + hora inicio + hora fin.
- **Tiempo continuo/lineal** a lo largo de los días. Ejemplo textual de Fede:
  - **Armado:** día 8 `08:00→20:00` · día 9 `08:00→24:00` · día 10 (víspera) `00:00→10:00`.
  - **Evento:** día 10 `10:00→20:00` · día 11 `10:00→20:00` · día 12 `10:00→20:00`.
  - **Desarme:** día 12 `20:30→...`.
- **Objetivo:** una TABLA clara, cómoda y entendible de los horarios con sus jornadas. Tiene que poder **mandarse como captura** → ser "fuente de info de verdad" para quien pregunte.
- **Datos:** requiere modelo per-día → probable tabla nueva **`evento_jornadas`** (`evento_id, fase, fecha, hora_inicio, hora_fin, orden`) — **DDL**. (O JSONB en `eventos`; a decidir en el diseño.) Reemplaza/extiende las columnas single `fecha_*_inicio/fin` + `hora_*_apertura/cierre` actuales.
- El **calendario** refleja las jornadas (fases multi-día con sus horarios por día).
- **Absorbe** el teardown→columna de 2.2 (cuando se haga este constructor, la sección Fechas se reescribe entera).
- Se combina con la **asignación de gente por día** (item 1 abajo): cada jornada tiene su headcount + roles.

1. **Asignación de personas POR DÍA dentro del evento** (no solo por fase). Ej.: armado de 2 días → día 1 van 8 personas, día 2 van 4; a la apertura va 1–2 de guardia hasta abrir. Cada día/fase con su headcount y su gente.
2. **Roles discriminados y agrupados, desplegables/colapsables:** gente de armado vs eléctricos vs chofer, etc. Agrupar la gente por rol dentro de cada día/fase.
3. **Vehículos en logística:** que figure el/los vehículo(s) que van (hoy falta verlos claros). Probablemente como desplegable/agrupado. Vive en Eventos/Logística, se refleja en calendario.
4. **Historial del calendario (tab Historial):** hoy NO muestra nada. Debe registrar cambios: fecha modificada, gente asignada, flete asignado. Requiere reactivar `evento_historial` (hoy deshabilitado por schema desalineado — Fase 6) + re-habilitar `logEventChange` en `eventos.js` (está comentado) + cargar el historial en `_loadPanelData` del calendario (hoy hardcodeado `[]`).
5. **Calendario = inerte:** ✅ HECHO ahora — se quitaron del panel los botones de acción ("+ Asignar", "✓ Aprobar"). El calendario no edita nada; solo refleja + "Abrir ficha →" para ir a Eventos. (Bump `calendario-operativo.js?v=15`.)

## CRM — revisión "bien pro" (2026-06-07)

- **Tabs:** Clientes ✅ · Pipeline ✅ · Cotizaciones ✅ · Interacciones ✅ (ya registra y muestra el **autor** de cada una vía `metadata.usuario`) · Analítica ✅ (solo superadmin).
- **Marketing ELIMINADO del CRM** (decisión Fede: del todo). Sacado: tab, estado (`_campanias`/`_mktFilterEstado`), config (`_mktEstados`/`_mktCanales`), counts, lógica (load / quick-action / render-case) y las 5 funciones de marketing + el localStorage `crm_campanias`. **Reemplaza el sub-bloque 2.3** (ya no hay marketing→Supabase). Bump `crm.js?v=12`. Verificado en preview. **Pendiente trivial:** borrar el CSS `.mkt-*` muerto (crm.js ~5164-5437, marcado "ELIMINADO — borrar en cleanup"; invisible, no se genera markup).
- **PENDIENTE (feature) — Auditoría de TODOS los cambios del CRM:** registrar quién hace cada cambio (editar cliente, mover pipeline, editar cotización), no solo interacciones. Engancha con el `audit_log` global. A diseñar/construir.
- **VISIÓN FUTURA — chat multicanal:** centralizar todas las charlas con cada cliente (multicanal) dentro del CRM → ficha del cliente = historial completo de conversaciones + interacciones, para estar siempre actualizado de cada cliente.

## FASE 3 — Capa de Activos (EN CURSO)

### 3.1a — Flota ✅ HECHO (commit `6a2d0a0`)
Módulo `flota.js` en ACTIVOS (patrón canónico). Maestro `vehiculos` extendido (uso + plata) + mantenimiento como cola del activo (`produccion_mantenimiento.vehiculo_id`, motor único con Taller). Vistas por rol (plata solo admin). Registrado en data/router/index; `api.js` extendido. SQL `sql/fase3_flota.sql` (idempotente) corrido + perms `flota` en tabla `roles` (write super/admin, read pm/taller). **Verificado en prod (Chrome):** módulo anda, 2 vehículos reales, sin errores de consola. El "link no anda" era falta del perm `flota` en `roles` (aplicado directo vía consola, persistido; el SQL queda como registro).

### 3.1b — Repuntar legacy → DIFERIDO a Fase 4
Repuntar `badges.js` (VTV/seguro) + `eventos.js` (select transporte) a `vehiculos` y retirar `logistica_vehiculos`. Va junto con la **reformulación de Logística** en Fase 4 (decisión Fede: mejor todo junto). El legacy sigue vivo, no molesta.

### 3.2 — Locaciones ✅ REVISADO (commit `7d30229`)
Maestro completo y sano (Lugares · Documentación con vencimientos · Stock, admin-only). Bug arreglado en la raíz: `Modal.close()` sin id no cerraba nada → Cancelar + cierre post-guardado de los 3 modales de Locaciones estaban rotos (y el mismo patrón latente en compras/rrhh). Fix en `components.js` (close sin id = cierra el topmost). Flota pasó a `data-modal-close`. ⚠️ Para verlo en prod hace falta pull del server (estaba en `6a2d0a0`).

### Falta de Fase 3
Estandarizar códigos/naming del catálogo (recetas) + showcase comercial (a definir por Fede). Inventario y Locaciones ya son maestros sanos.

## FASE 4 — Operaciones (EN CURSO)

### 4.1 — Eventos: constructor de jornadas ✅ HECHO (commit `2ef6566`)
Tabla `evento_jornadas` (DDL `sql/fase4_evento_jornadas.sql`) + trigger `fn_evento_jornadas_sync` que **deriva** `fecha_*/hora_*` de `eventos` desde las jornadas (compat: calendario/lobby/badges sin tocar). **Trigger verificado en prod** (insert → inicio=min, fin=max, apertura=primer día, cierre=último día, exacto; data de prueba limpiada y evento restaurado). UI en la ficha de Eventos: sección Jornadas (tabla por fase screenshot-able) + modal constructor (agregar/quitar jornadas: día + hora inicio + hora fin). Additivo (el form rápido de Fechas sigue intacto). Absorbe el `teardownEndDate` de localStorage. ⚠️ Falta pull del server para ver la UI (`eventos.js?v=9`).
**Edge conocido:** si se borran TODAS las jornadas de una fase, sus columnas derivadas quedan con el último valor (el guard no las nulea). Menor.

### 4.1c — Jornadas como única fuente (commits `f877f59` + sig.)
Decisión Fede: las fechas dejan de editarse a mano; las jornadas son la base (también para citar gente por jornada en 4.2).
- Sacado el editor de Fechas de la ficha → queda **read-only** (resumen derivado). El editor es Jornadas.
- Sacadas las 4 fechas por fase del modal de **crear evento** → ahora **1 rango tentativo opcional** (`tentDesde/tentHasta` → eventStart/End; armado/desarme y horarios salen de las jornadas).
- Botón **"+ Jornada" hereda** día siguiente + mismo horario de la última (cargar jornadas consecutivas = 1 click). Helper `_nextDay` TZ-safe.
- **Deuda menor:** el branch `isEditing` de `_renderPanelFechas` quedó muerto (sin trigger) → limpiar en una pasada futura.

### 4.2 — Gente por jornada ✅ HECHO (commit `f89f2bf` + sig.)
Reusa `asignaciones_evento` + `jornada_id` (SQL `sql/fase4_2_asignaciones_jornada.sql`). La sección **Equipo se reemplazó** por la gestión dentro de **Jornadas**: cada jornada (día) muestra su gente con **rol editable** (select inline) + **quitar** (×) + **"＋ persona"** (modal persona+rol). Las viejas sin jornada caen en grupo "Generales". Asignaciones desde la ficha entran `estado='aprobada'` (sin notif). `setJornadas` es **upsert** (preserva ids → editar horarios no borra gente). ⚠️ Falta pull del server para ver/probar.

### 4.3 — Vehículos visibles en la ficha ✅ HECHO (commit `4bcc8aa`+sig.)
En la sección "Vehículos y cargas" de la ficha (la que aparece cuando el evento tiene cargas) se agregó un **resumen de vehículos distintos** (chips 🚚 descripción · patente ×N) arriba de las cargas por fase. Hace "verlos claros" sin entrar a cada carga. ⚠️ Inerte hasta que haya cargas (hoy 0 en el sistema) + pull del server (v15). 4.2 verificado **end-to-end en prod** (jornada→asignar→aparece; upsert; cascade; fix de colisión `_openAsignarJornadaModal`).

### 4.4 — UX "Jornadas y personal" más legible ✅ HECHO (commit `ee493f1`)
Feedback Fede: "no veía bien" la asignación de gente por día. Mejorado: **sacada la sección Fechas** (redundante con jornadas, que son la única fuente); cada día muestra **día-de-semana + horario + duración** (ej. "Mié 08-may · 08:00–20:00 · 12h") + **"N personas" destacado** en turquesa + gente **ordenada por rol**. Verificado visualmente (captura). Tener ubicados los RRHH por día de un vistazo.

### 4.5 — Alta de gente multi-select ✅ HECHO (commit `5762dfa`)
Feedback Fede: el alta de a uno era un desastre (sobre todo en eventos de muchos días). Nuevo modal **"Asignar gente a jornadas"** (botón "+ gente"): tildás **varias personas** (rol por c/u o **rol por defecto** que las setea), elegís **a qué días** van (multi-check, pre-marca el del botón), y crea todas las asignaciones de una con **dedup** automático. El **chofer no se carga acá** (viene del vehículo/carga). Previewed visualmente (captura).

### 4.6 — Historial + docs de evento ✅ HECHO (commits `cd6bd49` + `814485f`)
Schema real de prod **verificado vía PostgREST** (no asumido): `evento_documentos` = `nombre/url/tipo/_deleted`; `evento_historial` = `user_id/accion/detalle(jsonb)/_deleted`. La API estaba **comentada** contra el schema viejo (`nombre_archivo/storage_path/…`, `tipo/descripcion/metadata/…`) → reescrita al schema real. **Sin DDL.**
- **Docs** (`eventos.js`): dejan localStorage (`ev_docs_`) → tabla `evento_documentos`. Alta con **nombre + link (Drive/URL) + tipo**, baja (soft delete), listado async en la ficha. Nombre clickeable si tiene link.
- **Historial** (`eventos.js`): sección nueva en la ficha + `logEventChange` **manual desde JS** (autoinyecta el usuario en `detalle`). Se loguea: jornadas actualizadas (fecha), asignó/quitó gente, doc agregado/eliminado. `createCarga` (api.js) loguea "Flete asignado".
- **Calendario** (`calendario-operativo.js`): el tab Historial del panel ahora trae `evento_historial` real (antes `[]`) + docs vía API. Render adaptado al schema nuevo.
- **Fix de paso:** `_refreshPanel` (eventos) ahora recarga las secciones async (proyectos/transporte/jornadas/docs/historial); antes quedaban en "Cargando…" tras editar notas/fechas.
- **RLS:** policies de ambas tablas en `sql/rls_eventos_proyectos.sql` (auth CRUD + anon select, idempotente). Si en prod no estuvieran aplicadas, los insert fallan silenciosos → correr ese SQL.
- Bumps: api v30, eventos v18, calendario v16, style v15. **Pendiente verificación de Fede en server.**

### 4.7 — 2º pase del calendario ✅ HECHO (commit `9003793`)
El panel del evento en el Calendario Operativo refleja (read-only) la estructura nueva. La edición sigue 100% en Eventos.
- **Tab Info → "Jornadas y personal":** replica la tabla de horarios por día de la ficha — por fase, cada jornada (día + horario + duración) con su gente agrupada por rol. Carga `evento_jornadas` vía `API.getJornadas` en `_loadPanelData`; agrupa asignaciones por `jornada_id` (las sin jornada → "Generales").
- **Tab Logística → vehículos:** resumen de vehículos distintos (chips 🚚 descripción · patente ×N) arriba de las cargas. Se quitó la lista de personas por fase (ahora va por día en Info; `_renderAsignacionesNewSection` queda definida pero sin uso).
- **Historial** ya se reflejaba (commit `814485f`). Bump calendario v17.

### Falta de Fase 4 (Eventos/Calendario)
Subalquileres por proveedor · 3.1b (repuntar legacy badges/eventos) + repensar Logística. (Taller = sección propia abajo.)

## FASE 4 — Taller: dashboard + flujo Oficina→Taller (EN CURSO)

**Naturaleza (no perder de vista):** taller = gente poco tech (Diego/Juan/Carlos/Willy), interfaz **ULTRA simple**, tablet en el galpón, el encargado **mueve** estados (no crea). Ve qué construir + toda la info, y pasa dudas al PM (nexo/deudor con el cliente).

**Diseño cerrado con Fede (2026-06-08):**
- **Flujo:** el PM, con todo cerrado, aprieta **"Pasar a Taller"** → proyecto `estado='en_taller'` → aparece en el dashboard + aviso. (SB3.)
- **Etapas = checks EDITABLES.** Plantilla: Estructura · Pintura · Gráfica · Equipamiento · Iluminación · Listo para cargar. El encargado tilda/agrega/renombra/quita por proyecto (cada stand es distinto).
- **UX decidido (3 forks):** tildar **desde la card** · estado **auto-sugerido** (1er check→armado; todos→"Listo" pulsa; confirma con tap) · editar con botón **"✎"** (evita toques accidentales). Pedido extra de Fede: **"más dinamismo"** → pills, barra animada, chip de urgencia, haptic.
- **Info delegada que ve el taller:** planos con medidas (técnicos) + renders + notas del PM. Materiales/insumos → **v2**.
- **Roles:** taller pierde `proyectos` (ve Eventos + Taller). (SB4.)

**SB1 — SQL ✅** (`sql/taller_checklist_editable.sql`, commit `3c32739`): `taller_proyecto_checklist` (vacía) → editable (label/orden/_deleted, item_key opcional, sin UNIQUE). **Pendiente que Fede lo corra.**

**SB2 — Checklist editable en la card ✅** (commit `d925d5f`): la card del stand = tablero vivo. Pills tildables (optimista + barra animada + haptic), modo ✎ (agregar/renombrar/quitar inline), estado auto-sugerido, chip de urgencia por fecha de armado. Tabs → **Producción + Mantenimiento** (la pestaña Checklist se absorbió en la card). API reescrita (array por proyecto + seed/add/rename/delete/setChecked **por id**). Badge repuntado a la tabla real. **Fix:** el bump `api.js?v=30` previo nunca entró (index seguía en v29 → el api.js nuevo no cargaba sin hard-refresh) → ahora **api v31** (historial/docs + checklist), taller v7, badges v3. La siembra de la plantilla es lazy en `_loadHoy` (proyectos sin checks) — en SB3 se mueve al gatillo.

**Falta:**
- **SB3** — gatillo "Pasar a Taller" en la ficha del proyecto (oficina) → `en_taller` + seed de la plantilla + notif al taller. El dashboard pasa a filtrar por `estado='en_taller'` (hoy filtra por `estado_taller != cerrado` — provisorio).
- **SB4** — detalle del stand read-only (planos/renders/notas, sin entrar a Proyectos) + sacar `proyectos` del rol taller (data.js + tabla `roles`) + reemplazar "→ Ficha" de la card por ese detalle interno.

## Próximas fases (ver PLAN-MAESTRO para detalle)
- **Fase 2 — Saneamiento de datos (PRIORIDAD):** localStorage→Supabase (eventos, calendario-operativo, CRM marketing); consolidar duplicados con bisturí; limpieza (`calendar.js` muerto).
- Fases 3–10: capa de Activos, Taller+Logística+Subalquileres, Compras+rentabilidad, Diseño, CRM, Finanzas+Contabilidad, Notificaciones+stats, Remate UI.
