# Detalle — ENDPOINTS, VPS E INTEGRACIONES

> Auditoría integral 2026-07-31. **No se tocó el VPS de producción**: todo es análisis de código + verificación de la DB por SELECT.
> Los ítems marcados **[VERIFICAR EN VPS]** traen el comando exacto que tiene que correr Fede.

---

## Inventario de endpoints

### `mepex-api` — pm2, `:3000`, nginx `location /api/` → `127.0.0.1:3000` (path completo, sin strip)

| Ruta | Método | Archivo:línea | Auth | Rate-limit | Valida input | Quién lo llama | Riesgo |
|---|---|---|---|---|---|---|---|
| `/health` | GET | `server.js:47` | **ninguna** | no | n/a | nadie (uptime externo) | filtra `version`. BAJO |
| `/api/ocr/comprobante` | POST | `server.js:55` | `requireAuth` | `iaLimit` 20/min·IP | `imagen` string; **sin tope de tamaño** | `carga-comprobante.js:188` | nginx corta en 5 MB → foto de celu = 413 mudo. **ALTO (H5)** |
| `/api/crm/digest` | POST | `server.js:60` | `requireAuth` | `iaLimit` | `contexto` a 4000; **`texto` sin tope** | `crm.js:4965`, `api.js:1721/1742` | costo IA sin cap. MEDIO |
| `/api/arca/status` | GET | `server.js:64` | `requireAuth` | no | n/a | **nadie en el front** | dead. BAJO |
| `/api/arca/ultimo` | GET | `server.js:65` | `requireAuth` | no | `parseInt` | `finanzas.js:7912` | pega a AFIP por request. MEDIO |
| `/api/arca/padron` | GET | `server.js:66` | `requireAuth` | no | CUIT 11 dígitos | `finanzas.js:7387` | **cualquier logueado (incl. `taller`) consulta el padrón AFIP con el cert de MEPEX.** MEDIO |
| `/api/arca/facturar` | POST | `server.js:67` | `requireRole('superadmin','admin','finanzas')` | **no** | tipos/fechas/importes saneados; **no valida total↔alícuotas** | `finanzas.js:7964`, `:8385` | **CRÍTICO (H1)** |
| `/api/push/estado` | GET | `server.js:75` | `requireAuth` | no | n/a | **nadie** | dead. BAJO |
| `/api/push/suscribir` | POST | `server.js:76` | `requireAuth` | `pushLimit` 30/min | allowlist SSRF; `user_id` de sesión | `push-cliente.js:120` | OK ✅ |
| `/api/push/desuscribir` | POST | `server.js:77` | `requireAuth` | `pushLimit` | `user_id` de sesión | `push-cliente.js:164` | OK ✅ |
| `/api/push/test` | POST | `server.js:78` | `requireRole('superadmin')` | `pushLimit` | n/a | `push-cliente.js:272` | OK ✅ |
| `/api/push/tarea` | POST | `server.js:79` | `requireAuth` | `pushLimit` + cooldown 60 s/tarea | UUID + **re-resuelve destinatarios server-side** | `api.js:4487` | OK ✅ |
| `/api/push/aviso` | POST | `server.js:82` | `requireAuth` | `pushLimit` + dedupe | allowlist de `tipo` + UUID + ventana 2 min | `api.js:4462` | **no deployado (H3)** |
| `/api/whatsapp/webhook` | GET | `server.js:89` | `WA_VERIFY_TOKEN` | no | query | Meta | OK |
| `/api/whatsapp/webhook` | POST | `server.js:90` | HMAC `timingSafeEqual` | **no** | firma **después** de parsear | Meta | parse de 5 MB pre-firma. MEDIO (H11) |

**No montado:** `/api/octexa/ask` — `tools/vps/octexa-ia.js` existe en el repo pero `server.js` no lo requiere. Código muerto en producción (documentado a propósito).

### `lobby-api` — pm2, `:3002`, nginx `location /lobby-api/` → `127.0.0.1:3002/` (**strippea** el prefijo)

