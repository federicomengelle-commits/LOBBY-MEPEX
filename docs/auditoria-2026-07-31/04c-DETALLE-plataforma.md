# Detalle — Dominio PLATAFORMA (Seguridad · Notificaciones · Costos · Inventario · Compras)

> Auditoría integral 2026-07-31. Verificado contra prod (solo SELECT).
> **[×2]** = encontrado por dos agentes independientes.

---

## SEGURIDAD

### C9 · `ajustar_stock` es ejecutable por **anónimos** y escribe stock sin ninguna autorización [×2]

- **Dónde:** función Postgres `public.ajustar_stock(p_tabla text, p_id bigint, p_delta numeric)`
- **Qué pasa:** es `SECURITY DEFINER` (bypassea RLS), **no tiene ningún guard de rol ni de sesión**, y su ACL incluye `anon=X/postgres` (y `=X` a PUBLIC). PostgREST la expone en `/rest/v1/rpc/ajustar_stock`.
- **Cómo se explota:** cualquiera que lea `config.js` (la anon key es pública por diseño, y está también en el bundle del **cotizador**) hace `POST /rest/v1/rpc/ajustar_stock` con `{"p_tabla":"insumos_base","p_id":1,"p_delta":-999999}` **sin loguearse**. Los IDs son bigint secuenciales: `insumos_base` va de 1 a 83, `catalogo_items` tiene 226 filas. Un `for` de 83 requests deja el inventario en negativo. **No hay rate-limit** (PostgREST directo, no pasa por el proxy).
- **Evidencia:** `acl = "=X/postgres | postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres"`, `secdef = true`. Cuerpo: `UPDATE insumos_base SET stock = COALESCE(stock,0) + p_delta WHERE id = p_id`, sin `auth.uid()` en ninguna parte.
- **Arreglo:** `REVOKE ALL ON FUNCTION public.ajustar_stock(text,bigint,numeric) FROM PUBLIC, anon;` + guard `fn_role_can('inventario','write')` adentro. **El REVOKE es lo que realmente protege.**
- **Esfuerzo:** S

---

### C10 · La matriz de roles **no se aplica en 65 de 122 tablas**: cualquier logueado tiene CRUD total

- **Dónde:** 89 policies `USING(true)` / `WITH CHECK(true)` sobre 66 tablas
- **Qué pasa:** el RBAC de Fase 9.bis (`fn_role_can`) se aplicó a un subconjunto. Los módulos que **efectivamente** aparecen en alguna policy son solo 7: `finanzas` (26 tablas), `contabilidad` (21), `crm` (14), `proyectos` (12), `admin-panel` (1), `stands` (1), `ventas` (1).
  **`costos`, `compras`, `inventario`, `locaciones`, `flota`, `rrhh`, `eventos`, `rendimiento`, `calendario-adm` y `catalogo` no tienen NINGUNA policy que consulte la matriz.** Para esas tablas el rol es decorativo.
- **Cómo se explota:** Diego (rol `taller`, que en la matriz tiene solo `read` en 6 módulos) abre la consola ya logueado y ejecuta:
  ```js
  supabaseClient.from('compras_ordenes').delete().neq('id',0)
  supabaseClient.from('personas').update({costo_dia_referencial: 999999})
  supabaseClient.from('insumos_base').update({costo_unitario: 0})
  supabaseClient.from('eventos').delete()
  ```
  Todo pasa: la policy dice `true`. **Es una línea en Chrome, sin ninguna herramienta.**
