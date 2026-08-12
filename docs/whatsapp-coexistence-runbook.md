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

## Prerequisitos — RE-VERIFICADOS EN VIVO 2026-08-11

> ⚠️ **Los prerequisitos de 2026-06-21 estaban mal en dos puntos.** Lo de abajo es lo que se vio
> en pantalla el 11/08 entrando a la cuenta real, no lo que se suponía.

- ✅ El WhatsApp de MEPEX es **WhatsApp Business App** (requisito de Coexistence).
- ✅ Portfolio **"MEPEX - Stands y Exposiciones"** (ID `646051252494229`), Fede admin.
- ❌ **CORREGIDO — la razón social NO estaba cargada.** El runbook decía *"Meta muestra razón
  social «Mepex S.A.», debe coincidir EXACTO con la constancia"*. Falso: **los cuatro campos
  estaban vacíos** (`Sin nombre` / `Sin dirección` / `Sin teléfono` / `Sin sitio web`). Ese
  "Mepex S.A." salía de la cuenta de Instagram vinculada, no del nombre legal. **Ya está
  cargado** (11/08) tal cual la constancia:
  ```
  MEPEX S.A. · COLOMBIA 1173 · LANUS, BUENOS AIRES 1824 · Argentina
  +541142184888 · https://www.mepex.com.ar/ · Identificación fiscal 30-70999081-7
  ```
  **★ El campo "Identificación fiscal (TIN)" no estaba documentado y vale oro:** Meta dice
  textual que *"se usará para encontrar posibles registros comerciales coincidentes"*. Ahí va
  el CUIT — es lo que hace que te crucen contra el registro oficial en vez de revisarte a mano.
- ❌ **FALTABA UN PASO ENTERO: Fede no era una cuenta de Meta for Developers registrada.**
  Por eso "Create App" no aparecía por ningún lado. Es un registro de 3 pantallas
  (Register → Contact info → About you) en `developers.facebook.com` → "Empezar".
  **Ver §BLOQUEO ACTUAL.**
- ✅ Número activo en la app >7 días · Argentina soportada (todos los países desde may-2026).
- 📄 Tener a mano: **constancia de inscripción AFIP** + el **celu** con la Business App
  actualizada (≥2.24.17).

## 🔴 BLOQUEO ACTUAL (2026-08-11) — registro de desarrollador

Meta rechaza completar el registro **desde la computadora de Fede**:

> *"No puedes realizar el cambio en este momento. Detectamos que estás usando un dispositivo
> que no usas habitualmente y necesitamos proteger tu cuenta. Te permitiremos realizar el
> cambio cuando ya hayas usado este dispositivo durante un tiempo."*

Y al confirmar el mail que la cuenta YA tenía, devuelve `Se produjo un error inesperado`.

**Lo que NO es el problema — probado, no supuesto:** el mail. Se probó con la casilla de admin,
con `mepex@mepex.com.ar` y con el `fede0610@hotmail.com` que la cuenta ya tenía. **Los códigos
de verificación llegaron bien las dos veces.** Los tres rebotan igual → el bloqueo es del
dispositivo, no de la casilla. **Que otra persona lea el mail desde la oficina no lo resuelve.**

**Camino a probar primero:** hacer el registro **desde el celular de Fede**, que es su
dispositivo habitual de Facebook. Una vez registrado, **eso queda en la cuenta, no en el
aparato** → se vuelve a la compu y se sigue. Si Meta también bloqueara la creación de la app
desde la compu, se hace desde el celu (incómodo pero posible).

**Pendiente chico derivado:** el mail de contacto quedará en `fede0610@hotmail.com`. Cambiarlo
a `mepex@mepex.com.ar` cuando el dispositivo esté confiado. No bloquea nada: lo institucional
es el portfolio, que ya es de la empresa.

**Trampa de UI que va a volver a pasar:** en los formularios de Meta, cuando aparece o
desaparece un mensaje de validación **todo el formulario se corre verticalmente**, así que un
click por coordenada cae en el elemento de al lado (pasó dos veces: una tirando los datos al
campo equivocado, otra tildando el checkbox de marketing en vez del botón). **Llenar por
referencia de elemento, no por coordenada.**

## Sesión "con celu" (~30-45 min, con Claude guiando)

**0 — SQL-first:** ✅ **HECHO.** `wa_eventos` existe en prod (0 filas, esperando el primer mensaje).

**1 — Deploy del webhook (VPS):** ✅ **HECHO Y VERIFICADO 2026-08-11.** El webhook responde y
el `WA_VERIFY_TOKEN` está generado: probado end-to-end contra prod, devolvió el `hub.challenge`.
Meta lo va a validar en verde al primer intento.

Comando usado (idempotente, se autotestea y **no expone el token en el chat**):
```bash
grep -q '^WA_VERIFY_TOKEN=' /home/mepex/api/.env || echo "WA_VERIFY_TOKEN=$(openssl rand -hex 24)" >> /home/mepex/api/.env; pm2 restart mepex-api >/dev/null; sleep 3; T=$(grep '^WA_VERIFY_TOKEN=' /home/mepex/api/.env | cut -d= -f2); curl -s "https://app.mepex.com.ar/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=$T&hub.challenge=PRUEBA123"; echo; echo "TOKEN (copiar a mano para pegarlo en Meta):"; echo "$T"
```
Si devuelve `PRUEBA123`, está listo. **El token se copia a mano al configurar el webhook en
Meta — no pasa por el chat.**

**Sonda rápida del estado del webhook** (sin token, desde cualquier lado):
`curl -o /dev/null -w "%{http_code}" https://app.mepex.com.ar/api/whatsapp/webhook`
→ **403** = existe y rechaza bien · **404** = no está deployado.

**1.5 — Registro de cuenta de Meta for Developers.** ⛔ **BLOQUEADO — ver §BLOQUEO ACTUAL.**
Sin esto no existe "Create App" en ninguna parte.

**2 — App de Meta:** developers.facebook.com → Create App → tipo **Business**, portfolio
"MEPEX - Stands y Exposiciones" → agregar producto **WhatsApp**. Si ofrece el onboarding de
"Tech Provider", completarlo (es de MEPEX, sin cliente externo). Después: Settings → Basic →
copiar **App Secret** → al `.env` como `WA_APP_SECRET` (⚠️ el chat enmascara keys → pasarla
en base64: `echo '<b64>' | base64 -d`) → `pm2 restart mepex-api`.

**3 — Business Verification:** se dispara en este punto (Security Center). Cargar la
constancia AFIP — razón social + dirección EXACTAS o Meta rebota. Los datos del negocio ya
están cargados y coinciden con el papel (ver Prerequisitos), así que sólo queda subir el PDF.

> ⚠️ **El orden importa y el 11/08 casi lo invertimos.** En Security Center hay un selector
> *"Selecciona tu caso de uso de verificación"* que hoy tiene **una sola opción**, "Acceder a
> la plataforma de creadores" — que NO es la nuestra. La lista se arma con **los productos que
> el negocio ya tiene conectados**, así que la opción de WhatsApp aparece recién **después** de
> crear la app con el producto WhatsApp (paso 2). **No arrancar la verificación antes del paso
> 2**, o Meta la evalúa contra los requisitos de colaboraciones con creadores de Instagram.
> Ojo también con el botón "Verify business" que aparece en la pantalla *Plataforma de
> creadores*: es el mismo camino equivocado.

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