| Ruta | Método | Archivo:línea | Auth | Rate-limit | Valida | Quién lo llama | Riesgo |
|---|---|---|---|---|---|---|---|
| `/health` | GET | `lobby-api/index.js:86` | ninguna | no | n/a | nadie | BAJO |
| `/deploy` | POST | `index.js:123` | `X-Deploy-Token` **o** superadmin | 10/min·IP | n/a | nadie en el front | `===` no constant-time; corre `git pull` en el web root. MEDIO |
| `/admin/users/create` | POST | `index.js:139` | `requireSuperadmin` | no | username `^[a-z0-9]+$`, pass ≥10 | `api.js:3542` | rollback parcial. MEDIO |
| `/admin/users/reset-password` | POST | `index.js:226` | `requireSuperadmin` | no | pass ≥10 | `api.js:3546` | OK |
| `/admin/users/delete` | POST | `index.js:256` | `requireSuperadmin` | no | solo `uid` presente | `api.js:3550` | error crudo de PG al cliente. BAJO |

---

## CRÍTICOS

### H1 · ARCA: el CAE se emite, el guardado puede fallar en silencio, y **el reintento duplica la factura fiscal**

- **Dónde:** `finanzas.js:7982-7984` (individual), `:8394-8395` (lote), `arca-connector.js:391-402`, `nginx-mepex.conf:84`
- **Tres agujeros encadenados:**
  1. Si el INSERT en `comprobantes` falla después del CAE, solo hay `console.warn`: el usuario ve "✓ Emitido", se baja el PDF, y **la factura no existe en la base**.
  2. **No hay idempotencia**: ni `Idempotency-Key`, ni índice único, ni chequeo de "ya emití esto". Verificado en prod: `comprobantes` **no tiene ningún índice único más allá de la PK** — ni sobre `cae`, ni sobre `(punto_venta, tipo, numero)`.
  3. nginx corta `/api/` a los **60 s**, y el connector **serializa** las emisiones en una cadena global (`_facturarChain`) mientras cada una hace hasta 3 llamadas SOAP de 30 s.
- **Cómo falla:** Sofi emite el lote de monotributos. La factura #4 tarda porque las tres anteriores están encoladas → nginx devuelve **504** a los 60 s → el front lo toma como error, escribe una fila `estado:'error'` con el comentario **"NO consume número en AFIP"** (que en este caso es **falso**: AFIP ya otorgó el CAE) y muestra un botón **"Reintentar"**. Al tocarlo se emite una **segunda factura fiscal real** por el mismo importe al mismo cliente. Queda un CAE huérfano que MEPEX no registró y una factura de más ante AFIP.
- **Arreglo:**
  1. Si el INSERT falla, **no** mostrar éxito: pantalla roja con el CAE, el número y el JSON completo para carga manual, + rescate en `localStorage`.
  2. `CREATE UNIQUE INDEX ... ON comprobantes (punto_venta, tipo, numero) WHERE _deleted=false` + `UNIQUE(cae)`. **Ojo: el índice tiene que incluir `tipo`** — en prod hay dos filas con `numero='00005-00000002'` y es legítimo (una `factura_b`, otra `nota_credito_b`); los correlativos de AFIP son por `(PtoVta, CbteTipo)`.
  3. Antes de ofrecer "Reintentar" en un error de red/timeout, llamar a `/api/arca/ultimo` y comparar con el correlativo esperado: si AFIP ya avanzó, el botón debe decir **"AFIP ya emitió — recuperar"**.
  4. Subir `proxy_read_timeout` de `/api/` a 180 s, o mover el lote a un job con polling.
- **Esfuerzo:** M

---

### H2 · Todo el repositorio —incluido `.git/`— se sirve por HTTP desde el web root

- **Dónde:** `nginx-mepex.conf:54` (`root /home/mepex/lobby`) + `:123-125` (`location / { try_files ... }`), **sin ninguna regla `location ~ /\.` ni `deny`**
- **Qué pasa:** `/home/mepex/lobby` es a la vez el checkout de git (lo confirma `lobby-api/index.js:99`: `REPO_DIR = path.join(__dirname,'..')`, el mismo directorio donde corre `git pull`) **y** el document root de nginx. Grep sobre el conf: **cero** reglas de denegación.
- **Cómo se explota:** cualquiera en internet baja:
  - `https://app.mepex.com.ar/tools/vps/server.js` → mapa exacto de endpoints
  - `/tools/vps/auth-middleware.js` → la lógica de autorización completa
  - `/tools/vps/arca-connector.js` → rutas de cert y key
  - los archivos de `sql/` → esquema completo, RLS, nombres de columna
  - `/CLAUDE.md` → documenta que `catalogo_items` es anon-readable, el IP del VPS y la arquitectura entera
  - **`/.git/config` + `/.git/HEAD` → clonar el historial completo**
