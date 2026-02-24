# BRIEF PARA ANTIGRAVITY — MEPEX Módulos: Eventos, Proyectos, Clientes

## CONTEXTO DEL PROYECTO

Sistema de gestión interno de **MEPEX** (empresa de montaje de stands y equipamiento para exposiciones). SPA en HTML + CSS + JS vanilla. Sin frameworks. Ya deployado en Vercel, con datos reales consumidos desde un backend en Railway.

El archivo a modificar es `modules.js`. Es el único archivo que necesita cambios. No tocar `index.html`, `style.css`, `api.js`, `auth.js`, `router.js`, `data.js`.

---

## ARQUITECTURA — CÓMO FUNCIONA HOY

```
const Modules = {
  render(moduleId)              // Entry point. Arma el shell: subheader + sidebar + #moduleContent
  _renderModuleSubHeader()      // Breadcrumb + chips de conexión a otros módulos
  _renderSectionSidebar()       // Nav lateral con las secciones del módulo
  _renderSectionContent()       // Dispatcher: external | api-powered | static fields
  _getApiSectionType()          // Mapeo moduleId:sectionId → tipo de datos ('events','projects','clients')
  _loadSectionData()            // Fetch async desde API, guarda en _currentApiData, llama _renderApiTable
  _renderApiTable()             // Dispatcher → _renderEventsTable / _renderProjectsTable / _renderClientsTable
  _renderEventsTable(events)    // ← REEMPLAZAR COMPLETAMENTE
  _renderProjectsTable(projects)// ← REEMPLAZAR COMPLETAMENTE
  _renderClientsTable(clients)  // ← MEJORAR
  _eventStatusClass()           // Helper badge color por status
  _priorityClass()              // Helper badge color por prioridad
  _projectStatusClass()         // Helper badge color por status proyecto
  _renderField()                // Renderer de campos estáticos (no tocar)
  _attachEvents()               // Event listeners sidebar (no tocar)
}
```

**Flujo de datos:**
1. Usuario hace click en sección → `_attachEvents` → `_loadSectionData`
2. `_loadSectionData` detecta tipo via `_getApiSectionType`, fetchea `API.getEvents()` / `API.getProjects()` / `API.getClients()`
3. Guarda resultado en `this._currentApiData` y `this._currentApiType`
4. Llama `_renderApiTable` → renderiza tabla en `#apiDataContainer`
5. El input `#apiSectionSearch` filtra sobre `_currentApiData` y re-renderiza

**Campos disponibles por tipo (vienen de Railway/Notion):**

*Eventos:*
- `e.id`, `e.name`, `e.status`, `e.priority`
- `e.eventStartDate`, `e.eventEndDate` (fechas ISO string)
- `e.setupDate` (fecha de armado — puede no existir aún, tratar como opcional)
- `e.teardownDate` (fecha de desarme — puede no existir aún, tratar como opcional)
- `e.venue` (string: "La Rural", "CEC", etc.)
- `e.totalStands`, `e.completedStands` (números)
- `e.organizerEmail`, `e.organizerPhone` (pueden ser null)
- `e.manualUrl`, `e.reglamentoUrl`, `e.planoUrl` (URLs a archivos, pueden ser null)

*Proyectos:*
- `p.id`, `p.number`, `p.name`, `p.status`, `p.area`
- `p.requestDate` (fecha ISO)
- `p.eventId`, `p.clientId` (relaciones — pueden ser null)
- `p.type` (tipo: 'Stand personalizado', 'Alquiler', etc.)

*Clientes:*
- `c.id`, `c.name`, `c.razonSocial`, `c.cuit`
- `c.email`, `c.phone`
- `c.rubro` (array de strings o string)
- `c.contactName`, `c.contactRole`

**Helpers disponibles:**
- `API.formatDate(dateStr)` → "13 mar 2026"
- `API.formatCUIT(cuit)` → "30-12345678-9"

---

## LO QUE HAY QUE CONSTRUIR

### 1. `_renderEventsTable(events)` — REEMPLAZAR COMPLETO

**Vista: tabla con columnas configurables.**

