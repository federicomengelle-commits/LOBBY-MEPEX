# MEPEX — Stack Técnico y Convenciones

> Referencia técnica para el Lobby MEPEX (Sistema de Gestión Integral). Define el stack, estructura de proyecto, convenciones de código y patrones reutilizables.

---

## Stack Principal

| Capa | Tecnología | Notas |
|------|-----------|-------|
| **Frontend** | Vanilla JS (ES6+) | SPA sin frameworks. Hash-based routing. ~24k líneas de código |
| **Base de datos** | Supabase (PostgreSQL) | Fuente de verdad. Client-side SDK via CDN |
| **Auth** | Supabase Auth | Login con email virtual (`user@mepex.local`), perfil en tabla `profiles` |
| **Fallback offline** | localStorage | Cache de sidebar state y preferencias. KPIs mock como fallback |
| **Fonts** | Google Fonts | Outfit, Space Mono, JetBrains Mono, Cabin |
| **Deploy** | Estático (sin build step) | HTML + JS + CSS servidos directamente |
| **Versionado** | Git + GitHub | Branch main |

### Cambios respecto al stack anterior
- **Supabase reemplazó a Notion API** como fuente de verdad
- **No hay servidor Express** — todo es client-side contra Supabase
- **No se usa jsPDF** — el proyecto evolucionó de Stand Presenter a Sistema de Gestión
- **No hay carpeta `server/`** — eliminada al migrar a Supabase

---

## Estructura del Proyecto

```
LOBBY-MEPEX/
├── index.html              # Entry point — SPA container, carga Supabase CDN + scripts
├── style.css               # Estilos principales (~8000 líneas, importa MEPEX_COMPONENTS.css)
├── MEPEX_COMPONENTS.css    # CSS base reutilizable (tokens legacy, reset, componentes base)
│
├── config.js               # Credenciales Supabase (URL + anon key), crea supabaseClient
├── api.js                  # API client contra Supabase (~2000 líneas): CRUD clientes, proyectos, eventos, insumos, catálogo, cotizaciones, KPIs, search global, pipeline comercial, La PyME integration
├── data.js                 # Definiciones estáticas: módulos, secciones, roles, permisos, categorías, acciones rápidas, indicadores mock, buscador local
├── router.js               # SPA router hash-based con guards de auth y permisos por rol
├── auth.js                 # Supabase Auth: login/logout/session restore, perfiles, RBAC
│
├── components.js           # Componentes UI reutilizables: Toast, Modal, ContextMenu, Confirm, FormBuilder
├── app.js                  # App Shell: header global + sidebar + search global + connection badge
├── lobby.js                # Vista Lobby: KPIs reales, mini calendario, bloques de categorías, actividad reciente
├── calendar.js             # Calendario global: grilla mensual CSS, filtros por tipo, panel de detalle
├── calendario-operativo.js # Timeline vertical operativo: carriles por evento, fases (armado/func/desarme), zoom, filtros
├── eventos.js              # Módulo Eventos: tabla + vista cards + side panel ficha con secciones editables
├── modules.js              # Renderer genérico de módulos (~7100 líneas): tablas, fichas, CRUD, filtros, sort, insumos, catálogo, pipeline comercial
├── settings.js             # Pantallas: Mi Perfil, Usuarios y Roles (admin), Notificaciones
├── admin-panel.js          # Panel de Control admin: métricas, tabla usuarios, audit log feed
│
├── assets/
│   ├── logo_full.png       # Logo MEPEX completo horizontal
│   ├── mepex_iso.png       # Isotipo X (favicon)
│   └── COLORES MEPEX.png   # Paleta de referencia
│
├── sql/
│   ├── calendario_operativo_v2.sql  # Schema para eventos con fases operativas
│   ├── pipeline_comercial.sql       # Schema pipeline + seguimientos + KPIs
│   ├── v4_pyme_integration.sql      # Integración La PyME API
│   └── fix_rls_authenticated.sql    # Fix de RLS policies
│
├── CLAUDE.md               # Contexto principal para Claude Code
├── MEPEX_BRAND.md          # Guía de marca visual (este ecosistema)
├── MEPEX_STACK.md          # Este archivo
├── MEPEX_CLAUDE.md         # Contexto adicional
├── BRIEF_VISUAL_STYLES.md  # Brief de estilos visuales
├── deploy.md               # Instrucciones de deploy
└── *.md                    # Blueprints de módulos (eventos, ventas, calendario, admin, etc.)
```

---

## Orden de Carga de Scripts

