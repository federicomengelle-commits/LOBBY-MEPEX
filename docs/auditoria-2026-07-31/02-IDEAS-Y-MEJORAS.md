# Ideas y mejoras — Automatizaciones, flujo y reducción de clics

> Auditoría integral 2026-07-31. **Cada propuesta viene con el número de prod que la justifica.** Una automatización sin data es una idea muerta.

---

## Corrección de premisa

**`pg_cron` NO está instalado.** `pg_extension` tiene solo `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`. Está *disponible* (1.6.4, igual que `pg_net` 0.19.5) pero requiere un `CREATE EXTENSION` desde el Dashboard.
Por eso **todo lo de abajo lo evita**: `alertas.js` ya recalcula solo cada 5 min y es el reloj más barato que hay. `pg_cron` se justifica solo para algo que tenga que correr **con la app cerrada** — hoy nada lo necesita, y el claim atómico (`notif_armado_7d_at`) ya resuelve el caso "nadie abrió la app hoy", con el costo conocido de salir al día siguiente.

---

# PARTE 1 — AUTOMATIZACIONES

## 🥇 ORO — eliminan trabajo manual recurrente **y** previenen un error de plata

### 1. La cuota de cobranza deja de depender de la memoria de nadie

- **Hoy:** se arma el plan de pagos desde la ficha de la venta y después **hay que acordarse** de facturar cada cuota y de reclamarla. No hay recordatorio ni pantalla que lo junte.
- **Disparador:** `plan_cobro_items` con `facturar = true` + `comprobante_venta_id IS NULL` + `fecha_estimada <= hoy + 5d`. Y su gemelo: `fecha_estimada IS NULL` con `estado <> 'cobrado'`.
- **Acción:** (1) **tarea derivada** "Emitir factura — cuota N de \<cliente\>" (`dedupe_key: cuota_fact:<id>`, `target_role:'admin'`, link a `#finanzas`). (2) **alerta** "cuota sin fecha de vencimiento" — porque una cuota sin fecha es plata que el motor **no puede reclamar nunca**.
- **Cómo:** generador en `tareas.js._gen.cobranzas` (calcado de `_gen.finanzas`) + un ítem en `Alertas._generators.finanzas`. **Cero DDL, cero backend.**
- **Data real:** **8 cuotas con `facturar=true` y sin factura = $34.000.000. Ninguna se facturó jamás.** De esas, **7 sin `fecha_estimada` → $30.000.000 invisibles** para la alerta que ya existe. La única con fecha está **vencida hace 114 días por $4.000.000**.
- **Riesgo:** ruido cero (8 filas; crece con las ventas, no con el tiempo). **No auto-emitir** — ver §NO recomiendo.
- **Esfuerzo:** S

### 2. Candado al comprobante de proveedor duplicado

- **Hoy:** el mismo papel entra por tres puertas (carga manual, foto/OCR, "generar pago" desde la OC) y **nada chequea si ya está**. Cada copia suma IVA crédito que no existe y sale en la DDJJ.
- **Disparador:** INSERT/UPDATE en `comprobantes_recibidos` con `(cuit, tipo, numero)` ya vivo.
- **Acción:** rechazar con mensaje claro ("esa factura ya está cargada, id X") y ofrecer abrir la existente.
- **Cómo:** `CREATE UNIQUE INDEX ... ON comprobantes_recibidos (cuit, tipo, numero) WHERE _deleted = false AND numero IS NOT NULL` + catch del `23505`.
  **La clave va por `cuit`, NO por `proveedor_id`** — verificado: 5 de 5 comprobantes vivos tienen `proveedor_id` NULL y los 5 tienen CUIT y número. Con `proveedor_id` el índice no atraparía nada.
- **Data real:** factura A `00002-00005961` **cargada 3 veces el mismo día**, $1.306.800 sumados, **$226.800 de IVA acumulado cuando el real es $75.600 → $151.200 de crédito fiscal inventado.** Hay que limpiar las 2 copias antes de crear el índice (si no, el `CREATE` falla — **cosa que es una ventaja**: te obliga a mirarlas).
- **Esfuerzo:** S

### 3. Las asignaciones de gente se convierten en costo solas

