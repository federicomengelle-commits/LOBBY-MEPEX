# Mapa de cableado — ¿a dónde llega cada dato?

> *"Cuando un dato se mueva en un lado, que efectivamente llegue a todos los lugares que corresponda."*
> Esta es la respuesta. **Cada fila fue verificada contra el código y contra producción.**

**Leyenda:** ✅ llega · ⚠️ llega a medias · ❌ **no llega** · 🔒 llega, pero de más (rompe algo)

---

## 1 · CIRCUITO COMERCIAL — del lead a la venta

| Cuando pasa esto… | Debería llegar a… | | Por qué |
|---|---|:-:|---|
| Entra un caso nuevo al CRM | `crm_casos`, bandeja, pipeline, `audit_log` | ✅ | |
| ídem | **aviso a Noe (comercial)** | ❌ | El aviso apunta al rol `venta` y **en prod no existe ningún perfil con ese rol** — Noe es `admin`. La lista de destinatarios queda vacía y `avisar` sale sin escribir nada, sin error |
| ídem | `clientes.ultimo_contacto` | ❌ | Nadie escribe esa columna. **NULL en las 265 filas** |
| Mensaje nuevo en el caso | `clientes.ultimo_contacto` → widgets del lobby | ❌ | Ídem. 2 widgets y 1 alerta permanentemente vacíos |
| Caso cambia de estado | `audit_log`, `crm_mensajes`, bandeja, pipeline | ✅ | |
| ídem (ganado / perdido) | notificación a alguien | ❌ | `_changeCasoEstado` no llama `avisar` |
| Cotización pasa a `aprobada` | proyecto + `cotizaciones.project_id` | ✅ | update atómico |
| ídem | **el caso vinculado y su estado** | ❌ | El modal no toca `crm_casos`: el caso puede seguir en "cotizado" con la cotización ya aprobada |
| ídem | aviso a quien la vendió | ⚠️ | Va a `venta`+`superadmin` → llega a los 7 superadmins, **no a Noe** |
| Se re-cotiza con otro monto | `ventas.total` de la venta que la apunta | ❌ | Es un snapshot. En prod ya hay una ficha que muestra "Total $23.974.904" y tres centímetros abajo "COT-2026-0026 · $26.372.394", **sin marca de desactualizado en ninguno de los dos** |
| Confirmar venta | número VTA, `audit_log` | ✅ | compare-and-swap contra `borrador` |
| ídem | `crm_casos.venta_id` | ✅ | |
| ídem | `proyectos.venta_id` | ⚠️ | Solo si el proyecto ya existía. **Si nace después, nadie lo engancha** |
| ídem | aviso a Sofi / finanzas | ❌ | `confirmarVenta` no llama `avisar` |
| ídem | ficha del proyecto · ficha del cliente | ❌ | `proyectos.venta_id` existe y **nadie lo lee**; `getVentasByCliente` existe y **nadie la llama** |
| Armar plan de cobro **desde la ficha de la venta** | subtab Planes de Finanzas | ✅ | |
| Armar plan **desde Finanzas** | ficha de la venta | ❌ | El modal de Finanzas **nunca manda `venta_id`** → la venta sigue mostrando "Armar plan" como si no tuviera |
| Anular venta | plan de cobro y sus cuotas | ❌ | Solo escribe estado y motivo |
| ídem | alerta "cuotas vencidas" | ❌ | La alerta no hace join a ventas → **sigue reclamando plata de una venta que ya no existe** |
| ídem | volver a ofrecer "Confirmar venta" en el caso | ❌ | El gate mira `caso.venta_id` sin filtrar anuladas → **el caso queda sin forma de generar una venta correcta** |

---

## 2 · CIRCUITO DE LA PLATA — cobro, pago, contabilidad

