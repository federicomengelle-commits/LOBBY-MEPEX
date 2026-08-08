# Punto de retomar — costos, cotizador y cierre de la auditoría

> **Escrito el 2026-08-06.** Este archivo existe para una sola cosa: que cuando termines el plan de
> fórmulas en el Cotizador y vengas a integrar, **no haya que reconstruir nada de memoria**.
>
> Todo lo de acá está verificado contra producción ese día. Si algo se contradice con otro
> documento más viejo, **manda este**.
>
> Se lee en el orden en que está. Las secciones 2 y 5 son las que más caro sale perder.

---

## 1 · Dónde quedó la auditoría del 31/07

**Cerrada.** De 69 ítems, **quedan 5 abiertos y ninguno es de código.**

| | qué falta | de quién depende |
|---|---|---|
| **T5.1** | Descongelar el ítem 89 (panel negro) | **Diego** — si el negro dura la mitad que el blanco |
| **T5.3** | Cargar los jornales (0 de 24) | **Lelean** — planilla enviada el 6/8 |
| **T5.4** | Relevar el stock físico del galpón | **el taller**, con las tablets |
| **T5.9** | Armar los 5 dispositivos | **Fede**, 2 h desde la oficina |
| **T5.14** | MFA en 6 cuentas admin/superadmin | **Fede**, 5 min por persona |

Lo cerrado el 6/8: superadmins depurados (7 → 4) y protección de contraseñas filtradas activada.
Los detalles de cada uno están en `docs/auditoria-2026-07-31/05-EJECUCION.md`.

---

## 2 · Lo que se decidió de costos, y que el Cotizador NO puede contradecir

**Fuente de verdad: `docs/costos-modelo-decidido.md`.** Resumen operativo:

### La regla de vida útil

Una sola columna, llenada según **qué es** el insumo:

| familia | qué significa el número | quién lo pone |
|---|---|---|
| Reutilizable (aluminio, placas, vidrios) | cuántos armados aguanta | el taller |
| Consumible (cinta, pintura, tornillos) | cuántos armados rinde lo comprado | quien compra |
| Equipamiento (reflectores, cables, TVs) | en cuántos alquileres se recupera | Fede |
| Subalquilado | **siempre 1** — se paga cada vez | nadie, es por definición |

### Los márgenes, por rubro y en dos bandas

| rubro | propio | subalquilado |
|---|---|---|
| Infraestructura · Equipamiento · Iluminación | **100%** | **50%** |
| Marketing | — | **50%** |
| Pisos · alfombras | — | **60%** |
| Pisos · tarimas | — | **45%** |
| Más servicios | **45%** | **45%** |

**Es markup, no margen**: 100% de markup = 50% de margen real. Convención del sistema.

### 🔴 La regla que más importa para el Cotizador

**El precio se calcula UNA sola vez, en el Lobby, y el Cotizador lo lee.**

`catalogo_items.precio_alquiler` es el resultado de la RPC `calcular_receta`, que es la fuente de
verdad del costeo. **Si el Cotizador recalcula precios por su cuenta, hay dos fuentes de verdad y
en algún momento van a divergir sin que nadie se entere.**

Eso ya pasó del lado del Lobby: había cuatro motores de costeo y la cascada usaba el equivocado.
Se unificó en la auditoría (T3.2/T3.23) y `calculo-receta.js` salió del loader. **No repetir el
error del otro lado.**

> Las fórmulas nuevas del Cotizador deberían decidir **cuánto de cada cosa entra** y **qué
> coeficientes se aplican al conjunto** — no cuánto cuesta cada cosa.

### Red de seguridad ya construida

Si un precio del catálogo envejece, ahora se ve: el módulo Costos tiene un chip
**`⚠ N desactualizados`** que compara el precio guardado contra el que daría la receta hoy
(view `v_catalogo_precio_desfasado`). **Hoy marca 1** — el ítem 89, congelado a propósito.

---

## 3 · El contrato entre las dos apps

**El Cotizador LEE** (no escribe): `catalogo_items` — sólo `es_cotizable = true`, y el precio es
`precio_alquiler` — más `clientes`, `proyectos`, `eventos`.

**El Cotizador ESCRIBE**: las columnas ALTER de `cotizaciones` y sus tablas propias
(`cotizacion_items`, `cotizacion_espacios`, `cotizacion_numerador`, `cotizacion_propuestas`).

**No toca** `pyme_*` ni nada de facturación.

**Regla de oro:** una columna nueva en tabla compartida se coordina. Y si el Cotizador necesita leer
algo nuevo del catálogo, **eso se construye primero en el Lobby** — al revés queda pidiendo una
columna que no existe.

### Los seis rubros

`Infraestructura` · `Iluminación` · `Equipamiento` · `Pisos` · `Marketing` · `Más servicios`

