# PERFILES, ADMIN PANEL & ROLES — BLUEPRINT
## Sistema de Gestión MEPEX

---

## 1. VISIÓN GENERAL

Tres patas en este módulo:
1. **Panel de Admin** — vista exclusiva para Fede/Lelean donde controlan todo el sistema
2. **Perfiles individuales** — cada usuario personaliza su experiencia
3. **Gestión de roles** — definir qué ve y qué puede hacer cada tipo de usuario

---

## 2. PANEL DE ADMIN

### 2.1 Quién accede
Solo usuarios con rol ADMIN (Fede, Lelean). Accesible desde sidebar → Admin & Finanzas → Panel de Control.

### 2.2 Dashboard de actividad del sistema

**Estadísticas de uso por usuario:**
- Tabla con todos los usuarios activos
- Para cada usuario:
  - Nombre, rol, email
  - Último login (fecha + hora + dispositivo)
  - Tiempo total de uso (hoy / esta semana / este mes)
  - Sesiones activas actuales
  - Módulos más visitados (top 3)
  - Acciones realizadas (cantidad hoy/semana/mes)

**Logs de actividad (audit trail):**
- Feed cronológico de acciones del sistema:
  - Quién hizo qué, cuándo, desde dónde
  - Ej: "Noe creó cotización COT-2026-0048 — 14:32 — PC Oficina"
  - Ej: "Fede cambió estado proyecto #127 a Producción — 09:15 — Celular"
  - Ej: "PM Externo accedió a ficha cliente Coca-Cola — 11:00 — Laptop"
- Filtros: por usuario, por módulo, por tipo de acción, por fecha
- Búsqueda en logs
- Exportar a CSV (futuro)

**Métricas del sistema:**
- Usuarios conectados ahora (tiempo real)
- Actividad por hora del día (heatmap semanal)
- Módulos más usados (ranking)
- Errores o accesos denegados (intentos de acceso a módulos sin permiso)

### 2.3 Dashboards inteligentes (📌 ITEM IMPORTANTE — venía de Ventas)

**Acá es donde viven los números que sacamos de Ventas:**
- Monto total en pipeline
- Ticket promedio
- Facturación por mes (gráfico de evolución)
- Embudo de conversión completo
- Rentabilidad por proyecto
- Rentabilidad por evento
- Rentabilidad por cliente
- Cash flow proyectado
- Comparativo mes a mes / año a año
- Top clientes por facturación
- Top eventos por rentabilidad

**Estos dashboards SOLO los ve el admin.** Ningún otro rol tiene acceso a datos financieros globales.

### 2.4 Gestión de usuarios (CRUD)

**Lista de usuarios:**
- Tabla con: nombre, email, rol, estado (activo/inactivo), último login
- Acciones: crear, editar, desactivar, resetear contraseña

**Crear/Editar usuario:**
- Nombre completo
- Email (login)
- Rol (selector — ver sección 4)
- Estado: activo / inactivo / suspendido
- Foto de perfil (opcional)
- Dispositivos autorizados (registro de terminales)

**Seguridad desde admin:**
- Ver sesiones activas de cualquier usuario
- Forzar cierre de sesión remoto
- Bloquear usuario
- Ver intentos fallidos de login
- Resetear contraseña (genera link temporal)

### 2.5 Gestión de roles (personalizable)

**Pantalla de configuración de roles:**
- Lista de roles existentes (los 6 base + posibilidad de crear nuevos)
- Para cada rol, grilla de permisos por módulo:

```
                    │ Ver │ Crear │ Editar │ Eliminar │ Exportar │
────────────────────┼─────┼───────┼────────┼──────────┼──────────┤
Dashboard           │  ○  │       │        │          │          │
Calendario          │  ○  │       │        │          │          │
Ventas              │  ○  │   ○   │   ○    │    ○     │    ○     │
  └ Pipeline        │  ○  │   ○   │   ○    │    ○     │          │
  └ Cotizador       │  ○  │   ○   │   ○    │          │    ○     │
  └ Métricas        │  ○  │       │        │          │          │
Marketing           │  ○  │   ○   │   ○    │    ○     │          │
Clientes/CRM        │  ○  │   ○   │   ○    │    ○     │    ○     │
Eventos             │  ○  │   ○   │   ○    │    ○     │    ○     │
Proyectos           │  ○  │   ○   │   ○    │    ○     │    ○     │
Producción          │  ○  │   ○   │   ○    │          │          │
Logística           │  ○  │   ○   │   ○    │          │          │
Inventario          │  ○  │   ○   │   ○    │    ○     │    ○     │
Compras/Proveedores │  ○  │   ○   │   ○    │    ○     │    ○     │
RRHH                │  ○  │   ○   │   ○    │    ○     │          │
Admin & Finanzas    │  ○  │   ○   │   ○    │    ○     │    ○     │
  └ Dashboards $    │  ○  │       │        │          │    ○     │
  └ Gestión usuarios│  ○  │   ○   │   ○    │    ○     │          │
  └ Gestión roles   │  ○  │   ○   │   ○    │    ○     │          │
  └ Config sistema  │  ○  │       │   ○    │          │          │
```

- Los ○ son toggles que el admin activa/desactiva
- Se pueden crear roles nuevos clonando uno existente
- Cambios de permisos se aplican en tiempo real (próximo login del usuario)

**Roles base predefinidos:**

| Rol | Descripción | Acceso base |
|-----|-------------|-------------|
| **Admin** | Fede, Lelean — todo | Todos los módulos, todos los permisos |
| **Comercial** | Noe, vendedores — gestión de ventas | Ventas, Clientes, Eventos/Proyectos (vista comercial), Marketing |
| **Project Manager** | PMs internos — gestión operativa | Ventas (lectura), Clientes, Eventos, Proyectos (completo), Producción, Logística, Inventario (lectura) |
| **Producción** | Jefes de taller — ejecución | Producción, Logística, Inventario, Proyectos (solo tareas asignadas) |
| **Taller** | Personal operativo — vista mínima | Solo tareas asignadas, checklist, carga de fotos, firma de conformidad |
| **Externo** | PM/vendedores externos — vista limitada | Proyectos asignados (sin datos financieros), Clientes asignados (lectura) |

---

## 3. PERFIL INDIVIDUAL DE USUARIO

### 3.1 Qué puede personalizar cada usuario en su perfil

**Datos personales:**
- Nombre para mostrar
- Foto de perfil
- Email (solo lectura, lo cambia el admin)
- Teléfono / WhatsApp
- Rol (solo lectura, lo cambia el admin)

**Preferencias de interfaz:**
- Tema: dark (default) / light (futuro)
- Sidebar: expandida o colapsada por defecto
- Módulo de inicio: a cuál va al loguearse (ej: Noe siempre a Ventas, PM a Proyectos)
- Densidad de tablas: compacta / normal / espaciada
- Notificaciones: activar/desactivar por tipo
  - Cotización sin respuesta (timer)
  - Proyecto cambió de estado
  - Nuevo evento asignado
  - Mención en notas

**Accesos directos personales:**
- Hasta 5 accesos rápidos que aparecen en el dashboard personal
- Configurable: arrastrar módulos/secciones favoritas

**Seguridad personal:**
- Cambiar contraseña
- Ver mis sesiones activas
- Cerrar sesiones en otros dispositivos
- Ver mis dispositivos registrados

### 3.2 Dashboard personal (home del usuario)

Cuando un usuario entra, ve su dashboard personalizado según su rol:

**Admin:** Dashboard completo del sistema + accesos a todo
**Comercial:** Pipeline de sus cotizaciones + KPIs operativos + agenda del día
**PM:** Proyectos asignados + calendario de eventos próximos + tareas pendientes
**Producción:** Proyectos en producción + tareas del día + checklist pendientes
**Taller:** Lista de tareas del día (ultra simple, tipo checklist)
**Externo:** Proyectos asignados + estado de cada uno

---

## 4. SISTEMA DE LOGS (AUDIT TRAIL)

### 4.1 Qué se registra

Cada acción en el sistema genera un log:

```json
{
  "timestamp": "2026-03-09T14:32:15Z",
  "user_id": "uuid",
  "user_name": "Noe",
  "user_role": "comercial",
  "action": "create",
  "module": "ventas",
  "entity": "oportunidad",
  "entity_id": "COT-2026-0048",
  "details": "Creó cotización para cliente Coca-Cola, evento ExpoAgro 2026",
  "device": "PC Oficina Noe",
  "ip": "192.168.1.45",
  "session_id": "uuid"
}
```

