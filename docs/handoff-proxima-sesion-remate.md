# HANDOFF PRO — Próxima sesión: REMATE de LOBBY-MEPEX (rediseño visual + lo que falta)

> **Arranque (pegar tal cual en la sesión nueva):**
> *"Leé `docs/handoff-proxima-sesion-remate.md` y arranquemos el remate con el método **prediseño → mostrar → validar → aplicar** (skill `pulir-pantallas`). Antes de codear: traés el render REAL, me mostrás un mockup con `show_widget`, yo valido, y recién ahí aplicás. Empecemos por **\<módulo\>**."*
>
> **Foto:** 2026-06-26. Branch `rediseno` == `origin/main` @ **`afb02fb`**. **PROGRESO ≈88% · PLAN ≈12%.**
> **Lo que queda ya casi no es lógica — es REMATE visual + un puñado de features chicas.** El objetivo de Fede: *"dejarlo prácticamente listo."*

---

## 0. EL MÉTODO — prediseño → mostrar → validar → aplicar  *(lo que pidió Fede)*

> Es la skill **`pulir-pantallas`** (vive en `.claude/skills/`, local/gitignored — Claude Code la detecta sola). Esto es el resumen operativo; la skill tiene el detalle + el catálogo vivo.

**El loop, pantalla por pantalla (un subtab concreto, NO "todo el módulo"):**
1. **Traé el render REAL** de la app vía `preview_eval` (extraé el `innerHTML` del subtab o llamá al builder directo). **NUNCA inventes un mockup a mano** — la lección más cara: un mockup trucho con logo dibujado a mano = Fede lo detesta. Logo/colores/estructura = los de verdad.
2. **Mostrá con `show_widget`** el estado actual y/o **una** propuesta concreta, en estilo MEPEX dark fiel (tokens §2). Una dirección clara, no 5 variantes.
3. **Fede da una indicación destilada** (corta: "el logo más a la izquierda", "sacá ese KPI", "no tanto número abultado"). Iterá el mockup **hasta el OK**. **No toques código hasta el OK.**
4. **Aplicá al código**: CSS + estructura/markup. **NO toques la lógica de datos ni las queries** salvo que el cambio lo pida. Reusá clases existentes; CSS nuevo **scopeado** (prefijo del módulo, ej. `.fin-…`, `.pjd-…`) para no pisar estilos compartidos.
5. **Verificá en preview por `preview_eval`** (render OK, 0 errores de consola, computed styles). ⚠️ Los **screenshots y el render de PDF cuelgan el headless** → verificá por eval, nunca por captura.
6. **Bump `?v=N`** del JS en `index.html` + `node --check` + **commit** (`git add` SOLO los archivos propios — árbol compartido) + `git push origin HEAD:main`.
7. **Avanzá** al siguiente subtab. Al cierre: PROGRESO / PLAN-MAESTRO / CLAUDE.md §10 + tildar el catálogo de la skill.

**No hacer:** rediseñar todo un módulo de una · meter KPIs/montos de más (Fede recorta) · tocar lógica al cambiar look · pisar CSS global · aplicar sin OK del mockup · confiar en screenshots.

---

## 1. ⛔ ANTES DE ARRANCAR — acciones de Fede pendientes (de esta sesión)

1. **SQL-FIRST (conforme de recepción):** correr **`sql/proyecto_conformes.sql`** en Supabase. Sin eso, el tab "Entrega" de la ficha del Proyecto abre vacío y "guardar" falla.
2. **Pull** (`~/pull-lobby.sh`) — trae todo lo de hoy:
   - **Subalquileres** por proveedor (ficha del Evento): `eventos.js?v=26` + `pedido-pdf.js?v=2`.
   - **Conforme de recepción** (ficha del Proyecto): `api.js?v=62` · `proyecto-detalle.js?v=9` · `conforme-pdf.js?v=1`.
