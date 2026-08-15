# AUDITORÍA — Fase 2 CRM: vínculo `cotizaciones ↔ eventos/proyectos`

> **Solo lectura.** No se modificó código ni schema. Branch: `claude/amazing-elgamal-7b3b5b` (worktree de `rediseno-modulos`).
> Fecha: 2026-05-02.

---

## 1. TABLA `cotizaciones` — schema real

**Origen del schema:** [sql/pipeline_comercial.sql:24-42](sql/pipeline_comercial.sql:24) (creación). Modificada por:
- [sql/v4_pyme_integration.sql:20-26](sql/v4_pyme_integration.sql:20) — agrega columnas `pyme_*`.
- [sql/pipeline_5_estados.sql:34-36](sql/pipeline_5_estados.sql:34) — re-define el CHECK de `estado` a 5 valores.

### 1.1 Columnas declaradas en SQL del repo

| Columna | Tipo | Nullable | Default | FK / CHECK |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `numero` | text | NOT NULL | — | UNIQUE |
| `cliente_id` | uuid | **NULL** | — | **FK** → `clientes(id) ON DELETE SET NULL` |
| `nombre_evento` | text | NULL | — | — |
| `tipo_evento` | text | NULL | — | — (texto libre: corporativo/social/boda/festival/congreso/feria) |
| `fecha_evento` | date | NULL | — | — |
| `monto_total` | numeric(12,2) | NULL | 0 | — |
| `estado` | text | NOT NULL | `'borrador'` | CHECK ∈ {`borrador`,`enviada`,`en_negociacion`,`aprobada`,`rechazada`} |
| `vendedor_id` | uuid | NULL | — | **NO** tiene FK declarada (comentario: "FK futura a tabla usuarios") |
| `notas_internas` | text | NULL | — | — |
| `created_at` | timestamptz | NOT NULL | `now()` | — |
| `updated_at` | timestamptz | NOT NULL | `now()` | trigger `cotizaciones_updated_at` |
| `pyme_venta_id` | uuid | NULL | — | sin FK |
| `pyme_factura_numero` | text | NULL | — | — |
| `pyme_factura_fecha` | date | NULL | — | — |
| `pyme_total` | numeric(12,2) | NULL | — | — |
| `pyme_balance` | numeric(12,2) | NULL | — | — |
| `pyme_estado_cobro` | text | NULL | NULL | (`pendiente`/`parcial`/`cobrada`) |
| `pyme_last_sync` | timestamptz | NULL | — | — |

### 1.2 Índices declarados

| Índice | Columna |
|---|---|
| `idx_cotizaciones_estado` | `estado` |
| `idx_cotizaciones_cliente` | `cliente_id` |
| `idx_cotizaciones_fecha` | `fecha_evento` |
| `idx_cotizaciones_pyme_venta` | `pyme_venta_id` |

### 1.3 Foco: `cliente_id`, `event_id`, `project_id`

| Columna | ¿En el SQL del repo? | ¿En el código (api.js)? | Estado |
|---|---|---|---|
| `cliente_id` | **Sí** (FK real, nullable, indexada) — [pipeline_comercial.sql:27](sql/pipeline_comercial.sql:27) | Lectura/escritura completa en `getCotizaciones` y `createCotizacion`/`updateCotizacion`. | **OK**. FK ya existe. |
| `event_id` | **NO** existe ningún `ALTER TABLE … ADD COLUMN event_id`. | **api.js lee `c.event_id`** [api.js:1794](api.js:1794) → mapea a `eventId`. **No** se escribe ni en `createCotizacion` ni en `updateCotizacion`. | **Indefinido en este repo.** Si la columna existe físicamente en Supabase es porque la creó el cotizador externo en una migración fuera de este repo (ver §3.4). En ese caso es una columna `uuid` plana **sin FK** a `eventos`. |
| `project_id` | **NO** existe ningún `ALTER TABLE … ADD COLUMN project_id`. | **api.js lee `c.project_id`** [api.js:1793](api.js:1793) → mapea a `projectId`. **No** se escribe ni en `createCotizacion` ni en `updateCotizacion`. Se usa en panel ([crm.js:1890](crm.js:1890), [crm.js:1927-1936](crm.js:1927)) para mostrar "Proyecto vinculado". | Mismo caso que `event_id`. |

