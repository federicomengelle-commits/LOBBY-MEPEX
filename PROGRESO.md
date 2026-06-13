# PROGRESO — Rediseño LOBBY-MEPEX  ·  AVANCE ≈ 49%

> **Registro de lo YA HECHO.** Lo que FALTA vive en `PLAN-MAESTRO-rediseno-lobby.md` (≈51%).
> *(Rebalanceo 2026-06-13d: reconciliación PROGRESO↔PLAN (workflow ultracode): confirmados acá Capa 1 + RLS comercial + Costos UX F1/F2/F3; +Fase 11 Centro de Tareas ≈10% al PLAN → universo creció. PROGRESO 50→49, PLAN 50→51.)*
> *(Rebalanceo 2026-06-13b: +Fase Costos UX ≈5% al PLAN-MAESTRO — el universo creció → el % bajó sin perder trabajo: PROGRESO 51→49, PLAN-MAESTRO 49→51.)*
> *(Rebalanceo 2026-06-13: +RRHH.2/3/4 → Fase RRHH v2 cerrada salvo RRHH.5 (bloqueada por Finanzas). El universo había crecido 2026-06-12 con Fase 9.bis Roles & Permisos ≈3%.)*
> *(Rebalanceo 2026-06-11: el % bajó sin perder trabajo — el universo creció al expandirse la mini-fase RRHH ≈3% en la fase RRHH v2 ≈8% con diseño cerrado.)*
> **Regla de los 2 archivos (Fede, 2026-06-07):** al cierre de cada sesión → mover lo completado de PLAN-MAESTRO acá y **rebalancear los %** (PROGRESO sube, PLAN-MAESTRO baja). Las ideas para fases futuras se suman al PLAN-MAESTRO, no acá.
> **Workflow:** desarrollar en branch `rediseno`; commit por sub-bloque; merge `--ff-only` a `main` + `git push origin main` → Fede pullea en el server y prueba. SQL-first en fases con DDL.
> **Baseline:** `rediseno`=`main` @ `7437138` *(actualizado 2026-06-13d)*.
> Companions: `PLAN-MAESTRO` (lo que falta), `BRIEF-ARRANQUE-CODE.md` (protocolo), `RECONOCIMIENTO-LOBBY.md` (estado del código).

---

## Estado general — AVANCE ≈ 49%
- **Hecho:** Fase 1 ✅ · Fase 2 ✅ · **Fase 3** (Flota + Locaciones) ✅ · **Fase 4 — EVENTOS** completa · **historial + docs a Supabase ✅** · **2º pase del calendario ✅** · **Taller — dashboard dinámico + flujo Oficina→Taller COMPLETO (SB1–SB4) ✅** (checklist editable, gatillo "Pasar a Taller", detalle del stand read-only, taller sin Proyectos).
- **Próximo (Fase 4) — ⛔ CUELLO DE BOTELLA ÚNICO: el cotizador del VPS tiene que escribir `cotizacion_items` en Supabase** (con flag propio/subalq + cantidad por línea + link a proyecto). Eso desbloquea de una: **subalquileres por proveedor** (PDF/mail) **y el remito simple de Logística** (Fede eligió "items del cotizador", no carga manual). Sin esa integración, ambos quedan trabados. Detalle en `PLAN-MAESTRO` §Fase 4.
  - **Logística — avance:** badge de vehículos → **Flota** ✅ (commit `89470ab`, verificado en prod). Decisiones del remito tomadas (por proyecto+evento, foto de firma, sacar pestaña Vehículos). Falta (post-cotizador): construir el remito + retirar cargas.
- **Fase 9 — TRANSVERSAL GLOBAL ✅ COMPLETA Y VERIFICADA (charla 03, 2026-06-08):** centro de notificaciones 2 capas (9.1 motor `Alertas` `4ed1278` · 9.2 campana `95aa6b6` · 9.3 página + silenciar `bc466e8`) + categoría GLOBAL en el menú (9.4 `fb3e755`) + stats por usuario / tab Actividad (9.5 `0e100ee`) + lobby home por rol híbrido (9.6 `11f83da`). Ver §Fase 9 abajo.
- **Desbloqueado para avanzar AHORA (manteniendo el orden):** **Fase 5 — Compras + rentabilidad por proyecto** (siguiente en orden, desbloqueada). Después Fase 6 (Diseño) · Fase 7 (CRM auditoría) · Fase 8 (Finanzas/Contab.) · Fase 10 (Remate UI). **Fase 4** sigue trabada por el cotizador (`cotizacion_items` vacía). **Fase RRHH v2 (diseño cerrado 2026-06-11, blueprint listo) intercalable — RRHH.1–4 sin dependencias.**
- **📐 DISEÑO RRHH v2 CERRADO (charla 04, 2026-06-11 — solo diseño, sin código):** módulo RRHH completo estilo CRM en 5 tabs (Panel / Nómina con ficha sub-tabs / Planificación grilla persona×días / Ausencias / Jornales lente-persona) + DDL + migración legacy + 5 etapas → **`docs/modulo-rrhh-v2-blueprint.md`** (SPEC obligatoria) + fase en PLAN-MAESTRO. Verificado contra prod: `personas.cuil`/`fecha_nacimiento` YA existen (SQL del repo desfasado); `direccion`/`cbu_alias`/`contacto_emergencia` NO. Decisiones Fede: sin presentismo (ausencias por excepción) · docs solo fechas+semáforo · sin self-service · jornales: la CARGA vive en Finanzas. **Spin-off:** "Rendimiento por evento" (planilla de costos que reemplaza el Excel de Lelean + dashboard de ganancia por evento) → prompt entregado para charla aparte, anotado en PLAN-MAESTRO §Fase 8; RRHH.5 depende de esa pieza.
- **Baseline:** `origin/main` al día (`b10f2a4`). Branch dev: `rediseno` (= main).
- **🔄 SYNC 2026-06-12:** verificado que Fases G/H de Finanzas YA están codeadas en main + SQL G.5/H corridos en prod (detalle en PLAN-MAESTRO §Fase 8 — NO re-implementar). Decisiones Fede de hoy: **importador asistido de `cotizacion_items` APROBADO** (stopgap del cuello de botella Fase 4) + **loop deploy VPS aprobado** (endpoint /deploy + no-cache + backup pg_dump).
- **🆕 SESIÓN 2026-06-12 — Infra de autonomía + RRHH.1 (ver §Infra y §Fase RRHH v2 abajo):**
  - **Infra/red de seguridad** (commits `6edea4e` + `3553e9d`, pusheados): `tools/check.sh` (smoke-check pre-push: sintaxis + console.log DEBUG + bumps `?v=`), `tools/mapa-tablas.js` → `docs/mapa-tablas.md` (85 tablas ↔ código, para retiros de legacy seguros), `sql/snapshot_schema.sql` (dump information_schema + verificación G.1/mapeos), endpoint `/deploy` en `lobby-api` + `tools/vps/backup-supabase.sh` + `docs/vps-deploy-loop.md` (guía A/B/C). **Falta:** instalación guiada en el VPS (descubrimiento hecho: nginx + pm2 `lobby-api` en `/home/mepex/lobby-api` fuera del repo → `REPO_DIR`; `pg_dump` falta instalar; **listmonk ya instalado** → candidato E3 mailing).
  - **B3 — seed `mapeo_cuentas` resultó YA HECHO** (verificado en prod 2026-06-12, sesión autenticada): 12 mapeos activos, cuentas G.1 4.9.01/5.9.01 existen, asientos automáticos generándose (6/8 últimos). El "bug de asientos en vacío" del CLAUDE.md §10 está RESUELTO. NO re-seedear.
  - **RRHH.1 ✅ PUSHEADO** (commits `83f33b5`+`139a31b`+`7edb00a`): ver §Fase RRHH v2 abajo.
