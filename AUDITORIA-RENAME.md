# AUDITORÍA — Rename `proyectos_2026` → `proyectos` y `eventos_2026` → `eventos`

> Fecha: 2026-05-01 — Branch: `claude/intelligent-mclean-e8ddb8` (worktree de rediseno-modulos)
> Solo lectura. No se modificó nada. La data actual es dummy y se descartará.

---

## 1. REFERENCIAS A `proyectos_2026`

### Código JS (CRÍTICO — hay que tocar)

**`api.js`** (6 hits)
- `api.js:96` — `getProjects()`: `.from('proyectos_2026').select('*').eq('_deleted', false)`
- `api.js:327` — métricas dashboard: `.from('proyectos_2026').select('*').eq('_deleted', false).not('responsable', 'in', '("Finalizado","Rechazado")')`
- `api.js:498` — `createProject()`: `UndoHelpers.createRecord('proyectos_2026', payload, …)`
- `api.js:517` — `updateProject()`: `UndoHelpers.updateRecord('proyectos_2026', id, payload, …)`
- `api.js:528` — `deleteProject()`: `UndoHelpers.deleteRecord('proyectos_2026', id, 'Elimino proyecto')`
- `api.js:875` — `getProjectsByClient()`: `.from('proyectos_2026').select('*').ilike('estado', …)`

**`badges.js`** (3 hits — calculadores de alertas)
- `badges.js:99` — comentario: `// NOTA: proyectos_2026 tiene columnas rotadas:`
- `badges.js:147` — `_calculators.proyectos()`: `.from('proyectos_2026').select('id, updated_at, created_at')`
- `badges.js:177` — `_calculators.eventos()`: `.from('proyectos_2026').select('evento_id').in('evento_id', eventoIds)`
- `badges.js:202` — `_calculators.taller()`: `.from('proyectos_2026').select('id').in('evento_id', eventoIds)`
- `badges.js:187` — comentario referencia: `// Columnas: eventos_2026.fecha_armado_inicio, proyectos_2026.evento_id, …`

**`modules.js`** (1 hit — entity config del renderer genérico)
- `modules.js:54` — `projects: { label: 'proyecto', labelPlural: 'proyectos', supabaseTable: 'proyectos_2026' }`

**`inventario.js`** (1 hit)
- `inventario.js:1727` — load proyectos para filtros y modales: `.from('proyectos_2026').select('id, nombre')`

**`finanzas.js`** (1 hit)
- `finanzas.js:2582` — `_proyectosMap` lookup: `.from('proyectos_2026').select('id, nombre')`

### SQL (CRÍTICO — afecta migraciones futuras o re-aplicación)

**`sql/badges_schema_additions.sql`** (5 hits)
- `:7` — `ALTER TABLE proyectos_2026 ADD COLUMN IF NOT EXISTS updated_at …`
- `:19` — `DROP TRIGGER IF EXISTS trg_proyectos_updated_at ON proyectos_2026;`
- `:21` — `BEFORE UPDATE ON proyectos_2026`
- `:26` — `UPDATE proyectos_2026 SET updated_at = created_at WHERE updated_at IS NULL;`

**`sql/inventario_migrations.sql`** (1 hit)
- `:17` — `proyecto_id uuid REFERENCES proyectos_2026(id),` (FK)

**`sql/logistica_module.sql`** (1 hit)
- `:26` — `proyecto_id BIGINT REFERENCES proyectos_2026(id) ON DELETE SET NULL,` (FK)

**`sql/rrhh_tables.sql`** (1 hit — solo comentario, no FK real)
- `:30` — `proyecto_id BIGINT, -- FK a proyectos_2026`

### Documentación (informativo — actualizar al final)

- `CLAUDE.md:245` — tabla "Tablas principales"
- `docs/MEPEX_STACK.md:102` — tabla Supabase
- `docs/AUDITORIA_ESTRATEGICA_2026.md:130, 247, 328`
- `docs/MEPEX_UNDO_SYSTEM.md:633, 695, 790, 796`
- `docs/cotizaciones-upgrade-blueprint.md:13`
- `docs/PROMPT-INVENTARIO-CLAUDE-CODE.md:45, 158`

---

## 2. REFERENCIAS A `eventos_2026`

