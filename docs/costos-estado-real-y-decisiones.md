# Costos — estado real del modelo y las decisiones que faltan

> ### ⚠️ ESTE ARCHIVO YA CUMPLIÓ SU FUNCIÓN — 2026-08-06
> Era el **insumo** de la sesión de diseño, y esa sesión se hizo. **Las decisiones tomadas viven
> ahora en `docs/costos-modelo-decidido.md`**, que es el que manda.
> Esto queda como el **diagnóstico** que la originó: sirve para entender de dónde venía cada
> problema, no para saber qué se decidió.
>
> **Ojo con los números de acá abajo: son del 2026-08-03 y varios ya no valen.** Los márgenes
> cambiaron (política nueva por rubro), las tarimas pasaron a subalquiladas y nació el rubro
> Marketing. Lo que sigue en pie: el hecho de que las vidas útiles reales las tiene que decir el
> taller — para eso está `docs/costos-preguntas-taller.md`.
>
> 🟥 **Y el título de la §2 ya no describe nada: "los 9 cotizables" hoy son 63.** Al 2026-08-15
> el catálogo tiene **351 ítems · 63 cotizables · 245 con precio · 222 con receta**.
> El **ítem 89 tampoco sigue congelado**: la sesión del Cotizador le sacó la vida útil de armado
> y lo dejó al mismo margen que el blanco, así que hoy los dos valen **$25.183,27**.

> Escrito el **2026-08-03**, con datos leídos de producción (no de la documentación).
> Nace de T5.1 de la auditoría: el plan decía *"recalcular el ítem 89, un clic, $40.240"* y al mirarlo
> resultó que el clic **no arregla un precio: aplica una vida útil que nadie validó**. Fede:
> *"no lo tengo del todo claro; es lo que tengo que diseñar mejor y saber generalidades,
> esto aplicado a todo el tema costos en general, para poder armar una buena propuesta."*
>
> **Para qué sirve este archivo:** es el insumo de esa sesión de diseño. No propone una respuesta —
> las respuestas son de Fede y del taller. Lo que hace es poner sobre la mesa **qué hay cargado hoy,
> qué decide cada número, y dónde el modelo pide un criterio que todavía no existe.**
>
> Ligado a: `PUESTA-A-PUNTO-2027.md` (etapa 1, el gate de costos) · `CLAUDE.md` §6.5 (cómo funciona
> la fórmula) · `docs/auditoria-2026-07-31/05-EJECUCION.md` (T5.1).

---

## 1. El tamaño real del catálogo — más chico de lo que parece

| | |
|---|---|
| ítems en el catálogo | **227** |
| **de esos, cotizables** | **9** |
| ítems con receta cargada | 28 |
| cotizables sin receta | **0** ✓ |
| ítems que quedan en **$0** (sin receta) | ~199 |
| insumos vivos | 80 |
| subalquilados | 7 |

**Lo primero que hay que digerir: hoy se cotizan 9 ítems.** Todo el resto del catálogo —columnas,
dinteles, mostradores, tarimas, sillas— está cargado como nombre pero **sin costear**, en $0. No es
un error: es que el trabajo de costeo se hizo sobre lo que más se usa y ahí quedó.

Eso significa que **la carga masiva del catálogo (etapa 2 de la puesta a punto) no es "cargar 200
precios": es decidir 200 vidas útiles.** Y de ahí que el gate del plan —motor de costos sano antes de
la carga— sea el correcto: cargar 200 ítems sobre criterios que no están definidos es fabricar 200
precios que después nadie va a poder defender.

---

## 2. Los 9 cotizables, con lo que decide su precio

| id | ítem | vida útil del armado | MO (min) | margen | precio hoy |
|---|---|---|---|---|---|
| 89 | Panel sistema **negro** h=2,50m | **5 usos** | 3 | **125%** | $22.944 |
| 49 | Vitrina mostrador 1,00m | **5 usos** | 0 | 100% | $93.880 |
| 88 | Panel sistema **blanco** h=2,50m | **10 usos** | 3 | 80% | $25.274 |
| 218 | TV 55" 4k | — | 0 | 50% | $279.860 |
| 219 | Vinilo impreso y colocado | — | 0 | 50% | $37.975 |
| 56 | Reflector LED 50w | — | 0 | 100% | $29.400 |
| 60 | Alfombra nueva con nylon | — | 0 | 50% | $11.200 |
| 58 · 59 | Alfombra usada (c/ y s/ nylon) | — | 0 | 50% | $7.200 · $6.240 |