- **🆕 SESIÓN 2026-06-13 — RRHH.2 + schema snapshot (ver §Fase RRHH v2):**
  - **`docs/schema-prod.md` ✅** (commit `95b74cd`): snapshot completo de ~80 tablas de prod (vía `sql/snapshot_schema.sql` que corrió Fede). Fuente de verdad del schema. **Hallazgo:** `cotizacion_items` ya tiene schema RICO (no necesita ALTER para B4); link cotización↔proyecto vía `cotizaciones.project_id`; propio/subalq deriva de `catalogo_items.tipo_receta`.
  - **RRHH.2 ✅ PUSHEADO** (commits `22a5829`+`385d131`): tab Ausencias + saldos vacaciones + retiro lecturas legacy `rrhh_*`. SQL `sql/rrhh2_ausencias.sql` corrido por Fede. Verificado end-to-end en prod. Ver §Fase RRHH v2.
  - **RRHH.3 ✅ PUSHEADO** (commits `d7cb1f9`+`7023857`): tab Planificación — grilla persona operativa × quincena + banner aprobar convocatorias. Sin DDL (lee asignaciones_evento + ausencias + eventos). Verificado end-to-end en prod (grilla, navegación, aprobar, conflicto). Ver §Fase RRHH v2.
  - **RRHH.4 ✅ PUSHEADO** (commits `757d7f3`+`b10f2a4`): tab Panel (dashboard KPIs, ahora landing) + sub-tab Docs con semáforo (`persona_documentos`, DDL corrido por Fede) + alerta `documento_por_vencer`. Verificado end-to-end en prod (Panel, CRUD docs, semáforo, alerta). **Con esto la Fase RRHH v2 queda cerrada salvo RRHH.5** (Jornales, ⛔ bloqueada por "Rendimiento por evento" de Finanzas). Ver §Fase RRHH v2.
- **✅ VERIFICADO EN PROD (Chrome, 2026-06-08):** los 3 SQL corridos + pull hecho (api v32 / taller v10 / data v10 / pjd v5) + roles taller corregido en la tabla (`{eventos:read, taller:write, logistica:write, inventario:read, flota:read}`). Flujo Taller testeado end-to-end: **"Pasar a Taller"** (estado=`en_taller` + 6 pasos sembrados + notif al rol taller) · **checklist editable** con tildado optimista + **auto-estado que PERSISTE** (bug `created_by` resuelto, verificado en DB) · **detalle del stand** (info + Drive + checklist + notas) · **docs/historial RLS** OK (insert/delete probados). Data de prueba limpiada. **Bug encontrado y arreglado en el acto:** los botones "Cerrar"/"Entendido" de los modales del taller usaban `data-modal-cancel` (no cerraban) → `data-modal-close` (commit `73f98a6`).
- **⏳ Solo queda (decisión de Fede):** validar los **pasos REALES del taller con el equipo** (Diego/Juan/Carlos/Willy) → alimenta el catálogo/presets v2.
- **🆕 SESIÓN 2026-06-13b — Fase 9.bis Roles & Permisos · Capa 1 ✅ + Capa 2 motor/financiero (SQL listo, sin correr):**
  - **Capa 1 — RBAC fuente única ✅ HECHA:** la matriz del Panel deriva de `Data.getPermissionableModules()` (data.js) en vez de la lista hardcodeada `admin-panel._permModules` (BORRADA) que driftaba (le faltaba `flota`, mostraba el difunto `parametros-globales`). Refresco de cache al guardar (sin re-login). Verificado en node. **Extras misma tanda:** categoría **GLOBAL fuera del sidebar** (redundante con dropdown+campana) · **`compras` movido ACTIVOS→ADMIN & FINANZAS** (breadcrumb realineado). Bumps `data.js?v=12`/`admin-panel.js?v=10`/`compras.js?v=10`.
  - **Capa 2 — RLS MANEJADA POR LA MATRIZ (diseño cerrado con Fede):** la RLS lee `roles.permissions` vía helpers → el acceso se configura inline desde el Panel, sin tocar SQL. NO esconde filas entre oficina (es nivel módulo/tabla); "responsable" = atribución, no pared. **SQL listo para correr (Fede ejecuta, SQL-first):** `sql/rls_capa2_motor.sql` (helpers `fn_user_role`/`fn_role_can`, superadmin short-circuit, SECURITY DEFINER) + `sql/rls_capa2_financiero.sql` (20 tablas, defensivo/transaccional, rollback incluido). Pre-flight OK: el Lobby (venta/pm) NO lee tablas financieras. **Update 2026-06-13d:** los 3 tiers (motor + `rls_capa2_financiero.sql` + `rls_capa2_comercial.sql`) ✅ escritos, commiteados (`3a25d86`+`2cd1163`) y **corridos por Fede**. Comercial: cotizaciones+hijas gate `crm` sin anon; `clientes` lectura amplia (taller.js + encuesta.html anon la leen). **⚠ NO cerrar anon en eventos/clientes/catálogo** (encuesta.html:267-268 + cotizador). **Resta = auditoría de corrección:** lock escritura `roles`/`profiles` + cerrar anon operativo tabla-por-tabla. Filtro "Míos" = opcional (no construido). Detalle en PLAN-MAESTRO §Fase 9.bis.
