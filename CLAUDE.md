# LOBBY MEPEX — Sistema de Gestion Integral

> SPA de gestion interna para MEPEX. Puerta de entrada a todos los modulos del ecosistema.

**Stack:** Vanilla JS (ES6+) SPA, hash routing, Supabase (DB + Auth), deploy estatico (sin build step). + proxy HTTP node en VPS `195.200.1.250:3000` para integraciones que requieren server-side (La PyME → ARCA).
**Carpeta local:** `C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX`
**IMPORTANTE:** Windows 11. Shell por defecto del entorno = Bash POSIX (usar `rm`, `ls`, etc. ahí); cuando se requieran herramientas Windows-only (`Remove-Item`, `Get-ChildItem`, gestión de servicios) usar **PowerShell**. NUNCA mezclar — Bash NO entiende `del`/`type`/`copy`/`findstr`.

---

## 2. CONTEXTO EMPRESA

**MEPEX** — Montaje y Equipamiento para Exposiciones. Fundada 1983. Buenos Aires, Argentina.
Diseno y construccion de stands para ferias, exposiciones, congresos y eventos. Sistema modular exclusivo **OCTEXA**. Modelo de **ALQUILER** B2B de alto valor — nada se vende al cliente final.

**Equipo:**
- **Fede** — Gerencia / desarrollo de sistemas / superadmin
- **Lelean** — Gerencia / admin
- **Noe** — Comercial senior (ventas de equipamiento)
- **Sofi** — Finanzas / admin
- **Leo y Meli** — Project Managers (stands)
- Equipo de taller/produccion (Diego, Juan, Carlos, Willy) — edad media/avanzada, poco tech

**Moneda:** Pesos argentinos ($, formato es-AR). Ejemplo: `$68.000`, `$743.243`. Punto como separador de miles, sin decimales salvo que corresponda.

---

## 3. ARQUITECTURA TECNICA

### Patron general
- **SPA con un solo `#app`** en `index.html`
- **Hash-based routing** (`#lobby`, `#ventas`, `#clientes`, etc.)
- **Objetos globales como modulos** — cada archivo JS exporta un objeto global: `API`, `Auth`, `Router`, `App`, `Data`, `Lobby`, `Modules`, `Settings`, `Calendar`, `CalendarioOperativo`, `EventosModule`, `AdminPanel`, `Toast`, `Modal`, `ContextMenu`, `Confirm`, `FormBuilder`, `SidebarEditor`, `UndoManager`, `UndoUI`, `UndoHelpers`
- **Template literals** para generar HTML (no JSX, no template engines)
- **Async/await** para todas las llamadas a Supabase
- **Estado local por modulo** — cada modulo mantiene su propio state en propiedades del objeto (prefijo `_` para privadas)
- **Lifecycle:** cada modulo tiene un metodo `render()` que renderiza en `#mainContent`
- **Eventos:** `addEventListener`, nunca inline `onclick`

### Patron estandar de modulo
```javascript
const MiModulo = {
    _items: [],
    _sortCol: 'name',
    _sortDir: 'asc',
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        const content = document.getElementById('mainContent');
        content.innerHTML = this._buildHTML();
        await this._loadData();
        this._attachEvents();
    },
    _buildHTML() { return `<div>...</div>`; },
    async _loadData() { this._items = await API.getItems(); },
    _attachEvents() { /* addEventListener calls */ },
};
```

### App Shell
- **Header global:** logo MEPEX (link a lobby), search global (Ctrl+K), connection badge (Online/Offline), user dropdown con navegacion
- **Sidebar:** acciones rapidas por rol + navegacion por categorias (configurable via SidebarEditor) + modo edicion (drag & drop, rename, color picker)
- **Main content:** `#mainContent` donde renderizan los modulos

### Supabase
- **URL:** `https://selnevalaeykdrgycvdz.supabase.co`
- Client-side SDK via CDN (`@supabase/supabase-js@2`)
- Auth con email virtual (`user@mepex.local`)
- **Casi todo es client-side contra Supabase.** Excepción: hay un proxy HTTP Node corriendo en VPS `195.200.1.250:3000` (pm2 `mepex-api`, `/home/mepex/api/server.js`, Express 5 + dotenv + cors) para integraciones server-side (certificados X.509, secrets, API keys). Expone `/api/lapyme/facturar` y (2026-06-14) `/api/crm/digest` (motor IA del CRM, driver gemini|claude, `tools/vps/crm-digest.js`). En Fase D se sumará `/api/arca/facturar`. **⚠️ Pendiente 2026-06-14:** el `:3000` NO es alcanzable desde el browser (`Failed to fetch`, lapyme incluido) → falta rutear `/api/` por nginx (`proxy_pass 127.0.0.1:3000`). Ver `docs/crm-casos-runbook.md` §ESTADO ACTUAL + memoria `project_crm_digest_blocker`.
- localStorage solo para preferencias de UI (sidebar state, etc.), NO para datos de negocio

### Componentes reutilizables (components.js)
| Componente | API |
|------------|-----|
| `Toast` | `.success(msg)`, `.error(msg)`, `.warning(msg)`, `.info(msg)` |
| `Modal` | `.open({ title, body, size, footer })`, `.close(id)`, `.confirm({ title, message, danger })` |
| `ContextMenu` | `.show(x, y, items)`, `.close()` |
| `Confirm` | `.delete(entityName)`, `.action(title, message)` |
| `FormBuilder` | `.render(fields, values)`, `.getValues(form)`, `.validate(form, fields)` |

### Sistema Undo/Redo (undo.js)
- **UndoManager:** stack en memoria (max 50 acciones). Ctrl+Z / Ctrl+Y o botones en header
- **UndoHelpers:** funciones helper para registrar acciones en UndoManager automaticamente
- **audit_log (Supabase):** registro persistente de todos los cambios. Trazabilidad completa
- Soft delete en todas las tablas (columna `deleted`)

---

## 4. BRAND & DISENO

### Colores principales
| Token | HEX | Uso |
|-------|-----|-----|
| `--primary` | `#00A9C1` | Turquesa MEPEX. Color dominante: titulos, botones, links, bordes de foco, scrollbar |
| `--bg` | `#050505` | Fondo principal negro |
| `--accent` | `#F28D15` | Naranja. Solo acentos: badges, alertas, categoria comercial. USO MODERADO |
| `--bg-card` | `#111111` | Fondo de cards |
| `--border` | `#2a2a2a` | Bordes generales |
| `--text-primary` | `#E8E8E8` | Texto principal |
| `--text-muted` | `#888888` | Texto secundario |
| `--text-dim` | `#555555` | Placeholders |
| `--color-success` | `#00CC88` | Estados exitosos |
| `--color-error` | `#ff4444` | Errores, danger |

### Colores de categoria (sidebar y lobby)
| Categoria | Color | Modulos |
|-----------|-------|---------|
| Principal | `#00A9C1` | Lobby, Calendario |
| Comercial | `#F28D15` | Ventas, Clientes |
| Operaciones | `#00CC88` | Proyectos, Eventos, Produccion |
| Recursos | `#9B7DFF` | Inventario |
| Admin & Finanzas | `#4A90D9` | RRHH, Finanzas, Proveedores |

### Tipografia
| Fuente | Variable | Uso |
|--------|----------|-----|
| **Outfit** | `--font-main` | Titulos, cuerpo, UI general (wght 300-800) |
| **Space Mono** | `--font-mono` | Labels, montos, datos numericos, btn-primary (wght 400, 700) |
| **JetBrains Mono** | — | Codigo, datos tecnicos (alternativa mono) |

### Reglas visuales
- **Dark theme SIEMPRE.** No existe modo claro.
- Sobrio, profesional, espaciado generoso
- Glow sutil en hover: `--glow-sm: 0 0 12px rgba(0, 169, 193, 0.2)`
- Bordes redondeados minimos: 4px general, 6px medium, 10px large
- Scrollbar custom turquesa sobre track negro
- Transiciones: `250ms ease` o `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- Desktop-first (herramienta interna usada en escritorio)
- Grid sutil de fondo en main content

### Logo
- `assets/logo_full.png` — logo completo horizontal (header)
- `assets/mepex_iso.png` — isotipo X (favicon)
- Siempre sobre fondo oscuro, en turquesa `#00A9C1`

---

## 5. ESTRUCTURA DE ARCHIVOS