### 1.4 Otras columnas que api.js asume y NO están en SQL del repo

api.js [1791-1801](api.js:1791) lee también: `tipo_cotizacion`, `tipo_stand`, `full_state`, `altura`, `superficie`, `pdf_url`, `fecha_emision`, `subtotal`, `iva`, `temperatura`. **Ninguna** aparece en `sql/` del repo. Probable origen: migración del cotizador externo.

> ⚠ Esto significa que el schema "real" de Supabase casi seguro tiene **más** columnas que las del repo. Antes de tocar nada en Fase 2 conviene pedir a Fede el `pg_dump` de la tabla `cotizaciones` o correr en Supabase un `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='cotizaciones';`.

---

## 2. TABLA `clientes` — schema real

### 2.1 Origen del schema

**No hay** `CREATE TABLE clientes` en `sql/` del repo. La tabla preexiste al branch. Sólo encontramos `ALTER TABLE`:

- [sql/badges_schema_additions.sql:34](sql/badges_schema_additions.sql:34) — añade `ultimo_contacto timestamptz DEFAULT NULL`.
- [sql/crm_clientes_columns.sql:10-16](sql/crm_clientes_columns.sql:10) — añade `tipo text DEFAULT ''`, `estado text DEFAULT 'activo'`, `score integer DEFAULT 0`.

### 2.2 Columnas que el código asume (api.js)

A partir de [api.js:36-72](api.js:36) (`getClients`) y [api.js:486-510](api.js:486) (`createClient`):

| Columna física (Supabase) | Tipo | Mapeo lógico en api.js | Notas |
|---|---|---|---|
| `id` | uuid | `id` | PK |
| `nombre_empresa` | text | `name` | OK |
| `razon_social` | text | `razonSocial` | OK |
| `cuit` | text | `cuit` | OK |
| `contacto_empresa` | text | `contactName` | OK |
| `cargo` | text | `contactRole` | OK |
| **`rubro`** | text | **`phone`** ⚠ | ROTADO |
| **`telefono`** | text | **`email`** ⚠ | ROTADO |
| **`correo_electronico`** | text | **`rubro`** ⚠ | ROTADO |
| `tipo` | text | `tipo` | (CRM) |
| `estado` | text | `estado` | (CRM) — `activo`/`lead`/`inactivo` |
| `score` | integer | `score` | (CRM) |
| `ultimo_contacto` | timestamptz | (no leído) | (badges) |
| `_deleted` | boolean | filtrado server-side | soft delete |

### 2.3 ¿Sigue rotada o ya está bien?

**Sigue rotada en producción.** Confirmado por:
- Comentario y mapeo en [api.js:45-58](api.js:45) (`getClients`).
- Mapeo simétrico en escritura [api.js:496-498](api.js:496) (`createClient`) y [api.js:522-524](api.js:522) (`updateClient`).
- Comentario explícito en [api.js:1759](api.js:1759): `// NOTA: columnas rotadas — rubro=phone, telefono=email, correo_electronico=rubro`.

Mapeo real:

```
columna física 'rubro'              → campo lógico 'phone'  (teléfonos)
columna física 'telefono'           → campo lógico 'email'  (emails)
columna física 'correo_electronico' → campo lógico 'rubro'  (rubros)
```

Esto coincide con la nota del `CLAUDE.md` (sección 7, "Bug conocido — columnas rotadas en clientes").

### 2.4 Cantidad de filas / data dummy o real

No se puede contar filas sin tocar Supabase. Hay, al menos, 6 IDs reales referenciados en el seed de cotizaciones ([pipeline_comercial.sql:262-267](sql/pipeline_comercial.sql:262)):

