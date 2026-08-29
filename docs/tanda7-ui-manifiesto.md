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

---

## El transversal — roles, RLS, notificaciones, PWA y push

**Cómo se probó** (cambió respecto de lo acordado, y conviene saber por qué): la idea era mirar los
gates de la UI cambiándole el rol a la sesión viva. **No se puede: la CSP del propio Lobby bloquea
inyectar script en la página** (probado — el `<script>` inyectado no ejecuta). O sea que la CSP que
se puso en julio hace su trabajo. Entonces la capa de base se probó **simulando el JWT de cada rol
por SQL** (`set local request.jwt.claims`), que no necesita ninguna contraseña y mide lo que
realmente importa; y la capa de UI, leyendo los gates del código.

### Lo que anduvo bien

- **La plata está bien cerrada.** Con el JWT de un usuario `taller` y de un `pm`, las cuatro tablas
  del dinero devuelven **0 filas**: `ingresos`, `egresos`, `comprobantes`, `asientos`. El `pm`
  además no ve `cuentas_financieras`, `creditos_fiscales` ni `cartera_valores`.
- **Los jornales están protegidos por privilegio de columna**: `select costo_dia_referencial from
  personas` con JWT de taller da **`permission denied`**, aunque la tabla sí se puede contar. La
  técnica fina existe y está bien aplicada acá.
- **`proyectos` filtra por rol de verdad**: taller ve 6, pm ve 15.
- **La PWA está sana**: `manifest.json` 200 con la marca correcta (standalone, `#00A9C1`, es-AR),
  `sw.js` 200 con `Cache-Control: no-cache, no-store, must-revalidate`, y los **3 íconos existen**
  (192, 512, 512-maskable). Los dos endpoints de push responden 401 → las rutas están montadas.

---

| # | Qué encontré | Dónde | Gravedad |
|---|---|---|---|
| **40** | 🔴 **Hoy un push no puede llegar a ningún teléfono de MEPEX.** Hay **4 suscripciones** en total: 2 de Fede y 2 de Jordi. Miré los user-agent: **las dos de Fede son Chrome en Windows — su celular no está suscripto**; las de Jordi son una Mac y un iPhone. Y el fan-out **siempre excluye al que dispara** (`if (excluirUid) ids.delete(excluirUid)`), así que **Fede no puede mandarse un push a sí mismo**. Sumado: la única forma de que alguien de MEPEX reciba un push hoy es que Jordi cree una tarea urgente. **La infraestructura está bien y el último metro no se caminó** — es el pendiente A4 (armar los 5 dispositivos), ahora medido | `push_subscriptions` | **Alta (bloquea la feature entera)** |
| **41** | **El rol `venta` no existe y nunca existió.** Cero perfiles con ese rol, ni activos ni de baja. Pero el sistema está construido alrededor de él: `Data.rolePermissions` lo define, el router lo gatea y `lobby.js` tiene un layout entero de widgets para `venta`. **Y Noe —la comercial, para quien se diseñó ese rol— es `admin`**, o sea que entra a Finanzas, Contabilidad, Costos y RRHH. La tabla de roles de `CLAUDE.md` describe un reparto que la base no tiene | `profiles` vs `data.js` | **Media-alta** |
| **42** | **El taller puede leer el libro comercial entero.** Con JWT de taller: **`catalogo_items` 353 filas con precio, costo por uso y margen** (máximos leídos: precio $630.000, costo/uso $420.000, **margen 125%**), **`cotizaciones` 17 con monto por un total de $173.173.684**, `clientes` 269 con datos de contacto, e `insumos_base` con el costo de compra. Ninguna pantalla del taller muestra eso —ve Proyectos (galpón) y Tareas— así que **es acceso que no necesita**. Pesa más de lo que parece porque **las cuentas de taller son genéricas y compartidas** (`Taller`, `Depósito`, `Energy`) y el plan de puesta a punto las pone en tablets en el galpón, en modo kiosko. 👉 **La forma de arreglarlo ya está en la casa**: es el mismo privilegio por columna que protege `personas.costo_dia_referencial` | RLS / grants | **Media-alta** |
| **43** | **Las cuentas de taller no son personas.** `Taller`, `Depósito` y `Energy` son logins compartidos. Todo lo que firman —`audit_log`, `firmado_by` de un acta de entrega, quién tildó el checklist— queda a nombre de una cuenta, no de alguien. En un sistema cuyo valor es la trazabilidad, eso vacía la traza justo en el eslabón físico. (De paso: `CLAUDE.md` nombra a Diego, Juan, Carlos y Willy; la base no tiene a ninguno) | `profiles` | Media |
| **44** | **La matriz de preferencias de notificación tiene 0 filas.** `notificacion_prefs` está vacía: **nadie configuró nunca nada**, así que toda la lógica de categoría × canal y el horario de silencio corre siempre por el camino del default y **nunca se ejerció contra una fila real**. Se construyó en julio y no se usó | `notificacion_prefs` | Media |
| **45** | **De los ~28 tipos de aviso catalogados, sólo 10 llegaron a dispararse alguna vez**: `asignacion_pendiente_aprobacion`, `carga_pendiente_aprobacion`, `caso_nuevo`, `encuesta_respondida`, `evento_armado_proximo`, `pedido_compra`, `proyecto_a_taller`, `remito_firmado`, `tarea_asignada`, `vehiculo_tercero_creado`. Los otros 18 no se sabe si andan | `notifications` | Media |
| **46** | **Jordi (consultor externo) es `superadmin` activo**, con acceso a toda la contabilidad y las finanzas. No es un bug —seguro fue a propósito para la consultoría— pero la sesión del 6/8 bajó los superadmin de 7 a 4 justo por esto, y conviene decidir si sigue. Quedan además **11 perfiles de baja**, entre ellos **`Colore` duplicado** (uno admin y uno taller, los dos de baja), que es la decisión que quedó abierta el 20/8 | `profiles` | Baja |