- **Hoy:** el PM asigna gente y después **alguien tiene que entrar a Rendimiento y apretar "🔄 Traer de asignaciones"**. Si no, el evento se costea sin mano de obra y la ganancia sale inflada. Y el botón muere en silencio para pm/venta por RLS.
- **Disparador:** INSERT/UPDATE/DELETE en `asignaciones_evento` o `evento_jornadas`.
- **Acción:** marcar `eventos.jornales_desfasados_at = now()` → **alerta** ("3 eventos con gente asignada sin costear") + **tarea derivada** por evento con la sincronización a un click.
  **Marcar, no ejecutar:** `syncJornalesEvento` borra líneas que ya no corresponden; un DELETE automático disparado por un cambio de asignación es la clase de cosa que se come una línea con pago encima. La función ya se cuida (`hasPago`), pero la decisión de barrer conviene que la firme un humano.
- **Cómo:** trigger AFTER (patrón calcado de `trg_evento_jornadas_sync`, que ya vive ahí) + 1 columna + ítem en alertas y tareas. **La lógica de cálculo no se toca:** sigue siendo `API._computeJornalLines`.
- **Data real:** **21 asignaciones de eventos YA TERMINADOS sin línea de jornal.** El caso duro: *Feria del Libro de Campana* — **20 personas asignadas, 0 jornales**, armado 10/06 y desarme 14/06. *Beauty Day*: 13 → 9. *Estetica*: 1 → 0. Total: 40 asignaciones vivas contra 15 líneas de costo.
- **⚠️ Precondición dura:** `personas.costo_dia_referencial` está **NULL en las 24** → 14 de las 15 líneas existentes valen $0. **Sin ese dato la automatización trae ceros prolijos, que es peor que no traer nada.** Primero Lelean carga las tarifas; después esto.
- **Esfuerzo:** M

### 4. El evento termina y el sistema cierra el ciclo (encuesta → proyectos)

- **Hoy:** al desarmar hay que abrir la ficha, apretar "📨 Enviar encuesta", copiar el link y mandarlo por WhatsApp. Nadie lo hace. Y como **la cadena de cierre cuelga de esa encuesta**, los stands quedan abiertos para siempre.
- **Disparador:** eventos cuyo `coalesce(fecha_desarme_fin, fecha_evento_fin)` pasó hace 1 día sin encuesta *posterior al desarme*. Segundo, independiente: proyectos con `estado_taller <> 'cerrado'` cuyo evento terminó hace >7 días.
- **Acción:** (1) crear la encuesta + **tarea derivada** "Mandar encuesta a \<cliente\>" con el link armado. (2) **alerta** "N stands abiertos con el evento terminado".
- **Cómo:** generador en `tareas.js._gen.eventos` (ya consulta esas tablas para "evento sin stands" — es la misma query con el signo dado vuelta) + ítem en alertas. **La segunda mitad ya está construida y funcionando:** `trg_encuesta_respondida` cierra todos los proyectos del evento al llegar la respuesta. **Lo único roto es el primer eslabón.**
- **Data real:** **4 de 6 proyectos con evento tienen el evento terminado y siguen abiertos**: Univ. Siglo XXI (72 días, `pendiente` 50%), Feria del Libro Campana (47 días, 0%), Stand Akadia (15 días, 25%), Feria del Libro Infantil (1 día, 25%). De 5 eventos terminados: 1 sin encuesta, **3 con encuesta creada ANTES del evento y nunca respondida** (Beauty Day: encuesta del 16/05 para un evento que desarmó el 16/07), 1 respondida (Estetica, NPS 10 → **y ese proyecto sí está cerrado al 100%: la cadena funciona cuando la disparás**).
- **Riesgo:** el proyecto puede seguir legítimamente abierto → **avisa y propone, no cierra**.
- **Esfuerzo:** M

### 5. La receta se marca desfasada sola cuando cambia lo que la compone

- **Hoy:** cambiás el costo de un insumo → las recetas que lo usan quedan con el precio viejo, y el único aviso es un `●` en un panel que hay que ir a mirar. Recalcular es un acto de memoria, ítem por ítem.
- **Disparador:** UPDATE de `insumos_base.costo_unitario` (o `receta_componentes`, o `parametros_globales`) → todos los `catalogo_items` que lo tengan en la receta, directa o por BOM.
- **Acción:** marcar `catalogo_items.recalculo_pendiente_at` en cascada + **alerta** ("N recetas desfasadas · M cotizables") con un botón que corra la RPC en lote.
- **Cómo:** trigger AFTER UPDATE que resuelve el árbol inverso de `receta_componentes` + 1 columna + ítem en alertas (categoría `costos`, hoy ausente de `_visibility`).
  ⚠️ **`receta_componentes.componente_id` es TEXT y `insumos_base.id` es BIGINT** → el join necesita cast.
