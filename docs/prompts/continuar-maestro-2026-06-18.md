# HANDOFF — Continuar el plan maestro de LOBBY-MEPEX (sesión nueva)

> Pegá esto en una sesión NUEVA de Claude Code. Es self-contained: orienta a la única fuente de verdad y deja claro qué sigue. **Fecha de corte:** 2026-06-18 · Branch `rediseno` → push directo a `main` · Fede pullea en el VPS con `~/pull-lobby.sh`.

## 0. Arranque de sesión (hacer ANTES de tocar nada)
1. **Preguntá a Fede** si hago `git fetch origin && git reset --hard origin/main` (regla del proyecto — evita conflictos por sesiones paralelas).
2. **Leé en orden:** `CLAUDE.md` (raíz, convenciones + arquitectura) · `PLAN-MAESTRO-rediseno-lobby.md` (**lo que FALTA = única fuente de verdad**) · `PROGRESO.md` (lo hecho + %) · `docs/lobby-module-builder-SKILL-v2.md` (patrón canónico + globals reales + gotcha de permisos) · `docs/schema-prod.md` (schema REAL de prod).

## 1. Dónde estamos (2026-06-18)
- Rediseño **~69% hecho**. **El `PLAN-MAESTRO` es la única fila de pendientes** — todo trabajo sale de ahí; al hacerse se mueve a `PROGRESO` y se rebalancea el % (regla de los 2 archivos).
- **Recién cerrado:** módulo **Rendimiento por evento** (verificado end-to-end en prod) · **RRHH.5 Jornales** (RRHH v2 = 100%) · **2 SQL de Finanzas** (`sql/fix_iva_asiento.sql` IVA en el asiento + `sql/fix_anular_contraasiento.sql` contra-asiento al anular — **CONFIRMAR con Fede si ya los corrió**; afectan TODO Finanzas, avisar a Sofi) · **reconciliación** del plan (varias cosas estaban hechas y mal trackeadas) · **auditoría de módulos** (5 agentes) → **Fase 12 Saneamiento técnico**.
- El skill `lobby-module-builder` quedó en **v2** (globals reales, gotcha de permisos, verificación end-to-end). Si vas a crear/refactorizar un módulo, seguilo.

## 2. Qué sigue (elegir; recomendado primero)
- **🅰 Fase 12.A — Saneamiento técnico transversal (RECOMENDADO para arrancar: autónomo, alta palanca, bajo riesgo).** Router lifecycle `destroy()` (arregla ~4 leaks de listeners de una) + `_esc()` global (cierra el XSS interno del legacy). Después seguir tildando Fase 12 (B datos / C permisos / D perf / E quick-wins). **Detalle con evidencia archivo:línea:** `docs/auditoria-modulos-2026-06-18.md` + `PLAN-MAESTRO` §Fase 12.
- **🅱 Gated en Fede (necesita su mano/teclado, NO autónomo):** CRM **E2 Gmail** + **E4 WhatsApp** (su prioridad declarada; necesita API keys Google/Meta + domain delegation + DNS) · **Fase 4** Logística remito/subalquileres (bloqueada hasta que el cotizador escriba `cotizacion_items`) · **Fase 6** Diseño (necesita motor de gráficas ImageMagick).
- **🅲 Fase 10 — Remate UI** = al FINAL de todo (decisión explícita de Fede: pasada superadora cuando esté todo armado).
- **Opcional chico, autónomo:** quedan quick-wins sueltos de Fase 12.E.

> **Recomendación:** si Fede no dirige a otra cosa, arrancá por **12.A** (router `destroy()` + `_esc` global) — es la de mayor impacto y desbloquea/limpia varios de los otros hallazgos. Verificá en prod (Chrome) con cleanup.

## 3. Convenciones OBLIGATORIAS (CLAUDE.md + skill v2)
- **SQL-first:** correr el DDL en Supabase ANTES de pushear el JS; dárselo a Fede y esperar OK. DDL idempotente + RLS `fn_role_can` + (si módulo nuevo con permiso propio) grant en tabla `roles` (gotcha §1.5 del skill).
- **`supabaseClient` global** para queries (NO `API.supabase`). **Schema real > SQL del repo** (verificá `information_schema`/`docs/schema-prod.md` antes de tocar tablas o insertar — las tablas relacionadas tienen CHECK/taxonomías propias). Soft delete `_deleted`.
- **`node --check`** de cada `.js` antes de pushear. **Bump `?v=`** de cada archivo tocado en `index.html`. **`git push origin HEAD:main`** → Fede pullea con `~/pull-lobby.sh` (**el deploy NO es instantáneo**).
- **Verificación END-TO-END en prod** vía Chrome (sesión autenticada de Fede): ejercitar el flujo real, confirmar el efecto en la DB, y **limpiar la data de prueba**. (Esto cazó 2 bugs reales construyendo Rendimiento.) Cambios a Finanzas/Contabilidad → avisar a Sofi.
- **Al cierre:** mover lo hecho a `PROGRESO.md` (+%), bajar el % de `PLAN-MAESTRO`, actualizar `CLAUDE.md` §10 + tabla de módulos.

## 4. Cómo trabajar (preferencias de Fede)
- Mínimos tokens, certero, una pasada precisa (no 3 tentativas). Plan extenso solo si aporta. **Verificá contra el código actual antes de afirmar** — memorias/planes pueden estar viejos (gana el código). Cuando haya que elegir, **preselectá opciones concretas** con una recomendación, no un survey largo. Ejecutá cuando está claro; preguntá 1 sola vez cuando hay duda real.

**Empezá saludando con un diagnóstico corto de en qué quedó todo (leído de PLAN/PROGRESO) y tu recomendación de por dónde seguir, y arrancá.**
