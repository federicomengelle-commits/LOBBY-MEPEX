# Placas — qué es realmente el Karikal y cómo comprarlo afuera

> **Estado: INVESTIGACIÓN. Nada pedido, nada comprado.**
> Continuación de `docs/proyecto-placas-duras-y-cortes.md`. Ahí quedó demostrado que el Karikal
> conviene por uso; acá se ataca la otra mitad: **conseguirlo más barato y con previsibilidad.**
>
> Pedido de Fede (2026-08-14): *"de qué manera puedo yo comprar, o al menos pedir presupuesto,
> de unas placas similares y hasta capaz mejores que las que compro acá, tipo en China, y comprar
> de a mil o dos mil placas."*
>
> ### 👉 **Para ACTUAR: [`placas-mails-para-mandar.md`](placas-mails-para-mandar.md)**
> Los 3 mails escritos y listos para copiar y pegar, con los contactos. **Este documento es el
> porqué; ese otro es el qué hacer.**

---

## 1 · El hallazgo que cambia la búsqueda

**El "Karikal H" no es un material raro. Es un producto de catálogo mundial con otro nombre.**

Karikal es un fabricante argentino de **San Francisco, Córdoba**. Su producto `Kariplac H` es:

| | |
|---|---|
| **Sustrato** | **hardboard** — lo que acá se llama *chapadur*: fibra de madera prensada en húmedo, alta densidad |
| **Revestimiento** | laminado decorativo de alta presión: cara decorativa con **resinas melamínicas**, capas internas con **resinas fenólicas** |
| **Espesor** | 3 mm |
| **Colores de catálogo** | 5520 Blanco Nube · 5332 Cuadrillé Gris · 5513 Verde Oficial |
| **Usos que declara el fabricante** | carrocerías, colectivos, vagones, **tabiques y stands de exposición**, fondos de muebles |
| **⚠️ Condición comercial** | ***"No es un producto de stock permanente. Se fabrica a pedido del cliente."*** |

**Esa última línea es la explicación de tu problema de previsibilidad.** No es que compres mal:
el producto **no existe en góndola**, se produce contra pedido. Por eso *"no puedo comprar rápido,
tengo que tener previsibilidad"*. Importar no sólo baja el precio — **resuelve el problema
estructural de que el material no está disponible.**

**Cómo se llama afuera** (esto es lo que hay que tipear en Alibaba, no "karikal"):

```
melamine faced hardboard          ← el nombre exacto
melamine faced HDF                ← sinónimo comercial más usado
melamine coated hardboard
double-sided melamine hardboard   ← para el bifaz
```

Partida arancelaria: **44.11** (tableros de fibra de madera). El hardboard, por densidad > 0,8 g/cm³,
cae en **4411.92**. Confirmar el desdoblamiento exacto con el despachante.

---

## 2 · Lo que estás pagando hoy, en dólares

Dólar oficial venta al 14/08/2026: **$1.510**.

| | ARS | USD |
|---|---|---|
| Karikal H bifaz 3 mm | $21.500 /m² | **US$ 14,2 /m²** |
| **por plancha** (3050 × 1220 = 3,72 m²) | **$80.000** | **US$ 53** |
| 1.000 planchas | $80.000.000 | US$ 53.000 |
| 2.000 planchas | $160.000.000 | US$ 106.000 |

**US$ 14 el m² es un precio altísimo para este material.** Es lo que cuesta un producto
hecho a pedido, en tiradas chicas, con un solo proveedor. En el mercado internacional el mismo
tablero se mueve en el orden de **US$ 1 a 3 el m² FOB**.

> ⚠️ Los precios FOB de esta sección salen de listados públicos de Alibaba y Made-in-China, que
> son **precios vidriera, no cotizaciones**. Sirven para saber si vale la pena averiguar —
> y la respuesta es que sí, por goleada. El número real sale recién con RFQ.

---

## 3 · El dato técnico que manda sobre todo: **el largo de 3050**

Esto es lo más importante de todo el documento y no es el precio.

La plancha estándar mundial de fibra es **1220 × 2440**. La segunda medida más común es
**1220 × 2750** (la brasilera). **El 3050 es una medida larga, menos habitual.**

Y vos dependés del 3050 por una sola pieza: **la cenefa de 3 módulos, 2940 mm**, que no entra
en ninguna plancha más corta.

| plancha | ¿entra el panel 960 × 2410? | ¿entra la cenefa 2940 × 210? | aprovechamiento del panel |
|---|---|---|---|
| **1220 × 3050** (la de hoy) | ✅ | ✅ | 62% solo · **91% con nesting** |
| 1220 × 2750 (Brasil) | ✅ | ❌ | ~84% |
| 1220 × 2440 (la mundial) | ✅ (justo: 2410 de 2440) | ❌ | **~95%**, pero sin cenefa larga |

**La decisión que se abre:** comprar todo en 3050 (menos proveedores, más caro, pero cierra el
nesting de `proyecto-placas-duras-y-cortes.md` §3), o **partir el pedido**: el grueso en 2440
—que es más barato, más disponible y rinde mejor para paneles— y un lote chico en 3050 sólo para
cenefas. La segunda opción es probablemente la ganadora, pero hay que hacer el número con la
lista de cortes calientes en la mano (paso 3 de aquel doc).

---

## 4 · Cuánto es "mil o dos mil placas" en contenedores

Plancha 3050 × 1220 × 3 mm de hardboard (densidad ~950 kg/m³): **0,011 m³ y ~10,6 kg cada una.**

