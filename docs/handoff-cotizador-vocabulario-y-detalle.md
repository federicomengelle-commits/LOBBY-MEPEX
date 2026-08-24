# Para llevar al Cotizador — vocabulario de las ramas + toggle de detalle

> **Qué es esto.** El detalle para abrir la charla del lado del **Cotizador** (repo
> `COTIZADOR-MEPEX`, app aparte que comparte la misma Supabase). Escrito el **2026-08-23**, después de
> aplicar del lado del Lobby el ítem **G10** de `PENDIENTES.md`.
>
> **Todo lo que dice acá está medido contra producción ese día, no estimado.** La idea es que la
> charla de allá **no vuelva a decidir lo ya decidido ni a re-descubrir lo ya medido** — que arranque
> construyendo.

---

## 0 · Las cuatro palabras (ya decididas, no se re-abren)

### **Stand · Expo · Equipamiento · Energía**

Estas cuatro son **las mismas en todos lados**: la etiqueta al facturar, el nombre de la cuenta
contable, la línea del caso en el CRM, el rubro del catálogo y **el título del presupuesto que ve el
cliente**. Si una cambia, cambian todas.

Dos cambian respecto de como se venían llamando: *Alquiler* → **Equipamiento**, *Electricidad* →
**Energía**. La segunda era una decisión de marca que `docs/las-cuatro-ramas.md` dejaba explícitamente
abierta; quedó cerrada el 23/8.

**Por qué se movió «Alquiler»** — y este es el argumento que conviene no perder: hasta el 23/8 la
palabra *expo* significaba **dos cosas opuestas** según el módulo. En el CRM un comentario del código
decía literalmente `'expo' = equipamiento/alquiler/subalquileres`; en facturación `SRV-EXPO` va a
*Ventas — Expo*, que es la estructura de una exposición entera. **Un caso marcado «expo» en el CRM
facturaba normalmente como alquiler.** Separar las palabras deshace ese nudo.

### Los códigos internos NO se tocan

`SRV-STAND` · `SRV-EXPO` · `SRV-ALQUILER` · `SRV-ELEC` · `SRV-ADIC` **quedan como están.**

Son identificadores internos que el usuario nunca ve, y renombrarlos obligaba a migrar los dos únicos
comprobantes con **CAE real de AFIP**. Decisión de Fede sobre las tres opciones que planteaba
`docs/handoff-continuar-20260820.md` §1.A. Ojo con la trampa: **`SRV-ALQUILER` es la rama que ahora se
llama «Equipamiento»** — el código no se corresponde con la etiqueta, y está bien que así sea.

---

## 1 · Lo que YA quedó hecho del lado del Lobby (23/8)

Para que la charla de allá sepa contra qué se está integrando:

| | Qué | Dónde |
|---|---|---|
| ✅ | Las 5 etiquetas de facturación renombradas | `finanzas.js` `_servicioLabel` |
| ✅ | Las 5 cuentas de venta renombradas en prod (`4.1.01` a `4.1.05`) | `sql/vocabulario_ramas_20260823.sql` |
| ✅ | El CRM pasó de **2 a 4 líneas** de caso: se sumaron `equipamiento` y `energia` | `crm.js` `_lineas` |
| ✅ | El editor de mapeos de Contabilidad muestra la etiqueta junto al código (era el único lugar donde el `SRV-*` se veía crudo) | `contabilidad.js` |
| ✅ | El gráfico de ventas por rama del Dashboard sumó la rama Energía, que antes caía en «Otros» | `finanzas.js` `_renderDonutChart` |
| ✅ | `docs/las-cuatro-ramas.md` actualizado con el vocabulario nuevo | — |

**Los valores en base `stand` y `expo` se conservaron tal cual** — no hubo migración de datos: los dos
únicos casos con línea cargada ya estaban bien clasificados.

---

## 2 · Lo que hay que hacer del lado del Cotizador

### 2.1 · Vocabulario en las tres pantallas

Donde el Cotizador diga *Alquiler* como **modo/rama**, debe decir **Equipamiento**; donde diga
*Electricidad*, **Energía**. Alcanza el selector de modo, los títulos del PDF de presupuesto, el badge
de modo del header y la propuesta comercial de weasyprint.

⚠️ **No confundir con el modelo de negocio.** MEPEX **alquila** todo (nada se vende al cliente final),
así que la palabra *alquiler* sigue siendo correcta cuando describe la operación — «precio de
alquiler», `precio_alquiler`. Lo que cambia es el nombre de **la rama**, no el del verbo.

### 2.2 · `cotizaciones.tipo_cotizacion` — la columna que decide la rama

**Es la única columna que le dice al Lobby de qué rama es un trabajo**, y la escribe el Cotizador.

