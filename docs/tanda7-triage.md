# TANDA 7 — la hoja de triage (Fase 1)

> El plan (`docs/tanda7-orden-de-correccion.md` §Fase 1) dice: *"Yo no decido qué se arregla.
> Sobre la lista numerada marcás **entra / no entra / después**"*.
>
> Para que no te lleve 30 minutos, en vez de darte 46 filas para marcar una por una, están
> **agrupadas por lo que yo propongo**. Leés el grupo, y sólo me decís lo que querés mover.
> El detalle de cada hallazgo está en `docs/tanda7-ui-manifiesto.md`.

---

## A · ENTRAN — son plata o riesgo de plata (7)

| # | Una línea | Cuánto duele |
|---|---|---|
| ~~**36**~~ | ~~"Recalcular todos" pone en $0 a 23 cotizables~~ → **FALSO POSITIVO, probado el 29/8**: los dos caminos de recálculo ya los excluyen (filtro en el masivo + guard F.13.2 en el individual). Lo probé sacándole el componente a un ítem demo: avisa y no escribe | — |
| ~~**12**~~ | ✅ **HECHO** (tanda B): la entrada pasa a ser **Total + Alícuota**, con opción "mixta" para la factura de varias tasas, cartel de cuadre en vivo y rechazo al guardar si neto + IVA ≠ total | de paso salió que seguía vivo para una NC con total **negativo** |
| **20** | El circuito de compra se bifurca: egreso de la OC + egreso del comprobante, sin dedup ni forma de atarlos | doble egreso posible por la misma compra; asiento sin crédito fiscal |
| ~~**9**~~ | ✅ **HECHO** (tanda B): candado en el circuito único **antes** del insert + refresco del plan + candado de reentrancia en el botón | ⚠️ y el reviewer encontró que **"Duplicar" evadía el candado**: copiaba el vínculo a la cuota |
| ~~**37**~~ | ✅ **HECHO** (tanda A). `Modal.close(instance)` era no-op en **13** lugares (no 11) | de paso salió el **50**: se podía borrar un certificado de retención mientras se guardaba la cobranza |
| **7** | Silla Jacobsen cotizable en $0 | si entra a una cotización, sale gratis |
| ~~**8**~~ | ~~8 cuotas de plan huérfanas~~ → **FALSO POSITIVO, verificado el 29/8**: las 8 están borradas junto con sus planes. La cascada funciona. **No hay nada que borrar** | — |

## B · ENTRAN — el sistema miente en pantalla (8)

Ninguno pierde plata, todos hacen que alguien tome una decisión con un número equivocado.

| # | Una línea |
|---|---|
| ~~**19**~~ | ✅ **HECHO** (tanda G): `monto_total` pasa a significar una sola cosa — si hay ganadora manda la ganadora |
| ~~**29**~~ | ✅ **HECHO** (tanda H): si el estado cambió, se repinta la cabecera |
| ~~**21**~~ | ✅ **HECHO** (tanda B): se muestra en el detalle del egreso **y** se puede cargar desde el modal, que no tenía el campo |
| ~~**14**~~ | ✅ **HECHO** (tanda D): distingue "nada bajo el mínimo" de "no hay contra qué comparar" |
| ~~**16**~~ | ✅ **HECHO**. Y el número era menor de lo que dije: **4 archivos, ~16 llamadas** (compras, locaciones, crm, costos). El resto de los 51 sitios recibía **timestamps**, que estaban bien |
| ~~**3**~~ | ✅ **HECHO** (tanda A): eran dos causas — el `close()` mudo y que el router no cerraba al navegar |
| ~~**10**~~ | ✅ **HECHO** (tanda B) |
| ~~**38**~~ | ✅ **HECHO** (tanda J): ahora dice **352 ítems · 63 cotizables · 24 cotizables sin receta · 129 sin receta · 0 incompletas** |

## C · ENTRAN — operación que se traba (7)

| # | Una línea |
|---|---|
| ~~**28**~~ | ✅ **HECHO** (tanda H): los pasos del ciclo son clickeables para admin/superadmin/pm, con confirmación y sello de quién y cuándo |
| ~~**17**~~ | ✅ **HECHO** (tanda G): sólo los nombres repetidos llevan sufijo · material / · pieza, y si se tipea algo que no matchea se avisa |
| ~~**1**~~ | ✅ **HECHO** (tanda C): el choque se ve **en la lista antes de elegir** + confirmación al guardar. No bloquea |
| ~~**2**~~ | ✅ **HECHO** (tanda C): valida en el modal de jornadas. **Avisa, no bloquea** — el reviewer cazó que bloquear dejaba sin guardar un caso legítimo |
| ~~**5**~~ | ✅ **HECHO** (tanda C): los 6 modales de la ficha llevan el nombre del evento |
| ~~**4**~~ | ✅ **HECHO** (tanda C) |
| ~~**30 + 31**~~ | ✅ **HECHO** (tanda H): no se avanza solo a propósito, pero se avisa que el paso quedó disponible |

## D · ENTRAN PERO SON DECISIÓN TUYA ANTES QUE CÓDIGO (5)

No los toco hasta que digas qué querés.

| # | Qué hay que decidir |
|---|---|
| **18** | **La fuente única de stock.** 30 de 83 insumos colisionan con el catálogo. Hoy sólo 2 difieren porque el resto está en cero: **hay que decidirlo antes del relevamiento del galpón, no después** |
| **41** | **El rol `venta`**: no existe ni existió nunca, y Noe es `admin` (entra a Finanzas, Contabilidad, Costos, RRHH). O se le crea el rol, o se saca del código |
| **42** | **El taller lee todo el catálogo con márgenes y las 17 cotizaciones ($173M)** desde cuentas compartidas que van a vivir en tablets del galpón. ¿Se cierra con grants por columna, como ya está hecho con los jornales? |
| **43** | **Las cuentas de taller son genéricas** (`Taller`, `Depósito`, `Energy`). Toda la traza del eslabón físico queda sin nombre. ¿Cuentas por persona? |
| **46** | Jordi superadmin activo + 11 perfiles de baja, con `Colore` duplicado |

