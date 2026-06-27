# Sistema OCTEXA — Fuente de Verdad

> Este documento es el **cerebro / fuente única** del sistema modular OCTEXA de MEPEX: la base de datos canónica sobre la cual se construirán el futuro **diseñador de stands**, el **generador de BOM** (despiece de materiales) y el **cotizador**.
> Proyecto **en construcción**. Las fuentes consolidadas acá son: **Manual Técnico OCTEXA**, **Brochure MEPEX** y la **Nota manuscrita Fede+Ana** (única fuente de pesos hoy).

**Estado de los datos:**
- **SÓLIDO (verificado por cálculo):** geometría modular completa (grilla 990 / 495 mm, perfil visible, encastres, tabla de combinaciones de las 6 filas, descomposiciones verticales de los componentes, diagonales por Pitágoras), densidad lineal del perfil (0,6917 kg/m), peso del medio módulo, cenefa, profundidades, tipos de stand.
- **⚠️ A CONFIRMAR:** peso del "perfil de metro" (+6,5 % sobre el teórico), anomalía de la escalera de alturas (salto 3,90 → 5,00 m), cuál diagonal se cota para fabricación, pesos de columnas / placas / vidrios / herrajes / iluminación, despiece (BOM) de cada componente, precios, y **todo el subsistema Maxima/Octanorm**. Ver §9.

---

## 1. Lógica de modulación

> **El nombre OCTEXA = OCTogonal + hEXAgonal**, por las dos geometrías de columna del sistema. Las columnas **octogonales (8 caras)** son el estándar; las **hexagonales (6 caras)** casi no se usan. Una columna octogonal enchufa hasta **8 paños a 45°** entre sí (Fede, 2026-06-27).

La grilla completa del sistema se construye desde una sola constante: **entre ejes = 990 mm** (Manual). Las columnas son de **ø40 mm** y aportan **20 mm de radio por lado** (offset).

### 1.1 Unidades base

| Unidad | Entre ejes (mm) | Perfil visible (mm) | Descomposición | Placa (mm) |
|---|---|---|---|---|
| **1 módulo** | 990 | 950 | 20 + 950 + 20 = 990 | 960 |
| **½ módulo** | 495 | 455 | 20 + 455 + 20 = 495 | 465 |

(Manual). El **½ módulo** se usa para extremos y ajustes.

### 1.2 Regla de encastre de placa

`placa = perfil_visible + 10 mm` (5 mm por lado, para encastrar en las ranuras del perfil) (Manual).

- Placa módulo entero: `950 + 10 = 960 mm` ✓
- Placa medio módulo: `455 + 10 = 465 mm` ✓
- Placa máxima entera disponible en mercado: **2.500 mm** de ancho (aplica a una pieza única de gráfica, distinto subsistema — ver §3 y §9).

### 1.3 Tabla de combinaciones (verificada)

Modelo de cálculo: `perfil_visible = (Σ vanos: 950 enteros / 455 medio) + (n_vanos − 1) × 40` (columnas internas); `entre_ejes = perfil_visible + 40`. Las 6 filas cierran exactamente (verificación geométrica).

| Módulos | Perfil visible (mm) | Entre ejes (mm) | Placa(s) (mm) |
|---|---|---|---|
| ½ | 455 | 495 | 465 |
| 1 | 950 | 990 | 960 |
| 1 ½ | 1.445 | 1.485 | 960 + 465 = 1.425 |
| 2 | 1.940 | 1.980 | 960 + 960 = 1.920 |
| 2 ½ | 2.435 | 2.475 | 960 + 960 + 465 = 2.385 |
| 3 | 2.930 | 2.970 | 960 × 3 = 2.880 |

**REGLA DURA:** cada placa es **individual por módulo**. Al combinar módulos hay **columna en el medio** → NO existe placa continua de 2 módulos. Una gráfica de 2 módulos (1.940 mm de perfil visible) son **dos placas de 960 mm separadas por la columna central**, no una sola.

### 1.4 Catálogo de largos de perfil (lista oficial OCTEXA)

**EE (entre ejes) = PERFIL (visible) + 40** siempre (la columna ø40). Largos de dintel disponibles (mm):