Medido el 23/8 en prod: **3 cotizaciones vivas, todas con `tipo_cotizacion = 'Stand'`.** Es `text`
libre, **sin CHECK**. De ahí el Lobby la propaga: el trigger `trigger_cotizacion_aprobada_crea_proyecto`
hace `UPPER(TRIM(tipo_cotizacion))` y lo escribe en `proyectos.tipo`.

**Lo que hay que acordar:** que el Cotizador escriba exactamente una de las cuatro palabras —
`Stand` · `Expo` · `Equipamiento` · `Energía`. Hoy no hay nada que lo garantice.

> 🔎 **Dato suelto que conviene mirar:** hay **1 proyecto en prod con `tipo = 'MOBILIARIO'`**, que no
> es ninguna de las cuatro ramas. No vino del trigger (no hay cotización con ese tipo): se cargó a
> mano. Es un solo registro, pero muestra qué pasa cuando una columna de clasificación es texto libre.

### 2.3 · ★ El toggle de nivel de detalle — **el pedido nuevo de Fede**

**Lo que pidió, textual (23/8):** *«esto va a ser algo que tampoco muestre el detalle detalle. O si
no, tiene que haber un toggle que muestre o no muestre. Hay veces que me lo van a pedir, y yo solamente
lo voy a pasar detallado si me lo piden.»*

**La buena noticia: los niveles de detalle YA están construidos.** Lo que hay que hacer no es
programar un render nuevo, sino **desacoplarlo del modo**.

Hoy el nivel de detalle **está atado al modo de cotización** y no se puede elegir (fuente:
`docs/cotizador-contexto-respuestas.md` §5.2, respondido por Fede):

| Modo | Cómo sale hoy el PDF |
|---|---|
| **Stand** | Lista plana, **sin precios por ítem** (Infraestructura sale como *«estructura / sistema modular OCTEXA»*). Sólo el **total** |
| **Expo** | **Por espacio, con precios** por ítem + subtotal por espacio |
| **Alquiler** | Igual que Expo — **con precios** |

O sea que **el comportamiento que Fede quiere por defecto ya existe: es el del modo Stand.** El trabajo
es convertirlo en una elección en vez de una consecuencia.

**Los tres niveles, que es lo que el código ya sabe dibujar:**

| Nivel | Qué muestra | De dónde sale |
|---|---|---|
| **A · Total** | Un número. A lo sumo abierto por espacio o zona | La caja de total que ya arma el PDF |
| **B · Por bloque** *(default sugerido)* | **Qué incluye**, agrupado por rubro, **sin precios unitarios** | Es exactamente el modo Stand de hoy |
| **C · Detallado** | Ítem por ítem con cantidad y precio | Es exactamente el modo Expo/Alquiler de hoy |

**Recomendación: que sean tres opciones y no dos.** El toggle binario que pidió Fede se cubre con B↔C,
pero A ya está pedido por escrito para la rama Energía (ver §2.4) y sale gratis.

**Default sugerido: B** para las cuatro ramas — que es lo que hoy hace Stand, y lo que Fede describe
como su forma normal de mandar un presupuesto. **C sólo cuando lo piden.**

#### Dónde guardar la elección — sin tocar schema compartido

**En `cotizaciones.full_state`**, el JSONB que ya guarda el estado del presupuesto y es **propiedad
exclusiva del Cotizador**. Cero DDL, cero coordinación con el Lobby, cero riesgo de chocar con una
columna que el Lobby lea.

**No hace falta una columna nueva.** Verificado el 23/8: en `cotizaciones`, `cotizacion_items` y
`cotizacion_espacios` **no existe hoy ninguna columna de detalle/visibilidad** — así que agregarla
sería empezar a coordinar schema por algo que el JSONB ya resuelve.

⚠️ **Que el nivel viaje con el presupuesto, no con la sesión.** Si se guarda en una preferencia del
navegador, reimprimir una cotización vieja puede salir con un nivel distinto al que se le mandó al
cliente. Guardado en `full_state`, el PDF se regenera siempre igual — que es la misma razón por la que
el Lobby **no archiva** los PDF de factura y los regenera on-demand.

### 2.4 · La rama Energía en el Cotizador (§G8 de `PENDIENTES.md`)

Poder armar **un presupuesto que sea sólo de energía**, sin stand alrededor.

**Se comporta como los stands:** lleva muchos ítems adentro pero el presupuesto **no los discrimina**
— muestra un número total; a lo sumo se abre **por zona o espacio**, nunca ítem por ítem. O sea:
**nivel A o B del toggle, nunca C por default.**

En el Lobby la rama ya está completa desde el 20/8: cuenta `4.1.05 Ventas — Energía` + servicio
`SRV-ELEC`, ambos verificados en producción.

