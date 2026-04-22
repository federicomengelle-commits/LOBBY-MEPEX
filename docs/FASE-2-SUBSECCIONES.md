# FASE 2 — Subsecciones por Módulo (CONFIRMADAS)

> Todas las definiciones peloteadas y confirmadas con Fede.

---

## PRINCIPAL

### Lobby (`#lobby`)
**Dashboard de inicio, personalizado por rol.**

| Rol | Contenido |
|-----|-----------|
| superadmin/admin | KPIs (cotizaciones activas, proyectos en curso, eventos próximos, cobros pendientes) + alertas operativas TODAS + actividad reciente |
| venta | Sus cotizaciones activas, pipeline resumido, follow-ups pendientes, próximos eventos + alertas: cotizaciones por vencer, clientes sin follow-up |
| pm | Sus proyectos asignados, calendario de la semana, tareas pendientes + alertas: proyectos trabados, eventos sin equipo |
| taller | Tareas del día, materiales a preparar, próximo armado + alertas: vehículos VTV/service vencido, tareas pendientes |

### Calendario Operativo (`#calendario`)
**Timeline vertical, vista operativa pura.**

- Eventos (armado/funcionamiento/desarme) — ya funciona
- Proyectos (deadlines, entregas a taller)
- Logística (salidas/retornos vehículos, armados en venue)
- Personal asignado por evento (quién va a armado, quién a desarme)
- Sin finanzas (tiene su propio calendario)
- Sin filtros adicionales (muestra todo)

---

## COMERCIAL

### CRM (`#crm`)
**Módulo nuevo. Fusión Clientes + Ventas. Ref: `crm-mepex.jsx`**

**5 tabs:**

1. **Clientes** — tabla con score, tipo (Marca/Agencia/Organizador/Productor Freelance/Productora), rubro, estado (activo/lead/inactivo). Ficha lateral: datos, score, proyectos, cotizaciones, pipeline activo, interacciones
2. **Pipeline** — kanban NUEVO integrado. 7 columnas: Borrador → Enviada → En Negociación → Aprobada → Cerrada Ganada → Cerrada Perdida → Facturada. KPIs arriba (sin "total en pipeline"): tasa conversión, tiempo promedio cierre, cotizaciones activas, hot leads, por vencer. Cards con código COT, cliente, evento, temperatura, días, vendedor
3. **Cotizaciones** — tabla con código, cliente, evento, fecha, estado, items, versión, vendedor, vigencia. Click → ficha lateral con 3 sub-tabs: Resumen (datos + presupuesto + link PDF inline y pestaña nueva), Timeline (interacciones: Nota/Email/WhatsApp/Vista + cambios estado automáticos), Seguimiento
4. **Interacciones** — feed cronológico global, levanta todas las interacciones de cotizaciones/clientes. Filtro por tipo
5. **Marketing** — campañas (cards con estado, canal, período, contactos)

**Se construye entero de cero, no se parchea el viejo.**
Interacciones: carga manual por ahora. Futuro: satélite automatizado.

### Cotizador (`#cotizador`)
**Link externo en sidebar → abre `195.200.1.250/cotizador/` en nueva pestaña.**
Flujo unidireccional: Cotizador exporta → tabla Cotizaciones del CRM.

### Catálogo (`#catalogo`)
**Vitrina de items/servicios para clientes.**

- Tabla/grilla: nombre, código, rubro, categoría, origen, unidad, foto/imagen
- Todo editable MENOS precio (viene de Costos → listas de precio)
- Ficha lateral con info del item
- Filtros por rubro, categoría
- Dos catálogos públicos diferenciados:
  - **Stands y Alquileres** → clientes directos (marcas, agencias)
  - **Eventos/Estructuras** → organizadores, productoras (expos, congresos, camarines)
- Generador de catálogos custom → vive en Costos

---

## OPERACIONES

### Proyectos (`#proyectos`)
**Extraer de modules.js a `proyectos.js`.**

- Tabla con multi-select en:
  - **Responsables** (puede haber 2+)
  - **Tipo** (puede ser múltiple):
    - Stand full (servicio integral)
    - Alquiler de equipamiento
    - Iluminación
    - Infraestructura
    - Gráfica
    - Pisos
    - Camarín
    - Más servicios
- **Filtros:** por evento, estado, responsable, tipo
- **Estados:** Pendiente, Aguarda respuesta, Aprobado, En proceso, Entregado a taller, Finalizado, Rechazado
- **Ficha lateral:** datos + evento + cotización + equipo + estado producción

### Eventos (`#eventos`)
**Ya separado (eventos.js). Ajustes menores:**

- Estado: "Cancelado" → renombrar a **"Rechazado"**
- Fechas mejoradas: cada fase (armado, funcionamiento, desarme) con **rango de días + horario apertura/cierre**
  - Ej: Armado 15-16 abril, 8:00-18:00 / Evento 17-19 abril, 9:00-20:00 / Desarme 20 abril, 8:00-14:00

