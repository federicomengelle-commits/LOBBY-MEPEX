# PLAN MAESTRO — Rediseño integral LOBBY-MEPEX  ·  RESTANTE ≈ 43%

> **Documento vivo = lo que FALTA hacer.** Lo que YA se hizo vive en `PROGRESO.md` (≈57%). No repetir acá lo que está en PROGRESO.
> *(Rebalanceo 2026-06-13f: Fase 11 Centro de Tareas v4 funcionalmente COMPLETA (7 fuentes por-item, ciclo completo, claim/notif/sync taller, manual CRUD, búsqueda, persistencia) → a PROGRESO; quedan futuros menores. PLAN 49→43, PROGRESO 51→57.)*
> *(Rebalanceo 2026-06-13e: Fede corrió los 5 SQL de RLS → **Fase 9.bis CERRADA** (Capa 1 + Capa 2 todos los tiers) → a PROGRESO. PLAN 51→49, PROGRESO 49→51.)*
> *(Rebalanceo 2026-06-13d: reconciliación PROGRESO↔PLAN (workflow ultracode): descontadas Capa 1 + RLS comercial + Costos UX F1/F2/F3 → PROGRESO + fixes stale (GLOBAL retirada del sidebar, `cotizaciones.project_id` SÍ existe). +Fase 11 Centro de Tareas ≈10% (diseño abierto) → universo creció. PLAN 50→51, PROGRESO 50→49. Fede puede subir a 52/48 si cuenta Fase 11 completa.)*
> *(Rebalanceo 2026-06-13c: Fase 9.bis Capa 1 (RBAC fuente única + GLOBAL fuera + compras→admin) CERRADA → a PROGRESO. Queda Capa 2 RLS-por-matriz: motor+financiero listos sin correr. PLAN 51→50, PROGRESO 49→50.)*
> *(Rebalanceo 2026-06-13b: +Fase Costos UX ≈5% — refactor completo del módulo (solo presentación, RPC `calcular_receta` intacta). El universo creció → PROGRESO 51→49, PLAN-MAESTRO 49→51.)*
> *(Rebalanceo 2026-06-13: −RRHH.2/3/4 → Fase RRHH v2 cerrada salvo RRHH.5 (bloqueada). El universo había crecido 2026-06-12 con la Fase 9.bis "Roles & Permisos" ≈3%.)*
> *(Rebalanceo 2026-06-11: el universo creció — la mini-fase RRHH ≈3% se expandió a la fase RRHH v2 ≈8% con diseño cerrado.)*
> **Regla de los 2 archivos (Fede, 2026-06-07):** al cierre de cada sesión → mover lo completado de PLAN-MAESTRO a PROGRESO, rebalancear los % (PROGRESO sube, PLAN-MAESTRO baja), y **sumar acá las ideas nuevas** que vayan saliendo para fases más adelante.
> **Companions:** `PROGRESO.md` (hecho + %), `RECONOCIMIENTO-LOBBY.md` (estado del código), `BRIEF-ARRANQUE-CODE.md` (protocolo).
> **Workflow:** branch `rediseno` para desarrollar; commit por sub-bloque; merge `--ff-only` a `main` + `git push origin main` para que Fede pullee en el server y pruebe. SQL-first en fases con DDL (Fede corre el SQL en Supabase, después se pushea el JS).
> **Baseline actual:** `rediseno`=`main` @ `7437138` *(actualizado 2026-06-13d — + reconciliación de docs + Fase 11 Centro de Tareas anotada)*.

---

## 🗺️ MAPA MACRO — lo que falta *(índice rápido; el detalle, en cada fase abajo)*

- **Fase 4 — Operaciones** ⛔ *trabada por el cotizador (Fede lo está REFACTOREANDO en paralelo, "yéndose para arriba") → analizar integración + posibles features nuevas cuando esté listo*
  - Remito simple (proyecto/evento) + Subalquileres por proveedor → esperan `cotizacion_items` (stopgap: importador asistido aprobado)
  - Retirar legacy de Logística (cargas/movimientos viejos)
- **Fase 5 — Compras** *(doble paso ✅, quedan mejoras)*
  - Botón "Pedido" en Operaciones → OC en Compras · columna presupuesto vs gasto real · hard-link OC↔egreso
- **Fase 6 — Diseño** *(liviana)* — BOM al cierre (CSV) cruza Costos · gráficas/mockups · planos→Drive
- **Fase 7 — CRM "Casos"** — WhatsApp/Gmail/llamadas en timeline · IA (Gemini digest) · clasificación + mailing. **🎯 INTERÉS ALTO DE FEDE (2026-06-13): quiere PROFUNDIZARLO + un DOCUMENTO PASO A PASO de TODO lo manual** (presencia digital, Meta Business, oficialización de WhatsApp, API keys, DNS). Implementación guiada. Ver `docs/crm-casos-blueprint.md`.
- **Fase 8 — Finanzas/Contab.** *(G/H ya codeadas)* · **INTERÉS ALTO DE FEDE**
  - "Rendimiento por evento" (planilla + dashboard ganancia) → **desbloquea RRHH.5** · auditoría de integridad. **🔒 Solo admin/superadmin, MÁS orientado a superadmin (Fede): info interna de cuánta plata se le saca a cada cosa.**
- **Fase 9.bis — Roles & Permisos / RLS** *(Capa 1 ✅ · Capa 2 en curso)*
  - ✅ **TODOS los tiers CORRIDOS (Fede 2026-06-13):** motor + financiero + comercial + **roles/profiles** (lock anti-escalada) + **operativo** (cierra `anon` preservando authenticated). RLS manejada por la matriz. ⇒ **Fase 9.bis CERRADA.**
  - ⏳ Solo resta: testeo por rol (Fede: login/módulos/encuesta/cotizador OK) · tightear escritura de referencia (opcional).
  - Opcional: filtro "Míos" (toggle frontend)
