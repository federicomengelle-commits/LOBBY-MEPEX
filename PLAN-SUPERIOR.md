# 🚀 PLAN SUPERIOR — LOBBY MEPEX

> **Fuente de verdad de lo que FALTA.** Nace del "Project Scope & Missing Pieces".
> Reemplaza a `PLAN-MAESTRO-rediseno-lobby.md` (**CONGELADO** — archivo histórico del rediseño).
> El registro de lo HECHO sigue en `PROGRESO.md` (ETAPA II, entradas `[E2]` al día hasta 2026-07-22).
> Última consolidación: **2026-07-22 (revisada integral con Fede)** — se verificó ítem por ítem contra prod,
> se movió TODO lo cerrado a PROGRESO y este archivo quedó solo con pendientes REALES.

## 📐 Premisa de tracking (máxima)
- **PLAN SUPERIOR** (este archivo) = todo lo que falta, ordenado por prioridad. Se **descuenta** acá a medida que se cierra (lo cerrado se registra al detalle en PROGRESO y se PODA de acá — nada se pierde, se muda).
- **PROGRESO.md — ETAPA II** = el registro al detalle de lo hecho, entradas `[E2]`.
- **PLAN-MAESTRO-rediseno-lobby.md** = CONGELADO. No seguirlo; referencia histórica.
- Se mantiene el registro de **TODAS las ideas al detalle** (premisa de Fede).

---

## 🗺️ Los 5 frentes (estado 2026-07-22)
1. **Rediseño LOBBY — ≈92%, construcción CERRADA.** Cero deudas de schema/deploy (ver verificación abajo). Lo que queda lo dicta la ronda de testeo del equipo.
2. **Consultoría Jordi — track técnico COMPLETO** (seguridad 39/40 · subagentes reviewers · plugins · PostHog). Queda: aprovechar la ventana para cerrar WhatsApp y mostrar el sistema redondo.
3. **CRM → máquina de demanda.** El CRM está terminado como producto (ficha v4 + copiloto + resumen IA incremental). Le falta el COMBUSTIBLE: WhatsApp conectado (semana entrante, sí o sí) + Gmail (iPlan, llamada lunes/martes) + base de clientes sana (archivos de Fede).
4. **OCTEXA** (repo propio `APPS ANTIGRAVITY\OCTEXA-API`, no cuenta en el % del lobby). Cerebro ~93% · Pilar 2 espera ruta del archivo histórico · backup 3-2-1 ANTES de mover nada.
5. **Cotizador** (app aparte, misma Supabase). Integración pendiente: importador 3ds Max→BOM (espera 1 CSV de Meli) + leer `cotizacion_items` estructurada en vez de parsear PDF.

---

## ✅ Verificación integral de deudas — 2026-07-22 (para NO re-dudar)
Se auditó contra prod (REST + curl) todo lo que figuraba como "⛔/⏳ pendiente de Fede" en memorias y sesiones viejas. **Resultado: CERO SQL, cero bucket, cero pull pendiente.** Constancia:

| Qué | Estado verificado |
|---|---|
| Front en prod | `crm.js?v=40` / `api.js?v=87` / `posthog-init.js?v=2` servidas (todo pulleado) |
| `wa_eventos` (WhatsApp staging) | ✅ tabla en prod — para la sesión celu solo falta el deploy VPS del runbook |
| `eventos_link_organizador` + `eventos_jornal_sync` | ✅ corridos (`link_url`/`organizador_id`/`es_organizador`/`jornal_diario` existen) |
| `proyecto_conformes` + `stands_predisenos` + `catalogo_showroom_f1` + `fase7` (`saldos_apertura`) | ✅ corridos |
| Buckets `proyecto-fotos` / `stands` / `comprobantes` / `catalogo` / `remitos` | ✅ existen (stands y comprobantes con contenido = features en uso; download anon bloqueado) |
| RLS `evento_documentos`/`evento_historial` | ✅ anon no ve nada (la memoria `project_fase4_rls_docs_historial` estaba desactualizada) |
| UI jornal en RRHH | ✅ FALSO pendiente — campo "Jornal diario" = `personas.costo_dia_referencial`, ya editable en Nómina |
| Circuito gastos de evento · 3b.2 proveedores UUID · triggers notif | ✅ verificados en prod 18/07 |

Únicos SQL sin correr **a propósito** (destructivos, diferidos con decisión): `reorg_cleanup.sql` PARTE 2 (DROP legacy) · DROP `compras_proveedores`/`compras_pagos` · retiro legacy `cargas`. Ver "Decisiones".

---

## ⏳ LO QUE FALTA — lo real, ordenado

