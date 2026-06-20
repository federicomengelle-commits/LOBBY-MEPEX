# Auditoría de módulos — LOBBY-MEPEX

> **Fecha:** 2026-06-18 · **Método:** 5 agentes en paralelo auditando ~22 archivos contra el patrón canónico (`docs/lobby-module-builder-SKILL-v2.md`), + síntesis crítica. Cada hallazgo tiene **evidencia** (archivo:línea) y **confianza** (`confirmado` / `probable` / `a-verificar`). Se descartaron los falsos positivos (este repo tiene historial de bug-hunts inflados — ver Apéndice).
>
> **Dos partes:** **A) 🐛 Errores** · **B) ✨ Mejoras + 💡 Ideas**. Arriba, lo transversal (más palanca).

---

## 🎯 Top prioridad (si tocás algo, esto primero)

| # | Qué | Dónde | Por qué |
|---|-----|-------|---------|
| 1 | **Router sin teardown de módulos** | `router.js` (transversal) | 1 fix arregla ~4 leaks de listeners de una. Es la corrección de mayor palanca. |
| 2 | **eventos.js — localStorage + dummy data vivos** | `eventos.js` | El único módulo con anti-patrones de DATOS vivos: dual-write a localStorage + 7 eventos ficticios servibles en prod. |
| 3 | **Escapado HTML faltante (XSS) en legacy** | `modules.js`, `locaciones.js`, `eventos.js` | Datos de usuario crudos en `innerHTML`. Threat model interno → no urgente, pero es la superficie de inyección real. |
| 4 | **inventario.js — stock no atómico** | `inventario.js` | Conocido; los agentes sumaron: tampoco chequea `.error` ni hace rollback. RPC `stock+=delta` lo cierra. |
| 5 | **rrhh.js — `render()` sin guard de rol** | `rrhh.js:64` | Expone CUIL/CBU/sueldos; hoy solo lo protege el router. Defensa en profundidad. |

---

## 🔁 Hallazgos TRANSVERSALES (la raíz de varios síntomas)

### T1 · El router no destruye módulos → leaks de listeners `[confirmado]`
`router.js` despacha `Modulo.render()` y reemplaza `#mainContent.innerHTML`, pero **nunca llama `destroy()`** ni desmonta los listeners globales del módulo saliente. Consecuencias reales:
- `calendario-operativo.js` **tiene** un `destroy()` (desconecta IntersectionObservers + remueve `keydown`) que es **código muerto** — nunca se invoca. Cada visita acumula un `keydown` global vivo (los `+`/`-`/`Esc` siguen activos en otras pantallas).
- `proyecto-detalle.js:1006` — `document.addEventListener('click', …)` para cerrar el dropdown de estado, sin cleanup; se re-arma en cada `_changeStatus`/`_pasarATaller` (re-render del shell) → se acumula.
- `crm.js:979` y `:2867` — el `escHandler` solo hace `removeEventListener` **dentro de la rama `Escape`**; si cerrás el panel con la X o navegando, queda colgado → uno por apertura.
- `app.js:516` y `notifications.js:47` — listeners/polling globales sin teardown (hoy impacto nulo porque son singletons que no se re-montan, pero quedan en la misma categoría).

**Fix de raíz (1 cambio):** que el router guarde el módulo actual y haga `this._prevModule?.destroy?.()` antes de renderizar el siguiente. Después, cada módulo que ate listeners a `document` expone un `destroy()`. Convierte ~4 hallazgos BAJA en una sola corrección estructural.

### T2 · Escapado HTML inconsistente (XSS interno) `[confirmado]`
Los módulos **nuevos** (`tareas.js`, `notifications.js`, `inventario.js`, `crm.js`, taller/logística/flota) escapan con `_esc`/`_escAttr`. Los **viejos** NO:
- `modules.js` — interpola **todo** dato de usuario crudo en `innerHTML` (`${item.name}`, `${i.resumen}`, notas…). No define ningún `_esc`. Un cliente llamado `<img onerror=...>` ejecuta script.
- `locaciones.js` — idem; además mete `foto_url`/`archivo_url` crudo en `style="background-image:url('…')"` y `href`.
- `eventos.js`, `calendar.js` — mismo patrón legacy.