### Nota de método

`stock_minimo` y `equipo_fuera_servicio` aparecen como "nadie los emite" si se buscan con grep:
**los emiten triggers de Postgres**, no el JS. El propio `notifications.js` avisa de esta trampa en
un comentario. La caí igual y la anoto: **el grep del repo no ve los emisores que viven en la base.**

---

## Fase 0 CERRADA — qué va a triage

Los 4 frentes que faltaban quedaron recorridos: **compras con OC · taller · costos · el transversal**.
Total: **hallazgos 16 a 46** (31 nuevos), más 5 falsos positivos descartados y 2 reglas de método.

### Los que son plata, en orden

| # | Qué | Cuánto |
|---|---|---|
| **36** | "Recalcular todos" pone en $0 a 23 cotizables sin receta | **$1.253.750** de lista de precios |
| **12** *(ya abierto)* | Comprobante recibido sin neto/IVA → Libro IVA en cero | **$315.000** de crédito fiscal sólo en 2 facturas |
| **20** | El circuito de compra se bifurca: egreso de la OC (sin IVA) + egreso del comprobante, sin dedup | doble egreso posible; asiento sin crédito fiscal |
| **40** | Ningún teléfono de MEPEX puede recibir un push | la feature entera, parada |

### Cómo caen en las tandas por archivo de la Fase 2

El orden de `tanda7-orden-de-correccion.md` sigue valiendo; esto es dónde entra lo nuevo.

| tanda | archivo | se suma |
|---|---|---|
| **A** — sola y primero | `components.js` | **37** (`Modal.close(instance)` no-op) — **y ahora se sabe que ésta es la causa del hallazgo 3**. Tocar `close()` para que acepte objeto o id arregla los 11 lugares de una |
| **B** | `finanzas.js` | 12 y 13 (neto/IVA y el prefijo del número) · **20** (atar comprobante ↔ egreso) · **21** (mostrar el evento en el detalle del egreso) |
| **C** | `eventos.js` | sin cambios (1, 2, 4, 5, 6) |
| **D** | `inventario.js` | 14, y **18** lo agranda: la fuente única de stock hay que decidirla **antes** del relevamiento físico del galpón |
| **E** | SQL / datos | 7 · 8 · **22** (índice único de N° de OC) · **33** (completitud que se contradice) · **42** (grants por columna en `catalogo_items` y `cotizaciones`) |
| **F** — al final | arquitectura | el bus de refresco, que ahora tiene **4 casos medidos**: hallazgo 9 (plan de cobro), **19** (monto de la OC), **29** (ciclo del taller), y el header de la OC. Y la fuente única de stock (18) |
| **G** — nueva, `compras.js` | `compras.js` | **17** (el picker que descarta lo que elegís) · **19** · **23** (falta el estado Recibida) · **26** (XSS sin escapar) · **27** (código muerto de Pagos) · **16** (`_formatDate`) |
| **H** — nueva, `proyectos.js` + `proyecto-detalle.js` | taller | **28** (nadie de oficina puede cerrar el ciclo) · **29** · **30** · **31** · **34** (vistas "Próximamente") · **35** (el acta) |
| **I** — nueva, transversal | varios | **16** (las fechas −1 día, ~23 sitios) · **40** (dispositivos) · **41** (el rol `venta`) · **43** (cuentas compartidas) · **44** y **45** (notificaciones) |

### Lo que sólo puede hacer Fede

1. **Decidir sobre el hallazgo 36 antes de que alguien apriete el botón.** Las 24 recetas faltantes
   son carga de datos, no código.
2. **El rol `venta`** (41): o se le crea el rol a Noe, o se saca del sistema. Hoy son 5 roles en el
   código y 4 en la realidad.
3. **Los 5 dispositivos** (40) — sin eso el push no existe.
4. **Jordi superadmin** y los 11 perfiles de baja, incluido `Colore` duplicado (46).
5. **Las cuentas de taller compartidas** (43): decidir si el galpón entra con cuentas por persona.

### Datos demo agregados hoy (para el borrado)

| qué | id |
|---|---|
| OC-0002 + 2 ítems + 1 presupuesto | `compras_ordenes` **16** |
| Movimiento de stock (+10 al insumo 84) | `inventario_movimientos` **10** |
| Comprobante recibido Aglolam $605.000 | `comprobantes_recibidos` **7ea08fed** |
| Egreso "OC OC-0002" $500.000 **pagado** | `egresos` **aeeebb95** → asiento **#124** |
| Ítem de catálogo con receta | `catalogo_items` **365** (`DEMO-T7`, `es_cotizable=false`) |
| Checklist 6/6 + conforme firmado + encuesta | proyecto `a5511ebe` |

⚠️ El egreso **aeeebb95 está pagado y tiene asiento**: se **anula por UI**, no se borra (el candado
de T4.2 lo rechaza, y con razón — anular genera el contra-asiento).

---

## Corrección al hallazgo 8 (verificado el 2026-08-29, antes de tocar nada)

**El hallazgo 8 es un falso positivo, y menos mal que se miró antes de borrar.**

Decía: *"8 cuotas de plan huérfanas: `plan_cobro_items` tiene 8 filas y `plan_cobro` 0 planes vivos"*.
La cuenta comparaba **el total** de una tabla contra **las filas vivas** de la otra. Mirando fila por
fila: las 8 tienen `_deleted = true` **y su plan también** — se borraron juntos. **La cascada del
soft-delete funciona.** Hoy hay 10 filas: 8 borradas (con sus 2 planes borrados) y 2 vivas, que son
las del plan demo de anoche. `v_plan_cobro_resumen` devuelve exactamente eso: 1 plan, 2 cuotas,
1 cobrada, $3.000.000 de $6.000.000.

