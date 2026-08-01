# Lista de decisión — agregados, ideas y automatizaciones

> **Esto no se ejecuta hasta que Fede lo marque.** A diferencia de las correcciones (que van en orden en `05-EJECUCION.md`),
> acá cada ítem es una decisión de producto: qué conviene, qué molesta, qué sobra.
>
> **Cómo marcar:** poné `SÍ`, `NO` o `DESPUÉS` en la columna. Alcanza con decirme "van A1, A3, D2, D5…" y yo lo vuelco acá.

**Esfuerzo:** S = menos de 1h · M = 1-4h · L = más de 4h
**Todos los números son de producción, verificados el 31/07.**

---

## A · Automatizaciones — que el sistema haga solo lo que hoy depende de que alguien se acuerde

| ID | Qué hace | Esf. | Lo que lo justifica hoy | ¿Va? |
|---|---|---|---|---|
| **A1** | **Tarea derivada cuando una cuota llega a su fecha de facturar** + alerta para las cuotas **sin fecha**, que son plata que el motor no puede reclamar nunca | S | **$34.000.000** en 8 cuotas sin facturar · 7 sin fecha ($30M invisibles) | |
| **A2** | **Candado al comprobante de proveedor duplicado** — índice único + aviso antes de guardar. El OCR ya extrae CUIT, tipo y número | S | La misma factura **×3** = $151.200 de IVA crédito inventado | |
| **A3** | **Marcar el evento como "gente asignada sin costear"** cuando cambian las asignaciones, con alerta + tarea a un clic. *(Marca, no ejecuta — barrer líneas automáticamente es riesgoso)* | M | **21 asignaciones de eventos terminados sin jornal.** Campana: 20 personas, 0 jornales | |
| **A4** | **El evento termina → tarea "mandar la encuesta"** con el link ya armado. El resto de la cadena **ya es automático y funciona** | M | **4 de 6** proyectos con el evento terminado siguen abiertos (uno hace 72 días) | |
| **A5** | **Marcar la receta como desfasada** cuando cambia un insumo, en cascada por el BOM. *(Marcar, NO recalcular — los snapshots existen a propósito)* | M | **16 de 28** recetas con un insumo tocado después de su snapshot | |
| **A6** | **Escribir `clientes.ultimo_contacto`** desde los mensajes del CRM + backfill acotado | S | NULL en **265 de 265** → enciende 2 widgets del lobby y 1 alerta hoy ciegos | |
| **A7** | **Derivar `cotizaciones.fecha_evento`** del evento vinculado | S | 14 de 18 tienen evento, **0 de 18** tienen la fecha → enciende 1 alerta + 1 tarea imposibles | |
| **A8** | **Recibir una OC actualiza el costo del insumo** + historial con motivo "OC ####" | S | Hoy hay que ir a Costos y tipearlo a mano. `fecha_ultimo_precio` NULL en los 80 pese a 41 cambios registrados | |
| **A9** | **Pedir el subalquiler a 14 y 5 días del armado** — tarea por proveedor. **Falta solo el reloj**: la función y el PDF ya existen | M | **1.277 unidades** en 4 eventos · 177 sin fecha porque su cotización no tiene evento | |
| **A10** | **Panel de salud contable** — 4 chequeos con semáforo en Contabilidad → Reportes (desbalanceados, drift de saldos, arrastre roto, movimientos sin asiento) | M | Los dos críticos contables **habrían aparecido solos el día que se produjeron** | |
| **A11** | **Rutina trimestral de revisión de precios de insumos.** Es literalmente un INSERT — la infra de rutinas ya está entera | S | **63 de 80** insumos sin cambio de precio hace más de 90 días | |
| **A12** | **Card "N avisos apagados por falta de dato"** en el lobby admin, con el desglose y el link a dónde cargarlo | S | 9 columnas vacías dejan mudas 6 alertas, 4 tareas derivadas y 3 widgets | |
| **A13** | **Alerta de caso de CRM enfriándose** (hoy solo hay un chip que exige abrir el CRM) | S | 4 casos vivos: **3 sin mensaje hace 28, 45 y 45 días**; los 4 sin próxima acción | |
| **A14** | **Tarea "N personas sin la app instalada"** con el link a la guía | S | 4 suscripciones de push, **las 4 de 2 superadmins**. Taller: cero. PM: cero | |

