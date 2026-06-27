# HANDOFF EJECUTABLE — CRM: terminar el rediseño (Bandeja + estado + presupuesto) para usarlo ya

> **Arranque (pegar en la sesión nueva):**
> *"Leé `docs/handoff-CRM-rediseno-bandeja.md`. El diseño ya está CERRADO con Fede (prediseño 2026-06-26). Ejecutá el sprint CRM: 1) rediseño de la Bandeja, 2) link reverso cotización↔caso, 3) auditoría de cambios. Para lo visual usá el método de la skill `pulir-pantallas` (traé el render real, mostrame, aplicás), pero el diseño base ya está definido acá — no re-explores de cero."*
>
> **Foto:** 2026-06-26. Branch `rediseno` == `origin/main` @ `5861e54`. Archivo: `crm.js` (~v21) · `api.js` (~v62).
> **Prioridad de Fede:** esto va PRIMERO, antes del refactor de Proyectos/Eventos. Objetivo: *"terminar el rediseño del CRM para empezar a usarlo bien ya."*
> **Fuera de alcance ahora:** Gmail (E2, bloqueado iPlan) · WhatsApp (E4, sesión con celu) · R4 difusión/mailing (es marketing/E3) · plan-cobro-auto.

---

## ✅ DISEÑO CERRADO (decisiones de Fede en el prediseño — NO re-debatir)

### Bandeja — la fila (`_renderCasoRow`)
1. **Sale la temperatura** (🔥/☀️/❄️). Hoy es auto por recencia (`_autoTemp`: Hot ≤5d/Warm 6-12d/Cold >12d) y **repetía la info del aging `Xd`** que ya está a la derecha → confundía. Eliminar `_tempConfig`, `_autoTemp`, `_effTemp` del render de la fila (y la columna `.caso-row-temp`). *(El override manual de temperatura en la ficha se puede quitar también; coordinar si se deja el dato en DB inerte.)*
2. **Barra izquierda de color = ETAPA del pipeline** (opción A elegida). Colores ya definidos en `_casoEstados`: Lead `#888` · Contactado `#4A90D9` · Cotizado `#9B7DFF` · Negociación `#F28D15` · Ganado `#00CC88` · Perdido `#E94B4B`. `border-left: 4px solid <color de la etapa>`.
3. **Chips de urgencia** (se mantienen, son lo que "grita"): rojo `sin responder` (`_sinResponder`) y `acción vencida` (`_accionVencida`); naranja `enfriándose` (varios días sin contacto — definir umbral, ej. >7d sin mensaje). El borde verde de `sin responder` (`.caso-row--sinresp`) SALE (la barra ahora es la etapa) → pasa a chip.
4. **Presupuesto linkeado** = chip violeta clickeable en la fila: `📄 COT-XXXX · $monto · <estado cot>` → abre la cotización (acceso rápido). El vínculo YA EXISTE: `this._cotizaciones.filter(c => c.casoId === caso.id)` (ver `_renderCasoFicha` línea ~3582). Si el caso tiene ≥1 cotización, mostrar la más reciente (o la de mayor monto).
5. **Estado de cambio rápido**: el badge de estado lleva un `▾` → clic abre un mini-menú para mover de etapa **sin salir de la Bandeja** (mismas 6 etapas). Reusar el handler que ya mueve estado en el pipeline / el `<select>` de la ficha.
6. **Más contraste + más detalle** (pedido de Fede): título más brillante (`#F4F4F4`, 600), badges con tint + borde del color, alineado a tokens MEPEX (dark, turquesa, Space Mono para montos/números). Mantener el punto turquesa de no-leído + el orden actual (`_enrichCasos` por `_score`).

### Estado del caso — **semi-automático** (elegido)
- Sigue siendo manual (badge `▾` en Bandeja · drag&drop en Pipeline · select en ficha), PERO:
  - Al **linkear/mandar una cotización** a un caso → el caso salta solo a **`cotizado`** si venía antes (lead/contactado). Hook en el guardado/linkeo de cotización (y en `importar-cotizacion.js` cuando adjunta a una cotización con caso).
  - Al **convertir un Ganado→proyecto** (ya existe el botón) → queda `ganado`.
  - El resto, manual.

### Pipeline (`_pipelineColumnsHtml`) y ficha
- Aplicar el mismo lenguaje: la tarjeta del pipeline ya usa el color de etapa por columna; sacarle el emoji de temperatura. En la **ficha del caso**, subir el presupuesto vinculado a un lugar prominente (hoy vive en el aside, línea ~3582-3641) — "linkeado adentro" como pidió Fede.

