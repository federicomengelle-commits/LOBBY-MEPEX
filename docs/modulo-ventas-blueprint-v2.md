# MÓDULO VENTAS — BLUEPRINT V2 (AJUSTADO)
## Sistema de Gestión MEPEX

---

## 1. VISIÓN GENERAL

Motor comercial de MEPEX. Acá nace todo: un lead entra, se cotiza, se negocia, se cierra.

**Usuarios:** Fede, Lelean, Noe, futuros PM/vendedores externos.
**Principio:** Compacto, denso en info, sin ruido visual. Letras chicas, columnas ajustadas, todo a la vista.

---

## 2. SUBSECCIONES DEL MÓDULO

### 2.1 PIPELINE COMERCIAL (pantalla principal)

**6 estados** (se eliminó "Vista"):

| Columna | Color | Descripción | Acción al entrar |
|---------|-------|-------------|------------------|
| **Borrador** | Gris | Cotización en preparación | — |
| **Enviada** | Cyan | Enviada al cliente | Arranca timer de seguimiento |
| **En negociación** | Naranja | Cliente respondió, hay ida y vuelta | Pausa timer, registra interacción |
| **Aprobada** | Verde | Cliente confirmó | Crea carpeta de proyecto (vacía, solo para visualizar) |
| **Rechazada** | Rojo | No avanzó | Registra motivo |
| **Vencida** | Gris oscuro | Pasaron X días sin respuesta | Se puede reactivar |

**Diseño UX:**
- Tipografía COMPACTA: cuerpo 12px, datos 11px, códigos en JetBrains Mono 10px
- Columnas ajustadas al contenido, sin espacios desperdiciados
- Vista principal: tabla con columnas personalizables (reordenar, mostrar/ocultar, resize)
- Vista alternativa: kanban (toggle)
- Densidad alta: mucha info en poco espacio

**Cada fila/tarjeta muestra:**
- Código cotización (COT-2026-0047)
- Cliente (nombre corto)
- Evento vinculado
- Tipo de servicio
- Días en estado actual
- Semáforo urgencia (verde/amarillo/rojo)
- Vendedor (iniciales o avatar mini)
- Estado (badge compacto de color)

---

### 2.2 FICHA DE OPORTUNIDAD (side panel al hacer clic)

**Header compacto:**
- Código + Estado (badge) + Días desde creación
- Botones: Cambiar estado, Editar, Duplicar

**Datos comerciales:**
- Cliente (link a ficha CRM)
- Evento vinculado (link a ficha evento)
- Tipo: Stand prediseñado / Personalizado / Expo / Alquiler
- Vendedor asignado
- Fecha de envío
- Archivo PDF cotización (tomado del historial del cotizador en Supabase)

**Timeline de seguimiento:**
- Registro cronológico de interacciones
- Entradas automáticas: envío, cambio de estado
- Botón "+" para agregar manual (< 10 segundos)

**⚡ SEGUIMIENTO AUTOMATIZADO (gol de automatización):**
- 2-3 plantillas predefinidas de mensaje (ej: "Primer seguimiento", "Segundo contacto", "Última oportunidad")
- Selector de medio: WhatsApp / Mail / Teléfono
- Al presionar el botón:
  1. Se autocompleta la plantilla con datos del documento (nombre cliente, código cotización, evento, monto, vendedor)
  2. Se abre en BORRADOR (no se envía solo)
  3. El usuario revisa, ajusta si quiere, y envía
  4. Se registra automáticamente en el timeline
- Los templates son editables desde configuración

**Notas internas:**
- Espacio para notas del equipo
- Historial de cambios

---

### 2.3 COTIZADOR (integrado vía Supabase)

Ya migrado y funcionando. El PDF se registra en el historial del cotizador en Supabase.
- Botón "Nueva cotización" → abre cotizador
- PDFs accesibles desde la ficha de oportunidad (se toman de Supabase)

---

### 2.4 MÉTRICAS COMERCIALES (widget compacto)

**SIN montos visibles. Solo métricas operativas:**
- Cotizaciones activas (por estado) — contadores
- Tasa de conversión (%) últimos 30/60/90 días
- Tiempo promedio de cierre (días)
- Cotizaciones por vendedor

**SIN:** ticket promedio, monto en pipeline, facturación.

**📌 IMPORTANTE — GUARDAR PARA DESPUÉS:**
> Los dashboards inteligentes con montos, gráficos financieros, estadísticas avanzadas y analytics se desarrollarán en el PERFIL DE ADMIN como feature separado. Esto incluye embudo de conversión visual, evolución mensual, rentabilidad, y todo lo que tenga que ver con plata visible.

