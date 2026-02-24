# PLAN DE IMPLEMENTACIÓN — LOBBY MEPEX
## Dividido en partes para ejecución paso a paso

---

## PARTE 1: Login + Estructura base

**Objetivo:** App funcional con login, routing y shell vacío del lobby.

### Archivos a crear:
```
index.html          → Shell principal, contenedor de todas las vistas
style.css           → Estilos globales, variables MEPEX, layout base
auth.js             → Login, roles, sesión en localStorage
router.js           → Navegación por hash (#login, #lobby, #ventas, etc.)
app.js              → Inicialización, orquesta todo
```

### Login:
- Pantalla fullscreen con branding MEPEX (fondo negro, X como decorativo, logo arriba)
- Input usuario + contraseña
- Usuarios hardcodeados por ahora:
  ```
  { user: "fede", pass: "admin", nombre: "Federico", rol: "admin", iniciales: "FM" }
  { user: "lelean", pass: "admin", nombre: "Lelean", rol: "admin", iniciales: "LM" }
  { user: "noe", pass: "ventas", nombre: "Noelia", rol: "ventas", iniciales: "NR" }
  { user: "taller1", pass: "taller", nombre: "Carlos", rol: "taller", iniciales: "CG" }
  ```
- Sesión persistente en localStorage (no pedir login cada vez)
- Logout desde el header

### Routing:
- Hash-based: `#login`, `#lobby`, `#ventas`, `#clientes`, `#eventos`, `#finanzas`, `#produccion`, `#inventario`, `#rrhh`, `#proveedores`
- Sub-rutas: `#ventas/cotizador`, `#ventas/pipeline`, `#clientes/CL-001`, etc.
- Protección de rutas por rol (si no tenés acceso, te manda al lobby)

### Layout shell (post-login):
```
┌─────────────────────────────────────────────────────┐
│ [Logo MEPEX → link HOME]     [🔍 Buscador]  [FM ▼] │  ← Header fijo
├──────┬──────────────────────────────────────────────┤
│      │                                              │
│ ⚡   │         Contenido dinámico                   │
│ ⚡   │         (cambia según ruta)                  │
│ ⚡   │                                              │
│ ⚡   │                                              │
│      │                                              │
├──────┴──────────────────────────────────────────────┤
```

- **Header fijo superior:**
  - Izquierda: Logo MEPEX clickeable → siempre te lleva a #lobby
  - Centro: Buscador global (solo roles internos, no taller)
  - Derecha: Iniciales + nombre + rol, dropdown con logout

- **Barra lateral izquierda (slim, ~50px colapsada):**
  - Acciones rápidas según rol (iconos)
  - Se expande al hover mostrando labels
  - Contenido dinámico por rol (ver Parte 4)

- **Área principal:**
  - Donde se renderiza cada vista

**Entregable:** Login funcional, lobby vacío con layout completo, navegación entre rutas, permisos por rol.

---

## PARTE 2: Lobby principal (dashboard)

**Objetivo:** La pantalla HOME post-login con los módulos y KPIs.

### Los 8 módulos como cards interactivas:
Cada card muestra:
- Ícono + nombre del módulo
- 1-2 indicadores clave (placeholder numérico por ahora)
- Estado visual: accesible (activo) o bloqueado (sin permiso para ese rol)
- Click → navega a la ruta del módulo

### Layout de módulos:
NO en grilla genérica. Diseño que refleje la conexión circular:
- Los módulos que se relacionan están visualmente cerca
- Líneas o flujos sutiles que conectan (ej: Ventas → Proyectos → Producción → Finanzas)
- Cliente al centro como eje

### KPIs por rol (placeholder):
- **Admin:** Proyectos activos, cotizaciones pendientes, cobranzas vencidas, equipo asignado hoy
- **Ventas:** Cotizaciones enviadas, sin respuesta (con timer), aprobadas esta semana, monto pipeline
- **Operaciones:** Proyectos en producción, montajes esta semana, vehículos asignados
- **Taller:** Mis tareas hoy, tareas pendientes

### Sección de actividad reciente (placeholder):
- Últimas acciones del sistema: "Noe envió cotización COT-2026-0015", "Proyecto Stand Arcor aprobado", etc.

**Entregable:** Lobby visualmente completo con cards de módulos, KPIs placeholder, navegación a cada módulo.

---

## PARTE 3: Vistas interiores de cada módulo

**Objetivo:** Estructura interna de los 8 módulos con subcategorías reales.

### Navegación interior:
- Tabs o sidebar con las subcategorías de cada módulo (según mepex-sistema-v2.md)
- Breadcrumb: Lobby > Ventas > Pipeline
- Desde cualquier módulo, links cruzados a módulos relacionados

### Por módulo:

**Ventas + Marketing:**
- Tabs: Cotizador | Pipeline | Envío directo | Marketing
- Cotizador: botón que abre https://cotizador-mepex.vercel.app en nueva pestaña
- Pipeline: tabla placeholder con estados (enviada, vista, en negociación, aprobada, rechazada, vencida) + timer visual
- Envío directo: form placeholder (seleccionar cotización, template, vista previa, botón enviar)
- Marketing: placeholder campañas y mailing

**Clientes / CRM:**
- Tabs: Listado | Ficha de cliente
- Listado: tabla con filtros (tipo, rubro)
- Ficha: datos + timeline de interacciones + historial de proyectos + estado de cuenta

**Eventos / Proyectos:**
- Tabs: Eventos | Proyectos
- Evento: ficha con datos, plano, reglamento, proyectos vinculados
- Proyecto: ficha con tipo, estado, cliente, evento, diseño, links cruzados

**Finanzas:**
- Tabs: Facturación | Cobros | Tesorería | Contabilidad | Rentabilidad | Reportes
- Cada uno con estructura de campos placeholder

**Producción & Operaciones:**
- Tabs: Taller | Logística | Montaje | Entregas | Mantenimiento
- Entregas: placeholder de carga de fotos + firma digital
- Mantenimiento: lista de vehículos/lugares con alertas

**Inventario & Recursos:**
- Tabs: Stock | Compras | Disponibilidad
- Stock con categorías (panelería, iluminación, mobiliario, alfombras, estructura, carros, escaleras, herramientas)
- Disponibilidad: timeline visual placeholder (qué está asignado en qué fechas)

**RRHH / Equipo:**
- Tabs: Personal | Asignaciones | Pagos | Vacaciones
- Calendario de asignaciones placeholder

**Proveedores & Compras:**
- Tabs: Base | Comparador | Pagos
- Comparador: placeholder tabla de presupuestos side by side

**Entregable:** Todos los módulos navegables con estructura interna real. Contenido placeholder pero arquitectura completa.

---

## PARTE 4: Barra lateral de acciones rápidas + Buscador global

**Objetivo:** Productividad. Acciones sin navegar y búsqueda instantánea.

### Barra lateral izquierda:
Slim (iconos), se expande al hover. Contenido según rol:

**Admin / Ventas:**
- ➕ Nueva cotización (abre cotizador)
- 📤 Enviar propuesta (abre envío directo)
- 👤 Nuevo cliente
- 📋 Nuevo proyecto

**Operaciones:**
- 📋 Mis montajes hoy
- 📸 Cargar entrega (fotos + firma)
- 🚛 Ver vehículos

**Taller:**
- 📝 Registrar orden de compra
- 📦 Descontar material usado
- ✅ Mis tareas

**Finanzas:**
- 💰 Registrar cobro
- 📄 Nueva factura
- 📊 Ver pendientes

### Buscador global (header, solo roles internos):
- Input con ícono 🔍, shortcut Ctrl+K para abrir
- Busca en: eventos, proyectos, clientes, cotizaciones
- Resultados agrupados por tipo
- Click en resultado → navega directo a la ficha
- Búsqueda fuzzy (tolerante a typos)
- Por ahora busca en datos mock, preparado para conectar a API

**Entregable:** Barra lateral funcional por rol + buscador global navegable.

---

## PARTE 5: Conexión con Notion (datos reales)

**Objetivo:** Reemplazar datos mock por datos reales de las 4 DBs existentes.

### Crear server/:
```
server/
├── index.js          → Express + endpoints
├── .env              → Keys de Notion + IDs de DBs
├── package.json
```

### Endpoints:
- GET /api/health
- GET /api/clientes → lista de clientes desde Notion
- GET /api/clientes/:id → ficha de un cliente
- GET /api/eventos → lista de eventos
- GET /api/eventos/:id → ficha de un evento
- GET /api/proyectos → lista de proyectos
- GET /api/proyectos/:id → ficha de un proyecto
- GET /api/cotizaciones → lista de cotizaciones
- GET /api/search?q=texto → búsqueda global en las 4 DBs

### Variables de entorno:
```
NOTION_TOKEN=secret_xxx
NOTION_CLIENTS_DB_ID=xxx
NOTION_EVENTS_DB_ID=xxx
NOTION_PROJECTS_DB_ID=xxx
NOTION_QUOTATIONS_DB_ID=3097d5080de880668870dc4bb8e74132
```

### Integración:
- api.js en el frontend con el patrón de MEPEX_STACK.md
- Fallback a datos mock si el server no está disponible
- El buscador global pasa a buscar en Notion real

**Entregable:** Lobby conectado a datos reales de Notion. Clientes, eventos, proyectos y cotizaciones visibles con info real.

---

## ORDEN DE EJECUCIÓN

```
Parte 1 → tu OK → Parte 2 → tu OK → Parte 3 → tu OK → Parte 4 → tu OK → Parte 5
```

Cada parte se testea antes de avanzar a la siguiente.
No se avanza sin tu aprobación.