| cantidad | volumen | peso | contenedor |
|---|---|---|---|
| **1.000 planchas** | 11,2 m³ | 10,6 t | **20' GP** (33 m³ / ~28 t) — sobra lugar |
| **2.000 planchas** | 22,3 m³ | 21,2 t | **40' HQ** (76 m³ / ~26 t) — **medida justa** |

**Conclusión limpia:** 2.000 planchas ≈ **un contenedor de 40 pies bien cargado**. Con este
material el límite es el **peso**, no el volumen: en un 40'HQ no entran mucho más de ~2.400
planchas aunque sobre espacio. Tu intuición de "mil o dos mil" era exactamente la escala correcta.

---

## 5 · Estimación de costo puesto en Buenos Aires

Escenario: **2.000 planchas de 3050 × 1220 (7.442 m²) en un 40'HQ.**

| concepto | supuesto | US$/m² |
|---|---|---|
| FOB China | US$ 2,50/m² | 2,50 |
| Flete marítimo 40'HQ | US$ 4.500 | 0,60 |
| Seguro | 1% | 0,03 |
| **CIF** | | **3,13** |
| Derecho de importación | **15% ⚠️ a confirmar** | 0,47 |
| Tasa de estadística | 3% | 0,09 |
| Despachante + terminal + flete interno | US$ 2.000 | 0,27 |
| **PUESTO EN EL GALPÓN** | | **≈ US$ 4,0 /m²** |

**≈ $6.000 el m² contra los $21.500 de hoy. Un cuarto del precio.**

Con supuestos pesimistas (FOB US$ 4, flete US$ 6.000) da **US$ 5,7/m² ≈ $8.600** — todavía
**2,5 veces más barato**. El ahorro sobre el contenedor va de **$100 a $115 millones**.

> El IVA (21% + 20% adicional) y la percepción de Ganancias **no son costo**: son crédito fiscal.
> Sí son **caja inmovilizada** varios meses — eso hay que preverlo, no ignorarlo.

**⚠️ El número que falta y decide la escala:** cuántos m² de placa consume MEPEX por año.
7.442 m² reusados 10 veces son 74.000 m²-uso. Si eso son cinco años de demanda, comprar 2.000
planchas no es una compra, es plata dormida. **Antes de pedir el contenedor hay que sacar el
consumo anual real** (sale de las recetas + el historial de cotizaciones).

---

## 6 · La dureza de superficie manda — y descarta el aluminio

> **Corrección del 14/08 (objeción de Fede, y tiene razón).** La primera versión de este documento
> proponía ACP (composite de aluminio) como alternativa. **Queda descartado.**
>
> *"Estas placas se rayan. Lo que hace la fórmica o melamina es que aguanta mucho las rayas. Si le
> pegás con la punta de una placa a otra… cuando se raya ya no la podés usar en exposiciones,
> queda una raya que da muy mal y no sirve más la placa."*

**El criterio real de vida útil de una placa de stand no es que no se rompa: es que no se raye.**
Una placa entera con una raya está muerta igual que una partida. Y eso se mide.

### La escala de dureza (prueba del lápiz)

| material | dureza | qué pasa cuando se raya |
|---|---|---|
| ACP con pintura PE (el barato) | ~1H | se marca con la uña |
| **ACP con PVDF** (el "bueno") | **1H – 2H** | **la raya deja ver el aluminio plateado abajo del blanco — es el peor caso visual** |
| ACP serie "anti-scratch" | hasta 3H | sigue debajo de una melamina común |
| Melamina directa (LPL/TFL) | ~3H – 4H | se marca, pero no cambia de color |
| **HPL / fórmica (lo que tenés hoy)** | **4H – 6H** | **es la referencia. Norma EN 438** |

**Sobre el aluminio confirmaste dos cosas y las dos son ciertas:** la pintura del ACP es blanda
(1H–2H) **y** el núcleo es polietileno blando, así que un golpe de punta **abolla en forma
permanente** — no vuelve. Peor todavía: cuando se raya, aparece el aluminio plateado abajo del
blanco. En una placa melamínica la raya se ve; en el ACP **brilla**.

### ⚠️ La trampa que tenía mi RFQ anterior

Esto es lo más importante de la corrección. **Tu Kariplac H es HPL** —laminado de **alta**
presión, multicapa con núcleo de kraft fenólico, norma EN 438: literalmente fórmica, la palabra
que usaste vos. Pero en China, cuando pedís **"melamine faced HDF"** te mandan **LPL / TFL**:
papel melamínico prensado **directo** sobre el tablero, a baja presión. Es **otro producto y es
más blando.**

> **Con el texto que te di ayer podías comprar un contenedor buenísimo de precio y traerte una
> placa que se raya más que la que usás hoy.** El pedido tiene que decir **HPL** y tiene que
> pedir el número de abrasión, no la palabra "melamina".

**Los tres datos que hacen la comparación objetiva** (y que un proveedor serio contesta sin
chistar):

| pedir | valor de referencia |
|---|---|
| **Abrasión EN 438-2, en revoluciones** | vertical grade ≥ **150 rev** · **horizontal grade ≥ 350 rev** ← pedir esta |
| **Dureza de lápiz** | **≥ 4H** |
| **¿Lleva overlay?** | **sí** — el overlay es la capa que aguanta la abrasión. Sin overlay el número se desploma |

### El candidato que sí puede ser mejor: **HPL compacto (fenólico macizo) 3 mm**

Ya que el material tiene que ser de esta familia, el upgrade está **dentro** de la familia, no
afuera. El compacto es **la misma superficie HPL que ya te funciona**, pero sin tablero abajo:
la placa entera es kraft fenólico prensado. Es el material de las **divisiones de baños
públicos** — está diseñado para que lo maltraten.

