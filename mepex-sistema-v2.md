# SISTEMA DE GESTIÓN INTEGRAL MEPEX — V2
## Arquitectura Circular

---

## FILOSOFÍA

No son módulos independientes. Es UN flujo circular donde la información
se genera una vez y se ve desde distintos ángulos según el rol.

Un dato ingresado en Ventas (ej: cotización aprobada) automáticamente:
- Crea un proyecto en Eventos/Proyectos
- Aparece en el pipeline de Producción
- Genera un pendiente de cobro en Finanzas
- Reserva materiales en Inventario

El usuario no "cambia de app". Navega perspectivas del mismo dato.

**Infraestructura:** Preparado para correr local + nube LIVE simultáneo.

---

## EL FLUJO CIRCULAR

```
        ┌──────────────────────────────────────────┐
        │              CLIENTE                      │
        │   (el eje, todo empieza y termina acá)    │
        └──────┬───────────────────────┬────────────┘
               │                       │
               ▼                       ▼
        ┌─────────────┐        ┌──────────────┐
        │   VENTAS    │───────▶│  PROYECTO    │
        │             │        │  (dentro de  │
        │ cotizar     │        │  un EVENTO)  │
        │ negociar    │        │              │
        │ cerrar      │        │              │
        └─────────────┘        └──────┬───────┘
               ▲                      │
               │                      ▼
        ┌─────────────┐        ┌──────────────┐
        │  FINANZAS   │◀───────│ PRODUCCIÓN   │
        │             │        │ & OPERACIONES│
        │ cobrar      │        │              │
        │ pagar       │        │ fabricar     │
        │ analizar    │        │ montar       │
        │ proyectar   │        │ entregar     │
        └─────────────┘        └──────────────┘
               │                      ▲
               │                      │
               ▼                      │
        ┌─────────────┐        ┌──────────────┐
        │ PROVEEDORES │───────▶│ INVENTARIO   │
        │ & COMPRAS   │        │ & RECURSOS   │
        └─────────────┘        └──────────────┘

        ┌──────────────────────────────────────────┐
        │              EQUIPO / RRHH                │
        │   (transversal: asignado a todo)          │
        └──────────────────────────────────────────┘
```

---

## 1. 🔶 VENTAS + MARKETING

**Quién lo usa:** Fede y Lelean (dueños), Noe (comercial senior)

### El cotizador (ya existe ✅)
Armar cotización → PDF con marca → guardado en Notion (migrar a DB propia)

### Pipeline comercial
Cada cotización tiene un ciclo de vida visible:
- **Enviada** → arranca timer
- **Vista** (si se puede trackear apertura de mail)
- **En negociación**
- **Aprobada** → dispara creación de proyecto + facturación
- **Rechazada** (con motivo, para aprender)
- **Vencida**

**Sistema de alertas inteligente:**
Timer configurable desde envío. A las X horas sin respuesta → indicador
visual (amarillo/rojo) + botón de acción rápida para recontactar
(WhatsApp o mail con un toque).

### Lanzador de envío directo
Desde la misma pantalla de ventas:
1. Seleccionar cotización (PDF listo)
2. Elegir diseño/template de mail
3. Adjuntar presupuesto
4. Vista previa
5. Botón de confirmación → envía al cliente directo
Sin salir del sistema. Un solo flujo.

### Marketing simplificado
- **Campañas**: crear campaña, asociar lista de clientes, template de mail
- **Mailing**: envío masivo o segmentado (por rubro, tipo de cliente, historial)
- **Métricas básicas**: enviados, abiertos, respondidos

### Conexiones automáticas:
- Cotización aprobada → crea PROYECTO + notifica PRODUCCIÓN + genera pendiente en FINANZAS
- Cliente nuevo desde cotización → se carga en CRM automáticamente
- Historial de envíos → alimenta timeline del CLIENTE

---

## 2. 🔶 CLIENTES / CRM

### Ficha del cliente
- Razón social, CUIT, contacto principal, mail, teléfono
- **Tipo**: Marca, Productora, Organizador, Agencia, Productor Freelance
- Rubro
- Dirección fiscal / dirección operativa

