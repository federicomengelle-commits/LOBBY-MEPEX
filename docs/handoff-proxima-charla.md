# HANDOFF — próxima charla (PASO A PASO · cola de ejecución)

> Escrito **2026-06-30b** al cerrar la sesión larga de **Eventos**. Autocontenido para
> arrancar una charla nueva y meter los pendientes **EN FILA**, uno tras otro, sin re-descubrir.
> La charla anterior quedó muy cargada de contexto → esta es la continuación limpia.

---

## 0. Arranque (SIEMPRE, antes de tocar nada)
1. **Pull:** preguntar a Fede si hago `git fetch origin && git reset --hard origin/main` (árbol compartido con otras charlas — sincronizar primero).
2. **Leer** en este orden: este handoff → `CLAUDE.md` §10 → `PROGRESO.md` (tope) → `PLAN-MAESTRO-rediseno-lobby.md` (tope) → la memoria del tema (`memory/`).
3. **Push directo a `main`** (`git push origin HEAD:main`), sin PRs. Fede hace `~/pull-lobby.sh` en el VPS.
4. **SQL-first:** si hay DDL, Fede corre el SQL en Supabase ANTES del pull.
5. **Árbol compartido:** `git add` SOLO lo propio + **bumpear `?v=`** del JS que toques.
6. **Verificar:** `node --check` + preview propio (`preview_start`). Se puede testear en vivo con **Chrome MCP** contra el VPS logueado (`http://195.200.1.250`, Fede suele estar logueado) o contra el preview local. **OJO:** screenshots y render de PDF/SVG **cuelgan headless** → validar por estado/posiciones (`preview_eval`/`javascript_tool`) + mockups `show_widget`; el OK visual final lo da Fede tras pull. **Truco preview:** el modal de la app abre con `opacity:0` (animación) en inyección por JS → forzar `overlay.style.opacity='1'` para screenshotear. Escrituras de prueba en prod → **siempre con cleanup**.

## 1. Estado al cierre (2026-06-30b)
- **Módulo Eventos = pulido y CERRADO.** Un solo modal de alta de gente (día-aware + look pulido: checkboxes de días + lista con chips/WhatsApp/búsqueda/multi-select + preset **"⧉ Traer los del armado"**); crear/editar-asignación/transporte pulidos; fin del `window.prompt` nativo; "Hasta" se auto-posiciona al elegir "Desde"; fix de taxonomía de fase (`evento`↔`funcionamiento`). Se borró el modal duplicado muerto + sección "Equipo asignado" (−420 líneas).
- **Último pull servido:** `eventos.js?v=37` + `api.js?v=67`. `HEAD == origin/main == c44f523`.
- **PROGRESO ≈90% · PLAN ≈9%.**
- Los 3 SQL del 2026-06-30 (`eventos_link_organizador`, `eventos_jornal_sync`, rendimiento) **confirmados corridos en prod**. `personas.jornal_diario` YA existe.
- Detalle canónico: `CLAUDE.md` §10 + memoria `project_eventos_jornadas_rendimiento`.

---

## 2. COLA — paso a paso (ejecutar en este orden)

