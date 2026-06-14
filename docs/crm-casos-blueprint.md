# CRM MEPEX — Blueprint "Casos" v1

> **Fecha:** 2026-06-11 · **Estado:** aprobado por Fede (sesión de diseño, mockups validados en chat).
> **Rol de este doc:** SPEC OBLIGATORIA de la Fase 7 del `PLAN-MAESTRO-rediseno-lobby.md`. Cuando se implemente el CRM nuevo, se construye basándose en este documento.
> **Modo de implementación:** GUIADO — al ejecutar cada etapa, Claude guía a Fede paso a paso en lo manual (API keys, delegación de Gmail, casillas, verificaciones). Ver §13.

---

## 1. Objetivo

Un CRM "de ida y vuelta todo el tiempo": el lugar donde vive la relación con cada cliente. Toda conversación (WhatsApp, email, llamada, reunión) y todo comentario interno del equipo queda nucleado en su **caso**, con resumen automático por IA. Nada se pierde: lo que se habló por teléfono se anota en 10 segundos y queda en el historial para siempre.

## 2. Qué existe hoy (base sobre la que se construye)

- `crm.js` con 5 tabs: Clientes · Pipeline (kanban de **cotizaciones**, 5 estados: borrador → enviada → en_negociación → aprobada → rechazada) · Cotizaciones · Interacciones · Analítica (superadmin).
- Tabla `interacciones`: resumen manual de 1 línea por **cliente** (`cliente_id`, `canal`, `quien`, `resumen`, `fecha`, `es_automatica`). API: `getInteracciones` / `createInteraccion` / `deleteInteraccion`.
- `cotizacion_timeline`: eventos por cotización (facturación, cobro, cambios de estado).
- Temperatura hot/warm/cold y tipos de cliente (Marca / Agencia / Organizador / Productor Freelance / Productora) ya existen.
- Proxy Node en VPS `195.200.1.250:3000` (hoy expone `/api/lapyme/facturar`).
- Sistema de notificaciones global (`Alertas`, Fase 9) — se reusa para los avisos del CRM.

**El gap:** las conversaciones reales no viven en el sistema (solo resúmenes manuales de 1 línea), no hay comentarios internos por oportunidad, y el pipeline gira alrededor de la cotización en vez de la oportunidad.

## 3. Concepto central: el CASO

**Caso = oportunidad comercial** ("Laboratorios Andina — Expomedical 2026"). Es el núcleo que junta:

- N cotizaciones (v1, v2…) — la cotización pasa a ser una *versión dentro del caso*.
- Todas las conversaciones: WhatsApp, email, llamadas, reuniones.
- **Notas internas del equipo** (con @menciones que disparan notificación) — intercaladas en el mismo timeline, con estilo propio. No hay tabla aparte: son mensajes con canal `nota`.
- Eventos de sistema (cotización enviada, cambio de estado).
- Próxima acción con fecha (el motor de la bandeja diaria).

Estados del caso: `lead → contactado → cotizado → negociacion → ganado / perdido`. El kanban del Pipeline se re-apunta de cotizaciones a casos. Al ganar, el caso se vincula al `proyecto`.

La **ficha del cliente** agrega todos sus casos (históricos + activos) → historial completo de la relación.

## 4. Modelo de datos

### Tablas nuevas

**`crm_casos`**
| Campo | Tipo | Nota |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| cliente_id | UUID FK clientes | |
| titulo | TEXT | ej. "Expomedical 2026 — stand 6×4" |
| evento_id | UUID FK eventos NULL | si la feria existe en el sistema |
| evento_texto | TEXT NULL | si no existe como evento |
| estado | TEXT CHECK | lead/contactado/cotizado/negociacion/ganado/perdido |
| temperatura | TEXT | hot/warm/cold |
| monto_estimado | NUMERIC | |
| owner_id | UUID FK profiles | responsable comercial |
| origen | TEXT | referido/web/feria/frio/... |
| proxima_accion | TEXT NULL | |
| proxima_accion_fecha | TIMESTAMPTZ NULL | |
| motivo_perdida | TEXT NULL | |
| proyecto_id | UUID NULL | se setea al ganar |
| created_at / updated_at / created_by / _deleted | | soft delete estándar |