| | Kariplac H (hardboard + HPL) | **HPL compacto 3 mm** |
|---|---|---|
| superficie | HPL 4H–6H | **HPL 4H–6H — la misma** ✅ |
| golpe de punta en el canto | **el chapadur se desgrana** | no tiene canto blando: **es macizo** |
| humedad del galpón | **se hincha, se abomba** | **inmune** |
| peso | 2,9 kg/m² | ~4,2 kg/m² |
| bifaz | sí | **sí, nace bifaz** |
| vida útil realista | ~10 usos | **25–30 usos** |
| FOB China | US$ 1–3 /m² | **US$ 8–15 /m²** |

**Por costo por uso empatan o gana el compacto** (≈US$ 0,40/uso contra ≈US$ 0,40 del chino
puesto), pero el compacto gana en **las dos formas de morir que describiste**: no se desgrana en
el canto y no se abomba con la humedad. Se paga más adelante y se rompe menos.

**Conclusión: se cotizan tres, todos de superficie dura.** HPL sobre hardboard 3050 · HPL sobre
hardboard 2440 · HPL compacto 3 mm. **El aluminio sale de la lista.**

---

## 7 · El camino corto que no habías pensado: Brasil

Duratex y Eucatex fabrican exactamente esto —**"chapa de fibra de madeira revestida com material
melamínico"** (Duratex) y **Eucadur** (Eucatex)— y son gigantes del rubro.

| | China | **Brasil** |
|---|---|---|
| arancel de importación | ~15% ⚠️ | **0% (Mercosur)** |
| tránsito | 45–60 días | **15–20 días** |
| mínimo | contenedor completo | **se puede traer un camión / pallets** |
| idioma y huso horario | 12 h de diferencia | mismo huso |
| medida larga | 3050 disponible | **2440 y 2750 — no llega a 2940** ❌ |

**Brasil es el mejor primer paso para probar**, porque permite traer 100 o 200 planchas y ver
cómo se comporta el material sin jugarse un contenedor. **Su límite duro es el largo**: con 2750
no hacés la cenefa de 2940. Sirve para paneles, no para cenefas largas.

---

## 8 · La traba legal — mirarla ANTES de pagar nada

**Resolución 240/2019 de la Secretaría de Comercio Interior.** Los tableros de fibra y de
partículas, **revestidos o no** (sólo se excluye el OSB), necesitan acreditar requisitos técnicos
de calidad y seguridad para ser comercializados en el país.

- Aplica **explícitamente a los importadores**, no sólo a los fabricantes nacionales.
- Se cumple con **declaración jurada + informes de ensayo** de un organismo reconocido.
- **Los informes de ensayo valen 6 meses**; vencidos, hay que reensayar.
- **Está prohibida la importación definitiva** de mercadería que no cumpla.

**Traducción operativa:** al proveedor chino hay que exigirle desde el primer mail los
**certificados de emisión de formaldehído E1 o E0** (norma EN 717 / ASTM). Si no los tiene o no
los quiere mandar, **ese proveedor está descartado**, por barato que sea — la mercadería queda
trabada en aduana.

> **El HPL compacto, al no llevar tablero de fibra, no cae bajo esta resolución.** Un punto más a
> su favor que no es técnico sino de trámite: se importa sin el ensayo de formaldehído.

---

## 9 · Las tres maneras de comprarlo

| | qué es | cuándo conviene |
|---|---|---|
| **A · Importar directo** | contenedor a nombre de MEPEX, con despachante propio | el mejor precio. Requiere estar inscripto como importador, capital inmovilizado 90 días y bancarse el trámite |
| **B · Comprarle a un importador local** | alguien que ya trae tableros y te vende acá | precio intermedio, cero trámite, **cero riesgo**. El paso natural para *probar el material* |
| **C · Trading / agente llave en mano** | te cobra 5–10% y hace todo: proveedor, inspección, flete, aduana | **la opción sensata para el primer contenedor.** Se paga el fee una vez y se aprende el circuito |

**Para el primer movimiento: B o C.** El camino A conviene recién en el segundo o tercer
contenedor, cuando ya sabés qué proveedor querés y el material está probado.

---

## 10 · El plan concreto — 5 pasos, los dos primeros gratis

### Paso 1 · Mandar la RFQ (esta semana, cuesta cero)

Abrir cuenta en **Alibaba** y **Made-in-China**, publicar el pedido y escribirle en paralelo a
10-15 proveedores. **Texto listo para copiar y pegar:**

> Hi, we are an exhibition stand manufacturer in Argentina. We need a long-term supplier for
> **reusable** exhibition wall panels. The panels are assembled, transported and re-used many
> times, so **surface scratch and abrasion resistance is our single most important requirement** —
> a scratched panel cannot be used in an exhibition and is scrapped.
>
> **Please note: we need HPL (High Pressure Laminate, EN 438), NOT low-pressure / direct-pressed
> melamine paper (LPL / TFL / MFC).** Quotes for direct-pressed melamine board will not be
> considered.
>
> **Product A — HPL faced hardboard**
> - Substrate: wet-process hardboard / HDF · Total thickness: 3 mm
> - Surface: **HPL, both faces (double sided)**
> - Colour: pure white, **matt / semi-matt** finish (no gloss). Please also quote black.
> - Sizes: **1220 × 3050 mm** and **1220 × 2440 mm** — please quote both
>
> **Product B — Compact HPL (solid phenolic laminate)**
> - Thickness: 3 mm · white, matt, **both faces decorative**
> - Size: **1220 × 3050 mm**
>
> **For both products, please state these values explicitly:**
> - **Abrasion resistance to EN 438-2, in revolutions** (we require horizontal grade, ≥ 350 rev)
> - **Pencil hardness** (we require ≥ 4H)
> - **Does the surface include an overlay?** (yes / no)
> - Impact resistance and surface finish code
> - Formaldehyde: **E1 or E0, with test report (EN 717 / ASTM)** — mandatory for customs clearance
>   in Argentina. We cannot import without it.
>
> Please advise: **FOB price per m² and per sheet**, port of loading, MOQ, quantity per 40'HQ
> container, lead time, and payment terms.
> Target quantity: **2.000 sheets (approx. 7.400 m²)**, recurring.
>
> Please also quote **cut-to-size**: we would send a cutting list of fixed sizes
> (960 × 2410, 2940 × 210, 960 × 660). Advise if you charge per piece or per full sheet.

