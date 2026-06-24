# Blueprint — Reorganización de la capa operativa física (LOBBY-MEPEX)

> Diseño 2026-06-23 (versión final, post-revisiones DDL + completitud); companion de PLAN-MAESTRO §REORGANIZACIÓN DE LA CAPA OPERATIVA FÍSICA. Solo diseño; nada construido. SQL en DRAFT, sin aplicar.
> Este documento ensambla 6 specs por área en un plan único, coherente, con contradicciones resueltas (decisiones explícitas marcadas **⚖️ DECISIÓN GLOBAL**). Grounding obligatorio antes de construir: `docs/schema-prod.md` (el schema real MANDA sobre el repo). **Las dos revisiones adversariales (DDL + completitud) están incorporadas: la firma de RLS real es `fn_role_can(module, need)→bool`, proyectos/locaciones YA tienen RLS blanket de Capa 2, y el rediseño REVIERTE `taller_rol_sin_proyectos.sql` (SB4) — ver Q1.bis.**

---

## 0. PREGUNTAS PARA FEDE (resolver antes de construir)

> Consolidadas y deduplicadas de las 6 áreas, priorizadas. Cada una con opciones + recomendación. Las marcadas **🔴 BLOQUEANTE** definen DDL — sin respuesta no se corre el SQL.
> **NOTA — 4 preguntas del draft original quedaron CERRADAS por el código (no se preguntan):** la forma de `roles.permissions` (es objeto `{modulo:"read"|"write"}`, `rls_capa2_motor.sql:12`), la firma de la función RLS (`fn_role_can(p_module,p_need)→bool`, `rls_capa2_motor.sql:41`), si proyectos/locaciones tienen RLS (sí: policy blanket `*_rls_auth FOR ALL authenticated USING(true)`, `rls_capa2_operativo.sql:42-95`), y la existencia de `locaciones.tipo` (existe, `text NOT NULL`, `schema-prod.md:107`).

### ✅ RESUELTAS por Fede (2026-06-24)
- **Q1 ✅** → gate de visibilidad taller = `proyectos.estado='en_taller'` (sin DDL; el filtro RLS y el `.eq()` del frontend usan el mismo valor).
- **Q1.bis ✅** → **el rediseño REEMPLAZA `taller_rol_sin_proyectos.sql` (SB4)**: el rol taller vuelve a ver Proyectos (read-only, filtrado al gate de Q1). Decisión delegada por Fede ("manejálo"). Fase A documenta que revierte SB4.
- **Q2 → DIFERIDA a Fase E (NO bloquea).** Claude verifica los valores reales de `locaciones.tipo` en prod al construir Locaciones y mapea el filtro taller (`tipo IN (...)`) a esos valores; si hay locaciones sin tipo clasificable, warning en la UI admin. Fede no hace nada.
- **Q3 ✅** → `rutinas.activo_id` = `text` (FK lógica polimórfica: cubre el bigint de locaciones/insumos + el uuid de vehiculos/equipos).
- **Decisiones ⚖️ globales (Q4 `equipos` · Q5 `evento_transporte` · Q6 motor único `rutinas` · Q8 no toca `vencimientos_recurrentes` · Q9 ad-hoc por ambas vías · resto) → RATIFICADAS por Fede** ("el resto lo veo todo bien").

### Bloqueantes de schema/seguridad

**Q1 — 🔴 Gate de visibilidad taller: ¿qué columna discrimina "proyecto en producción"?** Hay TRES columnas en juego y el código actual las mezcla:
- `proyectos.estado` (`text NOT NULL`) tiene entre sus valores `'en_taller'` (ver `proyectos.js _statusOptions`).
- `proyectos.estado_taller` (`varchar` nullable, `schema-prod.md:47`) es el estado del ciclo de taller (pendiente/en_armado/listo/despachado/cerrado).
- No existe `en_taller boolean`.
- **El blueprint usa los tres indistintamente → hay que unificar UNO solo y aplicarlo en RLS *y* en JS.**
- (a) Usar `estado='en_taller'` → semántica de "estado comercial del proyecto"; el JS ya filtra así.
- (b) Usar `estado_taller IS NOT NULL` → solo sirve si el default NO es `'pendiente'` para todos (verificar en prod; si todos arrancan con valor, no discrimina).
- (c) Agregar `en_taller boolean DEFAULT false` que setea el botón "Pasar a Taller" → gate explícito, desacoplado de ambos.
- **Reco:** (a) `estado='en_taller'` como gate único (ya es el contrato del JS y no requiere DDL), o (c) si querés desacoplar producción de estado comercial. **NO usar `estado_taller IS NOT NULL` salvo que prod confirme que discrimina.** **Define el filtro RLS de Fase A y el `.eq()` del frontend — deben coincidir.**

**Q1.bis — 🔴 ¿El rediseño REVIERTE la decisión SB4 (`taller_rol_sin_proyectos.sql`)?** Esa migración **sacó `proyectos` del rol taller a propósito** (justificación escrita: *"el taller ve Eventos + su dashboard; ya NO entra a Proyectos, eso es oficina; el PM es el nexo"*). El blueprint A.1 vuelve a darle `proyectos` (read-only) a taller porque disuelve el módulo Taller dentro de Proyectos.
- **Esto es un cambio de criterio deliberado y reciente.** Confirmar que el rediseño manda sobre SB4. Si sí: la disolución de Taller→Proyectos procede. Si no: hay que rediseñar la Fase C (taller seguiría en un dashboard propio, no en Proyectos).
- **Reco:** confirmar "sí, el rediseño reemplaza SB4" → entonces A.1 documenta explícitamente que revierte esa migración.

**Q2 — 🔴 Valores de `locaciones.tipo` (la columna EXISTE, `text NOT NULL`).** No es un ALTER — es auditoría de valores. ¿Los valores actuales incluyen `'taller'`/`'deposito'`, o son otros (`'galpon'`, `'oficina'`, etc.)?
- El filtro RLS+JS de taller es `tipo IN ('taller','deposito')`. **Si los valores reales son otros, taller no ve NINGUNA locación (falla silenciosa).**
- **Acción:** `SELECT tipo, count(*) FROM locaciones GROUP BY tipo;` → mapear los valores reales a la taxonomía operativa. Backfill manual de Fede si hace falta normalizar. Valores canónicos destino: `taller | deposito | oficina | showroom`.
- **Reco:** la UI admin de Locaciones debe mostrar un warning "N locaciones sin tipo clasificable" para que taller no quede ciego. **Define el filtro de Fase E (no requiere ALTER de la columna).**

**Q3 — 🔴 Tipo de `id` de los activos para rutinas.** Confirmado parcial: `locaciones.id`=**bigint**, `insumos_base.id`=**bigint** (verificar), `vehiculos.id`=**uuid**, `equipos.id`=**uuid** (tabla nueva). Una sola columna `rutinas.activo_id uuid` **NO puede** referenciar locaciones/insumos (bigint).
- **⚖️ DECISIÓN (resuelta por la revisión DDL):** `rutinas.activo_id` se modela como **`text`** (guarda uuid o bigint como string, FK lógica polimórfica de verdad, un solo campo, cubre todos los tipos). El índice `idx_rutinas_activo(activo_tipo, activo_id)` funciona uniforme. **No se usa `sello_id` para identificar el activo** (sello_id queda solo para el sello del activo). Confirmar con Fede o se toma este default. **Define el DDL de Fase F.**

### Decisiones de modelo (resuelven contradicciones entre áreas)

**Q4 — Tabla de equipos: nombre.** Las áreas la nombran distinto (`equipos` vs `inventario_equipos`).
- **⚖️ DECISIÓN GLOBAL: `equipos`** (UUID). Más corto, sin prefijo redundante (vive conceptualmente en Inventario pero es entidad propia). El FK desde transporte usa `equipo_id uuid REFERENCES equipos(id)`. Confirmar con Fede o se toma este default.

**Q5 — Transporte: ¿reusar `cargas` o tabla nueva?**
- **⚖️ DECISIÓN GLOBAL: tabla nueva `evento_transporte` + `evento_transporte_items`**, `cargas`/`carga_*`/`logistica_*` quedan **inertes** (NO drop). Justificación: el MODELO dice SIN workflow (aprobación/responsable/ayudantes); reusar `cargas` arrastra columnas muertas y `carga_proyectos` solo modela proyectos (necesitamos 3 tipos de ítem). El remito (`remito-pdf.js`) y "qué sale hoy" se reapuntan a `evento_transporte`. **Impacto:** flota "Salidas de hoy" lee `evento_transporte`, no `cargas`.

**Q6 — Rutinas: motor único.**
- **⚖️ DECISIÓN GLOBAL: tabla `rutinas` global única (plantilla) + instancia materializada en `tareas`.** Es el modelo más coherente con "Centro de Tareas = una fuente más, sin sistemas paralelos". `produccion_mantenimiento` se **reusa solo como tabla de SELLO** (la rutina "VTV" del camión sella ahí vía `sello_tabla/columna/id`), NO como tabla de rutinas. Locaciones NO crea sus propias tablas de rutinas: usa `rutinas` con `activo_tipo='locacion'`. Esto **elimina** las tablas `locaciones_rutinas`/`_generadas` y los ALTER de `produccion_mantenimiento` de las specs de área → un solo motor. **¿OK, Fede?** (Es la unificación más grande del blueprint.)

**Q7 — Política de reprogramación de rutinas.** Al completar, ¿próxima fecha desde el día hecho (evita acumular atrasos) o desde la programada (cadencia fija)?
- **Reco:** flag por rutina `reprog_desde ('completada'|'programada')`; default `completada` para mantenimiento físico, `programada` para cierres contables/cert.

**Q8 — ¿`rutinas` reemplaza o coexiste con `vencimientos_recurrentes` (Finanzas)?** **(NUEVA — la revisión de completitud detectó solapamiento.)** El seed de `rutinas` incluye "Cierre contable", "Vencimientos impositivos", "Cert ARCA" → esos dominios YA los maneja `vencimientos_recurrentes` (genera egresos en Finanzas/Calendario-adm).
- Riesgo: el admin ve el cierre contable DOS veces (en Tareas y en Calendario-adm).
- (a) `rutinas` NO toca finanzas → **sacar los seeds financieros** (cierre/impuestos/ARCA), dejar solo backup/inventario físico + activos físicos.
- (b) `rutinas` reemplaza `vencimientos_recurrentes` → refactor mayor de Finanzas, fuera de alcance de esta tanda.
- **Reco:** (a) — `rutinas` es para mantenimiento de ACTIVOS FÍSICOS + tareas operativas no-financieras. Los vencimientos con plata siguen en su carril. **Ajustar el seed de Fase F en consecuencia.**

### Decisiones de UX/alcance

**Q9 — Vehículo ad-hoc (ajeno): ¿se guarda en Flota o inline en el transporte?**
- **⚖️ DECISIÓN GLOBAL: ambas vías** — combobox con toggle "guardar en Flota (reusable, `vehiculos.es_propio=false`)" / "solo este viaje (campos `vehiculo_adhoc_*` inline en `evento_transporte`)". Mantiene Flota limpia sin obligar a dar de alta cada changa.

