# HANDOFF · lo que cambió en la base desde la charla del Cotizador

> **Para LOBBY.** Sesión larga del 2026-08-15 abierta en `COTIZADOR MEPEX V3 avanzada CLEAN`,
> trabajando sobre `catalogo_items`, `insumos_base`, `receta_componentes` y
> `costos_tipo_amortizacion` — todas tablas que LOBBY comparte.
>
> **Esto no es un resumen de la charla: es la lista de lo que quedó distinto en producción.**
> Si estás trabajando con estas tablas, leé la sección 1 antes de nada.
>
> ⚠️ **Nota de fechas**: los archivos SQL generados quedaron nombrados `2026-08-08_*` por arrastre
> del SUPERPLAN. **El trabajo es del 2026-08-15.** Los nombres están mal, el contenido no.

---

## 1 · 🟥 Lo que te puede romper si no lo sabés

### `codigo` ahora tiene CHECK — se acabaron los espacios

```sql
-- en catalogo_items Y en insumos_base
CHECK (codigo IS NULL OR codigo ~ '^[A-Za-z0-9-]+$')
```

Letras, números y **guion medio**. Ni espacios, ni guion bajo, ni acentos. **Cualquier INSERT o
UPDATE que mande un código con espacio ahora falla.** Si Costos arma códigos en algún lado,
verificá que respeten el patrón (o que manden NULL, que sí se acepta).

Se normalizaron **79 códigos** que tenían un espacio suelto al lado del guion:
`ALF- 002` → `ALF-002` · `MES - 070` → `MES-070` · `TAR -004` → `TAR-004`.

De paso: los TV de 75" y 85" tenían los tres el código del de 65" (`TVL-065`). Quedaron
`TVL-075` y `TVL-085`.

### `catalogo_items.notas` ahora EXISTE

Se corrió el `ALTER TABLE ... ADD COLUMN notas text` que estaba pendiente en
`sql/costos_catalogo_notas.sql`. El bloque Notas de la ficha de receta ya guarda de verdad
(antes toasteaba "Notas guardadas" sin persistir nada, porque la columna no existía y el mapeo
faltaba en `api.js`).

### El catálogo pasó de 9 a 63 ítems cotizables

🟥 **Si tenés documentado "~9 cotizables", está viejo.** Hoy:

| | antes | ahora |
|---|---|---|
| ítems totales | 226 | **258** |
| `es_cotizable = true` | 9 | **63** |
| con `precio_alquiler > 0` | 27 | **81** |
| con `costo_fabricacion > 0` | 27 | **67** |
| con receta cargada | 25 | **66** |

---

## 2 · Cambios en las naturalezas (`costos_tipo_amortizacion`)

Estos mueven el costo de todo lo que los use. Decisiones del dueño:

| código | antes | ahora | por qué |
|---|---|---|---|
| `ALUMINIO_BARRA` | vida 30 | **vida 25** | *"le pondría 25 usos, reformularía por ahí"* |
| `PLACA_FIBROPLUS_3` | vida 2 · reacond 30% | **vida 1 · reacond 0%** | se destruye: se le pega gráfica y al despegarla se arruina la cara, pierde adherencia, no se puede repintar |
| `PLACA_FIBROPLUS_5` | vida 4 | **vida 2** | aguanta una reutilización |
| `PLACA_KARIKAL_3` | vida 10 | vida 10 (sin cambio) | *"debería durar diez veces tranquilamente"* |

🟩 **La distinción Karikal / Fibroplus, en palabras del dueño**: la **Karikal (Kariplac H)**
forra el panel y se recupera 10 veces. El **Fibroplus** es el que se destruye. Coincide con lo
que ya se había concluido en la charla *"Placas: características y presupuestos"*: **el Karikal
sale más barato por uso que el Fibroplus**, al revés de lo que parece por el precio de compra.

---

## 3 · El panel de 2,50 quedó cerrado

Era el ítem con más problemas de la base. Tres correcciones:

1. **Va con Karikal, no con Fibroplus.** (Hubo un cambio a Fibroplus a mitad de sesión por un
   malentendido; se revirtió. El ítem `Placa Fibroplus 3mm 960 x h=2410mm` que se había creado
   quedó con `_deleted = true`.)
2. **Se le quitó `vida_util_armado_override`** a los dos (blanco tenía 10, negro tenía 5).
   Criterio del dueño: *"el panel no tendría que tener aguante de usos; cada material lo tiene.
   El panel tiene M.O. para el armado"*.
3. **Los dos al mismo margen (1,25).** Antes blanco 1,00 y negro 1,25, mismo mueble.

