# Plan de ejecución · Módulo Tareas + Push VAPID

**Responde a:** `01-INSTRUCCIONES-CLAUDE-MODULO-TAREAS.md` (Fase 0) + `02-PLAN-VAPID-PUSH-NOTIFICATIONS.md` (Paso 1)
**Fecha:** 2026-07-28 · **Actualizado:** 2026-07-29

## ESTADO

| Etapa | Estado |
|---|---|
| **E1** · SQL + RLS real | ✅ **corrido en prod por Fede** (+ delta `sql/tareas_v2_fix_rol_check.sql` pendiente) |
| **E2** · Fan-out de notificación | ✅ construido y verificado en preview |
| **E3** · Kanban + asignación múltiple | ✅ construido y verificado en preview |
| **E4** · PWA (manifest + SW + iconos) | ✅ construido · ⏳ falta deploy nginx |
| **E5** · Suscripciones push | ✅ código listo · ⛔ **bloqueada: faltan las claves VAPID + `npm install web-push` en el VPS** |
| **E6** · Envío atado al urgente | ✅ construido · se activa cuando E5 esté deployada |
| **E7** · Matriz del Paso 9 | ⏸ **espera decisión de Fede** (tabla precargada más abajo) |
| **E8** · Guía de instalación | ✅ `docs/guia-instalar-app-celular.md` |

**Nada está commiteado todavía** — todo vive en el working tree.

### Lo que falta que haga Fede

1. Correr **`sql/tareas_v2_fix_rol_check.sql`** (5 segundos, lo pidió el security-reviewer).
2. **Claves VAPID:** `npx web-push generate-vapid-keys` → guardar el par en el gestor de contraseñas.
   - ⚠️ **`config.js` está en `.gitignore`** (tiene las credenciales de Supabase), así que **NO viaja por `git pull`**. La clave **pública** hay que pegarla a mano en `/home/mepex/lobby/config.js` del VPS:
     ```js
     const VAPID_PUBLIC_KEY = 'B...';   // la MISMA que la del .env, si no: InvalidStateError
     ```
     (En tu copia local ya está la línea con el valor vacío y el comentario.)
   - Las tres variables (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) van al `.env` del proxy.
   - **La privada no me la pases por chat** — el chat enmascara las keys al copiar. Va del gestor al `.env` directo.
3. **VPS:** verificar que `SUPABASE_SERVICE_ROLE_KEY` esté en `/home/mepex/api/.env` · `cd /home/mepex/api && npm install web-push` · `cp /home/mepex/lobby/tools/vps/{push.js,server.js} /home/mepex/api/` · `pm2 restart mepex-api`.
4. **nginx:** `sudo cp /home/mepex/lobby/tools/vps/nginx-mepex.conf /etc/nginx/sites-enabled/mepex && sudo nginx -t && sudo systemctl reload nginx` (suma `worker-src`/`manifest-src` a la CSP, el `no-cache` del service worker y el `X-Forwarded-For` que le faltaba a `/api/`).
5. Tildar la **matriz de E7**.

---

## PARTE A · Reconocimiento (Fase 0 del doc 01 + Paso 1 del doc 02)

### A.1 · Lo que YA existe y se reusa

| Lo que pide Jordi | Qué hay hoy en LOBBY-MEPEX | Veredicto |
|---|---|---|
| Tabla `tasks` | **`public.tareas`** (`sql/fase11_tareas.sql`, en prod) — id uuid, titulo, descripcion, origen, modulo, proyecto_id, **evento_id**, responsable_id, target_role, estado, prioridad, **fecha_limite**, es_derivada, dedupe_key, created_by, completada_por, completada_at, _deleted | ✅ **EXTENDER, no crear** |
| `status` enum Kanban | `estado` CHECK `pendiente / en_curso / hecha / cancelada / bloqueada` | ✅ **Las 4 columnas de Jordi ya existen** (Pendiente→En proceso=`en_curso`→Bloqueada→Hecha). `cancelada` queda fuera del tablero. |
| `completed_at` / `completed_by` | `completada_at` / `completada_por` | ✅ ya está |
| `due_date` | `fecha_limite` (date) | ✅ ya está |
| Notificaciones in-app (campanita) | **`public.notifications`** + `notifications.js` (campana en header, 2 pestañas Novedades/Pendientes, polling 30s + refresh on focus, leído por `leida_por JSONB[]`, silenciado por categoría en localStorage). API: `API.getNotifications / createNotification / markNotificationRead / markAllNotificationsRead` (`api.js:4076-4178`) | ✅ **EXTENDER, no tocar la base** |
| Helper Postgres para el rol | **`fn_user_role()`** y **`fn_role_can(modulo, need)`** — `STABLE SECURITY DEFINER`, leen `profiles.role` + matriz `roles.permissions` (`sql/rls_capa2_motor.sql`). Sin recursión de policies, superadmin short-circuit. | ✅ **exactamente lo que pide §5.2 del doc 01** |
| Kanban con drag & drop | `crm.js:1716` (pipeline cotizaciones) y `crm.js:3923` (pipeline casos) — HTML5 DnD nativo, sin librerías | ✅ **calcar ese patrón** |
| Módulo Eventos | `public.eventos` (nombre, predio, `fecha_armado_inicio/fin`, `fecha_inicio/fin`, `fecha_desarme_*`). **No tiene columna `estado`**: el estado se deriva de las fechas (`eventos.js _deriveEstado`) | ⚠️ dato para la matriz del Paso 9 |
| Backend server-side | VPS `mepex-api` (pm2, :3000, nginx `/api/`). **`tools/vps/auth-middleware.js` ya trae `requireAuth` / `requireRole` / `rateLimit`**; `req.user.id` sale del token verificado contra Supabase | ✅ el `user_id` de la suscripción sale de la sesión del servidor, como exige §13 del doc 02 |
| HTTPS | `https://app.mepex.com.ar` con Let's Encrypt + HSTS + CSP enforcing | ✅ requisito de Web Push cubierto |
| Roles reales | `superadmin` · `admin` · `pm` · `venta` · `taller` (tabla `roles`, columna `permissions` JSONB, editable desde Panel) | ✅ mapeo 1:1 con los conceptuales de Jordi (ver A.4) |

