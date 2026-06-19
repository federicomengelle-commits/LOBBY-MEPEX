---
name: lobby-module-builder
description: Sistema completo para crear módulos nuevos o refactorizar módulos existentes en LOBBY-MEPEX. Usar siempre que el usuario pida crear un módulo nuevo, rediseñar/refactorizar un módulo existente, planificar fases de implementación, o generar prompts para Claude Code relacionados con módulos de LOBBY. También activar cuando mencione "inventario.js/crm.js/rendimiento.js como modelo", "patrón de módulo", "armar fases", "prompt para Claude Code", o cualquier referencia a implementar/mejorar módulos de la SPA. Incluye el patrón arquitectónico canónico, los globals REALES, el gotcha de permisos, anti-patrones, workflow SQL-first + verificación end-to-end en prod, y las lecciones de construcción verificadas.
---

# LOBBY Module Builder

Sistema para crear y refactorizar módulos de LOBBY-MEPEX siguiendo el patrón canónico.

> **Verificado 2026-06-18** construyendo el módulo `#rendimiento` de punta a punta (SQL → API → módulo → verificación en prod con Chrome). Los nombres de globals, el flujo de registro y las lecciones de abajo están groundeados contra el código que ANDA hoy. **Si algo de acá choca con el código actual, gana el código** — verificá antes de asumir (`CLAUDE.md` regla 12).

## Cuándo usar este skill

- Crear un módulo nuevo desde cero
- Refactorizar un módulo viejo al patrón actual
- Planificar fases de implementación
- Generar prompts para Claude Code
- Revisar si un módulo cumple el patrón

## Contexto del proyecto

```
Proyecto: LOBBY-MEPEX
Ruta: C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX
Branch: rediseno  →  push directo a main:  git push origin HEAD:main
Deploy: Fede pullea en el VPS con ~/pull-lobby.sh (el live NO se actualiza solo;
        recién con su pull). VPS sirve los estáticos en http://195.200.1.250
Stack: SPA vanilla JS (ES6+), Supabase (DB + Auth + Storage), hash routing,
       sin bundler / sin frameworks. + proxy Node en el VPS (:3000 vía nginx /api/)
       para integraciones server-side (La PyME, CRM digest IA).
Entorno: Windows 11. Shell por defecto = Bash POSIX; PowerShell para cosas Windows-only.
```

---

## 1. PATRÓN CANÓNICO

Todo módulo de LOBBY sigue esta estructura. **Referencias reales:** `inventario.js` (tabla + filtros + panel lateral CRUD), `crm.js` (tabs planas + ficha full-screen + composer), `rendimiento.js` (tabs + orquestador que REUSA otro subsistema + verificado en prod).

### 1.1 Estructura del objeto

```javascript
const NombreModule = {
    // ─── State (propiedades _priv) ───
    _activeTab: 'default_tab',
    _data: [], _filtered: [],
    _sortCol: 'nombre', _sortDir: 'asc', _searchQuery: '',
    _stylesInjected: false,

    // ═══ LIFECYCLE ═══
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        this._injectStyles();                 // inyecta <style> 1 sola vez
        const content = document.getElementById('mainContent');
        if (!content) return;
        content.innerHTML = this._buildShell();
        await this._loadData();
        this._attachEvents();
    },

    _buildShell() { return `<div class="PREFIX-wrap">…breadcrumb · título · tabs · body…</div>`; },
    async _loadData() { /* queries a supabaseClient, try/catch, fallback vacío */ },
    _renderBody() { /* switch por this._activeTab */ },
    _attachEvents() { /* addEventListener; NUNCA inline onclick */ },
};
```

### 1.2 Reglas de estructura