### Código JS (CRÍTICO — hay que tocar)

**`api.js`** (6 hits)
- `api.js:162` — `getEvents()`: `.from('eventos_2026').select('*').eq('_deleted', false).order('fecha_evento_inicio', …)`
- `api.js:343` — métricas dashboard: `.from('eventos_2026').select('*', { count: 'exact', head: true }).gte('fecha_evento_inicio', …)`
- `api.js:561` — `createEvent()`: `UndoHelpers.createRecord('eventos_2026', payload, …)`
- `api.js:592` — `updateEvent()`: `UndoHelpers.updateRecord('eventos_2026', id, payload, …)`
- `api.js:603` — `deleteEvent()`: `UndoHelpers.deleteRecord('eventos_2026', id, 'Elimino evento')`
- `api.js:907` — `getEventsByNames()`: `.from('eventos_2026').select('*').in('nombre', names)`

**`badges.js`** (3 hits)
- `badges.js:161` — comentario: `// No existe columna equipo_montaje en eventos_2026`
- `badges.js:168` — `_calculators.eventos()`: `.from('eventos_2026').select('id').gte('fecha_armado_inicio', hoy)`
- `badges.js:194` — `_calculators.taller()`: `.from('eventos_2026').select('id').gte('fecha_armado_inicio', hoy)`

**`modules.js`** (1 hit)
- `modules.js:55` — `events: { label: 'evento', labelPlural: 'eventos', supabaseTable: 'eventos_2026' }`

### SQL (CRÍTICO)

**`sql/calendario_operativo_v2.sql`** (10 hits)
- `:9-11` — `ALTER TABLE public.eventos_2026 ADD COLUMN IF NOT EXISTS color/fecha_desarme_fin/notas_operativas`
- `:17, :31, :58, :72` — 4 FKs `evento_id uuid NOT NULL REFERENCES public.eventos_2026(id) ON DELETE CASCADE` en tablas hijas
- `:150` — `DROP TRIGGER IF EXISTS evento_auto_log ON public.eventos_2026;`
- `:152` — `AFTER UPDATE ON public.eventos_2026`

**`sql/eventos_horarios.sql`** (7 hits)
- `:9` — `ALTER TABLE eventos_2026 ADD COLUMN IF NOT EXISTS hora_armado_apertura …` (+ 5 columnas hora más)
- `:18-23` — `COMMENT ON COLUMN eventos_2026.hora_*`

**`sql/logistica_module.sql`** (1 hit)
- `:25` — `evento_id BIGINT REFERENCES eventos_2026(id) ON DELETE SET NULL,` (FK)

**`sql/rrhh_tables.sql`** (1 hit — solo comentario)
- `:29` — `evento_id BIGINT, -- FK a eventos_2026`

### Documentación

- `CLAUDE.md:246`
- `docs/MEPEX_STACK.md:103`
- `docs/AUDITORIA_ESTRATEGICA_2026.md:130, 289`
- `docs/MEPEX_UNDO_SYSTEM.md:676, 789, 795`
- `docs/cotizaciones-upgrade-blueprint.md:14`
- `docs/PROMPT-INVENTARIO-CLAUDE-CODE.md:108`

---

## 3. ARCHIVOS SQL DE CREACIÓN

### ⚠️ NO HAY `CREATE TABLE proyectos_2026` ni `CREATE TABLE eventos_2026` EN EL REPO

Búsqueda exhaustiva en `sql/*.sql` — ningún archivo contiene `CREATE TABLE proyectos_2026` ni `CREATE TABLE eventos_2026`. Las tablas fueron creadas **directamente en la consola de Supabase** (SQL Editor o UI). Solo existen archivos de `ALTER TABLE` posteriores:

| Tabla | Archivos que la modifican |
|-------|--------------------------|
| `proyectos_2026` | `sql/badges_schema_additions.sql` (ADD updated_at + trigger) |
| `eventos_2026`   | `sql/calendario_operativo_v2.sql` (ADD color/fecha_desarme_fin/notas_operativas + trigger), `sql/eventos_horarios.sql` (ADD 6 columnas hora_*) |

**Implicación para el rename:** el `ALTER TABLE … RENAME TO` debe ejecutarse en Supabase directamente. Los SQL del repo son solo migraciones complementarias.

