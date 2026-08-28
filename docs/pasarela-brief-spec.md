# PASARELA DE BRIEF EN EL CRM — spec

> Decidido con Fede el **2026-08-28**. Implementa `MEPEX-COSTOS/docs/METODO-COTIZACION-MEPEX.md`,
> que es el documento maestro: **ninguna app define metodo por su cuenta**.
>
> Objetivo en una linea: **que un lead se convierta en un precio y en un PDF lindo en minutos**,
> sin salir del CRM.

## Las decisiones (2026-08-28)

| | decidido |
|---|---|
| **Donde vive** | **Paso 2 del caso**, en el CRM. El lead se crea en 5 segundos como hoy; despues aparece "completa el brief". Lo respondido queda **en el caso**. |
| **Cara** | **Interna primero** (la usa Noe con sesion). La cara cliente (link publico) queda para una 2a pasada: abre un frente de seguridad propio. |
| **Ramas** | **Las cuatro.** Comparten esqueleto; cambia como se llega a la lista de items. |
| **Precios** | **De la base, nunca hardcodeados.** Fuente unica. Se carga **solo lo que la pasarela usa** (~35-40 conceptos) para arrancar ya. |
| **Base constructiva** | **Banda por m2 + articulos por item.** La base sale de una tabla de bandas editable (calibrada con los 98 presupuestos); iluminacion, vitrinas, TV, piso y grafica van por cantidad x precio de lista. |
| **PDF** | **`GENERADOR-PROPUESTA-MEPEX`**, que ya esta deployado en el VPS (`POST /propuesta-api/render-propuesta`). La pasarela le manda el JSON. Cero diseno nuevo. |

## El esqueleto, igual para las 4 ramas

```
brief (preguntas por rama)
  -> lista de items            <- lo unico que cambia por rama
  -> precios de LISTA          <- catalogo_items.precio_alquiler (fuente unica)
  -> + canon logistico         <- METODO §3
  -> x palanca                 <- duracion 1,10 x margen 1,25 = 1,375 (editable)
  -> x ajuste por vertical     <- METODO §5.3
  -> = precio sin IVA -> IVA 21%
  -> PDF (Generador de Propuesta)
```

**Como se llega a la lista de items, por rama:**

| rama | como |
|---|---|
| **Stand** | **Base constructiva por banda de m2** + articulos elegidos por item. Semaforo contra la curva `$643.000 x m2^0,635` (±25%). |
| **Expo** | Conteo de material **por espacio**; el panel es la unidad. Receta del espacio de METODO §6.1 (1 spot y 1 cenefa por panel, 0,63 ml de arriostre, 1 toma c/3,5, 1 puerta y 1 tablero c/12). Semaforo: **$72.526 por panel instalado**. |
| **Equipamiento** | Seleccion directa del catalogo x cantidad x dias. **No necesita coeficientes historicos.** |
| **Energia** | Tableros + tomas + kW. Idem: seleccion directa. |

## Lo que hay que respetar, y esta medido

- 🟩 **El m2 de vinilo se PREGUNTA, no se estima** (estimado: p25 −42% / p75 +99%; preguntado: 92,6% dentro del ±10%).
- 🟩 El stand lleva **alfombra nueva**, no usada (la usada es de expo).
- 🟩 La palanca son **dos factores** que se multiplican: duracion **1,10** x margen **1,25**.
- ⚠️ **El modelo es un semaforo, no un cotizador.** Acierta el centro (−7% de mediana) pero solo
  el 29% cae dentro del ±10%. **La pantalla tiene que mostrar la banda, no un numero seco.**
- ⚠️ **Lista STAND ≠ Lista EXPO**: el mismo item vale distinto (alfombra **−62%** en expo) y hoy
  `catalogo_items` tiene **una sola** columna de precio. **Bloquea la rama Expo** hasta resolverlo
  (es el item 4 de "lo que falta" del METODO). Stand / Equipamiento / Energia arrancan sin esto.

## Modelo de datos (propuesta, sin DDL aplicado)

- **`crm_casos.brief JSONB`** — las respuestas. Una columna, cero tablas nuevas.
- **`crm_casos.cotizacion_estimada JSONB`** — el resultado: total, desglose, coeficientes
  aplicados y desvio contra la curva. Se guarda **el calculo, no solo el numero**, para poder
  auditar despues por que dio eso.
- **Parametros en `parametros_globales`** (ya existe): bandas por m2, palanca, verticales,
  canon logistico, receta del espacio. **Editables desde el Lobby, no en el codigo.**

## Fases

| # | que | estado |
|---|---|---|
| 0 | Esta spec | ✅ |
| 1 | Cargar los ~35-40 precios de lista que la pasarela usa | ⏳ |
| 2 | DDL: las 2 columnas JSONB + los parametros | ⏳ |
| 3 | `pasarela.js` — motor de calculo leyendo de la base (sin UI) | ⏳ |
| 4 | UI de la cara interna, rama **Stand**, dentro del caso | ⏳ |
| 5 | Enchufar el PDF al Generador de Propuesta | ⏳ |
| 6 | Ramas Equipamiento y Energia (seleccion directa) | ⏳ |
| 7 | Rama Expo (**depende** de resolver la lista dual) | ⛔ |
| 8 | Cara cliente (link publico) | ⏸ |