**Regla que confirma:** para decir que algo está huérfano hay que mirar las dos puntas con el mismo
criterio de vivo/borrado. Contar `count(*)` de un lado y filtrar del otro fabrica huérfanos que no
existen — y el arreglo habría sido borrar 8 filas legítimas.

**Lo que sí apareció al mirar** (y no estaba anotado): queda **1 fila residual en
`cobro_aplicaciones`** (`47d0d4fd`) que apunta a una cuota borrada, de un ingreso que después se
**anuló**. Ni la baja de la cuota ni la anulación del cobro limpian esa tabla. **Es inerte**: el
`monto_cobrado` de esa cuota quedó en 0 (o sea que `fn_recalcular_cuota_plan` sí excluye los
anulados) y la vista de resumen no la cuenta. Queda anotado como **hallazgo 47 (Baja)**: la
aplicación de cobro sobrevive a la baja de las dos puntas.

---

## Ampliación del hallazgo 2 (leí `fn_evento_jornadas_sync` el 2026-08-29)

Confirmado el mecanismo: la función hace **tres UPDATE independientes**, uno por fase, cada uno con
su `MIN(fecha)` / `MAX(fecha)`. **No compara nunca una fase contra otra**, así que un desarme anterior
al armado le resulta perfectamente válido. Es exactamente lo que decía el hallazgo.

**Y hay una segunda falla en la misma función, que no estaba anotada.** Los tres UPDATE terminan en:

```sql
WHERE e.id = v AND s.fmin IS NOT NULL
```

Cuando se borran **todas** las jornadas de una fase, el agregado devuelve `fmin = NULL` y el guard
saltea el UPDATE → **el evento se queda con las fechas viejas de una fase que ya no tiene jornadas**.
No hay forma de vaciar el armado de un evento: queda mostrando un armado que no existe, y de ahí
comen el calendario operativo, el KPI "Próx. armado" y el aviso de armado a 7/2 días.

**Las dos cosas se arreglan en el mismo lugar** cuando toque la tanda: comparar las tres fases entre
sí, y dejar que la fase sin jornadas ponga sus fechas en NULL en vez de saltear el UPDATE.
Queda como **hallazgo 48 (Media)**.

---
---

# FASE 2 · TANDA A — el leak de modales *(hecha y verificada, 2026-08-29)*

Archivos: `components.js` · `router.js` · **`cobranza.js`** (la excepción está justificada abajo).
Versiones: `components.js?v=19` · `router.js?v=27` · `cobranza.js?v=6` · **`app.js?v=55`**.

## Eran dos causas, no una

1. **`Modal.close()` no aceptaba el objeto que devuelve `Modal.open()`.** Comparaba `m.id === id`
   contra un objeto, no matcheaba nunca, y salía por un `return` mudo. Ahora tolera el objeto
   (y el id como string numérico), y **avisa por consola** cuando el id no existe: un cierre que
   no cierra es de los bugs más caros justamente por ser silencioso.
2. **El router no cerraba los modales al navegar.** Hacía teardown de módulos desde la fase 12.A,
   pero el modal quedaba en el DOM, en `Modal._stack` y con su Escape colgado de `document`. Ahora
   `Modal.closeAll()` corre antes de renderizar la ruta nueva. Cierra en **cualquier** cambio de
   hash, no sólo al cambiar de módulo, y es a propósito: pasar de `#proyectos/5` a `#proyectos/6`
   con un modal del 5 abierto es justo la forma de editarle las fechas al evento equivocado.

**Corrección al hallazgo 37: son 13 llamadas mal hechas, no 11.** Se me habían escapado dos en
`costos.js` (`progressInstance`, líneas 2898 y 3551) porque mi grep buscaba nombres que empezaran
con `instance`/`modal`. Las cazó el reviewer. **Y esas dos son el modal de progreso de "Recalcular
todos"** — el mismo botón del hallazgo 36 — así que hasta hoy ese modal también quedaba clavado.
Reparto real: **9 en `costos.js`, 1 en `contabilidad.js`, 3 en `flota.js`**, contra 71 llamadas
correctas con `.id`.

## Los dos HIGH del reviewer, verificados y arreglados

| # | Qué | Dónde |
|---|---|---|
| **49** | **El aviso nuevo sonaba en CADA "Cancelar" de CADA confirmación.** El botón Cancelar de `Modal.confirm()` llevaba `data-modal-close` **y** su propio handler `cleanup(false)`: dos listeners sobre el mismo click, los dos llamando a `close()`. El primero cerraba de verdad; el segundo entraba con un id que ya no estaba en el stack. Mientras `close()` era mudo no se notaba. **`Confirm.delete()` y `Confirm.action()` son wrappers de esto**, o sea toda confirmación de borrado de la app. El ruido tapaba exactamente la señal que el aviso viene a dar. Arreglado en la raíz: se le sacó el `data-modal-close`, porque cerrar y resolver la promesa es una sola cosa y la hace `cleanup` | `components.js` `confirm()` |
| **50** | 🔴 **Se podía borrar del bucket un certificado de retención mientras la cobranza se guardaba.** `Cobranza.abrir()` pone `onClose: () => this._limpiarCertificadosHuerfanos()`, que borra todo lo que esté en `_retenciones`. La invariante que lo hacía seguro —*"después de un guardado exitoso `_retenciones` se vacía"*— **tiene una ventana**: el array se vacía recién DESPUÉS de que `registrarCobranza` resuelve. Cerrar el modal en ese intervalo borra archivos que la fila de `creditos_fiscales` va a referenciar igual → **un crédito fiscal sin respaldo, con un "Cobranza registrada" impecable en pantalla**. El bug es previo, pero **antes pedía un click deliberado en la X, Escape o el fondo durante el request; desde que el router cierra al navegar, lo alcanza cualquier click en el sidebar**. Arreglado con un guard sobre `_guardando` | `cobranza.js` |

