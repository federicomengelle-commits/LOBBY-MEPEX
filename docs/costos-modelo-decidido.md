# Modelo de costos — lo que quedó decidido

> Resultado de la sesión de diseño del **2026-08-06**, con Fede.
> El insumo fue `docs/costos-estado-real-y-decisiones.md`, que planteaba 6 decisiones en orden.
> Acá está lo resuelto, con el porqué. Lo que sigue abierto está al final, con nombre y dueño.
>
> **Este archivo manda sobre cualquier criterio anterior de márgenes o vida útil.**
> La mecánica de la fórmula sigue documentada en `CLAUDE.md` §6.5 — eso no cambió.

---

## Decisión 1 · Qué significa "vida útil"

**El problema no era elegir entre usos y meses.** Al mirar los datos apareció que la columna
"vida útil" venía guardando **tres cosas distintas** según el insumo, sin que estuviera escrito
cuál iba en cada caso:

| lo que estaba cargado | lo que en realidad significaba |
|---|---|
| Reflector LED 50w → **1** | No dura un uso: se decidió **recuperar su costo entero en un solo alquiler** |
| Cable 2x1 → **2** | Ídem. Un cable no se destruye en dos armados |
| Aluminio pintado → **30** | Acá sí: **dura 30 armados** y después se descarta |

Por eso nadie podía validar la tabla. Si al taller le preguntabas *"¿el reflector dura un uso?"*
la respuesta correcta era **no** — y corregirlo a 50 le habría bajado el precio de $29.400 a
menos de $900. Las dos afirmaciones eran ciertas y la casilla sólo admitía una.

### La regla, para llenarla de acá en adelante

**Se mantiene una sola columna.** No se toca el motor. Lo que se define es **con qué criterio se
llena según qué es el insumo**:

| familia | criterio | quién pone el número |
|---|---|---|
| **Reutilizable** — aluminio, placas, vidrios | **Cuántos armados aguanta antes de descartarse** | El taller. Es una medición |
| **Consumible** — cinta, pintura, film, tornillos | **Cuántos armados rinde una unidad comprada** | Quien compra y usa |
| **Equipamiento** — reflectores, cables, TVs | **En cuántos alquileres se recupera lo pagado** | Fede. Es decisión comercial |
| **Subalquilado** | **Siempre 1.** No se amortiza: se paga cada vez | Nadie. Es por definición |
| **No va a un armado** — oficina, logística | Irrelevante para el costeo | — |

### Lo que esto destrabó

Aplicada a los 18 tipos de amortización que ya existen, la regla reparte los 80 insumos así:

```
38  subalquilados      → nada que decidir
 9  reutilizables      → ACÁ está la conversación con el taller
 9  equipamiento       → decisión comercial de Fede
11  consumibles        → rinde por unidad comprada
 5  ferretería         → mezclada: el tornillo es consumible, el candado es equipamiento
 8  oficina/logística  → no entran en ninguna receta
```

**De 80 insumos, sólo 9 necesitan al taller: el aluminio, cuatro placas y dos vidrios.**
La decisión 2 parecía una auditoría de 80 líneas y es una charla de media hora con Diego.

---

## Decisión 4 · Política de márgenes

**Por rubro**, con dos bandas separadas: **propio** y **subalquilado**. Son negocios distintos.

| rubro | propio | subalquilado |
|---|---|---|
| **Infraestructura** | **100%** | 50% |
| **Equipamiento** | **100%** | **50%** |
| **Iluminación** | **100%** | 50% |
| **Marketing** *(rubro nuevo)* | — | **50%** |
| **Pisos** · alfombras | — | **60%** |
| **Pisos** · tarimas | — | **45%** |
| **Más servicios** | **45%** | **45%** |

> ⚠️ **Lo que la UI llama "margen" es markup** — se calcula sobre el costo, no sobre el precio.
> Un ítem que cuesta $100 "al 100%" se vende a $200: la ganancia es $100 sobre $200, o sea
> **50% de margen real**. "Al 45%" es 31% real. Es convención del sistema, está documentada en
> `CLAUDE.md` §6.5 y no es un bug — pero conviene tenerla presente al discutir números.

### Por qué dos bandas y no una

- En **lo propio**, el margen es ganancia limpia: el desgaste del activo ya se cobró aparte, vía
  la vida útil.
- En **lo subalquilado**, el margen paga otras cosas: la gestión, el riesgo de que el proveedor
  falle, y sobre todo **que MEPEX le paga al proveedor antes de cobrarle al cliente**. Eso es
  capital propio prestado y tiene que estar cobrado.