### Tablas hijas con FK a `eventos_2026` o `proyectos_2026`

**Hijas de `eventos_2026`** (definidas en `sql/calendario_operativo_v2.sql`):

| Tabla hija | Línea | FK | Cascade |
|-----------|-------|----|---------| 
| `evento_equipo` | `:17` | `evento_id → eventos_2026(id)` | ON DELETE CASCADE |
| `evento_transporte` | `:31` | `evento_id → eventos_2026(id)` | ON DELETE CASCADE |
| `evento_documentos` | `:58` | `evento_id → eventos_2026(id)` | ON DELETE CASCADE |
| `evento_historial` | `:72` | `evento_id → eventos_2026(id)` | ON DELETE CASCADE |

**Hijas de `proyectos_2026`** (FK definidas en distintos archivos):

| Tabla hija | Archivo:línea | FK | Cascade |
|-----------|---------------|----|---------| 
| `inventario_movimientos` (o tabla similar) | `sql/inventario_migrations.sql:17` | `proyecto_id → proyectos_2026(id)` | sin acción explícita |
| Tabla logística (movimientos/cargas) | `sql/logistica_module.sql:26` | `proyecto_id → proyectos_2026(id)` | ON DELETE SET NULL |

**Hijas con FK a ambas (logística):**
- `sql/logistica_module.sql:25-26` — tabla logística referencia `evento_id → eventos_2026(id)` y `proyecto_id → proyectos_2026(id)`.

**FKs declaradas SOLO como comentario (no constraint real):**
- `sql/rrhh_tables.sql:29-30` — `evento_id` y `proyecto_id` son `BIGINT` sueltos con comentario `-- FK a …`. Sin constraint real, no se rompen al renombrar.

---

## 4. WRAPPERS EN `api.js`

### Funciones que tocan `proyectos_2026`

| Función | Líneas | Operación |
|---------|--------|-----------|
| `getProjects()` | 88-131 | SELECT con cache + mapeo de columnas rotadas |
| `searchProjects(query)` | 133-145 | Filtro in-memory sobre `getProjects()` |
| `getProject(id)` | 147-151 | Find sobre `getProjects()` |
| `createProject(data)` | 486-505 | INSERT vía `UndoHelpers.createRecord` |
| `updateProject(id, data)` | 507-524 | UPDATE vía `UndoHelpers.updateRecord` |
| `deleteProject(id)` | 526-535 | Soft-delete vía `UndoHelpers.deleteRecord` |
| `getProjectsByClient(clientName)` | 870-900 | SELECT con `ilike` sobre `estado` (rotada) |
| Métricas dashboard (inline) | 326-330 | SELECT count para activos |

### Funciones que tocan `eventos_2026`

| Función | Líneas | Operación |
|---------|--------|-----------|
| `getEvents()` | 154-201 | SELECT con cache + mapeo de columnas |
| `searchEvents(query)` | 203-213 | Filtro in-memory sobre `getEvents()` |
| `createEvent(data)` | 538-568 | INSERT vía `UndoHelpers.createRecord` |
| `updateEvent(id, data)` | 570-599 | UPDATE vía `UndoHelpers.updateRecord` |
| `deleteEvent(id)` | 601-610 | Soft-delete vía `UndoHelpers.deleteRecord` |
| `getEventsByNames(names)` | 903-927 | SELECT por array de nombres |
| Métricas dashboard (inline) | 342-346 | SELECT count de eventos próximos |

### ⚠️ MAPEO ROTADO DE COLUMNAS — CRÍTICO PARA EL REDISEÑO

`api.js:104-122` (en `getProjects()`):

```js
// NOTA: columnas rotadas en Supabase —
//   'estado' tiene nombre de cliente,
//   'responsable' tiene estado del proyecto,
//   'empresa' tiene nombre de evento,
//   'n_lote' tiene nombre del responsable.
const mapped = (data || []).map(p => ({
    id: p.id,
    name: p.nombre || '',
    clientName: p.estado || '',     // ← rotada
    status: p.responsable || '',    // ← rotada
    eventName: p.empresa || '',     // ← rotada
    responsible: p.n_lote || '',    // ← rotada
    type: p.tipo || '',
    lote: '', number: '', empresa: '',
}));
```

