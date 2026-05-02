# TODO POST-RENAME — Deuda técnica que quedó pendiente tras el refactor de tablas

> **Contexto:** este archivo se generó tras el commit que renombró `proyectos_2026 → proyectos` y `eventos_2026 → eventos`, fixeó las columnas rotadas en proyectos y agregó FKs reales (`cliente_id`, `evento_id`, `responsable_id`).
>
> Todos los lugares listados acá quedaron leyendo/escribiendo contra **claves del modelo viejo** (`clientName`, `eventName`, `responsible`, `status`) que ya **no existen** en el objeto que devuelve `API.getProjects()`. Hasta que se migren, estos módulos van a mostrar `—` o cadenas vacías donde antes había datos.
>
> No se arreglan ahora — son parte de la Fase 5 del CRM (rediseño de la cadena Cliente↔Evento↔Proyecto basada en FK reales).

---

## 1. Usos pendientes de `project.clientName`

Antes venía del workaround rotado (columna `estado`). Ahora hay que resolver via lookup `clientId → API.getClient(clientId).name`.

| Archivo | Línea | Contexto |
|---------|------:|----------|
| [api.js](api.js:135) | 135 | `searchProjects()` filtra por `p.clientName` (queda muerto) |
| [eventos.js](eventos.js:1396) | 1396, 1408, 1410 | Modal "vincular proyecto a evento" — listado de resultados |
| [crm.js](crm.js:288) | 288, 721, 2396, 2471, 2544 | Match cliente↔proyecto por nombre (varias secciones del CRM) |
| [modules.js](modules.js:2245) | 2245, 2590, 2951, 4406 | Renderer genérico de tabla/ficha de proyectos |
| [proyectos.js](proyectos.js:229) | 229, 360, 394, 514, 580, 909 | Módulo Proyectos (search, tabla, cards, ficha, form) |
| [taller.js](taller.js:250) | 250, 317 | Cards y meta de proyectos en taller |

**Cómo migrar (referencia):** cargar `_clientesMap = { id → name }` al inicio del módulo y reemplazar `p.clientName` por `_clientesMap[p.clientId] || '—'`.

---

## 2. Usos pendientes de `project.eventName`

Antes venía del workaround rotado (columna `empresa`). Ahora hay que resolver via lookup `eventoId → API.getEvent(eventoId).name`.

| Archivo | Línea | Contexto |
|---------|------:|----------|
| [api.js](api.js:136) | 136 | `searchProjects()` filtra por `p.eventName` |
| [modules.js](modules.js:2588) | 2588, 2952, 3560, 3719, 4380 | Renderer genérico (tabla, ficha, mini cards, filtro por evento) |
| [proyectos.js](proyectos.js:185) | 185, 217, 230, 361, 395, 420, 555, 604, 897 | Módulo Proyectos completo (filtros, tabla, ficha, form, vinculación a evento por nombre) |
| [taller.js](taller.js:140) | 140, 142, 254, 321 | `_findEventForProject()` matchea por nombre — debería usar `proyecto.evento_id` |

**Caso especial:** [proyectos.js:555](proyectos.js:555) y [taller.js:140-142](taller.js:140) buscan el evento por **nombre** dentro del array local. Con la nueva FK `evento_id` el lookup es directo: `_eventsMap[p.eventoId]`.

---

## 3. Usos pendientes de `project.responsible` / `project.responsibles`

Antes venía del workaround rotado (columna `n_lote`). Ahora hay que resolver via lookup `responsableId → API.getProfile(responsableId).name`.

| Archivo | Línea | Contexto |
|---------|------:|----------|
| [lobby.js](lobby.js:192) | 192 | "Mis proyectos" — match por nombre del usuario |
| [modules.js](modules.js:2246) | 2246, 2592, 3721 | Renderer genérico — columna responsable + cards |
| [proyectos.js](proyectos.js:152) | 152, 198, 220, 231, 363, 397, 613, 615, 926 | Módulo Proyectos — soporte multi-responsable (`p.responsibles`), filtro, badges, form |

**Nota multi-responsable:** [proyectos.js:152](proyectos.js:152) parsea `p.responsible` como string multi-valor (`"Leo, Meli"`). El nuevo schema sólo tiene `responsable_id` (uuid único). Si se quiere preservar multi-responsable hay que agregar tabla puente `proyecto_responsables (proyecto_id, profile_id)`.

---

## 4. Usos pendientes de `project.status` (renombrado a `project.estado`)

El nuevo mapping en `api.js:getProjects()` devuelve `estado` (no `status`). Toda lectura de `p.status` queda en `undefined` hasta migrar.

| Archivo | Líneas | Contexto |
|---------|--------|----------|
| [api.js](api.js:137) | 137, 397 | `searchProjects()`, search global |
| [crm.js](crm.js:831) | 831, 1942 | Badges de estado del proyecto |
| [calendario-operativo.js](calendario-operativo.js:989) | 989 | Tabla de stands |
| [eventos.js](eventos.js:633) | 633, 1408 | Lista proyectos vinculados al evento |
| [lobby.js](lobby.js:138) | 138, 194, 209, 354 | KPIs de proyectos activos |
| [modules.js](modules.js:875) | 875, 2243, 2580, 2586, 2920, 3526, 3561, 3716, 4409-4410 | Renderer genérico (sort, badge, mini-stats, ficha) |
| [taller.js](taller.js:117) | 117 | Filtro de proyectos en taller |
| [proyectos.js](proyectos.js:214) | 214, 352, 362, 386, 392, 508, 518, 554, 565, 584, 921 | Módulo Proyectos (filtros, badges, form) |

