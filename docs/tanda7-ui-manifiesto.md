# TANDA 7 por UI — 20 casos clic a clic

> Ejecutado el 2026-08-28 en produccion, con sesion de Fede (superadmin), por navegador.
> Los datos quedan **como demo**. Este archivo es el manifiesto para borrarlos impecable cuando se pida.

## Reglas de la corrida

1. **NO se emite en ARCA.** Regla dura de Fede: llegar hasta el ultimo paso del wizard, ver el preview,
   y NO confirmar. Ninguna factura, ninguna nota de credito. La plomeria fiscal se prueba con
   **carga manual de comprobante emitido** (registro local, sin CAE, reversible, no toca AFIP).
2. Todo lo creado lleva sufijo **`(demo)`** en nombres visibles + queda anotado aca por UUID.
3. Se crea **por UI** (que es donde viven los bugs de modales/races/filtros) y se verifica el
   impacto en las pantallas + contadores exactos.

## Foto previa (2026-08-28, antes de tocar nada)

| | |
|---|---|
| asientos vivos | 34 |
| DEBE = HABER | $35.970.740,00 |
| ingresos / egresos | 7 / 11 (los 18 **anulados**) |
| comprobantes emitidos / recibidos | 2 / 0 |
| clientes | 254 |
| proyectos / eventos | 7 / 7 |
| cotizaciones / casos CRM | 3 / 6 |
| planes de cobro / cuotas | 0 / **8** <- huerfanas, ver H-01 |
| valores en cartera / transferencias | 0 / 0 |
| creditos fiscales / ventas | 0 / 0 |

## Matriz de los 20 casos

| # | Circuito | Rama | Medio | Canal | Estado |
|---|---|---|---|---|---|
| 1 | Cliente nuevo -> caso CRM -> cotizacion -> aprobar -> proyecto | Stand | - | - | |
| 2 | Plan 50/50 -> comprobante -> cobro | Stand | transferencia | oficial | |
| 3 | 2do stand mismo evento (prueba H3: nombres distintos) | Stand | efectivo | oficial | |
| 4 | Plan 30/40/30 -> cobro parcial | Expo | e-cheq | oficial | |
| 5 | Cobro sin factura -> Anticipos de clientes | Expo | cheque fisico | interno | |
| 6 | Alquiler de equipamiento contado | Equipamiento | transferencia | interno | |
| 7 | Cobro con retencion (credito fiscal) | Equipamiento | transferencia | oficial | |
| 8 | Instalacion electrica | Energia | mercadopago | oficial | |
| 9 | Compra: OC -> recepcion -> comprobante recibido -> egreso | - | transferencia | oficial | |
| 10 | Subalquiler imputado a evento (prueba H4: cuenta 5.1.02) | - | efectivo | oficial | |
| 11 | Transferencia interna entre cuentas | - | - | - | |
| 12 | E-cheq recibido -> endoso a proveedor | - | e-cheq | - | |
| 13 | Jornales: asignar personal -> rendimiento -> pagar | - | efectivo | interno | |
| 14 | Logistica: vehiculo + chofer + transporte + remito | - | - | - | |
| 15 | Calendario: 5 eventos sin pisarse + conflicto de persona | - | - | - | |
| 16 | Taller: ciclo pendiente->armado->listo->despachado + entrega firmada | - | - | - | |
| 17 | Inventario: alta de insumo + movimiento de stock | - | - | - | |
| 18 | Costos: editar receta -> recalcular -> precio | - | - | - | |
| 19 | Contabilidad: asientos + libros IVA + EERR de todo lo anterior | - | - | - | |
| 20 | Anulacion: anular cobro y gasto -> contra-asiento -> vuelta a cero | - | - | - | |

## Inventario de lo creado (para el borrado)

### Eventos (5)
| UUID | Nombre |
|---|---|
| 72c7073a-3b0c-42ed-9c30-85f82bcbc6a3 | Expo Gastronomica Sur 2026 (demo) |
| 027ead0e-77f7-46d4-a18c-367e3686992d | Congreso Medico Nacional 2026 (demo) |
| 7e057659-c338-4168-84cd-37cc66493de9 | Feria Industrial Zona Norte 2026 (demo) |
| 743edece-1309-4a3a-8b78-abf7187b7f72 | Salon Inmobiliario 2026 (demo) |
| 2d814f1d-edfd-4289-a5e9-6ae9ea42cf4f | Encuentro Pyme Lanus 2026 (demo) |

Cuelgan de ellos: `evento_jornadas` (25 filas) y `asignaciones_evento` (11 filas).
**Borrado**: `delete from asignaciones_evento where evento_id in (...)` ->
`delete from evento_jornadas where evento_id in (...)` -> `update eventos set _deleted=true where id in (...)`.

## Hallazgos

