# AUDITORÍA — Integraciones del módulo Eventos con RRHH y Logística

**Fecha:** 2026-05-01
**Branch:** `claude/romantic-gould-e3ef2f` (worktree de `rediseno-modulos`)
**Modo:** solo lectura. No se modificó código ni schema.

---

## 1. EVENTOS — ESTADO ACTUAL

### 1.1 `eventos.js`

- **Objeto global:** `EventosModule` ([eventos.js:10](eventos.js:10))
- **Tabs:** **no usa pestañas**. Tiene un toggle de view (`_viewMode`: `'table'` | `'cards'`, [eventos.js:20](eventos.js:20)). La detalle se abre como **panel lateral**, no como tab.
- **Ficha del evento:**
  - Renderizada en un **panel lateral** (`<div class="ev-side-panel" id="evSidePanel">`, [eventos.js:119](eventos.js:119)).
  - Método principal: `_renderPanel()` ([eventos.js:485-542](eventos.js:485)).
  - Apertura: `_openPanel(eventId)` ([eventos.js:468](eventos.js:468)). Cierre: `_closePanel()` ([eventos.js:477-482](eventos.js:477)).
- **Secciones de la ficha:**

| Sección | Existe | Implementación | Ubicación |
|---|---|---|---|
| Equipo asignado | ✅ | **Real (dual-write)**. UI lee de `localStorage.ev_equipo_<id>`; al guardar también persiste a Supabase vía `API.saveEventEquipo`. | render: [eventos.js:645-694](eventos.js:645); save: [eventos.js:201-210](eventos.js:201) |
| Transporte | ✅ | **Real (dual-write)**. Lee de `localStorage.ev_transporte_<id>`; al guardar también persiste vía `API.saveEventTransporte`. | render: [eventos.js:708-768](eventos.js:708); save: [eventos.js:219-230](eventos.js:219) |
| Documentos | ✅ | **Solo localStorage**. No hay dual-write a `evento_documentos`. | render: [eventos.js:792-818](eventos.js:792); save: [eventos.js:239-241](eventos.js:239) |
| Notas operativas | ✅ | Dual-write a campo `notas_operativas` de `eventos` (NO a `evento_historial`). | save: [eventos.js:249-253](eventos.js:249) |
| **Historial** | ❌ | **No implementado**. No hay método `_renderPanelHistorial()` ni getter en `eventos.js`. La API tiene `getEventHistorial` y `logEventChange` ([api.js:774-816](api.js:774)) pero `eventos.js` no las llama. | — |

> **Nota:** la afirmación del subagente "ZERO references to Supabase" en eventos.js es engañosa: `eventos.js` no usa `supabaseClient` directamente, pero llama a `API.saveEventEquipo`, `API.saveEventTransporte` y `API.updateEvent` en los _save_ ([eventos.js:209,222,252](eventos.js:209)). El **read** sigue siendo solo `localStorage`.

### 1.2 Tablas hijas de eventos — uso real

| Tabla | Lectura | Escritura |
|---|---|---|
| `evento_equipo` | `api.js:619-639` (`API.getEventEquipo`). Consumida por: [calendario-operativo.js:908](calendario-operativo.js:908). **No la lee `eventos.js`** (lee localStorage). | `api.js:641-663` (`API.saveEventEquipo`). Llamada por: [eventos.js:209](eventos.js:209). |
| `evento_transporte` | `api.js:666-691` (`API.getEventTransporte`). Consumida por: [calendario-operativo.js:909](calendario-operativo.js:909). **No la lee `eventos.js`**. | `api.js:693-718` (`API.saveEventTransporte`). Llamada por: [eventos.js:222](eventos.js:222). |
| `evento_documentos` | `api.js:721-742` (`API.getEventDocumentos`). Consumida por: [calendario-operativo.js:910](calendario-operativo.js:910). **No la lee `eventos.js`**. | `api.js:744-771` (`API.addEventDocumento`, `API.deleteEventDocumento`). **No llamadas desde ningún módulo**. → tabla declarada sin uso de escritura. |
| `evento_historial` | `api.js:774-796` (`API.getEventHistorial`). Consumida por: [calendario-operativo.js:911](calendario-operativo.js:911). **No la lee `eventos.js`**. | `api.js:798-816` (`API.logEventChange`). **No llamadas desde ningún módulo**. → tabla declarada sin uso. |

