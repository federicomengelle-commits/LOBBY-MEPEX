# Handoff — Rediseño del FLUJO de mensajes de la Ficha de Caso (CRM v3)

> **2026-07-19.** La ficha de caso v3 está CONSTRUIDA y EN PROD (2 rondas), pero el flujo del
> composer/mensajes NO es intuitivo y Fede frenó el código: **"antes de seguir tocando, planeamos
> el flujo, aunque sea dibujado con flechitas y con ifs; 2-3 versiones; que lo pueda usar
> cualquiera"**. Esta sesión = DISEÑO DEL FLUJO primero (diagramas + mockups), código después del OK.
> Dealbreakers en memoria `feedback_crm_flujo_dealbreakers`.

## Estado exacto (todo pusheado y en prod)

| Pieza | Estado |
|---|---|
| Ficha v3 (`#crm/caso/<id>`) | ✅ prod. Cabecera rica (cliente protagonista, sin montos, chip evento deep-link, back circular), banda Resumen IA clamp 2 líneas + desplegable, aside (COT ítems sin montos + Drive if + contacto), Bandeja en cards. Commits `5ef1f7a` (v3) + `b9f15e9` (ronda 2 densidad/íconos/composer reencuadrado). Versiones: `crm.js?v=36 · api.js?v=85 · router.js?v=22`. |
| SQL | ✅ `sql/crm_ficha_v3.sql` corrido por Fede (drive_folder_url/id + resumen_ia/_at en `crm_casos`). |
| Connector VPS | ✅ deployado con `mode:'resumen_caso'` (`tools/vps/crm-digest.js`, cp+restart hechos). **El resumen IA real FUNCIONA en prod** (probado con Riderchail: resumió el historial solo). |
| Reviews | 3 agentes nativos pasados (sql/security/typescript — 3 HIGH cazados y arreglados). Regla 19. |
| Header v3 tras ronda 2 | ✅ **Fede: "mejoró mucho, está mucho mejor"** — NO tocar. |

## EL PROBLEMA (por qué se frenó)

El composer actual hereda el paradigma v2: **"registrar a mano lo que pasó"** — tabs de canal
(Nota/WhatsApp/Email/Llamada) + toggle "el mensaje lo mandó Cliente/MEPEX" + "Procesar con IA"
(parsea WhatsApp pegado) + "Agregar al historial". Fede NO lo entiende tras 2 iteraciones y su
modelo mental es otro:

> "Yo lo que necesito es un **resumen todo el tiempo** y poder **mandar mensajes**. Ya sé que los
> puedo recibir — el tema es que entre lo recibido y lo mandado se armen varias frases resumidas
> en el encabezado. El visualizador tiene que tener todo con el canal bien discriminado. Y los
> botones de abajo no los entiendo."

**Traducción de paradigma:** él espera un CHAT (como WhatsApp Web): los mensajes ENTRAN solos,
él ESCRIBE y manda, y la IA RESUME sola arriba. El registro manual (que hoy es necesario porque
las APIs aún no ingieren) tiene que existir pero ESCONDIDO como acción secundaria, jamás como la
cara del composer.

## Dealbreakers (memoria `feedback_crm_flujo_dealbreakers`)

1. **Resumen IA SIEMPRE visible y AUTOMÁTICO** — se regenera solo (p.ej. al abrir el caso si hay
   mensajes nuevos desde `resumen_ia_at`; el ↻ queda como extra). Varias frases, no una.
2. **Composer = MANDAR** (WhatsApp real post-E4 + notas internas). Nada de elegir dirección.
3. **Registro manual = secundario/escondido** ("＋ Registrar algo que pasó afuera" → modal con el
   flujo actual completo, incluido "Procesar con IA" que ahí adentro SÍ tiene sentido).
4. **Hilo con canal bien discriminado** (ya gusta: burbujas + íconos de marca SVG).
5. **Sin montos a la vista en el CRM.**
6. **Plan-first para flujos**: presentar 2-3 versiones DIAGRAMADAS (mermaid con flechitas/ifs +
   mockups `show_widget` estilo MEPEX fiel) y elegir con Fede ANTES de codear.

## Realidad técnica para el diseño

