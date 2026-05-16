# LOBBY MEPEX — Sistema de Gestion Integral

> SPA de gestion interna para MEPEX. Puerta de entrada a todos los modulos del ecosistema.

**Stack:** Vanilla JS (ES6+) SPA, hash routing, Supabase (DB + Auth), deploy estatico (sin build step)
**Carpeta local:** `C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX`
**IMPORTANTE:** Estamos en Windows 11. NUNCA usar comandos Linux (ls, cat, grep, rm). Siempre usar Windows (dir, type, findstr, del, copy).

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
- **NO hay backend propio, NO Railway, NO Express** — todo es client-side contra Supabase
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
├── sql/
│   ├── calendario_operativo_v2.sql  # Schema eventos con fases operativas
│   ├── pipeline_comercial.sql       # Schema pipeline + seguimientos + KPIs
│   ├── v4_pyme_integration.sql      # Integracion La PyME API
│   └── fix_rls_authenticated.sql    # Fix de RLS policies
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
| **Finanzas** | `modules.js` | Pendiente | Estructura registrada, sin funcionalidad |
| **RRHH** | `modules.js` | Pendiente | Estructura registrada, sin funcionalidad |
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
| `audit_logs` | Registro de auditoria del sistema |

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
7. **Actualizar "Estado actual" al final de cada sesion.**
8. **Interfaces de rol Taller = ultra simples.**
9. **NUNCA usar comandos Linux.** Solo Windows (type, dir, findstr, del, copy).
10. **Fede = superadmin del sistema.**
11. **Supabase es la fuente de verdad.** localStorage es para preferencias UI, no datos de negocio.
12. **SQL migrations en `/sql/`.** Documentar cambios de schema.
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
| `docs/CLAUDE.md.old` | Version anterior de CLAUDE.md (referencia historica) |

---

## 10. ESTADO ACTUAL

- **Fecha:** 2026-05-16
- **Ultimo commit destacado:** Tanda 3 completa (RRHH→personas + encuesta NPS + triggers completitud + cargas en calendario)
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
- **Bugs conocidos**:
  - Columnas rotadas en tabla `clientes` (mapeado en `api.js` como workaround).
  - Las tablas legacy `logistica_vehiculos` y `logistica_movimientos` referencian `eventos(id)` / `proyectos(id)` como BIGINT pero esas PK son UUID. Tanda 2 lo evita usando las tablas nuevas en UUID; la limpieza de las legacy queda para Tanda 3.
  - Ninguno otro reportado.
- **Pasos manuales pendientes (no automatizables vía SQL)**:
  1. Ejecutar `sql/taller_logistica_v2.sql` en Supabase SQL Editor (schema operativo Tanda 2).
  2. `sql/storage_remitos.sql` (crea bucket `remitos` via INSERT + policies — todo en uno, idempotente).
  3. `sql/taller_checklist_v2.sql` (tabla checklist UUID).
  4. `sql/rrhh_to_personas_migration.sql` (Tanda 3.A — expande personas + copia rrhh_personal → personas).
  5. `sql/completitud_triggers.sql` (Tanda 3.C — triggers + backfill completitud_pct).
- **Pendientes próximos** (orden recomendado):
  1. **Tanda 4 (planeada)**: revisión UI/UX integral con foco en móvil y tablet. Auditoría módulo por módulo con DevTools mobile preview (iPhone 12, iPad). Sidebar drawer en mobile, tablas → cards en mobile, tap targets 44px, modals fullscreen mobile, búsqueda como botón visible (no Ctrl+K), notif dropdown como bottom sheet, Calendario Operativo con vista alternativa mobile. Específicamente pensado para personal poco tech (taller). Ver `plan_tanda4_ui_review.md` en memoria.
  2. Cleanup de tablas legacy: `logistica_movimientos`, `logistica_vehiculos`, `rrhh_personal`, `rrhh_asignaciones`. Decidir qué migrar a esquema nuevo y qué borrar.
  3. Edge cases defensivos en Costos (items propios sin componentes, sin tipo_amortización, recetas circulares).
  4. Módulo de Costos Fijos mensuales + dashboard breakeven.
  5. Mejoras a la encuesta NPS: multi-pregunta, ratings por dimensión, envío automático por WhatsApp/email.
