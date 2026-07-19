# 🚀 PLAN SUPERIOR — LOBBY MEPEX

> **Fuente de verdad de lo que FALTA.** Nace del "Project Scope & Missing Pieces".
> Reemplaza a `PLAN-MAESTRO-rediseno-lobby.md` (**CONGELADO** — archivo histórico del rediseño).
> El registro de lo HECHO sigue en `PROGRESO.md`, ahora en **ETAPA II**.
> Última consolidación: **2026-07-17** (repaso completo con Fede; tablero: artifact "repaso-17-07").

## 📐 Premisa de tracking (máxima)
- **PLAN SUPERIOR** (este archivo) = todo lo que falta, ordenado por prioridad. Se **descuenta** acá a medida que se cierra.
- **PROGRESO.md — ETAPA II** = se sigue escribiendo al detalle (está al día, entradas `[E2]` hasta 2026-07-17).
- **PLAN-MAESTRO-rediseno-lobby.md** = CONGELADO. No seguirlo; queda de referencia histórica.
- Se mantiene el registro de **TODAS las ideas al detalle** (premisa de Fede). Nada de podar por brevedad.

---

## 🗺️ Los 5 frentes
1. **Rediseño LOBBY — ≈92% hecho.** Construcción cerrada; queda pulido dirigido por la ronda de testeo + costuras menores. La validación real la da la ronda.
2. **Consultoría Jordi (NUEVO frente).** Seguridad ✅ COMPLETA (39/40, `docs/cierre-auditoria-jordi.md`, verificada en prod 2026-07-17; bug grave de disponibilidad cazado en el camino). **4 MD ✅ APLICADOS (2026-07-18):** eran subagentes de Claude Code → instalados a nivel usuario (los 4 tal cual, para todos los proyectos) + adaptados al stack en `.claude/agents/` del repo (`security-reviewer`/`typescript-reviewer` + `sql-reviewer` propio nuevo) + regla 19 en CLAUDE.md §8. Veredicto completo: `docs/jordi/VEREDICTO.md`. **Siguiente fase:** 3 plugins + PostHog + WhatsApp rápido — todo dentro de la ventana de la consultoría.
3. **CRM → máquina de demanda.** WhatsApp E4 **DESBLOQUEADO** (webhook+runbook listos, sesión con celu agendada semana del 20/07) · Gmail E2 ⛔ iPlan · base de clientes espera archivos de Fede · marketing con plan escrito (`docs/PLAN-MARKETING.md`).
4. **OCTEXA (paralelo, repo propio `APPS ANTIGRAVITY\OCTEXA-API`, NO cuenta en el % del lobby).** Cerebro ~93% · Pilar 2 espera la ruta del archivo histórico · Compositor parkeado (el diseño vive en 3ds Max).
5. **Cotizador (app aparte, misma Supabase).** Integración: importador 3ds Max→BOM frenado por 1 CSV real (Meli) + leer `cotizacion_items` estructurada en vez de parsear el PDF.

---