| PERFIL | EE | · | PERFIL | EE |
|---:|---:|:-:|---:|---:|
| 207,5 | 247,5 | · | 1.940 | 1.980 |
| 310 | 350 | · | 2.435 | 2.475 |
| 455 | 495 | · | 2.930 | 2.970 |
| 660 | 700 | · | 3.465 | 3.505 |
| 702,5 | 742,5 | · | 3.920 | 3.960 |
| 950 | 990 | · | 4.160 | 4.200 |
| 1.360 | 1.400 | · | 4.455 | 4.495 |
| 1.445 | 1.485 | · | 4.910 | 4.950 |

Incluye fracciones de módulo (¼ = 207,5 · ½ = 455 · ¾ = 702,5 · 1 = 950 · 1½ = 1.445 · 2 = 1.940 · 2½ = 2.435 · 3 = 2.930 · 4 = 3.920) **y** los largos diagonales reusados como perfil (660 · 1.360 · 4.160). Los grandes (3.920+) son **vigas/pasos de luz**: un solo dintel largo con columnas solo en las puntas.

---

## 2. Composición vertical y alturas

### 2.1 Estructura vertical de un módulo

`módulo vertical = perfil_inferior (50 mm) + placa + perfil_superior (50 mm)` (Manual).

**Regla de oro:** perfiles = 50 mm (5 cm); placas = múltiplos de 50 mm; encastre = +10 mm real.

> **Sección real del perfil (Fede, 2026-06-27): 15 × 52 mm** (15 mm de espesor × 52 mm de cara visible). Se **diseña y cota como 50** para redondear, pero la pieza mide 52. Para layout usar 50; para BOM/corte/peso, la real es 52 × 15.

Ejemplo módulo vertical de 1,00 m:
- Perfil inferior: 50 mm
- Vano visible: 900 mm → placa real (con encastre): `900 + 10 = 910 mm`
- Perfil superior: 50 mm
- Total: `50 + 900 + 50 = 1.000 mm` ✓ — dimensiones de placa: 960 × 910 mm

### 2.2 Escalera de alturas

| Altura | Nota |
|---|---|
| 2,40 m | base |
| **2,50 m** | **división medianera estándar** entre stands |
| 2,90 m | +0,50 |
| 3,40 m | +0,50 |
| 3,95 m | ≈ "4 metros" *(el Manual decía 3,90; Fede confirma 3,95)* |
| **5,00 m** | **MÁXIMO** — se alcanza **con columna OCTEXA común, sin Maxima** |

**✅ RESUELTO (Fede, 2026-06-27):** **no existen 4,40 ni 4,90** — la escalera va de 3,95 (≈4 m) **directo a 5,00 m**, que es el techo del sistema. Los 5,00 m se hacen **con la columna OCTEXA común** (no requiere Maxima ni refuerzo). El **2,50 m** es la altura típica de la **división medianera** con el vecino.

---

## 3. Cenefa y gráfica / señalética

### 3.1 Cenefa (franja de marca)

| Dato | Valor | Fuente |
|---|---|---|
| Alto de franja | 300 mm | Manual |
| Ubicación típica | de 2,10 m a 2,40 m | Manual |
| Composición | perfil (50) + placa gráfica (200 visible / 210 real) + perfil (50) = 300 | Manual |
| Placa de cenefa | 960 × 210 mm (visible 200 mm de alto) | Manual |

Verificado: `50 + 200 + 50 = 300` ✓ y `2.400 − 2.100 = 300` ✓.

### 3.2 Fórmula de medidas de gráfica

- `ancho_gráfica = ancho_placa = perfil_visible + 10 mm`
- `alto_gráfica = vano_entre_perfiles + 10 mm`
- Placa máxima de una pieza: **2.500 mm**

Ejemplo (2 módulos): entre ejes 1.980, perfil visible 1.940 → **dos placas individuales de 960 mm** separadas por columna central (no una pieza de 1.940).

### 3.3 Métodos de gráfica (Manual)

