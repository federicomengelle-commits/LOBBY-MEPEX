# Brief para el Cotizador — auditoría de la lógica de precios

> **Para llevar al proyecto del Cotizador.** Lo escribe el lado del Lobby (LOBBY-MEPEX), que es
> dueño del catálogo y de los costos. El objetivo es entender **cómo se forma un precio en el
> Cotizador hoy**, para poder diseñar entre las dos apps la fórmula del m² con coeficientes.
>
> **No es una revisión de calidad de código.** No hace falta buscar bugs ni proponer refactors.
> Lo que necesito son **datos y reglas escritas**: qué hace el sistema hoy y con qué números.
>
> Fecha: 2026-08-06

---

## 0 · Contexto — qué cambió del lado del Lobby hoy

Esto importa porque los precios que el Cotizador lee acaban de moverse.

**Se fijó una política de márgenes por rubro**, con dos bandas según sea fabricación propia o
subalquilado:

| rubro | propio | subalquilado |
|---|---|---|
| Infraestructura · Equipamiento · Iluminación | 100% | 50% |
| Marketing *(rubro nuevo)* | — | 50% |
| Pisos · alfombras | — | 60% |
| Pisos · tarimas | — | 45% |
| Más servicios | 45% | 45% |

> Ojo con la palabra: lo que el sistema llama "margen" es **markup** — se calcula sobre el costo,
> no sobre el precio. 100% de markup = 50% de margen real.

**Consecuencias directas para el Cotizador:**

1. **Cambiaron 23 precios**, de los cuales 5 son ítems cotizables. El más importante: el panel de
   sistema blanco pasó de $25.273,80 a **$28.082** — es el ítem con más volumen del catálogo
   (2.247 unidades en el historial).
2. **Nació un rubro nuevo: `Marketing`** (gráfica y cartelería). Hoy tiene un solo ítem, el vinilo
   impreso, que antes no tenía rubro. **Si el Cotizador agrupa por rubro para presentar el
   presupuesto, hay que ver que lo contemple.** Los seis rubros vigentes son: Infraestructura,
   Iluminación, Equipamiento, Pisos, Marketing, Más servicios.
3. **Las tarimas pasaron de "propias" a "subalquiladas"** (hay dos proveedores). Estaban mal
   clasificadas.
4. **El ítem 89 — "Panel sistema negro h=2,50m" — está congelado a propósito.** Su costo guardado
   está desactualizado y recalcularlo afirmaría una vida útil que el taller todavía no validó. No
   tocarlo desde ningún lado.

---

## 1 · La fórmula de precio — lo primero y lo más importante

**Qué necesito:** la fórmula escrita, tal como está en el código, no una descripción.

- ¿En qué archivo y función vive? (tengo anotado `pricing.js`, confirmar)
- **¿Parte de `catalogo_items.precio_alquiler` tal como viene, o lo recalcula?**
  Es la pregunta central: el Lobby es el dueño del costeo, y si el Cotizador recalcula por su
  cuenta, hay dos fuentes de verdad y en algún momento van a divergir.
- ¿Redondea? ¿Cuándo — por línea o al final?
- La diferencia exacta entre `precio_unitario_base` y `precio_unitario_ajustado`: qué se aplica
  entre uno y otro.
- Cómo se llega de `precio_unitario_ajustado` a `subtotal_linea`.

**Formato de respuesta ideal:** la cadena completa, así:

```
precio_alquiler (viene del Lobby)
  → precio_unitario_base        = ...
  → precio_unitario_ajustado    = base × ... × ...
  → subtotal_linea              = ajustado × cantidad
  → subtotal / iva / monto_total = ...
```

---

## 2 · Los tres coeficientes — el corazón de lo que buscamos

La tabla `cotizacion_items` guarda tres columnas por línea, y son NOT NULL:

- `height_multiplier_aplicado`
- `modifier_pct_aplicado`
- `fee_pct_aplicado`

**Por cada una de las tres:**

1. **¿De dónde sale el valor?** ¿Constante en el código, tabla de configuración, input del usuario,
   o derivado de algo (altura del stand, tipo de stand, superficie)?
2. **¿Qué valores puede tomar?** La tabla completa. Ej: *altura 2,50 → 1,0 · 3,00 → 1,2 · 4,00 → 1,5*.
3. **¿A qué líneas se aplica?** ¿A todas, o sólo a ciertos rubros o tipos de ítem?
4. **¿De dónde salieron esos números?** Aunque la respuesta sea "los puso alguien a ojo en su
   momento", sirve saberlo — es exactamente el tipo de número heredado que estamos tratando de
   convertir en criterio escrito.

---

## 3 · El metro cuadrado

- **¿Existe hoy un cálculo por m², o el precio es siempre la suma de las líneas?**
- Si existe: la fórmula, dónde vive, y con qué coeficientes.
- ¿Cómo entran al cálculo la **superficie** y la **altura** del stand? (Las columnas
  `cotizaciones.superficie` y `.altura` existen; quiero saber qué las lee.)