- **Fase 10 — Remate UI/UX** (Claude Design) — sistema visual + pasada de coherencia. **⏸ AL FINAL DE TODO (Fede): cuando esté todo armado, recién ahí una pasada superadora al 100% sobre toda la app.**
- **Fase 11 — Centro de Tareas** ✅ v4 FUNCIONALMENTE COMPLETA (EN PRUEBA) — 7 fuentes por-item + ciclo completo + claim/notif/sync taller. Solo futuros menores → ver PROGRESO.
- **RRHH.5 — Jornales** ⛔ bloqueada por "Rendimiento por evento" (Fase 8)
- **Tracks paralelos** (no Claude Code): CAD/Diseño 3D · Configurador 2D

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
ACTIVOS            Inventario · Locaciones · Flota
ADMIN Y FINANZAS   RRHH · Compras · Finanzas · Contabilidad · Costos
(GLOBAL no es categoría de sidebar: Panel SuperAdmin = dropdown del nombre · Centro de notificaciones = campana del header. Retirada de Data.categories en `3a25d86`.)
```
- ✅ Hecho (Fase 1): RECURSOS→ACTIVOS, reubicación, SidebarEditor eliminado. Ver PROGRESO.
- **Catálogo = uno solo** (Fede 2026-06-07): el maestro completo de items vive en las **recetas** (Costos: `catalogo_items` + `insumos_base`), con filtros para todo — NO hay un "catálogo OCTEXA de piezas" aparte. La **Lista de Precios** (Costos) = el subconjunto `cotizable` que el **cotizador** levanta desde la app (los items OCTEXA en general no son cotizables). El **Catálogo comercial** (`catalogo.js`) se reconvierte en un **showcase visual** de todo lo que hace MEPEX — enfoque a definir por Fede.
- GLOBAL NO es categoría de sidebar (Panel = dropdown del nombre; Notif = campana). Se creó en Fase 9 (`fb3e755`) y se retiró del sidebar en Fase 9.bis Capa 1 (`3a25d86`) por redundante.

---

## FASES RESTANTES

### Fase 2 — Saneamiento de datos ✅ COMPLETA *(2026-06-07 — ver PROGRESO)*
- **2C limpieza** hecha (commit `5687973`): CSS muerto `.mkt-*`, comentarios stale RECURSOS→ACTIVOS, color del audit-log. `undo.js` verificado vivo. (`.cal-*` NO se borra: lo usa el mini-calendario del Lobby.)
- **2B auditada y DIFERIDA** → `AUDITORIA-2B-duplicados.md`. Los 3 duplicados (`personas`/`rrhh_*`; `vehiculos`/`logistica_*`; checklists) **no se consolidan ahora** — se absorben en Fases 3/4 y en la mini-fase RRHH (abajo), porque consolidar antes de reescribir esos módulos sería retrabajo.

### 🆕 Fase RRHH v2 — módulo completo estilo CRM *(✅ CERRADA salvo RRHH.5 · ≈0.5% restante bloqueado)*
- **✅ RRHH.1/2/3/4 HECHAS Y PUSHEADAS (2026-06-12/13 — ver PROGRESO §Fase RRHH v2):** 4 tabs operativas (Panel landing · Nómina v2 · Planificación · Ausencias) + ficha con sub-tabs Datos/Trabajo/Docs/Notas + alertas (ausencias solicitadas, docs por vencer). Todas verificadas end-to-end en prod + review adversarial. El módulo RRHH quedó **completo y usable**.
- **⛔ Único restante — RRHH.5 Jornales** (lente read-only por persona, ≈0.5%): **bloqueada** por la pieza "Rendimiento por evento" de Finanzas (Fase 8) que define el contrato de los ítems jornal. Se enchufa cuando esa pieza exista.
- **⏳ Pendientes de Fede (no bloquean):** pull en VPS + verificación visual de las 4 tabs + correr los **DROP comentados** de `sql/rrhh2_ausencias.sql` (con backup) para retirar `rrhh_asignaciones`/`rrhh_vacaciones`/`rrhh_vacaciones_solicitudes` (`rrhh_personal` sigue hasta Fase 4).
- **🔮 Idea futura (Fede 2026-06-13):** **evaluaciones de desempeño** por persona (no es un doc con vencimiento; sería una sección/feature aparte en la ficha). A diseñar más adelante.
- **📘 SPEC OBLIGATORIA: `docs/modulo-rrhh-v2-blueprint.md`** (decisiones, DDL, migración, etapas, tests). El retiro de `rrhh_personal` se cierra en **Fase 4** (lo leen `eventos.js`/`api.js getEventoTransporte` vía el flujo `logistica_movimientos`). Usar `docs/mapa-tablas.md` (regenerable) + `tools/vps/backup-supabase.sh` antes de cualquier DROP.
- **Único tab pendiente — Jornales (RRHH.5):** lente POR PERSONA, **read-only** (días/montos por evento, pendiente de cobro). Los otros 4 tabs (Panel · Nómina v2 · Planificación · Ausencias) ✅ construidos y verificados en prod → PROGRESO §Fase RRHH v2.
- **Decisiones Fede:** sin presentismo · docs solo fechas+semáforo (sin archivos) · sin self-service (todo carga admin; taller no ve RRHH) · sueldos internos FUERA (viven en Finanzas) · la CARGA de jornales vive en Finanzas ("Planilla del evento", ver Fase 8).
- **Etapas** (cada una deployable, SQL-first): ~~RRHH.1 ficha+Nómina v2~~ ✅ → ~~RRHH.2 Ausencias+migración+retiro legacy~~ ✅ → ~~RRHH.3 Planificación~~ ✅ → ~~RRHH.4 Panel+Docs+alerta `documento_por_vencer`~~ ✅ **HECHAS** → RRHH.5 Jornales (≈0.5%, **⛔ bloqueada por la pieza "Rendimiento por evento" de Finanzas**).
- **No cambia:** asignar gente sigue en Eventos por jornada; Logística/Calendario intactos; notifs de convocatoria se reusan.

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
  - **🎯 Visión Fede (2026-06-08):** al cotizar, la cotización **discrimina propio vs ajeno (subalquilado)** — sobre todo en equipamiento (muebles de terceros). Con eso se arman **tablas/listas imprimibles por proveedor** para **confirmar pedidos**. **Por EVENTO:** un **script que recorre cada proyecto del evento, extrae los elementos subalquilados y arma un PDF/mail de pedido directo al proveedor** (uno por proveedor). Es la pata que conecta cotización → compras/proveedores → logística-reparto.
  - **⛔ BLOQUEADO POR DATA (verificado 2026-06-08, dato corregido 2026-06-13):** el modelo existe — stand→cotización→`cotizacion_items` (`catalogo_item_id, cantidad`)→`catalogo_items` (`tipo_receta='subalquilado'` + `proveedor_id_directo`)→`proveedor`. El único faltante es que `cotizacion_items` está **VACÍA DE FILAS**: el **cotizador (app del VPS, ya NO Notion; hoy Maple para lo último)** todavía no escribe los items en Supabase. **⚠ CORRECCIÓN:** el link cotización↔proyecto **YA EXISTE** vía `cotizaciones.project_id` (inglés, verificado en `docs/schema-prod.md`) — NO falta ALTER. El flag propio/subalq se DERIVA del JOIN, sin columna nueva. Desbloqueo real = el **importador asistido** (stopgap aprobado, abajo) o que el cotizador escriba directo. (Catálogo de subalquiler ya clasificado en Costos: 7 items.)
- **Logística — REPENSAR** (Fede 2026-06-07): con los vehículos movidos a **Flota** (ACTIVOS), Logística cambia de rol → se nuclea en cargas/transporte conectado a Eventos y **consume** la Flota. **Transporte de Eventos pasa de `logistica_movimientos` a `cargas`** (ver AUDITORIA-2B). Redefinir su alcance al encarar Fase 4.
  - **Estado real verificado (2026-06-08):** transporte NUEVO = `cargas` (3 filas) + `vehiculos` (Flota, 2) + `carga_proyectos`/`carga_personas`. LEGACY a retirar = `logistica_movimientos` (4, ya UUID) + `logistica_vehiculos` (1). **VTV/seguro/service viven en `produccion_mantenimiento`** (`vehiculo_id` + `tipo` + `fecha_proximo_vencimiento`), NO en columnas de `vehiculos`. Lecturas legacy a migrar/retirar: `badges.js` (badge VTV/seguro de `logistica_vehiculos`), `eventos.js _openAddMovimientoModal` (alta de movimiento legacy), `api.js:856` (embed `logistica_movimientos`→`logistica_vehiculos`).
  - **✅ DECISIÓN FEDE (2026-06-08):** el aparato de **`cargas`** (armar viaje con responsable/chofer/quién carga/ayudantes + aprobación borrador→aprobada→en_curso) es **DEMASIADO TEDIOSO → se RETIRA**. Eso se coordina informal con la gente del taller, no en el sistema. Logística queda reducida a lo único útil: **REMITO RÁPIDO** — teniendo los elementos que van en cada proyecto, **armar remito → firmar → imprimir/PDF** desde el sistema, fácil.
  - **Diseño del remito simple (v1):** remito por **proyecto** (o evento) que lista los **elementos que van** (carga manual de items mientras `cotizacion_items` esté vacía; auto cuando el cotizador escriba). Botón **firmar** (foto/firma como hoy) + **imprimir/PDF**. Reusar `remito-pdf.js` pero **despegado del flujo de cargas**.
  - **⚠ Touch points del retiro (cascada — hacer con bisturí):** `logistica.js` (toda la UI de cargas/personas/aprobación) · `eventos.js _loadTransporteSection` + `_openAddMovimientoModal` (muestran/crean cargas y movimientos legacy) · `calendario-operativo.js _renderCargasNewSection` (muestra cargas en el panel) · `remito-pdf.js` (hoy genera desde una carga) · `api.js` (createCarga/approveCarga/getCargas/etc + el log "Flete asignado") · badges. **VTV/seguro viven en `produccion_mantenimiento` → el badge de vehículos pasa a FLOTA.** Legacy `logistica_vehiculos`/`logistica_movimientos` se retiran cuando no queden lecturas.
  - **Orden de ejecución propuesto:** (1) badge vehículos → Flota ✅ HECHO (commit `89470ab`). (2) Diseñar el remito simple con Fede (abajo). (3) Construir el remito simple por proyecto/evento. (4) Retirar la UI de cargas de Logística + sus referencias en eventos/calendario, dejando solo el remito. (5) Limpiar legacy. **Las partes destructivas (3-5) se confirman con Fede antes de ripear.**
  - **✅ Decisiones Fede (2026-06-08):** (a) remito **por proyecto Y por evento** (ambos). (b) Items: **esperar al cotizador** (NO carga manual) → el remito se construye cuando el cotizador escriba `cotizacion_items`. (c) Firma: **foto** del remito firmado (como hoy). (d) Pestaña **Vehículos sale de Logística** (ya está Flota). (e) historial de remitos: a definir.
  - **⛔ CONSECUENCIA — cuello de botella de TODA la Fase 4:** con "esperar al cotizador", el remito simple queda bloqueado por **la misma integración que subalquileres**. → **Lo único que desbloquea es que el cotizador del VPS escriba `cotizacion_items` en Supabase** (con flag propio/subalq + cantidad por línea, y el link cotización↔proyecto vía `proyecto_id`). Eso habilita de una: subalquileres-por-proveedor (PDF/mail) + remito simple + "items que van en cada stand". **Hasta esa integración, Logística-remito NO se puede construir.** No-bloqueado que queda en Logística: sacar pestaña Vehículos + retirar cargas (cuando el remito esté listo para reemplazarlas).
  - **🔓 REVISIÓN FEDE (2026-06-12): importador asistido APROBADO como stopgap.** Pantalla admin "Importar items de cotización" en el LOBBY: pegar texto/CSV del output del cotizador o Maple → parsea → escribe `cotizacion_items` con el **MISMO schema destino** que la integración futura — cuando el cotizador escriba directo, cero retrabajo. **Desbloquea remito simple + subalquileres-por-proveedor sin esperar al externo.**
    - **✅ Schema verificado contra prod (`docs/schema-prod.md`, 2026-06-13):** `cotizacion_items` ya tiene schema RICO (`nombre/codigo/unidad/rubro/categoria/catalogo_item_id/precio_unitario_base/precio_unitario_ajustado/cantidad/subtotal_linea/espacio_id/posicion`) — **NO hace falta ALTER**. El link cotización↔proyecto YA existe vía `cotizaciones.project_id` (inglés). El flag propio/subalq **se DERIVA** del JOIN `cotizacion_items.catalogo_item_id(int) → catalogo_items.id(bigint) → tipo_receta` (sin columna nueva; líneas de texto libre sin `catalogo_item_id` = "varios/otros").
    - **Único pendiente para arrancar:** Fede pasa un **ejemplo real del output del cotizador/Maple** (para diseñar el parser) + confirma formato de entrada (¿pegar texto? ¿CSV? ¿una cotización por vez?).
- **🆕 Flujo Oficina→Taller + visibilidad por rol (Fede 2026-06-07 · RE IMPORTANTE):** el **último estado del proyecto en la oficina = "en taller"** → ahí se delega y se pasa TODA la info (detalles, planos, todo). **Taller = dashboard de todos los proyectos vendidos** pasados a producción; ahí toma forma. Roles: **Taller VE Eventos + su dashboard de Taller**, **NO ve Proyectos** (eso es oficina). El **PM/vendedor queda como interlocutor y "deudor" directo entre cliente y taller** (nexo). Esto reformula Taller y ajusta la matriz de roles (taller pierde `proyectos`).
- **Test:** evento con jornadas + asignación por día reflejados en calendario; producción con tablero; subalquiler agregado por proveedor.

### Fase 5 — Compras (OCs) + rentabilidad por proyecto *(≈4% restante · doble paso ✅)*

> **Estado (charla 03):** ✅ **DOBLE PASO COMPLETO Y VERIFICADO** — 5.A Pedidos + 5.B OC (presupuestos/ganadora) + 5.C disparo a egreso (ver PROGRESO §Fase 5). **✅ FIX CERRADO (charla 03):** `sql/fase5_fix_compras_ordenes_fk.sql` corrido (ALTER `compras_ordenes.proyecto_id`/`evento_id` bigint→uuid) — pedido real "Cable 2x1" convirtió a OC con proyecto, loop de rentabilidad verificado por Chrome. Pestaña **Pagos retirada** (pagos → Finanzas; se ve al pullear compras v7). **🌟 + Pedido MULTI-ÍTEM con unidad heredada ✅ VERIFICADO** (commit `b247ce6`): varias cosas por pedido (cable 2x1 + 3x1), unidad heredada de `insumos_base.unidad`, items → Items de la OC. SQL corrido + probado por Chrome. **🔧 + Fix incongruencias presupuestos/ganadora/egreso ✅ VERIFICADO** (commit `8cd3300`): borrar ganadora limpia el cache de la OC; "egreso generado" por el egreso real (no por estado); botón requiere ganadora vigente (no más egreso fantasma). *(Nota: tras pull, hard refresh una vez — el VPS cachea index.html.)* **Falta (opcional / a revisar con Fede):** (a) columna de **presupuesto** (cotización del proyecto vía `proyectos.cotizacion_id`) en Rent. Proyecto para comparar vs gasto real; (b) revisar las **decisiones tomadas** en la implementación (taxonomía de gasto fija oficina/vehículo/material/…, dónde vive exactamente, archivado de OCs); (c) hard-link OC↔egreso = ALTER `egresos.orden_compra_id` de uuid a bigint (hoy es uuid huérfano; se trackea por estado+concepto). El modelo + definiciones originales, abajo (algunas ya resueltas en la implementación).

> **Visión Fede (charla 03, 2026-06-08).** Rediseñar la Orden de Compra como flujo **SIMPLE**: "hay que comprar algo, listo, hacé una OC". **Necesita darle forma fuerte + más definiciones antes de codear** (Fede lo dejó explícito). Reconocimiento del estado actual ✅ hecho (abajo).
>
> **🔮 Mockup visual (charla 03, v2 = DOBLE PASO):** `mockup-oc-v2.html` (raíz, NO-destructivo, clickeable, look de Compras) — abrir en `http://195.200.1.250/mockup-oc-v2.html` tras pull. Muestra el **doble paso**: Pedido (taller, ultra simple, sin precios) → Orden de Compra (Compras gestiona: presupuestos → ganadora → egreso). Base para debatir las **definiciones pendientes** de abajo.

