# BRIEF 1 — Navegación: Proyectos como módulo propio
## Archivos a modificar: `data.js` y `router.js`

---

## CONTEXTO

En el sistema actual, "Proyecto" es una subsección dentro del módulo "Eventos".
Hay que sacarlo y convertirlo en módulo independiente en el sidebar, con su propio
acceso desde la navegación principal.

---

## CAMBIO 1 — `router.js`

Agregar la ruta `proyectos` al objeto `routes`:

```js
'proyectos': { render: () => Modules.render('proyectos'), requiresAuth: true, module: 'proyectos' },
```

Ya existe el patrón exacto para ventas, clientes, eventos — replicarlo igual.

---

## CAMBIO 2 — `data.js`

### 2a. Permisos por rol — agregar 'proyectos' donde corresponde

```js
rolePermissions: {
    admin:       ['ventas', 'clientes', 'proyectos', 'eventos', 'finanzas', 'produccion', 'inventario', 'rrhh', 'proveedores'],
    ventas:      ['ventas', 'clientes', 'proyectos', 'eventos'],
    operaciones: ['produccion', 'inventario', 'proyectos', 'eventos', 'proveedores'],
    taller:      ['produccion', 'inventario'],
    finanzas:    ['finanzas', 'clientes', 'proveedores'],
},
```

### 2b. Agregar módulo `proyectos` en `Data.modules`

Insertarlo DESPUÉS de `clientes` y ANTES de `eventos`, con este orden (`order: 3`).
Reajustar el `order` de eventos a 4, finanzas a 5, etc.

```js
proyectos: {
    id: 'proyectos',
    name: 'Proyectos',
    shortName: 'Proyectos',
    icon: '🏗️',
    description: 'Stands, exposiciones, congresos y alquileres vinculados a eventos y clientes.',
    status: 'active',
    color: '#FF7200',
    order: 3,
    sections: [
        {
            id: 'lista',
            name: 'Lista de Proyectos',
            icon: '📋',
            description: 'Todos los proyectos con filtros por estado y tipo',
            fields: []
        },
        {
            id: 'diseno',
            name: 'Diseño',
            icon: '🎨',
            description: 'Renders, planos, aprobación de diseño, versionado',
            fields: [
                { label: 'Archivos de diseño', type: 'file' },
                { label: 'Estado aprobación', type: 'select', options: ['Pendiente', 'Aprobado', 'Con cambios'] },
                { label: 'Historial de versiones', type: 'list' },
            ]
        },
    ],
    connections: [
        { to: 'ventas',      label: 'Ver Cotización',  context: 'Cotización origen del proyecto' },
        { to: 'clientes',    label: 'Ver Cliente',     context: 'Cliente del proyecto' },
        { to: 'eventos',     label: 'Ver Evento',      context: 'Evento al que pertenece' },
        { to: 'produccion',  label: 'Ver Producción',  context: 'Estado de fabricación' },
        { to: 'inventario',  label: 'Ver Materiales',  context: 'Materiales reservados' },
        { to: 'finanzas',    label: 'Ver Finanzas',    context: 'Movimientos del proyecto' },
    ],
},
```

### 2c. Actualizar `_getApiSectionType` en `modules.js`

Agregar el mapeo para la nueva sección de proyectos:

```js
const map = {
    'clientes:ficha':    'clients',
    'eventos:evento':    'events',
    'eventos:proyecto':  'projects',   // mantener por ahora
    'proyectos:lista':   'projects',   // NUEVO
};
```

### 2d. Módulo `eventos` — sacar la sección `proyecto`

En `Data.modules.eventos.sections`, eliminar el objeto de sección con `id: 'proyecto'`.
Dejar solo: `evento` y `diseno`.

Actualizar también las connections de eventos: sacar el link a produccion/inventario/rrhh/finanzas
si quedaron huérfanos — dejar solo los que tienen sentido para un evento puro:
```js
connections: [
    { to: 'proyectos', label: 'Ver Proyectos', context: 'Proyectos dentro de este evento' },
    { to: 'clientes',  label: 'Ver Cliente',   context: 'Cliente organizador' },
],
```

---

## ORDEN FINAL DEL SIDEBAR

El sidebar se genera desde `Data.getModulesForRole(role)` que filtra por permisos
y ordena por `mod.order`. El orden final debe ser:

1. Lobby (hardcoded en app.js, no tocar)
2. Ventas (order: 1)
3. Clientes (order: 2)
4. **Proyectos (order: 3) ← NUEVO**
5. Eventos (order: 4) ← era 3
6. Finanzas (order: 5) ← era 4
7. Producción (order: 6)
8. Inventario (order: 7)
9. Equipo/RRHH (order: 8)
10. Proveedores (order: 9)

---

## ENTREGABLE

Dos archivos completos: `data.js` y `router.js`.
No tocar ningún otro archivo.
El sistema debe seguir funcionando exactamente igual — solo se agrega Proyectos
como módulo y se reordena el sidebar.