---

## B · Plata — Finanzas, Ventas, Cobranza

| ID | Qué hace | Esf. | Lo que lo justifica | ¿Va? |
|---|---|---|---|---|
| **B1** | **Cobrar desde la ficha de la venta.** Hoy no hay botón, aunque `cobranza.js` promete que se abre desde ahí. Cierra el circuito donde se ve el saldo, en vez de ir a Finanzas y elegir cliente a mano | M | `Cobranza.renderInto` ya existe | |
| **B2** | **Derivar `en_curso`/`cerrada` en vez de guardarlos.** Hoy son estados muertos: la UI los pinta y filtra, nadie los escribe → el KPI "Confirmadas" cuenta ventas ya terminadas | S | 0 ventas pueden llegar a esos estados | |
| **B3** | **Chip de venta en la ficha del proyecto y del cliente.** `proyectos.venta_id` existe y nadie lo lee; `getVentasByCliente` existe y nadie la llama | M | Hoy son 3 pantallas para saber "¿de qué venta salió esta carpeta?" | |
| **B4** | **Aviso de venta confirmada** a admin+superadmin. Es el momento exacto en que nace la deuda | S | Hoy Sofi se entera de casualidad | |
| **B5** | **Semáforo "proyecto en producción sin seña cobrada".** Toda la data está: `senaCobrada` ya se calcula | M | El aviso operativamente más útil del blueprint, y no se muestra en ningún lado | |
| **B6** | **Recibo de cobranza en PDF.** El objeto ya tiene todo (facturas aplicadas, medios, retenciones) y hay 6 generadores de patrón | M | Sofi lo arma a mano cada vez que un cliente lo pide | |
| **B7** | **"8 cuotas facturables sin factura, $34M" como fila del Panel**, con un clic al wizard de Emitir precargado | S | Es la lista de trabajo de facturación del mes | |
| **B8** | **La NC como acción de la factura**, no como comprobante suelto: "Anular con NC" precargando tipo, importes y asociación, y guardando el vínculo | M | Hoy la NC queda desconectada de lo que anula | |
| **B9** | **Autocompletar el comprobante recibido desde el CUIT.** El padrón AFIP ya está enchufado y andando para la emisión | S | Hoy `proveedor_id` nunca se setea por el camino del OCR | |
| **B10** | **Campo Evento en los modales de Ingreso y Egreso.** Sin esto, un gasto cargado a mano nunca puede imputarse a un evento | S | El puente Finanzas→Rendimiento solo funciona para lo que entra por OCR/OC | |
| **B11** | **Sacar el botón "Eliminar" de ingresos y egresos.** El circuito ya tiene la salida correcta (anular, con traza); ese botón es **la única forma de dejar un asiento huérfano** | S | Elimina una clase entera de bugs sin escribir lógica nueva | |
| **B12** | **Conciliación libro IVA ↔ cuenta contable** — una tercera tarjeta en Posición IVA con la diferencia y el detalle | S | Brecha de $151.200 (crédito) y $173,55 (débito) que hoy parece un error | |
| **B13** | **Deduplicar los dos pagadores de vencimiento** (`finanzas.js` y `calendario-adm.js` son el mismo formulario escrito dos veces, y ya divergen) | S | 0 filas hoy → **es el momento barato**, antes de que se cargue data | |

---

## C · Operaciones — Eventos, Proyectos, Rendimiento

