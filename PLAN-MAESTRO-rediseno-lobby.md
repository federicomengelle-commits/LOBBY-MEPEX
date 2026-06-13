# PLAN MAESTRO — Rediseño integral LOBBY-MEPEX  ·  RESTANTE ≈ 50%

> **Documento vivo = lo que FALTA hacer.** Lo que YA se hizo vive en `PROGRESO.md` (≈50%). No repetir acá lo que está en PROGRESO.
> *(Rebalanceo 2026-06-13: −RRHH.2 −RRHH.3 hechos → mitad del rediseño. El universo había crecido 2026-06-12 con la Fase 9.bis "Roles & Permisos: fuente única + scoping por fila/RLS" ≈3%.)*
> *(Rebalanceo 2026-06-11: el universo creció — la mini-fase RRHH ≈3% se expandió a la fase RRHH v2 ≈8% con diseño cerrado.)*
> **Regla de los 2 archivos (Fede, 2026-06-07):** al cierre de cada sesión → mover lo completado de PLAN-MAESTRO a PROGRESO, rebalancear los % (PROGRESO sube, PLAN-MAESTRO baja), y **sumar acá las ideas nuevas** que vayan saliendo para fases más adelante.
> **Companions:** `PROGRESO.md` (hecho + %), `RECONOCIMIENTO-LOBBY.md` (estado del código), `BRIEF-ARRANQUE-CODE.md` (protocolo).
> **Workflow:** branch `rediseno` para desarrollar; commit por sub-bloque; merge `--ff-only` a `main` + `git push origin main` para que Fede pullee en el server y pruebe. SQL-first en fases con DDL (Fede corre el SQL en Supabase, después se pushea el JS).
> **Baseline actual:** `origin/main` @ `7023857` *(actualizado 2026-06-13 — RRHH.1/2/3 + infra)*.

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