| Método | Detalle |
|---|---|
| **Vinilo sobre placa** (PRINCIPAL) | Soporte MDF/melamina; montaje sistema de cuñas; frontlight con spots LED |
| **Letras corpóreas** | Polyfan o MDF recortados |
| **Backlight** (opcional) | Gráficas translúcidas |

---

## 4. Catálogo de componentes

> Profundidad estándar = 500 mm; todos los anchos son múltiplos del módulo. Todas las descomposiciones verticales fueron verificadas por suma.
> ✅ **El despiece (BOM) de cada componente YA EXISTE como receta en el módulo Costos** (`catalogo_items` + `receta_componentes`). Lo que falta es el **peso armado** y el ensamblaje a nivel stand — ver §9 P0.1.

### 4.1 Vitrina Mostrador
| Campo | Valor |
|---|---|
| Alto | 1,00 m |
| Profundidad | 0,50 m |
| Superior | Vidrio 200 mm con estante de vidrio (placa vidrio = 210 mm) |
| Inferior | Faldón con placa 660 mm (650 visible + 10 encastre) + perfil base 50 mm |
| Zona guardado | Con estante de melamina |
| Descomposición vertical | 50 + 200 + 50 + 650 + 50 = **1.000 mm** ✓ |
| Notas | Componente más usado; contacto directo con público |

### 4.2 Vitrina Alta
| Campo | Valor |
|---|---|
| Alto | 2,40 m |
| Profundidad | 0,50 m |
| Faldón cerrado inferior | 1,00 m |
| Vidrio central | 1,10 m (con 2–3 estantes de vidrio) |
| Cenefa superior | 300 mm |
| Descomposición vertical | 1,00 + 1,10 + 0,30 = **2,40 m** ✓ |
| Plafón | Con spot dicroica embutido |
| Puertas | Con o sin |

### 4.3 Estantería
| Campo | Valor |
|---|---|
| Alto | 2,40 m |
| Profundidad | 0,50 m |
| Estantes | Abiertos sin vidrio (estándar) |
| Cantidad estantes | 5 por defecto (rango 4 a 6 según cliente) |
| Panel trasero | Blanco |
| Opción | Con vidrio |

### 4.4 Mostrador Simple
| Campo | Valor |
|---|---|
| Alto | 1,00 m |
| Profundidad | 0,50 m |
| Superior | Mesada |
| Debajo | Estante tipo gaveta abierta |
| Puertas | Generalmente con puertas para guardado |
| Cerradura | Tipo serrucho |
| Uso | Atención / punto de venta |

### 4.5 Panel Ranurado (slatwall)
| Campo | Valor |
|---|---|
| Alto | 2,40 m |
| Anchos | 0,50 / 0,70 / 1,00 m |
| Cenefa | 300 mm arriba y abajo |
| Placa ranurada alto útil | 1,80 m |
| Descomposición vertical | 300 + 1.800 + 300 = **2.400 mm** ✓ |
| Función | Colgar accesorios con ganchos |

### 4.6 Caja Punto de Cobro
| Campo | Valor |
|---|---|
| Alto | 1,00 – 1,20 m |
| Profundidad | 0,50 m |
| Base | Mostrador estándar |
| Opción alzada | 200 mm (placa hasta 1,20 m) |
| Motivo alzada | Cubrir manipulación de dinero / privacidad al cajero |

### 4.7 Tabla de profundidades disponibles

| Profundidad (mm) | Uso |
|---|---|
| 250 | Exhibición liviana |
| 350 | Exhibición media |
| **500** | **ESTÁNDAR** |
| 700 | Mostradores amplios |
| 1.000 | Mesas demo |

---

## 5. Tipos de stand y reglas de retiro

**Regla universal:** retiro mínimo **1,00 m** del vecino para cualquier elemento en altura (Manual).

| Tipo | Frentes abiertos | Lados contra vecino | Retiro en altura | Restricción / Nota |
|---|---|---|---|---|
| **Isla** | 4 | 0 | ninguno | Cenefa: "vale todo" |
| **Península** | 3 | 1 | 1,00 m del vecino | El más común en ferias medianas |
| **Esquina** | 2 | 2 | 1,00 m de cada vecino | Opción económica |
| **Lineal (centro)** | 1 | 3 | ⚠️ "muy limitado en altura" (sin número) | Muy limitado en altura |

