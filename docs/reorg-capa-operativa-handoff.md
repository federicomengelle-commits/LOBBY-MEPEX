# HANDOFF — Reorganización de la capa operativa física (LOBBY-MEPEX)

> Para arrancar la próxima sesión. Estado al **2026-06-25** (post Fase F). Branch `rediseno` == `origin/main` @ `4b11c86`.
> **Spec completa:** `docs/capa-operativa-blueprint.md`. **Tracking:** PROGRESO.md §sesión 2026-06-24/25 + PLAN-MAESTRO §REORGANIZACIÓN DE LA CAPA OPERATIVA FÍSICA.

## Qué es esto
Rediseño integral de la capa física/operativa decidido con Fede: **Taller y Logística se disuelven como módulos** (→ vistas filtradas), **Equipos operativos** entran a Inventario (con contenedores/canastos), **Locaciones** pasa a "espacios físicos" con vistas por rol, y el **Centro de Tareas** se vuelve el sistema nervioso (rutinas recurrentes). Se construyó en fases A→F con **workflows ultracode** (recon → build → verify adversarial → fix), SQL-first, todo **additivo/no-destructivo**, verificado en prod via Chrome con cleanup.

## ✅ HECHO y pusheado (PROGRESO ≈85%)
- **Fase A** — RBAC + RLS: el rol `taller` ve **Proyectos read-only filtrado a `estado='en_taller'`** (revierte SB4). Oficina intacta. *(SQL `reorg_a` ✅ corrido + verificado en prod.)*
- **Fase B** — **tab "Equipos" en Inventario** (CRUD + contenedores numerados con manifiesto XOR equipo-anidado/texto, guard de borrado). *(SQL `reorg_b` ✅ corrido · CRUD verificado contra prod.)*
- **Fase C-aditiva** — **vista galpón de Proyectos para el rol taller** (cards + ciclo `estado_taller`) + **tab "Producción"** (checklist) en la ficha del proyecto. `taller.js` SIGUE VIVO (no se borró). *(Sin SQL.)*
- **Fase D** (completa = núcleo + D.2) — **Transporte+Remito en la ficha del Evento** (vehículos propios/ajenos + qué lleva cada uno + remito por vehículo/evento; `remito-pdf.generate` auto-detecta transporte vs carga → **Logística sigue andando**) · **"Salidas de hoy" en Flota** (`getSalidasHoy`, filtro Q11) + chip propio/ajeno (`es_propio`) · **Calendario operativo reapuntado** a `evento_transporte`. *(SQL `reorg_d` ✅ corrido · CRUD + Q11 verificados contra prod.)*
- **Fase E** — **Locaciones role-aware**: admin con bloque alquiler/contrato + warning "sin tipo"; taller con **cara operativa** (cards read-only filtradas a `taller`/`deposito` + docs por vencer). Fase 0 cleanup. *(SQL `reorg_e` ✅ **corrido** por Fede + pulleado.)*
- **Fase F** — **Centro de Tareas v2 / motor de rutinas** (el "sistema nervioso"): tabla `rutinas` (plantilla) + RPC `fn_avanzar_rutina` (SECURITY DEFINER, **autoriza al caller por rol/responsable**) + seed no-financiero; amplía el CHECK de `tareas.origen` para `'rutina'`. Las instancias = **tareas-derivadas claimeables** (`origen='rutina'`, `dedupe_key='rutina:<id>:<proxima_fecha>'`) que reusan el motor de Tareas; al marcar **Hecha** avanza la rutina (RPC) y limpia el claim. **Pestaña Rutinas admin-level** (alta/edit/pausar/eliminar) dentro de `#tareas`. Rutinas vencidas → **badge** del Centro de Tareas. **Q21=manual+seed · Q24=admin-level.** *(SQL `reorg_f` ⏳ **PENDIENTE de correr** — ver abajo. Commit `4b11c86`.)*

## ⚡ LO ÚNICO PENDIENTE DE FEDE (para que TODO ande)
1. **Correr `sql/reorg_f_rutinas.sql`** en Supabase — es el **único SQL sin correr** (A/B/D/E ya están). Aditivo/idempotente: tabla `rutinas` + RPC `fn_avanzar_rutina` + seed (backup mensual + inventario físico trimestral) + amplía el CHECK de `tareas.origen`. (Verificá tras correr: `SELECT titulo, target_role, proxima_fecha, activa FROM rutinas;` debe traer las 2 del seed.)
2. **`~/pull-lobby.sh`** en el VPS (Fase F sirve `api.js?v=59 · tareas.js?v=7 · alertas.js?v=5`).
3. **Probar en la UI (Fase F):** como admin, ir a **Centro de Tareas → pestaña "🔁 Rutinas" → "+ Nueva rutina"** con `proxima_fecha = hoy` → volver a "📋 Tareas" → debe aparecer en "Hoy" con chip 🔁 → **Hecha** → la rutina avanza (`proxima_fecha` futura) y al reentrar **no se duplica**. Entrar como **taller** (Diego) → debe ver/poder cerrar la rutina de inventario físico (vía RPC). *(Recordá probar también lo de Fase E ya pulleado: vista galpón de Proyectos + Locaciones operativa como taller.)*

## ⏭️ LO QUE SIGUE (próxima sesión)

> **El additivo de la reorg (Fases A→F) está 100% construido.** Lo que queda son las **2 piezas DESTRUCTIVAS** (requieren OK explícito de Fede, cuando valide que las vistas nuevas reemplazan a los módulos viejos) + pulidos menores.

### 1. C-destructiva — disolver el módulo Taller *(DESTRUCTIVO → OK explícito de Fede)*
Cuando Fede valide que la **vista galpón** (Fase C-aditiva) le sirve como reemplazo: borrar `taller.js` + sacar Taller del sidebar (`data.js categories`) + redirects `#taller`→`#tareas`. *(Hoy taller tiene AMBOS: su dashboard viejo + la vista galpón nueva.)*

### 2. Desconectar Logística *(DESTRUCTIVO → OK de Fede)*
Sacar `<script logistica.js>` de `index.html` + la ruta del router + del sidebar. El transporte ya vive en el Evento (Fase D); `logistica.js` quedó vivo a propósito para no romper deep-links durante la transición. Las tablas legacy (`cargas`/`logistica_*`) quedan inertes (no se dropean).

### 3. Pulidos menores (anotados, baja prioridad)
- **Botones "Programar rutina" por-activo** (2ª pasada de Fase F): agregar un botón en las fichas de Flota / Locaciones / Inventario-Equipos que llame `Tareas.openProgramarRutina({activo_tipo, activo_id, activo_label, modulo, target_role})` (el entry-point ya existe en `tareas.js`, precarga el modal). Hoy la creación manual ya funciona 100% desde la pestaña Rutinas; esto es solo el atajo contextual.
- `api.js setTransporteItems`: validar `item_type` en la app antes del insert (el CHECK del DDL ya lo cubre).
- `eventos.js`: comentarios viejos que mencionan `logistica_movimientos` (el código ya usa `evento_transporte`).

## Cómo se viene trabajando (para la nueva sesión)
- **Ultracode ON** → cada fase = un workflow (recon paralelo → build → verify adversarial con `node --check` + review → fix auto). Verificación: estructural en preview + **data-layer contra prod via Chrome (con cleanup)**.
- **SQL-first:** el SQL se escribe + Fede lo corre ANTES de pullear el JS.
- **Regla de los 2 archivos:** al cierre, mover lo hecho a PROGRESO + rebalancear % (PROGRESO sube, PLAN baja).
- Push directo a `main` (`git push origin HEAD:main`); Fede pullea en el VPS.