### 🆕 Fase RRHH v2 — módulo completo estilo CRM *(diseño cerrado 2026-06-11 · ≈2% restante · EN CURSO)*
- **✅ RRHH.1 + RRHH.2 + RRHH.3 HECHAS Y PUSHEADAS (2026-06-12/13 — ver PROGRESO §Fase RRHH v2):** RRHH.1 = ALTER `personas` + Nómina v2 estilo CRM. RRHH.2 = tab Ausencias + saldos + retiro lecturas legacy `rrhh_asignaciones`/`rrhh_vacaciones*` (3 DROPeables; `rrhh_personal` hasta Fase 4). RRHH.3 = tab Planificación (grilla persona operativa × quincena + aprobar convocatorias inline, sin DDL). Las tres verificadas end-to-end en prod + review adversarial. ⏳ Falta pull de Fede + verificación visual + correr los DROP comentados de `sql/rrhh2_ausencias.sql` con backup. **Restante de la fase: RRHH.4 (+ RRHH.5 bloqueada).**
- **📘 SPEC OBLIGATORIA: `docs/modulo-rrhh-v2-blueprint.md`** (decisiones, DDL, migración, etapas, tests). El retiro de `rrhh_personal` se cierra en **Fase 4** (lo leen `eventos.js`/`api.js getEventoTransporte` vía el flujo `logistica_movimientos`). Usar `docs/mapa-tablas.md` (regenerable) + `tools/vps/backup-supabase.sh` antes de cualquier DROP.
- **5 tabs estilo CRM** (`.hr-*`): **Panel** (KPIs: activos, trabajando hoy, ausentes, convocatorias, docs por vencer, cumpleaños) · **Nómina** (tabla + panel lateral con sub-tabs Datos/Trabajo/Ausencias/Docs/Notas; ficha completa: dirección, emergencia, CBU/banco, situación previsional — `cuil`/`fecha_nacimiento` YA están en prod, verificado) · **Planificación** (grilla persona × días: asignaciones por color, ausencias gris, conflictos rojo + aprobar convocatorias inline) · **Ausencias** (vacaciones/enfermedad/licencia/franco/falta + saldo anual, sin presentismo diario — solo excepciones) · **Jornales** (lente POR PERSONA, read-only).
- **Decisiones Fede:** sin presentismo · docs solo fechas+semáforo (sin archivos) · sin self-service (todo carga admin; taller no ve RRHH) · sueldos internos FUERA (viven en Finanzas) · la CARGA de jornales vive en Finanzas ("Planilla del evento", ver Fase 8).
- **Etapas** (cada una deployable, SQL-first): ~~RRHH.1 ficha+Nómina v2~~ ✅ **HECHA** → ~~RRHH.2 Ausencias+migración+retiro legacy~~ ✅ **HECHA** → ~~RRHH.3 Planificación~~ ✅ **HECHA** → RRHH.4 Panel+Docs+alerta `documento_por_vencer` (≈1.5%) → RRHH.5 Jornales (≈0.5%, **⛔ bloqueada por la pieza "Rendimiento por evento" de Finanzas**; el resto NO depende de nada).
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
  - **⛔ BLOQUEADO POR DATA (verificado 2026-06-08):** el modelo existe — stand→cotización→`cotizacion_items` (`cotizacion_id, catalogo_item_id, cantidad`)→`catalogo_items` (`tipo_receta='subalquilado'` + `proveedor_id_directo`)→`proveedor`. PERO `cotizacion_items` está **VACÍA**: el **cotizador (app del VPS, ya NO Notion; hoy usan Maple para lo último)** todavía no escribe los items en Supabase. Además `cotizaciones` **no tiene `proyecto_id`** → falta el link cotización↔proyecto. **DECISIÓN FEDE pendiente:** que el cotizador del VPS escriba `cotizacion_items` (con flag propio/subalq por línea). Sin eso la agregación/PDF da 0. (Catálogo de subalquiler sí clasificado en Costos: 7 items.)
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
- **⚠ SYNC 2026-06-12 (verificado git + REST contra prod):** las Fases **G y H del blueprint finanzas YA están codeadas en main** (commits `9402b17`→`149e30c`, 2026-05-27/28): G.1 SQL cuentas dif. cambio 4.9.01/5.9.01 · G.2 tab "Mapeos auto." en Contabilidad · G.3 dif. cambio automática · G.4 subtab Mov. extranjeros · G.5 planes multi-moneda · G.6 Balance General + EERR PDF · H saldos apertura (tab + SQL). **SQL G.5 y H corridos en prod** (verificado: `plan_cobro.moneda` y tabla `saldos_apertura` existen). **Pendiente confirmar** (RLS bloquea verificación anon): seed G.1 (¿existen las cuentas 4.9.01/5.9.01?) y si `mapeo_cuentas` tiene filas — **NO re-implementar nada de G/H**. La conciliación ya tiene wizard 4 pasos (finanzas.js ~9011, desde abril).
- Revisar **todos los endpoints** + **integridad cruzada** (modificar uno modifica otro: asientos, libros). **Análisis completo de La PyME.**
- **✅ Seed de `mapeo_cuentas` YA HECHO Y FUNCIONANDO (verificado en prod 2026-06-12, sesión autenticada):** 12 mapeos activos (4 ingreso por servicio SRV-* + 8 egreso por categoría), cuentas G.1 4.9.01/5.9.01 existen, y los asientos automáticos SE GENERAN (6 de los últimos 8 asientos son `automatico` linkeados a ingresos/egresos). El "bug de asientos en vacío" del CLAUDE.md §10 quedó RESUELTO en algún momento post-mayo — NO re-seedear. `saldos_apertura` existe con 0 filas (esperable, apertura 2027 pendiente de carga). Pendiente real de Fase 8: backfill de asientos para movimientos confirmados ANTES del seed (si los hay sin asiento) + auditoría de integridad.
- Contabilidad ya semi-armada → ajustar copiando el funcionamiento fino de La PyME.
- **🆕 "Rendimiento por evento" — EN DISEÑO (charla aparte, prompt entregado 2026-06-11):** reemplaza el Excel de pagos de Lelean. Dos piezas: (1) **Planilla del evento** (grilla inline de carga rápida: jornales por persona / fletes / proveedores que facturan POR EVENTO — teles, muebles JD, audiovisual, MultiLED — + seguros + comida; estados pendiente/pagado con adelantos y pagos en tandas; pagar ítem → egreso propio, pagar seleccionados → egreso consolidado; asiento automático; OC de Compras read-only sin duplicar) y (2) **dashboard de ganancia por evento** (Σ ingresos proyectos − costos evento − costos proyecto, con materiales de inventario). Al cerrar aquel diseño se suma acá con su % y se rebalancea. **El tab Jornales de RRHH v2 (RRHH.5) depende de esta pieza** (contrato: ítems jornal con persona_id/fase/dias/tarifa/monto_pagado/egreso_id).
- **Test:** por definir según el análisis.

