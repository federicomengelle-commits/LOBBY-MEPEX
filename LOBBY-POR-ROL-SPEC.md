# LOBBY POR ROL + BADGES SIDEBAR — Especificación para Claude Code

> Documento definitivo. Decisiones confirmadas por Fede.
> Fecha: 4 de abril de 2026

---

## Resumen de decisiones

- El Lobby con dashboard **solo existe para superadmin/admin**
- Los demás roles caen directo a su módulo principal al hacer login
- La sidebar tiene **badges con alertas** para todos los roles (reemplaza la necesidad de un Lobby general)
- Los bloques del Lobby admin se ocultan si no tienen data (nunca hay bloques vacíos)

---

## 1. RUTA POR DEFECTO SEGÚN ROL

| Rol | Ruta al entrar | Justificación |
|-----|---------------|---------------|
| `superadmin` | `#lobby` | Dashboard con visión transversal |
| `admin` | `#lobby` | Ídem superadmin (menos Admin Panel) |
| `venta` | `#crm` | Su módulo principal de trabajo |
| `pm` | `#proyectos` | Su módulo principal de trabajo |
| `taller` | `#taller` | Su módulo principal de trabajo |

### Implementación
En `router.js` o donde se resuelva la ruta inicial post-login:
```
const defaultRoutes = {
  superadmin: '#lobby',
  admin: '#lobby',
  venta: '#crm',
  pm: '#proyectos',
  taller: '#taller'
};
```
Si el usuario navega manualmente a `#lobby` siendo venta/pm/taller, redirigir a su defaultRoute.

---

## 2. BADGES EN SIDEBAR

### Diseño visual
- **Forma:** círculo 18-20px
- **Fondo:** naranja `#F28D15` (color de acción MEPEX)
- **Texto:** blanco `#FFFFFF`, font-size 11px, font-weight 500
- **Posición:** a la derecha del nombre del módulo en la sidebar, centrado verticalmente
- **Animación:** ninguna (aparece/desaparece, sin bounce ni fade)

### Comportamiento
- El badge muestra un **número** (cantidad de items que requieren atención)
- **Desaparece cuando la situación se resuelve**, NO por "marcar como leído"
- Se recalcula al entrar al sistema y periódicamente (cada 5 min o al cambiar de módulo)
- Si el conteo es 0, el badge no se muestra

### Mapeo de badges

| Badge en módulo | Condición | Roles que lo ven |
|-----------------|-----------|-----------------|
| **CRM** | Cotizaciones con vigencia ≤ 3 días + clientes sin follow-up ≥ 15 días | superadmin, admin, venta |
| **Proyectos** | Proyectos sin cambio de estado ≥ 5 días | superadmin, admin, venta, pm |
| **Eventos** | Eventos con fecha armado ≤ 7 días sin equipo asignado | superadmin, admin, pm |
| **Taller** | Tareas pendientes con armado ≤ 3 días | superadmin, admin, taller |
| **Logística** | Vehículos con VTV o seguro vencido | superadmin, admin, taller |
| **Finanzas** | Cobros vencidos (fecha < hoy) | superadmin, admin |
| **Compras** | Pagos a proveedores vencidos | superadmin, admin |
| **RRHH** | Solicitudes de vacaciones pendientes de aprobación | superadmin, admin |
| **Inventario** | Insumos con stock por debajo de mínimo crítico | superadmin, admin |
| **Locaciones** | Contratos o habilitaciones con vencimiento ≤ 30 días | superadmin, admin |

### Queries Supabase (lógica base)
Cada badge necesita una función que devuelva el conteo. Ejemplo:
```
// Badge CRM
const cotVencen = await supabase
  .from('cotizaciones')
  .select('id', { count: 'exact' })
  .lte('vigencia', fechaHoyMas3Dias)
  .in('estado', ['enviada', 'en_negociacion']);

const clientesSinFollowUp = await supabase
  .from('clientes')
  .select('id', { count: 'exact' })
  .lte('ultimo_contacto', fechaHoyMenos15Dias)
  .eq('estado', 'activo');

badgeCount = cotVencen.count + clientesSinFollowUp.count;
```
**NOTA:** Las queries exactas dependen de los nombres de columna reales en Supabase. Verificar schema antes de implementar.

---

## 3. LOBBY ADMIN — Dashboard (solo superadmin/admin)

### Estructura (de arriba a abajo)

```
┌─────────────────────────────────────────────────────┐
│  FILA KPIs (5 cards compactas horizontales)         │
├─────────────────────────────────────────────────────┤
│  ALERTAS CONSOLIDADAS (todas, ordenadas por fecha)  │
├─────────────────────────────────────────────────────┤
│  MI SEMANA (timeline horizontal lun-dom)            │
├─────────────────────────────────────────────────────┤
│  ACTIVIDAD RECIENTE (feed últimas acciones equipo)  │
└─────────────────────────────────────────────────────┘
```

### 3.1 Fila de KPIs

5 metric cards en fila horizontal, estilo compacto:
- Fondo: `#111111` (card estándar MEPEX)
- Border: `#2a2a2a`
- Label: 12px, `#888`, Outfit
- Valor: 20-24px, `#E8E8E8`, Outfit font-weight 500
- Tendencia: flechita ↑ verde `#00CC88` o ↓ rojo (color semántico) + porcentaje vs período anterior