**Migración trivial:** find/replace `p.status` → `p.estado` en estos archivos. Los valores de estado siguen siendo strings — el rename solo cambia la key de salida.

---

## 5. Callers de `API.getProjectsByClient()` — cambio de signature

La función ahora recibe `clientId: uuid`, **no** `clientName: string`. Los callers pasan nombres:

| Archivo | Línea | Pasa actualmente | Acción |
|---------|------:|------------------|--------|
| [modules.js](modules.js:3516) | 3516 | `API.getProjectsByClient(item.name)` ❌ | Pasar `item.id` |
| [modules.js](modules.js:3689) | 3689 | `API.getProjectsByClient(item.name)` ❌ | Pasar `item.id` |

Ambos callers están en el módulo Clientes (renderer genérico, ficha de cliente). Con FK real `proyectos.cliente_id` el cambio es de una línea por sitio.

**Hasta que se arreglen, ambos devuelven `[]`** porque están consultando contra `cliente_id = "Cliente XYZ"` (string que no es uuid).

---

## 6. Schema de eventos — columnas que cambiaron y NO se actualizaron en api.js

El nuevo `CREATE TABLE eventos` en `sql/rename_proyectos_eventos.sql` introduce cambios de nombres de columna que **NO** se reflejaron en `api.js` (no estaban en el alcance del prompt). Después de aplicar el SQL en Supabase, las siguientes operaciones romperán o devolverán null:

| api.js | Líneas | Columna vieja | Columna nueva | Impacto |
|--------|--------|---------------|---------------|---------|
| `getEvents()` | 169, 928 | `e.lugar` | `e.predio` | `event.venue` queda `''` |
| `getEvents()` | 174-175 | `e.fecha_desarme` | `e.fecha_desarme_inicio` | `event.teardownDate` queda `null` |
| `getEvents()` | 185 | `e.prioridad` | (eliminada) | `event.priority` queda `''` |
| `getEvents()` | 191 | `e.estado` | (eliminada) | `event.status` queda `''` |
| `createEvent()` | 583, 588, 599 | `payload.lugar`, `payload.fecha_desarme`, `payload.prioridad` | `predio`, `fecha_desarme_inicio`, (n/a) | `INSERT` falla con "column does not exist" |
| `updateEvent()` | similar | similar | similar | `UPDATE` falla |

**Acción requerida (no incluida en este commit):**
1. En `getEvents()` mapping: `e.lugar → e.predio`, `e.fecha_desarme → e.fecha_desarme_inicio`. Eliminar `priority` y `status` del modelo (o decidir dónde van).
2. En `createEvent()` / `updateEvent()` payload: `lugar → predio`, `fecha_desarme → fecha_desarme_inicio`. Quitar `prioridad` y `estado`.
3. Auditar todos los usos de `event.venue`, `event.priority`, `event.status` en otros módulos (calendar.js, calendario-operativo.js, eventos.js, lobby.js).

---

## 7. localStorage de eventos.js que sigue vivo (deuda anterior, no agravada)

Estos hits ya estaban documentados en `AUDITORIA-RENAME.md` § Parte 5 — **no tocar ahora**:

- [eventos.js:257, 263](eventos.js:257) — `localStorage.getItem('ev_proyectos_${eventId}')`
- [calendario-operativo.js:216](calendario-operativo.js:216) — mismo localStorage

Son cachés locales de "qué proyectos están vinculados a un evento". Ahora que existe la FK real `proyectos.evento_id`, este localStorage es redundante y debería eliminarse cuando se refactorice el módulo Eventos.

---

## 8. Resumen — prioridad sugerida para Fase 5

1. **Crítico (rompe operativa diaria):**
   - § 5: callers de `getProjectsByClient` (2 sitios, fix trivial). Sin esto, ficha de cliente no muestra proyectos.
   - § 6: api.js `createEvent` / `updateEvent` (CRUD de eventos roto post-aplicación del SQL).

2. **Alto (UI rota silenciosamente):**
   - § 4: rename de `p.status → p.estado` (find/replace masivo, ~30 sitios).
   - § 6: lectura de `event.venue` / `event.priority` / `event.status` post-rename de columnas.

3. **Medio (deuda de modelo):**
   - § 1, § 2, § 3: lookups `clientId/eventoId/responsableId → name` en módulos Proyectos, CRM, Eventos, Taller, Lobby.
   - Decidir si se preserva multi-responsable (tabla puente) o se simplifica a único.

4. **Bajo:**
   - § 7: limpiar localStorage `ev_proyectos_*` cuando se refactorice eventos.js.

---

**Última verificación de scope:** búsqueda `proyectos_2026|eventos_2026` en `*.js` → 0 hits.