> **Referencia visual:** los mockups del prediseño (Bandeja Hoy/Propuesta + la fila al detalle + las 3 opciones de color) se mostraron con `show_widget` en la charla del 2026-06-26. La opción elegida = **A (barra por etapa)** con los chips de urgencia y el chip de presupuesto.

---

## 🔨 SPRINT — 3 piezas (en orden)

### 1. Rediseño de la Bandeja  *(método `pulir-pantallas`: traé el render real → mostrá 1 pasada fiel → OK de Fede → aplicá)*
- **Archivo:** `crm.js`. Funciones: `_renderCasoRow` (~3386), `_renderCasosBandeja` (~3327), `_bandejaRowsHtml`, `_pipelineColumnsHtml` (~3430). CSS: `crm.js` ~líneas 6418-6530 (`.caso-row*`, `.caso-pcard*`).
- Aplicar el diseño cerrado de arriba (barra por etapa, sacar temperatura, chips urgencia, chip presupuesto, badge `▾`).
- **Estado rápido:** menú al clic del `▾`. Reusar `API.updateCaso`/equivalente (el que usa el pipeline DnD). Verificar el nombre real del método de update de estado del caso.
- CSS scopeado (`.caso-*` ya lo está). Verificar por `preview_eval` (screenshots cuelgan el headless). Bump `crm.js?v=` + `node --check`.

### 2. Link reverso cotización↔caso
- Hoy: caso→cotización existe (`cotizacion.casoId`, ficha aside). Falta: **desde la cotización (tab Cotizaciones / panel) ver e ir al caso**. Agregar en el panel de la cotización un chip/botón "Ver caso" → `_openCasoFicha(casoId)`.
- + el chip de presupuesto en la fila de la Bandeja (pieza 1) es la otra mitad del vínculo.

### 3. Auditoría de cambios del CRM
- Registrar **quién** edita cliente / mueve estado del caso / edita cotización (no solo interacciones) → `audit_log` global. **Verificar primero** el nombre/forma real de la tabla de auditoría en prod (CLAUDE.md menciona `audit_logs` plural en contabilidad y `audit_log` singular en otros lados — confirmar contra `information_schema`). **SQL-first** si hace falta tabla/columna.
- Enganchar en los puntos de escritura: `API.updateCliente`, update de estado del caso, `API.updateCotizacion`/create.

---

## ⚙️ Cómo funciona hoy (contexto para no romper)
- **Estado:** manual. Pipeline kanban con drag&drop + `<select>` en la ficha (`.caso-estado-select`). 6 etapas en `_casoEstados`.
- **Temperatura:** auto por recencia (`_autoTemp`) + override manual (`temperaturaManual`/`temperatura` en el caso). Se elimina del UI.
- **Orden de la Bandeja:** `_enrichCasos` calcula `_score` (acción vencida > sin responder > no leído > días) y ordena desc. Mantener.
- **Cotización↔caso:** `cotizacion.casoId`. `this._cotizaciones` está cargado en el módulo. La cotización tiene `numero`, `montoTotal`, `estado` (`_cotEstados`).
- **CRM ya funciona y está EN USO en prod** (5 tabs, pipeline DnD, clientes full-screen, casos+timeline+composer, IA digest). Esto es pulido + features, no reconstrucción.

## ✅ Verificación / workflow
- Preview server "lobby" (`.claude/launch.json`) → `preview_eval` (no screenshots/PDF). Verificar: fila con barra por etapa, chip de presupuesto, `▾` cambia estado, chips de urgencia, 0 errores de consola.
- Prod (Fede, con cleanup): mover un caso de etapa desde la Bandeja, abrir el presupuesto desde el chip, ver que linkear una cotización lo pasa a "Cotizado".
- Git: `git push origin HEAD:main` (detached HEAD ok), `git add` SOLO lo propio (árbol compartido — NO tocar `docs/octexa/`). SQL-first para la auditoría si hay DDL.
- Cierre: PROGRESO/PLAN/CLAUDE §10 + tildar `pulir-pantallas` (Bandeja ✅).

## 🔗 Refs
- Diseño/contexto amplio del CRM: `docs/handoff-CRM-completar-todo.md` · `docs/crm-casos-blueprint.md` §14.
- Método: skill `pulir-pantallas`. Orden general: `docs/handoff-proxima-sesion-remate.md` (CRM = etapa 1).
- Memorias: `feedback_skill_pulir_pantallas`, `feedback_ui_separar_info_acciones`, `feedback_orden_sql_push`, `feedback_git_workflow`.