**Estado actual reconocido (charla 03):**
- **OCs** (`compras.js`, tab Órdenes de Compra): `compras_ordenes` = `numero_oc`, `proveedor_id` (**HOY obligatorio**), `evento_id`/`proyecto_id` (**opcionales**), `fecha`, `estado` (pendiente→aprobada→recibida→pagada), `notas`. Items en `compras_orden_items`, pagos en `compras_pagos`. **1 solo proveedor por OC** (sin multi-presupuesto). **Sin** campo link · **sin** categoría de gasto · **NO** dispara egreso automático.
- **Rentabilidad por proyecto YA existe** en Finanzas (`finanzas.js _renderRentProyecto`, report "Rent. Proyecto" + "Rent. Cliente"). Por proyecto calcula: **facturado** = Σ `comprobantes.total` (emitida) · **cobrado** = Σ `ingresos.monto` (confirmado) · **costo** = Σ `egresos.monto` (pagado, imputado al proyecto) · **rent %** = (cobrado − costo)/cobrado. Filtra por canal A/B. ⇒ El "costo" sale de **egresos imputados al proyecto**, NO de OCs ni del presupuesto.
- **Desconexión clave:** las OCs **no generan egresos** hoy → el gasto de una OC solo entra al "costo" del report si alguien crea un egreso a mano imputado al proyecto. **El "OC dispara a Egresos" de la visión cierra exactamente este hueco** (OC → egreso → aparece como costo → margen).
- **Permisos:** `taller` **NO** tiene `compras` (en `data.js rolePermissions`).
- **Link cotización↔proyecto:** existe vía `proyectos.cotizacion_id`.

