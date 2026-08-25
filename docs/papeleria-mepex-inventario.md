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
| 12 | **Plano del stand** | 🗑️ **SE PUEDE SACAR.** *«Se hace por afuera, con CAD directamente, se imprime desde el CAD y ya tiene su frame armado adentro. De ésa podemos disponer.»* **Y el código lo confirma:** `plano-pdf.js` sólo lo invoca `compositor.js`, que está **parkeado** desde que el diseño pasó a 3ds Max — son 298 líneas cargándose en cada arranque para nada |

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

**De 19, se saca uno** (el plano, §4.12) y **se crean dos** (la orden de compra y la lista de reparto).
Quedan **20 documentos vivos**.

---

## 6 · Lo que sigue abierto

| | Qué falta | De quién |
|---|---|---|
| 1 | **Si el remito necesita alguna leyenda** más allá de no explicar lo obvio | Fede — *«veremos»* |
| 2 | **Cómo es la lista de reparto**: qué campos, qué agrupación, cuántas hojas | Fede + el taller |
| 3 | **Qué tan simple es «simple»** para el estado de resultados y el remito | Se define dibujándolo |
| 4 | Sacar la **factura C** del selector, o dejarla | Fede |

---

## 7 · El orden de trabajo que se desprende

```
1. Llevar la hoja del generador al Lobby        ← una sola pieza, hereda en cascada
2. Los dos niveles: completo vs mínimo          ← la regla de §1
3. Corregir el domicilio del Lobby a Pallares   ← una constante
4. La orden de compra (nueva)                   ← el hueco más grande
5. La lista de reparto (nueva)                  ← necesita al taller
6. Sacar el plano y su compositor parkeado      ← limpieza, 298 líneas
```