- Águila / ARCOR `5e40ec9a-…`
- A2 Pigment `113d51d5-…`
- Afines `255b47ff-…`
- Agencia Red SRL `7a790c51-…`
- 3punto0 `472eec10-…`
- Adrotrans `8eb9c85e-…`

Por los nombres parece **data real** (clientes históricos), no dummy. Pedir confirmación a Fede o correr `SELECT count(*) FROM clientes WHERE _deleted=false;` antes de cualquier rebuild.

### 2.5 ¿Existe `clientes.js`?

**No.** No hay archivo dedicado. La UI vive en dos lugares:

- **`crm.js`** — tab "Clientes" (default), con su propia tabla, ficha lateral y modal CRUD ([crm.js:481](crm.js:481) `_renderClientesTable`, [crm.js:899](crm.js:899) `_openCreateModal`, [crm.js:991](crm.js:991) `_buildClientForm`).
- **`modules.js`** — renderer genérico, `_entityConfig.clients = { supabaseTable: 'clientes' }` ([modules.js:53](modules.js:53)). Path legacy del lobby cuando se navega a `#clientes:ficha` ([modules.js:431](modules.js:431)).

---

## 3. FORMULARIO ACTUAL DE COTIZACIÓN

### 3.1 ¿Dónde se crea/edita una cotización?

**Sorpresa: dentro del módulo CRM (`crm.js`) NO existe form de "nueva cotización".** El único botón "Nuevo +" del header de CRM ([crm.js:202-205](crm.js:202)) está hardcodeado a "Nuevo cliente" y dispara `_openCreateModal()` ([crm.js:899-931](crm.js:899)) que **siempre** crea un cliente. La etiqueta no cambia entre tabs (es un bug menor de UX a tener en cuenta).

El único form de creación de cotización en todo el repo está en **`modules.js`** (renderer genérico):

- Definición de campos: [modules.js:127-133](modules.js:127) (`_cotizacionFormFields`) — **5 campos**:

  | key | label | type | required | placeholder |
  |---|---|---|---|---|
  | `nombreEvento` | Evento | text | ✅ | "Ej: Expo Alimentek 2026" |
  | `tipoEvento` | Tipo de evento | select | — | feria/congreso/corporativo/social/festival/boda |
  | `fechaEvento` | Fecha del evento | date | — | — |
  | `montoTotal` | Monto total | number | — | "0" |
  | `notasInternas` | Notas internas | text | — | "Observaciones..." |

- Modal de creación: [modules.js:582-627](modules.js:582) (`_openCreateModal('cotizaciones')`) → llama `API.createCotizacion(values)` en línea 615.
- Modal de edición: [modules.js:630-...](modules.js:630) (`_openEditModal`) — usa los mismos `_cotizacionFormFields`.

**Edición desde el panel de CRM:** el botón "Editar" del panel lateral ([crm.js:2232-2235](crm.js:2232)) sólo abre `_editCotNotas(cot)` — un mini-form de **notas internas** y nada más. No edita cliente, evento, monto, fechas, ni vínculos.

### 3.2 ¿Cómo se selecciona el cliente hoy?

**No se selecciona en el form de creación.** `_cotizacionFormFields` no tiene campo `clienteId`/`name`. Por eso `API.createCotizacion(values)` recibe `data.clienteId === undefined` y guarda `cliente_id: null` ([api.js:1840](api.js:1840)).

Las cotizaciones del seed tienen `cliente_id` poblado porque fueron insertadas por SQL directo, no por la app.

### 3.3 ¿Hay algún campo de evento o proyecto en el form?

**No.** Ni en `_cotizacionFormFields` ni en `_editCotNotas`. El field `nombreEvento` es **texto libre** (no selector), y no se vincula a la tabla `eventos`.

### 3.4 Cotizador externo (cotizador-mepex)

Confirmado: **es una app separada que comparte la tabla `cotizaciones`.**

