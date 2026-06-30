# HANDOFF — próxima charla (menú de pendientes para desarrollar)

> Escrito 2026-06-27 al cerrar la sesión del **compositor de stands**. Sirve para arrancar
> una charla nueva y elegir QUÉ desarrollar. Autocontenido: cada ítem dice qué es, en qué
> estado está, qué necesita y por dónde entrar (archivos / docs / memoria).

## ⭐ Fuentes de verdad del estado (leer SIEMPRE antes de tocar)
- **`PROGRESO.md`** — lo YA HECHO (≈89% del rediseño) + el **track OCTEXA/compositor** (sección "Compositor de stands"). Cada sesión vive ahí.
- **`PLAN-MAESTRO-rediseno-lobby.md`** — lo que FALTA (≈11%) por **Fases** + **§Ideas de mejora pendientes** + **§TRACKS PARALELOS** (ahí vive el Compositor + Importador 3ds Max + Diseño 3D).
- **`CLAUDE.md`** (raíz) — instrucciones del proyecto + **§10 Estado actual** (el log de sesiones, fuente canónica del día).
- **`memory/MEMORY.md`** + las memorias temáticas (`project_*`, `feedback_*`) — contexto/decisiones que NO están en el código.
- **Regla de los 2 archivos** (Fede): al cerrar una sesión, mover lo hecho de PLAN-MAESTRO → PROGRESO y **rebalancear los %**. Ideas futuras → al PLAN. (El compositor es track paralelo: NO entra en el % del rediseño.)

---

## 0. Reglas de arranque (SIEMPRE, cualquier charla)
1. **Pull primero:** preguntar a Fede si hago `git fetch origin && git reset --hard origin/main` (evita choques con charlas paralelas). Árbol compartido.
2. **Leer** `CLAUDE.md` (raíz) + los `.md` de `docs/` relevantes al módulo + la memoria del tema.
3. **Push directo a `main`** (`git push origin HEAD:main`), sin PRs. Fede hace `~/pull-lobby.sh` en el VPS.
4. **SQL-first:** si hay DDL, Fede corre el SQL en Supabase ANTES del pull (sino los INSERT con columnas nuevas rompen).
5. **Árbol compartido:** `git add` SOLO lo propio (otras charlas tocan `index.html`/`data.js`/docs en paralelo) + **bumpear `?v=`** del JS que toques.
6. **Schema real > SQL del repo:** ante la duda, `SELECT column_name FROM information_schema.columns WHERE table_name=...` antes de tocar tablas.
7. **Verificar:** `node --check` + smokes DOM-stub para lógica; para UI, preview propio (`preview_start`) + montar el módulo y manejarlo por `preview_eval`. **OJO:** los screenshots y el render de PDF (pdf.js) **cuelgan el headless** → no se pueden ver; validar por posiciones/estado + mockups `show_widget` (Fede los ve) + el OK visual de Fede tras pull.

---

## 1. Compositor de stands — CERRADO (no retomar salvo que Fede pida)
`#stands` → tab Compositor. `compositor.js?v=18` · `compositor-piezas.js?v=2` · `plano-pdf.js?v=9`. Todo verificado en preview (texto/alinear/agrupar/distribuir/módulos/infra-equip/PDF/etc., 0 errores). **Lo único que falta:**
- ⏳ **OK visual de Fede** del PDF real + la UI (Claude no puede ver el render).
- ⏳ **Parte A para que Guardar/Cotizar persista:** correr `sql/stands_predisenos.sql` (RLS `proyecto_componentes`) + crear bucket privado `stands`.
- Detalle: `docs/octexa/handoff-compositor-proxima-sesion.md` + memoria `project_stands_predisenos`. Próximo del compositor (cuando se retome): §2.4 plantillas base + brief.

---

## 2. MENÚ — qué desarrollar (priorizado por listo-para-atacar)

### A. ⭐ Eventos — pulido de la ficha *(pulir-pantallas, riesgo bajo, self-contained)*
Es el próximo del catálogo de "pulir-pantallas" (después de Proyectos). **Transporte ya quedó en filas finas** (`eventos.js?v=27`, commit `f938298`, 2026-06-29 — cards chunky → filas densas de 2 líneas); Docs/Seguros ya eran filas finas. **Falta: modales crear / editar / asignar** (mejor INTERACTIVO con vos por ser subjetivo). Método: skill `pulir-pantallas` (mostrar render real → indicación de Fede → aplicar en vivo). Entry: `eventos.js`, memoria `project_proyectos_refactor` (lista el pendiente), skill `pulir-pantallas`.

### B. ⭐ Importador desde 3ds Max *(stands — LA pieza que falta para crear prediseños de verdad)*
El diseñador modela en 3ds Max con las piezas codeadas; exporta un **CSV por MaxScript** (rubro·código·nombre·**cantidad**) → el importador lo parsea → match por `catalogo_items.codigo` → escribe `proyecto_componentes` + precio (Costos). **Mismo patrón que `importar-cotizacion.js`** (parse → match → filas). **Necesita:** que Fede pase **1 CSV de ejemplo real** para fijar las columnas exactas. Datos ya confirmados por Fede: todos los códigos matchean `catalogo_items.codigo`, el CSV trae cantidades. Entry: memorias `feedback_compositor_vs_3dsmax` + `project_stands_predisenos`.