- **🆕 Fase Costos UX — F1/F2/F3 ✅ PUSHEADAS** (`e9fb2bd` F1+F2, `65a27c0` F3; `costos.js?v=32`): refactor de presentación del módulo Costos (RPC `calcular_receta` sigue siendo la única fuente). F1 quick-edits inline (popovers 2 clics) · F2 editor receta full-screen + fila fantasma + recibo vertical con "pendiente" · F3 variante subalquilado + ficha Insumos full-screen. ⏳ Falta validación visual de Fede en prod + F4 (Listas/Parámetros + pulido) → PLAN-MAESTRO. Blueprint `docs/costos-rediseno-ux-blueprint.md`.
- **Última actualización:** 2026-06-13d (Fase 9.bis Capa 1 + Capa 2 RLS motor/financiero/comercial corridos · Costos UX F1/F2/F3 · reconciliación de docs vía workflow ultracode + Fase 11 Centro de Tareas anotada). Próximo macro a elegir por Fede: **Fase 7 CRM "Casos"** (WhatsApp/Gmail/IA) · **Fase 8 Finanzas** (auditoría + "Rendimiento por evento" que desbloquea RRHH.5) · **Fase 4 Logística-remito** (espera cotizador) · **Fase 5 enhancements** · **Fase 9.bis Roles & Permisos**. Pendiente de Fede: pull en VPS + verificación visual de las 4 tabs de RRHH + instalación guiada del loop de deploy + correr los DROP comentados de `sql/rrhh2_ausencias.sql` (con backup).

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

## FASE 4 — Taller: dashboard + flujo Oficina→Taller (COMPLETO v1 · ✅ VERIFICADO EN PROD 2026-06-08)

**Naturaleza (no perder de vista):** taller = gente poco tech (Diego/Juan/Carlos/Willy), interfaz **ULTRA simple**, tablet en el galpón, el encargado **mueve** estados (no crea). Ve qué construir + toda la info, y pasa dudas al PM (nexo/deudor con el cliente).

**Diseño cerrado con Fede (2026-06-08):**
- **Flujo:** el PM, con todo cerrado, aprieta **"Pasar a Taller"** → proyecto `estado='en_taller'` → aparece en el dashboard + aviso. (SB3.)
- **Etapas = checks EDITABLES.** Plantilla: Estructura · Pintura · Gráfica · Equipamiento · Iluminación · Listo para cargar. El encargado tilda/agrega/renombra/quita por proyecto (cada stand es distinto).
- **UX decidido (3 forks):** tildar **desde la card** · estado **auto-sugerido** (1er check→armado; todos→"Listo" pulsa; confirma con tap) · editar con botón **"✎"** (evita toques accidentales). Pedido extra de Fede: **"más dinamismo"** → pills, barra animada, chip de urgencia, haptic.
- **Info delegada que ve el taller:** planos con medidas (técnicos) + renders + notas del PM. Materiales/insumos → **v2**.
- **Roles:** taller pierde `proyectos` (ve Eventos + Taller). (SB4.)

**SB1 — SQL ✅** (`sql/taller_checklist_editable.sql`, commit `3c32739`): `taller_proyecto_checklist` (vacía) → editable (label/orden/_deleted, item_key opcional, sin UNIQUE). **Pendiente que Fede lo corra.**

**SB2 — Checklist editable en la card ✅** (commit `d925d5f`): la card del stand = tablero vivo. Pills tildables (optimista + barra animada + haptic), modo ✎ (agregar/renombrar/quitar inline), estado auto-sugerido, chip de urgencia por fecha de armado. Tabs → **Producción + Mantenimiento** (la pestaña Checklist se absorbió en la card). API reescrita (array por proyecto + seed/add/rename/delete/setChecked **por id**). Badge repuntado a la tabla real. **Fix:** el bump `api.js?v=30` previo nunca entró (index seguía en v29 → el api.js nuevo no cargaba sin hard-refresh) → ahora **api v31** (historial/docs + checklist), taller v7, badges v3. La siembra de la plantilla es lazy en `_loadHoy` (proyectos sin checks) — en SB3 se mueve al gatillo.

**SB3 — Gatillo + filtro ✅** (commit `d6c46b9`): botón naranja **"Pasar a Taller"** en la ficha del proyecto (`proyecto-detalle.js`, oficina) → `estado='en_taller'` + siembra el checklist + notif al rol taller. El dashboard de Producción ahora filtra por `estado='en_taller'` (solo lo delegado) + `estado_taller != cerrado`. (Visible salvo que ya esté en_taller/finalizado/rechazado.)

**SB4 — Detalle del stand + roles ✅** (commit `52ddce0`): la card "→ Detalle" abre un **modal Taller-interno** (`_openStandDetail`) con info + planos/renders (Drive embebido + link) + checklist read-only + notas del PM (novedades) — sin entrar a Proyectos. El rol **taller pierde `proyectos`** (data.js fallback + `sql/taller_rol_sin_proyectos.sql` para la tabla `roles` = fuente de verdad). Ahora ve eventos/taller/logistica/inventario/flota (+ lobby/calendario).