Threat model = equipo interno confiable → **MEDIA, no ALTA**. Fix: un `_esc()` global compartido (ya existe el patrón en los módulos nuevos) aplicado a los renders del legacy.

---

# PARTE A — 🐛 ERRORES

### ALTA

**A1 · `eventos.js` — localStorage como almacén de negocio (dual-write) + dummy data servible `[confirmado]`**
- `_getLocalData`/`_saveLocalData` leen/escriben `ev_ext_${id}` (`eventos.js:325-338`); `_loadEvents` los mergea en cada evento (`:266`). Hoy persiste `teardownEndDate` (fecha de desarme) — dato de negocio que **no se comparte entre navegadores/usuarios**. El propio código admite que "se limpia en 2.2" pero el dual-write sigue. Debería ir a la columna real `fecha_desarme_fin` (ya existe).
- `_getDummyEvents()` (`:2988-3040`) = 7 eventos ficticios ("Expo Alimentek 2026"…) usados como **fallback en prod** si `API.getEvents()` vuelve vacío o falla (`:268-271`). Con IDs `ev-001…` que no existen → cualquier click posterior opera sobre un fantasma. **Borrar el fallback** (ya existe `.ev-empty` para empty-state real).
- *(menor, mismo archivo)* modal de transporte (`_openAddMovimientoModal`) consulta tablas **legacy** `logistica_vehiculos` (`:1862`) y `rrhh_personal` (`:1878`), mientras el resto del archivo ya usa `personas`/`cargas`. Doble `_ROLES_OP` declarado (`:812` y `:1237`, la 2ª pisa la 1ª). Clase cross-módulo `rh-tipo-tag` en panel de eventos.

### MEDIA

**A2 · `modules.js` — XSS sistémico (cero escapado).** Ver T2. Evidencia: `_loadClientResumen` (`:3398-3401`), `_renderClientsTable`. `[confirmado]`
También: 2 `console.log` de debug en prod (`:239`, `:437`). `[confirmado]`

**A3 · `locaciones.js` — el módulo más alejado del patrón `[confirmado]`** (3 hallazgos, todos quick-win):
- Sin `_esc`/`_escAttr`: interpola `nombre`/`direccion`/`notas`/`foto_url`/`archivo_url` crudo (`:266,273,337,550,816`).
- **3 `onclick="Modal.close()"` inline** (`:414,644,912`) — viola "addEventListener, nunca inline onclick". Los otros módulos usan `data-modal-close`.
- Tablas BIGINT (`locaciones`/`_documentos`/`_stock`) con `parseInt` en todas las FKs (`:659,927-929`) — legacy vs UUID del resto.

**A4 · `settings.js` — botón "Resetear contraseña" roto `[confirmado]`.** `_openResetPasswordModal` (`:763`) usa `supabaseClient.auth.admin.updateUserById(...)`, que **requiere service-role key** → con el anon key del cliente **siempre falla** (cae a "hacelo desde el dashboard"). Hay **dos pantallas de reset**: ésta (rota) y la de `admin-panel.js` que usa `API.adminResetPassword` (funciona). → apuntar settings a la API buena, o sacar el botón.

**A5 · `rrhh.js` — `render()` sin guard de rol `[confirmado]`.** `:64-72` solo checa `if (!user)`. A diferencia de finanzas/costos (`Auth.isAdminLevel()`), no restringe por rol; la única defensa es el guard genérico del router (`module:'rrhh'`). Expone nómina/CUIL/CBU/sueldos. Recomendado: `if (!Auth.isAdminLevel()) return Router.navigate('lobby')` (defensa en profundidad).

**A6 · `contabilidad.js` — totales del Libro Diario truncados a 1000 filas `[confirmado]`.** `:2685-2710`: el `count` sale exacto, pero `_diarioTotales.debe/haber` se reduce sobre `countRes.data`, que Supabase **capa a 1000 filas** sin `.range`. Con >1000 asientos en el rango, los totales quedan **subvaluados**. Hoy hay ~4 asientos → latente. Fix: sumar vía agregación SQL/RPC o paginar.