**✅ Medianera (Fede, 2026-06-27):** la división entre stands vecinos suele ser de **2,50 m**. Para subir por encima hay que **separarse del vecino** (retiro), según el **reglamento del predio/expo** (varía por feria) — no hay un número único universal más allá del 1,00 m de criterio.

**✅ Voladizo (Fede, 2026-06-27):** lo que puede **volar sin apoyo** es poco — máximo ~50 cm, y en la práctica solo con **profundidad 25 cm + altura baja (≤50 cm)**, p. ej. una cenefa entre 2,40 y 2,90 m. Más que eso **palanquea** y no se hace.

---

## 6. Perfiles, pesos y material

> **✅ Fuente canónica de perfiles y pesos: "Lista Perfiles OCTEXA 2012 (rev. 08-ABR-2021)"** (Excel oficial, Fede 2026-06-27). Reemplaza las estimaciones de la nota. Aleación **6063**, dureza **Brinell 60**, **templado** (Aluar).

### 6.0 Catálogo oficial de extrusiones

| Código | Pieza | Sección (mm) | kg/m | Barra | Acabado |
|---|---|---|---|---|---|
| **CS8-040** | Columna Simple Octogonal (poste estándar) | 40×40 (8 caras) | **0,9347** | a medida | blanco |
| CS6-040 | Columna Simple Hexagonal | 40×40 (6 caras) | 1,0638 | 6000 | blanco |
| **CH8-040** | Columna Hemi Octogonal (**media columna**) | 40×28 | — | 6000 | blanco |
| **CE8-040** | Columna Esquinera salida Octogonal (**puntera media caña**) | 28×28 | — | 6000 | blanco |
| CE6-040 | Columna Esquinera salida Hexagonal | 28×34 | — | 6000 | blanco |
| **CD8-080** | Columna Doble Octogonal | 80×40 | 1,96 | a medida | blanco |
| DAA-052 | **Dintel** Doble Aletado | 52×45,5 | 0,65 | 6000 | blanco |
| DLA-052 | **Dintel** Simple Aletado | 52×35,5 | 0,68 | 6000 | blanco |
| **DLL-052** | **Dintel** Liso Normal (= el "perfil 15×52" de Fede) | 52×15,5 | 0,57 | 6000 | blanco |
| DLL-040 | Dintel Liso Bajo | 40×15,5 | — | 6000 | blanco |
| **PCH-058** | **Cerrojo Hembra** | 58×8 | — | 3000 | natural |
| **PCM-058** | **Cerrojo Macho** | 58×8 | — | 3000 | natural |

**Cómo se lee:** las **columnas** se cortan a la altura (a medida); los **dinteles** (= largueros/perfiles horizontales) salen de barras de 6 m cortadas a los largos de la tabla §1.4; el **cerrojo** (macho+hembra) se corta de barras de 58×8 de 3 m. El dintel **aletado** es el que encastra la placa; el **liso** es para tramos vistos.

### 6.1 Densidad lineal (constante base)

`densidad = 4,150 kg ÷ 6,00 m = 0,69167 ≈ **0,6917 kg/m**` (derivada de la barra de 6 m, dato primario pesado).

> **✅ Peso real por catálogo (OCTEXA 2021):** el peso del perfil depende del **dintel** — Liso Normal `DLL-052` **0,57** · Doble Aletado `DAA-052` **0,65** · Simple Aletado `DLA-052` **0,68 kg/m**. Para BOM usar el kg/m del dintel específico (las recetas de Costos usan aletados). Las estimaciones de campo (0,69–0,75) quedan superadas por el catálogo.

### 6.2 Tabla de perfiles

| Nombre (alias nota) | Largo (mm) | Peso anotado (kg) | Peso calculado (×0,6917) | Δ | Veredicto |
|---|---|---|---|---|---|
| Barra completa | 6.000 | 4,150 (base) | — (define la densidad) | — | Dato primario |
| ½ módulo ("Perfil de 50") | 455 | 0,320 (0,317 sin redondeo) | 0,3147 | +1,68 % (vs 0,320) / +0,73 % (vs 0,317) | **Cuadra bien** |
| 1 módulo ("Perfil de Metro", "PPo") | 950 | 0,700 | 0,6571 | **+6,53 %** | ⚠️ **No cuadra** |