La toolbar del section content (que ya existe en `_renderSectionContent` para api sections) debe extenderse con:
- Buscador (ya existe: `#apiSectionSearch`)
- Contador de registros (ya existe: `#apiRecordCount`)
- **NUEVO:** Selector de columnas visibles (dropdown o toggle chips): el usuario puede mostrar/ocultar columnas. Persistir en `localStorage` con key `mepex_events_cols`.
- **NUEVO:** Filtro rápido por estado (chips clickeables: Todos / Sin empezar / En proceso / Finalizado)

**Columnas disponibles (todas visibles por defecto excepto las marcadas):**

| ID columna | Header | Campo | Default visible |
|---|---|---|---|
| `nombre` | Evento | `e.name` | ✅ |
| `venue` | Lugar | `e.venue` | ✅ |
| `armado` | F. Armado | `e.setupDate` | ✅ |
| `evento` | F. Evento | `e.eventStartDate` → `e.eventEndDate` (rango) | ✅ |
| `desarme` | F. Desarme | `e.teardownDate` | ✅ |
| `prioridad` | Prioridad | calculada automáticamente | ✅ |
| `estado` | Estado | `e.status` | ✅ |
| `stands` | Stands | `completedStands/totalStands` | oculta por defecto |
| `archivos` | Archivos | links manual/reglamento/plano | ✅ |

**Lógica de Prioridad Automática** (calcular desde `e.eventStartDate`, no usar `e.priority` del backend):

```js
function calcPriority(eventStartDate) {
  if (!eventStartDate) return { label: '—', class: 'badge-ghost', dias: null };
  const dias = Math.ceil((new Date(eventStartDate) - new Date()) / 86400000);
  if (dias < 0)   return { label: 'Finalizado', class: 'badge-ghost', dias };
  if (dias <= 14) return { label: `Urgente · ${dias}d`, class: 'badge-danger priority-urgent', dias };
  if (dias <= 30) return { label: `Alta · ${dias}d`, class: 'badge-danger', dias };
  if (dias <= 60) return { label: `Media · ${dias}d`, class: 'badge-accent', dias };
                  return { label: `Baja · ${dias}d`, class: 'badge-ghost', dias };
}
```

El badge `priority-urgent` debe tener animación CSS pulse (agregar solo si no existe en style.css, como style inline o `<style>` inyectado).

**Columna Archivos:** si existen las URLs, mostrar íconos-link clickeables inline:
- 📋 Manual → `e.manualUrl`
- 📜 Reglamento → `e.reglamentoUrl`  
- 🗺️ Plano → `e.planoUrl`

Si ninguna URL existe → mostrar `—`.

**Click en fila:** por ahora `console.log('Abrir ficha evento:', e.id)` — la ficha se construye después.

**Ordenamiento:** click en header de columna ordena ASC/DESC. Indicador visual (▲▼) en el header activo.

---

### 2. `_renderProjectsTable(projects)` — REEMPLAZAR COMPLETO

**Vista: tabla con columnas configurables.** Misma lógica de persistencia que eventos (`mepex_projects_cols`).

**Toolbar adicional:**
- Filtro rápido por estado (chips): Todos / Ingreso / En proceso / Aprobado / Finalizado / Rechazado
- Filtro por tipo (dropdown): Todos / Stand personalizado / Stand prediseñado / Alquiler / Congreso / Estructura / Exposición / Camarín

**Columnas:**

| ID | Header | Campo | Default |
|---|---|---|---|
| `numero` | # | `p.number` | ✅ |
| `nombre` | Proyecto | `p.name` | ✅ |
| `tipo` | Tipo | `p.type` | ✅ |
| `estado` | Estado | `p.status` | ✅ |
| `evento` | Evento | `p.eventId` (mostrar ID por ahora, luego se linkea) | ✅ |
| `cliente` | Cliente | `p.clientId` (ídem) | ✅ |
| `fecha` | F. Solicitud | `p.requestDate` | ✅ |
| `area` | Área m² | `p.area` | oculta por defecto |

**Estados y sus colores:**

```js
const PROJECT_STATUS = {
  'Ingreso':           'badge-ghost',
  'Para presupuestar': 'badge-ghost',
  'Aguarda respuesta': 'badge-accent',
  'Aprobado':          'badge-success',
  'En proceso':        'badge-accent',
  'Entregado a taller':'badge-success',
  'Finalizado':        'badge-success',
  'Rechazado':         'badge-danger',
};
```

**Click en fila:** `console.log('Abrir ficha proyecto:', p.id)` — ficha después.

