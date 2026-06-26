# HANDOFF — Reorganización de la capa operativa física (LOBBY-MEPEX)

> Para arrancar la próxima sesión. Estado al **2026-06-25** (reorg **CERRADA** — A→F + corte destructivo). Branch `rediseno` == `origin/main` @ `dbffc0d`.
> **Spec completa:** `docs/capa-operativa-blueprint.md`. **Tracking:** PROGRESO.md §sesiones 2026-06-24/25/25b + PLAN-MAESTRO §REORGANIZACIÓN DE LA CAPA OPERATIVA FÍSICA.

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
1. **Correr `sql/reorg_f_rutinas.sql`** en Supabase — es el **único SQL sin correr** (A/B/D/E ya están). Aditivo/idempotente: tabla `rutinas` + RPC `fn_avanzar_rutina` + seed (backup mensual + inventario físico trimestral) + amplía el CHECK de `tareas.origen`. (Verificá tras correr: `SELECT titulo, target_role, proxima_fecha, activa FROM rutinas;` debe traer las 2 del seed.)
2. **`~/pull-lobby.sh`** en el VPS — trae Fase F **+ el cierre**: `data.js?v=22 · router.js?v=15 · api.js?v=60 · alertas.js?v=6 · tareas.js?v=8 · proyecto-detalle.js?v=8 · inventario.js?v=10 · locaciones.js?v=7 · flota.js?v=5` (+ `taller.js`/`logistica.js` ya no se cargan).
3. **Probar en la UI:**
   - **(Fase F)** como admin: **Centro de Tareas → "🔁 Rutinas" → "+ Nueva rutina"** con `proxima_fecha = hoy` → "📋 Tareas" → aparece en "Hoy" con chip 🔁 → **Hecha** → avanza + no duplica al reentrar.
   - **(Cierre)** el sidebar **ya no muestra Taller ni Logística**; `#taller`/`#logistica` redirigen sin 404. Botón **🔁 Programar rutina** aparece en la ficha de un vehículo (Flota), un lugar (Locaciones) y un equipo (Inventario).
   - **(Como taller, Diego):** ve **Proyectos (galpón)** + **Tareas** + Locaciones operativa; **NO** ve Taller/Logística; puede cerrar su rutina de inventario físico (vía RPC).

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