El mismo mapeo rotado se replica en:
- `api.js:488-496` (`createProject`) — invertido (clientName → estado, etc.)
- `api.js:510-516` (`updateProject`) — invertido
- `api.js:884-895` (`getProjectsByClient`) — directo
- `badges.js:139-150` (`_calculators.proyectos`) — usa `responsable` como estado real
- `badges.js:99-103` — comentario documentando la rotación

> **Recomendación incluida en hallazgos previos (no es parte de esta auditoría):** al renombrar y empezar con data limpia, conviene desrotar las columnas en el nuevo schema y eliminar este workaround. El usuario decide si lo hace en este rename o en una segunda pasada.

---

## 5. STRING TEMPLATES DINÁMICOS

### ¿Hay nombres tipo `proyectos_${año}` o `eventos_${año}` armados dinámicamente?

**NO.** Búsqueda con regex `proyectos_\$\{|eventos_\$\{|\`proyectos_|\`eventos_` arrojó cero coincidencias para nombres de tabla Supabase construidos dinámicamente.

### Falsos positivos detectados (NO son nombres de tabla)

Existen 3 hits con el patrón `proyectos_` pero son **claves de localStorage**, no nombres de tabla Supabase:

- `eventos.js:257` — `localStorage.getItem(\`ev_proyectos_${eventId}\`)`
- `eventos.js:263` — `localStorage.setItem(\`ev_proyectos_${eventId}\`, JSON.stringify(ids))`
- `calendario-operativo.js:216` — `localStorage.getItem(\`ev_proyectos_${e.id}\` || '[]')`

Son cachés locales de "proyectos asignados a un evento" mientras no exista la FK real en Supabase. **No requieren cambio para el rename de tablas.**

### Conclusión

Todos los nombres de tabla Supabase están **hardcodeados como string literal**. El rename es seguro vía búsqueda-y-reemplazo del literal `'proyectos_2026'` → `'proyectos'` y `'eventos_2026'` → `'eventos'`, más los SQL de las tablas hijas.

---

## RESUMEN — Checklist de archivos a tocar para el rename

### JS (8 archivos, ~22 ocurrencias funcionales)
- [ ] `api.js` (12 hits — wrappers + dashboard métricas)
- [ ] `badges.js` (6 hits — calculadores)
- [ ] `modules.js` (2 hits — entityConfig)
- [ ] `inventario.js` (1 hit)
- [ ] `finanzas.js` (1 hit)

### SQL del repo (5 archivos)
- [ ] `sql/badges_schema_additions.sql` (5 hits)
- [ ] `sql/calendario_operativo_v2.sql` (10 hits — incluye 4 FKs de tablas hijas)
- [ ] `sql/eventos_horarios.sql` (7 hits)
- [ ] `sql/inventario_migrations.sql` (1 FK)
- [ ] `sql/logistica_module.sql` (2 FKs)
- [ ] `sql/rrhh_tables.sql` (2 comentarios — sin FK real)

### Supabase (acción manual fuera del repo)
- [ ] `ALTER TABLE proyectos_2026 RENAME TO proyectos;`
- [ ] `ALTER TABLE eventos_2026 RENAME TO eventos;`
- [ ] Las FKs de tablas hijas (`evento_equipo`, `evento_transporte`, `evento_documentos`, `evento_historial`, logística, inventario) se actualizan automáticamente porque PostgreSQL las redirige al nuevo nombre — pero verificar.
- [ ] Triggers (`trg_proyectos_updated_at`, `evento_auto_log`) seguirán funcionando, las referencias internas se actualizan.

### Docs (informativo, hacerlo al final)
- [ ] `CLAUDE.md:245-246`
- [ ] `docs/MEPEX_STACK.md:102-103`
- [ ] `docs/AUDITORIA_ESTRATEGICA_2026.md`, `docs/MEPEX_UNDO_SYSTEM.md`, `docs/cotizaciones-upgrade-blueprint.md`, `docs/PROMPT-INVENTARIO-CLAUDE-CODE.md`

### Sin cambios
- ✓ `eventos.js`, `calendario-operativo.js` — solo usan localStorage keys con prefijo `ev_proyectos_`, no son nombres de tabla.
- ✓ Backend `lobby-api/` — no usa estas tablas (verificado, sin hits).
