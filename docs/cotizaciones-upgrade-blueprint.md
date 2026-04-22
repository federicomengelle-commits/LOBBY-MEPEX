# COTIZACIONES MODULE — Upgrade Blueprint

> **Contexto:** LOBBY-MEPEX, SPA vanilla JS (ES6+), Supabase, dark theme, desktop-first.
> **Archivos a modificar:** `api.js` y `modules.js` (y posiblemente `style.css`).
> **No tocar:** El Cotizador (app aparte en el VPS), ni el pipeline kanban (ya funciona), ni el sistema de fichas base.

---

## PASO A — Mapear campos faltantes en `api.js`

### Problema
La tabla `cotizaciones` en Supabase tiene columnas que el código no lee:
- `project_id` (uuid, FK a `proyectos_2026`)
- `event_id` (uuid, FK a `eventos_2026`)
- `full_state` (jsonb, estado completo del Cotizador con items, params, totals)
- `altura` (text)

### Qué hacer
En `api.js` → función `getCotizaciones()` → bloque `const mapped = (data || []).map(c => {` (línea ~1459), agregar estos campos al objeto retornado:

```js
projectId: c.project_id || null,
eventId: c.event_id || null,
fullState: c.full_state || null,
altura: c.altura || '',
```

Ubicarlos después de la línea `tipoCotizacion` / `tipoStand` (zona del cotizador, línea ~1479).

### Verificación
Después del cambio, en la consola del browser: `await API.getCotizaciones()` → la cotización COT-2026-0007 debe mostrar `projectId`, `eventId` y `fullState` con datos. Las dummy (si aún existen) tendrán null.

---

## PASO B — Borrar cotizaciones dummy

### Problema
Hay 4 cotizaciones dummy sin `full_state` ni `pdf_url`:
- COT-2026-0005 (Festival Sustentable BA)
- COT-2026-0003 (Congreso RRHH Latam)
- COT-2026-0006 (Expo Logística 2026)
- COT-2026-0001 (Expo Alimentek 2026)

### Qué hacer
Desde Supabase Dashboard, marcar `_deleted = true` en esos 4 registros. 

IDs:
```
060c4a7d-2116-4c87-a31c-10f41a49e669
819d832e-551b-4a15-9c9b-be30f92e9753
b881c973-a4fd-4b63-b416-0917bf0d1320
c30254f9-50f6-4352-9931-8874de93f900
```

No borrar físicamente — soft delete con `_deleted = true` (el sistema ya filtra por esto).

**NOTA:** Este paso es manual en Supabase, no requiere código.

---

## PASO C — Columnas clickeables en la tabla

### Problema
En `_renderCotizacionesTable()` (modules.js, línea ~5842), las celdas de Cliente y Evento son texto plano. No se puede navegar al cliente o evento desde la tabla.

### Qué hacer

#### C1. Columna Cliente → clickeable
En el `switch (col.id)` dentro de `_renderCotizacionesTable`, reemplazar el case `'cliente'`:

**Antes:**
```js
case 'cliente':
    return `<td class="td-primary">${c.clienteNombre || '—'}</td>`;
```

**Después:**
```js
case 'cliente':
    return c.clienteId
        ? `<td class="td-primary td-link" data-link-type="cliente" data-link-id="${c.clienteId}">${c.clienteNombre || '—'}</td>`
        : `<td class="td-primary">${c.clienteNombre || '—'}</td>`;
```

#### C2. Columna Evento → clickeable
Reemplazar el case `'evento'`:

**Antes:**
```js
case 'evento':
    return `<td>${c.nombreEvento || '—'}</td>`;
```

**Después:**
```js
case 'evento':
    if (c.eventId) {
        return `<td class="td-link" data-link-type="evento" data-link-id="${c.eventId}">${c.nombreEvento || '—'}</td>`;
    }
    return c.nombreEvento
        ? `<td class="td-link" data-link-type="evento-nombre" data-link-nombre="${c.nombreEvento}">${c.nombreEvento}</td>`
        : `<td>—</td>`;
```

#### C3. Agregar listeners en `_attachCotizacionesListeners()`
Después del bloque de "Row click → open ficha side panel" (línea ~5976), agregar:

