# MÓDULO EVENTOS — BLUEPRINT
## Sistema de Gestión MEPEX

---

## 1. VISIÓN GENERAL

El módulo Eventos es la BASE DE DATOS MAESTRA de todos los eventos en los que MEPEX participa. Toda la información operativa de un evento nace y se edita acá. El calendario operativo CONSUME estos datos pero no los modifica.

**Regla fundamental:** Si un dato aparece en el calendario, en un proyecto, o en logística, su fuente de verdad es la ficha del evento en este módulo.

**Usuarios:** Fede, Lelean (gestión general), PMs (logística de sus eventos), Noe (vista comercial).

---

## 2. PANTALLA PRINCIPAL — LISTA DE EVENTOS

Tabla compacta con todos los eventos. Columnas personalizables:

| Columna | Descripción |
|---------|-------------|
| Nombre del evento | Nombre completo |
| Locación/Predio | Dónde se realiza |
| Fecha evento inicio | Primer día de funcionamiento |
| Fecha evento fin | Último día de funcionamiento |
| Fecha armado | Cuándo se monta |
| Fecha desarme | Cuándo se desmonta |
| Proyectos MEPEX | Cantidad de proyectos vinculados (badge) |
| Estado | Próximo / En curso / Finalizado / Cancelado |


**Funcionalidades:**
- Filtros: por estado, por predio, por rango de fechas
- Búsqueda por nombre de evento
- Ordenar por cualquier columna
- Toggle vista: tabla / tarjetas
- Botón "Nuevo evento"
- Color de fila según estado: próximo (cyan), en curso (verde), finalizado (gris), cancelado (rojo tenue)

---

## 3. FICHA DE EVENTO (side panel o página completa)

Al hacer clic en un evento, se abre su ficha completa. TODA la info se edita acá.
Cada sección tiene su propio botón Editar (lápiz) que convierte esa sección en formulario.

### 3.1 HEADER
- Nombre del evento (editable)
- Locación/predio (editable)
- Estado: Próximo / En curso / Finalizado / Cancelado (dropdown)
- Color asignado (el mismo que usa el calendario)

### 3.2 FECHAS (sección editable)
- Armado: fecha inicio — fecha fin
- Funcionamiento: fecha inicio — fecha fin
- Desarme: fecha inicio — fecha fin
- Date pickers para cada una
- Al guardar → el calendario se actualiza automáticamente

### 3.3 PROYECTOS MEPEX EN ESTE EVENTO
- Tabla de proyectos vinculados:
  - Cliente | Tipo | PM | Estado (badge)
- Botón "Vincular proyecto" → buscador/dropdown de proyectos existentes
- Botón "Desvincular" por fila (con confirmación)
- Click en proyecto → link a ficha del proyecto
- Los proyectos NO se crean acá, se crean en el módulo Proyectos y acá se vinculan

### 3.4 LOGÍSTICA — EQUIPO ASIGNADO (sección editable)
- Botón Editar (lápiz) → formulario:
  - Lista de personas, cada una con:
    - Selector de persona (dropdown buscador en lista de empleados RRHH)
    - Selector de rol: Supervisor / Montajista / Electricista / Chofer / Auxiliar
    - Botón eliminar (X)
  - Botón "+ Agregar persona"
  - Botón "+ Agregar eventual" → input manual nombre + rol (para gente no registrada)
  - Guardar / Cancelar
- En modo vista: tabla compacta nombre | rol

### 3.5 LOGÍSTICA — TRANSPORTE (sección editable)
- Botón Editar (lápiz) → formulario:
  - Camión: input texto o selector
  - Chofer: selector de persona o input manual
  - Fecha/hora de carga en depósito: datetime picker
  - Fecha/hora de salida a predio: datetime picker
  - Fecha/hora de retorno: datetime picker
  - Guardar / Cancelar
- En modo vista: datos compactos

### 3.6 CONFLICTOS DETECTADOS (automático, no editable)
- Se calcula cruzando:
  - Personal de este evento vs otros eventos en fechas superpuestas
  - Camión de este evento vs otros eventos en fechas superpuestas
- Warning naranja con detalle: "Carlos Pérez también asignado a ArquiExpo (16/3-24/3)"
- Si no hay conflictos: la sección no aparece

### 3.7 DOCUMENTOS (sección editable)
- Lista de documentos vinculados:
  - Ícono tipo + nombre + botón descargar + botón eliminar
- Botón "+ Subir documento":
  - Selector de tipo: Plano del predio / Reglamento / Manual del expositor / Seguro / Acreditación / Otro
  - File picker (PDF, JPG, PNG, DOC)
  - Upload a Supabase Storage → carpeta por evento_id
  - Aparece en la lista inmediatamente

