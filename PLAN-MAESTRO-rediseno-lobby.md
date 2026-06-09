# PLAN MAESTRO — Rediseño integral LOBBY-MEPEX  ·  RESTANTE ≈ 52%

> **Documento vivo = lo que FALTA hacer.** Lo que YA se hizo vive en `PROGRESO.md` (≈48%). No repetir acá lo que está en PROGRESO.
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

### Fase 9 — Transversal: GLOBAL ✅ COMPLETA (charla 03 — ver PROGRESO §Fase 9) *(solo quedan deudas/ideas futuras)*
- **🔔 Centro único de notificaciones ✅ HECHO (charla 03 — ver PROGRESO §Fase 9):** motor único `Alertas` (9.1) + campana 2 capas Novedades/Pendientes (9.2) + página completa + silenciar tipos por usuario (9.3). Verificado en prod. *(Decisiones: dos capas · campana + página · rol + silenciar tipos.)*
- **Capa GLOBAL en el menú ✅ HECHO (9.4, `fb3e755`):** categoría GLOBAL en el sidebar con Panel de Control (superadmin) + Centro de notificaciones (todos).
- **Stats por usuario ✅ HECHO (9.5, `0e100ee`):** tab Actividad en el Panel (acciones 7d/30d, días activos, módulo top, gráfico 14d, última actividad). *Pendiente futuro:* tiempo de sesión exacto — `audit_log` no loguea login/logout, habría que registrarlos (o usar `last_seen_at`).
- **Lobby/Home por rol ✅ HECHO — Híbrido (9.6, `11f83da`):** venta/pm aterrizan en el Lobby (home por rol con sus KPIs + contenido); taller sigue directo a su tablero (ULTRA simple). *Idea futura suelta:* bloque de estado de Taller en el home de admin (no pedido).
- **🆕 Ideas del centro (charla 03):** silenciado cross-device (`profiles.notif_prefs`, DDL) en vez de localStorage por navegador; permitir silenciar también tipos de *pendientes* y/o que el mute apague los dots del sidebar; separar el badge en 2 números (no-leídas vs pendientes) si Fede lo prefiere. Limpiar `settings._getNotifPrefs/_setNotifPrefs` muertos.

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
