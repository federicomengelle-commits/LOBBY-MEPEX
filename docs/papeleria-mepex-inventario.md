# Papelería MEPEX — inventario y decisiones

> **Relevamiento del 2026-08-24, con las decisiones de Fede del mismo día incorporadas.**
>
> Todas las leyendas que figuran como existentes están **copiadas del código**. Las que Fede dictó
> están marcadas como tales. Donde falta una, dice que falta — no hay ninguna redactada por mí.
> *(La primera versión de este trabajo sí las inventaba, y una era falsa: decía que la mercadería
> viaja por cuenta del cliente cuando el transporte lo hace MEPEX.)*

---

## 1 · ★ La regla que ordena todo: hay DOS niveles de hoja, no uno

Salió de las respuestas de Fede, que lo dijo tres veces sobre tres documentos distintos:
*«tiene que ser simplificado»* · *«re simplificado tiene que ser, loguitos apenas»* ·
*«que no sea tan tan así y dejarlo más simple como está ahora»*.

| Nivel | Para qué documentos | Cómo es |
|---|---|---|
| **Completo** | Lo que ve un **cliente** o un **proveedor** | El membrete a sangre de §2, con toda la marca |
| **Mínimo** | Lo **interno** y lo **operativo** | Encabezado y pie muy simples. *«Loguitos apenas»* |

**Esto responde la objeción original** —*«no son todas iguales, no son las mismas leyendas»*— con un
criterio y no con una lista de excepciones: **la hoja la decide quién la recibe.**

---

## 2 · La hoja membretada ya existe

Está en **`GENERADOR-PROPUESTA-MEPEX/app/render.py`**. No hay que diseñarla: hay que **extenderla**.

| Qué | Valor real |
|---|---|
| Turquesa | **`#00ABC8`** — el código aclara: *«del SVG canónico, NO del raster»* |
| Membrete | **A sangre**: banda de 7 mm arriba y abajo, `@page A4 margin:0` |
| Contenido | Caja a 16 mm |
| Pie | Filete cyan 1,6 mm · isotipo 7 mm · condiciones 7 pt `#7b8186` · contacto 7 pt `#3f4143` derecha |
| Tipografías | **Inter** (400/700/italic) + **Archivo** (700/800), embebidas como data-URI |
| Bajada | `MONTAJE Y EQUIPAMIENTO PARA EXPOSICIONES` |
| Contacto | WhatsApp **11 4970 7000** · **www.mepex.com.ar** · Pallares 549 - Dpto 1, CP 1824, Lanús Oeste |

**La leyenda comercial real, tal cual:**

> Presupuesto sujeto a confirmación. Incluye armado, desarme y logística. Vigencia: 15 días.
> Forma de pago a convenir.

---

## 3 · Las divergencias entre las tres apps

| | **Lobby** | **Cotizador** | **Generador propuesta** |
|---|---|---|---|
| Turquesa | `#00A9C1` · `[0,171,200]` en la factura | — | **`#00ABC8`** *(el canónico)* |
| Tipografía | Outfit + Space Mono | Helvetica (default jsPDF) | **Inter + Archivo** |
| Domicilio | Colombia 1173, Lanús | Pallares 549, Lanús Oeste | Pallares 549, Lanús Oeste |
| Logo | PNG en 8 de 9 · vectorial sólo en la factura | PNG | PNG + isotipo |

> ✅ **DECIDIDO (Fede, 24/8): va el domicilio COMERCIAL — Pallares 549.**
> El Lobby es el que está fuera de línea: usa Colombia 1173 en todo, cuando ése es el fiscal.

---

## 4 · El inventario, con las decisiones

### 4.1 · Al cliente — comerciales · **hoja completa**

| | Documento | Dónde | Estado |
|---|---|---|---|
| 1 | **Propuesta de cotización** | Cotizador | ✅ OK — leyenda propia ya escrita |
| 2 | **Propuesta comercial** (carátula + renders) | Generador | ✅ OK |
| 3 | **Presupuesto · Detalle de provisión** | Cotizador | ✅ OK |
| 4 | **Presupuesto · Distribución** (por sector y por espacio) | Cotizador | ✅ OK |
| 5 | **Propuesta de equipamiento** (catálogo con fotos) | Lobby · `catalogo.js` | ✅ **Leyenda dictada: «Precios expresados sin IVA / Sujeto a disponibilidad»** |
| 6 | **Lista de precios** — cliente / socio / interna | Lobby · `costos.js` | ✅ OK. **Las tres llevan la MISMA leyenda**: *«tiene que ser la misma cosa, la onda de diferencias en los precios»* — lo que cambia son los precios, no el papel |
| 7 | **Plan de pagos** | Lobby · `finanzas.js` | ⏳ **Va con un selector de cuenta/destino**: que se elija a qué cuenta se transfiere, en vez de imprimir una fija |