### 1.3 Schema real de las tablas hijas (sql/rename_proyectos_eventos.sql)

```sql
-- evento_equipo
id          uuid PK
created_at  timestamptz
updated_at  timestamptz
evento_id   uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE
profile_id  uuid REFERENCES profiles(id) ON DELETE SET NULL
rol         text
notas       text
_deleted    boolean

-- evento_transporte
id              uuid PK
created_at      timestamptz
updated_at      timestamptz
evento_id       uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE
tipo            text
proveedor       text
fecha           date
hora            time
detalle         text
_deleted        boolean

-- evento_documentos
id          uuid PK
created_at  timestamptz
updated_at  timestamptz
evento_id   uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE
nombre      text NOT NULL
url         text
tipo        text
_deleted    boolean

-- evento_historial
id          uuid PK
created_at  timestamptz
updated_at  timestamptz
evento_id   uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE
user_id     uuid REFERENCES profiles(id) ON DELETE SET NULL
accion      text NOT NULL
detalle     jsonb
_deleted    boolean
```

> ⚠️ **MISMATCH crítico schema vs API**: la SQL de migración (`rename_proyectos_eventos.sql`) define columnas distintas a las que la API escribe/lee:
>
> | Tabla | SQL define | API espera |
> |---|---|---|
> | `evento_equipo` | `profile_id`, `rol`, `notas` | `nombre_manual`, `rol_operativo`, `persona_id`, `orden` ([api.js:628-655](api.js:628)) |
> | `evento_transporte` | `tipo`, `proveedor`, `fecha`, `hora`, `detalle` | `camion`, `chofer_nombre`, `chofer_id`, `fecha_carga`, `fecha_salida`, `fecha_retorno`, `notas` ([api.js:677-710](api.js:677)) |
> | `evento_documentos` | `nombre`, `url`, `tipo` | `nombre_archivo`, `storage_path`, `tipo`, `uploaded_at`, `uploaded_by` ([api.js:730-754](api.js:730)) |
> | `evento_historial` | `user_id`, `accion`, `detalle (jsonb)` | `tipo`, `descripcion`, `metadata`, `usuario`, `created_at` ([api.js:784-809](api.js:784)) |
>
> Es decir: el SQL fue rehecho con columnas "limpias" pero la API quedó en la nomenclatura antigua. **Hoy mismo, los `INSERT` de `API.saveEventEquipo` / `saveEventTransporte` deberían fallar contra el schema actual** (silenciados con `.catch(() => {})` en el caller).

---

## 2. LOGÍSTICA — INVENTARIO COMPLETO

### 2.1 Archivos

Único archivo: **[logistica.js](logistica.js)**.

- **Objeto global:** `LogisticaModule`
- **Sub-vistas (no son tabs nominados, son secciones por estado interno):** `vehiculos` y `movimientos`.
- **Métodos clave:**
  - Vehículos: `_loadVehiculos`, `_renderVehiculos`, `_renderFichaVehiculo`, `_showVehiculoModal`, `_deleteVehiculo`.
  - Movimientos: `_loadMovimientos`, `_renderMovimientos`, `_buildMovCard`, `_renderFichaMovimiento`, `_showMovimientoModal`, `_deleteMovimiento`.
  - Remito: `_loadRemito`, `_renderRemitoTable`, `_precargarRemito`, `_showAddRemitoModal`.
  - Checks de viaje: `_toggleBigCheck` (salida / llegada / descarga / retorno).

Soporte:
- [badges.js:208-222](badges.js:208) — badge de vencimientos VTV/seguro de `logistica_vehiculos`.
- [router.js:57](router.js:57) — registro de ruta.

### 2.2 Tablas Supabase que toca Logística

