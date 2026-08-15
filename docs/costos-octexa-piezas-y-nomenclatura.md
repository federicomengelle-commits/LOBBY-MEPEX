# Costos OCTEXA — piezas, nomenclatura y lista de materiales

> **Estado: DISEÑO CERRADO · primera tanda APLICADA en prod el 2026-08-13.**
> Ver [`sql/costos_octexa_placas_20260813.sql`](../sql/costos_octexa_placas_20260813.sql):
> **86 placas nuevas** (la familia no existía — había una sola placa en todo el sistema) +
> 3 correcciones de código. Revisado por `sql-reviewer`: 0 CRITICAL / 0 HIGH, 2 MEDIUM
> aplicados. Lo que **falta** está en
> [`docs/costos-octexa-lo-que-necesito.md`](costos-octexa-lo-que-necesito.md).
>
> Sesión abierta el 2026-08-13 con Fede. Este archivo junta las reglas, las decisiones,
> lo que hay que corregir y lo que falta preguntar.
>
> **Objetivo de fondo (palabras de Fede):** que el costeo se una al manejo de unidades y a
> las listas de elementos, *"para ir democratizando el conocimiento y hacer las listas de una
> manera que sea enseñable, escalable, y poder empezar a tomar gente que pueda aprender esto
> y llevarlo adelante bien"*.
>
> Fuentes cruzadas: `docs/octexa/octexa-data.json` (cerebro OCTEXA, catálogo oficial 2021) ·
> `docs/costos-modelo-decidido.md` (política de márgenes y vida útil) · el estado real de
> prod leído por PostgREST el 2026-08-13.

---

## 1 · Para qué existe esto

Hoy el sistema puede **costear** un panel. No puede **pedirlo**.

Cuando MEPEX cotiza una expo de 50 stands, alguien tiene que traducir eso a *"300 columnas de
2500, 450 dinteles de 950, 200 placas de 960×2410"* para que el taller prepare. Esa traducción
vive hoy en la cabeza de Fede. El objetivo es que la haga el sistema, y que el que la revise
pueda entenderla sin haber estado 20 años en el rubro.

La cadena completa, que **ya existe entera en la base**:

```
insumo            →  pieza           →  producto        →  stand tipo      →  expo
(perfil, placa)      (DLL-1940)        (panel, cenefa)    (STD-3x3-A)       (× 50)
insumos_base         catalogo_items    catalogo_items     proyectos          cotización
                     nivel 2           nivel 3            es_prediseno
```

Lo que falta no son tablas. Es: **(a)** que las piezas tengan costo, **(b)** que las cenefas
tengan receta, **(c)** una convención de códigos, y **(d)** el explosionador que baja de
"50 stands" a "300 columnas".

---

## 2 · Las reglas geométricas — la ley del sistema

Todas verificadas contra el cerebro OCTEXA **y** contra los datos reales de la base.
**Todo en milímetros, siempre.** (Confirmado por Fede, 2026-08-13.)

### 2.1 Horizontal

```
EE (entre ejes) = perfil visible + 40          ← 40 = diámetro de la columna
placa ancho     = perfil visible + 10          ← 10 = encastre, 5 mm por lado
```

La columna aporta 20 mm por lado. Un "módulo de 1 metro" es en realidad **990 mm entre ejes**,
con perfil visible de 950 y placa de 960.

| módulos | perfil visible | entre ejes | placa |
|---|---|---|---|
| ½ | 455 | 495 | 465 |
| 1 | 950 | 990 | 960 |
| 1½ | 1445 | 1485 | 960 + 465 |
| 2 | 1940 | 1980 | 960 + 960 |
| 2½ | 2435 | 2475 | 960 + 960 + 465 |
| 3 | 2930 | 2970 | 960 × 3 |

### 2.2 Vertical

```
placa alto = altura del módulo − 90            ← (2 perfiles de 50) − 10 de encastre
```

El perfil **mide 52 × 15,5 mm de verdad** (DLL-052, catálogo OCTEXA 2021), pero **se cota como
50** para redondear. La placa se corta 10 mm más grande que el vano para que encastre en la
cuña. Históricamente eran 12 mm; se pasó a 10 para simplificar la cuenta y que la placa vaya
más suelta — *"es mejor cuando tenés un poquito de juego para mover"* (Fede).

**La regla de oro:** perfiles = 50 · placas = múltiplos de 50 · encastre = +10 real.

Verificación con cuatro casos independientes:

| caso | cuenta | placa | fuente |
|---|---|---|---|
| panel 2500 | 2500 − 90 | 2410 | dato real de `PLA-960-2410` |
| cenefa 300 | 300 − 90 | 210 | Fede + cerebro |
| cenefa 500 | 500 − 90 | 410 | Fede |
| cenefa 800 | 800 − 90 | 710 | Fede |