**`crm_mensajes`** — cada pieza del timeline
| Campo | Tipo | Nota |
|---|---|---|
| id | UUID PK | |
| caso_id | UUID FK crm_casos NULL | NULL = sin asignar (bandeja violeta) o nota a nivel cliente |
| cliente_id | UUID FK clientes NULL | |
| canal | TEXT CHECK | whatsapp/email/llamada/reunion/nota/sistema |
| direccion | TEXT CHECK | entrante/saliente/interna |
| autor | TEXT | nombre mostrado (contacto del cliente o miembro del equipo) |
| autor_id | UUID FK profiles NULL | si es del equipo |
| contenido | TEXT | texto completo (mail entero, mensaje de WA, nota) |
| resumen_ia | TEXT NULL | 1 línea generada por el digest |
| fecha | TIMESTAMPTZ | del mensaje real (no del insert) |
| metadata | JSONB | email: subject/from/message_id/thread_id · wa: teléfono · llamada: duración |
| adjuntos | JSONB | links a Drive/Storage |
| es_automatico | BOOLEAN | true si lo archivó la ingesta |
| created_at / created_by / _deleted | | |

**`crm_contactos`** — personas del cliente (habilita el matching automático)
| Campo | Tipo |
|---|---|
| id UUID PK · cliente_id FK · nombre · cargo · emails TEXT[] · telefonos TEXT[] · es_principal BOOLEAN · notas · _deleted | |

### Cambios a tablas existentes
- `cotizaciones` + `caso_id UUID NULL FK crm_casos`.

### Migración
- `interacciones` → `crm_mensajes` 1:1 (canal mapeado, `quien`→autor, `resumen`→contenido, caso_id NULL = nivel cliente). Cero pérdida. La tabla vieja queda legacy hasta verificar.
- Casos iniciales: 1 caso por cotización viva (mergeables a mano después).

## 5. UI (mockups aprobados 2026-06-11)

Se integra al módulo CRM existente como tab **Casos** (reemplaza/absorbe Interacciones).

1. **Bandeja de hoy** — el daily driver. KPIs: sin responder / acciones vencidas / sin asignar / casos activos. Lista priorizada: cada fila = caso + snippet del último mensaje con ícono de canal + chip de aging (rojo si >48h) + próxima acción + owner. Los leads clasificados por IA sin asignar aparecen en violeta con botón "Asignar".
2. **Pipeline** — el kanban actual re-apuntado a casos, con días-sin-contacto como semáforo.
3. **Ficha de caso** — header (título, estado, temperatura, monto, owner, próxima acción con botón "hecha") + **timeline unificado** (WhatsApp burbujas verdes in/out · email azul colapsado con resumen IA arriba y `<details>` para el mail completo · notas internas naranjas con @menciones · eventos de sistema centrados · digest IA violeta con sugerencias aceptar/descartar) + **composer de 4 canales**: Nota interna / WhatsApp / Email / **Llamada** (lo hablado por teléfono se registra acá y no se pierde) + panel lateral (contacto con wa.me/mailto, datos del cliente, cotizaciones del caso, vínculos a evento/proyecto).

## 6. Capa IA — el "digest"

**Decisión:** endpoint `POST /api/crm/digest` en el proxy del VPS, **agnóstico del modelo** — driver elegido por env (`MODEL_PROVIDER=gemini|claude`). Cambiar de proveedor = 1 variable, 0 refactor.

**Motor inicial: Gemini API free tier** (decidido por Fede — el volumen MEPEX entra cómodo en el tier gratuito; costo $0).
- ⚠ El Gemini incluido en Workspace (mepex@/admin@) es licencia de interfaz, NO da acceso por API. La API key se crea aparte en Google AI Studio (gratis).
- ⚠ Privacidad: en el free tier Google puede usar los datos para mejorar sus productos. Si pesa (son conversaciones comerciales de clientes), upgrade a tier pago / Vertex (centavos) o driver `claude` (Haiku 4.5: $1/$5 por MTok; Anthropic no entrena con datos de API). La decisión queda a un env var de distancia.