### El razonamiento sobre la competencia *(de Fede)*

Hay **2 o 3 empresas que hacen lo mismo y tercerizan prácticamente lo mismo**. De ahí se sigue
algo que sostiene toda la política: **si todas subalquilan a los mismos proveedores, ninguna tiene
ventaja de costo.** El que baja el margen no gana la venta, sólo gana menos. Es exactamente el
mercado donde el margen se sostiene en vez de pelearse — y por eso lo subalquilado no se regala.

Estaba al revés de lo conveniente: lo propio iba 50-125% y lo subalquilado 30-60%, cuando es en
lo subalquilado donde se compite mano a mano y donde se pone plata por adelantado.

### Los seis rubros

Quedaron fijados: **Infraestructura · Iluminación · Equipamiento · Pisos · Marketing · Más servicios.**

- **Marketing es nuevo** — gráfica y cartelería. Antes el vinilo no tenía rubro.
  No hizo falta tocar código: `costos.js` arma la lista de rubros con los valores que existen en
  el catálogo. **Pero el Cotizador es una app aparte y también agrupa por rubro** — cuando
  Marketing tenga ítems cotizables hay que avisar de ese lado.
- **Las tarimas son subalquiladas**, no fabricación propia (hay dos proveedores). Estaban mal
  cargadas: figuraban como propias. Se corrigió. No había ningún cálculo que arreglar — las cinco
  estaban vacías, sin componentes y en $0.

---

## Lo que sigue abierto

### Para Diego / el taller — hoja preparada en `docs/costos-preguntas-taller.md`

| | | |
|---|---|---|
| **Decisión 2** | Las vidas útiles reales | **9 insumos**: aluminio, 4 placas, 2 vidrios |
| **Decisión 3** | ¿El panel negro dura la mitad que el blanco? | Bloquea al ítem 89 |
| **Decisión 5** | La mano de obra real de armado | Hoy hay 3 minutos cargados, que no resisten una pregunta |

### El ítem 89 está congelado, y ahora se sabe exactamente por qué

Su costo por uso guardado es **$10.197**, *menor* que el del panel blanco (**$14.041**). Es
imposible: es el mismo panel con la mitad de vida útil, así que su costo por uso tiene que ser el
**doble** del blanco, $28.082. El número guardado quedó viejo.

**Recalcularlo no corregiría un precio: afirmaría que el panel negro dura 5 usos.** Queda afuera
de la política hasta que el taller lo confirme.

Dato que reordena la urgencia: **el panel negro se cotizó una sola vez, una unidad.** El blanco
movió **2.247**. Son el mismo producto en otro color, y uno es el negocio y el otro una anécdota.

---

## Hallazgos de la sesión

- **`pct_margen_default` no gobierna nada.** Los 226 ítems tienen `margen_propio` cargado, y 221
  con el valor exacto del parámetro global (0,50): alguien copió el default a cada ítem. Tocar el
  parámetro no cambia un solo precio. La política de arriba lo reemplaza como fuente de verdad.
- **`margen_propio` es decorativo en los subalquilados.** Los 7 lo tienen en 0,50 y la fórmula lo
  ignora: usa `margen_subalquiler`. Al mirar "el margen" de un ítem hay que mirar la columna que
  corresponde a su tipo.
- **Un precio invertido, corregido.** La alfombra usada **con** nylon se vendía **$960 más barata**
  que la usada sola, con el mismo costo: una estaba al 50% y la otra al 30%. Le agregabas nylon y
  la cobrabas menos.
- **Queda una deuda de costo, no de margen:** las dos alfombras usadas tienen el mismo costo
  ($4.800) y una lleva nylon. O el costo de esa está incompleto, o el nylon se lo come MEPEX.
- **Cuatro subalquilados en $0** — `TV 75" 4K`, `TV 85" 4K`, `Tarima 4cm + Alfombra + Nylon` y
  `Vinilo de corte colocado`. Hoy no hacen daño (ninguno está en una receta viva), pero el día que
  se arme la receta del TV 75" va a dar $0 y **nada lo va a avisar**.
- **Ocho ítems son todo el negocio cotizado.** 99 líneas de cotización reparten así: panel blanco
  2.247 unidades, reflector 706, vinilo 718, TV 55" 59, alfombra 500, vitrina 70, panel negro 1.
  Hay 226 ítems en el catálogo. La carga masiva sigue haciendo falta, pero **el rigor no se reparte
  parejo**: los primeros diez merecen discusión ítem por ítem, los otros doscientos merecen una
  regla que los cargue rápido — que es justamente lo que acaba de quedar escrito.