- URL: `http://195.200.1.250/cotizador/` ([data.js:174](data.js:174)). El `CLAUDE.md` menciona también `cotizador-mepex.vercel.app`, hoy hay un único deploy en uso (la IP 195.200…).
- Marcado como `isExternal: true` ([data.js:173](data.js:173)).
- Render en lobby: una card "Cotizador MEPEX V3" con botón "Abrir Cotizador" que hace `target="_blank"` ([modules.js:329-339](modules.js:329)). **No hay iframe ni embed**.
- Se confirma que el cotizador escribe `tipo_cotizacion`, `tipo_stand`, `full_state`, `altura`, `superficie`, `pdf_url`, `fecha_emision`, `subtotal`, `iva`, `project_id`, `event_id` (api.js los **lee** pero ninguna migración del repo los crea).

> Implicancia: cualquier cambio de schema sobre `cotizaciones` (agregar FK, NOT NULL, renames) tiene que ser **coordinado con el repo del cotizador**. El cotizador no se va a enterar solo.

---

## 4. CARDS DEL KANBAN — qué muestran hoy

Función: [crm.js:1281-1307](crm.js:1281) (`_renderPipelineCard`).

Datos visibles en cada card:

| Slot | Campo | Línea |
|---|---|---|
| Top-left | `cot.numero` | 1291 |
| Top-right | `cot.temperatura` (icono Hot/Warm/Cold) | 1292 |
| Línea 2 | `cot.clienteNombre` | 1294 |
| Línea 3 | `cot.nombreEvento` (**texto libre, no link al evento**) | 1295 |
| Línea 4 | `cot.tipoEvento` (chip) | 1296 |
| Bottom-left | `cot.montoTotal` | 1298 |
| Bottom-right | días desde `createdAt` + initial del vendedor | 1299-1302 |
| Footer | `cot.notasInternas` (truncado a 60 chars) | 1304 |

### ¿Muestra evento/proyecto vinculado?

- **Card del kanban: NO.** Sólo el string libre `nombreEvento`.
- **Tabla del pipeline:** [crm.js:1378-1387](crm.js:1378). Mismo caso: `cot.nombreEvento` y `cot.tipoEvento` como texto. No usa `eventId` ni `projectId`.
- **Panel lateral, sub-tab Resumen:** [crm.js:1927-1936](crm.js:1927). **Sí muestra "Proyecto vinculado"** cuando `cot.projectId` matchea un proyecto en `this._projects`. **NO muestra evento vinculado** (sólo el texto libre).

### ¿Dónde habría que agregarlo?

- **Card del kanban** ([crm.js:1294-1296](crm.js:1294)): reemplazar/complementar `nombreEvento` libre con un chip `<a href="#eventos:ficha?id=…">` cuando `cot.eventId` existe; idem para proyecto.
- **Panel Resumen** ([crm.js:1916-1924](crm.js:1916)): agregar bloque "Evento vinculado" simétrico al de "Proyecto vinculado" ya existente.
- **Tabla del pipeline** ([crm.js:1380-1382](crm.js:1380)): igual.

---

## 5. WRAPPERS `API.cotizaciones`

Todos en `api.js`:

| Función | Líneas | JOIN o 2-query | Mapea `event_id` / `project_id`? |
|---|---|---|---|
| `getCotizaciones()` | [1731-1820](api.js:1731) | **2-query strategy.** Query 1: `from('cotizaciones').select('*').eq('_deleted', false)`. Query 2: `from('clientes').select('id, nombre_empresa, contacto_empresa, rubro, telefono, correo_electronico')` filtrando por los `cliente_id` únicos. Build de un `clientMap` y mapeo manual ([1750-1769](api.js:1750)). **No** hace JOIN nativo de PostgREST porque "las columnas de clientes están rotadas" (comentario [1740](api.js:1740)). | Sí, ambos: `c.event_id → eventId`, `c.project_id → projectId` ([1793-1794](api.js:1793)). |
| `createCotizacion(data)` | [1822-1856](api.js:1822) | Single insert vía `UndoHelpers.createRecord('cotizaciones', payload, …)`. Genera `numero` auto-incremental con un SELECT previo ([1825-1836](api.js:1825)). | **No.** El payload no incluye `event_id` ni `project_id` (sólo `cliente_id`, `nombre_evento`, `tipo_evento`, `fecha_evento`, `monto_total`, `estado`, `vendedor_id`, `notas_internas`). |
| `updateCotizacion(id, data)` | [1934-1956](api.js:1934) | `UndoHelpers.updateRecord` plano. | **No.** El whitelist de campos editables ([1937-1948](api.js:1937)) cubre `nombreEvento`, `tipoEvento`, `fechaEvento`, `montoTotal`, `notasInternas`, `clienteId`, `vendedorId`, `tipoStand`, `superficie`, `pdfUrl`, `subtotal`, `iva`. **No** acepta `eventId` ni `projectId`. |
| `updateCotizacionEstado(id, estado)` | [1858-1867](api.js:1858) | `UndoHelpers.changeStatus`. | n/a |
| `deleteCotizacion(id)` | [1958-1967](api.js:1958) | `UndoHelpers.deleteRecord` (soft delete). | n/a |
| `addCotizacionTimeline(cotId, tipo, desc, meta)` | [1869-1887](api.js:1869) | Insert directo en `cotizacion_timeline`. | n/a |
| `getCotizacionTimeline(cotId)` | [1911-1931](api.js:1911) | Select directo, ordenado desc. | n/a |
| `getAllTimeline(limit=200)` | [1889-1909](api.js:1889) | Select directo limitado. | n/a |
| `syncFromPyME(cotizaciones)` | [2067-2188](api.js:2067) | Pagina `/sales` de La PyME, matchea por `customer.name` ↔ `clienteNombre`, hace `update` directo de columnas `pyme_*`. | n/a |
| `getEmailTemplates()` / CRUD de templates | [1969-…](api.js:1969) | Selects/updates planos. | n/a |

> Nota: el comment de [api.js:1740](api.js:1740) ("Query cotizaciones sin join") asume que el motivo es la rotación de `clientes`. Si la rotación se arreglara primero (sub-fase aparte), se podría volver a un `select('*, clientes(*)')` y reducir el chatter.

---

## 6. FILTROS INERTES (deuda detectada en Fase 1.5)

Las propiedades viven en `modules.js`, NO en `crm.js`:

- Declaración: [modules.js:25-26](modules.js:25) (dentro del objeto `Modules`).
  ```
  _activeCotClienteFilter: [],
  _activeCotEventoFilter: [],
  ```
- Lectura: [modules.js:4048-4049](modules.js:4048) (`_getMultiFilterArray('cot_cliente' / 'cot_evento')`).
- Escritura: [modules.js:4057-4058](modules.js:4057) (`_setMultiFilterArray`).

**Ningún otro consumidor.** `crm.js` no las menciona. No hay UI (`<select multiple>`, dropdown ni chip) que las pueble, y `_applyAllFilters()` ([modules.js:~3900-…](modules.js)) no les aplica. Son **state placeholders dejados a medio camino** del CRM paralelo de `modules.js` que ya fue reportado en `AUDITORIA-MODULES-CRM-PARALELO.md` y `TODO-FASE1-CRM-RESIDUOS.md`.

**Acción Fase 2:** se pueden borrar las cuatro líneas. Cero impacto runtime.

---

## 7. INVENTARIO DE EVENTOS Y PROYECTOS DISPONIBLES

### 7.1 Eventos