- **Data real:** **17 de 27 items con receta tienen el precio cacheado distinto del recálculo de la RPC.** El peor, y el único **cotizable**: id 89 "Panel sistema negro h=2,50m" — cacheado $22.943,80 vs fórmula $63.184,50 → **se cotiza $40.240,70 por debajo de su propio costeo**. Estructuralmente: **16 de 28 recetas tienen un insumo modificado DESPUÉS de su snapshot** (22 insumos cambiaron post 16/05, el último recálculo masivo).
- **Riesgo:** ninguno de plata — solo marca. **NO auto-recalcular** (ver §NO recomiendo).
- **Esfuerzo:** M

---

## 🥈 PLATA — eliminan trabajo manual recurrente

### 6. `clientes.ultimo_contacto` se escribe solo

- **Hoy:** nadie lo escribe. Nunca. En 265 clientes.
- **Cómo:** trigger AFTER INSERT en `crm_mensajes` (resuelve el cliente directo o vía `crm_casos.cliente_id`) + backfill. **DDL: ninguno, la columna ya existe.**
- **Data real:** **265 de 265 en NULL** → **tres consumidores muertos**: la alerta `crm_cliente_followup` (`alertas.js:157`) y dos widgets del lobby (`lobby.js:883` "sin follow-up" y `:893` "inactivos"), que hoy renderizan vacío para todo el mundo. Para el backfill hay: 9 clientes con cotización, 7 con ingreso, 6 con proyecto, 4 con mensajes.
- **Riesgo y mitigación:** que la alerta de "≥15 días sin follow-up" se encienda de golpe con ~250 clientes fríos. **Backfillear solo los que tienen actividad real (≈15) y dejar el resto NULL** — un cliente que nunca se tocó no es un follow-up atrasado, es un cliente sin relación. Eso además hace que la alerta signifique algo.
- **Esfuerzo:** S

### 7. `cotizaciones.fecha_evento` derivada del evento

- **Hoy:** el campo existe, la fecha existe en `eventos`, y nadie las une.
- **Cómo:** trigger BEFORE INSERT/UPDATE en `cotizaciones` + trigger en `eventos` que propaga. 5 líneas, sin DDL. Copiar solo cuando está NULL.
- **Data real:** **14 de 18 cotizaciones tienen `event_id`. 0 de 18 tienen `fecha_evento`.** Enciende la alerta "cotizaciones por vencer (evento ≤3 días sin cerrar)" y la tarea derivada `crm_cotiz`, **ambas hoy estructuralmente imposibles**. Hay 16 cotizaciones abiertas esperando eso.
- **Esfuerzo:** S

### 8. Recibir la compra actualiza el costo del insumo

- **Hoy:** recibís la OC → suma stock y registra el movimiento, **pero el costo queda con el precio viejo**. Hay que ir a Costos y tipearlo a mano, sabiendo cuál era.
- **Cómo:** ~10 líneas dentro de `API.recibirOrdenCompra` (`api.js:5123`). `logPrecioChange(insumoId, anterior, nuevo, motivo)` **ya existe y ya acepta motivo libre** — hoy solo lo llaman las ediciones manuales. Se encadena solo con la idea #5.
- **Data real:** **no hay todavía, y hay que decirlo**: las 4 líneas de OC existentes son de prueba, borradas, sin `insumo_id` ni `precio_unitario`. **Esta se construye ANTES de que Compras se use en serio, no después.** Lo que sí es real: `insumos_base.fecha_ultimo_precio` está **NULL en los 80** a pesar de **41 cambios de precio registrados** — la columna que muestra "última actualización" nunca se escribió.
- **Riesgo:** que una compra chica y atípica mueva el costeo. Mitigación: si el delta supera ±30%, **no pisar — avisar**.
- **Esfuerzo:** S

### 9. El subalquiler se pide antes de que sea tarde