- ¿Hay un precio de referencia por m² en algún lado, aunque sea informativo?
- `tipo_stand` — ¿qué valores toma y qué cambia en el cálculo?

---

## 4 · Los dos casos que no encajan en "multiplicar por ítem"

**Iluminación.** Se cotiza por metro lineal, no por unidad. ¿Cómo lo resuelve hoy el Cotizador?
¿Hay una regla del tipo *"cada X metros de frente lleva Y reflectores"*?

**Estructura.** Un stand del doble de superficie no lleva el doble de columnas ni de dinteles.
¿Hay alguna regla de escalado, o el usuario carga las cantidades a mano?

Estos dos son los que probablemente no se resuelvan con un multiplicador y necesiten su propia
función. Por eso pregunto aparte.

---

## 5 · Cuatro campos que el Lobby ve vacíos

Estos apagan funcionalidad del lado del Lobby, así que valen aunque no sean de precios.

| campo | qué veo | qué necesito saber |
|---|---|---|
| `cotizaciones.estado` | Tiene DEFAULT `'borrador'` y **parece que el Cotizador no lo escribe** — toda cotización nace y se queda ahí | ¿Lo escribe en algún momento? ¿Qué estados maneja internamente? |
| `cotizaciones.vendedor_id` | **NULL siempre**, en todas | ¿Existe el concepto de vendedor en el Cotizador? Si no, ¿de dónde podría salir? |
| `cotizaciones.monto_total` | `COT-2026-0003` quedó en **$0** y es una cotización que se mandó a un cliente | ¿Cuándo se escribe? ¿Puede quedar en 0 legítimamente? |
| `cotizacion_items` | Las 3 cotizaciones vivas **no tienen ninguna línea** | ¿Se escriben siempre, o sólo en algunos flujos? |

Con `estado` y `vendedor_id` apagados, del lado del Lobby quedan muertos el pipeline kanban, la
conversión por vendedor y el aviso de *"enviada hace más de 3 días"*.

---

## 6 · Endpoints, hooks y lo que escribe cada uno

Un inventario, no un análisis:

- **Todos los endpoints del backend** (`server/index.js`): ruta, método, qué hace en una línea.
- **Qué escribe cada uno en Supabase**: tabla y columnas. Es lo que más me sirve — quiero el mapa
  de quién toca qué.
- El endpoint de la **propuesta comercial** (weasyprint, `/propuesta-api`): qué datos consume y
  dónde guarda el PDF.
- **La IA (Claude Haiku)**: en qué punto del flujo entra, qué recibe y qué devuelve. ¿Influye en el
  precio de alguna manera, o es sólo texto?
- Si hay **hooks, triggers o jobs** que corran solos.

---

## 7 · Una pregunta de integridad

**¿Qué pasa si `precio_alquiler` cambia entre que se arma una cotización y se emite?**

O sea: ¿la cotización **congela** el precio al momento de armarla, o lo **relee** cada vez?

No es teórico — hoy movimos 23 precios. Si una cotización vieja se reabre y se re-emite leyendo los
precios de hoy, el número que ve el cliente cambia sin que nadie lo haya decidido.

*(Del lado del Lobby, `cotizacion_items.precio_unitario_base` parece ser justamente el congelado.
Confirmar que se usa así.)*

---

## 8 · Lo que necesito que vuelva, en concreto

Tres entregables. Con esto se puede diseñar; sin esto, no:

1. **La fórmula completa escrita**, como la cadena del punto 1.
2. **La tabla de los tres coeficientes** con todos sus valores posibles.
3. **⭐ Diez a quince cotizaciones reales ya cerradas**, con: superficie en m², altura, tipo de
   stand, cantidad de líneas y monto total final.

El tercero es el más importante y el que más se subestima. **Con esas quince hago el camino
inverso**: saco el m² efectivo que se cobró en cada una y busco el patrón. Ese es el "número
mágico" — no se inventa en una reunión, se descubre midiendo lo que ya se cobró. Y después la
fórmula nueva se ajusta hasta reproducir esas quince con un margen de error aceptable, que es la
única prueba real de que sirve.

---

## 9 · Reglas del contrato compartido — importante

Las dos apps usan **la misma base de Supabase**. Al auditar, tener presente:

- **El Cotizador LEE** `catalogo_items` (sólo `es_cotizable = true`; el precio es
  `precio_alquiler`), `clientes`, `proyectos`, `eventos`.
- **El Cotizador ESCRIBE** las columnas ALTER de `cotizaciones` y sus tablas propias
  (`cotizacion_items`, `cotizacion_espacios`, `cotizacion_numerador`, `cotizacion_propuestas`).
- **No toca** `pyme_*` ni nada de facturación.
- **Regla de oro: una columna nueva en una tabla compartida se coordina entre las dos apps.**
  Si la auditoría propone agregar algo a `cotizaciones` o a `catalogo_items`, que quede como
  propuesta y no como cambio aplicado.

**Y una advertencia sobre el orden de trabajo:** si de esto sale que el Cotizador debería leer algo
nuevo del catálogo, **eso se construye primero del lado del Lobby**. Al revés, el Cotizador queda
pidiendo una columna que no existe.