| Cuando pasa esto… | Debería llegar a… | | Por qué |
|---|---|:-:|---|
| Ingreso pasa a `confirmado` | asiento automático balanceado | ✅ | 7 confirmados, 0 sin asiento |
| Egreso pasa a `pagado` | asiento automático balanceado | ✅ | 6 pagados, 0 sin asiento |
| Egreso con comprobante | 3ª línea de IVA crédito | ✅ | split proporcional |
| Ingreso con comprobante | 4ª línea de IVA débito | ✅ | |
| Ingreso con retenciones | líneas `1.1.11`–`1.1.14` | ✅ | y **falla cerrado** si falta la cuenta |
| Cobro **sin** factura | `2.1.06 Anticipos` (pasivo) | ✅ | criterio correcto |
| Cheque / e-cheq | `1.1.07`/`2.1.07` + clearing | ✅ | |
| Transferencia interna | asiento automático | ⚠️ | hardcodea canal `'oficial'` y usa `monto` en vez de `total_en_ars` |
| **Registrar cobranza con retenciones** | asiento balanceado, crédito fiscal, libro | ✅ | |
| ídem | **`plan_cobro_items.monto_cobrado` / estado** | ❌ | Las aplicaciones se arman **sin `plan_cobro_item_id`** → el trigger corta en la primera línea. La cuota sigue en "pendiente", la venta muestra Cobrado $0, y la alerta sigue reclamando |
| Cobrar una cuota desde Finanzas | `monto_cobrado`, estado | ✅ | …pero por un camino **incompatible** con el trigger (uno suma, el otro recalcula desde cero) |
| ídem | `cobro_aplicaciones` → saldo de la factura | ❌ | **La factura sigue apareciendo con el saldo entero en Cobranza: riesgo de doble cobro, verificado en prod** |
| "Generar cobro" desde un comprobante | ingreso + asiento + link | ✅ | |
| ídem | saldo del comprobante | ❌ | No inserta aplicación → misma trampa |
| Anular ingreso/egreso | contra-asiento | ✅ | |
| ídem | aplicaciones, retenciones, cuotas, cartera, `evento_costo_pagos`, links | ❌ | **Las funciones de reversa solo copian el asiento invertido.** Las retenciones anuladas siguen entrando a la DDJJ |
| **Editar monto/fecha/canal de un movimiento ya contabilizado** | actualizar su asiento | ❌ | **Ya pasó: un egreso de $486.420 con 2 meses de corrimiento** entre Finanzas y Contabilidad |
| Eliminar (soft) un movimiento | asiento | ❌ | Ningún trigger observa `_deleted` |
| Asiento nuevo en un mes sin actividad previa inmediata | `saldos_mensuales` con arrastre correcto | ❌ | **−$3.200.000 hoy en pantalla** |
| Emitir factura en ARCA | `comprobantes` + CAE | ⚠️ | Si el INSERT falla, **se pierde con toast de éxito** |
| ídem | **asiento devengado** (Deudores + IVA débito) | ❌ | No hay trigger sobre `comprobantes`. *Es la Fase 3 pendiente por diseño* |
| ídem | Libro IVA / posición IVA | ✅ | …pero las NC **suman en vez de restar** |
| Emitir nota de crédito | restar de facturado / IVA / saldo | ❌ | Junio: IVA débito dice **$347,10**, correcto **$0,00** |
| Cargar comprobante por foto (sin pagar) | crédito fiscal en el libro | ✅ | …**y sin guard de duplicado: 3 copias de la misma factura en prod** |
| ídem | `proveedor_id` (ficha del proveedor) | ❌ | manda solo `proveedor_nombre` |
| Egreso/ingreso cargado a mano | imputación al evento (Rendimiento) | ❌ | **Los modales no tienen campo Evento** |
| Marcar vencimiento pagado | egreso + asiento + estado | ✅ | |

---

## 3 · CIRCUITO OPERATIVO — el evento y sus fechas

> **Hay dos formularios que escriben las mismas 4 columnas**, y uno le gana al otro en un momento impredecible: "Fechas y horarios" del panel, y el modal "Editar jornadas" (cuyo trigger recalcula MIN/MAX y **pisa** lo del primero).

