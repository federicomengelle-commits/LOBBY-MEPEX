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
