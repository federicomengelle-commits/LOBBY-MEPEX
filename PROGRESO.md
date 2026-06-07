# PROGRESO — Rediseño LOBBY-MEPEX

> Bitácora de ejecución del rediseño. Si la sesión se corta, leer **este archivo + `PLAN-MAESTRO-rediseno-lobby.md`** y retomar donde quedó.
> Branch de trabajo: **`rediseno`** (no se pushea; Fede valida en browser por sub-bloque).
> Companion: `BRIEF-ARRANQUE-CODE.md` (protocolo), `RECONOCIMIENTO-LOBBY.md` (estado del código).

---

## Estado general
- **Fase actual:** 1 — Cimientos (1A + 1B implementadas y verificadas en preview; pendiente confirmación de Fede en server). Próximo: **Fase 2 — Saneamiento de datos**.
- **Última actualización:** 2026-06-07.

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

## FASE 2 — Saneamiento de datos (EN CURSO)

**Hallazgo clave del reconocimiento:** el problema "calendario no multiusuario" NO es falta de tablas. `eventos.js` YA usa tablas reales (proyectos.evento_id, `asignaciones_evento`, `getEventoTransporte`, `evento_documentos`, notas con dual-write a `eventos`). El que quedó atrás es **`calendario-operativo.js`**, que enriquece leyendo localStorage (`ev_proyectos_/ev_equipo_/ev_transporte_/ev_notas_/ev_docs_`). Las claves `ev_proyectos_/ev_equipo_/ev_transporte_` **no tienen escritor** → lecturas huérfanas (data vacía/vieja). ⇒ Fase 2 es más **rewiring/consolidación** que crear tablas; la DDL real es chica.

Mapa localStorage de negocio:
- `eventos.js`: `ev_ext_<id>` (incluye `teardownEndDate`, sin columna), `ev_docs_<id>` (existe tabla real `evento_documentos`), `ev_notas_<id>` (ya dual-write a `eventos`).
- `calendario-operativo.js`: lee `ev_proyectos_/ev_equipo_/ev_transporte_/ev_notas_/ev_docs_` (huérfanas) + `co_events_cache` (solo cache UI, no es dato de negocio).
- `crm.js`: `crm_campanias` (no existe tabla; hay TODO para `marketing_campanias`).

Sub-bloques:
- **2.0 — Cleanup:** matar `calendar.js` (muerto, confirmado: `Calendar` nunca referenciado). ✅ HECHO. (CSS `cal-*` huérfano en style.css queda; inocuo, se limpia después.)
- **2.1 — calendario-operativo.js → Supabase:** ✅ HECHO. El enrich de la grilla usa data REAL en 3 bulk queries (`API.getProyectosByEventos / getAsignacionesByEventos / getCargasByEventos`) en vez de localStorage huérfano. `projectCount` real (antes siempre 0); detección de conflictos real (equipo/transporte). Notas y teardownEndDate ya venían reales de `getEvents`. Removidas las claves huérfanas `ev_proyectos_/ev_equipo_/ev_transporte_/ev_notas_`. **Docs siguen en localStorage (`ev_docs_`) → bloqueado por Fase 6** (`evento_documentos` existe pero su API está comentada por schema desalineado). `co_events_cache` queda como fallback offline. Bumps `api.js?v=25`, `calendario-operativo.js?v=9`. Verificado en preview (métodos OK, sin errores). **Pendiente de Fede:** ver el calendario con data real en el server.
- **2.2 — eventos.js cerrar localStorage:** ✅ **Notas → columna** (`notas_operativas`): `_saveNotas` persiste solo a Supabase (sin localStorage); el panel lee `ev.notasOperativas`; eliminado `_getNotas` + la clave `ev_notas_` del cleanup. Bump `eventos.js?v=8`. **Teardown DIFERIDO:** el `teardownEndDate→columna` se absorbe en el **constructor de fechas/jornadas** (no se hace ahora para no rehacerlo). **Docs** (`ev_docs_`) → Fase 6. Sin DDL.
- **2.3 — CRM marketing → Supabase:** crear `marketing_campanias`, migrar `crm_campanias`. DDL. ⏳
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

## Próximas fases (ver PLAN-MAESTRO para detalle)
- **Fase 2 — Saneamiento de datos (PRIORIDAD):** localStorage→Supabase (eventos, calendario-operativo, CRM marketing); consolidar duplicados con bisturí; limpieza (`calendar.js` muerto).
- Fases 3–10: capa de Activos, Taller+Logística+Subalquileres, Compras+rentabilidad, Diseño, CRM, Finanzas+Contabilidad, Notificaciones+stats, Remate UI.