**`Marketing` nació el 6/8** (gráfica y cartelería; antes el vinilo no tenía rubro). Del lado del
Lobby no hizo falta tocar código porque la lista se deriva de los valores existentes. **Del lado del
Cotizador hay que verificar que el agrupamiento del presupuesto lo contemple.**

---

## 4 · Los tres huecos de diseño que quedaron abiertos

Del diagrama de dos capas. Ninguno se puede resolver sin los datos del Cotizador:

**a) ¿Los coeficientes van por ítem o sobre el stand?**
Hoy van por ítem: `cotizacion_items` ya guarda `height_multiplier_aplicado`,
`modifier_pct_aplicado` y `fee_pct_aplicado`, y son NOT NULL. **La capa 2 no está vacía: existe a
medias y vive en el Cotizador.** La altura tiene sentido por ítem; complejidad, feria y urgencia son
propiedades del proyecto y probablemente deban subir al total.

**b) ¿El precio del stand es la suma de sus ítems, o el m² manda?**
Propuesta a debatir: **el m² es lo que se cotiza y se muestra; la suma de ítems es el piso que
valida que ese m² no quede por debajo del costo.** Si el m² da menos, el sistema avisa.

**c) Iluminación y estructura no encajan en "multiplicar por ítem".**
La iluminación va por metro lineal. La estructura no escala lineal —un stand del doble de superficie
no lleva el doble de columnas—. Los dos necesitan su propia función, no un coeficiente.

---

## 5 · 🔴 Trampas conocidas que muerden en la carga masiva

Esto es lo que más caro sale perder. Todo verificado el 6/8:

- **Cuatro subalquilados están en $0**: `TV 75" 4K`, `TV 85" 4K`, `Tarima 4cm + Alfombra + Nylon`,
  `Vinilo de corte colocado`. Hoy son inofensivos porque ninguno está en una receta viva, pero **el
  día que se arme la receta del TV 75" va a dar $0 y nada lo va a avisar**.
- **21 de 80 insumos no tienen costo unitario.** Ocho son consumibles de armado y dos son los fletes
  (camión y camioneta). Los de oficina no importan.
- **Dos convenciones de porcentaje conviven**: los tipos de amortización guardan `15` = 15%; los
  parámetros globales guardan `0.30` = 30%. Cargar un desperdicio como `0.15` da **0,15%**; un margen
  como `50` daría **5000%**. Nada lo avisa.
- **`pct_margen_default` no gobierna nada**: los 226 ítems tienen `margen_propio` cargado. Tocar el
  parámetro global no cambia un solo precio.
- **`margen_propio` es decorativo en los subalquilados** — la fórmula usa `margen_subalquiler`.
  Al mirar "el margen" de un ítem hay que mirar la columna que corresponde a su tipo.
- **El panel blanco y el negro tienen la misma receta exacta.** Lo único que los diferencia en todo
  el sistema es la vida útil: 10 contra 5.
- **Ocho ítems son todo el negocio cotizado** (de 226 en el catálogo): panel blanco 2.247 unidades,
  vinilo 718, reflector 706, alfombra 500, vitrina 70, TV 59, panel negro **1**.
  El rigor no se reparte parejo.

---

## 6 · Qué hacer cuando vuelvas del Cotizador

El brief que te llevaste es `docs/brief-auditoria-cotizador.md`. Cuando vuelva contestado:

1. **Primero lo de siempre: medir.** Con las 10-15 cotizaciones reales, sacar el **m² efectivo
   cobrado** en cada una. Ese es el número mágico — no se decide, se descubre.
2. **Después la fórmula**, ajustada hasta reproducir esas quince con error aceptable. Es la única
   prueba de que sirve.
3. **Recién después**, decidir dónde vive cada coeficiente (sección 4a) y si hace falta schema nuevo.
4. **Y sólo entonces**, la carga masiva del catálogo — con las vidas útiles de Diego ya cargadas.

**El orden importa y no se puede invertir**: cargar 200 ítems sobre criterios sin validar es
fabricar 200 precios que después nadie va a poder defender.

---

## 7 · Cuatro cosas del Lobby que el Cotizador apaga hoy

Sin esto, hay funcionalidad construida que no puede encenderse:

| campo | qué pasa | qué apaga |
|---|---|---|
| `cotizaciones.estado` | DEFAULT `'borrador'` y el Cotizador no lo escribe | el pipeline kanban, el aging de "enviada" |
| `cotizaciones.vendedor_id` | NULL siempre | toda métrica por vendedor (Noe) |
| `cotizacion_items` | las 3 cotizaciones vivas no tienen líneas | leer la cotización estructurada en vez de parsear el PDF |
| `cotizacion_propuestas.cotizacion_id` | NULL en las 5 filas | ver las propuestas brandeadas desde el Lobby |

**Las cuatro son coordinación del contrato, no bugs de ninguna de las dos apps.**