## ✅ Cerrado desde la consolidación anterior (02/07 → 17/07) — ya descontado
Detalle sesión por sesión en `PROGRESO.md` §[E2]. Resumen:
- **🛡️ Track COMPLETO de seguridad JordiGPT** (2026-07-10→17, ni figuraba en este plan): score 25→**39/40** — HTTPS+HSTS, auth Bearer en ARCA/IA, RLS paso 1+2 (encuesta por RPCs), Claude p/PII (`provider:claude`), XSS+escape central, **CSP enforcing** (script-src sin unsafe-inline), rate-limits (429 verificado), password mín 10 (front+server+Dashboard), M4 (GoTrue v2.193.0 revoca sesiones — verificado contra la fuente), M5 trigger, B4 bucket stands, B5 npm audit 0 vulns, **MFA activo en Fede (app + bonus Dashboard)**. Fuente de verdad: `docs/cierre-auditoria-jordi.md`.
- **🔴 Bug grave cazado y arreglado:** TODOS los POST a `/api/` daban 500 desde el switch de dominio (Origin en POST same-origin vs allowlist CORS con IP viejo) → **facturación ARCA + digest + OCR estuvieron caídos sin que nadie lo note**. Fix `cb(null,false)` + dominio en ambos servers, verificado en prod. No fue agujero (auth intacta), fue disponibilidad.
- **Infra front:** carga diferida del JS (login = 7 scripts core, `App._APP_SCRIPTS` — **los bumps `?v=` de módulos diferidos van AHÍ, no en index.html**, ver CLAUDE.md §5) · barrido IP→dominio (`/lobby-api`, `/cotizador/`) · fix `audit_log` 400 · `encuesta.js` externalizado.
- **📧 Proveedores — presupuestos por MAIL** (era el "🎯 PRÓXIMO RUMBO"): F1–F4 construido y **validado en prod** (06/07, 2 bugs cazados). Futuro F5 = SMTP del VPS.
- **🧾 Circuito gastos de evento** (staging Rendimiento → migrar/conciliar a Egresos): construido + **SQL aplicado en prod** (verificado 17/07). Falta solo la prueba real del circuito (escribe datos).
- **👥 Base de clientes bloque 1** (importador CSV + campos + vista salud): construido + **SQL aplicado en prod** (verificado 17/07). Espera archivos de Fede.
- **🔩 SQLs de la capa operativa** (`compras_pedido_piezas`, `compras_stock_recepcion`): **aplicados en prod** (verificados 17/07) — schema sin deudas.
- **📲 WhatsApp E4 — preparación completa (17/07):** decisión Cloud API directa (fallback 360dialog) + webhook con firma HMAC construido y testeado + staging `wa_eventos` + montaje en server.js (inerte sin env) + **runbook completo `docs/whatsapp-coexistence-runbook.md`**.
- Fixes varios: bug-hunt con data real (proveedor select, badge proyectos, búsqueda global), Flota↔Transporte picker chofer, pedidos→piezas, aire lateral (falta validación visual de Fede).

---

## ⏳ LO QUE FALTA — checklist real, ordenada