### Timeline de interacciones (NUCLEAR)
El gran problema hoy: las conversaciones están dispersas entre WhatsApp MEPEX,
WhatsApp de Lelean, WhatsApp de Fede, mail, Instagram...

**Solución: timeline unificado por cliente.**
Cada interacción se registra (manual o automática) con:
- Fecha/hora
- Canal (WhatsApp MEPEX / WA Lelean / WA Fede / Mail / Instagram / Teléfono / Presencial)
- Quién atendió (Fede / Lelean / Noe)
- Resumen breve (texto libre o selección rápida: "envié cotización", "pidió cambios", "confirmó seña")
- Archivo adjunto opcional (captura, audio, PDF)

Esto se construye de dos formas:
1. **Automático**: cada mail enviado desde el sistema, cada cotización, cada factura → se registra solo
2. **Manual rápido**: botón "+" en el timeline → seleccionar canal, escribir 1 línea, listo
   La clave es que sea TAN fácil que la gente lo use. Si lleva más de 10 segundos, nadie lo carga.

### Historial completo
- Todos los proyectos (con estado actual)
- Todas las cotizaciones (aprobadas, rechazadas, pendientes)
- Estado de cuenta (debe/haber)
- Timeline de interacciones
- Todo en UNA pantalla por cliente, scrolleable, filtrable por año/tipo

### Conexiones:
- Toda cotización de VENTAS se ve acá
- Todos los proyectos de EVENTOS se ven acá
- El estado de cuenta viene de FINANZAS
- Las interacciones alimentan el timeline

---

## 3. 🔶 EVENTOS / PROYECTOS

### EVENTO
- Nombre, fechas (montaje, evento, desmontaje), lugar/venue
- Organizador (vinculado a CLIENTES si es cliente nuestro también)
- Plano general (PDF/imagen, actualizable — versionado)
- Reglamento: seguros requeridos, limitaciones de construcción, normas de seguridad
- **Vista consolidada**: todos los proyectos MEPEX en ese evento
- Equipo total asignado al evento
- Cronograma general del evento (fechas clave)

### PROYECTO
- Vinculado a: 1 cliente + 1 evento
- Cotización origen (link directo)

**Tipos de proyecto:**
- Stand personalizado
- Stand prediseñado
- Exposición / Feria completa
- Congreso (armado + equipamiento)
- Camarín
- Alquiler de equipamiento
- Armado de estructura / panelería (penal, estadio, etc.)

**Estados del proyecto:**
- Ingreso (pendiente)
- Para presupuestar
- En aguarda respuesta
- Aprobado
- En proceso (producción)
- En montaje
- Entregado (con OK fotográfico)
- En desmontaje
- Finalizado

**Diseño:**
- Archivos de diseño asociados (renders, planos, planta)
- Estado de aprobación de diseño (pendiente / aprobado / con cambios)
- Historial de versiones

### Conexiones:
- Proyecto nace de VENTAS (cotización aprobada)
- Proyecto dispara PRODUCCIÓN
- Proyecto consume INVENTARIO
- Proyecto tiene EQUIPO asignado (RRHH)
- Proyecto genera movimientos en FINANZAS
- Lo económico-analítico (rentabilidad) se ve desde FINANZAS, no acá

---

## 4. 🔷 FINANZAS / ADMINISTRACIÓN

**Quién lo usa:** Perfil admin (Fede, Lelean + contador/a si hay)

### Facturación
- Integración LaPyme (puente temporal)
- Factura electrónica AFIP
- Objetivo futuro: facturación propia dentro del sistema

### Cobros por proyecto
- Seña / anticipo
- Pagos parciales
- Saldo final
- Estado: pendiente → parcial → cobrado → moroso
- Alertas de vencimiento

### Tesorería
- Valores cargados (cheques, transferencias pendientes, efectivo)
- Disponibilidad real de fondos
- Proyección de flujo de caja (ingresos esperados vs pagos programados)