**Por qué se tocó `cobranza.js` estando fuera de la tanda:** porque el cambio del router vuelve
alcanzable por navegación normal una pérdida de dato que antes era casi inalcanzable. Dejarlo para
su tanda significaba publicar el agujero abierto. Es una línea, en el archivo dueño de la invariante,
y no toca nada más.

**El intercambio que asume el guard:** si el guardado falla y el modal ya se cerró, el archivo queda
huérfano en el bucket. Es el lado correcto: un archivo de más ocupa lugar, uno de menos es un crédito
fiscal que no se puede justificar.

## Cómo se verificó

- **Node, 19 asserts** sobre `Modal` con un DOM mínimo: cerrar por objeto, por id, por string
  numérico, sin argumentos, con id inexistente, `closeAll`, el desenganche del Escape y que `onClose`
  corra una sola vez. **El mismo harness contra el código de antes del fix da 12 fallas**, así que la
  prueba sirve.
- **Navegador real** contra el server local, en pestaña limpia:
  - En el **login**, `Modal` está `undefined` (`components.js` es diferido y `router.js` es CORE) y
    el router **no rompe** — que era el riesgo del cambio.
  - Con **dos modales abiertos**, navegar deja **el stack y el DOM en cero**.
  - `Modal.close(objeto)` cierra y saca del DOM.
  - `confirm()`: Cancelar resuelve `false`, Confirmar resuelve `true`, Escape resuelve `false`, y
    **0 warnings** en los tres. Contra el código viejo, cancelar producía **1 warning** — probado en
    las dos direcciones.
  - **Cero errores de consola.**

## Lo que el reviewer dejó anotado y NO entra acá

`ContextMenu` tiene su propio overlay y sus propios listeners globales de `document`, y el router no
lo toca: si se abre uno y se navega antes de cerrarlo, queda colgado. No es regresión de esta tanda
—ya era así— pero es el mismo agujero que ésta cierra para los modales. Queda como **hallazgo 51
(Baja)**, para la tanda F.

---
---

# FASE 2 · TANDA J — `costos.js` *(2026-08-29)*

## 🔴 Corrección grande: el hallazgo 36 era FALSO POSITIVO

Lo había puesto **primero de todo el triage**, como el mayor riesgo de plata de la sesión
(*"Recalcular todos pone en $0 a 23 cotizables, $1.253.750"*). **No es cierto: los dos caminos de
recálculo ya los excluyen.** Lo verifiqué de tres formas.

**1 · En el código.** `_recalcularTodasRecetas` no recorre el catálogo entero: filtra antes.

```js
const targets = items.filter(i => itemsConReceta.has(String(i.id)) || i.tipoReceta === 'subalquilado');
```

Y el botón "Recalcular precio" de la ficha tiene un guard explícito desde F.13.2, con el mismo
razonamiento que yo creí estar descubriendo:

```js
// F.13.2 — Edge case: item propio sin componentes. La RPC devolvería
// costo=0 y precio=0 silenciosamente. Avisamos y abortamos.
```

**2 · Probándolo, no leyéndolo.** Le saqué el componente a mi ítem demo (365) para dejarlo en la
misma condición que los 23 —propio, sin receta, con precio cacheado— y apreté **Recalcular precio**.
Salió el aviso *"Este item propio no tiene componentes"* y **la base quedó intacta**: precio
$10.863,00 y `snapshot_costos_at` sin moverse. Después le devolví el componente.

**3 · Midiendo el único hueco que quedaba.** El filtro de "Recalcular todos" deja pasar a los
`subalquilado` **sin** componentes, que sí irían a $0. Pregunté a la base cuántos hay con precio
mayor a cero: **ninguno**. El único subalquilado sin receta es la Silla Jacobsen, que ya está en $0
(hallazgo 7).

> **La lección, y me la aplico a mí:** encontré que la RPC devuelve $0 y salté a *"entonces el botón
> los rompe"* sin preguntarme si algo llama a la RPC sobre esos ítems. **Un motor que puede devolver
> un valor peligroso no es un bug si nadie lo llama con esos datos.** Fue leer el efecto en vez de
> leer el camino. Es la misma clase de error que el hallazgo 8: una conclusión sacada de un lado
> solo.

### Lo que SÍ es verdad, y sigue importando

De los **63 ítems cotizables, 24 no tienen ni una línea de receta**: 23 llevan un precio tipeado a
mano por **$1.253.750** y el otro es la Silla Jacobsen en $0. **No hay ningún botón que los rompa** —
pero tampoco hay forma de que el motor los mantenga al día: el día que cambie el precio del aluminio,
esos 23 quedan viejos y **nadie se entera, porque el sistema los saltea en silencio**. Son todos
`propio`, o sea que deberían tener receta.

Deja de ser un bug y pasa a ser lo que `PUESTA-A-PUNTO-2027.md` ya decía: **el gate de costos va
antes de la carga masiva del catálogo**, y ahora está medido. **Renumerado: hallazgo 36-bis, y es
carga de datos, no código.**

## Lo que sí se arregló acá — hallazgo 38

El KPI decía **"351 RECETAS"** contando **ítems**, y **"0 INCOMPLETAS"** al lado. Ese cero era
correcto según su propia definición (*receta CON componentes donde alguno cuesta $0*), pero pegado al
351 se lee como "está todo bien", cuando **129 ítems no tienen ni una línea de receta**. Es el mismo
patrón del semáforo de stock (14) y del Libro IVA (12): **un cero que tranquiliza**.

