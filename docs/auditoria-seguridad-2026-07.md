# Auditoría de Seguridad — LOBBY-MEPEX (checklists JordiGPT)

> Fecha: 2026-07-10. Aplica los **46 chequeos** de los 2 PDFs de JordiGPT (base 27 + avanzado 19) al código real.
> Método: 4 agentes de auditoría en paralelo (Auth/RLS, Secretos, Input/XSS, IA/Infra) + verificación en vivo contra `http://195.200.1.250`.
> **Los PDFs asumen stack Next.js + Supabase + Stripe/Vercel.** LOBBY es vanilla JS estático + Supabase + proxy Node en VPS + ARCA/La PyME → cada chequeo se adaptó al stack real.

## Contexto del stack (define todo el modelo de amenaza)
- **Todo el frontend es público por diseño** (JS servido estático, sin build/minify). La seguridad NO puede vivir en el cliente.
- Las 3 capas donde SÍ vive la seguridad: **(a) RLS en Supabase**, **(b) el backend `lobby-api`** (service_role), **(c) el proxy `mepex-api`** en el VPS.
- La `publishable key` de Supabase en `config.js` es **correcta** en cliente — siempre que RLS proteje.
- **No auditable desde el repo** (vive en el VPS / dashboards): `server.js` del proxy, config de nginx, estado real de RLS en prod, settings de sesiones/rate-limit de Supabase, rotación efectiva de claves. Marcado como "verificar".

---

## 🔴 CRÍTICOS / URGENTES

### C1 — El proxy ARCA emite facturas fiscales REALES sin autenticación *(verificado en vivo)*
`GET http://195.200.1.250/api/arca/status` responde **HTTP 200 con datos y `prod:true` sin ningún token**. Eso prueba que el proxy `mepex-api` **no tiene auth delante de `/api/arca/*`**. El handler `/api/arca/facturar` (`tools/vps/arca-connector.js:392`) tampoco valida identidad y **emite comprobantes AFIP reales con CAE bajo el CUIT de MEPEX** (30709990817). El frontend lo llama same-origin sin token (`finanzas.js:7904,8309`). → **Cualquiera que alcance la URL puede emitir facturas a nombre de MEPEX.** Los endpoints IA (`/api/crm/digest`, `/api/ocr/comprobante`, `/api/octexa/ask`) están igual: sin auth → abuso de las API keys de Gemini/Claude.
**Fix:** middleware en `server.js` (VPS) que valide el `Authorization: Bearer <supabase access_token>` delante de `/api/arca/*`, `/api/crm/*`, `/api/ocr/*`, `/api/octexa/*`; para `/facturar`, además exigir rol admin/finanzas. (Requiere el `server.js` del VPS, que no está en el repo.)
**Chequeos:** 1.9, 8.2, 3.4, 6.4/6.5 (análogo a 5.1 webhooks Stripe).

### C2 — Todo el sistema viaja por HTTP sin cifrar *(verificado en vivo)*
El sitio se sirve por `http://195.200.1.250` (por IP, sin TLS; `https://` no responde). El token de sesión de Supabase (access + refresh) viaja **en claro** en cada request. Cualquiera en la misma red (wifi de oficina/galpón, ISP, router comprometido) puede interceptar un token y **secuestrar la sesión** — incluida la de admin/finanzas. Para una app con datos contables y facturación, es grave.
**Fix:** apuntar un dominio (ej. subdominio de `mepex.com.ar`) al VPS y poner **Let's Encrypt / Caddy** → HTTPS. Recién ahí HSTS.
**Chequeos:** 4.2 (peor que "falta HSTS": falta HTTPS entero).

### C3 — Confirmar rotación de 2 claves que quedaron en el historial de git
Dos secretos reales estuvieron commiteados y luego removidos:
1. **`service_role` de Supabase** (estaba en `config.js`, servido al browser → bypass total de RLS). Commit `f917d42` la metió, `cd7ef99` la sacó diciendo *"claves legacy rotadas y deshabilitadas"*. El uso del formato nuevo `sb_publishable_` sugiere que se migró — **pero hay que confirmar que el JWT secret del proyecto se rotó de verdad.**
2. **API key LIVE de La PyME** (`lpk_live_…`, en `api.js` ~20 commits). Commit `2594353` dice *"revocada"* — **confirmar en el panel de La PyME.**

Si ambas están efectivamente rotadas/revocadas, C3 queda cerrado (residual histórico inofensivo). Si no, están vivas en la historia para siempre.
**Chequeos:** 2.3, 2.5.

---

## 🟠 ALTOS

### A1 — Sin rate limiting en ninguna capa
No hay `express-rate-limit`, ni `nginx limit_req`, ni throttle en `lobby-api`. Impacto: fuerza bruta contra login/`DEPLOY_TOKEN`, y **denial-of-wallet** en los endpoints IA (hoy amortiguado porque Gemini corre en free tier → tope natural $0, pero DoS del feature sí; si migran a tier pago, es costo real).
**Fix:** `express-rate-limit` sobre `/api/crm/*`, `/api/ocr/*`, `/api/octexa/*` (~20 req/min/IP) + `limit_req_zone` en nginx + hard budget cap en Google AI Studio / consola Anthropic.
**Chequeos:** 4.3, 6.4, 6.5, 7.1.

