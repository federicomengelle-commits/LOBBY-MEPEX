# FASE 1 — Estructura Macro LOBBY MEPEX (CONFIRMADA)

> Actualizado con definiciones de Fede. Base para ejecución.

## Sidebar Final

```
PRINCIPAL (turquesa #00A9C1)
├── Lobby
└── Calendario Operativo

COMERCIAL (naranja #F28D15)
├── CRM
├── Cotizador ↗ (link externo → VPS)
└── Catálogo

OPERACIONES (verde #00CC88)
├── Proyectos
├── Eventos
├── Producción
└── Logística

RECURSOS (violeta #9B7DFF)
├── RRHH
├── Compras
├── Inventario
└── Locaciones

ADMIN & FINANZAS (azul #4A90D9)
├── Finanzas
├── Costos
└── Admin
```

**Total: 5 categorías, 14 módulos**

---

## Definiciones confirmadas

### COMERCIAL

**CRM** (`#crm`) — Fusión Clientes + Ventas. Ref: `crm-mepex.jsx`
- 5 tabs: Clientes, Pipeline (kanban), Cotizaciones, Interacciones, Marketing
- Ficha lateral cliente: datos, score, proyectos, cotizaciones, pipeline, interacciones
- Marketing = tab dentro del CRM
- Dashboard comercial = tab o vista dentro del CRM

**Cotizador** (`#cotizador`) — Link externo → `195.200.1.250/cotizador/`

**Catálogo** (`#catalogo`) — Vitrina de items/servicios
- Editable (contenido), pero precio viene de Costos (listas)

### OPERACIONES

**Proyectos** (`#proyectos`) — Extraer de modules.js
**Eventos** (`#eventos`) — Ya separado, no se toca
**Producción** (`#produccion`) — Taller + montaje + mantenimiento
**Logística** (`#logistica`) — Vehículos + transporte + entrega con OK

### RECURSOS

**RRHH** (`#rrhh`) — Personal + asignación + pagos + vacaciones (sin vehículos)
**Compras** (`#compras`) — Proveedores + OC + comparación + pagos planificados
**Inventario** (`#inventario`) — Insumos + stock (sin catálogo, sin simulador)
**Locaciones** (`#locaciones`) — Lugares + documentación + stock por locación

### ADMIN & FINANZAS

**Finanzas** (`#finanzas`) — LaPyme + cobros + tesorería + calendario admin + pagos terceros
**Costos** (`#costos`) — Recetas/BOM + simulador + pricing_config + listas de precio (solo admin/superadmin)
**Admin** (`#admin-panel`) — Usuarios + roles + logs + config

---

## Migraciones de código

| Origen | Destino | Tipo |
|--------|---------|------|
| modules.js → clientes + ventas | crm.js | Extraer + fusionar |
| modules.js → proyectos | proyectos.js | Extraer |
| modules.js → inventario (insumos+stock) | inventario.js | Extraer achicado |
| modules.js → inventario (catálogo) | catalogo.js | Mover a Comercial |
| modules.js → inventario (simulador) | costos.js | Mover a Admin |
| modules.js → proveedores | compras.js | Extraer + expandir |

## Rutas: actual → nueva

| Actual | Nueva | Acción |
|--------|-------|--------|
| `#ventas` | `#crm` | Reemplaza |
| `#clientes` | `#crm` | Fusiona |
| `#proveedores` | `#compras` | Reemplaza |
| — | `#catalogo` | NUEVO |
| — | `#logistica` | NUEVO |
| — | `#locaciones` | NUEVO |
| — | `#costos` | NUEVO |
| — | `#cotizador` | NUEVO (link externo) |