**🔑 Modelo DOBLE PASO (refinado charla 03 — la clave para que NO sea tedioso como las cargas):**
- **Paso 1 · PEDIDO (lo hace el taller, ULTRA simple):** botón "hay que comprar esto" desde Taller / la ficha del proyecto. Qué (insumo del catálogo **o** texto libre + link opcional) · cantidad · proyecto opcional · urgencia · nota. **El taller NO ve precios, proveedores ni presupuestos.** Pedido interno de 10 segundos que le llega a Compras.
- **Paso 2 · ORDEN DE COMPRA (lo gestiona Compras):** Compras agarra el pedido y le pone el laburo pesado: **varios proveedores con su presupuesto → elige la ganadora → dispara el egreso** a Finanzas. Toda la complejidad vive acá, pero solo la toca quien la necesita.
- **Entrada directa de oficina:** PM/superadmin pueden crear la OC directo (sin pedido previo).
- **Por qué NO es como las cargas (Fede preguntó):** las cargas murieron porque le metíamos todo el aparato pesado a gente que no lo necesitaba. Acá el peso está **repartido**: taller = pedido trivial; Compras = gestión real. Cada rol toca solo su parte → liviano para todos. Esa es la simplificación que lo hace sobrevivir.

**Detalle de la OC nueva (darle forma con Fede):**
1. **OC = algo simple.** Dos sabores:
   - **(a) Insumos:** elegir ítems del catálogo (`insumos_base`/`catalogo_items`).
   - **(b) Libre con link:** descripción + **link** (ej. MercadoLibre) para una máquina, repuesto, lo que sea.
2. **Origen múltiple:** la arma **taller**, **PM** o **superadmin** → `taller` necesita permiso `compras` (hoy no lo tiene; UI taller = ULTRA simple).
3. **Opciones de proveedor + ganadora (dentro de la misma OC):** cargar **varios proveedores con sus datos + su presupuesto**, y **seleccionar la cotización ganadora**. Hoy es 1 proveedor fijo → **estructura nueva** (OC → N presupuestos de proveedor → 1 ganadora). **DDL** (tabla nueva, ej. `compras_oc_presupuestos`).
4. **Sin proyecto = OK.** Una OC puede NO tener proyecto: **oficina / vehículo / material / etc.** → **categorías de gasto libres** (taxonomía a definir). **NO obligar proyecto.** *(Descarta el supuesto viejo "siempre imputada a un proyecto".)*
5. **Dispara a Finanzas → Egresos:** al elegir ganadora / recibir / pagar, la OC **se dirige sola a un egreso** (compras) en Finanzas — quedando ya cargado el gasto. Esto alimenta el "costo" del Rent. Proyecto.

**Rentabilidad — cerrar el loop:**
- **⚠ Fino:** Compras carga **COSTOS reales**; al cliente va **PRECIO con márgenes** (de Costos/cotización). Renta = diferencia. No mezclar.
- **Macro (cobrado vs costo):** ya funciona en el report; lo que falta es que el **gasto de OCs** llegue al "costo" (vía el disparo OC→egreso del punto 5).
- **Presupuesto vs real (enhancement):** sumar el **presupuesto** del proyecto (cotización total vía `proyectos.cotizacion_id` → Costos) como columna para comparar contra el gasto real. El **blocker del cotizador** (`cotizacion_items` vacía) afecta el **detalle por línea**, NO el **total agregado** → la renta macro se cierra sin el cotizador.

**Definiciones pendientes (Fede, charla 03 — debatir antes de codear):**
- **¿Dónde vive?** ¿"Pedidos" como pestaña dentro de Taller + "Órdenes" en Compras? ¿O todo en Compras y el taller solo dispara el pedido (botón en la ficha del proyecto/stand)?
  - **✅ DECISIÓN FEDE (2026-06-13):** **Compras movido a ADMIN & FINANZAS** (ya hecho en `data.js` — sale de ACTIVOS). El **disparo del pedido vive en OPERACIONES**: un botón/acción simple ("Pedido" / "hay que comprar esto") desde Taller/ficha de proyecto → genera un pedido liviano → la **OC se genera y gestiona dentro de Compras** (Admin). Reafirma el doble-paso: peso del pedido en Operaciones (trivial), peso de la OC en Admin. **Pendiente:** diseñar ese botón en Operaciones + el permiso "pedido" liviano para taller (hoy taller no tiene `compras`).
- **Archivado / histórico:** cómo queda la OC cerrada (comprada + link al egreso + presupuestos guardados). Estados del pedido (pedido → en compra → comprado) y de la OC.
- **Taxonomía de categorías de gasto** para pedidos/OCs sin proyecto (oficina/vehículo/material/herramientas/servicios/…).
- **Disparo del egreso:** ¿al elegir ganadora, o al marcar "recibida/pagada"? ¿botón explícito? ¿qué cuenta/categoría/canal de Finanzas? ¿1 egreso por OC?
- **Permiso:** el taller necesita acceso a "Pedidos" (hoy no tiene `compras`). ¿"Pedidos" = permiso aparte, más liviano que `compras` completo?
- ¿La renta se queda en Finanzas (admin-only) o un atajo/resumen en Compras?

**Test:** crear OC (insumo y link) desde taller/PM/superadmin · cargar 2 presupuestos y elegir ganadora · que dispare egreso en Finanzas · ver gasto imputado + margen por proyecto.

### Fase 6 — Integración de Diseño *(≈8% · LIVIANA · capa LOBBY)*
- **BOM al cierre (manual/CSV):** cruza contra **Costos** → techo de costos + cotizar bien de movida. Cero endpoint en v1.
- **Planos/renders → Drive** (tab Archivos Drive de `proyecto-detalle`).
- **❌ Stock en vivo descartado.**
- **✅ GRÁFICAS (Fede las quiere):** mockups con la gráfica colocada (para cliente/propia/proveedor) + fichas de producción (referencia, medidas, sangría, resolución). **⚡ Mismo motor que el Configurador 2D (spike ImageMagick hecho).**
- **Depende de:** Catálogo (Fase 3) + Costos.