**✅ RESUELTO (catálogo OCTEXA 2021):** el peso del perfil sale del **catálogo de dinteles** (§6.0): 0,57 / 0,65 / 0,68 kg/m según liso o aletado. El cerrojo se costea/pesa **aparte** (§6.6). Las estimaciones de la nota (barra 0,69 · campo 0,75) quedan superadas por el dato de fábrica.

**Nota de uso de los pesos:**
- **BOM / costeo de material:** usar el teórico lineal `largo (m) × 0,6917 kg/m × $/kg aluminio`. El herraje, si es lo que infla el 0,70, se costea como **ítem aparte** (evita doble conteo).
- **Estimación de transporte:** usar el peso anotado más alto (0,700 kg/módulo) — criterio conservador (sobrestimar). El perfil casi nunca es el límite de carga; pesan más placas y vidrios.

### 6.3 Barra de perfil

| Dato | Valor |
|---|---|
| Largo | 6,00 m |
| Peso | 4,150 kg |

### 6.4 Diagonales (sistema cerrado — valores de fábrica)

**✅ RESUELTO (Fede, 2026-06-27):** se cota la diagonal **VISIBLE** (no eje-eje). El 1.400 eje-eje queda **descartado**. Son valores canónicos, "sistema cerrado":

| Cuadrado | Diagonal de fábrica |
|---|---|
| ½ × ½ módulo (0,50 × 0,50) | **660 mm** |
| 1 × 1 módulo (1 × 1 m) | **1.360 mm** |
| 2 × 2 módulos (2 × 2 m) | **2.720 mm** |
| 3 × 3 módulos (3 × 3 m) | **4.160 mm** |

(El redondeo sobre el valor exacto de Pitágoras es holgura de corte; lo que manda para fabricar son estos 4 largos.)

### 6.5 Columna ø40 (octogonal)

| Dato | Valor |
|---|---|
| Diámetro | 40 mm |
| Offset por lado | 20 mm (radio) → `990 = 950 + 40` ; `495 = 455 + 40` |
| **Caras enchufables** | **8 (octogonal)** — el estándar. La hexagonal (6 caras) existe pero casi no se usa. *(Fede, 2026-06-27)* |
| **Conexiones por columna** | hasta **8 paños**, a **45°** entre sí → de acá sale el "girar pieza cada 45°" del diseñador |
| **Peso** | **0,9347 kg/m** *(CS8-040, catálogo oficial — el estimado de Fede ~0,9 fue casi exacto)* |
| **Material / acabado** | aluminio **6063 blanco** (pintado), corte a medida |
| ⚠️ Largos disponibles | **A CONFIRMAR** (¿stock por altura 2,40/2,90/3,40/3,90/5,00 o corte a medida?) |
| ⚠️ Espesor de pared | **A CONFIRMAR** (exacto) |

### 6.5.1 Variantes de columna

Además de la octogonal estándar, el sistema tiene punteras/columnas especiales según la terminación *(Fede, 2026-06-27)*:

| Variante | Sección | Uso |
|---|---|---|
| **Octogonal ø40** (`CS8-040`) | 40×40, 8 caras · 0,9347 kg/m | estándar; enchufa hasta 8 paños a 45° |
| **Puntera media caña** (`CE8-040`) | 28 × 28 mm | **esquina a 90°** con punta **redondeada** (radio desde el centro) |
| **Media columna** (`CH8-040`) | 40 × 28 mm | **lado exterior liso**; mostradores consecutivos con frentes interconectados y **perfiles rectos** (sin "loma") |
| **Columna doble** (`CD8-080`) | 80 × 40 mm · 1,96 kg/m | para **doble pared** (muro doble) |
| Hexagonal (`CS6-040`) | 40×40, 6 caras · 1,0638 kg/m | existe pero casi no se usa |

**Esquina a 90°:** el pivot es **una columna compartida** en la punta; la terminación se resuelve con puntera media caña (redondeada) o media columna (frente liso).