### 🔴 ESTA SEMANA / LA ENTRANTE — compromisos con fecha (Fede 2026-07-22)
1. **WhatsApp E4 — sesión "con celu" · SÍ O SÍ semana del 27/07.** Fede se trae el celu de la oficina un día y lo devuelve al otro; en el medio lo dejamos conectado y andando. Todo listo: runbook `docs/whatsapp-coexistence-runbook.md` (deploy webhook VPS + `WA_VERIFY_TOKEN` → app Meta + App Secret → Business Verification con constancia AFIP → conectar número → smoke contra `wa_eventos`). Traer: celu con WhatsApp Business App ≥2.24.17 + constancia AFIP + 30-45 min.
2. **iPlan (destraba Gmail E2) — Fede llama lunes 28 o martes 29, desde casa.** Pedido concreto al partner: destrabar la política org de GCP para poder crear un proyecto con **Gmail API + service account con domain-wide delegation** (`gmail.readonly`). Sin tarjeta. Al destrabarse: ingesta de mails al timeline del CRM + peinada automática de la base de clientes.

### 🔨 PRÓXIMO LABURO GRANDE (mío) — E4 fase 2: el CRM se vuelve chat real
Apenas el número quede conectado (sesión celu), los WhatsApp entrantes empiezan a caer CRUDOS en la tabla `wa_eventos`. La fase 2 los convierte en el CRM vivo:
- **Procesador `wa_eventos` → timeline:** cada mensaje entrante se matchea con el cliente por teléfono (ojo columnas rotadas de `clientes`) y aparece solo en el hilo del caso (`crm_mensajes`) — chau pegado manual.
- **Envío real desde el composer:** el botón WhatsApp deja de abrir `wa.me` y manda por la Cloud API. El punto de enchufe ya quedó hecho en la ficha v4 — sin rediseño.
- Se diseña juntos post-conexión (matcheo, casos nuevos automáticos vs bandeja de no-matcheados, etc.).

### 🟠 Cortos de Fede (van saliendo cuando pinte)
- **MFA en Lelean y Sofi** (5 min c/u, Mi Perfil → Seguridad; red de seguridad: Dashboard → Users → quitar factor).
- **CSV de 3ds Max — hablar con Meli** para que exporte uno de prueba → fijamos formato → cierro el importador (`importar-3dsmax.js` ya construido y testeado 24/24).
- **ARCA oportunista:** 1ª Factura A real con 2 alícuotas (21+10,5) → mirar el PDF → confirmar `_EMISOR` y sacar el `⚠️ verificar` de `finanzas.js`.
- **Archivos de la base de clientes** (ver sección Marketing abajo — es EL combustible).
- **Carga de datos operativa:** jornal diario por persona en RRHH → Nómina (campo ya existe; sin el valor, el "Traer de asignaciones" de Rendimiento trae $0). La puede hacer Lelean.
- **Session Replay de PostHog** (opcional, 2 min): activarlo en PostHog Settings cuando quieras ver sesiones grabadas — el código ya lo banca.

### 🗓️ Decisiones pendientes (solo Fede)
- **Fecha de la ronda de testeo del equipo.** Kit 100% listo en `docs/testeo/` (instructivos por rol + WhatsApps + PDFs + `qa-precheck.md`); largarla = mandar los WhatsApp + crear el grupo. **Sugerencia:** semana del **03/08**, ya con WhatsApp conectado al CRM (la sesión celu es la semana anterior).
- **claude-mem:** el piloto de 1 semana vence ~25/07. ¿Sigue o se apaga en LOBBY? (`"enabledPlugins": {"claude-mem@thedotmack": false}` en `.claude/settings.local.json` si molesta).
- **DROPs destructivos diferidos** (cuando haya semanas de uso sin ruido — sugerencia: post-ronda): DROP `compras_proveedores`/`compras_pagos` legacy · retiro legacy de `cargas` · `reorg_cleanup.sql` PARTE 1 (limpieza `roles.permissions`) y PARTE 2 (DROP tablas reorg).

