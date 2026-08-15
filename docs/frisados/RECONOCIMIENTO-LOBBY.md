# RECONOCIMIENTO LOBBY-MEPEX

> Reporte de reconocimiento **READ-ONLY** del estado actual del proyecto.
> Generado: 2026-06-07
>
> **Branch:** El branch `rediseno-modulos` indicado en la tarea NO existe (ni local ni remoto). Branches presentes: `main`, `origin/main`, `origin/claude/sad-poitras-2ed060`. Reconocimiento realizado sobre `main` @ 7c498b8 (== origin/main, working tree limpio).
> Patron canonico de referencia: `inventario.js`. SPA vanilla JS (ES6+) + Supabase, hash routing, dark theme.

---

## 1. Mapa de navegacion

### 1.1 Rutas registradas (router.js)

Rutas definidas en `Router.routes` (router.js:71-111). El render real lo hace cada objeto global; **ninguna ruta delega al renderer generico `modules.js` con un "type"** — `modules.js` solo se usa para `_openCreateModal` desde acciones rapidas. Las rutas con `module:` pasan por `Auth.hasAccess(module)`; las marcadas `superadminOnly`/`adminOnly` por `Auth.isSuperAdmin()`/`Auth.isAdminLevel()`.

| hash | modulo / objeto global | archivo JS | guard de auth/rol |
|------|------------------------|------------|-------------------|
| `login` | `Auth.renderLogin()` | auth.js | `requiresAuth: false` |
| `lobby` | `Lobby.render()` | lobby.js | `requiresAuth` + restringido a `superadmin`/`admin` (otros roles → su default, router.js:187-193) |
| `calendario` | `CalendarioOperativo.render()` | calendario-operativo.js | `requiresAuth` (sin `module`, accesible a todo autenticado) |
| `perfil` | `Settings.renderProfile()` | settings.js | `requiresAuth` |
| `admin-panel` | `AdminPanel.render()` | admin-panel.js | `requiresAuth` + `superadminOnly` |
| `notificaciones` | `Settings.renderNotifications()` | settings.js | `requiresAuth` |
| `crm` | `CRM.render()` | crm.js | `requiresAuth` + `module: 'crm'` |
| `cotizador` | `Router._openExternal('http://195.200.1.250/cotizador/')` | router.js (abre externo) | `requiresAuth` + `module: 'cotizador'` |
| `catalogo` | `CatalogoModule.render()` | catalogo.js | `requiresAuth` + `module: 'catalogo'` |
| `proyectos` | `ProyectosModule.render()` | proyectos.js | `requiresAuth` + `module: 'proyectos'` |
| `proyectos/:id` | `ProyectoDetalle.render(params.id)` | proyecto-detalle.js | `requiresAuth` + `module: 'proyectos'` (ruta dinamica, match por regex router.js:148-160) |
| `eventos` | `EventosModule.render()` | eventos.js | `requiresAuth` + `module: 'eventos'` |
| `taller` | `TallerModule.render()` | taller.js | `requiresAuth` + `module: 'taller'` |
| `logistica` | `LogisticaModule.render()` | logistica.js | `requiresAuth` + `module: 'logistica'` |
| `rrhh` | `RRHHModule.render()` | rrhh.js | `requiresAuth` + `module: 'rrhh'` |
| `compras` | `ComprasModule.render()` | compras.js | `requiresAuth` + `module: 'compras'` |
| `inventario` | `InventarioModule.render()` | inventario.js | `requiresAuth` + `module: 'inventario'` |
| `locaciones` | `LocacionesModule.render()` | locaciones.js | `requiresAuth` + `module: 'locaciones'` |
| `contabilidad` | `ContabilidadModule.render()` | contabilidad.js | `requiresAuth` + `module: 'finanzas'` (comparte permiso con finanzas) |
| `finanzas` | `FinanzasModule.render()` | finanzas.js | `requiresAuth` + `module: 'finanzas'` |
| `costos` | `CostosModule.render()` | costos.js | `requiresAuth` + `module: 'costos'` + `adminOnly` |
| `parametros-globales` | redirige: setea `CostosModule._activeTab='params'` → `navigate('costos')` | router.js (deprecado) | `requiresAuth` + `adminOnly` |

**Redirects** (rutas viejas → nuevas, `Router._redirects`, router.js:17-23): `ventas`→`crm`, `clientes`→`crm`, `proveedores`→`compras`, `produccion`→`taller`, `admin-usuarios`→`admin-panel`.

**Manejo de `?query`**: router.js:135-136 strippea todo lo posterior a `?` antes del match; el modulo destino puede leer `location.hash` para recuperar el query (deep-links de Notifications).

**Ruta desconocida**: si autenticado → `getDefaultRoute(user)`; si no → `login` (router.js:163-171). Defaults por rol (`_defaultRoutes`, router.js:28-34): superadmin/admin→`lobby`, venta→`crm`, pm→`proyectos`, taller→`eventos`.

### 1.2 Orden de carga de `<script>` (index.html)

Antes de los scripts propios se cargan, en el `<head>`: Supabase SDK (`@supabase/supabase-js@2`, CDN sin versión propia). En el `<body>` (antes de los módulos): jsPDF (`jspdf 2.5.1`) y jsPDF-autotable (`3.5.31`). Chart.js (`4.4.1`) se carga inline entre `costos.js` y `contabilidad.js`.

Orden de los `<script src>` propios (index.html:41-75):

1. `config.js?v=4`
2. `api.js?v=24`
3. `data.js?v=6`
4. `router.js?v=7`
5. `auth.js?v=4`
6. `audit-log.js?v=2`
7. `components.js?v=6`
8. `sidebar-editor.js?v=4`
9. `undo.js?v=3`
10. `badges.js?v=2`
11. `lobby.js?v=4`
12. `calendar.js?v=3`
13. `calendario-operativo.js?v=8`
14. `eventos.js?v=7`
15. `proyectos.js?v=3`
16. `proyecto-detalle.js?v=4`
17. `crm.js?v=11`
18. `catalogo.js?v=4`
19. `remito-pdf.js?v=3`
20. `taller.js?v=6`
21. `logistica.js?v=11`
22. `compras.js?v=2`
23. `inventario.js?v=6`
24. `locaciones.js?v=1`
25. `rrhh.js?v=6`
26. `calculo-receta.js?v=1`
27. `costos.js?v=29`
28. *(CDN inline)* Chart.js 4.4.1
29. `contabilidad.js?v=12`
30. `finanzas.js?v=19`
31. `settings.js?v=4`
32. `admin-panel.js?v=6`
33. `modules.js?v=7`
34. `notifications.js?v=2`
35. `app.js?v=5`

Nota: el orden de carga **difiere** del documentado en CLAUDE.md sección 5 (hay archivos nuevos: `audit-log.js`, `badges.js`, `proyectos.js`, `proyecto-detalle.js`, `crm.js`, `catalogo.js`, `remito-pdf.js`, `taller.js`, `logistica.js`, `compras.js`, `inventario.js`, `locaciones.js`, `rrhh.js`, `calculo-receta.js`, `costos.js`, `contabilidad.js`, `finanzas.js`, `notifications.js`).

### 1.3 Construccion del sidebar

El menú lateral se construye en **`app.js`**, función **`App._renderSidebar(user)`** (app.js:184-324), llamada desde `App.renderShell()` (una vez post-login) y desde `App.refreshSidebar()` (re-render parcial sin tocar header/main).

Flujo:

1. **`SidebarEditor.init()`** (sidebar-editor.js:69-88) corre primero, dentro de `renderShell()` (app.js:50). Lee dos claves de **localStorage**:
   - `mepex_sidebar_config` → la estructura del menú (JSON serializado de `SidebarEditor._data`).
   - `mepex_sidebar_version` → versión guardada.
   - Si la versión guardada coincide con `SidebarEditor._configVersion` (**actualmente = 5**, sidebar-editor.js:67) y hay config, la usa. Si no coincide (cambio de estructura) o no hay config, **reconstruye desde `Data.categories`** vía `_buildDefaultFromData()` (sidebar-editor.js:95-130), persiste la versión y borra la config vieja.

2. **`Data.categories`** es el **default real / fuente de la estructura inicial**. `_buildDefaultFromData()` mapea cada categoría a una "section" del sidebar (id, label, icono por key vía `_guessIconKey`, color, e items derivados de `cat.modules` o de `cat.moduleIds` resolviendo cada módulo con `Data.getModuleById`). El emoji de cada item sale de `_extractEmoji(mod.icon)` (default `📄` si el icono es SVG).

3. **`App._renderSidebar`** toma la config con `SidebarEditor.getConfig()` (devuelve `_data`) y arma el HTML. **No usa `Data.categories` directamente para pintar**, solo a través de SidebarEditor. Filtra items por permisos del rol con `Data.rolePermissions[user.role]` (app.js:189, 198-201): `lobby` y `calendario` siempre visibles; el resto requiere estar en `allowed`. Genera dos vistas: el menú completo (`categoriesHtml`) y la tira colapsada con flyouts (`stripHtml`).

4. **Persistencia**: NO se guarda en Supabase. Todo en **localStorage por navegador**, clave `mepex_sidebar_config` (estructura) + `mepex_sidebar_version` (versión). Se escribe en `SidebarEditor._save()` (sidebar-editor.js:170-172) tras cada operación del editor (add/delete/rename/color/drag&drop).

5. **`sidebar-editor.js`** define el objeto `SidebarEditor`: estado del menú (`_data`), modo edición (drag & drop de secciones/items, rename inline en mayúsculas para secciones, color picker con 10 colores `SECTION_COLORS`, add/delete), su propio `UndoSystem` (stack en memoria, max 50), iconos de categoría (`CategoryIcons`) y de acciones (`EditorIcons`). El editor solo lo activan superadmin/admin (botón "Editar sidebar" en el footer, app.js:302-316; eventos de edición en `App._attachSidebarEvents`, app.js:446-505).

6. **`_configVersion`** existe (sidebar-editor.js:67, valor **5**). Bumpearlo fuerza el rebuild del sidebar en TODOS los navegadores en el próximo `init()` (por el mismatch de versión), descartando la config local previa. Es el mecanismo para propagar cambios de estructura del menú hechos en `data.js`.