```
LOBBY-MEPEX/
├── index.html              # Entry point SPA — carga Supabase CDN + scripts
├── style.css               # Estilos principales (~8000 lineas, importa MEPEX_COMPONENTS.css)
├── MEPEX_COMPONENTS.css    # CSS base reutilizable (tokens legacy, reset, componentes base)
│
├── config.js               # Credenciales Supabase (URL + anon key), crea supabaseClient
├── api.js                  # API client contra Supabase (~2000 lineas): CRUD completo
├── data.js                 # Datos estaticos: modulos, roles, permisos, categorias, acciones rapidas
├── router.js               # SPA router hash-based con guards de auth y permisos por rol
├── auth.js                 # Supabase Auth: login/logout/session restore, perfiles, RBAC
│
├── components.js           # UI reutilizables: Toast, Modal, ContextMenu, Confirm, FormBuilder
├── sidebar-editor.js       # Editor de sidebar: drag & drop, inline rename, color picker, undo
├── undo.js                 # Sistema undo/redo: UndoManager + UndoUI + UndoHelpers
│
├── app.js                  # App Shell: header global + sidebar + search global + bootstrap
├── lobby.js                # Vista Lobby: KPIs reales, mini calendario, bloques de categorias
├── calendar.js             # Calendario global: grilla mensual CSS, filtros por tipo
├── calendario-operativo.js # Timeline vertical operativo: carriles por evento, fases, zoom
├── eventos.js              # Modulo Eventos: tabla + cards + ficha con secciones editables
├── modules.js              # Renderer generico de modulos (~4350 lineas): tablas, fichas, CRUD
├── settings.js             # Pantallas: Mi Perfil, Usuarios y Roles (admin), Notificaciones
├── admin-panel.js          # Panel de Control admin: metricas, tabla usuarios, audit log
│
├── sidebar-editor.html     # Prototipo funcional del sidebar editor (referencia)
│
├── assets/
│   ├── logo_full.png       # Logo MEPEX completo horizontal
│   ├── mepex_iso.png       # Isotipo X (favicon)
│   └── COLORES MEPEX.png   # Paleta de referencia
│
├── sql/                            # ~45 archivos de migración acumulados.
│   │                               # Las migraciones viejas YA están aplicadas en prod —
│   │                               # NO asumir que reflejan schema actual. Verificar con
│   │                               # `SELECT * FROM information_schema.columns WHERE table_name=...`
│   │                               # antes de tocar.
│   ├── contabilidad_fase_a_hardening.sql   # Fase A hardening contabilidad (CHECK, saldos, audit)
│   ├── finanzas_fase1..8.sql              # Schema finanzas — VERIFICADO 2026-05-19 que coincide con prod
│   ├── costos_fase1.sql, fase3.sql        # Schema módulo Costos
│   ├── taller_logistica_v1.sql, v2.sql    # Schema taller/logística
│   ├── rrhh_to_personas_migration.sql     # Unificación RRHH→personas
│   └── ...                                 # Ver `Glob sql/*.sql` para lista actual
│
└── *.md                    # Documentacion y blueprints (ver seccion 9)
```

### Carga de scripts — CORE + DIFERIDA (refactor 2026-07-15, crítico)

**`index.html` solo carga el CORE** (lo mínimo para el login):
```
1. Supabase SDK (CDN)
2. config.js       → crea supabaseClient
3. data.js         → datos estaticos (auth usa rolePermissions)
4. router.js       → _registerRoutes + handleRoute (async, gate de carga)
5. auth.js         → login/restoreSession/MFA
6. audit-log.js    → AuditLog (login/logout logs)
7. app.js          → App.init + LOADER (ensureAppLoaded/_APP_SCRIPTS)
```

**El RESTO (~46 scripts: api.js, components.js, todos los módulos + jsPDF/Chart.js/qrcode)
se inyecta recién con usuario autenticado** vía `App.ensureAppLoaded()` (llamado por
`Router.handleRoute()` antes de rutear). Descarga paralela con `async=false` = ejecutan
en orden de inserción. Al terminar re-llama `Router._registerRoutes()` (los `obj` del
teardown Fase 12.A necesitan los globals ya cargados).

**⚠️ REGLA: para bumpear la versión `?v=` de un módulo diferido, editar `App._APP_SCRIPTS`
en `app.js` — index.html ya NO lista esos scripts.** El orden de la lista importa igual
que antes (api → components → módulos → Chart.js antes de contabilidad/finanzas).

---

## 6. MODULOS — ESTADO ACTUAL

| Modulo | Archivo | Estado | Funcionalidades |
|--------|---------|--------|-----------------|
| **Lobby** | `lobby.js` | Completo | KPIs reales desde Supabase, mini calendario, bloques por categoria, actividad reciente |
| **Ventas** | `modules.js` | En desarrollo | Pipeline comercial (6 estados), cotizaciones, seguimientos, KPIs comerciales |
| **Clientes** | `modules.js` | Completo | Tabla + ficha detalle, CRUD, busqueda, filtros |
| **Proyectos** | `modules.js` | Completo | Tabla + ficha, vinculacion a eventos y clientes |
| **Eventos** | `eventos.js` | Completo | Tabla + cards + ficha por secciones editables, deteccion conflictos |
| **Calendario Operativo** | `calendario-operativo.js` | Completo | Timeline vertical, carriles, fases (armado/func/desarme), zoom, filtros, card view |
| **Calendario Global** | `calendar.js` | Completo | Grilla mensual CSS, filtros por tipo, panel detalle |
| **Produccion** | `modules.js` | En desarrollo | Tabla basica, ficha |
| **Inventario** | `modules.js` | En desarrollo | Insumos base + catalogo items con receta, selects editables |
| **Costos** | `costos.js` | **Completo** | 4 tabs (Insumos / Recetas / Listas de precio / Parámetros). Cálculo via RPC PL/pgSQL `calcular_receta`. Soporta items propios y subalquilados, BOM jerárquico, snapshots, márgenes por item, VU armado "duro" (regla 1:N), exportar PDF en 3 modos. **Ver sección 6.5 — Modelo de Costeo.** |
| **Finanzas** | `finanzas.js` (~8700 líneas) | En desarrollo avanzado | 8 tabs (Panel / Ingresos / Egresos / Facturación / Cuentas / Conciliación / Calendario / Reportes). Toggle A/B (canal `oficial`/`interno`) sincronizado con Contabilidad. Facturación operativa via proxy La PyME en VPS. Conciliación bancaria y Calendario aún en esqueleto. **Ver `docs/finanzas_blueprint_v2.md` para roadmap (Fases A-H, ARCA directo, multi-moneda, plan de pagos avanzado, etc).** |
| **Contabilidad** | `contabilidad.js` (~4500 líneas) | En desarrollo avanzado | 6 tabs (Plan cuentas / Libro diario / Libro mayor / Asiento manual / Libros IVA / Reportes). Partida doble vía triggers `fn_asiento_auto_ingreso`/`egreso` que mapean ingresos/egresos a asientos contables vía `mapeo_cuentas`. Libros IVA y Reportes pendientes. **Ver `docs/finanzas_blueprint_v2.md`.** |
| **Rendimiento por evento** | `rendimiento.js` | **Completo (verificado en prod 2026-06-18)** | Módulo `#rendimiento` (ADMIN & FINANZAS, admin/superadmin). Planilla de costos por evento (5 categorías: jornal/flete/proveedor/seguro/comida) que reemplaza el Excel de Lelean. Cada pago = 1 egreso → asiento auto (reusa la plomería de Finanzas, NO la reimplementa). Dashboard de ganancia (Cobrado+Facturado − Costos − Materiales). Expone `API.getJornalesByPersona` (contrato RRHH.5). **`comprobantes_recibidos` tiene taxonomías propias de `categoria`/`tipo` — ver `docs/modulo-rendimiento-evento-blueprint.md` §9.9.** |
| **RRHH** | `rrhh.js` | Operativo | Tab Nómina contra `personas` (migrada desde `rrhh_personal`). Tabs Asignación/Vacaciones aún contra tablas legacy con banner aclaratorio. |
| **Proveedores** | `modules.js` | Pendiente | Estructura registrada, sin funcionalidad |
| **Admin Panel** | `admin-panel.js` | Completo | Metricas del sistema, tabla usuarios, audit log feed |
| **Settings** | `settings.js` | Completo | Mi Perfil, Usuarios y Roles (admin), Notificaciones |
| **Sidebar Editor** | `sidebar-editor.js` | Completo | Drag & drop secciones/items, inline rename, color picker, undo |
| **Undo System** | `undo.js` | Completo | Undo/redo en memoria + audit_log persistente + soft delete |

### Roles y permisos
| Rol | Modulos | Usuarios |
|-----|---------|----------|
| `superadmin` | Todos + Panel de Control | Fede |
| `admin` | Todos + Usuarios y Roles | Lelean, Sofi |
| `venta` | Ventas, Clientes, Proyectos, Eventos, Produccion, Inventario | Noe |
| `pm` | Proyectos, Eventos, Clientes, Produccion, Inventario | Meli, Leo |
| `taller` | Proyectos, Eventos, Produccion | Diego, Juan, Carlos, Willy |

Permisos definidos en `Data.rolePermissions`, personalizables por usuario via `customPermissions` en tabla `profiles`.

---

## 6.5 MODELO DE COSTEO (módulo Costos)

> **Fuente de verdad: la función PL/pgSQL `calcular_receta(item_id)` en Supabase.**
> El frontend nunca calcula precios; solo invoca la RPC y muestra el resultado.
> Los snapshots se guardan en `catalogo_items` al momento del recálculo.

### Filosofía

El modelo combina 3 marcos teóricos estándar:

1. **Units of Production Depreciation (UoP)** — la amortización va por uso, no por tiempo.
2. **Activity-Based Costing (ABC)** — cada uso "consume" una porción del costo.
3. **Cost-Plus Pricing** — `precio = costo × (1 + margen)`.

Es lo que recomienda la industria de equipment rentals (party rentals USA, construcción, eventos).

### Tipos de receta

Cada item en `catalogo_items` tiene `tipo_receta`:

- **`propio`**: lo armás vos en el taller, juntando insumos y reusándolo. Aplica cascada completa (MP + MO + indirectos + amortización).
- **`subalquilado`**: lo alquilás de un proveedor y lo revendés con margen. Sin MO, sin amortización, sin indirectos. Solo `costo × (1 + margen)`.

### Fórmula PROPIO (cascada completa)

```
Por cada componente insumo:
  costo_comp_nueva = costo_unit × cantidad × (1 + desperdicio%_insumo)
  costo_comp_uso   = (costo_comp_nueva / VU_insumo) × (1 + reacond%_insumo)

Por cada componente sub-item (BOM jerárquico):
  costo_comp_nueva = sub.costo_fabricacion × cantidad
  costo_comp_uso   = sub.costo_por_uso × cantidad

Mano de obra del armado:
  costo_mo        = (mo_minutos / 60) × hora_taller_global
  costo_mo_uso    = costo_mo / VU_armado

Indirectos (sobre MO amortizada, no sobre MP):
  costo_indirectos = costo_mo_uso × pct_indirectos_global

Resultado:
  costo_fab    = Σ costo_comp_nueva + costo_mo
  costo_uso    = depende de si VU_armado_override está cargado (ver abajo)
  precio       = costo_uso × (1 + margen)
```

#### Regla 1:N — VU armado "duro" (F.11)

Si `vida_util_armado_override` está cargado y > 0, **se ignora la amortización por componente individual**:

```
costo_uso = (costo_fab / VU_armado_override) + costo_indirectos
```

Refleja la realidad operativa: si la vitrina dura 5 usos, **todo** lo que está adentro se descarta junto con ella. No tiene sentido amortizar el aluminio por su VU=30 si la vitrina entera vive solo 5 usos.

Si `vida_util_armado_override` es null, se usa la fórmula clásica (cada componente se amortiza por su VU propia).

### Fórmula SUBALQUILADO (simple)

```
costo_mp = Σ componentes (sin desperdicio, sin amortización)
costo_uso = costo_mp     (passthrough, no se amortiza nada)
margen = item.margen_subalquiler  (NO el global)
precio = costo_uso × (1 + margen)
```

Para subalquilado, el `margen_subalquiler` del item es la fuente. **No usa el global** `pct_margen_default`.

Si `costo_proveedor_directo` está cargado, se usa ese valor directo en lugar de sumar componentes (legacy, raro de usar).

### Margen propio override (F.8)

Items propios pueden tener `margen_propio` cargado para sobreescribir el margen global. Prioridad:

```
margen_efectivo = COALESCE(item.margen_propio, item.snapshot_pct_margen, parametros_globales.pct_margen_default)
```

Permite cobrar PSB-250 al 125% mientras el cerrojo sigue al 50% global. **Sin esto, el cost-plus puro no llegaría a precios de mercado** para items con valor percibido alto.

### Snapshots

Cada item `propio` guarda al momento del recálculo:

- `snapshot_pct_indirectos_fabrica`
- `snapshot_pct_margen`
- `snapshot_hora_taller_ars`
- `snapshot_costos_at` (timestamp)

Si después editás los globales (Parámetros), **las recetas existentes mantienen su snapshot** hasta recalcularlas individualmente. Esto evita que un cambio de hora_taller dispare cambios silenciosos en 200 items.

El indicador `●` "desfasado" en el panel avisa cuando snapshot ≠ global actual.

### Tipos de amortización

Tabla `costos_tipo_amortizacion` con 18 tipos. Cada uno define VU + % desperdicio + % reacond. Se asigna a cada insumo. Insumos pueden tener `*_override` que pisan el tipo. **Los valores son operativos (lo que dura en la realidad de MEPEX), no contables.**

Códigos vigentes:
```
ALUMINIO_BARRA, PLACA_FIBROPLUS_3, PLACA_FIBROPLUS_5, PLACA_KARIKAL_3,
PLACA_KARIKAL_10, VIDRIO_4MM, VIDRIO_6MM, FERRETERIA, CONSUMIBLE,
ELECTRICO, PINTURA, SUB_ALQUILER, MANO_OBRA, OFICINA, LIMPIEZA,
EMBALAJE, LOGISTICA, OTRO
```

### Parámetros globales (clave-valor en `parametros_globales`)

**Activos en el cálculo**:
- `hora_taller_ars` — multiplica los minutos de MO.
- `pct_indirectos_fabrica` — % sobre MO amortizada.
- `pct_margen_default` — margen default si el item no tiene `margen_propio`.

**Legacy / no usados** (la RPC los ignora, quedan por compat):
- `hora_montajista_ars`, `vida_util_default`, `pct_desperdicio_aluminio`, `pct_indirectos_comercial`, `pct_reacondicionamiento`.

### Markup vs Margen — aclaración técnica

Lo que la UI llama "Margen" técnicamente es **markup** (sobre el costo, no sobre el precio).

```
Markup = (precio - costo) / costo  ← lo que usamos
Margen = (precio - costo) / precio
```

Ej: un cerrojo con costo $66 y "margen 50%" según UI → precio $99. Eso es markup 50%, margen real 33%. **Convención del sistema, no bug.**

### RPC `calcular_receta(p_item_id)`

```sql
RETURNS TABLE(
  costo_mp NUMERIC,         -- Σ componentes amortizados (o costo_proveedor en subalq)
  costo_fabricacion NUMERIC, -- Σ componentes nuevos + MO
  costo_por_uso NUMERIC,     -- el divido por VU + MO/VU + indirectos
  precio_alquiler NUMERIC    -- costo_por_uso × (1 + margen)
)
```

Recursiva: cuando un componente es `tipo='item'`, llama a `calcular_receta` del sub-item con el snapshot del padre. **No usa los valores cacheados del sub-item, los recalcula al vuelo** con los snapshots del padre.

Defaults: si no hay snapshot del item, usa `parametros_globales` actuales. Si esos no existen, defaultea hardcoded (0.30 / 0.50 / 12000).

### UI — pestañas del módulo Costos

| Pestaña | Qué hace |
|---|---|
| **Insumos** | CRUD de `insumos_base`. Tabla con costo unitario, tipo amortización, VU efectiva. Panel lateral con datos básicos, costo, proveedor (combobox catálogo), amortización (tipo + overrides), notas, historial de precios. |
| **Recetas y Costos** | CRUD de `catalogo_items` con receta. Tabla con MO, Costo Fab, Costo/Uso, Precio. Panel lateral con header editable inline, toggle propio/subalq compacto, componentes (BOM jerárquico expandible), config (MO + VU armado + margen propio override) o subalq (margen + proveedor), snapshot colapsable, resultado actual con breakdown de fórmula, notas, eliminar, recalcular (turquesa→naranja con animación cuando hay cambios pendientes). |
| **Listas de Precio** | Vista read-only de items cotizables. Header con KPIs, filtros (rubro, cotizable, última act., sin receta). Tabla split visual PRECIO/ESTADO con toggle cotizable inline. Próxima revisión editable. Exportar PDF (Cliente / Socio / Interno) con branding MEPEX. |
| **Parámetros** | Editable solo superadmin. Lista key-value de `parametros_globales`. Conversión bidireccional %↔factor. |

### Decisiones tomadas (y por qué)

- **Snapshots por item** en lugar de aplicar globals en vivo → evita cambios silenciosos en 200 items cuando se mueve un parámetro.
- **VU armado "duro" opcional** → cuando se carga `vida_util_armado_override > 0`, divide costo_fab/VU. Refleja realidad operativa (vitrina = 5 usos sin importar que el aluminio dure 30).
- **Margen propio por item** → el cost-plus es el "piso", el mercado decide el techo. Sin esta palanca, items con valor percibido alto quedaban subvalorados.
- **`pct_markup_estructura` eliminado** → era confuso y se aplicaba doble. Ahora solo hay margen.
- **Cotizador externo lee Listas directo** (no sync) → MEPEX no orquesta esa sync, el cotizador filtra `es_cotizable=TRUE` y lee `precio_alquiler` de `catalogo_items`.
- **Pantalla `#parametros-globales` legacy eliminada** → todo en el tab Parámetros del módulo Costos.

---

## 7. INTEGRACIONES

### Supabase — Tablas principales
| Tabla | Uso |
|-------|-----|
| `profiles` | Usuarios: name, role, initials, active, custom_permissions |
| `clientes` | Base de clientes (NOTA: columnas rotadas — ver bug abajo) |
| `proyectos` | Proyectos por ano |
| `eventos` | Eventos feriales: fechas, venue, equipo, transporte, docs |
| `insumos_base` | Materias primas con costos. Campos clave del modelo nuevo: `tipo_amortizacion` (FK a `costos_tipo_amortizacion.codigo`), `vida_util_override`, `pct_desperdicio_override`, `pct_reacond_override`. |
| `catalogo_items` | Items con receta. Campos del modelo nuevo: `tipo_receta` (`propio`/`subalquilado`), `mano_obra_minutos`, `vida_util_armado_override` (regla 1:N), `margen_propio` (override del global), `margen_subalquiler`, `costo_proveedor_directo` (legacy), `proveedor_id_directo` (UUID), `es_cotizable`, snapshots `snapshot_*`, cache `costo_fabricacion`/`costo_por_uso`/`precio_alquiler`. |
| `receta_componentes` | Polimórfica: `componente_type` (`insumo`/`item`), `componente_id`, `cantidad`, `es_parametrico`, `factor`, `cantidad_fija`. Soporta BOM jerárquico (item dentro de item). |
| `costos_tipo_amortizacion` | Catálogo de 18 tipos de amortización. Cada tipo: `codigo` (PK), `nombre`, `vida_util` (usos), `pct_reacond`, `pct_desperdicio`, `orden`. |
| `parametros_globales` | Key-value de defaults globales. Activos: `hora_taller_ars`, `pct_indirectos_fabrica`, `pct_margen_default`. Resto legacy. |
| `proveedor` | Catálogo de proveedores (id es **UUID**, no integer). Usado en combobox de Insumos y Subalquilado. |
| `cotizaciones` | Cotizaciones del pipeline comercial |
| `pipeline_comercial` | Estados y seguimiento de cotizaciones |
| `audit_logs` | Registro de auditoría del sistema. Tabla creada en Fase A contabilidad (2026-05-19). Trigger automático en `asientos` (INSERT/UPDATE/DELETE). Solo admin/superadmin lee. |

### Schema real de Finanzas y Contabilidad (verificado 2026-05-19)

**OJO: los archivos `sql/contabilidad_fase1_*.sql` fueron borrados porque NO reflejaban el schema real de prod.** El SQL `sql/contabilidad_fase_a_hardening.sql` está alineado con producción.

#### Tablas Contabilidad
- **`plan_cuentas`**: `id UUID`, `codigo TEXT`, `nombre`, `tipo` (activo/pasivo/patrimonio_neto/resultado_positivo/resultado_negativo/orden), `nivel` (1-3), `codigo_padre`, `es_grupo BOOLEAN`, `cuenta_financiera_id UUID` (FK), `naturaleza` (deudora/acreedora), `activa`, `orden`, `notas`, `_deleted`. **Fase A agregó**: `imputable BOOLEAN`, `controla_subdiario TEXT` (cliente/proveedor/evento/proyecto).
- **`asientos`**: `id UUID`, `numero SERIAL`, `fecha`, **`concepto TEXT`** (NO `descripcion`), `tipo` (manual/automatico), `canal` (oficial/interno), `ingreso_id`, `egreso_id`, `comprobante_id`, `comprobante_recibido_id`, `transferencia_id`, `total_debe`, `total_haber`, `notas`, `created_by`, `_deleted`. **NO tiene columna `estado`** — vigencia se controla con `_deleted`. **Fase A agregó**: CHECK `chk_partida_doble` `ABS(total_debe - total_haber) < 0.01` (NOT VALID).
- **`asiento_lineas`**: `id UUID`, `asiento_id`, `cuenta_id`, **`tipo_movimiento TEXT`** (`'debe'` o `'haber'`), **`monto NUMERIC`** (NO columnas `debe`/`haber` separadas), `descripcion`, `orden`.
- **`mapeo_cuentas`**: `id`, `clave TEXT` (ej `ingreso_alquiler`, `egreso_otros`), `cuenta_id`, `descripcion`, `_deleted`. Es la tabla pivote que decide qué cuenta contable usar para cada tipo de movimiento de Finanzas.
- **`saldos_mensuales`**: `id`, `cuenta_id`, `periodo TEXT` (formato `YYYY-MM`), `canal`, `saldo_anterior`, `total_debe`, `total_haber`, `saldo_final`. Materializado vía trigger `trg_saldos_lineas` (Fase A) con cascada a meses posteriores. UNIQUE `(cuenta_id, periodo, canal)`.

#### Tablas Finanzas
- **`cuentas_financieras`**: tesorería (banco / billetera digital / caja). `tipo`, `canal_default`, `saldo_inicial`, `numero_cuenta`, `cbu_alias`. Vínculo a `plan_cuentas` vía `plan_cuentas.cuenta_financiera_id`.
- **`ingresos`** / **`egresos`**: movimientos de caja con FK a `cuentas_financieras`, `proyecto_id`, `cliente_id`/`proveedor_id`, `evento_id`. Estados: `pendiente`/`confirmado`/`anulado` (ingresos) y `pagado`/`pendiente`/`programado`/`anulado` (egresos). Campo `canal` (oficial/interno), `medio` (transferencia/efectivo/cheque/mercadopago/etc), `categoria`. Cuando pasan a estado final, triggers `fn_asiento_auto_*` generan asiento contable.
- **`transferencias_internas`**: entre `cuentas_financieras`.
- **`plan_cobro`** / **`plan_cobro_items`**: cuotas por proyecto. Item: estado (pendiente/cobrado/parcial/vencido) y `monto_cobrado`. **Falta integración con comprobantes para marcar facturadas.** Fase C.
- **`comprobantes`** (emitidos): vinculados a La PyME, FK `cliente_id`/`proyecto_id`/`ingreso_id`, almacena `cae`, `cae_vencimiento`, `pdf_url`, `lapyme_response` JSONB.
- **`comprobantes_recibidos`** (proveedor): sin CAE, carga manual. Categoría, `neto`, `iva`, `total`, FK a `orden_compra_id`/`egreso_id`.
- **`vencimientos_recurrentes`** / **`vencimientos_generados`**: plantillas + instancias.
- **`conciliaciones`** / **`extracto_bancario_lineas`**: matching ingresos/egresos vs extracto. Matching es manual hoy. Fase F.

#### Funciones / Triggers Contabilidad
- `fn_asiento_auto_ingreso()` / `fn_asiento_auto_egreso()` — disparan al confirmar ingreso o pagar egreso. Generan asiento via `mapeo_cuentas`.
- **Fase A** (`sql/contabilidad_fase_a_hardening.sql`):
  - `fn_refresh_saldo_periodo(cuenta, periodo, canal)` — recalcula 1 bucket de `saldos_mensuales`.
  - `fn_refresh_saldo_cascada(cuenta, periodo_desde, canal)` — recalcula desde periodo hacia adelante.
  - `trg_saldos_lineas` (en `asiento_lineas`) — refresca saldo afectado.
  - `trg_saldos_asiento_cabecera` (en `asientos`) — refresca si cambia fecha/canal/_deleted.
  - `fn_audit_asientos()` + `trg_audit_asientos` — registra cambios en `audit_logs`.

### Funciones PL/pgSQL en Supabase

| Función | Uso |
|---|---|
| `calcular_receta(p_item_id BIGINT)` | **Fuente de verdad del cálculo de costos.** Recursiva (sub-items via BOM). Devuelve `(costo_mp, costo_fabricacion, costo_por_uso, precio_alquiler)`. Aplica regla 1:N si `vida_util_armado_override > 0`. Lee snapshots del item, defaultea a `parametros_globales`. Ver detalle en sección 6.5. |

**Bug conocido — columnas rotadas en `clientes`:**
```
columna 'rubro'               → contiene telefonos
columna 'telefono'            → contiene emails
columna 'correo_electronico'  → contiene rubros
```
El mapeo se maneja en `api.js` al hacer el fetch. No se corrige en Supabase.

### La PyME API
- **Estado:** V4 (implementado)
- **URL:** `api.lapyme.com.ar`
- Facturacion, ventas, clientes. Match by customer.name
- SQL de integracion: `sql/v4_pyme_integration.sql`

### Cotizador MEPEX  — app SEPARADA (el lobby es PUENTE, no diseñador)
- **Estado:** Producción. **App separada**, repo `federicomengelle-commits/COTIZADOR-MEPEX` (privado). Cotiza **stands / expos / alquiler**.
- **Stack real** (NO "Notion/Railway/Vercel" — legacy removido): Vanilla JS SPA + jsPDF (PDF presupuesto) + **weasyprint `/propuesta-api`** (PDF propuesta comercial) + Express `server/index.js` (Node 18) + IA **Claude Haiku 4.5** vía backend.
- **URL real:** `http://195.200.1.250/cotizador/` (front) + `/cotizador-api/api` (back), pm2 `cotizador-api`. **NO existe `cotizador-mepex.vercel.app`.** Link externo desde acciones rápidas del sidebar.
- **Corte:** convierte necesidad + catálogo en **precios** + 2 PDFs (presupuesto + propuesta). El **lobby** es dueño del **catálogo/costos** (Costos), del **CRM** (clientes/proyectos/eventos/estados) y de la **facturación** (`pyme_*`). El cotizador NO diseña en 3D, NO administra catálogo, NO factura.
- **Comparte la MISMA Supabase** → **CONTRATO** (coordinación de schema crítica):
  - **Lee (no escribe):** `catalogo_items` (solo `es_cotizable=true`; precio = **`precio_alquiler`** redondeado — NO `precio_cliente`), `clientes`, `proyectos`, `eventos`.
  - **Escribe:** columnas ALTER de `cotizaciones` (`tipo_cotizacion/superficie/tipo_stand/altura/subtotal/iva/fecha_emision/full_state/pdf_url/project_id/event_id`) + tablas **propias** `cotizacion_items` / `cotizacion_espacios` / `cotizacion_numerador` (RPC `siguiente_numero_cotizacion`) / `cotizacion_propuestas` + Storage `cotizaciones-pdf`/`propuestas-pdf`. **NO toca `pyme_*` ni `vendedor_id`** (NULL hoy).
  - **Regla de oro:** columna nueva en tablas compartidas = **coordinar**. El lobby **NO recomputa precios** (fórmula única en `pricing.js` del cotizador → leer `cotizaciones.monto_total/subtotal/iva`).
- **NO duplicar el cotizador desde el lobby.** El diseñador OCTEXA in-lobby (`disenador.js`) quedó **oculto/superadmin, parkeado** — no reactivar ni reproponer un diseñador; Fede hace el "diseñador con IA" **aparte**. Integración a **priorizar**: **importador 3ds Max→BOM** (`importar-3dsmax.js`, ya construido, falta 1 CSV) + **leer `cotizacion_items` estructurada** en vez de parsear el texto del PDF (`importar-cotizacion.js`; `full_state` HOY sí trae los ítems).
- **Contexto completo:** memorias `reference_cotizador_mepex` + `project_cotizador_integracion_lobby`. Fuente: `docs/cotizador-contexto-cuestionario.md` (+ `cotizador-contexto-respuestas.md`).

### GitHub
- **Repo:** `https://github.com/federicomengelle-commits/LOBBY-MEPEX.git`
- Branch: `main`

---

## 8. REGLAS DE CONDUCTA

1. **Planificar antes de codear.** Usar plan mode.
2. **No romper lo que funciona.** Cambios quirurgicos.
3. **Nunca borrar archivos sin preguntar.** Backup antes de reescribir.
4. **Mostrar resultado antes de avanzar.** No encadenar cambios sin validacion.
5. **Dark theme MEPEX siempre.**
6. **Leer `CLAUDE.md` (raiz) y los `.md` relevantes en `docs/` antes de empezar a codear.**
7. **Actualizar `CLAUDE.md` AL CIERRE de cada sesión** y especialmente al completar una fase de trabajo o detectar discrepancias entre código/SQL del repo y la realidad de producción. Este archivo es la fuente de verdad para futuras sesiones; si está desactualizado, mentí.
8. **Interfaces de rol Taller = ultra simples.**
9. **Shell por defecto del entorno = Bash POSIX.** Usar `rm`, `ls` ahí. Para herramientas Windows-only (`Remove-Item`, gestión de servicios) usar la PowerShell tool. NUNCA mezclar comandos: Bash no entiende `del`/`type`/`findstr`.
10. **Fede = superadmin del sistema.**
11. **Supabase es la fuente de verdad.** localStorage es para preferencias UI, no datos de negocio.
12. **Schema real > SQL del repo.** Las migraciones en `/sql/` están aplicadas hace tiempo y la BD pudo modificarse manualmente. ANTES de tocar contabilidad/finanzas o cualquier tabla con incertidumbre, ejecutar `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '...'` para verificar el schema vigente. Si encontrás un archivo SQL desfasado, borralo y dejá nota en `Estado actual`.
13. **El bug de columnas rotadas en `clientes` se maneja en `api.js`**, no se corrige en Supabase.

### Eficiencia operativa (preferencias del usuario)

14. **Mínima cantidad de tokens posible.** Respuestas concisas, sin recapitular lo obvio.
15. **Simplificar el accionar.** Una pasada precisa > tres pasadas tentativas.
16. **Evitar pasos en vano.** No verificar lo que ya se sabe. No re-leer archivos sin razón. No repetir lo mismo en distintas formas.
17. **Ser certero.** Si hay decisión clara, ejecutar; si hay duda real, preguntar una sola vez con opciones concretas. Nada de "¿querés que…?" cuando ya está acordado.
18. **Plan first solo cuando aporta valor.** Si la tarea es chica y obvia, ejecutar directo. Plan extenso solo para refactors macro.

### Método pro (consultoría Jordi, 2026-07-18)

19. **Reviewers como subagentes ANTES de commitear.** Instalados en `.claude/agents/` (local, gitignored; genéricos de Jordi a nivel usuario `~/.claude/agents/`): `security-reviewer` (diff toca input/auth/endpoints/datos sensibles), `typescript-reviewer` (todo diff JS no trivial), `sql-reviewer` (TODO `sql/*.sql` nuevo antes de entregárselo a Fede). Findings CRITICAL/HIGH se arreglan antes del push. Originales + veredicto: `docs/jordi/`.

---

## 9. ARCHIVOS DE REFERENCIA

> Solo `CLAUDE.md` y `deploy.md` viven en la raiz. Toda la documentacion historica
> (blueprints, specs, prompts, briefs de marca/stack) se movio a `docs/` para
> reducir ruido. Citar siempre con la ruta `docs/<archivo>.md`.

### Raiz
| Archivo | Contenido |
|---------|-----------|
| `CLAUDE.md` | Este archivo. Instrucciones del proyecto para Claude Code. |
| `deploy.md` | Instrucciones de deploy (git push). |

### `docs/`
| Archivo | Contenido |
|---------|-----------|
| `docs/MEPEX_CLAUDE.md` | Prompt base original para Claude (contexto empresa + cotizador) |
| `docs/MEPEX_BRAND.md` | Guia de marca visual completa (colores, tipografia, logo, iconos, botones) |
| `docs/MEPEX_STACK.md` | Stack tecnico, convenciones de codigo, patrones, tablas Supabase |
| `docs/BRIEF_VISUAL_STYLES.md` | Brief para aplicar diseno web MEPEX al dashboard |
| `docs/MEPEX_UNDO_SYSTEM.md` | Documentacion del sistema undo/redo |
| `docs/modulo-eventos-blueprint.md` | Blueprint del modulo Eventos |
| `docs/modulo-ventas-blueprint-v2.md` | Blueprint del modulo Ventas V2 |
| `docs/calendario-operativo-blueprint.md` | Blueprint del calendario operativo |
| `docs/calendario-prompts-ejecucion.md` | Prompts secuenciales para construir el calendario |
| `docs/perfiles-admin-roles-blueprint.md` | Blueprint de perfiles, admin panel y roles |
| `docs/cotizaciones-upgrade-blueprint.md` | Blueprint de upgrade de cotizaciones |
| `docs/PROMPT-SIDEBAR-EDITOR-INTEGRATION.md` | Instrucciones de integracion del sidebar editor |
| `docs/PROMPT-INVENTARIO-CLAUDE-CODE.md` | Prompts para el modulo Inventario |
| `docs/LOBBY-POR-ROL-SPEC.md` | Spec del lobby segmentado por rol |
| `docs/FASE-1-ESTRUCTURA-MACRO.md` | Spec de estructura macro (rediseno) |
| `docs/FASE-2-SUBSECCIONES.md` | Spec de subsecciones (rediseno) |
| `docs/FASE-3-ROLES-PERMISOS.md` | Spec de roles y permisos (rediseno) |
| `docs/FASE-4-PRIORIDADES-EJECUCION.md` | Prioridades de ejecucion (rediseno) |
| `docs/AUDITORIA_ESTRATEGICA_2026.md` | Auditoria estrategica 2026 |
| `docs/modulo-taller-logistica-blueprint.md` | Blueprint integrado Taller + Logística + RRHH + Notifs + Encuestas |
| `docs/prompts/tanda-1-base.md` | Prompt ejecutable Tanda 1 (schema · API · Drive · notifs · novedades) |
| `docs/prompts/tanda-2-operativo.md` | Prompt ejecutable Tanda 2 (módulos Taller / Logística + remito) |
| `docs/prompts/tanda-3-cierre.md` | Prompt ejecutable Tanda 3 (RRHH / convocatorias / encuesta cliente) |
| `docs/finanzas_blueprint_v2.md` | **Blueprint Finanzas + Contabilidad v2** (2026-05-19): partida doble, lado A/B, plan de pagos avanzado, compras familiares con IVA virtual, ARCA directo (deprecar La PyME), multi-moneda, conciliación bancaria, saldos apertura 2027. Plan plug & play en 8 fases (A-H). Schema real verificado vs prod. |
| `docs/modulo-rrhh-v2-blueprint.md` | **Blueprint Módulo RRHH v2** (2026-06-11): SPEC OBLIGATORIA de la fase RRHH del plan maestro. 5 tabs estilo CRM (Panel/Nómina/Planificación/Ausencias/Jornales), ficha completa, DDL (`ausencias`, `vacaciones_saldos`, `persona_documentos`), migración + retiro `rrhh_*`, 5 etapas. RRHH.5 depende de "Rendimiento por evento" (Finanzas). |
| `docs/CLAUDE.md.old` | Version anterior de CLAUDE.md (referencia historica) |

---

## 10. ESTADO ACTUAL

> **Reorg capa operativa física = 100% CONSTRUIDA, PUSHEADA Y VERIFICADA EN PROD (A→F + corte destructivo).** Módulos **Taller y Logística DISUELTOS** (el **rol** taller se conserva): Taller→Proyectos(galpón read-only)+Tareas, Logística→Transporte en la ficha del Evento; redirects `#taller→#tareas`/`#logistica→#eventos`. `taller.js` borrado; `logistica.js` borrado; tablas legacy `cargas`/`logistica_*` NO dropeadas (inertes). **Verificado en prod 2026-06-26 via Chrome** (reorg estructural + rutinas end-to-end + botones; 8 rutinas reales sembradas vía app = 10 total; 0 errores). **🐞 fix:** `'flota'` faltaba en `tareas._MODULOS` → `tareas.js?v=9` (commit `104df77`), **⏳ Fede solo re-pullea** para tomarlo. Tracking: `PROGRESO.md` §sesiones 2026-06-24/25/25b/26 + `PLAN-MAESTRO §REORGANIZACIÓN…` + handoff `docs/reorg-capa-operativa-handoff.md`. Spec: `docs/capa-operativa-blueprint.md`. Pulidos opcionales (no funcionales): `sql/reorg_cleanup.sql` PARTE 1 (limpiar `roles.permissions` del DB) · PARTE 2 DROP legacy (comentada, "evitar romper").

- **Sesión 2026-07-16 (Cierre pre-reunión Jordi: facturación ARCA estaba CAÍDA + deploy VPS completo) — ✅ TODO VERIFICADO EN PROD:** **todos los POST a `/api/` daban 500 desde el switch de dominio** (facturar/digest/OCR muertos): los browsers mandan `Origin` en POST same-origin (en GET no) y el `ALLOWED_ORIGINS` del VPS tenía el IP viejo → `cb(new Error)` del cors → Express 5 → 500 HTML. Fix `e98ec84`: default → dominio + **`cb(null,false)` en vez de Error** (patrón corregido en `tools/vps/server.js` y `lobby-api/index.js`). Deploy de Fede + verificación vía su Chrome: digest **`provider:claude`** ✓ · OCR ✓ · facturar 401-sin-token ✓ (ARCA operativa) · `/lobby-api/deploy` 10×401→**429** (B3 ✓). **Dato de deploy: lobby-api corre DIRECTO del repo** (`/home/mepex/lobby/lobby-api/index.js`) → pull + `pm2 restart lobby-api` alcanza, sin cp. **+ M4 residual cerrado sin código** (GoTrue v2.193.0 ya revoca todas las sesiones en el reset por admin — verificado contra el tag). **+ B5**: npm audit 0 vulns. **CSP enforcing en prod verificada.** Score ~38/40; restan 4 manuales de Fede (Dashboard min 10 · MFA · query M5 · bucket stands) — `docs/cierre-auditoria-jordi.md` §Pendientes.

- **Sesión 2026-07-15 (Post-flip CSP: fix "crear cuenta" + barrido IP→dominio + CARGA DIFERIDA del JS) — PUSHEADO · ⏳ pull + re-copy nginx conf de Fede:** Fede reportó errores al crear usuario con la CSP ya enforcing en prod. **Causa raíz: `api.js._lobbyApiBase` hardcodeaba `http://195.200.1.250/lobby-api`** (CSP + mixed content lo bloqueaban desde `https://app.mepex.com.ar`) → **relativo `/lobby-api`** (same-origin vía nginx). **Barrido completo del IP viejo en el front:** cotizador → `/cotizador/` en `crm.js?v=34`/`data.js?v=27`/`router.js` + defaults `ALLOWED_ORIGINS` de `lobby-api/index.js` y `tools/vps/server.js` → dominio nuevo. **+ 🐞 `audit_log` 400:** `record()` mandaba `table_name:null` en login/logout/denied (NOT NULL en prod) → fallback `entityType || module || 'sistema'` (`audit-log.js?v=3`). **+ CSP:** `connect-src` suma cdnjs/jsdelivr (los `.js.map` que DevTools pide con F12 ensuciaban la consola de bloqueos). **+ CARGA DIFERIDA (recomendación del amigo de Fede): el login ya NO carga toda la app** — `index.html` quedó con 7 scripts CORE (supabase/config/data/router/auth/audit-log/app) y los ~46 restantes los inyecta `App.ensureAppLoaded()` recién con usuario autenticado (`Router.handleRoute()` gatea; re-registra rutas para el teardown 12.A; descarga paralela `async=false` = orden preservado; retry-safe). **⚠️ Versiones `?v=` de módulos diferidos ahora se bumpean en `App._APP_SCRIPTS` (app.js), NO en index.html — ver §5.** Verificado en local con la CSP enforcing exacta: login 7 scripts/globals internos ausentes/0 errores · loader 46 scripts en ~170ms · flujo completo simulado (auth stub → hashchange → carga sola → shell+lobby renderizan, `obj` teardown rebindeados) · 0 errores de consola. **⏳ Fede:** `~/pull-lobby.sh` + re-copiar el conf de nginx (`sudo cp /home/mepex/lobby/tools/vps/nginx-mepex.conf /etc/nginx/sites-enabled/mepex && sudo nginx -t && sudo systemctl reload nginx`) → probar crear usuario + login normal. Sigue pendiente el resto del handoff de seguridad (paso 1 deploy lobby-api, MFA, etc.).

- **Sesión 2026-07-14 (Seguridad — CSP a ENFORCING, último ítem estructural del checklist JordiGPT) — LISTA EN REPO · ⏳ deploy nginx de Fede:** sin violaciones Report-Only para pegar → auditoría estática de recursos + test local con la policy enforzada (boot + encuesta E2E: 0 violaciones). 4 roturas cazadas antes del flip: `connect-src` con `api.dolarapi.com` (el código usa `dolarapi.com`) · `frame-src` sin Supabase (PDFs de Storage en iframes) ni `blob:` (visor del acta) · `encuesta.html` con script inline (página pública) → externalizado a **`encuesta.js?v=1`** · hover inline de `router.js` → CSS (`router.js?v=20`). `tools/vps/nginx-mepex.conf` = header enforcing + policy corregida + `form-action 'self'`; script-src SIN `'unsafe-inline'`. **Verificado además: el paso 1 del handoff (deploy lobby-api) NO está hecho** (12×401 sin 429 en `/lobby-api/deploy`). **⏳ Fede:** handoff pasos 0-7 de `docs/cierre-auditoria-jordi.md` (0 = pull + `cp` del conf + `nginx -t && reload` + smoke F12).

- **Sesión 2026-07-01 (Contexto del Cotizador en el lobby — SIN código de app, solo docs+memoria):** Fede trajo las respuestas del cuestionario del Cotizador (`docs/cotizador-contexto-cuestionario.md` + `cotizador-contexto-respuestas.md`). Capturado como **fuente de verdad**: memorias `reference_cotizador_mepex` (qué es/límites/stack real/inputs/outputs/modelo de datos + **CONTRATO Supabase** lee/escribe) + `project_cotizador_integracion_lobby` (features del lobby que PISAN al cotizador + prioridades). **Premisa reafirmada: el lobby es PUENTE, no diseñador** — el diseñador OCTEXA in-lobby (`disenador.js`) queda **oculto/superadmin, parkeado**; NO reactivar ni reproponer un diseñador (Fede hace el "diseñador con IA" aparte). **§7 "Cotizador MEPEX" reescrita** (era stack legacy Notion/Railway/Vercel + URL Vercel inexistente → stack real VPS + contrato Supabase). Integración a priorizar: **importador 3ds Max→BOM** (`importar-3dsmax.js` ya construido, falta 1 CSV) + **leer `cotizacion_items` estructurada** en vez de parsear el PDF (`importar-cotizacion.js`); ojo: `cotizaciones.full_state` **HOY sí trae los ítems** (la Fase 4 asumía que no → revisar). Nota anotada en PLAN §TRACKS PARALELOS. **Solo docs — sin cambio de % del rediseño; push de CLAUDE.md/PLAN/PROGRESO.**
- **Sesión 2026-06-30 (Eventos — pulido de modales + puente jornadas→Rendimiento, interactivo con Fede) — TODO PUSHEADO + verificado en preview · ⛔ 2 SQL-first + validación de Fede**:
  - **Crear evento** (`eventos.js?v=28`/`api.js?v=64`, commit `4d4234a`): sacado el campo "Estado" (era **código muerto** — la columna no existe en `eventos`, el estado ya es 100% auto por fechas vía `_deriveEstado`) + **Organizador** (FK `eventos.organizador_id`→`clientes` + flag `clientes.es_organizador`; picker datalist organizadores-primero + "+ Nuevo" crea cliente-organizador) + **Link** del evento (`eventos.link_url`, web/IG, `_linkHref` maneja @instagram/bare). Ficha (`_renderPanel`) muestra org+link + ✏️ (`_openOrgLinkModal`). Degrada limpio sin SQL (omit-when-null). ⛔ **`sql/eventos_link_organizador.sql`**.
  - **Asignar gente** (`eventos.js?v=29`, commit `b5c3765`): **WhatsApp** `wa.me` por persona (guard `if(e.target.closest('a'))return` en handler delegado, sin inline onclick) + **chip de tipo** (interna/eventual/cuadrilla). El **contador "Agregar (N)" ya existía**; el **"quién va cada día" ya estaba resuelto** (panel "Jornadas y personal" = fase→tarjeta por día con gente + "＋ gente").
  - **★ Puente asignaciones → jornales del Rendimiento** (`api.js?v=65`/`rendimiento.js?v=6`, commit `14e30b3`, ⛔ **`sql/eventos_jornal_sync.sql`** = `personas.jornal_diario`): mata el doble-tipeo. `API.syncJornalesEvento(eventoId)` + helper PURO `_computeJornalLines` (1 fila por **persona-fase**, `dias`=jornadas asignadas; verificado 6 casos en preview) → upsert en `evento_costos` (preserva `tarifa` si `monto_editado`, no toca filas con pago). Botón **"🔄 Traer de asignaciones"** en el grupo Jornales (el render YA mostraba Persona·Fase·Días·Tarifa·Monto → mismo idioma). **Decisión Fede: tarifa preset desde RRHH por persona, editable inline** (`evento_costos.tarifa`/`monto_editado` ya lo soportaban). Memoria `project_eventos_jornadas_rendimiento`.
  - **⏳ Fede:** correr `sql/eventos_link_organizador.sql` + `sql/eventos_jornal_sync.sql` → `~/pull-lobby.sh` (api v=65 · eventos v=29 · rendimiento v=6) → validar (crear evento c/ org+link; asignar gente; Rendimiento "Traer de asignaciones"). **Pendiente clave:** UI en RRHH para cargar `personas.jornal_diario` (sin tarifa los jornales salen $0) + decidir auto-sync vs botón. **Eventos sin pulir (catálogo):** editar jornadas / modal transporte / docs.
  - **Git:** pusheado SOLO lo propio vía worktree cherry-pick; los 5 commits OCTEXA de la charla paralela siguen locales (no publicados). origin/main = `14e30b3`.

- **Sesión 2026-06-29 (autónoma — Fede dejó laburando ~2h) — C verificado en prod · A Eventos (Transporte filas finas) pusheado · B importador 3ds Max parado**:
  - **C — CRM Bandeja v2 ✅ VERIFICADO EN PROD** (Chrome MCP, caso temp `79ec9699…` + cleanup). Fede ya corrió `sql/crm_bandeja_v2.sql` (`snoozed_until`/`linea` = OK). Confirmado con los métodos reales: **snooze** `API.snoozeCaso` persiste → `getCasoSnoozes` lo trae → `unsnoozeCaso` limpia · **línea** `updateCaso({linea})` stand→expo persiste · **semi-auto** `CRM._semiAutoCotizado(casoId)` lead→cotizado (y auto-audita) · **audit** `AuditLog.record(action,module,detail,entityType,entityId)` inserta. **⚠️ Hallazgo: `audit_log` es APPEND-ONLY** (RLS con SELECT+INSERT, sin DELETE → el client NO puede borrar; correcto para un log) → la prueba dejó 2 filas apuntando al caso borrado; cleanup opcional `DELETE FROM audit_log WHERE record_id='79ec9699-a7b1-46ae-b770-e9702450360e';`. C = **cerrado** salvo pulir-loop visual opcional. Memoria `project_crm_bandeja_v2`.
  - **A — Eventos: Transporte → filas finas** (`eventos.js?v=27`, commit **`f938298`** en origin/main, verificado en preview 0 errores): `_renderPanelTransporte` cards chunky de 4 líneas → filas densas de 2 líneas (`.ev-trans-row`), **preservando TODOS los `data-*`/clases** de los handlers (cero cambio de lógica: toggle ítems · wa.me chofer · remito dot · acciones · add · remito-evento). Docs/Seguros YA eran filas finas (`.ev-doc-row`) → no se tocaron. **Pendiente Eventos** (próxima sesión, mejor INTERACTIVA por subjetivo): modales crear/editar/asignar.
  - **B — Importador 3ds Max: CONSTRUIDO + verificado, NO pusheado** (a pedido de Fede: "no tengo CSV, dejalo para después"). Pestaña "📥 3ds Max" en `#stands` (`renderInto`, como el Compositor) + nuevo `importar-3dsmax.js` (parser CSV PURO tolerante: 24/24 con node + render smoke 0 errores — autodetecta `,`/`;`/tab, encabezado con sinónimos vs posicional, comillas, es-AR, agrega código repetido, match alfanumérico laxo, sin-match) → match por `código` vs catálogo Costos → crea proyecto + BOM `proyecto_componentes` (patrón `importar-cotizacion.js` + `_persist` del compositor). **`importar-3dsmax.js` queda en disco (untracked, sobrevive resets); `stands.js`/`index.html` revertidos a origin para no 404 en prod** (3 líneas de integración documentadas en la memoria). **Retomar = Fede pasa 1 CSV real → fijar formato → push.** Memoria `project_importador_3dsmax`.
  - **D — ARCA `_EMISOR`:** valores YA cargados (`finanzas.js`: Colombia 1173 Lanús · IIBB 902-496739-1 · inicio 01/01/2007); **dejé el comentario `⚠️ verificar` a propósito** — el handoff dice sacarlo "al confirmar", y esa confirmación = tu 1ª emisión real A con 2 alícuotas (ahí ves el PDF). Nada seguro que tocar solo.
  - **Git (árbol compartido):** pusheé **SOLO `f938298`** (eventos) a origin/main vía worktree + cherry-pick — había **5 commits OCTEXA de una charla paralela sin pushear** debajo del mío y **no publiqué trabajo ajeno**. Esos 5 (solo tocan `disenador.js`/`docs/octexa/*`/`tools/octexa/*`, NO CLAUDE/PROGRESO/PLAN/index.html) quedan locales en `pulido-proyectos`; la charla OCTEXA los rebasea/pushea cuando esté lista.

- **Sesión 2026-06-27 (Proyectos ficha — pulido + features) — CONSTRUIDO + VERIFICADO (preview + prod con cleanup) + PUSHEADO · ⏳ Fede: bucket SQL + pull + verify logueado**: método pulir-pantallas sobre `proyecto-detalle.js` (commits `9598bf9`→`543261b`, **`?v=17`**). **(1) 7→5 pestañas** (cortadas Cotización origen + Actividad; sus 3 métodos borrados). **(2) Cotización origen → pill `⚡COT` en header + fila Origen, GATEADO para que taller NO la vea** (`_isTaller`; cierra un agujero que estaba abierto; nº resuelto en `_loadProject`→`_cotNumero`). **(3) Actividad → "Historial" colapsable en Resumen**, agrupado por día + humanizado (`_histDesc` mapea estados a labels/colores) + 24h, cargado lazy (`_loadResumenExtras`). **(4) Chip "listo para salir"** (`_renderReadinessChip`) 100% auto-derivado (evento/fechas/equipo/Drive/materiales) + banner faltantes (novedades `falta_material`) → botón Pedir compra. **(5) Duplicar** (`_openDuplicarModal`/`_submitDuplicar`) wizard 2 pasos, copia `proyecto_tipos`+`proyecto_responsables`+notas+`proyecto_componentes` (BOM best-effort), arranca por_iniciar/manual/sin cot — **verificado end-to-end en prod con cleanup**. **(6) Fotos del armado** al pie de Producción (`_fotosSectionHTML`/`_loadFotos`/`_uploadFotos`/`_compressImage`): cámara directa (`capture=environment`), compresión JPEG ~1600px, ver grande/borrar (admin/PM), subir = todos incl. taller (fuera del guard de RO); cache `_fotosCache` (no re-fetch por tilde); bucket privado `proyecto-fotos`, **degrada limpio sin él**. Visibles en Producción en **cualquier estado** (no solo en taller) → revisables tras finalizar (commit `7b6729f`). **Decisión: Storage (opción A), compresión 1600px/0.82 (no matar calidad); Drive descartado HOY** (subir necesita Google Drive API de escritura, bloqueada por el mismo problema GCP que Gmail; migrable al destrabar). **(7) Entrega repasada** — título adaptativo (`_entregaFrase`: stand/equipamiento/proyecto + fallback por nombre), wording sin jerga (Registrar entrega/Recibe (cliente)/Firma del cliente), modal simple (contexto stand·cliente, recibe+DNI en fila, observaciones plegadas); lógica de firma + `conforme-pdf.js` (acta con logo MEPEX real) **intactos**. **❌ Orden de trabajo PDF DESCARTADA** (Fede: nada de hoja suelta, QR = riesgo de seguridad; "eso ya es la Entrega"). **Decisiones de producto** anotadas en memorias `project_inventario_en_vivo` (visión: disponibilidad de material por solapamiento de fechas — el alquiler vuelve, no es stock que se agota; el chip de faltantes es la capa de captura, futuro = BOM activos vs stock) + `feedback_taller_cero_friccion` (taller grande/antitecno = cero fricción, auto-derivado > formularios). **⛔ Fede:** correr **`sql/proyecto_fotos_bucket.sql`** (bucket + RLS) → `~/pull-lobby.sh` (`proyecto-detalle.js?v=17`) → verificar en prod logueado (gate de taller con pm/venta; subir foto real; duplicar real). **+ fix (`543261b`, v=17): el conforme de Entrega mandaba `Auth.getUser().id`="fede" en `firmado_by` (col UUID) → "invalid input syntax for type uuid"; ahora usa `.uid` (el UUID de auth). Bug pre-existente del conforme (2026-06-26d), cazado por Fede al registrar una entrega REAL, verificado end-to-end con cleanup. Lección: `Auth.getUser().id` = username (ej "fede"), `Auth.getUser().uid` = el UUID — para FKs a auth usar `.uid`.** Mergeado limpio con la sesión paralela del compositor (solo se commiteó lo propio: `proyecto-detalle.js`/`index.html`/`sql/`). **Pendiente Eventos** (próximo en el catálogo pulir-pantallas): modales crear/editar/asignar + filas finas Transporte/Docs. Memoria `project_proyectos_refactor`.

- **Sesión 2026-06-26f (CRM Bandeja v2 + link reverso + auditoría) — CONSTRUIDO + VERIFICADO EN PREVIEW · ⛔ SQL-FIRST · ⏳ Fede pull+verify**: ejecución del sprint del handoff `docs/handoff-CRM-rediseno-bandeja.md` + features extra pedidas por Fede en vivo. **Bandeja v2** (`crm.js?v=23`): barra izquierda = **color de la etapa** (no más temperatura en la fila; el selector de temp queda en la ficha), **chips de urgencia** (sin-responder rojo · enfriándose naranja >7d; "vencida" fusionada en el chip de próxima acción), **chip de presupuesto** violeta clickeable (cotización más reciente vinculada → abre el cot-panel; si no hay, muestra monto estimado), **badge de estado con `▾`** (menú ContextMenu para mover de etapa sin abrir el caso), **acciones al hover** (WhatsApp `wa.me` · agendar · marcar respondido · snooze · clasificar línea), **owner = avatar de iniciales** (1 letra si nombre simple, color por hash). **Triage**: grupos "Necesitan acción" (vencida/sin-responder) / "En seguimiento" + grupo **"Pospuestos"** colapsable. **Snooze** por usuario (`API.snoozeCaso/unsnoozeCaso/getCasoSnoozes`, columna `crm_caso_lecturas.snoozed_until`). **Toggle "Solo míos"**. **Segmento de línea de negocio** `Stands · Expo · Todo` (campo nuevo `crm_casos.linea`; focalizado = triage, "Todo" = secciones por línea con encabezado + "Sin clasificar"); clasificación desde modal nuevo/editar, chip de la ficha, y acción 🏷️ del hover. Pipeline: tarjeta sin emoji de temp + puntito de línea. **Pieza 2 — link reverso cotización↔caso** (`api.js?v=63`): bloque "CASO (CRM) VINCULADO" en el cot-panel (ver/vincular/desvincular, espejo de cliente/evento/proyecto) + **semi-auto**: al vincular una cotización, el caso lead/contactado salta a `cotizado`. **Pieza 3 — auditoría** (`AuditLog.record`, tabla `audit_log` ya existente, **sin SQL**): enganchada en cliente create/edit/delete, caso estado (Bandeja ▾ + pipeline DnD + ficha select, todo ruteado por `_changeCasoEstado`) + línea + create/edit/delete, cotización estado/notas/delete/link/unlink. **Verificado en preview vía `preview_eval`** (render pipeline, triage, segmento, snooze, chip presupuesto, avatar, menús ContextMenu 6 items, CASO VINCULADO ambos estados, select de línea; **0 errores de consola**; screenshots no — cuelgan headless). **⛔ Fede SQL-FIRST:** correr `sql/crm_bandeja_v2.sql` (ALTER `crm_caso_lecturas.snoozed_until` + `crm_casos.linea` + índice; aditivo/idempotente) → recién después `~/pull-lobby.sh` (api v=63 · crm v=23). El código degrada limpio sin el SQL (snooze/línea no persisten, no rompe). **+ Presupuesto prominente en la ficha del caso** (`crm.js?v=23`, commit `b76575b`): banda con la cotización vinculada más reciente (COT · monto · estado · Abrir) arriba del timeline; el aside "Cotizaciones" queda como detalle. **+ QA adversarial** del código nuevo (agente) = **sin hallazgos de alta confianza**. **+ Proyectos — header "un solo hilo"** (`proyecto-detalle.js?v=10`, commit `376f51e`, prediseño validado con Fede): reemplaza los dos badges en paralelo (estado del proyecto + Ciclo del Taller) por un **stepper único** del ciclo de vida (Por iniciar→En proceso→En taller→Finalizado) con el ciclo del taller (`estado_taller`+`completitud_pct`) **anidado** como sub-progreso de "En taller"; rechazado = banner off-track. **Falta de Proyectos** (validado, pendiente): cortar 2 pestañas (Cotización origen→pill en header · Actividad→historial colapsable en Resumen). Todo **pusheado a main y mergeado limpio** con las charlas paralelas (OCTEXA docs / Stands Parte A `6fb98b3` / Compositor Parte B `9c9d4df`) — historia lineal, `HEAD==origin/main`, boot del árbol completo sin errores. **⏳ Resta verificación en prod logueada** (persistencia snooze/línea, semi-auto real, inserts de `audit_log`) + el pulir-loop visual sobre el render real. Memoria `project_crm_bandeja_v2`.

- **Sesión 2026-06-26e (Prediseño CRM + reordenamiento — SOLO DOCS/HANDOFF, sin código de app)**: Fede pidió ordenar el remate y puso **CRM PRIMERO** (terminar el rediseño para usarlo ya), antes del refactor de Proyectos/Eventos; Gmail/WhatsApp y R4-difusión quedan para después. **Prediseño de la Bandeja cerrado con Fede** (mockups `show_widget`): **SALE la temperatura** (auto por recencia, repetía el aging `Xd`); **barra izquierda = color de la ETAPA** del pipeline (opción A); chips de urgencia (sin-responder/vencida/enfriándose); **presupuesto linkeado** en la fila (chip clickeable; vínculo ya existe vía `cotizacion.casoId`); **estado de cambio rápido** (badge `▾`); **estado SEMI-AUTO** (manual + linkear cotización→`cotizado` + Ganado→proyecto). Sprint CRM = Bandeja + link reverso cotización→caso + auditoría de cambios. **Spec ejecutable: `docs/handoff-CRM-rediseno-bandeja.md`** (se ejecuta en charla nueva). Orden general: `docs/handoff-proxima-sesion-remate.md` (CRM=etapa 1). PLAN §Fase 7 actualizado. Sin cambio de %.

- **Sesión 2026-06-26d (Conforme de recepción del stand con firma digital) — CONSTRUIDO + VERIFICADO EN PREVIEW · ⛔ SQL-FIRST**: feature nueva pedida por Fede al cerrar B1 (el remito de Transporte de la reorg ya cubre el transporte; faltaba el **acta de entrega/recepción del stand**). **Tab "Entrega" en la ficha del Proyecto** (`proyecto-detalle.js?v=9`): checklist prellenado de los `cotizacion_items` del stand (editable) + receptor + **firma digital en `<canvas>`** (pointer events, `touch-action:none` para tablet) + compromiso de devolución → **acta PDF** (`conforme-pdf.js?v=1`, jsPDF+autotable, firma embebida, se regenera on-demand). **API** (`api.js?v=62`): `getItemsEntregaByProyecto`/`getConformesByProyecto`/`createConforme`/`deleteConforme`. **Tabla `proyecto_conformes`** (`sql/proyecto_conformes.sql`, RLS calcada de transporte; firma = PNG base64 en columna, sin bucket; `tipo` recepcion/devolucion — v1 recepción). Botón "Nuevo conforme" NO gateado por `_isRO` (el encargado=taller=RO es quien firma); eliminar = admin-level. Verificado en preview (acta PDF real `%PDF-1.3` 16KB con firma; pad hasInk/clear/toDataURL; edge cases; 0 errores). **⛔ Fede SQL-FIRST:** correr `sql/proyecto_conformes.sql` → recién después pull (api v=62 · proyecto-detalle v=9 · conforme-pdf v=1). **Pendiente futuro:** firma de **devolución** (toggle, ya soportado en `tipo`).

- **Sesión 2026-06-26c (B1 — Subalquileres por proveedor: UI v1) — CONSTRUIDO + VERIFICADO EN PREVIEW · ⏳ Fede pull + verificación en prod**: la pata de Fase 4 que automatiza el **pedido de subalquilados por evento** (recorre stands → extrae ítems subalquilados de sus cotizaciones → agrupa por proveedor → PDF de pedido por proveedor). **Sección "Subalquileres" en la ficha del Evento** (`eventos.js?v=25`, colapsable, consume `API.getSubalquileresByEvento` — backbone ya verificado, NO se tocó): KPIs + card por proveedor (tel WhatsApp/email/ítems con stand + botón "📄 PDF de pedido") + bloque "Sin proveedor asignado" + empty-state. **Nuevo `pedido-pdf.js?v=1`** (`PedidoPDF.generate({evento,proveedor})`, jsPDF+autotable, branding MEPEX, logo de `assets/logo_full.png`) → descarga `MEPEX_PEDIDO_<proveedor>_<evento>_<fecha>.pdf`. Botón PDF no gateado por `_isRO` (export read-only; la sección ya está gateada por acceso al Evento). Verificado en preview (mock data, patrón eval): globals OK, render OK (KPIs 2/4/25, 2 PDF btns, "18×", empty-state), PDF real `%PDF-1.3` 14.8KB, edge case sin ítems/contacto no rompe, 0 errores; slug folda acentos (node). **⏳ Fede:** pull → verificar en prod (evento "Estetica" → BXH/Parodi 18× Alfombra · Stand EGEO 2 + bloque sin-proveedor con TV 55") → generar PDF de BXH. **Pendientes (no v1):** mail al proveedor (Fase 2) · vista por STAND · "Generar TODOS". Detalle en PROGRESO §sesión 2026-06-26c + handoff `docs/handoff-B1-subalquileres-pedido-proveedor.md`.

- **Sesión 2026-06-25b (Reorg capa operativa — CIERRE destructivo) — PUSHEADO (commit `dbffc0d`) + BOOT-VERIFICADO EN PREVIEW · ⏳ Fede pull**: disolución del módulo Taller + desconexión de Logística + botones "Programar rutina" (OK de Fede "hasta el final"). **Rol `taller` intacto.** Borrado `taller.js` (ruta + `<script>` fuera); redirects `#taller→#tareas`, `#logistica→#eventos`, fix `#produccion→#tareas`; `logistica.js` desconectado (inerte). `data.js`: módulos fuera de categories/rolePermissions (clave de rol `taller:` conservada) + module-defs y connections "Ver Taller/Logística" borradas + quickAction "Mis tareas"→`#tareas`. Deep-links vivos re-apuntados (paso-armado→`#proyectos/<id>`, alertas→`#proyectos`, notif pasó-a-taller→`#proyectos/<id>`, createVehiculo→`#flota`). Botones 🔁 en Flota/Locaciones/Inventario→`Tareas.openProgramarRutina`. Construido por workflow ultracode (recon 4 → build → review adversarial 2 lentes → fix). Boot en preview: globals OK, `TallerModule`/`LogisticaModule` undefined, OPERACIONES=[calendario,eventos,proyectos], redirects disparan, 0 errores. Bumps: data v=22·router v=15·api v=60·alertas v=6·tareas v=8·proyecto-detalle v=8·inventario v=10·locaciones v=7·flota v=5. **Detalle en PROGRESO §sesión 2026-06-25b + handoff.**

- **Sesión 2026-06-25 (Reorg capa operativa — Fase F: Rutinas recurrentes) — PUSHEADO (commit `4b11c86`) · ⏳ Fede corre `sql/reorg_f_rutinas.sql` + pull**: motor de rutinas de mantenimiento (el "sistema nervioso") en el Centro de Tareas. Tabla `rutinas` (plantilla, `activo_id text` polimórfico) + RPC `fn_avanzar_rutina` (SECURITY DEFINER, autoriza al caller por rol/responsable) + seed no-financiero; amplía el CHECK de `tareas.origen` para `'rutina'` (la tabla `tareas` ya tenía todas las columnas). Las instancias = **tareas-derivadas claimeables** (`origen='rutina'`, `dedupe_key='rutina:<id>:<proxima_fecha>'`) que reusan el motor existente; Hecha → avanza vía RPC + limpia el claim. Pestaña **Rutinas admin-level** dentro de `#tareas` (Q24, gating solo en `tareas.js`, no toca `data.js`). Rutinas vencidas → badge. `api.js?v=59`/`tareas.js?v=7`/`alertas.js?v=5`. Decisiones: Q21=manual+seed, Q24=admin-level, Q8=seed no-financiero (no duplica `vencimientos_recurrentes`). Construido por workflow ultracode (recon→build→review adversarial 4 lentes→fix; 2 MEDIUM arreglados: RPC sin autorización + claim huérfano). **Detalle en PROGRESO §sesión 2026-06-25 + handoff.**

- **Sesión 2026-06-23 (cierre ARCA + Recurrentes pulido + purga La PyME) — TODO PUSHEADO + VERIFICADO EN PREVIEW (commits `75916c2` / `e42758e` / `b13e9df`)**:
  - **Recurrentes (lote) pulido (`finanzas.js?v=49`, `75916c2`):** revisor con dot de estado por fila (`_loteEstadoHTML`: Lista/Emitiendo/✓ CAE/Error) + leyenda, lenguaje de Emitidos (cliente/concepto/total en mono con `$`), **hint del monto original tachado al editar** una fila (toggle en vivo en el handler), footer/CTA con chip turquesa + total/período + cautela + botón con ícono SVG (chau emoji). CSS scopeado `.fin-lote-*`, lógica de emisión intacta. Verificado por `preview_eval`. → **módulo Facturación COMPLETO** (Emitidos/Recibidos/Emitir/Recurrentes pulidos; skill `pulir-pantallas` actualizada).
  - **Cierre/auditoría ARCA = código completo y DEPLOYADO en prod:** auditoría integral OK (connector IVA mixto `iva_alicuotas`→N `AlicIva` + compat legacy de 1 alícuota para Recurrentes/simple; contrato front→back; `_calcItems` A/B/C correcto; `_VPS_URL:''` same-origin, NO pega al `:3000` firewalleado; comprobante imprime datos fiscales emisor+receptor). **Fix doc del connector** (`e42758e`): faltaba documentar la 4ª ruta `/api/arca/padron`. **Fede deployó el connector con IVA mixto** (`cp /home/mepex/lobby/tools/vps/arca-connector.js /home/mepex/api/` + `pm2 restart mepex-api`) → **`/api/arca/status` = `{ok:true, App/Db/Auth OK}`**. **⏳ Resta SOLO:** 1 emisión real **A con 2 alícuotas (21+10,5)** end-to-end + confirmar `_EMISOR` (domicilio Colombia 1173 Lanús / IIBB 902-496739-1 / inicio 01/01/2007) → al confirmar, sacar el comentario `⚠️ verificar`.
  - **Purga de La PyME (`b13e9df`) — deprecada (greenfield, ARCA la reemplazó):** el sync nunca corría (el botón gateaba `API.syncPymeToLobby`, método inexistente). Removido todo el rastro muerto — `api.js`: `_pymeBaseUrl`/`_pymeApiKey` (**⚠️ API key LIVE `lpk_live_…` expuesta en cliente + en historial git → Fede debe REVOCARLA**) / `_pymeFetch` / `getPyMESales`* / `syncFromPyME` / `getLastPyMESync` + mapeos `pyme_*`; `crm.js`: botón "Sync PyME" (render+handler) + KPI "Facturado mes" stale (CRM Analítica queda con **5 KPIs**); `modules.js`: sección "Facturación (La PyME)" de la ficha + CSS `.pyme-*`/`.pk-*-readonly`. Sin tocar datos (columnas `pyme_*` + tabla `pyme_sync_log` quedan **inertes** en Supabase). Verificado en preview (símbolos `undefined`, 5 KPIs, 0 errores). Versiones: `api.js?v=55` · `crm.js?v=20` · `modules.js?v=10`.
  - **VPS — ruido de La PyME limpiado (falta remate de Fede):** `routes/lapyme.js` rompía en Express 5 (`/:path(*)` inválido en path-to-regexp v8 → `PathError`); se comentó `app.use('/lapyme'…)` en `server.js` (backup `server.js.bak`) → error log VACÍO + status OK + mepex-api estable. **⏳ Fede:** `rm /home/mepex/api/routes/lapyme.js` + sacar la línea comentada. (El `[crm/digest] Gemini 429` es cuota free del CRM digest, tema aparte.)
  - **⚠️ Árbol compartido — bundling:** el commit `b13e9df` (`git add api.js`) **arrastró ~400 líneas de "Catálogo Showroom F1" sin commitear** (de la sesión paralela de Fede) → quedaron en main, **inertes y sanas** (0 errores, SQL F1 aún pendiente de Fede). `catalogo-pdf.js` sigue **untracked** (de esa sesión, NO se tocó). Lección reconfirmada: en árbol compartido `git add <archivo>` se lleva los cambios de TODOS (no hay `add -p` acá) → commitear apenas se termina + coordinar. **Esta sesión corrió en paralelo con la del Catálogo; al cerrar, mergear entre las dos** (PROGRESO/PLAN-MAESTRO NO se tocaron acá a propósito, para no colisionar — el estado canónico de hoy está en este §10 + memorias).

- **Sesión 2026-06-21 (Facturación recurrente / carga masiva) — CONSTRUIDO + VERIFICADO EN PREVIEW · ⏳ falta pull + 1ª emisión real de lote de Fede**:
  - **Arranque:** árbol limpio, `rediseno`==`origin/main` (`2c07d6e`). Tarea = prioridad de Fede del handoff (`docs/facturador-arca-handoff-proxima-charla.md` §B.1): poder re-emitir varias facturas frecuentes de una (monotributos a inicio de mes). **Plan-first → Fede eligió Opción A** (re-emitir del mes anterior, revisor en vivo, **sin DDL**) sobre plantilla guardada (B) o CSV (C).
  - **CONSTRUIDO (`finanzas.js?v=41`, commit `090214f`, SIN SQL):** nuevo subtab **"Recurrentes"** en Facturación (Emitidos · Emitir · **Recurrentes** · Recibidos). Flujo: selector **mes origen** (default mes anterior) → **mes destino** (default mes actual); tabla revisor (1 fila por factura emitida del mes origen: cliente · tipo · concepto · **total editable**), **checks default apagados** (opt-in, porque cada emisión es un CAE real); "Emitir N en ARCA" → **confirm con total** → loop **secuencial** sobre `/api/arca/facturar` (el backend serializa el correlativo), **no aborta** si una falla (marca la fila ✗ Error y sigue), toast resumen + las erradas quedan tildadas para **reintentar**. Fuente y destino = tabla `comprobantes` (reusa la columna `lapyme_response`). Filtra solo **facturas A/B/C oficiales** del mes origen (excluye NC/ND y estado≠emitida). Período destino → `serv_desde/hasta` = mes destino, `concepto=2` (servicios). Total editable → back-calc neto/IVA por la alícuota del origen (A discrimina, B incluido).
  - **Refactor quirúrgico:** extraído **`_buildComprobanteRecord(d, result, uid)`** (single-source del registro que se guarda en `comprobantes`) — lo usan tanto `_emitirComprobante` (individual) como `_arcaEmitirUno` (lote). El path de emisión individual no cambió de comportamiento.
  - **Verificado en preview (Chrome headless, con mock + el fetch del lote pegando contra `localhost:3000`→404, sin tocar el VPS → 0 emisiones reales):** subtab rinde y ordena; filtrado correcto (excluye error/NC/otro-mes); orden alfabético por cliente; select-all / editar total / destildar / cambio de período actualizan el footer (conteo + total + período); loop de emisión corre, confirm con mensaje correcto, manejo de error por fila + toast resumen + reintento; CSS aplicado; **0 errores de consola** (salvo los 404 esperados del test). **NO verificable en preview** (requiere VPS + cert prod = CAE real): emisión exitosa de un lote real → la prueba Fede.
  - **⏳ Fede:** `~/pull-lobby.sh` (sirve `finanzas.js?v=40`) → probar un lote chico real (tildar 1-2 monotributos de mayo, emitir en junio, ver CAE + que queden en Emitidos). **Riesgo bajo:** reusa la plomería de emisión ya probada en prod; la única lógica nueva es la selección/loop.
  - **Pendientes que NO se tocaron** (siguen del handoff): rediseño completo de la solapa Facturación (repaso de marca); NC/ND real sin emitir; gaps de Reportes (Rent.Cliente/Proyecto no filtran por período; Rentab.% cliente ~100% sin costo atribuido) — **decisión de diseño pendiente de Fede** antes de tocar.
  - **+ Rediseño de subtabs de Facturación (`finanzas.js?v=42`, commit `dd5787e`, verificado en preview):** Fede pidió separar **información** (Emitidos, Recibidos) de **acciones** (Emitir, Recurrentes) — primer paso del repaso de marca. Aplicada la Opción A (validada con mockup `show_widget`): dos grupos de pills separados por divisor, grupo acción con acento turquesa + íconos (+ / ↻). CSS scoped `.fin-fact-*` (NO toca el `.fin-subtabs` global que comparten Ingresos/Egresos/etc.). **Esto es un PATRÓN MACRO** que Fede quiere replicar en toda la app → memoria `feedback_ui_separar_info_acciones` (separar ver/consultar de crear/hacer en toda barra de tabs). **El pull trae `v=42` = ambas piezas de hoy (recurrentes + subtabs).**
  - **+ Auditoría transaccional del circuito cobro/pago (2026-06-22, prod vía `preview_eval` con cleanup) — 100% SANO.** Pedido de Fede ("simulá una cadena de cobro y pago tomando control, ver si impacta en todos lados"). **COBRO** ($121k confirmado sin factura, `registrarCobro`) → asiento auto **#33** DEBE `1.1.04 Banco` / HABER **`2.1.06 Anticipos`** (cobro sin factura = anticipo ✓). **PAGO** ($60.5k con comprobante, `registrarGasto`) → asiento auto **#34 con IVA crédito `1.1.09` en 3ª línea** (DEBE `5.1.02` 50k + DEBE IVA 10.5k / HABER Banco 60.5k). Ambos balanceados; impacto verificado en `saldos_mensuales` + Libro Diario + tabs Ingresos/Egresos + Recibidos(pagado) + KPIs Dashboard; partida doble global cuadrada en cada paso. **Cleanup restauró EXACTO al estado inicial** (11 asientos, $13.136.600). Confirma que la deuda del IVA ya está resuelta (Fase 2) y que `ingresos` NO tiene `categoria` (clasifica por servicio/fallback). Detalle + cabo suelto ("anular" por UI) en PLAN-MAESTRO §Fase 8.
  - **+ Correcciones del comprobante (`finanzas.js?v=43`, commit `6b178cf`, iterado en mockups `show_widget` con Fede):** Fede mandó el PDF real (FC B + **NC B** 00005-00000002, ya emitidas) con 3 marcas → arregladas en visor **y** PDF: (1) **título por tipo** (helper `_tipoComprobanteNombre`: `FACTURA A/B/C` · `NOTA DE CRÉDITO A/B` · `NOTA DE DÉBITO A/B`; el PDF hardcodeaba `FACTURA {letra}` → la NC salía "FACTURA B"); (2) **logo MEPEX** más grande + a la izquierda (viewBox recortado `640 0…`) + subido (centrado con la caja de la letra); (3) **IMPORTE TOTAL** separado de la línea turquesa. **Clave:** el sistema NO archiva el PDF (`pdf_url:null`) — guarda los datos y **regenera on-demand** con el código actual → las facturas viejas se bajan ya corregidas desde Emitidos→"Descargar/imprimir" (no hay que migrar nada). Visor verificado en preview; el PDF se genera sin error (no se pudo renderizar a imagen acá: pdf.js cuelga el headless igual que los screenshots) → validación visual final del PDF la hace Fede tras pull.
  - **+ Reportes arreglados + "anular" verificado (`finanzas.js?v=44`, commit `4b9d1ab`) — "hacé todo en orden" #1+#2:** **(Reportes)** el selector "Período" ahora filtra Rent. Cliente/Proyecto (gte/lte `fecha`) + **costo real por cliente** (Σ egresos pagados imputados a sus proyectos) → Rentab.% deja de dar 100% falso (verificado 70% con data de prueba + cleanup). *Hallazgo:* la data imputa a cliente (ingresos) pero **no a proyecto** → hoy el costo por cliente da 0 hasta que se imputen gastos a proyectos (operativo). **(Anular)** ✅ **cabo de integridad CERRADO**: anular ingreso/egreso por la UI (`estado→'anulado'`) **revierte vía contra-asiento** ("Reversión: …", deja traza), el saldo de la cuenta vuelve exacto + partida doble balanceada (verificado ingreso **y** egreso con cleanup). Sin código (triggers `trg_revertir_asiento_*` ya vivos). **Restan #3 rediseño solapa (estético, a validar con Fede) + #4 recurrente v2 (DDL).**
  - **+ #3 Rediseño solapa Facturación EN CURSO (sesión de pulido en vivo) — Emitidos `v=45` + Recibidos `v=46` + skill `pulir-pantallas`:** Fede pidió encapsular el método (mostrar render REAL → indicación destilada → aplicar en vivo, charla directa) como **skill** → `.claude/skills/pulir-pantallas/SKILL.md` (local; `.claude` está gitignored, no va al repo pero Claude Code la detecta). Tokens de marca + método + lecciones (NO inventar logos/mockups truchos; los screenshots y el render de PDF cuelgan el headless → verificar por `preview_eval`) + catálogo de pantallas a tildar. Aplicados con mockups validados por Fede: **Emitidos** (`v=45`, commit `bc04ec5`) = barra de 4 KPIs livianos (Comprobantes·mes · Facturas·año · Ticket promedio · Cliente top — Fede recortó los montos abultados) + tabla 10→6 col (Fecha·Tipo·Número·Cliente·Total·Estado-dot + botón descargar PDF por fila; neto/iva/cae/servicio van al panel). **Recibidos** (`v=46`, commit `e6291a9`) = 4 KPIs (… · **Sin pagar** accionable) + tabla 11→7 col (pago con punto verde/naranja + clip del adjunto, filas sin-pago resaltadas). Helpers reusables `_renderFact*KPIs`/`_estadoDotComp`/`_pagoDotRec`/`_ensureFactKpiStyles`. Verificado en preview (0 errores). **+ Emitir: stepper ✅ rediseñado** (`v=47`, commit `01aeea1`): círculos rellenos (activo turquesa con glow / done verde / inactivo gris) + línea conectora + label debajo + form centrado (max 600px), en vez del subrayado azul plano. **Revisión de requisitos AFIP hecha** = todos los obligatorios YA están (el wizard emite con CAE). **Decisión de Fede:** los ítems del wizard van como **grilla de varios ítems + IVA por ítem (21/10,5) = IVA MIXTO + frases hechas editables inline**. **✅ IMPLEMENTADO** (`finanzas.js?v=48`, commit `08ddcdf`): grilla en el paso 2 (descripción+cant+precio+alícuota, subtotales y desglose de IVA por alícuota en vivo) · frases hechas (chips + editar inline en modal, set en localStorage) · helpers `_calcItems`/`_ivaIdAfip` · **SIN DDL** (ítems en `lapyme_response.items`) · PDF+visor renderizan N líneas con fallback al ítem único · **`arca-connector.js`** acepta N `AlicIva` (IVA mixto) con compat al formato viejo. **Verificado en preview** (A mixto neto $100k/IVA $18.900 [16.800+2.100]/total $118.900, B/C OK, grilla en vivo, 0 errores). **⏳ Fede:** deploy del connector en el VPS + 1 factura real con 2 alícuotas. **Faltan:** Recurrentes lote · resto del catálogo.

- **Sesión 2026-06-21 (Facturador ARCA + Dashboard + padrón + rediseño comprobante) — DEPLOYADO Y ANDANDO EN PROD · diseño finalizado con Fede**:
  - **Cierre de la sesión:** backend ARCA deployado por Fede (cert+rutas en `server.js`); **1ª factura real emitida** (FC B 00005-00000002, CAE OK). **Padrón AFIP** (`ws_sr_constancia_inscripcion`) autorizado+probado → autocompleta receptor por CUIT. **Diseño del comprobante FINALIZADO** (iterado en mockups con `show_widget`): logo grande, letra centrada, emisor 2 renglones, receptor en card, **IVA discriminado en A / incluido en B**, **CAE+QR+isologo anclados al pie de la A4** (preview=visor=PDF). Visor de Emitidos = modal central. Campo "CUIT" (sin "/DNI"). **Fix Reportes** Rent. Cliente/Proyecto que se colgaban (N+1 → queries agregadas). **`finanzas.js?v=40`** (último). **📘 Handoff próxima charla: `docs/facturador-arca-handoff-proxima-charla.md`** (ideas: facturación recurrente/CSV/monotributos, rediseño solapa Facturación, gaps de reportes, NC/ND sin emitir aún). ⏳ Fede: pull + verificar diseño en PDF real + reportes.
- **Sesión 2026-06-21 (Facturador ARCA + Dashboard) — CONSTRUIDO + VERIFICADO EN PREVIEW · ⏳ falta deploy backend de Fede + 1ª emisión real**:
  - **Arranque:** árbol limpio, `rediseno`==`origin/main` (`16c5665`). Plano: `docs/arca-facturador-dashboard-HANDOFF.md` (ahora con §E = lo construido + pasos de deploy). Trámite+conexión ARCA ya estaban hechos/verificados (no se tocó).
  - **Decisiones de Fede esta sesión:** (1) al emitir OK **se OFRECE "Generar cobro"** (no auto-dispara el ingreso → no registra plata fantasma; reusa `generarIngresoDeComprobante`). (2) Tipos v1 = **A, B, NC A/B, ND A/B** (las notas piden comprobante asociado vía `CbtesAsoc`). Factura C / informal-foto / E / M = siguen por **carga manual** de emitidos.
  - **Part 1 — Backend `tools/vps/arca-connector.js` (reescrito de check → módulo Express):** `GET /api/arca/status` (FEDummy) · `GET /api/arca/ultimo?pv=&tipo=` (FECompUltimoAutorizado) · `POST /api/arca/facturar` (FECAESolicitar). Reusa los 3 trucos (SOAPAction vacío WSAA · TLS `SECLEVEL=1`+`minDHSize:1024` WSFE · TA cacheado 12h + login serializado). **Maneja `CondicionIVAReceptorId`** (RG 5616 — verifiqué contra el WSDL vivo que existe y va entre MonCotiz y CbtesAsoc; AFIP lo exige aunque XSD diga opcional) + **`CbtesAsoc`** para NC/ND. Orden de elementos `FECAEDetRequest` = XSD estricto (Iva DESPUÉS de CbtesAsoc). Cert/key/CUIT por `.env`, fuera del repo. Serializa emisiones (no pisa el correlativo). El original verificado sigue intacto en `C:\Users\Fede\Desktop\mepex-arca\arca-check.js`.
  - **Part 2 — Pestaña Facturación (`finanzas.js?v=33`):** subtab "Emitir" = wizard 3 pasos con **PREVIEW visual "en papel"** (membrete MEPEX, emisor/receptor, ítems, IVA discriminado en A / total en B, letra+COD AFIP, **próximo número consultado a ARCA en vivo**, "CAE pendiente"). Emitir → ARCA → guarda en `comprobantes` (CAE + respuesta ARCA en `lapyme_response` reusada, **SIN DDL**, greenfield) → **descarga PDF con QR de AFIP** (jsPDF+autotable+qrcodejs) → pantalla de éxito con "Generar cobro". Panel de Emitidos: botón reimprimir PDF + label "Respuesta ARCA". La carga manual de emitidos/recibidos NO se tocó.
  - **Part 3 — Panel→Dashboard (`finanzas.js?v=33`):** tab "Panel"→"Dashboard" (key `panel` intacto). Header con mes + badge de canal; KPIs agrupados (Resultado del mes con **Resultado neto** + deltas vs mes anterior · Posición). Charts + toggle Oficial/Interno intactos.
  - **`index.html`:** `finanzas.js?v=33` + qrcodejs (cloudflare, no jsdelivr).
  - **Verificado en preview (sin backend):** preview A/B renderiza lindo ✅ · QR→dataURL PNG ✅ · Dashboard KPIs+deltas ✅ · 0 errores de consola. **Falta:** deploy backend de Fede (subir cert+key a `/home/mepex/api/certs/`, `cp` connector, `.env`, montar 3 rutas en `server.js`, `pm2 restart`, probar `status`/`ultimo`) → recién después **1ª emisión REAL controlada** (en prod NO hay dummy). Pasos exactos en HANDOFF §E.
  - **⚠️ Pendiente menor:** completar `_EMISOR` en `finanzas.js` (domicilio fiscal exacto + IIBB + inicio de actividades de MEPEX) para que el PDF impreso sea correcto.

- **Sesión 2026-06-21 (charla Finanzas — continuación 2) — verificación de 3d.2/Opción A + Fase 4 v1.1 (KPI + cheque/e-cheq en modales) · TODO VERIFICADO EN PROD (Chrome, con cleanup)**:
  - **Arranque:** árbol limpio, `rediseno`==`origin/main` (`e10745e`); Fede ya había corrido `sql/fase3d2_comprobante_evento.sql` + pull (prod servía api v=52 / finanzas v=30 / carga-comprobante v=3 / rendimiento v=4). `comprobantes_recibidos.evento_id` confirmado en prod.
  - **✅ VERIFICADO end-to-end (lo que quedó buildeado-sin-testear la sesión anterior):**
    - **3d.2 (a)** emitido→"Generar cobro" (`_showGenerarIngresoModal`→`API.generarIngresoDeComprobante`): sembré comprobante emitido (`servicio=SRV-ALQUILER`, neto 100k/IVA 21k) → ingreso confirmado + link bidireccional + **asiento balanceado DEBE `1.1.04` 121k / HABER `4.1.02` venta 100k + HABER `2.1.02` IVA débito 21k**. (Nota: `comprobantes.tipo` usa el enum `factura_a…`, NO `'A'`.)
    - **3d.2 (b)** recibido con `evento_id`→egreso: `generarEgresoDeComprobante` propaga `evento_id`+`proyecto_id`+`proveedor_id`; `categoria material`→`proveedor`; link bidireccional OK.
    - **3d.2 (c)** filtro "Solo sin pago" + columna "Pago" en Recibidos: 3 filas→2 al filtrar (oculta la pagada)→3 al restaurar. (`items.filter(c => !c.egreso_id)`.)
    - **Opción A** (Rendimiento↔Finanzas): egreso directo con `evento_id` no-linkeado a `evento_costo_pagos` → `getRendimientoDashboard.costos_directo` sube exacto; split `planilla + Finanzas`, sin doble conteo.
  - **✅ CONSTRUIDO + VERIFICADO en UI real — Fase 4 v1.1 pieces 1+2** (`finanzas.js?v=31`, commit `ceffdd1`, **SIN SQL** — `cartera_valores`/triggers ya en prod):
    - **Piece 1 — KPI "Valores en cartera" en Panel** (`_loadPanelData`/`_renderKPIs`): card nueva, a cobrar (`1.1.07`) + delta "a pagar" (`2.1.07`), respeta el toggle de canal. Verificado: $90k a cobrar / $70k a pagar con los e-cheq de prueba; vuelve a $0 al limpiar.
    - **Piece 2 — `medio=cheque` en modales Ingreso/Egreso**: al elegir Cheque se despliega el bloque de datos del valor (tipo e-cheq/cheque, banco, nro, titular, fecha cobro/débito). **Ingreso**→`API.crearValorRecibido` (ingreso + `cartera_valores` recibido; **asiento DEBE `1.1.07` / HABER `2.1.06`** anticipo, sin tocar banco). **Egreso**→exige cuenta origen, inserta el egreso directo (preserva la `categoria` elegida → trigger rutea **HABER `2.1.07`**) + fila `cartera_valores` emitido linkeada (`egreso_id`). Antes "Cheque" creaba un movimiento suelto sin fila en cartera (valor que nunca se podía clearing) — ahora queda en cartera y se gestiona en la pestaña Valores.
  - **✅ Fase 4 v1.1 piece 3 — saldo por cuenta vía `saldos_mensuales`** (`finanzas.js?v=32`, commit `1b4a05b`, **SIN SQL**): el "Saldo disponible" (Panel KPI) y el saldo por cuenta (tab Cuentas) ahora salen de `saldos_mensuales` (contable) en vez de sumar `ingresos`/`egresos`: **`saldo = saldo_inicial + Σ(último saldo_final por canal del plan_cuenta vinculado)`** → captura el ciclo del cheque (depósito/débito = asientos de clearing) y un cheque en tránsito NO distorsiona el banco. Helpers `_ensurePlanCuentaMap`/`_saldoCuentaContable`/`_saldoCuentaLegacy` (fallback a suma si la cuenta no tiene plan vinculado). **Verificación read-only ANTES de tocar el número (lo que pidió Fede):** reconcilia EXACTO con el método legacy hoy — KPI total **$8.314.400** idéntico en Total/Oficial/Interno (dif $0); Caja Oficina cuadra por el `saldo_inicial` (que `saldos_mensuales` no tiene porque la apertura aún no es asiento). **⚠️ Fase 7:** si se postean asientos de apertura, quitar el `saldo_inicial` de `_saldoCuentaContable` para no duplicar. **⏳ Pendiente pull+verify del ciclo del cheque end-to-end** (in-transit no baja el banco → al debitar sí). **`lobby.js` `_finData` también pasado al método contable** (coherencia del home, `lobby.js?v=13`, commit `c3443cc`). `finanzas.js?v=32` (pull pendiente de Fede).
  - **✅ Auditoría de integridad del backbone contable (read-only, preview de Fase 7) — 100% SANO:** A. partida doble global DEBE $13.135.600 = HABER $13.135.600 (dif $0, 10 asientos vivos) · B. 0 asientos desbalanceados · C. 0 con líneas≠cabecera / 0 sin líneas · D. **0 ingresos / 0 egresos confirmados-con-cuenta sin asiento** (= no hay plata movida sin contabilidad → confirma que piece 3 es seguro) · E. 0 asientos a movimiento borrado · F. 0 valores con mov borrado (y 0 valores vivos → cleanup de prueba completo).
  - **✅ Barrido integral del lobby ("lobby con esteroides", pedido de Fede)** — auditoría global buscando lo desconectado / que no muestra lo que debería. **(a) Barrido en vivo** (21 rutas vía Chrome con colector de consola+`onerror`+fetch 4xx): **0 errores de consola**, **1 sola llamada rota** → **BUG arreglado:** `tareas.js` fuente locaciones pedía `locaciones_documentos.tipo` (no existe, la real es `tipo_doc`) → 400, la fuente "documentos por vencer" nunca mostraba tareas; fix `tipo`→`tipo_doc` (commit `d01574c`, `tareas.js?v=6`). **(b) Auditoría de código** (agente Explore): 0 wiring roto, 0 handlers colgados; hallazgos menores baja-confianza (métodos `createEmailTemplate/update/delete` sin UI = scaffolding mailing futuro; `API.syncPymeToLobby` referenciado con guard pero no implementado → botón que nunca aparece). **(c)** `parametros-globales` = redirect intencional a Costos (no bug); proxy `/api/` responde (nginx vivo); badges/alertas 0 errores; **barrido de schema DEFINITIVO** (2º agente Explore cataloga TODOS los `.select()` de columnas explícitas/embeds del código → yo testeo cada uno contra prod): **25 selects distintos testeados, TODOS OK** (incl. `persona_documentos.tipo` [esta SÍ tiene `tipo`, ≠ locaciones que es `tipo_doc`], `clientes.ultimo_contacto`, `insumos_base.stock_actual/minimo`, `cuentas_financieras.entidad/numero_cuenta/cbu_alias`, embeds de `cargas`/`evento_costos`/`asiento_lineas`/`proyectos`/`vencimientos_generados`). Los 2 "errores" iniciales fueron **falsos positivos de tests especulativos** (`audit_logs` plural ≠ `audit_log` singular que usa el código; tabla base mal agrupada por el agente). **Único bug schema-mismatch de toda la app = el de Tareas (ya fixeado).** **Lección reconfirmada:** la clase de bug más valiosa acá = *schema mismatch en runtime* (JS con nombre de columna viejo tras migración en prod) — solo se caza consultando prod, no con análisis estático. Y los reportes de subagentes traen falsos positivos: SIEMPRE verificar contra el código real + prod antes de "arreglar".
  - **⏳ RESTA (orden por valor):** **3b.2** (switch `compras.js`→proveedor UUID, all-or-nothing, dedicada, con luz de día) · Fase 5 (conciliación CSV Galicia/MercadoPago + borrar `compras_pagos` muerto + solape calendario finanzas↔calendario-adm) · **Fase 6 ARCA** (👉 trámite del certificado X.509 — Fede lo arrancó 2026-06-21; "Emitir"=botón SDK ARCA reemplaza La PyME greenfield, PERO la carga manual de emitidos SE QUEDA para informal-foto/factura E/factura M) · Fase 7 (cierre pre-2027: mapeo_cuentas CRUD + auditoría integridad [ya hay preview ✅] + saldos apertura como asiento + bloqueo ejercicio). Plan que MANDA: `docs/finanzas-contabilidad-refactor-PLAN-EJECUCION.md`. **Pull pendiente de Fede:** `finanzas.js?v=32` + `lobby.js?v=13`.

- **Sesión 2026-06-21 (charla Finanzas — continuación del refactor) — Fase 4 Cartera de valores + 3d.1/3d.2 + coherencia Rendimiento · TODO VERIFICADO EN PROD (Chrome, con cleanup; 6 commits `27af2ea`→`5abbb86`)**:
  - **3d.1 verificado + BUG arreglado** (`27af2ea`, `finanzas.js?v=28`): el modal "Generar pago" del recibido estaba roto por `this._esc` (helper que `FinanzasModule` NO define) → cambiado a `escHtml` global. Era "construido sin testear" (lo cazó la verificación). Verificado: comprobante huérfano → egreso linkeado + asiento auto balanceado con IVA `1.1.09`.
  - **Fase 4 — Cartera de valores ✅ (la "pieza grande")** (`sql/fase4_cartera_valores.sql` CORRIDA, `finanzas.js?v=29`/`api.js?v=50`, `e61a364`→`a122309`): el cheque/e-cheq es un **medio diferido del circuito único** (NO libro paralelo). `1.1.07 Cheques a cobrar` / `2.1.07 Cheques emitidos diferidos` **YA existían** (0 cuentas nuevas). **e-cheq = `tipo` del valor, NO un `medio`** (el medio sigue siendo `'cheque'`). 4 caminos verificados (DB + UI real, balanceados, cleanup): cobro→`DEBE 1.1.07`/`HABER 2.1.06` · **endoso a proveedor**→`DEBE 5.x`/`HABER 1.1.07` (egreso linkeado por `egresos.cartera_valor_id`, **SIN cuenta bancaria** — un e-cheq recibido se endosa sin depositar) · emisión cheque propio→`HABER 2.1.07` · débito→`DEBE 2.1.07`/`HABER banco`. Tab **"Valores"** (KPIs/filtros) + modales Nuevo valor/Endosar/Clearing + adjunto del **comprobante bancario** (`cartera_valores.archivo_url` + `archivo_op_url` en egresos/ingresos/transferencias). `fn_asiento_auto_ingreso` refinada: cobro con cheque NO exige `cuenta_id`. **Input de Fede:** el e-cheq es el instrumento real (físico en retroceso), usado sobre todo para pagar proveedores endosando.
  - **3d.2 — comprobante↔movimiento bidireccional ✅** (`sql/fase3d2_comprobante_evento.sql` = 1 ALTER `evento_id`, `api.js?v=51`/`finanzas.js?v=30`/`carga-comprobante.js?v=3`, `e3aa905`): (a) **emitido→ingreso** (`API.generarIngresoDeComprobante` + botón "Generar cobro" en la ficha del emitido; clasifica por `servicio`+IVA débito; forward-looking para ARCA) · (b) **`evento_id`** en `comprobantes_recibidos` + propagación por TODO el circuito + select de evento en el modal de recibido **y en la carga foto/IA** (que ahora imputa proyecto+evento) · (c) **huérfanos**: columna "Pago" + filtro "Solo sin pago" en Recibidos.
  - **Opción A — coherencia Rendimiento↔Finanzas ✅** (`api.js?v=52`/`rendimiento.js?v=4`, `5abbb86`): "que no hablen idiomas distintos". `getRendimientoDashboard.costos` = planilla (`evento_costos`) **+** egresos imputados al evento (`evento_id`) que NO son pago de una línea (no en `evento_costo_pagos.egreso_id`) → sin doble conteo. Así un gasto cargado directo en Finanzas con `evento_id` "se carga solo" en Rendimiento. Vista Ganancia muestra el split. Read-side, sin SQL. Verificado a nivel DB.
  - **Decisiones de diseño (Fede) para Fase 6 ARCA (ANOTADAS, no construidas):** el sub-tab **"Emitir" = el botón del SDK de ARCA** (reemplaza La PyME greenfield) · **la carga manual de emitidos SE QUEDA** para lo que el SDK no va a hacer desde el lobby: **comprobante informal con foto, factura E, factura M**. El "Generar cobro" de 3d.2 es compatible (lado cobranza).
  - **⏳ Pendiente de Fede:** correr `sql/fase3d2_comprobante_evento.sql` (1 ALTER additivo) + `~/pull-lobby.sh` (api v=52 / finanzas v=30 / carga-comprobante v=3 / rendimiento v=4). El SQL de Fase 4 YA está corrido. **Resta (orden por valor):** Fase 4 v1.1 (KPI Panel + cheque en modales Ingresos/Egresos) · 3b.2 · Fase 5 conciliación · Fase 6 ARCA (cert) · Fase 7. **Patrón de verificación que funcionó:** Chrome + `javascript_tool` contra `supabaseClient`; manejar modales con `document.getElementById(...).click()` (el pixel-click derrapa lejos del origen, escala del screenshot ~0.81×); tras pull recargar con cache-buster `?cb=x#finanzas` (el browser cachea el index.html viejo).

- **Sesión 2026-06-20/21 (charla Finanzas) — REFACTOR INTEGRAL Finanzas+Contabilidad: CORAZÓN HECHO + VERIFICADO EN PROD (17 commits, plan-first)**:
  - **Plan-first.** 📘 Plan de ejecución 7 fases (MANDA): `docs/finanzas-contabilidad-refactor-PLAN-EJECUCION.md`. Semilla: `docs/finanzas-contabilidad-refactor-DOSSIER.md`. Blast-radius 107 paths (workflow): `docs/finanzas-blast-radius-map.md`. Diseño del circuito: `docs/finanzas-fase3-circuito-DISENO.md`.
  - **✅ VERIFICADO END-TO-END EN PROD (Chrome, sesión real, con cleanup):**
    - **Fase 1** — comprobantes recibidos/OCR abren/editan/eliminan en Facturación (montado `#finCuentasPanel` en las vistas Emitidos/Recibidos). Guard: no eliminar comprobante ligado a egreso vivo.
    - **Fase 2** (`sql/fase2_iva_y_ingreso_asiento.sql`, **CORRIDO**) — IVA desglosado en el asiento (3ª línea: crédito `1.1.09` / débito `2.1.02`, split proporcional) + **arreglo del asiento de INGRESO que estaba DORMIDO** (la función viva buscaba mapeo por `medio/canal` pero los mapeos de ingreso son por `servicio` y `ingresos` no tiene esa columna → 0 cobros generaban asiento). Fix: clasifica por el `servicio` del comprobante emitido + **criterio profesional: cobro SIN factura → `2.1.06` Anticipos de clientes** (pasivo), NO venta (se reclasifica al facturar, futuro). `campo_origen` es NOT NULL → genérico vía sentinel `'default'`. `fix_anular_contraasiento` resultó **YA CORRIDO** en prod (recon).
    - **Fase 3a** — **circuito único `registrarGasto`** (api.js): generaliza `pagarCostoEvento`. `GASTO_DOMINIO` consolida las 4 traducciones de categoría sueltas (todo target es enum-válido → imposible categoría ilegal; mató el bug `tipo:'A'`). Productores reapuntados: Rendimiento (`pagarCostoEvento` delega), OCR (`carga-comprobante.js`), Calendario-adm + pagador de venc. de finanzas (+ fix del `canal` hardcodeado).
    - **Fase 3b** — **proveedores unificados a UUID** (`sql/fase3b_proveedores_uuid.sql`, **CORRIDA**, additiva/reversible): 143 proveedores en `proveedor` (UUID) con `compras_proveedor_id` (traza al BIGINT) + `proveedor_uuid` en `compras_ordenes`/`_presupuestos`. **`egresos.proveedor_id` ahora guarda UUID real.** **3b.1**: `generarEgresoDeOC` al circuito + proveedor UUID (fallback BIGINT→UUID).
    - **Fase 3c** — `registrarCobro` (espejo de registrarGasto para ingresos, que no tenía capa de API; preserva sync `plan_cobro_items` + dif-cambio; el modal de ingreso delega).
  - **✅ Construido, ⏳ pull+test:** **Fase 3d.1** — puente **comprobante→egreso** (`API.generarEgresoDeComprobante` + botón "Generar pago" en la ficha del recibido).
  - **Versiones finales:** `api.js?v=49` · `finanzas.js?v=27` · `carga-comprobante.js?v=2` · `calendario-adm.js?v=2`. Commits `ead7246`→`53f8285` en `origin/main`.
  - **⏳ PENDIENTE FASE 8 (detalle en PLAN §Fase 8 / PROGRESO §sesión Finanzas):** **3d.2** (comprobante emitido→ingreso + `evento_id` en OCR + lista de huérfanos sin egreso) · **3b.2** (switch grande de `compras.js` a `proveedor` UUID — **diferido a pasada dedicada**: all-or-nothing + entretejido con OC/presupuestos/ganadora + helpers api.js; la data YA está unificada, Compras anda) · **Fase 4 tesorería + cartera de valores** (el chart ya tiene Cheques `1.1.07`/`2.1.07`) · Fase 5 conciliación CSV + borrar `compras_pagos` muerto · **Fase 6 ARCA** (bloqueado por trámite del certificado — Fede lo arranca) · Fase 7 cierre pre-2027 (saldos apertura + bloqueo ejercicio).
  - **Recon vivo clave (no re-descubrir):** códigos IVA `1.1.09`/`2.1.02` confirmados · La PyME = **greenfield** (0 comprobantes / 0 `pyme_venta_id` → ARCA sin migración) · backbone contable SANO (0 sin-asiento, 0 desbalances, 0 drift) · `chk_partida_doble` NOT VALID con 0 desbalances (validable). **NO usar de referencia** `sql/fix_iva_asiento.sql` (reemplazado por fase2, su lookup de ingreso por medio/canal estaba mal) ni `sql/fix_trigger_asiento_auto.sql` (obsoleto).

- **Sesión 2026-06-20 (charla `rediseno` — Fase 4 arranque + leftover Usuarios) — ⏳ CONSTRUIDO + PUSHEADO, FALTA SOLO PULL+VERIFY DE FEDE (se fue a la otra charla a refactorear Finanzas)**:
  - **Importador asistido de cotización (Fase 4 paso 1 · commit `3e4ff01`)** — el desbloqueo de TODA la Fase 4. Nuevo **`importar-cotizacion.js?v=1`**, ruta **`#importar-cotizacion`** (admin-level), botón **"Importar ítems"** en CRM→Cotizaciones (gated admin-level, `crm.js?v=19`). Parser PURO `_parse(text)`: pegás el texto del PDF del cotizador → detecta **espacios** (STANDS/NETWORKING/SALA 1) / **rubros** (INFRAESTRUCTURA/ILUMINACIÓN/EQUIPAMIENTO/MARKETING Y SERVICIOS) / **ítems** (`• N× nombre $monto`, es-AR) / **Ref** (COT-XXXX) + total. Preview con **match contra catálogo** (chip propio/subalquilado/varios). Escribe `cotizacion_espacios` + `cotizacion_items` con el **schema destino real** (NOT-NULL cubiertos: `height_multiplier_aplicado=1`/`modifier_pct_aplicado=0`/`fee_pct_aplicado=0`), **idempotente** (reemplaza si ya hay ítems). Matchea la cotización por `numero` y le adjunta. El flag **propio/subalq se DERIVA** de `catalogo_item_id`→`tipo_receta` (no se guarda en la línea). **Parser VERIFICADO con `node`** contra COT-2026-0019/0020 reales (11 ítems, 3 espacios, montos es-AR, nombre con comillas `TV 55"`, headers falsos EXPO/DATOS/PROPUESTA descartados, subtotales/IVA ignorados — todo OK).
    - **Decisiones de Fede esta charla (definen el diseño):** (1) las cotizaciones **YA existen como filas** en `cotizaciones` (el cotizador las crea) → el importador **matchea por número y adjunta** (NO crea cotización). (2) `cotizaciones.full_state` **NO** tiene los ítems hoy (o incierto) → se queda el **pegar-texto** (robusto al refactor del cotizador que Fede está haciendo "yéndose para arriba"); un sync desde `full_state` queda como futuro si se estabiliza.
  - **Consolidación "Usuarios y Roles" (opción A · commit `1411550`)** — leftover de Etapa 4. Porté el **editor de `customPermissions` por usuario** desde la pantalla MUERTA `#admin-usuarios` de `settings.js` a la tab Usuarios de **`admin-panel.js?v=12`** (acción "Permisos" por fila, gated no-superadmin; modal con matriz toggle **según-rol/personalizados**; guarda vía `API.updateProfile` + `AuditLog` + refresca cache de Auth si editás tus propios permisos). **Borrada** la pantalla muerta (`renderAdminUsers`+5 helpers, ~560 líneas, inalcanzable por el redirect `admin-usuarios→admin-panel`). **`settings.js?v=7`**. Gestión de usuarios = **solo superadmin** (decisión Fede; admin-panel ya es `superadminOnly`, no toqué accesos). **Hallazgo clave:** la pantalla muerta era la ÚNICA con editor de `customPermissions` (admin-panel = 0 refs); por eso fue port, no borrado a secas.
  - **⏳ LO ÚNICO QUE FALTA (Fede):** `~/pull-lobby.sh` (el VPS sirve versiones viejas) → después **verificación end-to-end en prod** (ninguna de las 2 piezas está verificada en prod; solo `node --check` + node-test del parser): **(a) Usuarios:** Panel→Usuarios→"Permisos" en un no-super→Personalizados→sacar módulo→guardar→confirmar en DB→**revertir**. **(b) Importador:** pegar texto de COT-2026-0020→matchea→importar→confirmar `cotizacion_items` en DB→**borrar la prueba**. **⚠ Riesgo a chequear primero:** RLS de INSERT en `cotizacion_items`/`cotizacion_espacios` (si admin/superadmin puede insertar; si no, hay que agregar policy).
  - **Próximo en Fase 4 (ya desbloqueado por el importador):** **remito simple** (proyecto/evento, reusar `remito-pdf.js` despegado del flujo de cargas) → **subalquileres por proveedor** (vista doble evento/stand + PDF/mail de pedido) → **retiro legacy de cargas** (destructivo — confirmar con Fede). Detalle: PLAN §ORDEN DE EJECUCIÓN (Etapa 1) + §Fase 4.
  - **Working tree compartido:** esta charla SOLO tocó `admin-panel.js`/`settings.js`/`crm.js`/`router.js`/`index.html` + el nuevo `importar-cotizacion.js`. La otra charla (refactor Finanzas+Contabilidad + lobby Fase 13) sigue en paralelo — el commit `ed37989` (dossier Finanzas) es de ella. Siempre `git add` solo lo propio.

- **Sesión 2026-06-20 (build) — Fase 13 Rediseño Lobby por rol v2: BUILD COMPLETO (5 fases) + PUSHEADO + VERIFICADO EN PREVIEW (sesión autónoma "mandale hacha")**:
  - El home se reescribió como **`HomeModule`** (`lobby.js?v=11`, alias `Lobby`): arquitectura por **zonas** (`_layouts[rol]`) + registro `_widgets`/`_R` **read-only** (43 widgets) con hidratación aislada (`Promise.allSettled` + try/catch por widget). 5 lobbies por rol: super/admin = 2 col (operativo|admin) + banda KPI macro + toggle Oficial/Interno; venta/pm = 1 col; taller = simple (tablet galpón, `¡Hola!`, sin plata). Commits en `origin/main`: `5421c1e`+`028fb9c` (13.1) · `d464ce4` (13.2) · `362224c` (13.3) · `45036c4` (13.4) · `c89f21a` (13.5). **Detalle completo en `PROGRESO.md` §Estado general.**
  - **2 piezas nuevas:** módulo **`#calendario-adm`** (`calendario-adm.js`, vencimientos por día + plantillas recurrentes + marcar pagado→egreso; reusa `vencimientos_recurrentes/_generados`, NO requiere DDL) + **Carga de comprobantes por foto/IA** (`carga-comprobante.js`, vive en Finanzas, atajo lobby admin; foto/PDF → OCR del VPS → form pre-cargado → humano confirma → `comprobantes_recibidos` +egreso). + `pedido-compra.js` (atajo liviano pm/taller → notif a admin).
  - **Reconocimiento clave aplicado (5 sondas en paralelo):** `_finData(ctx)` replica `finanzas._loadPanelData` memoizado (respeta toggle canal); scope real pm/super=`responsable_id`, venta=`vendedorId`/`ownerId`, taller=`estado='en_taller'`; estados cotización `enviada/en_negociacion/aprobada/rechazada`; temperatura `hot/warm/cold`; `getProjects` NO trae `estado_taller` (query directa con embeds); materiales = `proyecto_novedades.tipo='falta_material'`; `comprobantes_recibidos` taxonomía propia (categoria material..otro, tipo factura_a..recibo); permisos por tabla `roles.permissions` JSONB (módulo nuevo necesita grant, igual que rendimiento). **Verificado en preview:** 5 roles 0 errores de widget + 0 consola + 0 4xx/5xx; atajos correctos por rol; modales abren/cierran; responsive.
  - **⛔ PENDIENTE DE FEDE (infra — sin esto, gateado pero nada rompe):** (1) `sql/fase13_calendario_adm_grant.sql` (grant `calendario-adm` en `roles.permissions`); (2) deploy `tools/vps/ocr-comprobante.js` + montar `/api/ocr/comprobante` (reusa `GEMINI_API_KEY` del CRM digest) → sin esto la carga cae a modo manual; (3) `sql/fase13_comprobantes_bucket.sql` (bucket privado) → sin esto guarda sin adjunto; (4) `~/pull-lobby.sh`. Ver PLAN-MAESTRO §Fase 13.

- **Sesión 2026-06-20 — Fase 12 Saneamiento técnico (5 batches, sesión autónoma) CONSTRUIDO + PUSHEADO + ✅ VERIFICADO EN PROD (auditoría Chrome)**:
  - Fede autorizó correr derecho los 5 batches de la auditoría 2026-06-18 (`docs/auditoria-modulos-2026-06-18.md`) y auditar después. **JS puro, sin SQL, sin cambios de datos en ningún batch.** Commits en `origin/main`: `8f8f520` (12.A) · `1a4d5a5` (12.C) · `ebd1b4e` (12.E) · `e72e7c5` (12.B) · `59c1960` (12.D). **12.A** = los 2 hallazgos transversales de mayor palanca:
  - **T1 — Router teardown (`6346a44`):** `router.js?v=12` trackea el módulo activo (campo `obj` en rutas crm/calendario/proyectos:id) y llama `destroy()` al módulo saliente antes de renderizar el entrante → mata los leaks de listeners globales en `document`. Módulos con `destroy()`: `crm.js?v=18` (2 escHandlers de panel — antes solo se removían en la rama Escape; ahora ref en estado + remove-before-add + cleanup en `_closePanel`/`_closeCotPanel`/`destroy()`), `proyecto-detalle.js?v=6` (click de cierre del dropdown que se re-armaba en cada re-render del shell), `calendario-operativo.js?v=18` (ya tenía `destroy()`, era código muerto → ahora el router lo invoca + remove-before-add idempotente).
  - **T2 — `_esc` global (`8f8f520`):** `window.escHtml`/`escAttr` en `components.js?v=8` (escapa & < > " '). Aplicado al legacy que interpolaba datos de usuario crudos en innerHTML (XSS interno, threat model interno → MEDIA): `modules.js?v=8` (render de Clientes: tabla empresa/contacto/email/teléfono/rubro + resumen de ficha quien/resumen) y `locaciones.js?v=4` (lugares nombre/dirección/`foto_url` en background-image, ficha, docs nombre/`archivo_url` en href + `rel=noopener`, stock insumo/categoría/notas). **`calendar.js` NO se tocó: está muerto y borrado** (la auditoría lo listó por error; ver PROGRESO §2.0). `eventos.js` ya tiene `_esc`/`_escAttr` propio y los usa — sus gaps menores caen en el refactor de 12.B.
  - **12.C permisos (`1a4d5a5`):** `settings.js` reset-pass roto (`auth.admin.updateUserById` con anon key) → `API.adminResetPassword`; guards de rol en `rrhh.js` (`isAdminLevel`) y `admin-panel.js` (`isSuperAdmin`); `compras` con `adminOnly:true` en la ruta. **12.E quick-wins (`ebd1b4e`):** 10 `onclick="Modal.close()"` inline → `data-modal-close` (catalogo/locaciones/compras; los no-arg ni cerraban); `proyectos.js` búsqueda accent-insensitive (`normStr`); `catalogo.js` value escapado; −2 `console.log` en `modules.js`; `taller.js` `setEstadoTaller` con `await`+revert; `flota.js` `_norm`→`normStr`. **12.B datos (`e72e7c5`):** `eventos.js` borrado el fallback dummy `_getDummyEvents()` (+método) + dedup `_ROLES_OP`; `lobby.js` sin mock `Data.recentActivity`; `tareas.js` usa `stock` real (no `stock_actual` fantasma); `calendario-operativo.js` docs fuente única API. **12.D perf (`59c1960`):** `finanzas.js` saldo N+1→`Promise.all`; `contabilidad.js` totales Libro Diario sin truncar a 1000 (count `head:true` + suma paginada) + removido dead code `linea.debe/haber`.
  - **✅ AUDITADO EN PROD (Chrome, 2026-06-20, read-only, sin data de prueba):** router teardown probado en vivo (`CalendarioOperativo._keyHandler`→`null` al salir de calendario; `Router._activeModuleObj` correcto), `escHtml`/`Modules._esc`/`LocacionesModule._esc` presentes y escapando, guards rrhh/admin-panel/settings/compras presentes, Libro Diario count=4 DEBE=HABER=$8M balanceado, finanzas saldo OK, **cero errores de consola** (carga + navegación lobby/calendario/finanzas/contabilidad/crm/proyectos). **Diferidos (no autónomos / overlap con otras fases):** `inventario.js` stock atómico (RPC `ajustar_stock`, hogar = remito Fase 4) · Libro Mayor server-filter (necesita RPC para el saldo anterior) · `eventos.js` `teardownEndDate` localStorage→`fecha_desarme_fin` (la columna la deriva el trigger de jornadas → refactor de raíz) + modal transporte legacy (Fase 4) · consolidar "Usuarios y Roles" duplicado. Detalle: `docs/auditoria-modulos-2026-06-18.md` + PLAN-MAESTRO §Fase 12.

- **Sesión 2026-06-18 — Fase 8: módulo "Rendimiento por evento" CONSTRUIDO + VERIFICADO EN PROD (one-shot desde `docs/prompts/rendimiento-evento-oneshot.md`)**:
  - Módulo propio `#rendimiento` (ADMIN & FINANZAS, admin/superadmin) que reemplaza el Excel de pagos de Lelean. Planilla de costos por evento (5 categorías colapsables) cuyos pagos generan egresos+asientos **reusando la plomería de Finanzas** + dashboard de ganancia. **Archivos:** `rendimiento.js?v=3` (nuevo) · `api.js?v=44` (bloque RENDIMIENTO) · `data.js?v=15` · `router.js?v=11` · `sql/rendimiento_evento.sql`. **Commits:** `fabd0b4`→`f83ccd6`→`3a85f88` (en `origin/main`).
  - **Verificado end-to-end en prod via Chrome** (con cleanup): SQL corrido + grant `rendimiento:write` aplicado, módulo renderiza, pago-con-factura por la UI real → comprobante (`factura_a`+`material`) + egreso (`proveedor`+cuenta) → **asiento automático balanceado DEBE/HABER**, línea→Pagado, dashboard OK. GATE A/B confirmados.
  - **2 bugs encontrados y arreglados** (taxonomías propias de `comprobantes_recibidos`, no documentadas): `categoria` ∉ {proveedor,rrhh} (usa material/servicio/alquiler/credito_fiscal/logistica/otro) y `tipo` = `factura_a` (no A/B/C). + hallazgo no-bug: el asiento solo postea con `cuenta_id` (sin cuenta de tesorería no hay contrapartida — diseño de Finanzas).
  - **Desbloquea RRHH.5** (`API.getJornalesByPersona`). **⏳ Único pendiente de Fede: `~/pull-lobby.sh`** (el VPS aún sirve v=42/v=1).
  - **Deudas globales de Finanzas pendientes (hermanadas, cerrar juntas):** (a) fix IVA en `fn_asiento_auto_egreso` (3ª línea crédito fiscal; el asiento sale con 2 líneas — confirmado); (b) anular egreso no revierte asiento; (c) auditoría de integridad egreso→comprobante→asiento→saldos→libro (pedido explícito de Fede).

- **Sesión 2026-06-11 (charla 04) — Diseño Módulo RRHH v2 + spin-off "Rendimiento por evento" (solo docs, sin código)**:
  - **Blueprint cerrado** en `docs/modulo-rrhh-v2-blueprint.md` — SPEC OBLIGATORIA de la fase RRHH v2 del plan maestro (≈8%, absorbe la ex mini-fase RRHH de la auditoría 2B). 5 tabs estilo CRM: Panel (KPIs) / Nómina (tabla + panel lateral con sub-tabs Datos/Trabajo/Ausencias/Docs/Notas) / Planificación (grilla persona × días + aprobar convocatorias inline) / Ausencias (reemplaza Vacaciones legacy + migración + retiro de las 4 `rrhh_*`) / Jornales (lente por persona, read-only).
  - **Decisiones Fede**: sin presentismo diario (ausencias por excepción) · docs solo fechas + semáforo (sin archivos) · sin self-service (todo carga admin; taller no ve RRHH) · sueldos internos fuera (Finanzas) · la CARGA de jornales NO vive en RRHH.
  - **Verificado contra prod via REST**: `personas.cuil` y `personas.fecha_nacimiento` YA EXISTEN (agregadas a mano; `sql/rrhh_to_personas_migration.sql` desfasado — el "bug de pérdida de datos" que reportó un agente era falso positivo). `direccion`/`cbu_alias`/`contacto_emergencia` NO existen → ALTER en RRHH.1.
  - **Spin-off**: el tab Jornales derivó en "Rendimiento por evento" (Finanzas): planilla de costos del evento (grilla inline que reemplaza el Excel de Lelean — jornales/fletes/proveedores-que-facturan-por-evento/seguros/comida, pagos en tandas y adelantos, egreso individual o consolidado) + dashboard de ganancia por evento (Σ ingresos proyectos − costos). **Prompt entregado a Fede para charla aparte**; anotado en PLAN-MAESTRO §Fase 8. RRHH.5 bloqueada por esa pieza; RRHH.1–4 sin dependencias.
  - **Rebalanceo**: PROGRESO 48%→46%, PLAN-MAESTRO 52%→54% (universo creció).

- **Sesión 2026-06-11 — Diseño CRM "Casos" (solo docs, sin código)**:
  - **Blueprint aprobado** en `docs/crm-casos-blueprint.md` — SPEC OBLIGATORIA de la Fase 7 del plan maestro. Caso (oportunidad) como núcleo: timeline unificado WhatsApp/email/llamadas/notas internas + Bandeja de hoy + pipeline re-apuntado a casos. Tablas nuevas `crm_casos`/`crm_mensajes`/`crm_contactos` (DDL pendiente, se ejecuta recién al encarar Fase 7).
  - **Decisiones clave**: motor IA = **Gemini API free tier** detrás de driver intercambiable (`MODEL_PROVIDER=gemini|claude`) en el proxy del VPS (`/api/crm/digest`); el Gemini de Workspace NO da API. Ingesta email vía **Gmail API + domain-wide delegation** (NO IMAP, NO self-host de mail — Workspace queda intacto; la independencia = historial en Supabase). WhatsApp v1 = pegado asistido; Business Cloud API recién en E4. E3 = clasificación (rubro catálogo cerrado + eventos participados) + listas de difusión/mailing frío (Brevo candidato, subdominio dedicado); marketing lo lidera Fede + community manager humano. E5 = agente comercial casi-humano (escalera copiloto→cola con veto→autónomo).
  - **Implementación GUIADA** (pedido de Fede): al ejecutar cada etapa, guiar paso a paso lo manual (API keys, delegation, DNS). Fase 7 del `PLAN-MAESTRO-rediseno-lobby.md` actualizada para referenciar el blueprint.

- **Sesión 2026-05-30 — Barrido global UI 4.8 + tanda de fixes (en prod)**:
  - **Objetivo**: pasada completa por todos los módulos vía Chrome MCP buscando bugs/anomalías/mejoras, fixeando de a poco con confirmación de Fede. Cero errores de consola en toda la app.
  - **Sidebar default para TODOS los superadmin** (commit `9062a0e`): el sidebar se persiste en **localStorage por navegador** (`mepex_sidebar_config`), NO en Supabase ni por usuario. El default real vive en `Data.categories` (`data.js`). Se actualizó el default a la estructura vigente de Fede: PRINCIPAL=[lobby], OPERACIONES=[calendario,proyectos,eventos,taller,logistica], RECURSOS=[compras,inventario,locaciones], ADMIN&FINANZAS=[rrhh,finanzas,contabilidad,costos]. Bump `_configVersion` 4→5 en `sidebar-editor.js` para forzar rebuild en todos los navegadores. **Side effect**: arregló el breadcrumb de RRHH (decía RECURSOS porque la categoría en data.js lo tenía ahí).
  - **Fixes de código** (commits `9062a0e`, `a79561b`, `143901b`, `91e721a`, todos en `origin/main`):
    - `contabilidad.js`: sub-cuentas (nivel 2 y 3) del Plan de cuentas ahora ordenadas por código numérico (4.9 aparecía antes de 4.1/4.2).
    - `eventos.js`: validación de orden cronológico de fases (Armado ≤ Inicio ≤ Fin ≤ Desarme) al crear y editar (nuevo helper `_validateFaseDates`).
    - `taller.js`: tab Hoy "Próximos días" descarta fechas pasadas (`d > hoy`). El flujo de cierre por estado quedó pendiente de charlar.
    - `logistica.js`: headers de tablas Vehículos/Personas alinean (el global `.log-mov-row` de style.css tenía `display:flex` que rompía el layout; se forzó `display:table-row` en el scoped).
    - `finanzas.js`: (a) chart Cashflow del Panel pasó de **24 queries secuenciales a 2 en paralelo + bucketing JS** (se veía en blanco al cargar); (b) subtab "Recupero IVA extracontable" → **"Registros auxiliares"** para coherencia con Contabilidad (que usa "Auxiliar"); (c) KPI "Saldo disponible" ahora **respeta el toggle de canal** (antes sumaba todas las cuentas sin filtrar → daba $8.75M Oficial que no reconciliaba con el Balance contable $6.5M).
    - `crm.js`: columna "Fecha" de la tabla de Cotizaciones usa `fecha_emision`(fallback `created_at`) en vez de `fecha_evento` que estaba NULL (columna vacía). El resumen lateral no cambió (ahí "Fecha"=del evento + "Fecha emisión" aparte).
    - `compras.js`: relabel "Contacto" → "Dirección" en Proveedores. `compras_proveedores` **no tiene columna de dirección** (solo contacto/telefono/email/notas); el campo `contacto` venía conteniendo direcciones. Se relabeló sin tocar el nombre interno. Si se quiere un campo separado de persona de contacto, es un add de schema futuro.
  - **Cambios de DATOS en prod** (vía consola, autorizado por Fede):
    - Borrados (soft-delete `_deleted=true`) los asientos de prueba #10 "AJUSTE PRUEBA" ($500K) y #11 "PRUEBA Fase A" ($1) que ensuciaban Libro Diario/Estado de Resultados y dejaban Caja Oficina en -$1. Verificado: Libro Diario quedó en 4 asientos, Balance limpio = Banco Galicia CC $6.5M (reconcilia $7M ingresos − $500K egreso).
    - Corregido evento "Estetica": `fecha_armado_fin` 2026-05-12 → 2026-05-14 (estaba antes del inicio).
  - **Pendientes / no tocados (decisión de Fede)**:
    - Cliente duplicado "Artesanías Graciela" (borrar requiere saber cuál tiene proyectos vinculados).
    - Eventos sin fechas marcados "Próximo" (Feria Libro Infantil, Beauty Day) — comportamiento esperado hasta cargar fechas.
    - Taller: flujo de cierre de proyecto por cambio de estado (mover a otra solapa al pasar fecha/estado) — a diseñar más adelante.
  - **Inventario — verificado SANO (no era bug)**: el "stock no refleja movimientos" fue falso positivo del barrido (solo se vieron los ítems alfabéticos de arriba, sin movimientos). El stock SÍ se actualiza: insumo Placa karikal=20, catalogo Taburete JB=78, Reflector 100w=50, etc. — coinciden con los 8 movimientos. Las columnas `insumos_base.stock_actual`/`stock_minimo` están **sin usar** (la UI usa `stock`). El update de stock es read-modify-write con valor cacheado (`current + qty`), no atómico → **limitación conocida**: race si dos usuarios editan el mismo ítem a la vez (impacto casi nulo en equipo chico; fix futuro = RPC `stock = stock + qty`).
  - **Segunda pasada profunda (bug-hunt con 2 agentes en finanzas/contabilidad/inventario/costos/eventos)**: se reportaron ~19 "bugs" pero al **verificar uno por uno contra el código y la BD, casi todos eran FALSOS POSITIVOS**. Importante para futuras sesiones — NO confiar en reportes de agentes sin verificar:
    - "Falta filtro `_deleted` en asiento_lineas" (reportado crítico) → **`asiento_lineas` NO tiene columna `_deleted`**; el soft-delete vive en `asientos`, y TODAS las queries (Mayor 3159, EERR 4546, etc.) filtran `asientos._deleted=false` y descartan líneas huérfanas. Correcto.
    - "Suma sin `Number()`" → `monto` ya viene como `number` de Supabase. No rompe.
    - "Falta parseFloat en `_qty`" → se parsea en el change handler (inventario.js:2012). OK.
    - "Falta `_deleted` en `_loadMovimientos`" → ya lo filtra (1715). OK.
    - "Listeners duplicados en equipo de eventos" → `container.innerHTML=` re-renderiza (890), los listeners viejos mueren. OK.
    - **Único real y arreglado**: `console.log('[... DEBUG]')` olvidados en prod en Libro Mayor y Libro Diario → limpiados (commit `16f2f2d`).
  - **Aprendizaje**: (1) el sidebar NO es configurable por rol/usuario en backend; es localStorage por navegador con default en `data.js` — para cambiar lo que ven todos hay que tocar `data.js` + bump de `_configVersion`. (2) Los reportes de bug-hunting de subagentes tienen muchos falsos positivos en este repo — verificar SIEMPRE contra schema real (`information_schema`/query) y el flujo de código antes de "arreglar".

- **Fecha:** 2026-05-19 (sesión extensa, parte 5 + testeo en prod)
- **Ultimo commit destacado:** `d25fc72` — Fase E SQL final (schema real `mapeo_cuentas`, sin seed cuentas). Pusheado a `origin/main`.
- **Próximo paso:** **Fase G (reportes) → H (saldos apertura 2027) → F (conciliación) → D (ARCA, bloqueado por trámite cert)**. Antes de Fase G hay 2 sub-tareas previas pendientes: (a) seed manual de `mapeo_cuentas` para que los ingresos/egresos confirmados generen asientos automáticos; (b) decidir códigos finales del plan_cuentas para cuentas de diferencia de cambio (4.2 y 4.2.02 ya están ocupadas por "Otros ingresos" en prod).

- **Sesión 2026-05-19 (parte 5) — Fase E multi-moneda implementada + testeada en prod**:
  - **Commits**: `bc1e056` (feat inicial) → `1e140fc` (fix v1 plan_cuentas hereda tipo del padre) → `d25fc72` (fix v2 final: schema real mapeo_cuentas, sin seed cuentas). Todos en `origin/main`.
  - **SQL final** (`sql/finanzas_fase_e_multimoneda.sql`, idempotente, aplicado en prod 2026-05-19):
    - **E1** ALTER de 8 tablas con `moneda TEXT NOT NULL DEFAULT 'ARS' CHECK IN (ARS,USD,EUR)`, `cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1 CHECK > 0`, `total_en_ars NUMERIC(15,2)`. Tablas: `cuentas_financieras` (solo `moneda`), `ingresos`, `egresos`, `comprobantes`, `comprobantes_recibidos`, `comprobantes_iva_recovery`, `asientos` (solo `moneda`+`cotizacion` informativos), `transferencias_internas`. **21 columnas nuevas verificadas en prod via `information_schema.columns`.**
    - **E2** `fn_calcular_total_ars(monto, moneda, cotizacion)` IMMUTABLE. Cotización = ARS por 1 unidad de moneda extranjera.
    - **E3** triggers BEFORE INSERT/UPDATE: `fn_snapshot_total_ars_monto` (ingresos/egresos/transferencias) + `fn_snapshot_total_ars_total` (3 tablas comprobantes). Materializan `total_en_ars`. Backfill incluido.
    - **E4** ⏸ **DIFERIDO A FASE G**. Las cuentas 4.2 / 4.2.02 ya existen en prod con OTRO significado ("Otros ingresos", tipo `ingreso`). Pisarlas rompía contabilidad. Los códigos finales para diferencia de cambio se definen al diseñar el plan contable definitivo.
    - **E5** `fn_asiento_auto_ingreso/egreso` reescritos contra **schema real de `mapeo_cuentas`** (`tipo_movimiento` + `campo_origen` + `valor_origen` + `cuenta_contable_id` + `posicion` — NO `clave`/`cuenta_id` como asumía la versión anterior). Búsqueda jerárquica: match específico por categoría/medio/canal → fallback genérico. **Tolerante**: si no hay mapeos seedeados, sale en silencio sin romper (mismo comportamiento previo). El asiento usa `total_en_ars` y concepto incluye nota `[USD 100 @ 1420]` si moneda extranjera.
    - **E6** `fn_registrar_diferencia_cambio(p_ingreso_id, p_monto_ars, p_cuenta_pos_id, p_cuenta_neg_id, p_actor)` — recibe **las cuentas como parámetros** (no depende de mapeo_cuentas seedeado). Para uso manual desde JS o futura automatización Fase G.
    - **E7** índices parciales en `moneda` (filtran ARS).
  - **API** (`api.js?v=21`): `MONEDAS_DISPONIBLES`, `getCotizacionSugerida(moneda)` (vía dolarapi.com, cache 1h, devuelve null si falla), `calcularTotalArs`, `registrarDiferenciaCambio`, `getMovimientosExtranjeros`, `formatMontoMoneda`. `createComprobanteIvaRecovery` propaga `moneda`+`cotizacion`.
  - **UI** (`finanzas.js?v=14`): 3 helpers `_renderMonedaFields(prefix, item)` / `_attachMonedaListeners(prefix, montoFieldId?)` / `_readMonedaFields(prefix)`. Modales actualizados: Cuenta (moneda nativa simple, inmutable), Ingreso, Egreso, Transferencia (bloquea cambio entre monedas), Recibido (`finRec`/`finRecFormTotal`), IVA Recovery (`ivar`/`ivarTot`). Chips USD/EUR naranja en tablas Ingresos/Egresos con tooltip de cotización + equivalente ARS.
  - **Bugs encontrados y arreglados durante esta sesión**:
    1. **`plan_cuentas.tipo` CHECK** rechazó `'resultado_negativo'`. Enum real verificado en prod: `{activo, egreso, ingreso, pasivo, patrimonio}`. Fix v1: derivar tipo de la cuenta padre (`SELECT tipo INTO v_tipo_pos FROM plan_cuentas WHERE codigo='4'`).
    2. **`mapeo_cuentas` schema real diferente al asumido**. Columnas reales: `tipo_movimiento`/`campo_origen`/`valor_origen`/`cuenta_contable_id`/`posicion`/`activo`/`descripcion`/`_deleted` (NO `clave`/`cuenta_id`). Fix v2: reescribí `fn_asiento_auto_*` contra schema real y saqué TODO el seed de mapeos del SQL principal.
    3. **Cuentas raíz `5` no existe en prod plan_cuentas**, solo `4` (= "Otros Ingresos"). Decisión: no seedear cuentas de dif. cambio en esta fase, se hace manualmente en Fase G con códigos que no choquen.
    4. **`fix_trigger_asiento_auto.sql` previo (sesión parte 4) tenía bug latente**: referenciaba `mapeo_cuentas.clave`/`cuenta_id` inexistentes. El `CREATE FUNCTION` pasaba sintácticamente pero el trigger fallaba en runtime al disparar. Esta fase E también reemplaza esa función con la versión correcta contra schema real.
  - **Testeo end-to-end en prod via Chrome MCP** (todos OK, TEST data limpiada al final):
    | # | Test | Resultado |
    |---|------|-----------|
    | 1 | Crear cuenta "TEST USD Caja" con `moneda='USD'`, saldo=500 | ✅ persistida en BD |
    | 2 | Ingreso USD 100, click "🔄 Sugerir" → cotización 1420 auto, equivalente $142.000 ARS | ✅ `total_en_ars=142000` materializado por trigger |
    | 3 | Egreso USD 50 (servicio AWS) → equivalente $71.000 | ✅ `total_en_ars=71000` |
    | 4 | Comprobante recibido USD 50 (Factura A AWS) → equivalente $71.000 | ✅ `total_en_ars=71000` |
    | 5 | IVA Recovery USD 100 (subt 82.64 + IVA 17.36) → equivalente $142.000 | ✅ `total_en_ars=142000` |
    | 6 | Transferencia TEST USD Caja → Caja Oficina (ARS) | ✅ **bloqueada** con toast "No se puede transferir entre USD y ARS" + warning rojo en modal |
    | 7 | Chip USD naranja en tabla Ingresos+Egresos con tooltip | ✅ visible |
    | 8 | `fn_asiento_auto_ingreso/egreso` no rompen al confirmar/pagar con mapeos vacíos | ✅ salen en silencio, ingreso/egreso queda registrado |
  - **Decisiones de arquitectura tomadas**:
    - `total_en_ars` materializado por trigger (snapshot persistente, no recalcula).
    - Cotización por movimiento (no global por día).
    - dolarapi.com como sugerencia (gratis, sin auth, cache 1h, fallback manual).
    - Transferencias entre monedas no soportadas — usar ingreso+egreso por separado.
    - Seed plan_cuentas dif. cambio + mapeos diferidos a Fase G (cuando se diseñe el plan contable final). Los códigos 4.2/4.2.02 están ocupados por "Otros ingresos".
  - **Pendientes para Fase G (próximos)**:
    1. **Definir códigos finales para diferencia de cambio** en plan_cuentas (sugerencia: `4.9.01 Diferencia de cambio positiva` y `5.9.01 Diferencia de cambio negativa`, o sub-cuentas bajo otra rama). Coordinar con Fede.
    2. **Seedear `mapeo_cuentas`** con `tipo_movimiento='ingreso'`+`tipo_movimiento='egreso'` (genéricos + específicos por categoría) para que se generen asientos automáticos al confirmar/pagar. Hoy todos los ingresos/egresos del sistema quedan sin asiento contable (bug pre-existente).
    3. **Diferencia de cambio AUTOMÁTICA**: el JS detecta cuando se aplica un cobro a una factura USD con cotización vieja → llama a `fn_registrar_diferencia_cambio(...)` con las cuentas configuradas.
    4. **UI listado consolidado de movimientos extranjeros** — la API `getMovimientosExtranjeros` ya está, falta subtab en Finanzas.
    5. **Plan de pagos / vencimientos recurrentes en moneda extranjera**: ALTER `plan_cobro.total_plan`/`vencimientos_recurrentes.monto_estimado` con `moneda`+`cotizacion`. Heredar moneda al aplicar cobros.
    6. **Reportes exportables** (estado de resultados, balance, libros IVA AFIP).

- **Sesión 2026-05-19 (parte 4) — Pulido UI Finanzas + fixes**:
  - **Bug trigger contable (commit `38ce47e`)**: `fn_asiento_auto_ingreso`/`egreso` en prod referenciaba columnas inexistentes (`descripcion`/`estado` en asientos, `debe`/`haber` en asiento_lineas). Cualquier ingreso/egreso con estado `confirmado`/`pagado` rompía con `column "cuenta_id" does not exist`. Fix: `sql/fix_trigger_asiento_auto.sql` recrea ambos triggers contra schema real (concepto, tipo_movimiento/monto, sin estado). Si la cuenta financiera no tiene plan_cuentas vinculado, sale en silencio sin romper el INSERT.
  - **PDF plan de pagos rediseñado (commit `2fe3e56`)**: estilo cotización MEPEX. Logo optimizado (canvas 400px + JPEG 0.88), header turquesa con "PLAN DE PAGOS" + N° + fecha, rows con labels uppercase muted, tabla cuotas con zebra + estado coloreado, caja de totales con borde turquesa, datos bancarios automáticos (lee `cuentas_financieras` oficial+banco), notas opcionales. Filename `MEPEX_PLAN-<id>_<proyecto>_<fecha>.pdf`.
  - **Acciones inline en tablas Ingresos+Egresos (commit `8367e2c`)**: nueva columna "Acciones" con botones ✏️ Editar / ⎘ Duplicar / 🗑 Eliminar por fila. Edición inline de Concepto (doble click → input → Enter/Esc/blur). Estilos via `_ensureInlineStyles()` inyectado 1 vez.
  - **Sidebar fix + Registros aux + Planes (commit `b7541c5`)**: el side panel de detalle de Ingresos/Egresos quedaba colapsado a la altura de la fila clickeada (clientHeight=141, scrollHeight=632). Fix CSS override: position:fixed, top:80, right:16, width:420, max-height:calc(100vh-100px), scroll interno. En <900px cae a bottom sheet 75vh. Sacado `.fin-inline-editable` del guard de click — click simple abre panel, doble click edita inline. Registros auxiliares: reemplazado fin-btn-icon por fin-btn-row + botón Duplicar. Planes de cobro: botón Eliminar plan en header + botones editar/eliminar por cuota + modal `_showEditPlanItem`.
  - **Cleanup BD**: 1 registro IVA recovery TEST borrado, 0 planes huérfanos. Ingresos TEST ya estaban limpios.
  - **Versiones finales**: `finanzas.js?v=13`, `contabilidad.js?v=6`, `api.js?v=20` (sin bump, agregados aditivos).
  - **Verificado en prod via Chrome MCP**: sidebar arreglado se ve completo (DETALLE + REGISTRO + botones Editar/Anular/Eliminar). Plan "Feria del Libro Campana 2026" con 4 cuotas de $5M cada una visible OK. Falta verificación end-to-end de cobros multi-factura, generación PDF y vincular factura (requieren ejecución del `sql/fix_trigger_asiento_auto.sql` para que los ingresos confirmados no rompan).

- **Sesión 2026-05-19 (parte 3) — Fase B chamullo visual + Fase C completa**:
  - **Chamullo visual Fase B** (commit `8ddae6d`): "Recupero IVA extracontable" → **"Registros auxiliares"** en toda la app. Banner explicativo grande eliminado. Modal y textos suavizados: "Factura" → "Registro", "Traído por" → "Referencia", "Virtual" → "Auxiliar" en toggle Libros IVA, badge VIRTUAL violeta → AUXILIAR, chip "vía X" → "ref. X", Posición IVA con cards "Posición Oficial" / "Posición Total" + chip discreto "Diferencia" (sin narrativa "ahorro fiscal"). Internamente el valor `_origen: 'virtual'` se renombró a `'auxiliar'` por coherencia. La tabla SQL sigue siendo `comprobantes_iva_recovery` (no se ve, queda interno).
  - **Fase C completa** (commit `795e6f1`):
    - **SQL** (`sql/finanzas_fase_c_plan_pagos.sql`): ALTER `plan_cobro_items` con `facturar BOOLEAN` + `comprobante_venta_id UUID FK comprobantes`. Estados refinados: pendiente/facturada/parcial/cobrado/vencido/anulada. Tabla nueva `cobro_aplicaciones` (junction ingreso↔comprobante↔cuota, multi-factura). 2 VIEWs: `v_saldo_comprobante` (total - aplicado = saldo) + `v_plan_cobro_resumen` (totales, facturado, cobrado, conteo cuotas). 2 triggers: `fn_sync_cuota_desde_aplicacion` actualiza monto_cobrado/estado al insertar/borrar aplicaciones; `fn_marcar_cuota_facturada` BEFORE UPDATE marca cuota como 'facturada' al vincular un comprobante.
    - **API** (`api.js`): `getPlanesCobro`, `getPlanCobroById`, `getPlanCobroResumen`, `createPlanCobro` (con items), `updatePlanCobro`, `deletePlanCobro`, `createPlanCobroItem`, `updatePlanCobroItem`, `deletePlanCobroItem`, `vincularCuotaAComprobante`, `getCobroAplicaciones`, `aplicarCobro` (multi-factura), `deleteCobroAplicacion`, `getSaldoComprobante`, `getSaldosComprobantesPorCliente`.
    - **UI Finanzas > Ingresos > Planes** (`finanzas.js?v=9`): tabla de items sumadas columnas **Facturar** (✓/—) y **Factura** (badge VINCULADA turquesa si vinculada / botón "Vincular" si pendiente). Barra de progreso muestra pct cobrado Y pct facturado. Botón "📄 Resumen PDF" por plan en el header. Modal "Agregar item" con checkbox "Genera factura propia" (default true). Estados ampliados con iconos: ✓ Cobrado / ◐ Parcial / ○ Pendiente / 📄 Facturada / ! Vencido / Ø Anulada. Nuevo modal `_vincularCuotaConFactura` permite asociar una cuota a una factura existente del proyecto (no se generan facturas desde el modal — eso queda para Fase D con ARCA).
    - **PDF Resumen** (`_generarResumenPlanPDF`): A4 con jsPDF. Header turquesa MEPEX, datos cliente/proyecto/fecha/total, tabla cuotas (#/Concepto/Vence/Monto/Cobrado/Estado), totales (cobrado + saldo pendiente turquesa), datos bancarios MEPEX automáticos (lee `cuentas_financieras` con `canal_default='oficial'` y `tipo='banco'`), notas opcionales del plan. Filename: `plan-pagos-<proyecto>-<fecha>.pdf`.
  - **Coexistencia legacy**: `ingresos.plan_cobro_item_id` + `ingresos.comprobante_id` siguen funcionando para casos simples (1 ingreso = 1 factura). La lógica vieja de actualizar `monto_cobrado` manualmente desde JS al crear ingreso sigue activa. `cobro_aplicaciones` se usa solo para casos avanzados (cobros multi-factura o parciales complejos) — el trigger SQL nuevo solo dispara cuando hay aplicaciones explícitas, no compite con la legacy.
  - **Verificación end-to-end en prod**: Fase A asiento manual #11 guardado OK, Fase B factura virtual "Garbarino SA / Cuñada Pedro" $121.000 cargada con KPIs reales + badge AUXILIAR + Posición IVA mostrando diferencia $21k. **Fase C NO verificada todavía** — Fede tiene que pullear VPS + ejecutar SQL Fase C antes de probar.
  - **Bugs encontrados y arreglados durante la sesión**:
    - **Modal.open no soporta `onOpen` callback**. Los listeners deben attachearse DESPUÉS del `Modal.open()`, ya que el DOM existe síncrono al apendChild. (commit `6052755`).
    - **Modal.close() requiere `instance.id`** devuelto por Modal.open() — sin args no cierra nada. (commit `ba2d594`).
  - **Lecciones aprendidas** (anotadas para futuro): el SQL del repo PUEDE estar desfasado vs prod — verificar siempre con `information_schema.columns` antes de tocar tablas existentes (regla 12 del CLAUDE.md). El "bug crítico" del asiento_lineas que la auditoría inicial reportó NUNCA EXISTIÓ — el JS y la BD coincidían; el repo SQL era el desactualizado.

- **Sesión 2026-05-19 (parte 2) — Fase B: IVA Recovery completada**:
  - **SQL** (`sql/finanzas_fase_b_iva_recovery.sql`): tabla auxiliar `comprobantes_iva_recovery` (admin/superadmin RLS) — NO genera asiento. VIEW `v_libro_iva_compras_extendido` une oficiales (`comprobantes_recibidos`) + virtuales para Libro IVA AFIP. VIEW `v_posicion_iva_mes` agrega por periodo con desglose oficial/virtual.
  - **API** (`api.js`): bloque "FASE B" con `getComprobantesIvaRecovery({periodo, fechaDesde, fechaHasta})`, `createComprobanteIvaRecovery`, `updateComprobanteIvaRecovery`, `deleteComprobanteIvaRecovery`, `getLibroIvaComprasExtendido`, `getPosicionIvaMes`.
  - **UI Finanzas** (`finanzas.js?v=5`): nuevo subtab "Recupero IVA extracontable" dentro de tab Egresos. State `_egresosSubtab` (`egresos`|`iva_recovery`). Banner explicativo + filtro por periodo + KPIs (cantidad, subtotal, IVA recuperado, total) + tabla CRUD con modal de carga (fecha, CUIT, razón social, descripción, subtotal, IVA 21/10.5/otros, total, traído por, notas). Helper "Calcular desde Total y 21%" que infiere subtotal e IVA.
  - **UI Contabilidad** (`contabilidad.js?v=5`): Libros IVA > Compras suma toggle "Oficial / Virtual / Ambos". Tabla muestra badge VIRTUAL violeta + chip "vía [traído por]" cuando aplica. Footer con desglose oficial/virtual cuando "Ambos". Posición IVA rediseñada con 2 cards lado a lado: "Solo oficial" y "Real (con virtual)", + card "Ahorro fiscal del periodo" si hay IVA virtual.
  - **Filosofía respetada**: las facturas extracontables NO impactan el P&amp;L oficial (no generan asiento). Sí entran al Libro IVA AFIP. Solo visible a admin/superadmin (RLS en BD + check de rol en UI).

- **Sesión 2026-05-18/19 — Blueprint Finanzas+Contabilidad v2 + Fase A hardening contabilidad**:
  - **Descubrimiento crítico**: CLAUDE.md decía que Finanzas y Contabilidad estaban "Pendiente — sin funcionalidad". FALSO. Hay ~13.000 líneas de JS (`finanzas.js` 8756 + `contabilidad.js` 4560) + 8 SQLs de finanzas + tablas reales pobladas. La auditoría inicial (vía agent Explore) creyó que el SQL del repo reflejaba prod — ERROR. **El schema de prod difiere significativamente del que el SQL del repo describe.**
  - **Schema real verificado de tablas contables** (vía `information_schema.columns`):
    - `asiento_lineas` usa `tipo_movimiento`/`monto` (NO `debe`/`haber` como decía el repo).
    - `asientos` usa `concepto` (NO `descripcion`) y NO tiene columna `estado` (sólo `_deleted`).
    - `saldos_mensuales` usa `periodo TEXT 'YYYY-MM'` + `saldo_anterior` + `saldo_final` (NO `anio`/`mes` separados ni `debe`/`haber`/`saldo`).
  - **Pasos hechos**:
    1. **Blueprint v2 escrito** en `docs/finanzas_blueprint_v2.md` — partida doble formal, lado A/B con flag `canal`, plan de pagos avanzado (cotización $5M con cuotas y facturación parcial), compras familiares "IVA recovery" como tabla auxiliar con VIEW virtual (no contamina contabilidad real), ARCA directo (reemplazar La PyME, vía endpoint nuevo en proxy HTTP del VPS usando `arcasdk` TypeScript), multi-moneda USD/EUR con snapshot de cotización, conciliación bancaria semi-automática, saldos apertura para arrancar uso real Enero 2027. Plan en 8 fases (A-H) ~5-7 semanas.
    2. **Bug aparente en `contabilidad.js:3669`** identificado por la auditoría (uso de `tipo_movimiento`/`monto`) → "fixeado" → REVERTIDO al verificar schema real (el JS estaba correcto, el SQL del repo era el erróneo). Versión final `contabilidad.js?v=4` igual a la original.
    3. **Fase A hardening contabilidad escrita en `sql/contabilidad_fase_a_hardening.sql`** (idempotente):
       - A1: CHECK partida doble en `asientos` (NOT VALID, validar con `ALTER TABLE asientos VALIDATE CONSTRAINT chk_partida_doble` después de limpiar histórico).
       - A2: Funciones `fn_refresh_saldo_periodo` + `fn_refresh_saldo_cascada` + triggers `trg_saldos_lineas` y `trg_saldos_asiento_cabecera` + backfill + UNIQUE `(cuenta_id, periodo, canal)`. Cascada propaga cambios a meses posteriores.
       - A3: ALTER `plan_cuentas` agregando `imputable BOOLEAN` (backfill = NOT es_grupo) y `controla_subdiario TEXT` (cliente/proveedor/evento/proyecto).
       - A4: Tabla `audit_logs` (nueva) + trigger `trg_audit_asientos` (registra INSERT/UPDATE/DELETE en `asientos`). RLS read solo admin/superadmin.
    4. **Limpieza**: borrados 4 archivos SQL desfasados (`sql/contabilidad_fase1_tablas.sql`, `_seed.sql`, `_mapeos.sql`, `_triggers.sql`). Reflejaban schema viejo que no coincide con prod. Si necesito ver el plan de cuentas seedeado o los mapeos actuales, leer directo de la BD.
  - **Decisiones de arquitectura tomadas en este blueprint**:
    - **Lado A/B con flag `canal` por movimiento** (no plan de cuentas duplicado). Reportes filtran. Permisos por rol.
    - **Compras familiares**: tabla auxiliar `comprobantes_iva_recovery` (Fase B, pendiente) que NO genera asiento contable. Una VIEW suma el IVA de la auxiliar al saldo de "1.1.04.01 IVA crédito fiscal" para reportes gerenciales. La contabilidad oficial queda limpia; el IVA presentado a AFIP incluye el ahorro.
    - **Proyecto = centro de costo principal · Evento = agregador**. Las facturas y asientos imputan a `proyecto_id`; el `evento_id` se hereda y se usa solo para agregaciones.
    - **UI sin tab Económico ni en evento ni en proyecto**: toda la evaluación económica vive dentro del módulo Finanzas (admin/superadmin only). Selector de proyecto/evento desde adentro.
    - **ARCA directo via proxy HTTP del VPS** (mismo `195.200.1.250:3000` donde corre La PyME) usando `arcasdk` TypeScript. NO se usa Supabase Edge Functions (es overkill, ya hay backend). Fase D.
    - **Saldos apertura "borrador → bloquear y activar"**: pantalla editable hasta que superadmin clickea bloquear → genera asiento de apertura → ejercicio 2027 abierto. Uso real arranca Enero 2027.
  - **Pendientes próximos**:
    1. Fede ejecuta `sql/contabilidad_fase_a_hardening.sql` en SQL Editor → confirma NOTICEs OK.
    2. Fede prueba guardar asiento manual en prod → debe funcionar igual (el JS no cambió).
    3. ✅ Schema de Finanzas verificado (2026-05-19): los `sql/finanzas_fase1..8.sql` COINCIDEN con prod — no se borran. Cubren las 12 tablas exactas (cuentas_financieras, ingresos, egresos, plan_cobro, plan_cobro_items, transferencias_internas, comprobantes, comprobantes_recibidos, vencimientos_recurrentes, vencimientos_generados, conciliaciones, extracto_bancario_lineas).
    4. Arrancar Fase B (compras familiares + IVA recovery).
  - **Bugs conocidos al cierre de esta sesión**:
    - Columnas rotadas en `clientes` (mapeado en api.js, no se corrige en Supabase).
    - Tablas legacy `logistica_vehiculos` / `logistica_movimientos` con tipos BIGINT vs UUID en FKs.
    - Los archivos `sql/finanzas_fase*.sql` PUEDEN estar desfasados vs schema real (no verificado todavía).
- **Tanda 4 completada (UX/Mobile review integral)**:
  - **T4.1 — Foundation** (`e709569`): `mobile.css` nuevo (768/480 breakpoints) cargado después de `style.css`. Sidebar como drawer overlay con backdrop + body-scroll-lock + cierre on outside/hash change. Modal fullscreen mobile (100vw × 100dvh sin border-radius). Notif dropdown → bottom sheet con backdrop + transition slide-up. Botón búsqueda mobile (ícono lupa) reemplaza el input Ctrl+K + overlay fullscreen separado. Connection badge + user-info text + chevron ocultos en mobile. Header compacto. Inputs `font-size: 16px` (iOS no zoomea). Tap targets mínimos 44px. `app.js`: `App.isMobile()` helper, default sidebar `hidden` si mobile, `toggleSidebar` drawer-aware, `openDrawer/closeDrawer`, `openSearchMobile/closeSearchMobile`, `_handleSearch` con targetId parametrizable. `notifications.js`: `_renderMobileSheet` en `<body>` (el header tiene `backdrop-filter: blur(20px)` que anula `position:fixed` de descendientes — workaround obligatorio).
  - **T4.2 — Tablas a cards mobile** (`2ee509a`): `crm.js` tabla clientes con `class="table-stack-mobile"` + `data-label="..."` en cada `<td>`. `rrhh.js` tabla Nómina idem. En `mobile.css` la regla `.table-stack-mobile thead { display: none }` + `tr { display: block }` + `td::before { content: attr(data-label) }` transforma cada fila en card vertical con labels desde `data-label`. Wrappers de Inventario/Costos/Compras → `overflow-x: auto` con scroll horizontal touch-friendly (son módulos admin, menos críticos mobile).
  - **T4.3 — Calendario Operativo vista cards mobile** (`2ee509a`): `calendario-operativo.js _isMobile()` helper + `_init()` detecta mobile y fuerza `viewMode='cards'`. Skip timeline + infinite scroll + scroll-to-today. Toolbar wraps, oculta zoom + view-toggle. `.co-card` full-width. Side panel del evento → bottom sheet 85vh con corners redondeados.
  - **T4.4 — Polish** (`a7b9a21`): tabs scrollables horizontal con clases específicas por módulo (`.pjd-tabs-bar`, `.crm-tabs`, `.costos-tabs`, `.module-section-tabs`, `.cat-tabs`, `.co-sp-tabs`, `.cont-tabs-bar`, etc.). Tap targets 44px en `.pjd-tab`/`.crm-tab`/etc. Wrappers de tablas adicionales (compras, admin, catalogo, contabilidad) con `overflow-x: auto`.
- **Decisiones de arquitectura tomadas en Tanda 4**:
  - **`mobile.css` separado, NO infiltrado en `style.css`**: si algo rompe, se quita el `<link>` y se vuelve a desktop. Carga después del `style.css` así pisa lo necesario. Bumpear `?v=` cuando hay cambios.
  - **Cards mobile via CSS-only opt-in (`.table-stack-mobile` + `data-label`)**: cada `<td>` necesita su `data-label` pero el JS de cada módulo se toca solo una vez. Helper genérico en `mobile.css`. Aplicado solo a CRM y RRHH Nómina (los más usados desde mobile por personal poco tech). Resto: scroll horizontal en wrappers.
  - **Notif sheet en `<body>`, NO en header**: el header tiene `backdrop-filter: blur(20px)` que crea nuevo containing block para `position:fixed`. El sheet mobile se crea como hijo de `body` para que `bottom:0` ancle al viewport. Cerrarlo lo remueve.
  - **Drawer state independiente del `sidebarState` legacy**: `App.drawerOpen` boolean nuevo + clase `.drawer-open` en el sidebar. El `sidebarState` ('open'/'collapsed'/'hidden') sigue existiendo para desktop. En mobile cualquiera de los 3 estados queda detrás del CSS `transform: translateX(-100%)` salvo si se agrega `.drawer-open`.
  - **Calendario operativo mobile = cards forzadas, NO vista lista por día**: la vista cards ya existía. Decisión pragmática: forzar `viewMode='cards'` en mobile en lugar de construir vista nueva. Las cards son responsive-friendly. Si se quiere agrupar por día, queda para iteración futura.
  - **Tablet (768px portrait) aplica reglas mobile**: iPad portrait = 768x1024 exactamente. El cutoff `@media (max-width: 768px)` aplica también ahí. iPad landscape (1024x768) usa reglas desktop normal.
- **Verificación en preview local (375x812 / 768x1024)**:
  - Header mobile compacto: hamburger + logo + lupa + bell + avatar (sin chevron ni info text). ✓
  - Sidebar drawer abre + backdrop visible + body lock. ✓
  - Click backdrop fuera del drawer cierra el drawer. ✓
  - Modal fullscreen 375x812 sin borders en mobile. ✓
  - Notif bottom sheet posicionado bottom:0 con sheet en body. ✓
  - Sin scroll horizontal en viewport mobile/tablet. ✓
  - CRM `.table-stack-mobile`: `thead` hidden, `tr` block con bg + radius 8px, `td` flex con `::before "Empresa"` (label desde `data-label`). ✓
  - **NOTA preview headless**: los screenshots se traban (probable issue del entorno preview con polling Supabase + notif refresh, no del código). Verificación funcional vía `preview_eval` + computed styles directos.
- **Pendientes próximos**:
  1. Verificación end-to-end manual de Fede en iPhone real + iPad real (portrait + landscape).
  2. Polish residual posible al usar la app real desde celu (descubrir wrappers/tabs no cubiertos).
  3. Tablas grandes Inventario/Costos/Compras siguen con scroll horizontal — eventualmente decidir si convertirlas también a cards (más trabajo: tocar muchos `_renderRow` para agregar `data-label`).
  4. Cleanup tablas legacy `logistica_movimientos`, `logistica_vehiculos`, `rrhh_personal`, `rrhh_asignaciones` (postergado desde Tanda 3+).
  5. Edge cases defensivos en Costos.
  6. Módulo de Costos Fijos mensuales + dashboard breakeven.
- **Bugs conocidos** (al cierre Tanda 4):
  - Columnas rotadas en `clientes` (mapeado en api.js).
  - Tablas legacy `logistica_vehiculos` / `logistica_movimientos` con tipos BIGINT vs UUID en FKs.
  - Modal "Asignar a Evento" solo muestra eventos con fecha futura cargada — es esperado.
  - Preview headless local timeouts en screenshots cuando hay polling activo (Notifications + Supabase auth refresh) — no afecta producción real.
- **Tanda 3+ completada (Cierre del blueprint operativo + asignaciones_evento + pulido UX)**:
  - **3.E — Asignaciones de personas a eventos** (`sql/asignaciones_y_notifs.sql` + `api.js` + `logistica.js` + `calendario-operativo.js`): nueva tabla `asignaciones_evento` (UUID) — persona afectada a evento en una fase con rango de fechas + rol + estado (propuesta/aprobada/confirmada/cancelada). Diferente de `carga_personas` (que es por VIAJE). API CRUD completo (`getAsignacionesByEvento`, `getAsignacionesByPersona`, `getAsignacionesActivasBulk`, `getAsignacionesPendientesCount`, `createAsignacionEvento` con notif admin auto, `updateAsignacionEvento`, `approveAsignacionEvento` con notif al creador, `deleteAsignacionEvento`, `detectarConflictosPersona`). Trigger AFTER UPDATE en `encuestas_evento` dispara notif a PM+admin cuando se responde con NPS color-coded (Promotor/Pasivo/Detractor) — `prioridad='alta'` si NPS<7. Documentación SQL de los 9 roles canónicos operativos ampliados (armador/chofer/ayudante/electricista/montajista/encargado_armado/tecnico/azafata/colaborador).
  - **3.E UI Personas refactor según spec Fede** (`logistica.js v=9`): SACA columna Tipo + Estado + botón "→ Ir a RRHH" + banner read-only. Filtro `getPersonasOperativas` muestra solo gente con al menos un rol operativo (excluye internos de oficina/ventas). Teléfonos como links WhatsApp (`wa.me/<intl>`, asume AR si no tiene código). Botones "🚚 Carga" + "📅 Evento" por fila para asignar inline. Banner admin "X convocatorias pendientes" arriba si hay propuestas sin aprobar (clickeable → Calendario). Cada card muestra chips de asignaciones activas color-coded ("📅 Estetica" verde aprobada / naranja propuesta) con +N si hay más. Modal "Asignar a carga" si NO hay cargas próximas → empty state + botón "+ Crear nueva carga" que abre el form. Modal "Asignar a evento" valida solapamiento con `detectarConflictosPersona` y muestra confirm con lista si hay conflictos.
  - **3.E modal RRHH refactor** (`rrhh.js v=3`): input "Rol descriptivo" libre que guarda en `rol_legacy` + multi-select con 9 roles canónicos en checkboxes. Los checks definen en qué selects aparece la persona en Logística. Save handler usa los checkboxes (no el text input).
  - **3.E proyecto-detalle ciclo badge** (`proyecto-detalle.js v=4`): badge "🏗️ <estado_taller> <pct>%" en el header con barra mini color-coded por estado (pendiente gris / en_armado naranja / listo verde / despachado turquesa / cerrado violeta). Refleja `completitud_pct` mantenido por trigger SQL.
  - **3.E calendario operativo asignaciones** (`calendario-operativo.js v=6`): `_loadPanelData` trae `asignacionesNew` en paralelo. Side panel tab Logística suma sección "Personas asignadas (N)" agrupada por fase (armado/funcionamiento/desarme) con cada persona, estado color-coded y botón "✓ Aprobar" inline si admin. La sección legacy "Equipo asignado" (`rrhh_asignaciones`) ahora se renderiza SOLO como fallback si NO hay asignaciones nuevas (evita duplicación visual). Etiqueta "(legacy)" cuando aparece.
  - **Bug detectado y fixeado** (`sql/fix_completitud_trigger.sql`): la función trigger `trg_proyectos_completitud_fn` llamaba a `calc_completitud_pct(NEW.id)` que hace SELECT FROM proyectos. En un BEFORE UPDATE el SELECT lee el valor OLD (la fila aún no fue updateada), entonces el cálculo era con estado_taller viejo. Fix: la función ahora calcula directo con NEW.estado_taller sin SELECT intermedio. `calc_completitud_pct` queda para llamadas externas / backfill.
- **Decisiones de arquitectura tomadas en Tanda 3+**:
  - **Coexistencia legacy + nuevo schema**: `rrhh_personal` migrada a `personas` pero ambas viven (las legacy aún las referencian rrhh_asignaciones / rrhh_vacaciones). Tab Asignación y Vacaciones de RRHH siguen contra legacy con banner aclaratorio. La limpieza queda para tanda futura.
  - **9 roles canónicos operativos** (armador/chofer/ayudante/electricista/montajista/encargado_armado/tecnico/azafata/colaborador): valores en `personas.roles_operativos[]`. El campo `rol_legacy` guarda el string descriptivo libre (no se pierde info como "Encargado", "Chofer Iveco senior", etc.) — pero solo los roles canónicos definen visibilidad en selects de Logística.
  - **Validación de conflictos no es bloqueo**: si se detecta solapamiento al asignar una persona, se muestra warning con las asignaciones existentes y se permite continuar igualmente. Admin decide.
  - **Asignaciones vs cargas — distinción clara**: `asignaciones_evento` = persona afectada al EVENTO en una fase con rango de fechas (largo plazo, varios días). `carga_personas` = ayudantes de UN VIAJE específico (1 día, contexto carga). Coexisten — una persona puede tener una asignación al evento + estar en una carga específica del mismo evento.
- **Pasos manuales pendientes (SQL en Supabase Dashboard, orden recomendado)**:
  1. `sql/taller_logistica_v2.sql` — schema operativo (cargas/vehiculos/personas/etc.).
  2. `sql/storage_remitos.sql` — crea bucket `remitos` privado + policies (idempotente).
  3. `sql/taller_checklist_v2.sql` — tabla checklist UUID.
  4. `sql/rrhh_to_personas_migration.sql` — expande personas + copia rrhh_personal → personas.
  5. `sql/completitud_triggers.sql` — triggers completitud_pct + backfill.
  6. `sql/asignaciones_y_notifs.sql` — tabla asignaciones_evento + trigger notif encuesta.
  7. `sql/fix_completitud_trigger.sql` — fix del bug del badge "En armado 0%".
- **Pendientes próximos**:
  1. **Tanda 4 — Revisión UI/UX integral mobile/tablet** (ver `memory/plan_tanda4_ui_review.md`): sidebar como drawer overlay en mobile, tablas → cards en mobile, tap targets 44px, modals fullscreen mobile, búsqueda como botón visible (no Ctrl+K), notif dropdown como bottom sheet, Calendario Operativo con vista alternativa mobile (lista por día). Auditoría módulo por módulo con DevTools (iPhone 12 + iPad).
  2. Cleanup tablas legacy `logistica_movimientos`, `logistica_vehiculos`, `rrhh_personal`, `rrhh_asignaciones`. Decidir qué migrar al schema nuevo y qué borrar.
  3. Edge cases defensivos en Costos (items propios sin componentes, sin tipo_amortización, recetas circulares).
  4. Módulo de Costos Fijos mensuales + dashboard breakeven.
  5. Mejoras a la encuesta NPS: multi-pregunta, ratings por dimensión, envío automático por WhatsApp/email.
- **Bugs conocidos** (al cierre Tanda 3+):
  - Columnas rotadas en `clientes` (mapeado en api.js).
  - Tablas legacy `logistica_vehiculos` / `logistica_movimientos` con tipos BIGINT vs UUID en FKs.
  - Modal "Asignar a Evento" solo muestra eventos con fecha futura cargada — es esperado, pero data limitada hace que aparezcan pocos eventos.
- **Verificación end-to-end (en Chrome, server http://195.200.1.250)**: completada — pestaña Personas + asignar persona a evento + notif admin + aprobación inline en Calendario + badge ciclo en proyecto-detalle. PDF size 5.4MB→14KB. Bucket Storage OK. Notifs filter superadmin OK. Cleanup hecho (Sacha test cancelada, proyecto pendiente).
- **Tanda 3 completada (Cierre del blueprint operativo)**:
  - **3.A — RRHH migrado a `personas`** (`sql/rrhh_to_personas_migration.sql` + `rrhh.js`): expande `personas` con columnas faltantes (contacto, email, fecha_ingreso, documentacion, cantidad_personas, rol_legacy) + admite tipo='cuadrilla' + copia los registros vivos de `rrhh_personal` a `personas` manteniendo el mismo id UUID. Mapeo nombre→nombre+apellido, tipo 'fijo'→'interna', rol legacy a `roles_operativos[]` cuando matchea uno canónico (armador/chofer/ayudante/tecnico/azafata) o queda en `rol_legacy` cuando no. `rrhh.js` tab Nómina lee/escribe `personas` ahora (compat layer transparente con `_mapPersonaToLegacyShape`). EFECTO: las personas cargadas desde RRHH aparecen automáticamente como choferes/ayudantes en el select de cargas en Logística. La tabla `rrhh_personal` queda intacta mientras `rrhh_asignaciones` y `rrhh_vacaciones` la referencien (tabs Asignación y Vacaciones siguen legacy con banner aclaratorio).
  - **3.B — Encuesta NPS pública con token** (`encuesta.html` + `eventos.js` + `api.js`): `encuesta.html` standalone (sin login, branding MEPEX, mobile-first, escala NPS 0-10 color-coded — rojo 0-6, naranja 7-8, verde 9-10 + comentario opcional). `api.js getEncuestaForEvent(eventoId)` devuelve la encuesta más reciente del evento. `eventos.js` suma botón "📨 Enviar encuesta al cliente" en el panel lateral del evento (al lado de Eliminar). Al click: `_openEncuestaModal` crea la encuesta si no existe, genera URL pública (`/encuesta.html?t=<token>`), la muestra en modal con botón "Copiar" al clipboard. Si la encuesta ya fue respondida, muestra el NPS color-coded (Promotor/Pasivo/Detractor) + comentario + fecha. El admin/PM manda el link manualmente por WhatsApp/email.
  - **3.C — Triggers SQL para `completitud_pct`** (`sql/completitud_triggers.sql` + `taller.js`): función `calc_completitud_pct(proyecto_id)` mapea estado_taller a % (pendiente=0 / en_armado=25 / listo=50 / despachado=75 / cerrado=100). Si hay encuesta del evento respondida → siempre 100. Trigger BEFORE UPDATE en proyectos recalcula automáticamente al cambiar estado_taller. Trigger AFTER UPDATE en encuestas_evento cierra todos los proyectos del evento (estado='cerrado', completitud=100) cuando se responde la encuesta. Backfill incluido para proyectos existentes. UI: las cards de stand del Taller ahora muestran una segunda barra "Ciclo del proyecto" con gradient violeta→turquesa (debajo de la barra del checklist).
  - **3.D — Render de cargas en Calendario Operativo** (`calendario-operativo.js`): el side panel del evento (tab Logística) ahora suma una sección "Cargas (N)" agrupada por fase (Armado verde / Intermedio violeta / Desarme naranja) con mini-cards por cada carga (vehículo + chofer + fecha/hora + count stands + badge estado color-coded). Click en una mini-card → deep-link a `#logistica?tab=cargas&id=<uuid>`. Coexiste con la sección legacy "Transporte" (logistica_movimientos) sin pisarla.
- **UX refactor incluido en Tanda 3 (a pedido de Fede mid-sesión)**:
  - Logística cargas: tabla → grid de cards (1-2 cols responsive, chips de stands preview, botón Aprobar inline para admin).
  - Modal Nueva/Editar carga → form inline en panel lateral derecho (chau modal, más contextual).
  - Personas en Logística: solo lectura. CRUD se hace desde RRHH. Banner + link "→ Ir a RRHH" solo visible para admin/superadmin (no para taller/pm que no acceden a RRHH).
  - Panel cargas: warning naranja arriba si carga aprobada/en_curso sin vehículo o chofer + botón "Editar" en aprobadas + "Eliminar" separado en "ZONA DE PELIGRO" rojo dashed.
  - Tab Remitos (4to en Logística): listado histórico completo de PDFs + fotos firmadas con filtros (evento/tipo/fecha desde/hasta) e íconos clickeables que abren signed URLs.
  - Taller: 3 tabs (Hoy / Checklist / Mantenimiento). Tab Checklist tiene 6 items canónicos (placas/iluminación/mobiliario/pisos/gráfica/embalado) con rows expandibles. Tab Mantenimiento es CRUD de equipos/matafuegos/herramientas con vencimientos + stats banner (vencidos, próximos 30d). Cards de stand muestran progreso checklist + ciclo del proyecto.
  - PDF logo optimizado: de 5.4 MB → 14 KB (canvas resize 400px + JPEG 88%).
  - Notif filter: superadmin ve también las target_role='admin'.
- **Tanda 2 completada (Operativo: Taller cards + Logística cargas + Remito PDF)**:
  - **B1.a** (`sql/taller_logistica_v2.sql`): tablas operativas en UUID. `personas` (RRHH operativo: internos + eventuales con `roles_operativos[]`), `vehiculos` (flota MEPEX + terceros), `cargas` (viajes con FK a evento/vehículo/chofer/responsable/aprobador + estado borrador→aprobada→en_curso→completada/cancelada + paths a remito_pdf_url y remito_firmado_url), `carga_proyectos` (M2M stand↔carga, ON DELETE CASCADE), `carga_personas` (ayudantes). Índices por evento/fecha/estado + GIN sobre roles_operativos. RLS abierto a authenticated; DELETE restringido a admin/superadmin. Las legacy (`logistica_movimientos`, `logistica_vehiculos`, `rrhh_personal`) NO se tocan — coexisten.
  - **B1.b** (`sql/storage_remitos.sql`): policies del bucket `remitos` (SELECT/INSERT/UPDATE abiertos a authenticated, DELETE a admin/superadmin). El bucket en sí hay que crearlo a mano en Dashboard → Storage (Supabase no permite crear buckets via SQL).
  - **B2** (`api.js`): bloque "TANDA 2" agregado al final con CRUD completo: `getVehiculos`/`createVehiculo`/`updateVehiculo`/`deleteVehiculo` + `getPersonas`/`getChoferes`/`createPersona`/`updatePersona`/`deletePersona` + `getCargas`/`getCargaById`/`getCargasProximas`/`createCarga`/`updateCarga`/`setCargaProyectos`/`setCargaAyudantes`/`approveCarga`/`setCargaEstado`/`setCargaRemitoPDF`/`setCargaRemitoFirmado`/`deleteCarga`. Helpers Storage: `uploadRemitoPDF`/`uploadRemitoFirmado`/`getRemitoSignedUrl` (signed URLs 1h por defecto). `setEstadoTaller(proyectoId, estado)` para que taller marque listo + notif a PM. Fan-out de notifs cableado en creación de carga (admin → "carga pendiente aprobación"), aprobación (creador → "carga aprobada"), foto firmada (PM + admin → "remito firmado"), vehículo tercero (admin → revisar). Embedded selects ajustados a columnas reales (`eventos.nombre`, `eventos.predio`, `eventos.fecha_armado_inicio`, `proyectos.nombre`).
  - **B2.1** (`logistica.js`): reescrito desde cero. 3 tabs internos (Cargas, Vehículos, Personas) con split table+panel lateral en Cargas. Banner sticky para admin con count de pendientes de aprobación. Filtros (evento/fase/estado/fecha) + botón "+ Nueva carga". Panel de carga muestra estado, fase, fecha+hora, vehículo, chofer (con tel: link), destino, ayudantes (chips), stands cargados, notas, aprobador, remito firmado. Botón principal contextual por estado: borrador → Aprobar (admin) / Editar (autor o admin); aprobada → Descargar remito / Marcar en curso; en_curso → Subir foto del remito; completada → Ver detalle. Modal de nueva/editar carga con FormBuilder ad-hoc (event + fase + fecha/hora + vehículo + chofer + ayudantes multi-select + proyectos del evento multi-select + notas). Tab Vehículos y Personas con CRUD via modal. Vehículo tercero dispara notif admin automática. Deep-link `#logistica?tab=cargas&id=<uuid>` soportado. CSS inyectado.
  - **B3** (`remito-pdf.js`): nuevo módulo `RemitoPDF` con un solo método `generate(cargaId)` que devuelve Blob. Layout A4 portrait con branding turquesa MEPEX: header (logo de `assets/logo_full.png` cargado vía fetch+FileReader cacheado + "REMITO DE CARGA Nº <8 chars>" + fecha emisión), bloque Evento/Destino/Fase/Fecha/ETA, bloque Vehículo/Propietario/Chofer/Ayudantes, lista de proyectos con checkbox cuadrado numerados, notas si las hay, casilleros de firma (Responsable MEPEX / Recibido por con aclaración + fecha entrega), footer. Auto-paginación si supera el alto. jsPDF ya cargaba para Costos; reusado.
  - **B4** — Flujo aprobación admin: en `logistica.js _aprobarCarga` llama `API.approveCarga(id)` → `RemitoPDF.generate(id)` → `API.uploadRemitoPDF(id, blob)` → `API.setCargaRemitoPDF(id, path)`. Todo en una sola acción del usuario.
  - **B5** (`taller.js`): reescrito como vista cards mobile-first. Saluda "Hola <name>", banner naranja "Tenés N novedades nuevas" si las hay, sección "HOY · <día long>" con cards en grid responsive (auto-fill minmax 280px), sección "PRÓXIMOS DÍAS" con sub-headers por día. Dos tipos de card: **Stand** (cliente, evento, venue, estado_taller badge, banner naranja con primer novedad pendiente, botón principal según estado: pendiente→empezar armado, en_armado→listo, listo→despachado; botones secundarios: ver carpeta Drive si hay URL, ver ficha) y **Carga** (vehículo + hora chip, evento, destino, fase, count stands; botón según estado: borrador→editar, aprobada→descargar remito + salí de viaje, en_curso→subir foto firmada con `<input type=file capture=environment>`, completada→ver detalle). Cards 44px tap-target mínimo, layout 1-col en <640px. Modal de novedad con tipo + prioridad + autor + fecha al click en banner.
  - **Index** (`index.html`): suma `remito-pdf.js?v=1`, bumpea `taller.js?v=2` y `logistica.js?v=2`. jsPDF y autotable ya estaban.
- **Decisiones de arquitectura tomadas en Tanda 2**:
  - **Schema nuevo en UUID, legacy intacto.** Las tablas `cargas`/`personas`/`vehiculos` coexisten con `logistica_movimientos`/`rrhh_personal`/`logistica_vehiculos`. No se migra data — quien quiera reusar las viejas las consulta directo. Tanda 3 puede decidir si borrar o migrar.
  - **RLS práctico, no purista.** El "estado=aprobada solo admin" se enforce en el frontend (botón visible/invisible). RLS solo bloquea DELETE para evitar accidentes. Permite simplificar las policies y dejarlas legibles.
  - **Storage privado, signed URLs.** Bucket `remitos` no público — al click "Descargar" se genera signed URL 1h via `createSignedUrl`. Evita exponer URLs estables que puedan filtrarse.
  - **PDF en cliente con jsPDF.** Reusa la lib ya cargada para Costos. Sin servidor de generación. El PDF generado se sube a Storage al aprobar (no se genera on-demand cada vez).
  - **Mobile-first solo en Taller.** El resto del sistema sigue desktop-first. Taller tiene cards grandes y `<input capture=environment>` para abrir cámara directo.
- **Tanda 1 completada (Taller + Logística — Base & Backbone)**:
  - **B1** (`e432abc`): `sql/taller_logistica_v1.sql` — migración base. Crea `proyecto_novedades`, `notifications`, `encuestas_evento` (UUID, alineadas a eventos/proyectos/profiles). ALTER `proyectos` con `estado_taller`, `estado_taller_updated_{at,by}`, `completitud_pct`. RLS habilitado en las 3 tablas (SELECT amplio para authenticated; UPDATE/DELETE filtrado por autor/admin; encuestas SELECT/UPDATE abierto a anon vía token).
  - **B2** (`43de642`): `api.js` extendido. CRUD para `proyecto_novedades` (`getNovedades`, `createNovedad`, `resolveNovedad`, `markNovedadVisible`, `deleteNovedad`) con fan-out automático a `notifications` según matriz §5 del blueprint (PM siempre; +admin si alta/crítica; +taller si toggle o alta/crítica). CRUD para `notifications` (`getNotifications` segmentado por target_user_id/role, `getUnreadNotificationsCount`, `markNotificationRead`, `markAllNotificationsRead`, `createNotification`). Esqueleto encuestas (`getEncuestaByToken`, `createEncuesta`).
  - **B3** (`117bd61`): Drive embed en tab "Archivos Drive" de ficha proyecto. Reemplaza placeholder por iframe a `https://drive.google.com/embeddedfolderview?id=<ID>#grid` con toolbar superior (URL compacta + botones) y fallback "Abrir en Drive" debajo del iframe. `_extractDriveFolderId` ahora soporta `/folders/<id>` y `?id=<id>`. Requiere que la carpeta esté compartida como "Cualquiera con el enlace".
  - **B4** (`da896e1`): `notifications.js` nuevo módulo `Notifications`. Campana en header global (entre badge de conexión y user dropdown) con badge numérico (0–99+). Dropdown 380px con últimas 20 notifs del rol/usuario. Polling 30s + refresh on focus/visibilitychange. Click en notif → marca leída + navega al deep link. Botón "Marcar todas leídas" cuando hay no leídas. Estilos inyectados en `<head>` sin tocar `style.css`. Cargado antes de `app.js` en `index.html` (v=4).
  - **B5** (`8a97ef2`): Tab "Novedades" en ficha proyecto (entre Archivos Drive y Cotización origen). Stats chips (pendientes/resueltas) + botón "+ Nueva novedad". Modal con tipo (6 valores), prioridad (3 niveles), mensaje libre y toggle "Avisar a taller". Cada item lista autor, fecha relativa, mensaje, acciones (marcar resuelta / reabrir / toggle visible_para_taller / eliminar) con permisos por autor + admin. Border-left por prioridad. Soporte de deep-link `#proyectos/<id>?tab=novedades` — Router ahora strippea `?query` antes del match de ruta (no rompe rutas existentes).
- **Decisiones de arquitectura tomadas en Tanda 1**:
  - **Opción C (alcance estricto)** — solo se crearon las tablas que Tanda 1 realmente necesita. Las tablas `personas`, `vehiculos`, `cargas`, `carga_proyectos`, `carga_personas`, `asignaciones_evento` NO se crearon: ya existen las legacy (`rrhh_personal`, `logistica_vehiculos`, `logistica_movimientos`, `rrhh_asignaciones`) en BIGINT y los módulos `taller.js`/`logistica.js`/`rrhh.js` ya están enchufados a ellas. Tanda 2 decide migrar o extender.
  - **UUID en tablas nuevas** — coherente con `eventos`/`proyectos`/`profiles`/`clientes`. Las legacy BIGINT quedan como están.
  - **Notifications.leida_por como JSONB array de UUIDs** — permite que múltiples usuarios puedan leer la misma notif por target_role sin duplicar filas. El frontend actualiza optimistic.
  - **Encuesta evento creada ahora aunque sea Tanda 3** — para no tener que tocar schema después.
- **Refactor mayor reciente — Módulo Costos (F.1 a F.11)**:
  - F.1: Insumos integran `tipo_amortizacion` + overrides (VU/desp/reac).
  - F.2: Recetas integran RPC `calcular_receta`, MO en minutos, snapshots.
  - F.3: Tab Parámetros editable.
  - F.4: Listas de Precio read-only con split visual y export PDF (3 modos).
  - F.5: Subalquilado con fórmula simple `costo × (1 + margen)`. Sin markup.
  - F.6: Panel Insumos rediseñado al "idioma Recetas" (bloques consistentes).
  - F.7: Limpieza legacy (botón Ajuste masivo, `parametros-globales.js` viejo, `_renderCascadaBlock` shim, etc).
  - F.8: Margen propio por item (override del global `pct_margen_default`).
  - F.9: Bug proveedor UUID (era integer en DB, ahora UUID) + búsqueda accent-insensitive global (12 archivos).
  - F.10: Panel Recetas rediseñado (header editable inline, snapshot colapsable, resultado compacto, notas, eliminar, recalcular naranja con animación).
  - F.11: VU armado "duro" (regla 1:N) + breakdown visual de la fórmula.
- **Otros refactors importantes**:
  - Sistema undo/redo completo con soft delete.
  - Sidebar editor con drag & drop.
  - Calendario operativo V2 con card view.
  - Modulo eventos V1 completo.
  - Panel de control admin.
  - Integracion La PyME V4.
- *(La lista de SQLs a ejecutar y los Pendientes próximos están ahora en la sección Tanda 3+ arriba, actualizadas con los nuevos archivos. Ver §10 al inicio.)*
