# HANDOFF — Reorganización de la capa operativa física (LOBBY-MEPEX)

> Para arrancar la próxima sesión. Estado al **2026-06-25**. Branch `rediseno` == `origin/main` @ `4f0de79`.
> **Spec completa:** `docs/capa-operativa-blueprint.md`. **Tracking:** PROGRESO.md §sesión 2026-06-24/25 + PLAN-MAESTRO §REORGANIZACIÓN DE LA CAPA OPERATIVA FÍSICA.

## Qué es esto
Rediseño integral de la capa física/operativa decidido con Fede: **Taller y Logística se disuelven como módulos** (→ vistas filtradas), **Equipos operativos** entran a Inventario (con contenedores/canastos), **Locaciones** pasa a "espacios físicos" con vistas por rol, y el **Centro de Tareas** se vuelve el sistema nervioso (rutinas recurrentes). Se construyó en fases A→F con **workflows ultracode** (recon → build → verify adversarial → fix), SQL-first, todo **additivo/no-destructivo**, verificado en prod via Chrome con cleanup.

## ✅ HECHO y pusheado (PROGRESO ≈84%)
- **Fase A** — RBAC + RLS: el rol `taller` ve **Proyectos read-only filtrado a `estado='en_taller'`** (revierte SB4). Oficina intacta. *(SQL `reorg_a` ✅ corrido + verificado en prod.)*
- **Fase B** — **tab "Equipos" en Inventario** (CRUD + contenedores numerados con manifiesto XOR equipo-anidado/texto, guard de borrado). *(SQL `reorg_b` ✅ corrido · CRUD verificado contra prod.)*
- **Fase C-aditiva** — **vista galpón de Proyectos para el rol taller** (cards + ciclo `estado_taller`) + **tab "Producción"** (checklist) en la ficha del proyecto. `taller.js` SIGUE VIVO (no se borró). *(Sin SQL.)*
- **Fase D** (completa = núcleo + D.2) — **Transporte+Remito en la ficha del Evento** (vehículos propios/ajenos + qué lleva cada uno + remito por vehículo/evento; `remito-pdf.generate` auto-detecta transporte vs carga → **Logística sigue andando**) · **"Salidas de hoy" en Flota** (`getSalidasHoy`, filtro Q11) + chip propio/ajeno (`es_propio`) · **Calendario operativo reapuntado** a `evento_transporte`. *(SQL `reorg_d` ✅ corrido · CRUD + Q11 verificados contra prod.)*
- **Fase E** — **Locaciones role-aware**: admin con bloque alquiler/contrato + warning "sin tipo"; taller con **cara operativa** (cards read-only filtradas a `taller`/`deposito` + docs por vencer). Fase 0 cleanup. *(SQL `reorg_e` ⏳ **PENDIENTE de correr** — ver abajo.)*

## ⚡ LO ÚNICO PENDIENTE DE FEDE (para que TODO ande)
1. **Correr `sql/reorg_e_locaciones.sql`** en Supabase — es el **único SQL sin correr** (A/B/D ya están). Aditivo: bloque alquiler + grant `taller` locaciones + RLS por tipo. (Verificado en prod 2026-06-25: las columnas de alquiler todavía NO existen → confirma que falta correrlo.)
2. **`~/pull-lobby.sh`** en el VPS (sirve `api.js?v=58 · data.js?v=21 · inventario.js?v=9 · eventos.js?v=23 · proyectos.js?v=5 · proyecto-detalle.js?v=7 · remito-pdf.js?v=4 · flota.js?v=4 · calendario-operativo.js?v=20 · locaciones.js?v=6`).
3. **Probar en la UI:** crear un equipo/canasto en Inventario · armar un transporte en un evento + generar remito · entrar como usuario **taller** (Diego) → ver la vista galpón de Proyectos + Locaciones operativa.

## ⏭️ LO QUE SIGUE (próxima sesión)

### 1. Fase F — Rutinas recurrentes (la última pieza additiva = el "sistema nervioso")
Motor de tareas de mantenimiento que se auto-generan en el **Centro de Tareas** (VTV/service de vehículos, limpieza/mantenimiento de galpón, conteo de inventario, matafuegos, etc.). SQL `reorg_f_rutinas.sql` ya está **en borrador en el blueprint §4** (tabla `rutinas` + RPC `avanzar_rutina` + índices). **Necesita 2 definiciones de Fede antes de construir:**
- **Q21 — ¿cómo se crean las rutinas?** Reco: **manual** (admin carga cada rutina por activo desde un botón "Programar rutina" en Flota/Locaciones/Inventario/Equipos) en v1; plantillas auto-sugeridas por tipo de activo, después.
- **Q24 — ¿quién las gestiona / dónde?** Reco: **admin-level**; botón "Programar rutina" en cada activo + las rutinas vencidas caen solas en el Centro de Tareas (sin pantalla global en v1, o una lista simple).
- Modelo ya cerrado: tabla única `rutinas` (Q6), `activo_id` = `text` polimórfico (Q3), `reprog_desde` completada/programada (Q7), **NO toca `vencimientos_recurrentes` de Finanzas** (Q8 — seed solo de activos físicos, no cierres contables/ARCA).

### 2. C-destructiva — disolver el módulo Taller *(DESTRUCTIVO → OK explícito de Fede)*
Cuando Fede valide que la **vista galpón** (Fase C-aditiva) le sirve como reemplazo: borrar `taller.js` + sacar Taller del sidebar (`data.js categories`) + redirects `#taller`→`#tareas`. *(Hoy taller tiene AMBOS: su dashboard viejo + la vista galpón nueva.)*

### 3. Desconectar Logística *(DESTRUCTIVO → OK de Fede)*
Sacar `<script logistica.js>` de `index.html` + la ruta del router + del sidebar. El transporte ya vive en el Evento (Fase D); `logistica.js` quedó vivo a propósito para no romper deep-links durante la transición. Las tablas legacy (`cargas`/`logistica_*`) quedan inertes (no se dropean).

### 4. Pulidos menores (anotados, baja prioridad)
- `api.js setTransporteItems`: validar `item_type` en la app antes del insert (el CHECK del DDL ya lo cubre).
- `eventos.js`: comentarios viejos que mencionan `logistica_movimientos` (el código ya usa `evento_transporte`).

## Cómo se viene trabajando (para la nueva sesión)
- **Ultracode ON** → cada fase = un workflow (recon paralelo → build → verify adversarial con `node --check` + review → fix auto). Verificación: estructural en preview + **data-layer contra prod via Chrome (con cleanup)**.
- **SQL-first:** el SQL se escribe + Fede lo corre ANTES de pullear el JS.
- **Regla de los 2 archivos:** al cierre, mover lo hecho a PROGRESO + rebalancear % (PROGRESO sube, PLAN baja).
- Push directo a `main` (`git push origin HEAD:main`); Fede pullea en el VPS.