### 1.4 Categorias actuales del menu

Categorías desde `Data.categories` (data.js:54-93), en orden, con los módulos que cuelga cada una (de `modules`/`moduleIds`). Nota: estos módulos se filtran luego por permisos de rol; `lobby` y `calendario` siempre se muestran.

- **PRINCIPAL** (id `principal`, color `#00A9C1`, `alwaysVisible`)
  - lobby

- **COMERCIAL** (id `comercial`, color `#F28D15`)
  - crm
  - cotizador
  - catalogo

- **OPERACIONES** (id `operaciones`, color `#00CC88`)
  - calendario
  - proyectos
  - eventos
  - taller
  - logistica

- **RECURSOS** (id `recursos`, color `#9B7DFF`)
  - compras
  - inventario
  - locaciones

- **ADMIN & FINANZAS** (id `admin`, color `#4A90D9`)
  - rrhh
  - finanzas
  - contabilidad
  - costos

Aclaración importante: estas son las categorías del **default en `data.js`**. Lo que cada navegador muestra realmente puede diferir si tiene una config guardada en `localStorage` (`mepex_sidebar_config`) con `mepex_sidebar_version == 5`. El menú efectivo solo coincide con esta lista en navegadores nuevos o tras un bump de `_configVersion`.

---


## 2. Roles y visibilidad

### 2.1 Roles existentes (auth.js)

Los roles base están definidos en `Data` (data.js) — **5 roles**: `superadmin`, `admin`, `venta`, `pm`, `taller`. Además, el sistema soporta roles personalizados creados desde el Panel de Control (tabla `roles` en Supabase), que se agregan a esa lista en runtime.

**Estructura del objeto que devuelve `getUser()`** (construido en `Auth._fetchProfile`, auth.js:154-167):

```javascript
{
    id: data.username,            // el username (no el UUID)
    name: data.name,
    role: data.role,              // string del rol (ej 'superadmin')
    initials: data.initials,
    uid: data.id,                 // el UUID real de Supabase
    customPermissions: data.custom_permissions || null,  // override por usuario
    active: data.active !== false,
    telefono: data.telefono || '',
    _rolePermissions: null,       // se llena desde tabla `roles` (JSONB { moduleId: "write"|"read"|"none" })
    _roleLabel: null,             // label del rol desde Supabase
    _roleColor: null,             // color del rol desde Supabase
}
```

`_rolePermissions`, `_roleLabel` y `_roleColor` se completan inmediatamente después con una segunda query a la tabla `roles` filtrando por `eq('id', data.role)` (auth.js:170-183). Si esa query falla, quedan en `null` y se usa el fallback de `Data`.

**Métodos relevantes de `Auth`:**

- `login(username, password)` — concatena `username + '@mepex.local'`, hace `signInWithPassword`, fetchea el perfil, valida que esté activo, registra audit log y actualiza `last_login_at`/`last_device`.
- `logout()` — registra logout, limpia `_profile`, cierra sesión Supabase, navega a login.
- `getUser()` — devuelve el perfil cacheado (`_profile`), sync.
- `isAuthenticated()` — `true` si hay perfil cacheado.
- `hasAccess(moduleId)` — `true` si `getAccessLevel(moduleId) !== 'none'`.
- `getAccessLevel(moduleId)` — devuelve `'write' | 'read' | 'none'`. **Es el corazón de la visibilidad** (ver 2.2/2.3 para su lógica de prioridad).
- `isSuperAdmin()` — `true` solo si `role === 'superadmin'`.
- `isAdminLevel()` — `true` si `role === 'superadmin' || role === 'admin'`.
- `restoreSession()` — al cargar la página: recupera sesión Supabase, refetchea perfil, y dispara `Data.loadRolesFromDB()` (fire-and-forget) para refrescar las caches de roles.
- `_fetchProfile(userId)` — query a `profiles` + query a `roles`, arma el objeto user.
- `changePassword(newPassword)` — `auth.updateUser({ password })` (solo del usuario actual).
- `getStartModule()` / `setStartModule(moduleId)` — preferencia de módulo de inicio en `localStorage` por usuario (`mepex_start_module_<uid>`), validando que el user siga teniendo acceso.
- `updateCachedProfile(updates)` — `Object.assign` sobre `_profile`.
- `renderLogin()` — renderiza la pantalla de login.

**NO existe** un método llamado `getRole()` ni `hasPermission()` en `Auth`. El rol se lee directo con `Auth.getUser().role` o `Auth._profile?.role`. El equivalente a "hasPermission" es `hasAccess(moduleId)` / `getAccessLevel(moduleId)`.

### 2.2 Visibilidad de módulos por rol

**SÍ existe control de visibilidad por rol.** La decisión vive en `Auth.getAccessLevel(moduleId)` (auth.js:84-105), con una **cadena de prioridad de 3 niveles**:

```javascript
getAccessLevel(moduleId) {
    const user = this.getUser();
    if (!user) return 'none';

    // 1) Custom per-user override (array of module IDs = write access)
    if (user.customPermissions) {
        return user.customPermissions.includes(moduleId) ? 'write' : 'none';
    }

    // 2) Supabase roles table cache (JSONB: { moduleId: "write"|"read"|"none" })
    if (user._rolePermissions) {
        const level = user._rolePermissions[moduleId];
        if (level === 'write' || level === 'read') return level;
        return 'none';
    }

    // 3) Fallback to Data.rolePermissions (offline / roles query failed)
    const allowed = Data.rolePermissions[user.role] || [];
    if (!allowed.includes(moduleId)) return 'none';
    const readOnly = Data.readOnlyPermissions[user.role] || [];
    return readOnly.includes(moduleId) ? 'read' : 'write';
}
```

Prioridad: **customPermissions del usuario → tabla `roles` de Supabase (`_rolePermissions`) → `Data.rolePermissions` (fallback offline)**.

El menú lateral filtra categorías/módulos con `Data.getCategoriesForRole(role)` (data.js:641-651), que usa `Data.rolePermissions[role]`:

```javascript
getCategoriesForRole(role) {
    const allowed = this.rolePermissions[role] || [];
    return this.categories
        .map(cat => {
            if (cat.alwaysVisible) return cat;
            const visibleIds = (cat.moduleIds || []).filter(id => allowed.includes(id));
            if (visibleIds.length === 0) return null;
            return { ...cat, moduleIds: visibleIds };
        })
        .filter(Boolean);
}
```

**Matriz de visibilidad — fallback offline (`Data.rolePermissions`, data.js:21-27), VERBATIM:**

```javascript
rolePermissions: {
    superadmin: ['crm', 'cotizador', 'catalogo', 'proyectos', 'eventos', 'taller', 'logistica', 'rrhh', 'compras', 'inventario', 'locaciones', 'finanzas', 'contabilidad', 'costos', 'admin-panel'],
    admin:      ['crm', 'cotizador', 'catalogo', 'proyectos', 'eventos', 'taller', 'logistica', 'rrhh', 'compras', 'inventario', 'locaciones', 'finanzas', 'contabilidad', 'costos'],
    venta:      ['crm', 'cotizador', 'catalogo', 'proyectos', 'eventos'],
    pm:         ['crm', 'catalogo', 'proyectos', 'eventos', 'taller', 'logistica', 'inventario'],
    taller:     ['proyectos', 'eventos', 'taller', 'logistica', 'inventario'],
},
```

**IMPORTANTE:** esta matriz es solo el **fallback offline**. La fuente de verdad declarada en el código es la tabla `roles` de Supabase (columna `permissions` JSONB). En runtime, `Data.loadRolesFromDB()` (data.js:567-605) **sobrescribe en memoria** `Data.rolePermissions`, `Data.readOnlyPermissions`, `_roleColors` y `roleLabels` con lo que venga de la tabla `roles`. Si la query falla, queda el hardcode de arriba.

Nota: `Data.categories` ubica los módulos en categorías de navegación. `calendario` aparece en la categoría OPERACIONES (data.js:77) pero **no está listado en ninguna entrada de `rolePermissions`** (los módulos listados son `crm, cotizador, catalogo, proyectos, eventos, taller, logistica, rrhh, compras, inventario, locaciones, finanzas, contabilidad, costos, admin-panel`).

### 2.3 Escritura vs solo-lectura

**SÍ existe distinción.** Hay dos mecanismos según el nivel de prioridad:

1. **Con tabla `roles` de Supabase (`_rolePermissions`):** el propio valor JSONB ya es `"write"`, `"read"` o `"none"` por módulo (auth.js:94-98).

2. **Con customPermissions:** es solo un array de IDs → si el módulo está, da `'write'`; si no, `'none'`. **No hay solo-lectura posible vía customPermissions.**

3. **En el fallback offline:** se cruza `Data.rolePermissions` (acceso) con `Data.readOnlyPermissions` (cuáles de esos son solo lectura).

**Matriz de solo-lectura (`Data.readOnlyPermissions`, data.js:32-39), VERBATIM:**

```javascript
readOnlyPermissions: {
    superadmin: [],
    admin:      [],
    venta:      ['catalogo'],
    pm:         ['crm', 'catalogo', 'inventario'],
    taller:     ['proyectos', 'eventos', 'inventario'],
    // Note: 'taller' in readOnly refers to the role, not the module
},
```

Helper relacionado (`Data.isReadOnly`, data.js:523-526), VERBATIM:

```javascript
isReadOnly(role, moduleId) {
    const ro = this.readOnlyPermissions[role] || [];
    return ro.includes(moduleId);
},
```

### 2.4 Hardcode vs Supabase

**Mecanismo híbrido: Supabase es la fuente de verdad declarada, con hardcode como fallback offline.**