| # | Que encontre | Donde | Gravedad |
|---|---|---|---|
| **1** | **Una persona se asigna a dos eventos el mismo dia sin ningun aviso.** Braian Ayala quedo en el armado de Expo CAPPI y en el de Encuentro Pyme el 10-nov, las dos `aprobada`. `API.detectarConflictosPersona` existe y lo usa el modal de Logistica, pero el modal "Agregar gente al evento" de la ficha **no lo llama**. El dia del armado falta gente en un lado y nadie se entera hasta ese dia | `eventos.js` modal agregar gente | **Alta** |
| **2** | **Se acepta una jornada de desarme ANTERIOR al armado**, sin validacion en la pantalla ni en la base. Verificado: Feria Industrial quedo con ARMADO 19-oct / DESARME 18-oct, y la ficha lo muestra sin marcarlo. `fn_evento_jornadas_sync` solo hace MIN/MAX por fase, no compara entre fases. La validacion cronologica existe en el modal de crear/editar evento, **pero no en el de jornadas, que es donde se cargan las fechas de verdad** | `eventos.js` modal jornadas + `fn_evento_jornadas_sync` | **Alta** |
| **3** | **Los modales no se remueven del DOM al cerrarse: se apilan.** Llegue a 4 `.modal-overlay` vivos. Consecuencia real, no cosmetica: despues de guardar, el usuario queda mirando un modal vacio identico al que acaba de completar y **no sabe si se guardo**; y los clicks siguientes pueden ir a una copia vieja (me paso) | `components.js` / `eventos.js` | **Media** |
| **4** | **El filtro "Todos los predios" acumula opciones en cada render**: 35 opciones para 7 predios distintos. Cada vez que se vuelve a la pantalla suma otra tanda | `eventos.js` filtros | **Media** |
| **5** | **El modal "Editar jornadas" no dice de que evento es.** Me equivoque de fila y estuve a un click de pisarle las fechas a Expo CAPPI (evento real, con gente asignada) creyendo que editaba uno de prueba. El titulo deberia llevar el nombre del evento | `eventos.js` | **Media** |
| **6** | El cartel dice *"Sin jornadas. Toca el lapiz para armar la tabla"* pero **el lapiz solo aparece al pasar el mouse por encima**. En una tablet no hay hover: el cartel manda a un boton que no existe | `eventos.js` | Baja |
| **7** | **`Silla Jacobsen` esta marcada cotizable con precio $0.** Si entra a una cotizacion, sale gratis | `catalogo_items` id 258 | Media |
| **8** | **8 cuotas de plan de cobro huerfanas**: `plan_cobro_items` tiene 8 filas y `plan_cobro` 0 planes vivos. Confirmado por pantalla: Planes de cobro decia "No hay planes" con esas 8 filas en la base | Finanzas | Baja |
| **9** | **Al cobrar una cuota, el plan NO se refresca en pantalla.** Verificado: la cuota quedo `cobrado` con `monto_cobrado` correcto en la base —el fix F4 anda—, pero la pantalla siguio mostrando **0% cobrado** y la cuota **"Pendiente"** con su boton "Cobrar" activo. Recien al recargar aparece 50% y "✓ Cobrado". **El riesgo es concreto: el operador cobra, ve "Pendiente", y vuelve a cobrar** — dos ingresos por la misma cuota | `finanzas.js` planes de cobro | **Alta** |
| **10** | El prefill de "Cobrar cuota" trae monto, concepto y proyecto, **pero no el cliente**, aunque el proyecto tiene uno. Si el operador no lo elige a mano, el cobro queda sin cliente y no aparece en su cuenta corriente | `finanzas.js` | Media |
| **11** | *(observacion, ya estaba abierta como H9)* **Reproducida por UI**: una transferencia de Galicia (canal oficial) a Caja Oficina (canal interno) deja el asiento en canal **oficial**. Plata que entro a una cuenta interna queda contabilizada como oficial | Tesoreria | Baja |

| **12** | 🔴 **El comprobante recibido NO calcula neto ni IVA, y el Libro IVA Compras sale en CERO.** El campo dice **"Auto si pones total"** y no calcula: cargue una Factura A de Aglolam por **$1.210.000** y quedo con `neto = NULL` e `iva = NULL` en la base. **Evidencia visual: el Libro IVA Compras de agosto muestra la fila con NETO $0,00 · IVA $0,00 · TOTAL $1.210.000, y los TOTALES en $0,00.** Eso es lo que va a la **DDJJ**: se pierden **$210.000 de credito fiscal por comprobante**. Nada valida que `neto + iva = total`. **⚠️ No es nuevo: PROGRESO del 2026-08-05 ya documenta el mismo sintoma** (*"el CSV del Libro IVA Compras... cero si el auxiliar se cargo por total"*) — se arreglo el CSV, **no la carga**. Ademas, al generar el pago el asiento sale sin la linea de IVA credito fiscal `1.1.09` | `finanzas.js` comprobante recibido | **🔴 Alta — es plata** |
| **13** | El numero del comprobante recibido se guarda con un prefijo de mas: cargue `0004-00009876` y el Libro IVA lo muestra como **`0000-0004-00009876`** | `finanzas.js` / libro IVA | Baja |

