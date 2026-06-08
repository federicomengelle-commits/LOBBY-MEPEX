# PLAN MAESTRO — Rediseño integral LOBBY-MEPEX  ·  RESTANTE ≈ 62%

> **Documento vivo = lo que FALTA hacer.** Lo que YA se hizo vive en `PROGRESO.md` (≈15%). No repetir acá lo que está en PROGRESO.
> **Regla de los 2 archivos (Fede, 2026-06-07):** al cierre de cada sesión → mover lo completado de PLAN-MAESTRO a PROGRESO, rebalancear los % (PROGRESO sube, PLAN-MAESTRO baja), y **sumar acá las ideas nuevas** que vayan saliendo para fases más adelante.
> **Companions:** `PROGRESO.md` (hecho + %), `RECONOCIMIENTO-LOBBY.md` (estado del código), `BRIEF-ARRANQUE-CODE.md` (protocolo).
> **Workflow:** branch `rediseno` para desarrollar; commit por sub-bloque; merge `--ff-only` a `main` + `git push origin main` para que Fede pullee en el server y pruebe. SQL-first en fases con DDL (Fede corre el SQL en Supabase, después se pushea el JS).
> **Baseline actual:** `origin/main` @ `c2439fc`.

---

## Principios rectores

1. **Sanear antes de reorganizar a fondo.** No mover la fachada sobre cimientos de localStorage.
2. **Un dato maestro en un lugar, vistas por rol.** Nunca duplicar la entidad; se filtra por rol (uso vs plata).
3. **Data real única, coherente entre módulos, EN TIEMPO REAL.** (Fede) Toda la data de eventos alimenta calendario Y logística (los viajes se programan desde ahí). Una sola fuente de verdad (Supabase) consumida por todos. *Visión: crear eventos en la nube + backup desde el server.*
4. **Simplicidad operativa.** Completar info sí; burocracia que da ganas de no usar el sistema, no.
5. **No romper lo que anda.** Lo viejo que funciona se toca con bisturí, no con maza.
6. **Separar tracks.** SPA (Claude Code) vs tracks paralelos (CAD/diseño = Meli; configurador 2D = aparte).

---

## Árbol de navegación destino (estado acordado)

```
PRINCIPAL          Lobby (home por rol)
COMERCIAL          CRM (Clientes = vista interna · sin Marketing) · Cotizador · Catálogo (showcase visual — a definir, Fase 3)
OPERACIONES        Calendario (SOLO vista) · Eventos · Proyectos · Taller · Logística
ACTIVOS            Inventario · Locaciones · Compras · [Flota — crear Fase 3]
ADMIN Y FINANZAS   RRHH · Finanzas · Contabilidad · Costos
GLOBAL [Fase 9]    Panel SuperAdmin (roles + stats) · Centro de notificaciones
```
- ✅ Hecho (Fase 1): RECURSOS→ACTIVOS, reubicación, SidebarEditor eliminado. Ver PROGRESO.
- **Catálogo = uno solo** (Fede 2026-06-07): el maestro completo de items vive en las **recetas** (Costos: `catalogo_items` + `insumos_base`), con filtros para todo — NO hay un "catálogo OCTEXA de piezas" aparte. La **Lista de Precios** (Costos) = el subconjunto `cotizable` que el **cotizador** levanta desde la app (los items OCTEXA en general no son cotizables). El **Catálogo comercial** (`catalogo.js`) se reconvierte en un **showcase visual** de todo lo que hace MEPEX — enfoque a definir por Fede.
- GLOBAL todavía no existe como categoría (Panel = dropdown; Notif = campana) → se arma en Fase 9.

---

## FASES RESTANTES

### Fase 2 — Saneamiento de datos ✅ COMPLETA *(2026-06-07 — ver PROGRESO)*
- **2C limpieza** hecha (commit `5687973`): CSS muerto `.mkt-*`, comentarios stale RECURSOS→ACTIVOS, color del audit-log. `undo.js` verificado vivo. (`.cal-*` NO se borra: lo usa el mini-calendario del Lobby.)
- **2B auditada y DIFERIDA** → `AUDITORIA-2B-duplicados.md`. Los 3 duplicados (`personas`/`rrhh_*`; `vehiculos`/`logistica_*`; checklists) **no se consolidan ahora** — se absorben en Fases 3/4 y en la mini-fase RRHH (abajo), porque consolidar antes de reescribir esos módulos sería retrabajo.

