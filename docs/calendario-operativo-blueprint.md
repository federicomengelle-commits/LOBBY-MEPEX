# CALENDARIO OPERATIVO — BLUEPRINT
## Sistema de Gestión MEPEX

---

## 1. VISIÓN GENERAL

Calendario vertical infinito para planificación logística y operativa. Muestra eventos con proyectos confirmados, con sus 3 fases (armado, funcionamiento, desarme) en un timeline vertical donde el tiempo corre de arriba hacia abajo.

**Usuarios:** Fede, Lelean (planificación general), PMs (logística de sus eventos), Producción (ver carga de trabajo).

**Propósito:** Ver superposiciones entre eventos, planificar equipos, camiones, y días de carga/transporte. Es la herramienta central para decisiones de logística.

**Regla de entrada:** Solo aparecen eventos que tienen al menos 1 proyecto con estado CONFIRMADO (aprobado + pago recibido).

---

## 2. ESTRUCTURA VISUAL

### Layout principal

```
    ┌──────────────────────────────────────────────────────┐
    │  [◄ Hoy ►]  [Mes ▼]  [Zoom ▼]  [Filtros]          │
    ├──────────────────────────────────────────────────────┤
    │         │  Carril 1  │  Carril 2  │  Carril 3  │    │
    │         │            │            │            │    │
    │  MAR 10 │ ░░░░░░░░░░ │            │            │    │
    │         │ ░ ARMADO ░ │            │            │    │
    │  MAR 11 │ ░░░░░░░░░░ │            │            │    │
    │         │ ▓▓▓▓▓▓▓▓▓▓ │ ░░░░░░░░░ │            │    │
    │  MAR 12 │ ▓ EVENTO ▓ │ ░ ARMADO░ │            │    │
    │         │ ▓▓▓▓▓▓▓▓▓▓ │ ░░░░░░░░░ │            │    │
    │  MAR 13 │ ▓▓▓▓▓▓▓▓▓▓ │ ▓▓▓▓▓▓▓▓▓ │            │    │
    │         │ ▓▓▓▓▓▓▓▓▓▓ │ ▓ EVENTO▓ │            │    │
    │  MAR 14 │ ▒▒▒▒▒▒▒▒▒▒ │ ▓▓▓▓▓▓▓▓▓ │            │    │
    │         │ ▒DESARME▒ │ ▓▓▓▓▓▓▓▓▓ │            │    │
    │  MAR 15 │            │ ▒▒▒▒▒▒▒▒▒ │            │    │
    │         │            │ ▒DESARME▒ │            │    │
    │         │            │            │            │    │
    │    ↓ scroll infinito hacia abajo (futuro)      │    │
    │    ↑ scroll infinito hacia arriba (pasado)     │    │
    └──────────────────────────────────────────────────────┘
```

### Eje vertical (tiempo)
- Corre de arriba (pasado) hacia abajo (futuro)
- Scroll infinito en ambas direcciones
- Escala configurable: 1 día = X píxeles (zoom in/out)
- Marcadores de fecha a la izquierda (columna fija)
- Línea horizontal "HOY" destacada (cyan, pulsante)
- Marcas de semana y mes visibles
- Los fines de semana con fondo ligeramente diferente

### Carriles (columnas)
- Columnas fijas lado a lado
- Cada evento ocupa un carril
- Si no hay superposición, los eventos pueden compartir carril
- Si hay superposición temporal, se abren carriles paralelos automáticamente
- Ancho de carril configurable (o auto-ajustable)
- Los carriles se ordenan cronológicamente por fecha de inicio

### Bloques de evento
- Cada evento es un bloque vertical continuo dividido en 3 fases
- El bloque tiene UN color base único por evento (asignado automáticamente de una paleta)
- Las 3 fases se distinguen por textura/patrón sobre ese color:

| Fase | Textura | Descripción visual |
|------|---------|-------------------|
| **Armado** | Rayas diagonales (////) | Indica actividad de preparación |
| **Funcionamiento** | Sólido (color pleno) | El evento está en curso |
| **Desarme** | Punteado (· · · ·) | Desmontaje y retiro |

### Contenido visible en cada bloque
- Nombre del evento (bold, compacto)
- Locación/predio
- Fechas de cada fase
- Cantidad de proyectos MEPEX en ese evento
- Ícono indicador si tiene equipo/camión asignado

---

## 3. NAVEGACIÓN Y CONTROLES

### Barra superior
- **Botón "Hoy":** Centra el scroll en la fecha actual
- **Selector de mes:** Navegar rápido a un mes específico
- **Zoom:** Controla la escala vertical (día comprimido ↔ día expandido)
  - Zoom mínimo: vista de 3 meses en pantalla
  - Zoom máximo: 1 semana en pantalla con detalle
- **Filtros:** Por predio/locación, por PM asignado, por cliente

### Interacción
- Scroll vertical: navegar en el tiempo (infinito)
- Scroll horizontal: ver más carriles si hay muchos eventos simultáneos
- Click en bloque de evento → abre side panel con detalle
- Hover sobre bloque → tooltip con info rápida (nombre, fechas, proyectos)
- Drag vertical en bloque → ajustar fechas (futuro, V2)

---

## 4. SIDE PANEL — DETALLE DE EVENTO

Al hacer clic en un bloque se abre panel lateral con:

### Header
- Nombre del evento
- Locación/predio
- Color asignado (badge)
- Fechas: armado | funcionamiento | desarme

### Sección: Proyectos MEPEX en este evento
- Lista de proyectos confirmados vinculados
- Para cada proyecto: cliente, tipo, PM asignado, estado
- Link a ficha del proyecto

### Sección: Logística
- Equipo asignado (personas del taller + montajistas)
- Camión/transporte asignado
- Día y hora de carga en depósito
- Día y hora de transporte ida
- Día y hora de transporte vuelta
- Checklist de materiales a cargar (futuro, vinculado a inventario)
- Notas operativas

### Sección: Documentos
- Link al plano del predio
- Link al reglamento del evento
- Link al manual del expositor
- Seguros y acreditaciones

---

## 5. CONEXIONES CON OTROS MÓDULOS

### Calendario → Eventos
- El calendario LEE datos de la DB de eventos
- Solo muestra eventos con proyectos confirmados
- Las fechas de armado/funcionamiento/desarme vienen de la ficha del evento

### Calendario → Proyectos
- Desde el side panel se accede a los proyectos vinculados
- El estado del proyecto determina si el evento aparece o no

### Calendario → RRHH/Equipo
- Asignación de personas a cada evento/fase
- Visualización de carga de trabajo (quién está ocupado cuándo)
- Detección de conflictos (misma persona asignada a 2 eventos superpuestos)

### Calendario → Logística/Inventario
- Asignación de camiones/transporte
- Pre-visualización de materiales necesarios (futuro)
- Detección de conflictos de recursos (mismo camión, 2 eventos)

### Calendario → Ventas (solo lectura)
- No hay conexión directa
- Los eventos aparecen solo cuando tienen proyectos confirmados (post-venta)

---

## 6. PALETA DE COLORES PARA EVENTOS

Colores base automáticos (se asignan en orden):
```
Evento 1: #00BCD4 (cyan MEPEX)
Evento 2: #FF9800 (naranja MEPEX)
Evento 3: #9C27B0 (púrpura)
Evento 4: #4CAF50 (verde)
Evento 5: #E91E63 (rosa)
Evento 6: #3F51B5 (índigo)
Evento 7: #009688 (teal)
Evento 8: #FF5722 (deep orange)
Evento 9: #607D8B (blue grey)
Evento 10: #CDDC39 (lime)
```
Si hay más de 10 eventos simultáneos, se reciclan con variación de luminosidad.

---

## 7. DISEÑO UX/UI

### Estilo visual
- Dark theme MEPEX consistente con el lobby
- Tipografía compacta (Archivo + JetBrains Mono)
- Los bloques de evento deben ser el foco visual (colores saturados sobre fondo oscuro)
- La línea de "HOY" debe ser inmediatamente visible
- Grid de fondo sutil para leer las fechas

### Performance
- Renderizar solo lo visible en pantalla + buffer arriba/abajo
- Lazy loading de eventos al hacer scroll
- No cargar todos los eventos de la historia, solo rango visible + 2 meses buffer

### Responsive
- Desktop: vista completa con múltiples carriles
- Tablet: scroll horizontal para carriles, misma funcionalidad
- Mobile: vista simplificada, 1 carril a la vez con swipe

---

## 8. PRIORIDAD DE IMPLEMENTACIÓN

### V1 (AHORA):
- [ ] Timeline vertical infinito con scroll
- [ ] Carriles lado a lado para superposiciones
- [ ] Bloques de evento con 3 fases (texturas)
- [ ] Línea de HOY
- [ ] Zoom in/out
- [ ] Botón "Hoy" + navegación por mes
- [ ] Click → side panel con detalle básico (nombre, fechas, proyectos)
- [ ] Datos dummy realistas (5-8 eventos con superposiciones)

### V2 (PRÓXIMO):
- [ ] Conexión Supabase (eventos + proyectos confirmados)
- [ ] Side panel completo con logística (equipo, camión, horarios)
- [ ] Filtros por predio, PM, cliente
- [ ] Detección de conflictos (personas/camiones en 2 eventos)
- [ ] Tooltip en hover

### V3 (FUTURO):
- [ ] Drag para ajustar fechas
- [ ] Asignación de equipo desde el calendario (drag personas a eventos)
- [ ] Checklist de materiales vinculado a inventario
- [ ] Vista de carga por persona (quién está libre cuándo)
- [ ] Exportar vista a PDF/imagen para compartir