### A2 — Sin 2FA en cuentas admin
No hay MFA en ningún lado (`auth.js` solo `signInWithPassword`). Superadmin (Fede) y admins (Lelean, Sofi) — que ven finanzas y **emiten facturas AFIP** — entran solo con usuario+password. Supabase soporta MFA TOTP nativo.
**Fix:** `supabase.auth.mfa.enroll` (TOTP) obligatorio para `admin`/`superadmin`, con gate AAL2 para finanzas/facturación. Mejor ratio esfuerzo/impacto de toda la lista.
**Chequeos:** 7.3.

---

## 🟡 MEDIOS

### M1 — XSS almacenado interno: escapado inconsistente
~540 asignaciones `innerHTML =` en ~46 archivos; el helper `escHtml`/`escAttr` (`components.js:22-27`) está aplicado de forma despareja. Campos de texto libre (`concepto`, `nombre`, `notas`, `venue`, `descripcion`) se interpolan **crudos** incluso en módulos que sí tienen helper. Un usuario mete `<script>`/`</textarea>` en un campo → se ejecuta en el navegador de otro. Peores ofensores:
- **`contabilidad.js`** (63 innerHTML, 0 escape) — nombres de cliente/proveedor (editables por comercial) caen en vistas contables de admin.
- **`finanzas.js`** — `concepto` crudo en ingresos/egresos/comprobantes.
- **`costos.js`** — nombres/notas de insumos crudos (`</textarea>` breakout).
- **`calendario-operativo.js`** — `venue`/nombres, visible por `taller`/`pm`.
- **`admin-panel.js`** — nombres/iniciales de usuario.
- **`rrhh.js:969`** — una textarea de notas cruda.
No hay CSP ni DOMPurify como red de seguridad.
**Fix:** envolver esas interpolaciones en `escHtml()`/`escAttr()` + agregar CSP (header nginx o `<meta>`) como defensa sistémica. *(Esto lo puedo hacer yo en el código.)*
**Chequeos:** 3.1, 6.7 (6.7 ya está OK: el output del LLM SÍ se escapa).

### M2 — PII de clientes argentinos a Gemini free tier
El CRM digest y el OCR mandan datos personales reales (conversaciones, nombres, CUIT, razón social, montos) al LLM. El driver por defecto es **Gemini free tier de AI Studio**, que **usa los prompts para mejorar sus productos** (no zero-retention). Anthropic API sí es no-training por defecto.
**Fix:** cambiar `MODEL_PROVIDER=claude` (el driver ya lo soporta, 1 variable) o Gemini vía Vertex con data governance; separar system/datos en el prompt (prompt injection, 6.1); validar el JSON de salida contra schema en el backend.
**Chequeos:** 6.6, 6.1.

### M3 — Endurecer RLS: policies `anon` peligrosas + tablas nuevas sin cubrir
La "RLS por matriz" (Capa 2 / Fase 9.bis) está bien diseñada, pero:
- **`clientes` con `SELECT TO anon USING(true)`** (`rls_capa2_comercial.sql:92`) → cualquiera con la publishable key baja **toda la base de clientes** (PII). El propio SQL tiene un `TODO`: si el cotizador no la necesita, borrarla.
- **`encuestas_evento` con `UPDATE TO anon USING(true) WITH CHECK(true)`** (`rls_capa2_operativo.sql:131`) → anon puede sobrescribir cualquier respuesta de encuesta (el filtro por token vive solo en JS). Mover el submit a un RPC `SECURITY DEFINER`.
- **Tablas creadas después del 2026-06-13** (crm_bandeja_v2, stands_predisenos, proyecto_conformes, catalogo_showroom_f1, etc.) no están en los arrays de Capa 2 → **verificar que tengan RLS ON en prod**.
- **PII operativa sin aislar**: `personas`, `persona_documentos`, `ausencias`, `inventario_*`, `compras_*` están en `FOR ALL TO authenticated USING(true)` → cualquier logueado (incl. `taller`) lee/escribe toda la tabla por consola del browser. Es decisión de diseño ("no esconde filas entre oficina"), pero la PII de RRHH conviene gatearla por `fn_role_can('rrhh',...)`.
**Fix:** correr en prod `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT tablename FROM pg_policies …)` para el inventario; borrar/ajustar las 2 policies anon; gatear PII de RRHH.
**Chequeos:** 1.1, 1.2, 1.5, 1.4.

### M4 — Sesiones no se invalidan al cambiar contraseña
`Auth.changePassword` (`auth.js:199-207`) hace `updateUser({password})` pero no revoca las otras sesiones. Reset por admin igual. Un token robado sigue vivo aunque la víctima cambie la clave.
**Fix:** tras cambiar password, `supabaseClient.auth.signOut({ scope: 'others' })`; en reset admin, `auth.admin.signOut(uid,'global')` en el backend; activar la revocación en el dashboard de Supabase.
**Chequeos:** 7.4.