### 3.8 SEGUROS Y ACREDITACIONES
- Contenedor simple para hasta 5 archivos PDF
- Botón "+ Subir seguro/acreditación" → file picker (PDF)
- Upload a Supabase Storage, misma carpeta del evento
- Cada archivo muestra: nombre + botón descargar + botón eliminar
- Sin categorías ni checklist, solo archivos cargados
- Límite visible: "X/5 cargados"

### 3.9 NOTAS OPERATIVAS
- Textarea siempre editable
- Auto-save al perder foco (indicador "Guardado ✓")

---

## 4. ESTRUCTURA DE DATOS (SUPABASE)

### Tabla: eventos (ampliar existente)
```sql
- id (uuid, PK)
- nombre
- locacion
- estado (proximo/en_curso/finalizado/cancelado)
- color (hex, asignado automáticamente)
- fecha_armado_inicio, fecha_armado_fin
- fecha_evento_inicio, fecha_evento_fin
- fecha_desarme_inicio, fecha_desarme_fin
- notas_operativas (text)
- created_at, updated_at
```

### Tabla: evento_equipo (NUEVA)
```sql
- id (uuid, PK)
- evento_id (FK a eventos)
- persona_id (FK a empleados, nullable — null si es eventual)
- nombre_manual (text, para eventuales)
- rol_operativo (supervisor/montajista/electricista/chofer/auxiliar)
- orden (int, para ordenar la lista)
- created_at
```

### Tabla: evento_transporte (NUEVA)
```sql
- id (uuid, PK)
- evento_id (FK a eventos)
- camion (text)
- chofer_nombre (text)
- chofer_id (FK a empleados, nullable)
- fecha_carga (timestamp)
- fecha_salida (timestamp)
- fecha_retorno (timestamp)
- created_at, updated_at
```

### Tabla: evento_documentos (NUEVA)
```sql
- id (uuid, PK)
- evento_id (FK a eventos)
- tipo (plano/reglamento/manual/seguro_acreditacion/otro)
- nombre_archivo (text)
- storage_path (text — ruta en Supabase Storage)
- uploaded_at (timestamp)
- uploaded_by (FK a users)
```

Nota: seguros y acreditaciones se guardan en la misma tabla evento_documentos con tipo "seguro_acreditacion". Límite de 5 archivos de este tipo por evento (validar en frontend).

### Supabase Storage
- Bucket: "evento-documentos"
- Estructura: /evento-documentos/{evento_id}/{archivo}

---

## 5. CONEXIONES CON OTROS MÓDULOS

### Eventos → Calendario
- El calendario LEE de la tabla eventos (fechas, nombre, locación, color)
- LEE de evento_equipo y evento_transporte para mostrar en el side panel (SOLO LECTURA)
- LEE de evento_documentos para mostrar links
- El calendario NUNCA escribe datos, solo los muestra

### Eventos → Proyectos
- Relación muchos a muchos: un evento tiene múltiples proyectos, un proyecto pertenece a un evento
- La vinculación se hace desde la ficha del evento O desde la ficha del proyecto
- El evento solo aparece en el calendario si tiene al menos 1 proyecto confirmado

### Eventos → RRHH/Equipo
- evento_equipo referencia a la tabla de empleados
- Permite ver carga de trabajo por persona (en cuántos eventos está)
- Detecta conflictos de superposición

### Eventos → Logística
- evento_transporte gestiona camiones y horarios
- Detecta conflictos de vehículos

### Eventos → Ventas (solo lectura)
- Desde Ventas se puede ver a qué evento está vinculada una cotización
- Los eventos no se crean desde Ventas

---

## 6. DISEÑO UX/UI

- Dark theme MEPEX consistente
- Tipografía compacta (14px base)
- Side panel para ficha de evento (misma mecánica que Ventas)
- Botones editar (lápiz) discretos, aparecen al hover sobre la sección
- Al editar: fondo de sección cambia sutilmente (más claro) para indicar modo edición
- Guardar en cyan, Cancelar en gris
- Tabla principal con misma mecánica de columnas personalizables que Ventas

---

## 7. PRIORIDAD DE IMPLEMENTACIÓN

### V1 (AHORA):
- [ ] Tabla de eventos con filtros, búsqueda, ordenamiento
- [ ] Ficha de evento con todas las secciones
- [ ] Edición por sección (botón lápiz)
- [ ] Vinculación de proyectos
- [ ] Equipo asignado (desde lista RRHH + eventuales manuales)
- [ ] Transporte con horarios
- [ ] Upload de documentos a Supabase Storage
- [ ] Seguros y acreditaciones
- [ ] Notas operativas con auto-save
- [ ] Detección de conflictos automática

### V2 (PRÓXIMO):
- [ ] Calendario consume datos reales del módulo Eventos
- [ ] Vista de tarjetas alternativa
- [ ] Historial de cambios por evento (quién modificó qué)

### V3 (FUTURO):
- [ ] Checklist de materiales vinculado a inventario
- [ ] Presupuesto operativo por evento
- [ ] Galería de fotos del evento (post-evento)
- [ ] Encuesta de satisfacción vinculada