### A.2 · Lo que FALTA (el trabajo real)

| # | Falta | Gravedad |
|---|---|---|
| 1 | **RLS de `tareas` está ABIERTA**: `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. Cualquier usuario logueado lee, edita y borra **todas** las tareas desde la consola del navegador. | 🔴 **Es el hallazgo más grave.** Es exactamente lo que el doc 01 §5 llama "no es seguridad". |
| 2 | Asignación **múltiple**: hoy es `responsable_id` (1 persona) **o** `target_role` (1 rol). Jordi pide N roles + N personas mezclados → falta `task_assignees`. | 🔴 bloquea el tagueo estilo Discord |
| 3 | `task_activity` (historial de cambios de estado) | 🟠 |
| 4 | `is_urgent` (el gatillo del push). Hoy hay `prioridad` normal/alta/critica — **no es lo mismo** y no conviene reusarla: la prioridad es visual, el urgente interrumpe un celular. | 🟠 |
| 5 | `categoria` (evento/marketing/comercial/operaciones). Hoy hay `modulo` (17 valores para deep-link) que **no** es la categoría de Jordi. | 🟠 |
| 6 | Vista Kanban (hoy: lista agrupada por vencimiento — Vencidas/Hoy/Semana/Sin fecha) | 🟠 |
| 7 | Fan-out de notificación: `Tareas._notify` (`tareas.js:711`) manda **1 fila a 1 rol**, sin expandir a usuarios, sin deduplicar, sin excluir al creador. | 🟠 |
| 8 | **La app NO es PWA**: no hay `manifest.json`, no hay service worker, no hay iconos 192/512/badge. Solo `assets/logo_full.png` y `assets/mepex_iso.png`. | 🔴 **sin esto no hay push en iPhone** |
| 9 | Todo el push: tabla `push_subscriptions`, claves VAPID, `/api/push/*`, `web-push` en el VPS, toggle en el perfil. | 🔴 |

### A.3 · Relevamiento específico de Push (Paso 1 del doc 02)

1. **Framework**: vanilla JS SPA, **sin build step**. → **`process.env` NO EXISTE.** La clave pública VAPID va como constante en `config.js` (es pública, no hay problema); la privada solo en el `.env` del VPS. Nada de prefijos `NEXT_PUBLIC_`/`VITE_`.
2. **Carpeta pública** = raíz del repo, servida por nginx desde `/home/mepex/lobby`. → `sw.js` y `manifest.json` van en la **raíz del repo** y quedan servidos en `/sw.js` y `/manifest.json`. El `try_files $uri $uri/ /index.html` los sirve bien porque el archivo existe.
3. **Service worker existente: NO HAY.** No se pisa nada. Ventaja: arrancamos limpio. Desventaja: el riesgo de cachear mal recae 100% en nosotros → mitigación en E4.
4. **Backend**: `mepex-api` (`tools/vps/server.js` → `/home/mepex/api/server.js`). Deploy = `cp` + `pm2 restart mepex-api`. Ahí va `web-push` y la clave privada.
5. **Secretos**: `.env` en `/home/mepex/api/`. Ya viven ahí `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, certificados ARCA. ⚠️ **A verificar en E5: si `SUPABASE_SERVICE_ROLE_KEY` está cargada** (el auth-middleware la trata como opcional). El envío de push la necesita.
6. **CSP**: `default-src 'self'` sin `worker-src` explícito → cae en `script-src 'self'` = **`/sw.js` pasa sin cambios**. Igual conviene declarar `worker-src 'self'` y `manifest-src 'self'` explícitos para que no dependa de un fallback. **`connect-src` no necesita cambios**: los endpoints de push son same-origin (`/api/push/*`).
7. **Carga diferida**: `index.html` solo trae 7 scripts core; el resto lo inyecta `App._APP_SCRIPTS` (app.js). ⚠️ **Los `?v=` de los módulos diferidos se bumpean en `app.js`, NO en index.html.**

### A.4 · Mapeo de roles

| Jordi (conceptual) | LOBBY-MEPEX (real) | Personas |
|---|---|---|
| `super_admin` | **`superadmin`** | Fede |
| `admin_finanzas` | **`admin`** | Lelean, Sofi |
| `project_manager` | **`pm`** | Meli, Leo |
| `taller` | **`taller`** | Diego, Juan, Carlos, Willy |
| `ventas` | **`venta`** (singular) | Noe |

### A.5 · El riesgo que ningún documento contempla: las **tareas derivadas**

El Centro de Tareas actual **no es solo una tabla**. `tareas.js` tiene **7 generadores client-side** (`_gen`: taller, compras, rrhh, finanzas, inventario, locaciones, flota, crm, eventos) que **derivan tareas al vuelo** de otras tablas (checklists de proyecto, OCs pendientes, documentos por vencer, rutinas...). Esas tareas **no existen como filas** hasta que alguien las "toma" (claim por `dedupe_key`).

Consecuencia para este plan:

- Una tarea derivada **no puede tener** filas en `tarea_asignados` (no existe todavía).
- La visibilidad de las derivadas ya se resuelve hoy en cliente con `Tareas._visibility()` (rol → módulos).
- **Decisión de diseño (D2 abajo)**: el Kanban nuevo tiene que decidir si muestra derivadas o no. Si las muestra, la RLS no las gobierna (no están en la DB) y el criterio de aceptación "el rol taller ve únicamente lo suyo" se cumple para las manuales pero para las derivadas sigue siendo un filtro de cliente.

**Recomendación:** el tablero muestra **ambas**, pero las derivadas se marcan visualmente como automáticas y su visibilidad sigue gobernada por `_visibility()` (que ya está bien alineada por rol). Al claimearlas se materializan como fila y pasan a estar bajo RLS. Esto no rompe nada de lo que anda hoy.

---

## PARTE B · Decisiones — ✅ CERRADAS con Fede (2026-07-28)

> D1 · **Conviven Lista + Tablero** · D2 · **Las derivadas entran, con chip `⚙️ auto`** ·
> D3 · **`superadmin` + `admin` + `pm` asignan; urgente solo `superadmin`; borrar `superadmin`+`admin`** ·
> D5 · **Sí, la instalación en celulares se hace con el equipo** → E4-E6 van.
>
> Queda **una sola** abierta, la marco en D6 al pie.

**D1 · ¿El Kanban reemplaza la lista actual o convive?**
La vista de hoy (Vencidas / Hoy / Esta semana / Sin fecha) es una **bandeja personal**, muy útil para el taller desde el celular. El Kanban es una vista de **gestión**.
→ **Recomendado: conviven.** Dos botones arriba: `📋 Lista` (default en mobile) · `📊 Tablero` (default en desktop). Se suma a las secciones que ya existen (`Tareas` / `Rutinas`). Coste extra: bajo. Riesgo de romper el flujo actual del taller: cero.

**D2 · ¿Las tareas automáticas (derivadas) entran al Kanban?**
→ **Recomendado: sí, con un chip `⚙️ auto`** y bajo el filtro de rol actual. Ver A.5.

**D3 · ¿Quién crea y quién asigna?**
Jordi propone por defecto "cualquiera crea, solo super_admin asigna a otros". Acá ya hay `admin` y `pm` que gestionan equipo (la vista "Del equipo" hoy es `superadmin/admin/pm`).
→ **Recomendado:** cualquiera crea tareas para sí mismo; **`superadmin` + `admin` + `pm` asignan a otros roles/personas**; solo `superadmin` marca urgente (el push es un recurso escaso); borrar = `superadmin` + `admin`.

**D4 · Alcance de la matriz del Paso 9** — ver Parte C, E7. Precargada abajo con recomendación por fila.

**D5 · Instalación en los celulares.** ✅ Se hace con el equipo → E4-E6 van.
Sin la app agregada a la pantalla de inicio, en iPhone no llega ningún push (limitación de Apple, no hay workaround).

---

**D6 · ⚠️ ABIERTA — ¿`admin` y `pm` ven TODAS las tareas?**
Jordi (§5.1) dice que solo `super_admin` ve todo. Pero hoy la vista "Del equipo" ya la tienen `superadmin` + `admin` + `pm`, y para asignar hay que ver.
→ **Implementado por defecto en E1:** `superadmin` y `admin` ven todo (es la convención `_adminLevel` que ya usa todo el código, `tareas.js:137`); **`pm` ve lo suyo + lo de su rol + lo que creó + lo que asignó**. `venta` y `taller` ven estrictamente lo suyo.
→ Es **una línea de una policy**: si querés a `pm` viendo todo, o a `admin` restringido, se cambia en 30 segundos. Decidilo cuando lo veas andando.

---

## PARTE C · Plan por etapas

Regla transversal (CLAUDE.md §8 regla 19 + `feedback_orden_sql_push`): **SQL primero en Supabase, después push del JS.** Cada `sql/*.sql` nuevo pasa por el subagente `sql-reviewer` y cada diff JS por `typescript-reviewer` (+ `security-reviewer` en E1, E5, E6) **antes** de commitear.

---

### E1 · Cimientos de datos + RLS real  🔴 la etapa más importante

**Estado: ✅ SQL escrito y revisado — ⏳ falta que Fede lo corra.**

**Objetivo:** que la visibilidad por rol sea verdad en la base, y que la asignación múltiple sea posible.

**Archivos**
- `sql/tareas_v2_asignados_rls.sql` **(nuevo, listo)**

**Revisión (regla 19).** `sql-reviewer` y `security-reviewer` dieron **Block** en la primera pasada. Los 3 hallazgos serios, ya corregidos en el archivo:
1. **HIGH · el INSERT no tenía guard** (solo el UPDATE) → un `venta`/`taller` podía crear de una una tarea con `target_role='admin'` o a nombre de otro. Era la misma puerta que el archivo dice cerrar, por atrás. Los dos reviewers lo cazaron por separado.
2. **HIGH · `created_by` no era inmutable.** `tareas.js` manda `created_by: uid` en cada claim (`_upsertClaim` en `tomar`/`hecha`, `_reasignarModal`) → el que TOMA una tarea pasaba a figurar como su creador. Efecto: el PM que delegó **dejaba de ver la tarea** apenas alguien la tomaba, y el que la tomó quedaba habilitado a borrarla. Ahora el trigger lo congela.
3. **MEDIUM · el guard revertía el borrado en silencio** → `UndoHelpers.deleteRecord` escribía en `audit_log` un borrado que nunca ocurrió, sin toast, con la tarea todavía en pantalla. Ahora el borrado no autorizado tira excepción 42501 y `_action` ya la muestra con su `try/catch`.
+ 3 LOW: robo de claim entre compañeros del mismo pool, undelete sin guardia, y el `CHECK` sin scopear por tabla.

**Deuda que se salda en E3** (no bloquea E1, el trigger ya lo neutraliza): sacar `created_by: uid` de los 3 patches de `tareas.js` (líneas 673, 675, 804) — hoy le mienten al guard sin consecuencia.

**Contenido**
1. `ALTER TABLE tareas`: `+ is_urgent boolean NOT NULL DEFAULT false`, `+ categoria text CHECK IN ('evento','marketing','comercial','operaciones')` (nullable, default `null` para no romper filas viejas).
2. `CREATE TABLE tarea_asignados` — `id uuid`, `tarea_id uuid REFERENCES tareas ON DELETE CASCADE`, `tipo text CHECK IN ('rol','usuario')`, `rol text`, `usuario_id uuid REFERENCES profiles`, **`CHECK` de exactamente-uno** (`num_nonnulls(rol, usuario_id) = 1` + coherencia con `tipo`), índices únicos parciales `(tarea_id, rol)` y `(tarea_id, usuario_id)`.
3. `CREATE TABLE tarea_actividad` — `tarea_id`, `actor_id`, `estado_desde`, `estado_hasta`, `comentario`, `created_at`.
4. **Helper** `fn_puede_ver_tarea(p_tarea_id uuid)` `STABLE SECURITY DEFINER` — implementa las 4 condiciones del doc 01 §5.1 (asignada a mi rol / a mí / la creé / soy superadmin). Reusa `fn_user_role()`, que ya existe y ya resolvió el problema de recursión.
5. **Reemplazo de la policy abierta** de `tareas` por 4 policies:
   - `SELECT`: `fn_puede_ver_tarea(id)` **OR** `target_role = fn_user_role()` (compat con el claim actual) **OR** `responsable_id = auth.uid()`.
   - `INSERT`: authenticated, con `created_by = auth.uid()` **+ el mismo guard de campos privilegiados que el UPDATE** (si no, un `venta`/`taller` crea de una una tarea con `target_role='admin'` o a nombre de otra persona — lo cazaron los dos reviewers).
   - `UPDATE`: solo lo que ve; **`is_urgent` y las asignaciones no las puede cambiar quien no es admin-level** (se hace con un trigger `BEFORE UPDATE` que revierte esos campos si el actor no está autorizado — más robusto que una policy de columnas).
   - `DELETE`: `superadmin`/`admin`.
6. Policies espejo en `tarea_asignados` y `tarea_actividad` (si no ve la tarea, no ve nada de ella).
7. **Backfill**: por cada tarea viva, `INSERT` en `tarea_asignados` la fila que corresponda a su `responsable_id` y/o `target_role` actual. Sin esto, al activar la RLS **desaparecen tareas de la vista de todos**.
8. Trigger `AFTER UPDATE OF estado` → fila en `tarea_actividad` (así el historial se registra aunque el cambio venga de otro lado, no solo del Kanban).

**Riesgos**
- 🔴 **Activar RLS mal = el módulo Tareas se ve vacío para todos.** Mitigación: el archivo termina con un bloque de verificación `SELECT count(*)` por rol; y las policies son `DROP + CREATE` en una transacción, con el SQL de rollback comentado al pie.
- 🟠 `Tareas._loadManual()` hace `select('*')` sin filtro → con RLS pasa a traer menos filas. Es lo esperado, pero hay que verificarlo antes de tocar el JS.
- 🟠 Las derivadas claimeadas por otro rol podrían dejar de verse en "Del equipo". Mitigación: la condición `target_role = fn_user_role()` de la policy SELECT.

**Cómo se prueba (antes de pasar a E2)**
- En el SQL editor: `SELECT * FROM tareas` como `postgres` (bypassa) vs. contra la app logueado con cada rol.
- Prueba negativa del criterio de aceptación de Jordi: desde la consola del navegador con un usuario `taller`, `supabaseClient.from('tareas').select('*').eq('id', '<id de una tarea de ventas>')` → **tiene que devolver 0 filas**.
- Contar tareas visibles por rol antes/después del backfill: los números tienen que dar lo mismo para las tareas ya asignadas.

---

### E2 · Función única de notificación (fan-out in-app)

**Objetivo:** el contrato `notificar({destinatarios, titulo, cuerpo, url, push, tipo})` del doc 01 §7.4, **sin push todavía**.

**Archivos**
- `api.js` (bloque nuevo `NOTIFICACIONES v2`) → bump a `?v=89` en `app.js`
- `tareas.js` (reemplaza `_notify`) → bump

**Contenido**
- `API.resolverDestinatarios({roles, usuarios, excluir})`: expande roles a usuarios vía `profiles` (`active = true`), suma los directos, **deduplica por uuid**, **excluye al creador**. Espejo exacto de `lib/destinatarios.js` del doc 02 §7.1, adaptado a que acá el rol vive en `profiles.role`.
- `API.notificar({destinatarios, titulo, cuerpo, url, push, tipo})`: **siempre** escribe N filas in-app (una por usuario, con `target_user_id`), y **si `push:true` llama al endpoint de E6** (en E2 ese llamado queda como no-op detrás de un guard). Nunca hay push sin registro in-app.
- **Idempotencia** (doc 01 §7.5): notifica al crear, al agregar un destinatario nuevo (solo al nuevo), y al marcar urgente una tarea que no lo era. Editar título/fecha no re-notifica. Se resuelve comparando el set de asignados antes/después dentro del guardado.
- `notifications.js`: sumar la categoría `tareas` al `TIPO_CATALOG` (para que sea silenciable como el resto).

**Riesgo:** 🟢 bajo. Es aditivo; si falla, la tarea se crea igual (try/catch como el `_notify` actual).

**Prueba:** crear tarea tagueando `@venta` → 1 fila por cada usuario de venta, ninguna para el creador. Taguear `@taller` + Diego (que es taller) → Diego recibe **una sola**.

---

### E3 · Kanban + tarjeta + vista del SuperAdmin

**Archivos**
- `tareas.js` (secciones nuevas) → bump `?v=14`
- `style.css` o estilos scopeados `.tar-kb-*` inyectados por el módulo (patrón actual de `_ensureStyles`)
- `mobile.css` si hace falta ajuste de columnas

**Contenido**
- Toggle `📋 Lista` / `📊 Tablero` (según D1). 4 columnas: Pendiente · En proceso · Bloqueada · Hecha.
- **DnD calcado de `crm.js:1716-1760`** (HTML5 nativo, ya probado en prod). Update optimista + revert visual si la base rechaza + toast de error.
- Al soltar: `UPDATE estado` → el trigger de E1 escribe `tarea_actividad` → `API.notificar` avisa al superadmin (doc 01 §7.3).
- `hecha` setea `completada_at/por`; sacar de `hecha` los limpia (ya existe en `_action`, se reusa).
- **Tarjeta** en el orden de jerarquía del doc 01 §6.3: urgente (banda `--color-error`) → título → chip categoría → evento → chips de asignados (rol y/o persona, avatar de iniciales como en la Bandeja del CRM) → vencimiento en rojo si venció.
- **Selector del superadmin** arriba del tablero: `Todas` (default) · `Por rol` · `Por persona` · `Mías`. Reemplaza/absorbe el toggle actual `MIS TAREAS / DEL EQUIPO`.
- Filtros: categoría, evento, urgencia, vencidas, buscador. **Se aplican sobre lo visible, nunca amplían.**
- **Mobile**: selector de columna arriba + lista vertical (más usable que el scroll horizontal para el taller). Tap targets 44px.
- Modal de alta: sumar **selector de destinatarios estilo menciones** (chips de roles + chips de personas, mezclables), **checkbox Urgente** con el texto de ayuda literal del doc (`Marcá urgente solo si necesitás que le llegue al celular ahora mismo.`) y el select de categoría.

**Riesgo:** 🟠 medio — es el archivo con más superficie. Mitigación: no se toca `_gen` (los 7 generadores) ni `_merged()` ni `_upsertClaim`; el tablero consume el mismo `_merged()` que la lista.

**Prueba:** preview local + verificación en prod con usuario de cada rol; mover tarjetas y confirmar filas en `tarea_actividad`.

---

### E4 · PWA: manifest + iconos + service worker base  🔴 etapa de máximo cuidado

**Objetivo:** que la app se pueda instalar. **Todavía sin push** — se despliega y se verifica que no rompió nada.

**Archivos**
- `manifest.json` **(nuevo, raíz)** — `display: "standalone"`, `start_url: "/"`, `scope: "/"`, `background_color`/`theme_color` `#050505` / `#00A9C1`, `name` "MEPEX", iconos.
- `assets/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `badge-72.png` **(nuevos)** — generados del isotipo turquesa (memoria `feedback_logo_iso_optimizado`: SVG fuente en `ARCHIVOS MEPEX\RECURSOS BASE\LOGOS`, `#00abc8`). El badge en monocromo (Android lo pinta él).
- `sw.js` **(nuevo, raíz)** — **SOLO** los listeners `push`, `notificationclick`, `install` (`skipWaiting`) y `activate` (`clients.claim`), tal cual el doc 02 §5. **Cero cache de assets, cero `fetch` handler.**
- `index.html` — `<link rel="manifest">` + `<meta name="theme-color">` + `apple-touch-icon`.
- `tools/vps/nginx-mepex.conf` — `location = /sw.js { add_header Cache-Control "no-cache"; }` + `worker-src 'self'` y `manifest-src 'self'` explícitos en la CSP.

**Por qué el SW no cachea nada:** es la regla de oro del doc 02 §0 ("un cambio mal puesto en el service worker se cachea y rompe la app para todos"). Un SW sin `fetch` handler **no puede** romper la carga de la app: si falla, el navegador sirve todo normal. El precio es que la app no funciona offline — cosa que hoy tampoco hace, así que no perdemos nada.

**Kill switch (documentar en el propio `sw.js`):** si algo sale mal, se publica un `sw.js` que hace `self.registration.unregister()` en `activate` y se limpia solo en todos los dispositivos.

**Riesgo:** 🔴 alto por naturaleza, 🟢 bajo con este diseño. El punto real de atención es el `Cache-Control` de nginx: sin él, un `sw.js` viejo puede quedar pegado.

**Prueba:** DevTools → Application → Service Workers (versión activa correcta) + Manifest (sin warnings) + "Add to home screen" funcionando en Android y iPhone. **Y el smoke de siempre: login + navegar 5 módulos, 0 errores de consola.**

---

### E5 · Suscripciones: tabla + endpoints + toggle en el perfil

**Archivos**
- `sql/push_subscriptions.sql` **(nuevo)** — tal cual el doc 02 §4 (RLS: cada usuario solo sus suscripciones; `endpoint` UNIQUE; `ON DELETE CASCADE`). ⚠️ ajuste: la FK va a **`public.profiles(id)`** (que es 1:1 con `auth.users`) para ser consistente con el resto del schema.
- `tools/vps/push.js` **(nuevo)** — `suscribirHandler`, `desuscribirHandler`, `testHandler`, `enviarPush(userIds, payload)` con **limpieza automática de 404/410**.
- `tools/vps/server.js` — montar 3 rutas con `requireAuth` (+ `requireRole('superadmin')` en `/api/push/test`) y `rateLimit`.
- `push-cliente.js` **(nuevo, raíz)** — `pushSoportado()`, `activarNotificaciones()`, `desactivarNotificaciones()`. Adaptado a vanilla: la clave pública sale de `config.js`, no de `process.env`.
- `config.js` — `+ VAPID_PUBLIC_KEY` (bump `?v=5`)
- `settings.js` — toggle **"Activar notificaciones en este dispositivo"** en Mi Perfil, con estado (activado / bloqueado por el navegador / no soportado) y el texto de ayuda para iOS.
- `app.js` — sumar `push-cliente.js` a `_APP_SCRIPTS`.

**Manual de Fede (no lo puedo hacer yo):**
1. `npx web-push generate-vapid-keys` → **guardar el par en el gestor de contraseñas**.
2. Cargar en `/home/mepex/api/.env`: `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:federicomengelle@gmail.com` (la pública también, para `setVapidDetails`).
3. Verificar que `SUPABASE_SERVICE_ROLE_KEY` esté en ese `.env` (la necesita el envío).
4. `cd /home/mepex/api && npm install web-push` + `cp` de `push.js` y `server.js` + `pm2 restart mepex-api`.
5. Correr `sql/push_subscriptions.sql`.

> ⚠️ La clave privada **no me la pases por el chat** (el chat enmascara keys al copiar — memoria `reference_vps_layout`). Va directo del gestor de contraseñas al `.env` del VPS.

**Riesgo:** 🟠 medio. Endpoints nuevos en un servidor que factura en AFIP → van con `requireAuth` + rate limit desde el minuto cero, y el `security-reviewer` los mira antes del push.

**Prueba:** activar el toggle en Chrome desktop → fila en `push_subscriptions` con el `user_id` correcto (**verificar que sale de la sesión del servidor, no del body**). `/api/push/test` → llega una notificación. Desactivar → la fila desaparece.

---

### E6 · Envío atado al check de urgencia

**Archivos**
- `tools/vps/push.js` — `+ /api/push/tarea`
- `api.js` — `API.notificar` deja de ser no-op en la rama `push:true`
- `tareas.js` — llama con `push: tarea.is_urgent`

**Diseño de seguridad (importante):** el endpoint recibe **`{ tareaId, motivo }`**, no una lista de destinatarios. **Re-resuelve los destinatarios en el servidor** leyendo `tarea_asignados` con la service key. Así un usuario autenticado no puede usar el endpoint para mandarle push a quien quiera.

**Orden de operaciones (doc 02 §8, no negociable):** 1) base → 2) in-app → 3) push, este último en `try/catch` que nunca puede voltear la creación de la tarea.

**Payload:** título + nombre de la tarea. **Sin montos, sin datos de cliente** (se lee desde la pantalla bloqueada). `requireInteraction: true` solo para urgentes.

**Riesgo:** 🟢 bajo (todo el andamiaje ya está probado en E5).

**Prueba:** los 2 criterios de aceptación de Jordi — tarea **sin** urgente → campanita sí, celular no; **con** urgente → campanita y celular, **con la app cerrada del todo**.

---

### E7 · Matriz del Paso 9 · **completar con Fede**

Solo se implementan las filas confirmadas. Las filas 1-4 ya están cerradas por el doc 01. Precargo el resto con lo que existe hoy en el sistema y mi recomendación:

| # | Suceso | ¿Existe hoy? | Recomendación |
|---|---|---|---|
| 5 | Tarea vence hoy y sigue abierta | ✅ ya lo agrupa la lista ("Hoy") | In-app sí · push **no** · job diario 8:00 |
| 6 | Tarea vencida | ✅ grupo "Vencidas" | In-app a asignados + superadmin · push **no** |
| 7 | Faltan X días para el armado | ✅ `eventos` tiene las fechas | In-app a pm+taller a **7 y a 2 días** · push **solo el de 2 días** |
| 8 | Cambia fecha de armado/desarme | ✅ editable en Eventos | In-app pm+taller · **push sí** (rompe planificación) |
| 9 | Se confirma un evento | ⚠️ **no hay estado de evento** (se deriva de fechas) | ❌ **dejar fuera** — habría que construir el estado primero |
| 10 | Presupuesto aprobado | ✅ `cotizaciones.estado='aprobada'` | In-app venta+superadmin · push no |
| 11 | Lead nuevo al CRM | ✅ `crm_casos` | In-app venta · push no (sería ruido) |
| 12 | Lead X días sin respuesta | ✅ chip "sin responder" de la Bandeja | In-app · push no · job diario |
| 13 | Orden de compra generada | ✅ `compras_ordenes` | In-app admin · push no |
| 14 | Material bajo stock mínimo | ✅ alerta `stock_minimo` ya existe | In-app taller · push no |
| 15 | Solapamiento de armados | ✅ `eventos.js` detecta conflictos | In-app pm+superadmin · **push sí** |
| 16 | Ausencia de personal | ⚠️ tabla `ausencias` prevista en RRHH v2, **no construida** | ❌ dejar fuera |
| 17 | Vence VTV de un vehículo | ✅ ya es tarea derivada (`flota`) | ya cubierto, no duplicar |
| 18 | Factura emitida | ✅ ARCA en prod | In-app admin · push no |
| 19 | Factura vencida sin cobrar | ✅ `plan_cobro_items` estado vencido | In-app admin+superadmin · push no · job diario |

**Preguntas de cierre del doc 02 §9:**
- **Job diario**: recomiendo **`pg_cron` de Supabase a las 08:00 ART** para las filas 5/6/12/19 (no depende del VPS ni de que alguien abra la app). Alternativa: cron del VPS pegándole a un endpoint.
- **Apagar categorías**: ya existe el mecanismo (`Notifications.TIPO_CATALOG` + mute por usuario en localStorage) → se extiende, no se construye.
- **Horario de silencio**: recomiendo **retener push entre 21:00 y 07:00** salvo urgente-de-tarea. Un push a las 23:00 al taller no aporta.

---

---

### Hallazgos de los reviewers (regla 19) — todos aplicados

Los dos reviewers dieron **Block** sobre el JS de E2–E6. Lo que encontraron, ya corregido:

| Sev | Qué | Dónde |
|---|---|---|
| 🔴 CRITICAL | **`Tareas._esc()` no escapaba comillas.** El truco `textContent→innerHTML` escapa `& < >` pero no `"`. El Kanban lo usaba dentro de `title="…"` y `value="…"` → un título de tarea (que **cualquier rol** puede escribir) con un `"` cerraba el atributo e inyectaba otro. Con `style-src 'unsafe-inline'` + `img-src https:` alcanzaba para un beacon que dispara con solo renderizar la tarjeta. | `tareas.js` → delega en el `escHtml` global |
| 🔴 CRITICAL | **Inyección en el filtro PostgREST del connector de push.** `tarea_asignados.rol` es `text` libre y se concatenaba en `profiles?role=in.(…)`, consulta que corre con la **service key** (bypassa RLS). Un rol con `)`/`&`/`"` podía ampliarla. | `tools/vps/push.js` (allowlist de roles + solo-UUID) y `sql/tareas_v2_fix_rol_check.sql` (CHECK en la base) |
| 🟠 HIGH | **`/api/push/tarea` no chequeaba que el que llama tenga que ver con esa tarea.** Cualquier logueado con el UUID podía reenviar el push urgente ajeno en loop (`requireInteraction` = no se cierra solo). | `push.js`: autorización tipo `fn_tarea_visible` + cooldown de 60s por tarea |
| 🟠 HIGH | **Dos caminos divergentes para cambiar de estado.** La Lista sincronizaba checklist/rutina pero **no avisaba al superadmin**; el Tablero avisaba pero **dejaba las rutinas sin reprogramar** (una rutina cerrada desde el Kanban moría en silencio). | `tareas.js`: `_aplicarCambioEstado()` único |
| 🟠 HIGH | **Sin guard de concurrencia en el drag & drop.** Dos drops rápidos leían el caché viejo y ganaba el UPDATE que llegaba último, sin error visible. | `tareas.js`: `_moving` Set |
| 🟠 HIGH | **Errores de Supabase tragados** en 3 queries (el patrón que CLAUDE.md marca como lección cara). | `tareas.js` ×3 |
| 🟡 MEDIUM | SSRF saliente: el `endpoint` de la suscripción no se validaba → el VPS le pegaba a cualquier URL. | `push.js`: allowlist de hosts de push |
| 🟡 MEDIUM | Race del select de eventos: una respuesta lenta poblaba el modal equivocado. | `tareas.js`: token por modal |
| 🟡 MEDIUM | El título de la tarea se lee desde la pantalla bloqueada. | Aviso agregado al hint del check Urgente |
| 🟢 LOW | `sw.js` navegaba a la URL del payload sin validar same-origin. | Solo rutas que arranquen con `/` |
| 🟢 LOW | `/api/` no seteaba `X-Forwarded-For` → el rate limit de **todo** `/api/*` (push, ARCA, IA) era evadible mandando el header a mano. **No era de este diff**, se arregló igual. | `nginx-mepex.conf` |

### E8 · Guía de instalación + pruebas en dispositivo real

- `docs/guia-instalar-app-celular.md` (una carilla, con capturas, iPhone y Android) — doc 02 §10.
- Sesión de 10 minutos con el equipo junto instalando y activando.
- Las 7 pruebas del doc 02 §11, incluida la de suscripción muerta (desinstalar sin desuscribir → verificar que el registro se limpia solo).
- Actualizar `PROGRESO.md` (entrada `[E2]`), `PLAN-SUPERIOR.md` y `CLAUDE.md` §10.

---

## PARTE D · Orden, dependencias y esfuerzo

```
E1 (SQL+RLS) ──► E2 (fan-out) ──► E3 (Kanban)
                                      │
D5 ✔ ──► E4 (PWA) ──► E5 (suscripción) ──► E6 (push atado) ──► E8
                                      │
                                 E7 (matriz) ──► filas confirmadas
```

| Etapa | Riesgo | Bloquea a | Notas |
|---|---|---|---|
| E1 | 🔴 | todo | **SQL-first.** Es la que arregla el agujero de seguridad. |
| E2 | 🟢 | E3, E6 | aditiva |
| E3 | 🟠 | — | la más visual, se pule con vos en vivo |
| E4 | 🔴 | E5 | solo si D5 = sí |
| E5 | 🟠 | E6 | requiere pasos manuales tuyos en el VPS |
| E6 | 🟢 | E8 | |
| E7 | — | filas nuevas | decisión tuya, no código |
| E8 | 🟢 | — | cierre |

**E1→E3 tienen valor por sí solas** aunque el push nunca se haga. **E1 conviene hacerla igual y ya**, independientemente de todo lo demás: hoy cualquier usuario logueado puede leer y borrar todas las tareas de la empresa desde la consola del navegador.

---

## PARTE E · Criterios de aceptación (doc 01 §8) mapeados

| Criterio de Jordi | Etapa | Cómo se prueba |
|---|---|---|
| `taller` ve únicamente lo suyo | E1+E3 | login real con usuario taller |
| API directa denegada con RLS activo | **E1** | consola del navegador, sin service role |
| SuperAdmin ve todas y filtra por rol/persona | E3 | UI |
| `@ventas` → todos los de ventas, nadie más | E2 | filas en `notifications` |
| `@taller` + persona del taller → **una sola** notif | E2 | dedup |
| Sin urgente → campanita, sin push | E6 | celular en mano |
| Con urgente → campanita **y** celular | E6 | celular en mano, app cerrada |
| Mover tarjeta → `tarea_actividad` + in-app al superadmin | E3 | DB + campanita |
| Completar → `completada_at/por` + in-app | E3 | DB |
| El creador no se auto-notifica | E2 | |
| Kanban usable desde el celular | E3 | dispositivo real |
| `evento_id = null` funciona igual | E1-E3 | tareas sueltas de marketing |

## PARTE F · Fuera de alcance (doc 01 §9)

Recurrentes automáticas — **ojo: ya existen** como pestaña `🔁 Rutinas` (Fase F, `sql/reorg_f_rutinas.sql`), no hay que construirlas. Subtareas/checklists, comentarios en hilo, adjuntos, dependencias entre tareas y reportes de productividad: **no se tocan.** Quedan anotados en `PLAN-SUPERIOR.md`.