**Ese último párrafo puede valer más que el descuento por volumen.** Hoy tirás el 38% de cada
plancha (`proyecto-placas-duras-y-cortes.md` §3). Si la fábrica corta a medida y te cobra por
pieza, te ahorrás el desperdicio **y** las horas de taller de cortar.

### Paso 2 · Pedir muestras (US$ 100–200, y es la plata mejor gastada del proyecto)

De los 3-5 proveedores que mejor contesten, pedir muestras. **No para mirarlas.** Tres pruebas,
en este orden de importancia:

> ⛔ **1 · El rayado — el que decide si la placa sirve.** Agarrar el canto de otra placa y
> **rayar la muestra igual que se raya en la carga y descarga**. Después la prueba de la moneda y
> la de la llave. **Comparar contra un pedazo de Kariplac actual, al lado, con el mismo golpe.**
> Si se raya más que el Kariplac, se descarta — no importa el precio ni el número que declaró
> el proveedor.
>
> ⛔ **2 · El despegado del vinilo.** Pegarle vinilo, dejarlo una semana y **despegarlo
> cronometrando**. Todo el proyecto de placas duras depende de que la gráfica salga
> (`proyecto-placas-duras-y-cortes.md` §2), y el presupuesto es de **12 minutos por m²**.
>
> **3 · La humedad.** Un pedazo dos semanas en el galpón y ver si se abomba. Acá el compacto
> debería ganarle al hardboard por lejos.

**Mandar también una muestra del Kariplac actual al proveedor** y pedirle que iguale o supere.
Es la forma más rápida de que entiendan el nivel sin discutir normas por mail.

### Paso 3 · Recién ahí, comparar de verdad

Con muestras aprobadas y precios reales, hacer el cuadro **costo por uso** —no costo de compra—
de los 3 candidatos: **Karikal actual · HPL sobre hardboard chino · HPL compacto chino**. Y el
número de usos de cada uno **sale del test del rayado, no del catálogo del proveedor.**

### Paso 4 · Confirmar la escala antes de firmar

Sacar el **consumo anual de m²** y ver si 2.000 planchas son un año o cinco. Es la diferencia
entre una buena compra y $160 millones dormidos en el galpón.

### Paso 5 · Primer pedido chico, por la vía B o C

Ideal: **un lote de prueba de Brasil o de un importador local** antes del contenedor. Se compra
tiempo y se compra certeza.

---

## 11 · Lo que NO conviene hacer todavía

- **No aceptar la palabra "melamina" sola.** Si no dice **HPL / EN 438** y no viene con el número
  de abrasión en revoluciones, es LPL y es más blando que lo que usás hoy. Es la forma más fácil
  de gastar un contenedor en un downgrade.
- **No comprar el contenedor sin el test del rayado y el del vinilo hechos.** Son los dos únicos
  requisitos no negociables, y en ese orden.
- **No ir a superficies pintadas** (aluminio, chapa prepintada, PVC impreso). Toda esa familia
  está en 1H–3H y la raya deja ver el material de abajo.
- **No cerrar por precio con un proveedor sin certificado E1/E0.** Queda en aduana.
- **No pedir todo en 3050.** Probablemente convenga el grueso en 2440 y un lote de cenefas en 3050.
- **No pagar 100% por adelantado.** El estándar es 30% anticipo, 70% contra copia de B/L.
- **No dejar la inspección al proveedor.** Un tercero (SGS, Bureau Veritas o el agente del camino C)
  revisa antes de que el contenedor salga. Sale unos cientos de dólares y evita recibir 2.000
  planchas fuera de escuadra.

---

## 12 · Cómo se conecta con lo que ya está escrito

| pendiente abierto | qué le hace esta investigación |
|---|---|
| **VU real del Fibroplus** (Diego) | **sigue siendo el paso cero.** Si el Fibroplus aguanta 3-4 usos, todo el negocio se achica — incluso importando |
| **El "hornito" para despegar gráfica** | sigue en pie: la superficie va a seguir siendo melamínica, así que el despegado no se resuelve solo cambiando de proveedor. **Antes de construirlo, cronometrar el despegado sobre las muestras** — puede que un HPL con overlay ya despegue mejor que el de hoy |
| **El rayado como criterio de vida útil** | **es un dato nuevo y hay que meterlo en el modelo de costos.** Hoy `costos-preguntas-taller.md` pregunta "cuántos armados dura"; la respuesta real es *"hasta que se raya"*. Vale la pena preguntarle a Diego **por qué** se descarta una placa: si es por raya, por canto desgranado o por hinchada — cada causa apunta a un material distinto |
| **Nesting / aprovechamiento de cortes** | si se compra cortado a medida en origen, el problema se resuelve comprando, no cortando |
| **Previsibilidad de compra** | es el problema que la importación resuelve mejor que el precio: pasás de un producto a pedido a stock propio |
| **Diferenciar blanco y negro** | en la RFQ hay que cotizar los dos colores desde el minuto uno |