**Taller v1 COMPLETO.** Solo falta que Fede corra los 3 SQL (ver Estado general) + **valide los pasos REALES con el equipo** → eso alimenta el catálogo/presets v2 (ver PLAN-MAESTRO §Taller v2).

**Edges/deudas conocidas:** (1) la siembra del checklist es lazy en `_loadHoy` además del gatillo (defensivo). (2) un stand `despachado` sigue en el dashboard hasta que el PM lo finaliza o pasa a `cerrado` (no hay botón "cerrar/archivar" en la card todavía). (3) `_proyectosChecklist`/`_selectedChecklistProyecto` quedaron como state sin uso (inocuo). (4) la pestaña Checklist vieja se borró; su CSS `.tlr-chk-*` quedó muerto en el bloque tanda2 (inocuo).

## FASE 9 — Centro único de notificaciones (núcleo · ✅ VERIFICADO EN PROD 2026-06-08, charla 03)

Fusión de los 3 sistemas que vivían sueltos (Lobby-alertas + campana `Notifications` + `Badges`) en un centro coherente de **dos capas**. Decisiones Fede: **dos capas** (no feed único) · **campana + página** · **rol + silenciar tipos**.

**9.1 — Motor único `Alertas` ✅** (commit `4ed1278`): nuevo `alertas.js` = fuente única de "pendientes" (estado vivo derivado). 9 generadores con definición canónica role-gated; reproduce las queries schema-correctas que estaban **duplicadas con criterios distintos** entre `badges.js` y `lobby.js`. Dispatch `mepex:alertas` tras recomputar. `badges.js` → **proyector fino** de los dots del sidebar (delega en Alertas; entry points app/auth/router intactos). Las cards "ALERTAS" del Lobby proyectan los mismos items. **Cambio intencional:** el Lobby ahora usa la def. de los dots (antes calculaba distinto → algún número puede verse distinto, es la consolidación). Verificado en prod: dot `taller:1` + card "1 stand sin terminar" salen del motor.

**9.2 — Campana 2 capas ✅** (commit `95aa6b6`): el dropdown gana pestañas **Novedades** (feed `notifications`, leído/no-leído como hasta hoy) + **Pendientes** (del motor `Alertas`). El **badge suma no-leídas + pendientes** (antes solo no-leídas). Repinta en vivo escuchando `mepex:alertas`. Tab switch sin cerrar; "marcar todas" solo en Novedades; pendientes navegan al módulo. Sheet mobile con tabs. Verificado: Novedades 7 / Pendientes 1, badge=1.

**9.3 — Página centro completo + preferencias ✅** (commit `bc466e8`): `#notificaciones` (era un **stub muerto** de prefs) → centro real con 3 secciones: **Preferencias** (silenciar avisos por categoría: Logística y remitos / Asignaciones de gente / Taller y producción), **Actividad reciente** (feed hasta 100, marcar todas leídas, click navega), **Pendientes** (estado vivo). Silenciado **por usuario** en localStorage (`mepex_notif_mute_<uid>`, consistente con `getStartModule`); `Notifications.isMuted()` filtra la campana (Novedades + conteo no-leídas + badge). Los **pendientes y los dots NO se silencian** (señal ambiental). Verificado: silenciar Logística baja el feed 7→1 y vuelve a 7 al reactivar; persiste por usuario.

**9.4 — Categoría GLOBAL en el menú ✅** (commit `fb3e755`): nueva sección **GLOBAL** en el sidebar (`Data.categories`) con **Panel de Control** (admin-panel, solo superadmin) + **Centro de notificaciones** (todos). Registrado `notificaciones` como módulo; sumado al special-case always-visible del sidebar (como lobby/calendario). En el Lobby, GLOBAL solo le muestra el Panel a superadmin. Sin DDL (el sidebar se construye directo de `Data.categories`). Verificado en prod: sidebar con sección GLOBAL = Admin + Notificaciones, click navega.

**9.5 — Stats por usuario ✅** (commit `0e100ee`): nuevo tab **Actividad** en el Panel de Control (superadmin), analítica temporal desde `audit_log` + `profiles` (complementa el Dashboard, que es foco "hoy"). Métricas: acciones 30d, más activo, promedio/día. Gráfico CSS de actividad del equipo (14 días). Tabla por usuario: acciones 7d/30d, **días activos** (jornadas distintas con actividad), módulo top, última actividad, último login. **Nota:** `audit_log` NO registra login/logout (solo create/edit/update/delete) → se muestra "días activos" en vez de "sesiones"; tiempo de sesión exacto = futura iteración. Verificado en prod (67 acciones/30d, Fede 11 días activos, 16 usuarios).

**9.6 — Lobby/Home por rol (Híbrido) ✅** (commit `11f83da`): decisión Fede = **híbrido**. venta/pm ahora aterrizan en el **Lobby** al loguear (home por rol con KPIs + contenido propio — `_fetchVentaKPIs`/`_fetchPMKPIs`, `_loadVentaContent` "mis próximos eventos" / `_loadPMContent` "esta semana" — que ya estaban construidos pero inalcanzables); **taller sigue directo a su tablero** (eventos) por ser ULTRA simple (tablet en galpón). `router.js`: `_defaultRoutes` venta/pm→`lobby`; restricción del lobby pasó de "solo super/admin" a allow-list `[superadmin,admin,venta,pm]`. Verificado en prod: getDefaultRoute correcto por rol, lobby superadmin sin regresión, code paths venta/pm OK (3 KPIs c/u, sin errores). **⏳ Falta verificación visual de Fede con logins venta/pm reales.**

### ✅ FASE 9 COMPLETA (charla 03, 2026-06-08)
Centro único de notificaciones (9.1-9.3) + categoría GLOBAL en el menú (9.4) + stats por usuario (9.5) + lobby home por rol híbrido (9.6). **Deuda futura** (en PLAN-MAESTRO): tiempo de sesión exacto (audit_log no loguea login/logout); silenciado cross-device; limpiar `settings._getNotifPrefs/_setNotifPrefs` muertos.