### Fase 9 — Transversal: GLOBAL ✅ COMPLETA (charla 03 — ver PROGRESO §Fase 9) *(solo quedan deudas/ideas futuras)*
- **🔔 Centro único de notificaciones ✅ HECHO (charla 03 — ver PROGRESO §Fase 9):** motor único `Alertas` (9.1) + campana 2 capas Novedades/Pendientes (9.2) + página completa + silenciar tipos por usuario (9.3). Verificado en prod. *(Decisiones: dos capas · campana + página · rol + silenciar tipos.)*
- **Capa GLOBAL en el menú ✅ HECHO (9.4, `fb3e755`):** categoría GLOBAL en el sidebar con Panel de Control (superadmin) + Centro de notificaciones (todos).
- **Stats por usuario ✅ HECHO (9.5, `0e100ee`):** tab Actividad en el Panel (acciones 7d/30d, días activos, módulo top, gráfico 14d, última actividad). *Pendiente futuro:* tiempo de sesión exacto — `audit_log` no loguea login/logout, habría que registrarlos (o usar `last_seen_at`).
- **Lobby/Home por rol ✅ HECHO — Híbrido (9.6, `11f83da`):** venta/pm aterrizan en el Lobby (home por rol con sus KPIs + contenido); taller sigue directo a su tablero (ULTRA simple). *Idea futura suelta:* bloque de estado de Taller en el home de admin (no pedido).
- **🆕 Ideas del centro (charla 03):** silenciado cross-device (`profiles.notif_prefs`, DDL) en vez de localStorage por navegador; permitir silenciar también tipos de *pendientes* y/o que el mute apague los dots del sidebar; separar el badge en 2 números (no-leídas vs pendientes) si Fede lo prefiere. Limpiar `settings._getNotifPrefs/_setNotifPrefs` muertos.

### 🆕 Fase 9.bis — Roles & Permisos: fuente única + scoping por fila (RLS) *(≈3% · transversal · deuda del Panel SuperAdmin)*

> **Síntoma reportado (Fede, 2026-06-12):** la matriz de Roles y Permisos del Panel de Control "nunca está actualizada — no copia lo nuevo". Diagnóstico verificado contra el código: **no hay fuente única.** Conviven 5 definiciones paralelas que driftean.

**🔎 Causa raíz (verificada):** la matriz arma sus **filas** desde una lista hardcodeada `admin-panel.js:1215` (`_permModules`) que quedó vieja — le falta `flota`/`calendario`, todavía muestra `parametros-globales` (eliminado, hoy en Costos). Los **valores** write/read/none sí salen de la tabla `roles` de Supabase (esa parte OK). Pero al guardar un rol: (1) las filas son una lista a mano que no refleja los módulos reales, y (2) el resto de la app (`settings.js`, sidebar, lobby) lee de `Data.rolePermissions` (copia en memoria que **solo** se refresca en login vía `loadRolesFromDB`, fire-and-forget en `auth.js:133`). ⇒ un cambio en el Panel no se ve en ningún lado hasta re-loguear.

**Las 5 fuentes que driftean:** (1) `Data.modules`/`categories` = qué módulos existen · (2) `Data.rolePermissions`/`readOnlyPermissions` = arrays "fallback" · (3) tabla `roles.permissions` JSONB = fuente *declarada* · (4) `admin-panel._permModules` = filas de la matriz, **la más vieja** · (5) `profiles.custom_permissions` = override por usuario. Encima **2 formatos**: JSONB `{mod: write/read/none}` vs arrays planos sin distinción read/write.

**🔧 Capa 1 — RBAC de módulos (fuente única). Lo que pidió Fede ("todo espejo de una fuente"):**
- **Catálogo de módulos = derivado de `Data.modules`** (la lista real del sidebar). La matriz del Panel itera ESA, no `_permModules` → mata el drift de filas. Borrar `_permModules`.
- **Permisos por rol = SOLO la tabla `roles` (Supabase).** `Data.rolePermissions` queda únicamente como fallback offline, idealmente auto-derivado de `roles`.
- **Refresco inmediato:** al guardar en el Panel → re-`loadRolesFromDB()` + re-render de las pantallas afectadas. Sin esperar al próximo login.
- **Un solo formato** `{mod: nivel}` (none/read/write). Migrar `custom_permissions` a ese formato (override por usuario *sobre* el rol; hoy es array plano sin niveles).
- **Un solo resolver en runtime:** todo pasa por `Auth.hasPermission(mod)`. Eliminar las lecturas directas a `Data.rolePermissions` (hoy `settings.js:481/576/590/620` las usa → desincronizado del Panel).
- **Test:** editar un permiso en el Panel → se refleja sin re-login en sidebar + settings + lobby; agregar un módulo nuevo aparece solo en la matriz; ningún módulo fantasma.