- **Hoy:** los ítems subalquilados salen de las cotizaciones de los stands; hay que entrar a la ficha, mirar la sección, generar el PDF por proveedor y mandarlo a mano. Nadie avisa que se viene.
- **Cómo:** **falta solo el reloj.** `API.getSubalquileresByEvento` (`api.js:9121`) ya devuelve la estructura agrupada por proveedor con teléfono y mail, y `pedido-pdf.js` ya genera el PDF. Un generador en `tareas.js` que la llame a 14 y 5 días del armado, con el claim atómico de dos hitos que ya tiene patrón probado en `notifyArmadoProximo`.
- **Data real:** **44 líneas de subalquiler / 1.277 unidades en 4 eventos.** El más cargado: Feria del Libro Infantil con 26 líneas / 530 unidades. **10 líneas / 177 unidades cuelgan de cotizaciones sin evento vinculado** → no se pueden pedir a tiempo porque no tienen fecha.
- **Esfuerzo:** M

### 10. Auditoría contable que corre sola

- **Hoy:** la partida doble se verifica cuando alguien se acuerda (última vez: 2026-06-21, a mano). No hay pantalla.
- **Acción:** 4 chequeos y una alerta si alguno falla — (a) asientos desbalanceados, (b) `saldos_mensuales` vs recálculo, (c) **arrastre roto** (`saldo_anterior` ≠ `saldo_final` del período previo de la misma cuenta+canal), (d) movimientos confirmados con cuenta y sin asiento.
- **Cómo:** view `v_integridad_contable` (⚠️ **nace con `security_invoker = true`**, regla de facto desde 2026-07-26) + generador en alertas. Para reparar ya existe `fn_refresh_saldo_cascada(cuenta, periodo_desde, canal)` → un botón "recalcular" al lado.
- **Data real:** **el bug está vivo**: cuenta `1.1.01` interno cerró **2026-05 en $3.200.000** y **2026-07 arranca con `saldo_anterior = 0`**. **Los totales de debe/haber por período están perfectos (0 filas de drift)** — el error es exclusivamente de arrastre, la clase de cosa que no ves nunca mirando un mes solo.
- **Riesgo:** empezar solo con (b) y (c), que son deterministas.
- **Esfuerzo:** M

### 11. Rutina de revisión de precios de insumos

- **Cómo:** **es literalmente un INSERT.** Una fila en `rutinas` (`target_role:'admin'`, trimestral) — la infraestructura está entera: 10 rutinas activas, generador `_gen.rutinas`, RPC de avance, claim por `dedupe_key`, alerta de vencida.
- **Data real:** **63 de 80 insumos no tienen cambio de precio hace más de 90 días.** El historial existe (41 cambios, 27 insumos, entre el 10/03 y el 19/05) y después **se cortó seco**.
- **Esfuerzo:** S (una fila)

---

## 🥉 BRONCE — hacen visible algo que hoy hay que ir a buscar

### 12. La bandeja de "alertas apagadas por falta de dato"

Media docena de alertas y widgets están construidos, testeados y **completamente ciegos** porque la columna que miran está vacía. **No fallan: devuelven cero.** Una card en el lobby admin ("6 avisos apagados por falta de dato") con el desglose y el link a dónde cargarlo.

**Inventario completo verificado:**

| Columna | Cobertura | Qué queda muerto |
|---|---|---|
| `clientes.ultimo_contacto` | **0/265** | 1 alerta + 2 widgets del lobby |
| `insumos_base.stock_minimo` | **0/80** | 1 alerta + 1 tarea derivada + el trigger `trg_notif_stock_minimo` (bien escrito, no puede disparar nunca) |
| `personas.costo_dia_referencial` | **0/24** | 14 de 15 jornales en $0 |
| `cotizaciones.fecha_evento` | **0/18** | 1 alerta + 1 tarea |
| `plan_cobro_items.fecha_estimada` | **1/8** | $30M invisibles para la alerta de cobranzas |
| `locaciones_documentos.fecha_vencimiento` | **0 filas** | 3 alertas + 3 tareas derivadas sobre tablas vacías |
| `persona_documentos.fecha_vencimiento` | **0 filas** | semáforo de ART que dice "al día" |
| `produccion_mantenimiento.fecha_proximo_vencimiento` | **0 filas** | idem |
| `vencimientos_recurrentes` | **0 filas** | el módulo `#calendario-adm` entero + 2 alertas |