- **Lo grave del historial:** hay **9 commits que tocan `lpk_live`** (API key LIVE de La PyME) y **2 que tocan `service_role`** en `config.js`/`api.js`. Una service key **bypassa toda la RLS**. Ambas figuran como rotadas el 2026-07-11 en la auditoría de Jordi, así que hoy el daño es "solo" divulgación de código — pero de acá en adelante **cualquier secreto que toque el repo por un minuto queda público para siempre**.
- **Arreglo:** agregar antes de `location /`:
  ```nginx
  location ~ /\.                                   { deny all; return 404; }
  location ~* ^/(sql|tools|docs|lobby-api|memory)/ { deny all; return 404; }
  location ~* \.(md|sql|sh|yml|lock)$              { deny all; return 404; }
  ```
  A mediano plazo, separar el checkout del document root (servir `/home/mepex/lobby-web` con solo los assets del front).
- **Esfuerzo:** S
- **[VERIFICAR EN VPS]:**
  ```bash
  curl -sI https://app.mepex.com.ar/.git/config        | head -1
  curl -sI https://app.mepex.com.ar/tools/vps/server.js | head -1
  curl -sI https://app.mepex.com.ar/CLAUDE.md          | head -1
  ```
  Si alguno da `200`, el agujero está abierto.

---

## ALTOS

### H3 · `/api/push/aviso` no está deployado: el push de eventos no sale y nadie se entera

- **Dónde:** `server.js:82` + `push.js:479` (commit `5565375`, 31/07) vs `api.js:4469`
- **Qué pasa:** la ruta nueva vive en **`server.js`**, no solo en `push.js` — **un `cp push.js` aislado no la monta**. Y `mepex-api` corre de una **copia** en `/home/mepex/api/`, no del repo. Del lado cliente, `pushNotificarAviso` hace `if (!res.ok) return null` → el 404 se traga entero, sin toast, sin log de error.
- **Cómo falla:** un PM mueve la fecha de armado a 2 días vista. La campanita se escribe bien; **el push al celular del taller nunca sale**. Son los 3 avisos que el diseño marcó como los únicos que valen una vibración: fecha cambiada (`api.js:927`), solapamiento (`:961`), armado en 2 días (`:4749`).
- **Arreglo:** deploy (comando abajo) + distinguir en el cliente `404` ("el connector no tiene /aviso, redeployar") de `5xx`.
- **Esfuerzo:** S

### H4 · El `nginx.conf` del 30/07 no está deployado → **el rate limit de todo `/api/*` es evadible**

- **Dónde:** `nginx-mepex.conf:82` (`proxy_set_header X-Forwarded-For $remote_addr;`), agregado en `443aa3f` (30/07)
- **Qué pasa:** el limitador de `auth-middleware.js:133-134` usa el **primer** valor de `X-Forwarded-For` como clave. Sin que nginx lo sobreescriba, **el cliente lo elige**. El propio commit lo dice: *"sin eso el rate limit de todo /api/* era evadible mandando el header"*. El handoff de deploy vigente (CLAUDE.md §10) solo pide `pull-lobby.sh` + `cp push.js` + `pm2 restart` — **no menciona re-copiar el conf de nginx**, y el conf se tocó después del último deploy documentado (15/07).
- **Cómo falla:** un `for` con `X-Forwarded-For: 1.2.3.$i` contra `/api/crm/digest` o `/api/ocr/comprobante` (con un token válido de **cualquier** usuario, incluido `taller`) quema la cuota de Anthropic sin tope. El `iaLimit` de 20/min deja de existir.
- **Esfuerzo:** S · **[VERIFICAR]:** `grep -n 'X-Forwarded-For' /etc/nginx/sites-enabled/mepex`

### H5 · El OCR de comprobantes **no puede funcionar con una foto de celular**: nginx corta en 5 MB