**Deudas menores:** (1) `settings._getNotifPrefs`/`_setNotifPrefs` (placeholders viejos) quedaron muertos → limpiar en una pasada. (2) El silenciado es por navegador (localStorage), no cross-device — futuro `profiles.notif_prefs` con DDL. (3) El badge sigue contando no-leídas + pendientes; si Fede prefiere separarlos visualmente, es un ajuste chico.

## FASE 5 — Compras: doble paso (✅ doble paso COMPLETO · charla 03)

Modelo doble paso (Pedido taller → OC Compras). **SQL corrido por Fede** (`sql/fase5_compras_doble_paso.sql`): `compras_pedidos` + `compras_oc_presupuestos` + ALTER `compras_ordenes` (pedido_id/tipo/descripcion/link/cantidad/categoria_gasto). Tipos verificados (compras_* = **bigint**, proyectos uuid, `egresos.orden_compra_id` ya existe).

**5.A — Pedidos ✅** (commit `109b151`, verificado en prod): paso 1 completo.
- **API** (`api.js?v=33`): `getPedidos/getPedidoById/createPedido` (+notif a admin) `/updatePedido/setPedidoEstado/deletePedido` sobre `compras_pedidos`.
- **Compras** (`?v=5`): tab nuevo **Pedidos** — tabla (descripción/destino/quién/estado/fecha + acciones estado pendiente→en_compra→comprado + cancelar/eliminar) + modal "+ Nuevo pedido" (tipo insumo/libre, datalist de 79 insumos, imputación proyecto/categoría-gasto, urgencia). Deep-link `#compras?tab=pedidos`.
- **Taller** (`?v=11`): botón **"🛒 Pedir compra"** en cada card de stand → modal ULTRA simple (qué/cantidad/link/urgencia/nota, proyecto pre-set, sin precios).
- Verificado: crear+listar+estados+notif. **Fix:** `entidad_id` omitido en la notif (pedido.id es bigint y `notifications.entidad_id` es uuid → rompía el insert). **⏳ Falta verificación visual de Fede del botón en Taller** (necesita un stand `en_taller`).

**5.B — OC: presupuestos + ganadora + convertir pedido→OC ✅** (commit `f44b799`, verificado en prod): botón **"Crear OC"** en Pedidos (`createOrdenFromPedido` → crea `compras_ordenes` con `pedido_id`+descripción+proyecto+categoría, marca pedido `en_compra` + linkea, abre el detalle) + "Ver OC". Sección **"Presupuestos de proveedor"** en el detalle de OC: agregar (proveedor de lista o nombre libre + monto + link), **elegir ganadora** (radio) → vuelca proveedor + `monto_total` a la OC. API: `createOrdenFromPedido/getPresupuestos/addPresupuesto/deletePresupuesto/setGanadora`. (`compras_ordenes.proveedor_id` es nullable, OK.)

**5.C — Disparo a Egresos ✅** (commit `f44b799`, verificado en prod): botón **"Generar egreso en Finanzas"** cuando hay ganadora → crea `egresos` (imputado al proyecto, proveedor como texto), marca **OC `recibida`** + **pedido `comprado`** + dup-check. Al pagarse en Finanzas entra como **costo** en Rent. Proyecto. **⚠ Mismatches del schema viejo resueltos** (en `api.generarEgresoDeOC`): `egresos.orden_compra_id`/`proveedor_id` son **uuid** (no matchean compras_* bigint) → omitidos, proveedor va como `destinatario` texto, link OC↔egreso por **estado (`recibida`) + N° de OC en el concepto**; `egresos.categoria` tiene CHECK (`proveedor/credito_fiscal/servicio`) → `'proveedor'` + la taxonomía de gasto va en `subcategoria`; `egresos.medio` NOT NULL → `'transferencia'` default.

**🔧 Fix post-test (charla 03, commit `85acd8a`, verificado en prod por Chrome en la sesión real de Fede):**
- **(a) Bug: crear OC desde un pedido CON proyecto rompía** — `compras_ordenes.proyecto_id` y `evento_id` eran **bigint** mientras proyectos/eventos son **uuid** (mismatch legacy de la tabla vieja). El test previo usó gasto sin proyecto → no lo pegó. Fix raíz: **`sql/fase5_fix_compras_ordenes_fk.sql`** ALTER ambos a uuid (tabla vacía, seguro). **✅ Fede lo corrió + VERIFICADO en prod por Chrome:** el pedido real **"Cable 2x1" convirtió a OC-0001 con el proyecto correcto** (`proyecto_id` = el uuid real), pedido → `en_compra` + linkeado. Y el **loop de rentabilidad CIERRA** — un egreso de una OC con proyecto imputa al `proyecto_id` (→ entra como costo en Rent. Proyecto al pagarse). Verificado end-to-end con pedido de prueba (limpiado).
- **(b) Pestaña Pagos retirada** (estaba en desuso; los pagos se trackean en **Finanzas** vía el egreso de la OC): botón + routing + deep-link + el auto-create de `compras_pagos` al marcar pagada. (Métodos `_loadPagos`/`_renderPagos` quedan muertos, inocuos.)
- **(c)** Detalle de OC ahora muestra **Imputación** (proyecto/gasto) + **Detalle**.
- **(d) Verificado end-to-end en prod (Chrome, gasto-path):** pedido→OC→presupuestos→ganadora→egreso. El egreso **impacta en Finanzas › Egresos** (categoria `proveedor`, subcategoria = gasto, destinatario = proveedor, estado pendiente) · OC `recibida` · pedido `comprado`. Data de prueba limpiada.