**🔐 Capa 2 — Scoping por fila + RLS (lo de "venta ve solo lo propio"). HOY NO EXISTE:**
- Es OTRA cosa que el RBAC de módulos. Hoy el sistema decide *"ves el módulo o no"* (+ read/write), **no** *"qué filas ves dentro"*. Los datos ya tienen los ganchos (`vendedor_id`, `responsable_id`/`proyecto_responsables`, `created_by`) pero **las queries de listado no filtran por usuario** → un "venta" trae TODOS los proyectos/clientes, no los propios.
- **Modelo de scope por rol (a definir fino con Fede):** superadmin/admin = todo · **venta** = donde es `vendedor_id` (sus clientes/cotizaciones/proyectos) · **pm** = donde es responsable (`proyecto_responsables`/`responsable_id`) · **taller** = lo pasado a producción / asignado. Calendario operativo / Panel / Finanzas = ocultos por rol (eso ya es Capa 1).
- **⚠ CRÍTICO — el filtro va en RLS de Supabase, no solo frontend.** Casi todo es client-side con la anon key → aunque la UI esconda, un usuario puede pedir todo igual con la key. **Es un agujero de seguridad real, no solo UX.** Requiere policies por tabla (`clientes`/`proyectos`/`cotizaciones`/`eventos`/…) que mapeen `auth.uid()` → rol → scope. Carga SQL no trivial + testeo por rol cuidadoso (que no rompa lo que admin/superadmin sí ven).
- **Test:** loguear como venta → solo aparecen sus proyectos/clientes en UI **y** la query directa a Supabase con su token tampoco devuelve los ajenos.

**Orden sugerido:** Capa 1 primero (fix acotado, sin riesgo, resuelve el síntoma visible). Capa 2 después (fundacional, tocar con bisturí, SQL-first, una tabla por vez con RLS + verificación). Las dos son separables.

### Fase 10 — Remate UI/UX (Claude Design) *(≈5%)*
- Sistema visual (tokens dark theme + manual de marca) aplicado a cada módulo + **pasada final de coherencia**.
- En PARALELO: Fede pasa info a Meli/Leo para el track CAD.

---

## 🆕 Ideas de mejora pendientes *(del análisis ultracode 2026-06-12 — lo ya hecho está en PROGRESO §Infra)*
- **Cache-busting automático por git-hash** en vez de bumps `?v=N` manuales: un script (pre-commit/paso del deploy) que reescribe los `?v=` con el short-hash del commit. Elimina la clase de bug "pusheé pero no se ve". (Hecho parcial: el `check.sh` ya valida que el bump esté; falta automatizarlo.)
- **No-cache para index.html en nginx** (parte del loop deploy, `docs/vps-deploy-loop.md` §B): mata el "hard refresh tras cada pull". ⏳ pendiente de instalar.
- **RPC `ajustar_stock(item_id, delta)` atómico** antes de que el remito de Fase 4 descuente inventario (hoy el update es read-modify-write no atómico → race; impacto bajo hoy, crece con el remito). De paso decidir destino de `insumos_base.stock_actual`/`stock_minimo` sin uso.
- **Tab CRUD de `mapeo_cuentas` + panel de cobertura** en Contabilidad (qué categorías de ingreso/egreso NO tienen mapeo → no generan asiento): convierte el seed en feature mantenible por Sofi/Lelean. Engancha con la auditoría de Fase 8. (El seed base YA está; esto es la capa de mantenimiento.)
- **Protocolo "mockup clickeable primero"** para decisiones de diseño abiertas (showcase catálogo, historial de remitos, planilla del evento): generar un HTML no-destructivo en raíz y que Fede decida sobre algo tangible (como funcionó con `mockup-oc-v2.html`).

## TRACKS PARALELOS *(fuera de la SPA — conectados por el Catálogo; NO los ejecuta Claude Code)*

**Track CAD / Diseño 3D** *(Meli/Fede):* BricsCAD Mechanical (planos VIEWBASE/VIEWSECTION) + 3dsMax (renders). Estandarizar biblioteca OCTEXA (codigo_pieza, categoria, dimensiones, es_grafica) alineada a Supabase. Scripts LISP/MaxScript → v1 exportan BOM a CSV (carga manual); API REST cuando madure. Handoff: `MEPEX_Handoff_Diseno`.

**⭐ Configurador de stands 2D** *(sube de relevancia):* venta rápida SIN diseñador ("lo hace cualquiera"). Prediseñados + brand kit → visual brandeado. ImageMagick spike hecho. **⚡ Mismo motor que las gráficas de Fase 6.** A profundizar.

---

## Cómo seguir (en la charla nueva)
1. Leer `PROGRESO.md` (lo hecho + %) + este archivo (lo que falta) + `BRIEF-ARRANQUE-CODE.md` (protocolo).
2. Preguntar a Fede si hago `git fetch && git reset --hard origin/main` (baseline `c2439fc`) y arrancar en branch `rediseno`.
3. Tomar la **próxima fase** (recomendado: cerrar **Fase 2** con 2B/2C, o saltar a la fase que Fede priorice) → reconocer código real → proponer + preguntar → ejecutar por sub-bloques (commit + push + test) → al cierre, rebalancear % entre PROGRESO y PLAN-MAESTRO.