### C. CRM Bandeja v2 — cerrar *(verificación, NO dev; ⛔ SQL-first)*
Construido + verificado en preview; falta **correr `sql/crm_bandeja_v2.sql`** (ALTER aditivo: `crm_caso_lecturas.snoozed_until` + `crm_casos.linea` + índice) → pull (`crm.js?v=23`/`api.js?v=63`) → **verificar en prod logueado** (persistencia snooze/línea, semi-auto cotizado, inserts de `audit_log`). Memoria `project_crm_bandeja_v2`.

### D. ARCA — cerrar el facturador *(verificación + 1 ajuste)*
Anda en prod (1ª factura real con CAE). Falta: **1 emisión real A con 2 alícuotas (21 + 10,5)** end-to-end + **confirmar `_EMISOR`** en `finanzas.js` (domicilio Colombia 1173 Lanús / IIBB 902-496739-1 / inicio 01/01/2007) → al confirmar, sacar el comentario `⚠️ verificar`. Memoria `project_arca_facturador_handoff` + `docs/facturador-arca-handoff-proxima-charla.md`. (Ideas extra ahí: rediseño solapa Facturación, NC/ND real, gaps de Reportes.)

### E. Finanzas — siguiente fase *(riesgo medio-alto: toca plata → verificar con cleanup)*
Plan que MANDA: `docs/finanzas-contabilidad-refactor-PLAN-EJECUCION.md`. Pendientes por valor: **Fase 4 v1.1** (KPIs de cartera en Panel) · **3d.2** (comprobante↔movimiento, ya casi) · **3b.2** (switch `compras.js` → proveedor UUID, dedicada) · **Fase 5** (conciliación CSV Galicia/MercadoPago) · **Fase 7** (cierre pre-2027: mapeo_cuentas CRUD + saldos apertura + bloqueo ejercicio). Memoria `project_finanzas_refactor_handoff`.

### F. RRHH v2 *(grande, 5 etapas, con blueprint)*
5 tabs estilo CRM (Panel/Nómina/Planificación/Ausencias/Jornales). SPEC obligatoria: `docs/modulo-rrhh-v2-blueprint.md`. Arranca en **RRHH.1** = ALTER `personas` (`direccion`/`cbu_alias`/`contacto_emergencia` — NO existen; `cuil`/`fecha_nacimiento` SÍ existen). RRHH.5 (Jornales) ya desbloqueada por "Rendimiento por evento".

### G. Cierres chicos / SQL pendientes de correr
- **Proyectos — fotos del armado:** correr `sql/proyecto_fotos_bucket.sql` (bucket + RLS) + verify (memoria `project_proyectos_refactor`).
- Varios buckets/grants sueltos están listados en CLAUDE.md §10 por sesión.

---

## 3. Bloqueados por algo externo (NO atacar hasta destrabar)
- **Gmail API (CRM E2):** bloqueado por política de org en GCP — espera al **partner iPlan** (reseller Workspace). NO meter tarjeta (Gmail API es gratis). Memoria `project_gmail_api_gcp_blocker`.
- **WhatsApp Cloud API (CRM E4):** necesita una sesión **"con el celu"** (WhatsApp Coexistence: vincular QR + verificar + webhook). Memoria `project_whatsapp_meta_coexistence`.

---

## 4. Cómo elegir
Decile a Claude el ítem (A–G). Para **B** (importador 3ds Max) traé el CSV de ejemplo. Para **E/F** confirmá que querés tocar plata/RRHH (más riesgo, más verificación). **A** y **G** son los de menor fricción para una charla corta.

## 5. Prompt para arrancar la charla nueva (copiar/pegar)
```
Trabajamos en LOBBY-MEPEX (C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX). Antes de tocar nada:
1) Preguntame si hago `git fetch origin && git reset --hard origin/main` (árbol compartido con otras charlas — sincronizar primero).
2) Leé en este orden: `docs/handoff-proxima-charla.md` (menú + reglas + fuentes de verdad), después `CLAUDE.md` §10, `PROGRESO.md`, `PLAN-MAESTRO-rediseno-lobby.md`, y la memoria del tema que elija.

Quiero desarrollar: [ELEGÍ — A Eventos pulido / B Importador 3ds Max (adjunto un CSV de ejemplo) / C CRM Bandeja v2 / D ARCA / E Finanzas / F RRHH v2 / G cierres chicos].

Protocolo del proyecto: plan-first si es refactor grande; SQL-first si hay DDL (yo corro el SQL antes de pullear); push directo a `main` (`git push origin HEAD:main`), no PRs; `git add` SOLO lo tuyo + bumpear `?v=`; verificá en preview lo que se pueda (los screenshots y el render de PDF/SVG cuelgan headless → validá por estado/posiciones + mockups show_widget; el OK visual final lo doy yo tras pull). Mínimos tokens, certero, mostrame antes de encadenar cambios.
```