| Cambio una fecha de armado… | Debería llegar a… | | Por qué |
|---|---|:-:|---|
| | columna del evento | ✅ | |
| | `fecha_armado_fin` si es de 1 día | ✅ | guard `armadoEsMultiDia` (fix del 30/07) |
| | `fecha_armado_fin` si es multi-día | ⚠️ | queda la ventana vieja **a propósito** → el rango puede quedar invertido |
| | `evento_jornadas` (los días concretos) | ❌ | Y **le van a ganar** al panel en cuanto alguien las toque |
| | `asignaciones_evento` (quién va qué día) | ❌ | **10 asignaciones fuera de rango hoy en prod** |
| | aviso `evento_fecha_cambiada` | ✅ | campanita ✓ · **push en 404** |
| | aviso de solapamiento | ✅ | consulta la base, no el caché |
| | **recordatorio "faltan 7 / 2 días"** | ❌ | **El claim no se resetea → si la fecha se pospone, el aviso no sale nunca más** |
| | alertas de "evento sin stands" / "stands sin terminar" | ✅ | se recalculan solas cada 5 min |
| | tareas derivadas del taller | ✅ | derivadas |
| | Calendario Operativo | ✅ | …salvo offline: cae a un caché de `localStorage` con fechas viejas **sin marca de desactualizado** |
| | `evento_transporte.fecha` (el camión) | ❌ | **El camión queda reservado el día viejo** y aparece en "Salidas de hoy" |
| | `evento_historial` / `audit_log` | ❌ | El log está comentado y el trigger de la base **no está attacheado a ninguna tabla** (y encima está roto). **"¿Quién movió el armado al 17?" no tiene respuesta** |
| **Cambio la fecha de desarme** | `fecha_desarme_fin` | ❌ | El `localStorage` **pisa la columna real** → en ese navegador el desarme se vuelve de 1 día para siempre, **mientras la base dice 2**. Dos personas ven cosas distintas |
| **Muevo un día en "Editar jornadas"** | fechas del evento | ✅ | trigger |
| | aviso de fecha cambiada | ❌ | El trigger no pasa por la API |
| | fechas de las asignaciones | ❌ | El vínculo por `jornada_id` sobrevive; **las fechas copiadas no** |
| | días de jornal en Rendimiento | ⚠️ | Sí para admin; **no para pm/venta** |
| **Borro un día** | asignaciones de ese día | 🔒 | **Se borran en cascada, sin confirm, sin undo, sin traza.** 43 asignaciones cuelgan hoy de un `jornada_id` |
| **Borro TODOS los días de una fase** | fechas del evento | ❌ | Quedan congeladas apuntando a jornadas que ya no existen |

---

## 4 · OPERATIVO — el proyecto y el taller

> Dos ejes independientes que la UI muestra como uno: `proyectos.estado` (ciclo de vida) y `estado_taller` (ciclo de galpón). **Pueden divergir libremente — y en prod ya lo hacen.**

| Cuando pasa esto… | Debería llegar a… | | |
|---|---|:-:|---|
| Cambio `estado` | `proyecto_actividad` | ✅ | |
| ídem | `completitud_pct` | ❌ | El trigger solo mira el otro eje |
| ídem → `en_taller` | visibilidad para el rol taller | ✅ | la RLS lo habilita exactamente ahí |
| ídem → sale de `en_taller` | el taller deja de verlo **aunque lo esté armando** | 🔒 | sin ningún aviso |
| Cambio `estado_taller` | `completitud_pct` | ✅ | *(el bug histórico de leer `OLD` está corregido)* |
| ídem | `proyecto_actividad` | ❌ | **Todo el ciclo de galpón no deja rastro** |
| ídem | notificación al PM creador | ✅ | |
| ídem | Lobby (KPIs, cola, barras) | ✅ | |
| ídem | ficha del Evento / Calendario | ⚠️ | listan `estado`, no `estado_taller` |
| **Tildo un paso del checklist** | `estado_taller` pendiente→en_armado | ✅ | …pero **el taller no puede tildar** |
| Tildo del 2º al 6º paso | `completitud_pct` | ❌ | solo se mueve en el salto de estado |
| El cliente responde la encuesta | cerrar el proyecto | 🔒 | **Cierra TODOS los stands del evento**, incluso los que siguen en armado |
| Registro la Entrega firmada | `estado` / `estado_taller` | ❌ | **Firmar la entrega no cierra nada** |
| Subo el remito firmado | poder verlo después | ❌ | Bucket privado + `getRemitoSignedUrl` **sin llamadores** → hay que entrar al dashboard de Supabase |

---

## 5 · PERSONAS Y COSTO DE MANO DE OBRA

| Cuando pasa esto… | Debería llegar a… | | |
|---|---|:-:|---|
| Asigno gente en la ficha del evento | `asignaciones_evento` | ✅ | 40 filas vivas |
| ídem (**rol admin**) | línea de jornal en Rendimiento | ✅ | |
| ídem (**rol pm / venta / taller**) | línea de jornal | ❌ | **RLS pide `finanzas`, que esos roles no tienen.** El error se traga dos veces: `getEventoCostos` devuelve `[]` y `syncJornalesEvento` **devuelve** `{ok:false}` en vez de rechazar. **Meli carga 12 personas, ve el toast verde, y no se escribió una sola línea** |
| Quito una asignación | el jornal se retira | ⚠️ | no retira si hay pago (correcto) **ni si está anulado** (bug: la línea anulada bloquea la recreación **para siempre**) |
| Edito el monto a mano en Rendimiento | protección contra el próximo sync | ❌ | **El candado `monto_editado` no se activa nunca** → el siguiente sync lo reescribe en $0 |
| `personas.costo_dia_referencial` | tarifa de la línea | ✅ | mecánicamente… **pero está NULL en las 24 personas** |
| Cambio la tarifa de una persona | jornales **ya pagados** | 🔒 | **Sí, y no debería** |
| Línea de jornal pagada | egreso + asiento | ✅ | |
| Asigno a alguien ya ocupado | warning al que asigna | ❌ | **La función de detección existe y el flujo que asigna nunca la llama.** El conflicto solo aparece en una pantalla que ni Meli ni Leo pueden abrir |
| Asigno a alguien de licencia | warning | ❌ | el detector no mira `ausencias` |
| Cargo una ausencia | warning si choca con un evento | ✅ | **la única dirección cableada** |
| Creo una asignación | notificación de aprobación | ❌ | Se crea directo en `aprobada` → **el circuito de aprobación entero es código muerto** y el KPI dice siempre "0 · al día" |
| Borro una persona | limpiar asignaciones y jornales | ❌ | Siguen contando en Planificación y en el costo del evento, ahora con "—" |

