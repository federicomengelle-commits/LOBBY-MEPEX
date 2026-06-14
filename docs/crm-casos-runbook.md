# CRM "Casos" — RUNBOOK de ejecución paso a paso (Fase 7)

> **Qué es este doc:** el **mapa operativo** para construir y poner en marcha el CRM, etapa por etapa, con TODO lo manual/externo detallado (API keys, delegación de Gmail, DNS, Meta/WhatsApp). El **diseño** (modelo de datos, UI, decisiones) vive en `docs/crm-casos-blueprint.md` — este runbook NO lo repite, lo ejecuta.
> **Modo (pedido de Fede):** GUIADO. Para cada paso manual, cuando lo encaremos en vivo Claude te va diciendo exactamente dónde hacer clic; este doc es el plano para no perdernos y para que sepas de antemano qué cuentas/accesos vas a necesitar.
> **Leyenda:** 🧑‍💻 = lo hace Fede (manual/externo) · 🤖 = lo hace Claude (código) · ✅ = verificación.

---

## ⚡ ESTADO ACTUAL — handover 2026-06-13

- ✅ **E1.1 — `sql/crm_casos.sql` CORRIDO por Fede** (tablas `crm_casos`/`crm_mensajes`/`crm_contactos` + `cotizaciones.caso_id` + migración `interacciones`→`crm_mensajes` + RLS comercial).
- ✅ **E1.3 — endpoint IA escrito:** `tools/vps/crm-digest.js` (driver gemini|claude). **Sin deployar todavía.**
- ⏭️ **PRÓXIMOS PASOS EN ORDEN (retomar acá):**
  1. 🤖 **Claude construye + pushea el tab "Casos"** (front: Bandeja de hoy + ficha con timeline unificado + composer 4 canales). Integrarlo en `crm.js` reemplazando/absorbiendo "Interacciones". *(SQL ya está → se puede pushear el JS.)*
  2. 🧑‍💻 Fede: pull + probar el tab (crear caso, nota, llamada, WhatsApp pegado en modo manual).
  3. 🧑‍💻 Fede: crear **API key de Gemini** en aistudio.google.com (§2.2).
  4. 🤖+🧑‍💻 **Deploy de `/api/crm/digest`** en el proxy del VPS (montar `tools/vps/crm-digest.js`, env `MODEL_PROVIDER`/`GEMINI_API_KEY`, `pm2 restart`) — juntos por SSH (§2.3).
  5. ✅ Probar WhatsApp pegado → la IA lo estructura/resume/archiva. **E1 cerrado.**
  6. Después: **E2 (email automático)** — §3.
- ⚠️ **Deploy gap del VPS:** venía atrasado en pulls (Tareas v2/v3/v4, lobby v7 con el iso más grande). Conviene un **pull general** para sincronizar todo.
- **Decisiones abiertas a cerrar:** naming del tab ("Casos"/"Oportunidades") · casilla de mail para E2 · catálogo de rubros (E3) · listmonk vs Brevo (E3) · número WhatsApp (E4).

---

## 0. Pre-requisitos (juntar ANTES de arrancar)

Accesos que vas a necesitar a mano (no hay que comprar nada todavía):
- **Google Workspace admin** (admin@mepex…) — para Gmail API + delegación (E2).
- **Acceso a Google Cloud Console** con la misma cuenta (es gratis crear proyectos).
- **Acceso al DNS del dominio mepex** (donde sea que estén los registros: el panel del registrador) — para E3 (mailing) y E4.
- **Cuenta Meta Business** (Facebook Business) — para E4 (WhatsApp oficial). Recién en E4.
- **Acceso SSH al VPS** `195.200.1.250` (usuario `mepex`) — para poner las API keys y deployar el proxy. Esto lo operamos juntos.
- **Un número de teléfono dedicado** para el WhatsApp comercial — recién en E4 (NO tu número personal; una vez que un número entra a la Cloud API no se puede usar en la app normal de WhatsApp).