### 6.6 Conector de punta (cerrojo macho-hembra)

El herraje que ancla cada perfil a la columna. **El más repetido del sistema** → ítem de BOM por sí mismo.

| Dato | Valor |
|---|---|
| Códigos | **PCH-058** (hembra) + **PCM-058** (macho) — extrusión 58×8, barra 3 m, acabado natural |
| Composición | **2 piezas (macho + hembra) + 1 tornillo Allen** ("gusano") |
| Mecanismo | el tornillo se rosca y **expande** la punta del perfil; ésta se abre y queda **anclada en la ranura** de la columna octogonal |
| Cantidad | **1 cerrojo por punta de perfil → 2 por perfil** |
| ¿Entra en el peso del perfil? | **No** — se pesa/costea aparte (por eso el perfil "pelado" da ~0,75 kg/m) |
| ⚠️ A confirmar | **peso y precio** del cerrojo (por unidad), para cerrar el costeo del herraje |

*(Fuente: Fede, 2026-06-27.)*

### 6.7 Arcos curvos (largueros Z460)

OCTEXA tiene **largueros curvos** — cuartos de círculo (código larguero **Z460**) para hacer arcos:

| Ø (mm) | Nota |
|---|---|
| 990 | el más chico |
| 1.400 | |
| 1.980 | |
| 2.800 | el más grande |

*(Hay precios de referencia en pesos mexicanos por tramo de ¼ de círculo — no usables para AR, pero confirman que el sistema es curvable. "Tensochapa montada" como terminación. **A confirmar:** si MEPEX los stockea y su precio local.)*

---

## 7. Pisos y terminaciones

| Terminación | Detalle |
|---|---|
| **Alfombra de nylon** | Varios colores. La más común y económica; directo sobre el piso del predio |
| **Tarima 40 mm** | Elevación 4 cm; terminación alfombra encima o remate de placa blanca |
| **Tarima 80 mm** | Elevación 8 cm; mayor presencia; mismas terminaciones |

**⚠️ A confirmar (§9):** estructura interna de la tarima (bastidor + tablero), módulo de armado, peso/m², capacidad de carga, rampa de accesibilidad, ancho de rollo y rendimiento (m²/rollo) de alfombra.

---

## 8. Subsistema Maxima / Octanorm (PLACEHOLDER)

> **Estado: PENDIENTE DE DATOS.** Declarado por Fede, sin medidas. **No calculable** hasta levantar specs.

**Lo que se sabe (Nota):**
- Perfiles **cuadrados grandes**: rango **8×8 cm a 12×12 cm** (80×80 a 120×120 mm).
- **Doble anclaje en cada punta.**
- Sistema **estructural** (carga / grandes luces), distinto del OCTEXA modular de display (ø40 + perfil 50). **Aclaración (Fede, 2026-06-27):** la altura simple **NO** lo necesita — hasta **5,00 m** se hace con columna OCTEXA común. Maxima queda para **segundo piso, grandes luces de techo y cargas estructurales pesadas** (uso real a confirmar).

**Lo que falta levantar (no asumir; no mezclar densidades ni grillas con OCTEXA hasta confirmar compatibilidad):**

| Dato faltante | Para qué |
|---|---|
| Secciones reales disponibles (80×80, 90×90, 100×100, 120×120 — ¿cuáles existen?) | Catálogo base |
| Peso lineal (kg/m) por sección | BOM + carga de camión |
| Espesor de pared del perfil | Peso real + rigidez |
| Largos estándar de barra | Cortes y stock |
| Geometría de canal/ranura (caras, perfil de boca) | Encastre y compatibilidad |
| Tipo de conector/anclaje "doble" (cubo, escuadra, placa, pasador) | Pieza de BOM por unión |
| Módulo / grilla propia (¿990 como OCTEXA o distinta?) | Diseño |
| Compatibilidad con modular ø40 | Diseño híbrido |
| Tabla de luces/alturas máximas por sección | Reglas estructurales |
| Bases/patas y anclaje a piso | Estabilidad |
| Precio por barra y por kg, por sección | Costeo |
| Acabado / aleación | Precio / peso |
| Capacidad de carga (techo, segundo nivel) | Seguridad / diseño |

