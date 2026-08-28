# PASARELA — tabla de diferencias de precios

> **Para que Fede apruebe o corrija.** Modo piloto/copiloto del `SUPERPLAN` de MEPEX-COSTOS:
> yo propongo con criterio y fuente, Fede dice SI / NO / corrige.
> **Nada de esto está aplicado a la base.** Preparado el 2026-08-28 de madrugada.

Cruce de **los conceptos que usa la Pasarela v5** (extraídos del artifact, 8/8) contra
**`catalogo_items` en producción** (leído hoy).

---

## Resumen en una mirada

| | cuántos |
|---|---|
| ✅ Coinciden exacto — no se toca nada | **3** |
| ⚠️ Desfasados — el catálogo se movió | **1** |
| 🔴 Discrepancia grande — hay que decidir cuál vale | **1** |
| ❌ Faltan en el catálogo — hay que cargarlos | **10** |
| 🧩 Son "concepto comercial", no un ítem — necesitan decisión | **5** |
| ⚙️ No son ítems: van a parámetros | **6 bandas + 4 upgrades** |

---

## ✅ Los que ya coinciden (no tocar)

| concepto | pasarela | catálogo | id |
|---|---|---|---|
| Vinilo impreso y colocado (m²) | $36.750 | $36.750 | 219 |
| TV 55" 4K | $299.850 | $299.850 | 218 |
| Vitrinas y mostradores | $93.880 | $93.880 | 49 |

**Esto prueba que el camino funciona**: los tres se tomaron del catálogo el 8/8 y siguen iguales.

---

## ⚠️ Desfasado

| concepto | pasarela (8/8) | catálogo hoy | dif |
|---|---|---|---|
| Alfombra nueva con nylon (m²) | $11.200 | **$12.800** | **+14,3%** |

**Propongo**: gana el catálogo ($12.800). Es justo el caso que demuestra por qué no hay que
hardcodear: en tres semanas ya se movió.

---

## 🔴 La discrepancia que hay que resolver — corpóreas

| | pasarela | catálogo |
|---|---|---|
| Letras corpóreas | **$185.000** (medianas) · chicas $120.000 · grandes $320.000 | **$23.000** — un solo ítem, "Corpóreo" (259) |

**Son 8 veces de diferencia.** No es un error de tipeo: **están midiendo cosas distintas**.
La sospecha: el catálogo cobra **por letra** y la pasarela **por juego de letras**.

🟥 **Decisión de Fede**: ¿el catálogo es por letra o por juego? Según la respuesta:
- **por letra** → la pasarela multiplica por cantidad de letras, y los 3 tamaños son un
  multiplicador (no un precio)
- **por juego** → el catálogo está mal y hay que subirlo, y conviene abrir los 3 tamaños

---

## ❌ Faltan en el catálogo — hay que cargarlos

Estos la pasarela los cotiza y **el catálogo no los tiene** (o los tiene en $0). Propongo cargar
el precio de la pasarela, que salió de los Excel reales:

| concepto | propongo | hoy en catálogo | rubro |
|---|---|---|---|
| Vinílico símil madera (m²) | $19.500 | no existe | Pisos |
| Tarima con alfombra (m²) | $24.000 | Tarima h=10 c/rampa (63) en **$0** | Pisos |
| Tarima con vinílico (m²) | $27.500 | no existe | Pisos |
| Tarima terminación lisa (m²) | $29.500 | Tarima h=4 (61) en **$0** | Pisos |
| Cartel backlight | $320.000 | no existe | Marketing |
| Pintura especial | $145.000 | Panel pintado (101) en **$0** | Infraestructura |
| Pantalla LED 3 × 2 m | $2.800.000 | no existe | Equipamiento |
| Retransmisión en pantalla | $1.450.000 | DEMO LIVE (86) en **$0** | Más servicios |
| Azafata (por día) | $95.000 | no existe | Más servicios |
| Limpieza diaria | $48.000 | no existe | Más servicios |
| Depósito y guardado | $135.000 | no existe | Más servicios |
| Tiras LED | $85.000 | no existe | Iluminación |
| Ambientación de color (RGB) | $120.000 | no existe | Iluminación |