- **Dónde:** `nginx-mepex.conf:85` (`client_max_body_size 5m`) vs `server.js:44` (`express.json({limit:'15mb'})`) vs `carga-comprobante.js:212-219`
- **Qué pasa:** la imagen viaja **cruda en base64** (+33 %). Una foto de un celular moderno pesa 3-8 MB → 4-11 MB de body → nginx devuelve **413 HTML** antes de llegar a Express. El límite de 15 MB nunca se usa. `api.js:7624` convierte el 413 en `throw` y `:7628` en `return null`.
- **Cómo falla:** Sofi saca la foto de la factura, toca "✨ Leer con IA" y le aparece *"IA no disponible — cargá los datos a mano"*. **El diagnóstico apunta al motor de IA (que está perfecto) en lugar de al tamaño.** Es exactamente el caso de uso para el que se construyó la feature. El límite está desde `2ef16d2` (11/07) → **vivo hoy**; los smokes que pasaron usaron imágenes chicas.
- **Arreglo:** comprimir en el cliente antes de mandar — **el helper ya existe**: `_compressImage` en `proyecto-detalle.js` (1600 px / JPEG 0.82), usado para las fotos del armado. Además subir `client_max_body_size` de `/api/` a `16m` y que el mensaje distinga 413 ("la foto es muy grande") de 502 ("la IA no responde").
- **Esfuerzo:** S

### H6 · `requireRole(...,'finanzas')`: rol inexistente, confirmado contra prod

- **Dónde:** `server.js:67`, documentado igual en `auth-middleware.js:20`
- **Qué pasa:** `finanzas` es un **módulo**, no un rol. Roles vivos en prod: `superadmin` (7), `admin` (4), `pm` (2), `taller` (3). **No existe `finanzas` ni `venta`.**
- **Riesgo real (inverso):** falla cerrado, así que hoy no hay daño — pero alguien puede "arreglar" el desfase creando un rol `finanzas` en `profiles` sin notar que **ese rol no está en `Data.rolePermissions` ni en la matriz `fn_role_can`**: el usuario quedaría sin acceso a nada en la app mientras **sí** puede emitir facturas AFIP reales por el proxy.
- **Nota lateral:** `push.js:89` `ROLES_VALIDOS` incluye `'venta'`, que tampoco existe (inofensivo).
- **Arreglo:** `requireRole('superadmin','admin')` y borrar la mención del comentario.
- **Esfuerzo:** S

### H7 · `config.js` está gitignored: **no se deploya con `pull-lobby.sh`**, y en el repo `VAPID_PUBLIC_KEY` está vacía

- **Dónde:** `.gitignore:2`, `config.js:25`
- **Qué pasa:** es el único archivo del front que no viaja por git. Toda constante nueva requiere **edición manual en el VPS**. Y si alguien lo edita ahí, `git pull --ff-only` sigue funcionando (está ignorado) → **no hay ninguna señal de divergencia**.
- **Cómo falla:** el repo dice `const VAPID_PUBLIC_KEY = '';` con un `⚠️ PENDIENTE DE FEDE` al lado, mientras CLAUDE.md afirma "✅ PUSH ANDANDO EN PROD". O la clave está solo en el VPS (y nadie puede reproducir el front localmente ni auditar cuál está viva), o el push nunca se activó y `diagnostico()` devuelve `sin_configurar` en silencio. **No hay forma de saberlo desde el repo.**
- **Arreglo:** versionar todo lo que no sea verdaderamente secreto (hoy: nada — la anon key y la VAPID pública son públicas por diseño). O como mínimo, un check al final de `pull-lobby.sh` que compare las constantes de `config.js` contra `config.example.js` y grite si falta alguna.
- **Esfuerzo:** S · **[VERIFICAR]:** `grep -c "VAPID_PUBLIC_KEY = ''" /home/mepex/lobby/config.js` → `1` = el push nunca se activó

### H8 · Contrato Cotizador: el lobby hace `DELETE` masivo sobre tablas que son del cotizador

- **Dónde:** `importar-cotizacion.js:297-298`, `stands.js:462`
- **Qué pasa:** CLAUDE.md §7 dice que `cotizacion_items` / `cotizacion_espacios` **las escribe el cotizador** y el lobby solo lee. Pero el importador **borra todos los ítems y espacios** de una cotización antes de reinsertar los suyos.
- **Cómo falla:** Noe arma una cotización en el cotizador (que escribe sus ítems estructurados); después alguien en el lobby usa "Importar ítems" pegando el texto del PDF de esa misma cotización → **se borran los ítems buenos del cotizador** y quedan los parseados del PDF, sin `precio_unitario_base` ni los multiplicadores reales.
- **Y la premisa ya no vale:** el importador se justificaba con *"`full_state` no trae los ítems"*, pero CLAUDE.md §10 registra el 2026-07-01 que **hoy sí los trae**.
- **Arreglo:** guard que cuente los ítems existentes y pida confirmación mostrando qué se va a pisar. Mejor: retirar el importador de texto y leer `cotizacion_items` directo — que es lo que el propio CLAUDE.md marca como la integración a priorizar.
- **Esfuerzo:** S (guard) / M (retiro)

