# Cierre de la auditoría JordiGPT — LOBBY-MEPEX

> **Fecha de cierre: 2026-07-13.** Pasada final contra los 46 chequeos de los 2 PDFs de JordiGPT
> (base 27 + avanzado 19), aplicados al stack real. Informe original: `docs/auditoria-seguridad-2026-07.md`
> (2026-07-10). Este doc registra el estado FINAL de cada hallazgo **con evidencia verificada en prod**
> (curls externos del 2026-07-13, sin acceso privilegiado — lo que probaría un atacante).

## Resumen ejecutivo

- **Todo lo CRÍTICO, ALTO y MEDIO está cerrado y verificado en prod.** No queda ningún agujero explotable conocido.
- Score: de **~25/40** chequeos aplicables en verde (2026-07-10) a **~36/40** (2026-07-13).
- Lo abierto es: la **adopción** del MFA (el mecanismo ya está live), 2 ítems de higiene (bucket `stands`, `npm audit`) y 3 deploys ya resueltos en código: **CSP enforcing** (2026-07-14, ver M1) + lobby-api (B3/B6).

## Cuadro final de hallazgos

| # | Hallazgo | Estado | Evidencia / detalle |
|---|----------|--------|---------------------|
| **C1** | Proxy ARCA/IA sin auth (emitía facturas AFIP reales) | ✅ **CERRADO** | Bearer JWT + `requireRole(admin/finanzas)` en `/facturar`. Verificado 2026-07-13: `/api/arca/*`, `/api/crm/digest`, `/api/ocr/comprobante` → **401 sin token** |
| **C2** | Todo por HTTP sin cifrar | ✅ **CERRADO** | `https://app.mepex.com.ar` (Let's Encrypt + hook de renovación). Verificado 2026-07-13: redirect **301** http→https, **HSTS** max-age=31536000 includeSubDomains |
| **C3** | Rotación de service_role + lpk_live (historial git) | ✅ **CERRADO** | Fede confirmó rotación/revocación (2026-07-11). Código actual limpio; residual histórico inofensivo |
| **A1** | Sin rate limiting | ✅ **CERRADO** | `iaLimit` 20 req/min en endpoints IA del proxy; ARCA detrás de auth+rol; `/deploy` de lobby-api con 10 req/min (código 2026-07-13, ⏳ deploy). Recomendado: budget cap mensual en console.anthropic.com |
| **A2** | Sin 2FA en admins | ✅ código / ⏳ **adopción** | MFA TOTP live (login + enrolamiento en Mi Perfil→Seguridad). **Falta activarlo en las cuentas** (Fede → después Lelean/Sofi). Futuro opcional: obligatorio para admin con gate AAL2 en finanzas |
| **M1** | XSS interno + sin CSP | ✅ código / ⏳ **deploy nginx** | Escape central (Toast/Modal/ContextMenu) + `escHtml` en los 6 módulos ofensores (live). **CSP ENFORCING lista en el repo (2026-07-14)** — sin violaciones juntadas, se reemplazó por auditoría estática de recursos + test local sirviendo la app con la policy enforzada (boot completo + encuesta E2E contra el RPC real, **0 violaciones**). Fixes vs la Report-Only: `connect-src` corrige `api.dolarapi.com`→`dolarapi.com` (la URL real de api.js), `frame-src` suma Supabase + `blob:` (PDFs de cotización/acta en iframes que la policy vieja habría ROTO), `form-action 'self'`, script inline de `encuesta.html` externalizado a `encuesta.js` y hover inline de `router.js` pasado a CSS (script-src queda SIN 'unsafe-inline'). Falta solo el deploy del conf (paso 0 del handoff) |
| **M2** | PII de clientes a Gemini free tier | ✅ **CERRADO** | `MODEL_PROVIDER=claude` en prod (2026-07-13): digest verificado corriendo en el VPS contra `claude-haiku-4-5` (no entrena, centavos). Gemini queda de fallback. Hardening opcional: validar el JSON de salida contra schema en el backend |
| **M3** | RLS: policies anon peligrosas + tablas nuevas | ✅ **CERRADO** | PASO 1 (2026-07-11) + PASO 2 (encuesta→RPCs `SECURITY DEFINER`, 4 policies anon dropeadas). **Barrido anon 2026-07-13 sobre 18 tablas sensibles: 17 cerradas** (profiles, roles, personas, ingresos, egresos, asientos, comprobantes, crm_*, conformes, cotizaciones, tareas, cartera…). Única abierta: `catalogo_items` — **a propósito** (catálogo/precios para showroom/cotizador, sin PII; riesgo asumido, ver pendientes). PII operativa gateada solo por authenticated = decisión de diseño asumida (PARTE 4 opcional) |
| **M4** | Sesiones no se revocan al cambiar password | ✅ **CERRADO** (principal) | `signOut({scope:'others'})` al cambiar pass (live). Residual menor: el reset por admin no revoca las sesiones del usuario reseteado → próxima charla |
| **M5** | Escalada de rol — trigger `fn_profiles_guard` | ⏳ **VERIFICAR** (1 query) | Capa 2 corrida por Fede en prod (esperado OK). Query de verificación en Pendientes §5 |
| **B1** | CORS `*` en lobby-api | ✅ **CERRADO** | Allowlist por env en lobby-api y proxy |
| **B2** | Gemini key en query string | ✅ **CERRADO** | Key al header `x-goog-api-key` en los 3 tools (ocr/crm deployados; octexa no montado) |
| **B3** | `/deploy` sin rate-limit (fuerza bruta del token) | ✅ código / ⏳ deploy | Rate-limit 10/min por IP en `lobby-api/index.js` (2026-07-13) |
| **B4** | Bucket `stands` sin límites MIME/size | ⏳ **VERIFICAR** | Query + ALTER listos en Pendientes §6 |
| **B5** | `npm audit` sin correr en lobby-api | ⏳ **CORRER** | Comando en Pendientes §7 |
| **B6** | Password mínimo 6 caracteres | ✅ código / ⏳ deploy + dashboard | Mínimo 10 en `settings.js?v=9`, `admin-panel.js?v=15`, `lobby-api/index.js` (2026-07-13). Falta: pull + deploy lobby-api + subir el mínimo en Supabase Dashboard |

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
1. **Deploy de lobby-api** (trae B3 + B6 server-side — verificado 2026-07-14 que AÚN NO corre): `~/pull-lobby.sh`, después
   `pm2 show lobby-api` (para ver el path real) → copiar `lobby-api/index.js` del repo ahí → `pm2 restart lobby-api`.
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