---

*Investigación: 2026-08-14. Nada de esto está pedido ni cotizado — son precios de listado público
y estimaciones de costo. Los números reales salen del Paso 1.*

## 13 · Proveedores concretos — la lista corta

Datos sacados de las fichas públicas de cada fábrica al 14/08/2026. **Los precios son de listado,
no cotizaciones**, pero ya sirven para saber a quién escribirle y en qué orden.

### Placas duras

### 🔑 El filtro que ordena la lista: **el ancho de la prensa**

Antes que el precio, la calidad o la simpatía, hay un dato **físico**: cuánto mide la prensa de
esa fábrica. Una que lista medidas de 2130 tiene una prensa de 2130 o más y **puede** hacer la de
2150. Una que topea en 1830 **no puede** — y no hay precio, volumen ni insistencia que lo cambie.

> **Cómo se lee sin preguntar:** varias fábricas publican las medidas en **pies**. `6' = 1830` y
> `7' = 2130`. **Si en el listado no aparece nada de 7 pies, la prensa no llega.** Con eso sola
> se descarta media lista antes de escribir un mail.

| fábrica | dónde | ancho máximo | ¿sirve para 2150? |
|---|---|---|---|
| **Kepler** ⭐ | Changzhou, Jiangsu | lista **2130×2130, 2130×3050, 2130×3660, 2130×4270** en compacto · 0,5–30 mm · desde 2008 | ✅ **la mejor candidata** |
| **Yaming** ⭐ | Changzhou, Jiangsu | **1830** en sus páginas · pero declara *"18 medidas + corte + customización"* · compacto 3–25 mm | ⚠️ **preguntar** |
| Zhongtian | Changzhou, Jiangsu | lista 2130 **pero en laminado** · 40.000 m², ISO9002, 2 contenedores/día · HPL a **US$ 1,90/m²** | ⚠️ para la vía del laminado |
| Zhenghang | Changzhou, Jiangsu | mide en pies y **no tiene 7'** → topea en **1830** · 230.000 m², MOQ 50, US$ 25–40/plancha | ❌ |
| Fumeihua | Shenzhen | compacto sólo en 1220×1830 y 1220×2440 | ❌ *(+ puerto equivocado)* |
| Risewell | Shenzhen | compacto *Debo*, fuerte en 12 mm | ❌ *(+ puerto equivocado)* |

**Las dos que quedan —Kepler y Yaming— están las dos en Changzhou**, o sea mismo puerto y
consolidables. **Kepler va primera** porque es la única que ya publica la familia de 2130 en
compacto: no hay que convencerla de nada, sólo pedirle 20 mm más.

**Los contactos, los links y el mail entero están en
[`placas-mails-para-mandar.md`](placas-mails-para-mandar.md).**

### ★ El ancho de la plancha es la decisión más rentable de todo el proyecto

El nesting de `proyecto-placas-duras-y-cortes.md` §3 está calculado sobre **1220 de ancho**, que
es la plancha que se consigue acá. Pero las fábricas chinas listan anchos mucho mayores, y **la
placa de panel de 960 entra distinta cantidad de veces en cada uno.** El número que importa no es
el precio del m², es **cuántos m² de plancha consume UN panel**:

| plancha | m² | **paneles 960×2410 enteros** | qué sobra al ancho | **m² por panel** |
|---|---|---|---|---|
| **1220** × 3050 *(la de hoy)* | 3,72 | 1 | 260 → **cenefa 210 ✓** | **3,72** |
| 1525 × 3050 | 4,65 | 1 | 565 → nada estándar | 4,65 ✗ |
| 1830 × 3050 | 5,58 | 1 | 870 → **vitrina 660 + cenefa 210 ✓** | 5,58 *(pero rinde 2 piezas más)* |
| **★ 2150 × 3080** *(a pedir)* | 6,62 | **2** | **210 → cenefa ✓** *(+ 2 frentes de 660)* | **3,31** ⭐ |

### ★★ El plan de corte — el módulo entero de una sola plancha

## ⭐ **LA MEDIDA A PEDIR ES 2150 × 3080**

**No 2130 × 3050**, que es la medida estándar de catálogo. Las piezas suman 2130 × 3070 y la
sierra necesita su lugar: la plancha se pide **más grande que el estándar, a propósito.**

```
                       2150 de ancho pedido
      ┌─────────────┬─────────────┬───────┐ ┐
      │             │             │       │ │
      │   PANEL     │   PANEL     │   C   │ │  las piezas suman
2410  │  960×2410   │  960×2410   │   E   │ │  2130 de ancho
      │             │             │   N   │ │  3070 de largo
      │             │             │   E   │ │
      ├─────────────┼─────────────┤   F   │ │  se piden
 660  │   FRENTE    │   FRENTE    │   A   │ │  2150 × 3080
      │   960×660   │   960×660   │       │ │
      └─────────────┴─────────────┴───────┘ ┘
        └── corte ──┘└── corte ──┘   2940×210
```

| | cuenta | de dónde sale la demasía |
|---|---|---|
| **ancho 2150** | 960 + 960 + 210 = **2130** → **+20** | **dos** cortes de sierra al largo (cenefa y entre paneles) |
| **largo 3080** | 2410 + 660 = **3070** → **+30** | **un** corte transversal (+10) **y los 20 que faltan** para que el frente salga de **660** y no de 650 |

**Orden de corte** (el que definió Fede): primero la **cenefa** al largo · después los **dos
paneles** a 960 · y recién ahí el **corte transversal** que separa paneles de frentes.