## E · DESPUÉS — reales pero no urgentes (9)

~~**22**~~ ✅ **APLICADO** (índice único parcial) · **23** al modal de OC le falta el estado "Recibida" ·
**24** KPI "Bien calificados" sólo puede decir 0 · **25** datos de proveedor partidos entre columnas ·
~~**26**~~ ✅ hecho (tanda G) · **32** tabla `taller_checklist` muerta ·
~~**33**~~ ✅ **APLICADO** (1 → 0 incoherentes) · **34** dos vistas de Proyectos son "Próximamente" ·
**35** el encabezado del acta se parte ("ENTREGAD/O")

## F · DESPUÉS — dependen de que armes los dispositivos (3)

| # | Una línea |
|---|---|
| **40** | Hoy un push no puede llegar a ningún teléfono de MEPEX. **Tu celular no está suscripto** (tus 2 suscripciones son Chrome en Windows) |
| **44** | La matriz de preferencias de notificación tiene 0 filas: nunca se usó |
| **45** | De ~28 tipos de aviso, sólo 10 se dispararon alguna vez |

## G · NO ENTRAN — código muerto, barrido aparte (2)

**27** la pestaña Pagos de Compras se retiró del shell pero sus ~150 líneas siguen viajando ·
~~**6**~~ ✅ hecho (tanda C), y resultó **más ancho**: en una tablet TODOS los lápices de la ficha eran invisibles, no sólo el de jornadas

---

## Lo que hace falta que digas

1. **¿Algo se mueve de grupo?** (ej: "el 22 entra", "el 16 lo dejo para después").
2. **Los 5 de D**, que son decisiones y no código.
3. **36-bis** (lo que quedó del 36 después de probarlo): **24 de los 63 cotizables no tienen receta**
   — 23 con precio a mano por **$1.253.750**. Ningún botón los rompe, pero el motor tampoco los
   mantiene al día: cuando cambie el precio del aluminio, esos 23 quedan viejos **y el sistema los
   saltea en silencio**. Es carga de datos, no código, y es el gate que `PUESTA-A-PUNTO-2027.md`
   pone antes de cargar el catálogo. ¿Las armás vos, o querés que arme yo las recetas de los que
   más se cotizan?

---

# Después de la Fase 3 *(2026-08-30, re-corridos con Fede logueado)*

El detalle de cada caso, con el antes y el después, está en `docs/tanda7-ui-manifiesto.md`
§FASE 3. Acá sólo qué cambió de estado.

## Confirmados cerrados — el caso que los destapó vuelve a pasar (14)

**12** (el Libro IVA de agosto pasó de **$0 / $0** a **NETO $1.500.000 · IVA $315.000**) ·
**9** y **10** (incluida la puerta de Duplicar: la copia sale con el vínculo en NULL y la cuota no
se duplica) · **1** · **2** · **4** · **6** · **14** · **17** y la regresión de la Recepción ·
**19** · **28** · **29** · **30** · **38**.

## Reabierto y arreglado en la misma sesión (1)

**5 — el nombre del evento en los modales.** El fix estaba escrito y **no hacía nada**: el helper
leía `ev.nombre` y la propiedad se llama `ev.name` (`API.getEvents()` la mapea así, y los otros seis
lugares del módulo la leen bien). Los seis modales seguían sin el nombre. Arreglado
(`eventos.js?v=51`).

> Es el resultado más útil de la Fase 3: **el diff se veía bien y el caso no pasaba.** Justifica la
> fase entera.

## No re-corrido (1)

**31** — firmar la entrega avisa que el ciclo quedó atrás. Pide firmar una segunda acta sobre un
proyecto que ya tiene una, y usa el mismo mecanismo que el **30**, que pasa.

## Hallazgos nuevos, salidos de re-correr (2)

| # | Una línea | Estado |
|---|---|---|
| **52** | **En la pestaña Ingresos había un botón que cargaba un gasto.** `CargaComprobante.open()` no recibe parámetros y siempre crea una factura de PROVEEDOR + un EGRESO; estaba cableado con el mismo label y el mismo color en Egresos (bien) y en **Ingresos** (mal). Lo vio Fede mirando la pantalla | ✅ **ARREGLADO** — y de paso se ordenaron las tres puertas: la carga a mano se mudó a Egresos, Facturación → Recibidos quedó como *lo que debo* (mirar + Generar pago), y el 📸 salió de Ingresos |
| **53** | **El número de OC se repite y hay código que lo usa como identidad.** Hay dos OC-0001, dos OC-0002 y dos OC-0003 (una borrada y una viva de cada una); el numerador reusa números de OC borradas, y `_egresoForOC` busca el egreso por prefijo de texto del concepto porque `egresos.orden_compra_id` es UUID y `compras_ordenes.id` es BIGINT. **Una OC nueva hereda el egreso de la borrada con el mismo número, y pierde el botón "Generar egreso"** | ⏳ **ABIERTO** — el arreglo de fondo es el FK real (DDL) + decidir si el numerador saltea números usados. Va con Fede |

## La regla que deja la Fase 3

> **Un hallazgo no está cerrado porque el diff se vea bien.** De 15 casos re-corridos, 14 pasaron y
> **uno estaba escrito, llamado desde los seis lugares correctos, y leyendo una propiedad que
> nadie escribe**. Eso no se ve en el diff ni en un test de la lógica pura: se ve abriendo la
> pantalla.