---

## 6 · COSTOS, COMPRAS E INVENTARIO

| Cuando pasa esto… | Debería llegar a… | | |
|---|---|:-:|---|
| Cambio el costo de un insumo | recetas que lo usan | ⚠️🔒 | Ofrece cascada, pero **corre el motor JS, no la RPC** → sin regla 1:N, sin desperdicio, con un parámetro legacy de más |
| ídem | precio del catálogo | ⚠️ | escribe `ultima_recalculacion` pero **no los snapshots** → la UI marca la receta como desactualizada **justo después de actualizarla** |
| **Cambio VU armado / margen / minutos de MO** | precio del ítem | ❌ | El "dirty" **vive solo en el DOM**. Cerrás el panel y se pierde. **Así se subfactura el ítem 89 en $40.240** |
| Agrego o saco un componente | precio del ítem | ❌ | mismo mecanismo |
| Cambio el tipo de amortización | recetas que lo usan | ❌ | **Cero cascada, cero aviso** — y el texto de la ficha dice lo contrario |
| Cambio un parámetro global | ítems que lo usan | ❌ | La función que resuelve qué recetas dependen **existe con 0 llamadores** |
| Aprieto "Recalcular" | precio + snapshots | ✅ | |
| `precio_alquiler` | **cotizador externo** | ✅ | lee directo… **y se lleva el error del ítem 89 tal cual** |
| Recibo una OC | stock + movimiento auditable | ✅ | |
| ídem | **costo del insumo** | ❌ | Nunca toca `costo_unitario` aunque el precio de la OC ya esté guardado |
| Elijo presupuesto ganador | proveedor + monto de la OC | ✅ | …pero **un timeout al leer los borra a los dos** |
| Genero egreso desde OC | `egresos.proveedor_id` UUID | ✅ | |
| Movimiento de inventario | stock | ✅ | |
| **Stock cae bajo el mínimo** | notificación | ❌ | El trigger está bien escrito. **`stock_minimo` está NULL en los 80 insumos** → corta en la primera línea |
| ídem | aviso al **taller** (que es quien se queda sin material) | ❌ | El trigger inserta solo para `admin`. *El trigger hermano de equipos sí inserta dos filas — la asimetría es accidente* |
| Stock por locación | `locaciones_stock` | ❌ | **Cero escritores en todo el repo** — Locaciones dice que lo gestiona Inventario e Inventario solo hace SELECT |

---

## 7 · EL SISTEMA NERVIOSO

| Evento | Quién debería enterarse | | |
|---|---|:-:|---|
| Lead nuevo | Noe | ❌ | rol `venta` inexistente |
| Presupuesto aprobado | Noe + gerencia | ⚠️ | llega a los 7 superadmins, no a Noe |
| Se mueve una fecha de armado | pm, taller, gerencia | ⚠️ | `['pm','taller']` → **Fede, Lelean y Sofi no** |
| Dos armados se pisan | pm, gerencia | ⚠️ | `['pm','superadmin']` → **los 4 admin no** |
| Faltan 2 días para un armado | pm, taller | ⚠️ | campanita ✓ · **push en 404** |
| Insumo bajo mínimo | taller + admin | ❌ | ver arriba |
| Equipo fuera de servicio | admin + taller | ✅ | |
| Stand marcado listo | pm + gerencia | ⚠️ | `target_role:'pm'` → superadmin **no** |
| Stand trabado 3 semanas | pm, gerencia | ❌ | **La alerta filtra 8 estados de los cuales 7 son ilegales** |
| Cliente sin contacto 15 días | comercial | ❌ | `ultimo_contacto` NULL en 265/265 |
| Cotización por vencer | comercial | ❌ | `fecha_evento` NULL en 18/18 |
| Factura emitida / OC generada | admin + Fede | ✅ | |
| Tarea urgente asignada | los asignados | ⚠️ | in-app ✓ · **push solo si tienen la app instalada — y las 4 suscripciones son de 2 superadmins** |
| Novedad **crítica** para el taller | Diego | ⚠️ | campanita ✓ · **el fan-out nunca llama al push** → el celular no suena |
| Encuesta NPS respondida | pm + admin + Fede | ✅ | |
| Rutina de mantenimiento vencida | admin / responsable | ✅ | 8 vencidas hoy |