- **Tabla `roles` en Supabase** (columnas `id`, `label`, `color`, `permissions` JSONB). El JSONB tiene forma `{ moduleId: "write"|"read"|"none" }`. Es la fuente de verdad.
- **Carga en runtime:** tras restaurar sesión, `Auth.restoreSession()` llama `Data.loadRolesFromDB()` (data.js:567-605), que lee toda la tabla `roles` y **reemplaza en memoria** `Data.rolePermissions`/`readOnlyPermissions`/`_roleColors`/`roleLabels`. Convierte el JSONB a arrays (write+read → `rolePermissions`; solo read → `readOnlyPermissions`).
- **Por usuario individual:** además, `Auth._fetchProfile` lee el `permissions` del rol del usuario y lo guarda en `user._rolePermissions`, que tiene **prioridad sobre** `Data.rolePermissions` en `getAccessLevel`.
- **Override por usuario (`customPermissions`):** la columna `profiles.custom_permissions` (array de module IDs). Si está seteada, **tiene la máxima prioridad** y pisa por completo lo del rol — el usuario ve exactamente esos módulos (todos con write). Se mapea a `user.customPermissions` en el perfil.
- **Hardcode (`Data.rolePermissions` / `readOnlyPermissions` / `roleLabels` / `_roleColors` en data.js):** solo se usa si las queries a Supabase fallan (modo offline). Los comentarios del código lo dicen explícitamente: *"Fuente de verdad: tabla `roles` en Supabase. Este mapa se usa como fallback si la query a Supabase falla."*

Es decir: la config **vive en Supabase** (`roles.permissions` y `profiles.custom_permissions`), y el hardcode de data.js es red de seguridad offline.

### 2.5 Panel de SuperAdmin

**SÍ existen DOS lugares para configurar permisos** (uno es el panel completo, el otro un editor por usuario):

#### A) Panel de Control — `admin-panel.js` (objeto `AdminPanel`)

Solo superadmin (header muestra badge "Solo superadmin"; comentario de cabecera: *"Solo SUPERADMIN"*). Es la ruta `admin-panel`. Tiene 4 tabs: Dashboard, Usuarios, **Roles y Permisos**, Audit Log. **Lee y escribe contra Supabase.**

Acciones concretas que permite HOY:

**Tab Roles y Permisos** (admin-panel.js:1044-1477):
- Muestra una grilla editable: filas = módulos (agrupados por categoría), columnas = roles. Cada celda cicla `write → read → none` al hacer click (`_cyclePermLevel`, líneas 1107-1111: write→read→none→write). Iconos: `✅` write, `👁️` read, `—` none.
- **Guardar cambios** → escribe `roles.permissions` (JSONB merged) en Supabase vía `supabaseClient.from('roles').update(...)` (`_saveRolesPermissions`, líneas 1298-1329). Las celdas en `none` se borran del objeto.
- **Crear nuevo rol** → `INSERT` en tabla `roles` con `id`, `label`, `description`, `is_base: false`, `permissions: {}`, `color` (`_openCreateRoleModal`, líneas 1331-1433).
- **Eliminar rol** → solo roles con `is_base = false`; previo chequea que no haya usuarios con ese rol; luego `DELETE` en `roles` (`_deleteRole`, líneas 1436-1477).
- Celdas **bloqueadas (locked)**: todo lo de `superadmin`, y `admin-panel` para no-superadmin (líneas 1158-1160) — no editables.
- El grid de módulos disponibles está hardcodeado en `_permModules` (líneas 1049-1073): incluye `parametros-globales` pero **no incluye `admin-panel` ni `calendario`** como filas editables.

**Tab Usuarios** (admin-panel.js:537-1042): CRUD real de usuarios contra Supabase/API:
- Crear usuario (`API.createUser`), editar (nombre/iniciales/rol/teléfono vía `API.updateProfile`), resetear contraseña (`API.adminResetPassword`), activar/desactivar (`API.updateProfile {active}`), eliminar (`API.adminDeleteUser`). Aquí se asigna el **rol** al usuario (no los permisos finos).

**Tab Dashboard:** métricas (online, acciones hoy, módulo más activo, último error) + tabla del equipo. **Tab Audit Log:** feed de `audit_log` con filtros e infinite scroll.

#### B) Editor por usuario — `settings.js` (`Settings.renderAdminUsers`, ruta `#admin-usuarios`)

Accesible para **admin level** (superadmin + admin): `if (!user || !Auth.isAdminLevel()) return Router.navigate('lobby')` (settings.js:225). Pantalla "Usuarios y Roles" con lista + panel de detalle. **Lee y escribe contra Supabase** (vía `API`).

Acciones concretas que permite HOY:
- Crear usuario (solo superadmin ve el botón; `Auth.isSuperAdmin()`, settings.js:241): `API.createUser` con username/nombre/iniciales/rol/password temporal (`mepex123`). El select de rol excluye `superadmin`.
- Editar usuario: nombre, iniciales, **rol** (`API.updateProfile`).
- **Permisos personalizados por usuario** (settings.js:515-602): toggle "Según rol / Personalizados". En modo Personalizados se habilita una matriz de checkboxes por módulo; al guardar arma `custom_permissions` (array de module IDs) y lo persiste en `profiles.custom_permissions` vía `API.updateProfile`. Esto es el override por-usuario de la sección 2.4. La matriz es solo write/none (checkbox marcado = acceso) — **no permite definir solo-lectura por usuario**.
- Activar/desactivar cuenta y resetear contraseña: solo superadmin y solo sobre roles ≠ superadmin (`btnToggleActive`, `btnResetPassword`, settings.js:546-561). El reset usa `supabaseClient.auth.admin.updateUserById`; si la Admin API no está disponible con la anon key, muestra instrucciones para hacerlo desde el dashboard de Supabase.

**Resumen:** la config de visibilidad por rol se hace en `admin-panel.js` (grilla roles×módulos write/read/none → tabla `roles`); la config por usuario individual se hace tanto en `admin-panel.js` Tab Usuarios (asignar rol) como en `settings.js` (asignar rol + permisos personalizados write/none → `profiles.custom_permissions`). Ambos paneles operan contra Supabase, no contra código.

Archivos relevantes (rutas absolutas): `C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX\auth.js`, `C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX\data.js`, `C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX\admin-panel.js`, `C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX\settings.js`.

---

## 3. Inventario de modulos

> Una ficha breve por modulo. Patron canonico = objeto global + prefijo CSS + todo a Supabase.

### 3.1 Comercial / Operaciones / Calendarios
`Calendar` (calendar.js) is not referenced by router, app, data, lobby, or index — it appears to be dead/unwired code.

### CRM (crm.js)
- **Ruta hash:** `#crm` (también `#ventas` y `#clientes` redirigen a `crm` via `router.js` `redirects`)
- **Categoria:** Comercial (fusiona Clientes + Ventas)
- **Prefijo CSS:** `crm-` (ej. `crm-tab`)
- **Pestanas (_tabs):** Clientes, Pipeline, Cotizaciones, Interacciones, Analítica, Marketing. (Analítica solo visible para superadmin: `_tabs.filter(t => t.id !== 'analitica' || isSuper)`.)
- **Patron:** Objeto global (`const CRM`), prefijo CSS consistente. Mayormente vía `API.*`, pero hace 2 llamadas directas a `supabaseClient.from(...)` (`proyectos`, `proyecto_responsables`). **ANTI-PATRON: usa localStorage para DATA DE NEGOCIO** — el tab Marketing persiste campañas en `localStorage('crm_campanias')` (linea 3283/3291); además hay un `TODO` (linea 57) reconociendo que falta crear la tabla `marketing_campanias` en Supabase. No hay mock data fija más allá de los catálogos de config (tipos/estados/columnas, que son legítimos).
- **Tablas Supabase:** `proyectos`, `proyecto_responsables` (directas). El resto del CRUD pasa por `API.*` (clientes, cotizaciones, pipeline, etc. no aparecen como `.from()` directo en este archivo).

### ProyectosModule (proyectos.js)
- **Ruta hash:** `#proyectos`
- **Categoria:** Operaciones
- **Prefijo CSS:** `pj-` (ej. `pj-event-link`, `pj-avatar`)
- **Pestanas (_tabs):** No tiene tabs. Es un listado con `_viewMode: 'table' | 'cards' | 'calendar'` (toggle de vista, no pestañas).
- **Patron:** Objeto global (`const ProyectosModule`), prefijo CSS consistente, estilos inyectados con prefijo propio. Usa `supabaseClient.from()` directo (no API abstraction). Sin localStorage, sin mock data (solo catálogos de config `_statusOptions`/`_typeOptions`). Sigue el patrón canónico.
- **Tablas Supabase:** `proyectos`, `proyecto_responsables`, `proyecto_tipos`.

### ProyectoDetalle (proyecto-detalle.js)
- **Ruta hash:** `#proyectos/:id` (ruta dinámica; soporta deep-link `#proyectos/<id>?tab=novedades`)
- **Categoria:** Operaciones (sub-vista de Proyectos)
- **Prefijo CSS:** `pjd-` (los tabs usan `.pjd-tab` / `.pjd-tabs-bar`, citados en CLAUDE.md; el archivo es la vista detalle de Proyectos)
- **Pestanas (_tabs):** Resumen, Archivos Drive, Novedades, Cotización origen, Actividad.
- **Patron:** Objeto global (`const ProyectoDetalle`). Usa `supabaseClient.from()` directo. **Regla explícita en el header: NUNCA muestra info económica** (todo lo monetario vive en CRM/Finanzas). Sin localStorage para datos, sin mock data. Sigue el patrón canónico.
- **Tablas Supabase:** `proyectos`, `cotizaciones`, `clientes`, `profiles`, `proyecto_actividad`, `proyecto_responsables`, `proyecto_tipos`.

### EventosModule (eventos.js)
- **Ruta hash:** `#eventos` (soporta deep-link `#eventos?id=<uuid>` para abrir la ficha directo)
- **Categoria:** Operaciones
- **Prefijo CSS:** `ev-` (ej. `ev-equipo-list`, `ev-equipo-item`)
- **Pestanas (_tabs):** No tiene tabs a nivel módulo. Tiene `_viewMode: 'table' | 'cards'` (toggle de vista) y un side panel/ficha con secciones editables (equipo, transporte, docs, conflictos, notas), no pestañas.
- **Patron:** Objeto global (`const EventosModule`), prefijo CSS consistente. Mezcla `API.*` (getEvents, createEvent, getAsignaciones..., getCargas, etc.) con `supabaseClient.from()` directo. **ANTI-PATRON: usa localStorage para DATA DE NEGOCIO** de forma extensa — extensiones de evento (`ev_ext_<id>`), documentos (`ev_docs_<id>`), notas (`ev_notas_<id>`), y `teardownEndDate` que "no está en el schema de Supabase" (linea 2030). Comentarios propios lo reconocen ("Extend with localStorage data", "Save ... to localStorage (not in Supabase schema)"). Tablas legacy referenciadas (`rrhh_personal`, `logistica_vehiculos`).
- **Tablas Supabase:** `proyectos`, `personas`, `logistica_vehiculos`, `rrhh_personal` (directas). Eventos/predios/asignaciones/cargas se acceden vía `API.*`.