| Tabla | Archivo:Línea | Op | Columnas |
|---|---|---|---|
| `logistica_vehiculos` | [logistica.js:173](logistica.js:173) | select * | todas |
| `logistica_vehiculos` | [logistica.js:437,440](logistica.js:437) | update / insert | nombre, tipo, patente, contacto, estado, vtv_vencimiento, seguro_vencimiento, ultimo_service, notas |
| `logistica_vehiculos` | [logistica.js:458](logistica.js:458) | update | _deleted |
| `logistica_vehiculos` | [logistica.js:476,885](logistica.js:476) | select * | todas |
| `logistica_vehiculos` | [badges.js:213](badges.js:213) | select | id, vtv_vencimiento, seguro_vencimiento |
| `logistica_movimientos` | [logistica.js:475](logistica.js:475) | select * | todas |
| `logistica_movimientos` | [logistica.js:862](logistica.js:862) | update | check_salida \| check_llegada \| check_descarga \| check_retorno |
| `logistica_movimientos` | [logistica.js:1000,1003](logistica.js:1000) | update / insert | evento_id, proyecto_id, vehiculo_id, chofer, origen, destino, fecha, hora_programada, notas |
| `logistica_remito` | [logistica.js:786](logistica.js:786) | select * | todas |
| `logistica_remito` | [logistica.js:826,845](logistica.js:826) | delete | (por id) |
| `logistica_remito` | [logistica.js:1041,1095](logistica.js:1041) | insert | movimiento_id, item_nombre, cantidad, notas |
| `taller_materiales` (cross-módulo) | [logistica.js:1028](logistica.js:1028) | select | item_nombre, cantidad, notas |

### 2.3 Vehículos — `logistica_vehiculos`

Definida en [sql/logistica_module.sql](sql/logistica_module.sql) (líneas 7-20):

```sql
id                  BIGSERIAL PK
nombre              TEXT NOT NULL
tipo                TEXT NOT NULL DEFAULT 'propio'
                      CHECK (tipo IN ('propio','tercero'))
patente             TEXT
contacto            TEXT                 -- ⚠ texto libre, sin FK
vtv_vencimiento     DATE
seguro_vencimiento  DATE
ultimo_service      DATE
estado              TEXT NOT NULL DEFAULT 'disponible'
                      CHECK (estado IN ('disponible','en_uso','en_service','baja'))
notas               TEXT
_deleted            BOOLEAN NOT NULL DEFAULT false
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

Campo "contacto/chofer": **TEXTO LIBRE**. UI: input simple con placeholder "Nombre y teléfono" ([logistica.js:378-379](logistica.js:378)). → **chofer no normalizado**.

### 2.4 Movimientos — `logistica_movimientos`

Definida en [sql/logistica_module.sql](sql/logistica_module.sql) (líneas 23-41):

```sql
id                BIGSERIAL PK
evento_id         BIGINT REFERENCES eventos(id)             ON DELETE SET NULL  -- ⚠ ver §5
proyecto_id       BIGINT REFERENCES proyectos(id)           ON DELETE SET NULL  -- ⚠ ver §5
vehiculo_id       BIGINT REFERENCES logistica_vehiculos(id) ON DELETE SET NULL
chofer            TEXT                  -- ⚠ texto libre, duplica `contacto` del vehículo
origen            TEXT NOT NULL
destino           TEXT NOT NULL
fecha             DATE
hora_programada   TEXT
check_salida      TIMESTAMPTZ
check_llegada     TIMESTAMPTZ
check_descarga    TIMESTAMPTZ
check_retorno     TIMESTAMPTZ
estado            TEXT DEFAULT 'programado'   -- legacy, no se actualiza activamente
notas             TEXT
_deleted          BOOLEAN NOT NULL DEFAULT false
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
```

FKs: a `eventos`, a `proyectos`, a `logistica_vehiculos`. **Sin FK a `rrhh_personal`** para chofer.

> **Tipo BIGINT en FKs vs UUID en eventos/proyectos**: en `rename_proyectos_eventos.sql` (post-migración), `eventos.id` y `proyectos.id` son **UUID**. En cambio, `logistica_movimientos.evento_id` y `proyecto_id` son **BIGINT** (SQL antiguo). → **incompatibilidad de tipos** entre el SQL de logística y el SQL nuevo de eventos/proyectos. Las FKs no se pueden crear con esos tipos.

---

## 3. RRHH — INVENTARIO COMPLETO

### 3.1 Archivos

Único archivo: **[rrhh.js](rrhh.js)**.

- **Objeto global:** `RRHHModule`
- **Tabs (estado `_activeTab`):** `nomina`, `asignacion`, `vacaciones`.
- **Métodos clave:** `_loadNomina`/`_renderNomina`/`_renderFichaPersonal`/`_showPersonModal`; `_loadAsignacion`/`_renderAsignacion`/`_detectConflicts`/`_showAsignacionModal`; `_loadVacaciones`/`_renderVacaciones`/`_showSolicitudModal`/`_showVacConfigModal`.

### 3.2 Tablas Supabase tocadas

| Tabla | Archivo:Línea | Op | Columnas |
|---|---|---|---|
| `rrhh_personal` | [rrhh.js:194](rrhh.js:194), [rrhh.js:649](rrhh.js:649), [rrhh.js:913](rrhh.js:913) | select * | todas |
| `rrhh_personal` | [rrhh.js:610,613](rrhh.js:610) | update/insert | nombre, rol, tipo, cantidad_personas, contacto, telefono, email, fecha_ingreso, estado, documentacion, notas |
| `rrhh_personal` | [rrhh.js:631](rrhh.js:631) | update | _deleted |
| `rrhh_asignaciones` | [rrhh.js:347](rrhh.js:347), [rrhh.js:650](rrhh.js:650) | select * | personal_id, evento_id, proyecto_id, rol_evento, fecha_desde, fecha_hasta |
| `rrhh_asignaciones` | [rrhh.js:893](rrhh.js:893) | insert | personal_id, evento_id, proyecto_id, rol_evento, fecha_desde, fecha_hasta, notas |
| `rrhh_asignaciones` | [rrhh.js:760](rrhh.js:760) | update | _deleted |
| `rrhh_vacaciones` | [rrhh.js:368](rrhh.js:368), [rrhh.js:914](rrhh.js:914), [rrhh.js:1113](rrhh.js:1113), [rrhh.js:1240-1242](rrhh.js:1240) | select/upsert/update | personal_id, dias_totales, dias_usados |
| `rrhh_vacaciones_solicitudes` | [rrhh.js:915](rrhh.js:915), [rrhh.js:1098](rrhh.js:1098), [rrhh.js:1174-1181](rrhh.js:1174) | select/insert/update | personal_id, fecha_desde, fecha_hasta, estado, notas |
| `eventos`, `proyectos` (vía `API`) | [rrhh.js:651,652](rrhh.js:651) | select | (lectura para combos) |

### 3.3 Tabla de personas — `rrhh_personal`

Definida en [sql/rrhh_tables.sql](sql/rrhh_tables.sql) (líneas 8-23):

```sql
id                 BIGSERIAL PK
nombre             TEXT NOT NULL
rol                TEXT             -- "función" del staff
tipo               TEXT DEFAULT 'fijo'
                     CHECK (tipo IN ('fijo','eventual','cuadrilla'))
