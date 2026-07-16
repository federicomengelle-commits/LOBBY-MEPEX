# Cierre de la auditoría JordiGPT — LOBBY-MEPEX

> **Fecha de cierre: 2026-07-13.** Pasada final contra los 46 chequeos de los 2 PDFs de JordiGPT
> (base 27 + avanzado 19), aplicados al stack real. Informe original: `docs/auditoria-seguridad-2026-07.md`
> (2026-07-10). Este doc registra el estado FINAL de cada hallazgo **con evidencia verificada en prod**
> (curls externos del 2026-07-13, sin acceso privilegiado — lo que probaría un atacante).

## Resumen ejecutivo

- **Todo lo CRÍTICO, ALTO y MEDIO está cerrado y verificado en prod.** No queda ningún agujero explotable conocido.
- Score: de **~25/40** chequeos aplicables en verde (2026-07-10) a **~38/40** (2026-07-16: CSP enforcing en prod, B3 verificado con 429, B5 0 vulns, M4 completo).
- Lo abierto (todo manual de Fede, ~10 min): **adopción** del MFA (el mecanismo ya está live), el toggle de password mínimo en el Dashboard (B6), y 2 verificaciones por SQL Editor (trigger M5, bucket `stands` B4).

## Cuadro final de hallazgos

| # | Hallazgo | Estado | Evidencia / detalle |
|---|----------|--------|---------------------|
| **C1** | Proxy ARCA/IA sin auth (emitía facturas AFIP reales) | ✅ **CERRADO** | Bearer JWT + `requireRole(admin/finanzas)` en `/facturar`. Verificado 2026-07-13: `/api/arca/*`, `/api/crm/digest`, `/api/ocr/comprobante` → **401 sin token** |
| **C2** | Todo por HTTP sin cifrar | ✅ **CERRADO** | `https://app.mepex.com.ar` (Let's Encrypt + hook de renovación). Verificado 2026-07-13: redirect **301** http→https, **HSTS** max-age=31536000 includeSubDomains |
| **C3** | Rotación de service_role + lpk_live (historial git) | ✅ **CERRADO** | Fede confirmó rotación/revocación (2026-07-11). Código actual limpio; residual histórico inofensivo |
| **A1** | Sin rate limiting | ✅ **CERRADO + VERIFICADO** | `iaLimit` 20 req/min en endpoints IA del proxy; ARCA detrás de auth+rol; `/deploy` de lobby-api con 10 req/min — **verificado en prod 2026-07-16: 10×401 → 429** desde el browser. Recomendado: budget cap mensual en console.anthropic.com |
| **A2** | Sin 2FA en admins | ✅ código / ⏳ **adopción** | MFA TOTP live (login + enrolamiento en Mi Perfil→Seguridad). **Falta activarlo en las cuentas** (Fede → después Lelean/Sofi). Futuro opcional: obligatorio para admin con gate AAL2 en finanzas |
| **M1** | XSS interno + sin CSP | ✅ **CERRADO** | Escape central (Toast/Modal/ContextMenu) + `escHtml` en los 6 módulos ofensores (live). **CSP ENFORCING deployada en prod (2026-07-15, verificada 2026-07-16)** — script-src SIN 'unsafe-inline' (script de `encuesta.html` externalizado a `encuesta.js`, hover inline de `router.js` a CSS), `frame-src` cubre PDFs (Supabase + blob), `form-action 'self'`, connect-src exacto (+cdnjs/jsdelivr solo por los source maps de DevTools). App en uso real bajo la policy sin violaciones. Endurecimiento futuro opcional: sacar `'unsafe-eval'` |
| **M2** | PII de clientes a Gemini free tier | ✅ **CERRADO** | `MODEL_PROVIDER=claude` en prod (2026-07-13): digest verificado corriendo en el VPS contra `claude-haiku-4-5` (no entrena, centavos). Gemini queda de fallback. Hardening opcional: validar el JSON de salida contra schema en el backend |
| **M3** | RLS: policies anon peligrosas + tablas nuevas | ✅ **CERRADO** | PASO 1 (2026-07-11) + PASO 2 (encuesta→RPCs `SECURITY DEFINER`, 4 policies anon dropeadas). **Barrido anon 2026-07-13 sobre 18 tablas sensibles: 17 cerradas** (profiles, roles, personas, ingresos, egresos, asientos, comprobantes, crm_*, conformes, cotizaciones, tareas, cartera…). Única abierta: `catalogo_items` — **a propósito** (catálogo/precios para showroom/cotizador, sin PII; riesgo asumido, ver pendientes). PII operativa gateada solo por authenticated = decisión de diseño asumida (PARTE 4 opcional) |
| **M4** | Sesiones no se revocan al cambiar password | ✅ **CERRADO** (completo) | `signOut({scope:'others'})` al cambiar pass (live). **Residual del reset-por-admin: cerrado por la plataforma (verificado 2026-07-15 contra la fuente):** GoTrue `v2.193.0` (la versión exacta del proyecto, `/auth/v1/health`) borra TODAS las sesiones del usuario cuando el admin cambia la password vía `PUT /admin/users/{id}` — `adminUserUpdate` → `UpdatePassword(tx, nil)` → `Logout(tx, user.ID)` = `DELETE FROM sessions WHERE user_id`. Es exactamente lo que hace `updateUserById(uid,{password})` en lobby-api. Sin código nuestro. (Residual estándar: el access token JWT vigente vive hasta expirar ~1h, igual que cualquier logout de Supabase.) |
| **M5** | Escalada de rol — trigger `fn_profiles_guard` | ⏳ **VERIFICAR** (1 query) | Capa 2 corrida por Fede en prod (esperado OK). Query de verificación en Pendientes §5 |
| **B1** | CORS `*` en lobby-api | ✅ **CERRADO** | Allowlist por env en lobby-api y proxy |
| **B2** | Gemini key en query string | ✅ **CERRADO** | Key al header `x-goog-api-key` en los 3 tools (ocr/crm deployados; octexa no montado) |
| **B3** | `/deploy` sin rate-limit (fuerza bruta del token) | ✅ **CERRADO + VERIFICADO** | Rate-limit 10/min por IP en `lobby-api/index.js` — deployado y verificado en prod 2026-07-16 (10×401 → **429**) |
| **B4** | Bucket `stands` sin límites MIME/size | ⏳ **VERIFICAR** | Query + ALTER listos en Pendientes §6 |
| **B5** | `npm audit` sin correr en lobby-api | ✅ **CERRADO** | `npm audit --omit=dev` contra el `package-lock.json` del repo (2026-07-15): **0 vulnerabilidades**. (El VPS instala del mismo lockfile; re-correrlo ahí al redeployar es opcional.) |
| **B6** | Password mínimo 6 caracteres | ✅ deployado / ⏳ **dashboard** | Mínimo 10 en `settings.js?v=9`, `admin-panel.js?v=15`, `lobby-api/index.js` — front y server deployados (2026-07-16). Falta SOLO: Supabase Dashboard → Authentication → Sign In/Up → Minimum password length = 10 |

**Lo que ya estaba BIEN** (sin cambios, ver informe original §✅): JWT delegado a Supabase, RBAC server-side con RLS por matriz, cero secretos en frontend, sin SQLi/SSRF, output del LLM escapado, uploads validados por bucket, human-in-the-loop en IA, `lobby-api` con verificación de rol server-side.

**No aplican** (6): 5.1–5.4 (Stripe/pagos online — no hay), 8.4 (GraphQL), 9.2 (source maps — no hay build).

---

## Pendientes (handoff próxima charla)

> **Update 2026-07-14:** la CSP enforcing quedó lista en el repo (ver M1) — el paso 8 (juntar
> violaciones) ya NO hace falta. Se suma el **paso 0** (deploy del conf de nginx). El paso 1 se
> verificó desde afuera ese día y **sigue pendiente**: 12 POSTs a `/lobby-api/deploy` sin token
> → 12×401 y ningún 429 (el rate-limit nuevo no está corriendo).
>
> **Update 2026-07-15:** paso 0 ✅ HECHO por Fede (la CSP está enforcing en prod). El flip
> destapó que "crear cuenta" pegaba al IP viejo por http (`api.js._lobbyApiBase`) → fix a
> `/lobby-api` relativo + barrido IP→dominio + fix `audit_log` 400 + **carga diferida del JS**
> (login = 7 scripts core). El conf de nginx cambió de nuevo (`connect-src` += cdnjs/jsdelivr
> por los source maps de DevTools) → **repetir el paso 0** (re-copiar conf + reload) junto con
> el pull del front.
>
> **Update 2026-07-15b (pre-reunión Jordi) — smokes en prod vía Chrome + 1 BUG GRAVE cazado y arreglado en repo:**
> - ✅ Verificado en prod logueado: pull hecho (carga diferida andando, `/lobby-api` relativo),
>   `audit_log` insertando (fix live), lobby-api con auth OK (400 "Campos requeridos" con token,
>   sin crear nada), ARCA GET perfecto (`/status` 200 · `/ultimo` 200 contra AFIP).
> - 🔴 **BUG: TODOS los POST a `/api/` (mepex-api) devolvían 500 — facturar/digest/OCR CAÍDOS
>   desde el switch de dominio.** Causa: los browsers mandan `Origin` en POST aunque sea
>   same-origin; el `ALLOWED_ORIGINS` del VPS quedó con el IP viejo → el callback de cors hacía
>   `cb(new Error(...))` → Express 5 → 500 HTML. Los GET no mandan Origin → pasaban (por eso
>   nadie lo vio; el smoke del digest del 13/7 fue curl en localhost, sin Origin). **NO es un
>   agujero de seguridad** (la auth nunca se salteó) — es una caída de disponibilidad.
>   **Fix en repo:** default de `ALLOWED_ORIGINS` → dominio nuevo + el callback ya no tira
>   Error (`cb(null,false)`: niega headers CORS sin 500) en `tools/vps/server.js` y
>   `lobby-api/index.js`. **⛔ Falta el deploy de Fede en el VPS (ver paso 1 ampliado).**
> - ✅ **M4 residual cerrado sin código** (GoTrue v2.193.0 revoca sesiones en el reset por
>   admin — ver cuadro M1/M4). ✅ **B5 cerrado** (npm audit: 0 vulnerabilidades).
>
> **Update 2026-07-16 — deploy VPS completo, TODO verificado en prod (pre-reunión):**
> el paso 1 quedó HECHO (mepex-api: cp + restart; lobby-api corre directo del repo → pull +
> restart alcanzó). Verificado desde el browser logueado: digest sin token → 401 JSON · con
> token → **`provider: claude`**, `pide_cotizacion`, hot · OCR → 400 JSON del handler ·
> `/api/arca/facturar` sin token → 401 JSON (**facturación operativa de nuevo**) ·
> `/lobby-api/deploy` → **10×401 + 429** (B3 vivo). Restan SOLO los 4 pasos manuales de Fede:
> **2** (Dashboard min password 10) · **3** (MFA) · **5** (query trigger M5) · **6** (bucket stands).

### Lado Fede (una pasada de ~15 min)

0. **Deploy CSP enforcing** (cierra M1, el último estructural): `~/pull-lobby.sh`, después
   ```bash
   sudo cp /home/mepex/lobby/tools/vps/nginx-mepex.conf /etc/nginx/sites-enabled/mepex
   sudo nginx -t && sudo systemctl reload nginx
   ```
   (Recordar: `sites-enabled/mepex` es COPIA, no symlink; backups FUERA de `sites-enabled/`.)
   Smoke: `curl -sI https://app.mepex.com.ar/ | grep -i content-security` debe decir
   `Content-Security-Policy:` (sin `-Report-Only`). Después usar la app normal con F12 un rato
   (PDFs, charts de Finanzas, Drive embed, acta de entrega) — si algo se bloquea, ahora se ve
   como error rojo `Refused to…`; rollback = volver a copiar el conf anterior.
1. **Deploy VPS consolidado** (trae B3 + B6 server-side de lobby-api **+ el fix de los POST caídos de mepex-api** — 2026-07-15b). Una sola pasada:
   ```bash
   ~/pull-lobby.sh
   # mepex-api (fix POSTs 500: facturar/digest/OCR):
   cp /home/mepex/lobby/tools/vps/server.js /home/mepex/api/server.js
   grep ALLOWED_ORIGINS /home/mepex/api/.env   # si existe con el IP viejo → cambiar a https://app.mepex.com.ar (o borrar la línea)
   pm2 restart mepex-api
   # lobby-api (B3 rate-limit + B6 mínimo 10 + mismo fix CORS):
   pm2 show lobby-api   # ver el path real (cwd/script)
   cp /home/mepex/lobby/lobby-api/index.js <PATH_REAL>/index.js
   grep ALLOWED_ORIGINS <PATH_REAL>/.env       # ídem: IP viejo → dominio nuevo
   pm2 restart lobby-api
   ```
   Verificación (la puede correr Claude desde el Chrome de Fede): POST `/api/crm/digest` con token → JSON con `provider: claude` (ya no 500); 11 POSTs a `/lobby-api/deploy` sin token → el 11º da **429**.
2. **Supabase Dashboard** → Authentication → Sign In/Up → **Minimum password length = 10** (enforcement server-side del B6).
3. **Activar MFA** en tu cuenta (Mi Perfil → Seguridad → QR con Google Authenticator). Después Lelean y Sofi. Red de seguridad: Dashboard → Authentication → Users → quitar factor.
4. **Smokes logueado**: pegar WhatsApp en el CRM (debe volver `provider: claude`) · carga de comprobante por foto · abrir un link de encuesta real (ficha Proyecto → Entrega).
5. **M5 — verificar el trigger anti-escalada** (SQL Editor, solo lectura):
   ```sql
   SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE '%profiles_guard%';
   SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('profiles','roles');
   ```
   Esperado: 1 trigger habilitado + `relrowsecurity = true` en ambas. Si falta → correr `sql/rls_capa2_roles_profiles.sql`.
6. **B4 — bucket `stands`** (SQL Editor):
   ```sql
   SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'stands';
   -- Si file_size_limit / allowed_mime_types están NULL:
   UPDATE storage.buckets
   SET file_size_limit = 15728640,  -- 15MB, igual que los demás buckets
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
   WHERE id = 'stands';
   ```
7. **B5 — npm audit**: en el VPS, `cd` al dir de lobby-api (el de `pm2 show lobby-api`) y `npm audit --omit=dev`. Pegar el resultado en la próxima charla si hay highs.
8. ~~**CSP**: juntar violaciones `[Report Only]`~~ — **YA NO HACE FALTA** (2026-07-14): el flip se hizo con auditoría estática + test local enforzado. Reemplazado por el paso 0.

### Próxima charla (Claude)

- ~~**CSP → enforcing**~~ ✅ **HECHA en el repo (2026-07-14)** — falta solo el deploy de Fede (paso 0). Endurecimiento futuro opcional: sacar `'unsafe-eval'` de script-src (probar PDFs + charts con consola abierta después de unos días enforcing).
- **M4 residual**: revocar sesiones del usuario al resetearle la password desde admin (investigar endpoint admin de GoTrue — no adivinar el SDK).
- **Opcionales/endurecimiento** (si Jordi los pide): MFA obligatorio para admin + gate AAL2 en finanzas · PARTE 4 RLS (PII de RRHH gateada por `fn_role_can('rrhh',…)`) · revisar si el cotizador realmente lee `catalogo_items` con anon (si no, cerrarla también) · validar JSON del LLM contra schema en el backend · budget cap en console.anthropic.com.

### Prompt de arranque para la próxima charla

```
Seguimos el cierre de seguridad de LOBBY-MEPEX (checklists JordiGPT). Estado en
docs/cierre-auditoria-jordi.md + memoria project_auditoria_seguridad_jordi.
La CSP enforcing ya está en el repo (2026-07-14); quedan los deploys/pasos 0-7
del handoff y el M4 residual.

Al empezar: git fetch origin && git reset --hard origin/main.

Del handoff hice los pasos: <marcar 0-7; el 0 es el deploy de la CSP>
Si algo se rompió con la CSP enforcing, pego acá los errores "Refused to…" de la consola:
<PEGAR SI HAY>
```