> **Decisiones a cerrar antes de E2/E3/E4** (las dejo marcadas en cada etapa): qué casilla de mail ingestar · catálogo de rubros · ESP de mailing (Brevo vs **listmonk que YA está instalado en el VPS**) · número de WhatsApp.

---

## 1. Orden y por qué

```
E1 Núcleo + Gemini   →  el equipo trabaja "ida y vuelta" en el CRM (WhatsApp pegado, notas, llamadas, mails a mano). VALOR DÍA 1.
E2 Email automático  →  los mails entran y se archivan solos (Gmail API).
E3 Clasificación+mailing → segmentar la base + campañas en frío.
E4 WhatsApp oficial  →  WhatsApp entra solo (Meta Cloud API).
E5 Agente comercial  →  borradores → autonomía acotada.
```
Cada etapa da valor sola y se prueba antes de la siguiente. **SQL-first** siempre: Claude prepara el SQL, vos lo corrés en Supabase, después se pushea el JS (regla del proyecto).

---

## 2. E1 — Núcleo + motor IA (Gemini)

**Resultado:** tab "Casos" funcionando: bandeja de hoy, pipeline por caso, ficha con timeline + composer de 4 canales (nota/WhatsApp/email/llamada), y el digest de IA parseando WhatsApp pegado.

### 2.1 🤖 Base de datos (Claude prepara → 🧑‍💻 Fede corre)
- Claude escribe `sql/crm_casos.sql`: tablas `crm_casos`, `crm_mensajes`, `crm_contactos` + `cotizaciones.caso_id` + migración `interacciones → crm_mensajes` (1:1, cero pérdida) + RLS (comercial: oficina, como la Capa 2). Ver modelo en blueprint §4.
- 🧑‍💻 Lo corrés en Supabase SQL Editor. ✅ Verificás que las 3 tablas existan y que `interacciones` se haya copiado.

### 2.2 🧑‍💻 Crear la API key de Gemini (Google AI Studio) — GRATIS
> ⚠ OJO: el Gemini que ves dentro de Workspace (mepex@) es licencia de **interfaz**, NO sirve por API. La key se crea aparte y es gratis.

1. Entrá a **aistudio.google.com** con tu cuenta Google.
2. Botón **"Get API key"** (arriba a la izquierda o en el menú) → **"Create API key"**.
3. Elegí un proyecto de Google Cloud (o dejá que cree uno nuevo). 
4. Copiá la key (`AIza...`). **No la pegues en ningún archivo del repo** — va al VPS como variable de entorno (paso 2.3).
5. ✅ Tier gratuito: el volumen de MEPEX entra cómodo. **Decisión de privacidad:** en el free tier Google puede usar los datos para mejorar productos. Si te pesa (son charlas de clientes), después se pasa a tier pago / Vertex (centavos) o al driver `claude` cambiando 1 variable. Lo dejamos andando gratis y decidís con el uso real.

### 2.3 🤖+🧑‍💻 Endpoint del digest en el proxy del VPS
- El proxy Node ya corre en `195.200.1.250:3000` (hoy `/api/lapyme/facturar`). Le sumamos `POST /api/crm/digest`.
- 🤖 Claude escribe el handler con **driver intercambiable** (`MODEL_PROVIDER=gemini|claude`) y el contrato JSON del blueprint §6.
- 🧑‍💻+🤖 En el VPS (lo hacemos juntos por SSH): agregar al `.env` del proxy:
  ```
  MODEL_PROVIDER=gemini
  GEMINI_API_KEY=AIza...        # la del paso 2.2
  GEMINI_MODEL=gemini-2.0-flash # o el flash vigente del free tier
  ```
  Reiniciar el proceso: `pm2 restart <nombre-del-proxy>` (lo identificamos con `pm2 list`).
