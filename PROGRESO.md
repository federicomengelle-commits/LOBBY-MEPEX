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
Sidebar desacoplado de localStorage + estructura al árbol destino. Próximo: **Fase 2 — Saneamiento de datos** (localStorage→Supabase en eventos/calendario-operativo/CRM marketing; consolidar duplicados con bisturí; matar `calendar.js`).

---

## Próximas fases (ver PLAN-MAESTRO para detalle)
- **Fase 2 — Saneamiento de datos (PRIORIDAD):** localStorage→Supabase (eventos, calendario-operativo, CRM marketing); consolidar duplicados con bisturí; limpieza (`calendar.js` muerto).
- Fases 3–10: capa de Activos, Taller+Logística+Subalquileres, Compras+rentabilidad, Diseño, CRM, Finanzas+Contabilidad, Notificaciones+stats, Remate UI.
