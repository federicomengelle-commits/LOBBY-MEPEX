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
| **12** | El comprobante recibido no calcula neto ni IVA → Libro IVA en cero | **$315.000** de crédito fiscal sólo en las 2 facturas cargadas. Se produce solo: cada factura que entra |
| **20** | El circuito de compra se bifurca: egreso de la OC + egreso del comprobante, sin dedup ni forma de atarlos | doble egreso posible por la misma compra; asiento sin crédito fiscal |
| **9** | Al cobrar una cuota el plan no se refresca → dice "Pendiente" con el botón activo | **doble cobro** |
| ~~**37**~~ | ✅ **HECHO** (tanda A). `Modal.close(instance)` era no-op en **13** lugares (no 11) | de paso salió el **50**: se podía borrar un certificado de retención mientras se guardaba la cobranza |
| **7** | Silla Jacobsen cotizable en $0 | si entra a una cotización, sale gratis |
| ~~**8**~~ | ~~8 cuotas de plan huérfanas~~ → **FALSO POSITIVO, verificado el 29/8**: las 8 están borradas junto con sus planes. La cascada funciona. **No hay nada que borrar** | — |

## B · ENTRAN — el sistema miente en pantalla (8)

Ninguno pierde plata, todos hacen que alguien tome una decisión con un número equivocado.

| # | Una línea |
|---|---|
| **19** | La ficha de la OC dice "(ganadora) $480.000" arriba del presupuesto que dice "$500.000 GANADORA". El KPI "Monto abierto" queda corto |
| **29** | El ciclo del taller no se entera del checklist en la misma pantalla: dice "Pendiente 0%" con la base en "En armado 25%" |
| **21** | La imputación a evento se guarda y no se muestra en ningún lado — y es la que decide el ruteo contable |
| **14** | El semáforo de stock sólo puede decir "todo ok": 82 de 83 insumos en cero y ninguno con mínimo |
| **16** | Todas las fechas `date` se muestran un día antes. ~23 lugares; el idioma correcto ya está aplicado en 66 |
| ~~**3**~~ | ✅ **HECHO** (tanda A): eran dos causas — el `close()` mudo y que el router no cerraba al navegar |
| **10** | "Cobrar cuota" prefill sin cliente → el cobro no aparece en su cuenta corriente |
| ~~**38**~~ | ✅ **HECHO** (tanda J): ahora dice **352 ítems · 63 cotizables · 24 cotizables sin receta · 129 sin receta · 0 incompletas** |

## C · ENTRAN — operación que se traba (7)

| # | Una línea |
|---|---|
| **28** | Nadie de oficina puede cerrar el ciclo del taller: Listo/Despachado sólo existen en la vista del rol `taller` |
| **17** | El picker de insumo/pieza no puede expresar la diferencia y descarta lo que elegís (30 ítems afectados) |
| **1** | Una persona se asigna a dos eventos el mismo día sin ningún aviso |
| **2** | Se acepta un desarme anterior al armado, sin validación en pantalla ni en la base |
| **5** | El modal "Editar jornadas" no dice de qué evento es |
| **4** | El filtro de predios acumula opciones en cada render (35 para 7 predios) |
| **30 + 31** | Terminar el checklist al 100% y firmar la entrega no mueven el ciclo |

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

**22** N° de OC no único (reusa los de las borradas) · **23** al modal de OC le falta el estado "Recibida" ·
**24** KPI "Bien calificados" sólo puede decir 0 · **25** datos de proveedor partidos entre columnas ·
**26** XSS sin escapar en la tabla de ítems de la OC · **32** tabla `taller_checklist` muerta ·
**33** un proyecto con completitud que se contradice · **34** dos vistas de Proyectos son "Próximamente" ·
**35** el encabezado del acta se parte ("ENTREGAD/O")

## F · DESPUÉS — dependen de que armes los dispositivos (3)

| # | Una línea |
|---|---|
| **40** | Hoy un push no puede llegar a ningún teléfono de MEPEX. **Tu celular no está suscripto** (tus 2 suscripciones son Chrome en Windows) |
| **44** | La matriz de preferencias de notificación tiene 0 filas: nunca se usó |
| **45** | De ~28 tipos de aviso, sólo 10 se dispararon alguna vez |

## G · NO ENTRAN — código muerto, barrido aparte (2)

**27** la pestaña Pagos de Compras se retiró del shell pero sus ~150 líneas siguen viajando ·
**6** el cartel manda al lápiz que sólo aparece con hover *(entra igual si se toca eventos.js por el 5)*

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