| **14** | **El semaforo de stock solo puede decir "todo ok".** El dashboard muestra **BAJO EL MINIMO: 0 · todo ok** y el cartel *"Todo el stock esta en niveles normales y los equipos operativos"*. Medido: de **83 insumos, 82 tienen stock CERO** y **ninguno tiene stock minimo cargado**. No es que este todo bien: **es que no hay contra que comparar**, asi que la alerta no puede encenderse nunca. Mismo patron que el Libro IVA: **un cero que parece un dato y es una ausencia**, y encima tranquiliza | `inventario.js` dashboard | Media-alta |
| **15** | **El mismo item fisico tiene DOS stocks que no se hablan.** El buscador de movimientos lista "Reflector LED 100w" dos veces, `{pieza}` y `{material}`. Cargue una entrada de 25 al material y quedo asi: `insumos_base` #84 = **25** · `catalogo_items` #6 = **50**. En el galpon hay UN monton de reflectores. **Es exactamente el problema de "si se modifica una punta tiene que modificarse la otra"** | `insumos_base` vs `catalogo_items` | **Alta (arquitectura)** |

## Falsos positivos descartados (valen tanto como los hallazgos)

| que parecia | por que NO es bug |
|---|---|
| *"El alta de cliente desde el caso pierde los datos"* | Artefacto de mi automatizacion: sete el `<select>` por codigo. Repetido **con teclado real** anduvo — cliente creado y caso vinculado. **Regla: un bug de formulario no se reporta sin repetirlo a mano.** |
| *"TOTAL PIPELINE $0,00 con 8 casos y montos cargados"* | El KPI es de **cotizaciones**, no de casos. La unica cotizacion no terminal (COT-2026-0003) tiene `monto_total = 0`, asi que **suma bien**. El dato real es otro: hay una cotizacion **enviada a un cliente con monto en $0** |
| *"El modal no se cierra"* | Se habian **apilado 4 modales** por mis propias aperturas; cada Escape cerraba uno. El leak de DOM (bug 3) es real, pero "no cierra" no |


---

## Estado al pausar (2026-08-28)

Se pausa la simulacion para implementar la **pasarela de brief en el CRM** (pedido de Fede).
**Los datos quedan vivos como demo.** Lo recorrido:

- ✅ **5 eventos** creados con predio, organizador y fechas
- ✅ **25 jornadas** (armado / evento / desarme) en 4 de los 5; el 5o (Salon Inmobiliario)
  queda a proposito **sin jornadas**, que es un estado legitimo (evento cargado, sin planificar)
- ✅ **11 asignaciones** de personal con rol, todas `aprobada`
- ✅ Verificado el impacto: fechas derivadas por trigger, KPI "Prox. armado", tabla de eventos
  y **carriles del calendario operativo con las 3 fases**
- ✅ **2 casos CRM** + **1 cliente** creado desde el propio alta
- ✅ **2 proyectos** creados desde la ficha del evento (evento preseleccionado, cliente vinculado)
- ✅ **2 cobros** con **asiento automatico balanceado y ruteo correcto por medio y canal**:
  transferencia/oficial -> DEBE `1.1.04 Banco Galicia` · efectivo/interno -> DEBE `1.1.01 Efectivo (mano)`,
  los dos contra HABER `2.1.06 Anticipos de clientes` (**criterio correcto**: cobro sin factura
  no es venta). El toggle Oficial/Interno filtra bien: el cobro interno no aparece en la vista oficial
- ✅ **3 cobros por 3 medios y 2 canales**, todos con asiento automatico balanceado:
  transferencia/oficial -> DEBE `1.1.04 Banco Galicia` · efectivo/interno -> DEBE `1.1.01 Efectivo (mano)` ·
  **e-cheq -> DEBE `1.1.07 Cheques a cobrar`, SIN tocar el banco, y con su fila en `cartera_valores`**.
  Los tres contra HABER `2.1.06 Anticipos de clientes` (correcto: cobro sin factura no es venta)
- ✅ **1 egreso** — y **verifica por UI el fix H4 del 20/8**: un subalquiler imputado a proyecto
  fue a **`5.1.02 Proveedores/subcontratistas`** (costo directo) y NO a `5.2.02 Alquiler oficina`
- ⏸ **Falta**: cotizaciones, planes de cobro, comprobantes, cheque fisico/mercadopago,
  compras (OC), tesoreria, taller, inventario, costos y contabilidad

### Observacion nueva (no es bug, es un hueco)

**El modal de egreso tiene campo Proyecto pero NO campo Evento.** El fix H4 (`categoria_directo`)
aplica cuando el egreso esta imputado **a proyecto o a evento** — pero por pantalla solo se puede
imputar a proyecto. Un gasto de un evento que no tiene proyecto (jornales de una expo, flete del
predio) **no puede rutearse a costo directo desde este modal**.

### Falso positivo descartado (vale tanto como un hallazgo)

Reporte inicial: *"el alta de cliente desde el caso pierde los datos"*. **No es un bug.**
Al repetirlo con teclado real, el cliente se creo y el caso quedo vinculado. El primer intento
fallo porque **yo sete el `<select>` por automatizacion** y eso no reproduce lo que hace una
persona. Queda como regla: **un bug de formulario no se reporta sin repetirlo a mano.**


---

## Foto al cierre de la noche (2026-08-28)