### 4.2 Tipos de acciones logueadas
- Login / logout
- Crear / editar / eliminar cualquier registro
- Cambiar estado (cotización, proyecto, etc.)
- Ver ficha de cliente (para auditoría de datos sensibles)
- Exportar datos
- Cambios de configuración
- Errores y accesos denegados

### 4.3 Métricas derivadas de logs
- Tiempo de uso por usuario (calculado entre login y última actividad)
- Frecuencia de uso por módulo
- Picos de actividad (hora del día, día de la semana)
- Usuarios inactivos (no loguearon en X días)

### 4.4 Retención
- Logs de los últimos 12 meses accesibles en la UI
- Logs más antiguos archivados (accesibles via export)

---

## 5. CONEXIONES CON OTROS MÓDULOS

### Admin → Todo
- El admin ve estadísticas agregadas de todos los módulos
- Los dashboards inteligentes cruzan datos de Ventas, Proyectos, Finanzas, Clientes

### Roles → Sidebar
- El sidebar se adapta automáticamente según el rol del usuario logueado
- Módulos sin permiso NO aparecen (no se muestran bloqueados, directamente no existen para ese usuario)

### Logs → Ventas/Proyectos/etc.
- En la ficha de cualquier entidad (cotización, proyecto, cliente) hay un mini-log que muestra "quién tocó qué" en ese registro específico

### Perfil → Dashboard
- Las preferencias del perfil determinan qué ve el usuario en su home
- Los accesos directos personalizan la experiencia

---

## 6. IDEAS QUE SUMAN

### 6.1 Sistema de notificaciones internas
- Campana en el topbar con badge de conteo
- Notificaciones por tipo: asignación, mención, alerta de timer, cambio de estado
- Cada usuario configura cuáles recibe y cuáles no
- Historial de notificaciones con marcar como leída

### 6.2 Vista "Mi día"
- Pantalla resumen de lo que cada usuario tiene pendiente HOY
- Para comercial: cotizaciones sin respuesta, seguimientos pendientes
- Para PM: hitos de proyectos del día, eventos próximos
- Para producción: tareas asignadas, entregas del día
- Se genera automáticamente cruzando datos de todos los módulos

### 6.3 Registro de terminales
- Cada dispositivo se registra con nombre amigable al primer login
- El admin ve qué dispositivos están registrados por usuario
- Puede bloquear un dispositivo sin afectar al usuario en otro
- Útil para tablets de taller compartidas

### 6.4 Modo "Solo lectura" temporal
- El admin puede poner a un usuario en modo solo lectura temporalmente
- Útil durante auditorías o cuando alguien está en período de prueba

---

## 7. PRIORIDAD DE IMPLEMENTACIÓN

### V1 (AHORA):
- [ ] Panel admin: lista de usuarios con último login y tiempo de uso
- [ ] Logs de actividad: feed cronológico con filtros
- [ ] Gestión de usuarios: CRUD básico (crear, editar, desactivar)
- [ ] Roles base: los 6 predefinidos con permisos fijos
- [ ] Perfil individual: datos personales + cambiar contraseña + módulo de inicio
- [ ] Sidebar adaptable según rol (ocultar módulos sin permiso)

### V2 (PRÓXIMO):
- [ ] Grilla de permisos personalizable por rol
- [ ] Crear roles nuevos
- [ ] Dashboard personal por rol
- [ ] Preferencias de interfaz (densidad, sidebar, notificaciones)
- [ ] Accesos directos personales
- [ ] Métricas de uso detalladas (heatmap, módulos más usados)

### V3 (DASHBOARDS INTELIGENTES — 📌 IMPORTANTE):
- [ ] Dashboards financieros exclusivos admin
- [ ] Montos en pipeline, ticket promedio, facturación mensual
- [ ] Embudo de conversión
- [ ] Rentabilidad por proyecto/evento/cliente
- [ ] Cash flow proyectado
- [ ] Comparativos históricos
- [ ] Marketing analytics

### V4 (AVANZADO):
- [ ] Notificaciones internas (campana)
- [ ] Vista "Mi día"
- [ ] Registro y bloqueo de terminales
- [ ] Modo solo lectura temporal
- [ ] Export de logs a CSV
- [ ] Logs de los últimos 12 meses con archivo