- **Evidencia:** `compras_ordenes → compras_ordenes_all | ALL | qual=true | with_check=true | {authenticated}`. Idéntico en `compras_pagos`, `compras_proveedores`, `insumos_base`, `catalogo_items`, `receta_componentes`, `costos_params_globales`, `personas`, `persona_documentos`, `rrhh_*`, `vacaciones_saldos`, `ausencias`, `payments`, `locaciones_stock`, `inventario_movimientos`, `eventos` (INSERT/UPDATE/**DELETE**), `taller_*`, `vehiculos`, `proveedor`, `listas_precio`.
- **Arreglo:** migrar por tandas, empezando por el bloque **plata + RRHH**: reemplazar `USING(true)` por `fn_role_can('<modulo>','read')` en SELECT y `'write'` en el resto. Es el mismo patrón ya escrito para las 42 tablas de finanzas.
- **Esfuerzo:** L (partible: compras + costos + rrhh primero = el 80% del riesgo)

---

### C11 · `profiles.active = false` **no desactiva nada** a nivel de datos — hay 4 cuentas de baja con acceso vigente

- **Dónde:** `auth.js:202-229` (`restoreSession`), `fn_role_can()`, `fn_is_admin()`, `fn_user_role()`
- **Qué pasa:** el flag `active` se chequea **solo** en `_finishLogin` (`auth.js:70`). Ni `restoreSession()` ni **ninguna** función de RLS lo miran: `fn_role_can` hace `SELECT role FROM profiles WHERE id = auth.uid()` sin filtrar por `active`. Prod: **20 perfiles, 4 desactivados.**
- **Cómo se explota:** dos caminos reales. (1) Un usuario dado de baja hace `signInWithPassword` — **Supabase Auth le da un JWT válido** (no sabe nada de `active`); la app lo desloguea del lado del cliente, pero él ya tiene el token: lo usa contra PostgREST y RLS le concede todo lo que su `role` permita. (2) Si tenía sesión abierta, el refresh token se renueva solo y `restoreSession()` lo deja entrar sin volver a mirar `active`.
- **Confirmación de que el criterio existe:** el proxy VPS **sí** lo chequea (`auth-middleware.js:118`) → el olvido está en la capa de datos, no en el criterio.
- **Arreglo:** agregar `AND COALESCE(active,true)` a `fn_role_can`/`fn_is_admin`/`fn_user_role` (arregla las 42 tablas de una) + el check en `restoreSession`. Para las bajas reales, además revocar sesiones desde el Dashboard.
- **Esfuerzo:** S

---

### A25 · La estructura de costos y márgenes de MEPEX es legible **sin loguearse** [×2]

- **Dónde:** policies `catalogo_items_rls_anon`, `listas_precio_rls_anon`, `lista_precio_items_rls_anon`, `lista_precio_rubros_rls_anon`, `catalogo_item_fotos_anon` (todas `{anon} SELECT qual=true`)
- **Qué pasa:** el contrato con el Cotizador exige que anon lea `catalogo_items`, pero la policy da la **fila entera**, no las columnas del contrato. Expuestas: `costo_fabricacion, costo_indirectos, costo_mano_obra, costo_por_uso, costo_produccion, costo_proveedor_directo, margen_propio, margen_subalquiler, precio_alquiler, precio_cliente, snapshot_pct_margen`.
- **Cómo se explota:** un competidor toma la anon key del bundle y hace `GET /rest/v1/catalogo_items?select=*` → 226 ítems con costo real y margen por ítem. Ve que el panel blanco cuesta $140.185 fabricarlo y que MEPEX le carga 80% de markup (y al negro 125%). **Es material de negociación en la mano del comprador.**
- **Arreglo:** RLS es por fila; lo que hace falta acá es **grant por columna**:
  `REVOKE SELECT ON catalogo_items FROM anon; GRANT SELECT (id, nombre, rubro, precio_alquiler, es_cotizable, unidad, foto_url) ON catalogo_items TO anon;`
  Mejor aún: una view `v_catalogo_publico` con `security_invoker=true` y sacarle el acceso directo a la tabla. **Coordinar con el repo del cotizador — es contrato compartido.**
- **Esfuerzo:** M

### A26 · `cartera_valores` es la única tabla financiera fuera de la matriz

- **Dónde:** policies `cv_select` / `cv_insert` / `cv_update` (`qual: true`)
- **Qué pasa:** todo el resto del circuito financiero usa `fn_role_can('finanzas'|'contabilidad')`. **Los cheques y e-cheques quedaron con `true`.** Solo el DELETE está protegido.
- **Cómo se explota:** un `taller` o `pm` lee toda la cartera (montos, bancos, titulares, fechas de cobro) y puede **insertar o modificar** un valor: cambiarle el importe a un e-cheq o marcarlo con otro estado. El INSERT además dispara `fn_asiento_auto_valor` → **mete un asiento contable**.
- **Arreglo:** alinear las 3 policies con el patrón de `ingresos`. Es copiar-pegar. **La corrección de mejor relación valor/esfuerzo del informe.**
- **Esfuerzo:** S

### A27 · `fn_avanzar_rutina`: el guard trata a los anónimos como contexto privilegiado [×2]

- **Dónde:** `public.fn_avanzar_rutina(uuid, date)`, `SECURITY DEFINER`, `proacl` incluye `anon=X`
- **Qué pasa:** el guard es `IF NOT ( auth.uid() IS NULL OR v_role IN ('admin','superadmin') OR ... )`. El comentario dice *"auth.uid() IS NULL = contexto privilegiado (consola/service)"* — pero para una llamada **anon vía PostgREST `auth.uid()` también es NULL**. El anon pasa el guard entero. La función hace además un `EXECUTE format('UPDATE public.%I SET %I = ...')` como SECURITY DEFINER.
- **Mitigante real:** `rutinas_select` es `TO authenticated` → un anónimo **no puede enumerar los UUIDs**. Hay que conocer uno (screenshot, log, link compartido). No es explotable a ciegas.
- **Valor del hallazgo — el patrón:** el mismo idioma está en `siguiente_numero_venta`, y ahí **lo único que lo salva es el `REVOKE`**, no el guard. Comparar con `fn_role_can`, que hace lo correcto: `WHEN auth.uid() IS NULL THEN false`.
- **Arreglo:** `REVOKE ALL ON FUNCTION fn_avanzar_rutina FROM PUBLIC, anon;` y cambiar el idioma a `auth.role() = 'service_role'`. Aplicar el mismo REVOKE a las otras ~19 SECURITY DEFINER expuestas a anon (todas menos las 2 `fn_encuesta_publica_*`, públicas a propósito).
- **Esfuerzo:** S

### A28 · XSS almacenado y `javascript:` en `href` — URLs de la DB sin escapar ni validar esquema

- **Dónde:** `modules.js:2291-2293`, `finanzas.js:9359`, `finanzas.js:9789` (**sin escapar nada**) · `eventos.js:2331/2363/2435`, `locaciones.js:955`, `compras.js:215/1546`, `lobby.js:987` (escapado pero **sin validar esquema**)
- **Qué pasa:** dos defectos. (a) Interpolación cruda dentro de `href="..."` → una comilla doble cierra el atributo e inyecta `onmouseover=`. (b) `_escAttr`/`escAttr` evita romper el atributo pero **no impide `javascript:`**.
- **Cómo se explota:** los campos son tipeados por usuarios y las tablas de origen tienen RLS `true` (C10), así que **cualquier logueado los planta**. Para (a): `eventos.manualUrl = '" onmouseover="fetch(\`/x?c=\`+document.cookie) x="'` → se dispara con solo pasar el mouse en la tabla de Eventos, en el navegador de quien la abra (Fede, admin). Para (b): `compras_pedidos.link = 'javascript:...'` se ejecuta al hacer clic.
- **Evidencia:** `if (e.manualUrl) links.push(\`<a href="${e.manualUrl}" ...>📋</a>\`)` — cruda.
- **Arreglo:** el helper correcto **ya existe en el repo** — `venta-detalle.js:404` y `creditos-fiscales.js:255` definen `_safeUrl(u)` que solo deja pasar http/https. Promoverlo a global en `components.js` junto a `escHtml`/`escAttr` y aplicarlo en los 10 puntos: `href="${escAttr(_safeUrl(x))}"`.
- **Esfuerzo:** M

### Otros hallazgos de seguridad

| # | Hallazgo | Impacto | Esf. |
|---|---|---|---|
| M45 | **`audit_logs`: la policy de INSERT no está restringida a ningún rol.** Se llama `audit_insert_authenticated` pero se creó sin `TO`, así que aplica a **todos** (el linter la reporta como la única con `roles: ["-"]`), y `anon` tiene `GRANT INSERT`. Un anónimo puede contaminar el registro de auditoría contable con entradas falsas. Es corrupción de la evidencia. | ALTO | S |
| M46 | **Toda la auditoría es legible por cualquier logueado**: `audit_log_read_authenticated SELECT qual=true`. Un `taller` lee quién hizo qué en todos los módulos (montos, clientes, borrados). Y `audit_log_insert_authenticated` es `WITH CHECK true` → puede **fabricar** entradas a nombre de otro. (La tabla hermana `audit_logs` sí restringe la lectura a admin.) | MEDIO | S |
| M47 | **`notifications` INSERT `WITH CHECK true`** → cualquier logueado crea avisos con cualquier `target_user_id`/`target_role`, texto y link. **Phishing interno** ("Aprobá este pago acá") contra un admin; el link se renderiza en `settings.js:624` sin escapar. | MEDIO | S |
| M48 | **3 buckets públicos con listado habilitado**: `catalogo`, `cotizaciones-pdf`, `propuestas-pdf` — no solo se bajan objetos conocidos, **se enumera el bucket entero** (todas las cotizaciones y propuestas PDF de clientes). | MEDIO | S |
| M49 | **`requireRole('superadmin','admin','finanzas')`** en `tools/vps/server.js:67` (`/api/arca/facturar`): `finanzas` es un **módulo**, no un rol → nunca matchea. Inofensivo (falla cerrado) pero engaña al lector. | BAJO | S |
| M50 | 62 funciones con `search_path` mutable; la única SECURITY DEFINER sin `SET search_path` es `user_module_permission`. Explotable solo si el atacante puede crear objetos en un schema del path — `anon`/`authenticated` no tienen `CREATE` en `public`. Higiene. | BAJO | S |
| M51 | **Leaked password protection desactivada** en Supabase Auth (1 toggle). | BAJO | S |
| M52 | **`Data.rolePermissions` desincronizado del DB**: `admin` y `venta` tienen `stands` en el front y no en el DB; `pm` figura con `catalogo` read-only cuando el DB le da `write`. Solo aplica si la query a `roles` falla (fallback offline). Higiene. | BAJO | S |
| M53 | **`compras.js:801` y `eventos.js:3287` tienen `_esc` que no escapa comillas** (variante insegura documentada). Hoy sin camino de explotación (se usan en contexto de texto), pero el próximo que lo use dentro de un atributo abre un XSS. | BAJO | S |

### Matriz de permisos: front vs RLS

> Fuente real del front = `roles.permissions` del DB (`Auth.getAccessLevel` → `user._rolePermissions`). `Data.rolePermissions` es solo fallback offline.

| Módulo | roles.permissions (DB) | Guard router | ¿RLS detrás? |
|---|---|---|---|
| **costos** | super, admin, **pm**:write | `adminOnly` | ❌ **ninguna policy usa `fn_role_can('costos')`** — guard de teatro |
| **compras** | super, admin, pm | `module` | ❌ 6 tablas `compras_*` en `true` |
| **rendimiento** | super, admin | `adminOnly` | ❌ sin `fn_role_can('rendimiento')` |
| **calendario-adm** | super, admin | `adminOnly` | ❌ `vencimientos_*` sin matriz |
| **rrhh** | super, admin | `module` | ❌ `personas`, `rrhh_*`, `persona_documentos`, `ausencias`, `vacaciones_saldos` en `true` |
| **inventario** | todos (taller read) | `module` | ❌ `inventario_*` en `true` → **taller escribe** |
| **locaciones** | super, admin, taller:read | `module` | ❌ |
| **flota** | super, admin, pm, taller | `module` | ❌ `vehiculos` INSERT/UPDATE `true` |
| **eventos** | todos (taller read) | `module` | ❌ INSERT/UPDATE/**DELETE** `true` |
| **catalogo** | pm/admin write, venta read | `module` | ❌ + **anon lee costos y márgenes** |
| ventas | super, admin | `adminOnly` | ✅ |
| finanzas | super, admin | `module` | ✅ 26 tablas — **salvo `cartera_valores`** |
| contabilidad | admin:write | `module` | ✅ 21 tablas |
| crm | todos menos taller | `module` | ✅ 14 tablas |
| proyectos | todos (taller read) | `module` | ✅ 12 tablas |
| stands | **solo super** | `module` | ✅ |
| admin-panel | super | `superadminOnly` | ✅ |

### Falsos positivos de seguridad descartados

- **Inyección SQL en `ajustar_stock`** → **NO hay SQL dinámico**: es un `IF/ELSIF` con dos UPDATE literales y `RAISE EXCEPTION` en el `ELSE`. Whitelist dura. El problema es el ACL, no la inyección.
- **Escalación vía `profiles`** → el trigger `fn_profiles_guard` aborta si cambian `role`, `active` o `custom_permissions` sin ser admin. Sólido.
- **Views con fuga a anon** → las 6 tienen `security_invoker=true` y `anon_can_select=false`. El fix del 2026-07-26 se sostuvo y la view nueva nació bien.
- **Webhook de WhatsApp sin firma** → la verifica con HMAC-SHA256 y `timingSafeEqual`, con el raw body capturado correctamente. Bien hecho.
- **Endpoints del VPS sin auth** → todos guardados (`requireAuth`/`requireRole` + `iaLimit`/`pushLimit`). `requireRole` además chequea `profile.active === false` — la capa que le falta a RLS.
- **CORS mal configurado** → `cb(null, false)` para origins desconocidos, sin wildcard. Patrón correcto.
- **Secretos en el árbol** → **no hay ninguno**. Los hits de `lpk_live_`, `sb_secret_` y `AIza` son **menciones del prefijo** en comentarios y docs. Cero JWTs, cero claves privadas fuera de `node_modules`. `config.js` y `.env*` en `.gitignore`. La key de La PyME **ya no está en el árbol actual**.
- **Funciones de trigger llamables por anon** (`fn_profiles_guard`, `fn_tareas_*`, `handle_new_user`, `trigger_*`) → invocadas como RPC fallan con *"trigger functions can only be called as triggers"*. Ruido del linter.
- **`siguiente_numero_venta` explotable** → tiene el REVOKE y el guard. **Es el único caso bien resuelto del lote.**
- **`getAccessLevel` con `customPermissions: []`** → falla **cerrado** (bloquea, no abre).

---

## NOTIFICACIONES Y TAREAS

### C12 · `caso_nuevo` no le llega a nadie: en prod **no existe ningún perfil con rol `venta`**

- **Dónde:** `api.js:1381` (`createCaso` → `avisar({roles:['venta']})`)
- **Qué pasa:** `resolverDestinatarios` matchea el rol **literal** contra `profiles.role`. En producción hay 20 perfiles y **cero con rol `venta`**.
- **Cómo falla:** cada caso nuevo del CRM emite un aviso con lista vacía → `avisar` sale por `if (!destinatarios.length) return` → **no se escribe ninguna fila, sin error, sin warning**. **Noelia El Juri (Noe, la comercial senior) tiene rol `admin`.** Nunca se va a enterar de un lead nuevo por la campanita.
- **Evidencia:** `admin 8 (4 activos) · superadmin 7 · taller 3 · pm 2 · venta → NO APARECE`
- **Arreglo:** `roles: ['venta','admin']` en el emisor, o pasarle el rol `venta` a Noe (afecta permisos, es decisión de Fede). Lo mismo con `cotizacion_aprobada` (`['venta','superadmin']` → hoy solo los 7 superadmins, **no la que lo vendió**).
- **Esfuerzo:** S

### C13 · El push de Eventos sale aunque la pantalla muestre el switch de Celular apagado

- **Dónde:** `notifications.js:45-48` (catálogo, categoría `eventos` **sin** `pushDefault`) vs `tools/vps/push.js:532` (`filtrarPorPreferencia(destinatarios, categoria, true)`)
- **Qué pasa:** front y servidor tienen defaults **opuestos** para la misma categoría. Sin fila en `notificacion_prefs` (y la tabla tiene **0 filas**), `getPref('eventos').push` devuelve `false` → la pantalla dibuja el switch apagado; el connector con `pushPorDefecto=true` **manda el push igual**.
- **Cómo falla:** a un PM le vibra el teléfono a las 20:50 por un cambio de fecha mientras su pantalla dice que el celular para Eventos está apagado. Y como **ya se ve apagado**, no tiene forma de apagarlo: tiene que prenderlo y volver a apagarlo para que se escriba la fila con `push:false`. Es exactamente el bug que el propio handoff prohíbe (§4.4: *"no escribir en la UI algo que el código no hace"*).
- **Arreglo:** agregar `pushDefault: true` a la categoría `eventos` del catálogo (una línea, alinea el front con lo que el servidor ya hace).
- **Esfuerzo:** S

### A29 · Tres alertas del CRM y una tarea derivada son **estructuralmente imposibles**: las columnas están vacías

- **Dónde:** `alertas.js:134-165` (`_generators.crm`) y `tareas.js:554-566` (`_gen.crm`)
- **Qué pasa:** `cotiz_por_vencer` y "Cerrar cotización" filtran `cotizaciones.fecha_evento`; `cliente_sin_followup` filtra `clientes.ultimo_contacto`. En PostgREST un `.gte()`/`.lte()` sobre NULL nunca matchea.
  ```
  cotizaciones vivas: 18   ·  con fecha_evento: 0
  clientes activos: 264    ·  con ultimo_contacto: 0
  ```
- **Cómo falla:** el módulo CRM **no aporta ni un solo pendiente ni una sola tarea derivada al sistema**. Todo el aporte de Comercial al sistema nervioso es cero, sin ninguna señal. Ya hay antecedente: en la sesión 2026-05-30 se cambió la columna Fecha de la tabla de Cotizaciones justamente porque `fecha_evento` estaba vacía — **nadie revisó que dos alertas dependían de ella**.
- **Arreglo:** decidir la fuente real (para cotizaciones, `fecha_emision` + antigüedad, o el `fecha_evento` del caso/evento vinculado; para follow-up, derivarlo del último `crm_mensajes`).
- **Esfuerzo:** M

### A30 · La alerta "proyecto trabado" está muerta: filtra 8 estados de los cuales **7 son ilegales**

- **Dónde:** `alertas.js:175`
- **Qué pasa:** filtra `.in('estado', ['en_proceso','en_produccion','pendiente','en_preparacion','En proceso','En producción','Pendiente','En preparación'])`. El CHECK solo admite `{por_iniciar, en_proceso, en_taller, finalizado, rechazado}` → **7 valores no pueden existir**. Y el único legal (`en_proceso`) tiene 0 filas: los 11 proyectos vivos son `por_iniciar` (6) y `en_taller` (5).
- **Cómo falla:** un stand en taller que lleva tres semanas sin que nadie lo toque no genera pendiente, no pinta el dot y no aparece en la campanita. La alerta corre cada 5 minutos y **siempre devuelve `[]`**.
- **Arreglo:** `.in('estado', ['por_iniciar','en_proceso','en_taller'])`.
- **Esfuerzo:** S

### A31 · `novedad_proyecto` y `novedad_critica` **no están en el catálogo** → nadie los puede silenciar

- **Dónde:** `api.js:_fanoutNovedadNotifications` (emite 3 tipos) vs `notifications.js:TIPO_CATALOG` (solo tiene `novedad_para_taller`)
- **Cómo falla:** llegan a la campanita con la etiqueta cruda (`"novedad_critica"` en vez de `"🔧 Taller y producción"`), no aparecen en la matriz de preferencias e `isMuted()` los deja pasar siempre.
- **Nota:** son los **únicos 2 huérfanos** del sistema — se cruzaron los 28 tipos emitidos (25 JS + 3 triggers) contra los 26 catalogados. **No hay tipos fantasma.**
- **Arreglo:** sumarlos a la categoría `taller` del catálogo.
- **Esfuerzo:** S

### A32 · El aviso de stock bajo **nunca llega al taller** — ni por campanita ni por dot

- **Dónde:** trigger `trg_notif_stock_minimo_fn` + `alertas.js:_visibility.inventario`
- **Qué pasa:** la matriz del Paso 9 (fila 14) dice *"Material bajo stock mínimo → In-app **taller**"*. El trigger inserta **una sola** fila con `target_role='admin'`, y la alerta `stock_bajo` es visible solo para `['superadmin','admin']`.
- **Asimetría reveladora:** el trigger hermano `trg_notif_equipo_estado_fn` **sí** inserta dos filas (admin + taller). Es accidente, no decisión.
- **Y además no puede dispararse nunca:** `insumos_base.stock_minimo` es **NULL en los 80 insumos** → la primera línea del trigger es `IF NEW.stock_minimo IS NULL THEN RETURN NEW`. El trigger está perfectamente escrito y es decorativo.
- **Arreglo:** duplicar el INSERT con `'taller'` + sumar `'taller'` a `_visibility.inventario` + campo "stock mínimo" en el panel de Insumos con backfill por tipo de amortización.
- **Esfuerzo:** S

### A33 · Los 25 emisores de notificación **fallan en silencio**; solo 1 chequea el resultado

- **Dónde:** `api.js:4342` (`createNotification`), `:4419` (`notificar`), `:4686` (`avisar`), `_fanoutNovedadNotifications`
- **Qué pasa:** las cuatro tienen `try/catch` interno que degrada a `console.warn` y devuelve `null`/`{inapp:0}`. De los ~25 sitios de emisión, **solo `pedido-compra.js:48` mira el retorno**.
- **Por qué importa:** es la clase de bug que ya pasó **dos veces documentadas** (el `entidad_id` bigint que abortaba el INSERT entero; el `.select()` que devolvía cero filas por RLS). En ambos casos el aviso se perdió el 100% de las veces sin que nadie lo notara durante semanas. No hay contador, ni toast, ni métrica.
- **Dato que lo ilustra:** el 2026-07-30 se insertaron 32 `tarea_asignados` y 11 `tarea_actividad`, y en `notifications` **no hay ni una fila de ese día** (la última es del 2026-07-02). La explicación benigna existe (Fede creó y movió sus propias tareas → `_notificarAvance` corta si el creador es el actor) pero **no hay forma de distinguirla de un fallo real**. `notifications` tiene 19 filas y **0 con `target_user_id`** → el fan-out (E2) nunca escribió una fila en prod. *[Requiere verificación logueada para descartar]*
- **Arreglo:** que `notificar()` devuelva `{inapp, error}` y que el Toast de éxito se degrade ("Guardado, pero no pude avisar a X") cuando `inapp === 0` con destinatarios > 0. Mínimo: `console.error` + `capture` de PostHog (ya instalado).
- **Esfuerzo:** M

### A34 · `superadmin`/`admin` entran y salen de los destinatarios sin criterio

Como `resolverDestinatarios` **no tiene jerarquía de roles** (a diferencia de `createNotification`+RLS, donde superadmin sí ve lo de `admin`), cada emisor nombra los roles a mano — y el resultado es incoherente entre avisos hermanos:

| Aviso | roles | Llega a | No se entera |
|---|---|---|---|
| `evento_fecha_cambiada` | `pm`,`taller` | 5 | Fede, Lelean, Sofi |
| `evento_solapamiento` | `pm`,`superadmin` | 9 | los 4 admin |
| `evento_armado_proximo` | `pm`,`taller` | 5 | super y admin |
| `cotizacion_aprobada` | `venta`,`superadmin` | 7 (todos super) | **Noe, que es quien lo vendió** |
| `oc_generada` / `factura_emitida` | `admin`,`superadmin` | 11 | — |

Dos avisos sobre el mismo evento tienen listas distintas y la diferencia no está justificada en ningún comentario. Además, cada `avisar` que nombra `superadmin` escribe **7 filas** — incluyendo cuentas que parecen de prueba/consultoría.
**Arreglo:** helper `ROLES_MANDO = ['admin','superadmin']` usado consistentemente + depurar los superadmins de prueba (`active=false` los saca del fan-out sin borrarlos).

### Otros hallazgos del sistema nervioso

| # | Hallazgo | Esf. |
|---|---|---|
| M54 | **El deploy pendiente del VPS deja `/api/push/aviso` en 404** → `pushNotificarAviso` hace `if (!res.ok) return null`, se traga el 404, y los 3 avisos con `push:true` llegan solo a campanita. **Ojo:** el handoff manda copiar solo `push.js`, pero **la ruta nueva está en `server.js`** → con `cp push.js` sigue en 404. Comando correcto: `cp /home/mepex/lobby/tools/vps/{push.js,server.js} /home/mepex/api/ && pm2 restart mepex-api`. *[SIN VERIFICAR contra el VPS]* | S |
| M55 | **Dos generadores de alertas nunca pintan su dot en el sidebar**: `Badges` busca el item por `data-route === moduleId`, y las claves `taller` y `equipos` **ya no son rutas** (Taller fue disuelto; `equipos` vive dentro de `#inventario`). "3 stands sin terminar, armado en ≤3 días" (severidad `danger`) es invisible para quien mira el menú en vez de la campanita. | S |
| M56 | **El canal push alcanza a 2 personas, las dos superadmin**: `push_subscriptions` tiene 4 filas, todas de Fede (2 dispositivos) y Jordi (2). **Cero taller, cero pm, cero admin.** Toda la infra VAPID sirve hoy para que le suene el teléfono a quienes la construyeron. El caso de uso que la justificaba tiene **cero cobertura**. No es código: es una sesión de 15 min instalando la PWA. | S (operativo) |
| M57 | **`expires_at` es columna muerta y la tabla no se purga nunca**. Además `getNotifications` lee con `limit: 20` **antes** de filtrar silenciados en cliente → si tus últimas 20 son de una categoría silenciada, la campanita se ve vacía teniendo avisos sin leer más atrás, y el contador los subcuenta. | M |
| M58 | **`markAllNotificationsRead` hace 2 round-trips por notificación** (loop secuencial, read-modify-write sobre `leida_por`). Con 50 no leídas son 100 requests seriales + race entre pestañas. | M |
| M59 | El que pierde un claim simultáneo ve el texto crudo de Postgres (`duplicate key value violates unique constraint "uniq_tareas_dedupe"`) en vez de "Alguien más tomó esta tarea". | S |
| M60 | Resolver una novedad no toca su notificación → el aviso "⚠️ Novedad crítica" queda sin leer después de resuelto. | S |

### Inventario de emisores — resumen

**28 emisores · 26 tipos catalogados · 9 categorías.** (CLAUDE.md dice "18 tipos / 8 categorías" → quedó desactualizado tras la matriz del Paso 9.)

**3 viven en triggers de Postgres y el grep del JS NO los ve:** `trg_encuesta_notif_fn` (encuestas), `trg_notif_stock_minimo_fn` (insumos), `trg_notif_equipo_estado_fn` (equipos).

**Alertas calculadas:** 18 generadores en `alertas.js`, recalculan solas cada 5 min, no son silenciables por diseño. **Tres son imposibles de disparar hoy** (`cotiz_por_vencer`, `cliente_sin_followup`, `proyecto_trabado`).

**Tareas derivadas:** 10 generadores en `tareas.js._gen` (`crm` imposible).

### Falsos positivos de notificaciones descartados

- **"`notificacion_prefs` con 0 filas apaga la campanita para todos"** → **NO**. `getPref()` sin fila devuelve `{in_app: true}`. El default in-app es **encendido**; el problema está solo en el canal push (C13).
- **"El claim del pool tiene race"** → **NO**. Aunque `_upsertClaim` hace read-then-write sobre un caché, la base lo cubre con `CREATE UNIQUE INDEX uniq_tareas_dedupe ... WHERE (es_derivada AND NOT _deleted)`. Lo único mejorable es el mensaje.
- **"Quedan emisores con el choque BIGINT/UUID en `entidad_id`"** → **NO**. Se verificó el tipo de PK de las 24 tablas: los 4 emisores que tocan tablas bigint **omiten `entidad_id` a propósito y está comentado**; `equipos.id` **es UUID**.
- **"El horario de silencio usa `Intl` y falla en el Node del VPS"** → **NO**, usa offset fijo UTC-3, correcto y comentado.
- **"`sw.js` puede romper la carga"** → **NO**: sin handler de `fetch`. Además valida que la URL del click sea interna.
- **"El Kanban y la Lista muestran conjuntos distintos"** → **NO**: ambos parten del mismo `_aplicarFiltros(_visibleFor(...))`.
- **"Alguna alerta consulta una columna inexistente"** → **NO**: las 11 tablas verificadas contra `information_schema`, todas las columnas existen (incluida `ausencias`, que **sí existe** contra lo que dice el handoff §3.1). El problema no son columnas faltantes sino **columnas vacías y estados equivocados**.
- **"La RLS de `notifications` sigue abierta"** → **NO**, el fix está aplicado y coincide con lo que hace el JS.

---

## COSTOS · INVENTARIO · COMPRAS

### C14 · El aviso de "recalculá" vive **solo en el DOM** → precios desactualizados sin ninguna señal

- **Dónde:** `costos.js:3089-3096` (`persist`), `:3059-3066` (`showDirty`), `:2935-2964` (indicador ●)
- **Qué pasa:** al editar VU armado, margen propio, minutos de MO o componentes, `persist()` guarda el campo y marca "dirty" con `tag.style.display='inline-block'`. Ese estado **no se persiste en ninguna columna**. Cerrás el panel o recargás y el aviso desaparece, pero `precio_alquiler` sigue con el valor viejo. El indicador `●` "desfasado" **no tapa el hueco**: solo compara los 3 parámetros globales contra los snapshots, **nunca el precio cacheado contra los inputs del propio item**.
- **Cómo falla — caso real en prod:** ítem **89 "Panel sistema negro h=2,50m"**, `es_cotizable=true`. La RPC lo recalculó el 16/05 04:05; después le pusieron `vida_util_armado_override=5` y nadie apretó Recalcular. El panel blanco (id 88), **componentes idénticos**, se recalculó a las 05:30 (ya con VU=10) y quedó bien.
  ```
  id=88 blanco: vu=10 fab=140185.00 uso_cache=14041.00 = 140185/10 + 22.5 ✓
  id=89 negro : vu=5  fab=140185.00 uso_cache=10197.25  ≠ 140185/5 + 45 = 28082.00 ✗
  ```
  **Se cotiza a $22.943,80 cuando su propia fórmula da $63.184,50 → $40.240,70 menos por panel (−64%). Un stand de 30 paneles negros se subfactura $1.207.221.** Y la UI no muestra ni un ●, porque sus 3 snapshots coinciden con los globales.
- **Arreglo:** badge server-side. Una view `v_catalogo_precio_stale` que compare `precio_alquiler` contra `calcular_receta(id)` y pinte la fila en rojo en Recetas y Listas. La RPC ya es la fuente de verdad y corre para los 226 items en un SELECT. **Recalcular el ítem 89 ya mismo.**
- **Esfuerzo:** S (recalc inmediato) / M (badge)

### C15 · `calculo-receta.js` es un **segundo motor de costeo** con fórmula distinta que puede pisar el precio [×2]

- **Dónde:** `calculo-receta.js:66-96`, cableado en `api.js:3703` ← `api.js:3874` (`recalcularEnCascada`) ← `costos.js:2729` (`_confirmAndCascadeInsumo`)
- **Qué pasa:** al cambiar el precio de un insumo, la cascada **no usa la RPC**: usa un reimplemento en JS que (a) **ignora `vida_util_armado_override`** (la regla F.11 de CLAUDE.md §6.5), (b) ignora el % desperdicio por insumo, (c) **suma `pct_indirectos_comercial`**, que CLAUDE.md marca como legacy que la RPC ignora, y (d) escribe `ultima_recalculacion` pero **no toca los snapshots**.

  | | RPC `calcular_receta` | JS `CalculoReceta` (la cascada) |
  |---|---|---|
  | Desperdicio por insumo | Sí | **No** |
  | Parámetros | globales de `parametros_globales` | campos legacy por-item con defaults hardcodeados 0.30/0.20/20/0.05 |
  | `snapshot_costos_at` | lo escribe | **no lo escribe** |
  | Regla 1:N (VU armado) | Sí | **No existe** en todo el archivo |

- **Cómo falla:** hoy no hay daño consumado (`ultima_recalculacion > snapshot_costos_at` da **0 de 226**), pero está armado: el día que Fede corrija el precio de un insumo y acepte la cascada, los ítems con VU armado — entre ellos los 3 cotizables 49, 88 y 89 — reciben un precio **sin la regla 1:N**. Y como `snapshot_costos_at` no se tocó, la tabla les pinta el ⚠ *"Precio cacheado sin snapshot. Recalculá para refrescar"* → **el sistema te avisa que la receta está desactualizada justo después de haberla actualizado.**
- **Arreglo:** que `recalcularEnCascada` llame `recalcularRecetaRPC` en vez de `recalcularPrecioAlquiler`. **Una línea.** Un motor solo. Borrar `calculo-receta.js` + `calculo-receta-tests.html`.
- **Esfuerzo:** S

### Otros hallazgos de costos/inventario/compras

| # | Hallazgo | Esf. |
|---|---|---|
| A35 | **Cambiar la amortización no propaga nada, y está documentado como intencional** (`costos.js:369`: *"NO recalcula recetas"*). Cambiar `tipoAmortizacion` desde el popover cambia la VU efectiva → cambia el costo por uso de todas las recetas que lo usan → **cero cascada, cero aviso**. Ídem los overrides VU/reacond/desperdicio: solo se dispara cascada si cambió `costoUnitario`. Y el propio texto de la ficha dice que esos parámetros "se aplican al cálculo de las recetas que usan este insumo". | M |
| A36 | **Los roles que trabajan con material tienen Inventario en solo-lectura**: `pm` y `taller` están en `readOnlyPermissions` → los botones Entrada/Consumo/Transformación **no se emiten**. Solo Fede + Lelean + Sofi pueden mover stock. Diego saca 20 placas del galpón y no tiene dónde registrarlo. Choca de frente con el criterio de cero-fricción del taller. Explica por qué los movimientos se cortaron en abril. | S |
| A37 | **El botón más visible para registrar un movimiento es un stub**: el "Registrar movimiento" del panel del ítem hace `console.log` + `Toast.info('próximamente')`. El camino que funciona es otro (la toolbar de la pestaña Movimientos). El usuario abre la pieza, aprieta el botón obvio, no pasa nada, y concluye que el módulo no anda. | S |
| M61 | **`api.js:5106` se traga cualquier error de la RPC y cae al read-modify-write**: el `catch` no distingue "la RPC no existe" de un error real (permisos, timeout). La versión de `inventario.js:2448` sí discrimina por `code`. Con dos recepciones simultáneas se pierde un update. | S |
| M62 | **`updateParametroGlobal` devuelve `true` aunque no actualice ninguna fila** (no chequea filas afectadas, y no hay INSERT en ningún lado → una clave nueva **no se puede crear**). `costos.js:939` guarda `proxima_revision_lista`, clave que **no está entre las 9 de prod**: la UI dice "guardado" y el valor se pierde en cada intento. | S |
| M63 | **El indicador ● marca "desfasado" de mentira a todo item con margen propio**: `snapshot_pct_margen` guarda el margen *efectivo* del item, pero la UI lo compara contra `pct_margen_default`. La rama de subalquilado corrige esto; la de propio no. Los **9 items con `margen_propio ≠ 0.50`** —entre ellos la vitrina, el panel blanco y el negro— muestran ● permanente aunque los acabes de recalcular. **El ● pierde credibilidad justo en los items caros.** | S |
| M64 | **El ● nunca se le muestra a un admin que no sea superadmin** (`costos.js:210` solo carga `_paramsGlobales` si `isSuperAdmin`) → Lelean y Sofi ven el panel sin ningún aviso de desfasaje, nunca. | S |
| M65 | **`costos_params_globales` es una tabla huérfana con valores contradictorios y en otra escala**: ningún `.js` la lee ni la escribe, guarda `hora_taller_ars=12000` (vs 15000 vigente) y `pct_indirectos_fabrica=30.00` / `pct_margen_default=50.00` — **porcentaje, no factor**. La trampa es futura: el comentario de `costos.js:4082` la describe como si fuera la que se usa. Quien lo lea y la cablee aplicaría indirectos al **3000%**. | S |
| M66 | **`compras_pagos` está muerta en Compras pero VIVA en Alertas**: ~215 líneas inalcanzables en `compras.js:1992-2205`, pero `alertas.js:265` sigue contando pagos vencidos y `notifyPagosVencidos` sigue escribiendo. Si se dropea la tabla sin tocar esos dos, rompe el badge de Compras. | S |
| M67 | **`locaciones_stock` no tiene ningún escritor en todo el repo**: `locaciones.js:1251` dice que el alta se gestiona desde Inventario; `inventario.js:2313` solo hace SELECT. Las dos partes se pasan la pelota → "Stock por locación" va a mostrar vacío para siempre, con 3 locaciones cargadas. | M |
| M68 | **`numero_oc` duplicado**: las OC id=4 e id=15 son ambas `OC-0001` (sin unique constraint). `_egresoForOC` deduplica **por string del número en el concepto** → con dos OC-0001, la segunda **no puede generar su egreso**: la da por ya generada. | S |
| M69 | **Doble (triple) tipeo en compras**: el ítem de la OC es texto libre; en la recepción hay que **volver a escribir el mismo insumo** en otro input para linkearlo; el match es por `nombre.toLowerCase()` exacto y **si no matchea → `insumo_id: null` → no suma stock y no avisa** (el toast dice "Recepción registrada" igual). Y el costo, otra vez a mano en Costos. | M |
| M70 | **Recibir una OC no actualiza el costo del insumo**: `recibirOrdenCompra` ajusta stock, inserta movimientos y marca la OC — **nunca toca `costo_unitario` ni `insumo_precio_historial`**, aunque `compras_orden_items.precio_unitario` ya esté guardado y `logPrecioChange` acepte un motivo libre. | M |
| M71 | **Filtros que no persisten + bug fantasma**: cero `localStorage` en `costos.js`/`inventario.js`. Al volver al módulo, `render()` reconstruye el input de búsqueda **sin `value`** pero `this._searchQuery` conserva el texto → **la tabla queda filtrada por un término que no se ve en ningún lado**. Y `_clearFilters()` solo vacía el DOM, no el estado. | S |
| M72 | **`_recalcularUnaReceta` recarga el mundo por ítem**: cada recálculo dispara `_refreshData()` → `_renderActiveTab()` → `_loadAllRecetaStatuses()`, que hace un SELECT de `receta_componentes` **entera**. Recalcular 40 recetas de a una = 40 veces. | M |
| M73 | **`API.recalcularTodasRecetasRPC` existe con `onProgress` y no la usa nadie**: `costos.js:3285` reimplementa el loop a mano. | S |

### Estado real del costeo en prod

| Métrica | Valor |
|---|---|
| Items en catálogo (vivos) | **226** (219 propios / 7 subalquilados) |
| **Con receta viva** | **27 (12%)** — 199 sin receta |
| Componentes vivos | 49 (26 insumo + 23 sub-item) de 67 filas |
| Con `precio_alquiler > 0` | 27 |
| **Cotizables (lo que ve el cotizador)** | **9** — todos con receta y precio |
| Cotizables con precio sin receta | **0** |
| **Precio cacheado ≠ recálculo de la RPC** | **17 de 27 (63%)** |
| **Cotizables mal** | **1 de 9** (id 89) |
| Suma cacheada vs recalculada | $541.204,81 → $586.486,46 (**+8,4%**, +$45.281,65) |
| Del cual, solo el ítem 89 | **$40.240,70 (89% del desvío)** |

**Parámetros vigentes de verdad** — manda `parametros_globales` (9 filas), la que lee la RPC y escribe el tab Parámetros: `hora_taller_ars` **15000** (act. 16/05) · `pct_indirectos_fabrica` **0.30** · `pct_margen_default` **0.50**. Los defaults hardcodeados de la RPC **no se están usando**.

> **Sobre los "195 items desfasados":** tienen `snapshot_hora_taller_ars=12000` contra 15000 vigente, pero los 195 tienen **precio 0 y `es_cotizable=false`** — son el bulto del catálogo que nunca se costeó. **El desfasaje de snapshots es ruido; el problema real son los 17 items cuyo precio no matchea su propia fórmula, y a esos el ● no los marca.**

### Falsos positivos de costos/inventario descartados

- **"`parametros_globales` tiene 0 filas"** → **FALSO**, tiene **9** con las 3 claves activas cargadas.
- **"El módulo lee una tabla y escribe en otra"** → **FALSO**: lee y escribe `parametros_globales` en los dos sentidos. `costos_params_globales` no aparece en ningún `.js` ejecutable, solo en un comentario.
- **"Los 226 items están costeados con valores hardcodeados"** → **FALSO**: están costeados con los globales reales. El problema es que 199 no tienen receta y 17 de los 27 con precio no se recalcularon.
- **"El cotizador cotiza con precios sin fundamento"** → **casi todo FALSO**: los 9 cotizables tienen receta y precio. La excepción real es **uno solo** (id 89), y por cache vencido, no por falta de receta.
- **"`ajustar_stock` es vulnerable a SQL injection"** → **FALSO**: whitelist dura con `IF/ELSIF`. (El grant a anon sí es real → C9.)
- **"El trigger de stock mínimo vigila la columna equivocada"** → **FALSO**: vigila `stock` y `stock_minimo`, las correctas. Lo que falla es que `stock_minimo` está vacío.
- **"`inventario_movimientos` tiene 0 filas / la UI está rota"** → **FALSO en las dos partes**: tiene **8 movimientos reales** de abril 2026 y la cadena DOM→handler→insert está completa y verificada en los 5 puntos de inserción. **Se usó y se abandonó; no se rompió.** Las causas del abandono son el gate de permisos (A36) y el botón stub (A37).
- **"`locaciones` tiene 0 filas"** → **FALSO**, tiene 3 y el alta funciona sin gate. Lo huérfano es `locaciones_stock`.
- **"`compras_proveedores` tiene 0 filas"** → **FALSO**, tiene 143, igual que `proveedor`.
- **"Deuda 3b.2: compras.js sigue en BIGINT"** → **FALSO / YA SALDADA**. No hay **ni una** query contra `compras_proveedores` en ningún `.js`. El dropdown se llena de `from('proveedor')` con UUID; el egreso lleva UUID correcto; el motor de sugeridos opera en espacio UUID. Lo que queda es dual-write de traza, inofensivo. **Varios docs siguen afirmando lo contrario** (`docs/mapa-tablas.md:27`, `docs/handoff-capa-operativa-pulido-notificaciones.md:43`, `PLAN-MAESTRO:256`).
- **"No se puede subir foto al catálogo"** → **FALSO**: el bucket existe con las 4 policies correctas. Que haya 1 sola foto es uso, no defecto.
- **"La protección anti-ciclo del BOM es incompleta"** → **FALSO**: doble red (trigger con CTE recursiva + guard `p_visited` en la RPC). La única grieta (`_deleted = false` vs `IS NOT TRUE OR IS NULL`) no es explotable: default `false`, 0 filas NULL.