### 4.2 · Al cliente — fiscales · **forma propia, no se tocan**

| | Documento | Estado |
|---|---|---|
| 8 | **Factura A / B** | ✅ OK. ⚠️ **MEPEX NO hace factura C.** Y hay una razón de fondo: es **Responsable Inscripto**, y un RI no puede emitir C — es de monotributistas y exentos. Verificado: **ARCA tampoco la emite** (`_arcaTipos` no la incluye), así que la opción está en el selector sin corresponder |
| 9 | **Nota de crédito A / B** | ✅ OK |
| 10 | **Nota de débito A / B** | ✅ OK |

### 4.3 · Al cliente — operativos · se firman

| | Documento | Estado |
|---|---|---|
| 11 | **Acta de entrega del stand** ✍ | ✅ OK — *«está linda esa, está buena»* |
| 12 | **Plano del stand** | ✅ **SE QUEDA.** *(Corregido por Fede el 24/8: yo había propuesto sacarlo y estaba mal.)* Su valor no es el stand a medida —ése se dibuja en CAD, que ya lo imprime con su frame— sino **el alquiler de mobiliario**: un planito rápido de cómo se distribuyen los muebles, que **lo hace quien vende, sin pasar por diseño**. Fede lo construyó justamente para eso: son cuadraditos y círculos configurables. Ver §6.bis, que es adónde va el trabajo |

### 4.4 · A proveedores · **hoja completa**

| | Documento | Estado |
|---|---|---|
| 13 | **Pedido a proveedor** (subalquiler por evento) | ✅ OK |
| 14 | **Orden de compra** | 🔨 **SE CREA**, *«adaptada y simplificada, que incluya la lista necesaria nomás»* y *«más simple como está ahora, pero está bueno que tenga su forma»*. **Contenido dictado: las cosas a comprar + plazo de entrega + forma de pago.** Hoy sale por `mailto:` con texto plano — sin membrete, sin número, sin condiciones |

### 4.5 · Internos · **hoja mínima**

| | Documento | Estado |
|---|---|---|
| 15 | **Remito de carga** ✍ | ⏳ Simplificado. ✅ **NO lleva leyenda de transporte:** *«no hace falta aclarar que lo transporta MEPEX porque se sabe — es un remito de MEPEX y va a transportar MEPEX»*. Falta ver si necesita alguna otra |
| 16 | **Estado de resultados** | ⏳ **Re simplificado, «loguitos apenas»**. ✅ **Sí lleva la aclaración** de que no es un comprobante |
| 17 | **Libros IVA** (compras y ventas) | ✅ OK — PDF + CSV para el contador |
| 18 | **Libro de retenciones y percepciones** | ✅ OK — CSV para el contador |
| 19 | **Lista de reparto para el taller** | 🔨 **HAY QUE LABURARLO.** *«Son las listas de todo el equipamiento de alquileres y de stands.»* Es el G5 de `PENDIENTES.md`: el formato que el taller entiende — cuadritos con ítems, visual, funcional |

---

## 5 · El veredicto de Fede sobre el conjunto

> *«Valen todas, básicamente. Y si puede llegar a sobrar alguna… no, en este momento no están
> sobrando. Parece que no está sobrando tanto.»*

**No se saca ninguno** y **se crean dos** (la orden de compra y la lista de reparto): **21 documentos
vivos**. *(La versión anterior daba de baja el plano; Fede lo corrigió — ver §4.12 y §6.bis.)*

---

## 6 · Lo que sigue abierto

| | Qué falta | De quién |
|---|---|---|
| 1 | **Si el remito necesita alguna leyenda** más allá de no explicar lo obvio | Fede — *«veremos»* |
| 2 | **Cómo es la lista de reparto**: qué campos, qué agrupación, cuántas hojas | Fede + el taller |
| 3 | **Qué tan simple es «simple»** para el estado de resultados y el remito | Se define dibujándolo |
| 4 | Sacar la **factura C** del selector, o dejarla | Fede |

---