### 2.3 Cotas, no pilas

La cenefa **sale perpendicular** de la misma columna que el panel. No hay una pila vertical:
cada módulo se define por **desde qué cota hasta qué cota**, en la cara que le toque.

```
columna COC-3400 — una sola, 8 caras enchufables a 45°
   cara A →  panel     de    0 a 2400
   cara B →  cenefa    de 2100 a 2400      ← perpendicular
   cara B →  cenefa    de 2600 a 3400      ← el "doble juego"
```

**Consecuencias para el BOM:**
- La **columna se cuenta una sola vez** aunque reciba 8 paños. Contarla por paño la duplica.
- La columna se dimensiona por **la cota más alta de todo lo que se le cuelga**, mire donde mire.
- La cenefa **no suma columnas**: sólo las alarga. Un stand de 2,40 con cenefa de 30 lleva
  `COC-2500`, no `COC-2400` + algo.

### 2.3.bis La regla de conteo — `columnas = paneles + 1`

Así está cargado el panel que funciona, y es correcto:

> **`PSB-250` = 2 × dintel `DLL-950` + 1 × columna `COC-2500` + 1 × placa `960 × 2410`**

**Una sola columna por panel**, porque se comparte con el vecino. Es exactamente lo que dicta
Fede: *"si son 10 paneles, son 11 columnas, 10 placas, 20 perfiles"*.

```
   │panel│panel│panel│          3 paneles
   ▲     ▲     ▲     ▲          4 columnas   →  columnas = paneles + 1
```

**El "+1" es por tramo recto, no por stand.** Cada tramo que arranca suma su columna de cierre;
en una esquina, los dos tramos **comparten** la columna del vértice y no se cuenta dos veces.
Ahí está el pendiente que el cerebro OCTEXA ya tiene anotado: *"falta el conteo de columnas por
topología (L / U / perímetro / isla) para el BOM automático"*.

### 2.4 Los topes duros

| tope | valor | qué implica |
|---|---|---|
| **perfil máximo** | **5900 mm** | la barra viene de 6000. Ninguna pieza de perfil pasa de 5900 = **6 módulos**. Más largo que eso se resuelve con varias piezas separadas por columna |
| **placa máxima — Karikal** | **3050 × 1220** | la plancha. Por eso la cenefa de 3 módulos va entera (2940 ✓) y la de 3½ se parte (3435 ✗) |
| **placa máxima — Fibroplus** | **2600 × 1830** | tope de placa **2445**. En Fibroplus no existe la placa de 2940 |
| voladizo máximo | ~500 mm | práctica: 250 de profundidad y ≤500 de alto; más, palanquea |
| altura máxima | 5000 mm | se llega con columna OCTEXA común, no hace falta Máxima |
| alturas estándar | 2400 · 2500 · 2900 · 3400 · 3950 · 5000 | 2500 = medianera típica. **No existen 4400 ni 4900** |

> ⚠️ El cerebro OCTEXA anota `placa_max_entera_mm: 2500` como pendiente a confirmar (P3).
> **Queda descartado:** el límite real es el largo de la plancha, no un número redondo. Fede usa
> placa de 2940 en la cenefa de 3 m. Corregir en `octexa-data.json`.

### 2.5 Materiales de placa

| material | plancha | placa máx | costo | vida útil | costo **por uso** |
|---|---|---|---|---|---|
| **Karikal H bifaz 3 mm** | 3050 × 1220 | 2940 | $21.500/m² | 10 usos | **$2.150/m²** |
| **Fibroplus 3 mm** | 2600 × 1830 | 2445 | $5.250/m² | **1 uso** | **$5.250/m²** |
| Fibroplus 5,5 mm | 2600 × 1830 | 2445 | $5.500/m² | 2 usos | $2.750/m² |
| Karikal melamina 10 mm | 3050 × 1850 | 2940 | $16.500/m² | 15 usos | $1.100/m² |

**Regla de uso (Fede, 2026-08-13):**
> **Las placas de cenefa — las de arriba — van SIEMPRE en Fibroplus.**
> Con tres acabados posibles: **pintada · con gráfica (vinilo) · doble** (dos placas espalda con
> espalda, para que sea blanca de los dos lados — **duplica el material**).
>
> El Karikal es para el general de expo y para los stands donde convenga: *"meter un stand de
> 2,50 de altura con todas placas Karikal, ponerle toda gráfica, después sacársela y recuperar
> la placa"*. Ver `docs/proyecto-placas-duras-y-cortes.md`.