**Lo que salta a la vista y hay que resolver:**

- **El panel negro dura 5 usos y el blanco 10.** Es el mismo producto en otro color. ¿El negro se
  raya y se ensucia al doble de velocidad —que es plausible— o alguien cargó un número y el otro no?
  **Nadie lo puede contestar desde el sistema. Lo sabe el taller.**
- **Los márgenes van de 50% a 125% sin un criterio escrito.** El panel negro al 125%, el blanco al
  80%, la vitrina al 100%, el resto al 50%. Puede ser deliberado (valor percibido, competencia) o
  puede ser el sedimento de decisiones sueltas. **Hoy no hay forma de saber cuál es cuál.**
- **Sólo 3 de los 9 tienen mano de obra cargada**, y son 3 minutos. Armar un panel lleva más que eso;
  probablemente el número esté puesto como placeholder.

---

## 3. Las vidas útiles que están cargadas hoy

Cada insumo hereda su vida útil de un **tipo de amortización** (18 tipos), y puede pisarla con un
valor propio. Esto es lo que hay:

| tipo | usos | desperdicio | reacond. | insumos que lo usan |
|---|---|---|---|---|
| Sub-alquilados | 1 | 0% | 0% | **38** |
| Consumibles | 1 | 0% | 0% | 9 |
| Eléctrico | 50 | 0% | 5% | 9 |
| Oficina | 1 | 0% | 0% | 6 |
| Ferretería | 30 | 0% | 5% | 5 |
| Aluminio en barra | 30 | 5% | 5% | 3 |
| Logística | 1 | 0% | 0% | 2 |
| Placa Fibroplus 3mm | **2** | 15% | 30% | 1 |
| Placa Fibroplus 5,5mm | **4** | 15% | 25% | 1 |
| Placa Karikal 3mm | 10 | 15% | 20% | 1 |
| Placa Karikal 10mm | 15 | 15% | 15% | 1 |
| Vidrio float 4mm | 10 | 0% | 10% | 1 |
| Vidrio float 6mm | 15 | 0% | 10% | 1 |
| Pintura · Embalaje | 1 | 0% | 0% | 1 c/u |
| Mano de obra · Limpieza · Otros | 1 / 1 / 20 | — | — | **0** |

**15 de los 80 insumos** tienen además una vida útil propia que pisa la del tipo.

**Las preguntas que abre esta tabla:**
1. **¿La vida útil es en USOS o en TIEMPO?** Está declarada en usos, pero una placa que se moja en un
   armado se descarta aunque sea el primer uso, y un perfil de aluminio guardado 3 años sigue sano.
   Hoy el modelo asume desgaste por uso, sin excepciones.
2. **¿Qué pasa con lo que se rompe antes?** No hay forma de registrar "esta placa duró 1 uso en vez
   de 4". El modelo es un promedio implícito, y nadie está midiendo el real.
3. **Ferretería con vida útil 30** — un tornillo no se reusa 30 veces; se pierde. ¿O ahí "vida útil"
   significa otra cosa (el paquete rinde 30 armados)? **La unidad de medida no está escrita.**
4. **Aluminio 30 usos** — el sistema OCTEXA es el activo principal de MEPEX. Si el número real es 50
   o 100, todo el costeo de estructura está sobrevaluado; si es 15, subvaluado.

---

## 4. Cómo se convierte todo eso en un precio

Verificado leyendo la función `calcular_receta` en producción (no la documentación):

```
Por cada insumo de la receta:
    costo_nuevo = costo_unitario × cantidad × (1 + desperdicio/100)
    costo_uso   = (costo_nuevo / vida_útil) × (1 + reacondicionamiento/100)

Mano de obra:  (minutos / 60) × $15.000 la hora   ÷ vida útil del armado
Indirectos:    mano de obra amortizada × 30%
Precio:        costo_uso × (1 + margen)
```

**La regla 1:N — la que decide el caso del ítem 89.** Si el ítem tiene cargada una *vida útil de
armado*, se ignora la amortización de cada componente y se reparte **todo** el costo de fabricación
entre esos usos:

```
costo_uso = (costo_fabricación / vida_útil_armado) + indirectos
```

Es lo correcto conceptualmente: si la vitrina se descarta a los 5 usos, el aluminio que tiene adentro
se va a la basura con ella, no importa que el aluminio "dure 30". **Pero convierte a ese número en el
más sensible de todo el modelo**, porque multiplica o divide el precio entero.