### CalendarioOperativo (calendario-operativo.js)
- **Ruta hash:** `#calendario`
- **Categoria:** Principal / Operaciones (registrado como `'calendario'` en router; CLAUDE.md lo lista bajo Operaciones)
- **Prefijo CSS:** `co-` (ej. `co-wrapper`, `co-toolbar`, `co-card`, `co-sp-tab`)
- **Pestanas (_tabs):** A nivel módulo usa `_viewMode: 'timeline' | 'cards'` (toggle, no pestañas). El **side panel del evento** sí tiene 3 sub-pestañas (`_activePanelTab`): Info, Logística, Historial.
- **Patron:** Objeto global (`const CalendarioOperativo`), prefijo CSS consistente. Carga datos vía `API.getEvents()` / `API.getVenues()`. **ANTI-PATRON: usa localStorage para DATA DE NEGOCIO** — "enriquece" los eventos leyendo logística/equipo/transporte/docs/notas/proyectos desde localStorage (`ev_proyectos_<id>`, `ev_equipo_<id>`, `ev_transporte_<id>`, `ev_notas_<id>`, `ev_docs_<id>`) y cachea eventos en `co_events_cache`. Comentarios propios lo admiten ("logistics from localStorage for now", "until Supabase tables populated"). Detecta mobile y fuerza `_viewMode='cards'`. No mock data fija (solo paletas/nombres de meses/días).
- **Tablas Supabase:** Ninguna `.from()` directa — todo el acceso a datos pasa por `API.*` (getEvents, getVenues, getAsignacionesByEvento, getCargas, getEventoTransporte, etc.).

### Calendar (calendar.js)
- **Ruta hash:** **Sin ruta.** No está registrado en `router.js` ni referenciado por `app.js`/`data.js`/`lobby.js`/`index.html`. `Calendar` aparenta ser código no cableado / muerto (el "Calendario Global" funcional efectivo es `CalendarioOperativo` en `#calendario`). Si tuviera ruta, sería "ver router".
- **Categoria:** Principal (sería Calendario, según CLAUDE.md), pero hoy no enganchado al menú.
- **Prefijo CSS:** `cal-` (ej. `cal-page`, `cal-header`, `cal-month-grid`, `cal-filter-btn`)
- **Pestanas (_tabs):** No tiene tabs. Tiene filtros toggle por tipo (`_filters: { evento, armado, proyecto }`) y navegación de mes.
- **Patron:** Objeto global (`const Calendar`), prefijo CSS consistente. Carga vía `API.getEvents()` / `API.getProjects()` (sin `.from()` directo). Sin localStorage, sin mock data. El código en sí sigue el patrón canónico; la única anomalía es que está **desconectado del router** (no se llega a él desde la app). Nota interna: `// Could add project deadlines here in the future` (proyectos cargados pero no volcados al calendario).
- **Tablas Supabase:** Ninguna `.from()` directa — usa `API.getEvents()` y `API.getProjects()`.

### 3.2 Taller / Logistica / RRHH / Compras / Locaciones
### TallerModule (taller.js)
- **Ruta hash:** `#taller` (router: `'taller' → TallerModule.render()`; alias legacy `produccion → taller`)
- **Categoria:** OPERACIONES (breadcrumb hardcodeado `color: #00CC88`)
- **Prefijo CSS:** `taller-` (módulo wrapper) y `tlr-` (cards, checklist, mantenimiento, badges, etc.)
- **Pestanas (_tabs):** `Hoy`, `Checklist`, `Mantenimiento` (state `_activeTab`, default `'hoy'`)
- **Patron:** Canónico (objeto global, `render()` → `_buildShell` → `_loadActiveTab`, `addEventListener`, estado `_` privado). Sin localStorage de datos de negocio. Sin dummy/mock data. Estilos con prefijo, inyectados 1 vez vía `_injectStyles()` con `id="taller-tanda2-styles"` (todos scopeados a `.taller-module`). Datos vía capa `API.*` (getCargas, getChecklistsBulk, getMantenimiento, setEstadoTaller, uploadRemito*, etc.) salvo 3 queries directas.
- **Tablas Supabase:** `proyectos`, `proyecto_novedades` (directas). El resto vía API: cargas, checklists, mantenimiento, remitos (Storage) — tablas subyacentes no visibles en `.from()` directo en este archivo.

### LogisticaModule (logistica.js)
- **Ruta hash:** `#logistica` (router: `'logistica' → LogisticaModule.render()`); soporta deep-link `#logistica?tab=cargas&id=<uuid>`
- **Categoria:** OPERACIONES (breadcrumb hardcodeado `color: #00CC88`)
- **Prefijo CSS:** `log-` (cards, toolbar, panel, table, remitos, etc.)
- **Pestanas (_tabs):** `Cargas`, `Remitos`, `Vehículos`, `Personas` (state `_activeTab`, default `'cargas'`)
- **Patron:** Canónico (objeto global, `render()` con parse de deep-link, `_loadActiveTab`, `addEventListener`, estado `_` privado, estilos con prefijo `log-` inyectados vía `_injectStyles()`). Sin localStorage de datos de negocio. Sin dummy/mock data. Acceso a datos casi todo vía `API.*` (getCargas, getCargaById, createCarga, getVehiculos, getPersonas, approveCarga, uploadRemito*, etc.) y `RemitoPDF.generate`. Nota: en `_attachCargaPanelEvents` el handler de cerrar referencia `.log-mov-row` (selector de la tabla vieja de vehículos) aunque las cargas ahora son cards `.log-card` — inconsistencia menor, no rompe.
- **Tablas Supabase:** `proyectos` (única directa, en `_loadProyectosPorEvento`). El resto vía API: cargas / carga_proyectos / vehiculos / personas / remitos (Storage) — no aparecen como `.from()` directo en este archivo.

### RRHHModule (rrhh.js)
- **Ruta hash:** `#rrhh` (router: `'rrhh' → RRHHModule.render()`)
- **Categoria:** RECURSOS (breadcrumb hardcodeado `color: #9B7DFF`)
- **Prefijo CSS:** `rh-` (stats, table, ficha, vac, asign, etc.)
- **Pestanas (_tabs):** El shell renderiza solo 2: `Nómina`, `Vacaciones`. **OJO:** el comentario de cabecera y los tabs visibles dicen 2 tabs, pero el archivo conserva código completo de un tab `Asignación` legacy (`_loadAsignacion`, `_renderAsignacion`, `_showAsignacionModal`) que **ya no es alcanzable desde el shell** (no hay botón de tab que lo active). Código muerto / huérfano.
- **Patron:** Mayormente canónico (objeto global, `render()`, tabs, estado `_`). Anti-patrones presentes:
  - **Acceso directo a Supabase desde el módulo** (no usa capa API para CRUD de personas/vacaciones): `supabaseClient.from(...)` para insert/update/delete inline en los modales.
  - **`onclick` inline** en footers de modales: `onclick="Modal.close()"` (viola la regla "nunca inline onclick").
  - **Mezcla schema nuevo/legacy:** Nómina lee/escribe `personas` con compat layer `_mapPersonaToLegacyShape`; Vacaciones y el código huérfano de Asignación siguen contra tablas `rrhh_*` legacy.
  - Estilos: `<style>` embebido en `_buildShell` (clases con prefijo `rh-`), no sin-prefijo. Sin localStorage de datos de negocio. Sin dummy/mock data (los `<datalist>` de roles son sugerencias de UI, no datos persistidos).
- **Tablas Supabase:** `personas`, `rrhh_vacaciones`, `rrhh_personal`, `rrhh_asignaciones`, `rrhh_vacaciones_solicitudes`. (Además `API.getEventosDePersona`, `API.getEvents`, `API.getProjects` vía capa API.)

### ComprasModule (compras.js)
- **Ruta hash:** `#compras` (router: `'compras' → ComprasModule.render()`; alias legacy `proveedores → compras`)
- **Categoria:** RECURSOS (breadcrumb hardcodeado `color: #9B7DFF`)
- **Prefijo CSS:** `cmp-` (toolbar, table, ficha, calif, pipeline, kpi, etc.)
- **Pestanas (_tabs):** `Proveedores`, `Órdenes de Compra`, `Pagos` (state `_activeTab`, default `'proveedores'`)
- **Patron:** Mayormente canónico (objeto global, tabs, ficha + tabla, estado `_`). Anti-patrones presentes:
  - **Acceso directo a Supabase** para todo el CRUD (`supabaseClient.from('compras_*')` insert/update/delete inline), no via capa API.
  - **`onclick` inline** en footers de modales: `onclick="Modal.close()"`.
  - **Auto-migración de datos en el cliente:** `_migrateOldProveedores()` lee `proveedor` (tabla vieja) e inserta filas en `compras_proveedores` la primera vez que está vacía — efecto de escritura de negocio disparado desde el render del módulo.
  - Sin localStorage de datos de negocio. Sin dummy/mock data (los `<datalist>` de rubros son sugerencias UI). Estilos con prefijo `cmp-` (no en este archivo; vive en CSS global).
- **Tablas Supabase:** `compras_proveedores`, `proveedor` (legacy, solo en la migración), `compras_ordenes`, `compras_orden_items`, `compras_pagos`. (Además `API.getEvents`, `API.getProjects`.)