### 🆕 Mini-fase RRHH — unificar sobre `personas` *(nueva, salida de la auditoría 2B · ≈3% · DDL)*
Nómina ya escribe `personas`, pero **Vacaciones y Asignación siguen 100% en `rrhh_*`** (`rrhh_vacaciones`, `rrhh_vacaciones_solicitudes`, `rrhh_asignaciones`, `rrhh_personal`) y `personas` no tiene esas columnas. Migrar vacaciones/asignaciones a `personas` + FKs nuevas, limpiar la doble lectura de Eventos (`personas` 1025 + `rrhh_personal` 1495) y retirar las `rrhh_*`. Sin fase asignada hoy — intercalar antes/junto a Fase 9.

### Fase 3 — Capa de Activos (datos maestros) *(≈15% · FUNDACIONAL, SQL pesado)*
- Vistas maestras: **Inventario/Catálogo (= las recetas), Flota, Locaciones.** Dato único + vistas por rol (Operaciones = uso; Finanzas = plata: VTV/seguro/patente/amortización).
- **Flota:** ✅ HECHO (`flota.js`, commit `6a2d0a0`) — sección ACTIVOS, `vehiculos` extendido (uso + plata) + mantenimiento (motor único). Falta repuntar `badges.js`/`eventos.js` a `vehiculos` y retirar `logistica_vehiculos` → **diferido a Fase 4** (con el repensado de Logística).
- **Mantenimiento** = cola colgada del activo (vehículo/máquina), motor único.
- **FUNDACIONAL — estandarizar lo que YA existe:** el maestro de items ya vive en las recetas (`catalogo_items`/`insumos_base`); el grueso es **consolidar y estandarizar códigos/naming** alineados a Supabase → habilita Costos, Diseño (Fase 6) y Configurador. **NO se construye un catálogo nuevo.**
- **🆕 Catálogo comercial = showcase visual (a definir por Fede):** reconvertir `catalogo.js` en un visualizador lindo de todo el abanico de productos/servicios MEPEX (la vitrina, no el maestro de costeo). Fede tiene que encontrarle la vuelta (enfoque/UX). Puede caer acá o en Fase 7 (Comercial).
- **⚠ Carga de SQL pesada.**
- **Test:** cada maestro accesible; vistas por rol correctas.

### Fase 4 — Operaciones: Eventos + Taller + Logística + Subalquileres *(≈15%)*
- **⭐⭐ Reformulación de EVENTOS (núcleo de esta fase — spec detallada en PROGRESO):**
  - **Constructor de fechas tipo TABLA con jornadas:** ✅ HECHO (4.1, commit `2ef6566`) — tabla `evento_jornadas` + trigger que deriva `fecha_*/hora_*` para compat + UI constructor en la ficha. Trigger verificado.
  - **Asignación de gente POR DÍA** ✅ HECHO (4.2) — `asignaciones_evento.jornada_id`; cada jornada con su gente + rol editable, reemplaza Equipo. *(Falta: agrupar visualmente por rol desplegable si hace falta.)*
  - **Vehículos** visibles ✅ HECHO — resumen de vehículos distintos (chips) arriba de las cargas en la ficha del evento.
  - **Historial del evento** ✅ HECHO (commits `cd6bd49`+`814485f`) — `evento_historial` + `logEventChange` reescritos al schema real verificado; sección en la ficha + reflejado en el panel del calendario. Loguea fecha (jornadas) / gente / flete / docs, con usuario.
  - **Docs de evento** ✅ HECHO — `evento_documentos` a Supabase (nombre + link Drive/URL + tipo); dejó localStorage.
  - **2º pase del CALENDARIO** ✅ HECHO (commit `9003793`) — el panel del evento refleja jornadas + gente por día (tab Info) + vehículos (tab Logística). El historial ya se reflejaba. El calendario es SOLO vista; la edición vive en Eventos.
- **Taller v1 ✅ COMPLETO + VERIFICADO EN PROD** (SB1–SB4, Chrome 2026-06-08 — ver PROGRESO §Taller): tablero dinámico con checks editables (plantilla Estructura/Pintura/Gráfica/Equipamiento/Iluminación/Listo), gatillo Oficina→Taller ("Pasar a Taller"), detalle del stand read-only, taller sin Proyectos. Checklist unificado en `taller_proyecto_checklist` (badge incluido). **Falta v2 (abajo) + que Fede valide los pasos reales con el equipo.**
  - **🔮 v2 — Catálogo de pasos + presets (idea Fede 2026-06-08):** en vez de escribir los pasos a mano, una **base de datos de pasos reutilizables** (`taller_pasos_catalogo`): al agregar, elegís de una lista (autocompletar) o escribís uno nuevo que **se suma al catálogo** (crece con el uso). Y **presets/plantillas por tipo de stand** (`taller_plantillas`): "stand con pintura", "espacio con puertas", "con vidrios", etc. → siembran su set de pasos. Ideas a sumar: derivar los pasos de **características del proyecto** (tiene vidrios/puertas/gráfica) en vez de presets rígidos; etiquetar cada paso con **sector** (carpintería/pintura/gráfica/eléctrico) para agrupar/asignar; puente hacia **"tareas derivadas del BOM"** (la receta del proyecto define los pasos). **⚠ NO diseñar el catálogo/presets antes de que Fede valide los pasos REALES con el equipo de taller** (Diego/Juan/Carlos/Willy) — armamos sobre el proceso real, no inventado.