**Y hay una tensión económica abierta:** Karikal sale **$2.150/m² por uso** contra **$5.250 del
Fibroplus** — 2,4 veces más barato, aunque cueste 4 veces más comprarlo. Fede lo tiene claro
(*"sí, sé que el Karikal sale más barato por uso... tendríamos que usar la mayoría Karikal,
pasa que se complica"*). Es un proyecto aparte, no un cambio de esta pasada.

> ⚠️ **El VU = 1 del Fibroplus es uno de los 9 valores que esperan la charla con Diego**
> (Decisión 2 de `costos-modelo-decidido.md`). Si en realidad aguanta 3-4 usos, toda la
> comparación de arriba se da vuelta. **No tocar hasta confirmarlo.**

### 2.5.bis Los cortes calientes de Karikal

Las medidas que se repiten en toda obra, dictadas por Fede el 2026-08-13. **Todas creadas**:

| placa | qué es |
|---|---|
| `PKH-960x2410` | panel de 2,50 — 1 módulo *(era `PLA-960-2410`, normalizada)* |
| `PKH-465x2410` | panel de 2,50 — medio módulo |
| `PKH-670x2410` | panel sobre perfil 660 |
| `PKH-960x660` | **frente de mostrador / vitrina** |
| `PKH-960x910` | frente de mostrador entero / **antepecho para vidrio** |
| `PKH-465x660` | lateral de mostrador / vitrina |
| `PKH-490x640` | **puerta corrediza** de vitrina de 1 m — van **2 por módulo** |

El `670` no sale de la grilla modular: es el perfil de **660** (la diagonal de medio módulo, que
se reusa como perfil recto) **+ 10 de encastre**. La regla `placa = perfil + 10` vale igual.

### 2.5.ter ⚠️ La regla de las guías — dato macro que no estaba en ningún lado

> **Cuando un vano lleva guías arriba y abajo, la pieza se corta 20 mm más corta**:
> 10 mm arriba y 10 mm abajo se los come la guía dentro del perfil.

Verificado contra las medidas reales: el frente de vitrina sin guías es `960 × **660**`; la
puerta corrediza del mismo vano es `490 × **640**`. **660 − 20 = 640** ✓

Y a lo ancho, las **dos** puertas de 490 suman 980 sobre un perfil visible de 950 — el
solapamiento de 30 mm que necesita una corrediza para cerrar.

**La guía es de PVC y se consume por metro: 95 cm por cada perfil de 950.**
⛔ Falta darla de alta como insumo (código, precio por metro, presentación). Sin eso las puertas
quedan con la placa costeada y la guía no.

### 2.6 Placas curvas

El sistema usa curvas, y es **la razón técnica por la que la placa blanda existe**: el Fibroplus
se dobla, el Karikal no.

| radios disponibles (mm) | 500 · 1000 · 1400 · 1500 · 1750 · **2000** |
|---|---|

> La de **2000 se usa poco: se termina abriendo** si la placa es muy pesada.

Pendiente de definir: cómo se codifica una placa curva (el desarrollo de la curva no es el ancho
plano) y si el radio va en el código o como atributo.

Nótese que **Karikal es más barato por uso que Fibroplus** ($2.150 vs $5.250 el m²), aunque
cueste 4 veces más comprarlo. Es exactamente la premisa del sistema: *"usar placas duras por
defecto: no se rompen y se reúsan; en alquiler el costo es por uso, no por compra"*.

**El color se diferencia** (decisión de Fede): no es un tema de costo — blanco y negro salen lo
mismo — sino de **previsibilidad de compra**. *"No puedo comprar rápido, tengo que tener
previsibilidad. Aparte es un factor determinante armar todo en blanco o todo en negro."*

### 2.5 Diagonales

Se cota la **diagonal visible**, no eje-eje. Valores canónicos de fabricación:

| diagonal | visible (corte) | entre ejes |
|---|---|---|
| ½ × ½ | 660 | 700 |
| 1 × 1 | 1360 | 1400 |
| 2 × 2 | **2720** | **2760** |
| 3 × 3 | 4160 | 4200 |

> ⚠️ Fede nombró "2760" y el cerebro dice "2720". **Son la misma pieza en unidades distintas**
> (2720 visible + 40 de columna = 2760 entre ejes). Al dictar medidas conviene aclarar cuál,
> porque el perfil se corta a la visible.

---

## 3 · Nomenclatura

**Un solo principio: el código dice qué es y cuánto mide, en milímetros.**

| nivel | qué es | patrón | ejemplo |
|---|---|---|---|
| **Insumo — extrusión** | el perfil como se compra (barra de 6 m) | `<FAM>-<sección>` | `DLL-052` · `CS8-040` |
| **Insumo — plancha** | la placa como se compra (m²) | `MAT-<sigla>` | `MAT-KPH` · `MAT-FP3` |
| **Pieza** | lo que se corta y se prepara | `<FAM>-<largo>` | `DLL-1940` · `COC-2500` |
| **Placa cortada** | la pieza que hoy no existe como familia | `<FAM>-<ancho>x<alto>[-acabado]` | `PKH-960x210-N` |
| **Producto** | lo que se cotiza | `<FAM>-<medida>` | `PSB-2500` · `CEN-300` |
| **Stand tipo** | el preseteo | `STD-<ancho>x<prof>-<letra>` | `STD-3x3-A` |

**Por qué el insumo y la pieza comparten las 3 letras y se distinguen por el número:** el
número del insumo es la **sección** (052, 040), el de la pieza es el **largo** (1940, 2500).
Se lee natural: *"el DLL-1940 se corta del perfil DLL-052"*. Y no choca, porque las secciones
son de 2-3 dígitos y los largos de 3-4.

### El mapeo con el catálogo oficial OCTEXA

Las familias de Costos ya matchean 1 a 1 con las extrusiones oficiales. No hay que renombrar nada:

| Costos | OCTEXA 2021 | qué es | kg/m |
|---|---|---|---|
| `COC` | CS8-040 | columna simple octogonal, 8 caras | **0,9347** |
| `CMO` | CH8-040 | columna hemi octogonal (media) | a confirmar |
| `CCO` | CE8-040 | columna esquinera puntera media caña | a confirmar |
| `CDO` | CD8-080 | columna doble octogonal | **1,96** |
| `CHE` | CS6-040 | columna hexagonal (casi no se usa) | 1,0638 |
| `DLL` | DLL-052 | dintel liso-liso — **el default** | **0,57** |
| `DLA` | DLA-052 | dintel simple aletado | 0,68 |
| `DAA` | DAA-052 | dintel doble aletado | 0,65 |
| — | PCH-058 + PCM-058 | cerrojo de punta (macho + hembra) | 2 por perfil |

**Cuándo va cada dintel** *(regla de Fede, se enseña en 10 segundos)*:
> **DLL es el default, siempre.** Los aletados son sólo cuando hay que apoyar algo horizontal:
> tapa de melamina 10 mm, vidrio 6 mm, estantes. El aletado tiene la aleta que recibe la placa.

---

## 4 · Lo que hay que corregir en los datos

Todo verificado contra prod el 2026-08-13.

### 4.0 ⚠️ ANTES DE LEER LO QUE SIGUE — `receta_componentes` tiene `_deleted`

**Toda consulta a las recetas debe filtrar `_deleted=false`.** Sin ese filtro aparecen los
componentes viejos y la receta parece decir cualquier cosa. En la primera pasada de esta sesión
se leyeron sin filtrar y salieron **tres hallazgos falsos** (peso del dintel, una alfombra dentro
del cerrojo, la mano de obra cobrada por tres vías). Los tres se cayeron al filtrar.

Verificación de que el motor está sano, hecha con dos ítems de prueba y cleanup exacto:

| prueba | RPC devolvió | esperado |
|---|---|---|
| 1 m² de placa Karikal | fab $24.725 · uso $2.967 | 21.500 × 1,15 ✓ · (24.725/10) × 1,20 ✓ |
| + 1 sub-ítem propio (cerrojo) | fab $26.649,50 · uso $3.070,72 | +1.924,50 ✓ · +103,72 ✓ |
| 1 sub-ítem **subalquilado** (alfombra) | fab $8.000 | lo suma bien ✓ |

**La RPC `calcular_receta` es confiable, incluido el BOM jerárquico y los subalquilados anidados.**
Y el cache guardado coincide exactamente con el cálculo en vivo en los 5 ítems verificados.

> 📌 **Deuda anotada: la definición de `calcular_receta` no está en el repo.** Sólo hay archivos
> que la invocan. Vive únicamente en prod. Conviene volcarla a `sql/` para que se pueda leer.

### 4.1 🟠 El peso del perfil — un número, dos fuentes que no coinciden

| fuente | kg/m | |
|---|---|---|
| **receta cargada** (`DLL-950`: 0,75 kg / 950 mm) | **0,789** | |
| **estimación de Fede** (2026-08-13) | **0,80** | *"el metro pesaría algo de 800 gramos"* — **coincide con lo cargado** |
| barra de 6 m pesada | 0,69 | 4,15 kg ÷ 6 m, anotado en el cerebro |
| catálogo OCTEXA 2021 (DLL-052) | **0,57** | el cerebro dice *"manda el catálogo"* |

O sea: **lo cargado y la intuición de Fede coinciden en ~0,79-0,80**, y el catálogo oficial dice
0,57 — un **38% menos**. Uno de los dos está mal y el dintel entra 2 veces en cada panel y 2
veces en cada cenefa.

> ⛔ **ACCIÓN, 10 minutos y una balanza: pesar una barra de 6 m de cada tipo** (DLL liso, DLA
> simple aletado, DAA doble aletado) **y una columna.** Resuelve de raíz el costo de las 39
> piezas. Es lo más barato del proyecto y lo que más plata mueve.

La columna está cargada en **1,000 kg/m** (2,5 kg / 2500 mm) contra 0,9347 del catálogo — 7% de
diferencia, y Fede la da por buena. Además el catálogo tiene **tres densidades distintas** según
el dintel (0,57 / 0,65 / 0,68) y las recetas usan una sola para todos.

### 4.2 ~~El cerrojo tiene una alfombra adentro~~ — FALSO POSITIVO

El componente `1 × ALF-003 "Alfombra nueva con nylon"` existe en la receta de `CER-PER` **pero
está `_deleted = true`**. Ya estaba borrado. La cuenta cierra exacta sin él:
`0,09 kg × $15.000 × 1,05 + 0,02 × $350 + 2 min de MO = $1.924,50` = lo que devuelve la RPC.

**Sin acción.** Queda como ejemplo de por qué vale la regla de §4.0.

### 4.3 🔴 33 de 39 piezas están en $0

| familia | con costo | total |
|---|---|---|
| columnas COC | **1** (`COC-2500`) | 17 |
| dinteles DLL | 6 | 22 |

Las que la cenefa necesita — `DLL-1940` (módulo de 2 m) y `DLL-2930` (3 m) — **están las dos en
cero**. Si se cargan cenefas antes de costear las piezas, **nacen en $0 y nada avisa**. Es el
mismo agujero ya documentado con los TV subalquilados.

### 4.4 ~~La mano de obra se cobra por tres vías~~ — FALSO POSITIVO

Los dos insumos de mano de obra que aparecían dentro de las recetas —**"Mecanizado aluminio M.O."**
($14.000/h) y **"Armado estructura M.O."** ($10.000/h)— están **`_deleted = true`** en el
`DLL-950` y en el `CER-PER`. La única vía viva es `mano_obra_minutos × hora_taller_ars`.

**Sin acción sobre las recetas.** Queda un detalle menor: los dos insumos siguen existiendo en
`insumos_base` (uno con unidad "Kg" y el nombre diciendo "(hora)"), y el tipo `MANO_OBRA` tiene
VU = 1, que es lo correcto — la mano de obra no se amortiza.

**Lo que sí sigue abierto es el otro lado:** los minutos cargados. Hoy las piezas tienen 2-3
minutos, que como ya dice `costos-modelo-decidido.md` *"no resisten una pregunta"*.

### 4.5 🟠 El dintel usa aluminio crudo y la columna pintado

- Dintel → `MAT-ALC` "Aluminio **crudo** (cerrojos)" $15.000/kg, VU 20
- Columna → `MAT-ALB` "Aluminio **pintado** (blanco perfil)" $18.000/kg, VU 30

Los dos son perfil blanco a la vista, del mismo sistema. **A confirmar cuál corresponde.**

### 4.6 ✅ Dos fórmulas de costeo conviviendo — RESUELTO el 2026-08-15

Quedó una sola. **La regla, confirmada por Fede:**

> **El `vida_util_armado_override` se usa SÓLO cuando el ensamble se destruye antes que sus
> materiales.** Si se desarma y las piezas vuelven al galpón, va sin override: cada material
> se amortiza por su cuenta, y la mano de obra del armado se cobra entera en cada uso.

De **87 ítems con override quedaron 2**. Lo que hacía en cada caso, medido:

| | qué hacía realmente el override |
|---|---|
| **perfiles** (83) | Los **acortaba**: el aluminio pintado dura 30 y el override decía 20 → −26% |
| **placa Karikal** | Mismo divisor (10). Lo único que hacía era **omitir el 20% de reacondicionamiento** — que es despegarle el vinilo → +19% |
| **cerrojo** | Casi nada: 20 ≈ la vida real de su aluminio crudo → +3% |

**Y el precio final no se movió**: el panel pasó de $25.164,21 a **$25.183,27**. Diecinueve pesos.
Los dos efectos se compensaron — el override no estaba cambiando el precio, **estaba repartiendo
mal el costo entre las piezas**. El margen de 1,25 que los paneles ya tenían era el correcto
(se probó 1,50 y daba $27.981).

**Los 2 que quedaron con override, a propósito:**
- **Tapa vidrio 6mm** (10) — Fede: *"dejala por ahora"*. Sacarlo la lleva de $2.617 a $5.752 porque el vidrio dura 5.
- **Vitrina `VMB-080`** (5) — **le corresponde ir sin override** (se desarma), pero está bloqueada: ver abajo.

### 4.6.bis ⛔ La vitrina: el override tapaba una hora de taller

`VMB-080` tiene **`mano_obra_minutos = 0`**. No tiene tiempo de armado cargado, y una vitrina
con 12 perfiles, vidrios, tapas y dos puertas corredizas evidentemente lo tiene.

```
sin override              $52.886     ← se desploma a la mitad
guardado (con override)   $93.880
```

La cuenta al revés: para llegar a $93.880 con su margen de 1,00 faltan **$20.497** de costo, que
en mano de obra más 30% de indirectos son **≈ 63 minutos**. **El override de 5 era una hora de
taller disfrazada de vida útil.**

Espera el dato real de cuánto lleva armarla (está en la hoja de campo). Aparte arrastra un **+18%
sin recalcular** ($93.880 guardado vs $110.794 del motor) porque sus 12 dinteles pasaron a
aluminio pintado el 13/8; se resuelve en la misma pasada.

### 4.7 🟡 Ruido menor de códigos

- `SLA-001` está repetido en **3 ítems distintos** (Spot orientable aplicado / con brazo / premier con brazo)
- Códigos con espacio basura: `ALF- 003`, `REL- 050`
- `MOR-051` = mostrador de 1,00 m y `MOR-101` = mostrador de 0,50 m — **invertidos**
- `DLL-130` ($4.794) cuesta **menos** que `DLL-100` ($5.386), siendo más largo
- 76 ítems sin código · `PLA-960-2410` está marcado nivel 3 siendo una pieza (nivel 2)

---

## 5 · El cambio de fondo que se propone

**Hoy** el insumo es *"aluminio por kilo"* y cada pieza declara cuántos kilos lleva, cargado a
mano, pieza por pieza. Por eso hay 33 en cero y las 6 cargadas tienen 10-30% de dispersión.

**Se propone** que el insumo sea *"el perfil por metro"*, con su kg/m del catálogo oficial.
Entonces el costo de cualquier pieza sale solo:

```
costo pieza = largo(m) × kg/m del perfil × $/kg + cerrojos + mano de obra
```

Y eso da la frase que hace el sistema enseñable — un tipo nuevo la puede verificar de cabeza:

> **"Un dintel son dos mil y pico fijos, más quince mil por metro."**

*(El fijo son los 2 cerrojos y el mecanizado, que no cambian con el largo. Por eso el dintel de
10 cm sale $53.865 el metro y el de 95 cm sale $17.275 el metro: no es un error, es el costo
fijo repartido entre menos metros.)*

Las 39 piezas se costean en una sola pasada, todas con el mismo criterio.

---

## 5.bis · La cenefa — resuelta

### Qué es

Un **módulo bajo** que sale de la columna, casi siempre **perpendicular** al panel. Misma física
que cualquier módulo: 2 perfiles horizontales + placa. Lo que la distingue es que **el perfil
horizontal va corrido**, y donde se juntan dos placas no hay columna sino un **montante de
40 mm** que la emula.

### Anatomía — aprobada por Fede el 2026-08-13

Ejemplo: **cenefa de 4 módulos (3,96 m), h = 300**

| cant | pieza | medida |
|---|---|---|
| 2 | perfil horizontal DLL | **3920** — corrido, uno arriba y uno abajo |
| 2 | placa | **1950 × 210** |
| 1 | **montante de 40** | largo 200 (el vano entre los dos horizontales) |
| 4 | cerrojo de punta | 2 por perfil horizontal — **anclan sobre la columna** |
| 2 | **cerrojo especial** | del montante: **más corto**, entra en un lugar más angosto |

**Dos piezas que hay que crear y hoy no existen en ningún lado:**
1. **El montante de 40** — extrusión propia (Fede la llama `DLL-040` por su sección de 40 mm en
   vez de 52). ⚠️ **No cargarla con ese código en Costos**, donde el número significa el largo:
   `DLL-040` se leería "dintel de 4 cm". Va como extrusión en insumos.
2. **El cerrojo especial del montante** — más corto que el `CER-PER` común.

### Tabla canónica de armado

Una sola forma por largo, la más pareja (decisión de Fede). Verificada: la suma de los tramos
más los 40 mm de cada montante da exacto el perfil total.

**Son dos tablas, porque el tope de placa depende de la altura** (confirmado por Fede): la de
h=300 se hace en Karikal y llega a 2940; el resto va en Fibroplus, cuya plancha topea en 2445.

| mód | largo | perfil | **A · altura 300** (Karikal, ≤2940) | mont. | **B · alturas 400-1300** (Fibroplus, ≤2445) | mont. |
|---|---|---|---|---|---|---|
| ½ | 0,49 m | 455 | 465 | 0 | 465 | 0 |
| 1 | 0,99 m | 950 | 960 | 0 | 960 | 0 |
| 1½ | 1,49 m | 1445 | 1455 | 0 | 1455 | 0 |
| 2 | 1,98 m | 1940 | 1950 | 0 | 1950 | 0 |
| 2½ | 2,48 m | 2435 | 2445 | 0 | 2445 | 0 |
| 3 | 2,97 m | 2930 | **2940** | **0** | 1455 + 1455 | 1 |
| 3½ | 3,46 m | 3425 | 1950 + 1455 | 1 | 1950 + 1455 | 1 |
| 4 | 3,96 m | 3920 | 1950 + 1950 | 1 | 1950 + 1950 | 1 |
| 4½ | 4,46 m | 4415 | 2445 + 1950 | 1 | 2445 + 1950 | 1 |
| 5 | 4,95 m | 4910 | 2445 + 2445 | 1 | 2445 + 2445 | 1 |
| 5½ | 5,45 m | 5405 | **2940** + 2445 | 1 | 1950 + 1950 + 1455 | 2 |
| 6 | 5,94 m | 5900 | **2940 + 2940** | **1** | **1950 + 1950 + 1950** | **2** |

*(La columna B de 6 módulos —1950×3 con dos montantes— la confirmó Fede textualmente.)*

**Más de 6 módulos** = varias cenefas consecutivas **separadas por columna**, no por montante
(el perfil no puede pasar de 5900). 8 módulos → dos de 4 · 10 → dos de 5 · 12 → dos de 6.

**Los 6 anchos de placa de todo el sistema:** `465 · 960 · 1455 · 1950 · 2445 · 2940`
— el **2940 sólo existe en Karikal y sólo en altura 210**.

### Las 16 alturas

Vanos de 50 en 50. Las cinco de la serie que no figuran (260 · 560 · 760 · 1060 · 1160)
**no se usan** — confirmado por Fede.

| altura módulo | 300 | 400 | 450 | 500 | 550 | 600 | 700 | 750 | 800 | 900 | 950 | 1000 | 1050 | 1100 | 1200 | 1300 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **placa** | 210 | 310 | 360 | 410 | 460 | 510 | 610 | 660 | 710 | 810 | 860 | 910 | 960 | 1010 | 1110 | 1210 |

La de **300 es la "general"** — la de las expos, en Karikal. Las demás son de stand.

### Precio por metro lineal

La cenefa se cotiza **por metro lineal**, como hoy. Regla fijada para el costo:
> **Manda el módulo real del stand tipo cuando existe; si no, se calcula sobre módulo de 2,00 m.**

El material por metro lineal casi no varía con la modulación (0,202 vs 0,206 m²/ml entre modular
de a 1 m y de a 3 m). Lo que sí varía fuerte son **cerrojos y mano de obra**: modulado de a 1 m
son 4 cerrojos y 6 minutos por metro; de a 3 m, 1,3 cerrojos y 2 minutos. Tres veces menos.

---

## 6 · Decisiones abiertas

| # | decisión | resolución | estado |
|---|---|---|---|
| **D1** | ¿La cenefa lleva placa continua o una por módulo? | **Continua, hasta 3 módulos (2940).** No hay columna intermedia: hay un **montante de 40 mm** que la emula. La *regla dura* del cerebro vale para el **panel**, no para la cenefa | ✅ |
| **D2** | Las 5 alturas huérfanas (260·560·760·1060·1160) | **No se usan.** Quedan las 16 | ✅ |
| **D3** | Modulaciones y tope de placa | **Hasta 3 módulos** · una sola forma canónica por largo, la más pareja · **6 anchos**: 465·960·1455·1950·2445·2940 | ✅ |
| **D6** | Acabado de la placa | **El color se diferencia** (previsibilidad de compra, no costo). **El vinilo va como propiedad de textura** de la placa — suma sus m² sin duplicar el catálogo. Idea de Fede | ✅ |
| **D9** | Material de las placas | **General / expo → Karikal siempre. Stands → Fibroplus**, salvo que convenga Karikal para ahorrar colocación | ✅ |
| **D10** | Stock de piezas | **Fuera de esta pasada.** Entra con el relevamiento físico del galpón | ✅ aplazada |
| **D4** | ¿El dintel va en aluminio crudo ($15.000) o pintado ($18.000)? *(ver 4.5)* | — | ⛔ abierta |
| **D5** | La mano de obra: ¿se unifica todo en `hora_taller_ars` y se sacan los insumos-MO de las recetas, o mecanizado y armado son tarifas legítimamente distintas? *(ver 4.4)* | — | ⛔ abierta |
| **D7** | ¿Los paneles altos (2900+) se modelan con su BOM real? La placa de 2810 no entra en la plancha de 3050 × 1220 sólo si el ancho manda; **hay que definir cómo se parte un panel alto**. Hoy ninguno tiene receta | — | ⛔ abierta |
| **D8** | Vida útil de armado: hoy sólo 2 piezas la tienen. ¿20 a todo el aluminio y 10 a las placas, como las cargadas? Enlaza con la **Decisión 2** de `costos-modelo-decidido.md` | Fede + taller | abierta |
| **D11** | ¿La tabla canónica cambia según la altura? Si el 2940 sólo se justifica en la cenefa de 300, las de 5½ y 6 módulos en otras alturas se arman con más tramos | — | abierta |
| **D12** | Peso y precio unitario del **cerrojo especial** del montante, y sección/kg-m de la **extrusión de 40** | Fede | abierta |

---

## 7 · Orden de trabajo acordado

Se acordó **cenefas primero** (2026-08-13), pero al medir los valores apareció que las piezas
que la cenefa necesita están en $0 — así que se mueve un escalón:

1. **Corregir los datos rotos** — la alfombra dentro del cerrojo, la densidad del dintel, los códigos duplicados
2. **Costear las 39 piezas por fórmula** — columnas y dinteles, todas con el mismo criterio
3. **Crear la familia de placas** — no existe; hoy hay una sola placa cargada en todo el sistema
4. **Crear las cenefas** con su receta real
5. **Los stands tipo** — `STD-3x3-A` y compañía, con sus piezas contadas
6. **El explosionador** — de "50 stands" a la lista de preparación

> Regla que se fijó para el precio por metro lineal de cenefa: **manda el módulo real del stand
> tipo cuando existe; si no, se calcula sobre módulo de 2,00 m de referencia.** (Cambia sólo
> cerrojos y mano de obra: el material por metro lineal casi no varía — 0,202 vs 0,206 m²/ml
> entre modular de a 1 m y de a 3 m.)

---

## 8 · Pendientes de más adelante

- **Corpóreos** — Fede quiere una cuenta viable para semiautomatizarlos y dejar de depender de
  Guille. Hoy `Corpóreo` es un ítem suelto de Marketing a $23.000 sin receta. El cerebro los
  lista como método de gráfica: *letras corpóreas en polyfan o MDF*.
- **Vinilo como material de placa** — ver D6. Hoy `Vinilo impreso y colocado` es un
  subalquilado suelto ($36.750) con 718 unidades cotizadas: es el 2º ítem más vendido del
  catálogo y no está atado a ninguna placa.
- **Marketing en el Cotizador** — el rubro Marketing es nuevo y el Cotizador es app aparte que
  también agrupa por rubro: **hay que avisar de ese lado cuando tenga ítems cotizables**.
- **Los P0 del cerebro OCTEXA que siguen abiertos:** despiece pieza por pieza de cada
  componente del catálogo · material y espesor de placa por componente · precios de placa por
  material, vidrio, spot LED, alfombra, tarima · peso y precio unitario del cerrojo.
- **Conteo de columnas por topología** (L / U / perímetro / isla) — es lo que falta para que el
  BOM de un stand salga 100% automático. La geometría ya está resuelta (esquina 90 = columna
  compartida única).
- **`parametrico`, `medida_mm`, `es_parametrico`, `factor`** existen en el schema y están
  muertos: los 116 componentes del sistema los tienen en `false`/`null` y ningún JS los lee.
  Decidir si se usan o se retiran.
- **`nivel` no es confiable** — 2 y 3 están puestos sin criterio (los subalquilados nuevos
  entraron como 2, `PLA-960-2410` es una pieza marcada 3). O se define qué significa, o no se
  usa para nada.

---

## 9 · Bitácora

**2026-08-13 — sesión de diseño + primera tanda aplicada.** Se levantó el estado real de prod
(259 ítems, 83 insumos, 116 componentes de receta, 68 ítems con receta). Se derivó la regla
`placa = alto − 90` de los datos y se confirmó contra 4 casos y contra el cerebro OCTEXA, que
ya tenía resueltas la modulación, las densidades oficiales y los topes. Se acordó nomenclatura
en milímetros, la tabla canónica de armado y el orden de trabajo.

**Lo aplicado en prod** (`sql/costos_octexa_placas_20260813.sql`): 3 correcciones de código
(`DLA-4455`/`DAA-4455` → 4415, `SLA-001` triplicado) + **86 placas nuevas** con receta y costo,
todas recalculadas, ninguna en $0. Catálogo 259 → 345. Cotizables intactos en 63. Ítem 89 sin
tocar. `sql-reviewer`: 0 CRITICAL / 0 HIGH; los 2 MEDIUM se aplicaron (política de márgenes al
100% como sus hermanos de Infraestructura, y rollback acotado por rango de id).

**La lección de método de la sesión:** `receta_componentes` tiene `_deleted`, y leerla sin
filtrar produjo **tres hallazgos falsos** que se cayeron al filtrar — incluido uno que acusaba
al dintel de estar sobrecosteado un 65%. Ver §4.0.