### Contabilidad
- **Libro diario**: asientos contables
- **Asientos bancarios**: movimientos de cuenta
- **Estado de resultados**: P&L por período

### Rentabilidad
- Por proyecto (cotizado vs costo real)
- Por evento (todos los proyectos del evento consolidados)
- Por cliente (histórico)
- Por período (mensual, trimestral, anual)

### Pagos a terceros
- Proveedores: pagos programados con fecha (no más "todo al momento")
- RRHH: jornales, extras, eventuales
- Proyección: qué hay que pagar esta semana/mes

### Reportes
- Fabricador de reportes personalizado
- Filtros: por fecha, cliente, evento, tipo de proyecto, rubro
- Exportable (PDF, Excel)

### Conexiones:
- Cada peso que entra o sale está vinculado a un PROYECTO, CLIENTE o PROVEEDOR
- Alimenta la vista de estado de cuenta en CLIENTES
- Recibe datos de costos de INVENTARIO/COMPRAS
- Recibe jornales de RRHH

---

## 5. 🔷 PRODUCCIÓN & OPERACIONES

### Producción en taller
- Tareas por proyecto (lista de lo que hay que fabricar/preparar)
- Estado de avance por tarea
- Materiales necesarios (vinculado a INVENTARIO)
- Digitalización progresiva de listas de papel

### Logística
- Vehículos asignados por evento/proyecto
- Cronograma: preparación → carga → transporte → montaje → evento → desmontaje → retorno
- Coordinación de múltiples armados/desarmes simultáneos

### Montaje / Desmontaje
- Equipo de personas asignado (vinculado a RRHH)
- Checklist de entrega

### Entrega con OK
- **Carga de fotos** del proyecto entregado/montado
- **Firma digital** del responsable del proyecto en terminal/celular
- Esto marca el proyecto como "Entregado" y queda como respaldo

### Mantenimiento
- **Lugares/instalaciones**: mantenimiento de taller, depósito, oficinas
- **Vehículos**: service, VTV, seguro, kilometraje, próximo mantenimiento
  Alertas automáticas por vencimiento o kilometraje

### Conexiones:
- Recibe proyectos aprobados desde VENTAS
- Consume materiales de INVENTARIO
- Usa personal de RRHH
- Los costos reales alimentan FINANZAS (rentabilidad)
- Fotos + firma alimentan el cierre del PROYECTO

---

## 6. ⬜ INVENTARIO & RECURSOS

### Stock de equipamiento
- **Panelería** (tipos, medidas, cantidad)
- **Iluminación** (tipos, cantidad)
- **Mobiliario** (sillas, mesas, mostradores, etc.)
- **Alfombras** (metros, colores)
- **Estructura** (perfilería, columnas, etc.)
- **Carros** (de transporte, de herramienta, etc.)
- **Escaleras** (tipos, alturas)
- **Herramientas**

Estado de cada ítem: **Disponible / Asignado a evento / En reparación / Baja**

La disponibilidad se calcula en cascada:
si un evento usa X paneles del día 5 al 12, esos paneles no están
disponibles para otro evento en esas fechas. Cuando el evento termina
y se desmonta, vuelven a disponible.

### Compras
- Stock general (reposición de consumibles y materiales)
- Compras específicas por proyecto (lo que el cliente pide puntual)
- Comparación de precios entre proveedores (vinculado a PROVEEDORES)

### Tercerización
- Gráfica (siempre tercerizada → vinculado a PROVEEDORES)
- Otros servicios puntuales

### Conexiones:
- PROYECTOS reservan materiales → baja disponibilidad
- PRODUCCIÓN consume → actualiza stock
- COMPRAS generan movimiento en FINANZAS
- PROVEEDORES suministran

---

## 7. ⬜ EQUIPO / RRHH

### Personal
- **Fijos**: 17 personas (datos, rol, antigüedad)
- **Eventuales base**: 3 personas
- **Pico**: hasta 40 con grupos externos

### Asignación
- Por proyecto (quién trabaja en qué)
- Por evento (vista consolidada de todo el equipo en un evento)
- Calendario de disponibilidad / ocupación

