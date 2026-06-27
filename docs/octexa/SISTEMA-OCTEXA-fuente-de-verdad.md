# Sistema OCTEXA — Fuente de Verdad

> Este documento es el **cerebro / fuente única** del sistema modular OCTEXA de MEPEX: la base de datos canónica sobre la cual se construirán el futuro **diseñador de stands**, el **generador de BOM** (despiece de materiales) y el **cotizador**.
> Proyecto **en construcción**. Las fuentes consolidadas acá son: **Manual Técnico OCTEXA**, **Brochure MEPEX** y la **Nota manuscrita Fede+Ana** (única fuente de pesos hoy).

**Estado de los datos:**
- **SÓLIDO (verificado por cálculo):** geometría modular completa (grilla 990 / 495 mm, perfil visible, encastres, tabla de combinaciones de las 6 filas, descomposiciones verticales de los componentes, diagonales por Pitágoras), densidad lineal del perfil (0,6917 kg/m), peso del medio módulo, cenefa, profundidades, tipos de stand.
- **⚠️ A CONFIRMAR:** peso del "perfil de metro" (+6,5 % sobre el teórico), anomalía de la escalera de alturas (salto 3,90 → 5,00 m), cuál diagonal se cota para fabricación, pesos de columnas / placas / vidrios / herrajes / iluminación, despiece (BOM) de cada componente, precios, y **todo el subsistema Maxima/Octanorm**. Ver §9.

---

## 1. Lógica de modulación

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

---

## 2. Composición vertical y alturas

### 2.1 Estructura vertical de un módulo

`módulo vertical = perfil_inferior (50 mm) + placa + perfil_superior (50 mm)` (Manual).

**Regla de oro:** perfiles = 50 mm (5 cm); placas = múltiplos de 50 mm; encastre = +10 mm real.

Ejemplo módulo vertical de 1,00 m:
- Perfil inferior: 50 mm
- Vano visible: 900 mm → placa real (con encastre): `900 + 10 = 910 mm`
- Perfil superior: 50 mm
- Total: `50 + 900 + 50 = 1.000 mm` ✓ — dimensiones de placa: 960 × 910 mm

### 2.2 Escalera de alturas

| Altura | Salto vs. anterior | Nota |
|---|---|---|
| 2,40 m | base | Altura base (Manual) |
| 2,90 m | +0,50 | |
| 3,40 m | +0,50 | |
| 3,90 m | +0,50 | |
| **5,00 m** | **+1,10** ⚠️ | Rotulada "MÁXIMO" (Manual) |

**⚠️ ANOMALÍA (verificada):** los primeros 4 niveles siguen un paso modular de **+0,50 m**, pero el salto **3,90 → 5,00 = +1,10 m** rompe la propia regla. Si el paso fuese estricto, después de 3,90 vendrían **4,40 y 4,90**. Dos hipótesis:
- (a) Faltan los peldaños 4,40 y 4,90 en la tabla (es una muestra, no la lista completa).
- (b) 5,00 m es un **techo estructural especial** (tope de altura/pandeo), no un peldaño modular — lo que sugiere el rótulo "MÁXIMO".

Ver pregunta accionable en §9.

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

**⚠️ A confirmar (§9):** desde qué altura aplica el retiro, hasta qué altura se permite pegar pared al vecino SIN retiro (muro ciego permitido), y el límite numérico real del lineal.

---

## 6. Perfiles, pesos y material

> **Única fuente de pesos: Nota manuscrita Fede+Ana.** El Manual da geometría pero NO da pesos.

### 6.1 Densidad lineal (constante base)

`densidad = 4,150 kg ÷ 6,00 m = 0,69167 ≈ **0,6917 kg/m**` (derivada de la barra de 6 m, dato primario pesado).

### 6.2 Tabla de perfiles

| Nombre (alias nota) | Largo (mm) | Peso anotado (kg) | Peso calculado (×0,6917) | Δ | Veredicto |
|---|---|---|---|---|---|
| Barra completa | 6.000 | 4,150 (base) | — (define la densidad) | — | Dato primario |
| ½ módulo ("Perfil de 50") | 455 | 0,320 (0,317 sin redondeo) | 0,3147 | +1,68 % (vs 0,320) / +0,73 % (vs 0,317) | **Cuadra bien** |
| 1 módulo ("Perfil de Metro", "PPo") | 950 | 0,700 | 0,6571 | **+6,53 %** | ⚠️ **No cuadra** |

**⚠️ Inconsistencia del "perfil de metro":** el anotado 0,700 kg está +6,5 % por encima del teórico lineal (~0,657 kg). El medio módulo SÍ cuadra con la misma densidad → la hipótesis de "sección distinta" queda **descartada para el medio módulo**. Hipótesis más probable: **redondeo de obra al alza + posible herraje incluido en el "PPo"** (peso del módulo armado, no del perfil pelado). **Requiere pesar la pieza real en balanza** (§9).