- **Hoy NO se puede mandar WhatsApp real** (llega con E4 fase 2, sesión celu agendada semana 20/07:
  webhook `wa_eventos` ya construido + runbook `docs/whatsapp-coexistence-runbook.md`). Gmail E2
  bloqueado por iPlan. → El único "mandar" real HOY es la **nota interna** (y wa.me que abre
  WhatsApp afuera). El diseño debe contemplar los 2 tiempos: hoy (manual escondido + notas) y
  post-E4 (enviar de verdad desde el composer; el input ya está diseñado para eso).
- **Resumen automático**: `API.generarResumenCaso(caso, mensajes)` ya existe (arma texto del
  timeline → `/api/crm/digest` mode `resumen_caso` → guarda en `crm_casos.resumen_ia/_at`).
  Para el AUTO: disparar en `_openCaso` si `max(mensajes.fecha) > resumen_ia_at` (async, sin
  bloquear el render; actualizar la banda al llegar). Costo: centavos por regeneración (Haiku).
  También puede regenerarse tras "Agregar al historial"/preview de WhatsApp aplicado.
- **Piezas de código relevantes** (`crm.js`): `_renderComposer` (L~4300), `_sendComposer`,
  `_procesarWhatsapp`/`_showWhatsappPreview` (pegado asistido → `createMensajesBulk`),
  `_renderTimelineItem` (burbujas por canal), `_resumenIaHtml`/`_iaDespleHtml`/`_generarResumenIa`,
  `_attachCasoFichaEvents`. `_canalSvg(canal)` = set de íconos de marca inline.
- Mensajes de sistema ("Estado → X") ya se renderizan finitos en el hilo.

## Direcciones candidatas para las 2-3 versiones (semilla, NO decisión)

- **A "Chat-first"**: composer de UNA línea como WhatsApp Web: input + botón enviar con selector
  de destino (Nota interna hoy; WhatsApp cuando E4 esté). Arriba del input, UN link discreto:
  "＋ Registrar conversación externa" → modal con el registro manual completo (canal, quién,
  procesar con IA). El resumen es auto.
- **B "Inbox auto"**: igual que A pero el registro manual ni siquiera es visible en la ficha —
  vive en el menú ⋯ del header; la apuesta es que post-E4 casi todo entra solo y lo manual es
  excepción. Riesgo: hasta E4, registrar cuesta un click más.
- **C "Dos zonas"**: composer para nota/enviar + una franja fina "¿Pasó algo por WhatsApp/mail?
  Pegalo acá" que expande el registro inline (sin modal). Punto medio.
- En TODAS: banda IA auto + hilo intacto + "El mensaje lo mandó Cliente/MEPEX" solo DENTRO del
  flujo de registro (nunca a la vista).

## Método de la sesión

1. Leer memoria `feedback_crm_flujo_dealbreakers` + este handoff. NO tocar código de entrada.
2. Diagramar los flujos (mermaid con ifs: mensaje entra → ¿de dónde? → hilo → resumen auto;
   usuario quiere contar algo → ¿nota o pasó afuera? → ...) — 2 o 3 versiones.
3. Mockups `show_widget` fieles MEPEX de la zona del composer por versión (skill `pulir-pantallas`;
   el header NO se toca).
4. Fede elige/mezcla → recién ahí codear (con reviewers regla 19) → push → pull → verificar juntos.

## Pendientes conexos (no de esta sesión)

- Barrido global "botón volver" circular (patrón registrado en PLAN, diseño listo — buena tarea
  autónoma post-flujo).
- Fase 2 ficha (post-celu): enviar WhatsApp real, adjuntar COT/catálogo desde el hilo, countdown
  del evento en el chip, "mandar al Centro de Tareas".
- 🧠 CEREBRO MEPEX + historial por cliente (PLAN §🟡; charlar con Jordi).

## Prompt de arranque para la charla nueva

```
Sesión: rediseñar el FLUJO de mensajes de la Ficha de Caso del CRM (LOBBY-MEPEX).
Al empezar: git fetch origin && git reset --hard origin/main.
Leé docs/handoff-crm-ficha-flujo.md COMPLETO + la memoria feedback_crm_flujo_dealbreakers.
REGLA: primero los diagramas del flujo (2-3 versiones, con flechitas e ifs) + mockups
del composer en estilo MEPEX fiel. NADA de código hasta que yo elija. El header de la
ficha NO se toca (ya está aprobado). Arrancá mostrándome las versiones.
```
