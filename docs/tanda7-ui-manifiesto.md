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