- ✅ Test: `curl -X POST http://localhost:3000/api/crm/digest -H 'Content-Type: application/json' -d '{"texto":"[10:01] Juan: hola, ¿precio stand 6x4?"}'` → debe devolver el JSON estructurado.

### 2.4 🤖 Frontend — tab "Casos" en `crm.js`
- Bandeja de hoy + pipeline re-apuntado a casos + ficha (timeline + composer 4 canales) + pegado de WhatsApp que llama al digest. Todo dark theme MEPEX (colores en blueprint §197). Claude lo construye y pushea (después de que corras el SQL).
- ✅ Probás: crear un caso, pegar un chat de WhatsApp, registrar una llamada, escribir una nota con @mención (dispara notificación).

**Decisión pendiente E1:** naming del tab ("Casos" vs "Oportunidades") y si "Interacciones" desaparece o queda read-only.

---

## 3. E2 — Email automático (Gmail API + domain-wide delegation)

**Resultado:** los mails de la casilla comercial entran, se matchean al cliente/caso, se resumen y se archivan solos. Sin IMAP, sin tocar Workspace.

> **Decisión a cerrar primero:** ¿qué casilla se ingesta? (¿`ventas@`? ¿`mepex@`? ¿varias?). Define el alcance del polling.

### 3.1 🧑‍💻 Proyecto en Google Cloud + habilitar Gmail API
1. **console.cloud.google.com** → crear proyecto (ej. "mepex-crm") o reusar el de la key de Gemini.
2. **APIs & Services → Library** → buscar **"Gmail API"** → **Enable**.

### 3.2 🧑‍💻 Service Account + clave
1. **APIs & Services → Credentials → Create credentials → Service account**.
2. Nombre (ej. "crm-gmail-reader"). No hace falta darle roles de proyecto.
3. Entrá al service account creado → pestaña **Keys → Add key → JSON** → se descarga un `.json`. **Ese archivo es un secreto** → va al VPS, no al repo (paso 3.4).
4. Anotá el **Client ID** del service account (un número largo) y su email (`...@...iam.gserviceaccount.com`).
5. En el service account, habilitá **"Enable Google Workspace Domain-wide Delegation"**.

### 3.3 🧑‍💻 Domain-wide delegation en el Admin de Workspace
> ⚠ La ubicación exacta en admin.google.com cambia cada tanto — cuando lo hagamos te guío al lugar vigente. Hoy: **Security → Access and data control → API controls → Domain-wide delegation → Manage Domain Wide Delegation → Add new**.
1. **Client ID:** el del service account (paso 3.2).
2. **OAuth scopes** (exactos, separados por coma):
   ```
   https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.modify
   ```
   (`readonly` para leer; `modify` para poner el label `CRM/Procesado` y no re-procesar.)
3. Autorizar.
- ✅ Test de impersonación: con el service account, impersonar la casilla comercial y listar 1 mail. Lo corremos desde el VPS con un script chico; si devuelve mails, la delegación quedó.

### 3.4 🤖+🧑‍💻 Polling en el proxy
- 🧑‍💻 Subir el `.json` del service account al VPS a una ruta fuera del repo (ej. `/home/mepex/secrets/crm-gmail.json`, permisos `600`). En el `.env`: `GMAIL_SA_JSON=/home/mepex/secrets/crm-gmail.json` + `GMAIL_INBOX=ventas@mepex…`.
- 🤖 Claude escribe el poller (cada 2-5 min): lee no-procesados → matchea remitente contra `crm_contactos` → si matchea, archiva en el caso; si no, va a "sin asignar" (bandeja violeta) → pone label `CRM/Procesado`. Resumen vía el digest.
- ✅ Mandás un mail de prueba a la casilla → en 2-5 min aparece en el CRM.

**Gotchas E2:** el `.json` nunca al repo · si "sin asignar" se llena, al asignar un mail el sistema aprende ese contacto · backup de la casilla por Google Takeout si querés histórico viejo.