Ahora la barra dice, con su tooltip cada uno:

| | |
|---|---|
| **352** ítems | lo que hay en el catálogo (antes decía "recetas") |
| **63** cotizables | |
| **24** cotizables sin receta | **en rojo** — el número que decide si se puede cargar el catálogo |
| **129** sin receta | en naranja |
| **0** incompletas | recetas que sí tienen componentes pero alguno cuesta $0 |

Los cinco valores verificados contra la base antes de tocar el código (223 con receta + 129 sin
receta = 352). El contenedor ya era `flex-wrap`, así que pasar de 3 a 5 no rompe el layout.

`costos.js?v=44`

---
---

# FASE 2 · TANDAS B · C · D · G · H *(2026-08-29)*

## Tanda B — `finanzas.js` + `api.js`

### Hallazgo 12 — el comprobante recibido que dejaba el Libro IVA en cero

**Lo que pasaba:** el campo Neto decía *"Auto si ponés total"* y el único listener que existía iba
**al revés** (calculaba desde el Neto). Como el número que uno tiene delante es el total de la
factura, se cargaba el total, el neto y el IVA quedaban en NULL, y el **Libro IVA Compras** —lo que
va a la DDJJ— mostraba **$0,00** de neto y de IVA sobre **$1.815.000** de facturas.

**Lo que quedó:** la entrada es **Total + Alícuota** y el neto y el IVA se derivan.

- La alícuota arranca sola según el tipo: **21% para las facturas A** (las únicas que dan crédito
  fiscal) y **"sin IVA discriminado" para B, C, recibo y otro** — una B lleva el IVA adentro del
  precio y no se recupera; una C no tiene.
- Escribir el **IVA a mano** recalcula el neto desde el total: es la salida para la factura de
  alícuota mixta.
- Hay una **opción "Mixta — la cargo a mano"** que no deriva nada. Al abrir un comprobante viejo, si
  el neto y el IVA guardados no caen en ninguna banda limpia, el select va solo ahí: adivinarle 21%
  era una trampa, porque después alcanzaba con tocar el total para que el recálculo le pisara los
  números buenos.
- Un **cartel en vivo** dice si los tres cierran, y **al guardar se rechaza** si no.
- Si el neto y el IVA llegan vacíos, **se derivan antes de escribir**: un NULL acá es un $0 en el
  libro. Y va `0`, no `null`, cuando de verdad no hay IVA discriminado — cero es un dato, null es
  una ausencia.
- El `iva` se calcula como `total − neto` (y no como `neto × alícuota`) justamente para que los tres
  cierren siempre, sin arrastres de redondeo.

### Hallazgo 9 — el doble cobro de una cuota

Eran **tres** cosas, no una:

1. **La pantalla no se refrescaba.** Se recargaban los ingresos pero no el plan, así que la cuota
   seguía diciendo "Pendiente" con el botón "Cobrar" activo. Arreglado.
2. **Nada impedía el segundo cobro.** `registrarCobro` insertaba otra aplicación y el trigger las
   suma: la cuota terminaba al 200% con dos ingresos reales y dos asientos. Ahora hay un candado
   **antes** del insert (validar después dejaría un ingreso sin su aplicación, que es peor).
3. **Y el candado, en su primera versión, tenía un agujero de manual que cazó el reviewer:** miraba
   el flag `syncPlanItem` en vez de la columna. **"⎘ Duplicar" copiaba un cobro con su
   `plan_cobro_item_id` y lo guardaba sin el flag**, así que pasaba de largo — y el trigger de la
   base cuenta la columna igual, sin importarle por qué puerta entró. Un click en un botón que ya
   estaba en pantalla, sin ninguna carrera. Ahora el candado mira **la columna**, y además Duplicar
   limpia el vínculo a la cuota y a la factura: duplicar sirve para repetir un movimiento parecido,
   no para cobrar dos veces lo mismo.

El candado además rechaza cobrar una **cuota anulada** (espejo del guard que el trigger ya tenía del
otro lado) y **cobrar en una moneda distinta** de la de la cuota — sin eso comparaba magnitudes de
monedas distintas y una cuota en USD se daba por cobrada con el mismo número en pesos.

**Lo que NO cierra, dicho:** el candado es *check-then-act*. Dos llamadas que se solapen dentro del
round-trip pueden leer las dos el mismo saldo. Se le agregó al botón de Ingreso el mismo **candado de
reentrancia** que el modal de comprobante recibido ya tenía —que cierra el camino realista, el doble
click—, pero el cierre duro pide una constraint en la base y eso va con Fede.

### Hallazgos 10 y 21

- **10** — "Cobrar cuota" no prefilleaba el cliente aunque el proyecto tiene uno: el cobro nacía sin
  cliente y no entraba en su cuenta corriente.
- **21** — el `evento_id` del egreso **se guardaba y no se mostraba en ningún lado**, y el modal de
  egreso no tenía campo Evento. Y no es un dato de adorno: la imputación a proyecto **o evento** es
  lo que rutea el gasto a costo directo (5.1.x) en vez de a estructura (5.2.x). Un gasto de un evento
  sin proyecto —los jornales de una expo, el flete del predio— no se podía imputar desde ahí. La OC y
  el comprobante recibido ya lo tenían.

---

## Tanda C — `eventos.js` + `style.css`