### 2.5 · El rubro Energía en el catálogo — **coordinación, no un `UPDATE`**

Hoy los ítems eléctricos están cargados bajo el rubro **Iluminación**, mezclados con los reflectores:

- `Tablero seccional monofásico`
- `Tablero seccional trifásico`
- `Tomacorriente doble`

**Por qué importa:** el rubro es lo que agrupa el presupuesto **en bloques**. Sin rubro propio, un
presupuesto de energía sale con los tableros desparramados entre las luces, y medir qué se vendió de
energía da mezclado.

⚠️ **El Cotizador también agrupa por rubro** — y no sólo eso: `docs/cotizador-contexto-respuestas.md`
§ documenta un **mapeo de rubros a 6 keys internas** (`Pisos`, `Infraestructura`, `Iluminación`,
`Equipamiento`, `Marketing`, `Más Servicios`). **Un rubro nuevo que no esté en ese mapeo puede
desaparecer del PDF o caer en un cajón equivocado**, no sólo verse distinto.

**Por eso el orden es: primero se suma la key `Energía` al mapeo del Cotizador, y recién después se
mueven los tres ítems en la base.** Al revés, quedan huérfanos. Es el mismo cuidado que se tuvo cuando
nació el rubro *Marketing* el 6/8.

Estado del catálogo medido el 23/8 — **351 ítems vivos con rubro**:

| Rubro | Ítems |
|---|---|
| Infraestructura | 240 |
| Equipamiento | 76 |
| Iluminación | 19 *(incluye los 3 que se van a Energía)* |
| Pisos | 8 |
| Más servicios | 6 |
| Marketing | 2 |

---

## 3 · El contrato con la base compartida (recordatorio)

Lo que ya está escrito en `CLAUDE.md` §7 y en la memoria `reference_cotizador_mepex`, resumido para
esta charla:

**El Cotizador LEE (no escribe):** `catalogo_items` (sólo `es_cotizable = true`; el precio es
**`precio_alquiler`** redondeado, **nunca** `precio_cliente`) · `clientes` · `proyectos` · `eventos`.

**El Cotizador ESCRIBE:** las columnas ALTER de `cotizaciones` (`tipo_cotizacion`, `superficie`,
`tipo_stand`, `altura`, `subtotal`, `iva`, `fecha_emision`, `full_state`, `pdf_url`, `project_id`,
`event_id`) + sus tablas propias `cotizacion_items` / `cotizacion_espacios` / `cotizacion_numerador` /
`cotizacion_propuestas` + los buckets `cotizaciones-pdf` y `propuestas-pdf`.

**Regla de oro:** columna nueva en tabla compartida = **coordinar**. Y **el precio se calcula una sola
vez** — la fórmula vive en `pricing.js` del Cotizador y el Lobby **no recomputa**: lee
`cotizaciones.monto_total` / `subtotal` / `iva`.

Para el toggle esto significa lo dicho en §2.3: **va en `full_state`**, que es territorio propio.

---

## 4 · El orden sugerido para la charla de allá

```
1. Vocabulario en las 3 pantallas (§2.1)          ← chico, ordena todo lo demás
2. Toggle de nivel de detalle (§2.3)              ← el pedido de Fede; el render YA existe
3. Key 'Energía' en el mapeo de rubros (§2.5)     ← ANTES de tocar la base
4. Mover los 3 ítems eléctricos al rubro nuevo    ← recién ahora, y avisando al Lobby
5. Modo/rama Energía como presupuesto propio (§2.4)
6. Acordar que tipo_cotizacion escriba una de las 4 palabras (§2.2)
```

**Lo que conviene NO hacer:** mover los ítems de rubro antes del paso 3, y agregar una columna nueva
para el toggle cuando `full_state` ya alcanza.

---

## 5 · Lo que sigue esperando a una persona (no es código)

De `PENDIENTES.md` §G9, porque toca directamente al Cotizador:

**Los guiones de brief de las otras tres ramas.** `brief.js` tiene las 10 preguntas de **stand** y nada
más. En `docs/las-cuatro-ramas.md` §3 quedaron **propuestos** los de expo, equipamiento y energía —
derivados del guion de stand, del catálogo real y de las cuentas contables, pero **sin validar por
nadie del área comercial**. Media hora con Noe alcanza.

**Es el prerequisito del agente de onboarding**: sin guion no hay chatbot que tome un requerimiento, y
ese guion no es trabajo de IA — es saber qué se le pregunta a un cliente.

Dos decisiones adentro: si **equipamiento** va con brief o con catálogo visual (el Showroom se
construyó para eso), y si el precio de **expo** se arma por módulo o por m² totales.