---

## 4. E3 — Clasificación + mailing en frío

**Resultado:** segmentar la base ("cosmética que estuvo en Expomedical 2024-25") y mandar campañas sin quemar el dominio.

### 4.1 🤖 Clasificación (código, poco manual)
- `rubro` pasa a **catálogo cerrado** (hoy es texto libre + el bug de columnas rotadas en `clientes`, ya mapeado en api.js — ojo ahí) · tipo de cliente ya existe · "eventos en los que participó" se deriva de casos/proyectos · tags libres.
- 🧑‍💻 **Decisión:** definir el catálogo de rubros con Noe/Fede (lista cerrada).
- Las listas de difusión = un filtro guardado.

### 4.2 🧑‍💻 Elegir el motor de envío
Dos caminos (decisión tuya):
- **listmonk** — ⭐ **YA está instalado en el VPS** (lo vimos en el reconocimiento). Self-hosted, gratis, sin límite de Brevo. Requiere configurar un relay SMTP para la entrega (o usar la Gmail API para volúmenes chicos). Más control, más setup.
- **Brevo** — SaaS, free 300 mails/día, API + métricas de apertura listas. Más rápido de arrancar, techo en el free.

### 4.3 🧑‍💻 DNS del subdominio de envío (CRÍTICO para no quemar el dominio)
> **Regla de oro:** el mailing en frío sale por un **subdominio dedicado** (ej. `news.mepex…`), NUNCA por el dominio principal. Si una campaña cae en spam, no arrastra los mails normales de la empresa.
1. En el panel DNS del dominio, para el subdominio elegido, cargar los 3 registros que te dé el ESP (listmonk/Brevo):
   - **SPF** (TXT) — autoriza al ESP a enviar.
   - **DKIM** (TXT/CNAME) — firma criptográfica.
   - **DMARC** (TXT) — política (arrancar en `p=none` para monitorear).
2. Esperar propagación (hasta 24-48h) y verificar en el panel del ESP que den "verde".
3. **Warm-up:** arrancar con poco volumen e ir subiendo; no mandar 5000 el día 1.

**Gobernanza (Fede):** el marketing lo liderás vos + un community manager humano para redes/comunicación. El CRM aporta segmentación y datos; el plan de marketing completo se diseña aparte.

---

## 5. E4 — WhatsApp Business Cloud API (Meta)

**Resultado:** el WhatsApp comercial entra solo, en tiempo real. Recién cuando el volumen lo justifique (hasta entonces, el pegado asistido de E1 alcanza).

> ⚠ **No usar puentes no oficiales** (librerías que simulan WhatsApp Web): arriesgan el **ban del número**. No negociable. Solo Cloud API oficial.

### 5.1 🧑‍💻 Meta Business + verificación de negocio
1. **business.facebook.com** → crear/usar el Business de MEPEX.
2. **Business Settings → Security Center → Business verification** → completar (datos de la empresa, documentación). Puede tardar días — arrancar con tiempo.

### 5.2 🧑‍💻 App + producto WhatsApp
1. **developers.facebook.com → My Apps → Create App** → tipo "Business".
2. Agregar el producto **WhatsApp**.
3. **Número dedicado:** registrar el número comercial (el que NO usás en la app normal). Verificación por SMS/llamada.
4. **Display name** del número → requiere aprobación de Meta.

### 5.3 🧑‍💻+🤖 Token permanente + webhook
1. Crear un **System User** en Business Settings con un **token permanente** (los tokens temporales vencen en 24h — no sirven para producción).
2. 🤖 Claude escribe el webhook en el proxy (`POST /api/crm/whatsapp`) + el verify token.
3. 🧑‍💻 En la app de Meta, configurar el **Webhook** apuntando a `https://<dominio-o-ip>/api/crm/whatsapp` y suscribir el campo `messages`. (Meta exige **HTTPS** para el webhook → puede que haya que ponerle un dominio/cert al proxy; lo resolvemos en su momento.)
4. **Templates:** los mensajes que MEPEX inicia (fuera de la ventana de 24h de respuesta) deben ser **plantillas pre-aprobadas** por Meta. Las cargás en el Business Manager.
- ✅ Mandás un WhatsApp al número comercial → aparece en el CRM en tiempo real.