### 13. Caso de CRM enfriándose → alerta, no chip
La Bandeja tiene el chip "enfriándose >7d" pero **hay que abrir el CRM para verlo**. Un ítem en `Alertas._generators.crm` lo sube al dot del sidebar. Sin fila de `notifications` (es estado vivo — reaparecería sin leer en cada recálculo, decisión D2 del rework).
**Data real:** 4 casos vivos, **3 sin mensaje hace 28, 45 y 45 días**, y **los 4 sin `proxima_accion` cargada**. · **S**

### 14. Nadie fuera de los superadmin puede recibir un push
El push VAPID está construido, deployado y andando. **Las 4 suscripciones que hay son de superadmins.** Taller: cero. PM: cero. Los avisos de armado a 2 días con `push:true` que ya emite `notifyArmadoProximo` **no le llegan al celular de nadie que los necesite.** Tarea derivada para admin ("5 personas sin la app instalada") con el link a `docs/guia-instalar-app-celular.md`. · **S**

---

## Puentes faltantes entre módulos

| Proceso A (produce) | Proceso B (consume) | Cómo viaja hoy | Cómo debería |
|---|---|---|---|
| Asignar gente al evento (40 vivas) | Planilla de Rendimiento | **Botón manual**, y muere callado por RLS para pm/venta | Trigger marca desfase → alerta + tarea (**21 asignaciones sin costear**) |
| Fin del evento | Encuesta NPS → cierre de proyectos | **Nada** | Tarea al día siguiente del desarme. **El resto ya es automático** |
| Recibir OC | Costo del insumo | **Nada** — suma stock, no toca costo | 10 líneas en la misma función |
| Cambio de costo de insumo | Precio de las recetas | **Nada** — solo un `●` que hay que ir a mirar | Trigger en cascada (**17 desfasados hoy**) |
| Mensaje/cotización/cobro de un cliente | `clientes.ultimo_contacto` | **Nada** — 0 de 265 | Trigger + backfill acotado |
| `cotizaciones.event_id` (14/18) | `cotizaciones.fecha_evento` (0/18) | **Nada** | Trigger de 5 líneas |
| Cuota llega a su fecha | Factura ARCA | **Nada** — 0 de 8 cuotas facturadas ($34M) | Tarea derivada (emitir siempre lo firma un humano) |
| Ítems subalquilados (44 líneas / 1.277 u.) | Pedido al proveedor | Entrar, generar PDF, mandar a mano | Tarea por proveedor a 14 y 5 días |
| Asientos | `saldos_mensuales` | Trigger automático… **con el arrastre roto** ($3,2M escondidos) | Chequeo como alerta + botón de recálculo |
| Comprobante recibido | Egreso | **Botón** ya construido — pero 2 comprobantes por $871.200 siguen huérfanos | Falta la alerta de huérfanos |
| Cotización aprobada | Proyecto | **Trigger automático** ✅ | ya está |
| Encuesta respondida | Cierre de proyectos | **Trigger automático** ✅ | ya está |
| Ingreso/egreso confirmado | Asiento contable | **Trigger automático** ✅ | ya está |

---

## Candidatos para IA (con lo que ya está montado)

**Vale la pena — hay un juicio que una regla no hace:**

1. **Detectar el duplicado *antes* de guardar, en la carga por foto.** `/api/ocr/comprobante` ya extrae CUIT, tipo y número. Falta que el front consulte si existe y avise en el mismo formulario que el humano confirma. **La IA no decide: extrae, y una consulta SQL exacta decide.** El caso de los 3 duplicados habría muerto en el paso de confirmación.
2. **Modo nuevo en el digest: "cierre de evento".** `crm-digest.js` ya tiene 3 modos sobre Claude Haiku 4.5; sumar un cuarto es una función de prompt, cero infra. Le das la planilla de costos, la ganancia, las novedades y el NPS → sale la retrospectiva. **Es el primer ladrillo concreto del "cerebro MEPEX" y llega gratis con lo que ya corre.**
3. **Borrador del reclamo de cobranza.** Cuota vencida hace 114 días por $4M: el mismo `redactar_respuesta` que ya escribe el próximo mensaje al cliente. **Borrador al composer, jamás auto-envía** — igual que el Copiloto hoy.

**No vale la pena — una regla simple alcanza y es auditable:**