| Regla | Detalle |
|-------|---------|
| **Objeto global** | `const NombreModule = { … }` — NO clases, NO export, NO `this` perdido |
| **Render target** | `document.getElementById('mainContent')` |
| **Prefijo CSS** | prefijo único por módulo (`inv-`, `rend-`, `crm-`) para no colisionar |
| **Estilos** | `<style>` inyectado 1 vez (`_injectStyles` con guard `_stylesInjected`) o dentro de `_buildShell()`. NO en `style.css` global |
| **Breadcrumb** | `Lobby › CATEGORÍA › Módulo` con el color de la categoría |
| **Eventos** | `addEventListener` siempre. Botones de modal cierran con `data-modal-close` |
| **Soft delete** | columna `_deleted boolean DEFAULT false`; filtrar `.eq('_deleted', false)` |
| **Permisos** | guard de ruta por `module:` + `Data.isReadOnly(user.role, id)` para read-only. **Ver §1.5 (gotcha)** |
| **Dark theme** | bg `#050505`, card `#111111`, input `#1A1A1A`, border `#2a2a2a`, text `#E8E8E8` |
| **Fonts** | Outfit (`--font-main`) UI/títulos; Space Mono (`--font-mono`) labels/montos/badges |
| **Moneda** | `$` es-AR. Lobby general sin decimales; Costos con 2 decimales |

### 1.3 Colores de categoría (`data.js`)

```
Principal=#00A9C1 · Comercial=#F28D15 · Operaciones=#00CC88 · Activos/Recursos=#9B7DFF · Admin&Finanzas=#4A90D9
```

### 1.4 Registro en el sistema — son **4 cosas** (el viejo skill decía 3, faltaban data.js + el grant)

1. **Archivo JS** en la raíz: `modulo.js`.
2. **Script tag** en `index.html`: `<script src="modulo.js?v=1"></script>` (antes de `app.js`). **Bumpear `?v=` cada vez que tocás el archivo** o el browser cachea la versión vieja.
3. **Ruta en `router.js`**: `'modulo': { render: () => NombreModule.render(), requiresAuth: true, module: 'PERMISO' }`. (`adminOnly: true` si es admin-level.)
4. **`data.js`**: agregar el módulo a `modules` (def con icon/color/sections) + a la categoría correspondiente (`moduleIds`) + a `rolePermissions` (superadmin/admin como fallback offline).

### 1.5 ⚠️ GOTCHA DE PERMISOS (crítico — esto rompe módulos nuevos en silencio)

`Auth.getAccessLevel(moduleId)` resuelve en este orden y **NO tiene bypass de superadmin**:
1. `user.customPermissions` (override por usuario), 2. **`user._rolePermissions`** (de la tabla `roles` de Supabase, cargada al login), 3. fallback `Data.rolePermissions`.

Como normalmente `_rolePermissions` está seteado, si gateás la ruta con `module: 'miModulo'` y la tabla `roles` NO tiene ese permiso → **acceso denegado incluso para Fede, y el sidebar lo esconde** (`_renderSidebar` filtra por `Data.rolePermissions`, que post-login viene de la DB). Dos caminos:

- **(a) Gatear sobre un permiso existente** (ej. `module: 'finanzas'`): anda al toque para admin/superadmin, sin tocar la tabla `roles`. Pero el sidebar igual necesita el id en `rolePermissions` para mostrarlo.
- **(b) Permiso propio** (`module: 'miModulo'`): hay que **otorgarlo en la tabla `roles`** (parte del SQL):
  ```sql
  UPDATE roles SET permissions = COALESCE(permissions,'{}'::jsonb) || '{"miModulo":"write"}'::jsonb
   WHERE id IN ('superadmin','admin');
  ```
  + agregarlo a `Data.rolePermissions` (fallback). Sin el grant, no aparece ni deja entrar.

---

## 2. ANTI-PATRONES

### 2.1 localStorage como storage de negocio
```javascript
// ❌ localStorage para datos de negocio
localStorage.setItem(`ev_equipo_${id}`, JSON.stringify(equipo));
// ✅ TODO a Supabase (localStorage SOLO para preferencias de UI: sidebar state, último filtro…)
await supabaseClient.from('evento_equipo').upsert(rows);
```

### 2.2 Datos dummy hardcodeados en prod
```javascript
// ❌ this._events = this._getDummyEvents();   // 7 fake
// ✅ this._events = data || [];               // estado vacío limpio en UI
```

### 2.3 Estilos globales sin prefijo
```css
/* ❌ .table-wrapper {…}  → colisiona  */
/* ✅ .inv-table-wrapper {…}            */
```

### 2.4 Dual-write (localStorage + Supabase) → fuente de verdad ambigua
```javascript
// ✅ Supabase es la ÚNICA fuente de verdad
const { error } = await supabaseClient.from('evento_equipo').upsert(rows);
if (error) throw error;
```