⚠️ **Ojo con las 4 tarimas**: en el catálogo existen 5 tarimas, **todas en $0 y no cotizables**,
y son `subalquilado` (dos proveedores, corregido el 6/8). Antes de cargar precio conviene ver si
las de la pasarela son las mismas.

---

## 🧩 Los que NO son un ítem: son un concepto comercial

**Este es el hallazgo de diseño de la noche.** La pasarela vende *paquetes*; el catálogo tiene
*piezas*. No es un error de ninguno de los dos — son dos idiomas.

| concepto de la pasarela | $ | qué hay en el catálogo |
|---|---|---|
| **Living lounge** | $380.000 | Sillón LE CORBUSIER 2 cuerpos $405.000 · 1 cuerpo $270.000 · PETRO doble $165.000 · mesa ratona BARCELONA $72.000 |
| **Barra + heladera** | $220.000 | Heladera Frigobar $225.000 · Heladera c/freezer $453.000 · Mesa alta $50.000 |
| **Electrodomésticos** | $160.000 | Cafetera $45.000 · Microondas $138.750 · Frigobar $225.000 |
| **Luz focal** | $60.000 | Reflector LED 100w $42.000 · 50w $29.400 · Spot premier $23.000 |
| **Potencia extra** | $38.000 **por kW** | Tablero monofásico $93.000 · trifásico $105.000 · Toma doble $25.000 |

🟥 **Decisión de Fede** — dos caminos, y se puede mezclar:

- **(a) Paquete como ítem**: se crea "Living lounge" en el catálogo con su precio. Simple, rápido,
  y el precio del paquete se controla en un solo lugar. Contra: el paquete no se descompone, y si
  cambia el sillón no cambia solo.
- **(b) Receta de paquete**: el concepto mapea a *N ítems del catálogo* y el precio es la suma.
  Más fiel y se actualiza solo. Contra: hay que definir qué lleva cada paquete (una vez).

**Mi recomendación: (b) para los tres de mobiliario** (living, barra, electrodomésticos), porque
ahí el catálogo ya tiene todas las piezas y el precio sale solo; y **(a) para luz focal y potencia**,
que son más un servicio que un conjunto.

---

## ⚙️ Lo que no es ítem y va a parámetros

No van a `catalogo_items`: van a `parametros_globales`, editables desde el Lobby.

**Base constructiva por banda de m²** (y su banda de control del METODO §5.2):

| banda | $/m² pasarela | $/m² esperado (control) |
|---|---|---|
| hasta 15 m² | $204.000 | $265.000 – $295.000 |
| 16 – 30 m² | $177.000 | $230.000 – $250.000 |
| 31 – 45 m² | $165.000 | $220.000 – $250.000 |
| 46 m² + | $139.000 | $180.000 – $200.000 |

> ⚠️ **Mirá esto**: la base constructiva sola está **~25-30% por debajo** de la banda de control.
> Es correcto y esperable — la base es sólo la estructura; el resto lo suman piso, gráfica,
> iluminación, equipamiento, canon y palanca hasta llegar al $/m² final. **Pero significa que
> la base NO se puede mostrar como precio**: sin lo demás, subcotiza.

**Upgrades (% sobre la base)**: exhibición vidriada **+35%** · estructura especial **+60%** ·
full branding **+20%** · modular + madera **+75%** *(este oculto al cliente)*.

**Del METODO, además**: palanca duración **1,10** × margen **1,25** = **1,375** · verticales
(Salud 1,18 · Estética 1,15 · Industrial 0,97 · Editorial 0,76) · canon logístico
($233.000 stand chico / $350.000 grande / $700.000 XL).

---

## Lo que propongo hacer, en orden

1. **Fede decide** las dos 🟥: corpóreas (por letra o por juego) y paquetes (a / b).
2. Cargo los **13 precios que faltan** con los valores de arriba (SQL con dry-run primero,
   respaldo y rollback al pie, como manda el SUPERPLAN).
3. Corrijo la **alfombra** a $12.800 en la pasarela (gana el catálogo).
4. Cargo los **parámetros** (bandas, upgrades, palanca, verticales, canon).
5. Recién ahí el motor de la pasarela lee todo de la base y **no queda un solo precio en el código**.
