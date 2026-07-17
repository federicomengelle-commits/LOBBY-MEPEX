# WhatsApp en el CRM (E4) — Coexistence · Runbook

> **Actualizado 2026-07-17.** Retomado post-cierre de seguridad. La estrategia sigue siendo
> **Coexistence** (Meta): el MISMO número de MEPEX vive en la WhatsApp Business App del celu
> **y** en la Cloud API a la vez, sincronizado — el equipo sigue usando el celu, el CRM
> recibe todo live. Memoria: `project_whatsapp_meta_coexistence`.

## Decisión de arquitectura (2026-07-17)

**Cloud API directa con app de Meta propia** (alineado al blueprint del CRM: independencia,
historial en Supabase, sin costo recurrente). La doc de Meta enmarca el onboarding de
Coexistence como flujo de "Tech Providers/Partners" — ese registro lo puede completar el
propio MEPEX (es un onboarding en el App Dashboard + Business Verification, que ya íbamos
a hacer con la constancia de AFIP).
**Fallback si Meta nos rebota el Embedded Signup:** **360dialog** (BSP pass-through, fee
mensual bajo, onboarding Coexistence guiado) — el webhook nuestro sirve IGUAL (forwardean
el mismo formato de payload de Cloud API).

## Ya construido (repo, 2026-07-17)

| Pieza | Qué hace |
|---|---|
| `tools/vps/whatsapp-webhook.js` | Webhook receptor: GET verificación (`hub.challenge` + `WA_VERIFY_TOKEN`) · POST eventos con **firma HMAC** `X-Hub-Signature-256` validada contra `WA_APP_SECRET` (la ruta es pública a propósito — la firma ES la auth) · parsea `messages` / `statuses` / `smb_message_echoes` / `smb_app_state_sync` / `history` · responde 200 rápido y persiste async · **idempotente** (dedupe por `wa_id`, los retries de Meta no duplican). Testeado con node (firma ok/mala/ausente + 4 shapes + hash estable). |
| `sql/whatsapp_webhook_v1.sql` | Staging `wa_eventos` (crudo, `procesado` flag, índices) + RLS `fn_role_can('crm','read')`. El server escribe con service key. |
| `tools/vps/server.js` | Monta las 2 rutas + captura `req.rawBody` (necesario para la firma). Sin las env `WA_*`, rechaza todo y no molesta al resto. |

**Filosofía v1:** el webhook NUNCA pierde un mensaje (staging crudo). El procesamiento fino
(matchear caso del CRM → `crm_mensajes`, bajar media, mandar desde el CRM) es la **fase 2**,
consume de `wa_eventos` y se diseña con Fede (decisiones de UI).

## Prerequisitos (estado verificado 2026-06-21)

- ✅ El WhatsApp de MEPEX es **WhatsApp Business App** (requisito de Coexistence).
- ✅ Business Manager **"MEPEX - Stands y Exposiciones"**, Fede admin. Meta muestra razón social "Mepex S.A." — ⚠️ al verificar debe coincidir EXACTO con la constancia de AFIP.
- ✅ Número activo en la app >7 días · Argentina soportada (todos los países desde may-2026).
- 📄 Tener a mano: **constancia de inscripción AFIP** + el **celu** con la Business App actualizada (≥2.24.17).

## Sesión "con celu" (~30-45 min, con Claude guiando)

**0 — SQL-first:** correr `sql/whatsapp_webhook_v1.sql` en el SQL Editor.

**1 — Deploy del webhook (VPS):**
```bash
~/pull-lobby.sh
cp /home/mepex/lobby/tools/vps/server.js /home/mepex/api/server.js
cp /home/mepex/lobby/tools/vps/whatsapp-webhook.js /home/mepex/api/whatsapp-webhook.js
echo "WA_VERIFY_TOKEN=$(openssl rand -hex 24)" >> /home/mepex/api/.env   # guardar el valor: se pega en Meta en el paso 4
pm2 restart mepex-api
```

**2 — App de Meta:** developers.facebook.com → Create App → tipo **Business**, portfolio
"MEPEX - Stands y Exposiciones" → agregar producto **WhatsApp**. Si ofrece el onboarding de
"Tech Provider", completarlo (es de MEPEX, sin cliente externo). Después: Settings → Basic →
copiar **App Secret** → al `.env` como `WA_APP_SECRET` (⚠️ el chat enmascara keys → pasarla
en base64: `echo '<b64>' | base64 -d`) → `pm2 restart mepex-api`.

**3 — Business Verification:** se dispara en este punto (Security Center). Cargar la
constancia AFIP — razón social + dirección EXACTAS o Meta rebota.

**4 — Configurar el webhook:** App Dashboard → WhatsApp → Configuration →
Callback URL `https://app.mepex.com.ar/api/whatsapp/webhook` + Verify Token (el del paso 1)
→ "Verify and save" (Meta hace el GET; con el token correcto queda verde) → **Subscribe** a:
`messages` · `smb_message_echoes` · `smb_app_state_sync` · `history`.

**5 — Conectar el número (el paso del celu):** WhatsApp → API Setup → conectar cuenta
existente de WhatsApp Business App → Meta manda código/QR a la app del celu → tocar
"Conectar a la plataforma" → aceptar **compartir historial** (~6 meses) → evento
`FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`. ⚠️ El Business Manager elegido acá queda fijo.

**6 — Smoke E2E:**
- Desde otro número, mandar un WhatsApp al de MEPEX → `SELECT field, direccion, telefono, created_at FROM wa_eventos ORDER BY created_at DESC LIMIT 5;` → aparece `messages/entrante`.
- Responder DESDE el celu → aparece `smb_message_echoes/saliente`.
- `pm2 logs mepex-api` debe mostrar `[wa-webhook] N evento(s) guardado(s)`.

**Si el paso 5 rebota** (Meta exige partner y no deja auto-onboardearse): plan B 360dialog —
cuenta → onboarding Coexistence guiado desde su hub → configurar el forwarding de webhooks
a la misma URL nuestra. El resto no cambia.

## Fase 2 (sesión aparte, post-conexión)

Procesador `wa_eventos` → CRM: matchear teléfono→cliente/caso (ojo columnas rotadas de
`clientes` — el teléfono real vive en `rubro`), crear caso nuevo si no hay, insertar en
`crm_mensajes` (canal `whatsapp`), bajar media con el access token, y **mandar** desde el
CRM (Cloud API `/messages`, pricing por conversación de Meta). El pegado asistido + digest
IA siguen andando mientras tanto.