### 2.5 Normalización manual de estados → valores limpios en DB + mapa de display directo.

### 2.6 Reimplementar un subsistema que ya existe
```javascript
// ❌ calcular precios / armar asientos a mano en el front
// ✅ REUSAR la plomería: el front nunca calcula contabilidad ni precios.
//    Costos → RPC calcular_receta.  Plata → crear egresos/comprobantes y el
//    asiento se genera SOLO por trigger.  Hacé un orquestador en api.js (ej.
//    pagarCostoEvento) que cree las filas; la cascada contable ya existe.
```

---

## 3. WORKFLOW — de la idea al módulo andando

### 3.1 Proceso (SQL-first)

```
1. PLANIFICAR: tabs · tablas SQL · permisos · qué subsistema reusar · 4-6 fases
2. SQL PRIMERO: DDL idempotente (CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE) +
   RLS + grant de rol (§1.5). Dárselo a Fede para correr en Supabase ANTES de
   pushear el JS, y esperar su OK. (Si los INSERT salen antes que el SQL, rompen.)
3. EJECUTAR cada fase → node --check modulo.js api.js → commit → push a main.
4. VERIFICAR end-to-end en prod (ver §3.4) → limpiar data de prueba.
5. CERRAR: actualizar PROGRESO.md/PLAN-MAESTRO (% ) + CLAUDE.md §10 + tabla de módulos.
```

### 3.2 Reglas duras (CLAUDE.md)
- **SQL-first**: SQL en Supabase → después push del JS.
- **Schema real > SQL del repo (regla 12)**: verificá columnas/tipos/CHECK contra `docs/schema-prod.md` o `information_schema`/REST antes de tocar tablas o escribir inserts.
- **RLS por la matriz**: tablas nuevas con 4 políticas explícitas (SELECT/INSERT/UPDATE/DELETE) usando `fn_role_can('modulo','read')` y `'write'`. **Nunca `FOR ALL`** (llamar `fn_role_can` con 1 arg defaultea a `'read'` → daría escritura a lectores).
- **Cambios a subsistemas compartidos** (Finanzas/Contabilidad): NO aplicar SQL de prod solo; avisar (ej. a Sofi) + test idempotente.
- **Bisturí**: no tocar lo que funciona; cambios mínimos.

### 3.3 Fases típicas
```
Módulo nuevo:   F1 SQL+shell+tabs+router+index+data.js → F2 tabs lectura (tabla+filtros+panel)
                → F3 tabs escritura (modales+CRUD) → F4 features/orquestadores → F5 dashboard
Refactor viejo: F1 localStorage→Supabase → F2 shell (breadcrumb/tabs/prefijo) → F3 data layer
                (sacar dummy) → F4 panel (_openPanel/_closePanel) → F5 limpieza
```

### 3.4 Verificación END-TO-END en prod (mucho más fuerte que "F12 + visual")
El "F12 consola + navegar + visual" del workflow viejo es **insuficiente** — construyendo Rendimiento, eso no cazaba los bugs; la verificación end-to-end sí cazó 2 (CHECK constraints no documentados).

```
□ node --check de cada .js tocado (sintaxis)
□ ¿el módulo escribe/lee prod y necesita login? → verificá en el browser de Fede
  (Chrome MCP) ya autenticado, NO en preview local headless.
□ Ejercitar el FLUJO REAL: crear data de prueba → correr la acción → confirmar el
  EFECTO en la DB (ej. el egreso generó su asiento balanceado; el estado cambió por trigger).
□ LIMPIAR toda la data de prueba al final (soft-delete / borrar). Nunca dejar basura en prod.
□ Cero errores de consola.
```

### 3.5 Plantilla de prompt para Claude Code
```
> Contexto: LOBBY-MEPEX en C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX,
> branch rediseno. SPA vanilla JS + Supabase, dark theme. [estado del módulo si aplica]
> Tarea: [qué hacer en esta fase]
> Detalle: [crear/modificar qué, queries, estilos, permisos, comportamiento]
> Reglas: patrón de inventario.js/crm.js · supabaseClient (NO API.supabase) ·
>   dark theme MEPEX · Outfit+Space Mono · soft delete _deleted · SQL-first ·
>   verificar schema real · registrar en data.js+router.js+index.html (?v=) + grant de rol.
> Commit: feat(modulo): … · NO tocar archivos fuera de esta fase.
```