| pieza | medida | cuántas |
|---|---|---|
| placa de panel | 960 × 2410 | **2** |
| frente de mostrador / vitrina | 960 × **660** | **2** |
| cenefa de 3 módulos | 2940 × 210 | **1** |

| | |
|---|---|
| plancha bruta 2150 × 3080 | 6,622 m² |
| **piezas útiles** | **6,512 m²** |
| **aprovechamiento** | **98,3 %** — contra el **62 %** de hoy |
| descarte | los cortes de sierra + una colita de 210 × 140 |

### ⛔ Por qué NO se pide "2130 neto" — la trampa está justamente ahí

Parece más elegante pedir *"2130 × 3070 como medida neta útil después del recorte"* y dejar que la
fábrica decida el bruto. **Es un error, y por un motivo puntual: 2130 × 3050 ES una medida
estándar de catálogo** (7' × 10' del mercado americano).

> Pedir "2130 neto" invita a que te manden **la plancha estándar de 2130** y te digan que ese ya
> es el neto. Y ahí **la cenefa queda mordida por la sierra** — es exactamente lo que no queremos.
>
> **2150 × 3080 no es medida estándar: la tienen que fabricar.** No hay ambigüedad posible, no hay
> interpretación, no depende de la buena voluntad de nadie. **Se pide el número y listo.**

**Los 20 mm de ancho no son un lujo, son la condición de que el plan exista:** a 2130 las piezas
entran justo y **los dos cortes de sierra se comen 8 mm que no están**. La cenefa sale de 202 y
rompés el estándar del sistema.

**Y los 30 de largo compran el frente completo:** a 3070 el frente sale de **650**; a 3080 sale de
**660**, que es la medida estándar que hoy se viene resignando a 640. Diez milímetros más de
plancha = **0,3 % más de material** y dejás de ceder en la pieza.

**Dos cosas a confirmar antes de festejar:**
- Falta que **Yaming confirme que fabrica 2150 × 3080 en compacto**. Es medida especial, así que
  puede tener un mínimo propio o un recargo — **preguntar el recargo explícitamente**, porque
  contra el 98 % de aprovechamiento casi cualquier recargo cierra.
- **Peso: 28 kg** por plancha en compacto de 3 mm. Es de a dos personas. Chequearlo con el taller
  antes de enamorarse del rendimiento.

**Igual hay que cotizar 1220×3050, 1830×3050 y 2150×3080, y comparar por m² por panel — no por m².**

### El servicio de corte en origen

Las fábricas de compacto **cortan a medida de rutina** (viven cortando cubículos de baño:
seccionadora y CNC). Si cortan ellos, el taller recibe **el kit del módulo listo** y desaparecen
el desperdicio y las horas de sierra. **Cuatro cosas a preguntar y a mirar con lupa en la respuesta:**

| | qué preguntar | por qué importa |
|---|---|---|
| **1** | **cómo cobran** — por corte, por m² o por plancha consumida | suelen cobrar la **plancha entera**. Acá da igual: con 98 % de aprovechamiento no hay recorte que perder |
| **2** | **tolerancia dimensional** de la pieza cortada | **si el panel llega de 963 no entra en el perfil OCTEXA.** Exigir ±1 mm por escrito |
| **3** | **embalaje** | flejado sobre pallet, **protección de canto** y papel entre pieza y pieza. La pieza cortada viaja peor que la plancha: tiene el canto expuesto |
| **4** | **rotulado por medida** | cada pieza en su paquete etiquetado, o llega un pallet de 3 medidas mezcladas para clasificar a mano |

> ⚠️ **Y una regla de negociación: en el mail NO se explica el plan de corte.** Se pide el neto
> garantizado y se pregunta si ofrecen corte, y nada más. El esquema de nesting es la ventaja de
> MEPEX; contarlo no mejora el precio y sí le enseña al proveedor cuánto vale lo que está vendiendo.

### ⚠️ La confusión que hay que tener clarísima: laminado ≠ placa

Casi todo lo que aparece buscando "HPL" es **laminado**: la lámina de 0,6 a 3 mm que se **pega**
sobre un tablero. No es un panel. Un listado que diga *"laminate sheet applied to substrates"* o
que liste aplicaciones tipo *"furniture veneer, cabinet"* **es superficie, no placa**, aunque
ofrezca 3 mm.

> **Y el corolario que ahorra discusiones: la dureza NO viene del espesor.** La superficie
> melamínica es igual de dura a 0,7 mm que a 3 mm — es la misma prensada y el mismo overlay.
> Lo que compra el espesor es **rigidez**, no resistencia a la raya. Un HPL nunca va a salir
> "blando" de superficie; el riesgo era que te mandaran **LPL** en vez de HPL, no que fuera fino.

**El dato que cierra la duda de si el compacto "es lo bastante durito":**

| | módulo flexural | densidad |
|---|---|---|
| **HPL compacto** (exigido por **EN 438-4**) | **≥ 9.000 MPa** | 1,35 g/cm³ |
| Hardboard / chapadur | ~3.000 – 4.500 MPa *(valor típico del grado)* | ~0,95 g/cm³ |

**El compacto de 3 mm es más del doble de rígido que el Kariplac de 3 mm.** Y en compacto el
**3 mm es el mínimo, no el máximo** — Yaming llega a 25. Si un paño de 2410 flexa en 3 mm, se
pide 4 o 5, algo que con el Kariplac no se puede porque ahí el 3 sí es el techo.

**Trampa de listado ya detectada en la práctica:** el producto *"Colors HPL Laminate Sheet"* de
Zhongtian tiene **MOQ de 8.000 piezas**, dice *"wear resistant"* **sin un solo número** y apunta a
grado mueble. La misma empresa tiene MOQ de **50–100** en otros productos. **Siempre mirar el MOQ
y exigir el número de abrasión antes de entusiasmarse con un link.**