**Nota de uso de los pesos:**
- **BOM / costeo de material:** usar el teórico lineal `largo (m) × 0,6917 kg/m × $/kg aluminio`. El herraje, si es lo que infla el 0,70, se costea como **ítem aparte** (evita doble conteo).
- **Estimación de transporte:** usar el peso anotado más alto (0,700 kg/módulo) — criterio conservador (sobrestimar). El perfil casi nunca es el límite de carga; pesan más placas y vidrios.

### 6.3 Barra de perfil

| Dato | Valor |
|---|---|
| Largo | 6,00 m |
| Peso | 4,150 kg |

### 6.4 Diagonales (Pitágoras, `D = √(a² + b²)`)

| Base | a × b (mm) | Diagonal exacta | Redondeo de obra (nota) |
|---|---|---|---|
| ½ módulo (visible) | 455 × 455 | 643,47 mm | **660 mm** |
| Módulo (perfil visible) | 950 × 950 | 1.343,50 mm | **≈1.360 mm** |
| Módulo (eje a eje) | 990 × 990 | 1.400,07 mm | **1.400 mm** |
| ½ módulo (eje a eje) | 495 × 495 | 700,04 mm | — (no rotulado) |

Los redondeos al alza son **holgura de corte sistemática (~+16,5 mm)**, no errores aritméticos. **⚠️ A confirmar (§9):** si la barra diagonal de fabricación se pide a **1.400 mm (eje-eje)** o **1.360 mm (visible)** — son largos de corte distintos.
**Aclaración:** la nota escribió "0,90" pero el cómputo usó 0,99 (= 990 mm eje a eje); "0,90" es un lapsus de escritura, el valor correcto es 0,99 (confirmado por la aritmética que da 1,40 m).

### 6.5 Columna ø40

| Dato | Valor |
|---|---|
| Diámetro | 40 mm |
| Offset por lado | 20 mm (radio) → `990 = 950 + 40` ; `495 = 455 + 40` |
| ⚠️ Peso por unidad / por m | **A CONFIRMAR** (no está en ninguna fuente; probablemente NO la misma densidad que el perfil de barra) |
| ⚠️ Largos disponibles por altura | **A CONFIRMAR** (2,40 / 2,90 / 3,40 / 3,90 / 5,00 m) |
| ⚠️ N° de canales / caras enchufables | **A CONFIRMAR** (¿4 caras? ¿8 tipo Octanorm? — define cuántos paneles enchufa cada columna) |

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
- Sistema **estructural** (carga / altura / grandes luces), distinto del OCTEXA modular de display (ø40 + perfil 50). Probable uso: alturas 3,40 m+, techos, tótems, voladizos, segundo piso.

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
3. **Pesar el "perfil de metro" real en balanza** para cerrar el +6,5 % (0,700 vs 0,657). Define si hay una o dos densidades lineales.
4. **Sección completa del perfil de 50 y de la columna ø40:** ancho × fondo del cuerpo, peso/m de la columna, y **cuántos canales/caras enchufables** tiene la columna (¿4? ¿8 tipo Octanorm?).
5. **Cuña de encastre y conector de columna:** qué piezas son, cuántas por placa/unión, peso y precio (el herraje más repetido del sistema).
6. **Precios:** por barra de perfil, por columna (cada largo), por m² de placa (cada material), por m² de vidrio, por spot LED, por dicroica, por m² de alfombra, por m² de tarima. ¿`insumos_base` o planilla?

### P1 — Reglas de diseño (para el diseñador de stands)
7. **Cierre de esquina a 90°:** ¿columna compartida o pieza de esquina? ¿Y para U, perímetro cerrado e isla, cuántas columnas comparte cada topología? *(Conteo de columnas por topología — no solo por cantidad de módulos.)*
8. **Retiros y alturas contra medianera:** ¿hasta qué altura puedo pegar pared al vecino SIN retiro (muro ciego permitido)? ¿Desde qué altura aplica el 1,00 m de retiro? ¿Límite de altura real del lineal?
9. **Alturas 3,40 / 3,90 / 5,00 m:** ¿con columna ø40 sola o requieren Maxima / refuerzo / arriostramiento? ¿A partir de qué altura cambia el sistema?
10. **Voladizo y estabilidad:** ¿cuánto puede volar una cenefa/estante/cartel sin apoyo? ¿Una pared libre de qué largo necesita pata/riostra/contrapeso?
11. **Diagonales:** ¿el largo de corte se pide a 1.400 mm (eje-eje) o 1.360 mm (visible)? Confirmar el criterio de +16 mm de holgura.
12. **Escalera de alturas:** ¿existen las alturas intermedias 4,40 y 4,90 m, o 5,00 m es un techo estructural fijo que no sigue el paso de 50 cm?

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