### Fase 7 — CRM "Casos": conversaciones multicanal + IA *(≈10%)*
- **📘 SPEC OBLIGATORIA: `docs/crm-casos-blueprint.md` (aprobado por Fede 2026-06-11).** El CRM nuevo se construye basándose en ese documento — modelo, UI (mockups validados), ingesta, etapas. **Implementación GUIADA:** al ejecutar cada etapa, Claude guía a Fede paso a paso en lo manual (API key Gemini/AI Studio, domain-wide delegation en admin.google, Brevo/DNS, Meta).
- **Modificación a fondo** armónica, manteniendo integración con cotizaciones. **Clientes = vista interna** del CRM.
- ✅ Ya hecho (ver PROGRESO): Marketing eliminado; Interacciones registra autor; Analítica solo superadmin.
- **Núcleo nuevo = CASO (oportunidad):** nuclea conversaciones WhatsApp/email/**llamadas** (lo de teléfono se anota y no se pierde) + notas internas con @menciones + N cotizaciones + próxima acción. Timeline unificado + Bandeja de hoy; el kanban del Pipeline se re-apunta de cotizaciones a casos. Tablas `crm_casos`/`crm_mensajes`/`crm_contactos` + `caso_id` en cotizaciones; migra `interacciones` 1:1 (DDL, SQL-first).
- **Ingesta + IA:** endpoint `/api/crm/digest` en el proxy del VPS con **driver intercambiable** — arranca **Gemini API free tier** (decidido; cambiar a pago/Claude = 1 env var). E1: WhatsApp pegado crudo → estructurado/resumido/archivado. E2: email automático vía **Gmail API** (domain-wide delegation desde admin@; ya incluida en Workspace) + bandeja "sin asignar" + digest diario → notificaciones. La IA sugiere, el humano confirma.
- **E3 — Clasificación + mailing en frío:** rubro como catálogo cerrado + tipo + eventos participados + tags → **listas de difusión desde el CRM** (envío: Brevo candidato; subdominio dedicado para no quemar el dominio). Contenido generado por IA. Marketing lo lidera Fede + **community manager humano** para redes/comunicación (desarrollo de marketing aparte, pendiente).
- **E4 — WhatsApp Business Cloud API** (cuando el volumen lo justifique) · **E5 — Agente comercial casi-humano** (escalera: copiloto → cola con veto → autónomo acotado; el historial de casos es su memoria).
- **🆕 Auditoría de TODOS los cambios del CRM:** registrar quién hace cada cambio (editar cliente, mover pipeline, editar cotización), no solo interacciones. Engancha con `audit_log` global.
- **Test:** caso con timeline multicanal + nota interna + llamada registrada + digest IA (Gemini) andando; auditoría de cambios visible.

### Fase 8 — Finanzas + Contabilidad *(≈10%)*
- **⚠ SYNC 2026-06-12 (verificado git + REST contra prod):** las Fases **G y H del blueprint finanzas YA están codeadas en main** (commits `9402b17`→`149e30c`, 2026-05-27/28): G.1 SQL cuentas dif. cambio 4.9.01/5.9.01 · G.2 tab "Mapeos auto." en Contabilidad · G.3 dif. cambio automática · G.4 subtab Mov. extranjeros · G.5 planes multi-moneda · G.6 Balance General + EERR PDF · H saldos apertura (tab + SQL). **SQL G.5 y H corridos en prod** (`plan_cobro.moneda` y tabla `saldos_apertura` existen). Seed G.1 (cuentas 4.9.01/5.9.01) y `mapeo_cuentas` con filas → **CONFIRMADO** (ver bullet "Seed de `mapeo_cuentas` YA HECHO" abajo: 12 mapeos activos). **NO re-implementar nada de G/H.** La conciliación ya tiene wizard 4 pasos (finanzas.js ~9011, desde abril).
- Revisar **todos los endpoints** + **integridad cruzada** (modificar uno modifica otro: asientos, libros). **Análisis completo de La PyME.**
- **✅ Seed de `mapeo_cuentas` YA HECHO Y FUNCIONANDO (verificado en prod 2026-06-12, sesión autenticada):** 12 mapeos activos (4 ingreso por servicio SRV-* + 8 egreso por categoría), cuentas G.1 4.9.01/5.9.01 existen, y los asientos automáticos SE GENERAN (6 de los últimos 8 asientos son `automatico` linkeados a ingresos/egresos). El "bug de asientos en vacío" del CLAUDE.md §10 quedó RESUELTO en algún momento post-mayo — NO re-seedear. `saldos_apertura` existe con 0 filas (esperable, apertura 2027 pendiente de carga). Pendiente real de Fase 8: backfill de asientos para movimientos confirmados ANTES del seed (si los hay sin asiento) + auditoría de integridad.
- Contabilidad ya semi-armada → ajustar copiando el funcionamiento fino de La PyME.
- **🆕 "Rendimiento por evento" — EN DISEÑO (charla aparte, prompt entregado 2026-06-11):** reemplaza el Excel de pagos de Lelean. Dos piezas: (1) **Planilla del evento** (grilla inline de carga rápida: jornales por persona / fletes / proveedores que facturan POR EVENTO — teles, muebles JD, audiovisual, MultiLED — + seguros + comida; estados pendiente/pagado con adelantos y pagos en tandas; pagar ítem → egreso propio, pagar seleccionados → egreso consolidado; asiento automático; OC de Compras read-only sin duplicar) y (2) **dashboard de ganancia por evento** (Σ ingresos proyectos − costos evento − costos proyecto, con materiales de inventario). Al cerrar aquel diseño se suma acá con su % y se rebalancea. **El tab Jornales de RRHH v2 (RRHH.5) depende de esta pieza** (contrato: ítems jornal con persona_id/fase/dias/tarifa/monto_pagado/egreso_id).
- **Test:** por definir según el análisis.

### Fase 9 — Transversal: GLOBAL ✅ COMPLETA (charla 03 — ver PROGRESO §Fase 9) *(solo quedan deudas/ideas futuras)*
- **🔔 Centro único de notificaciones ✅ HECHO (charla 03 — ver PROGRESO §Fase 9):** motor único `Alertas` (9.1) + campana 2 capas Novedades/Pendientes (9.2) + página completa + silenciar tipos por usuario (9.3). Verificado en prod. *(Decisiones: dos capas · campana + página · rol + silenciar tipos.)*
- **Capa GLOBAL en el menú — ✅ HECHO Y LUEGO RETIRADA:** se creó (9.4, `fb3e755`) y se quitó del sidebar en Fase 9.bis Capa 1 (commit `3a25d86`, `data.js:93-95`) por redundante: Panel de Control vive en el dropdown del nombre (superadmin) y Notificaciones en la campana (todos). NO es categoría de sidebar. Ver PROGRESO §Fase 9.bis Capa 1.
- **Stats por usuario ✅ HECHO (9.5, `0e100ee`):** tab Actividad en el Panel (acciones 7d/30d, días activos, módulo top, gráfico 14d, última actividad). *Pendiente futuro:* tiempo de sesión exacto — `audit_log` no loguea login/logout, habría que registrarlos (o usar `last_seen_at`).
- **Lobby/Home por rol ✅ HECHO — Híbrido (9.6, `11f83da`):** venta/pm aterrizan en el Lobby (home por rol con sus KPIs + contenido); taller sigue directo a su tablero (ULTRA simple). *Idea futura suelta:* bloque de estado de Taller en el home de admin (no pedido).
- **🆕 Ideas del centro (charla 03):** silenciado cross-device (`profiles.notif_prefs`, DDL) en vez de localStorage por navegador; permitir silenciar también tipos de *pendientes* y/o que el mute apague los dots del sidebar; separar el badge en 2 números (no-leídas vs pendientes) si Fede lo prefiere. Limpiar `settings._getNotifPrefs/_setNotifPrefs` muertos.

### 🆕 Fase 9.bis — Roles & Permisos: fuente única + scoping por fila (RLS) *(≈3% · transversal · deuda del Panel SuperAdmin)*

> **Síntoma reportado (Fede, 2026-06-12):** la matriz de Roles y Permisos del Panel de Control "nunca está actualizada — no copia lo nuevo". Diagnóstico verificado contra el código: **no hay fuente única.** Conviven 5 definiciones paralelas que driftean.

**🔎 Causa raíz (verificada):** la matriz arma sus **filas** desde una lista hardcodeada `admin-panel.js:1215` (`_permModules`) que quedó vieja — le falta `flota`/`calendario`, todavía muestra `parametros-globales` (eliminado, hoy en Costos). Los **valores** write/read/none sí salen de la tabla `roles` de Supabase (esa parte OK). Pero al guardar un rol: (1) las filas son una lista a mano que no refleja los módulos reales, y (2) el resto de la app (`settings.js`, sidebar, lobby) lee de `Data.rolePermissions` (copia en memoria que **solo** se refresca en login vía `loadRolesFromDB`, fire-and-forget en `auth.js:133`). ⇒ un cambio en el Panel no se ve en ningún lado hasta re-loguear.

**Las 5 fuentes que driftean:** (1) `Data.modules`/`categories` = qué módulos existen · (2) `Data.rolePermissions`/`readOnlyPermissions` = arrays "fallback" · (3) tabla `roles.permissions` JSONB = fuente *declarada* · (4) `admin-panel._permModules` = filas de la matriz, **la más vieja** · (5) `profiles.custom_permissions` = override por usuario. Encima **2 formatos**: JSONB `{mod: write/read/none}` vs arrays planos sin distinción read/write.

**🔧 Capa 1 — RBAC de módulos (fuente única). ✅ CERRADA Y PUSHEADA (commit `3a25d86` — ver PROGRESO §Fase 9.bis Capa 1).** Resta solo el **polish diferido (no era el bug):**
- **Un solo formato** `{mod: nivel}` (none/read/write). Migrar `custom_permissions` a ese formato (override por usuario *sobre* el rol; hoy es array plano sin niveles).
- **Un solo resolver en runtime:** todo pasa por `Auth.hasPermission(mod)`. Eliminar las lecturas directas a `Data.rolePermissions` (hoy `settings.js:481/576/590/620` las usa → desincronizado del Panel).
- **Test:** editar un permiso en el Panel → se refleja sin re-login en sidebar + settings + lobby; agregar un módulo nuevo aparece solo en la matriz; ningún módulo fantasma.

**🔐 Capa 2 — RLS MANEJADA POR LA MATRIZ. NO es esconder filas entre la oficina. ✅ TODOS los tiers CORRIDOS (2026-06-13): motor + financiero + comercial + roles/profiles + operativo. Resta: testeo por rol + tightear escritura de referencia (opcional) · 2A filtro "Míos" ⏸ OPCIONAL.**
> Decisión clave: **admin/superadmin/venta/pm ven TODO entre ellos.** El "responsable" es **atribución** (quién lidera, para cobertura ante ausencias y correcciones macro), **no una pared**. "Lo propio" = un **filtro/vista**, no una restricción. Taller ve proyectos **a su manera** (tablero Taller, no el módulo Proyectos — ya por RBAC). Futuro: vincular lo **presupuestario** al flujo de taller/proyecto para integrarlo.

- **2A — Atribución + filtro "míos" (frontend, seguro, reversible) — ⏸ OPCIONAL (Fede 2026-06-13: "¿qué es eso? jaja" → no prioritario, NO construir salvo pedido):** responsable/vendedor claro en cada entidad + auto-set al crear (sino el filtro no tiene de qué agarrarse: `cotizaciones.vendedor_id` y `proyectos.responsable_id` pueden quedar null) + toggle **"Míos / Todos"** (default Todos) en CRM (cotizaciones) y Proyectos. Da foco SIN esconder.
- **2B — RLS MANEJADA POR LA MATRIZ (decisión Fede 2026-06-13, clave):** la RLS **lee `roles.permissions`** (la misma matriz del Panel que arregló Capa 1) vía helpers SQL → **el acceso se configura inline desde Roles y Permisos, sin tocar SQL nunca más.** Cambiás un permiso en el Panel y la RLS lo respeta al instante. Hoy el RBAC es **solo frontend** → un taller (o cualquiera con la anon key) puede leer finanzas/comercial por query directa, y `anon` lee TODO (`USING(true)`, ver `sql/rls_*.sql`/`fase1c_rls.sql`). Esto cierra ese agujero **sin esconder filas entre oficina** (es a nivel módulo/tabla, no por fila).
  - **Helpers (`sql/rls_capa2_motor.sql`):** `fn_user_role()` + `fn_role_can(p_module, p_need)` — SECURITY DEFINER (sin recursión), STABLE, leen `roles.permissions` por `auth.uid()` (`profiles.id = auth.uid()` verificado). **superadmin = siempre true** (short-circuit, no te bloqueás). Mapeo: SELECT⇒`read`, INSERT/UPDATE/DELETE⇒`write`, `none`⇒sin acceso.
  - **Tier financiero (`sql/rls_capa2_financiero.sql`) ✅ CORRIDO (commit `3a25d86`):** ingresos/egresos/comprobantes*/asientos/asiento_lineas/cuentas_financieras/plan_cuentas/saldos*/transferencias/plan_cobro*/cobro_aplicaciones/mapeo_cuentas/vencimientos*/conciliaciones/extracto → read = `fn_role_can('finanzas'|'contabilidad','read')`, write = idem write.
  - **Tier comercial (`sql/rls_capa2_comercial.sql`) ✅ CORRIDO (2026-06-13, pre-flight verificado):** cotizaciones+hijas/interacciones/email_templates → gate `crm` (read=crm OR proyectos, write=crm), **sin anon** (taller bloqueado de precios/cotizaciones). `clientes` → **lectura amplia** (authenticated + anon) porque **taller.js lee clientes** (nombre del stand) **y `encuesta.html` (anon) embebe `clientes`**; escritura solo crm. `proyectos` NO acá (operativo: taller lo lee/escribe estado_taller).
  - **⚠ HALLAZGO (2026-06-13):** `encuesta.html` pública (anon, por token) **embebe `eventos`(nombre/predio/fecha) + `clientes`(razón social)** → **NO cerrar anon en `eventos`/`clientes`** o se rompe la encuesta del cliente. Verificado en encuesta.html:267-268.
  - **Tier operativo → DIFERIDO a la auditoría de corrección:** es "todos ven" (authenticated, coincide con el reframe) → no se gatea por ahora. Su único cambio de seguridad = cerrar `anon`, pero está **enredado con consumidores públicos** (encuesta→eventos/clientes; posibles test-pages→catálogo) → se hace tabla-por-tabla verificando cada consumidor. **Compartidas/referencia** (catálogo/insumos/precios) → **mantener anon** (cotizador externo lee `catalogo_items`), escritura a tightear opcional en la auditoría.
  - **⚠ Riesgo (DB viva):** SQL-first, **tier por tier con rollback** (re-aplicar `USING(true)` revierte; snippet en cada archivo). Fede corre + testea logueado por rol. **El backend service-role (lobby-api) bypassa RLS** → ops admin server-side intactas.