### Y una tercera vía que aparece con el precio de Zhongtian

Zhongtian vende el **laminado HPL solo** (la lámina de ~0,8 mm) a **US$ 1,90 el m²**. O sea:
comprar sólo la superficie —que es lo caro y lo que no se consigue acá— y pegarla sobre
**chapadur crudo comprado en Argentina**, que es barato y sí hay en stock.

- **A favor:** la lámina pesa ~1,1 kg/m² contra 2,9 del tablero → **el flete se desploma**, y al
  no importar tablero de fibra **no aplica la Resolución 240/2019.**
- **En contra:** hace falta prensar. Y ojo con esto: **un tablero de 3 mm laminado de un solo
  lado se curva** — hay que laminar **las dos caras sí o sí** para que quede equilibrado.

No es el primer movimiento, pero **es la opción más barata de todas si algún día se monta la
prensa**, y conviene tener el número a mano cuando se discuta.

---

## 14 · Acrílico 2 mm

### El proveedor

| | |
|---|---|
| **Zhejiang Leasinder Technology** | Hangzhou, Zhejiang · fabricante desde 2011 |
| producto | acrílico **extruido** (PMMA), **100% materia prima virgen** |
| espesores | 0,8 – 8 mm (hasta 0,6–15 a pedido) — **el 2 mm está en el rango estándar** |
| medidas | **1220×2440** y 1220×1830, o a medida |
| **precio** | **US$ 1,80 – 2,80 por kilo** |
| **MOQ** | **1.000 kg (1 tonelada)** — *espesores, colores y medidas se pueden mezclar dentro de la tonelada* |
| entrega | 20–25 días · muestras en 1 día |
| pago | T/T · L/C a la vista · D/P |

### La cuenta

El acrílico de 2 mm pesa **2,4 kg/m²**. Entonces:

| | |
|---|---|
| precio por m² | **US$ 4,3 – 6,7** |
| plancha 1220×2440 (2,98 m²) = 7,1 kg | **US$ 13 – 20 FOB** |
| **la tonelada del MOQ** | **420 m² ≈ 141 planchas** |
| **volumen de esa tonelada** | **0,84 m³** |

**Ese último número es la buena noticia.** El mínimo de acrílico ocupa menos de un metro cúbico:
**entra en un rincón del contenedor de las placas.**

### ⚠️ Las dos trampas del acrílico (y la defensa, que es una sola)

1. **Material reciclado disfrazado de virgen.** El reciclado amarillea y se quiebra al cortar.
   Por eso importa que Leasinder declare *"100% virgin raw materials"* — **hay que pedir que lo
   escriban en la proforma**, no que quede en el chat.
2. **Sub-espesor.** Es *el* vicio del acrílico chino: te venden "2 mm" y llega de 1,7. En una
   plancha no se nota; en 140 estás pagando 15% de aire.

> **La defensa contra las dos es la misma y ya está en la forma en que cotiza Leasinder:
> comprar por KILO, no por plancha.** Si viene más fino, entran más planchas en la tonelada y no
> perdiste nada. Si comprás por plancha, el sub-espesor es plata regalada. **Que la orden diga
> precio por kg y peso total** — y de paso pedir tolerancia de espesor por escrito.

**Extruido vs colado (cast):** el extruido es más barato y en 2 mm es lo normal —el colado
prácticamente no existe tan fino—, corta y termoforma bien. Su límite es que **amarillea a los
1–2 años a la intemperie**, contra 5+ del colado. Para uso en stand, bajo techo y guardado entre
expo y expo, **el extruido está bien**. Si algún día hay algo que vive afuera, ese va colado.

### "¿Lo vende el mismo proveedor?"

**No — y no hay caso: son dos industrias distintas.** El que prensa kraft fenólico no extruye
PMMA. Pero eso importa mucho menos de lo que parece, porque **lo que se comparte no es el
proveedor, es el contenedor**:

> **Yaming y Zhongtian están en Changzhou (Jiangsu). Leasinder está en Hangzhou (Zhejiang).
> Los tres cargan por el mismo puerto: Shanghái / Ningbo.**

Un agente consolidador junta las tres cargas en un depósito, arma un solo contenedor y sale un
solo embarque. **Es exactamente el beneficio que buscabas, y encima te deja elegir la mejor
fábrica de cada material en vez de atarte a una que hace las dos cosas más o menos.**

⛔ **Consecuencia práctica: no cotizar con Risewell si se va a consolidar.** Está en **Shenzhen**,
a 1.500 km y otro puerto (Yantian). Buena fábrica, mal encaje logístico para este armado.

---

## 15 · El cierre — qué se decidió y qué sigue

**Lo que quedó firme:**

1. El Karikal H es **HPL sobre hardboard**, se fabrica **a pedido** y lo estás pagando a
   **US$ 14/m²** cuando afuera el mismo producto está entre **US$ 1 y 3**.
2. **El material tiene que ser de superficie dura (HPL, 4H–6H).** El aluminio quedó descartado
   por rayado y por abolladura. Todo lo pintado queda afuera.
3. **La medida que manda es 2150 × 3080 — pedida así, no como "neto".** De una plancha salen
   **2 paneles + 2 frentes + 1 cenefa**, con **98 % de aprovechamiento** contra el 62 % de hoy.
   **No es medida estándar y eso es a propósito:** la estándar de 2130 × 3050 no deja lugar para
   la sierra.