---

### 2.5 MARKETING
> Se desarrollará junto con los dashboards pro en el perfil de admin. No se incluye en V1.

---

## 3. CONEXIONES CON OTROS MÓDULOS (CORREGIDAS)

### Ventas → Clientes/CRM ✅
- Cada oportunidad tiene un cliente vinculado
- Cliente nuevo → se crea ficha en CRM
- Timeline alimenta historial del cliente
- Desde Clientes se ven todas las oportunidades

### Ventas → Eventos ✅
- Cada oportunidad se vincula a un evento
- Datos del evento visibles desde la oportunidad
- Desde Eventos se ven oportunidades vinculadas

### Ventas → Proyectos ✅ (limitado)
- Cotización APROBADA → se crea CARPETA de proyecto (vacía, solo para visualizar)
- NO se carga info automática hasta que haya pago confirmado
- Link bidireccional entre oportunidad y proyecto

### Ventas → Finanzas ❌
- NO hay conexión directa Ventas→Finanzas en el Lobby
- La facturación se maneja desde La PyME
- No todo se factura por La PyME, hay cosas aparte por otro canal
- El Lobby no dispara facturas

### Ventas → Producción ❌ (no automático)
- NO hay notificación automática al aprobar cotización
- Producción se activa recién cuando hay pago confirmado
- Eso se gestiona desde el módulo Proyectos, no desde Ventas

### Ventas → Inventario ❌ (futuro lejano)
- No hay pre-reserva automática en V1

---

## 4. FLUJO COMPLETO DE UNA VENTA (CORREGIDO)

```
1. Lead entra (referido, mail, evento anterior)
       ↓
2. Se crea OPORTUNIDAD en pipeline → estado: BORRADOR
       ↓
3. Se arma cotización en el COTIZADOR → PDF en Supabase
       ↓
4. Se envía al cliente → estado: ENVIADA → arranca TIMER
       ↓
5a. Cliente responde → estado: EN NEGOCIACIÓN → interacción registrada
5b. No responde → ALERTA → botón de seguimiento automático
    → Se elige plantilla + medio → borrador → revisa → envía
       ↓
6a. Cliente aprueba → estado: APROBADA
    └─→ Se crea CARPETA de proyecto (vacía, para visualizar)
    └─→ Se registra en historial del CLIENTE
    └─→ (Facturación se hace aparte en La PyME, manual)
    └─→ (Producción espera confirmación de pago)
       ↓
6b. Cliente rechaza → estado: RECHAZADA → motivo registrado
       ↓
7. Post-aprobación: el seguimiento pasa al módulo PROYECTOS
   (cuando se confirma pago → se activa producción desde ahí)
```

---

## 5. DISEÑO UX/UI

### Estilo visual
- Dark theme MEPEX, colores corporativos
- **COMPACTO:** letras chicas (12px base, 11px datos, 10px códigos)
- Columnas personalizables: drag to reorder, toggle show/hide, resize
- Máxima densidad de información
- Sin espacios vacíos innecesarios
- Side panel para detalle (no página nueva)

### Interacciones
- Click en fila → side panel con ficha
- Filtros rápidos: vendedor, evento, estado, fecha
- Búsqueda por cliente o código
- Toggle vista: tabla ↔ kanban
- Drag & drop en kanban

### Responsive
- Desktop: tabla completa + side panel
- Tablet: tabla con scroll horizontal
- Mobile: lista simplificada

---

## 6. PLAN DE IMPLEMENTACIÓN

### V1 (AHORA):
- [ ] Tabla principal con columnas personalizables
- [ ] 6 estados con cambio manual
- [ ] Ficha de oportunidad en side panel
- [ ] Timeline de interacciones (manual)
- [ ] Seguimiento automatizado (plantillas + botón borrador)
- [ ] Link al cotizador + PDF desde Supabase
- [ ] KPIs operativos (sin montos)
- [ ] Filtros y búsqueda

### V2 (PRÓXIMO):
- [ ] Timer automático con alertas visuales
- [ ] Conexión bidireccional con fichas de cliente y evento
- [ ] Mejoras UX según uso real

### V3 (ADMIN PROFILE):
- [ ] Dashboards inteligentes con montos y analytics
- [ ] Marketing/mailing integrado
- [ ] Embudo de conversión, gráficos de evolución

### V4 (CON LA PYME API):
- [ ] Estado "Facturada" sincronizado (solo lectura, no dispara)
- [ ] Visibilidad de estado de cobro desde La PyME