| # | KPI | Valor | Comparación |
|---|-----|-------|-------------|
| 1 | **Facturación del mes** | Monto en $ (es-AR) | % vs mes anterior, flecha ↑↓ |
| 2 | **Cotizaciones activas** | Cantidad + monto total en juego | — |
| 3 | **Tasa de conversión** | % (últimos 90 días) | Tendencia vs 90 días anteriores |
| 4 | **Proyectos en curso** | Cantidad | — |
| 5 | **Cobros pendientes** | Cantidad + monto total | — |

**Si un KPI no tiene data** (ej: facturación del mes = $0 porque no hay Finanzas todavía), mostrar "—" en gris tenue, no ocultar la card (mantiene el layout estable).

### 3.2 Alertas consolidadas

- Lista vertical de TODAS las alertas del sistema (mismas condiciones que los badges, pero todas juntas)
- Ordenadas por fecha de proximidad/urgencia (lo más cercano arriba)
- Cada alerta es una fila clickeable → navega al módulo correspondiente
- **Sin colores de urgencia** (sin semáforo rojo/amarillo/verde)
- Ícono del módulo de origen a la izquierda para identificar de dónde viene
- Fecha/tiempo a la derecha ("Hoy", "Mañana", "En 3 días", "Hace 2 días")

Estructura de cada fila:
```
[ícono módulo] [texto de la alerta]                    [fecha relativa]
```

**Si no hay alertas**, mostrar texto tipo "Sin alertas pendientes" en gris tenue.

### 3.3 Mi semana

- Timeline horizontal de 7 días (lun a dom)
- Muestra superpuestos:
  - **Eventos** (barras por fase: armado, funcionamiento, desarme) — color turquesa `#00A9C1`
  - **Entregas de proyectos** (puntos) — color naranja `#F28D15`
  - **Salidas logística** (puntos) — color verde `#00CC88`
- Click en un día o evento → navega al módulo correspondiente
- Leyenda compacta debajo (3 items)

**Si no hay nada esta semana**, mostrar la grilla vacía con "Semana libre" en gris tenue.

### 3.4 Actividad reciente

- Feed cronológico de las últimas 15 acciones del sistema
- Formato: `[Usuario] [acción] [objeto]    [tiempo relativo]`
- Ejemplos:
  - "Noe envió COT-2026-0014 a Nestlé — hace 23 min"
  - "Meli actualizó renders Stand Siluma — hace 1h"
  - "Diego marcó tarea panelería como lista — hace 2h"
- Lee de la tabla `audit_log` existente
- Click en una fila → navega al módulo/objeto correspondiente

**Si no hay actividad**, mostrar "Sin actividad reciente".

---

## 4. ORDEN DE IMPLEMENTACIÓN

Dado que el Lobby admin depende de data de otros módulos, el orden recomendado es:

1. **Badges en sidebar** — se puede hacer ya, es independiente de los módulos. Arranca con los badges que tienen data disponible (ej: si CRM ya tiene cotizaciones con vigencia, el badge de CRM ya funciona). Los que no tienen data simplemente no muestran badge.

2. **Ruta por defecto por rol** — cambio mínimo en router.js, se hace junto con los badges.

3. **Lobby admin** — implementar último, cuando haya suficientes módulos activos con data real para que los KPIs y alertas muestren algo útil. Empezar por:
   - 3a. Estructura base + KPIs (aunque muestren "—")
   - 3b. Alertas consolidadas (reutiliza la lógica de badges)
   - 3c. Mi semana (lee de eventos + proyectos + logística)
   - 3d. Actividad reciente (lee de audit_log)

**Estimación: 2-3 sesiones de Claude Code** (1 para badges+rutas, 1-2 para Lobby admin)

---

## 5. CONSIDERACIONES TÉCNICAS

### Archivo: lobby.js
- Registrar en router como `#lobby`
- Solo renderiza si el rol es `superadmin` o `admin`
- Otros roles que intenten acceder → redirect a su defaultRoute

### Badges: badges.js (nuevo módulo global)
- Función `Badges.init()` que se llama post-login
- Función `Badges.refresh()` que se llama cada 5 min + al cambiar de módulo
- Cada badge tiene su función de cálculo independiente
- El sidebar renderer lee los conteos de Badges para mostrar/ocultar los circulitos
- Los badges respetan permisos: si un rol no ve un módulo, no se calcula ni muestra su badge

### Tablas Supabase necesarias
Verificar que existen y tienen las columnas requeridas:
- `cotizaciones.vigencia` (date)
- `clientes.ultimo_contacto` (timestamp)
- `clientes.estado` (text)
- `proyectos.updated_at` o `proyectos.estado_changed_at` (timestamp)
- `eventos.fecha_armado` (date)
- `eventos.equipo_asignado` (boolean o relación)
- `logistica_vehiculos.vtv_vencimiento` (date)
- `logistica_vehiculos.seguro_vencimiento` (date)
- `compras_pagos.fecha_vencimiento` (date)
- `rrhh_vacaciones_solicitudes.estado` (text)
- `inventario_insumos.stock_actual` y `stock_minimo` (numeric)
- `locaciones_documentos.vencimiento` (date)
- `audit_log` (ya existe)