```js
// Cell links → open ficha for cliente/evento
document.querySelectorAll('.td-link[data-link-type]').forEach(cell => {
    cell.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent row click from firing
        const linkType = cell.dataset.linkType;
        const linkId = cell.dataset.linkId;

        if (linkType === 'cliente' && linkId) {
            const clients = await API.getClients();
            const client = clients?.find(cl => cl.id === linkId);
            if (client) this._openFichaByType(client, 'clients');
        }
        if (linkType === 'evento' && linkId) {
            const events = await API.getEvents();
            const event = events?.find(ev => ev.id === linkId);
            if (event) this._openFichaByType(event, 'events');
        }
        if (linkType === 'evento-nombre') {
            const nombre = cell.dataset.linkNombre;
            if (nombre) {
                const events = await API.getEvents();
                const event = events?.find(ev => (ev.name || '').trim().toLowerCase() === nombre.trim().toLowerCase());
                if (event) this._openFichaByType(event, 'events');
            }
        }
    });
});
```

#### C4. CSS para td-link
Agregar en los estilos (dentro de `_injectStyles()` o en `style.css`):

```css
.td-link {
    cursor: pointer;
    color: var(--primary, #00A9C1);
    transition: color 0.15s;
}
.td-link:hover {
    color: #fff;
    text-decoration: underline;
}
```

### Verificación
Click en el nombre del cliente → abre ficha lateral del cliente.
Click en nombre del evento → abre ficha lateral del evento.
Click en fila fuera de esas celdas → abre ficha de la cotización (comportamiento existente).

---

## PASO D — Ficha Resumen: links por ID

### Problema
En `_attachCotizacionResumenLinks()` (línea ~3951), el link a evento busca por nombre (`item.nombreEvento`) en vez de usar `item.eventId`. No hay link a proyecto.

### Qué hacer

#### D1. Cambiar link de evento a usar eventId
En `_attachCotizacionResumenLinks()`, reemplazar el bloque del evento:

**Antes:**
```js
if (linkType === 'evento' && item.nombreEvento) {
    const events = await API.getEvents();
    const evName = item.nombreEvento.trim().toLowerCase();
    const event = events?.find(e => (e.name || '').trim().toLowerCase() === evName);
    if (event) { this._closeFicha(); setTimeout(() => this._openFicha(event, 'events'), 300); }
}
```

**Después:**
```js
if (linkType === 'evento') {
    const events = await API.getEvents();
    let event = null;
    // Prefer FK lookup
    if (item.eventId) {
        event = events?.find(e => e.id === item.eventId);
    }
    // Fallback to name match
    if (!event && item.nombreEvento) {
        const evName = item.nombreEvento.trim().toLowerCase();
        event = events?.find(e => (e.name || '').trim().toLowerCase() === evName);
    }
    if (event) { this._closeFicha(); setTimeout(() => this._openFicha(event, 'events'), 300); }
}
```

#### D2. Agregar link a Proyecto en la ficha Resumen
En la config de fichas `cotizaciones` → `renderTab` → sección de resumen (línea ~3297), después de la sección "Evento" (línea ~3329), agregar una sección Proyecto si existe:

```js
${item.projectId ? `<div class="ficha-section">
    <div class="ficha-section-title">Proyecto</div>
    <div class="ficha-row"><span class="ficha-row-label">Proyecto</span><span class="ficha-row-value"><span class="ficha-chip" data-link-type="proyecto" data-link-id="${item.projectId}" style="cursor:pointer; color:var(--primary)">📋 Ver proyecto</span></span></div>
</div>` : ''}
```

#### D3. Agregar handler para link de proyecto
En `_attachCotizacionResumenLinks()`, agregar después del handler de evento:

```js
if (linkType === 'proyecto' && (item.projectId || chip.dataset.linkId)) {
    const pid = item.projectId || chip.dataset.linkId;
    const projects = await API.getProjects();
    const project = projects?.find(p => p.id === pid);
    if (project) { this._closeFicha(); setTimeout(() => this._openFicha(project, 'projects'), 300); }
}
```

#### D4. Agregar event_id al chip de evento en la ficha
Reemplazar la línea del evento en renderTab resumen (línea ~3326):

**Antes:**
```js
<span class="ficha-chip" data-link-type="evento" style="cursor:pointer; color:var(--primary)">${item.nombreEvento}</span>
```

**Después:**
```js
<span class="ficha-chip" data-link-type="evento" data-link-id="${item.eventId || ''}" style="cursor:pointer; color:var(--primary)">${item.nombreEvento}</span>
```

---

## PASO E — Filtros por Cliente y Evento

### Problema
Solo hay chips de estado. Para un módulo comercial necesitás filtrar por cliente y por evento.

### Qué hacer

#### E1. Agregar state variables
En el objeto `Modules` (inicio de modules.js, zona de línea ~19-25), agregar:

```js
_activeCotClienteFilter: [],
_activeCotEventoFilter: [],
```

#### E2. Extender _getMultiFilterArray y _setMultiFilterArray
En `_getMultiFilterArray()` (línea ~4177), agregar:

```js
if (filterId === 'cot_cliente') return this._activeCotClienteFilter;
if (filterId === 'cot_evento') return this._activeCotEventoFilter;
```

En `_setMultiFilterArray()` (línea ~4184), agregar:

```js
if (filterId === 'cot_cliente') this._activeCotClienteFilter = arr;
if (filterId === 'cot_evento') this._activeCotEventoFilter = arr;
```

#### E3. Renderizar filtros en la tabla de cotizaciones
En `_renderCotizacionesTable()`, reemplazar el bloque de filter chips (línea ~5846):

**Antes:**
```js
const filtersEl = document.getElementById('apiToolbarFilters');
if (filtersEl) {
    const statuses = ['Todos', 'Borrador', 'Enviada', 'En Negociación', 'Aprobada', 'Cerrada Ganada', 'Cerrada Perdida'];
    filtersEl.innerHTML = `
        <div class="mepex-filter-chips">
            ${statuses.map(s => `
                <button class="mepex-filter-chip ${(!this._activeStatusFilter && s === 'Todos') || this._activeStatusFilter === s ? 'active' : ''}" data-status-filter="${s}">${s}</button>
            `).join('')}
        </div>
    `;
}
```

**Después:**
```js
const filtersEl = document.getElementById('apiToolbarFilters');
if (filtersEl) {
    const statuses = ['Todos', 'Borrador', 'Enviada', 'En Negociación', 'Aprobada', 'Cerrada Ganada', 'Cerrada Perdida'];
    const clienteOpts = [...new Set(cotizaciones.map(c => c.clienteNombre).filter(Boolean))].sort();
    const eventoOpts = [...new Set(cotizaciones.map(c => c.nombreEvento).filter(Boolean))].sort();

    // Use _currentApiData (unfiltered) for filter options so they don't disappear when filtering
    const allData = this._currentApiData || cotizaciones;
    const allClienteOpts = [...new Set(allData.map(c => c.clienteNombre).filter(Boolean))].sort();
    const allEventoOpts = [...new Set(allData.map(c => c.nombreEvento).filter(Boolean))].sort();

    filtersEl.innerHTML = `
        <div class="mepex-filter-chips" style="margin-bottom: 8px;">
            ${statuses.map(s => `
                <button class="mepex-filter-chip ${(!this._activeStatusFilter && s === 'Todos') || this._activeStatusFilter === s ? 'active' : ''}" data-status-filter="${s}">${s}</button>
            `).join('')}
        </div>
        <div class="mepex-multifilter-bar">
            ${this._renderMultiFilter('cot_cliente', 'Cliente', allClienteOpts, this._activeCotClienteFilter)}
            ${this._renderMultiFilter('cot_evento', 'Evento', allEventoOpts, this._activeCotEventoFilter)}
            ${(this._activeCotClienteFilter.length || this._activeCotEventoFilter.length) ? '<button class="mepex-filter-clear-btn" id="btnClearCotFilters">Limpiar filtros</button>' : ''}
        </div>
    `;
    this._attachMultiFilterListeners(filtersEl);

    // Clear button for cot-specific filters
    document.getElementById('btnClearCotFilters')?.addEventListener('click', () => {
        this._activeCotClienteFilter = [];
        this._activeCotEventoFilter = [];
        this._applyAllFilters();
    });
}
```

#### E4. Extender _applyAllFilters
En `_applyAllFilters()`, después del bloque de cotizaciones status filter (línea ~900), agregar:

```js
// Cotizaciones: Client filter
if (type === 'cotizaciones' && this._activeCotClienteFilter && this._activeCotClienteFilter.length > 0) {
    data = data.filter(c => this._activeCotClienteFilter.includes(c.clienteNombre));
}
// Cotizaciones: Event filter
if (type === 'cotizaciones' && this._activeCotEventoFilter && this._activeCotEventoFilter.length > 0) {
    data = data.filter(c => this._activeCotEventoFilter.includes(c.nombreEvento));
}
```

#### E5. Persistencia en vistas (opcional pero recomendado)
Si querés que los filtros se guarden al cambiar de tab y volver, agregar en `_saveCurrentFiltersToView()` los nuevos filtros, y restaurarlos en el switch de sección. Seguir el patrón existente de `clasificacion`/`categoria`/`proveedor`.