---

## 8 · LOS NÚMEROS ENTRE PANTALLAS

| Métrica | Pantalla A | Pantalla B | Diferencia |
|---|---|---|---|
| **Saldo disponible** | UI: **$5.000.000** | verdad: **$8.200.000** | **$3.200.000** |
| **Cobrado del mes** | Lobby: **$0** | Finanzas (Total): **$5.000.000** | **$5.000.000** — el Lobby está clavado en Oficial **y no lo dice** |
| **Aging de cobros** | Finanzas: **$4.000.000** | Lobby: **$34.000.000** | **$30.000.000** — y el KPI al lado del gráfico de Finanzas dice $34M: **no cierra ni consigo misma** |
| **Facturado del mes (junio)** | Panel y Lobby: **$2.000** | correcto: **$0** | Las NC suman en vez de restar |
| **IVA débito (junio)** | Libro IVA: **$347,10** | cuenta `2.1.02`: **$173,55** · correcto: **$0** | **Tres pantallas, tres números** |
| **Resultado histórico** | Finanzas EERR: **$12.417.090** | Contabilidad Balance: **$7.639.726** | **$4.777.363** (anticipo $5.000.000 + IVA) |
| **Saldo de Galicia** | header del detalle: **$4.703.610** | KPI del Panel: **$5.703.610** | **$1.000.000** — el header ignora el toggle |
| **Rentabilidad %** | 6 de 7 clientes: **100%** | realidad: sin costos imputados | costo 0 → 100% |
| **IVA crédito** | Libro: **$374.010** | cuenta `1.1.09`: **$222.810** | **$151.200** — devengado vs percibido, sin pantalla que lo explique |

---

## 9 · LO QUE SÍ ESTÁ BIEN CABLEADO

Vale tenerlo presente para no romperlo:

- **Ingreso/egreso confirmado → asiento contable.** Trigger automático, 0 movimientos sin asiento, partida doble al centavo.
- **Cotización aprobada → proyecto.** Trigger automático con guard; 12 proyectos, 0 duplicados.
- **Encuesta respondida → cierre de proyectos + 100 % de completitud.** Trigger automático. *El único evento donde se mandó la encuesta, cerró solo.*
- **Comprobante recibido → egreso** y **OC → egreso**: botones que funcionan, con proveedor UUID correcto.
- **Cheque → cartera → clearing → banco**: los 4 caminos generan su asiento, idempotentes.
- **Retenciones → asiento + libro de créditos fiscales**: el orden pendiente→retenciones→confirmado es deliberado y correcto.
- **Asignación → jornal** *(para admin)*: idempotente, preserva pagos, no borra lo que tiene plata encima.
- **Alertas calculadas**: se recalculan solas cada 5 min, sin depender de que nadie apriete nada.
- **Claim atómico del pool de tareas**: protegido por índice único en la base, no por el cliente.
- **Fechas del evento → jornadas → calendario → tareas del taller**: la derivación funciona.

---

## Los cinco cortes de cable que más duelen

Si hubiera que elegir dónde soldar primero, por daño real y no por severidad teórica:

1. **La cobranza no marca la cuota** → la venta miente sobre lo cobrado y la alerta reclama plata que ya entró.
2. **Editar un movimiento contabilizado no toca su asiento** → Finanzas y Contabilidad se separan en silencio. Ya pasó, con 2 meses de corrimiento.
3. **El puente asignaciones→jornales muere para PM y venta** → el evento se costea sin mano de obra y el margen sale inflado.
4. **Mover la fecha del evento no arrastra ni las asignaciones ni el camión ni el recordatorio** → la gente y el camión quedan citados el día viejo, y el aviso de "faltan 2 días" no vuelve a salir nunca.
5. **El "recalculá" del costo vive en el DOM** → el precio queda viejo sin ninguna señal, y el cotizador se lo lleva tal cual.