**Ordenamiento:** mismo sistema que eventos.

---

### 3. `_renderClientsTable(clients)` — MEJORAR (no reemplazar estructura, ampliar)

Agregar a la toolbar existente:
- Filtro por rubro (dropdown dinámico generado desde los rubros únicos presentes en los datos)

Agregar columna **Contacto** entre Empresa y CUIT:
- Mostrar `c.contactName` + `c.contactRole` si existen

**Click en fila:** `console.log('Abrir ficha cliente:', c.id)` — ficha después.

---

### 4. TOOLBAR EXTENDIDA — Modificar `_renderSectionContent`

Para las secciones api-powered, la toolbar actual es:
```html
<div class="api-section-toolbar">
  <div class="api-search-box">...</div>
  <span class="api-record-count">...</span>
</div>
```

Debe quedar:
```html
<div class="api-section-toolbar">
  <div class="api-search-box">...</div>
  <div class="api-toolbar-filters" id="apiToolbarFilters">
    <!-- Inyectado por cada _render*Table según el tipo -->
  </div>
  <div class="api-toolbar-actions">
    <button class="btn btn-ghost btn-sm" id="btnToggleCols" title="Columnas visibles">⊞ Columnas</button>
  </div>
  <span class="api-record-count" id="apiRecordCount">Cargando…</span>
</div>
<div class="api-cols-panel" id="apiColsPanel" style="display:none">
  <!-- Inyectado por cada _render*Table según el tipo -->
</div>
```

Los event listeners de filtros y columnas se attached dentro de cada `_render*Table` después de insertar el HTML.

---

### 5. HELPERS DE BADGE — Actualizar `_eventStatusClass` y `_priorityClass`

```js
_eventStatusClass(status) {
  if (!status) return 'badge-ghost';
  const s = status.toLowerCase();
  if (s.includes('confirmado') || s.includes('activo')) return 'badge-success';
  if (s.includes('montaje') || s.includes('proceso') || s.includes('empezar') === false) return 'badge-accent';
  if (s.includes('sin empezar')) return 'badge-ghost';
  if (s.includes('finalizado')) return 'badge-ghost';
  return 'badge-ghost';
},
```

La prioridad ya NO usa `_priorityClass` con `e.priority` del backend. Se reemplaza por la función `calcPriority` que calcula desde la fecha.

---

## RESTRICCIONES — NO TOCAR

- No modificar `render()`, `_renderModuleSubHeader()`, `_renderSectionSidebar()`, `_renderField()`, `_attachEvents()`
- No modificar ningún otro archivo (index.html, style.css, api.js, auth.js, router.js, data.js)
- Mantener el patrón `this._currentApiData` / `this._currentApiType` para que el search global siga funcionando
- No agregar dependencias externas
- CSS inline o `<style>` tag inyectado solo para lo mínimo que no esté cubierto (ej: animación urgent). Preferir clases existentes.

---

## CLASES CSS EXISTENTES (para mantener consistencia visual)

Del style.css actual, estas clases ya existen y deben usarse:

```
.api-table-wrap, .api-table, .api-table-row  → tabla base
.td-primary                                   → columna principal (negrita/color)
.td-number                                    → columna numérica (monospace, alineada derecha)
.badge, .badge-success, .badge-danger, .badge-accent, .badge-ghost → badges de estado
.btn, .btn-sm, .btn-ghost, .btn-secondary     → botones
.input                                        → inputs
.api-section-toolbar                          → toolbar contenedor
.api-search-box, .api-search-input            → buscador
.api-record-count                             → contador registros
.api-loading, .api-spinner                    → loading state
.api-offline-msg                              → error de conexión
.api-empty                                    → sin resultados
.label                                        → texto etiqueta uppercase
.text-muted                                   → texto secundario
.chip                                         → chip/tag clickeable
```

Para el panel de columnas y filtros chips, crear clases nuevas con prefijo `mepex-` para no colisionar:
`.mepex-filter-chips`, `.mepex-filter-chip`, `.mepex-filter-chip.active`, `.mepex-cols-panel`, `.mepex-col-toggle`

---

## ENTREGABLE

Un único archivo `modules.js` completo y funcional que reemplaza al actual. Mismo nombre, misma estructura, mismos métodos — solo los tres `_render*Table` y la toolbar extendida modificados, y los helpers de badge actualizados.
