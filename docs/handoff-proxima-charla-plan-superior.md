# HANDOFF — Próxima charla (arranca desde PLAN-SUPERIOR)

> **Para retomar en una charla NUEVA.** Driver = `PLAN-SUPERIOR.md` (lo que falta) + `PROGRESO.md` (ETAPA II, entradas `[E2]`).
> **Arranque:** preguntar si se hace `git fetch origin && git reset --hard origin/main` (sesiones paralelas). `importar-3dsmax.js` es untracked y sobrevive.
> Fecha de cierre: **2026-07-04**. `main` @ `bc69145`+ (ver commits abajo).
> Método: skill **`pulir-pantallas`** — **mostrar render/mockup REAL → OK de Fede → aplicar; NUNCA rediseñar a lo grande sin validar**. Fede rechazó un mockup de Físico por "mucho espacio, no va por ahí" → lección: **compacto, respetar lo que ya funciona, simplificar > rediseñar**.

---

## ✅ Hecho esta sesión (todo pusheado a main)
| Qué | Commit | Versiones |
|-----|--------|-----------|
| **Flota** — fix agujero de permisos (pm/taller ya no editan; `_isRO` + guardas) | `c421f07` | flota v6 |
| **Notificaciones** — matriz evento→rol + gaps #1–#5 (OC incompleta, equipo, flota-tarea, stock, pago) | `a4dd521`·`429081b` | api v72→74, alertas v8, tareas v11, notifications v7 |
| **Inventario** — shell estándar + Dashboard launchpad interconectado | `b0d3e18` | inventario v11 |
| **Inventario** — KPIs en los 5 subtabs + 🐞 fix stock materiales (`getInsumos`) | `63ff667` | inventario v12, api v74 |
| **Compras** — KPIs de cabecera en los 3 tabs (cierra el puente con Inventario) | `bc69145` | compras v14 |
| **Inventario** — 🔑 discriminación de stock (Piezas 226→217, Materiales 80→42) | `f92b145` | inventario v13 |
| **Inventario** — Movimientos: saca filtro Proyecto + acento por tipo | `f4a8676` | inventario v14 |

## ⛔ PENDIENTE DE FEDE (SQL-first + pull + verificación logueada)
- **SQL:** `sql/notif_operativas.sql` (triggers stock/equipo + flag `compras_pagos.notif_vencido_at`) + los previos `sql/fase7_bloqueo_ejercicio.sql` + `sql/compras_stock_recepcion.sql`.
- **Pull:** `flota v6 · api v74 · alertas v8 · tareas v11 · notifications v7 · inventario v14 · compras v14`.
- **Verificar en prod LOGUEADO** (el preview no puede loguearse → varias tablas dan RLS-vacío; la validación real la ve Fede o vía Chrome MCP): Flota (pm/taller no editan) · notifs (OC incompleta / equipo fuera de servicio / stock cruza mínimo) · Inventario (Piezas=217, Materiales=42, dashboard, KPIs) · Compras (KPIs).

## 🔜 Inventario v2 — lo que Fede quiere seguir (PENSAR BIEN, no apurar)
Fede: *"Inventario no lo veo final. Pensémoslo bien, le damos la vuelta para sacarlo bien."*
1. **Físico — rework de usabilidad.** Circuito completo y sólido (sesión→auto-genera filas esperado→contás→difs→cerrar=ajusta stock). Problemas: 259 ítems planos, jerga "Teórico/Real", **columna Código ROTA** (`_renderConteoTable` ~line 3649, siempre vacía). **Dirección validada por Fede = COMPACTO, misma tabla que le gusta, simplificar** (rechazó cards grandes). Mockup compacto de partida: chips Todo/Materiales/Piezas (contar **por partes**) + progreso inline + tabla 4 col (Ítem+dot · Esperado · Contado · Dif) + saca Código. **"Por galpón" NO mapea** (piezas/materiales sin ubicación; solo equipos) → scope por tipo/clasificación. → **construir con mockup→OK→aplicar, sin romper lo actual.**
2. **Dashboard — expandirlo** (Fede: "está flaco/vacío"). Hoy: 4 KPIs clickeables + "Necesita atención" + puente Compras. Definir con Fede qué señal va arriba. Ojo: la data hoy es casi todo stock 0 (catálogo) → KPIs neutrales que se activan solos con comprar→stock.
- **Contexto data (ya diagnosticado, no re-descubrir):** `getInsumos`/`getCatalogoItems` **camelCasean** (`tipoReceta`, no `tipo_receta`). Regla de discriminación centralizada en `_soloPiezasFisicas`/`_soloMaterialesReales`. Memoria `project_capa_operativa_integracion`.

## 🗺️ Resto del handoff de la capa operativa (sin tocar hoy)
Pulido: **Flota** (KPI/banner de vencimientos a nivel módulo) · **Locaciones vista-operativa** · CRM Bandeja visual. Integración fina: pedidos→piezas/equipos · chofer transporte↔flota · progreso producción unificado · 3b.2 proveedores UUID. Detalle: `docs/handoff-capa-operativa-pulido-notificaciones.md` + memoria `project_capa_operativa_integracion`.

## 📌 Cómo arrancar la charla nueva
1. Leer `PLAN-SUPERIOR.md` (lo que falta, por prioridad) + este handoff.
2. Preguntar el pull. Confirmar con Fede qué encara: cerrar Inventario v2 (Físico compacto → Dashboard) o avanzar otra cosa del PLAN-SUPERIOR (Flota, etc.).
3. **Método:** mockup/render → OK → aplicar. Compacto, no romper lo que anda, verificar (preview eval; screenshots cuelgan headless).