**🌟 Refinement — pedido MULTI-ÍTEM + unidad heredada (charla 03, commit `b247ce6`):** un pedido puede tener **varias cosas** del mismo proveedor (ej. cable 2x1 + cable 3x1). `compras_pedidos.items` jsonb (**`sql/fase5_pedido_items.sql` — ⏳ pendiente que Fede lo corra**). Modal de pedido (**Compras + Taller**) reescrito a multi-ítem: filas insumo+cantidad+unidad con "+ Agregar ítem"; la **unidad se HEREDA** de `insumos_base.unidad` al elegir el insumo (datalist). Resumen auto para listados/notif. Al convertir a OC, cada ítem → `compras_orden_items` (la OC los lista en "Items de la Orden", con la unidad en el nombre). El tab Pedidos muestra los ítems como chips. **`createPedido` degrada a single-ítem** si la columna `items` no existe todavía (no rompe). **✅ SQL corrido por Fede + VERIFICADO end-to-end en prod (Chrome):** pedido "Cable 2x1 ×10 m + Cable 3x1 ×5 m" → resumen "Cable 2x1 + 1 más" + items jsonb; al convertir → "Cable 2x1 (m)" / "Cable 3x1 (m)" en Items de la OC; **herencia de unidad OK** (elegir "Alfombra nueva + Nylon" auto-completa unidad "m²"). **⚠ Cache:** el VPS sirve `index.html` cacheado → tras un pull hace falta **hard refresh (Ctrl+Shift+R) una vez** para tomar v35/v8/v12 (los `?v=N` solos no alcanzan si el index quedó cacheado).

**🔧 Fix incongruencias OC presupuestos/ganadora/egreso (charla 03, commit `8cd3300`, VERIFICADO end-to-end vs DB real por Chrome con live-patch):** 3 bugs que reportó Fede, todos resueltos:
- **(1)** borrar la ganadora dejaba `monto_total`/`proveedor_id` viejos en la OC → `deletePresupuesto` + `setGanadora` ahora llaman **`_recomputeOCGanadora`** que sincroniza el cache de la OC con la ganadora **vigente** (o lo limpia si no hay).
- **(2)** "egreso generado" se trackeaba por el `estado` de la OC → **falso positivo** si el egreso se borraba → ahora `hasEgreso` consulta el **egreso REAL** (`_egresoForOC`, link por N° de OC al inicio del concepto; `egresos.orden_compra_id` es uuid huérfano → no se usa). Ya NO se setea `estado='recibida'` al generar.
- **(3)** el botón "Generar egreso" aparecía por `proveedor_id` viejo y generaba **egreso fantasma** → ahora requiere **ganadora vigente** (botón por `presupuestos.find(es_ganadora)`, generación valida la ganadora).
- La ficha **refresca la OC desde DB** antes de renderizar. Verificado: ganadora→borrar(limpia monto/proveedor)→nueva; generar→dup-check→borrar egreso(reaparece botón)→sin ganadora(no genera). **⏳ Pendiente: pull en el server (api v36 / compras v9) + hard refresh.**

**✅ Fase 5 doble paso COMPLETO** (5.A+5.B+5.C, charla 03) — Pedido (taller, 10 seg) → OC (Compras: presupuestos→ganadora) → Egreso (imputado al proyecto, cierra el pedido). **Falta (opcional / a revisar con Fede):** (a) columna de **presupuesto** (cotización del proyecto vía `proyectos.cotizacion_id`) en Rent. Proyecto para comparar vs gasto real; (b) revisar las **decisiones tomadas** (taxonomía de gasto fija, dónde vive exactamente, archivado de OCs); (c) si se quiere hard-link OC↔egreso, ALTER `egresos.orden_compra_id` a bigint (hoy es uuid huérfano). **⏳ Falta verificación visual de Fede** del flujo completo en el server.

## INFRA DE AUTONOMÍA (sesión 2026-06-12 · commits `6edea4e` + `3553e9d`, pusheados)

Red de seguridad + velocidad para que las sesiones autónomas no rompan prod (ideas del análisis ultracode 2026-06-12):
- **`tools/check.sh`** — smoke-check pre-push: (1) `node --check` de todos los `.js` de raíz, (2) caza `console.log` con marca DEBUG, (3) verifica que todo `.js` cambiado vs `origin/main` tenga su `?v=` bumpeado en index.html. Correr SIEMPRE antes de pushear.
- **`tools/mapa-tablas.js` → `docs/mapa-tablas.md`** — autogenera el mapa tabla↔código (`.from()`/`.rpc()` → archivos+líneas). 85 tablas/views + 3 RPCs. Responde "¿quién lee la tabla X?" antes de retirar legacy. Regenerar con `node tools/mapa-tablas.js`.
- **`sql/snapshot_schema.sql`** — UN SQL que devuelve information_schema completo + verificación G.1/mapeos/apertura. Fede lo corre, pega el JSON, se versiona en `docs/schema-prod.md`. (⏳ pendiente que Fede pegue el resultado.)
- **Loop deploy VPS** (código listo, ⏳ instalación guiada pendiente): endpoint `POST /deploy` en `lobby-api/index.js` (auth superadmin JWT o header `X-Deploy-Token`; hace `git pull --ff-only`, necesita `REPO_DIR=/home/mepex/lobby` en `.env` porque lobby-api vive fuera del repo) · `tools/vps/backup-supabase.sh` (pg_dump + rotación 30d + cron) · guía completa en `docs/vps-deploy-loop.md` (§0 descubrimiento ya hecho · §A /deploy · §B no-cache nginx para index.html · §C backup). Falta: instalar `pg_dump`, agregar el `location` no-cache en nginx, setear el cron. **Descubrimiento VPS** → `memory/reference_vps_layout.md` (nginx + pm2 cotizador/lobby/mepex-api · **listmonk instalado** = candidato E3 mailing).

## FASE RRHH v2 — RRHH.1/2/3/4 ✅ CERRADA salvo RRHH.5 (sesión 2026-06-12/13, PUSHEADO a main)

> Blueprint: `docs/modulo-rrhh-v2-blueprint.md`. SQL-first respetado. **4 tabs operativas: Panel (landing) · Nómina v2 · Planificación · Ausencias.** Solo queda **RRHH.5 Jornales** (lente read-only por persona), ⛔ bloqueada por la pieza "Rendimiento por evento" de Finanzas (Fase 8). El módulo RRHH quedó completo y usable sin RRHH.5.