**Q10 — Regla de backfill de `vehiculos.es_propio`.** **(NUEVA — la columna NO existe; `vehiculos.propietario` es `varchar` texto libre.)** El ALTER agrega `es_propio boolean`, pero el backfill desde `propietario` es ambiguo (no hay enum MEPEX/Tercero).
- ¿Cómo distinguís hoy propios de ajenos en `propietario`? (¿`propietario ILIKE '%mepex%'`? ¿`titular`/`valor_compra`/`fecha_compra` no-null = propio? ¿NULL = propio?)
- **Reco:** backfill explícito y revisado por Fede, NO heurístico de string. Default `es_propio=true` puede marcar ajenos como propios. Candidato: `es_propio = (valor_compra IS NOT NULL OR fecha_compra IS NOT NULL)`. **Confirmar antes de correr el ALTER (va en `reorg_d`).**

**Q11 — "Qué sale hoy": ¿dónde vive y qué es "hoy"?**
- **⚖️ DECISIÓN GLOBAL: tab "Salidas de hoy" en Flota (read-only, fuente `evento_transporte`) + la sección de transporte del Calendario operativo se reapunta a `evento_transporte`.** Widget de lobby por rol = fase 2.
- **Definición de "hoy" (resuelta):** `getSalidasHoy` lista transportes con `fecha = CURRENT_DATE` **+** transportes con `fecha < hoy` y `remito_firmado_url IS NULL` (en tránsito, no devueltos). Empty-state: "No hay salidas hoy".

**Q12 — Individualización vs lote de equipos.** ¿Herramientas/matafuegos uno por uno o lote con cantidad?
- **Reco:** contenedores/máquinas/escaleras = individualizados; herramientas chicas/matafuegos = lote (`cantidad>1`). El DDL soporta ambos.

**Q13 — Manifiesto→remito: default.** Al cargar un canasto, ¿lista solo el canasto (1 línea) y "desglosar contenido" es opt-in?
- **Reco:** sí, default = solo el canasto; toggle `detallar_contenido` expande el manifiesto en el remito.

**Q14 — Taller ve `#locaciones`/`#proyectos` como ítems de menú, o solo vía Centro de Tareas?**
- **⚖️ DECISIÓN GLOBAL: ítems de menú filtrados** (proyectos read-only en taller; locaciones operativa taller/depósito). El Centro de Tareas es el "Hoy" canónico, pero el galpón navega a sus vistas.

**Q15 — Blindaje de escritura taller.** ¿Alcanza "la API solo toca `estado_taller`/checklist" (v1, sin trigger), o trigger BEFORE UPDATE que revierta cambios de columnas comerciales si el actor es taller?
- **Reco:** v1 sin trigger (confiar en API + filtrado por query). Trigger = blindaje opcional si lo pedís. **Nota:** la RLS NO va a bloquear el write de taller sobre `equipos`/`evento_transporte` (son `authenticated USING(true)` v1); el lock vive en UI/API — ver §2.3.

**Q16 — ¿Hay datos reales de matafuegos/herramientas a migrar, y en qué tabla viven hoy?** **(NUEVA — la revisión de completitud detectó que `produccion_mantenimiento` solo tiene `vehiculo_id`, es de FLOTA, no de herramientas.)** El blueprint asume que el "mantenimiento de taller" (matafuegos/herramientas) se absorbe en Equipos, pero no aparece en `produccion_mantenimiento`.
- ¿Los matafuegos/herramientas existen como datos en alguna tabla (`taller_checklist`/`taller_materiales`/local de `taller.js`), o es greenfield (se cargan a mano en Equipos)?
- **Reco:** si es greenfield → Fase B crea las entidades vacías y Fede carga los equipos físicos; las rutinas (VTV de matafuego, etc.) se programan en Fase F. Si hay datos → agregar paso de migración explícito en Fase B. **Confirmar antes de Fase B/C.**

**Q17 — Manifiesto→remito anidado >1 nivel.** Un canasto que contiene otro canasto con `detallar_contenido`: ¿se expande recursivo o se corta? **Reco:** render de manifiesto corta a 1 nivel (UI); en el remito, `detallar_contenido` expande solo el primer nivel del canasto (no recursivo). Documentado.

**Q18 — Mantenimiento huérfano al disolver taller.** **⚖️ DECISIÓN GLOBAL: lo absorbe la sub-vista Equipos de Inventario EN ESTA tanda** (Fase B), vía `rutinas` con `activo_tipo='equipo'`. No queda huérfano: el orden de fasado pone Equipos antes de disolver Taller. (Sujeto a Q16 — si hay datos, migrar.)

**Q19 — Tildado del checklist de armado: ¿inline en cards + en ficha, o solo ficha?**
- **Reco:** tildado inline en cards (flujo del galpón) SÍ; edición de estructura del checklist (add/rename/delete ítems) solo en la ficha del proyecto.

**Q20 — ¿Hay cargas/movimientos vivos en prod a migrar?** Si hay transportes reales en `cargas`/`logistica_movimientos` de eventos en curso.
- **Reco:** greenfield (el aparato fue retirado por tedioso); lo nuevo solo para eventos nuevos. **Gate explícito antes del corte de lectura legacy en `eventos.js`:** correr `SELECT count(*) FROM cargas WHERE _deleted=false;` y `SELECT count(*) FROM logistica_movimientos WHERE _deleted=false;` (o equivalente) — si ambos 0, cortar; si no, decidir migración. **Confirmar.**

**Q21 — Catálogo de rutinas: manual o plantillas auto-sugeridas por tipo de activo.**
- **Reco:** v1 manual + seed transversal (no-financiero, ver Q8). Plantillas auto-sugeridas por `tipo_equipo`/`tipo` de locación = fase 2.

**Q22 — `logistica_vehiculos` huérfanos.** ¿Confirmás que puedo verificar y migrar huérfanos a `vehiculos`, o ya sabés que está vacío y corto la lectura directo?

**Q23 — Color de la categoría ACTIVOS.** **(NUEVA — la sección 4 de CLAUDE.md define 5 categorías con colores fijos; ACTIVOS es nueva.)** El sidebar destino agrupa Inventario/Flota/Locaciones bajo **ACTIVOS**, que no tiene color asignado en la marca.
- Hoy "Recursos" = `#9B7DFF` (violeta, Inventario). ¿ACTIVOS hereda ese violeta, usa otro, o se mantiene "Recursos" como nombre?
- **Reco:** ACTIVOS reusa `#9B7DFF` (violeta Recursos) — ya es el color de Inventario, y Flota/Locaciones son recursos también. Confirmar nombre ("ACTIVOS" vs "RECURSOS") y color con Fede.

**Q24 — ¿Quién ve la pestaña Rutinas?** admin-level (admin/superadmin) o +pm. **Reco:** admin-level v1.

**Q25 — Rutina sin responsable.** Si `target_role` y `responsable_id` son ambos NULL, ¿a qué bandeja cae la instancia? **Reco:** fallback a `admin` (la instancia se rutea a rol admin si no hay responsable explícito).

---

## 1. Modelo y principios

**Dos mundos + un sistema nervioso.**

- **ACTIVOS** (lo que MEPEX TIENE, permanente, cruza eventos): **Inventario** (insumos + piezas + **Equipos** + contenedores) · **Flota** (vehículos propios/ajenos) · **Locaciones** (espacios físicos). Cada activo = dato maestro + cara $$/admin + **rutinas** (mantenimiento recurrente).
- **OPERACIONES** (lo que MEPEX HACE, por evento): Evento → Proyecto/stand → producción (checklist) → **Transporte** (en la ficha del evento) → remito.
- **CENTRO DE TAREAS** (sistema nervioso): caen TODAS las tareas — derivadas (operativas) + recurrentes (rutinas de activos) + manuales — ruteadas por rol/perfil. Cada activo/módulo = una fuente del motor `Alertas` + `notifications`. **NO es un sistema paralelo.**

**Principio rector:** un módulo que en el fondo es "una vista filtrada de otra cosa para un rol" no es un módulo, es esa vista filtrada (dato único + vistas por rol). Aplicado:
- **Taller** se disuelve → Proyectos read-only filtrado (rol taller). *(Revierte SB4 — Q1.bis.)*
- **Logística** se disuelve → Transporte en la ficha del Evento.
- **Equipos** no es módulo → sub-vista de Inventario.
- **"Qué sale hoy"** no es módulo → tab de Flota + sección de Calendario operativo.

**Restricciones de ingeniería (transversales):** SQL additivo + idempotente (`IF NOT EXISTS`, `DO $$` para constraints/policies), grounded en `docs/schema-prod.md`. Tablas nuevas en UUID + `_deleted boolean NOT NULL DEFAULT false` + `created_at timestamptz NOT NULL DEFAULT now()` + RLS, alineadas a eventos/proyectos/profiles. Gotchas: `proveedor.id`=UUID; `vehiculos`/`cargas`=UUID; `locaciones`/`insumos_base`/`logistica_*`=bigint legacy; columnas rotadas en `clientes` (mapeadas en api.js). **Permiso nuevo = grant en `data.js Data.rolePermissions` (ARRAY de strings por rol) Y en `roles.permissions` (JSONB objeto `{modulo:"read"|"write"}`, para RLS Capa 2 vía `fn_role_can`)** — son DOS formatos distintos, no confundir. Patrón de módulo: objeto global `render()/_buildHTML()/_loadData()/_attachEvents()`, template literals, `addEventListener` (no `onclick` inline), cache-bust `?v=N`. **`_esc`/`_escAttr` (XSS interno) en todo render de datos de usuario.**

---

## 2. Navegación destino + cambios de roles/permisos/RLS

### 2.1 Sidebar destino (5 grupos)

```
PRINCIPAL          → Lobby · Centro de Tareas · Calendario
COMERCIAL          → CRM · Cotizador · Catálogo
OPERACIONES        → Eventos · Proyectos · Calendario operativo
ACTIVOS (Q23)      → Inventario (sub-vista Equipos) · Flota · Locaciones
ADMIN & FINANZAS   → RRHH · Compras · Finanzas · Contabilidad · Rendimiento · Calendario-adm · Costos
```

- **Calendario operativo** = ítem navegable de OPERACIONES (no solo deep-link).
- **Grupo ACTIVOS** = nuevo en `Data.categories`; requiere color (Q23, reco violeta `#9B7DFF`). Confirmar nombre vs "RECURSOS".
- **Bajas:** `taller`, `logistica` (módulos disueltos → fuera del sidebar y router; quedan como **redirect** para no romper deep-links).

### 2.2 Cambios de rol

| Rol | Pierde | Gana | Conserva |
|---|---|---|---|
| **taller** | `taller`, `logistica` | `proyectos` (read-only, filtrado al gate Q1) · `locaciones` (read-only operativa, filtrado a `tipo IN ('taller','deposito')`) **— ojo: revierte SB4 (Q1.bis)** | `eventos` (read) · `inventario` (read, incl. Equipos) · `flota` (read) |
| **pm** | `taller`, `logistica` | — | resto intacto |
| **admin/superadmin** | (limpiar `taller`/`logistica` si están explícitos) | — | `all` |
| **venta** | — (no los tenía) | — | resto |

**Excepción de escritura (taller):** aunque Proyectos sea read-only, taller **tilda** el checklist de armado → write sobre `taller_proyecto_checklist` (no sobre `proyectos`), permitido por RLS para proyectos en taller (ver A.6).