- **Decisiones tomadas (2026-06-13):** RLS lee la matriz (configurable inline) · clientes = venta ve TODOS · "propio" (para el filtro) = `cotizaciones.vendedor_id` y `proyectos.responsable_id`/`proyecto_responsables` · pm ve TODOS los proyectos · compartidas = lectura amplia/escritura dueño · premisa: taller sin finanzas/comercial, pm comercial+ops, venta comercial, admin ~todo, superadmin todo.
- **Test:** taller logueado NO lee cotizaciones/finanzas ni por query directa · anon no lee comercial/financiero · admin/superadmin siguen viendo todo · cambiar un permiso en el Panel cambia el acceso real sin redeploy.

**Orden:** Capa 1 ✅ · Capa 2B RLS motor + financiero + comercial ✅ CORRIDOS (`3a25d86` + `2cd1163`). Resta: auditoría de corrección (lock `roles`/`profiles` + cerrar `anon` operativo tabla-por-tabla, respetando que encuesta.html/cotizador leen eventos/clientes/catálogo) + 2A filtro "Míos" ⏸ OPCIONAL.

### 🆕 Fase Costos UX — refactor completo del módulo *(≈5% · solo presentación, RPC intacta)*

> **Origen (Fede 2026-06-13):** "el módulo de costos más amigable" → derivó en el refactor completo de las 4 solapas. Diseño cerrado con renders interactivos validados.