---

## MEDIOS

| # | Hallazgo | Esf. |
|---|---|---|
| H9 | **Una service key rota deja `requireRole` en 403 para todos, sin diagnóstico.** `fetchProfile` usa `SERVICE_KEY \|\| ANON_KEY`: si está **ausente** cae a anon y funciona; si está **presente pero inválida** (legacy `eyJ…` deshabilitada desde 2026-04-06, o mal copiada) → `return null` → 403 a todo el mundo. `push.js:578` tiene un `autodiagnostico()` que nombra exactamente esta falla; `auth-middleware.js` no tiene nada equivalente — **y es el que gatea la facturación**. Fede rota la key, se equivoca en un carácter, el server arranca sin advertencias, el push sigue andando, y Sofi (admin) recibe "Acceso denegado" al facturar. | S |
| H10 | **`/api/push/aviso` marca el suceso como pusheado ANTES de leerlo**: `sucesosYaPusheados.add(clave)` en `:506` precede al `sbGet` de `:510`. Si esa lectura falla, el handler devuelve 500 pero la clave ya está puesta → cualquier reintento contesta "ya se pusheó". Un hipo de 2 s de Supabase **pierde el push de forma permanente** (no hay cola), y la campanita queda bien así que nadie lo nota. Fix: `sucesosYaPusheados.delete(clave)` en el catch. | S |
| H11 | **El webhook de WhatsApp parsea hasta 5 MB de JSON antes de validar la firma, y sin rate limit** (es el único POST de `/api/` sin ninguno). Cualquiera que conozca la URL manda POSTs de 5 MB sin firma; cada uno se bufferea y parsea en el event loop **antes** de rebotar con 403. Con paralelismo modesto, `mepex-api` se pone lento o muere — **y con él caen ARCA, CRM digest, OCR y push, todos en el mismo proceso**. Fix: parser dedicado de `256kb` + `rateLimit` delante. | S |
| H12 | **`/api/crm/digest` sin tope de texto**: `contexto` se recorta a 4000 pero `texto` va entero al modelo (~5 MB de prompt posibles). Sin budget cap configurado — y con H4 sin deployar, sin límite real de requests. | S |
| H13 | **`_adminFetch` sin timeout y sin manejo de respuesta no-JSON**: `await res.json()` se ejecuta **antes** de mirar `res.ok`. Si `lobby-api` está caído, nginx devuelve 502 HTML → `SyntaxError: Unexpected token '<'` como mensaje de error al crear un usuario. Y si el proceso está colgado, el spinner gira hasta el timeout del navegador. Es el único de los fetch al VPS **sin `AbortController`** (los otros 4 sí lo tienen). | S |
| H14 | **`cotizacion_propuestas`: RLS habilitada y cero policies** = deny-all para `anon` y `authenticated`; solo `service_role`. Es la única de las 5 tablas del contrato del cotizador en ese estado. Si el cotizador escribe desde el browser, **la generación de propuestas está rota desde el 26/07**; si escribe con service key, está bien pero es una asimetría no documentada. **[VERIFICAR]** en el repo del cotizador con qué key se conecta. | S |
| H15 | **Divergencia de `pushDefault` en la categoría `eventos`** (confirma C13 del informe de notificaciones): la pantalla muestra el switch de Celular apagado y el push sale igual. El default del servidor es el correcto; lo que hay que arreglar es que la UI lo refleje. | S |
| H16 | **`verifyToken`/`fetchProfile` sin timeout y sin caché**: ningún `AbortSignal.timeout`; un Supabase lento cuelga la request hasta que nginx corta a los 60 s. Y `requireRole` hace **dos** llamadas (user + profile) en el camino de facturación, el más largo. Fix: timeout de 8 s + caché en memoria `token → {user, profile}` con TTL 60 s (el JWT dura ~1 h; saca el 95 % de las llamadas). | S |
| H17 | **Estado en memoria por proceso**: `_facturarChain`, `hits` (rate limit), `ultimoPushPorTarea`, `sucesosYaPusheados` son todos `Map`/`Set`/Promise del proceso. Con `pm2 start -i N` habría N copias → **la serialización de emisiones deja de serializar** y dos `FECompUltimoAutorizado` simultáneos devuelven el mismo número. Fix: dejar explícito `instances: 1` / `exec_mode: fork` en el ecosystem + un comentario en `arca-connector.js` diciendo por qué. **[VERIFICAR]:** `pm2 describe mepex-api \| grep -iE 'instances\|exec mode'` | S |

