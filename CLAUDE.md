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

## 7. INTEGRACIONES

### Supabase — Tablas principales
| Tabla | Uso |
|-------|-----|
| `profiles` | Usuarios: name, role, initials, active, custom_permissions |
| `clientes` | Base de clientes (NOTA: columnas rotadas — ver bug abajo) |
| `proyectos` | Proyectos por ano |
| `eventos` | Eventos feriales: fechas, venue, equipo, transporte, docs |
| `insumos_base` | Materias primas con costos, clasificacion, categoria |
| `catalogo_items` | Items fabricados con receta de insumos |
| `cotizaciones` | Cotizaciones del pipeline comercial |
| `pipeline_comercial` | Estados y seguimiento de cotizaciones |
| `audit_logs` | Registro de auditoria del sistema |

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
| `docs/CLAUDE.md.old` | Version anterior de CLAUDE.md (referencia historica) |

---

## 10. ESTADO ACTUAL

- **Fecha:** 2026-03-24
- **Ultimo commit:** `cfc1522` — fix: updateProfile resiliente a columnas faltantes en profiles
- **Commits recientes destacados:**
  - Sistema undo/redo completo con soft delete
  - Sidebar editor con drag & drop integrado
  - Calendario operativo V2 con card view
  - Modulo eventos V1 completo
  - Panel de control admin
  - Integracion La PyME V4
- **Bugs conocidos:**
  - Columnas rotadas en tabla `clientes` (mapeado en api.js como workaround)
  - Ninguno otro reportado