| # | Qué quedó |
|---|---|
| **1** | Se citaba a la misma persona a dos eventos el mismo día **sin ningún aviso**. Ahora el choque se ve **en la lista, antes de elegir** (chip rojo con el nombre del otro evento) y además se confirma al guardar, diciendo quién choca y con qué. **No bloquea**: a veces son dos eventos en el mismo predio. Una sola consulta por el rango de fechas del evento, no una por persona |
| **2** | El modal de jornadas aceptaba un **desarme anterior al armado**. Reusa `_validateFaseDates`, el mismo chequeo del modal de crear/editar: no hay dos criterios dando vueltas |
| **4** | El filtro de predios hacía `appendChild` sin limpiar — 35 opciones para 7 predios. Reconstruye y conserva lo elegido |
| **5** | Ningún modal decía de qué evento era. Ahora el nombre va en el título de los cuatro (jornadas, gente, transporte, organizador) |
| **6** | Resultó **más ancho que el hallazgo**: `.ev-edit-btn` nace en `opacity: 0` y sólo lo revela el hover, así que **en una tablet TODOS los lápices de la ficha son invisibles**, no sólo el de jornadas. Se muestran en touch, y de paso el cartel de "sin jornadas" pasó a ser el botón |

**Decisión de dónde va cada cosa, que costó mirar:** la validación cronológica **no** puede ir como
trigger que rechace. `API.setJornadas` escribe **fila por fila**, un HTTP por jornada, así que durante
una edición normal existen estados intermedios inconsistentes (movés el armado y todavía no moviste
el desarme). Un `RAISE` en la base rechazaría ediciones legítimas a mitad de camino. Para que el
candado pueda vivir en la base, primero `setJornadas` tiene que escribir todo en una transacción.

---

## Tanda D — `inventario.js` · hallazgo 14

Los **83 insumos tienen `stock_minimo` en NULL**, y `x < NULL` da NULL: **la alerta no podía
encenderse nunca**. El tablero decía "0 · todo ok" y "Todo el stock está en niveles normales".
Ahora distingue las dos cosas: si no hay ni un mínimo cargado el KPI dice **"—" en naranja** con
"sin mínimos cargados", y el cartel explica que la alerta no puede encenderse. Si hay algunos, avisa
cuántos siguen sin mínimo. Mismo criterio en el KPI de la pestaña Materiales, para que las dos
pantallas digan lo mismo.

*(`alertas.js` se miró y está bien: filtra `stock_minimo not null`, así que no genera una alerta
falsa — simplemente no genera ninguna, que es honesto.)*

---

## Tanda G — `compras.js` + `locaciones.js`

| # | Qué quedó |
|---|---|
| **17** | El picker ofrecía **dos opciones con el mismo `value`**: elegir "pieza" guardaba el insumo igual, probado en prod. Ahora **sólo a los nombres repetidos** se les agrega " · material" / " · pieza", así los ~380 que no colisionan se siguen escribiendo igual. Verificado en el browser: la pieza resuelve a `catalogo_item_id`, el material a `insumo_id`, y el nombre ambiguo a secas ya no resuelve solo. Y si se tipea algo que no matchea, **se avisa** en vez de guardar sin vínculo (antes la recepción no sumaba stock y nadie sabía por qué) |
| **19** | `monto_total` tenía **dos escritores y un solo rótulo**. La columna pasa a significar una cosa: **lo que nos comprometimos a pagar** — si hay ganadora manda la ganadora, si no hay manda la suma de los ítems |
| **16** | `_formatDate` mostraba **un día antes** toda columna `date`. Verificado en los dos sentidos: `2026-08-29` daba "28 de ago" y ahora da "29"; y en `locaciones.js`, donde pega en vencimientos de documentos, **`2026-01-01` se mostraba como "31 de dic de 2025"** |
| **26** | `_renderOrdenItemsTable` interpolaba `nombre` y `notas` crudos |

---

## Tanda H — `proyecto-detalle.js`

| # | Qué quedó |
|---|---|
| **28** | Los botones que avanzan el ciclo del taller vivían **sólo** en la vista galpón, que se renderiza únicamente si el rol es `taller`: **ninguna cuenta de oficina podía pasar de "En armado"**, ni corregir un estado mal puesto, ni cerrar un proyecto si el del taller se olvidaba. Ahora los pasos del stepper son clickeables para admin/superadmin/pm, con confirmación, y queda sellado quién y cuándo |
| **29** | La cabecera no se repintaba cuando el checklist movía el estado: decía "Pendiente · 0%" con la base en "En armado · 25%", **en la misma pantalla**. Ahora, si el estado cambió, se repinta el shell — que es lo que ya hacía el cambio de estado del proyecto |
| **30** | Completar el checklist al 100% no avisaba nada. **No se avanza solo a propósito** (marcar listo es una decisión de quien armó, no una consecuencia de tildar la última casilla), pero se dice que el paso quedó disponible |
| **31** | Firmar la entrega tampoco movía el ciclo: el stand quedaba entregado y conformado, y el sistema decía que se estaba armando. Se avisa |

---

## Cómo se verificó todo esto

- **`node --check`** en los 8 archivos tocados, y llaves balanceadas en `style.css`.
- **21 asserts en Node** sobre la lógica pura de `eventos.js`: el orden cronológico entre fases (9
  casos, incluido el real de producción), el título con el nombre del evento, y el recorrido de días
  del detector de choques (fin de mes, fin de año, año bisiesto, rango invertido y el tope de 400).
- **En navegador real, contra el server local:** los **47 scripts diferidos cargan**, los 16 globals
  de módulo existen, **0 errores de consola**.
- **Manejando el modal real de comprobante recibido**, los siete casos: Factura A con sólo el total
  (500.000 + 105.000 ✓), cambio a 10,5%, Factura C que va sola a "sin discriminar", **nota de crédito
  con total negativo** (−500.000 − 105.000 ✓), IVA cargado a mano, "mixta" que no pisa lo escrito, y
  el descuadre que aparece en rojo con los dos números.