### H18 · Cabos sueltos (BAJO)

- **`LOBBY_API_URL = 'http://localhost:3002'`** (`config.js:11`, `config.example.js:17`): declarada, **nunca leída** (`api.js:3514` usa el relativo `/lobby-api`). Borrar antes de que alguien la "arregle".
- **`/api/arca/status` y `/api/push/estado`**: montados, con auth, **sin ningún llamador**. Útiles como smoke manual → documentarlo en `server.js` para que no se borren por "código muerto".
- **`octexa-ia.js`**: en el repo, no montado, y nginx sí tiene `location /octexa-api/ → :3010` (otro servicio). Fácil de confundir.
- **`/deploy`**: `token === process.env.DEPLOY_TOKEN` no es constant-time. Con el rate limit de 10/min es teórico, pero `crypto.timingSafeEqual` cuesta 2 líneas (y ya se usa bien en `whatsapp-webhook.js:66`).
- **`/health` de `mepex-api`** expone `version: '1.1.0'`. Gratis sacarlo.
- **`frame-src` vs `pdf_url`**: `crm.js:2895` y `modules.js:3779` meten en un `<iframe>` una URL que sale de `cotizaciones.pdf_url`. La CSP lo bloquea si apunta a otro host — bien como defensa, **pero el fallo es mudo**. Si el cotizador cambia de host de storage, el visor de PDF muere sin mensaje.

---

## Matriz CSP vs URLs reales del código

Barrido exhaustivo del front. **Ningún host queda afuera de la policy — la CSP está bien construida.** Lo relevante son las dependencias frágiles:

| Host que contacta el código | Dónde | ¿Permitido? | Consecuencia si no |
|---|---|---|---|
| `selnevalaeykdrgycvdz.supabase.co` | `config.js:8` + Storage en 6 módulos | ✅ `connect-src`, `frame-src` | la app entera muere |
| `wss://…supabase.co` | implícito en supabase-js — **no hay un solo `.channel()`/`.subscribe()` en todo el front** | ✅ | hoy no se usa |
| `dolarapi.com/v1/…` | `api.js:7149-7150` | ✅ (apex, sin `api.`) | "🔄 Sugerir" deja de funcionar; degrada a carga manual |
| `cdnjs.cloudflare.com` (jsPDF, autotable, qrcodejs, Chart.js) | `app.js:40,41,42,72` | ✅ `script-src` + `connect-src` | **la app no carga**: son scripts obligatorios de `_APP_SCRIPTS` |
| `cdn.jsdelivr.net` (supabase-js@2) | `index.html:30`, `encuesta.html:15` | ✅ | no hay login |
| `us-assets.i.posthog.com` / `us.i.posthog.com` | `app.js:95`, `posthog-init.js:30` | ✅ | nada (está en `_OPTIONAL_SCRIPTS`) / se pierde analytics |
| `fonts.googleapis.com` | `index.html:12,14`, `encuesta.html:9,11`, **`style.css:10` (`@import`)** | ✅ | ⚠️ **el `@import` de `style.css` es la dependencia menos visible del repo**: si se cae esa entrada muere el stack tipográfico entero, no solo el `<link>` del index |
| `fonts.gstatic.com` | `index.html:13` | ✅ `font-src` | fuentes al fallback |
| `drive.google.com/embeddedfolderview` | `proyecto-detalle.js:965→982` | ✅ `frame-src` | pestaña "Archivos Drive" en blanco |
| `blob:` en iframe (acta de entrega) | `proyecto-detalle.js:1689→1693` | ✅ | no se ve el acta firmada |
| `data:`/`blob:` en `<img>` (QR AFIP, previews, logos) | 14 sitios | ✅ `img-src data: blob:` | PDFs sin logo ni QR |
| `https:` arbitrario en `<img>`/`background-image` | `locaciones.js`, `catalogo.js`, `stands.js` | ✅ (comodín) | si se acota `https:` a allowlist, sumar Supabase **explícitamente** a `img-src` |
| `/manifest.json`, `/sw.js` | `index.html:21`, `push-cliente.js:24` | ✅ | sin PWA no hay push en iOS |
| `www.afip.gob.ar/fe/qr/` | `finanzas.js:8236` | n/a | **falso positivo**: es el *texto* codificado dentro del QR, no un request |
| `unpkg.com`, `api.dolarapi.com`, `app.posthog.com`, `api.lapyme.com.ar`, `195.200.1.250` | — | — | **cero referencias en código vivo** (el IP viejo sobrevive solo en `.md`) |

