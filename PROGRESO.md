# PROGRESO — Rediseño LOBBY-MEPEX

> Bitácora de ejecución del rediseño. Si la sesión se corta, leer **este archivo + `PLAN-MAESTRO-rediseno-lobby.md`** y retomar donde quedó.
> Branch de trabajo: **`rediseno`** (no se pushea; Fede valida en browser por sub-bloque).
> Companion: `BRIEF-ARRANQUE-CODE.md` (protocolo), `RECONOCIMIENTO-LOBBY.md` (estado del código).

---

## Estado general
- **Fase actual:** 1 — Cimientos: navegación + roles.
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

### 1B — Estructura de menú canónica (árbol destino) ⏳ PENDIENTE
- `recursos` → `activos` (id + nombre) en `Data.categories` (`data.js`).
- OPERACIONES al orden destino: Calendario · Eventos · Proyectos · Taller · Logística (hoy: calendario·proyectos·eventos·taller·logistica → swap eventos/proyectos).
- ACTIVOS = Inventario · Locaciones · Compras (hoy recursos: compras·inventario·locaciones → reordenar).
- COMERCIAL queda [crm, cotizador, catalogo]; ADMIN & FINANZAS queda [rrhh, finanzas, contabilidad, costos] (sin cambios).
- Actualizar breadcrumbs "RECURSOS" → "ACTIVOS" en `inventario.js`, `locaciones.js`, `compras.js` (mismo rename; bump `?v=`). RRHH no se toca (ya estaba en admin).
- Bump `data.js?v=7`.
- **Test:** cada rol ve la estructura nueva (ACTIVOS en vez de RECURSOS, orden correcto), sin errores.

---

## Próximas fases (ver PLAN-MAESTRO para detalle)
- **Fase 2 — Saneamiento de datos (PRIORIDAD):** localStorage→Supabase (eventos, calendario-operativo, CRM marketing); consolidar duplicados con bisturí; limpieza (`calendar.js` muerto).
- Fases 3–10: capa de Activos, Taller+Logística+Subalquileres, Compras+rentabilidad, Diseño, CRM, Finanzas+Contabilidad, Notificaciones+stats, Remate UI.