### LocacionesModule (locaciones.js)
- **Ruta hash:** `#locaciones` (router: `'locaciones' → LocacionesModule.render()`)
- **Categoria:** RECURSOS (breadcrumb hardcodeado `color: #9B7DFF`)
- **Prefijo CSS:** `loc-` (toolbar, card, ficha, table, form, badge, stock, etc.)
- **Pestanas (_tabs):** `Lugares`, `Documentación`, `Stock por Locación` (state `_activeTab`, default `'lugares'`; data-tab interno `stock-locacion`)
- **Patron:** Mayormente canónico (objeto global, tabs, ficha/cards/tabla, estado `_`, config declarativa en arrays `_tiposLugar`/`_tiposDoc`/`_estadosStock`/`_categoriasStock`). Anti-patrones presentes:
  - **Acceso directo a Supabase** para todo el CRUD (`supabaseClient.from('locaciones*')` y lectura de `insumos_base`), no via capa API.
  - **`onclick` inline** en footers de modales: `onclick="Modal.close()"`.
  - **`_categoriasStock` es un array hardcodeado** de categorías (Panelería, Iluminación, etc.) usado para el filtro — constantes de UI, no datos persistidos ni mock de negocio; aceptable, pero notable como lista fija en código.
  - Sin localStorage de datos de negocio. Estilos con prefijo `loc-` (en CSS global, no en este archivo). Nota: usa `parseInt(locacion_id)` / `parseInt(insumo_id)` al guardar → FKs tratadas como integer (las tablas `locaciones*` son BIGINT, no UUID).
- **Tablas Supabase:** `locaciones`, `locaciones_documentos`, `locaciones_stock`, `insumos_base`.

### 3.3 Recursos (Inventario / Catalogo / Costos)

### InventarioModule (inventario.js)
- **Ruta hash:** `#inventario` (deducida del breadcrumb `Inventario` y categoría RECURSOS)
- **Categoria:** RECURSOS (breadcrumb: `<span class="breadcrumb-cat" style="color: #9B7DFF">RECURSOS</span>`, color violeta `#9B7DFF`)
- **Prefijo CSS:** `inv-`
- **Pestanas (_tabs):** Dashboard, Stock Piezas, Stock Materiales, Movimientos, Inventario Físico
- **Patron:** Canónico (este es el módulo de referencia). Lifecycle `render()` con guard de auth, shell + tabs + content router, estado por propiedades `_`, eventos vía `addEventListener`, soft delete (`_deleted=false`). Estilos con prefijo. Sin localStorage de datos de negocio. Sin mock data. Nota: hace queries directas a Supabase (`supabaseClient.from(...)`) en lugar de pasar todo por `api.js`, y los updates de stock son read-modify-write no atómicos (`stock: current + item._qty`) — limitación conocida documentada en CLAUDE.md.
- **Tablas Supabase:** `catalogo_items`, `insumos_base`, `inventario_movimientos`, `inventario_movimiento_items`, `inventario_fisico_sesiones`, `inventario_fisico_conteo`, `locaciones_stock`, `locaciones`, `proyectos`

### CatalogoModule (catalogo.js)
- **Ruta hash:** `#catalogo` (deducida del breadcrumb `Catálogo`)
- **Categoria:** COMERCIAL (breadcrumb: `<span class="breadcrumb-cat" style="color: #F28D15">COMERCIAL</span>`, naranja `#F28D15`)
- **Prefijo CSS:** `cat-`
- **Pestanas (_tabs):** No usa `_tabs`. Tiene 2 tabs hardcodeadas en el shell vía `_activeTab` (`'stands'`/`'eventos'`): "Stands y Alquileres" y "Eventos / Estructuras". Nota: ambas tabs muestran TODO el catálogo igual — el filtro por tab no está implementado (comentario en `_applyFilters`: "for now both tabs show all items", esperando un campo `audiencia` en la DB).
- **Patron:** Canónico. Lifecycle `render()` con guard, `_loadData` vía `API.getCatalogoItems()`, filtros/sort/búsqueda, side panel (ficha), CRUD completo vía API (`createCatalogoItem`/`updateCatalogoItem`/`deleteCatalogoItem`) con soft delete, `API.clearCache()`. Estilos con prefijo `cat-` (definidos en CSS externo, no inline en este archivo). Sin localStorage de negocio, sin mock data. `_editFoto` es placeholder ("Subida de fotos — próximamente").
- **Tablas Supabase:** Ninguna llamada directa `.from(...)`; todo el acceso a datos pasa por `API.*` (tabla subyacente: `catalogo_items`).

### CostosModule (costos.js)
- **Ruta hash:** `#costos` (deducida del breadcrumb `Costos`)
- **Categoria:** ADMIN & FINANZAS (breadcrumb: `<span class="breadcrumb-cat" style="color: #4A90D9">ADMIN & FINANZAS</span>`, azul `#4A90D9`). Acceso restringido: solo superadmin/admin (`Auth.isAdminLevel()`); tab Parámetros solo superadmin (`Auth.isSuperAdmin()`).
- **Prefijo CSS:** `costos-`
- **Pestanas (_tabs):** No usa array `_tabs`; tabs hardcodeadas en el shell vía `_activeTab`: Insumos, Recetas y Costos, Listas de Precio, y Parámetros (esta última solo superadmin).
- **Patron:** Canónico con desviación. Lifecycle correcto, estado `_`, filtros/sort, side panel, export PDF (jsPDF), accent-insensitive search (`_norm`). Carga la mayoría vía `API.*`, pero también hace queries directas a Supabase con `supabaseClient.from(...)` (anti-patrón menor respecto a centralizar en api.js). NO usa localStorage para datos de negocio (cachés en memoria: `_recetaCache`, `_paramsCache`, `_recetaStatusCache`). Sin mock data. El cálculo real de precio lo delega a la RPC PL/pgSQL `calcular_receta` (no a este JS).
- **Tablas Supabase:** `costos_tipo_amortizacion`, `receta_componentes` (vía llamadas directas `.from`). Adicionalmente, vía `API.*`: `insumos_base`, `catalogo_items`, `proveedor`, `parametros_globales`, listas de precio (las tablas subyacentes no se invocan con `.from` directo en este archivo).

### CalculoReceta (calculo-receta.js)
- **Ruta hash:** No aplica — no es un módulo de vista/pantalla. No tiene ruta.
- **Categoria:** No aplica.
- **Prefijo CSS:** No tiene (no renderiza UI ni define estilos).
- **Pestanas (_tabs):** No tiene.
- **Patron:** No es un módulo de UI — es un **helper / función pura de cálculo**. Expone el objeto global `CalculoReceta` con un método público `calcular(receta, componentes, params)` y privados `_calcularSubalquilado`, `_calcularPropio`, `_sumarMP`, `_num`, `_round`. No toca Supabase, no tiene DOM, no tiene state, no tiene lifecycle `render()`. Implementa la cascada de costeo (MP + MO + indirectos + amortización + reacond → precio con margen) en JS. **Importante:** según CLAUDE.md la fuente de verdad del cálculo es la RPC PL/pgSQL `calcular_receta` en Supabase (el frontend "nunca calcula precios"); este archivo es una implementación JS paralela/legacy de esa fórmula (incluye conceptos como `pctIndirectosComercial` que la doc marca como legacy). Exporta vía `window.CalculoReceta` y `module.exports`.
- **Tablas Supabase:** Ninguna (función pura, no accede a la DB).

### 3.4 Admin & Finanzas (Finanzas / Contabilidad)

### FinanzasModule (finanzas.js)
- **Ruta hash:** `#finanzas` (router.js: `'finanzas' → FinanzasModule.render()`)
- **Categoria:** ADMIN & FINANZAS (data.js, color `#4A90D9`, `moduleIds: ['rrhh','finanzas','contabilidad','costos']`)
- **Prefijo CSS:** `fin-` (ej. `fin-tab`, `fin-subtab`, `fin-badge-*`, `fin-filter-select`, `fin-report-toolbar`). Consistente.
- **Pestanas (_tabs):** Panel · Ingresos · Egresos · Facturación · Cuentas · Conciliación · Calendario · Reportes.
  - **Subtabs:**
    - Ingresos: Cobros · Planes de cobro (`_ingresosSubtab`).
    - Egresos: Egresos · Registros auxiliares (`_egresosSubtab`, ex "IVA recovery").
    - Facturación: emitir · emitidos · recibidos (`_factSubtab`).
    - Calendario: calendario · plantillas (`_calSubtab`).
    - Reportes: Estado de resultados · Rent. Proyecto · Rent. Cliente · Cashflow Proy. · IVA · 🌐 Mov. ME (`_repSubtab`).
  - **Toggle A/B (canal):** Oficial · Interno · Total.
- **Patron:** Canónico (objeto global `FinanzasModule`, `_activeTab`/`_tabs`, render en container, template literals, `addEventListener`). **localStorage:** SÍ usa `localStorage` pero solo para PREFERENCIA UI (`finanzas_vista_canal`, el toggle de canal) — no es data de negocio, es aceptable según convención del proyecto. No se detecta dummy/mock data hardcodeada. Estilos con prefijo `fin-` correcto, aunque hay bloques de estilos inline en algunos toggles (no son clases sin prefijo, son `style="..."` ad-hoc). No usa `.rpc()`.
- **Tablas Supabase:** `cuentas_financieras`, `proyectos`, `clientes`, `ingresos`, `egresos`, `plan_cobro`, `plan_cobro_items`, `transferencias_internas`, `comprobantes`, `comprobantes_recibidos`, `vencimientos_generados`, `vencimientos_recurrentes`, `proveedor`, `conciliaciones`, `extracto_bancario_lineas`, `mapeo_cuentas`.

### ContabilidadModule (contabilidad.js)
- **Ruta hash:** `#contabilidad` (router.js: `'contabilidad' → ContabilidadModule.render()`, `module: 'finanzas'` para permisos)
- **Categoria:** ADMIN & FINANZAS (misma que Finanzas)
- **Prefijo CSS:** `cont-` (ej. `cont-tab`, `cont-subtab`, `cont-iva-subtab`, `cont-iva-origen-pill`, `cont-diario-filter-input`, `cont-eerr-title`). Consistente.
- **Pestanas (_tabs):** Plan de cuentas · Libro diario · Libro mayor · Asiento manual · Mapeos auto. · Apertura · Libros IVA · Reportes.
  - **Subtabs:**
    - Libros IVA: IVA Ventas · IVA Compras · Posición IVA (`_ivaSubtab`); con toggle de Origen: Oficial · Auxiliar · Ambos (`_ivaComprasOrigen`).
    - Reportes: 📊 Estado de Resultados · ⚖️ Balance General (`_repContSubtab`).
  - **Toggle A/B (canal):** sincronizado con Finanzas vía getter/setter sobre el mismo localStorage key.