- **Clasificar la categoría del gasto** → `GASTO_DOMINIO` ya garantiza enum válido. Cambiar algo determinista por algo que hay que revisar.
- **Detectar duplicados** → un `UNIQUE INDEX` los **previene**, que es mejor que detectarlos.
- **Priorizar tareas / decidir destinatarios** → `resolverDestinatarios` + la matriz ya lo resuelve, **y es explicable**: cuando alguien pregunta "por qué me llegó esto" hay respuesta.
- **Estimar precios o recalcular costos** → la fuente de verdad es `calcular_receta`, determinista. Poner IA cerca del precio es exactamente lo que el diseño de snapshots vino a evitar.
- **Resumir qué pasó en el taller** → el estado ya está en `estado_taller` + `completitud_pct` + checklist. No hay texto que resumir.

---

## Automatizaciones que **NO** recomiendo

- **Auto-recalcular recetas cuando cambia un insumo.** Es la trampa obvia y va **contra una decisión tomada a propósito**: los snapshots existen para que mover `hora_taller` no dispare cambios silenciosos en 200 items. Marcar y avisar, sí. Recalcular solo, no.
- **Auto-emitir las facturas de las cuotas.** El CAE es irreversible y anularlo es una NC. El lote de Recurrentes ya nace con los checks **apagados** por esta razón exacta; no la contradigamos desde otro lado.
- **Auto-cerrar proyectos porque el evento terminó.** Un stand puede seguir abierto con motivo. Cerrarlo por fecha es perder la única señal de que quedó algo sin hacer.
- **Notificar cada cambio de estado.** Sería una fila de `notifications` por click. La campanita tiene 20 filas en total hoy; el día que tenga 200 nadie la mira más y se lleva puestos los avisos que sí importan.
- **Avisar por push todo lo automático.** Hoy el push llega a 4 dispositivos, **los 4 de superadmins**: un push "automático" es un push a Fede. Hasta que taller y pm estén suscriptos, el push va solo donde ya está racionado.
- **Instalar `pg_cron` para lo que `alertas.js` ya hace cada 5 min.** Duplicaría el reloj y partiría la lógica en dos lugares.
- **Auto-crear casos de CRM desde cada WhatsApp entrante.** El número todavía no está conectado (`wa_eventos`: 0 filas). Cuando esté, el matcheo por teléfono pega contra el bug de columnas rotadas de `clientes` — **eso se diseña con la data en la mano, no antes**.
- **Alerta de egresos pendientes por monto.** Ya descartada por ruidosa, y hoy hay **1 egreso pendiente de $97**. Un aviso que dispara por eso enseña a ignorar los avisos.

---

# PARTE 2 — FLUJO Y REDUCCIÓN DE CLICS

## Fricción del TALLER (Diego, Juan, Carlos, Willy)

> Gente de edad media/avanzada, poco tecnológica. Regla del proyecto: cero fricción, auto-derivado > formularios, 1-2 pasos máximo.
> Navegación base en celular: **3 taps** para cualquier módulo (☰ → acordeón de categoría, que arranca cerrado → ítem). Las Quick Actions son la excepción: 2 taps.

| Flujo | Hoy | Posible |
|---|---|---|
| Ver qué armar | 0 (pero sin filtrar por persona) | 0 + míos arriba |
| Abrir un stand | 2 (y aterrizás mal, en `#tareas` genérico) | **1** |
| Marcar un paso del checklist | **imposible** (C8) | **1** |
| Marcar un stand listo | 4 + bloqueado por lo anterior | **1** |
| Sacar foto del armado | **6** | **1** |
| Reportar un problema / falta de material | **imposible** (A23) | **1** |
| Entrega firmada | **7** + 15 ítems tipeados en tablet | **2** + 0 tipeados |

**Los dos cambios de mayor palanca:**
1. **Meter checkboxes + 📷 + ⚠️ en la bigcard del Lobby** (`lobby.js:981-990`). Los datos ya están en memoria (`getChecklistsBulk` en `:984`). Convierte el Lobby del taller de tablero informativo en superficie de acción.
2. **Para `role === 'taller'`, la ficha arranca en Producción con 4 tabs** (`proyecto-detalle.js:102`). Un tap menos en **cada** flujo, gratis.

**Lo que ya está bien hecho y no hay que tocar:** `capture="environment"` abre la cámara trasera directo · compresión a 1600px/JPEG 0.82 antes de subir · nombre de archivo autogenerado (cero campos) · el botón de estado progresivo (`Empezar armado` → `Marcar listo` → `Despachar`) sin confirmaciones de más · marcar una tarea hecha es **1 clic** · la Lista se fuerza en mobile · los empty states de Entrega están entre los mejores del repo · la Quick Action "🛒 Pedir compra" (2 taps, 1 textarea con placeholder concreto) **es el patrón a copiar**.