- **🆕 Subalquileres con agregación por proveedor:** cada stand lista items subalquilados + proveedor. **Vista doble:** por EVENTO (totales por proveedor) y por STAND. Dos salidas: lista de TOTALES (taller/pedido) + lista INDIVIDUAL filtrable por proveedor. Conecta con Compras-proveedores y Logística-reparto.
  - **⛔ BLOQUEADO POR DATA (verificado 2026-06-08):** el modelo existe — stand→cotización→`cotizacion_items` (`cotizacion_id, catalogo_item_id, cantidad`)→`catalogo_items` (`tipo_receta='subalquilado'` + `proveedor_id_directo`)→`proveedor`. PERO `cotizacion_items` está **VACÍA**: el **cotizador (app del VPS, ya NO Notion)** todavía no escribe los items en Supabase. (Catálogo de subalquiler sí clasificado en Costos: 7 items.) Además `cotizaciones` **no tiene `proyecto_id`** → falta resolver el link cotización↔proyecto. **DECISIÓN FEDE:** ¿el cotizador del VPS va a escribir `cotizacion_items` en Supabase? Sin eso la agregación da 0.
- **Logística — REPENSAR** (Fede 2026-06-07): con los vehículos movidos a **Flota** (ACTIVOS), Logística cambia de rol → se nuclea en cargas/transporte conectado a Eventos y **consume** la Flota. **Transporte de Eventos pasa de `logistica_movimientos` a `cargas`** (ver AUDITORIA-2B). Redefinir su alcance al encarar Fase 4.
  - **Estado real verificado (2026-06-08):** transporte NUEVO = `cargas` (3 filas) + `vehiculos` (Flota, 2) + `carga_proyectos`/`carga_personas`. LEGACY a retirar = `logistica_movimientos` (4, ya UUID) + `logistica_vehiculos` (1). **VTV/seguro/service viven en `produccion_mantenimiento`** (`vehiculo_id` + `tipo` + `fecha_proximo_vencimiento`), NO en columnas de `vehiculos`. Lecturas legacy a migrar/retirar: `badges.js` (badge VTV/seguro de `logistica_vehiculos`), `eventos.js _openAddMovimientoModal` (alta de movimiento legacy), `api.js:856` (embed `logistica_movimientos`→`logistica_vehiculos`).
  - **PROPUESTA (a confirmar por Fede) — 3.1b:** (1) retirar el alta de transporte legacy de Eventos (el transporte se crea como `cargas` desde Logística; el panel del evento ya muestra `cargas`). (2) El **badge de alertas de vehículos pasa a FLOTA** (no Logística) y cuenta `produccion_mantenimiento` con `fecha_proximo_vencimiento` vencida/próxima. (3) Logística queda nucleada en `cargas` (reparto/viajes) consumiendo la Flota. (4) Retirar `logistica_vehiculos`/`logistica_movimientos` cuando no queden lecturas. **DECISIÓN FEDE:** ¿confirmás esta dirección y que el badge de vehículos va en Flota?
- **🆕 Flujo Oficina→Taller + visibilidad por rol (Fede 2026-06-07 · RE IMPORTANTE):** el **último estado del proyecto en la oficina = "en taller"** → ahí se delega y se pasa TODA la info (detalles, planos, todo). **Taller = dashboard de todos los proyectos vendidos** pasados a producción; ahí toma forma. Roles: **Taller VE Eventos + su dashboard de Taller**, **NO ve Proyectos** (eso es oficina). El **PM/vendedor queda como interlocutor y "deudor" directo entre cliente y taller** (nexo). Esto reformula Taller y ajusta la matriz de roles (taller pierde `proyectos`).
- **Test:** evento con jornadas + asignación por día reflejados en calendario; producción con tablero; subalquiler agregado por proveedor.

### Fase 5 — Compras + rentabilidad por proyecto *(≈10% · corazón del valor)*
- OC de **doble origen** (encargado taller + PM), **siempre imputada a un proyecto**.
- **⚠ Fino:** Compras carga **COSTOS reales**; al cliente va **PRECIO con márgenes**. Renta = diferencia. No errar.
- **Loop:** Costos (presupuesto) vs Compras (gasto real) → margen por proyecto.
- **Test:** cargar OC desde taller y PM; ver gasto imputado + margen.