---

## PASO F — Preview de PDF en ficha

### Problema
El PDF se muestra como link de texto en la ficha. Queremos algo más visual y útil.

### Qué hacer

#### F1. Reemplazar el link de PDF en la ficha Resumen
En la config de fichas `cotizaciones` → `renderTab` → sección "Presupuesto" (línea ~3336), reemplazar:

**Antes:**
```js
${item.pdfUrl ? `<div class="ficha-row"><span class="ficha-row-label">PDF</span><span class="ficha-row-value"><a href="${item.pdfUrl}" target="_blank" class="cot-pdf-link" style="color:#3B82F6">📄 Ver PDF</a></span></div>` : ''}
```

**Después:**
```js
${item.pdfUrl ? `
    <div class="ficha-pdf-section">
        <div class="ficha-section-title">Propuesta PDF</div>
        <div class="ficha-pdf-actions">
            <button class="btn btn-primary btn-sm" id="fichaPdfPreview" data-url="${item.pdfUrl}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Ver PDF
            </button>
            <a href="${item.pdfUrl}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Nueva pestaña
            </a>
        </div>
        <div class="ficha-pdf-embed" id="fichaPdfEmbed" style="display:none;">
            <iframe src="" class="ficha-pdf-iframe" id="fichaPdfIframe"></iframe>
        </div>
    </div>
` : ''}
```

#### F2. Agregar handler en _loadCotizacionTabData o _attachCotizacionResumenLinks
En `_attachCotizacionResumenLinks()`, agregar:

```js
// PDF preview toggle
const pdfBtn = panel.querySelector('#fichaPdfPreview');
if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
        const embedEl = document.getElementById('fichaPdfEmbed');
        const iframe = document.getElementById('fichaPdfIframe');
        if (!embedEl || !iframe) return;

        if (embedEl.style.display === 'none') {
            iframe.src = pdfBtn.dataset.url;
            embedEl.style.display = 'block';
            pdfBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                Ocultar PDF`;
        } else {
            embedEl.style.display = 'none';
            iframe.src = '';
            pdfBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Ver PDF`;
        }
    });
}
```

#### F3. CSS para el embed
```css
.ficha-pdf-section {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border, #2a2a2a);
}
.ficha-pdf-actions {
    display: flex;
    gap: 8px;
    margin: 8px 0;
}
.ficha-pdf-embed {
    margin-top: 8px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border, #2a2a2a);
}
.ficha-pdf-iframe {
    width: 100%;
    height: 500px;
    border: none;
    background: #1a1a1a;
}
```

### Verificación
Click en "Ver PDF" → iframe se despliega dentro de la ficha con el PDF embebido.
Click en "Nueva pestaña" → abre el PDF en otra tab.
Click en "Ocultar PDF" → colapsa el iframe.

---

## NOTAS IMPORTANTES PARA CLAUDE CODE

1. **NO tocar el pipeline kanban** — ya funciona, cambia estados correctamente.
2. **NO tocar el Cotizador** — app aparte en el VPS, no está en este repo.
3. **El sistema de fichas es genérico** — `_openFichaByType(item, type)` recibe el objeto y el tipo. No inventar un sistema nuevo.
4. **Los multi-filters ya existen** — usar `_renderMultiFilter()` y `_attachMultiFilterListeners()` que están en modules.js. No reimplementar.
5. **La tabla usa `_currentApiData` como data sin filtrar** y `_applyAllFilters()` re-renderiza. Respetar este flujo.
6. **`_refreshCurrentTable()` borra cache y recarga** — NO duplicar lógica.
7. **El `full_state` es JSON pesado** — solo mapearlo por ahora, no renderizar su contenido (eso viene después cuando armemos el detalle de items).
8. **Supabase Storage URLs son públicas** — el `pdf_url` tipo `https://selnevalaeykdrgycvdz.supabase.co/storage/v1/object/public/cotizaciones-pdf/...` se puede embeber directo en iframe.

## Orden de ejecución

| Paso | Archivo | Complejidad | Descripción |
|------|---------|-------------|-------------|
| A | api.js | Baja | Agregar 4 campos al mapeo |
| B | Supabase | Manual | Soft-delete dummies |
| C | modules.js | Media | Celdas clickeables + listeners |
| D | modules.js | Media | Ficha: links por ID + proyecto |
| E | modules.js | Media-Alta | Multi-filters cliente/evento |
| F | modules.js + css | Media | Preview PDF en ficha |