- **El picker de compras** probado con datos que colisionan: dos opciones distinguibles, cada una
  resolviendo al id correcto.
- **El candado de doble submit**: tras un click inválido el botón vuelve a habilitarse (un guard que
  deja el botón trabado es peor que no tenerlo).

## Los tres HIGH del reviewer, verificados y arreglados

1. **"Duplicar" evadía el candado del doble cobro** — un botón que ya está en pantalla, sin ninguna
   carrera. Es el que más importa: mi propio comentario decía que el candado cubría "lo que entre por
   otra puerta", y Duplicar era exactamente esa puerta.
2. **El botón de Ingreso no tenía candado de reentrancia**, teniéndolo el modal de al lado con el
   motivo escrito en un comentario.
3. **El hallazgo 12 seguía vivo para una nota de crédito con total negativo**: los cuatro gates
   usaban `> 0` y ninguno corría, así que se volvía a guardar neto y IVA en NULL.

---

## Correcciones a mis propios hallazgos, de mirar el código en vez de deducirlo

Tres, y las tres iguales en la forma: **deduje una consecuencia sin verificar el camino.**

### El 36 no existía (ya está en la tanda J)

"Recalcular todos pondría en $0 a 23 cotizables". Los dos caminos de recálculo ya los excluyen.
Lo probé sacándole el componente a un ítem demo: avisa y no escribe.

### El 20 estaba mal en su parte más fuerte

Dije: *"no hay forma desde ninguna pantalla de atar un comprobante a un egreso que ya existe"*.
**Es falso: el modal de comprobante recibido tiene un select "Vincular a egreso"** con los últimos
200 egresos vivos. Lo que sí es cierto, y quedó arreglado:

- **Nada avisaba que estabas por crear un segundo egreso por la misma compra.** Cada rama se cuida
  de sí misma —`_egresoForOC` mira el N° de OC en el concepto, el comprobante mira su `egreso_id`—
  pero ninguna sabe de la otra. Ahora, antes de generar el pago, se buscan egresos del mismo
  proveedor por un monto parecido y se muestran, sugiriendo vincular en vez de crear.
- **La comparación mira el total Y el neto**, porque el egreso de la OC nace por el monto **neto** de
  la cotización y el comprobante viene **con IVA**. Si sólo comparara el total, justo el caso real no
  aparecería. Para los comprobantes viejos que quedaron con el neto en NULL (hallazgo 12), también
  se prueba el neto que saldría al 21% y al 10,5%.
- **El proveedor matchea por inclusión, no por igualdad.** El caso real era "Aglolam" en el egreso y
  "Aglolam SA" en la factura: con igualdad exacta, el aviso no habría saltado. Lo probé con el caso
  real y con dos falsos positivos (otro proveedor con el mismo monto, mismo proveedor con otro monto):
  encuentra el bueno y descarta los dos.

**Lo que queda abierto del 20, dicho con precisión:** vincular un comprobante a un egreso **ya
pagado** no le agrega la línea de IVA al asiento que ya se posteó — el asiento lo dispara el cambio
de estado del egreso, no el vínculo. Recuperar ese crédito fiscal pide anular y rehacer, o un
recálculo del asiento que hoy no existe. Va con Fede.

### El 16 era más chico de lo que dije

Dije "~23 lugares". Midiendo columna por columna: los sitios reales eran **~16 llamadas en 4
archivos** (`compras.js`, `locaciones.js`, `crm.js`, `costos.js`). Todo el resto de los 51 que había
contado recibe **timestamps** (`created_at`, `crm_mensajes.fecha`, `asignaciones_evento.fecha_inicio`,
`crm_casos.proxima_accion_fecha`), que traen su offset y **se renderizaban bien**.

> **La regla que sale de las tres:** el patrón de la llamada no alcanza para saber si algo está mal.
> Hay que ir a ver **el tipo de la columna** y **quién llama a qué**. Contar ocurrencias de un patrón
> infla los hallazgos; medir la causa los define.

---

## La tercera pasada de reviewers — y una regresión que me cazó

`BLOCK` con **1 HIGH que introduje yo**, y es el hallazgo más importante de las tres pasadas:

> **El arreglo del hallazgo 17 rompía la Recepción para los mismos 30 ítems que venía a arreglar.**

`_invRef()` pasó a sufijar los nombres colisionantes, pero `nombreRef()` —la función que
**pre-llena** el campo de cada fila del modal de Recepción desde el vínculo ya guardado— seguía
leyendo el `.nombre` **crudo** de la tabla. Era un **cuarto lector** de `byName` que no pasa por
`_invRef()` y que yo no busqué. Con el guard nuevo, ese nombre sin sufijo se tomaba como "no
encontrado" y **bloqueaba el "Confirmar recepción" de toda la OC**, sobre ítems que estaban
perfectamente vinculados.

**Arreglado de raíz:** `_invRef()` ahora devuelve también `byId` (el mapa inverso id → etiqueta
visible) y la Recepción lo usa. La etiqueta sale del **mismo lugar** que arma el desplegable, así no
puede volver a divergir. Verificado con el repro exacto del reviewer: los cuatro casos (insumo
colisionante, pieza colisionante, insumo suelto, pieza suelta) precargan una etiqueta que matchea y
**resuelven al mismo id que tenían**; el ítem sin vínculo queda vacío.

> **La lección:** cambié el formato de una clave y busqué los llamadores **de la función**, no los
> lectores **del formato**. El que rompía no llamaba a `_invRef()`: fabricaba la clave por su cuenta.
> Cuando se cambia el formato de un identificador, hay que buscar quién lo *construye*, no sólo quién
> lo *consume*.