### RRHH.1 — Nómina v2

- **SQL `sql/rrhh1_ficha_personas.sql`** (corrido por Fede, verificado en prod): ALTER `personas` + 7 columnas (`dni`, `direccion`, `contacto_emergencia_nombre/telefono`, `cbu_alias`, `banco`, `situacion_previsional`). `cuil`/`fecha_nacimiento` ya existían.
- **Nómina v2** (`rrhh.js?v=9`, commits `83f33b5`+`139a31b`+`7edb00a`): reescritura del tab Nómina al patrón CRM (tabla + panel lateral 380px, sin ficha full-page):
  - **Tabla:** búsqueda (nombre/rol/CUIL/tel), filtro por rol operativo canónico, **roles como chips**, teléfono como **link WhatsApp** (`wa.me`), columna **"Días año"** (días trabajados del año, derivados de `asignaciones_evento` aprobadas/confirmadas en 1 bulk query).
  - **Panel lateral** con sub-tabs: **Datos** (contacto/identidad/emergencia/bancario/trabajo — las 7 columnas nuevas + costo_dia), **Trabajo** (asignaciones próximas/anteriores desde `API.getAsignacionesByPersona` + counters eventos/días del año), **Notas** (textarea con guardado directo).
  - **Form ampliado** (modal large) con secciones Identidad/Contacto/Trabajo/Administrativo + roles operativos multi-check.
- **Bug encontrado y arreglado en preview** (`139a31b`): `asignaciones_evento.fecha_inicio/fin` son **TIMESTAMPTZ** (no DATE) → "días año" daba 0; normalizado a `YYYY-MM-DD`. Verificado: 11 personas con días reales.
- **Review adversarial** (3 lentes, opus-4-8) → 2 hallazgos `menor`, ambos arreglados (`7edb00a`): escape HTML en campos de texto libre (helper `_h()`) + Notas del modal volvió a `textarea`.
- **Verificado en preview** (data real, cero errores consola): 24 personas, panel abre/cierra, sub-tabs, búsqueda con foco preservado, inyección `<b>`/`<i>` NO se renderiza, value con comilla intacto, modal cierra OK.
- **⏳ Pendiente de Fede:** pull en VPS + verificación visual real.

### RRHH.2 — Ausencias + saldos + retiro legacy (`rrhh.js?v=10`, commits `22a5829`+`385d131`)
- **SQL `sql/rrhh2_ausencias.sql`** (corrido por Fede, tablas verificadas en prod): CREATE `ausencias` (tipo vacaciones/enfermedad/licencia/franco/falta · estado solicitada/aprobada/rechazada) + `vacaciones_saldos` (persona×año) + RLS + migración legacy (2 `rrhh_vacaciones`→saldos; 0 solicitudes). **Los DROP están al final COMENTADOS** (esperan verificación de Fede + backup).
- **Tab Ausencias** (reemplaza Vacaciones): leyenda 5 tipos color-coded · calendario mensual pintado por tipo · **saldos de vacaciones** con días usados DERIVADOS de las ausencias aprobadas (no se duplica el dato) · modal con **warning de solape** vs asignaciones de evento (avisa, no bloquea; usa `detectarConflictosPersona` con fin-de-día por el TIMESTAMPTZ).
- **Retiro de lecturas legacy:** `rrhh.js` (borrado código muerto ex-tab Asignación + Vacaciones → **0 lecturas `rrhh_*`**) · `api.js` (removidas 5 funciones `getEventoEquipo/add/update/removeEventoAsignacion/getEventosDePersona`, sin callers) · `alertas.js` (generador `rrhh()` repuntado a `ausencias` + fix: filtraba `estado='pendiente'` inexistente → nunca disparaba).
- **`rrhh_personal` NO se retira aún:** quedan 2 lectores legacy (`eventos.js _openAddMovimientoModal` + `api.js getEventoTransporte` embed `chofer:rrhh_personal!chofer_id`), ambos del flujo `logistica_movimientos` que se desmantela en **Fase 4**. Las otras 3 (`rrhh_asignaciones`/`rrhh_vacaciones`/`rrhh_vacaciones_solicitudes`) ya quedaron SIN lectores → DROPeables.
- **Review adversarial** (3 lentes, opus-4-8) → 2 hallazgos, ambos arreglados (`385d131`): (1) `_formatDate`/`_formatDateShort` desfasaban un día las columnas DATE (parseo UTC en es-AR) → helper `_toLocalDate`; corrige también el sub-tab Trabajo de Nómina; (2) limpieza de estado muerto (`_asignaciones/_vacaciones/_solicitudes/_events/_projects` + `_getEventName`).
- **Verificado end-to-end en prod** (tablas ya existían): crear ausencia "Franco" 2026-06-15 → tabla muestra **15/6** (sin desfase) + días hábiles=1 + DB OK; data de prueba limpiada. Cero errores de consola.
- **⏳ Pendiente de Fede:** pull en VPS + verificación visual + correr los DROP comentados (con backup).

