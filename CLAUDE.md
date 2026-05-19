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
- **Casi todo es client-side contra Supabase.** Excepción: hay un proxy HTTP Node corriendo en VPS `195.200.1.250:3000` para integraciones que requieren server-side (certificados X.509, secrets). Hoy expone `/api/lapyme/facturar`. En Fase D se sumará `/api/arca/facturar`.
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
├── modules.js              # Renderer generico de modulos (~7100 lineas): tablas, fichas, CRUD
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

### Orden de carga de scripts (critico)
```
1. Supabase SDK (CDN)
2. config.js       → crea supabaseClient
3. api.js          → usa supabaseClient
4. data.js         → datos estaticos
5. router.js       → usa Auth, App
6. auth.js         → usa supabaseClient, Data
7. components.js   → Toast, Modal, etc.
8. sidebar-editor.js → SidebarEditor
9. undo.js         → UndoManager, UndoUI, UndoHelpers
10. lobby.js       → vista Lobby
11. calendar.js    → calendario global
12. calendario-operativo.js → timeline operativo
13. eventos.js     → modulo Eventos
14. settings.js    → perfil, admin usuarios
15. admin-panel.js → panel de control
16. modules.js     → renderer generico
17. app.js         → bootstrap (App.init → Router.init)
```

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

### Cotizador MEPEX
- **Estado:** Produccion
- **URL:** `cotizador-mepex.vercel.app`
- Link externo desde acciones rapidas del sidebar
- App separada (Vanilla JS + Notion + jsPDF + Railway)

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
| `docs/CLAUDE.md.old` | Version anterior de CLAUDE.md (referencia historica) |

---

## 10. ESTADO ACTUAL

- **Fecha:** 2026-05-19 (sesión extensa, parte 5)
- **Ultimo commit destacado:** *pendiente de commit en este worktree* — Fase E (multi-moneda) implementada.
- **Próximo paso:** Fede ejecuta `sql/fix_trigger_asiento_auto.sql` **+** `sql/finanzas_fase_e_multimoneda.sql` en Supabase, hace pull en VPS para versiones `api.js?v=21` + `finanzas.js?v=14`, prueba cargar un ingreso USD en prod. Luego **Fase G (reportes) → H (saldos apertura 2027) → F (conciliación) → D (ARCA, bloqueado por trámite cert)**.

