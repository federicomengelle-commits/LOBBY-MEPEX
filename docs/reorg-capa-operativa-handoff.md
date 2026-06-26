# HANDOFF — Reorganización de la capa operativa física (LOBBY-MEPEX)

> Para arrancar la próxima sesión. Estado al **2026-06-26** (reorg **CERRADA + VERIFICADA EN PROD**). Branch `rediseno` == `origin/main` @ `104df77`.
> **Spec completa:** `docs/capa-operativa-blueprint.md`. **Tracking:** PROGRESO.md §sesiones 2026-06-24/25/25b/26 + PLAN-MAESTRO §REORGANIZACIÓN DE LA CAPA OPERATIVA FÍSICA.

## ✅ VERIFICADO EN PROD (2026-06-26, via Chrome, con cleanup)
Fede corrió `reorg_f_rutinas.sql` + pulleó. Verificado en vivo en `http://195.200.1.250`:
- **Reorg estructural:** módulos Taller/Logística disueltos (globals undefined, sin module-def, fuera del sidebar); redirects `#taller→#tareas`, `#logistica→#eventos`, `#produccion→#tareas` disparan OK; **el rol taller ve** `lobby·tareas · eventos·proyectos · inventario·locaciones·flota` y NO ve Taller/Logística. **0 errores de consola.**
- **Rutinas end-to-end:** sembré las 8 rutinas reales **vía la app** (total 10). Engine probado con una rutina temporal due-hoy → aparece en "Hoy" con chip 🔁 → "Hecha" → `proxima_fecha` avanzó + `ultima_ejecucion` sellada + claim auto-limpiado (sin bloat) → cleanup OK (volvió a 10). Pestaña Rutinas (admin) renderiza las 10 y el toggle anda.
- **Botones "Programar rutina":** presentes en Flota / Locaciones / Inventario-Equipos; el modal abre **precargado** (tipo/label/rol/módulo).
- **🐞 1 bug cazado y arreglado:** `'flota'` faltaba en `_MODULOS` (tareas.js) → el modal de rutina guardaba módulo `'taller'` en vez de `'flota'`. Fix en `tareas.js?v=9` (commit `104df77`). **⏳ Falta SOLO re-pullear** para tomarlo.

## Qué es esto
Rediseño integral de la capa física/operativa decidido con Fede: **Taller y Logística se disuelven como módulos** (→ vistas filtradas), **Equipos operativos** entran a Inventario (con contenedores/canastos), **Locaciones** pasa a "espacios físicos" con vistas por rol, y el **Centro de Tareas** se vuelve el sistema nervioso (rutinas recurrentes). Se construyó en fases A→F con **workflows ultracode** (recon → build → verify adversarial → fix), SQL-first, todo **additivo/no-destructivo**, verificado en prod via Chrome con cleanup.

## ✅ HECHO y pusheado (PROGRESO ≈86%)
- **Fase A** — RBAC + RLS: el rol `taller` ve **Proyectos read-only filtrado a `estado='en_taller'`** (revierte SB4). Oficina intacta. *(SQL `reorg_a` ✅ corrido + verificado en prod.)*
- **Fase B** — **tab "Equipos" en Inventario** (CRUD + contenedores numerados con manifiesto XOR equipo-anidado/texto, guard de borrado). *(SQL `reorg_b` ✅ corrido · CRUD verificado contra prod.)*
- **Fase C-aditiva** — **vista galpón de Proyectos para el rol taller** (cards + ciclo `estado_taller`) + **tab "Producción"** (checklist) en la ficha del proyecto. *(Sin SQL. `taller.js` se borró luego en el Cierre.)*
- **Fase D** (completa = núcleo + D.2) — **Transporte+Remito en la ficha del Evento** (vehículos propios/ajenos + qué lleva cada uno + remito por vehículo/evento; `remito-pdf.generate` auto-detecta transporte vs carga → **Logística sigue andando**) · **"Salidas de hoy" en Flota** (`getSalidasHoy`, filtro Q11) + chip propio/ajeno (`es_propio`) · **Calendario operativo reapuntado** a `evento_transporte`. *(SQL `reorg_d` ✅ corrido · CRUD + Q11 verificados contra prod.)*
- **Fase E** — **Locaciones role-aware**: admin con bloque alquiler/contrato + warning "sin tipo"; taller con **cara operativa** (cards read-only filtradas a `taller`/`deposito` + docs por vencer). Fase 0 cleanup. *(SQL `reorg_e` ✅ **corrido** por Fede + pulleado.)*
- **Fase F** — **Centro de Tareas v2 / motor de rutinas** (el "sistema nervioso"): tabla `rutinas` (plantilla) + RPC `fn_avanzar_rutina` (SECURITY DEFINER, **autoriza al caller por rol/responsable**) + seed no-financiero; amplía el CHECK de `tareas.origen` para `'rutina'`. Las instancias = **tareas-derivadas claimeables** (`origen='rutina'`, `dedupe_key='rutina:<id>:<proxima_fecha>'`) que reusan el motor de Tareas; al marcar **Hecha** avanza la rutina (RPC) y limpia el claim. **Pestaña Rutinas admin-level** (alta/edit/pausar/eliminar) dentro de `#tareas`. Rutinas vencidas → **badge** del Centro de Tareas. **Q21=manual+seed · Q24=admin-level.** *(SQL `reorg_f` ⏳ **PENDIENTE de correr** — ver abajo. Commit `4b11c86`.)*
- **Cierre (destructivo) — módulo Taller DISUELTO + Logística DESCONECTADA + botones "Programar rutina"** (commit `dbffc0d`, OK de Fede "hasta el final"). **Rol `taller` intacto.** `taller.js` **borrado** + `logistica.js` **desconectado** (inerte en disco); rutas fuera del router; redirects **`#taller→#tareas`**, **`#logistica→#eventos`**, fix **`#produccion→#tareas`**; `data.js` limpio (categories/rolePermissions/module-defs/connections); deep-links vivos re-apuntados (paso-armado→`#proyectos/<id>`, alertas→`#proyectos`, notif pasó-a-taller→`#proyectos/<id>`, createVehiculo→`#flota`). Botones 🔁 en Flota/Locaciones/Inventario. **Boot-verificado en preview** (0 errores; globals OK; redirects disparan). Tablas legacy `cargas`/`logistica_*` **NO dropeadas**. *(Sin SQL.)*

