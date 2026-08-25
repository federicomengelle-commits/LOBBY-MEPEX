# Puesta en marcha — instalarlo y empezar a usarlo

> **Escrito el 2026-08-24**, a pedido de Fede: *«quiero agarrar las features que falten o los detalles
> que falten arreglar, ponerle moño y empezar a usarlo. Después sí ir arreglando, que ya va a ser más
> fácil con uso, porque van a saltar errores y le vamos a poder ir atrás específicamente.»*
>
> **Este documento tiene un solo filtro: ¿esto bloquea instalar, o se arregla usando?**
> Todo lo que no bloquea está abajo del todo, y está ahí a propósito.

---

## 1 · El estado de hoy, medido

La base quedó **limpia** el 24/8. No es una estimación: es el chequeo corrido después de borrar el
último movimiento inventado.

| | |
|---|---|
| Partida doble | **$0,00** · 34 asientos, todos con su contra-asiento |
| Cuentas con saldo | **0** · ninguna en negativo |
| Movimientos vivos sin anular | **0** |
| Facturas cobrables | **0** |
| Residuos de prueba | **0** |

**Lo que SÍ es real y no se toca:** los **254 clientes** (tu base importada), los **63 ítems
cotizables** con sus precios trabajados el 6/8, las **24 personas**, y los **2 comprobantes con CAE
real de AFIP** — que son los únicos documentos que existen ante el fisco bajo el CUIT de MEPEX.

**Lo que NO hay, y está bien que no haya:** ni un movimiento de plata real. Fede: *«recién puede
llegar a haber algo real a partir de septiembre»*. La base está en cero **a propósito**, lista para
que el primer asiento sea de verdad.

---

## 2 · Lo que BLOQUEA instalar

Son tres, y ninguna es de código.

| | Qué | Cuánto | Por qué bloquea |
|---|---|---|---|
| **1** | **Que cada uno pueda entrar.** 10 cuentas activas. Falta que cada persona sepa su usuario y su contraseña, y la cambie al entrar | 20 min con todos juntos | Es literalmente la puerta. Sin esto no hay nada que instalar |
| **2** | **Los jornales de las 24 personas** | La planilla que tiene Lelean | Sin el dato, **la mano de obra de cada evento vale $0** y la ganancia sale inflada. No impide usar el sistema, pero el primer número que miren va a estar mal, y eso quema la confianza el día uno |
| **3** | **Decidir si el taller entra ahora o después** | — | Si entra: hacen falta los 2 celulares + 3 tablets (`docs/puesta-en-marcha-dispositivos.md`, ~2 h desde la oficina). Si no: **el sistema funciona igual** — oficina y PMs alcanzan para arrancar |

> **Nada más bloquea.** Todo lo demás de `PENDIENTES.md` puede esperar a que el sistema esté en uso,
> y varias cosas van a estar *mejor* resueltas después de que salten usándolo.

---

## 3 · Lo que NO hay que hacer antes de instalar

Esta sección vale tanto como la anterior: es donde se pierde el tiempo.

| | Por qué esperar |
|---|---|
| **Cargar el stock mínimo de los 83 insumos** | 82 figuran con stock **0**. Cargar los mínimos hoy **enciende 82 alertas rojas juntas**, todas ciertas e inútiles, y la alerta nace desacreditada. Lo que falta es el relevamiento físico del galpón, que va con las tablets |
| **Cargar el catálogo completo** | Hay 63 ítems cotizables con precio trabajado. Alcanzan para cotizar. La carga masiva depende de decisiones del modelo de costos que siguen abiertas (media hora con Diego) |
| **Terminar de unificar la papelería** | Los 6 documentos que más se usan ya están. Los dos que faltan (lista de precios y plan de pagos) tienen portada propia y no molestan a nadie como están |
| **MFA de todos** | Importa, pero no impide entrar. Y es más fácil hacerlo con cada persona al lado, una vez que ya usó el sistema y entiende qué protege |
| **Perfeccionar el compositor de planos** | Es una mejora de una herramienta que ya funciona |

---

## 4 · Lo que va a saltar cuando lo usen — y está bien

No es pesimismo: es dónde mirar cuando pase, para no perder tiempo diagnosticando.