- **📘 SPEC OBLIGATORIA: `docs/costos-rediseno-ux-blueprint.md`.** Tokens **grounded** en `MEPEX_BRAND.md` + `style.css :root` (§0 del blueprint): bg `#050505`, cards `#111111`, inputs `#1A1A1A`, border `#2a2a2a`, radius 4/6/10, badges Space Mono UPPERCASE (`color20`/`color40`), btn-primary mono + glow, SVG inline (no icon fonts). **Reusar clases reales, no inventar tokens.**
- **Objetivo (Fede):** módulo más amigable y cómodo, edición tipo planilla, fórmula clara. Las 4 solapas (Insumos · Recetas · Listas de Precio · Parámetros) como **un sistema de diseño cohesivo**, no 4 pantallas sueltas.
- **Decisiones cerradas:** editor de receta a **pantalla completa** (2 col, `.modal--full` nuevo) · **fila fantasma** inline para componentes (sin modales; reusa `addRecetaComponente`+`validarNoCiclo`+`_insumoSinVU`) · **recibo vertical** paso a paso con marcador "pendiente" (**cero cálculo en el front**; la RPC `calcular_receta` es la única fuente; Recalcular dispara la RPC) · **quick-edits de 2 clics** en la tabla (popovers sobre badges). Variante **subalquilado** = simple (anula MO/amortización/indirectos; solo `costo MP × (1+margen)` + proveedor). Convivencia: dejar el panel lateral actual hasta validar, después bajar el que sobre.
- **Reglas preservadas (bisturí):** RPC fuente · snapshots por item · propio/subalq · VU armado 1:N · margen override · overrides nullables · cambio de tipo con confirmación · cascada al cambiar precio insumo · BOM jerárquico · markup vs margen. Todo vive en `persist()`/`_recalcularUnaReceta()`/RPC, independiente del DOM.
- **Etapas:** ~~F1 quick-edits inline~~ ✅ (`e9fb2bd`) → ~~F2 editor receta full-screen + fila fantasma + recibo pendiente~~ ✅ (`e9fb2bd`) → ~~F3 variante subalquilado + ficha Insumos full-screen~~ ✅ (`65a27c0`) **HECHAS Y PUSHEADAS (ver PROGRESO §Fase Costos UX).** Resta **F4**: Listas de Precio + Parámetros al mismo sistema de diseño + pulido transversal. **⏳ Falta validación visual de Fede en prod de F1/F2/F3** (`costos.js?v=32`) con una receta real antes de cerrar F4.
- **Cambios técnicos:** `.modal--full` (MEPEX_COMPONENTS.css) · popovers + editor + fila fantasma + recibo en `costos.js` · clases nuevas en `style.css` · bump `costos.js?v=`.
- **Test:** cambiar clasificación/tipo amort. en 2 clics desde la tabla · agregar componente con fila fantasma sin modal · editar cantidad → MP live + precio "pendiente" → Recalcular dispara RPC · subalquilado sin MO · Listas con toggle cotizable inline.

### Fase 10 — Remate UI/UX (Claude Design) *(≈5%)*
- Sistema visual (tokens dark theme + manual de marca) aplicado a cada módulo + **pasada final de coherencia**.
- En PARALELO: Fede pasa info a Meli/Leo para el track CAD.

### Fase 11 — Centro de Tareas (back office transversal) — ✅ v4 FUNCIONALMENTE COMPLETA (EN PRUEBA) *(detalle en PROGRESO · solo futuros menores)*

> **Futuros menores (lo único que queda):** posponer/snooze · recordatorios programados · más afinado de fechas por fuente · (opcional) un trigger SQL si se quiere que las derivadas existan sin abrir la app. La spec/diseño completo quedó abajo como referencia histórica.

> **Estado: diseño abierto.** Pedido por Fede (2026-06-13): "tareas de TODO el back office (compras, administración, etc.), POR ROL y POR PERFIL, según los proyectos ASIGNADOS y los PASOS de esos proyectos. Es compleja, veremos cómo integrarla, pero es importantísima". Lo que sigue es un primer aterrizaje para debatir, NO una spec cerrada.

**🖼️ Mockup clickeable (para decidir sobre algo tangible):** `mockup-centro-tareas.html` (raíz, no-destructivo, 2026-06-13). Selector de rol que **refiltra** la bandeja · grupos Vencidas/Hoy/Esta semana/Sin fecha · cards con origen/prioridad/semáforo/Tomar-Hecha · toggle Mis tareas/Del equipo · patrón *claim por pool*.

**✅ v1 CONSTRUIDO Y WIREADO (2026-06-13, EN PRUEBA):** `tareas.js` (módulo `Tareas`) + ruta `#tareas` + item en sidebar PRINCIPAL (todos los roles) + DDL `sql/fase11_tareas.sql`. Decisiones aplicadas: generación **cliente reusando patrones de Alertas** · **por-item** · **claim por pool**. Generadores defensivos (try/catch c/u) para **taller** (pasos de checklist), **compras** (pedidos + OCs a aprobar), **rrhh** (docs por vencer + ausencias a aprobar), **crm** (cotizaciones por cerrar ≤7d), **eventos** (sin stands ≤7d). Manual + Tomar/Hecha contra tabla `tareas` (degrada si la tabla no existe). **⏳ Pendiente Fede:** correr `sql/fase11_tareas.sql` + hard-refresh + testear `#tareas` por rol. **Refinamientos siguientes:** fecha_límite real en pasos de taller (join armado del evento) · más fuentes (inventario/finanzas/locaciones) · vista "Del equipo" con reasignar · notificación al asignar · **sync inverso** (marcar "Hecha" una tarea derivada de taller tilda el checklist origen).

**✅ v2 (2026-06-13, EN PRUEBA):** vista **HECHAS** (las completadas dejaron de desaparecer — bug que reportó Fede) + filtro de estado (Abiertas/Hechas/Todas) + **barra de stats** (Pendientes/En curso/Hechas) + **"+ Nueva tarea"** manual (modal: título/desc/módulo/prioridad/fecha/asignar a mí o a un rol) + **Reabrir** + eliminar manuales + responsable visible en "Del equipo". Icono = **check verde** (SVG en título + ✅ en sidebar). **+ iso MEPEX en el saludo del Lobby.** Bumps tareas v2/data v14/lobby v6.

**✅ v3 (2026-06-13):** **fecha límite real** en pasos de taller (= armado del evento, con prioridad por proximidad) · fuentes nuevas **inventario** (stock bajo) y **locaciones** (docs por vencer) · **sync inverso** (marcar Hecha un paso de taller **tilda el checklist origen**) · **reasignar a persona** en Del equipo (admin/pm) · **editar** tareas manuales · **notificación** al asignar a rol/persona (campana). Bump tareas v3. Quedan futuros: fuente finanzas/vencimientos · posponer/snooze · búsqueda · persistir filtro por usuario.

**Visión.** El único lugar donde cada persona entra y ve "¿qué tengo que hacer YO hoy?", sin importar de qué módulo venga la tarea. Hoy los pendientes están dispersos (taller=cards, compras=OCs sin aprobar, finanzas=vencimientos, RRHH=docs por vencer). El Centro de Tareas los consolida en una **bandeja personal por perfil**, donde cada tarea sabe a qué proyecto/paso/rol pertenece y quién la tiene que cerrar.

**Dos naturalezas de tarea:**
- **Derivadas (automáticas):** nacen de un paso de proyecto, una asignación o una regla de negocio ("tildar Gráfica del stand X", "aprobar OC #42", "renovar ART de Diego"). El sistema las crea/cierra solo; el usuario solo ejecuta.
- **Manuales (ad-hoc):** alguien crea una tarea suelta y se la asigna a sí mismo o a otro perfil/rol.

**Diferenciador vs el motor `Alertas` (Fase 9):** Alertas computa estado vivo AGREGADO (badges/dots, efímero) → "¿qué pasa en el sistema?". Tareas es PERSISTENTE, asignable, con dueño, vencimiento y ciclo de vida (pendiente→en curso→hecha) + historial → "¿qué tengo que hacer YO?". **Decisión a tomar:** que Tareas sea **una fuente más** de Alertas, no un sistema paralelo.

**Modelo de datos tentativo — tabla nueva `tareas` (UUID, soft-delete, alineada a eventos/proyectos/profiles).** Campos clave:
- Asignación dual: `responsable_id` (perfil concreto, nullable) **Y/O** `target_role` (pool de rol). Patrón *claim*: cuando un miembro del pool la toma → se setea `responsable_id` + `estado='en_curso'`.
- Contexto/origen: `origen` (paso_proyecto/asignacion/compra/finanzas/rrhh/manual) · `modulo` (deep-link) · `proyecto_id`/`evento_id` (nullable) · `paso_ref_tipo`+`paso_ref_id` (fila origen: checklist item, OC, vencimiento).
- Ciclo de vida: `estado` (pendiente/en_curso/hecha/cancelada/bloqueada) · `prioridad` (normal/alta/critica, reusa escala de `notifications`) · `fecha_limite` (semáforo + orden).
- Derivadas: `es_derivada` BOOLEAN + `dedupe_key` TEXT (UNIQUE WHERE es_derivada AND NOT _deleted) → el generador no duplica; cierra la tarea cuando la fila origen se cierra.
- Auditoría: `created_by`/`completada_por`/`completada_at`/`created_at`/`_deleted`.