- **Patron:** Canónico (objeto global `ContabilidadModule`, `_activeTab`/`_tabs`, render, template literals). **localStorage:** SÍ, pero solo PREFERENCIA UI — getter/setter `_canalVista` que lee/escribe `finanzas_vista_canal` (compartido con Finanzas). No es data de negocio. No se detecta dummy/mock data hardcodeada. **Anti-patrón menor:** usa estilos INLINE extensos (`style="..."`) en los subtabs de Reportes y en el toggle de Origen de IVA, en lugar de clases `cont-` — mezcla de prefijo correcto con estilos inline ad-hoc. Usa `.rpc('fn_generar_asiento_apertura')` (Fase H apertura).
- **Tablas Supabase:** `plan_cuentas`, `cuentas_financieras`, `asientos`, `asiento_lineas`, `comprobantes`, `comprobantes_recibidos`, `mapeo_cuentas`, `v_saldos_apertura_ejercicio` (vista), `saldos_apertura`.

### 3.5 Renderer generico y modulos de sistema

### Modules (modules.js)
- **Que es / rol:** Renderer generico que renderiza DENTRO de `#mainContent` el sub-header + tabs de seccion + contenido (tabla con filtros/vistas tipo Notion + fichas) para varias entidades. Es el "viejo" renderer del que se fueron extrayendo modulos a archivos propios.
- **Ruta hash:** Sin ruta propia. Se invoca via `Modules.render(moduleId)` desde el Router para los moduleId que aun maneja. La estructura de tabs viene de `Data.getModuleById(moduleId).sections`, no de un `_tabs` interno.
- **Prefijo CSS:** No tiene un prefijo unico propio. Usa clases generales/compartidas: `module-view`, `module-subheader`, `module-section-tabs`, `section-tab`, `api-*` (`apiDataContainer`, `apiSectionSearch`, `api-offline-msg`), `ficha-*` (`ficha-section-title`, `ficha-row`, `ficha-prov-search`, `ficha-edit-input`), `admperm`/`view`/`col` no. Tablas con `th.sortable`. (Anti-patron leve: muchas clases sin prefijo de modulo, son globales de la SPA.)
- **Pestanas (_tabs):** No define `_tabs`. Las secciones salen de `Data` por modulo. Solo las combinaciones mapeadas en `_getApiSectionType` cargan datos reales: `clientes:ficha`→clients, `eventos:evento`→events, `eventos:proyecto`→projects, `inventario:insumos`→insumos. Comentarios indican que `proyectos:lista` y `inventario:catalogo` fueron movidos a `ProyectosModule`/`CatalogoModule`. Hay tambien fichas de cotizacion (resumen, seguimiento, timeline).
- **Patron / anti-patrones:**
  - localStorage: solo preferencias de UI (vistas Notion `mepex_views_*`, lock `mepex_table_locked`, orden de columnas `*_order`). No guarda data de negocio. OK.
  - Dummy/mock: no hay mock data; todo via `API.*`. El form de cotizacion fue eliminado (nacen en el cotizador externo); `catalogo` removido (CatalogoModule).
  - No accede a Supabase directo: usa `API.*` (getClients/getProjects/getEvents/getInsumos + create/update/delete equivalentes, getCotizaciones, getInteracciones, getCotizacionTimeline, recalcularTodo, etc).
- **Tablas Supabase:** Ninguna `.from('...')` directa. Implicitas via `_entityConfig.supabaseTable`: `clientes`, `proyectos`, `eventos`, `insumos_base`, `cotizaciones`. (El acceso real lo hace api.js.)
- **Modulos/entidades que renderiza genericamente y como decide cual:** Decide por el par `moduleId:sectionId` en `_getApiSectionType()` y por `_entityConfig`/`_getFormFields(type)` segun el `apiType` resultante. Entidades activas hoy: **clients (clientes), projects (proyectos), events (eventos), insumos (insumos_base), cotizaciones** (esta ultima solo via fichas, sin form). Proyectos-lista y catalogo estan explicitamente marcados como movidos a otros modulos. No maneja **produccion ni proveedores** de forma generica aqui (solo aparece `proveedor` como campo de texto del form de insumo y filtros; no como entidad propia).

### AdminPanel (admin-panel.js)
- **Que es / rol:** Panel de Control para SUPERADMIN: dashboard de actividad del sistema, gestion CRUD de usuarios, matriz de roles/permisos y feed de audit log.
- **Ruta hash:** Sin hash explicito en el archivo; se invoca via `AdminPanel.render()` desde el Router (modulo admin / Panel de Control). Breadcrumb fijo "ADMIN & FINANZAS › Admin".
- **Prefijo CSS:** `admpanel-*` (metricas, tablas, badges, search), `admperm-*` (grilla de roles/permisos), `adm-*` y `adm-form-*` (modales/forms de usuario). Reusa shell global `module-view admpanel`, `module-subheader`, `section-tab`.
- **Pestanas (_tabs):** 4 tabs via `_activeTab` (no se llama `_tabs`): **Dashboard, Usuarios, Roles y Permisos, Audit Log**.
- **Patron / anti-patrones:**
  - No usa localStorage. No hay mock data — todo real.
  - La grilla de permisos `_permModules` esta **hardcodeada** (lista fija de categorias/modulos: CRM, Cotizador, Catalogo, Proyectos, Eventos, Taller, Logistica, RRHH, Compras, Inventario, Locaciones, Finanzas, Contabilidad, Costos, Parametros). No se lee de `Data`.
  - Mezcla acceso directo a Supabase (`supabaseClient.from`) con `API.*` (getProfiles, getRoles, createUser, updateProfile, adminResetPassword, adminDeleteUser, isUsernameAvailable). Registra acciones via `AuditLog.record`.
- **Tablas Supabase:** `.from('audit_log')`, `.from('roles')`. Mas `profiles` via `API.getProfiles()`.

### Settings (settings.js)
- **Que es / rol:** Pantallas de configuracion accesibles desde el dropdown: Mi Perfil, Usuarios y Roles (admin), Notificaciones.
- **Ruta hash:** Tres vistas (segun comentarios): `#perfil` (`renderProfile`), `#admin-usuarios` (`renderAdminUsers`, requiere `Auth.isAdminLevel()`), `#notificaciones` (`renderNotifications`).
- **Prefijo CSS:** `settings-*` (settings-page, settings-section, settings-user-table, settings-perm-matrix, settings-switch, settings-danger-zone, etc). Reusa `form-*`, `btn`, `badge`.
- **Pestanas (_tabs):** No tiene tabs internos; son 3 pantallas separadas por metodo render.
- **Patron / anti-patrones:**
  - localStorage: **solo preferencias de notificaciones** (`notification_prefs_v2`) — es UI, OK. El modulo inicio se guarda via `Auth.setStartModule` (no es localStorage directo aqui).
  - Anti-patron / limitacion conocida: en Notificaciones hay un banner "se activaran cuando el sistema de notificaciones este implementado" — las prefs no estan cableadas a nada funcional (placeholder real). El reset de contraseña de otros usuarios depende de `supabaseClient.auth.admin.updateUserById` que **falla con anon key**, con fallback que instruye hacerlo desde el dashboard de Supabase. Contraseña temporal hardcodeada `mepex123` en create/reset.
  - Sin mock data de negocio; usuarios reales via `API.getUsers`, `API.updateProfile`, `API.createUser`, `API.toggleUserActive`, `Auth.changePassword`.
- **Tablas Supabase:** Una `.from()` indirecta via `supabaseClient.auth.admin.updateUserById` (auth, no tabla). Datos via `API.*` (perfiles/usuarios) — no hay `.from('tabla')` directo. Usa `Data.roleLabels`, `Data.rolePermissions`, `Data.getModuleList`.

### AuditLog (audit-log.js)
- **Que es / rol:** Helper (no es modulo de UI). `AuditLog.record()` inserta acciones fire-and-forget en `audit_log`; ademas maneja Heartbeat de presencia (actualiza `last_seen_at` cada 2 min) y API legacy de undo/historial.
- **Ruta hash:** No aplica — es un helper/servicio global sin ruta.
- **Prefijo CSS:** No aplica (no renderiza UI; solo usa `Toast` en revert).
- **Pestanas (_tabs):** No aplica.
- **Patron / anti-patrones:**
  - No localStorage, no mock data. Acciones validas documentadas: create/edit/delete/login/logout/view/error/denied.
  - Comentario al inicio documenta el schema real de `audit_log` (id, user_id, user_name, user_email, action, module, table_name, record_id, details jsonb, tipo, ip_address, created_at) — alineado con prod.
  - `revertFromHistory` hace updates dinamicos sobre `entry.table_name` (cualquier tabla) — usa soft delete `_deleted`.
- **Tablas Supabase:** `.from('audit_log')` (insert/select), `.from('profiles')` (heartbeat update `last_seen_at`), y `.from(entry.table_name)` dinamico en revert (cualquier tabla del sistema, vía `_deleted`/update).

### Badges (badges.js)
- **Que es / rol:** Helper que calcula conteos de alertas por modulo y los pinta como circulitos naranjas en la sidebar. Se recalcula post-login y cada 5 min.
- **Ruta hash:** No aplica — helper/servicio. Se inicia con `Badges.init()` post-login, `Badges.stop()` en logout.
- **Prefijo CSS:** Inserta `.sidebar-badge` en items existentes (`.se-item[data-route]` y `.sidebar-strip-flyout-link[data-route]`). No define prefijo propio de bloque.
- **Pestanas (_tabs):** No aplica.
- **Patron / anti-patrones:**
  - No localStorage, no mock data. Visibilidad por rol en `_visibility`. Un calculador por modulo en `_calculators` con try/catch tolerante (devuelve 0 si falla o si faltan columnas/tablas).
  - Anti-patron / deuda conocida: `finanzas()` es **placeholder (return 0)**; varios calculadores dependen de columnas/tablas que pueden no existir aun (comentarios citan `sql/badges_schema_additions.sql` para `clientes.ultimo_contacto`, `insumos_base.stock_actual`/`stock_minimo`). Nota: el calculador de **inventario** usa `stock_actual`/`stock_minimo` que segun CLAUDE.md estan sin uso en prod (la UI usa `stock`) — por eso probablemente devuelve 0.