```html
<!-- En index.html, el orden es crítico: -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>  <!-- Supabase SDK -->
<script src="config.js"></script>       <!-- 1. Credenciales, crea supabaseClient -->
<script src="api.js"></script>          <!-- 2. API wrapper (usa supabaseClient) -->
<script src="data.js"></script>         <!-- 3. Datos estáticos, módulos, roles -->
<script src="router.js"></script>       <!-- 4. Router (usa Auth, App) -->
<script src="auth.js"></script>         <!-- 5. Auth (usa supabaseClient, Data) -->
<script src="components.js"></script>   <!-- 6. UI components (Toast, Modal, etc.) -->
<script src="lobby.js"></script>        <!-- 7. Vista Lobby -->
<script src="calendar.js"></script>     <!-- 8. Calendario global -->
<script src="calendario-operativo.js"></script>  <!-- 9. Timeline operativo -->
<script src="eventos.js"></script>      <!-- 10. Módulo Eventos -->
<script src="settings.js"></script>     <!-- 11. Perfil, Admin usuarios -->
<script src="admin-panel.js"></script>  <!-- 12. Panel de Control -->
<script src="modules.js"></script>      <!-- 13. Renderer genérico de módulos -->
<script src="app.js"></script>          <!-- 14. App Shell + bootstrap -->
```

---

## Tablas Supabase

| Tabla | Uso |
|-------|-----|
| `profiles` | Usuarios del sistema: name, role, initials, active, custom_permissions |
| `clientes` | Base de clientes (columnas rotadas: ver nota abajo) |
| `proyectos_2026` | Proyectos por año |
| `eventos_2026` | Eventos feriales: fechas, venue, equipo, transporte, docs |
| `insumos_base` | Materias primas con costos, clasificación, categoría |
| `catalogo_items` | Items fabricados con receta de insumos |
| `cotizaciones` | Cotizaciones del pipeline comercial |
| `pipeline_comercial` | Estados y seguimiento de cotizaciones |
| `audit_logs` | Registro de auditoría del sistema |

### Bug conocido: columnas rotadas en `clientes`
```
columna 'rubro'               → contiene teléfonos
columna 'telefono'            → contiene emails
columna 'correo_electronico'  → contiene rubros
```
El mapeo se maneja en `api.js` al hacer el fetch.

---

## Convenciones de Código

### JavaScript

- **Objetos globales como módulos.** Cada archivo exporta un objeto global: `API`, `Auth`, `Router`, `App`, `Data`, `Lobby`, `Modules`, `Settings`, `Calendar`, `CalendarioOperativo`, `EventosModule`, `AdminPanel`, `Toast`, `Modal`, `ContextMenu`, `Confirm`, `FormBuilder`
- **Naming:** camelCase para funciones y variables, PascalCase para objetos globales/módulos
- **Propiedades privadas:** prefijo `_` para estado interno (`_sortCol`, `_activePanel`, `_cache`, etc.)
- **Lifecycle:** cada módulo tiene un método `render()` que recibe nada y renderiza en `#mainContent`
- **Eventos:** `addEventListener`, nunca inline `onclick` en HTML
- **Async/await** para todas las llamadas a Supabase
- **Template literals** para generar HTML (no JSX, no template engines)
- **Estado local por módulo:** cada módulo mantiene su propio state en propiedades del objeto

```javascript
// Patrón estándar de módulo
const MiModulo = {
    // State
    _items: [],
    _sortCol: 'name',
    _sortDir: 'asc',
    _searchQuery: '',

    // Lifecycle
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        const content = document.getElementById('mainContent');
        if (!content) return;
        content.innerHTML = this._buildHTML();
        await this._loadData();
        this._attachEvents();
    },

    // Private methods
    _buildHTML() { return `<div>...</div>`; },
    async _loadData() { this._items = await API.getItems(); },
    _attachEvents() { /* addEventListener calls */ },
};
```

### Patrón API (api.js)

```javascript
const API = {
    isConnected: false,
    _cache: {},
    _cacheTimeout: 60000, // 1 min

    async checkConnection() {
        const { count, error } = await supabaseClient
            .from('clientes')
            .select('*', { count: 'exact', head: true });
        this.isConnected = !error;
        return this.isConnected;
    },

    async getClients() {
        // Check cache
        const cached = this._cache['clients'];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) return cached.data;
        // Fetch from Supabase
        const { data, error } = await supabaseClient
            .from('clientes').select('*').order('nombre_empresa');
        if (error) throw error;
        // Map columns + cache
        const mapped = data.map(row => ({ /* mapeo */ }));
        this._cache['clients'] = { data: mapped, ts: Date.now() };
        return mapped;
    },
};
```

### Patrón Auth

```javascript
const Auth = {
    _profile: null,

    async login(username, password) {
        const email = username + '@mepex.local';
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) return { success: false, error: 'Usuario o contraseña incorrectos' };
        const profile = await this._fetchProfile(data.user.id);
        this._profile = profile;
        return { success: true, user: profile };
    },

    getUser() { return this._profile; },
    isAuthenticated() { return this._profile !== null; },
    hasAccess(moduleId) {
        const allowed = this._profile?.customPermissions || Data.rolePermissions[this._profile?.role] || [];
        return allowed.includes(moduleId);
    },
    isSuperAdmin() { return this._profile?.role === 'superadmin'; },
    isAdminLevel() { return ['superadmin', 'admin'].includes(this._profile?.role); },
};
```