**Contrato JSON del digest** (la IA sugiere, el humano confirma con 1 click — nunca decide sola):
```json
{
  "cliente_sugerido_id": "...", "caso_sugerido_id": "...", "confianza": 0.92,
  "resumen": "1-2 líneas",
  "mensajes": [{ "autor": "", "direccion": "entrante|saliente", "fecha": "", "texto": "" }],
  "intencion": "pide_cotizacion|objecion_precio|acepta|consulta|otro",
  "temperatura_sugerida": "hot|warm|cold",
  "proxima_accion_sugerida": { "texto": "", "fecha": "" },
  "monto_mencionado": null
}
```

Usos: parsear WhatsApp pegado (detecta `[fecha] Nombre:` y separa burbujas), resumir mails, clasificar leads entrantes, digest diario por caso activo → notificaciones.

## 7. Ingesta por canal

| Canal | Etapa | Cómo |
|---|---|---|
| **Nota / Llamada / Reunión** | E1 | Manual desde el composer. Canal `llamada` = la info de teléfono que hoy se pierde. |
| **WhatsApp (pegado asistido)** | E1 | Copiás el chat crudo desde WhatsApp Web → pegás en el composer → digest lo estructura en burbujas, resume y archiva. Cero infra. |
| **Email automático** | E2 | **Gmail API** (incluida en Workspace, gratis): domain-wide delegation desde admin@mepex → el proxy lee la casilla comercial por polling (2-5 min), matchea remitente contra `crm_contactos`, resume y archiva. Sin match → bandeja "sin asignar" (al asignar, aprende el contacto). Label `CRM/Procesado` en Gmail. Mucho mejor que IMAP: hilos estructurados, message_id, labels. |
| **WhatsApp Business Cloud API** | E4 | Número comercial dedicado + aprobación Meta. Todo entra solo en tiempo real. Recién cuando el volumen lo justifique. |

## 8. Decisión de infraestructura de mail

- **NO self-hostear mail. Nunca.** Deliverability + mantenimiento recaen en Fede, upside cero. Workspace queda como está ("no tocar lo que funciona").
- La independencia real de Google = (a) dominio propio (ya es de MEPEX — migrar de proveedor es cambiar MX), y (b) **que la memoria comercial viva en Supabase**: una vez que cada mail/chat queda en `crm_mensajes`, Gmail es transporte reemplazable. **El CRM es el plan de independencia.**
- Backup periódico: Google Takeout o `imapsync` a disco propio.

## 9. Etapas de implementación (todas dentro de Fase 7 del plan maestro)

| Etapa | Alcance | Entregable |
|---|---|---|
| **E1 — Núcleo** | SQL (3 tablas + caso_id + migración `interacciones`) · tab Casos (Bandeja + Pipeline re-apuntado + ficha con timeline y composer 4 canales) · endpoint digest con driver Gemini · pegado de WhatsApp | El equipo trabaja "ida y vuelta" en el CRM desde el día 1 |
| **E2 — Email auto** | Gmail API + delegation · polling en proxy · matching + sin asignar · digest diario → notificaciones | Los mails entran y se archivan solos |
| **E3 — Clasificación + mailing** | ver §10 | Listas de difusión desde el CRM |
| **E4 — WhatsApp API oficial** | Cloud API + webhooks en proxy | WhatsApp entra solo |
| **E5 — Agente comercial** | ver §11 | Borradores → autonomía acotada |

Orden no caprichoso: E1-E2 dan valor inmediato; E3 necesita datos limpios que recién existen usando E1-E2; E4-E5 son potencia sobre base probada. SQL-first como siempre (Fede corre el SQL antes del push del JS).

## 10. E3 — Clasificación y mailing en frío