### 2.3 RLS — patrón consolidado **(CORREGIDO por la revisión DDL)**

> **Tres correcciones críticas respecto del draft:**
> 1. **La función real es `public.fn_role_can(p_module text, p_need text DEFAULT 'read') → boolean`** (NO `fn_modulo_nivel`, NO devuelve string de nivel). Todo predicado de permiso usa `fn_role_can('modulo','read'|'write')`.
> 2. **`proyectos`/`locaciones`/`taller_proyecto_checklist` YA tienen policy blanket `<tabla>_rls_auth FOR ALL authenticated USING(true)`** (Capa 2, `rls_capa2_operativo.sql`). Con RLS las policies son **OR** — una policy `USING(true)` deja pasar TODO. **Hay que `DROP` esas blanket antes de crear las finas, o el filtro de taller NO aplica.**
> 3. **El invariante de Fase 9.bis es "RLS NO esconde filas entre oficina".** El row-filtering de taller es una **excepción explícita y acotada al rol taller** (taller no es "oficina"). Documentado como tal; no se aplica row-filtering a roles de oficina.

Patrón por tabla caliente:
- **SELECT oficina** (no-taller con permiso): `fn_role_can('proyectos','read') AND NOT (rol=taller)` → ve todo, sin filtro de fila.
- **SELECT taller**: rol taller + filtro de fila (gate Q1 / `tipo`).
- **WRITE oficina**: `fn_role_can('proyectos','write') AND NOT (rol=taller)`.
- **Excepción checklist**: taller UPDATE de `taller_proyecto_checklist` de proyectos en taller.

Tablas nuevas (`equipos`, `equipo_contenido`, `evento_transporte`, `evento_transporte_items`, `rutinas`): **RLS permisiva v1** (`FOR ALL authenticated USING(true)` con DELETE restringido a admin donde aplica; `rutinas` write = admin). **Consciente:** esto deja a taller (authenticated) técnicamente capaz de escribir `equipos`/`evento_transporte` a nivel DB — el lock fino vive en **UI + API** (consistente con la decisión "RLS permisiva v1, lock en UI"). Si se quiere enforcement DB real, cambiar el write de `equipos` a `fn_role_can('inventario','write')` (Q15).

### 2.4 Archivos de navegación tocados
`data.js` (`Data.rolePermissions`=arrays / `readOnlyPermissions` / `categories` con grupo ACTIVOS+color / `quickActions`), `router.js` (redirects + teardown registry; **corregir cadena `produccion`→`taller`→`tareas` a `produccion`→`tareas` directo** — R1), `app.js` (sidebar se alimenta de `categories`, verificar OPERACIONES no queda vacía), `admin-panel.js` (matriz de permisos se limpia sola al sacar módulos de `categories`), `sidebar-editor.js` (**bump `_configVersion` 5→6** — el valor actual es 5, `sidebar-editor.js:67` — para forzar rebuild del sidebar en todos los navegadores).

**Redirects (R6 — preservar sub-path/query):** `#taller`→`#tareas`, `#logistica`→`#eventos`. **Verificar que `Router.navigate(redirect)` preserve `?query`/sub-id** — notificaciones persistidas pueden tener `link:'#logistica?tab=cargas&id=X'` o `#proyectos/<id>?tab=novedades`. Si el router descarta el query al redirigir, esos deep-links se rompen → ajustar el redirect para conservar el sufijo o mapear los casos conocidos.

---

## 3. Áreas (en orden de fasado)

### 3.A — Equipos operativos en Inventario (+ contenedores) `[Fase B]`

**1. Destino.** Nueva tab "Equipos" en `inventario.js` (6ª, entre `materiales` y `movimientos`), layout split table+panel. Tabla filtrable (tipo/ubicación/estado, búsqueda `normStr`): Código · Nombre · Tipo (chip) · Ubicación · Estado (dot) · 🔧 rutina vencida · 📦+N si contenedor (fila expandible → manifiesto inline). Botón "+ Nuevo equipo" (código, nombre, `tipo_equipo`, `es_contenedor`, ubicación=locación galpón/depósito, estado, cantidad, notas). Panel: header inline · ubicación+"Mover" (+ "🚚 En tránsito — Evento X" derivado del último remito sin devolver) · estado operativo · **manifiesto** (si contenedor: equipo anidado XOR línea libre + cantidad/unidad) · **rutinas** (lista con semáforo + "marcar realizado" + "asignar rutina") · historial (remitos donde apareció) · notas · eliminar (guard si en manifiesto activo o remito sin devolver). Enlace al Transporte: equipo seleccionable como ítem de carga; contenedor ofrece "cargar canasto" / "desglosar contenido".

**Empty-states (E2):** canasto sin líneas → contador 📦 muestra `0`; cargar un contenedor vacío a remito permitido (sale como 1 línea, sin desglose). **(E8):** `equipos.ubicacion_id` apuntando a locación soft-deleted → panel muestra "Ubicación no disponible" (no rompe).

**2. Modelo.** Tabla nueva `equipos` (UUID) — NO extender `catalogo_items` (cotizables/receta → riesgo de fuga a lista de precios) ni `insumos_base` (consumibles/amortización). Tabla nueva `equipo_contenido` (manifiesto, XOR equipo/texto). **Rutinas → tabla global `rutinas`** (ver §3.E, decisión Q6). Remito → reusa `evento_transporte_items` con `item_type='equipo'`, `equipo_id` (decisión Q5). Legacy inglés `inventory_items`/`locations` no se toca.

**Migración (Q16):** si hay datos reales de matafuegos/herramientas en alguna tabla → migrarlos a `equipos` en esta fase. Si es greenfield → Fede carga los equipos a mano; sin paso de migración de datos.

**3. DDL.** `equipos` + `equipo_contenido` (ver §4 consolidado, Fase B). **`equipos.proveedor_id uuid REFERENCES proveedor(id)`** (FK declarada — consistencia, #6 revisión DDL).

**4. Código.** `inventario.js`: tab + `_buildEquiposHTML`/`_loadEquipos`/tabla/panel/manifiesto/rutinas/modales (`_openModalEquipo`, `_openModalManifiestoLinea`, `_moverEquipo`, `_toggleManifiestoRow`) + KPI dashboard (Equipos / Rutinas vencidas). `api.js`: bloque EQUIPOS (`getEquipos`/`getEquipoById` con manifiesto+rutinas/`createEquipo`/`updateEquipo`/`deleteEquipo` con guard+UndoHelpers / `getManifiesto`/`addManifiestoLinea`/`updateManifiestoLinea`/`deleteManifiestoLinea` / `getEquiposParaRemito`). `tareas.js`: las rutinas de equipos llegan vía la fuente `rutinas` global (§3.E), no una fuente `equipos` propia. `index.html`: bump.

**5. Pasos.** **Q16 confirmado (greenfield/migración)** → SQL (`equipos`+`equipo_contenido`) → `api.js` EQUIPOS → `inventario.js` tab→manifiesto→rutinas→modales→KPI → verificación end-to-end (alta canasto + manifiesto anidado+texto + rutina + mover + soft-delete con guard + empty-state canasto vacío) → push.

**6. Riesgos.** SQL-first obligatorio. Contenedor recursivo → cortar render a 1 nivel (Q17). `equipos.ubicacion_id` (dónde vive) ≠ `locaciones_stock` (cantidades). No se toca costeo/cotizador/listas de precio.

**7. Preguntas.** Q4 (nombre tabla), Q12 (individualización/lote), Q13 (manifiesto→remito default), Q16 (datos a migrar), permiso sub-vista (hereda `#inventario`), "en tránsito" derivado (sí, si el remito marca devuelto).

---

### 3.B — Locaciones = espacios físicos (vistas por rol + rutinas edilicias) `[Fase E]`

**1. Destino.** Mismo módulo `#locaciones`, sin fusión con Inventario. **Cara ADMIN** (4 tabs): Lugares (cards + contadores `📄 docs por vencer` / `🔧 rutinas pendientes` + **warning "N locaciones sin tipo clasificable"** si las hay — E6) · Ficha full-screen con sub-tabs (Datos+bloque alquiler/contrato · Documentación con semáforo · **Rutinas** · Stock read-only por lugar) · Documentación global · **Rutinas** global (tablero edilicio admin). **Cara OPERATIVA (rol taller):** solo `tipo IN ('taller','deposito')` (valores confirmados en Q2), sin contratos/$$, cards simples + tareas de mantenimiento edilicio pendientes (tildar = completar rutina). Venta: sin acceso v1.

**2. Modelo.** `locaciones` (BIGINT, se EXTIENDE con bloque alquiler: `alquiler_monto`/`alquiler_moneda`/`alquiler_dia_pago`/`contrato_vence`/`propietario`/`propietario_contacto`). NO migrar a UUID (arrastra `locaciones_stock.locacion_id`). `tipo` **ya existe** (`text NOT NULL`) → **NO se hace ALTER de `tipo`**; solo se auditan/normalizan valores (Q2). **Rutinas → tabla global `rutinas`** con `activo_tipo='locacion'`, `activo_id=locaciones.id::text` (bigint serializado a text, Q3). **Las tablas `locaciones_rutinas`/`_generadas` de la spec original quedan ELIMINADAS** por la decisión Q6 (motor único). `locaciones_documentos` sigue igual (doc puntual ≠ rutina recurrente, conviven).

**3. DDL.** ALTER `locaciones` (bloque alquiler). Las rutinas se cubren con `rutinas` global (Fase F). Ver §4.

**4. Código.** `locaciones.js`: Fase 0 cleanup (`_esc`/`_escAttr` en cards/ficha/docs/stock; `onclick="Modal.close()"`→`data-modal-close`; null-check parseInt FKs) · rol gating en `_loadLugares` (`role==='taller'`→`.in('tipo',['taller','deposito'])`) · `_renderOperativa()` para taller · ficha con sub-tabs · bloque alquiler en Datos · tab Rutinas (lee `rutinas` global, botón "Programar rutina" → modal de `rutinas`) · warning "sin tipo". `tareas.js`/`alertas.js`: las rutinas de locación llegan por la fuente `rutinas` global. `data.js`: agregar `locaciones` a rol taller. `index.html`: bump.

**5. Pasos.** **Auditar valores `locaciones.tipo` (Q2)** → SQL (ALTER locaciones bloque alquiler) + grant `locaciones` a taller (ya en Fase A) → Fase 0 cleanup → extender módulo (gating/operativa/ficha/alquiler/warning) → tab Rutinas (consume `rutinas`) → bump → verificación (admin 4 tabs + crear rutina → cae en Tareas/Alertas; taller ve solo taller/depósito + tilda).

**6. Riesgos.** SQL toca tabla viva (additivo, solo bloque alquiler). Cambio de acceso: taller gana ítem de menú nuevo (confirmar Q14). No romper Inventario (no se toca `locaciones_stock`). No se retira legacy. **Falla silenciosa si `tipo` no tiene valores taller/deposito (Q2 — mitigado con warning UI).**

**7. Preguntas.** Q2, Q14, Q21 (catálogo de rutinas), alquiler edilicio vs `vencimientos_recurrentes` financiero (Q8 — si lo manejás por Finanzas, saco `alquiler` del catálogo de rutinas), oficina con/sin rutinas, docs vs rutinas para habilitación/seguro.

---

### 3.C — Disolución de Taller → Proyectos read-only filtrado `[Fase C]`

> **⚠️ Revierte `taller_rol_sin_proyectos.sql` (SB4) — Q1.bis. Confirmar con Fede que el rediseño manda sobre esa decisión ANTES de construir.**

**1. Destino.** `taller.js` deja de ser ruta. Rol taller entra a **Proyectos** = vista read-only filtrada a confirmados en producción. **A)** Lista por rol: taller → filtro del gate Q1 (`estado='en_taller'` reco) en modo cards mobile-first (saludo "¡Hola!", banner novedades, "HOY/PRÓXIMOS DÍAS" por fecha de evento, tap≥44px); oficina → tabla actual sin cambios. **B)** Checklist de armado → tab "Producción" en `proyecto-detalle.js` (tildar inline en cards + estructura en ficha; primer check → `estado_taller: pendiente→en_armado`; botones "Marcar listo"/"Despachar" en header). El botón "🔨 Pasar a Taller" **se conserva intacto** (la compuerta). **C)** "Hoy" = Centro de Tareas filtrado a taller (fuente "armado-taller"). **D)** Mantenimiento → migra a Inventario/Equipos+Rutinas (Q18: se construye en Fase B, antes de esta fase).