**Cómo se DERIVAN (el corazón de la fase)** — un generador (SQL trigger vs job en `Alertas`, a decidir) materializa/cierra tareas por `dedupe_key` desde fuentes que YA existen:

| Fuente | Regla → tarea | Responsable |
|---|---|---|
| `taller_proyecto_checklist` (items sin tildar) | 1 tarea por item pendiente | `taller` + encargado del proyecto |
| `proyectos.estado_taller` | avanzar stand al siguiente estado | PM (`proyecto_responsables`) |
| `asignaciones_evento` (estado `propuesta`) | confirmar convocatoria de \<persona\> | admin / PM creador |
| `compras` (OC pendiente de aprobación) | aprobar OC #N | `admin` |
| `comprobantes_recibidos`/`vencimientos_*` | registrar/pagar | admin/finanzas |
| `persona_documentos` (doc por vencer) | renovar \<doc\> de \<persona\> | admin/RRHH |

El vínculo **proyecto→perfil ya existe** (no hay que inventar): `proyectos.responsable_id` + `proyecto_responsables`. Los **"pasos"** = items de `taller_proyecto_checklist` (editable por proyecto) + transiciones de `estado_taller`. La **persona afectada** = `asignaciones_evento` (persona↔evento↔fase↔`jornada_id`).
> **Recomendación inicial:** arrancar **client-side reusando `Alertas`** (ya recorre esas fuentes) para validar UX, migrar a trigger SQL si escala.

**Vista por rol/perfil** — módulo nuevo `tareas` (`#tareas`, todos los roles, contenido filtrado): "Mis tareas" (default, agrupadas Hoy/Vencidas/Esta semana/Sin fecha) · "Del equipo" (admin/superadmin/PM, con reasignar) · filtros módulo/proyecto/evento/estado/prioridad · lista (desktop) + cards (mobile, reusa patrón Taller) · acciones tomar/en curso/hecha/reasignar/posponer/abrir contexto. **La pestaña "Hoy" de Taller pasa a ser una vista filtrada del Centro** (`target_role='taller'`) — unifica.

**Integración con notificaciones** — reusa `notifications` + campana (no se duplica): al crear/asignar → `createNotification(..., link='#tareas?t=<id>')`; al vencer → notif `alta`; `Alertas` suma un tipo `tareas` (badge sidebar). NO se crea un segundo sistema de avisos.

**Dependencias / orden:** reusa `notifications`, `Alertas`, `proyectos.responsable_id`+`proyecto_responsables`, `asignaciones_evento`, `taller_proyecto_checklist`+`estado_taller`, `roles`+RLS Capa 2, patrón cards de `taller.js`. Conviene **después de Fase 4** (estados de taller + asignaciones estables) y **Fase 5** (para derivar tareas de OCs). No depende del cotizador. Esqueleto (`tareas` manual + "Mis tareas") puede arrancar en paralelo; sumar generadores de a uno.

**Gap real detectado:** las personas operativas (cuadrillas/eventuales) muchas veces NO tienen `profile` → no pueden ser `responsable_id`. (Pregunta abierta #7.)

**Preguntas abiertas para Fede (a charlar):** (1) granularidad: ¿1 tarea por item de checklist o 1 por proyecto que abre el checklist? (2) generación SQL trigger vs job en `Alertas`: ¿las derivadas existen aunque nadie abra la app? (3) claim por rol: ¿la toma el primero o se asigna explícito? ¿quién reasigna? (4) alcance v1: ¿solo taller+compras+RRHH y después finanzas/admin, o todo de una? (5) tareas manuales: ¿cualquiera asigna a cualquiera, o jerarquía? (6) `proyecto_novedades` → ¿convertir novedad en tarea con un clic? (7) personal sin login: ¿sus tareas las ve el encargado o quedan fuera de v1? (8) recurrencia (cierres mensuales, renovaciones): ¿v1 o futuro?

---

## 🆕 Ideas de mejora pendientes *(del análisis ultracode 2026-06-12 — lo ya hecho está en PROGRESO §Infra)*
- **Cache-busting automático por git-hash** en vez de bumps `?v=N` manuales: un script (pre-commit/paso del deploy) que reescribe los `?v=` con el short-hash del commit. Elimina la clase de bug "pusheé pero no se ve". (Hecho parcial: el `check.sh` ya valida que el bump esté; falta automatizarlo.)
- **No-cache para index.html en nginx** (parte del loop deploy, `docs/vps-deploy-loop.md` §B): mata el "hard refresh tras cada pull". ⏳ pendiente de instalar.
- **RPC `ajustar_stock(item_id, delta)` atómico** antes de que el remito de Fase 4 descuente inventario (hoy el update es read-modify-write no atómico → race; impacto bajo hoy, crece con el remito). De paso decidir destino de `insumos_base.stock_actual`/`stock_minimo` sin uso.
- **Tab CRUD de `mapeo_cuentas` + panel de cobertura** en Contabilidad (qué categorías de ingreso/egreso NO tienen mapeo → no generan asiento): convierte el seed en feature mantenible por Sofi/Lelean. Engancha con la auditoría de Fase 8. (El seed base YA está; esto es la capa de mantenimiento.)
- **Protocolo "mockup clickeable primero"** para decisiones de diseño abiertas (showcase catálogo, historial de remitos, planilla del evento): generar un HTML no-destructivo en raíz y que Fede decida sobre algo tangible (como funcionó con `mockup-oc-v2.html`).
- **`docs/DROP_CHECKLIST.md`** ✅ CREADO (2026-06-13) — los DROP de tablas legacy cuelgan sin registro vivo: `rrhh_asignaciones`/`rrhh_vacaciones`/`rrhh_vacaciones_solicitudes` (sin lectores → DROPeables ya) · `logistica_movimientos`/`logistica_vehiculos`/`rrhh_personal` (en Fase 4). Crear doc con la lista + dependencias verificadas vía `docs/mapa-tablas.md` + fecha "safe to run".
- **`tools/SETUP.md` + pre-commit hook** ✅ CREADO (2026-06-13) — `tools/check.sh` existe pero sin instalación: `.git/hooks/pre-commit` → `./tools/check.sh` (bloquea commit si falla sintaxis/bump) + CI opcional. Quick-win contra el "pusheé pero no se ve".
- **`docs/MIGRATION_LOG.md`** ✅ CREADO (2026-06-13) — ~70 SQL en `/sql/` sin registro de qué se corrió/cuándo/por quién. Log manual + (futuro) tabla `sql_migrations`. Mata la incertidumbre "¿este SQL ya está aplicado?".

## TRACKS PARALELOS *(fuera de la SPA — conectados por el Catálogo; NO los ejecuta Claude Code)*

**Track CAD / Diseño 3D** *(Meli/Fede):* BricsCAD Mechanical (planos VIEWBASE/VIEWSECTION) + 3dsMax (renders). Estandarizar biblioteca OCTEXA (codigo_pieza, categoria, dimensiones, es_grafica) alineada a Supabase. Scripts LISP/MaxScript → v1 exportan BOM a CSV (carga manual); API REST cuando madure. Handoff: `MEPEX_Handoff_Diseno`.

**⭐ Configurador de stands 2D** *(sube de relevancia):* venta rápida SIN diseñador ("lo hace cualquiera"). Prediseñados + brand kit → visual brandeado. ImageMagick spike hecho. **⚡ Mismo motor que las gráficas de Fase 6.** A profundizar.

---

## Cómo seguir (en la charla nueva)
1. Leer `PROGRESO.md` (lo hecho + %) + este archivo (lo que falta) + `BRIEF-ARRANQUE-CODE.md` (protocolo).
2. Preguntar a Fede si hago `git fetch && git reset --hard origin/main` (baseline `c2439fc`) y arrancar en branch `rediseno`.
3. Tomar la **próxima fase** (recomendado: cerrar **Fase 2** con 2B/2C, o saltar a la fase que Fede priorice) → reconocer código real → proponer + preguntar → ejecutar por sub-bloques (commit + push + test) → al cierre, rebalancear % entre PROGRESO y PLAN-MAESTRO.
