# BRIEF 2 — Panel lateral: Ficha de Proyecto
## Archivo a modificar: `modules.js`

---

## CONTEXTO

Al hacer click en cualquier fila de la tabla de Proyectos, debe abrirse un panel
deslizable desde la derecha que ocupa ~50% del ancho de pantalla. El resto de la
tabla queda visible y usable detrás (no es un modal bloqueante).

El panel muestra toda la información del proyecto organizada verticalmente,
similar a cómo Notion muestra la ficha de un registro.

---

## COMPORTAMIENTO DEL PANEL

- **Apertura:** click en fila `api-table-row` en la tabla de proyectos
- **Animación:** desliza desde la derecha (transform: translateX)
- **Cierre:** botón X en el panel, o click fuera del panel (en el overlay semitransparente), o tecla Escape
- **Ancho:** 480px fijo en desktop. En mobile: 100% del ancho
- **Z-index:** sobre la tabla pero no bloquea el header/sidebar del sistema
- **Scroll:** el panel tiene scroll interno si el contenido supera la altura

---

## ESTRUCTURA HTML DEL PANEL

Inyectar al final del `#app` (no dentro de `#mainContent`) para que el z-index
funcione correctamente:

```html
<div class="ficha-overlay" id="fichaOverlay"></div>
<div class="ficha-panel" id="fichaPanel">
    <div class="ficha-panel-header">
        <div class="ficha-panel-title">
            <span class="ficha-panel-icon">🏗️</span>
            <h2 class="ficha-panel-name">{nombre del proyecto}</h2>
        </div>
        <div class="ficha-panel-header-actions">
            <span class="badge {statusClass}">{estado}</span>
            <button class="btn btn-ghost btn-sm ficha-close-btn" id="fichaCerrar">✕</button>
        </div>
    </div>
    <div class="ficha-panel-body">
        <!-- Secciones de contenido -->
    </div>
</div>
```

---

## CONTENIDO DEL PANEL — FICHA DE PROYECTO

### Sección: Información

Mostrar como lista de filas `label → valor`, igual que Notion:

| Label | Campo API | Formato |
|---|---|---|
| N° Proyecto | `p.number` | `#8` |
| Estado | `p.status` | badge con color |
| Tipo | `p.type` | texto o `—` |
| Fecha de solicitud | `p.requestDate` | `API.formatDate()` |
| Fecha último mov. | `p.updatedAt` o `p.lastModified` | `API.formatDate()` o `—` |
| N° Lote | `p.lote` | texto o `—` |
| Área | `p.area` | `"40,5m²"` o `—` |
| Dimensiones | `p.dimensions` | `"9,00 × 4,50m"` o `—` |
| Responsable | `p.responsible` | chip/tag o `—` |
| Teléfono contacto | `p.phone` | texto o `—` |
| N° modificaciones | `p.modifications` | número o `—` |

Todos los campos que no existan en el objeto → mostrar `—`. No romper si el campo es null/undefined.

### Sección: Vínculos

```
Cliente     →  {p.clientName o p.clientId}   [chip clickeable → futuro]
Evento      →  {p.eventName o p.eventId}      [chip clickeable → futuro]
```

Por ahora los chips no navegan (solo `console.log`). Se activarán cuando existan fichas de cliente y evento.

### Sección: Notas / Comentarios

Área de texto con placeholder "Sin notas registradas". Por ahora es solo visual (disabled), no guarda. Se activará cuando haya backend para comentarios.

---

## CSS A AGREGAR

Inyectar como `<style id="fichaStyles">` en el `<head>` la primera vez que se abre el panel
(verificar que no exista antes de inyectar):

```css
.ficha-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 200;
}
.ficha-overlay.active { display: block; }

.ficha-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 480px;
    max-width: 100vw;
    height: 100vh;
    background: var(--bg-card, #1a1d23);
    border-left: 1px solid var(--border, #2a2d35);
    z-index: 201;
    transform: translateX(100%);
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.ficha-panel.open { transform: translateX(0); }

.ficha-panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 24px 20px 16px;
    border-bottom: 1px solid var(--border, #2a2d35);
    flex-shrink: 0;
}
.ficha-panel-title {
    display: flex;
    align-items: center;
    gap: 10px;
}
.ficha-panel-name {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-primary, #fff);
    margin: 0;
}
.ficha-panel-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}
.ficha-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}
.ficha-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.ficha-section-title {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted, #888);
    margin-bottom: 8px;
}
.ficha-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px solid var(--border-subtle, #22252c);
    min-height: 34px;
}
.ficha-row:last-child { border-bottom: none; }
.ficha-row-label {
    font-size: 0.78rem;
    color: var(--text-muted, #888);
    min-width: 140px;
    flex-shrink: 0;
}
.ficha-row-value {
    font-size: 0.85rem;
    color: var(--text-primary, #fff);
    flex: 1;
}
.ficha-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--bg-hover, #22252c);
    font-size: 0.8rem;
    color: var(--text-primary, #fff);
    cursor: pointer;
}
.ficha-chip:hover { background: var(--primary, #FF7200); color: #fff; }
.ficha-notes {
    width: 100%;
    min-height: 80px;
    background: var(--bg-hover, #22252c);
    border: 1px solid var(--border, #2a2d35);
    border-radius: 8px;
    padding: 10px;
    color: var(--text-muted, #888);
    font-size: 0.85rem;
    resize: none;
    font-family: inherit;
}

@media (max-width: 600px) {
    .ficha-panel { width: 100vw; }
}
```

---

## IMPLEMENTACIÓN EN `modules.js`

### Paso 1: Función `_openFichaProyecto(proyecto)`

```js
_openFichaProyecto(p) {
    // Inyectar CSS si no existe
    if (!document.getElementById('fichaStyles')) { /* inyectar style tag */ }

    // Crear overlay y panel si no existen en el DOM
    // Rellenar contenido con los datos de p
    // Agregar clase .open al panel y .active al overlay
    // Attachar listeners de cierre
},
```

### Paso 2: En `_renderProjectsTable`

En cada `<tr>` de la tabla, el click actual es `console.log`. Reemplazarlo:

```js
document.querySelectorAll('#apiDataContainer .api-table-row').forEach(row => {
    row.addEventListener('click', () => {
        const id = row.dataset.id;
        const proyecto = this._currentApiData.find(p => p.id == id);
        if (proyecto) this._openFichaProyecto(proyecto);
    });
});
```

Attachar estos listeners DESPUÉS de inyectar el HTML de la tabla
(al final de `_renderProjectsTable`, no dentro del template string).

### Paso 3: Función `_closeFicha()`

```js
_closeFicha() {
    document.getElementById('fichaPanel')?.classList.remove('open');
    document.getElementById('fichaOverlay')?.classList.remove('active');
},
```

---

## RESTRICCIONES

- No tocar `render()`, `_renderModuleSubHeader()`, `_renderSectionSidebar()`, `_renderField()`, `_attachEvents()`
- No modificar ningún otro archivo
- El panel debe funcionar igual si se navega a otra sección y se vuelve (re-attachar listeners)
- Si el proyecto no tiene un campo → mostrar `—`, nunca `undefined` o `null` en pantalla
- Mantener `this._currentApiData` y `this._currentApiType` intactos

---

## ENTREGABLE

Un único archivo `modules.js` completo que reemplaza al actual.