- Tabla limpia post-rename: [sql/rename_proyectos_eventos.sql:27-48](sql/rename_proyectos_eventos.sql:27).
- PK uuid, columna `nombre text NOT NULL`, fechas de armado/evento/desarme, `predio`, `color`, `notas_operativas`.
- Wrapper: [api.js:216-263](api.js:216) (`getEvents`). Mapea a `{ id, name, venue, setupDate, eventStartDate, … }`. Cache de 60s.
- **Cantidad de filas:** no se puede contar sin tocar Supabase. El `CLAUDE.md` (sección 10) menciona "data dummy o real" sin precisar. Pedir a Fede.
- ¿Bug residual del rename? **No se observa** en el código actual de `getEvents`. Lee `from('eventos')`, no de `eventos_2026`. La auditoría previa [AUDITORIA-RENAME.md] daba estos hits como ya migrados.

### 7.2 Proyectos

- Tabla limpia post-rename: [sql/rename_proyectos_eventos.sql:67-91](sql/rename_proyectos_eventos.sql:67).
- PK uuid, `nombre text NOT NULL`, FKs reales a `clientes(id)`, `eventos(id)`, `profiles(id)`.
- Wrapper: [api.js:155-193](api.js:155) (`getProjects`). Mapea a `{ id, name, clientId, eventoId, responsableId, estado, tipo, fechaInicio, fechaFin, notas }`.
- **Cantidad de filas:** sin contar.
- ¿Bug residual? Idem eventos. El `searchProjects` ([api.js:200-203](api.js:200)) chequea `p.clientName`/`p.eventName` que **no se mapean** en `getProjects` — siempre dan `undefined`, así que la búsqueda por nombre de cliente/evento desde proyectos está rota silenciosamente. **No es de Fase 2** pero conviene anotarlo.

### 7.3 ¿Sirven los datos limpios para selectores?

Sí. `API.getEvents()` y `API.getProjects()` ya devuelven `[{ id, name, … }]` listos para alimentar `<select>` o autocomplete. **Caveat:** ambos hacen 1 query a Supabase y cachean 60s — para selector con autocomplete por teclado eso está bien. Si el set crece a >500 eventos, conviene paginar.

---

## 8. RIESGOS Y DECISIONES PENDIENTES

### 8.1 Rotación de columnas en `clientes` — ¿Fase 2 o sub-fase aparte?

**Recomendación: sub-fase aparte ANTES de Fase 2.**

Razones:
- La rotación está enredada con escritura (`createClient`/`updateClient` también rotan), no sólo lectura. Un `RENAME COLUMN` requiere coordinar el SQL + 4 funciones de api.js + posibles consumidores fuera (cotizador, La PyME).
- Mientras siga rotada, agregar el selector de cliente al form de cotización funciona bien (api.js ya devuelve `name` correcto), pero complica cualquier `JOIN` futuro entre `cotizaciones` y `clientes`.
- El alcance de Fase 2 (FK + selector + chip en card) **no necesita** que la rotación esté arreglada. Se puede dejar para una Fase 2.5.

### 8.2 Cotizador externo escribiendo `event_id` / `project_id`

**Riesgo alto.** Antes de agregar la FK necesitamos saber:

1. ¿La columna `event_id` existe físicamente en Supabase? Si no, el cotizador tampoco la llena.
2. Si existe, ¿es `uuid` o `text`? Si fue creada como `text` por el cotizador, un `ALTER COLUMN … TYPE uuid USING event_id::uuid` puede fallar si hay valores no-UUID (slugs, números, etc.).
3. ¿Hay registros con `event_id` apuntando a un evento que ya no existe (huérfanos)? Una FK con `ON DELETE SET NULL` se puede crear `NOT VALID` y limpiar antes de validar; mejor que `NOT VALID` directo.

