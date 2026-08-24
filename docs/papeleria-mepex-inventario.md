# Papelería MEPEX — qué documentos existen, quién los recibe y qué dicen

> **Relevamiento, no propuesta.** Escrito el **2026-08-24** a pedido de Fede: *«primero yo vería bien
> todos los documentos que necesitamos… primero listemos todo eso y después ya iremos viendo bien qué
> es lo que terminamos haciendo»*.
>
> **Todas las leyendas de acá están copiadas del código, no inventadas.** Donde falta una, dice que
> falta — no hay ninguna redactada por mí. *(La versión anterior de este trabajo sí las inventaba, y
> una era directamente falsa: decía que la mercadería viaja por cuenta del cliente cuando el
> transporte lo hace MEPEX.)*

---

## 1 · ★ La hoja membretada YA EXISTE, y está bien hecha

Está en **`GENERADOR-PROPUESTA-MEPEX/app/render.py`**, el motor weasyprint de la propuesta comercial.
No hay que diseñarla: hay que **extenderla al resto**.

| Qué | Valor real |
|---|---|
| Turquesa | **`#00ABC8`** — y el código aclara: *«del SVG canónico, NO del raster»* |
| Membrete | **A sangre**: banda de 7 mm arriba y abajo, `@page A4 margin:0` |
| Contenido | Caja a 16 mm |
| Pie | Filete cyan 1,6 mm · isotipo 7 mm · condiciones 7 pt `#7b8186` · contacto 7 pt `#3f4143` a la derecha |
| Tipografías | **Inter** (400/700/italic) + **Archivo** (700/800), embebidas como data-URI |
| Bajada | `MONTAJE Y EQUIPAMIENTO PARA EXPOSICIONES` |
| Contacto | WhatsApp **11 4970 7000** · **www.mepex.com.ar** · Pallares 549 - Dpto 1, CP 1824, Lanús Oeste |

**La leyenda comercial real, tal cual:**

> Presupuesto sujeto a confirmación. Incluye armado, desarme y logística. Vigencia: 15 días.
> Forma de pago a convenir.

---

## 2 · ⚠️ Las tres apps no dicen lo mismo

Cada una armó su propia versión de la marca. Antes de unificar hay que decidir cuál gana en cada eje.

| | **Lobby** | **Cotizador** (jsPDF) | **Generador propuesta** |
|---|---|---|---|
| Turquesa | `#00A9C1` · y `[0,171,200]` en la factura | — | **`#00ABC8`** *(el canónico)* |
| Tipografía | Outfit + Space Mono | Helvetica (default de jsPDF) | **Inter + Archivo** |
| Domicilio | **Colombia 1173**, Lanús | **Pallares 549**, Lanús Oeste | **Pallares 549**, Lanús Oeste |
| Logo | PNG en 8 de 9 · vectorial sólo en la factura | PNG base64 | PNG base64 + isotipo |

**Las dos que hay que resolver sí o sí:**

1. **Son dos domicilios distintos.** Puede ser correcto —fiscal vs. comercial— pero hoy nada dice
   cuál va en qué papel. La factura usa Colombia 1173; todo lo comercial usa Pallares 549.
2. **Son tres turquesas.** `#00ABC8` es el del SVG canónico según el propio código del generador.

---

## 3 · El inventario, por quién lo recibe

### 3.1 · Al cliente — comerciales

| | Documento | Dónde vive | Leyenda que tiene HOY |
|---|---|---|---|
| 1 | **Propuesta de cotización** | Cotizador · `script.js` | *«Presupuesto en concepto de alquiler. Incluye armado, desarme y logística.»* + *«No incluye diseño del material gráfico. Vigencia: 15 días. Forma de pago a convenir.»* |
| 2 | **Propuesta comercial** (carátula + renders) | Generador · `render.py` | La de §1 |
| 3 | **Presupuesto · Detalle de provisión** | Cotizador · `gen_final.py` | La de §1 |
| 4 | **Presupuesto · Distribución** (por sector y por espacio) | Cotizador · `gen_final.py` | La de §1 |
| 5 | **Propuesta de equipamiento** (catálogo con fotos) | Lobby · `catalogo.js` | *(sin leyenda)* |
| 6 | **Lista de precios** — sale en 3 versiones: cliente / socio / interno | Lobby · `costos.js` | *«Precios expresados sin IVA»* |
| 7 | **Plan de pagos** | Lobby · `finanzas.js` | *(sin leyenda; sí imprime datos bancarios)* |

> Los 1 a 4 comparten la misma leyenda comercial y ya están alineados entre sí. Los 5, 6 y 7 salen del
> Lobby y **no tienen ninguna**.

### 3.2 · Al cliente — fiscales *(forma propia, no se toca)*