| ID | Qué hace | Esf. | Lo que lo justifica | ¿Va? |
|---|---|---|---|---|
| **C1** | **"Fechas y horarios" de solo lectura cuando el evento tiene jornadas**, con un botón "Editar jornadas" en su lugar | M | Hoy dos formularios escriben las mismas 4 columnas y uno le gana al otro en un momento impredecible. **Es la raíz de la mitad de los cortes de cable** | |
| **C2** | **Derivar la fecha de la asignación de su jornada** en vez de copiarla | M | 10 asignaciones fuera de rango hoy. Mata la clase entera de bug | |
| **C3** | **Chip "desfasado" en la ficha del evento** — asignaciones fuera de ventana, transportes en días que ya no existen, jornales en $0, stands sin remito | M | Mismo patrón del chip "listo para salir" de Proyectos, que ya funciona | |
| **C4** | **Prefill de fecha en el modal de transporte** según la fase + avisar cuando la fecha del evento se mueve | M | El camión queda reservado el día viejo y aparece en "Salidas de hoy" | |
| **C5** | **"Traer la misma gente del evento anterior"** — la versión entre eventos del botón que ya existe para el armado | M | Ahorra ~80% del tildado cuando son 12 personas × 5 jornadas | |
| **C6** | **Sync de jornales automático al abrir Rendimiento** (el botón "Traer de asignaciones" sobra: la función ya es idempotente y segura) | S | Hoy es un acto de memoria | |
| **C7** | **Banner de "egresos ya cargados en Finanzas"** en la planilla, no recién en el modal de cierre | S | Hoy es una sorpresa al final. `getEgresosSueltosEvento` ya lo calcula | |
| **C8** | **Alerta "evento terminado hace N días, rendimiento sin cerrar"** | S | `alertas.js` no tiene ni un generador de `rendimiento` ni de `costos` | |
| **C9** | **Decidir qué es "✓ Pagado" en Rendimiento**: o es un flag de planilla y la UI lo dice, o se cablea el modal de pago que hoy es inalcanzable | M | Finanzas no se entera de un peso hasta que alguien cierra el evento | |
| **C10** | **Unificar el vocabulario de fases** (`evento`/`funcionamiento`/`intermedio` para lo mismo, en 3 tablas) | M | Hoy funciona con dos traducciones separadas; cualquier join futuro falla en silencio | |

---

## D · Taller — reducción de clics para Diego, Juan, Carlos y Willy

| ID | Qué hace | Esf. | Hoy → posible | ¿Va? |
|---|---|---|---|---|
| **D1** | **Checkboxes del checklist en la card del Lobby.** Los datos ya están en memoria | M | marcar un paso: **imposible → 1 tap** | |
| **D2** | **Botón 📷 en la card del Lobby**, reusando la compresión que ya existe | M | sacar foto: **6 taps → 1** | |
| **D3** | **Botón ⚠️ "Reportar problema"** — modal clon del de Pedir compra, que ya está muy bien hecho | M | reportar: **imposible → 1 tap + 1 frase** | |
| **D4** | **La ficha arranca en Producción con 4 tabs** para el rol taller | S | **un tap menos en todos los flujos**, gratis | |
| **D5** | **"Míos" arriba en la lista de stands** (hoy los 4 ven la misma lista de 12 y nadie sabe cuál es suyo) | M | 0 clics, solo orden | |
| **D6** | **Prellenar los ítems de la entrega** desde el checklist o una RPC sin precios | M | **45 taps y 15 descripciones tipeadas en tablet → 0** | |
| **D7** | **"✍️ Entregar" en la card** cuando el stand está despachado | S | entrega: **7 taps → 2** | |
| **D8** | **Toolbar de Proyectos reducido** para taller (hoy 4 selects + 3 botones de vista, dos de ellos "Próximamente") | S | media pantalla de ruido antes de la primera card | |
| **D9** | **Filtros de Tareas reducidos** para taller (hoy 7 controles) + card con 2 botones en vez de 6 | S | | |
| **D10** | **Sacar las instrucciones de SQL de la cara del usuario** — el empty state dice *"corré sql/fase11_tareas.sql"* | S | Willy lee eso | |
| **D11** | **Checkboxes de 44px** y fila entera clickeable (hoy son nativos de ~18px, y es la interacción más repetida del día) | S | | |
| **D12** | **Push cuando la novedad para taller es crítica** (hoy el fan-out nunca llama al push → el celular no suena) | S | 1 línea | |
| **D13** | **Ocultar el NPS del cliente** al rol taller (no le aporta nada operativo y puede ser incómodo) | S | | |

---

## E · Costos e Inventario