**Recomendación de modelado:** crearlo como subsistema paralelo (`sistema = 'maxima'`) con los mismos campos que OCTEXA, marcado `datos_pendientes = true`, para que el cotizador/BOM lo conozcan pero lo bloqueen hasta cargar specs.

---

## 9. ⚠️ A CONFIRMAR — Preguntas accionables para Fede

> Priorizadas. **P0 = bloqueante** (sin esto no hay BOM ni costeo). **P1 = reglas de diseño.** **P2 = completar catálogo.** **P3 = defaults/aclaraciones.**

### P0 — Bloqueantes (BOM y costeo)
1. **Despiece pieza por pieza de cada componente → YA EXISTE en el módulo Costos.** ✅ La **receta** de cada `catalogo_items` (vía `receta_componentes`) ES el BOM del componente. Ej. real `Vitrina mostrador VMB-080`: 6× Dintel aletado 950 + 6× Dintel liso aletado 455 + 2× Tapa melamina + 1× Tapa vidrio 6mm + 2× Vidrio 465×210 + 1× Vidrio 960×210 + 2× Puerta corrediza vidrio + 2× Puerta corrediza + 0,5× Cerradura serrucho → Costo MP $18.498 / Precio $93.880. **Lo que SÍ falta no es el despiece del componente sino el ensamblaje a nivel STAND:** dado un stand diseñado (N módulos × tipo × altura), qué `catalogo_items` + qué **perfiles/columnas de perímetro** lo arman (conteo de columnas por topología — ver P1.7). Ese es el puente diseño→BOM que falta construir, NO el despiece por pieza.
2. **Material y espesor de placa por componente** (pared, faldón, cenefa gráfica, panel trasero, mesada). Vincular a los tipos del módulo Costos (FibroPlus 3/5, Karikal 3/10, etc.).
3. ✅ **(Resuelto, catálogo OCTEXA 2021)** Pesos por dintel: 0,57 / 0,65 / 0,68 kg/m (§6.0). El 0,700 era solo perfil; el cerrojo va aparte. Cerrado.
4. ✅ **(Resuelto, catálogo OCTEXA 2021)** Perfil = dintel **52×15,5** (liso) / aletados 52×45,5 y 52×35,5; columna **CS8-040 octogonal 40×40, 0,9347 kg/m, alum. 6063 blanco**. Sólo falta el espesor de pared exacto (menor).
5. ✅ **(Resuelto, catálogo OCTEXA 2021)** Conector = **PCH-058 + PCM-058** (58×8, 3 m, natural) + tornillo Allen, 2 por perfil (§6.6). Sólo falta el **precio** del cerrojo.
6. **Precios:** por barra de perfil, por columna (cada largo), por m² de placa (cada material), por m² de vidrio, por spot LED, por dicroica, por m² de alfombra, por m² de tarima. ¿`insumos_base` o planilla?

### P1 — Reglas de diseño (para el diseñador de stands)
7. ✅ **(Resuelto, Fede 2026-06-27)** Esquina 90° = **columna compartida única** + variantes (puntera media caña 28×28, media columna 40×28, columna doble — ver §6.5.1). **Falta solo** el *conteo de columnas por topología* (L/U/perímetro/isla) para automatizar el BOM.
8. ✅ **(Resuelto, Fede 2026-06-27)** Medianera estándar **2,50 m**; subir más exige **retiro según reglamento** de la expo (varía por feria).
9. ✅ **(Resuelto, Fede 2026-06-27)** Hasta **5,00 m con columna OCTEXA común** — NO requiere Maxima.
10. ✅ **(Resuelto, Fede 2026-06-27)** Voladizo máx **~50 cm**; práctica: prof 25 cm + altura ≤50 cm; más palanquea.
11. ✅ **(Resuelto, Fede 2026-06-27)** Diagonal de fábrica = **visible**: 660 / 1.360 / 2.720 / 4.160 mm. Descartado el 1.400.
12. ✅ **(Resuelto, Fede 2026-06-27)** **No existen** 4,40 / 4,90 — va de 3,95 (≈4 m) directo a **5,00 m** (techo).