**A7 · `inventario.js` — stock update no atómico + sin error-check + secuencial `[confirmado]`.** `:2126-2134` (y gemelos `:2251,:2398,:3061`): read-modify-write con `item.stock` cacheado (`current + qty`). Matices nuevos sobre lo ya conocido: (a) los `update` **no chequean `.error`** → si falla a mitad del `for`, queda estado parcial sin rollback; (b) el loop es `await` **secuencial**. Fix real = RPC `stock = stock + delta` (atómico, resuelve la race y el rollback).

**A8 · `calendario-operativo.js` — `destroy()` muerto + docs por localStorage divergentes `[confirmado]`.** Ver T1 (leak). Además: `_loadEvents` lee docs desde `localStorage('ev_docs_${id}')` (`:263`) porque `evento_documentos` "tiene schema desalineado", **pero** el panel usa `API.getEventDocumentos` (`:1017`) → la lista y el panel muestran **fuentes distintas**. (El `co_events_cache` sí es caché de UI legítimo.) Sin guard `Data.isReadOnly` (es read-only de facto, bajo riesgo).

**A9 · `tareas.js` — generador "Reponer stock" sobre columnas fantasma `[probable]`.** `_gen.inventario` (`:251`) lee `insumos_base.stock_actual`/`stock_minimo`, que **están sin usar** (la UI real usa `stock`, ya anotado en CLAUDE.md) → la fuente probablemente **nunca dispara** (queda vacía en silencio por el `try/catch` de `_safe`). Usar `stock`, o confirmar schema.

### BAJA

- **`lobby.js` — actividad ficticia visible `[confirmado]`.** `_loadActivityFeed` (`:548`) cae a `Data.recentActivity` (mock con nombres/cotizaciones inventadas, `data.js:128`) cuando `audit_log` vuelve vacío → un admin ve actividad falsa como real. Vaciar el feed si no hay datos.
- **`admin-panel.js` `[confirmado]`.** `render()` (`:122`) sin `Auth.isSuperAdmin()` (confía 100% en el router; es el único de su grupo que toca audit completo + roles sin doble check). Selector CSS frágil `[style*="${color}"]` (`:1373`) — si dos roles comparten color, actualiza el contador equivocado.
- **`compras.js` `[confirmado/probable]`.** `adminOnly` ausente en el router (`router.js:94`) pese al header "Solo superadmin y admin" — inconsistente con cómo se protegió `rendimiento` (`:102`). Auto-migración `_migrateOldProveedores` inserta dentro de un load (`:537-584`): guardada con flag 1-vez + check de tabla vacía, pero sin `unique`/dedupe → duplicados si 2 sesiones abren Compras vacía a la vez (impacto casi nulo).
- **`flota.js` `[probable]`.** `_norm` (`:426`) usa regex de combining marks con caracteres literales en vez de `̀-ͯ` → frágil si el archivo se re-guarda con otra codificación. (Mismo patrón en otros módulos.)
- **`catalogo.js` / `compras.js` `[confirmado]`.** 7 `onclick="Modal.close()"` inline (cancelar de Modal global; trivial pero viola la regla). `catalogo.js:605` `value="${val}"` sin escapar — rompe el input si un `codigo` tiene `"`.
- **`taller.js` `[confirmado]`.** `_togglePill` (`:588`) llama `API.setEstadoTaller` **sin `await`** mientras la UI ya asume `en_armado` → si el write falla, el badge local queda desincronizado de la DB.
- **`notifications.js` `[confirmado, impacto nulo]`.** `setInterval` de polling + listeners sin teardown (singleton, no se re-monta hoy).

---

# PARTE B — ✨ MEJORAS + 💡 IDEAS