- **Tablas Supabase:** `cotizaciones`, `clientes`, `proyectos`, `eventos`, `taller_checklist`, `logistica_vehiculos`, `compras_pagos`, `rrhh_vacaciones_solicitudes`, `insumos_base`, `locaciones_documentos`. (`finanzas` no consulta nada.)


---

## 4. Lobby / Home

La vista PRINCIPAL > Lobby (`lobby.js`, objeto global `Lobby`) es **funcional, NO placeholder**. Es un dashboard personalizado por rol que carga data real desde Supabase con fallback graceful. La estructura visible: saludo ("Bienvenido, <nombre>" + fecha en español), bloque de KPIs (skeleton mientras carga), alertas, y un split de dos columnas (contenido principal + columna lateral con calendario y, solo admin/superadmin, actividad reciente).

Carga toda la data en paralelo vía `_loadDashboardData` (`Promise.allSettled` de KPIs, alertas, contenido principal, calendario y, para admin/superadmin, activity feed).

### KPIs (varían según rol — `_fetchKPIsForRole`)
Salen de llamadas API (`API.getCotizaciones`, `API.getProjects`, `API.getEvents`), no de queries `.from(` directas. Si fallan, cae a `Data.getIndicatorsForRole(role)`.

- **superadmin / admin** (`_fetchAdminKPIs`, 4 KPIs): Cotizaciones activas (estados borrador/enviada/negociacion/aprobada), Proyectos en curso (excluye Finalizado/Rechazado), Eventos próximos (eventStartDate ≥ hoy), Cobros pendientes (suma `montoTotal` de cotizaciones aprobada/ganada — el código lo etiqueta como "placeholder").
- **venta** (`_fetchVentaKPIs`, 3 KPIs): Mis cotizaciones activas (filtra por `vendedorId === user.id/uid`, con resumen de pipeline env/neg/apr), En negociación, Monto en negociación (`_formatMoney`).
- **pm** (`_fetchPMKPIs`, 3 KPIs): Mis proyectos activos (filtra `p.responsible` por nombre del usuario, con desglose por estado), Eventos de la semana (próximos 7 días), Total asignados.
- **taller** (`_fetchTallerKPIs`, 2 KPIs): Armados pendientes (eventos con `setupDate` ≥ hoy), Próximo armado (countdown "HOY"/"MAÑANA"/"en N días" + nombre del evento).

### Alertas (`_loadAlerts` / `_fetchAlertsForRole`)
Sección "ALERTAS" con cards de color (danger/warning/ok). Reglas calculadas client-side sobre la misma data de cotizaciones/proyectos/eventos:
- `_checkCotizacionesVencer`: cotizaciones enviada/negociacion cuyo `createdAt + 30 días` cae dentro de la próxima semana.
- `_checkEventosSinEquipo`: eventos futuros sin `equipoAsignado`/`team`.
- `_checkProyectosTrabados`: proyectos activos sin actualizar hace ≥ 7 días.
- `_checkClientesSinFollowUp` (solo venta): cotizaciones sin interacción ≥ 7 días.
- Las alertas de **taller** son placeholder explícito: el comentario dice "vehiculos/mantenimiento tables don't exist yet" y el bloque `taller`/`superadmin`/`admin` solo tiene un `// Future:` sin implementar.

### Mini calendario (`_renderMiniCalendar` + `_loadCalendarData`)
Sí existe y es funcional. Grilla mensual CSS del mes actual (resalta hoy). `_loadCalendarData` trae eventos y proyectos, pinta dots de color por día (verde `#00CC88` para `eventStartDate`, naranja `#F28D15` para `setupDate`/Armado, máx 3 dots/día). Debajo, lista "PRÓXIMOS" (`_renderUpcoming`) con los próximos 5 eventos (nombre, venue, fecha).

### Bloques por categoría (`_renderCategoryBlocks`)
Sí. Para admin/superadmin/venta/pm renderiza bloques "MÓDULOS" agrupados por categoría (desde `Data.getCategoriesForRole`, excluye `principal`), cada uno con chips de módulo clicables que navegan vía `Router.navigate(chip.dataset.module)`. El rol **taller** no ve bloques de módulos: ve en su lugar "PRÓXIMOS TRABAJOS" (`_loadTallerContent`), lista de armados/desarmes de los próximos 14 días con countdown. **venta** suma "MIS PRÓXIMOS EVENTOS"; **pm** suma "ESTA SEMANA" (armado/evento/desarme).

### Actividad reciente (`_loadActivityFeed`, solo admin/superadmin)
Funcional con fallback. Es **la única consulta `.from(` directa de todo el archivo**: `supabaseClient.from('audit_log').select('*').order('created_at', desc).limit(8)`. Mapea cada log a item con `_timeAgo` + ícono por acción. Si la tabla no existe o viene vacía, cae a `Data.recentActivity` (mock); si tampoco hay, muestra "Sin actividad reciente". Footer con link "Ver toda la actividad" → `Router.navigate('admin-panel')`.

### Tablas Supabase consultadas
- Directa (`.from(`): **`audit_log`** (única, en `_loadActivityFeed`). Nota: el nombre de tabla es `audit_log` (singular), mientras el CLAUDE.md/schema reciente menciona `audit_logs` (plural) — posible desajuste, no verificado contra prod.
- Indirectas vía API: cotizaciones, proyectos y eventos (a través de `API.getCotizaciones` / `API.getProjects` / `API.getEvents`).

---

## 5. Notificaciones / alertas

Sí existe un sistema de notificaciones, en **`notifications.js`**, objeto global **`Notifications`**. Es independiente de las "alertas" del lobby y de los badges del sidebar. Documentado como "Tanda 1 B4".

### Qué lo dispara
- **Polling cada 30 s**: `POLL_MS: 30000`, `setInterval(() => this.refresh(), this.POLL_MS)` en `init()`.
- **Refresh por eventos del navegador**: `window` `focus` y `document` `visibilitychange` (cuando la pestaña vuelve a estar visible). También refresca al abrir el dropdown (`openDropdown` llama a `refresh`).
- **Fan-out desde el backend (API)**: las notificaciones se **crean** desde `api.js` vía `API.createNotification(...)`, que hace `INSERT` en la tabla `notifications`. Es fan-out a nivel aplicación (JS), **no triggers SQL**: se disparan en flujos como `createAsignacionEvento`, `approveAsignacionEvento`, `createVehiculo` (vehículo tercero), `createCarga`, `approveCarga`, `setCargaRemitoFirmado` (notifica a pm y admin), `setEstadoTaller` (stand listo → pm). El `Notifications` del frontend solo lee/marca leídas; no crea.
- **Init**: se monta en `app.js:73` (`Notifications.init()`), solo si el objeto está definido.

### Segmentación por usuario / rol
La query vive en `API.getNotifications` (`api.js:3343`). Tabla `notifications`, filtro `.or(...)` que incluye tres caminos:
- `target_user_id.eq.<uid>` (notificación dirigida al usuario puntual),
- `target_role.eq.<rol>` (por rol del usuario; **superadmin además ve `admin`** — `visibleRoles = ['superadmin','admin']`),
- `target_role.is.null` (broadcast sin rol).

Orden `created_at` descendente, `limit` 20 (`LIMIT: 20`).

El estado leído/no-leído es **por usuario** mediante la columna array `leida_por` (lista de uids). `_isReadBy` / `_isNotifReadBy` chequean si el uid está en el array. `markRead` hace read-modify-write del array (optimistic en el front + update en API). `markAllNotificationsRead` itera las no leídas y las marca una por una. La prioridad (`prioridad`: normal/alta/critica) cambia el color del dot (turquesa/naranja/rojo).

### Tabla Supabase
Única: **`notifications`**. Columnas usadas: `id`, `tipo`, `titulo`, `mensaje`, `target_role`, `target_user_id`, `entidad_tipo`, `entidad_id`, `link`, `prioridad`, `expires_at`, `leida_por` (array de uids), `created_at`.

### Dónde se monta en la UI
Campana en el header global. `app.js:138` define el contenedor `<div class="notif-wrapper" id="notifBellSlot">`. `Notifications._renderBell()` inyecta el botón campana (SVG) con badge numérico naranja (`notif-badge`, "99+" si excede) cuando hay no leídas. Al click abre un dropdown (`notif-dropdown`, 380 px) con las últimas 20 notifs: dot de no-leída, título, mensaje, tipo y fecha relativa (`_fmtRelative`), botón "Marcar todas leídas". Click en un item → `markRead` + navega vía `window.location.hash` al `link` (soporta hash con query param, ej `#proyectos/<id>?tab=novedades`). En mobile (≤768 px) se renderiza como bottom sheet a nivel `<body>` con backdrop (`_renderMobileSheet`, porque el header tiene `backdrop-filter` que rompe `position:fixed`). Los estilos se inyectan en `<head>` (`_injectStyles`, id `notif-styles`), no en `style.css`.

### badges.js — SÍ es parte del sistema de alertas (pero distinto de Notifications)
Objeto global **`Badges`**. Muestra **circulitos naranjas de conteo en la sidebar** (por módulo), no en la campana. Es un sistema separado de `Notifications`.

- **Init/refresh**: `Badges.init()` en `app.js:69` (post-login); refresco periódico cada **5 minutos** (`_REFRESH_MS = 5*60*1000`); `Badges.stop()` en `auth.js:62` (logout).
- **Visibilidad por rol**: mapa `_visibility` define qué roles ven cada badge (crm, proyectos, eventos, taller, logistica, finanzas, compras, rrhh, inventario, locaciones).
- **Cálculo**: un `_calculator` por módulo, cada uno hace queries `.from(` directas a Supabase contando condiciones de "alerta":
  - `crm` → `cotizaciones` (evento ≤ 3 días) + `clientes` (`ultimo_contacto` ≥ 15 días — nota: columna puede no existir).
  - `proyectos` → `proyectos` sin cambio ≥ 5 días.
  - `eventos` → `eventos` (armado ≤ 7 días) sin `proyectos` vinculados.
  - `taller` → `eventos` + `proyectos` + `taller_checklist` (checklist incompleto, armado ≤ 3 días).
  - `logistica` → `logistica_vehiculos` (VTV/seguro vencido).
  - `finanzas` → **placeholder, retorna 0** ("tabla de cobros no implementada aún").
  - `compras` → `compras_pagos` vencidos.
  - `rrhh` → `rrhh_vacaciones_solicitudes` pendientes.
  - `inventario` → `insumos_base` (`stock_actual < stock_minimo` — nota: estas columnas están sin usar según el CLAUDE.md, retorna 0 si no existen).
  - `locaciones` → `locaciones_documentos` (vencimiento ≤ 30 días).