**Sin `form-action` afuera:** no hay un solo `<form action="https://...">`. `'self'` alcanza.

---

## Grafo de dependencias `tools/vps/` + comandos de deploy

```
server.js  (entry, pm2 'mepex-api')
 ├── dotenv, express, cors                    ← npm
 ├── ./auth-middleware   (sin deps propias)
 ├── ./ocr-comprobante   (sin deps propias)
 ├── ./crm-digest        (sin deps propias)
 ├── ./arca-connector    → fs, https, path, child_process + binario `openssl` en PATH
 ├── ./push              → web-push (npm; si falta, el push se desactiva y el server arranca igual)
 └── ./whatsapp-webhook  → crypto

octexa-ia.js  ← HUÉRFANO: nadie lo requiere. No hace falta copiarlo.

lobby-api/index.js (pm2 'lobby-api')
 └── dotenv, express, cors, @supabase/supabase-js, child_process, path
```

> **Regla que ya costó una caída** (30/07, faltaba `whatsapp-webhook.js`): `server.js` requiere **6 hermanos** en el top level. Si falta uno, el `require` tira y `mepex-api` entra en crash-loop llevándose ARCA + CRM + OCR + push juntos. **Nunca copiar `server.js` solo.**

```bash
# ── A) mepex-api (ARCA · CRM digest · OCR · push · WhatsApp) — SIEMPRE los 7 juntos
~/pull-lobby.sh
cd /home/mepex/lobby/tools/vps && cp server.js push.js auth-middleware.js \
   arca-connector.js crm-digest.js ocr-comprobante.js whatsapp-webhook.js \
   /home/mepex/api/
pm2 restart mepex-api
pm2 logs mepex-api --lines 30      # buscar "[push] ✓ listo" y ningún MODULE_NOT_FOUND
curl -s https://app.mepex.com.ar/health

# ── B) lobby-api (usuarios, reset pass, /deploy) — CORRE DEL REPO, sin cp
~/pull-lobby.sh && pm2 restart lobby-api

# ── C) nginx (CSP · PWA no-cache · X-Forwarded-For · deny de dotfiles)
sudo cp /home/mepex/lobby/tools/vps/nginx-mepex.conf /etc/nginx/sites-enabled/mepex
sudo nginx -t && sudo systemctl reload nginx
# (sites-enabled/mepex es COPIA, no symlink; los backups van FUERA de esa carpeta)

# ── D) front (index.html + los ~50 módulos JS)
~/pull-lobby.sh

# ── E) config.js — NO viaja por git (gitignored). Edición manual:
nano /home/mepex/lobby/config.js
```

---

## Riesgo de desfase repo ↔ prod