| | Documento | Dónde vive | Leyenda |
|---|---|---|---|
| 8 | **Factura A / B / C** | Lobby · `finanzas.js` | *«Comprobante autorizado por ARCA (AFIP)»* · *«Condición de venta: Contado»* · *«IVA incluido»* (en B) |
| 9 | **Nota de crédito A / B** | Lobby · `finanzas.js` | ídem |
| 10 | **Nota de débito A / B** | Lobby · `finanzas.js` | ídem |

> Layout AFIP ya resuelto: `ORIGINAL` centrado, letra y código en caja al medio, CAE + QR al pie,
> márgenes 14 mm. **Esta hoja no entra en la unificación**: su forma la fija la resolución, no la marca.

### 3.3 · Al cliente — operativos *(se firman)*

| | Documento | Dónde vive | Leyenda que tiene HOY |
|---|---|---|---|
| 11 | **Acta de entrega del stand** ✍ | Lobby · `conforme-pdf.js` | Compromiso de devolución *(en el cuerpo, no al pie)* |
| 12 | **Plano del stand** — **el único horizontal** | Lobby · `plano-pdf.js` | *(sin leyenda)* |

### 3.4 · A proveedores

| | Documento | Dónde vive | Estado |
|---|---|---|---|
| 13 | **Pedido a proveedor** (subalquiler por evento) | Lobby · `pedido-pdf.js` | Existe, **sin leyenda** |
| 14 | **Orden de compra** | Lobby · `compras.js` | 🔴 **NO EXISTE COMO DOCUMENTO.** Hoy sale por `mailto:` con texto plano: sin membrete, sin número, sin condiciones |

> ⚠️ **El 14 es el hueco más grande del relevamiento**, y es justo lo que marcaste: *«lo que más
> conviene es mandar pedido confirmado, con nuestra info y todo»*. Hoy el proveedor recibe un mail
> suelto. Falta decidir qué dice ese papel: si compromete precio, en qué plazo se entrega, cómo y
> cuándo se paga, y quién autoriza.

### 3.5 · Internos

| | Documento | Dónde vive | Estado |
|---|---|---|---|
| 15 | **Remito de carga** ✍ | Lobby · `remito-pdf.js` | Existe. ⚠️ **Su leyenda hay que escribirla de cero**: la que había puesto yo decía que la mercadería viaja por cuenta del cliente, y es al revés — **el transporte lo hace MEPEX** |
| 16 | **Estado de resultados** | Lobby · `contabilidad.js` | Existe, sin leyenda |
| 17 | **Libros IVA** (compras y ventas) | Lobby · `contabilidad.js` | Salen en PDF y en CSV para el contador |
| 18 | **Libro de retenciones y percepciones** | Lobby · `creditos-fiscales.js` | Sale en CSV para el contador |
| 19 | **Lista de reparto para el taller** | — | 🔴 **NO EXISTE.** Es el ítem G5 de `PENDIENTES.md`: *«el formato que ellos entienden: cuadritos con ítems, visual, funcional»* |

---

## 4 · Lo que hay que decidir antes de tocar nada

| | Decisión | Por qué no la puedo tomar yo |
|---|---|---|
| **1** | **Qué domicilio va en qué documento** | Son dos y ninguno está marcado como fiscal o comercial |
| **2** | **Qué dice el remito** | Lo transporta MEPEX: la leyenda tiene que decir qué pasa si algo llega roto o falta, y eso es criterio del negocio |
| **3** | **Qué dice la orden de compra** | Compromete plata con un tercero. Precio, plazo, forma de pago y quién autoriza |
| **4** | **Si la lista de precios interna dice lo mismo que la del cliente** | Sale en tres versiones y hoy las tres llevan el mismo pie |
| **5** | **Si el estado de resultados aclara que no es un comprobante** | Es el único riesgo que vi solo: con el mismo membrete que una factura, se puede confundir con un papel oficial |
| **6** | **Cuáles de los 19 valen el trabajo** | Unificar los 19 es mucho. Los comerciales ya están alineados entre sí; el Lobby es el que está suelto |

---

## 5 · Lo que este relevamiento corrige de la versión anterior

- **La hoja no había que diseñarla**: ya existe en el generador de propuestas, con sus fuentes, su
  cyan canónico y su membrete a sangre. Las dos «direcciones» que propuse (banda vs. filete) eran
  innecesarias — la banda a sangre de 7 mm ya es la decisión tomada.
- **Eran 19 documentos, no 9.** Faltaban los cuatro del Cotizador y del generador, los dos que no
  existen, y los libros del contador.
- **La agrupación correcta es por destinatario** (cliente comercial · cliente fiscal · cliente
  operativo · proveedor · interno), no por orientación de la hoja.
- **Ninguna leyenda se inventa.** Las que faltan, faltan.