### Los dos MEDIUM, también aplicados

- **`_recomputeOCGanadora` dejaba `monto_total` en `$0`** al borrar la ganadora, en vez de volver a
  la suma de los ítems — contradiciendo la invariante que mi propio comentario acababa de declarar.
  La ficha mostraba $0 con la OC llena de ítems hasta que alguien tocara uno. Ahora vuelve a sumar,
  y si no puede leer los ítems **no escribe nada** en vez de escribir un cero que nadie pidió.
- **`_buildShell()` sin guard si `_loadProject()` falla.** `_loadProject` deja `_project` en null y
  `_buildShell` desreferencia `p.estado` en la primera línea: un blip de red justo después de un
  guardado exitoso tiraba un TypeError. El agujero **ya existía** en `_changeStatus` desde antes; se
  tapó en los tres lugares, no sólo en los dos que agregué.

### Los LOW

- **Nombres repetidos dentro de la misma tabla**: medido, **no hay ninguno** (ni en `insumos_base` ni
  en `catalogo_items`), pero se restauró el "el primero gana" que tenía el código viejo.
- **El modal de "Nuevo pedido" no lleva el guard de "no encontrado"** — y está bien así: un pedido es
  una **lista de deseos con texto libre**. Tener que pedir sólo cosas que ya están en el catálogo
  sería el error opuesto. Se deja explícito para que no parezca un olvido.
- **Checklist de un solo ítem**: el aviso de "checklist completo" quedaba después del `return` que
  repinta la cabecera, así que con un checklist de un ítem no salía. Se movió antes.

---
---

# FASE 2 · TANDA E — datos y base *(aplicada en producción el 2026-08-29)*

`sql/tanda7_e_datos.sql` · **sql-reviewer: APPROVE, 0 CRITICAL / 0 HIGH** · aplicado por MCP y
verificado en el momento.

| bloque | qué | resultado |
|---|---|---|
| **1** · hallazgo 48 | `fn_evento_jornadas_sync` no vaciaba las fechas de una fase cuando se borraban todas sus jornadas | aplicado y **probado funcionalmente** |
| **2** · hallazgo 22 | índice único parcial sobre `compras_ordenes.numero_oc` para las filas vivas | creado |
| **3** · hallazgo 33 | `completitud_pct` que contradecía su propio `estado_taller` | **1 → 0** proyectos incoherentes |

## La prueba funcional del bloque 1

No alcanzaba con mirar que la definición hubiera cambiado. Sobre el evento demo *Salón Inmobiliario
2026* (0 jornadas, con la fecha del evento cargada a mano):

1. Se insertó una jornada de **armado** → el trigger seteó `fecha_armado_inicio = 03/11/26` y
   `hora_armado_apertura = 08:00`, **y la fecha del evento cargada a mano (05/11/26) sobrevivió**.
2. Se borró esa jornada → **las tres columnas del armado quedaron en NULL** (antes se quedaban en
   03/11/26 para siempre) **y la fecha manual del evento siguió intacta**.
3. El evento quedó exactamente como estaba: `NULL / 05/11/26 / NULL`, 0 jornadas.

**Foto antes → después:** proyectos incoherentes 1→0 · índice no→sí · función sin bloque→con bloque ·
jornadas 67→67 · eventos vivos 12→12 · OC duplicadas 0→0 · **partida doble cuadrada, $46.320.740,
0 asientos desbalanceados**.

## Lo que encontró el reviewer y cambió la conclusión

Reportó **3 eventos vivos con fechas y sin jornadas detrás**, dos de producción real
(*Cumbre internacional de Jóvenes Líderes 2026* y *Estetica*), y planteó que el arreglo es
forward-only y no los repara. **Al medirlo, la conclusión se dio vuelta: los tres tienen CERO
jornadas en total** — nunca las tuvieron. Son el camino manual del modal de "crear evento", que es
justo el que el guard protege.

> **O sea que no hay ningún fantasma que reparar, y un backfill ciego —que era la reacción
> natural— le habría borrado las fechas a dos eventos reales.** Es la mejor confirmación de que el
> arreglo tenía que ser angosto: limpiar **sólo** cuando la operación fue un DELETE de esa fase.
> Desde `eventos` sola no se puede distinguir "nunca tuvo jornadas" de "tuvo y se borraron todas".

## Lo demás del review, aplicado

- **El rollback apuntaba a un lugar que no tenía la función completa.** Ahora está entera y
  ejecutable dentro del propio archivo: un cambio sin rollback usable no está listo.
- **El comentario decía que `setJornadas` escribe "fila por fila" también en los deletes** — falso:
  borra con un solo `.in('id', …)`. La conclusión se sostiene igual (los insert y update sí son fila
  por fila, y por eso un `RAISE` en la base rechazaría ediciones legítimas a mitad de camino), pero
  el comentario se corrigió para que nadie razone mañana desde una premisa falsa.
- Anotado que `proyectos` tiene **dos** triggers de `updated_at` duplicados (de antes de esta tanda).

## Hallazgo nuevo que salió del review — **49**

**`notif_armado_7d_at` / `notif_armado_2d_at` pueden quedar quemadas para una fecha que ya no
existe.** `api.js` sólo las resetea cuando `updateEvent()` recibe `fecha_armado_inicio` explícito —
o sea, en la edición manual. El trigger nunca las toca. Si se borran las jornadas de armado y se
cargan otras con **otra fecha** (el camino normal del modal de jornadas), el aviso de 7 y 2 días
puede quedar consumido para la fecha vieja y **no salir nunca para la nueva**. Es previo, no lo crea
ni lo empeora esta tanda, pero es exactamente el síntoma del que este trigger es la fuente. Va a la
próxima.
