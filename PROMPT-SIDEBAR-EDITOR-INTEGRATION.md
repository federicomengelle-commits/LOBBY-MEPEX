# TAREA: Integrar Sidebar Editable al Lobby MEPEX

## CONTEXTO
El sidebar actual está hardcodeado: `Data.categories` define las secciones y `App._renderSidebar()` las renderiza. Necesitamos que las secciones y sus módulos sean configurables por el superadmin/admin directamente desde la UI, con drag & drop, renombrar inline, agregar/eliminar, y undo global con Ctrl+Z.

## ARCHIVOS DE REFERENCIA
- `sidebar-editor.html` — prototipo funcional completo (adjuntá este archivo). Contiene toda la lógica de edición ya funcionando: drag & drop de items entre secciones, drag de secciones, inline rename con doble click, color picker, undo system, toasts.
- `MEPEX_BRAND.md` y `MEPEX_STACK.md` — referencia obligatoria de branding y convenciones.

## REGLA #1: NO ROMPER NADA
- El header global con logo (`assets/logo_full.png`), search, connection badge y user dropdown NO se toca.
- El ciclo de sidebar states (`open → collapsed → hidden → open`) debe seguir funcionando exactamente igual.
- El sidebar colapsado (strip con flyouts) debe seguir funcionando.
- Las acciones rápidas deben seguir funcionando.
- El `Router` y `Auth` no se modifican.
- Los estilos existentes en `style.css` no se reescriben — se agregan los nuevos al final.
- El `Data.categories` sigue existiendo como fuente DEFAULT de la config del sidebar.

## PLAN DE IMPLEMENTACIÓN

### Paso 1: Crear `sidebar-editor.js` (~nuevo archivo)
Extraer del prototipo `sidebar-editor.html` la lógica del `SidebarEditor` como objeto global, adaptada al ecosistema MEPEX:

```javascript
const SidebarEditor = {
    _data: [],           // Estructura de sidebar actual
    _editMode: false,
    _undoHistory: [],
    _maxUndo: 50,

    // Inicializar: lee config guardada o usa Data.categories como default
    init() { ... },

    // Obtener la config actual (para que App._renderSidebar la use)
    getConfig() { return this._data; },

    // Toggle modo edición (solo superadmin/admin)
    toggleEditMode() { ... },

    // Acciones de edición
    addSection() { ... },
    deleteSection(sectionId) { ... },
    addItem(sectionId) { ... },
    deleteItem(sectionId, itemId) { ... },
    renameSection(sectionId, newLabel) { ... },
    renameItem(itemId, newLabel) { ... },
    moveItem(itemId, fromSectionId, toSectionId, targetItemId, insertBefore) { ... },
    moveSection(fromId, toId) { ... },
    changeColor(sectionId, color) { ... },

    // Undo
    pushUndo(label) { ... },
    undo() { ... },
    canUndo() { ... },

    // Persistencia
    _save() { localStorage.setItem('mepex_sidebar_config', JSON.stringify(this._data)); },
    _load() { /* localStorage o Data.categories como fallback */ },

    // Inline edit helpers
    startInlineEdit(element, type) { ... },

    // Drag & drop setup
    attachDragEvents() { ... },

    // Color picker
    openColorPicker(button, sectionId) { ... },
};
```

### Paso 2: Modificar `App._renderSidebar()` en `app.js`
La función actual genera el HTML de categorías desde `Data.getCategoriesForRole()`. Modificarla para que:

1. Si hay config guardada (`SidebarEditor.getConfig()`), usarla en vez de `Data.categories`.
2. Si el usuario es superadmin/admin, agregar un botón "Editar sidebar" en el footer del sidebar (antes del área de collapse, como un botón sutil).
3. Cuando `SidebarEditor._editMode` está activo, renderizar los drag handles, botones de acción, y botones de agregar — usando las clases CSS del prototipo.
4. **CRÍTICO:** Mantener la estructura de clases CSS existente (`.sidebar-cat`, `.sidebar-cat-header`, `.sidebar-cat-modules`, `.sidebar-nav-link`) para no romper estilos. Agregar clases adicionales para las funciones de edición.

El flujo sería:
```
App._renderSidebar(user)
  → secciones = SidebarEditor.getConfig() // en vez de Data.getCategoriesForRole()
  → filtrar por permisos del rol (Auth.hasAccess)
  → renderizar igual que antes, pero con extras de edición si editMode activo
```