---

## 6. E5 — Agente comercial (escalera de autonomía)

Sin setup externo nuevo (usa el driver IA ya configurado; para calidad de escritura conviene modelo grande — Claude Sonnet/Opus o Gemini Pro, se decide con pruebas). Escalera: **copiloto** (borradores que Noe edita) → **cola con veto** (responde bajo riesgo, 30 min frenable) → **autónomo acotado** (leads fríos/FAQ, escala ante precio/negociación). Detalle en blueprint §11. WhatsApp autónomo SOLO con la Cloud API oficial (E4).

---

## 7. Tabla maestra "quién hace qué"

| Etapa | 🧑‍💻 Fede (manual/externo) | 🤖 Claude (código) |
|---|---|---|
| E1 | correr SQL · crear key Gemini (AI Studio) · poner env + restart proxy (juntos) | SQL · endpoint digest (driver) · tab Casos · pegado WhatsApp |
| E2 | proyecto GCloud · habilitar Gmail API · service account+JSON · domain-wide delegation en Admin · subir JSON al VPS · decidir casilla | poller + matching + label + "sin asignar" + digest diario |
| E3 | definir rubros · elegir listmonk/Brevo · cargar SPF/DKIM/DMARC del subdominio | catálogo rubros · listas/segmentación · integración ESP · generación de contenido IA |
| E4 | verificación de negocio Meta · número dedicado · display name · token permanente · configurar webhook + templates | webhook en proxy · parser de mensajes |
| E5 | revisar/editar borradores (entrena el tono) | escalera del agente + métricas |

---

## 8. Riesgos / gotchas transversales

- **Secretos:** API keys y el JSON del service account viven SOLO en el VPS (env / `/home/mepex/secrets`), nunca en el repo ni en el frontend (la anon key del browser no toca nada de esto).
- **Privacidad Gemini free tier:** Google puede usar los datos. Si pesa → pago/Vertex o Claude (1 env var). Decidir con uso real.
- **No quemar el dominio:** mailing en frío SIEMPRE por subdominio dedicado + warm-up.
- **Ban de WhatsApp:** solo Cloud API oficial, jamás puentes no oficiales.
- **Workspace intacto:** no se self-hostea mail; la independencia real = la memoria comercial queda en Supabase (`crm_mensajes`), Gmail pasa a ser transporte reemplazable. **El CRM es el plan de independencia.**
- **HTTPS para webhooks (E4):** Meta exige TLS; el proxy hoy es HTTP → habrá que ponerle dominio + cert (Caddy/Let's Encrypt) cuando lleguemos.

---

## 9. Checklist de arranque (cuando le demos a E1)

- [ ] 🧑‍💻 Tenés acceso admin de Workspace + Google Cloud + DNS + SSH al VPS (§0).
- [x] ✅ `sql/crm_casos.sql` CORRIDO (2026-06-13).
- [x] ✅ Endpoint digest ESCRITO (`tools/vps/crm-digest.js`) — falta deployar.
- [ ] 🤖 **Tab Casos** (PRÓXIMO) → pushear → 🧑‍💻 pull + probar (pegar WhatsApp, nota, llamada).
- [ ] 🧑‍💻 Crear key de Gemini en AI Studio (§2.2).
- [ ] 🤖+🧑‍💻 Deploy del endpoint: env + `pm2 restart` (§2.3) → ✅ curl OK.
- [ ] Decidir: naming del tab · casilla de mail para E2.

> Cuando quieras arrancar E1, avisá y vamos paso por paso con este doc como guía.