### RRHH.3 — Planificación (grilla persona × quincena) (`rrhh.js?v=11`, commits `d7cb1f9`+`7023857`)
- **Sin DDL** — lee `asignaciones_evento` + `ausencias` + `eventos` (color). 3ª tab, entre Nómina y Ausencias.
- **Grilla persona operativa × 14 días** (quincena navegable ‹ Hoy ›, arranca el lunes de la semana), filtrable por rol operativo. Solo personas con `roles_operativos` no vacío (decisión Fede; evita ruido de oficina/ventas).
- **Celda:** color del evento / gris ausencia / **rojo conflicto** (2+ eventos distintos, o evento+ausencia el mismo día) / rayado = propuesta sin aprobar / vacío = libre. Tooltip con detalle, hoy resaltado, finde sombreado, click en bloque → deep-link al evento.
- **Banner de convocatorias pendientes** (`estado='propuesta'`) con **Aprobar** (`API.approveAsignacionEvento`) + Rechazar (`deleteAsignacionEvento`, soft-delete con confirm) inline. Centraliza lo que estaba repartido en Logística/Calendario. **Solo ver + aprobar** — asignar sigue en Eventos (decisión Fede).
- **Review adversarial** (3 lentes, opus-4-8) → 1 medio + 3 menor; arreglados los 3 accionables (`7023857`): (1) **off-by-one nocturno** — `fill()` + banner usaban `slice(0,10)` del TIMESTAMPTZ en UTC → una asignación 21–24h ART se pintaba un día tarde; ahora usan `_toLocalDate` (día local). Verificado: `2026-05-29T01:00Z` → 28/5 (era 29/5). (2) `evento.color` escapado con `_h` en el `style=`. (3) fecha del banner normalizada. Los 2 edge-cases restantes (banner muestra convocatorias de gente fuera de la grilla; propuesta que duplica una aprobada del mismo evento no se ve rayada) quedaron **documentados, no arreglados** (baja frecuencia, el banner igual las surfacea).
- **Verificado end-to-end en prod** (data real): grilla con bloques "Feria del Libro", navegación, aprobar convocatoria por botón (banner→vacío, DB→aprobada), conflicto rojo evento+ausencia. Data de prueba limpiada. Cero errores de consola.
- **⏳ Pendiente de Fede:** pull en VPS + verificación visual.

### RRHH.4 — Panel (dashboard) + Docs con semáforo (`rrhh.js?v=12`, `alertas.js?v=3`, commits `757d7f3`+`b10f2a4`)
- **SQL `sql/rrhh4_documentos.sql`** (corrido por Fede, tabla verificada en prod): `persona_documentos` (tipo/numero/fecha_emision/fecha_vencimiento/notas) + RLS. **Sin archivos adjuntos** (decisión Fede).
- **Tab Panel** (ahora **1ª tab + landing** del módulo, default `_activeTab='panel'`): 6 KPIs clickeables que navegan a su tab (activos por tipo · trabajando hoy · ausentes hoy · convocatorias pendientes · docs por vencer ≤30d · cumpleaños del mes) + 3 cards (Trabajando hoy · Documentación por vencer con drill-down a la ficha · Cumpleaños). El KPI "trabajando hoy" consulta asignaciones en ventana ±1 día y filtra por **día LOCAL** (TIMESTAMPTZ ↔ TZ).
- **Sub-tab Docs** en la ficha de Nómina (**solo tipo fijo/interna**, decisión Fede; guard en `_renderPanel`): CRUD de `persona_documentos` con tipos **DNI / Licencia de conducir / ART-seguro / Examen médico / Otro** + **semáforo** (vencido rojo / ≤30d naranja / vigente verde). Cache invalidado en `_closePanel`.
- **Alerta `documento_por_vencer`** en `alertas.js` (generador `rrhh()` ahora devuelve array: ausencias solicitadas + docs por vencer; tolera tabla inexistente).
- **Review adversarial** (3 lentes, opus-4-8) → 4 hallazgos `menor`; arreglados 3 (`b10f2a4`): (1) trabajando-hoy en día local (ventana ±1d + filtro), (2) cache `_panelDocs` reseteado en `_closePanel`, (3) sacada llamada `_openPanel` redundante en la navegación del doc-row. El 4º (doc-row de una persona no-fija aterriza en Datos) quedó **documentado, no arreglado** (frecuencia casi nula, sin estado roto).
- **Verificado end-to-end en prod** (data real): landing Panel + 6 KPIs (cumpleaños=3 reales), CRUD de doc real (Licencia #12345678 vence en 12d → naranja → aparece en KPI/card), doc-row del dashboard → ficha en sub-tab Docs. Data de prueba limpiada. Cero errores de consola.
- **⏳ Pendiente de Fede:** pull en VPS + verificación visual.

### RRHH.5 — Jornales (lente por persona) ⛔ BLOQUEADA
- Read-only: días/montos por evento, pendiente de cobro. **Bloqueada** por la pieza "Rendimiento por evento" (Finanzas, Fase 8) que define el contrato de los ítems jornal (`persona_id`/`fase`/`dias`/`tarifa`/`monto_pagado`/`egreso_id`). Se enchufa cuando esa pieza exista. **El módulo RRHH ya es completo y usable con 4 tabs sin esto.**

## Próximas fases (ver PLAN-MAESTRO para detalle)
- **Fase RRHH v2: CERRADA** salvo RRHH.5 (bloqueada por Finanzas). El próximo macro lo elige Fede entre: Fase 7 CRM "Casos" · Fase 8 Finanzas (auditoría + "Rendimiento por evento", que además desbloquea RRHH.5) · Fase 4 Logística-remito (espera cotizador) · Fase 9.bis Roles & Permisos · Fase 5/6 enhancements.
- **B4 — Importador `cotizacion_items`** (APROBADO 2026-06-12): stopgap que desbloquea remito + subalquileres de Fase 4. **🔄 CORRECCIÓN tras snapshot completo (`docs/schema-prod.md`, 2026-06-13):** `cotizacion_items` NO es minimalista — tiene schema RICO ya listo (`nombre/codigo/unidad/rubro/categoria/catalogo_item_id/precio_unitario_base/precio_unitario_ajustado/cantidad/subtotal_linea/espacio_id/...`); está vacía de FILAS, no de columnas. El link cotización↔proyecto YA EXISTE (`cotizaciones.project_id` en inglés). Propio/subalq se DERIVA del JOIN `cotizacion_items.catalogo_item_id → catalogo_items.tipo_receta`. **→ NO hace falta ALTER.** Solo falta: decisión de Fede sobre el formato de entrada del importador (pegar texto/CSV del cotizador/Maple) + un ejemplo real de output del cotizador para armar el parser.
- Fases 3–10: capa de Activos, Taller+Logística+Subalquileres, Compras+rentabilidad, Diseño, CRM, Finanzas+Contabilidad, Notificaciones+stats, Remate UI.