3. **Verificar en prod** (con cleanup):
   - Subalq → evento **"Estetica"**: debe listar **BXH/Parodi 18× Alfombra · Stand EGEO 2** + bloque "sin proveedor" (TV 55"); probar "PDF de pedido", "Generar todos" y el toggle Por proveedor / Por stand.
   - Conforme → un stand → tab **Entrega** → "Nuevo conforme" → tildar ítems → **firmar en el canvas** → guardar → baja el **acta PDF** con la firma.
4. *(Pendiente viejo, si no lo hizo:)* el importador de cotización necesita pull+verify + chequear RLS de INSERT en `cotizacion_items` (es lo que puebla los ítems de subalq/conforme).

---

## 2. TOKENS DE MARCA MEPEX  *(para que los mockups sean fieles)*

- Fondo app `#050505` · cards `#111` · inputs `#0f0f0f` · bordes `#2a2a2a` · texto `#e8e8e8` / muted `#888` / dim `#555`.
- **Turquesa primario `#00A9C1`** (acentos, acciones, foco). Naranja `#F28D15` (MODERADO). Éxito `#00CC88` · error `#ff4444` · azul `#4A90D9` · violeta `#9B7DFF`.
- Tipografía: **Outfit** (UI/títulos) · **Space Mono** (montos, números, labels). **Montos SIEMPRE en mono, es-AR** (`$2.179.000`).
- Dark theme SIEMPRE · glow sutil en hover · bordes 4–10px.
- **Patrón macro info/acción** (memoria `feedback_ui_separar_info_acciones`): en barras de tabs, separar VER/consultar de CREAR/hacer; acciones con acento turquesa.
- **Simple > abultado** (preferencia firme de Fede): pocos KPIs, preferir cantidades/promedios/tendencias antes que totales gigantes. *"Tiene que ser simple, figuran los datos y listo."*

---

## 3. EL RESTO — dos tracks

### 🅰️ TRACK A — REMATE VISUAL (el grueso de lo que pidió Fede: prediseño → validar → aplicar)

Recorrer por módulo, **subtab por subtab**, con el loop §0. Catálogo (✅ = ya pulido):

| Módulo | Estado del pulido | Notas |
|---|---|---|
| **Finanzas** › Facturación | ✅ COMPLETO | Emitidos/Recibidos/Emitir/Recurrentes (referencia de estilo: helpers `_renderFactKPIs`, `_estadoDotComp`, `.fin-fact-kpi*`). |
| **Finanzas** › resto | ⏳ | Dashboard · Ingresos · Egresos · Cuentas · Valores · Conciliación · Calendario · Reportes. |
| **Eventos** | ✅ tabla/cards/ficha | Pendiente: **modales** (crear/editar evento, asignar gente) + filas finas en Transporte/Docs. *(La sección Subalquileres nueva ya está en estilo MEPEX.)* |
| **Proyectos** | ⏳ **(siguiente sugerido)** | `proyectos.js` (lista) + `proyecto-detalle.js` (tabs: Resumen·Producción·Archivos·Novedades·**Entrega**[nuevo]·Cotización·Actividad). Análisis previo (en PLAN): dos estados conviven confusos, "barra de pendiente" = badge Ciclo del Taller, Actividad a rediseñar, quizá sobra una pestaña. |
| **CRM** › Bandeja | ⏳ | Rework SOLO visual ("que se lea sola") + **bug: colores de temperatura** (ver Track B 1a). |
| **Contabilidad** · **Costos** · **Calendario op.** · **Inventario/Catálogo** · **Compras** · **RRHH** · **Rendimiento** · **Lobby/Home** · **Admin/Settings** | ⏳ | Recorrer con el loop. |

**Orden sugerido:** Proyectos (ya tiene análisis hecho + tab nuevo) → CRM Bandeja → Finanzas (Dashboard/Ingresos/Egresos) → el resto. *(Fede manda el orden; este es el default.)*

### 🅱️ TRACK B — FEATURES construibles ya (no son visual; se pueden intercalar)

| # | Qué | Dónde | Notas |
|---|---|---|---|
| B-1a | **CRM colores de temperatura** (bug concreto) | `crm.js` | `_tempConfig` define `color` para hot/warm/cold pero el chip solo muestra el emoji. Aplicar el color (dot/borde). Rápido, alto impacto. |
| B-1b | **CRM link reverso** cotización→caso | `crm.js` | Hoy caso→cotización existe; falta el reverso. |
| B-1c | **CRM plan-de-cobro auto** al convertir caso→proyecto | `crm.js`/`api.js` | Sembrar `plan_cobro` al "Convertir a proyecto" (engancha Finanzas). |
| B-1d | **CRM auditoría de cambios** | `crm.js`/`api.js` | Registrar quién edita cliente / mueve pipeline → `audit_log`. |
| B-2 | **Facturación recurrente v2** | `finanzas.js` | Plantilla guardada (tabla `comprobantes_recurrentes`, **DDL**). La v1 (re-emitir mes anterior) ya anda. |
| B-3 | **Cierres contables (Fase 8)** | `finanzas.js`/`compras.js` | 3b.2 switch Compras→proveedor UUID (pasada dedicada) · conciliación CSV (Galicia/MP) · cierre 2027 (saldos apertura + bloqueo). Medio-alto; **algunas piezas necesitan definiciones de Fede**. |
| B-4 | **Subalquileres: mail al proveedor** | `eventos.js` | Fase 2 — necesita infra de envío de mails (Brevo/listmonk). tel/email ya vienen en el backbone. |
| B-5 | **Conforme: firma de DEVOLUCIÓN** | `proyecto-detalle.js` | El `tipo` ya soporta `devolucion`; sumar el toggle (firmar "devolví todo en orden" al cierre). |

> **CRM completo** tiene handoff propio: `docs/handoff-CRM-completar-todo.md` (no duplicar).

### 🔴 BLOQUEADOS por infra externa (no es código)
- **Gmail al CRM (E2)** → lo destraba el **partner iPlan** (consola GCP de la org). NO meter tarjeta (es gratis). Memoria `project_gmail_api_gcp_blocker`.
- **WhatsApp al CRM (E4)** → **sesión "con celu"** (~30 min): vincular QR (Coexistence) + verificar negocio + webhook VPS. Memoria `project_whatsapp_meta_coexistence`.

---

## 4. WORKFLOW + VERIFICACIÓN (no negociable)

- **Preview:** `.claude/launch.json` server "lobby" (estático, node). `preview_start` → `preview_eval` para verificar. **Nunca** screenshots/PDF (cuelgan el headless).
- **Git:** push directo a `main` → `git push origin HEAD:main` (estás en detached HEAD, es normal acá). Fede pullea con `~/pull-lobby.sh`. **Árbol COMPARTIDO** (sesiones en paralelo): `git add` SOLO tus archivos, NUNCA `git add -A`. Hoy quedaron untracked y ajenos: `docs/octexa/`, `docs/handoff-pulido-panel-receta-costos.md` → **no tocar**.
- **SQL-first** (memoria `feedback_orden_sql_push`): si hay DDL, escribir el `.sql`, que Fede lo corra **antes** de pullear el JS. Idempotente + RLS (calcar `sql/reorg_d_transporte.sql`). El schema real manda (`docs/schema-prod.md` / `information_schema`), no las migraciones viejas.
- **Autónomo por batches** (memoria `feedback_autonomous_batches`): en trabajo de bajo riesgo Fede prefiere que corras derecho y verifiques al final. Pero el **rediseño visual NO es autónomo** — es prediseño→mostrar→**validar con Fede**→aplicar. Las features de Track B sí pueden ir de corrido.
- **Cierre de sesión:** actualizar PROGRESO (hecho, %↑) · PLAN-MAESTRO (falta, %↓) · CLAUDE.md §10 · tildar catálogo de la skill.

---

## 5. PUNTEROS

- **Método/catálogo:** skill `pulir-pantallas` (`.claude/skills/pulir-pantallas/SKILL.md`).
- **Mapa general:** `docs/handoff-progreso-a-plan.md` (progreso→plan rankeado).
- **CRM:** `docs/handoff-CRM-completar-todo.md` + `docs/crm-casos-blueprint.md` §14.
- **Estado canónico:** `CLAUDE.md` §10 · `PROGRESO.md` · `PLAN-MAESTRO-rediseno-lobby.md`.
- **Memorias clave:** `feedback_skill_pulir_pantallas`, `feedback_ui_separar_info_acciones`, `feedback_autonomous_batches`, `feedback_orden_sql_push`, `feedback_git_workflow`, `rule_dos_archivos_porcentaje`.
- **Lo de hoy (referencia de estilo y patrón):** sección Subalquileres (`eventos.js` `_renderPanelSubalquileres`/`_renderSubalqBody`) · conforme con firma (`proyecto-detalle.js` tab Entrega + `_initSignaturePad`) · PDFs (`pedido-pdf.js`/`conforme-pdf.js`, branding MEPEX reusable).