```
Columna octogonal 2500      $ 2.411,25
2 × Dintel liso liso 950    $ 1.663,66
Placa Karikal 960           $ 5.898,70
Mano de obra 3 min          $   750,00
Indirectos                  $   225,00
                            ───────────
costo por uso               $10.948,60      precio $24.634,35
```

**Contra la moda real de $25.000 en 98 presupuestos: 1,5% de diferencia.**

🟥 **Pendiente**: el criterio del punto 2 alcanza a **10 ítems**, no a 2. Los dinteles 950,
la columna octogonal, el cerrojo, la Placa Karikal, la Tapa vidrio 6mm y la **Vitrina mostrador**
también tienen `vida_util_armado_override` cargado. **No se tocaron** porque sacárselo cascadea
hacia arriba y la Vitrina hoy calza exacto con su lista ($93.880,30) justamente por el override.

---

## 4 · Altas y cargas

- **29 ítems nuevos de subalquiler.** `insumos_base` tenía 38 insumos de clasificación
  "Sub alquiler" con el costo real del proveedor cargado, y **34 no se usaban en ninguna receta**.
  Se les creó su ítem de catálogo con receta 1:1 y precio = costo × 1,50 (el margen que ya usaban
  el TV 55", el vinilo y las alfombras). Sillones LE CORBUSIER y PETRO, sillas ATHINA/BERNO/
  EAMES/VENUS, taburetes NÁPOLES y TULIP, mesas, TVs 42/50/65", heladeras, freezer, microondas,
  cafetera, matafuegos, unifilas, arreglo floral.
  - 🟥 **Los TV quedaron a ×1,50 y eso los deja caros**: el de 50" da $306.000 y en los Excel se
    cobra $260–270.000. Sin resolver.
- **3 altas reales**: Silla Jacobsen ($45.000, subalquilada), Corpóreo ($23.000, Marketing),
  Dintel de arriostre por ML ($4.250, expo).
- **Insumo nuevo**: `Reflector LED 100w`, $20.000 ARS, ELECTRICO, `vida_util_override = 1`
  (espejo del de 50w, que también se cobra entero).
- **9 dinteles** que no tenían receta recibieron la suya, propagando el mismo peso de aluminio a
  las 3 variantes de aleta del mismo largo. Los pesos que ya estaban **no se tocaron**: son los
  que cargó Ana y el dueño los confirmó como correctos.
- **Unidades corregidas en `insumos_base`**: 4 cables → `metro`, pintura albalatex → `litro`,
  Fibroplus 3mm y 5,5mm → `m²`. Y las 12 cenefas/cenefones de `catalogo_items` → `ml`.

### Alias resueltos (evitaron duplicados)

De 17 ítems que "faltaban dar de alta", **9 ya existían con otro nombre**:

| en los Excel | es en el catálogo |
|---|---|
| Cuarzo 10w | Spot LED premier (id 57) |
| Cuarzo 50w / 100w | Reflector LED 50w / 100w (56 / 6) |
| Banqueta | Taburete JB (5) |
| Cartel aéreo 3,40 | Cenefa 3,40m − h=1,00m (54) — **$34.000/ml + IVA** |
| Módulo librero (stock) | Librero con guardado 1,00 × 0,50 (29) — $75.000 |
| Tablero termomag. monofásico | Tablero seccional monofásico (52) |
| Panel opaco 0,99 EE h2,50 | el mismo panel 88/89 a **precio de lista EXPO** → va en `listas_precio` |

---

## 5 · El motor de costos, documentado

`calcular_receta` tiene **tres caminos**, no una fórmula:

| camino | cuándo | costo por uso |
|---|---|---|
| **A · subalquilado** | `tipo_receta='subalquilado'` | el costo del proveedor, entero |
| **B · F.11** | el ítem tiene `vida_util_armado_override` | `costo_fabricacion ÷ esa vida` — **ignora la vida de cada pieza** |
| **C · por componente** | el resto | cada pieza ÷ su vida × (1 + reacond) |

Hallazgos al leer la función:

- El **reacondicionamiento se aplica sobre el costo POR USO**, no sobre el valor de la pieza:
  `(costo / vida) × (1 + reacond)`.
- Los **indirectos (30%) van solo sobre la mano de obra**, no sobre los materiales.
- La mano de obra sale de `parametros_globales.hora_taller_ars`, que hoy vale **$15.000**
  (igual que la de montajista).
- `costo_fabricacion` reproducido al peso en 3 ítems de control.

**Estado**: los 66 ítems con receta tienen su `costo_por_uso` coincidiendo con el motor, 66/66.
En 6 de 8 ítems auditados, el precio del motor da **exacto** el de la lista.

---

## 6 · Código de LOBBY que se tocó

**Feature nueva: "Duplicar ítem"** en el módulo Costos. Ya está en `main`, commit **`8cd4a01`**
(la feature venía de `1ac32f7`).

- Botón en la fila del listado de recetas y otro dentro de la ficha, al lado de Recalcular.
- Copia el ítem **con su receta completa** (multinivel), autonumera nombre (`Vitrina` →
  `Vitrina 1`) y código (`VMB-080` → `VMB-081`, respetando ancho de dígitos), arranca en
  `es_cotizable = false`, y dispara el recálculo.
- **Las fotos se copian de verdad en Storage** (`storage.from('catalogo').copy()`), no se
  comparte el objeto. Si la copia falla, no inserta la fila.
- Archivos: `api.js` (+176), `costos.js` (+97), `style.css` (+54), cache-bust en `app.js` e
  `index.html`.
- Probado end-to-end contra producción (duplicó la Vitrina con sus 9 componentes, verificó el
  objeto en el bucket, probó el CHECK con 3 códigos inválidos) y **la base quedó limpia**.
- 🟥 **Lo único sin probar es la UI en el navegador** (requiere login). Probar con un ítem
  cualquiera antes de usarlo en serio.
- Bug encontrado de paso y **no arreglado**: el tooltip del badge "param" en la ficha de receta
  muestra `cantidad fija=NaN`, porque el mapper de `getRecetaComponentes` hace `parseFloat` sobre
  `cantidad_fija`, que es **boolean** en prod. Cosmético.

---

## 7 · Lo que quedó abierto

| # | qué | quién decide |
|---|---|---|
| 1 | Los otros **8 ítems con `vida_util_armado_override`** (incluida la Vitrina): ¿se los sacamos como al panel? | Fede |
| 2 | **Precios de placa desactualizados**: Karikal $21.500/m² (implica $80.002 la placa; Fede dice ~$85.000+IVA) y Fibroplus $5.250/m² (implica $24.980; Fede dice ~$28.000) | Fede |
| 3 | **Cartel aéreo 3,90 ($38.000/ml)**: de los 3 Cenefones H/3,90 (bandas 0,50 / 0,90 / 1,10), ¿cuál es? | Fede |
| 4 | **Pintura**: va por litro y hoy se calcula a ojo. Idea del dueño: armar el combo completo (insumos + mano de obra) y sacar un **precio por m² pintado** | a diseñar |
| 5 | **Los TV a ×1,50 quedan caros** contra lo que se cobra | Fede |
| 6 | **3 lámparas en $0** en `insumos_base` (cuarzo, 9w spot, dicro) — bloquean las recetas de iluminación | Fede las completa |
| 7 | **48 dinteles y 32 columnas** sin peso de aluminio | falta la regla kg/m |
| 8 | **`SLA-001` repetido** en 3 ítems (Spot LED orientable aplicado / con brazo / premier con brazo) | Fede numera |
| 9 | **74 ítems sin código** | falta la regla de prefijos |

---

## 8 · Requisito de arquitectura que apareció

> *"Eventualmente hay que armar todos esos ítems: de lo que sea un corte de placa, tenemos que
> tener la medida, el costo, todo, para cuando pasemos la exportación de los ítems del 3ds Max
> al cotizador, o para pasar la lista de materiales."*

El modelo tiene que poder alimentar **dos salidas más**: importar el despiece desde 3ds Max, y
emitir la lista de materiales para el taller. Las dos exigen que **cada corte de placa sea un
ítem con su medida y su costo**. Es la forma que ya se viene armando, así que no hay que cambiar
de rumbo — hay que completarlo.

La tabla **`octexa_piezas`** (con `ancho_mm`, `prof_mm`, `alto_mm`, `geometria` y `despiece` en
JSONB) **existe y está vacía**. Probablemente sea ahí donde va eso.

---

## 9 · Dónde está el detalle

Todo en `APPS ANTIGRAVITY/MEPEX-COSTOS/`:

- `SUPERPLAN.md` — estado de cierre, los 3 caminos del motor, las tandas reordenadas
- `docs/METODO-COTIZACION-MEPEX.md` — §1 naturaleza, §2 las fórmulas verificadas, §5.1.b la validación
- `docs/VALIDACION-MODELO-2026-08-08.md` — el auto-armado contra los 98 stands
- `sql/2026-08-08_tanda1A_precios-mercado.sql` — los 22 UPDATE de precio
- `sql/2026-08-08_tanda2_recetas-panel-y-naturalezas.sql` — la fórmula del motor + reversión completa
- `sql/2026-08-08_tanda3_altas-subalquilados.sql` — las 29 altas