**Empty-state (E3):** taller con 0 proyectos en el gate → "No tenés stands en producción hoy".

**Helpers a portar de `taller.js` (V3 — inventario explícito para que sea one-shot):** la card de stand (`_renderCard` o equivalente), el saludo "¡Hola!", el banner de novedades, la agrupación HOY/PRÓXIMOS por fecha de evento, el tildado inline del checklist, los botones de transición de estado. Destino: `proyectos.js` (lista cards galpón) + `proyecto-detalle.js` (tab Producción/checklist). **Auditar `taller.js` y listar los métodos exactos antes de portar.**

**2. Modelo.** CERO tablas nuevas. `proyectos` (gate Q1), `taller_proyecto_checklist`, `proyecto_novedades` reutilizadas. `roles.permissions`: taller gana `proyectos`+`locaciones`, pierde `taller` (revierte SB4).

**3. DDL.** Solo RBAC (`roles.permissions`) + RLS finas (SELECT taller filtrado + UPDATE checklist acotado). **Va en Fase A** (el RBAC/RLS); la disolución de código va en Fase C.

**4. Código.** `router.js` (redirect `#taller`→`#tareas`, sacar `TallerModule` del teardown, **fix `produccion`→`tareas`** R1). `data.js` (rolePermissions taller, sacar de `categories`, bump `_configVersion`). `proyectos.js` (`_loadData`/`_render`/`_attach` bifurcados por rol; portar cards galpón de `taller.js` — lista V3). `proyecto-detalle.js` (tab "Producción" con checklist portado + botones estado; "Pasar a Taller" intacto). `tareas.js` (fuente "armado-taller"). `index.html` (bump; `taller.js?v=N` se deja cargado como red de seguridad **hasta el corte destructivo**). `api.js` SIN cambios de contrato (reusa `getChecklistsBulk`/`setChecklistItemChecked`/`setEstadoTaller`/etc.). **Destructivo posterior (con OK):** quitar `<script taller.js>` + borrar archivo.

**5. Pasos.** **Fede confirma Q1.bis (revertir SB4) + Q1 (gate)** + corre RBAC/RLS (Fase A) → `data.js` → `proyecto-detalle.js` (tab Producción primero) → `proyectos.js` (bifurcación) → `tareas.js` (fuente) → `router.js` (redirects+fix) → bump → verificar con usuario taller real → **solo si pasa:** corte destructivo de `taller.js` (commit aparte, reversible).

**6. Riesgos.** Q1 BLOQUEANTE (gate debe coincidir RLS↔JS, no usar `estado_taller IS NOT NULL` si no discrimina). Q1.bis (revierte SB4 — confirmar). RBAC: no quitar `taller` del JSONB hasta confirmar que `proyectos` entró. Borrar `taller.js` = destructivo (commit aparte, reversible, alias activo). Bump `_configVersion` obligatorio. Auto-transición `pendiente→en_armado` debe disparar desde la ficha.

**7. Preguntas.** Q1, Q1.bis, Q14, Q15 (blindaje), Q16/Q18 (mantenimiento), Q19 (tildado), "¿taller ve todos los del gate o solo asignados?".

---

### 3.D — Transporte en la ficha del Evento + Remito `[Fase D]`

**1. Destino.** Sección "Transporte" colapsable en la ficha del Evento (`eventos.js`), nivel "Equipo asignado"/"Documentos". Cards por vehículo (id+patente+chip propietario [`es_propio` → MEPEX/Tercero], chofer+`wa.me`, fase, fecha/hora, "N stands · M equipos" expandible, estado remito, acciones Editar/Remito/Foto firmada/Eliminar). Botón "+ Agregar vehículo" → editor inline (selector Flota propios + "➕ Ajeno ad-hoc" con toggle guardar-en-Flota/solo-este-viaje [Q9]; fase/fecha/hora/destino=predio/notas; **qué lleva**: stands/proyectos del evento + equipos operativos [contenedor→detallar contenido] + ítems manuales). Botón "Generar remito del evento" (PDF consolidado). Remito por vehículo y por evento; firma = foto (`<input capture=environment>`)→Storage, sin flujo de estados. "Qué sale hoy" → tab en Flota + Calendario operativo (Q11).

**Empty-states:** **(E1)** evento sin transporte → "Sin transporte cargado"; "Generar remito del evento" deshabilitado si 0 vehículos. **(E4)** vehículo ajeno "solo este viaje" → validar `vehiculo_adhoc_descripcion` no vacío; en el remito sale sin patente si `vehiculo_adhoc_patente` es null (mostrar "s/patente").

**2. Modelo.** Tabla nueva `evento_transporte` (cabecera: vehículo del pool o ad-hoc inline, chofer, fase, fecha, destino, remito urls) + `evento_transporte_items` (polimórfico: `item_type proyecto|equipo|manual`, `proyecto_id`/`equipo_id`/`descripcion_manual`, `cantidad`, `detallar_contenido`). **Retira de uso** (inertes, no DROP): `cargas`/`carga_proyectos`/`carga_personas`/`logistica_movimientos`/`logistica_vehiculos`/`logistica_remito`/`remitos`. `equipo_id` → FK a `equipos` (existe tras Fase B). (Decisión Q5.) **`vehiculos.es_propio` (Q10):** ALTER + backfill explícito (NO heurístico de string) — va en `reorg_d`.