**Detalles que molestan:** la barra de filtros de Tareas tiene **7 controles** que el taller no necesita · la card tiene hasta **6 botones** (sobran "Tomar" y "Abrir") · el chip de origen imprime el slug crudo · **el empty state dice "corré `sql/fase11_tareas.sql`"** y el Toast de error también — instrucciones de SQL en la cara de Willy · los checkboxes son nativos sin tamaño mínimo (~18px) · `mobile.css` no tiene ni una regla `.pjt-`/`.home-`/`.tar-` (todo el responsive del taller vive inline en cada JS) · hovers con `transform` que en táctil se pegan después del tap · el toolbar de Proyectos le sirve 4 selects + 3 botones de vista, **dos de ellos placeholders "Próximamente"** · se le muestra el NPS completo del cliente, que no le aporta nada operativo.

---

## Flujo 8 — "Cerrar un evento: saber cuánto ganamos"

**Hoy: ≈40 clics · ≈55 campos tipeados · 3 pantallas + 4 modales** (evento típico: 8 jornales + 2 fletes + 3 proveedores + 1 seguro + 2 comidas). **Cero de eso arranca solo.**

**No hay entrada desde la ficha del evento:** `evento_costos` no aparece ni una vez en `eventos.js`, y `eventos.js` no menciona "rendimiento". Hay que ir al Lobby → card Rendimiento → elegir el evento.

**La fórmula:** `ganancia = cobrado − costos − materiales`. **`facturado` NO entra** — se calcula y se muestra como KPI, pero es decorativo.

| Componente | Fuente | ¿Entra solo? |
|---|---|---|
| `cobrado` | ingresos con `evento_id` confirmados | sí |
| `facturado` | comprobantes de los proyectos | sí, **pero no suma** |
| `costos_planilla` | `evento_costos` | **manual** |
| `costos_directo` | egresos con `evento_id` no linkeados | **sí, entran solos** |
| `materiales` | `evento_rendimiento.materiales_manual` | **100% a mano** |

> Los gastos cargados en Finanzas con `evento_id` **sí entran solos** al dashboard (bien deduplicados), **pero no aparecen en la planilla** — recién los ves en el modal de cierre como "Ya cargado en Finanzas para este evento". **Sorpresa al final.**

**Nada avisa que faltan cargar costos:** `alertas.js` tiene 18 generadores y **ninguno es `rendimiento` ni `costos`**. Grep de "rendimiento" en `alertas.js`/`notifications.js`/`tareas.js`: **0 hits**.

**Top 3 fricciones:**
1. **~200 líneas de UI de pagos son código muerto e inalcanzable** (`_openPayModal`, `_openBulkPayModal`, `_openPagosModal`, la paybar) porque `this._selected` **nunca se llena**. Consecuencias reales: no se puede ver el historial de pagos de una línea, no se puede anular un pago, y no se puede pagar con factura/IVA desde Rendimiento. La única vía es el toggle, que **ni siquiera genera egreso**.
2. **El botón de sync es un acto de memoria.** El puente ya es idempotente y seguro; el único motivo para que sea manual es que **nadie lo enganchó a `_loadEvento`**.
3. **El cierre es un loop serial sin red:** `for` con `await` por línea, sin barra de progreso, sin transacción. Si falla en la mitad, `cerrarEventoRendimiento` corre igual (está **fuera** del try) → evento cerrado con la mitad migrada. Y reabrir no des-migra nada.

**Ya existe y lo automatizaría:** `API.syncJornalesEvento` (llamarla en `_loadEvento` si el evento no está cerrado — el botón sobra) · `API.getEgresosSueltosEvento` (ya calcula los egresos sin conciliar; como banner en la planilla mata la sorpresa) · `API.crearCostoDesdeComprobante` (existe, funciona, y solo lo llama `carga-comprobante.js`) · `evento_rendimiento.cerrado_at` + `eventos.fecha_evento_inicio` alcanzan para una alerta "evento terminado hace N días, rendimiento sin cerrar".

---

## Flujo 9 — "Insumo nuevo con costo → precio de las recetas"

