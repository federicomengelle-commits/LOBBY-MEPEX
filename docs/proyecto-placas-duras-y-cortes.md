# Proyecto — Placas duras, aprovechamiento de cortes y recuperación de gráfica

> **Estado: IDEA CON NÚMEROS. No arrancado.**
> Nació de costado en la sesión de costos del 2026-08-13, cuando al cargar los materiales apareció
> que **el Karikal sale más barato por uso que el Fibroplus**, al revés de lo que parece.
>
> Palabras de Fede: *"empezar a economizar demasiado las placas... cuando sean curvas sí Fibroplus,
> si no todos cortes, y cuidar los cortes y que no se rompan. Llevar el sistema al siguiente nivel
> y tener bien el stock de todas las placas, de todos los cortes, todo el tiempo."*

---

## 1 · La cuenta que lo dispara

| | comprar | vida útil | **por uso** |
|---|---|---|---|
| **Karikal H bifaz 3 mm** | $21.500/m² | 10 usos | **$2.150/m²** |
| **Fibroplus 3 mm** | $5.250/m² | 1 uso | **$5.250/m²** |

**Punto de equilibrio: 4,1 usos.** Una placa de Karikal que se use más de 4 veces ya salió más
barata que comprar Fibroplus cada vez. En los 10 usos de su vida, el ahorro es de **$31.000 por
metro cuadrado**.

> ⚠️ **Todo esto depende de un dato sin confirmar:** el VU = 1 del Fibroplus es uno de los 9
> valores que esperan la charla con Diego (`docs/costos-preguntas-taller.md`). Si el Fibroplus
> aguanta 3 o 4 usos reales, el negocio se achica mucho. **Confirmarlo es el paso cero.**

---

## 2 · Por qué no se hace ya: la gráfica

El Karikal se reúsa **sólo si se le puede sacar el vinilo**. Una placa dura con gráfica pegada
que no se puede despegar es una placa de un solo uso — o sea, lo peor de los dos mundos: precio
de Karikal, vida de Fibroplus.

**Ahí está el cuello de botella real, y Fede ya sabe cuál es la solución:**

> *"Hacer una especie de sistemita, o de hornito, para sacarle la gráfica a los paneles mucho
> más fácil. No sé bien cómo, pero tengo que hacerlo con rodillos y que le pegue calor de alguna
> forma a las placas. Más que nada las grandes."*

**El número que decide si conviene:** el ahorro es de $3.100 por m² por uso. A $15.000 la hora
de taller, eso da **12,4 minutos por metro cuadrado** de presupuesto de mano de obra para
despegar. Si sacar la gráfica de un m² lleva menos de 12 minutos, el proyecto cierra solo.

⛔ **Acción concreta y barata: cronometrar cuánto lleva despegar 1 m² de vinilo hoy, a mano.**
Ese único dato decide si hace falta el hornito o si ya conviene sin él.

---

## 3 · El aprovechamiento de corte — la otra mitad del ahorro

Hoy, de una plancha de Karikal (3050 × 1220 = **3,72 m²**) sale **una sola** placa de panel de
960 × 2410 (2,31 m²). **Aprovechamiento: 62%. Se tira el 38%.**

Pero los recortes no son basura, son piezas del sistema:

```
┌────────────────────────────────┬──────────┐
│                                │  franja  │   plancha 3050 × 1220
│   placa de panel               │  3050    │
│   960 × 2410                   │  × 260   │   → de la franja sale
│                                │          │     la placa de cenefa
│                                │  ← 2940  │     2940 × 210
├────────────────────────────────┤  × 210   │
│  recorte 640 × 960             │          │   → y del recorte,
│  → placa 465 × 640             │          │     una placa chica
└────────────────────────────────┴──────────┘
```

| | área usada | aprovechamiento |
|---|---|---|
| hoy (1 placa de panel) | 2,31 m² | **62%** |
| con nesting (panel + cenefa 2940×210 + chica) | 3,38 m² | **91%** |

**Casi 30 puntos de aprovechamiento**, y la placa de cenefa de 3 m —la más usada en expos—
sale del recorte del panel. Eso además explica algo del costeo actual: si la cenefa se cobra a
m² pleno pero sale de un recorte ya pagado por el panel, el precio está contando material dos
veces.

---

## 4 · Qué habría que construir

| | qué | para qué |
|---|---|---|
| **1** | **Catálogo de cortes calientes** — las 10-15 medidas de placa que se repiten en toda obra (frente de vitrina 960×660, cenefa 1950×210 y 2940×210, placa de panel 960×2410, …) | Saber qué comprar y qué tener siempre |
| **2** | **Stock por corte** — cuántas hay de cada medida, en cada material y color | Hoy no existe. Es lo que permite decir "esta expo ya está cubierta" o "faltan 40 placas" |
| **3** | **Plan de corte / nesting** — dada una lista de placas a producir, cómo se acomodan en la plancha con mínimo desperdicio | Los 30 puntos de aprovechamiento de arriba |
| **4** | **El hornito** — rodillos + calor para despegar vinilo | La precondición de todo. Sin esto el Karikal no se reúsa |
| **5** | **Análisis de inversión** — cuánta plata hay que poner en stock inicial de Karikal y en cuántas obras se recupera | Lo que Fede pidió: *"ver una potencial inversión, en cuánto se recupera comparado con el Fibroplus"* |

**Y dónde engancha con lo que ya existe:** los **prediseñados** (`proyectos.es_prediseno`, 2 ya
cargados). Un stand prediseñado con su BOM resuelto es exactamente una lista de cortes conocida
de antemano — o sea, la demanda predecible que justifica tener el stock.

---

## 5 · Lo que queda fuera de este proyecto

Las **curvas siguen siendo Fibroplus, siempre**. El Karikal no se dobla; la placa blanda existe
justamente por eso. Radios en uso: 500 · 1000 · 1400 · 1500 · 1750 · 2000 mm — la de 2000 se usa
poco porque *"se termina abriendo si la placa es muy pesada"*.

---

## 6 · Orden sugerido

1. **Confirmar el VU real del Fibroplus con Diego** — si no es 1, todo el proyecto cambia de tamaño
2. **Cronometrar el despegado de 1 m² de vinilo** — decide si hace falta el hornito
3. **Listar los cortes calientes** — sale de las recetas una vez que estén cargadas (paso 3 del plan de costos)
4. Recién ahí: nesting, stock e inversión

Los dos primeros son de una tarde y definen si el resto vale la pena.

---

*Sesión de origen: 2026-08-13. Ver `docs/costos-octexa-piezas-y-nomenclatura.md` §2.5 y §2.6.*