- **Segmentación:** `rubro` pasa a catálogo cerrado (hoy texto libre + bug de columnas rotadas en `clientes` — ojo, mapeado en api.js) · tipo de cliente ya existe · **eventos en los que participó** se deriva de casos/proyectos/eventos · tags libres. Meta: filtrar "cosmética + estuvo en Expomedical 2024-2025" en 2 clicks.
- **Listas de difusión:** el filtro se guarda como lista → export o campaña directa desde el CRM.
- **Envío:** candidato **Brevo** (free 300 mails/día, API, métricas de apertura); para volúmenes muy chicos alcanza la propia Gmail API. **Regla:** el mailing en frío sale por subdominio dedicado (ej. `news.mepex…`) para no quemar la reputación del dominio principal.
- **Contenido:** generado con el mismo driver IA (asunto + cuerpo por segmento).
- **Gobernanza (Fede 2026-06-11):** la estrategia/ejecución de marketing la lidera Fede, con un **community manager humano para redes y comunicación** — aunque se automatice la producción, el manejo de redes y la comunicación tiene una persona. El CRM aporta la segmentación y los datos; el desarrollo de marketing completo se diseña aparte (pendiente, "nos lo debemos").

## 11. E5 — Agente comercial "casi humano"

Prerequisito: el historial de casos (E1-E2) es su memoria — lo que evita el efecto bot no es el delay, es el **contexto** (leer todo el caso antes de escribir).

Escalera de autonomía (se sube de a un escalón, con métricas):
1. **Copiloto:** redacta borradores en el composer; Noe edita y envía. Cada corrección = entrenamiento del tono de la casa.
2. **Cola con veto:** responde solo en casos de bajo riesgo, con pacing humano (horario laboral, demora variable 20-90 min, largo/estructura variables) y 30 min en cola visible en la Bandeja donde se puede frenar.
3. **Autónomo acotado:** primera respuesta a leads fríos y FAQs; escala a humano ante precio, negociación o malestar.

Límites: en WhatsApp solo con la Cloud API oficial (los puentes no oficiales arriesgan el ban del número — no negociable); en email se puede antes. Honestidad: el agente no miente si le preguntan si es un asistente — la reputación de MEPEX vale más que el truco. Modelo: acá importa la calidad de escritura → modelo grande (Claude Sonnet/Opus o Gemini Pro), decidido con pruebas vía el driver.

## 12. Decisiones tomadas / pendientes

**Tomadas (2026-06-11):**
- Caso como núcleo; notas internas en el mismo timeline (canal `nota`).
- Motor IA: Gemini API **free tier**, detrás de driver intercambiable en el proxy del VPS.
- Ingesta email: Gmail API + domain-wide delegation (NO IMAP, NO self-host).
- Llamadas: registro manual canal `llamada` (composer).
- WhatsApp: v1 pegado asistido; API oficial recién en E4.
- Workspace/Google queda intacto; independencia = datos en Supabase.
- Mailing: desde el CRM con segmentación propia; Brevo candidato; subdominio dedicado.
- Marketing: lidera Fede + community manager humano para redes/comunicación.
- La IA sugiere, el humano confirma (en todas las etapas salvo escalones 2-3 del agente).

**Pendientes de decisión (al implementar):**
- Casilla exacta a ingestar en E2 (¿ventas@? ¿mepex@? ¿varias?).
- Catálogo cerrado de rubros (definir con Noe/Fede).
- Si el free tier de Gemini molesta por privacidad → pago/Vertex vs Claude (1 env var).
- Naming del tab (¿"Casos"? ¿"Oportunidades"?) y si Interacciones desaparece o queda read-only.

## 13. Implementación guiada (pedido explícito de Fede)

Al ejecutar cada etapa, Claude guía paso a paso lo que es manual/externo:
- **E1:** crear API key en Google AI Studio · variables en el proxy del VPS · deploy del endpoint.
- **E2:** proyecto en Google Cloud Console → habilitar Gmail API → service account → domain-wide delegation en admin.google.com (scopes `gmail.readonly` + `gmail.modify`) → probar impersonación de la casilla.
- **E3:** alta en Brevo (o el ESP elegido) · DNS del subdominio (SPF/DKIM/DMARC).
- **E4:** verificación de negocio en Meta · número dedicado · webhook en el proxy.

---

*Mockups de referencia (renderizados en la sesión de chat 2026-06-11): "Ficha de caso" (timeline multicanal + composer) y "Bandeja de hoy" (KPIs + lista priorizada). Reproducirlos con el dark theme MEPEX estándar: turquesa #00A9C1, naranja #F28D15 (notas internas), verde WhatsApp #25D366, azul email #4A90D9, violeta IA #9B7DFF.*