- **DOM**: `_updateDOM()` pinta `.sidebar-badge` sobre `.se-item[data-route]` (sidebar expandida) y `.sidebar-strip-flyout-link[data-route]` (sidebar colapsada).

**Tablas Supabase de Badges**: `cotizaciones`, `clientes`, `proyectos`, `eventos`, `taller_checklist`, `logistica_vehiculos`, `compras_pagos`, `rrhh_vacaciones_solicitudes`, `insumos_base`, `locaciones_documentos`.

### Resumen de los tres sistemas (no confundir)
- **Lobby > Alertas** (`lobby.js`): cards de alerta dentro de la vista Lobby, calculadas client-side sobre data de API. Taller sin implementar.
- **Notifications** (`notifications.js`): campana del header, tabla `notifications`, polling 30 s, segmentada por user/rol, fan-out creado desde `api.js`.
- **Badges** (`badges.js`): contadores naranjas en la sidebar por módulo, queries directas, refresh 5 min. `finanzas` e `inventario` son placeholder/0.

---


## 6. Esquema de datos

### 6.1 Archivos de migracion SQL en el repo

54 archivos en `sql/`. Agrupados por familia:

**Finanzas (fases 1-8 + letras A-H):**
- `finanzas_fase1.sql`, `finanzas_fase2.sql`, `finanzas_fase3.sql`, `finanzas_fase4.sql`, `finanzas_fase5.sql`, `finanzas_fase6.sql`, `finanzas_fase8.sql` (NO existe `finanzas_fase7.sql`)
- `finanzas_fase_b_iva_recovery.sql`, `finanzas_fase_c_plan_pagos.sql`, `finanzas_fase_e_multimoneda.sql`, `finanzas_fase_g1_dif_cambio_cuentas.sql`, `finanzas_fase_g5_planes_moneda.sql`, `finanzas_fase_h_saldos_apertura.sql`

**Contabilidad:**
- `contabilidad_fase_a_hardening.sql`, `fix_trigger_asiento_auto.sql`

**Costos:**
- `costos_fase1.sql`, `costos_fase3.sql` (NO existe `costos_fase2.sql`)

**Taller / Logística / Operativo:**
- `taller_module.sql`, `taller_logistica_v1.sql`, `taller_logistica_v2.sql`, `taller_checklist_v2.sql`, `logistica_module.sql`, `cargas_encargado_y_cleanup.sql`, `storage_remitos.sql`

**RRHH / Personas:**
- `rrhh_tables.sql`, `rrhh_to_personas_migration.sql`, `personas_asegurados_meridional.sql`, `asignaciones_y_notifs.sql`

**Inventario / Locaciones / Predios:**
- `inventario_migrations.sql`, `locaciones.sql`, `predios.sql`, `fase1b_seed_predios.sql`

**Comercial / CRM / Cotizaciones / Listas de precio:**
- `pipeline_comercial.sql`, `pipeline_5_estados.sql`, `crm_clientes_columns.sql`, `cotizaciones_fks.sql`, `listas_precio.sql`, `lista_base_unica.sql`

**Compras:**
- `compras_module.sql`

**Eventos / Calendario:**
- `eventos_horarios.sql`, `calendario_operativo_v2.sql`, `rename_proyectos_eventos.sql`, `rls_eventos_proyectos.sql`

**Completitud / Badges:**
- `completitud_triggers.sql`, `fix_completitud_trigger.sql`, `badges_schema_additions.sql`

**Unificación UUID / RLS / Roles-Permisos / Fixes:**
- `fase1_unificacion_uuid.sql`, `fase1c_rls.sql`, `fix_rls_authenticated.sql`, `fix_rls_profiles.sql`, `fix_roles_permissions.sql`

**Integración externa:**
- `v4_pyme_integration.sql`

### 6.2 Tablas Supabase referenciadas en el codigo

Lista única alfabética de todo lo visto en `.from('...')` en `**/*.js` (incluye tablas reales y VIEWs `v_*`):

- `asiento_lineas`
- `asientos`
- `asignaciones_evento`
- `audit_log`
- `carga_personas`
- `carga_proyectos`
- `cargas`
- `catalogo_items`
- `categorias_config`
- `clientes`
- `cobro_aplicaciones`
- `comprobantes`
- `comprobantes_iva_recovery`
- `comprobantes_recibidos`
- `compras_orden_items`
- `compras_ordenes`
- `compras_pagos`
- `compras_proveedores`
- `conciliaciones`
- `costos_tipo_amortizacion`
- `cotizacion_timeline`
- `cotizaciones`
- `cuentas_financieras`
- `egresos`
- `email_templates`
- `encuestas_evento`
- `evento_documentos`
- `evento_historial`
- `eventos`
- `extracto_bancario_lineas`
- `ingresos`
- `insumo_precio_historial`
- `insumos_base`
- `interacciones`
- `inventario_fisico_conteo`
- `inventario_fisico_sesiones`
- `inventario_movimiento_items`
- `inventario_movimientos`
- `lista_precio_items`
- `lista_precio_rubros`
- `listas_precio`
- `locaciones`
- `locaciones_documentos`
- `locaciones_stock`
- `logistica_movimientos`
- `logistica_vehiculos`
- `mapeo_cuentas`
- `notifications`
- `opciones_select`
- `parametros_globales`
- `personas`
- `plan_cobro`
- `plan_cobro_items`
- `plan_cuentas`
- `predios`
- `produccion_mantenimiento`
- `profiles`  *(usuarios)*
- `proveedor`
- `proyecto_actividad`
- `proyecto_novedades`
- `proyecto_responsables`
- `proyecto_tipos`
- `proyectos`
- `pyme_sync_log`
- `receta_componentes`
- `remitos`
- `roles`  *(roles)*
- `rrhh_asignaciones`
- `rrhh_personal`
- `rrhh_vacaciones`
- `rrhh_vacaciones_solicitudes`
- `saldos_apertura`
- `taller_checklist`
- `taller_proyecto_checklist`
- `transferencias_internas`
- `v_libro_iva_compras_extendido`  *(VIEW)*
- `v_plan_cobro_resumen`  *(VIEW)*
- `v_posicion_iva_mes`  *(VIEW)*
- `v_saldo_comprobante`  *(VIEW)*
- `v_saldos_apertura_ejercicio`  *(VIEW)*
- `vehiculos`
- `vencimientos_generados`
- `vencimientos_recurrentes`

Notas:
- VIEWs (no tablas físicas): `v_libro_iva_compras_extendido`, `v_plan_cobro_resumen`, `v_posicion_iva_mes`, `v_saldo_comprobante`, `v_saldos_apertura_ejercicio`.
- `remitos` aparece como `supabase.storage.from('remitos')` (es un **bucket de Storage**, no tabla de DB) — referenciado en `api.js`.
- Coexistencia legacy/nuevo: `personas` (nuevo) vs `rrhh_personal`/`rrhh_asignaciones`/`rrhh_vacaciones`/`rrhh_vacaciones_solicitudes` (legacy); `vehiculos`+`cargas`+`carga_proyectos`+`carga_personas` (nuevo) vs `logistica_vehiculos`/`logistica_movimientos` (legacy); `taller_proyecto_checklist` vs `taller_checklist`.

### 6.3 Tablas de usuarios / roles / permisos / auditoria

| Tabla | Categoría | Uso en el código |
|-------|-----------|------------------|
| `profiles` | **Usuarios** | Tabla central de usuarios: name, role, initials, active, custom_permissions. Leída/escrita en `auth.js` (login, session restore, RBAC), `api.js` (CRUD usuarios), `admin-panel.js` (tabla de usuarios), `lobby-api/index.js` (backend admin con service_role), `proyecto-detalle.js` (autor/responsables). Fuente del rol del usuario logueado. |
| `roles` | **Roles** | Catálogo de roles del sistema. Leída en `auth.js` (resolución de permisos), `data.js` (carga de roles), `admin-panel.js` (gestión de roles), `api.js` (admin de roles). Los permisos por rol se combinan con `Data.rolePermissions` + `profiles.custom_permissions`. |
| `audit_log` | **Auditoría** | Registro persistente de cambios del sistema. Tabla dedicada en `audit-log.js` (lectura/escritura del feed de auditoría), consumida por `admin-panel.js` (audit log feed admin) y `lobby.js` (actividad reciente). **Nota:** el código JS usa `audit_log` (singular), distinto de `audit_logs` (plural) que mencionan CLAUDE.md / el SQL de Fase A contabilidad — el JS de auditoría general apunta a `audit_log`. |

Auditoría/actividad complementaria (no de usuarios/roles/permisos pero registran actividad/cambios):
- `proyecto_actividad` — log de actividad por proyecto (`proyecto-detalle.js`).
- `evento_historial` — historial de cambios por evento (`api.js`).
- `cotizacion_timeline` — timeline de eventos por cotización (`api.js`).
- `pyme_sync_log` — log de sincronización con La PyME (`api.js`).
- `notifications` — notificaciones segmentadas por `target_user_id`/`target_role` (`api.js`).

No se encontró ninguna tabla explícita de "permisos" como entidad propia (no hay `.from('permisos')` ni `.from('permissions')`): los permisos viven en `roles` + `profiles.custom_permissions` + el objeto estático `Data.rolePermissions`.

### Confirmación de config Supabase
`config.js` confirma la URL del proyecto: `https://selnevalaeykdrgycvdz.supabase.co`. La anon key existe (`SUPABASE_ANON_KEY`, formato `sb_publishable_...`, no la expongo completa) y se crea `supabaseClient` con `window.supabase.createClient(...)`. Además define `LOBBY_API_URL = 'http://localhost:3002'` (backend admin con service_role, usado por `lobby-api/index.js`).