### Patrón Router

```javascript
const Router = {
    routes: {},
    shellRendered: false,

    async init() {
        this.routes = {
            'login': { render: () => Auth.renderLogin(), requiresAuth: false },
            'lobby': { render: () => Lobby.render(), requiresAuth: true },
            'ventas': { render: () => Modules.render('ventas'), requiresAuth: true, module: 'ventas' },
            // ...
        };
        window.addEventListener('hashchange', () => this.handleRoute());
        await Auth.restoreSession();
        this.handleRoute();
    },

    handleRoute() {
        // Auth guard → role guard → render shell → render route → update sidebar
    },

    navigate(hash) { window.location.hash = '#' + hash; },
    getHash() { return window.location.hash.replace('#', ''); },
};
```

### CSS

- **Variables CSS** para todos los colores y tokens (ver MEPEX_BRAND.md)
- **Dos capas:** `MEPEX_COMPONENTS.css` (base) + `style.css` (override con nuevo sistema visual)
- **Tema oscuro siempre.** No implementar modo claro
- **Grid + Flexbox** para layouts
- **Desktop-first** (herramienta interna usada en escritorio)
- **Clases descriptivas:** `.ev-wrapper`, `.co-toolbar`, `.lobby-cat-block`, `.sidebar-nav-link`
- **Prefijos por módulo:** `ev-` (eventos), `co-` (calendario operativo), `cal-` (calendar)
- **No BEM estricto** pero nombres claros y consistentes

### HTML

- **SPA con un solo `#app`** que contiene todo
- **App Shell:** header global + sidebar + `#mainContent`
- **Scripts al final** del body, antes de `</body>`
- **SVG inline** para iconos funcionales
- **Emojis** para iconos de módulos en data.js

---

## Componentes Reutilizables (components.js)

| Componente | API | Uso |
|------------|-----|-----|
| `Toast` | `.success(msg)`, `.error(msg)`, `.warning(msg)`, `.info(msg)` | Notificaciones temporales con progress bar |
| `Modal` | `.open({ title, body, size, footer })`, `.close(id)`, `.confirm({ title, message, danger })` | Modales con stack, ESC, click outside |
| `ContextMenu` | `.show(x, y, items)`, `.close()` | Menú contextual posicional, mobile bottom sheet |
| `Confirm` | `.delete(entityName)`, `.action(title, message)` | Confirmaciones con danger mode |
| `FormBuilder` | `.render(fields, values)`, `.getValues(form)`, `.validate(form, fields)` | Forms dinámicos con validación |

---

## Roles y Permisos

| Rol | Módulos | Usuarios |
|-----|---------|----------|
| `superadmin` | Todos + Panel de Control | Fede |
| `admin` | Todos + Usuarios y Roles | Lelean, Sofi |
| `venta` | Ventas, Clientes, Proyectos, Eventos, Producción, Inventario | Noe |
| `pm` | Proyectos, Eventos, Clientes, Producción, Inventario | Meli, Leo |
| `taller` | Proyectos, Eventos, Producción | Diego, Juan, Carlos, Willy |

Los permisos se definen en `Data.rolePermissions` y se pueden personalizar por usuario via `customPermissions` en la tabla `profiles`.

---

## Integraciones Externas

| Servicio | Estado | Detalle |
|----------|--------|---------|
| **La PyME API** | V4 (implementando) | `api.lapyme.com.ar` — facturación, ventas, clientes. Match by customer.name |
| **Cotizador MEPEX** | Externo | `cotizador-mepex.vercel.app` — link externo desde acciones rápidas |

---

## Reglas Generales

1. **Trabajo acertado > velocidad.** Planificar antes de codear. Plan mode en Claude Code.
2. **No romper lo que funciona.** Cambios quirúrgicos, testear antes y después.
3. **Supabase es la fuente de verdad.** localStorage es para preferencias UI, no datos de negocio.
4. **Simplicidad en la UI.** El equipo incluye personas de edad media/avanzada y poco tech. Interfaces extremadamente intuitivas.
5. **Branding estricto.** Dark theme, turquesa `#00A9C1`, Outfit + Space Mono.
6. **5 niveles de usuario:** superadmin (todo + panel de control), admin (todo + gestión usuarios), venta (comercial + operaciones), pm (proyectos + operaciones), taller (ejecución simple).
7. **SQL migrations en `/sql/`.** Documentar cambios de schema.
8. **Mapeo de columnas.** El bug de columnas rotadas en `clientes` se maneja en `api.js`, no se corrige en Supabase.