### Fase 6 — Integración de Diseño *(≈8% · LIVIANA · capa LOBBY)*
- **BOM al cierre (manual/CSV):** cruza contra **Costos** → techo de costos + cotizar bien de movida. Cero endpoint en v1.
- **Planos/renders → Drive** (tab Archivos Drive de `proyecto-detalle`).
- **❌ Stock en vivo descartado.**
- **✅ GRÁFICAS (Fede las quiere):** mockups con la gráfica colocada (para cliente/propia/proveedor) + fichas de producción (referencia, medidas, sangría, resolución). **⚡ Mismo motor que el Configurador 2D (spike ImageMagick hecho).**
- **Depende de:** Catálogo (Fase 3) + Costos.

### Fase 7 — CRM: poda + Clientes como vista + armonía *(≈10%)*
- **Modificación a fondo** armónica, manteniendo integración con cotizaciones. **Clientes = vista interna** del CRM.
- ✅ Ya hecho (ver PROGRESO): Marketing eliminado; Interacciones registra autor; Analítica solo superadmin.
- **🆕 Auditoría de TODOS los cambios del CRM:** registrar quién hace cada cambio (editar cliente, mover pipeline, editar cotización), no solo interacciones. Engancha con `audit_log` global.
- **🔮 Chat multicanal:** centralizar todas las charlas con cada cliente (multicanal) dentro del CRM → ficha del cliente = historial completo de conversaciones + interacciones. *(agentes IA de info/atención — horizonte, Fede dará más.)*
- **Test:** CRM limpio y armónico; auditoría de cambios visible.

### Fase 8 — Finanzas + Contabilidad *(≈10%)*
- Revisar **todos los endpoints** + **integridad cruzada** (modificar uno modifica otro: asientos, libros). **Análisis completo de La PyME.**
- Contabilidad ya semi-armada → ajustar copiando el funcionamiento fino de La PyME.
- **Test:** por definir según el análisis.

### Fase 9 — Transversal: GLOBAL (centro único de notificaciones + stats) *(≈7%)*
- **🔔 UN SOLO centro de notificaciones** — fusionar los 3 de hoy (Lobby alertas + `Notifications` + `Badges`). Vinculado a tareas/proyectos/locaciones. Tipos + **personalizado por rol**.
- **Capa GLOBAL en el menú:** Panel SuperAdmin (roles + stats) + Centro de notificaciones.
- **Stats por usuario:** tiempo de sesión, logs de horarios, rendimiento (base: `last_login_at`, `audit_log`).
- **Lobby/Home por rol** afinado + placeholders de Taller.

### Fase 10 — Remate UI/UX (Claude Design) *(≈5%)*
- Sistema visual (tokens dark theme + manual de marca) aplicado a cada módulo + **pasada final de coherencia**.
- En PARALELO: Fede pasa info a Meli/Leo para el track CAD.

---

## TRACKS PARALELOS *(fuera de la SPA — conectados por el Catálogo; NO los ejecuta Claude Code)*

**Track CAD / Diseño 3D** *(Meli/Fede):* BricsCAD Mechanical (planos VIEWBASE/VIEWSECTION) + 3dsMax (renders). Estandarizar biblioteca OCTEXA (codigo_pieza, categoria, dimensiones, es_grafica) alineada a Supabase. Scripts LISP/MaxScript → v1 exportan BOM a CSV (carga manual); API REST cuando madure. Handoff: `MEPEX_Handoff_Diseno`.

**⭐ Configurador de stands 2D** *(sube de relevancia):* venta rápida SIN diseñador ("lo hace cualquiera"). Prediseñados + brand kit → visual brandeado. ImageMagick spike hecho. **⚡ Mismo motor que las gráficas de Fase 6.** A profundizar.

---

## Cómo seguir (en la charla nueva)
1. Leer `PROGRESO.md` (lo hecho + %) + este archivo (lo que falta) + `BRIEF-ARRANQUE-CODE.md` (protocolo).
2. Preguntar a Fede si hago `git fetch && git reset --hard origin/main` (baseline `c2439fc`) y arrancar en branch `rediseno`.
3. Tomar la **próxima fase** (recomendado: cerrar **Fase 2** con 2B/2C, o saltar a la fase que Fede priorice) → reconocer código real → proponer + preguntar → ejecutar por sub-bloques (commit + push + test) → al cierre, rebalancear % entre PROGRESO y PLAN-MAESTRO.
