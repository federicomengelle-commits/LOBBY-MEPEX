# Handoff — Blindaje de seguridad LOBBY-MEPEX (auditoría JordiGPT)

> Sesión 2026-07-11. Se auditó la app contra los 2 checklists de JordiGPT (46 chequeos) y se
> **cerró todo lo crítico, alto y medio**, deployado y verificado en prod. Este doc + la memoria
> `project_auditoria_seguridad_jordi` + `docs/auditoria-seguridad-2026-07.md` = el contexto completo.

## Estado: qué quedó HECHO y deployado en prod

| Item | Estado | Verificación |
|------|--------|--------------|
| **HTTPS** en `app.mepex.com.ar` | ✅ live | redirect 301, cert Let's Encrypt válido, HSTS |
| **Security headers** (HSTS/X-Frame/X-Content-Type/Referrer) | ✅ live | chequeo 4.2 |
| **CSP** | ✅ **Report-Only** (no enforza aún) | header presente; falta juntar violaciones y flip |
| **Facturador ARCA con auth** | ✅ live | `/api/arca/status` sin token = **401**; padrón logueado = **200** |
| **RLS anon cerrado** (insumos/inventario/recetas/opciones/audit_log) | ✅ corrido | `pg_policies` = solo `{authenticated}` |
| **XSS** escapado + escape central (Toast/Modal/ContextMenu) | ✅ live | 6 módulos + components.js |
| **MFA / 2FA (TOTP)** opcional | ✅ live (código) | servido; **falta probar el flujo real** |
| **Rate-limit IA + CORS + key al header + signOut sesiones** | ✅ live | proxy + lobby-api |
| **Rotación** service_role + lpk_live | ✅ (Fede dice ya hecho) | confirmar |

**Score:** de "bien encaminado con 1 crítico abierto" a **blindado** (todo crítico/alto/medio cerrado).

## Pendientes (todos OPCIONALES o tareas de Fede)