### ⭐ PASO 1 — RRHH: UI para cargar `personas.jornal_diario` (tarifa por persona)
- **Por qué (el #1):** sin tarifa por persona, el puente jornadas→Rendimiento ("🔄 Traer de asignaciones") trae los jornales en **$0**. Con esto, el circuito **Eventos → Rendimiento da plata real**. Es lo que cierra el loop del feature del 2026-06-30.
- **Sin SQL:** la columna `personas.jornal_diario NUMERIC(15,2) DEFAULT 0` **ya existe en prod** (verificado). Es SOLO UI.
- **Qué hacer:** en `rrhh.js`, tab **Nómina** (edita `personas`), agregar un campo numérico **"Jornal diario"** (formato es-AR, `$`) en el form/panel de edición de la persona → guarda en `personas.jornal_diario`. Mostrarlo también en la tabla/ficha de Nómina. (RRHH ya lee/escribe `personas` con compat `_mapPersonaToLegacyShape` — seguir ese patrón.)
- **Decisión ya LOCKEADA (preset + editable):** este `jornal_diario` es la **tarifa preset** por persona; el puente la usa como `evento_costos.tarifa` al crear la línea, y en Rendimiento queda **editable inline por evento** (`evento_costos.tarifa`/`monto_editado` ya lo soportan). No hace falta re-preguntar.
- **Verificar (con cleanup):** cargar una tarifa a una persona en RRHH → en un evento con esa persona asignada a jornadas, Rendimiento → "🔄 Traer de asignaciones" → el jornal sale con **tarifa × días** (no $0). Borrar la prueba.
- **Entrada:** `rrhh.js` · memoria `project_eventos_jornadas_rendimiento` · `docs/modulo-rrhh-v2-blueprint.md`.

### PASO 2 — Decisión + (opcional) auto-sync del puente
- **Preguntar a Fede (1 sola):** ¿el puente jornadas→Rendimiento se dispara **automático** (al asignar/quitar gente en Eventos) o queda el **botón manual** "Traer de asignaciones"?
  - Si **auto:** llamar `API.syncJornalesEvento(eventoId)` tras guardar en el modal de alta de gente (`_openAsignarJornadaModal` save) + tras quitar gente (`.ev-jc-del` en `_attachJornadasViewEvents`). Bajo riesgo (idempotente, preserva tarifas editadas y filas con pago).
  - Si **manual:** no tocar nada (ya está el botón en Rendimiento).

### PASO 3 — Eventos: modales chicos que quedaron (opcional)
- Los únicos sin pulir: **Docs/Seguro** (modal "Agregar documento/seguro") y **Encuesta** (`_openEncuestaModal`). Chicos y funcionales; pulir al idioma de los otros (clases scopeadas, sin `style=` inline). Método: skill **`pulir-pantallas`** (mostrar render real → indicación de Fede → aplicar). Preguntar a Fede si los quiere pulir o los dejamos.

### PASO 4 — Resto del catálogo `pulir-pantallas`
- Otros módulos a pulir (preguntar a Fede cuál sigue: Inventario / Compras / Locaciones / CRM Bandeja visual / etc.). Skill `pulir-pantallas`. Tokens de marca + método en `.claude/skills/pulir-pantallas/` (memoria `feedback_skill_pulir_pantallas`).

---

## 3. Más adelante (NO ahora — decisión explícita de Fede 2026-06-30b)
- **CRM E2 Gmail + E4 WhatsApp (APIs):** diferido. E2 ⛔ bloqueado por política de org GCP (espera al partner iPlan; NO meter tarjeta, Gmail API es gratis). E4 necesita sesión "con el celu" (WhatsApp Coexistence). Memorias `project_gmail_api_gcp_blocker`, `project_whatsapp_meta_coexistence`.
- **Importador 3ds Max (CSV→BOM):** diferido — falta que Fede pase **1 CSV de ejemplo real**. Memoria `feedback_compositor_vs_3dsmax` + `project_stands_predisenos`.
- **Cierres/verificaciones sueltas** (cuando toque): C **CRM Bandeja v2** (correr `sql/crm_bandeja_v2.sql` + verificar en prod: snooze/línea/semi-auto/audit) · D **ARCA** (1 emisión real **A con 2 alícuotas** + confirmar `_EMISOR`) · E **Finanzas** fase siguiente (`docs/finanzas-contabilidad-refactor-PLAN-EJECUCION.md`) · F **RRHH v2** completo (`docs/modulo-rrhh-v2-blueprint.md` — el PASO 1 de arriba es un adelanto de RRHH.5).

---

## 4. Fuentes de verdad
- `PROGRESO.md` (hecho + %) · `PLAN-MAESTRO-rediseno-lobby.md` (falta + % + "en fila") · `CLAUDE.md` §10 (log canónico por sesión) · `memory/MEMORY.md` + memorias temáticas (`project_*`, `feedback_*`).
- El **`SUPERPLAN-octexa.md`** es del track **OCTEXA** (paralelo) — no entra en el % del rediseño ni en esta cola.

## 5. Prompt para arrancar la charla nueva (copiar/pegar)

```
Trabajamos en LOBBY-MEPEX (C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX). Antes de tocar nada:
1) Preguntame si hago `git fetch origin && git reset --hard origin/main` (árbol compartido — sincronizar primero).
2) Leé: docs/handoff-proxima-charla.md (el paso a paso), después CLAUDE.md §10, PROGRESO.md y PLAN-MAESTRO-rediseno-lobby.md (topes), + la memoria del tema.

Arrancá con el PASO 1 (RRHH: campo "Jornal diario" en la Nómina, sin SQL, para que el puente a Rendimiento dé montos reales) y seguí la cola en fila (PASO 2, 3, 4). Mostrame cada paso antes de encadenar el siguiente.

Protocolo: SQL-first si hay DDL (yo corro el SQL antes de pullear); push directo a main (git push origin HEAD:main), no PRs; git add SOLO lo tuyo + bumpear ?v=; verificá en preview/Chrome lo que se pueda (screenshots y PDF/SVG cuelgan headless → validá por estado/posiciones + show_widget; el OK visual final lo doy yo tras pull). Escrituras de prueba en prod con cleanup. Mínimos tokens, certero.

NO todavía: APIs (Gmail/WhatsApp) ni el CSV de 3ds Max.
```