cantidad_personas  INT              -- solo aplica a tipo='cuadrilla'
contacto           TEXT
telefono           TEXT
email              TEXT
fecha_ingreso      DATE
estado             TEXT DEFAULT 'activo'
                     CHECK (estado IN ('activo','inactivo'))
documentacion      TEXT
notas              TEXT
_deleted           BOOLEAN DEFAULT false
created_at         TIMESTAMPTZ DEFAULT now()
```

**Diferenciación chofer / técnico / comercial:**
- Se hace por la columna **`rol`** (texto libre, con datalist en el modal: Armador, Electricista, **Chofer**, Carpintero, Pintor, Encargado, Ayudante, Administrativo, Project Manager, Diseñador, Comercial, Gerencia — [rrhh.js:506-519](rrhh.js:506)).
- `tipo` (fijo / eventual / cuadrilla) describe **modalidad de contratación**, no la función.

### 3.4 Relación con `profiles` (Auth)

- **Son tablas SEPARADAS, sin FK declarada.**
- `profiles` (de Supabase Auth) guarda usuarios del sistema (id = `auth.users.id`, email, role, permissions). Manejada por [auth.js](auth.js).
- `rrhh_personal` guarda staff operativo (incluye gente sin login: cuadrillas, eventuales).
- No hay columna `profile_id` en `rrhh_personal`, ni `personal_id` en `profiles`. → No es posible "saber" si un usuario logueado corresponde a una persona del staff sin matchear por nombre/email.

---

## 4. INTEGRACIÓN — GAPS DETECTADOS

### 4.1 `evento_equipo`

- Schema actual (post-migración): `evento_id` UUID, `profile_id` UUID → `profiles.id`, `rol`, `notas`.
- **`profiles` NO es la tabla correcta para representar al equipo del evento.** Razones:
  1. Los choferes y cuadrillas (Diego, Juan, Carlos, Willy y eventuales) viven en `rrhh_personal`, no en `profiles`. Profiles solo tiene usuarios con login al sistema.
  2. El equipo de un evento típicamente incluye personas sin acceso al sistema (cuadrillas, taller).
- **FK que debería ser:** `personal_id UUID/BIGINT REFERENCES rrhh_personal(id)` (con la advertencia de tipos: hoy `rrhh_personal.id` es BIGSERIAL y `eventos.id` es UUID; hay que decidir un estándar).
- **Inconsistencia adicional:** la API ([api.js:628-655](api.js:628)) escribe `nombre_manual`, `rol_operativo`, `persona_id`, `orden` — columnas que **no existen** en el schema definido por `rename_proyectos_eventos.sql`. Cualquier `INSERT` actual debería fallar.

### 4.2 `evento_transporte`

- Schema actual: `evento_id`, `tipo`, `proveedor`, `fecha`, `hora`, `detalle`. **Sin FK a `logistica_vehiculos` ni a chofer.**
- FKs a agregar:
  - `vehiculo_id` → `logistica_vehiculos(id)` (puede ser NULL si es transporte tercerizado).
  - `chofer_personal_id` → `rrhh_personal(id)` (NULL si es chofer externo, en cuyo caso queda en `proveedor` + texto).
- **Solapamiento con `logistica_movimientos`:** un "transporte de evento" hoy se modela en dos lugares (`evento_transporte` y `logistica_movimientos.evento_id`). Hay que decidir cuál es la fuente de verdad. Recomendación: eliminar `evento_transporte` y leer/crear desde `logistica_movimientos` filtrando por `evento_id`.
- **Inconsistencia adicional:** API ([api.js:677-710](api.js:677)) usa `camion`, `chofer_nombre`, `chofer_id`, `fecha_carga`, `fecha_salida`, `fecha_retorno`, `notas` — columnas que no existen en el schema actual.

### 4.3 localStorage residual a migrar

| Archivo:Línea | Key | Qué guarda | Tabla equivalente |
|---|---|---|---|
| [eventos.js:181,190](eventos.js:181) | `ev_ext_<id>` | "extensiones" genéricas del evento | (sin tabla; revisar si es legacy) |
| [eventos.js:196,202](eventos.js:196) | `ev_equipo_<id>` | array de equipo asignado | `evento_equipo` (dual-write activo, pero schema mismatch) |
| [eventos.js:214,220](eventos.js:214) | `ev_transporte_<id>` | objeto transporte | `evento_transporte` (dual-write, schema mismatch) o `logistica_movimientos` |
| [eventos.js:234,240](eventos.js:234) | `ev_docs_<id>` | array documentos | `evento_documentos` (NO hay dual-write hoy) |
| [eventos.js:245,250](eventos.js:245) | `ev_notas_<id>` | string notas | `eventos.notas_operativas` (dual-write activo) |
| [eventos.js:257,263](eventos.js:257) | `ev_proyectos_<id>` | array de IDs de proyectos | `proyectos.evento_id` (FK ya existe; bastaría leer por evento) |
| [eventos.js:1534](eventos.js:1534) | (cleanup) | removeItem batch al borrar evento | n/a |
| [calendario-operativo.js:216,223,224,225,239](calendario-operativo.js:216) | `ev_proyectos_<id>`, `ev_equipo_<id>`, `ev_transporte_<id>`, `ev_notas_<id>`, `ev_docs_<id>` | enriquece eventos para timeline | **mismas tablas que arriba** + el módulo ya tiene fallback a `API.getEventEquipo/Transporte/Documentos/Historial` ([calendario-operativo.js:908-911](calendario-operativo.js:908)) |
| [calendario-operativo.js:262,274](calendario-operativo.js:262) | `co_events_cache` | snapshot offline de eventos | n/a (cache offline, ok) |

**Logística y RRHH:** **no usan localStorage** (verificado).

---

## 5. RIESGOS Y DECISIONES PENDIENTES

### Schema mismatches (críticos, bloquean integración)

1. **API vs SQL desincronizados** en las cuatro tablas hijas de eventos. La SQL nueva (`rename_proyectos_eventos.sql`) define columnas distintas a las que `api.js` escribe. Hoy los dual-writes silenciosos (`.catch(() => {})`) ocultan el error pero **no hay datos persistiendo**. Hay que decidir: o se actualiza el SQL para que matchee la API (más columnas, más dominio), o se reescribe la API para usar el schema "limpio".

2. **Tipos incompatibles entre módulos:**
   - `eventos.id`, `proyectos.id` → UUID (post-migración).
   - `logistica_movimientos.evento_id`, `proyecto_id` → BIGINT (sin migrar).
   - `rrhh_personal.id` → BIGSERIAL.
   - `profiles.id` → UUID.
   - Las FKs de logística a eventos/proyectos están **rotas a nivel de tipo**.

### FKs faltantes que deberían existir

3. `logistica_vehiculos.contacto` (chofer) → debería ser FK a `rrhh_personal(id)` (con fallback a texto libre cuando es chofer externo / proveedor terceros).
4. `logistica_movimientos.chofer` → idem.
5. `evento_equipo.profile_id` → debería apuntar a `rrhh_personal(id)`, no a `profiles(id)`.
6. `evento_transporte` → necesita `vehiculo_id` → `logistica_vehiculos(id)` y `chofer_personal_id` → `rrhh_personal(id)`. O eliminarse y unificarse con `logistica_movimientos`.

### Duplicación de información

7. **Chofer triplicado:**
   - `logistica_vehiculos.contacto` (texto libre).
   - `logistica_movimientos.chofer` (texto libre).
   - `rrhh_personal` con `rol = 'Chofer'` (normalizado, pero no referenciado).
   La misma persona "Diego" aparece como string en 2 tablas y como fila en una tercera, sin enlace.

8. **Transporte de evento duplicado:** se puede modelar tanto en `evento_transporte` (vacía hoy) como en `logistica_movimientos` con `evento_id`. Decidir una sola fuente.

9. **Equipo de evento (asignaciones) duplicado:** existe `evento_equipo` y `rrhh_asignaciones` (con `personal_id` + `evento_id`). Hoy `eventos.js` escribe a `evento_equipo` (con schema roto) mientras que RRHH escribe a `rrhh_asignaciones`. Son dos sistemas paralelos para la misma relación N:N.

### Tablas declaradas sin uso

10. `evento_documentos`: la API tiene CRUD ([api.js:721-771](api.js:721)) pero **ningún módulo la llama** (calendario-operativo solo la lee con `.catch`). En `eventos.js` los docs viven en `localStorage`.
11. `evento_historial`: `API.logEventChange` ([api.js:798-816](api.js:798)) **nunca se invoca**. La columna `eventos.notas_operativas` y el `audit_logs` global cubren parcialmente esa función.

### Decisiones de diseño que dependen de cómo trabaja MEPEX

12. **¿Un chofer es parte del equipo del evento o es una entidad separada?**
    - Hoy: separado. El chofer va por `logistica_movimientos.chofer` (texto) y el equipo va por `evento_equipo` o `rrhh_asignaciones`.
    - Decisión: si el chofer también arma stand → debe ser una asignación normal en `rrhh_asignaciones` con `rol_evento = 'Chofer + Armador'`. Si solo maneja → solo aparece en logística.

13. **¿`evento_equipo` y `rrhh_asignaciones` deben fusionarse?**
    - Recomendación fuerte: **sí, dejar solo `rrhh_asignaciones`** (ya tiene `personal_id`, `evento_id`, `proyecto_id`, `rol_evento`, fechas). Eliminar `evento_equipo`. Actualizar `eventos.js` y `calendario-operativo.js` para leer de ahí.

14. **¿`evento_transporte` se mantiene o se elimina?**
    - Recomendación: eliminar y leer desde `logistica_movimientos.WHERE evento_id = X`. Un evento ya tiene viajes (movimientos): no hace falta una tabla extra que dice "tipo, proveedor, fecha, hora".

15. **¿Existirá un módulo `documentos` global?**
    - Si MEPEX maneja docs (planos, presupuestos, fotos del armado), conviene una tabla `documentos` polimórfica con `entidad_tipo` ('evento'|'proyecto'|'cliente') y `entidad_id`, en lugar de `evento_documentos` aislada.

16. **Estandarizar tipo de PK del proyecto:** todo apunta a UUID. Logística y RRHH usan BIGSERIAL. Para crear FKs reales hay que migrar. Decisión: ¿migrar logística+RRHH a UUID, o revertir eventos/proyectos a BIGINT? (UUID es lo que ya quedó migrado, más sencillo arrastrar el resto).

---

**Fin de la auditoría.** No se modificó código ni schema.