### Producción (`#produccion`)
**Nuevo, desde cero. SENCILLEZ ANTE TODO (resistencia al uso).**

- **Tareas por proyecto** — lista simple: qué hacer + estado (pendiente/en proceso/listo). Sin responsable individual (lo hace taller como equipo)
- **Mantenimiento** — herramientas importantes, estado, matafuegos, reparaciones, alertas vencimiento
- Montaje/desmontaje → vive en Logística
- Visibilidad: rol taller ve Producción + Calendario Operativo + su Lobby

### Logística (`#logistica`)
**Nuevo, separado de Producción.**

- **Vehículos** — flota propia: datos, estado, VTV, service, seguro, disponibilidad
- **Transporte** — cronograma salidas/retornos por evento, vehículo asignado, conductor
- **Montaje/Desmontaje** — checklist de lo que sale del depósito, verificación al volver
- **Entrega con OK** — fotos del stand terminado, firma/confirmación del cliente

---

## RECURSOS

### RRHH (`#rrhh`)

- **Nómina** — personal fijo (17) / eventual base (3) / pico (40): nombre, rol, tipo, contacto, antigüedad, documentación. Cuadrillas externas como unidad ("cuadrilla de fulano, 8 personas")
- **Asignación** — por evento/proyecto, cruza con Calendario Operativo
- **Pagos** — jornales, extras, horas adicionales, grupos externos
- **Vacaciones** — calendario, días disponibles, solicitudes

### Compras (`#compras`)
**Nuevo, reemplaza `#proveedores`.**

- **Proveedores** — tabla + ficha: datos, rubro, calificación (cumplimiento, calidad, precio)
- **Órdenes de compra** — generar OC, vincular proveedor, estado (pendiente/aprobada/recibida/pagada)
- **Comparación** — presupuestos de distintos proveedores para mismo insumo/servicio
- **Pagos planificados** — qué se debe, a quién, cuándo vence

### Inventario (`#inventario`)
**Extraer de modules.js, achicado.**

- **Insumos base** — tabla: clasificación, categoría, costo unitario, moneda, unidad, proveedor
- **Stock** — qué hay, cuánto, estado (Disponible/Asignado/En reparación/Baja), vinculado a Locaciones
- Categorías: Panelería, Iluminación, Mobiliario, Alfombras, Estructura, Carros, Escaleras, Herramientas
- Sin catálogo (→ Comercial), sin simulador (→ Costos)

### Locaciones (`#locaciones`)
**Nuevo.**

- **Lugares** — tabla: nombre, dirección, tipo, superficie, estado. Hoy: depósito, taller, oficina (3 locaciones)
- **Documentación** — contratos, habilitaciones, seguros, vencimientos por locación
- **Stock por locación** — qué hay en cada lugar, cruzado con Inventario

---

## ADMIN & FINANZAS

### Finanzas (`#finanzas`)

- **Facturación** — integración LaPyme (futuro: reemplazo propio)
- **Cobros por proyecto** — seña, parciales, saldo, alertas vencimiento
- **Tesorería** — valores, disponibilidad, proyección flujo de caja
- **Pagos a terceros** — proveedores, RRHH, jornales (cruza con Compras y RRHH)
- **Calendario administrativo** — vencimientos, cobros entrantes, pagos salientes, filtros por tipo/fecha/estado
- **Reportes** — rentabilidad por proyecto, cliente, período, exportable

### Costos (`#costos`)
**Nuevo. Solo superadmin y admin.**

- **Recetas/BOM** — composición de items, carga desde receta base existente (ej: columna C-100 → clonar y ajustar para C-120)
- **Catálogo base** — items con costo de producción calculado desde recetas
- **Listas de precio** — sistema de listas nombradas:
  - **General** — margen estándar sobre costo
  - **Agencias** — margen menor (se muestra como descuento: precio lista tachado + "X% OFF")
  - **Especiales** — esporádicas, custom por cliente/evento
  - Margen configurable: global, por rubro, o por item
  - Precio se CALCULA, nunca se carga a mano
  - Recálculo automático al actualizar insumos (~cada 3 meses)
- **Generador/exportador** — exporta PDF/Excel, alimenta Catálogo y Cotizador
- Cotizador selecciona qué lista usar al cotizar

### Admin (`#admin-panel`)
**Ya funcional, se mantiene + mejoras.**

- **KPIs:** usuarios online, acciones hoy, módulo más usado, último error
- **Estadísticas de usuarios:** tabla con rol, login, dispositivo, uso hoy/semana, sesiones, acciones
- **Actividad del sistema:** feed con filtros (usuario, módulo, acción, fechas)
- **Salud del sistema** (NUEVO): errores por módulo (24/48hs), tiempos de carga promedio
- **Adopción por módulo** (NUEVO): uso real + tendencia semanal (sube/baja)
- **Gestión de usuarios y roles**
- Alertas operativas → NO acá, viven en Lobby de cada rol