### El caso del ítem 89, como ejemplo de lo que hay que decidir

| | |
|---|---|
| cuesta fabricarlo | **$140.185** |
| vida útil de armado cargada | **5 usos** |
| → costo por uso | $28.082 |
| → precio con su margen del 125% | **$63.184** |
| **precio que tiene cargado hoy** | **$22.944** |

El precio guardado corresponde a repartirlo entre **~14 usos**. Alguien cambió la vida útil a 5 y
nunca se recalculó. **Apretar "Recalcular" no corrige un error: afirma que el panel dura 5 usos** — y
lo lleva de $22.944 a $63.184, que es lo que el Cotizador saldría a cobrar.

**Está congelado a propósito hasta que se defina el criterio.**

---

## 5. Deudas concretas del estado actual

- **22 insumos cambiaron de precio después del último recálculo masivo** (16/05). Sus recetas siguen
  con el costo viejo hasta que alguien las recalcule una por una.
- **17 ítems tienen el precio guardado distinto del que da su receta.** Sólo **1 es cotizable** (el
  89). De los otros 16, uno (`217 Placa Karikal`) está **$1.720 por encima**, no por debajo.
- **El aviso de "hay que recalcular" vive sólo en el panel abierto**: se pierde al cerrarlo. Por eso
  el 89 quedó desfasado sin que nadie lo viera. *(Hallazgo del audit; el arreglo está pendiente.)*
- **Dos convenciones de porcentaje conviviendo en la misma fórmula** — no rompe hoy, pero es una
  trampa esperando:

  | dónde | cómo se guarda | qué hace la fórmula |
  |---|---|---|
  | tipos de amortización (desperdicio, reacond.) | **entero**: `15` = 15% | divide por 100 |
  | overrides de los insumos | entero | divide por 100 |
  | parámetros globales (indirectos, margen default) | **factor**: `0.30` = 30% | **no** divide |
  | margen propio del ítem | factor: `1.25` = 125% | no divide |

  Cargar un desperdicio como `0.15` pensando en factor da **0,15%**. Un margen cargado como `50` daría
  **5000%**. Nada lo avisa.

- **Parámetros que la fórmula ignora** pero siguen en la pantalla de Parámetros, invitando a que
  alguien los cambie creyendo que hacen algo: `hora_montajista_ars`, `vida_util_default`,
  `pct_desperdicio_aluminio`, `pct_indirectos_comercial`, `pct_reacondicionamiento`, `dolar_bna_vendedor`.

---

## 6. Las decisiones que hay que tomar (el orden importa)

1. **¿En qué unidad se mide la vida útil?** Usos, armados, o meses. Y qué se hace con lo que se rompe
   antes de tiempo. Todo lo demás cuelga de esto.
2. **Las vidas útiles reales del sistema OCTEXA** — aluminio, placas, paneles armados. Es una
   conversación con el taller, no con el sistema. Empezar por los 9 cotizables y por el aluminio.
3. **¿El panel negro dura la mitad que el blanco?** Si sí, queda escrito el porqué. Si no, se unifica.
4. **Una política de márgenes**: qué justifica el 125% del panel negro contra el 50% del resto.
   Escrita, no heredada.
5. **La mano de obra real de armado**, aunque sea por familia de producto. Los 3 minutos de hoy no
   resisten una pregunta.
6. **Recién entonces**: recalcular los 17 desfasados y cargar el resto del catálogo.

**Nada de esto es trabajo de sistema.** El sistema ya calcula bien: lo verificado es que la fórmula
hace lo que dice la documentación. Lo que falta son los números que la alimentan, y ésos salen del
taller y de la decisión comercial.

---

## 7. Lo que el sistema debería sumar para sostener esas decisiones

Ideas que salen de lo de arriba, para evaluar cuando se defina el criterio — **no antes**:

- **Registrar la vida útil real**: cuántos armados lleva cada panel/placa, para que la vida útil deje
  de ser una estimación y pase a ser una medición. Hoy no hay dónde anotarlo.
- **Que el "hay que recalcular" sobreviva al cierre del panel** — badge persistente por ítem, o un
  contador de "N ítems desfasados" en el módulo. Es lo que habría evitado el caso del 89.
- **Una sola convención de porcentaje**, con la UI convirtiendo.
- **Sacar de la pantalla los parámetros que la fórmula no usa.**
- **Un "qué pasa si"**: cambiar la vida útil del aluminio de 30 a 50 y ver el impacto en los 9
  cotizables antes de confirmarlo.