**Alta: ~6 clics + 12 campos, repartidos en 1 modal + 1 panel.** Los overrides (VU / % reacond / % desperdicio) **no están en el alta**: hay que crear el insumo, abrir la ficha, desplegar un colapsable cerrado por default y llenar 3 inputs.

**Propagar el costo a 40 recetas — tres caminos, ninguno bueno:**

- **Camino A (el que la UI te empuja): 4 clics, resultado incorrecto.** La cascada usa el **motor JS**, no la RPC → las 40 recetas quedan con precio distinto del que daría "Recalcular" y con el ⚠ *"sin snapshot"*. **El sistema te avisa que la receta está desactualizada justo después de haberla actualizado.**
- **Camino B (dejar todo bien): 7 clics, pero recalcula TODO el catálogo** — y solo si sos superadmin. **No existe un "recalcular con RPC solo estas 40".**
- **Camino C (receta por receta con la RPC): ~120 clics.** Y cada recálculo dispara `_refreshData()` → `_loadAllRecetaStatuses()`, que hace un SELECT de `receta_componentes` **entera**. 40 veces.

**Los tres indicadores de desfase y por qué ninguno sirve:**
1. **● "desfasado"** compara los 3 parámetros globales contra los snapshots. **No mira insumos** → si sube el costo de un insumo, no se prende nunca.
2. **● "pendiente de recalcular"** del recibo sí compara costo MP vivo vs cacheado — **pero solo al abrir la ficha** de esa receta. Sin lista, sin contador, sin badge.
3. **Botón turquesa → naranja** es **in-memory de la sesión del panel**. Cerrás y reabrís la ficha → se apaga aunque no hayas recalculado. **No persiste nada.**

**Bonus verificados:** ✅ **hay historial de precios** (`insumo_precio_historial`, se lee en la ficha con variación % coloreada y motivo). ❌ **No se puede actualizar el costo desde una factura de compra** — `recibirOrdenCompra` **nunca toca `costo_unitario`**, y el `precio_unitario` de la OC ya está persistido y muere ahí.

**Fricción extra:** cambiar `tipoAmortizacion` desde el popover cambia la VU efectiva → cambia el costo por uso de todas las recetas que lo usan → **cero cascada, cero aviso** (y está documentado como intencional, aunque el texto de la ficha diga lo contrario).

---

## Doble tipeo y listas sin acción rápida

**El insumo se crea en un solo lugar** (bien). **El doble/triple tipeo está en compras:**
1. Ítem de la OC: **texto libre**.
2. Recepción: hay que **volver a escribir el mismo insumo** en otro input para poder linkearlo.
3. El match es por nombre exacto en minúsculas → **si no matchea, `insumo_id: null` → no suma stock, y no avisa** (el toast dice "Recepción registrada" igual).
4. Y el costo, otra vez a mano en Costos.

| Tabla | Editable inline | Requiere abrir ficha |
|---|---|---|
| **Insumos** | costo, clasificación, categoría, tipo amort. | VU efectiva, overrides, notas, proveedor |
| **Recetas** | **solo rubro** | MO, costo fab., costo/uso, **precio** |
| **Listas de Precio** | solo toggle cotizable | precio y antigüedad read-only, **sin botón recalcular en la fila** |
| **Planilla Rendimiento** | solo toggle pagado | **el monto** — hay que abrir un modal de 6-9 campos para cambiar un número |
| **Catálogo Rendimiento** | nada | tarifa read-only |

**Filtros que no persisten — con un bug fantasma:** cero `localStorage` en `costos.js`/`inventario.js`. Al volver al módulo, `render()` reconstruye el input de búsqueda **sin `value`** pero `this._searchQuery` conserva el texto → **la tabla queda filtrada por un término que no se ve en ningún lado.** Y `_clearFilters()` solo vacía el DOM, no el estado.

---

## Por dónde empezar

**Las tres primeras son un día de trabajo entre las tres:**

1. **Candado de duplicados** (S) — previene plata inventada, tiene data hoy.
2. **`ultimo_contacto` + `fecha_evento`** (S cada uno) — dos triggers que **encienden 5 consumidores muertos**.
3. **Cuotas de cobranza** (S) — $34M sin facturar.
4. Cargar `costo_dia_referencial` en RRHH → **y recién ahí** el puente de jornales (M) — 21 asignaciones esperando.
5. Marcado de recetas desfasadas (M).
