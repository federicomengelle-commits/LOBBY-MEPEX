# tools/octexa — utilidades del cerebro OCTEXA

## `validate-cerebro.js` — Validador geométrico (Fase 1 #1)

Red de seguridad del cerebro. Chequea las invariantes de `docs/octexa/octexa-data.json`:

- **EE = perfil + columna** (990 = 950 + 40) en módulo, ½ módulo, combinaciones y la tabla de largos oficial.
- **placa = perfil + encastre** (960 = 950 + 10).
- **Descomposiciones verticales** de los componentes que cierran (y = al alto).
- **Diagonales** con holgura de corte (corte ≥ exacta de Pitágoras).
- **Esquema de piezas**: campos requeridos + códigos únicos.
- **Premisas** presentes y bien formadas · alturas monótonas.

```bash
node tools/octexa/validate-cerebro.js
```

Sale **0** si el cerebro es consistente, **1** si algo falla. **Correlo cada vez que toques el cerebro o agregues una pieza/subsistema** (es lo que garantiza que el diseñador nunca herede una medida rota).

## Extender el cerebro (Fase 1 #2)

El molde para agregar piezas/subsistemas vive en `octexa-data.json → _schema`:
- **Pieza** (`perfiles_catalogo.items[]`): requeridos `codigo`, `desc`, `seccion_mm`; el `codigo` debe matchear `catalogo_items.codigo` en Costos (cross-link de precio).
- **Subsistema**: cada uno declara su grilla/EE propia (octexa_8 / octexa_6 / maxima / arcos). No mezclar densidades ni grillas hasta confirmar compatibilidad.
- **Premisas** (`premisas_diseno[]`): las máximas que el diseñador obedece (motor de reglas editable).

Tras cualquier alta, correr el validador.

## `octexa-bom.js` — Motor de BOM a nivel stand (Fase 1 #3, v1)

Dado un stand (footprint en módulos + topología + altura + componentes), deriva el despiece:

- **Columnas: EXACTAS** por topología (grafo de paños) — `columnsByTopology(F, D, topo)`:
  isla `0` · península `F+1` · esquina `F+1+D` · lineal `F+1+2D`. (6×3 → 0 / 7 / 10 / 13, matchea el compositor.)
- **Perfiles / placas:** estimación de perímetro v1 (N placas + 2N perfiles por pared).
- **Componentes:** se agregan del catálogo (cada uno ya tiene receta + precio en Costos).

```bash
node tools/octexa/octexa-bom.js   # self-test, 13/13 OK
```

**Pendiente (v2):** despiece vertical fino + **precio** del estructural → cuando los ítems de perfil/columna/cerrojo estén cargados en Costos (C-0). Los componentes ya cotizan; falta el aluminio de perímetro.