4. **El contenedor**: en 1220×3050 entran ~2.000 planchas en un 40'HQ (limita el peso). En
   **2150×3080 de compacto entran ~920 planchas — que son ~1.840 paneles + 1.840 frentes + 920
   cenefas.** Un 40'HQ es la unidad de compra en cualquiera de los dos casos.
5. **1 tonelada de acrílico entra en el mismo contenedor** y son 141 planchas.

**Las dos apuestas, que son distintas y se pueden probar juntas:**

| | HPL sobre hardboard | HPL compacto 3 mm |
|---|---|---|
| qué es | **lo mismo que usás hoy** | mismo *acabado*, sin tablero abajo |
| precio puesto | **≈ US$ 4/m² · un cuarto de hoy** | ≈ US$ 12–15/m² · **parecido a hoy** |
| vida útil | ~10 usos | **25–30 usos** |
| la apuesta | **la plata** | **el costo por uso y no romper** |

**Lo que sigue, en orden, y las dos primeras no cuestan nada:**

1. **Escribirle a Yaming y a Zhongtian** con el texto del §10 (ya corregido: dice HPL, pide
   revoluciones de abrasión y descarta melamina de baja presión). **A Leasinder, el de acrílico.**
2. **Pedir muestras a los que contesten bien** + mandarles un pedazo de Kariplac para que igualen.
3. **El test del rayado**, con el Kariplac al lado y el mismo golpe. Ahí se decide, no antes.
4. **Sacar el consumo anual de m²** para saber si 2.000 planchas son un año o cinco.
5. Recién entonces: un lote chico por un importador o un agente, y el contenedor después.

**Y los dos datos que siguen faltando y no dependen de China:**

- **El VU real del Fibroplus** (charla con Diego). Sigue siendo el paso cero de todo el proyecto.
- **Por qué se descarta una placa hoy** — raya, canto desgranado o hinchada. Cada respuesta
  apunta a un material distinto, y es la pregunta que faltaba en `costos-preguntas-taller.md`.

---

## Fuentes

- [Kariplac H — Emplacado (Karikal)](https://karikal.com.ar/productos-karikal/kariplac-h-emplacado/)
- [Kariplac H — Panel Decorativo (Karikal)](https://karikal.com.ar/productos-karikal/panel-decorativo-kariplac-h/)
- [Karikal — Soluciones en superficies](https://karikal.com.ar/)
- [Resolución 240/2019 — Cámara de Importadores](https://www.cira.org.ar/es/servicios/normativas-servicios/resolucion/resolucion-240-2019/)
- [Resolución 240/2019 — Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/207709/20190517)
- [Certificar tableros de fibra y partículas — Argentina.gob.ar](https://www.argentina.gob.ar/servicio/certificar-los-tableros-derivados-de-la-madera-de-fibras-y-de-particulas)
- [Melamine faced hardboard — Made-in-China](https://www.made-in-china.com/products-search/hot-china-products/Melamine_Faced_Hardboard.html)
- [Melamine hardboard — Alibaba](https://www.alibaba.com/showroom/melamine-hardboard.html)
- [HPL vs Melamina (LPL) — diferencias de prensado y resistencia](https://medium.com/@SteedForm/melamine-lpl-vs-high-pressure-laminate-hpl-whats-the-difference-ed95ff5a7c2d)
- [HPL vs TFL vs Melamina — cuándo usar cada uno](https://www.panel.com/hpl-vs-tfl-vs-melamine-their-uses-and-when-to-use-them/)
- [EN 438 — norma de ensayo de HPL (abrasión y rayado)](https://www.held-tech.de/en/furniture-and-laminates)
- [EN 14322 / EN 14323 — norma de tableros melamínicos](https://standards.iteh.ai/catalog/standards/cen/8cfc2e99-5886-4c93-9912-d3f7a82872b2/en-14322-2021)
- [Dureza de lápiz de ACP con PVDF (1H–2H) y series anti-rayas](https://www.der-acp.com/What-Anti-scratch-resistance-ACP-sheets-is-----DERACP.html)
- [HPL compacto fenólico 3mm — Made-in-China](https://www.made-in-china.com/products-search/hot-china-products/Compact_Laminate.html)
- **Yaming** — [HPL compacto fenólico, 3–25 mm, medidas hasta 1830×3050](https://en.chinawuya.com/Product/phenolic-HPL-compact-laminate.html)
- **Zhongtian** — [Changzhou Zhongtian Fire-Proof Decorative Sheets](https://ztdecor.en.made-in-china.com/)
- **Risewell** — [Shenzhen Risewell, compacto *Debo*](https://risewell.en.made-in-china.com/product-group/jeRQbEDYJzVI/Compact-Laminate-catalog-1.html)
- **Luli Group** — [HPL 1220×3050](https://luligroup.en.made-in-china.com/product/WeHmInVYOwpr/China-HPL-High-Pressure-Laminate-Board.html)
- **Leasinder** — [acrílico PMMA extruido 0,8–8 mm, US$1,80–2,80/kg](https://leasinderacrylic.en.made-in-china.com/product/RTPUOcZFfWkL/China-Leasinder-China-Acrylic-Sheets-Supplier-1mm-2mm-1220X2440mm-Clear-PMMA-Extruded-Acrylic-Sheet-Transparent-Perspex.html)
- [Chapa de fibra revestida melamínica Duratex](https://www.sodimac.com.br/sodimac-br/product/876382/chapa-de-fibra-de-madeira-revestida-com-material-melaminico-duratex/876382/)
- [Eucadur / Eucatex 3mm](https://www.madeiranit.com.br/chapa-de-fibra-duratree-eucadur-3mm-1-22x2-44mt-eucatex)
- [Cotización dólar — dolarapi.com](https://dolarapi.com/v1/dolares)