| Lo que va a pasar | Por qué | Dónde mirar |
|---|---|---|
| **Van a querer un medio de pago que no está** | El sistema acepta `pagofacil` y `mercadopago` como medio pero **no existen las cuentas** donde poner esa plata. Fede dijo que no los usan; si aparece otro, es lo mismo | Finanzas → Cuentas · **y después vincularla en Contabilidad → Plan de cuentas**, que es otro módulo y es el paso que se olvida |
| **Un gasto va a entrar por asiento manual** | Es la salida natural cuando el sistema no ofrece dónde ponerlo. Pasó el 20/8 con Movistar. El costo: no aparece en Egresos y **su IVA no entra al Libro de Compras** | Correr `/chequeo-integridad`: lo caza |
| **Un pago va a quedar sin asiento, en silencio** | Si alguien crea una cuenta de tesorería y se olvida de vincularla al plan, el egreso se guarda y **no genera asiento, sin ningún error** | El chequeo también lo caza — se le agregó ese control el 24/8 |
| **Los nombres de proyecto se van a repetir** | Tres stands de la misma expo generan tres proyectos parecidos. Se arregló el 20/8 para que nazcan con la rama y el responsable, pero el nombre lo pone el Cotizador | Ver cómo salen los primeros y ajustar |
| **Van a pedir campos que no existen** | Inevitable y sano. Es la clase de pedido que sólo aparece usando | Anotarlos sin arreglarlos en el momento |

**La regla para esos días: anotar, no arreglar en caliente.** Juntar una semana de pedidos y
atacarlos por lote es más rápido que ir uno por uno, y evita romper algo mientras la gente trabaja.

---

## 5 · El orden de los primeros días

```
DÍA 1 · Sentarlos y que entren
        Cada uno con su cuenta, cambia la contraseña, mira su pantalla.
        Que carguen UNA cosa real cada uno: un cliente, un caso, una tarea.

DÍA 2-5 · Que trabajen normal y anoten
        Sin ayuda, a ver dónde se traban. La lista de lo que falta la escriben ellos.

FIN DE SEMANA 1 · El primer lote de arreglos
        Con los pedidos reales sobre la mesa, no con los que suponemos.

SEPTIEMBRE · La plata de verdad
        Recién acá el primer movimiento real. Correr /chequeo-integridad ese día
        y el siguiente: es cuando más barato sale encontrar un error.
```

---

## 6 · Lo que espera una decisión tuya

Ninguna bloquea instalar; todas se pueden responder en un rato.

**De la papelería** (`docs/papeleria-mepex-inventario.md` §6):

| | |
|---|---|
| 1 | **¿El remito necesita alguna leyenda?** Hoy va sin ninguna, por decisión tuya de no explicar lo obvio |
| 2 | **¿Qué dice la orden de compra al pie?** Qué se le promete a un proveedor: si el precio queda en firme, qué pasa si entrega tarde. Hoy va sin leyenda antes que con una inventada |
| 3 | **¿Sacamos la factura C del selector?** No la hacen — y además **no pueden**: MEPEX es Responsable Inscripto y la C es de monotributistas y exentos. ARCA tampoco la emite |
| 4 | **¿Cómo es la lista de reparto del taller?** Es lo único de la papelería que no se puede diseñar sin ellos |

**Del sistema:**

| | |
|---|---|
| 5 | **¿El taller entra ahora?** Define si hay que armar los dispositivos esta semana |
| 6 | **¿Jordi sigue con superadmin?** Es el único externo con acceso total. *(Las otras cuatro cuentas — `Ana`, `Budie`, `Colore`, `Lex@` — se dieron de baja el 24/8.)* |

---

## 7 · Estado de las tandas grandes

Para no re-preguntar qué quedó a medias:

| | Estado |
|---|---|
| **Vocabulario de las 4 ramas** | ✅ Cerrado (23/8). Stand · Expo · Equipamiento · Energía |
| **H7 — la nota de crédito** | ✅ Cerrado (24/8). Y con él, cuatro agujeros más del mismo tipo |
| **Papelería** | ✅ 6 de 8 documentos del Lobby unificados + la orden de compra creada. Faltan lista de precios y plan de pagos |
| **Agente de integridad** | ✅ Andando. `/chequeo-integridad`, read-only |
| **Cotizador** | ⏳ En tu cancha: `docs/handoff-cotizador-vocabulario-y-detalle.md` (vocabulario + el toggle de detalle) |
| **Modelo de costos** | ⏳ Media hora con Diego (`docs/costos-preguntas-taller.md`) |
| **Compositor de planos** | ⏳ G11 — perfeccionarlo para mobiliario |
| **Web v4** | ⏳ Terminada en disco desde el 19/8, sin publicar. Faltan 6 fotos y el destino del formulario |