| ID | Qué hace | Esf. | Lo que lo justifica | ¿Va? |
|---|---|---|---|---|
| **E1** | **Badge "precio vencido" calculado**, comparando `precio_alquiler` contra la RPC. Reemplaza al `●` actual, que compara lo que no importa | M | Detectaría los 17 al toque, incluido el cotizable de −$40.240 | |
| **E2** | **Recalcular al guardar** en vez de marcar dirty en el DOM | S | Saca al humano de la ecuación y cierra el agujero del ítem 89 | |
| **E3** | **KPI "27 de 226 ítems tienen receta"** + filtro "sin receta" en el tab Recetas | S | Convierte 199 ítems invisibles en una cola de trabajo | |
| **E4** | **"Cotizable" exige receta y precio recalculado** (guard o CHECK) | S | Hoy da la casualidad de que los 9 cumplen; nada lo garantiza | |
| **E5** | **Stock mínimo por defecto según el tipo de amortización** — llena las 80 filas de una y enciende el trigger que ya está escrito | S | | |
| **E6** | **Dejar que el taller registre movimientos de inventario** (hoy es solo-lectura para pm y taller → Diego saca 20 placas y no tiene dónde anotarlo) | S | **Decisión de producto.** Explica por qué los movimientos se cortaron en abril | |
| **E7** | **Cablear o sacar el botón "Registrar movimiento"** del panel del ítem (hoy es un stub con "próximamente") | S | El usuario aprieta el botón obvio y concluye que el módulo no anda | |
| **E8** | **Decidir el dueño de `locaciones_stock`** — hoy Locaciones dice que lo gestiona Inventario e Inventario solo hace SELECT | M | "Stock por locación" va a estar vacío para siempre | |
| **E9** | **Numerador atómico de OC** (reusar el patrón de cotizaciones) | S | `OC-0001` ya se duplicó una vez | |
| **E10** | **Match de insumo por id, no por nombre exacto** en la recepción de OC | M | Hoy si no matchea: `insumo_id: null`, **no suma stock, y el toast dice "Recepción registrada" igual** | |

---

## F · Sistema nervioso — notificaciones y tareas

| ID | Qué hace | Esf. | Lo que lo justifica | ¿Va? |
|---|---|---|---|---|
| **F1** | **Jerarquía de roles en `resolverDestinatarios`** (que `['admin']` expanda a admin+superadmin, como ya hace la RLS) | S | Hoy cada emisor lo nombra a mano y **ya falló en 3 de 7** | |
| **F2** | **Constantes de tipo** exportadas, para que sea imposible emitir un tipo sin catalogar | S | Hoy el drift se detecta recién cuando ya llegó a producción | |
| **F3** | **Test de humo del sistema nervioso** — cuántas filas matchea hoy cada generador. Un generador en 0 por 30 días es casi siempre un bug | M | 3 alertas y 1 tarea derivada son **estructuralmente imposibles** hoy | |
| **F4** | **"Resumen del día" a las 8:00** — una sola notificación por persona con lo que le toca, en vez de N avisos sueltos | M | Reduce ruido y da canal natural a todo lo que hoy es alerta que nadie mira | |
| **F5** | **Purga de notificaciones leídas** > 90 días + contar no-leídas server-side | M | Hoy el contador se deriva de una página de 20 → subcuenta | |
| **F6** | **Depurar los 7 superadmins** (`active=false` a los de prueba) | S | Cada aviso que nombra superadmin escribe **7 filas** | |

---

## G · Plataforma e infraestructura

| ID | Qué hace | Esf. | Lo que lo justifica | ¿Va? |
|---|---|---|---|---|
| **G1** | **`deploy.sh` versionado** que haga los 5 pasos con `set -e` y verifique | M | Hoy el orden vive en prosa repartida en 3 documentos. **Elimina de raíz la clase de bug del push sin deployar** | |
| **G2** | **Endpoint `/api/version`** que devuelva el HEAD del repo **y** el hash de lo copiado en `/home/mepex/api/` | S | El desfase se ve de un vistazo en vez de deducirse por arqueología de commits | |
| **G3** | **Budget cap mensual** en la cuenta de Anthropic para la key del VPS | S | Última recomendación abierta de la auditoría de Jordi | |
| **G4** | **Comprimir la imagen del OCR en el cliente** + recortar el prompt del CRM | S | Baja costo de IA **y** arregla el OCR que hoy no funciona con fotos de celular | |
| **G5** | **Apagar el listado de los 3 buckets públicos** | S | Los nombres de archivo cantan cliente y evento: *"Propuesta - Aguila - Expo Hobby.pdf"* | |
| **G6** | **Sacar `modules.js` de la carga** (4.321 líneas, 212 KB, sin una sola ruta que lo alcance) | S | **Una línea.** La mitad del peso muerto del proyecto | |
| **G7** | **Barrido de los 78 métodos muertos de `api.js`** y las 861 clases de CSS sin emisor | M | ~411 KB. **Ojo con los restos asimétricos** (`compras_pagos` muerta en Compras y viva en Alertas) | |
| **G8** | **Unificar los 7 cargadores de logo para PDF** y los 20 formateadores de moneda (hoy la misma venta se lee distinto en la lista que en su ficha) | M | | |
| **G9** | **Índice en `egresos.evento_id`** | S | El único hueco de índice con impacto real: seq scan en cada apertura de Rendimiento | |
| **G10** | **Ordenar `sql/`** — archivar los 6 que mienten y adoptar una convención | M | `fix_trigger_asiento_auto.sql` describe un schema que no existe y **engaña a cualquiera que busque "cómo se genera el asiento"** | |