- **Sesión 2026-05-19 (parte 5) — Fase E (multi-moneda) implementada**:
  - **SQL** (`sql/finanzas_fase_e_multimoneda.sql`, idempotente):
    - **E1** ALTER de 8 tablas con `moneda TEXT NOT NULL DEFAULT 'ARS' CHECK IN (ARS, USD, EUR)`, `cotizacion NUMERIC(15,4) NOT NULL DEFAULT 1 CHECK > 0`, `total_en_ars NUMERIC(15,2)`. Tablas afectadas: `cuentas_financieras` (solo `moneda`), `ingresos`, `egresos`, `comprobantes`, `comprobantes_recibidos`, `comprobantes_iva_recovery`, `asientos` (solo `moneda`+`cotizacion` informativos), `transferencias_internas`.
    - **E2** función `fn_calcular_total_ars(monto, moneda, cotizacion)` — IMMUTABLE. Convención: cotización = ARS por 1 unidad de moneda extranjera. Si moneda=ARS → devuelve monto. Si cotización inválida → fallback al monto (defensivo).
    - **E3** triggers BEFORE INSERT/UPDATE en las 6 tablas con monto/total: `fn_snapshot_total_ars_monto` (ingresos/egresos/transferencias) y `fn_snapshot_total_ars_total` (comprobantes/comprobantes_recibidos/comprobantes_iva_recovery). Fuerzan `moneda='ARS' ⇒ cotizacion=1` y materializan `total_en_ars`. Backfill incluido para filas existentes (todas en ARS).
    - **E4** seed idempotente de cuentas `4.2.02 Diferencia de cambio positiva` (resultado_positivo, acreedora) y `5.4.02 Diferencia de cambio negativa` (resultado_negativo, deudora) en `plan_cuentas` — crea también padres `4`, `4.2`, `5`, `5.4` si no existen. Mapeos `dif_cambio_positiva` y `dif_cambio_negativa` en `mapeo_cuentas`.
    - **E5** **`fn_asiento_auto_ingreso`/`egreso` actualizados**: el asiento contable SIEMPRE usa `total_en_ars` (la contabilidad va en ARS). Si moneda ≠ ARS, se agrega nota informativa al concepto del asiento (`[USD 100 @ 1420]`). El asiento guarda `moneda` y `cotizacion` para auditoría.
    - **E6** helper `fn_registrar_diferencia_cambio(p_ingreso_id, p_monto_ars, p_actor)` — genera asiento tipo='manual' con líneas debe/haber contra la cuenta de diferencia según signo. **No se invoca automáticamente** desde los triggers — pensado para que el JS lo llame manualmente cuando aplica un cobro a una factura USD con cotización distinta. Caso completo (cobro USD → factura USD con cotización vieja → ajuste automático) queda para Fase G.
    - **E7** índices parciales en `moneda` (filtran ARS) para tablas con mayor volumen.
  - **API** (`api.js?v=21`, agregado al final): `MONEDAS_DISPONIBLES` (ARS/USD/EUR con flag+label+symbol), `formatMontoMoneda`, `getCotizacionSugerida(moneda)` (fetch a `https://dolarapi.com/v1/dolares/oficial` y `/v1/cotizaciones/eur`, cache 1h en memoria, devuelve null si falla), `calcularTotalArs(monto, moneda, cotizacion)` (cálculo client-side sin pegarle a la BD), `registrarDiferenciaCambio(ingresoId, montoArs)` (wrapper de RPC), `getMovimientosExtranjeros(tabla, filtros)`. La función `createComprobanteIvaRecovery` ahora propaga `moneda`+`cotizacion`.
  - **UI** (`finanzas.js?v=14`): 3 helpers nuevos del módulo Finanzas:
    - `_renderMonedaFields(prefix, item)` devuelve HTML con select moneda + input cotización + chip equivalente. Genera IDs `<prefix>FormMoneda`, `<prefix>FormCotizacion`, `<prefix>FormCotGroup`, `<prefix>FormEquivalente`, `<prefix>FormEquivalenteVal`. **Si moneda=ARS la cotización y el equivalente quedan ocultos** (no clutter visual para el 95% de los casos).
    - `_attachMonedaListeners(prefix, montoFieldId?)` setea listeners para: cambio de moneda → sugerencia automática de cotización vía `API.getCotizacionSugerida`; botón manual "🔄 Sugerir"; live preview del equivalente al tipear monto/cotización. `montoFieldId` permite usar un input de monto custom (ej. Total en lugar de Monto para comprobantes).
    - `_readMonedaFields(prefix)` devuelve `{ moneda, cotizacion, error }` para validación pre-submit.
  - **Modales actualizados con el bloque de moneda**:
    - `_showCuentaModal`: selector simple de moneda nativa (sin cotización; es atributo permanente de la cuenta). Aviso "inmutable post-creación".
    - `_showIngresoModal` + `_showEgresoModal`: bloque completo, helper `_attachMonedaListeners` con auto-sugerir.
    - `_showTransferModal`: **especial** — la moneda se deriva automáticamente de la cuenta origen. Si origen y destino tienen monedas distintas, warning rojo + bloqueo del botón Transferir ("usar ingreso/egreso por separado, no se soporta cambio cambiario"). Cotización pedida solo si moneda ≠ ARS.
    - `_showRecibidoModal` (comprobantes recibidos): `_attachMonedaListeners('finRec', 'finRecFormTotal')` — usa Total como base, no Monto.
    - `_showIvarModal` (IVA recovery): mismo patrón con `_attachMonedaListeners('ivar', 'ivarTot')`.
  - **Tablas con chip de moneda**: en `_renderIngresosTable` y `_renderEgresosTable` el chip naranja `USD`/`EUR` aparece al lado del monto cuando moneda ≠ ARS. Tooltip muestra cotización y equivalente ARS. Tablas en ARS no muestran nada (limpio).
  - **Verificación local** (preview node server, `localhost:3000`): el modal renderea OK con los 3 IDs nuevos, el listener de cambio de moneda dispara la sugerencia de dolarapi.com (USD oficial $1420 al 2026-05-19), el equivalente se calcula en vivo ($142.000 ARS para USD 100 @ 1420), `_readMonedaFields` devuelve los valores correctos. Screenshot validado.
  - **Decisiones de arquitectura tomadas en esta fase**:
    - **`total_en_ars` materializado por trigger, no calculado en VIEW**: snapshot persistente. Si en el futuro cambiamos la cotización del día, los movimientos viejos NO se recalculan automáticamente. Esto es deseado (snapshot al momento del hecho económico).
    - **Cotización por movimiento, no global por día**: cada ingreso/egreso/factura guarda su cotización propia. Permite registrar tres cobros del mismo día con cotizaciones distintas (caso "MEP del banco" vs "blue del cliente").
    - **dolarapi.com como fuente sugerida**: API pública argentina, sin auth, free. BCRA WS requiere certificado X.509 (overkill para una sugerencia). El usuario puede ignorar la sugerencia y tipear a mano.
    - **Transferencias NO soportan conversión**: si origen y destino son cuentas en monedas distintas, hay que registrar ingreso+egreso por separado con cotizaciones explícitas. Forzar conversión en una transferencia "interna" oculta la operación cambiaria.
    - **Diferencia de cambio NO automática en esta fase**: el caso end-to-end (factura USD → cobro USD a cotización distinta → ajuste por diferencia) requiere un flujo bidireccional comprometido con Fase C (plan de pagos avanzado) y Fase D (ARCA, que conoce las cotizaciones AFIP). El helper `fn_registrar_diferencia_cambio` queda disponible para que el JS lo llame manualmente. Automatización en Fase G.
  - **Pendientes inmediatos al pasar el SQL a prod**:
    1. Ejecutar primero `sql/fix_trigger_asiento_auto.sql` (sigue siendo pre-requisito de la sesión parte 4).
    2. Ejecutar después `sql/finanzas_fase_e_multimoneda.sql`.
    3. Verificar NOTICES: las 8 ALTER tablas deberían terminar con `[Fase E]` y las cuentas 4.2.02 / 5.4.02 creadas.
    4. Smoke test: crear un ingreso USD 100 a cotización 1420 → confirmar → el asiento contable resultante debe tener `total_debe = total_haber = 142000` y el concepto incluir `[USD 100 @ 1420]`.
    5. Pull en VPS para `api.js?v=21` + `finanzas.js?v=14`.
  - **Cosas conocidas a mejorar en próximas fases**:
    - Plan de pagos en moneda extranjera: hoy `plan_cobro.total_plan` es NUMERIC sin moneda. Heredar moneda de la cotización origen requiere ALTER + lógica de aplicación de cobros.
    - Vencimientos recurrentes en moneda extranjera (alquiler USD): mismo caso.
    - Listado consolidado de movimientos extranjeros en un nuevo subtab del módulo Finanzas — la API `getMovimientosExtranjeros` ya está lista, falta la UI.
    - Selector de moneda en wizard de Facturación (comprobantes emitidos): el modal de emisión vive en otro lado (probablemente `_showComprobanteModal` o equivalente para La PyME). Pendiente para cuando esté Fase D (ARCA) — La PyME hoy solo soporta ARS de todos modos.

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