---

## 14. REFACTOR v2 — arquitectura unificada (decidido 2026-06-14)

> **Por qué:** tras construir E1 (tab "Casos") quedaron **dos pipelines** (el viejo de cotizaciones + el de casos) y el **panel lateral angosto** se confirmó como patrón equivocado. Fede pidió full-screen tipo cotizador y un CRM integrado de punta a punta. Decisiones cerradas con Fede en esta charla.

### 14.1 Principio rector
**El CASO es la columna vertebral.** Cliente = directorio (quién es). Caso = la oportunidad / relación viva. **Cotización = un documento DENTRO del caso.** Todo (timeline, cotizaciones, próxima acción, proyecto al ganar) cuelga del caso.

### 14.2 Pestañas (decidido: 5 planas)
`Bandeja · Pipeline · Clientes · Cotizaciones · Analítica`
- **"Casos" deja de ser pestaña** — se vive a través de Bandeja (lista del día) + Pipeline (kanban) + la **ficha full-screen** al clickear.
- **Pipeline = UN solo kanban de CASOS** con drag&drop de estado (reemplaza el de cotizaciones; se reusa la infra de DnD existente). Se acaba la redundancia.
- **Interacciones se JUBILA** (su data ya vive en el timeline de cada caso/cliente).
- **Cotizaciones** = índice plano/tabla operativa; cada fila linkea a su caso.

### 14.3 Modelo de navegación: full-screen, chau panel lateral
Click en **caso** o **cliente** → cuadro completo que ocupa todo `#mainContent` (como el cotizador). La ficha de caso YA es full-screen (E1); el refactor lleva el mismo patrón a **Clientes** y retira el `_openPanel` lateral en todo el CRM.

### 14.4 Conexión hacia abajo (todo enlazado)
- Caso **Ganado** → botón "convertir": crea el **proyecto** (+ evento opcional) y arranca el **plan de cobro** en Finanzas desde la cotización aprobada.
- Cotización aprobada dentro del caso → engancha el flujo de facturación existente.
- Caso **Perdido** → motivo + queda en histórico para Analítica.

### 14.5 Clientes con acciones + listas de difusión (prep E3)
Filtros sobre clientes (rubro catálogo cerrado + tipo + "participó en feria X" derivado de casos/eventos + tags) → **guardar como lista** → campaña (Brevo/listmonk, E3) o export. Botón "nueva campaña / agregar a lista" por cliente.

### 14.6 Hooks para el agente futuro (NO se construye ahora — "mambo aparte")
El modelo ya deja servido lo que el agente necesitará: timeline = su memoria, `proxima_accion`, y el composer con un futuro modo "borrador IA que un humano confirma" (mismo contrato del digest §6). Se deja la puerta abierta; se construye en una etapa propia más adelante.

### 14.7 Migración (backfill) — SQL-first
`sql/crm_casos_backfill.sql` (idempotente): 1 caso por grupo (cliente + evento) desde las cotizaciones sin caso, estado derivado (aprobada→ganado, rechazada→perdido, en_negociacion→negociacion, enviada→cotizado, resto→lead), set `cotizaciones.caso_id`. Se corre ANTES del push del refactor JS.

### 14.8 Fases del refactor
- **R1 — Unificación pipeline + tabs** (SQL-first): backfill · tabs→5 planas · Pipeline=kanban de casos con DnD · jubilar Interacciones · Cotizaciones linkea a caso.
- **R2 — Full-screen en todo**: Clientes ficha full-screen (retirar panel lateral).
- **R3 — Conexión Finanzas/Operaciones**: caso Ganado → proyecto + plan de cobro; cotización→facturación.
- **R4 — Clientes con acciones + listas de difusión** (prep E3).
- *(Futuro)* Agente asistente — hooks sembrados, etapa aparte.

> Las etapas IA originales **E2 (email Gmail) / E3 (mailing) / E4 (WhatsApp Cloud) / E5 (agente)** siguen vigentes y se encaran después del refactor v2 (que es de estructura/UX, no de ingesta).