### 🔴 AHORA — ventana consultoría Jordi (semana del 20/07)
1. **WhatsApp E4 — sesión "con celu"** 📅 **agendada: Fede trae el celu de la oficina mar→mié o mié→jue de la semana entrante.** Runbook paso a paso listo: `docs/whatsapp-coexistence-runbook.md` (SQL `whatsapp_webhook_v1.sql` → deploy webhook + `WA_VERIFY_TOKEN` → app Meta + App Secret → Business Verification con constancia AFIP → configurar webhook + subscribe 4 campos → conectar número desde el celu → smoke E2E contra `wa_eventos`). Traer: celu con Business App ≥2.24.17 + constancia AFIP + 30-45 min. **Después: fase 2** (procesador `wa_eventos`→timeline `crm_mensajes`, matcheo por teléfono —ojo columnas rotadas de `clientes`—, mandar desde el CRM) — se diseña juntos post-conexión.
2. ~~**Los 4 MD de Jordi**~~ ✅ **HECHO 2026-07-18** — eran subagentes de Claude Code, no checklists. Instalados: nivel usuario `~/.claude/agents/` (los 4 tal cual, sirven en todos los proyectos) + nivel proyecto `.claude/agents/` (security/typescript adaptados al stack + **`sql-reviewer` propio nuevo** — el hueco del set: migraciones a mano contra la única BD). Regla de uso = CLAUDE.md §8 regla 19. Veredicto por MD con evidencia: **`docs/jordi/VEREDICTO.md`** (resumen: security ~todo ya cumplido por el 39/40, valor = review proactivo de diffs nuevos; typescript aplica solo el núcleo JS, sin TS/build/tests a propósito; python N/A hoy — 0 `.py`; loop-operator destilado a memoria). Descartado a conciencia: eslint (ruido sobre legacy) y migrar a TS.
3. ~~**3 plugins**~~ ✅ **INSTALADOS 2026-07-17** por CLI (scope user, activos en sesiones nuevas): `supabase@claude-plugins-official` (⏳ 1ª vez pide autenticar con la cuenta Supabase de Fede → después: schema/SQL directo) + `superpowers@claude-plugins-official` v6.1.1 + `claude-mem@thedotmack` v13.11.0. **Solape claude-mem ✅ REVISADO (2026-07-18, sesión de los MD):** hooks verificados — captura automática TOTAL (observación por CADA tool call + contexto propio en cada arranque/Read + sqlite propio + daemon). Se solapa de lleno con la memoria curada. **Regla de convivencia:** CLAUDE.md/PROGRESO/PLAN + `memory/` = fuente de verdad CANÓNICA; claude-mem = ayuda de recall, si contradice gana lo curado. **En modo piloto ~1 semana:** si mete ruido/latencia (spawn bash+node por tool call en Windows) o memorias viejas que contradigan §10 → apagarlo SOLO en LOBBY con `"enabledPlugins": {"claude-mem@thedotmack": false}` en `.claude/settings.local.json` (queda vivo para otros proyectos con menos docs). Nota: instalación real fue 18/07 22:15 UTC, activos en sesiones nuevas.
4. **PostHog Analytics** ✅ **INTEGRADO 2026-07-17** (cuenta creada por Fede — US Cloud, proyecto 518740, cuenta personal federicomengelle@; key phc_ client-side en `posthog-init.js`): carga post-login al final de `App._APP_SCRIPTS` como **script OPCIONAL** (si el CDN falla, la app carga igual — `_OPTIONAL_SCRIPTS`), identify usuario+rol, $pageview manual por hashchange con propiedad `modulo`, CSP actualizada (us-assets script / us.i connect). Verificado en local con CSP enforcing: init + identify + connect 200 + 0 violaciones. **✅ DEPLOYADO Y VERIFICADO EN PROD 2026-07-17** (posthog cargado + identificado como `fede`, eventos fluyendo; onboarding "Installation complete"). Residuales finos: (a) 1 pull más para el **Error Tracking** (`b2ba376`, `capture_exceptions` en posthog-init v2) · (b) **Session replay**: activarlo desde PostHog Settings cuando Fede quiera (el código ya lo banca) · (c) productos elegidos: Product/Web Analytics + Session Replay + Error Tracking (Logs/AI/Flags descartados para herramienta interna).
5. ~~**Confirmar triggers de notificaciones**~~ ✅ **VERIFICADO 2026-07-18** (SQL Editor vía Chrome): `trg_notif_stock_minimo` + `trg_notif_equipo_estado`, ambos `tgenabled='O'` (activos).

