# Continuar LOBBY-MEPEX — arranque de charla nueva (2026-06-20)

> Pegá esto en una charla NUEVA de Claude Code. Self-contained. Branch `rediseno` → push directo a `main`; Fede pullea en el VPS con `~/pull-lobby.sh` (el deploy NO es instantáneo).

## 0. Arranque (antes de tocar nada)
1. `git fetch origin` + `git status`. ⚠️ **Hay 2+ sesiones de Claude trabajando sobre el MISMO working tree local** → puede haber cambios sin commitear que NO son tuyos (otra charla está construyendo el rediseño del lobby y refactoreando Finanzas). **Nunca `git reset --hard`** con trabajo ajeno sin commitear; preguntale a Fede primero. Cuando commitees, `git add` **solo tus archivos** (no `index.html` ni código que no tocaste vos).
2. Leé en orden: **`docs/ROADMAP-restante-2026-06-20.md`** ← empezá por acá (orden + readiness + exclusiones) · `CLAUDE.md` · `PLAN-MAESTRO-rediseno-lobby.md` (detalle de cada fase) · `PROGRESO.md` · `docs/lobby-module-builder-SKILL-v2.md` (patrón canónico) · `docs/schema-prod.md` (schema real).

## 1. Exclusiones DURAS (NO tocar)
- ⛔ **Lobby / home / Fase 13** — Fede lo está construyendo en otra charla. No toques `lobby.js`, las líneas de lobby de `router.js`, `data.js` (sidebar/quickActions), ni los módulos nuevos `calendario-adm.js` / `carga-comprobante.js` / `pedido-compra.js`.
- ⛔ **Finanzas + Contabilidad (Fase 8)** — Fede las está refactoreando (botón de comprobantes auto). No toques `finanzas.js` / `contabilidad.js` ni su schema. Toda la Fase 8 va a lo último.
- ⛔ **Gmail (E2) + WhatsApp (E4)** — a lo último.

## 2. Qué hacer, EN ORDEN (detalle en el ROADMAP + PLAN)
1. **Fase 4 — Operaciones (mayor valor):** importador asistido de `cotizacion_items` (⛔ pedile a Fede un ejemplo real del output del cotizador/Maple apenas arranques) → remito simple por proyecto/evento (reusar `remito-pdf.js` despegado de cargas) → subalquileres por proveedor (vista doble + PDF/mail) → retiro legacy de Logística (cargas, con bisturí, confirmar antes).
2. **CRM (sin Gmail/WhatsApp):** auditoría de cambios (`audit_log`) · polish v3 · listas de difusión (listmonk ya en VPS) · E3 clasificación (rubro/tags).
3. **Fase 6 Diseño (sin ImageMagick):** BOM al cierre (CSV) cruza Costos · planos/renders → Drive.
4. **Leftovers bajo riesgo (relleno):** consolidar "Usuarios y Roles" (settings vs admin-panel) · cache-busting por git-hash.

## 3. Cómo trabajar (estilo: autónomo, arrancá ya)
- **Diagnóstico corto y a la Etapa 1 de una.** Corré derecho lo de bajo riesgo y confirmá solo SQL / destructivo / cambios a subsistemas compartidos. Si te falta un input de Fede (ej. el ejemplo del cotizador), pedíselo y mientras avanzá un leftover de la Etapa 4. Hacer preguntas en el camino está OK.
- **SQL-first** (DDL en Supabase antes del JS, o JS con fallback — dárselo a Fede y esperar OK) · `supabaseClient` global (no `API.supabase`) · **schema real > repo** (verificar contra `docs/schema-prod.md` / `information_schema`) · soft delete `_deleted` · RLS por la matriz (`fn_role_can`).
- `node --check` de cada `.js` · **bump `?v=`** en `index.html` de cada archivo tocado · `git push origin HEAD:main`.
- **Verificación END-TO-END en prod** vía Chrome (sesión autenticada de Fede): ejercitar el flujo real → confirmar el efecto en la DB → **limpiar la data de prueba**.
- **Cierre:** regla de 2 archivos — mover lo hecho a `PROGRESO.md` (+%), bajar % en `PLAN-MAESTRO`, actualizar `CLAUDE.md §10`. Si otra sesión está editando esos docs, `git add` solo tus archivos o avisá a Fede.

**Arrancá saludando con un diagnóstico corto (leído del ROADMAP/PLAN/PROGRESO) + tu plan para la Etapa 1, y dale.**

---
*Estado al generar este prompt: Fase 12 ✅ completa+verificada (incl. inventario stock atómico, `dc5dcc0`; falta correr `sql/inventario_ajustar_stock.sql`). Fase 13 (lobby) + Finanzas en construcción por Fede en paralelo.*