### M5 — Escalada de rol: mitigada por trigger, verificar en prod
El path cliente permite mandar `role` arbitrario en el update de perfil (`api.js:3319`). La única defensa es el trigger `fn_profiles_guard` (`rls_capa2_roles_profiles.sql:94-118`) que bloquea cambios de `role`/`active`/`custom_permissions`. La memoria dice que Capa 2 corrió en prod. **Si el trigger NO estuviera aplicado → escalada trivial (CRÍTICO).**
**Fix:** verificar en Supabase que `trg_profiles_guard` existe y `profiles`/`roles` tienen RLS ON. Si falta, correr `sql/rls_capa2_roles_profiles.sql`.
**Chequeos:** 8.1, 1.6.

---

## 🟢 BAJOS / higiene

- **B1 — CORS `*` en `lobby-api`** (`index.js:32`, `app.use(cors())`). Mitigado porque todo va con Bearer JWT (no cookies), pero acotar a `origin: 'http://195.200.1.250'`. *(Puedo hacerlo yo.)* — chequeo 4.1.
- **B2 — GEMINI key en el query string** de la URL saliente (`crm-digest.js:50`, etc.). Hoy no se loguea, pero cualquier APM futuro la filtraría. Pasar a header `x-goog-api-key`. *(Puedo hacerlo yo.)* — chequeo 4.4.
- **B3 — Endpoint `/deploy` con `DEPLOY_TOKEN` estático** (`lobby-api/index.js:92`) sin rate-limit → fuerza bruta del token. Bien construido por lo demás (solo `git pull --ff-only`, args fijos). — chequeo 8.2.
- **B4 — Verificar bucket `stands`**: `stands.js:654` sube con `contentType: file.type` y no encontré su `storage.buckets` INSERT con `allowed_mime_types`/`file_size_limit`. Los demás buckets (comprobantes, fotos, remitos, catalogo) sí validan MIME+size server-side. — chequeo 8.3.
- **B5 — `npm audit` sin correr** en `lobby-api` (express, cors, supabase-js, dotenv). — chequeo 9.3.
- **B6 — Password mínimo 6 caracteres** (`lobby-api/index.js:116`, `settings.js:180`). Subir a ≥10-12. — higiene.

---

## ✅ Lo que está BIEN (para no cundir en pánico)

- **1.3 JWT** — el frontend delega 100% en Supabase, no decodifica a mano. OK.
- **1.6 Roles** — el RBAC está enforced **server-side** (RLS por matriz + trigger anti-escalada + backend con service_role), no solo escondido en la UI. Muy bien resuelto.
- **2.1 / 2.2 / 2.4 / 2.5 (código actual)** — cero secretos en el frontend; `config.js` gitignoreado con solo la publishable key; `.env` no trackeado (solo `.example`); service_role solo en el backend vía `process.env`; sin certs en el repo.
- **3.2 SQLi** — query builder de Supabase parametrizado en todos lados; la única migración con `EXECUTE` usa `format(%I)`. OK.
- **3.3 SSRF** — no hay fetch server-side de URLs del usuario (el OCR recibe base64, no una URL). OK.
- **6.3 API key del LLM** — vive solo en el VPS, el frontend pega al proxy. OK.
- **6.7 Output del LLM** — el OCR escribe a `.value` (no HTML) y el digest pasa por `escHtml`. OK.
- **8.3 Uploads** — MIME + tamaño validados a nivel bucket (15MB, tipos allow-list) + recompresión JPEG cliente. OK (salvo verificar `stands`).
- **`lobby-api`** — valida rol **server-side** (`requireSuperadmin`: verifica JWT + re-chequea `profiles.role`). El endpoint `/deploy` bien protegido.
- **Human-in-the-loop** en IA — el OCR solo pre-carga el form y el digest sugiere; ningún LLM auto-ejecuta acciones ni tiene tool-calling. Esto amortigua el prompt injection (6.1).

---

## Score honesto

De los 46 chequeos, **~4 no aplican** (5.1-5.4 Stripe/créditos/e-commerce — no hay pagos online) y **2 son N-A por el stack** (8.4 GraphQL, 9.2 source maps por no haber build). De los **~40 que aplican**, pasás limpio **~25**. En la escala de Jordi eso es **"Bien encaminado" tirando a sólido en las bases** — con un puñado de agujeros reales, **uno crítico** (el facturador abierto) y el tema estructural de HTTP sin cifrar. No estás en zona de riesgo, pero tampoco blindado. El grueso de lo que falta es infra (HTTPS, auth del proxy, rate-limit) más que errores de código.

## Reparto de trabajo
- **Yo solo, en el código del repo:** M1 (escapar XSS + CSP), B1 (CORS), B2 (key al header), M4 (signOut scope), fixes de policies anon vía SQL (M3 parcial), B6.
- **Necesito el `server.js` del VPS (no está en el repo):** C1 (auth del proxy), A1 (rate-limit del proxy).
- **Vos / dashboards (yo no tengo acceso):** C2 (HTTPS+dominio), C3 (confirmar rotaciones), A2 (activar MFA), M2 (cambiar provider IA), verificar RLS en prod (M3/M5), settings de sesión Supabase (M4).