**3. DDL.** `evento_transporte` + `evento_transporte_items` + RLS + `vehiculos.es_propio`. **`_deleted`/`created_at` con `NOT NULL DEFAULT`** (#9 revisión DDL, alinear al patrón). Ver §4 (Fase D).

**4. Código.** `api.js`: bloque TRANSPORTE EVENTO (`getTransporteByEvento`/`getTransporteById`/`getSalidasHoy` [hoy + en-tránsito sin firmar, Q11]/`getTransporteByEventos` bulk/`createTransporte`/`updateTransporte`/`setTransporteItems`/`deleteTransporte`/`crearVehiculoAdhoc`/`setTransporteRemitoPDF`/`uploadTransporteRemitoFirmado`/`es_propio` en createVehiculo); marcar `cargas`/`approveCarga`/etc. `@deprecated`. `remito-pdf.js`: `generate(transporteId)` sobre `evento_transporte_items` (proyecto/equipo/manual; si `detallar_contenido`+manifiesto→expandir 1 nivel, Q17) + `generateEvento(eventoId)` **consolidado = un PDF con N bloques (uno por vehículo), paginación por bloque** (V2 — layout definido). Hook "detallar contenido" llama `API.getManifiesto(equipoId)`. `eventos.js`: reescribir sección Transporte (`_loadTransporteSection` [hoy lee `cargas`+`logistica_movimientos` en paralelo, eventos.js:1809] → `getTransporteByEvento`; `_renderPanelTransporte`; eliminar fallback legacy + deep-link `#logistica` **tras gate Q20**). `calendario-operativo.js`: reapuntar el bulk actual (`getCargasByEventos` o equivalente — **identificar el método exacto antes de tocar**, V4) + panel + sección a `evento_transporte` (`Promise.allSettled`; empty-state si vacío). `flota.js`: tab "Salidas de hoy" (`getSalidasHoy`) + flag `es_propio`+filtro+"Ajeno rápido"+sección Plata condicionada. **Desconectar logística:** `router.js`/`data.js`/`index.html`(quitar `<script logistica.js>`)/`roles.permissions`. Bump.

**5. Pasos.** **Fase B corrida (FK `equipo_id`)** → **gate Q20 (`count(*)` de cargas/logistica vivos)** + **Q10 (regla `es_propio`)** → SQL (`evento_transporte*` + `vehiculos.es_propio` + backfill) → confirmar bucket `remitos` existe → `api.js` TRANSPORTE → `remito-pdf.js` parametrizar (generate + generateEvento) → `eventos.js` reescribir sección → `calendario-operativo.js` reapuntar → `flota.js` tab+es_propio → desconectar logística → verificación (transporte propio+ad-hoc, stands+equipos+manual, remito por vehículo y evento, foto firmada, Calendario+Flota, soft-delete, empty-states E1/E4).

**6. Riesgos.** Disolver Logística = pierde workflow de aprobación (Q20 confirmar 0 cargas vivas con `count(*)`). Eliminar fallback legacy en eventos (Q20 data a preservar). `equipo_id` depende de Fase B (orden B→D; el SQL D no es defensivo ante `equipos` inexistente → **nota en cabecera "requiere reorg_b corrido"**, R5). Reapuntar Calendario con `allSettled`. DROP de cargas/logistica = destructivo futuro, NO en este build. **Redirect `#logistica?tab=...` debe preservar query (R6).**

**7. Preguntas.** Q5, Q9, Q10, Q11, Q20, formato remito consolidado (bloque por vehículo — resuelto V2), quién emite/firma remitos (cualquier operativo vs admin), granularidad de fase.

---

### 3.E — Centro de Tareas v2: motor de recurrentes `[Fase F]`

> **⚠️ Confirmar que la tabla `tareas` existe con las columnas que el motor necesita (V1).** El blueprint materializa instancias en `tareas` con `origen='rutina'`, `fecha_limite`, `dedupe_key`, pero `tareas` NO está en `docs/schema-prod.md` y el motor `tareas.js._gen` actual es **100% en-memoria** (`es_derivada:true`, sin path de escritura). **Antes de Fase F:** verificar columnas reales de `tareas` (`sql/fase11_tareas.sql`) — ¿tiene `origen`/`dedupe_key`/`fecha_limite`/`estado`? Si faltan, agregarlas al DDL de Fase F. **El `CREATE UNIQUE INDEX` anti-duplicado sobre `dedupe_key` va en el DDL de esta fase.**

**1. Destino.** Motor de tareas recurrentes que materializa RUTINAS de activos (Flota/Locaciones/Equipos/Admin) como tareas en la misma bandeja. 3 clases: derivadas (en vivo, memoria) · **recurrentes (nuevas, persistentes — escriben fila en `tareas`)** · manuales. Generación client-side al entrar a `#tareas`/lobby: lee plantillas activas en ventana (`lead_days`) o vencidas → materializa (upsert por `dedupe_key`) instancia en `tareas` (`origen='rutina'`, `fecha_limite=proxima_fecha`, rol/responsable heredados; fallback admin si ambos null — E5/Q25). Al marcar Hecha: sella `ultima_ejecucion`, avanza `proxima_fecha` (Q7), opcionalmente sella el activo (`sello_tabla/columna/id`). **Pestaña "Rutinas"** (admin-level, Q24): grilla de plantillas (alta/baja/edición/pausar). Chip "🔁 Rutina" + activo de origen, click → ficha del activo. Botón "Programar rutina" en fichas de Flota/Locaciones/Inventario-Equipos (el agregador).

**2. Modelo.** Tabla nueva `rutinas` (plantilla) + reuso de `tareas` (instancia; **agregar columnas si faltan — V1**). NO reusar `vencimientos_*` (dominio Finanzas, genera egreso; Q8 saca los seeds financieros). `rutinas`: `activo_tipo flota|locacion|equipo|inventario|admin|general`, **`activo_id text`** (FK lógica polimórfica uniforme, cubre uuid y bigint — Q3/#8), `activo_label` snapshot (evita JOINs), `modulo`, `target_role`/`responsable_id`, `frecuencia mensual|trimestral|semestral|anual|dias`+`intervalo_dias`, `lead_days`, `proxima_fecha`, `ultima_ejecucion`, `sello_tabla/columna/id`, `reprog_desde` (Q7), `activa`, `_deleted`. **Esta es la tabla única que absorbe las rutinas de TODAS las áreas** (decisión Q6). `produccion_mantenimiento` se reusa solo como destino de sello (Flota VTV/service); NO se extiende con `equipo_id`/`locacion_id`/`frecuencia`.

**Sello + permisos (M12 revisión DDL):** `rutinas_write` policy = admin/superadmin. Pero las rutinas de taller (ej. inventario físico, `target_role='taller'`) las marca un taller → no podría hacer UPDATE de `rutinas` para sellar/avanzar. **Solución:** `avanzarRutina` corre vía **RPC `SECURITY DEFINER`** (`fn_avanzar_rutina(rutina_id, fecha)`) que calcula próxima fecha + sella, eludiendo la RLS de escritura. Así taller marca Hecha y la rutina reprograma. (Alternativa: policy UPDATE que permita al `responsable_id`/`target_role` avanzar su propia rutina; RPC es más simple.)

**3. DDL.** `rutinas` + índices + RLS (SELECT amplio, write admin) + trigger `updated_at` + **RPC `fn_avanzar_rutina` SECURITY DEFINER** + seed transversal **NO-financiero** (Q8: backup/inventario físico + activos físicos; **NO** cierre contable/impositivos/ARCA — esos quedan en `vencimientos_recurrentes`) + grant `rutinas:write` + (si faltan) ALTER `tareas` `origen`/`dedupe_key`/`fecha_limite` + `CREATE UNIQUE INDEX` anti-dup. Ver §4 (Fase F).

**4. Código.** `sql/reorg_f_rutinas.sql`. `api.js`: bloque RUTINAS (`getRutinas`/`getRutinasDue`/`createRutina`/`updateRutina`/`deleteRutina`/`avanzarRutina` [llama RPC `fn_avanzar_rutina`]). `tareas.js`: generador `rutinas` en `_gen` (**materializa persistente con upsert por `dedupe_key`** — cambio concreto: hoy `_gen` solo arma derivadas en memoria; agregar rama que hace INSERT idempotente a `tareas`), `_deriveForRole` suma `rutinas`, `_action` rama 'hecha' → `avanzarRutina` si `origen==='rutina'` (**+ persistir el cierre de la instancia en `tareas`**), pestaña "Rutinas" en `_shell` (gated admin), `_renderRutinas`/`_rutinaModal`, chip en `_card`. Helper reusable `Rutinas.openProgramar({activo_tipo,activo_id,activo_label,modulo})` llamado desde `flota.js`/`locaciones.js`/`inventario.js` (botones diferibles a 2ª pasada). `data.js`+`roles.permissions`: permiso `rutinas`. `index.html`: bump.

**5. Pasos.** **Verificar schema (Q3 `activo_id text`, `produccion_mantenimiento` columnas de sello, columnas reales de `tareas` — V1, `gen_random_uuid`)** → Fede corre `sql/reorg_f_rutinas.sql` + ajusta `proxima_fecha` del seed → `api.js` RUTINAS → `tareas.js` (generador persistente+pestaña+sync hecha vía RPC+chip) → `data.js` permiso + bump → verificación (rutina `proxima_fecha=hoy` → instancia "Hoy" con chip → Hecha → instancia cierra + `proxima_fecha` avanzó + `ultima_ejecucion=hoy` + reentrar no duplica + taller puede avanzar su rutina vía RPC) → 2ª pasada: botones "Programar rutina".

**6. Riesgos.** NO destructivo (tabla nueva, seed idempotente). Q3 (id type → `text`). **`tareas` debe existir con columnas correctas (V1 bloqueante).** Materialización persistente → `tareas` crece con histórico (deseable). Dedupe_key con fecha + índice único anti-duplicado. Sello best-effort (RPC SECURITY DEFINER evita el bloqueo de RLS; aun así try/catch, rutina avanza igual). Solapamiento con `vencimientos_recurrentes` (Q8 — mitigado sacando seeds financieros).

**7. Preguntas.** Q6, Q7, Q8, Q3, Q24, Q25, V1 (existe `tareas`?), lead time por rutina.

---

### 3.F — Navegación, roles, permisos y RLS (transversal) `[Fase A]`

**1. Destino.** Ver §2. Es la **primera** fase (habilita todo lo demás): reconfigura sidebar, RBAC y RLS para que taller entre a Proyectos/Locaciones filtrados y se preparen los grants.

**2. Modelo.** `roles.permissions` (edita contenido objeto `{modulo:nivel}`, no schema) + gate Q1 en `proyectos` + `locaciones.tipo` (discriminador, valores Q2) + `taller_proyecto_checklist` (write acotado). **RBAC en DOS lados:** `Data.rolePermissions` (arrays en `data.js`) Y `roles.permissions` (JSONB en DB) — formatos distintos.

**3. DDL.** **DROP de las policies blanket de Capa 2** (`proyectos_rls_auth`, `locaciones_rls_auth`, `taller_proyecto_checklist_rls_auth`) **ANTES** de crear las finas (#3/B2/R2 revisiones) + RBAC (UPDATE roles taller/pm con `||`/`-` sobre objeto JSONB) + RLS proyectos (SELECT oficina sin filtro / SELECT taller filtrado por gate Q1 / WRITE oficina) + RLS locaciones (idem por `tipo`) + RLS checklist (SELECT all, UPDATE taller acotado, ALL oficina) + (condicional Q1.c) `en_taller BOOLEAN`. **Todas las policies usan `fn_role_can(modulo, nivel)`, NO `fn_modulo_nivel`.** Ver §4 (Fase A).

**4. Código.** `data.js` (rolePermissions/readOnlyPermissions/categories+ACTIVOS+color/quickActions), `router.js` (redirects+teardown+fix `produccion`→`tareas`), `proyectos.js`/`proyecto-detalle.js` (read-only taller + checklist — código en Fase C), `locaciones.js` (operativa taller — código en Fase E), `app.js` (verificar OPERACIONES no queda vacía), `admin-panel.js` (matriz se limpia sola), `sidebar-editor.js` (bump `_configVersion` 5→6), `index.html` (bump).

> **Nota de orden:** la parte de **código** de la disolución de Taller (cards galpón, tab Producción) vive en Fase C; Fase A hace solo el RBAC/RLS/nav-shell. Locaciones operativa (código) vive en Fase E. Fase A deja los grants y filtros base listos.

**5. Pasos.** **Verificar schema + cerrar Q1/Q1.bis/Q2/Q23** → Fede corre DROP blanket + RBAC + policies finas (con `fn_role_can`, gate Q1) → auditar/normalizar `locaciones.tipo` (Q2) → editar nav (data.js/router.js/sidebar-editor bump) → **verificar lectura admin/oficina ANTES de dar por bueno** (que el DROP+policies finas no oculten filas a oficina) → verificar con usuario taller (sidebar correcto, redirects con query preservado, sin 404).

**6. Riesgos.** Q1/Q1.bis/Q2 bloqueantes. **Activar policies finas sobre `proyectos`/`locaciones` (calientes) sin dropear las blanket = filtro no aplica (OR); con DROP mal hecho = oficina pierde acceso → probar lectura admin ANTES (R2).** `NOT EXISTS(role='taller')` asume solo rol base taller (roles custom = documentar). No borrar `taller.js`/`logistica.js` acá (solo redirect, con query preservado R6). **No reasumir SB4 sin confirmar Q1.bis.**

**7. Preguntas.** Q1, Q1.bis, Q2, Q23, Q14, roles custom.

---

## 4. DDL consolidado (todas las migraciones DRAFT, por fase)

> **REGLA:** verificar contra `information_schema`/`docs/schema-prod.md` ANTES de cada corrida. `gen_random_uuid()` (pgcrypto) disponible. Sin DROPs de tablas (los destructivos van comentados). **La función de permisos real es `public.fn_role_can(p_module text, p_need text) → boolean` — NO existe `fn_modulo_nivel`.** Forma de `roles.permissions` = objeto `{modulo:"read"|"write"}`.

### ▶ Correr ANTES de Fase A — `sql/reorg_a_nav_roles_rls.sql`

```sql
-- DRAFT: verificar contra information_schema antes de correr.
-- ⚠️ Esta migración REVIERTE sql/taller_rol_sin_proyectos.sql (SB4): vuelve a dar 'proyectos' al rol taller. Confirmar Q1.bis.
-- ⚠️ Usa fn_role_can(modulo, nivel) — la función real de Capa 2 (rls_capa2_motor.sql). NO fn_modulo_nivel.

-- ===== A.0 DROP de policies blanket de Capa 2 (sino el row-filtering de taller NO aplica por OR) =====
DROP POLICY IF EXISTS proyectos_rls_auth ON public.proyectos;
DROP POLICY IF EXISTS locaciones_rls_auth ON public.locaciones;
DROP POLICY IF EXISTS taller_proyecto_checklist_rls_auth ON public.taller_proyecto_checklist;

-- ===== A.1 RBAC: rol taller gana proyectos+locaciones, pierde taller/logistica; pm pierde taller/logistica =====
-- roles.permissions es objeto {modulo:"read"|"write"} (confirmado rls_capa2_motor.sql:12).
UPDATE public.roles
SET permissions = jsonb_strip_nulls(
      (permissions - 'taller' - 'logistica')
      || jsonb_build_object('proyectos','read','locaciones','read',
                            'eventos','read','inventario','read','flota','read')),
    updated_at = now()
WHERE id = 'taller';

UPDATE public.roles
SET permissions = (permissions - 'taller' - 'logistica'), updated_at = now()
WHERE id = 'pm';
-- UPDATE public.roles SET permissions = (permissions - 'taller' - 'logistica')
--   WHERE id IN ('superadmin','admin') AND permissions ? 'taller';

-- ===== A.2 Gate de visibilidad taller (CONDICIONAL Q1.c — solo si elegís en_taller explícito) =====
-- ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS en_taller boolean NOT NULL DEFAULT false;
-- UPDATE public.proyectos SET en_taller = true WHERE estado = 'en_taller' AND en_taller = false;
-- NOTA: si el gate elegido es estado='en_taller' (reco Q1), NO se agrega columna; el filtro va en las policies de abajo.

-- ===== A.3 locaciones.tipo — NO se hace ALTER (la columna YA existe text NOT NULL). =====
-- Solo auditar/normalizar valores (Q2): SELECT tipo, count(*) FROM locaciones GROUP BY tipo;
-- Backfill manual de Fede a la taxonomía taller|deposito|oficina|showroom si hace falta.

-- ===== A.4 RLS proyectos (gate Q1 = estado='en_taller'; ajustar si elegís otro) =====
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proyectos_select_oficina ON public.proyectos;
CREATE POLICY proyectos_select_oficina ON public.proyectos FOR SELECT TO authenticated
  USING (public.fn_role_can('proyectos','read')
         AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='taller'));
DROP POLICY IF EXISTS proyectos_select_taller ON public.proyectos;
CREATE POLICY proyectos_select_taller ON public.proyectos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='taller' AND p.active=true)
         AND estado = 'en_taller'                        -- gate Q1 (NO usar estado_taller IS NOT NULL salvo prod confirme)
         AND COALESCE(_deleted,false)=false);
DROP POLICY IF EXISTS proyectos_write_oficina ON public.proyectos;
CREATE POLICY proyectos_write_oficina ON public.proyectos FOR ALL TO authenticated
  USING (public.fn_role_can('proyectos','write')
         AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='taller'))
  WITH CHECK (public.fn_role_can('proyectos','write')
         AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='taller'));

-- ===== A.5 RLS locaciones (filtro taller por tipo — valores confirmados en Q2) =====
ALTER TABLE public.locaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS locaciones_select_oficina ON public.locaciones;
CREATE POLICY locaciones_select_oficina ON public.locaciones FOR SELECT TO authenticated
  USING (public.fn_role_can('locaciones','read')
         AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='taller'));
DROP POLICY IF EXISTS locaciones_select_taller ON public.locaciones;
CREATE POLICY locaciones_select_taller ON public.locaciones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='taller' AND p.active=true)
         AND tipo IN ('taller','deposito') AND COALESCE(_deleted,false)=false);
DROP POLICY IF EXISTS locaciones_write_oficina ON public.locaciones;
CREATE POLICY locaciones_write_oficina ON public.locaciones FOR ALL TO authenticated
  USING (public.fn_role_can('locaciones','write')
         AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='taller'))
  WITH CHECK (public.fn_role_can('locaciones','write')
         AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='taller'));

-- ===== A.6 RLS taller_proyecto_checklist (write acotado para taller; gate Q1) =====
ALTER TABLE public.taller_proyecto_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checklist_select_all ON public.taller_proyecto_checklist;
CREATE POLICY checklist_select_all ON public.taller_proyecto_checklist FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS checklist_update_taller ON public.taller_proyecto_checklist;
CREATE POLICY checklist_update_taller ON public.taller_proyecto_checklist FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proyectos pr JOIN public.profiles p ON p.id=auth.uid()
                 WHERE pr.id = taller_proyecto_checklist.proyecto_id
                   AND pr.estado = 'en_taller'           -- gate Q1
                   AND (p.role='taller' OR public.fn_role_can('proyectos','write'))
                   AND p.active=true))
  WITH CHECK (true);
DROP POLICY IF EXISTS checklist_all_oficina ON public.taller_proyecto_checklist;
CREATE POLICY checklist_all_oficina ON public.taller_proyecto_checklist FOR ALL TO authenticated
  USING (public.fn_role_can('proyectos','write'))
  WITH CHECK (public.fn_role_can('proyectos','write'));
```

### ▶ Correr ANTES de Fase B — `sql/reorg_b_equipos.sql`

```sql
-- DRAFT: verificar contra information_schema antes de correr (proveedor.id uuid, locaciones.id bigint).
CREATE TABLE IF NOT EXISTS equipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text, nombre text NOT NULL,
  tipo_equipo text NOT NULL DEFAULT 'otro',
  es_contenedor boolean NOT NULL DEFAULT false,
  ubicacion_id bigint,                       -- → locaciones.id (bigint, FK lógica)
  estado text NOT NULL DEFAULT 'operativo',
  cantidad int NOT NULL DEFAULT 1,
  proveedor_id uuid REFERENCES proveedor(id),  -- FK declarada (consistencia)
  valor_compra numeric, fecha_compra date, foto_url text, notas text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  _deleted boolean NOT NULL DEFAULT false
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='equipos_tipo_chk') THEN
    ALTER TABLE equipos ADD CONSTRAINT equipos_tipo_chk
      CHECK (tipo_equipo IN ('carro','escalera','contenedor','vidriero','herramienta','matafuego','maquina','otro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='equipos_estado_chk') THEN
    ALTER TABLE equipos ADD CONSTRAINT equipos_estado_chk
      CHECK (estado IN ('operativo','en_reparacion','fuera_de_servicio','baja'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_equipos_ubicacion ON equipos(ubicacion_id) WHERE _deleted=false;
CREATE INDEX IF NOT EXISTS idx_equipos_tipo ON equipos(tipo_equipo) WHERE _deleted=false;

CREATE TABLE IF NOT EXISTS equipo_contenido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contenedor_id uuid NOT NULL,                 -- → equipos.id
  contenido_equipo_id uuid,                    -- → equipos.id (anidado)
  contenido_texto text, cantidad numeric NOT NULL DEFAULT 1, unidad text, notas text,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), _deleted boolean NOT NULL DEFAULT false
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='equipo_contenido_xor_chk') THEN
    ALTER TABLE equipo_contenido ADD CONSTRAINT equipo_contenido_xor_chk
      CHECK ((contenido_equipo_id IS NOT NULL) <> (contenido_texto IS NOT NULL));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_equipo_contenido_cont ON equipo_contenido(contenedor_id) WHERE _deleted=false;

ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipo_contenido ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='equipos' AND policyname='equipos_all_auth') THEN
    CREATE POLICY equipos_all_auth ON equipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='equipo_contenido' AND policyname='equipo_contenido_all_auth') THEN
    CREATE POLICY equipo_contenido_all_auth ON equipo_contenido FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
-- Equipos NO es módulo nuevo (vive en #inventario) → sin grant de ruta. Permiso opcional 'inventario:equipos' si se gatea aparte.
-- ⚠️ RLS v1 permisiva: taller (authenticated) puede técnicamente escribir equipos. Lock en UI/API (Q15).
--    Si querés enforcement DB: cambiar write a USING (public.fn_role_can('inventario','write')).
```

### ▶ Fase C — sin DDL nuevo (usa RBAC/RLS de Fase A). Solo código (disolución de Taller).

### ▶ Correr ANTES de Fase D — `sql/reorg_d_transporte.sql`

```sql
-- DRAFT: verificar contra information_schema (vehiculos.id uuid, personas.id uuid, eventos/proyectos uuid).
-- ⚠️ REQUIERE reorg_b_equipos.sql CORRIDO (FK equipo_id → equipos). Si equipos no existe, este script falla.
-- ⚠️ GATE Q20 antes de cortar lectura legacy en eventos.js:
--    SELECT count(*) FROM cargas WHERE _deleted=false;            -- debe ser 0 (o decidir migración)
--    SELECT count(*) FROM logistica_movimientos WHERE _deleted=false;

-- ===== D.0 vehiculos.es_propio (Q10 — backfill EXPLÍCITO, no heurístico de string) =====
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS es_propio boolean NOT NULL DEFAULT true;
-- Backfill a confirmar con Fede (Q10). Candidato (revisar antes de correr):
-- UPDATE public.vehiculos SET es_propio = (valor_compra IS NOT NULL OR fecha_compra IS NOT NULL);

CREATE TABLE IF NOT EXISTS evento_transporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES eventos(id),
  vehiculo_id uuid REFERENCES vehiculos(id),
  vehiculo_adhoc_descripcion text, vehiculo_adhoc_patente text, vehiculo_adhoc_propietario text,
  chofer_persona_id uuid REFERENCES personas(id), chofer_nombre text, chofer_telefono text,
  fase text CHECK (fase IN ('armado','intermedio','desarme')),
  fecha date, hora_salida time, destino text, notas text,
  remito_pdf_url text, remito_firmado_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  _deleted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_evento_transporte_evento ON evento_transporte(evento_id) WHERE _deleted=false;
CREATE INDEX IF NOT EXISTS idx_evento_transporte_fecha ON evento_transporte(fecha) WHERE _deleted=false;

CREATE TABLE IF NOT EXISTS evento_transporte_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transporte_id uuid NOT NULL REFERENCES evento_transporte(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('proyecto','equipo','manual')),
  proyecto_id uuid REFERENCES proyectos(id),
  equipo_id uuid REFERENCES equipos(id),     -- existe tras Fase B
  descripcion_manual text, cantidad numeric DEFAULT 1, detallar_contenido boolean DEFAULT false,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  _deleted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_evento_transporte_items_transporte ON evento_transporte_items(transporte_id) WHERE _deleted=false;

ALTER TABLE evento_transporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_transporte_items ENABLE ROW LEVEL SECURITY;
-- SELECT/INSERT/UPDATE authenticated; DELETE admin/superadmin (DO blocks idempotentes)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte' AND policyname='et_select') THEN
    CREATE POLICY et_select ON evento_transporte FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte' AND policyname='et_insert') THEN
    CREATE POLICY et_insert ON evento_transporte FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte' AND policyname='et_update') THEN
    CREATE POLICY et_update ON evento_transporte FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte' AND policyname='et_delete') THEN
    CREATE POLICY et_delete ON evento_transporte FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','superadmin'))); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte_items' AND policyname='eti_select') THEN
    CREATE POLICY eti_select ON evento_transporte_items FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte_items' AND policyname='eti_insert') THEN
    CREATE POLICY eti_insert ON evento_transporte_items FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte_items' AND policyname='eti_update') THEN
    CREATE POLICY eti_update ON evento_transporte_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte_items' AND policyname='eti_delete') THEN
    CREATE POLICY eti_delete ON evento_transporte_items FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','superadmin'))); END IF;
END $$;
```

### ▶ Correr ANTES de Fase E — `sql/reorg_e_locaciones.sql`

```sql
-- DRAFT: verificar contra information_schema (confirmar locaciones no tiene alquiler_*). tipo YA existe → no se toca.
ALTER TABLE locaciones ADD COLUMN IF NOT EXISTS alquiler_monto numeric;
ALTER TABLE locaciones ADD COLUMN IF NOT EXISTS alquiler_moneda text NOT NULL DEFAULT 'ARS';
ALTER TABLE locaciones ADD COLUMN IF NOT EXISTS alquiler_dia_pago int;
ALTER TABLE locaciones ADD COLUMN IF NOT EXISTS contrato_vence date;
ALTER TABLE locaciones ADD COLUMN IF NOT EXISTS propietario text;
ALTER TABLE locaciones ADD COLUMN IF NOT EXISTS propietario_contacto text;
-- grant 'locaciones' a rol taller en roles.permissions (ya cubierto en Fase A.1; verificar).
-- NO se crean locaciones_rutinas/_generadas — las rutinas viven en la tabla global `rutinas` (Fase F).
-- NO se hace ALTER de `tipo` (ya existe text NOT NULL); solo auditar valores (Q2).
```

### ▶ Correr ANTES de Fase F — `sql/reorg_f_rutinas.sql`

```sql
-- DRAFT: verificar tipos de id (Q3 → activo_id text); columnas reales de `tareas` (V1: origen/dedupe_key/fecha_limite);
--        produccion_mantenimiento (destino de sello). gen_random_uuid disponible.

-- ===== F.0 (CONDICIONAL V1) si a `tareas` le faltan columnas para materializar rutinas =====
-- ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS origen text;          -- 'derivada'|'rutina'|'manual'
-- ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS dedupe_key text;      -- 'rutina:{id}:{fecha}'
-- ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS fecha_limite date;
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_tareas_dedupe ON public.tareas(dedupe_key) WHERE dedupe_key IS NOT NULL AND COALESCE(_deleted,false)=false;

CREATE TABLE IF NOT EXISTS rutinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL, descripcion text,
  activo_tipo text NOT NULL,            -- flota|locacion|equipo|inventario|admin|general
  activo_id text,                       -- FK lógica polimórfica (uuid o bigint serializado); NULL si transversal (Q3)
  activo_label text,
  modulo text NOT NULL DEFAULT 'general',
  target_role text, responsable_id uuid REFERENCES profiles(id),
  prioridad text NOT NULL DEFAULT 'normal',
  frecuencia text NOT NULL,             -- mensual|trimestral|semestral|anual|dias
  intervalo_dias int, lead_days int NOT NULL DEFAULT 7,
  proxima_fecha date NOT NULL, ultima_ejecucion date,
  reprog_desde text NOT NULL DEFAULT 'completada',  -- completada|programada (Q7)
  sello_tabla text, sello_columna text, sello_id text,
  activa boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  _deleted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_rutinas_activa ON rutinas(activa, proxima_fecha) WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_rutinas_activo ON rutinas(activo_tipo, activo_id) WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_rutinas_role ON rutinas(target_role) WHERE NOT _deleted;

ALTER TABLE rutinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rutinas_select ON rutinas;
CREATE POLICY rutinas_select ON rutinas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rutinas_write ON rutinas;
CREATE POLICY rutinas_write ON rutinas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','superadmin')));

CREATE OR REPLACE FUNCTION set_rutinas_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rutinas_updated ON rutinas;
CREATE TRIGGER trg_rutinas_updated BEFORE UPDATE ON rutinas FOR EACH ROW EXECUTE FUNCTION set_rutinas_updated_at();

-- ===== F.1 RPC para avanzar rutina (SECURITY DEFINER — permite a taller cerrar su rutina pese a rutinas_write=admin) =====
CREATE OR REPLACE FUNCTION fn_avanzar_rutina(p_rutina_id uuid, p_fecha date DEFAULT current_date)
RETURNS void AS $$
DECLARE r rutinas%ROWTYPE; v_base date; v_next date;
BEGIN
  SELECT * INTO r FROM rutinas WHERE id = p_rutina_id AND NOT _deleted;
  IF NOT FOUND THEN RETURN; END IF;
  v_base := CASE WHEN r.reprog_desde = 'programada' THEN r.proxima_fecha ELSE p_fecha END;
  v_next := CASE r.frecuencia
              WHEN 'mensual'    THEN v_base + interval '1 month'
              WHEN 'trimestral' THEN v_base + interval '3 month'
              WHEN 'semestral'  THEN v_base + interval '6 month'
              WHEN 'anual'      THEN v_base + interval '1 year'
              WHEN 'dias'       THEN v_base + (COALESCE(r.intervalo_dias,30) || ' days')::interval
              ELSE v_base + interval '1 month'
            END::date;
  UPDATE rutinas SET ultima_ejecucion = p_fecha, proxima_fecha = v_next, updated_at = now()
   WHERE id = p_rutina_id;
  -- Sello best-effort del activo (try/catch en el caller; aquí condicional simple)
  -- (el sello específico por tabla/columna lo aplica el JS o un bloque dinámico si se decide)
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed transversal NO-FINANCIERO (Q8: cierre/impuestos/ARCA quedan en vencimientos_recurrentes).
-- Idempotente; ajustar proxima_fecha real antes de correr.
INSERT INTO rutinas (titulo, descripcion, activo_tipo, modulo, target_role, prioridad, frecuencia, reprog_desde, lead_days, proxima_fecha)
SELECT v.* FROM (VALUES
  ('Backup de base de datos','Backup manual / verificar automático','admin','general','admin','alta','mensual','programada',3, (date_trunc('month',now())+interval '1 month')::date),
  ('Inventario físico periódico','Conteo de stock vs sistema','inventario','inventario','taller','normal','trimestral','completada',10,(date_trunc('quarter',now())+interval '3 month')::date)
) AS v(titulo,descripcion,activo_tipo,modulo,target_role,prioridad,frecuencia,reprog_desde,lead_days,proxima_fecha)
WHERE NOT EXISTS (SELECT 1 FROM rutinas r WHERE r.titulo=v.titulo AND r.activo_tipo=v.activo_tipo AND NOT r._deleted);

-- grant 'rutinas:write' en roles.permissions p/ admin/superadmin (objeto {modulo:nivel}).
```

### ▶ DROPs destructivos (NO correr; futuro, con OK explícito de Fede, tras verificar 0 dependencias + backup)

```sql
-- DROP TABLE IF EXISTS carga_personas, carga_proyectos, cargas CASCADE;
-- DROP TABLE IF EXISTS logistica_remito, logistica_movimientos, logistica_vehiculos CASCADE;
-- DROP TABLE IF EXISTS remitos CASCADE;
-- DROP TABLE IF EXISTS taller_checklist, taller_notas, taller_materiales CASCADE;
-- DROP TABLE IF EXISTS inventory_items, locations CASCADE;   -- legacy inglés
```

---

## 5. Orden de fasado para one-shot

> Cada fase: SQL primero (Fede), luego JS, luego verificación end-to-end en prod (Chrome/preview, con cleanup), luego push. El orden respeta dependencias: **Equipos antes de Transporte** (FK `equipo_id`) y **antes de disolver Taller** (mantenimiento huérfano, Q16/Q18); **Rutinas al final** (motor que consume todos los activos ya creados). **Cerrar las preguntas bloqueantes (Q1/Q1.bis/Q2/Q3/Q10/Q16/Q20/Q23 + V1) antes de la fase que las consume.**

| Fase | Qué se construye | SQL antes (Fede) | Destructivo (OK Fede) | Criterio de "hecho" |
|---|---|---|---|---|
| **A — Nav/Roles/RLS** | Sidebar 5 grupos (+ACTIVOS color Q23), RBAC taller/pm (revierte SB4), redirects `#taller`/`#logistica` (con query R6), RLS proyectos/locaciones/checklist con `fn_role_can` (drop blanket previo), shell read-only por rol | `reorg_a_nav_roles_rls.sql` (DROP blanket + RBAC + policies finas; gate Q1) | No (solo redirects; no se borran archivos) | Usuario taller: sidebar correcto, `#taller`/`#logistica` redirigen sin 404 (query preservado). Usuario oficina: ve todo (lectura admin OK tras drop+policies). `_configVersion` 6. |
| **B — Equipos en Inventario** | Tab Equipos, manifiesto, modales, KPI; absorbe mantenimiento de taller (Q16) | `reorg_b_equipos.sql` (`equipos`+`equipo_contenido`) | No | Alta canasto + manifiesto (anidado+texto) + mover + soft-delete con guard + canasto vacío; 0 errores consola. |
| **C — Disolución Taller** | Proyectos read-only filtrado (cards galpón portadas, V3), tab Producción/checklist en ficha, fuente "armado-taller" en Tareas | — (usa RBAC/RLS de A) | **Sí**: borrar `taller.js` + quitar `<script>` (commit aparte, reversible, tras verificar) | Taller ve solo gate Q1, sin CRUD, tilda checklist (inline+ficha); "Marcar listo"/"Despachar" mueven estado; oficina intacta; empty-state sin stands. |
| **D — Transporte en Evento** | Sección Transporte (cards+editor inline), remito por vehículo/evento (consolidado N bloques V2), foto firma, "Salidas hoy" en Flota, Calendario reapuntado; **desconectar Logística**; `es_propio` | `reorg_d_transporte.sql` (`evento_transporte`+items+`vehiculos.es_propio`; gate Q20; backfill Q10) | **Sí**: desconectar `logistica.js`. Tablas `cargas`/`logistica_*` inertes (NO drop) | Transporte propio+ad-hoc, stands+equipos+manual, remito x vehículo y x evento, foto firmada, aparece en Flota/Calendario, soft-delete, empty-states E1/E4. |
| **E — Locaciones activo** | 4 tabs admin (+warning sin-tipo), ficha sub-tabs, bloque alquiler, cara operativa taller, Fase 0 cleanup | `reorg_e_locaciones.sql` (ALTER alquiler; tipo NO se toca) + auditoría valores `tipo` (Q2) | No | Admin: 4 tabs + ficha. Taller: solo taller/depósito (Q2), cara operativa. `_esc` aplicado; warning sin-tipo. |
| **F — Centro de Tareas v2 (Rutinas)** | Tabla `rutinas` + RPC avanzar, motor de recurrentes (persistente en `tareas`), pestaña Rutinas (Q24), botones "Programar rutina", seed no-financiero (Q8) | `reorg_f_rutinas.sql` (`rutinas`+RPC+seed+grant; +ALTER `tareas` si V1) + ajuste `proxima_fecha` | No | Rutina `proxima_fecha=hoy` → instancia "Hoy" con chip → Hecha → cierra + avanza + `ultima_ejecucion` + reentrar no duplica + taller avanza su rutina vía RPC. Rutinas caen por rol. |

> **Flota (extensión propia: `es_propio`, "+Ajeno rápido", tab Salidas, sección Plata condicionada):** se reparte entre D (tab "Salidas de hoy" + `es_propio` + lectura `evento_transporte`) y F (botón "Programar rutina" + las rutinas de flota usan `rutinas` global, NO se extiende `produccion_mantenimiento` con frecuencia). El flag `es_propio` y el modal "Ajeno rápido" se hacen en **Fase D**. DDL flota (`ALTER vehiculos ADD es_propio` + backfill Q10) **incluido en `reorg_d_transporte.sql`**.

---

## 6. Mapa de impacto archivo-por-archivo

> **Cache-bust:** cada fase bumpea `?v=N`. **Valor actual de `_configVersion` = 5 → destino 6** (`sidebar-editor.js:67`). Las versiones `?v=N` de cada archivo JS las fija el ejecutor leyendo `index.html` al momento de cada fase (no se hardcodean acá para no quedar desfasadas).

| Archivo | Qué cambia | Fase |
|---|---|---|
| `data.js` | rolePermissions/readOnlyPermissions (taller, pm — **arrays de strings**) · categories (sacar taller/logistica, 5 grupos, **grupo ACTIVOS + color Q23**) · quickActions (reapuntar taller→tareas) · permisos `rutinas`/`locaciones` | A (nav), F (permiso rutinas) |
| `router.js` | redirects `#taller`→`#tareas`, `#logistica`→`#eventos` (**preservar query R6**) · **fix `produccion`→`tareas` directo (R1)** · sacar TallerModule/Logistica del teardown registry | A, D |
| `sidebar-editor.js` | bump `_configVersion` 5→6 (forzar rebuild sidebar) | A |
| `app.js` | verificar OPERACIONES no queda vacía (sidebar se alimenta de categories) | A |
| `admin-panel.js` | matriz de permisos se limpia sola (verificar sin columnas huérfanas) | A |
| `proyectos.js` | `_loadData`/`_render`/`_attach` bifurcados por rol; **portar cards galpón de `taller.js` (lista V3)**; filtro gate Q1; empty-state sin stands | C |
| `proyecto-detalle.js` | tab "Producción" (checklist portado + botones estado); "Pasar a Taller" intacto | C |
| `taller.js` | **se desconecta y borra** (commit aparte, tras verificar; red de seguridad hasta el corte) | C |
| `inventario.js` | tab Equipos (`_buildEquiposHTML`/`_loadEquipos`/tabla/panel/manifiesto/rutinas/modales) + KPI; empty-states E2/E8; botón "Programar rutina" | B, F |
| `eventos.js` | reescribir sección Transporte (`_loadTransporteSection` eventos.js:1809 [lee cargas+logistica_movimientos] → `getTransporteByEvento`, editor inline, eliminar fallback legacy + deep-link `#logistica` tras gate Q20); empty-states E1/E4 | D |
| `remito-pdf.js` | `generate(transporteId)` sobre `evento_transporte_items` (hook `getManifiesto` p/ detallar, 1 nivel Q17) + `generateEvento(eventoId)` consolidado (N bloques/vehículo, paginación V2) | D |
| `calendario-operativo.js` | reapuntar bulk (**identificar método actual que lee cargas, V4**) + panel + sección a `evento_transporte` (`allSettled`, empty-state) | D |
| `flota.js` | flag `es_propio`+filtro+"Ajeno rápido"+sección Plata condicionada · tab "Salidas de hoy" (`getSalidasHoy`, hoy+en-tránsito Q11) · botón "Programar rutina" | D, F |
| `logistica.js` | **se desconecta** (router/sidebar/script); archivo queda muerto | D |
| `locaciones.js` | Fase 0 cleanup (`_esc`/`data-modal-close`/parseInt) · rol gating · `_renderOperativa` · ficha sub-tabs · bloque alquiler · warning sin-tipo (E6) · tab Rutinas (consume `rutinas`) · botón "Programar rutina" | E, F |
| `tareas.js` | fuente "armado-taller" (C) · **generador `rutinas` persistente (INSERT idempotente por `dedupe_key`, no solo memoria — V1)** + pestaña Rutinas + `_renderRutinas`/`_rutinaModal` + sync 'hecha'→`avanzarRutina` (RPC) + chip (F) | C, F |
| `alertas.js` | rutinas vencidas suman a `fuentes` (vía `rutinas` global) | F |
| `api.js` | bloque EQUIPOS (B) · bloque TRANSPORTE EVENTO + `getSalidasHoy` + `crearVehiculoAdhoc` + `es_propio` en createVehiculo + `@deprecated` cargas (D) · bloque RUTINAS `getRutinas`/`getRutinasDue`/`avanzarRutina`[RPC] (F) | B, D, F |
| `index.html` | cache-bust de todos los tocados por fase; quitar `<script logistica.js>` (D) y `<script taller.js>` (C, al final) | todas |
| `roles` (tabla) | grants RBAC taller/pm (A, revierte SB4) · `rutinas:write` (F) — vía SQL `{modulo:nivel}` | A, F |
| `tareas` (tabla) | (condicional V1) ALTER `origen`/`dedupe_key`/`fecha_limite` + índice único | F |
| `vehiculos` (tabla) | ALTER `es_propio` + backfill (Q10) | D |

---

## 7. Checklist de verificación post-build por fase

**Fase A — Nav/Roles/RLS**
- [ ] Sidebar muestra PRINCIPAL/COMERCIAL/OPERACIONES/ACTIVOS/ADMIN&FINANZAS; sin "Taller"/"Logística"; ACTIVOS con color (Q23).
- [ ] `#taller`→`#tareas`, `#logistica`→`#eventos` (sin 404; deep-link con `?query`/sub-id preservado — R6).
- [ ] `#produccion` va directo a `#tareas` (sin doble salto — R1).
- [ ] Usuario taller: ve `proyectos`/`locaciones`/`eventos`/`inventario`/`flota` en menú.
- [ ] Usuario oficina (admin/pm): lee `proyectos` y `locaciones` **sin filas ocultas** (probar lectura admin DESPUÉS del DROP blanket + policies finas — R2).
- [ ] `_configVersion`=6 (sidebar viejo no persiste).
- [ ] Confirmado con Fede que A.1 revierte SB4 a propósito (Q1.bis).
- [ ] 0 errores de consola en login + navegación.

**Fase B — Equipos**
- [ ] Tab Equipos rinde; filtros (tipo/ubicación/estado) + búsqueda accent-insensitive.
- [ ] Alta de canasto `es_contenedor=true` → manifiesto (1 equipo anidado + 1 línea libre) → contador 📦 correcto.
- [ ] Canasto vacío → contador 📦 = 0 (E2).
- [ ] Fila de contenedor expande/colapsa (render corta a 1 nivel — Q17).
- [ ] Mover equipo cambia `ubicacion_id`; ubicación borrada → "no disponible" (E8).
- [ ] Soft-delete con guard (bloquea si en manifiesto activo / remito sin devolver).
- [ ] (Si Q16=datos) matafuegos/herramientas migrados a `equipos`.
- [ ] KPI dashboard "Equipos"/"Rutinas vencidas" presentes.

**Fase C — Disolución Taller**
- [ ] Usuario taller en `#proyectos`: solo gate Q1, modo cards, sin CRUD; empty-state si 0 (E3).
- [ ] Checklist tilda inline en card + en ficha (tab Producción); primer check → `en_armado`.
- [ ] "Marcar listo"/"Despachar" mueven `estado_taller`.
- [ ] "Pasar a Taller" (oficina) sigue sembrando checklist + notif.
- [ ] Centro de Tareas muestra fuente "armado-taller" para taller.
- [ ] Oficina ve Proyectos igual que antes (tabla completa).
- [ ] (Tras corte destructivo) `taller.js` borrado, app carga sin error; redirects siguen vivos.

**Fase D — Transporte**
- [ ] Sección Transporte en ficha de evento: agregar vehículo propio (combobox Flota) y ad-hoc (toggle guardar/solo-viaje); validar ad-hoc sin descripción (E4).
- [ ] Carga: stands + equipos (contenedor con "detallar contenido", 1 nivel) + manual.
- [ ] Remito por vehículo (PDF) + remito del evento (consolidado N bloques/vehículo — V2).
- [ ] Foto firmada sube a Storage `remitos/...` y marca `remito_firmado_url`.
- [ ] "Salidas de hoy" en Flota lista transportes del día + en-tránsito sin firmar (Q11); empty-state.
- [ ] Calendario operativo muestra transporte (sin deep-link a logística muerta; empty-state si vacío).
- [ ] `#logistica` desconectado; chip propietario MEPEX/Tercero correcto (`es_propio`, backfill Q10 OK).
- [ ] Gate Q20 verificado (0 cargas/logistica vivos) antes de cortar fallback.
- [ ] Evento sin transporte → "Sin transporte cargado"; "Generar remito" deshabilitado (E1).
- [ ] Soft-delete del transporte; 0 errores consola.

**Fase E — Locaciones**
- [ ] Admin: 4 tabs (Lugares/Documentación/Rutinas) + ficha con sub-tabs (Datos+alquiler/Docs/Rutinas/Stock).
- [ ] Contadores docs por vencer / rutinas pendientes en cards; warning "N sin tipo" si aplica (E6).
- [ ] Bloque alquiler/contrato guarda en `locaciones`.
- [ ] Usuario taller: solo `tipo IN ('taller','deposito')` (Q2), cara operativa (sin contratos/$$).
- [ ] `_esc`/`_escAttr` aplicado (sin XSS interno); `data-modal-close` funciona.

**Fase F — Rutinas**
- [ ] (V1) `tareas` tiene `origen`/`dedupe_key`/`fecha_limite` + índice único; confirmado antes de build.
- [ ] Pestaña Rutinas visible solo admin-level (Q24); alta/edición/pausar plantilla.
- [ ] Rutina con `proxima_fecha=hoy` → instancia en "Hoy" con chip 🔁 + activo de origen.
- [ ] Marcar Hecha → instancia cierra (persiste en `tareas`) + `proxima_fecha` avanza (según `frecuencia`/`reprog_desde` Q7) + `ultima_ejecucion=hoy`.
- [ ] **Usuario taller marca Hecha su rutina (inventario físico) → avanza vía RPC `fn_avanzar_rutina` (no bloqueado por `rutinas_write`=admin).**
- [ ] Reentrar a `#tareas` NO duplica (dedupe_key + índice único).
- [ ] Sello best-effort: rutina con `sello_tabla/columna/id` actualiza el activo (o falla silencioso sin romper).
- [ ] Rutina sin responsable → cae a bandeja admin (E5/Q25).
- [ ] Rutinas de flota/locación/equipo caen al rol correcto (taller/admin).
- [ ] Botones "Programar rutina" en Flota/Locaciones/Equipos abren el modal de `rutinas` precargado.
- [ ] Seed transversal **no-financiero** (backup/inventario físico) presente; cierre/impuestos/ARCA NO duplicados (siguen en `vencimientos_recurrentes` — Q8).
- [ ] Alertas suma rutinas vencidas al badge.

---

> **Resumen de correcciones incorporadas de las revisiones:** (1) `fn_modulo_nivel`→`fn_role_can(modulo,nivel)` en todo el DDL RLS; (2) DROP de las policies blanket `*_rls_auth` de Capa 2 antes de crear las finas; (3) gate taller unificado (`estado='en_taller'`, no `estado_taller IS NOT NULL`) coincidente RLS↔JS; (4) `rutinas.activo_id text` (polimórfico uuid+bigint); (5) `locaciones.tipo` ya existe → auditoría de valores, no ALTER; (6) Q1.bis explícita (revierte SB4); (7) `vehiculos.es_propio` backfill explícito (Q10); (8) seed de rutinas no-financiero (Q8, evita duplicar `vencimientos_recurrentes`); (9) RPC `fn_avanzar_rutina` SECURITY DEFINER (taller cierra su rutina); (10) `tareas` columnas/índice anti-dup condicionales (V1); (11) FK `equipos.proveedor_id`, `_deleted`/`created_at NOT NULL`, nota "requiere reorg_b" en reorg_d; (12) empty-states E1–E8; (13) fix redirect `produccion`→`tareas` (R1) + preservar query (R6); (14) hook-points explícitos (eventos.js:1809, sidebar-editor.js:67, lista de helpers a portar de taller.js); (15) color categoría ACTIVOS (Q23); (16) "qué sale hoy" = hoy + en-tránsito sin firmar (Q11); (17) remito consolidado = N bloques/vehículo (V2). 4 preguntas del draft cerradas por el código (forma roles.permissions, firma RLS, RLS existente, locaciones.tipo).