| Feature del front | Depende de | ¿Deployado? | Cómo verificarlo |
|---|---|---|---|
| **Push de eventos** (fecha · solapamiento · armado 2d) | ruta en **`server.js:82`** + `push.js:479` (31/07) | **Casi seguro NO** — el handoff pide `cp push.js` solo y la ruta está en `server.js` | logueado: `fetch('/api/push/aviso',{method:'POST',headers:{'Content-Type':'application/json',...await API._authHeader()},body:'{}'}).then(r=>r.status)` → `400` = ok · `404` = falta |
| **Rate limit real de `/api/*`** | `nginx:82` (30/07) | **Probablemente NO** (último deploy de nginx: 15/07) | `grep -n 'X-Forwarded-For' /etc/nginx/sites-enabled/mepex` |
| `/sw.js` sin caché + `Service-Worker-Allowed` | `nginx:61-65` | Probablemente NO | `curl -sI https://app.mepex.com.ar/sw.js \| grep -i cache-control` |
| `worker-src`/`manifest-src` en CSP | `nginx:52` | Probablemente NO | **sin impacto**: caen al fallback de `default-src 'self'` |
| **Push VAPID (todo)** | `config.js` **fuera de git** | Indeterminable desde el repo | `grep -c "VAPID_PUBLIC_KEY = ''" /home/mepex/lobby/config.js` → `1` = nunca se activó |
| Facturación ARCA | `arca-connector.js` (sin cambios desde 23/06) | **SÍ** | `curl` autenticado a `/api/arca/status` → `{ok:true, AppServer:"OK"}` |
| CRM digest / OCR | `crm-digest.js`, `ocr-comprobante.js` (19/07) | **SÍ** | F12 → Network: respuesta con `provider:"claude"` |
| WhatsApp webhook | `whatsapp-webhook.js` (17/07) | **SÍ desde 30/07** | `curl -s ".../api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=x"` → `403` (no 404) |
| Usuarios, `/deploy` con 429 | `lobby-api/index.js` (16/07) | **SÍ** (corre del repo) | 11 POSTs a `/lobby-api/deploy` sin token → el 11º da `429` |
| Módulos del front | `App._APP_SCRIPTS` | Verificable | `curl -s .../app.js \| grep -o "api.js?v=[0-9]*"` |

---

## Ideas / mejoras

1. **Un `deploy.sh` versionado que haga los 5 pasos.** Hoy el orden vive en prosa repartida entre CLAUDE.md §10, `docs/cierre-auditoria-jordi.md` y un comentario en `push.js:21`. Un script con `set -e` que copie los 7 archivos, reinicie, chequee `/health` y compare las constantes de `config.js` **elimina de una la clase entera de bugs H3/H4/H7**.
2. **Un endpoint `/api/version`** que devuelva el `git rev-parse HEAD` del repo **y** el hash de los archivos copiados en `/home/mepex/api/`. El desfase se ve de un vistazo en vez de deducirse por arqueología de commits.
3. **Índices únicos como red de seguridad fiscal**: `UNIQUE(cae)` y `UNIQUE(punto_venta, tipo, numero) WHERE _deleted=false`. Dos líneas de migración que convierten una doble emisión silenciosa en un error ruidoso.
4. **Recortar el prompt del CRM y comprimir la imagen del OCR en el cliente** — bajan costo de IA y arreglan H5/H12 a la vez.
5. **Budget cap mensual en `console.anthropic.com`** para la key del VPS. Es la última recomendación abierta de la auditoría de Jordi, y con H4 sin deployar es más urgente de lo que parecía.
6. **El `deny` de dotfiles (H2) debería entrar en el mismo deploy que H4** — es la misma copia de archivo.

---

## Falsos positivos descartados

- **Inyección XML en el connector de ARCA** → revisados los 12 puntos de interpolación: `tipo` sale de un mapa, los numéricos pasan por `parseInt`/`Number`, los CUIT por `.replace(/\D/g,'')`, las fechas por regex `^\d{8}$`. **No hay camino de string libre al XML.**
- **Inyección PostgREST en `push.js`** → allowlist de roles, `RE_UUID`/`soloUuids` y regex de `categoria` cubren los 3 filtros que corren con service key.
- **CORS** → `cb(null,false)` en ambos servicios, correcto, con el comentario del bug de 15/07 que lo motivó.
- **Firma HMAC del webhook** → `timingSafeEqual` sobre el raw body, con el `try/catch` necesario porque tira si los buffers difieren en longitud. Correcto.
- **`requireRole` chequea `profile.active === false`** → es una capa que la RLS **no** tiene.
- **Offset fijo UTC-3 en `push.js:185`** → correcto, con el comentario de por qué `Intl` falla callado en Node con small-icu.
- **`sw.js` sin handler de `fetch`** → deliberado: un SW sin `fetch` no puede romper la carga.
- **Dos filas con `numero='00005-00000002'`** → **no** es doble emisión: una es `factura_b` y otra `nota_credito_b`, con CAEs distintos. Los correlativos de AFIP son por `(PtoVta, CbteTipo)`.
- **`open redirect` en `notificationclick`** → `sw.js:85` valida `startsWith('/') && !startsWith('//')`.
- **`iaLimit` antes de `requireAuth`** → parece invertido pero es correcto: protege también el chequeo de auth. Efecto lateral: una oficina detrás de NAT comparte los 20/min.