### Refactors al patrón / consistencia
- **`router.js` lifecycle de `destroy()`** (T1) — la mejora de mayor palanca. Habilita limpiar los leaks de calendario/proyecto-detalle/crm.
- **`_esc()` global compartido** (T2) — aplicarlo al legacy (`modules.js`, `locaciones.js`, `eventos.js`, `calendar.js`). El helper ya existe en los módulos nuevos.
- **`eventos.js` — refactor de raíz** (es el candidato #1): arrastra 3 generaciones de schema (`rrhh_asignaciones`→`asignaciones_evento`, `logistica_movimientos`→`cargas`, localStorage→columnas). Hacerlo cuando se cierre el cleanup de tablas legacy.
- **`proyectos.js` — búsqueda accent-insensitive `[confirmado]`.** `_applyFilters` (`:372`) usa `toLowerCase()` plano; "iluminacion" no matchea "Iluminación". Usar `normStr` (global, ya lo usa eventos.js).
- **Duplicación "Usuarios y Roles"** entre `settings.js` (`#admin-usuarios`) y `admin-panel.js` (tab Usuarios) — dos UIs para lo mismo, mantenimiento doble. Consolidar.
- **`rrhh.js` — centralizar CRUD de `personas` en `api.js`** (hoy mezcla `API.*` + `supabaseClient` directo; el mapeo vive en `_mapPersonaToLegacyShape`).
- **`locaciones.js` — los 3 quick-win** (esc + sacar onclick inline) lo alinean al patrón.

### Performance
- **`finanzas.js:5856` — KPI "Saldo disponible" N+1 secuencial `[confirmado]`.** Loop sobre cuentas con 2 `await` por cuenta. Paralelizar con `Promise.all` o, mejor, leer `saldos_mensuales` (ya materializado por trigger) en vez de full-scan de ingresos/egresos en vivo.
- **`contabilidad.js:3122` — Libro Mayor sin filtro de fecha `[confirmado]`.** Trae toda la historia de la cuenta y parte por período en JS; no escala para Caja/Banco multi-año. Pushear el filtro al server.
- **`inventario.js`** — el loop de stock secuencial → `Promise.all` (además del fix atómico A7).
- **`taller.js`** — `_setEstado*` hace re-render total de `_renderHoy()` en vez de patch parcial de la card (ya tiene `_refreshCardMeta` quirúrgico para imitar).

### 💡 Ideas de producto
- **KPIs reales en el Lobby**: "Cobros pendientes" (`lobby.js:146`) hoy es un placeholder que suma cotizaciones; con Finanzas operativo ya se puede leer el saldo real.
- **`saldos_mensuales` como fuente única de saldo** — finanzas y contabilidad computan saldo por caminos distintos (riesgo de divergencia que ya se vio: $8.75M vs $6.5M, ya arreglado una vez). Unificar contra el materializado.
- **Split de `crm.js`** (7154 líneas, el más grande) por tab si se vuelve a tocar pesado — no urgente.
- **Costos**: el preview "Costo MP" del editor (`costos.js:2304`) recalcula desperdicio en JS replicando la RPC → si la fórmula de la RPC cambia, el preview se desincroniza (riesgo visual, no de datos). Que el preview muestre el último snapshot.

---

## ✅ Apéndice — módulos LIMPIOS y falsos positivos descartados

**Módulos de referencia (patrón canónico bien aplicado):** `proyectos.js`, `flota.js`, `remito-pdf.js`, `costos.js`, `inventario.js` (gold-standard de cleanup de listeners: guarda el `_panelEscHandler` en state, lo remueve antes de re-add y lo nullea al cerrar — **copiar ese patrón para arreglar crm.js**), `rendimiento.js` (recién construido). `tareas.js` = modelo de carga defensiva (cada fuente en `try/catch`, queries batch con `.in()`, sin N+1).

**Falsos positivos descartados (NO re-reportar):**
- ❌ "Falta `_deleted` en `asiento_lineas`" — la columna no existe; el soft-delete vive en `asientos` y todas las queries lo filtran ahí. Reconfirmado falso.
- ❌ `costos.js` "calcula precios en el front" — el preview de MP es solo visual; la fuente es la RPC `calcular_receta`. Los `panel.onclick=` son asignación JS con cleanup, no inline-HTML.
- ❌ "Falta guard de permisos en taller/logística/flota" — el guard está centralizado en `router.js` (`module:'x'`), es el patrón correcto del repo.
- ❌ `clientes` columnas rotadas — ya mapeado en `api.js` (conocido, no es nuevo).
- ❌ `this` perdido — los handlers usan arrow functions; no se halló.
- ❌ "116 inline `style=` en rrhh" = styling inline en template literals (todo el repo lo hace), NO el anti-patrón de clases CSS sin prefijo (rrhh usa `.hr-`/`.rh-`).

**Corrección de doc:** `modules.js` tiene **4354 líneas**, no ~7100 como dice `CLAUDE.md §5`. `lobby.js` define `Lobby`. Actualizar el doc.