**Mitigación sugerida:**
```sql
-- Diagnóstico previo (correr en Supabase, NO ejecutar ahora):
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'cotizaciones'
   AND column_name IN ('event_id','project_id');

SELECT count(*) FILTER (WHERE event_id IS NOT NULL)   AS con_event_id,
       count(*) FILTER (WHERE project_id IS NOT NULL) AS con_project_id,
       count(*)                                        AS total
  FROM cotizaciones;

-- Huérfanos (FK candidata):
SELECT c.id, c.numero, c.event_id
  FROM cotizaciones c
  LEFT JOIN eventos e ON e.id = c.event_id
 WHERE c.event_id IS NOT NULL AND e.id IS NULL;

SELECT c.id, c.numero, c.project_id
  FROM cotizaciones c
  LEFT JOIN proyectos p ON p.id = c.project_id
 WHERE c.project_id IS NOT NULL AND p.id IS NULL;
```

Si aparecen huérfanos: `UPDATE cotizaciones SET event_id = NULL WHERE event_id NOT IN (SELECT id FROM eventos);` antes de la FK.

Si las columnas no existen físicamente: **agregarlas** (`ADD COLUMN event_id uuid`) + comunicar al equipo del cotizador para que las llene en escritura.

### 8.3 Coordinación con el repo del cotizador

Cualquier cambio que agregue `NOT NULL` o restrinja tipos en `cotizaciones` puede romper el cotizador silenciosamente. Para Fase 2:

- **Mantener `event_id` y `project_id` nullable** (no hay NOT NULL).
- **`ON DELETE SET NULL`** en ambas FKs, no `RESTRICT`, para que borrar un evento/proyecto no rompa cotizaciones históricas.
- Avisar al equipo del cotizador antes de mergear.

### 8.4 Form de creación de cotización

`_cotizacionFormFields` está en `modules.js`, no en `crm.js`. Hay dos opciones para agregar los selectores:

- **A.** Tocar `modules.js` y agregar tres campos (`clienteId`, `eventId`, `projectId`) como `type: 'select'` con datos de `API.getClients/getEvents/getProjects`. Esto requiere que `FormBuilder.render` soporte selects con opciones dinámicas (verificar antes en `components.js`).
- **B.** Mover el form de creación a `crm.js`, simétrico al `_buildClientForm` que ya existe. Más alineado con el rediseño (`modules.js` es legacy).

Recomendación: **B**, pero si se hace **A** primero como parche, hay que recordar que el botón "Nuevo +" del header de CRM (`crmBtnNew`) sigue creando clientes — habría que decidir si:
- (i) cambia el label/acción según el tab activo, o
- (ii) cada tab tiene su propio botón "Nuevo".

### 8.5 Filtros inertes (§6)

Borrar las 4 líneas en `modules.js` es trivial. Hacerlo en el mismo PR de Fase 2 ayuda a no arrastrar deuda visible.

---

## 9. RESUMEN EJECUTIVO

| Tema | Estado | Acción Fase 2 |
|---|---|---|
| `cotizaciones.cliente_id` | FK real, indexada, nullable | nada |
| `cotizaciones.event_id` | columna no declarada en repo, leída por api.js, **escrita por cotizador externo** | crear FK (después de diagnóstico §8.2) |
| `cotizaciones.project_id` | idem | idem |
| Form de "nueva cotización" | en `modules.js`, 5 campos texto, **sin cliente/evento/proyecto** | agregar 3 selects |
| Card kanban | sólo texto libre `nombreEvento` | mostrar chip "Evento" y/o "Proyecto" vinculado |
| Panel Resumen | ya muestra "Proyecto vinculado", **falta "Evento vinculado"** | agregar bloque simétrico |
| `getCotizaciones` 2-query | OK por rotación de `clientes` | nada |
| `createCotizacion` payload | no envía event_id/project_id | extender payload |
| `updateCotizacion` whitelist | no acepta event_id/project_id | extender whitelist |
| Filtros inertes (`_activeCotClienteFilter`, `_activeCotEventoFilter`) | declarados pero sin UI ni aplicación | borrarlos |
| Rotación de columnas en `clientes` | sigue activa | **no** tocar en Fase 2 (sub-fase aparte) |
| Cotizador externo | comparte tabla, escribe campos no declarados en repo | coordinar antes de FK / NOT NULL |