1. **Probar MFA** en la cuenta de Fede: Mi Perfil → Seguridad → Activar → escanear QR con Google Authenticator → verificar. Después activarlo en admins (Lelean, Sofi). **Red de seguridad si te lockeás:** Supabase Dashboard → Authentication → Users → quitar el factor.
2. **CSP → enforcing**: usar la app unos días mirando la consola (F12) por violaciones `[Report Only] Refused to…` (sobre todo al generar PDF/factura, abrir embeds de Drive, ver charts de Finanzas). Pasarle las violaciones a Claude → ajusta la policy → flip: en `tools/vps/nginx-mepex.conf` cambiar `Content-Security-Policy-Report-Only` → `Content-Security-Policy`, pull, `cp` a sites-enabled, `nginx -t && reload`.
3. **Claude para PII** — ✅ **DEPLOYADO Y VERIFICADO 2026-07-13**: `MODEL_PROVIDER=claude` + `ANTHROPIC_API_KEY` en el `.env` del proxy (la key vive SOLO ahí), `OCR_MODEL` gemini borrado (pisaba el modelo del OCR), `server.js` con `/api/crm/digest` montado (iaLimit + requireAuth, 401 sin token). Digest probado end-to-end EN el VPS → `provider: claude`, parse perfecto. Modelo: `claude-haiku-4-5` (centavos, no entrena). **Gotcha:** la UI del chat enmascara las keys al copiarlas (`sk-ant-a••••`) → pasarlas en base64 y `base64 -d` en el server.
4. **2 policies anon opcionales** — ✅ **CERRADO Y VERIFICADO EN PROD 2026-07-13**: encuesta pública migrada a RPCs `SECURITY DEFINER` (token server-side, un solo uso) y las 4 policies anon dropeadas (`clientes_rls_anon`, `encuestas_rls_anon_sel`/`_upd`, `eventos_anon_select`). Verificado con curls anon: clientes/eventos/encuestas devuelven vacío, UPDATE anon bloqueado, RPCs validan token. Pendiente menor: smoke de un link de encuesta real (el flujo está verificado con mock + RPCs en prod).
5. **Gemini key al header** en `crm-digest.js`/`octexa-ia.js`: editado en repo; `ocr-comprobante.js` ya está en el VPS. `crm-digest` ahora SÍ está montado en `server.js` (2026-07-11, junto con el switch a Claude — ver #3); `octexa-ia` queda afuera a propósito (diseñador parkeado, OCTEXA en su repo).

## Gotchas / lecciones de esta sesión (LEER antes de tocar infra)

- **nginx**: `/etc/nginx/sites-enabled/mepex` es un **ARCHIVO copia, NO un symlink** a sites-available. nginx carga `sites-enabled/*` **entero** → los backups NUNCA van en esa carpeta (dan "conflicting server name"). Fuente de verdad versionada = **`tools/vps/nginx-mepex.conf`**. Para cambios: editar el repo → `~/pull-lobby.sh` → `sudo cp /home/mepex/lobby/tools/vps/nginx-mepex.conf /etc/nginx/sites-enabled/mepex` → `sudo nginx -t && sudo systemctl reload nginx`.
- **nginx reload vs restart**: un `reload` NO bindea un puerto nuevo (ej. agregar `listen 443`) → usar `restart`.
- **Proxy .env**: la publishable key estaba guardada como `SUPABASE_SERVICE_KEY` (histórico, mal nombrada). Se agregó `SUPABASE_ANON_KEY` y el `auth-middleware.js` acepta ambos nombres.
- **Deploy del proxy** (`tools/vps/*.js`): NO están symlinkeados; hay que `cp` a `/home/mepex/api/` y `pm2 restart mepex-api`. El `server.js` real del VPS = copia de `tools/vps/server.js`.
- **Cert renewal**: hook en `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` (recarga nginx al renovar).
- **MFA es no-invasivo**: quien no lo activa entra igual (el `getAuthenticatorAssuranceLevel` da aal1→aal1). Guard en `restoreSession` evita bypass al recargar con sesión a medias.

## Infra / referencias

- **VPS**: `srv1530303` (Hostinger, Ubuntu 24.04, **IPv4-only** `195.200.1.250`). Repo en `/home/mepex/lobby`. Proxy `mepex-api` (Express, pm2) en `/home/mepex/api`. lobby-api (admin, service_role) en `:3002`.
- **Dominio**: `app.mepex.com.ar` (DNS en Hostinger, A → 195.200.1.250). El viejo `http://195.200.1.250` redirige a https.
- **Archivos clave**: `docs/auditoria-seguridad-2026-07.md` (46 chequeos), `sql/seguridad_rls_fixes.sql`, `tools/vps/{auth-middleware,server,nginx-mepex.conf,crm-digest,ocr-comprobante,octexa-ia}`, `auth.js` (MFA), `settings.js` (enrolamiento).
- **Commits de la sesión** (origin/main): `611d0f2` XSS/sesiones · `33bbed6` proxy CORS/key/middleware · `37529c0` docs+sql · `57c25f2` sql RLS fixes · `f6e734a` front Bearer · `f8b90d9` server.js · `fa86328` middleware env robusto · `2ef16d2` nginx HTTPS · `957035f` MFA · `1c1d12a` CSP report-only.
- **Versiones front**: auth v7 · settings v8 · api v82 · finanzas v54 · components v9 · contabilidad v16 · costos v34 · calendario-operativo v21 · admin-panel v14 · rrhh v16.

## Prompt para arrancar la sesión nueva

```
Seguimos con el blindaje de seguridad de LOBBY-MEPEX (auditoría de los checklists de
JordiGPT). La sesión anterior cerró TODO lo crítico/alto/medio y quedó deployado en prod
(HTTPS, facturador ARCA con auth, RLS anon cerrado, XSS escapado, MFA, rate-limit, headers,
CSP en Report-Only). Antes de tocar nada leé `docs/handoff-seguridad-jordi.md` y la memoria
`project_auditoria_seguridad_jordi` para el estado completo y los gotchas de infra (sobre todo
el tema de que sites-enabled/mepex es una copia, no symlink).

Al empezar, hacé `git fetch origin && git reset --hard origin/main` para sincronizar.

Hoy quiero encarar: <ELEGIR UNO>
  A) Revisar las violaciones de la CSP Report-Only que junté y activarla (enforcing).
  B) Las 2 decisiones de RLS anon pendientes (clientes / encuestas) — PASO 2 de sql/seguridad_rls_fixes.sql.
  C) Enchufar Claude para la PII (ya tengo/voy a sacar la ANTHROPIC_API_KEY).
  D) Otra cosa: <describir>.
```