| | previa | ahora |
|---|---|---|
| asientos vivos | 34 | **42** |
| DEBE = HABER | $35.970.740 | **$45.020.740** |
| desbalanceados | 0 | **0** |
| ingresos / egresos | 7 / 11 | 12 / 13 |
| eventos / proyectos | 7 / 7 | 12 / 9 |
| clientes / casos CRM | 254 / 6 | 256 / 8 |
| planes de cobro | 0 | 1 |
| valores en cartera | 0 | 1 |
| transferencias | 0 | 1 |
| comprobantes recibidos | 0 | 1 |
| **comprobantes EMITIDOS** | 2 | **2 — no se emitio ninguno** |

**Jornadas demo: 22 · asignaciones: 53.**

### Como borrar todo esto, cuando se pida

```sql
-- 1) los 5 eventos demo y lo que cuelga
--    72c7073a / 027ead0e / 7e057659 / 743edece / 2d814f1d
delete from asignaciones_evento where evento_id in (...);
delete from evento_jornadas    where evento_id in (...);
update eventos set _deleted=true where id in (...);

-- 2) plan de cobro y sus 2 cuotas  -> update plan_cobro set _deleted=true ...
-- 3) los movimientos: ANULAR por UI, no borrar. El candado de T4.2 rechaza el
--    soft-delete de un movimiento contabilizado y manda a Anular, que es lo
--    correcto: genera el contra-asiento y no deja el asiento huerfano.
-- 4) comprobante recibido de Aglolam, cliente 'Distribuidora Norte SRL (demo)',
--    proyectos 'Stand 6x4 — Distribuidora Norte' y 'Stand 3x3 — Akadia',
--    y los 2 casos CRM.
```

### Lo que NO se toco, a proposito

- **ARCA**: cero emisiones. Se llego al preview del wizard y se salio sin confirmar.
- **Los 2 comprobantes de Olavarria**: son los unicos con CAE real de AFIP.
- **Los precios del catalogo**: la tabla de diferencias espera aprobacion de Fede.
- **El item 89** (panel negro), que sigue congelado.


## Verificado despues (2a tanda de la noche)

- ✅ **Anulacion con contra-asiento**: anular el cobro en efectivo genero el asiento **#123 "Reversion"**
  con las lineas **exactamente invertidas** del #116 original (DEBE 2.1.06 / HABER 1.1.01). No borra:
  deja traza. Y el dialogo avisa de antemano que **"se dan de baja sus retenciones y lo aplicado a las
  cuotas"**. **Cierre: 43 asientos, DEBE = HABER = $45.820.740, 0 desbalanceados.**
- ✅ **Movimiento de stock**: la entrada de 25 unidades subio el stock del insumo de 0 a 25.
- ⓘ Nota fina: **la lista de cobros SI se refresca al anular**, y el plan de cobro **no** se refresca al
  cobrar (hallazgo 9). O sea que no es una limitacion del framework: es que en un lugar se hizo y en el
  otro se olvido.

---
---

# FASE 0 — continuación (2026-08-29)

> Lo que faltaba relevar según `docs/tanda7-orden-de-correccion.md` §Fase 0:
> **costos · taller · compras con OC · el transversal**.
> Misma regla: NO se emite en ARCA. Todo lo creado lleva `(demo)`.

## Caso 9 — Compra: OC → recepción → comprobante recibido → egreso ✅ recorrido entero

**Lo que se creó** (para el borrado): OC **`compras_ordenes` id 16 · OC-0002**, proveedor Aglolam,
imputada al evento *Feria Industrial Zona Norte 2026 (demo)* · 2 ítems (`compras_orden_items` 12 y 13)
· 1 presupuesto ganador en `compras_oc_presupuestos` por $500.000 · movimiento de stock
`inventario_movimientos` id **10** (+10 al insumo 84) · comprobante recibido
`comprobantes_recibidos` **7ea08fed** (0004-00009877, $605.000) · egreso **aeeebb95** ($500.000,
pagado) · asiento **#124**.

**Lo que anduvo bien** (vale tanto como lo que falló):
- La recepción sumó stock y **dejó traza**: movimiento `entrada / compra / OC OC-0002` con su detalle.
- El egreso se generó por el **monto de la ganadora vigente**, leído de la base y no del cache de la
  OC — el código lo hace a propósito, y está bien.
- **`evento_id` se propagó** de la OC al egreso, y el asiento **#124** ruteó a
  **`5.1.02 Proveedores / subcontratistas`** (costo directo) y no a `5.2.02 Alquiler oficina`.
  **Esto verifica por primera vez el fix H4 del 20/8 por la ruta de COMPRAS**, y con `evento_id`
  solo (sin proyecto), que es justo el caso que el fix decía cubrir y que nadie había probado.
- El modal de recepción **sí dice de qué OC es** en el título — lo que el hallazgo 5 pide para eventos.

---

## Hallazgos nuevos