---

## H · Ideas grandes — no se deciden hoy, se anotan

| ID | Qué es | Nota |
|---|---|---|
| **H1** | **Modo "cierre de evento" en el digest de IA** — le das la planilla, la ganancia, las novedades y el NPS, y sale la retrospectiva | Es una función de prompt, cero infra. **El primer ladrillo concreto del "cerebro MEPEX"**, gratis con lo que ya corre |
| **H2** | **Detección de duplicado en la carga por foto** — la IA extrae, una consulta SQL exacta decide | El caso de los 3 duplicados habría muerto en el paso de confirmación |
| **H3** | **Borrador del reclamo de cobranza** con el mismo `redactar_respuesta` del Copiloto | Borrador al composer, **jamás auto-envía** |
| **H4** | **Leer `cotizacion_items` estructurada** en vez de parsear el texto del PDF | Ya está marcado como la integración a priorizar. Además el importador actual **borra los ítems del cotizador** |
| **H5** | **Inventario en vivo** — disponibilidad por solapamiento de fechas, no stock que se agota | Visión ya anotada en memoria. Feature grande |

---

## Lo que **NO** recomendamos construir

> Estas están acá para que no se propongan de nuevo dentro de tres meses.

| Qué | Por qué no |
|---|---|
| Auto-recalcular las recetas cuando cambia un insumo | Va **contra una decisión tomada a propósito**: los snapshots existen para que mover un parámetro no dispare cambios silenciosos en 200 ítems |
| Auto-emitir las facturas de las cuotas | El CAE es irreversible. El lote de Recurrentes ya nace con los checks **apagados** por esta razón exacta |
| Auto-cerrar proyectos porque el evento terminó | Un stand puede seguir abierto con motivo. Cerrarlo por fecha **pierde la única señal** de que quedó algo sin hacer |
| Notificar cada cambio de estado | Sería una fila por click. La campanita tiene 20 filas hoy; con 200 nadie la mira y se lleva puestos los avisos que sí importan |
| Avisar por push todo lo automático | Hoy el push llega a 4 dispositivos, **los 4 de superadmins**: un push "automático" es un push a Fede |
| Instalar `pg_cron` para lo que `alertas.js` ya hace cada 5 min | Duplicaría el reloj y partiría la lógica en dos lugares. Solo se justifica para algo que corra **con la app cerrada** |
| Auto-crear casos de CRM desde cada WhatsApp entrante | El número no está conectado todavía, y el matcheo por teléfono pega contra el bug de columnas rotadas. **Se diseña con la data en la mano** |
| Alerta de egresos pendientes por monto | Ya descartada por ruidosa, y hoy hay **1 egreso pendiente de $97**. Un aviso que dispara por eso enseña a ignorar los avisos |
| IA para clasificar gastos, priorizar tareas o estimar precios | Hay reglas deterministas y auditables para las tres. Poner IA cerca del precio es **exactamente lo que el diseño de snapshots vino a evitar** |

---

## Resumen para decidir rápido

**Si querés lo de mayor retorno con menos riesgo, este es el corte:**

- **Las 5 de un día entre todas:** A2 (candado de duplicados) · A6 + A7 (dos triggers que encienden 5 pantallas muertas) · A1 (los $34M sin facturar) · E2 (recalcular al guardar)
- **Las que le cambian el día al taller:** D1 + D2 + D3 en la misma card del Lobby
- **La que evita el próximo susto:** A10 (panel de salud contable) — los dos críticos contables habrían aparecido solos
- **La que evita el próximo "pulleé y sigo viendo lo viejo":** G1 (`deploy.sh`)
