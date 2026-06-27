# Estilo del plano PDF — extraído de los planos reales MEPEX

> Análisis de los planos reales que mandó Fede (2026-06-27) para rehacer
> `plano-pdf.js` §2.3 "como la gente". Referencias: **A.Laciar v53 — Congreso AOA**
> (esquina/L) y **Cedent V83/V84 — Congreso AOA 2025** (esquina 6×3 con R495).
> Los binarios (PDF/imagen) los tiene Fede; acá queda la convención de estilo.

## Carátula / marco (común a TODAS las hojas)
- **Marco = corchetes en L** en las **4 esquinas** de la hoja, color **navy** (~`#1A2A4A`),
  trazo grueso (~1.2mm). NO hay rectángulo de borde completo, solo las 4 escuadras.
- **Logo MEPEX centrado ARRIBA** (turquesa `#00A9C1`). No arriba-izquierda como ahora.
- Bloque **abajo-izquierda**, navy, bold, sans ~13-15pt:
  ```
  CLIENTE: <nombre>
  PROYECTO: <nombre>
  ```
- **NO hay leyenda lateral** (ni "REFERENCIAS" ni "LISTA DE EQUIPAMIENTO" en panel).
  Los planos reales NO tienen tabla lateral — los rótulos van SOBRE cada pieza.
- Fondo blanco, todo line-art.

## Planta (top-down) — lo que exporta el compositor
- **Paredes / estructura**: líneas **finas navy** (~0.3–0.5mm). La modulación se lee por
  las divisiones de paneles (cada módulo = un paño).
- **Columnas = círculos chicos huecos** (○) en los **nodos** (esquinas/uniones de paño),
  navy. (Ya tengo `_columnsXY()`.)
- **Esquinas redondeadas/chaflán**: callout **`R495`** (rosa) en la esquina OCTEXA. En
  A.Laciar es chaflán recto con cota diagonal `660`/`455`; en Cedent es radio `R495`.

### Cotas (2 niveles, 2 colores)
- **Cotas de módulo = AZUL** (~`#2B6CB0`): segmentos cortos entre nodos con **ticks** en
  los extremos y el número arriba. Valores OCTEXA reales: **950** (perfil) y **455** (medio).
  Ej. fila superior Cedent: `455 · 455 · 950 · 950 · 950 · 950 · 455 · 455`.
- **Cotas overall / internas = ROSA-MAGENTA** (~`#D53F8C`): con flechas/ticks. Ej. Cedent
  `6,00m` (frente), `3,00m` (fondo), cadena interior `1445 · 1940 · 1445` y total `4910`.
  En A.Laciar overall `2435` / `1940` y chaflán `660`.

### Rótulos de piezas
- Texto **azul** SOBRE cada pieza, **rotado para seguir la orientación** de la pieza:
  las vitrinas/mostradores de los laterales van con **texto vertical** (90°), los del frente
  horizontal. Ej.: `Vitrina mostrador`, `Mostrador`, `Vitrina alta`, `Vitrn mostra`
  (abreviado cuando no entra).
- Esto reemplaza la numeración `1,2,3…` + leyenda. → en el PDF nuevo, el rótulo de cada
  pieza va dibujado encima (no en una tabla aparte). (Decidir: ¿numerar igual para piezas
  con nombre largo? Propuesta: rótulo directo; si no entra, abreviar.)

### Mobiliario
- Símbolos line-art navy/violeta: **mesa redonda + sillas** (respaldo curvo), banquetas.
  Ya tengo glyphs en `CompositorPiezas` que cumplen este rol.

## Elevaciones (no las exporta el compositor hoy — referencia futura)
- Líneas finas navy, grilla modular de paneles/estantes.
- Cotas **verticales azules**: `2400`, `2600`, `3400`, `900`, `1000` (alturas OCTEXA).
- Spots de iluminación = símbolo `ϟϟϟ` sobre los estantes.
- Rótulos puntuales: `TV 40"`, `TV 75"`, `750 x h710mm`.
- (El compositor hoy es solo planta; una vista de elevación sería otra fase.)

## Paleta resumida
| Uso | Color aprox |
|---|---|
| Marco escuadras + estructura + carátula | navy `#1A2A4A` |
| Logo | turquesa `#00A9C1` |
| Cotas de módulo (950/455) | azul `#2B6CB0` |
| Cotas overall / internas | rosa-magenta `#D53F8C` |
| Rótulos de piezas | azul `#2B6CB0` |
| Fondo | blanco |

## Cambios vs el PDF actual (`plano-pdf.js` v4)
1. Logo → **centrado arriba**; sacar "PLANO" top-right y el divisor turquesa.
2. **Sacar el panel de leyenda lateral** (70mm) y las tablas REFERENCIAS/EQUIPAMIENTO.
3. Agregar **4 escuadras navy** en las esquinas.
4. **Carátula CLIENTE/PROYECTO** abajo-izquierda (pasar `cliente` en opts; hoy no se setea →
   agregar campo en el modal o derivar del nombre).
5. Paredes naranjas → **navy finas**; columnas grises rellenas → **círculos huecos navy**.
6. **Cotas por módulo en azul** (entre nodos) + **overall en rosa** (hoy es 1 sola cota gris).
7. **Rótulos sobre cada pieza** (rotados) en vez de números + leyenda.
8. Plan centrado ocupando casi toda la hoja (sin reservar franja derecha).