### 🟡 Backlog técnico a demanda (mío, sin fecha)
- **Finanzas Fase 5 — conciliación bancaria CSV** (Galicia/MercadoPago): la última pata gorda de Finanzas. Matching automático extracto↔movimientos (hoy es manual).
- **Triage de la ronda de testeo** → arreglar lo que el equipo cace → pulido dirigido con criterio real.
- **🧠 CEREBRO MEPEX** (idea grande de Fede, registrada 2026-07-18 — madurar): historial IA de cada proyecto al cerrarse → memoria organizacional consultable que aprende el método MEPEX. Piezas que ya existen: resumen IA por caso + migración caso→proyecto + cerebro OCTEXA. Camino: (1) hook de cierre → retrospectiva IA en DB; (2) corpus consultable; (3) alimenta respuestas del CRM/estimaciones/onboarding; (4) agentes con humano en el loop. SIEMPRE humanos decidiendo.
- **Remito simple** (proyecto/evento sin flujo de cargas) — a charlar: pisa con el remito de Transporte.
- **Auditoría de integridad contable periódica** (preview ya validada 2026-06-21) — repetir post-uso-real.
- **Aire lateral global** — falta SOLO validación visual de Fede (ya está en prod).
- **Conforme de devolución** (v2 del conforme de entrega — el `tipo` ya lo soporta).
- **Pulido Eventos restante:** editar jornadas · modal transporte legacy · docs (menor, entra en el pulido post-ronda).
- **Cotizador → leer `cotizacion_items` estructurada** en el lobby (en vez de parsear el texto del PDF) — cuando el refactor del cotizador se asiente.
- **Notificaciones #7 egresos-alerta** — descartada por ruidosa; retomar solo si Fede la pide.
- **Activación real Finanzas 2027** (enero): cargar saldos de apertura + bloquear ejercicio (pantalla + RPC ya en prod, en pausa a propósito).

### 🟣 OCTEXA (el plan grande — su propio repo, a tu ritmo)
- **Pilar 2 primero** (camino más corto al valor): Fede pasa la ruta del archivo histórico + 5-10 nombres de carpeta reales → dry-run (CSV de migración, no toca nada) → revisión juntos → migración → **Prediseñados filtrable por medida**.
- **Datos del cerebro** (entrevistas cortas T1-T3): catálogo blando (luces/vidrios/puertas/tarima) · Maxima cuando haya material · precios al final.
- **Infra backup 3-2-1** (restic + Backblaze + pg_dump del VPS) — definido, sin ejecutar. **ANTES de mover el archivo histórico.**

### ⛔ Bloqueados por terceros
- **Gmail E2** — pasa a "en curso" con la llamada a iPlan (ver 🔴 #2). Hasta el OK: no meter tarjeta, no gastar energía.
- **Fase 10 remate UI/UX** — al final de todo, decisión ya tomada.

### 🔒 Opcionales de seguridad (solo si Jordi los pide)
MFA obligatorio para admin + gate AAL2 en finanzas · sacar `'unsafe-eval'` de la CSP (probar PDFs+charts con consola) · PARTE 4 RLS (PII de RRHH por `fn_role_can`) · cerrar `catalogo_items` a anon si el cotizador no la usa · validar JSON del LLM contra schema en backend · budget cap en console.anthropic.com · (nuevo 22/07, cosmético) policies de LIST en Storage: anon puede listar NOMBRES de carpetas de buckets privados — el download está bloqueado, riesgo casi nulo.

---

## 📣 Marketing — hacer de MEPEX una máquina de demanda (el NORTE del frente CRM)
**La idea en una línea:** el sistema ya optimiza la OPERACIÓN; ahora hay que fabricar DEMANDA — atacar **evento por evento**, ofreciendo **stands prediseñados a precio de entrada** por mailing/WhatsApp a los expositores, y si pican, upsell a personalizado. Un loop simple, un evento a la vez. Plan ejecutable: `docs/PLAN-MARKETING.md`.

**Por qué todavía no arranca: falta el combustible = la base de clientes.** Radiografía real: 265 clientes y solo ~15% con datos de contacto útiles. El plan de rescate (`docs/PLAN-BASE-CLIENTES.md`): peinar → rescatar → dedup → validar → enriquecer → segmentar → mailing (subdominio+DKIM vía Brevo/listmonk) → atacar por evento.

**Lo que ya está construido y esperando:** importador CSV (`importar-contactos.js`: dedup email→CUIT→tel→nombre, completa sin pisar) + campos nuevos en prod + vista "salud de la base" (KPIs en CRM→Clientes).

**Lo único que falta para arrancar — ARCHIVOS DE FEDE:** export de Google Contacts, agenda de WhatsApp, listas de expositores de ferias, facturas con CUIT — lo que haya. Me los pasás y los importo con data real. La peinada AUTOMÁTICA (leer el Gmail para completar contactos) espera iPlan.

---

## 🎯 Orden recomendado (actualizado 2026-07-22, revisada con Fede)
**Semana del 27/07: iPlan (lunes/martes, desde casa) + WhatsApp sesión con celu (sí o sí, 2 días seguidos) → E4 fase 2 conmigo (procesador + envío real) → MFA Lelean/Sofi.**
**Semana del 03/08 (sugerida): largar la ronda de testeo** con WhatsApp ya conectado → triage → pulido dirigido.
En paralelo cuando pinte: CSV de Meli · archivos de la base → marketing arranca · OCTEXA Pilar 2.
~25/07: decidir claude-mem. Post-ronda: decidir DROPs destructivos.