### 🟠 Cierres cortos (dependen solo de vos / guiados)
- ~~**Probar el circuito de gastos de evento en prod**~~ ✅ **VERIFICADO END-TO-END EN PROD 2026-07-18** (vía Chrome de Fede, con cleanup EXACTO al baseline): los 3 caminos — staging con factura → migrar "pagada" (egreso pagado + asiento #44 balanceado **con IVA en 3ª línea**, comprobante reusado sin duplicar) · migrar "pendiente" (egreso `pendiente` SIN asiento) · **conciliar** con egreso suelto ya cargado (pago apunta al existente, detector de candidatos OK) + cierre/badge/reabrir por UI real + dashboard **anti-doble-conteo** exacto ($191.000 planilla / $0 directo). Partida doble global intacta antes y después ($13.984.910, dif $0).
- **MFA en Lelean y Sofi** (5 min c/u, Mi Perfil → Seguridad; red de seguridad: Dashboard → Users → quitar factor).
- **CSV de 3ds Max** — recontraviable: **hablar con Meli** para que exporte un CSV de prueba → fijamos formato de columnas → cierro el importador (`importar-3dsmax.js` ya construido, banca `,`/`;`/tab + sinónimos + es-AR).
- **ARCA — verificación oportunista** (sin apuro): 1ª Factura A real con 2 alícuotas (21+10,5) → mirar el PDF → confirmar `_EMISOR` y sacar el `⚠️ verificar` de `finanzas.js`. Nota: el endpoint quedó re-verificado operativo el 16/07 tras el fix de POSTs.

### 🗓️ Ronda de testeo del equipo — PENDIENTE SIN FECHA (decisión Fede 2026-07-17)
- **No se largó** (la pisó el track de seguridad). Posible ventana: semana del **27/07** o **agosto**. Todo sigue en verde para largarla: kit completo en `docs/testeo/` (instructivos por rol + WhatsApps + PDFs livianos + `qa-precheck.md`). Al largarla queda solo: mandar los WhatsApp + adjuntar PDFs + crear el grupo de reporte. **Ventaja de esperar la semana del 20:** el equipo probaría con WhatsApp ya conectado al CRM.

### 🟡 Después del testeo / a demanda
- ~~**🎨 CRM Bandeja — rediseño VISUAL**~~ ✅ **DISEÑADO + CONSTRUIDO 2026-07-19** (commit `5ef1f7a`, sesión en vivo con 6 mockups): Bandeja en **cards 2-col** (cliente protagonista, acciones inline, sin montos) + **Ficha de Caso v3** "sala de situación" (cabecera rica, Resumen IA estilo Gemini, cotización desplegable sin montos, Drive del caso, ruta `#crm/caso/<id>`, chip evento deep-link). Reviews de los 3 agentes nativos pasados (3 HIGH cazados y arreglados). **⛔ Fede:** `sql/crm_ficha_v3.sql` → pull → `cp tools/vps/crm-digest.js` + `pm2 restart mepex-api` → verificación en prod. **Fase 2 (post-celu):** enviar WhatsApp real desde el composer · countdown del evento · adjuntar COT/catálogo · "mandar al Centro de Tareas".
- **🎨 Patrón global "botón volver" (Fede 2026-07-18, sesión ficha caso):** los "← Volver/← Bandeja" de texto pelado son fuleros y desplazan el título — reemplazar por **botoncito circular prolijo** (chevron en círculo ghost, 30px, borde `#2a2a2a`) en TODAS las fichas/paneles de la app (proyecto-detalle, eventos, compras, CRM, etc.). Barrido dedicado corto; el diseño quedó definido en los mockups de la ficha caso v3.
- **🧠 CEREBRO MEPEX (idea grande de Fede 2026-07-18 — registrar y madurar):** historial escrito por IA de cada proyecto al cerrarse (resumen de todo lo que pasó: cómo se habló con el cliente, proceso, números, aprendizajes) → **memoria organizacional consultable** que aprende el método MEPEX. Piezas que YA existen: resumen IA por caso (diseño ficha v3) + migración caso→proyecto al Ganar + cerebro OCTEXA (repo propio) + todo el proceso codificado en el sistema. Camino barato: (1) hook de cierre de proyecto → retrospectiva IA guardada en DB; (2) corpus consultable ("cerebro mayor"); (3) alimenta respuestas sugeridas del CRM / estimaciones / onboarding; (4) a futuro, agentes autónomos con humano en el loop. SIEMPRE con humanos decidiendo.
- **Triage de la ronda** → arreglar lo que el equipo cace → pulido dirigido con criterio real.
- **Finanzas restantes:** Fase 5 conciliación bancaria CSV (Galicia/MercadoPago) · ~~**3b.2** switch `compras.js` a proveedor UUID~~ ✅ **HECHO 2026-07-18** (commit `d94d8b7`, api v84 · compras v18: fuente única `proveedor` UUID + helpers de traza para datos viejos + backfill aplicado en prod [0 filas sin uuid] + `_recomputeOCGanadora` propaga uuid + auto-migración inversa borrada + review adversarial aplicado; **✅ VERIFICADO EN PROD 2026-07-18 post-pull** [v84/v18 servidas · 0 huérfanos · 143 proveedores renderizando · ficha+historial `.or()` OK · selected del combo OK · 0 errores consola]; DROP de `compras_proveedores`/`compras_pagos` legacy queda para después de unas semanas de uso OK, destructivo, confirmar) · remito simple (a charlar — pisa con el remito de Transporte) · retiro legacy de `cargas` (destructivo, confirmar) · bloqueo de asientos retroactivos por período (opcional) · activación real 2027 (cargar saldos + RPC = tarea de Fede).
- **Deudas globales Finanzas** (hermanadas, cerrar juntas): ~~fix IVA asiento egreso~~ ✅ (Fase 2, verificado) · ~~anular no revierte~~ ✅ (contra-asiento verificado) · auditoría de integridad periódica (ya hay preview ✅ 2026-06-21, repetir post-uso-real).
- **Notificaciones — opcional #7** egresos-alerta (descartado por ruidoso, retomar solo si Fede lo pide).

### 🟣 OCTEXA (el plan grande — su propio repo, a tu ritmo)
- **Pilar 2 primero** (camino más corto al valor): Fede pasa la ruta del archivo histórico + 5-10 nombres de carpeta reales → dry-run (CSV de migración, no toca nada) → revisión juntos → migración → **Prediseñados filtrable por medida**.
- **Datos del cerebro** (entrevistas cortas T1-T3): catálogo blando (luces/vidrios/puertas/tarima) · Maxima cuando haya material · precios al final.
- **Infra backup 3-2-1** (restic + Backblaze + pg_dump del VPS) — definido, sin ejecutar. **ANTES de mover el archivo histórico.**

### ⛔ Bloqueados por terceros (no gastar energía acá)
- **Gmail E2:** esperando al partner iPlan (política org GCP). No meter tarjeta. *(Fede habla con iPlan.)*
- **Fase 10 remate UI/UX:** al final de todo, decisión ya tomada.

### 🔒 Opcionales de seguridad (solo si Jordi los pide)
MFA obligatorio para admin + gate AAL2 en finanzas · sacar `'unsafe-eval'` de la CSP (probar PDFs+charts con consola) · PARTE 4 RLS (PII de RRHH por `fn_role_can`) · cerrar `catalogo_items` a anon si el cotizador no la usa · validar JSON del LLM contra schema en backend · budget cap en console.anthropic.com.

---

## 📣 Marketing — hacer de MEPEX una máquina de demanda
El sistema optimiza la OPERACIÓN; la DEMANDA es otra máquina. Idea de Fede: atacar **por evento**,
ofrecer **prediseñados a precio de entrada** vía CRM + generador de propuestas + PDF comercial →
si pican, upsell a personalizado. Simple, un loop, un evento a la vez. Plan ejecutable: **`docs/PLAN-MARKETING.md`**.

**+ Base de clientes = el combustible.** Radiografía real: 265 clientes, ~15% contactables — es el cuello.
Protocolo completo: **`docs/PLAN-BASE-CLIENTES.md`** (peinar → rescatar → dedup → validar → enriquecer →
segmentar → mailing con subdominio+DKIM vía Brevo/listmonk → atacar por evento → el CRM enriquece con el uso).
**Ya construido y con SQL en prod:** importador CSV (`importar-contactos.js`, dedup email→CUIT→tel→nombre,
completa sin pisar) + campos nuevos + vista "salud de la base" (KPIs en CRM→Clientes).
**⏸ ESPERA ARCHIVOS/INFO DE FEDE** (export Google Contacts/WhatsApp, facturas/CUIT, listas de feria) →
probar importador con data real → segmentador/export (definir ejes + destino Brevo/listmonk) →
auto-enriquecimiento → validación email/tel. La peinada automática espera Gmail E2 (iPlan).

---

## 🎯 Orden recomendado (actualizado 2026-07-17)
**Semana del 20/07 (ventana Jordi): WhatsApp sesión con celu (mar/mié) → MDs de Jordi + 3 plugins (sesión aparte, prompt listo) → PostHog (cuenta de Fede) → query notif + circuito gastos + MFA equipo (cierres de 10 min).**
Después: **CSV de Meli → ronda de testeo (¿27/07 o agosto?) → triage → Bandeja visual (pulir-pantallas con mockups) → OCTEXA Pilar 2 en paralelo.**
Gmail sigue en la heladera hasta que iPlan destrabe. Marketing/base arranca cuando Fede junte los archivos.