| # | Qué encontré | Dónde | Gravedad |
|---|---|---|---|
| **16** | **Todas las fechas de tipo `date` se muestran un día antes.** `new Date('2026-08-29')` lo parsea JS como **medianoche UTC**; renderizado en UTC−3 da **28 de ago**. Verificado mecánicamente en el browser de Fede y contra la base: la OC guardada el 29 dice "28 de ago", la OC-0001 (`2026-07-10`) dice "09 de jul". **No mueve plata entre períodos** — el bucketing fiscal usa `slice(0,7)` sobre el string y los filtros van server-side, así que el Libro IVA agrupa bien. Es display, pero sobre **28 columnas `date` en 17 tablas**: vencimiento de cuota, fecha de cheque, armado y desarme, límite de tarea, fecha de comprobante. **Lo que lo vuelve barato: el idioma correcto YA existe en el repo** (`new Date(f + 'T00:00:00')`) y está aplicado en **66 lugares**; falta en ~23 (2 helpers — `compras.js:895` y `locaciones.js:359`, con 11 llamadas — más ~12 sitios inline). Mismo patrón de siempre: se arregló en un lugar y se olvidó en el otro | transversal | **Alta** |
| **17** | **El picker de insumo/pieza no puede expresar la diferencia, y descarta lo que elegís.** El desplegable ofrece dos filas con el **mismo `value`** ("Reflector LED 100w"), una etiquetada `insumo` y otra `pieza`. Como en un `<datalist>` lo que viaja es el `value`, el código resuelve por nombre y `_invRef()` se queda **siempre con el insumo**. Verificado: elegí la **pieza** y guardó `insumo_id: 84`, `catalogo_item_id: null`. Para esos ítems la rama `catalogo_item_id` es **inalcanzable desde esta pantalla**. El comentario del código dice que la colisión es *"rara (materia prima vs producto terminado)"*: **son 30 de 83 insumos**, y son justamente **los muebles y electrodomésticos que MEPEX alquila** (todas las Sillas, Sillones, Mesas, Taburetes, Heladeras, TVs, Microondas, Cafetera, Reflectores, Matafuegos). Los que NO colisionan son las materias primas | `compras.js` `_invRef` | **Alta** |
| **18** | **Hallazgo 15, medido: la divergencia está DORMIDA, no es chica.** Hoy sólo 2 de los 30 pares tienen stock distinto (Reflector 100w **35 vs 50** después de esta compra, Reflector 50w 0 vs 30) **porque los otros 28 están en cero de los dos lados**. El día que se cargue el galpón —que es el pendiente A2 y la precondición del hallazgo 14— los 30 divergen de una. **La fuente única de stock hay que decidirla ANTES del relevamiento físico, no después.** Dato extra: existe una **tercera** tabla de stock, `locaciones_stock` (`locacion_id`, `insumo_id`, `cantidad`), **vacía** — que es justo la forma que necesita un stock por galpón | arquitectura | **Alta** |
| **19** | **`compras_ordenes.monto_total` tiene dos escritores y un solo rótulo.** Lo escribe `_recalcTotal` (suma de ítems) y lo escribe `_recomputeOCGanadora` (monto de la ganadora); gana el último que corrió. La pantalla lo rotula **"Monto Total (ganadora)"**. Verificado: ganadora $500.000, ítems $480.000 → la ficha muestra **"(ganadora) $480.000"** justo encima del presupuesto que dice **"$500.000 GANADORA"**, la lista de OC muestra $480.000, y el KPI **"Monto abierto" queda $20.000 corto**. El egreso sale bien ($500.000) → **no se pierde plata, se pierde el número en el que uno se apoya para aprobar** | `compras.js` + `api.js` | **Media-alta** |
| **20** | **El circuito de compra se bifurca en la plata y las dos ramas no se conocen.** La OC genera su egreso por el **monto de la ganadora** (un número solo, sin IVA y sin comprobante), y el comprobante recibido genera **otro** egreso por el **total con IVA**. No hay dedup entre las dos ramas (`_egresoForOC` matchea por el texto "OC N°" en el concepto; `generarEgresoDeComprobante` sólo se cuida de sí mismo), **y no hay forma desde ninguna pantalla de atar un comprobante a un egreso que ya existe** (ni el modal de egreso tiene campo comprobante, ni el de comprobante tiene campo egreso). Resultado real de este caso: egreso $500.000 pagado + factura $605.000 "Sin pago", **sin crédito fiscal en el asiento** (#124 salió con 2 líneas, sin `1.1.09`), y si alguien clickea "Generar pago" en la factura quedan **$1.105.000 de egresos por una compra de $605.000** | `api.js` + `finanzas.js` + `compras.js` | **Alta — es plata** |
| **21** | **La imputación a EVENTO se guarda y no se muestra en ningún lado.** La ficha de la OC calcula "Imputación" mirando sólo `proyecto_id` (y `categoria_gasto` de fallback) → una OC imputada a un evento muestra **"—"**. El panel de detalle del egreso tampoco tiene fila de evento: dice "Proyecto —" y listo. Y es **la imputación la que decide el ruteo contable** (fix H4) → hoy no hay forma de ver por pantalla por qué un gasto fue a costo directo | `compras.js:1572` · `finanzas.js` | Media |
| **22** | **El número de OC no es único ni estable.** El correlativo se calcula sobre las OC vivas, así que **reusa números de las borradas**: hay `OC-0001` viva (id 15) y borrada (id 4), y `OC-0002` viva (id 16) y borrada (id 7); las próximas van a chocar con `OC-0003` (borrada, estado **pagada**) y `OC-0004`. No hay índice único. **El número se imprime en el PDF que se le manda al proveedor** | `compras_ordenes` | Media |
| **23** | **El modal de crear/editar OC sólo ofrece 3 estados** (Pendiente / Aprobada / Pagada) y el circuito tiene 4: falta **Recibida**. Editar una OC ya recibida con ese modal la manda a un estado que no eligió nadie | `compras.js` `_showOrdenModal` | Media |
| **24** | **El KPI "Bien calificados" de Proveedores sólo puede decir 0** — 143 proveedores, ninguno con calificación cargada. Mismo patrón que el hallazgo 14 (el semáforo de stock) y que el 12 (el Libro IVA): **un cero que parece un dato y es una ausencia, y encima tranquiliza** | `compras.js` | Baja |
| **25** | **Datos de proveedores partidos entre columnas.** "Alfa solar" tiene rubro `Insumos (smart tv` y dirección `pie de piso)` — un CSV importado que se cortó en la coma de adentro del paréntesis. Vale contar cuántos más hay antes de que alguien mande un mail o un remito a una dirección así | `proveedor` | Baja |
| **26** | **`_renderOrdenItemsTable` interpola `nombre` y `notas` crudos en el HTML** (el módulo tiene `_esc`/`_escAttr` y ahí no los usa), y el nombre del ítem es texto libre. Modelo de amenaza interno, pero es el mismo agujero que se tapó en `modules.js` y `locaciones.js` en la fase 12.A | `compras.js:1682` | Media |
| **27** | **La pestaña "Pagos" se retiró del shell pero su código sigue viajando**: `_loadPagos`, `_renderPagos`, `_showPagoModal` y sus helpers (~150 líneas) quedaron inalcanzables. Mismo caso que `modules.js` en agosto | `compras.js:2059+` | Baja |

### Confirmaciones de hallazgos ya abiertos

- **Hallazgo 12 reproducido con un segundo caso.** Cargué una Factura A de $605.000 poniendo sólo el
  Total y quedó `neto = NULL`, `iva = NULL`. Ahora el **Libro IVA Compras de agosto** muestra **dos**
  facturas, **$1.815.000 de total**, y **NETO $0,00 · IVA $0,00 · TOTALES $0,00** →
  **$315.000 de crédito fiscal invisibles para la DDJJ**. El campo sigue prometiendo *"Auto si ponés
  total"* y no calcula, ni siquiera al salir del campo. Nada valida que `neto + iva = total`.
  Y el **CUIT quedó vacío** en las dos filas del libro sin que nada avise.
- **Hallazgo 13 reproducido.** Cargué `0004-00009877`, la base lo guarda bien, y el Libro IVA lo
  muestra **`0000-0004-00009877`**: el prefijo se agrega al renderizar. En el mismo libro el tipo
  sale como `factura_a` crudo en vez de "Factura A".

### Falsos positivos descartados (valen tanto como los hallazgos)

| qué parecía | por qué NO es bug |
|---|---|
| *"El modal de editar egreso no tiene campo Evento, así que guardarlo borra `evento_id`"* | **Probado: no lo borra.** Guardé el egreso desde ese modal y `evento_id` quedó intacto (el UPDATE es parcial). Era el riesgo más grave que se podía imaginar acá —habría re-roteado el gasto a "Alquiler oficina", que es el bug que H4 vino a arreglar— y no existe. El hueco es de **entrada y de vista**, no de pérdida de dato |
| *"El Libro IVA agrupa mal por el bug de fechas"* | **No.** El bucketing por período usa `slice(0,7)` sobre el string y los filtros van server-side con `gte/lte` → inmune a la zona horaria. El hallazgo 16 es sólo de display. Confirmado además en pantalla: el libro mostró 28/8 y 1/8 correctos |
| *"El modal de agregar ítem se abre vacío / fantasma"* | Artefacto de mi captura: el screenshot salió a mitad de la transición CSS. El DOM tenía **un solo** overlay, opacidad 1. **Regla nueva para mí: después de abrir un modal, la captura va en llamada aparte.** El hallazgo 3 (modales que se apilan) sigue siendo real, pero no se reprodujo en este circuito |
| *"Emitidos dice 'Total: $0,00' con dos comprobantes de $1.000"* | Es el **neteo correcto**: son una FC B de $1.000 y su NC B de $1.000, que la anula. El saldo de las dos es cero — que es exactamente lo que arregló la sesión del 24/8 |

---

## Caso 16 — Taller: ciclo del proyecto + entrega firmada ✅ recorrido

**Lo que se creó**: el proyecto demo *Stand 6x4 — Distribuidora Norte* (`a5511ebe`) pasó a taller,
se tildaron los **6** ítems de su checklist (`taller_proyecto_checklist`), se registró **1 conforme
de entrega firmado** (`proyecto_conformes`, firma PNG de 10.826 bytes) y se generó el **link de
encuesta** (`encuestas_evento`, token `cc05430d…`).

**Lo que anduvo bien:**
- El **acta de entrega** sale impecable: membrete MEPEX, proyecto/cliente/evento, receptor, tabla de
  elementos, texto de conformidad, firma embebida y pie con sello de tiempo. Fecha correcta (29/08).
- **La firma valida**: intenté firmar con el canvas vacío y lo rechazó.
- `firmado_by` guardó el **UUID real** de auth — el fix de junio (`.uid` y no `.id`) sigue en pie.
- Los diálogos de esta pantalla **sí nombran al proyecto** ("¿Delegar *Stand 6x4 — Distribuidora
  Norte* al taller?", "Entrega del stand · *Stand 6x4 — Distribuidora Norte · Distribuidora Norte
  SRL*"). Es exactamente lo que el hallazgo 5 pide para los modales de Eventos: **el ejemplo a copiar
  ya está adentro de la casa**.
- El link de encuesta se genera y se copia sin login. Correcto.

---

| # | Qué encontré | Dónde | Gravedad |
|---|---|---|---|
| **28** | **El ciclo del taller no se puede terminar desde ninguna cuenta de oficina.** Los botones que avanzan a *Listo* → *Despachado* viven **sólo** en la vista "galpón" de Proyectos, y esa vista se renderiza únicamente si `_userRole === 'taller'` (`proyectos.js:450`). Desde la ficha, lo único que mueve el estado es el primer tilde del checklist, y con un valor **hardcodeado**: `setEstadoTaller(id, 'en_armado')` (`proyecto-detalle.js:807`). Barrido completo: esos son los **dos únicos** llamadores de `setEstadoTaller` en toda la app. Consecuencia: Fede, Lelean, Sofi, Leo y Meli ven un ciclo de 5 pasos del que **sólo pueden empujar el primero**, no pueden corregir un estado mal puesto ni cerrar un proyecto si el del taller se olvidó — y **nada en pantalla dice dónde se hace el resto** | `proyectos.js:450` · `proyecto-detalle.js:807` | **Alta** |
| **29** | **La cabecera "Ciclo del taller" no se entera de lo que pasa abajo, en la misma pantalla.** Tildé un ítem: el badge del checklist saltó a **EN ARMADO** y la base guardó `estado_taller='en_armado'`, `completitud_pct=25` — y la barra de arriba siguió diciendo **"● Pendiente · 0%"**. Se arregla sola al salir de la ficha y volver. El código lo dice en su propio comentario: *"Re-render del contenido del tab"* → `_toggleChecklistItem` sólo repinta `#pjdContent`, nunca el shell. **Es el hallazgo 9 otra vez**, y ésta es la versión más confusa: dos indicadores del mismo estado, uno al lado del otro, y sólo uno se actualiza | `proyecto-detalle.js:796-819` | **Media-alta** |
| **30** | **Completar el 100% del checklist no avanza nada.** Con 6/6 y la barra llena, el badge sigue en "EN ARMADO" y el ciclo en 25%. El auto-avance existe **sólo para el primer tilde** (pendiente→en_armado). El que arma termina todo y el sistema sigue diciendo que está a la cuarta parte | `proyecto-detalle.js` | Media |
| **31** | **Firmar la entrega tampoco mueve el ciclo.** Después del acta firmada, el proyecto sigue en `en_taller / en_armado / 25%`: **el stand está entregado y conformado por el cliente, y el sistema dice que se está armando**. Sumado al 28 y al 30, el resultado es que el ciclo del taller, en la práctica, **muere en el paso 2 de 5** | `proyecto-detalle.js` | Media-alta |
| **32** | **Hay dos tablas de checklist y una está muerta.** La viva es `taller_proyecto_checklist` (37 filas); `taller_checklist` existe con **0 filas** y ningún lector. Residuo de la Tanda 3 | base | Baja |
| **33** | **Un proyecto tiene `completitud_pct` que contradice su propio `estado_taller`**: *Stand 2,00 x 2,00 en Univ. Siglo XXI* está en `pendiente` con **50%** (a `pendiente` le corresponde 0). Es 1 de 9 — dato viejo de antes del fix del trigger de junio, que sólo recalcula cuando la fila se toca | `proyectos` | Baja |
| **34** | **Dos de los tres modos de vista de Proyectos son un cartel de "Próximamente"**: los botones "Vista tarjetas" y "Vista calendario" están activos en la barra y llevan a una pantalla vacía. Están en el aire desde que se construyó la lista | `proyectos.js:456` | Baja |
| **35** | En el acta que firma el cliente, el encabezado de la última columna se parte al medio: **"ENTREGAD / O"**. Es el papel que queda como respaldo de la entrega | `conforme-pdf.js` | Baja |

### Nota de método (me pasó a mí, y cambia cómo verifico)

Verifiqué el hallazgo 29 mal la primera vez: **navegar al mismo hash no recarga nada**, así que
"sobrevivió la recarga" era falso — la pantalla nunca se había vuelto a dibujar. Recién saliendo a
`#lobby` y volviendo apareció el valor correcto. **Regla: para probar que algo persiste hay que
salir de la vista y volver, no re-navegar a la misma URL.**

---

## Caso 18 — Costos: editar una receta de punta a punta ✅ recorrido

**Lo que se creó**: el ítem `catalogo_items` **id 365 · "Mostrador de prueba Tanda 7 (demo)"**
(código `DEMO-T7`, rubro Equipamiento, **`es_cotizable = false`** a propósito → invisible para el
Cotizador), con 1 componente de receta (8 kg de Aluminio pintado) y 180' de mano de obra.
**No se tocó ningún precio real.**

**El motor de costos está sano, y se puede auditar a ojo.** La ficha muestra la fórmula abierta:

```
Costo MP                                  $151.200,00     (8 kg × $18.000 + 5% desperdicio)
+ Mano de obra (180' × $15.000,00/h)       $45.000,00
= Costo fabricación                       $196.200,00
Costo por uso (amort. por componente)       $7.242,00     (151.200/30 +5% reacond + 45.000/30 + 30% indirectos)
× margen (1 + 50%)                            × 1,50
= Precio                                   $10.863,00
```

Verificado contra la base: el **cache** (`precio_alquiler`) y el **recálculo al vuelo** de la RPC dan
**$10.863,00 idénticos**, y los tres snapshots quedaron escritos. La cascada de §6.5 hace exactamente
lo que dice. También andan bien: el desperdicio se muestra por separado (*"$151.200 (sin desp:
$144.000)"*), el VU del armado hereda solo del tipo de amortización del componente, el buscador de
insumos **sí distingue** cada ítem (muestra código y precio unitario — el contraste con el picker de
Compras del hallazgo 17 es total), y el botón de recalcular se pone naranja con el chip
**"● cambios sin recalcular"** apenas tocás algo.

---

| # | Qué encontré | Dónde | Gravedad |
|---|---|---|---|
| **36** | 🔴 **"RECALCULAR TODOS" pondría en $0 a 23 ítems cotizables que hoy suman $1.253.750.** De los **63** ítems cotizables, **24 no tienen receta** — 23 llevan un precio tipeado a mano (Vitrina alta $115.000, Tablero seccional trifásico $105.000, Mostrador recto $50.000, Taburete JB $30.000…) y el otro es la Silla Jacobsen en $0 (hallazgo 7). Probé la RPC en 5 de ellos **sin escribir nada**: `calcular_receta` devuelve **$0,00** en los cinco, porque sin componentes no hay de dónde sacar costo. O sea que el botón que está al lado de "+ Nueva receta", y que cualquiera apretaría para poner las cosas al día, **borra de un click el 37% de la lista de precios que lee el Cotizador**. Son todos `propio`: deberían tener receta y no la tienen | `costos.js` + datos | **Alta — es plata** |
| **37** | **El modal "Nueva receta" nunca se cierra: queda clavado en "Creando…" con el ítem ya creado.** Causa exacta: `Modal.close(instance)` — pero `Modal.close(id)` busca por `m.id === id` y recibe el **objeto** que devuelve `Modal.open()` → `idx === -1` → **`return` silencioso**. El ítem se crea, el toast sale, la ficha se abre detrás… y el formulario sigue ahí diciendo "Creando…". El que lo usa piensa que falló y **lo vuelve a intentar → ítems duplicados**. 👉 **Es el hallazgo 3 explicado**: el overlay nunca sale del stack, así que el siguiente modal se apila arriba. Y ya estaba avisado: CLAUDE.md lo documenta desde el 2026-05-19 (*"Modal.close() requiere `instance.id`"*). **Barrido: son 11 lugares** — 7 en `costos.js` (1053, 1909, 1958, 3788, 3910, 3998, 4030), 1 en `contabilidad.js:5613`, y 3 en `flota.js` (388, 443, 612) donde la variable **se llama `modalId` pero guarda el objeto**. Contra 71 llamadas correctas con `.id` | `components.js` + 3 módulos | **Alta** |
| **38** | **El KPI dice "351 RECETAS" y recetas hay 223.** Cuenta todos los ítems vivos del catálogo, tengan o no componentes: **128 de los 351 no tienen ni una línea de receta**. Al lado, "0 INCOMPLETAS" mientras la tabla muestra decenas de filas con costo "—" y el punto rojo. Es el mismo patrón del hallazgo 14 y del 24, pero al revés: **un número que tranquiliza porque sobra, no porque falte** | `costos.js` | Media |
| **39** | **Dato para la sesión de costos, no bug:** los ítems cotizables pasaron de **9 (medidos el 6/8) a 63**. Alguien marcó 54 más como cotizables. De esos 63, **24 no tienen receta** (hallazgo 36) → el Cotizador está ofreciendo hoy 63 ítems, de los cuales el 38% tiene un precio que ningún cálculo respalda. **Esto es justo el gate que `PUESTA-A-PUNTO-2027.md` pone antes de la carga masiva del catálogo**, y ya está medido: el motor está sano, lo que falta son las recetas | datos | — |
