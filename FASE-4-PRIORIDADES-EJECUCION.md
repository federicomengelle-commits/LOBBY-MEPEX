# FASE 4 — Prioridades de Ejecución

## Orden de implementación

| Paso | Módulo | Sesiones | Impacto | Dependencias |
|------|--------|----------|---------|--------------|
| 0 | **Preparación** (git branch + backup Supabase) | 1 | — | Nada |
| 1 | **Sidebar + Rutas** (data.js + router.js) | 1 | Visual inmediato | Nada |
| 2 | **Eventos** (ajustes: Rechazado + horarios) | 1 | Bajo, cleanup | Paso 1 |
| 3 | **Proyectos** (extraer a proyectos.js) | 1-2 | Alto, módulo core | Paso 1 |
| 4 | **CRM** (construir crm.js completo) | 3-5 | MUY ALTO, corazón comercial | Paso 1 |
| 5 | **Catálogo** (extraer a catalogo.js) | 1-2 | Medio | Paso 1 |
| 6 | **Inventario** (achicar + extraer) | 1 | Medio | Paso 5 (quitar catálogo primero) |
| 7 | **Costos** (construir costos.js) | 3-5 | MUY ALTO, desbloquea precios $0 | Paso 6 (insumos limpios) |
| 8 | **Producción** (construir simple) | 1-2 | Medio | Paso 3 (proyectos) |
| 9 | **Logística** (construir nuevo) | 2-3 | Medio | Paso 2 (eventos) |
| 10 | **Compras** (construir, migrar proveedores) | 1-2 | Medio | Nada |
| 11 | **RRHH** (construir) | 1-2 | Medio | Nada |
| 12 | **Locaciones** (construir simple) | 1 | Bajo | Paso 6 (inventario para cruce stock) |
| 13 | **Finanzas** (construir + LaPyme) | 2-3 | Alto | Paso 4 (CRM para cobros) |
| 14 | **Lobby por rol** (rediseñar dashboards) | 2-3 | Alto | Todos los anteriores (necesita data real) |
| 15 | **Admin mejoras** (salud + adopción) | 1 | Bajo | Todos (necesita módulos activos) |

**Total estimado: 22-35 sesiones de Claude Code**

## Lógica del orden

1. **Pasos 0-1:** Setup. Se ve el cambio al instante, nada se rompe.
2. **Pasos 2-3:** Eventos + Proyectos. Quick wins, patrón probado.
3. **Paso 4:** CRM. El módulo más valioso. Se construye de cero, no se parchea.
4. **Pasos 5-6:** Catálogo + Inventario. Reorganización del inventario actual.
5. **Paso 7:** Costos. Desbloquea los precios $0,00 del Cotizador.
6. **Pasos 8-12:** Módulos independientes en cualquier orden.
7. **Pasos 13-15:** Finanzas + Lobby + Admin. Necesitan data de los otros.

## Estrategia de ejecución con Claude Code

- Un prompt por paso, objetivo acotado
- Cada paso = un commit (mínimo)
- Pasos grandes (CRM, Costos) = un commit por sección/tab
- Si algo falla, rollback de un solo paso
- Testear después de cada paso antes de seguir
- Branch `rediseno-modulos`, merge a main cuando esté estable

## Instrucciones para Claude Code por paso

### Paso 0: Preparación
```
git checkout -b rediseno-modulos
```
Backup Supabase desde dashboard.

### Paso 1: Sidebar + Rutas
Actualizar data.js con las 5 categorías y 14 módulos.
Actualizar router.js con nuevas rutas.
Módulos sin código propio → placeholder digno.
Eliminar rutas #ventas y #clientes (redirigir a #crm).
Eliminar ruta #proveedores (redirigir a #compras).

### Paso 2: Eventos
En eventos.js: renombrar estado "Cancelado" → "Rechazado".
Mejorar sección fechas: cada fase (armado, funcionamiento, desarme) con rango de días + horario apertura/cierre.

### Paso 3: Proyectos
Crear proyectos.js copiando patrón de eventos.js.
Extraer lógica de proyectos de modules.js.
Agregar campos multi-select: Responsables y Tipo.
Tipos: Stand full, Alquiler de equipamiento, Iluminación, Infraestructura, Gráfica, Pisos, Camarín, Más servicios.
Filtros: por evento, estado, responsable, tipo.
Registrar en router.

### Paso 4: CRM (por sub-pasos)
4a. Crear crm.js con estructura base + tab Clientes
4b. Tab Pipeline (kanban 7 columnas + KPIs sin "total en pipeline")
4c. Tab Cotizaciones (tabla + ficha lateral con Resumen/Timeline/Seguimiento)
4d. Tab Interacciones (feed cronológico global)
4e. Tab Marketing (campañas)
Referencia visual: crm-mepex.jsx

### Paso 5: Catálogo
Crear catalogo.js.
Extraer catálogo de items de modules.js.
Mover a categoría Comercial.
Campos editables menos precio.
Ficha lateral con info del item.

### Paso 6: Inventario
Limpiar modules.js: quitar catálogo (ya en catalogo.js) y simulador (irá a costos).
Crear inventario.js con insumos + stock.

### Paso 7: Costos (por sub-pasos)
7a. Crear costos.js con estructura + Recetas/BOM
7b. Catálogo base con costos calculados
7c. Listas de precio (General + Agencias + especiales)
7d. Generador/exportador + conexión con Catálogo y Cotizador

### Pasos 8-12: Módulos independientes
Cada uno: crear archivo .js, definir secciones según Fase 2, registrar en router.

### Paso 13: Finanzas
Integración LaPyme, cobros, tesorería, calendario admin, reportes.

### Paso 14: Lobby por rol
Rediseñar dashboards con KPIs y alertas por rol según definición Fase 2.

### Paso 15: Admin mejoras
Agregar salud del sistema y adopción por módulo al admin-panel.js.