---

## 4. REFERENCIA RÁPIDA (globals REALES)

```javascript
supabaseClient            // ⚠️ GLOBAL directo (NO "API.supabase"). supabaseClient.from('tabla')…
API.*                     // métodos CRUD de api.js (getClients, createEgreso, …). _uid()/_today() helpers
Auth.getUser()            // { uid, role, name, _rolePermissions, customPermissions } — usar .uid para created_by
Auth.isSuperAdmin()       // role === 'superadmin' (SIN bypass en getAccessLevel — ver §1.5)
Auth.isAdminLevel()       // superadmin || admin
Auth.hasAccess(id) / Auth.getAccessLevel(id)   // 'write' | 'read' | 'none'
Data.isReadOnly(role, id) · Data.rolePermissions · Data.categories
Router.navigate(hash) · Router.getHash()
Toast.success/error/warning/info(msg)
Modal.open({ title, body, size:'sm'|'md'|'lg', footer })  // footer con [data-modal-close] auto-cierra
Modal.closeAll() · Modal.confirm({...})
Confirm.action(title, msg) · Confirm.delete(nombre)        // devuelven Promise<boolean>
Components / FormBuilder / ContextMenu
```

### Roles
```
superadmin → todo + admin-panel   ·   admin → todo menos admin-panel
venta → CRM/cotizador/catálogo   ·   pm → proyectos/eventos/…   ·   taller → taller/inventario (no costos)
```

### Tablas de referencia (nombres REALES — sin sufijo _2026)
```
eventos · proyectos · clientes · personas · proveedor (UUID)
catalogo_items (bigint) · insumos_base (bigint) · receta_componentes
egresos · ingresos · comprobantes (emitidos) · comprobantes_recibidos · asientos · asiento_lineas · mapeo_cuentas
profiles · roles (permissions jsonb) · notifications · audit_log
```

---

## 5. LECCIONES DE CONSTRUCCIÓN (verificadas, 2026-06-18 — Rendimiento)

1. **Reusá la plomería, no la reinventes.** Para plata: creá `egresos` (y `comprobantes_recibidos` si hay factura) y el asiento se arma SOLO por `trg_asiento_auto_egreso`. Hacé un orquestador en `api.js` (`pagarCostoEvento`) que encadene comprobante→egreso→link→pago. El front nunca toca `asientos`.
2. **El asiento solo postea si el egreso tiene `cuenta_id`** (cuenta de tesorería vinculada a `plan_cuentas`). Sin cuenta, el egreso queda registrado pero sin asiento (diseño de Finanzas, no bug). Avisalo en la UI.
3. **Las tablas relacionadas tienen taxonomías/CHECK PROPIAS.** No asumas que un enum se comparte. Ej. real que rompió inserts: `comprobantes_recibidos.categoria` ∈ {material,servicio,alquiler,credito_fiscal,logistica,otro} (NO acepta `proveedor`/`rrhh`, que sí valen en `egresos.categoria`); y `comprobantes_recibidos.tipo` = `factura_a` (no `A`). **Antes de insertar en una tabla ajena, probá los valores válidos** (query distinct, o leé el mapa de opciones del modal de ese módulo, ej. `_catRecibido`/`_tipoCompRecibed` en `finanzas.js`).
4. **mapeo_cuentas debe cubrir la categoría** del egreso/ingreso o el asiento sale en silencio (sin error). Verificá el mapeo antes de habilitar pagos.
5. **Verificá end-to-end en prod con cleanup** (§3.4). Cazó 2 bugs de CHECK que ni el blueprint mencionaba. "F12 + visual" no alcanza.
6. **El deploy NO es instantáneo:** pusheás a `main`, pero el live cambia recién cuando Fede corre `~/pull-lobby.sh`. Bumpeá `?v=` siempre.
7. **Las memorias/planes driftean.** Antes de "construir lo pendiente", verificá contra el CÓDIGO actual — puede estar ya hecho (pasó con Costos UX: una memoria lo daba pendiente y estaba implementado).
8. **Cerrá con docs:** PROGRESO.md (hecho+%) / PLAN-MAESTRO (falta, baja %) — regla de los 2 archivos — + CLAUDE.md §10 + tabla de módulos.