### Pagos
- Jornales (fijos y eventuales)
- Extras
- Horas adicionales
- Grupos externos

### Vacaciones
- Días disponibles por persona
- Solicitud → aprobación
- Calendario de vacaciones del equipo
- Alerta de superposición (que no se vayan todos juntos)

### Conexiones:
- Asignaciones vinculadas a PROYECTOS y EVENTOS
- Pagos van a FINANZAS
- Disponibilidad afecta PRODUCCIÓN (puedo tomar este proyecto si tengo gente)

---

## 8. ⬜ PROVEEDORES & COMPRAS

### Base de proveedores
- Datos de contacto
- Rubro: gráfica, transporte, ferretería, pintura, aluminio, maderas,
  vidrios, tech, mano de obra externa
- Calificación (cumplimiento, calidad, precio)

### Gestión comercial
- Historial de compras
- Comparación de presupuestos (para mismo producto, distintos proveedores)
- Mejores precios detectados

### Pagos planificados
- Cada compra con fecha de pago programada
- Vista de pagos pendientes por semana/mes
- Proyección de egresos

### Conexiones:
- Cada compra vinculada a INVENTARIO
- Compras específicas vinculadas a un PROYECTO
- Todos los pagos van a FINANZAS / Tesorería
- Comparación de precios informa decisiones de COMPRAS

---

## AUTENTICACIÓN & ROLES

### Login
- Pantalla de ingreso al sistema con branding MEPEX
- Usuario + contraseña (hash seguro, nunca plano)
- Sesión persistente por dispositivo (token JWT o similar)
- Opción "recordar en este dispositivo" para terminales fijas de oficina/taller
- Timeout configurable de inactividad (ej: 8hs oficina, 2hs remoto)

### Roles

| Rol | Acceso | Usuarios típicos |
|---|---|---|
| **Admin** | Todo. Gestión de usuarios, configuración del sistema, permisos | Fede, Lelean |
| **Ventas** | Ventas, Clientes, Eventos/Proyectos (vista comercial), Marketing | Noe, vendedores |
| **Operaciones** | Producción, Inventario, Eventos/Proyectos (vista operativa), RRHH asignaciones | Jefes de taller, logística |
| **Finanzas** | Finanzas, Clientes (estado de cuenta), Proveedores (pagos) | Administración, contador/a |
| **Taller** | Vista ultra simplificada: tareas asignadas, checklist, carga de fotos, firma | Personal de producción |
| **Externo** | Vista limitada de proyectos asignados, sin datos financieros | PM o vendedores externos |

### Gestión de usuarios (solo Admin)
- Alta / baja / modificación de usuarios
- Asignar rol
- Asignar terminal (ej: "PC Oficina Noe", "Tablet Taller", "Celular Fede")
- Ver historial de sesiones (quién entró, cuándo, desde dónde)
- Resetear contraseña

### Terminales
Cada dispositivo se registra con un nombre amigable al primer login.
Esto permite:
- Saber desde qué dispositivo se hizo cada acción
- Política de seguridad por terminal (ej: tablet de taller solo rol Taller)
- Bloquear terminales perdidas/robadas sin afectar al usuario en otro dispositivo

### Seguridad
- Contraseñas hasheadas (bcrypt)
- JWT con expiración configurable
- HTTPS obligatorio en nube
- Registro de actividad (audit log): quién hizo qué, cuándo, desde dónde
- Intentos fallidos: bloqueo temporal después de X intentos

---

## NOTA TÉCNICA: LOCAL + NUBE

El sistema debe funcionar en modo dual:
- **Local**: servidor en oficina/taller para operación sin internet
- **Nube**: acceso remoto, backup, sincronización
- **Sincronización LIVE**: cambios en local se reflejan en nube y viceversa
- Esto implica una DB que soporte sync bidireccional
  (PostgreSQL + replicación, o CouchDB/PouchDB para offline-first)
- La auth funciona en ambos modos: login local no depende de internet