## 6.bis · El compositor de planos: no se saca, se perfecciona

*(Pedido de Fede, 2026-08-24. Anotado también en `PENDIENTES.md`.)*

**Para qué es, en sus palabras:** *«para los alquileres de mobiliario puede rendir mucho. Si hacemos
nosotros un planito rápido de cómo se distribuyen los muebles, lo puede hacer quien venda los muebles
directamente y no jode a diseño. Es una cosa que yo implementé con ese objetivo: simplificar los
planos, porque son cuadraditos o circulitos en un lote que es todo configurable.»*

**Lo que hay que mejorarle:**

1. **Que tenga la misma onda que todos los planos que usa MEPEX** — no un dibujo aparte.
2. **El nombre del ítem adentro** de cada pieza.
3. **Las dimensiones bien puestas.**
4. **La interfaz más intuitiva**, para manejar todo desde adentro: *«tienen que poder hacerlo mono,
   básicamente»* — o sea, que lo use un vendedor sin saber dibujar.

⚠️ Esto **cambia la conclusión anterior** de que `plano-pdf.js` colgaba de algo muerto. Es cierto que
su único invocador es `compositor.js` y que el compositor está parkeado — pero está parkeado **para
stands**, que se dibujan en 3ds Max. **Para mobiliario nunca dejó de tener sentido**, y es donde va a
trabajarse.

---

## 7 · Lo que quedó CONSTRUIDO el 2026-08-24

**La pieza en cascada: `hoja-mepex.js`.** Un solo membrete para todos los PDF del
Lobby, con los dos niveles. Trae las constantes de marca (el cyan canónico, el
domicilio comercial, la bajada, el contacto), el **logo vectorial** —que existía en
`finanzas.js` y sólo usaba la factura mientras los otros ocho imprimían un PNG de
baja— y `encabezado()` / `pie()`.

| Documento | Nivel | Qué cambió |
|---|---|---|
| **Remito de carga** | mínimo | Membrete común. **Sin leyenda de transporte**, por decisión |
| **Pedido a proveedor** | completo | Membrete común. `_render` pasó a async y su `forEach` a `for` — un `forEach` no espera promesas |
| **Acta de entrega** | completo | Membrete común |
| **Estado de resultados** | mínimo | Membrete común + **la aclaración de que no es un comprobante** |
| **Catálogo** | — | La leyenda dictada: *«Precios expresados sin IVA · Sujeto a disponibilidad»* |
| **Orden de compra** | completo | 🆕 **NUEVA** — `orden-compra-pdf.js` + botón en Compras |

### ★ Un hallazgo que valía más que el membrete: los PDF pesaban 20 veces de más

`jsPDF` embebe las imágenes **sin comprimir** salvo que se le pase el 8º parámetro
de `addImage`. Medido sobre el mismo logo: **255 KB sin comprimir contra 8 KB con
`'FAST'`**, al mismo tamaño y con 15 ms de costo. Un PNG de 388×166 px por 4 canales
son 252 KB exactos — el bitmap crudo.

| | Antes | Ahora |
|---|---|---|
| Pedido a proveedor | 309 KB | **16 KB** |
| Acta de entrega | 308 KB | **15 KB** |
| Remito × 5 vehículos | 96 KB | **11 KB** |

Se corrigió también en **la factura**, que tenía el mismo problema en sus tres
imágenes (logo, QR e isotipo) y es el papel que más se manda por mail.

*(De paso: el logo se cachea por tamaño y color. El remito consolidado dibuja un
membrete por vehículo, así que sin cache el mismo logo se rasterizaba y se embebía
una vez por página.)*

---

## 8 · El orden de trabajo que sigue

```
1. ✅ La hoja del generador llevada al Lobby
2. ✅ Los dos niveles: completo vs mínimo
3. ✅ El domicilio del Lobby → Pallares
4. ✅ La orden de compra (nueva)
5. ⏳ La lista de precios y el plan de pagos al membrete común
6. ⏳ La lista de reparto (nueva)                ← necesita al taller
7. ⏳ Perfeccionar el compositor de planos       ← §6.bis, para mobiliario
```

**Lo que falta del punto 5:** la lista de precios (`costos.js`) y el plan de pagos
(`finanzas.js`) tienen portada y layout propios más elaborados que los cuatro
migrados; pasarlos al membrete común es una pasada aparte, no un reemplazo de
encabezado. La leyenda de la lista ya es la correcta y Fede la aprobó.