**IMPORTANTE sobre la estructura de datos:**
- `Data.categories` usa `{ id, name, icon (SVG), color, modules: [{id, shortName, icon (SVG)}] }` o `moduleIds`
- El `SidebarEditor` debe usar la MISMA estructura, no la del prototipo que usa emojis.
- Cuando se crea un nuevo item desde el editor, debe tener un `id` (para la ruta), `shortName`, e `icon` (SVG o emoji).

### Paso 3: Integrar Undo global
El `UndoSystem` del prototipo se convierte en un sistema global para todo el lobby:
- Se accede como propiedad de `SidebarEditor` por ahora
- Ctrl+Z dispara `SidebarEditor.undo()` (solo cuando hay historial de sidebar)
- Más adelante se puede expandir a otros módulos

### Paso 4: Agregar botón de "Editar sidebar" al header O al sidebar
Opciones (elegir la más limpia):
a) Botón en el footer del sidebar, antes del collapse
b) Botón en el header global, al lado del user dropdown

El botón solo es visible para `Auth.isSuperAdmin() || Auth.isAdminLevel()`.
Cuando está activo, cambia a "Listo" con estilo `--primary`.

### Paso 5: Agregar estilos al final de `style.css`
Copiar del prototipo SOLO los estilos que no existen:
- `.drag-handle`, `.inline-edit-input`, `.color-picker-dropdown`, `.color-swatch`
- `.sidebar-add-section`, `.sidebar-add-item`
- `.section-action-btn`
- `.edit-mode` como modificador
- Indicadores de drag: `.drag-over`, `.drag-over-below`, `.drag-over-section`
- `.header-undo-btn`, `.undo-count`
- `.header-edit-toggle`

**NO** copiar los estilos del header, sidebar base, toast, responsive que ya existen en style.css.

### Paso 6: Actualizar `index.html`
Agregar `<script src="sidebar-editor.js"></script>` en el orden correcto:
- DESPUÉS de `data.js` (necesita Data.categories)
- DESPUÉS de `components.js` (puede usar Toast)
- ANTES de `app.js` (App lo referencia)

### Paso 7: Agregar a `App._attachShellEvents()`
- Event listener para el botón de editar sidebar
- Event listener para Ctrl+Z → SidebarEditor.undo()
- Después de renderizar sidebar en modo edición, llamar a `SidebarEditor.attachDragEvents()`

## MAPEO DE DATOS: Prototipo → Lobby Real

| Prototipo | Lobby Real | Nota |
|-----------|-----------|------|
| `section.label` | `cat.name` | Ambos uppercase |
| `section.icon` (string key) | `cat.icon` (SVG inline) | Mantener SVGs del Data.categories |
| `section.color` | `cat.color` | Mismo formato hex |
| `item.emoji` | `module.icon` (SVG o emoji) | Mantener los iconos actuales |
| `item.label` | `module.shortName` | Nombre corto |
| `item.route` | `module.id` | Hash route |

## QUÉ NO HACER
- No tocar `router.js`
- No tocar `auth.js`
- No modificar `Data.categories` (es el default/fallback)
- No cambiar colores, fonts, ni branding
- No crear componentes React/Vue — todo vanilla JS
- No romper el sidebar strip (collapsed view con flyouts)
- No romper las acciones rápidas
- No romper el search global
- No cambiar el logo ni el header

## TESTING
Después de implementar, verificar:
1. Login → sidebar se renderiza con las categorías correctas
2. Click en módulos → navega correctamente
3. Sidebar toggle funciona (open → collapsed → hidden → open)
4. Sidebar collapsed muestra strip con flyouts
5. Botón "Editar sidebar" aparece solo para superadmin/admin
6. En modo edición: drag & drop items entre secciones funciona
7. En modo edición: drag & drop de secciones funciona
8. Doble click renombra inline
9. Agregar/eliminar secciones e items funciona
10. Color picker cambia el color de la sección
11. Ctrl+Z deshace cambios
12. Recargar página → los cambios persisten (localStorage)
13. Si se borra localStorage, vuelve al default de Data.categories
14. Responsive: funciona en todas las resoluciones
15. Acciones rápidas siguen funcionando
16. Search global sigue funcionando