## ⚡ LO ÚNICO PENDIENTE DE FEDE (para que TODO ande)
1. **Re-pullear** (`~/pull-lobby.sh`) para tomar **`tareas.js?v=9`** (el fix de `'flota'` en `_MODULOS`). Es lo único que falta del lado código. *(El resto ya está pulleado y verificado; `reorg_f_rutinas.sql` ya corrido.)*
2. **`sql/reorg_f_seed_rutinas.sql` → NO hace falta correrlo** (las 8 rutinas reales ya las sembré vía la app). El archivo queda como fuente reproducible (idempotente: si lo corrés, no duplica).
3. **Opcionales (prolijidad, no funcionales):**
   - `sql/reorg_cleanup.sql` **PARTE 1**: saca `taller`/`logistica` inertes de `roles.permissions` (hoy `Data.rolePermissions.taller` los muestra porque el DB los tiene; son inertes — sin sidebar ni ruta).
   - `sql/reorg_cleanup.sql` **PARTE 2** (DROP legacy): **comentado a propósito** — decisión Fede "evitar romper"; correr la query de conteo + backup antes, si algún día.
4. **Probar como `taller` (Diego)** en prod: ve Proyectos (galpón) + Tareas + Inventario/Locaciones/Flota; **NO** ve Taller/Logística; cierra una rutina suya (inventario físico). *(El flujo de admin ya quedó verificado por Chrome.)*

## ⏭️ LO QUE SIGUE (próxima sesión)

> **La REORG DE LA CAPA OPERATIVA (A→F + corte destructivo) está 100% construida y pusheada.** Solo restan pulidos OPCIONALES (no funcionales) + la verificación en prod de Fede tras el pull.

### Pulidos — estado
- **`logistica.js` borrado del disco** ✅ (commit `cbc208d`).
- **`eventos.js` comentarios stale** ✅ (`logistica_movimientos`→`evento_transporte`).
- **Botones "Programar rutina"** ✅ (Flota/Locaciones/Inventario).
- **Limpiar el DB `roles.permissions`** (módulos `taller`/`logistica` inertes) → **SQL listo**: `sql/reorg_cleanup.sql` PARTE 1 (segura/idempotente; Fede la corre cuando quiera — es solo prolijidad, todo anda sin esto).
- **DROP de tablas legacy** `cargas`/`carga_*`/`logistica_*`/`remitos` + `taller_checklist`/`taller_notas`/`taller_materiales` + `inventory_items`/`locations` → `sql/reorg_cleanup.sql` PARTE 2 (**comentada**; DESTRUCTIVO de datos → correr la query de conteo que está ahí + backup + OK de Fede). **OJO:** NO confundir con las tablas NUEVAS `taller_proyecto_checklist` / `evento_transporte` (esas se quedan).
- `api.js setTransporteItems`: validar `item_type` en la app antes del insert (el CHECK del DDL ya lo cubre).
- `admin-panel.js _getModuleColor`: se DEJA `taller`/`logistica` a propósito (colorea entradas históricas del `audit_log`).

## Cómo se viene trabajando (para la nueva sesión)
- **Ultracode ON** → cada fase = un workflow (recon paralelo → build → verify adversarial con `node --check` + review → fix auto). Verificación: estructural en preview + **data-layer contra prod via Chrome (con cleanup)**.
- **SQL-first:** el SQL se escribe + Fede lo corre ANTES de pullear el JS.
- **Regla de los 2 archivos:** al cierre, mover lo hecho a PROGRESO + rebalancear % (PROGRESO sube, PLAN baja).
- Push directo a `main` (`git push origin HEAD:main`); Fede pullea en el VPS.