### P2 — Completar catálogo
13. **Iluminación:** modelo/potencia/precio del spot LED frontlight y de la dicroica embutida + regla de cuántos spots por metro de cenefa / por m² + consumo total estimado por tipo de stand.
14. **Vidrios:** espesor y tipo (templado/float) de estante y cerramiento; dimensiones estándar de estante por componente; peso/m².
15. **Puertas/cerraduras:** dimensión de puerta estándar, hoja (material/espesor), modelo de la cerradura "tipo serrucho" y sus herrajes.
16. **Techo/plafón:** ¿existe sistema de techo modular OCTEXA? ¿Cómo se arma (plafón apoyado/suspendido, parrilla)? Specs y peso.
17. **Tarima:** estructura interna (bastidor + tablero), módulo de armado, peso/m², capacidad de carga, ¿rampa?
18. **Pesos armados** de cada componente (para carga de camión: Cargo 8.000 kg + Transit 2.400 kg = 10.400 kg).
19. **Maxima:** levantar la tabla del §8 (secciones, kg/m, largos, conector, grilla, compatibilidad con ø40, luces máximas).

### P3 — Defaults, terminaciones y aclaraciones
20. **Defaults declarados:** color de placa (¿blanco melamínico?), color de alfombra default, terminación de perfil (anodizado natural/color), cantidad de estantes default (estantería = 5).
21. **"Ø50 mm" del croquis de la nota:** ¿es un perfil redondo de 50 mm o el "perfil-50" (medio módulo) del manual? Ambiguo en la nota de Ana.
22. **Placa máxima 2.500 mm:** confirmar que ninguna pieza individual del sistema supere los 2.500 (las individuales son ≤960; el 2.500 aplica a gráfica de una sola pieza).
23. **Alfombra:** ancho de rollo, rendimiento (m²/rollo), colores reales disponibles.

---

## 10. Glosario

| Término | Definición |
|---|---|
| **Entre ejes** | Distancia de centro a centro de dos columnas consecutivas. Base de la grilla: 990 mm (módulo) / 495 mm (medio módulo). |
| **Perfil visible** | Largo del perfil horizontal que queda a la vista entre dos columnas: 950 mm (módulo) / 455 mm (medio módulo). `entre_ejes = perfil_visible + 40` (columna ø40). |
| **Módulo** | Unidad base del sistema: 990 mm entre ejes, 950 mm de perfil visible, placa de 960 mm. |
| **Medio módulo** | Mitad de la unidad base: 495 mm entre ejes, 455 mm de perfil visible, placa de 465 mm. Para extremos y ajustes. |
| **Encastre** | Sobremedida de la placa (+10 mm = 5 mm por lado) para que entre y se trabe en las ranuras del perfil. |
| **Cenefa** | Franja superior de marca, alto 300 mm, ubicación típica 2,10–2,40 m. Composición: perfil 50 + placa gráfica 200 (210 real) + perfil 50. |
| **Placa** | Panel que cierra el vano del módulo (pared, faldón, gráfica). Individual por módulo; máx. 960 mm de ancho por pieza. |
| **Faldón** | Placa cerrada inferior de un componente (ej. vitrina mostrador: faldón de 650 visible + 10 encastre = 660 mm). |
| **Vano** | Hueco visible entre perfiles donde va la placa (ej. módulo de 1,00 m: vano vertical de 900 mm). |
| **Columna ø40** | Pilar vertical de 40 mm de diámetro que une los perfiles y aporta 20 mm de offset por lado. |
| **Perfil de metro** | Perfil de 1 módulo (950 mm visible); alias "PPo" en la nota; peso anotado 0,700 kg (a verificar). |
| **Diagonal** | Riostra en ángulo; largo = √(a² + b²) más holgura de corte (~+16 mm). |
| **PPo** | "Peso propio" — anotación de la nota Fede+Ana para el peso del perfil/módulo armado. |
| **BOM** | *Bill of Materials* — despiece de todos los materiales y cantidades de un componente o stand. |
| **Maxima / Octanorm** | Subsistema estructural de perfiles cuadrados (8×8 a 12×12 cm), doble anclaje. Pendiente de datos. |
