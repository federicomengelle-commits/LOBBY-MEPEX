# HANDOFF — CRM: "hacer bien TODO el CRM" (completar al 100%)

> **Para lanzar como charla dedicada.** Arranque sugerido: *"Leé `docs/handoff-CRM-completar-todo.md` + `docs/crm-casos-blueprint.md` (§14) + `docs/crm-casos-runbook.md`, y vamos cerrando el CRM por bloques (empezá por lo construible-ya)."*
> Estado al **2026-06-26**. Branch `rediseno` == `origin/main`. CRM `crm.js?v=21` · `api.js?v=61`.
> **Objetivo:** que el CRM sea el sistema comercial central — caso (oportunidad) como columna vertebral, conversaciones multicanal, IA que asiste, y que esté **pulido y completo**.

## ✅ Lo que YA está (no rehacer — detalle en PROGRESO + blueprint §14)
- **E1 núcleo:** caso = oportunidad; **5 tabs planas** (Bandeja · Pipeline · Clientes · Cotizaciones · Analítica); ficha de caso full-screen (timeline unificado + composer 4 canales + pegar capturas + @menciones→notif).
- **Pipeline = kanban de CASOS con drag&drop**; Clientes full-screen; caso Ganado → **"Convertir a proyecto"**; backfill corrido.
- **IA del digest ✅ andando** en el browser: `/api/crm/digest` (nginx same-origin, `gemini-2.5-flash-lite`). WhatsApp pegado → estructurado/resumido. Fallback parser local si la IA falla.
- **Polish v3 parcial:** lote 1 ✅ · lote 2 `sql/crm_polish_v3.sql` (temperatura auto+override, bandeja leído/no-leído, lightbox capturas) · **Score ELIMINADO** ✅ (2026-06-26, `crm.js?v=21`) · **Analítica → admin+superadmin** ✅ (`Auth.isAdminLevel`).

## 🔨 Lo que falta — RANKEADO

### 🟢 1. Construible YA (sin bloqueos)
| # | Qué | Notas |
|---|---|---|
| 1a | **Polish visual de la Bandeja** (con skill `pulir-pantallas`, interactivo) | Fede: "rework SOLO visual, que se lea sola". **Bug concreto:** los **colores de temperatura no se aplican** — `_tempConfig` (crm.js:102) define `color` para hot/warm/cold (`#EF5350/#F28D15/#4A90D9`) pero el chip (`_renderCasoRow` ~3434 y pipeline card ~3482) **solo muestra el emoji**, nunca usa `temp.color`. Aplicar el color (dot/borde/fondo del chip). |
| 1b | **R4 — Clientes con acciones + listas de difusión** | Prep de E3 (mailing). `listmonk` ya instalado en el VPS (memoria `reference_vps_layout`). Botones de acción en Clientes + armar/segmentar listas. |
| 1c | **Link reverso cotización → caso** | Hoy caso→cotización existe; falta el reverso (desde la cotización, ver/ir al caso). |
| 1d | **Plan de cobro automático al convertir caso → proyecto** | Al "Convertir a proyecto", sembrar el plan de cobro (engancha con Finanzas `plan_cobro`). |
| 1e | **Auditoría de cambios del CRM** | Registrar quién edita cliente / mueve pipeline / edita cotización (no solo interacciones) → `audit_log` global. |

### 🔴 2. BLOQUEADO por infra externa (NO es código — son las comms, prioridad de Fede)
| # | Qué | Bloqueo | Destrabe |
|---|---|---|---|
| 2a | **E2 — Gmail al timeline** (ingesta automática de mails) | Política de seguridad a nivel **org de Google** impide crear proyectos GCP | El **partner iPlan** lo habilita. Arquitectura lista: service account + **domain-wide delegation** (`gmail.readonly`), app interna → **gratis, sin verificación, NO meter tarjeta**. Memoria `project_gmail_api_gcp_blocker`. Runbook en `crm-casos-runbook.md`. |
| 2b | **E4 — WhatsApp al timeline** (número live + CRM a la vez) | Falta **vincular el número por QR** (Coexistence) | Sesión "con celu" (~30 min): QR Coexistence + verificar negocio (constancia AFIP, datos EXACTOS) + webhook VPS. Memoria `project_whatsapp_meta_coexistence`. Decisión técnica (Cloud API directa vs BSP) la resuelve Claude. |

> **Nota:** E2/E4 son la **prioridad declarada de Fede** (memoria `project_crm_gmail_whatsapp_priority`) pero dependen de terceros. Cuando se destraben, la **ingesta automática** al timeline es el mayor salto del CRM. Mientras tanto: WhatsApp **pegado** (manual) ya funciona.

### 🔵 3. Futuro (cuando el volumen lo justifique)
- **E3 — Clasificación + mailing en frío:** rubro (catálogo cerrado) + tipo + eventos participados + tags → listas de difusión (Brevo candidato, subdominio dedicado). Contenido por IA. Lo lidera Fede + community manager humano.
- **E5 — Agente comercial casi-humano:** escalera copiloto → cola con veto → autónomo acotado; el historial de casos es su memoria. (Hooks ya sembrados.)

## 📐 Decisiones de Fede (ya tomadas)
- **Score ELIMINADO** ✅ · **Analítica → admin+superadmin** ✅ · **Bandeja = solo rework visual** (no cambia qué muestra) · Marketing eliminado (2026-06-07) · IA = Gemini free tier detrás de driver intercambiable (cambiar a Claude/pago = 1 env var).

## ✅ Cómo chequearlo
- **Polish/temp colors:** en prod, abrir Bandeja → cada caso muestra el color de su temperatura (rojo/naranja/azul), no solo el emoji. Pipeline idem. Usar `pulir-pantallas` (mostrar render real → ajustar con Fede).
- **R4/difusión:** crear una lista, segmentar, (E3) disparar un envío de prueba a una casilla propia.
- **Link reverso / plan cobro:** desde una cotización ir al caso; convertir un caso ganado → ver el plan de cobro sembrado en Finanzas (con cleanup).
- **Auditoría:** editar un cliente / mover pipeline → ver la entrada en `audit_log`.
- **E2/E4 (post-destrabe):** un mail/WhatsApp entrante aparece solo en el timeline del caso correcto.

## 🗂️ Archivos / specs
- Código: `crm.js` (~v21), `api.js` (bloque CRM), `/api/crm/digest` en el VPS (`tools/vps/crm-digest.js`).
- **Specs (NO duplicar, leer):** `docs/crm-casos-blueprint.md` (§1-13 v1 + **§14 refactor v2**) · `docs/crm-casos-runbook.md` (Gemini key, Gmail API+delegation, DNS/mailing, Meta/WhatsApp — pasos manuales/externos).
- Memorias: `project_crm_gmail_whatsapp_priority`, `project_gmail_api_gcp_blocker`, `project_whatsapp_meta_coexistence`, `project_crm_digest_blocker` (resuelto).

## 📋 Orden sugerido (por bloques deployables)
1. **Polish Bandeja + colores de temperatura** (pulir-pantallas, rápido, alto impacto visual). 2. **R4 + link reverso + plan-cobro-auto + auditoría** (features construibles). 3. **E2 Gmail** apenas iPlan destrabe. 4. **E4 WhatsApp** en la sesión con celu. 5. E3/E5 (futuro). Cada bloque: build → verificar en prod (con cleanup) → PROGRESO/PLAN → push. SQL-first donde haya DDL.
