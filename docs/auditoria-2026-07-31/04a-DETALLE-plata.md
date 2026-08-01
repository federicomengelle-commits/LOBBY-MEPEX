# Detalle — Dominio PLATA (Ventas · Cobranza · Finanzas · Contabilidad)

> Auditoría integral 2026-07-31. Todo verificado contra el schema y los datos **reales de producción** (solo SELECT).
> Los hallazgos marcados **[×2]** fueron encontrados de forma independiente por dos agentes distintos → confianza alta.

---

## CRÍTICOS

### C1 · `saldos_mensuales` pierde el arrastre cuando un mes no tuvo movimiento — **$3.200.000 invisibles hoy** [×2]

- **Dónde:** función Postgres `fn_refresh_saldo_periodo()` → consumida por `finanzas.js:4585` (`_saldoCuentaContable`) y `lobby.js:561`
- **Qué pasa:** la función calcula `saldo_anterior` leyendo **únicamente el mes inmediatamente anterior**. Si esa fila no existe (la cuenta no tuvo movimiento ese mes), el SELECT no devuelve nada, `COALESCE(...,0)` lo vuelve **0**, y el `saldo_final` arranca de cero borrando todo el acumulado previo. `fn_refresh_saldo_cascada` no lo salva: solo itera hasta el `MAX(periodo)` que **ya existe**, así que nunca crea la fila del mes vacío que rompe la cadena.
- **Cómo falla:** cuenta `1.1.01 Efectivo (mano)`, canal interno. Abril +$3.200.000 · mayo neutro · **junio sin movimiento** · julio +$5.000.000 = **$8.200.000**. Como no existe la fila `2026-06`, el refresh de `2026-07` leyó `saldo_anterior = 0`. El KPI "Saldo disponible" del Panel, el tab Cuentas y el widget del Lobby **muestran $4.999.900 cuando lo real es $8.199.900**.
- **Evidencia:**
  ```
  periodo  canal    saldo_anterior  total_debe  total_haber  saldo_final
  2026-04  interno       0.00        3200000.00     0.00      3200000.00
  2026-05  interno  3200000.00        500000.00  500000.00    3200000.00
     ← 2026-06 NO EXISTE
  2026-07  interno       0.00 ←BUG   5000000.00     0.00      5000000.00
  ```
  Barrido de drift completo (materializado vs Σ`asiento_lineas`): **1 cuenta desalineada, −$3.200.000**. Hay **3 series (cuenta, canal) con hueco de mes**; las otras dos tienen saldo 0 antes del hueco → misma bomba, sin detonar.
- **Arreglo:** en `fn_refresh_saldo_periodo`, buscar el último período **existente y anterior**: `SELECT saldo_final ... WHERE periodo < p_periodo ORDER BY periodo DESC LIMIT 1`. Después, backfill recorriendo todas las series. Alternativa robusta: derivar el acumulado de `asiento_lineas` y dejar `saldos_mensuales` como caché de solo lectura.
- **Ojo:** al arreglarlo el KPI va a **subir**. No es un bug nuevo.
- **Esfuerzo:** S (función) + S (backfill)

---

### C2 · Editar un movimiento ya contabilizado NO toca su asiento — **ya pasó en prod, con 2 meses de corrimiento** [×2]

- **Dónde:** `fn_asiento_auto_egreso()` / `fn_asiento_auto_ingreso()` (2ª línea del cuerpo) · disparado desde `finanzas.js:4497` (egresos) y `finanzas.js:3621` (ingresos)
- **Qué pasa:** los triggers cortan con `IF TG_OP='UPDATE' AND OLD.estado='pagado' THEN RETURN NEW`. La guarda evita duplicar asientos, pero es la **única** rama de UPDATE: nada sincroniza el asiento cuando cambian `monto`, `fecha`, `canal`, `categoria`/`servicio` o `cuenta_id`. El modal de edición manda un `.update(payload)` con **todos** esos campos y sin ningún guard sobre el estado.
- **Cómo falla — ya ocurrió:**
  ```
  egreso "CANEPA SANTIAGO J BY SAENZ SILVIA P S DHECHO"  $486.420
    creado:  2026-07-03 14:41:58 → asiento #41 con fecha 2026-04-24
    editado: 2026-07-03 14:42:59 → fecha del egreso pasó a 2026-07-03
    RESULTADO: periodo_finanzas = 2026-07 | periodo_contable = 2026-04
  ```
  61 segundos después de crearlo alguien corrigió la fecha y el asiento se quedó en abril. **Abril sobrestima gastos en $486.420 y julio los subestima igual.** Es además la causa del saldo negativo imposible de `1.1.02 Caja Oficina` (−$486.420).
  Otras dos formas: cambiar el monto de un cobro de $5M a $4M deja el asiento en 5M para siempre; borrar (soft) un egreso pagado lo saca de la lista pero el asiento sigue vivo descontando el saldo.
- **Arreglo:** dos capas. (a) En `finanzas.js`, bloquear en el modal los campos que impactan el asiento cuando el estado ya es final (editar solo concepto/notas) y forzar el camino Anular → volver a cargar, que sí genera contra-asiento. (b) Trigger `AFTER UPDATE OF monto, fecha, canal, categoria, cuenta_id ON ingresos/egresos` que regenere el asiento o rechace con `RAISE EXCEPTION`. Además: ningún trigger observa `_deleted`.
- **Esfuerzo:** M

---

### C3 · La cobranza con retenciones nunca marca la cuota como cobrada

- **Dónde:** `cobranza.js:493-495` → `api.js:6774` (`aplicarCobro`) → trigger `fn_sync_cuota_desde_aplicacion`
- **Qué pasa:** el recibo de cobranza (la pieza estrella de Ventas Fase 2) arma las aplicaciones **solo con `comprobante_id`**, sin `plan_cobro_item_id`. `aplicarCobro` inserta `plan_cobro_item_id: null` y el trigger que sincroniza la cuota corta en la primera línea (`IF v_item_id IS NULL THEN RETURN`).
- **Cómo falla:** Sofi registra una cobranza de $121.000 con $6.000 de retención contra la factura de una cuota. Se crea el ingreso, el crédito fiscal y el asiento balanceado — pero **la cuota sigue en `pendiente` con `monto_cobrado = 0`**. La ficha de la venta sigue mostrando *Cobrado $0 / Saldo $5.000.000* y la alerta "cuotas vencidas" sigue reclamando plata que ya entró.
- **Evidencia:**
  ```js
  // cobranza.js:493
  const aplicaciones = Object.entries(this._aplic)
      .map(([comprobante_id, v]) => ({ comprobante_id, monto_aplicado: API._monto(v) }))
  ```
  `api.js:9226`: `const cobrado = items.reduce((a,i) => a + (Number(i.monto_cobrado)||0), 0);` — único origen del "Cobrado" de la venta.
- **Arreglo:** en `_bloqueAplicacion` traer también las cuotas cuyo `comprobante_venta_id` sea esa factura y mandar `plan_cobro_item_id` en cada aplicación. Si una factura documenta N cuotas, repartir por orden hasta agotar el aplicado.
- **Esfuerzo:** M

---

### C4 · Dos escritores de `monto_cobrado` con semánticas incompatibles — **arreglar C3 sin esto ceba la bomba** [×2]

- **Dónde:** `api.js:7735-7744` (`registrarCobro`, camino Finanzas) vs trigger `fn_sync_cuota_desde_aplicacion`
- **Qué pasa:** el camino legacy hace read-modify-write **incremental** (`cobrado = monto_cobrado + monto`) y **no crea fila en `cobro_aplicaciones`**. El trigger hace `SET monto_cobrado = SUM(cobro_aplicaciones)` — **absoluto**. Escriben la misma columna con semánticas opuestas.
- **Cómo falla:** cuota cobrada $100 desde Finanzas → `monto_cobrado=100`, `cobro_aplicaciones` vacío. Después se aplican $30 por el camino nuevo → el trigger recalcula desde cero y deja `monto_cobrado=30`. **Los $100 desaparecen sin un solo error.**
- **Evidencia:** prod tiene la cuota `36241d3e` con `estado='cobrado'`, `monto_cobrado=5.000.000` y **0 filas en `cobro_aplicaciones`** — exactamente el estado que el trigger va a aplastar. Hoy no explota solo porque C3 impide que el trigger llegue a tocar una cuota.
- **Arreglo:** que `registrarCobro` con `syncPlanItem` inserte la fila en `cobro_aplicaciones` (si la cuota no tiene factura, migrar la columna a NULLABLE y ajustar el trigger) y **borrar el UPDATE de JS**. Una sola fuente de verdad: el trigger. Antes, backfill de las cuotas cobradas por el camino viejo.
- **Esfuerzo:** L

---

### C5 · Si ARCA devuelve CAE y falla el INSERT, el comprobante se pierde y la pantalla dice "✓ Emitido"

- **Dónde:** `finanzas.js:7982-7986`
- **Qué pasa:** el error del insert se traga con un `console.warn` y sigue derecho al toast de éxito, al PDF y a la pantalla de "Comprobante emitido".
- **Cómo falla:** RLS, timeout o cualquier constraint hacen que la factura **exista en AFIP con CAE y numeración consumida, y no exista en el sistema**: no aparece en Emitidos, no entra al Libro IVA ventas, no se puede cobrar, y el próximo `FECompUltimoAutorizado` deja un hueco inexplicable. No hay reintento porque el flujo ya se declaró exitoso.
- **Evidencia:**
  ```js
  const { data: inserted, error } = await supabaseClient.from('comprobantes').insert([record]).select().single();
  if (error) { console.warn('[Finanzas] Error guardando comprobante:', error); }
  const comp = inserted || { ...record, id: null };
  Toast.success(`✓ Emitido — CAE ${result.cae}`);
  ```
- **Arreglo:** error bloqueante con el CAE y el número en pantalla + botón "Reintentar guardado" que reintente **solo el INSERT** (nunca la emisión), y volcar el `record` a `localStorage` para no perderlo si se cierra la pestaña.
- **Esfuerzo:** S

---

## ALTOS

### A1 · Una factura ya cobrada sigue con saldo entero en Cobranza — **riesgo de doble cobro, verificado en prod**

- **Dónde:** `api.js:7912` (`generarIngresoDeComprobante`), view `v_saldo_comprobante`, `cobranza.js:115`
- **Qué pasa:** `v_saldo_comprobante` calcula el saldo **solo** contra `cobro_aplicaciones`. Pero `generarIngresoDeComprobante` (el botón "Generar cobro" del panel de Emitidos) crea el ingreso y setea `comprobantes.ingreso_id` **sin insertar ninguna aplicación**. Los dos caminos de cobro escriben en lugares distintos.
- **Evidencia:** la FC B `00005-00000002` de $1.000 tiene su ingreso confirmado con asiento correcto, y la vista igual reporta `total 1000 · total_cobrado 0 · saldo 1000 · pendiente`. El guard anti-carrera de `cobranza.js:512` re-consulta **la misma vista**, así que tampoco frena.
- **Arreglo:** que `generarIngresoDeComprobante` inserte también la `cobro_aplicaciones`, o que la vista sume los `ingresos.monto` con ese `comprobante_id` sin aplicación.
- **Esfuerzo:** S

### A2 · Las notas de crédito **suman en vez de restar** en todos los agregados

- **Dónde:** view `v_posicion_iva_mes`, `finanzas.js:6097` (KPI Facturado), `finanzas.js:8754-8758`, `finanzas.js:6724` (Rentab. proyecto), view `v_saldo_comprobante`, `finanzas.js:8979` (botón "Gestionar cobro")
- **Qué pasa:** las NC se guardan con `total`, `neto` e `iva` **positivos**, y ningún consumidor mira el signo del `tipo`.
- **Evidencia:** junio 2026 tiene una FC B de $1.000 (IVA 173,55) y su NC B que la anula. La posición de IVA debería dar débito **$0,00**; da **$347,10**. El KPI "Facturado del mes" muestra $2.000 en vez de $0. La NC figura en `v_saldo_comprobante` como crédito a cobrar de $1.000 y su panel ofrece **"⎘ Gestionar cobro"**, que en dos clics crea un ingreso **positivo** de $1.000 con asiento DEBE banco / HABER Ventas por una nota de crédito.
- **Arreglo:** definir el signo en un solo lugar (`CASE WHEN tipo LIKE 'nota_credito%' THEN -1 ELSE 1 END`) y aplicarlo en la vista de posición IVA, en `v_saldo_comprobante` y en los tres reduce de JS. Ocultar "Gestionar cobro" cuando el tipo es NC.
- **Esfuerzo:** M

### A3 · Sin guard de duplicado en `comprobantes_recibidos` — **hoy hay $151.200 de crédito fiscal inventado**

- **Dónde:** `api.js:7581` (`createComprobanteRecibido`), `carga-comprobante.js:275`, `api.js:7688` (dentro de `registrarGasto`), `api.js:7997` (`crearCostoDesdeComprobante`)
- **Qué pasa:** los cuatro caminos de alta insertan sin chequear si ya existe, y no hay índice único (solo la PK y cuatro índices no-únicos).
- **Evidencia:** en prod está **tres veces** la misma factura `00002-00005961` de ONORIER NOEMI, $435.600 (IVA $75.600 cada una) — dos sin pagar y una pagada. `v_libro_iva_compras_extendido` no distingue: junio informa **$226.800** de IVA crédito cuando lo real es **$75.600**. Son **$151.200 listos para computarse en una DDJJ**. El asiento contable solo tomó los $75.600 de la pagada → libro y contabilidad ya difieren en ese monto.
- **Arreglo:** limpiar las dos duplicadas + índice único parcial `(cuit, tipo, numero) WHERE _deleted=false AND numero IS NOT NULL` + aviso en la UI ("ya cargaste esta factura el X") antes del insert.
- **Esfuerzo:** S

### A4 · Anular revierte el asiento **y nada más** [×3]

- **Dónde:** `fn_revertir_asiento_ingreso` / `fn_revertir_asiento_egreso` (1,4-1,5 KB: solo el INSERT del contra-asiento y el loop de líneas invertidas)
- **Qué queda vivo tras anular una cobranza:**
  - las `cobro_aplicaciones` → la factura sigue figurando cobrada y la cuota en `cobrado`
  - las `creditos_fiscales` de retención en `estado='pendiente'` → **siguen entrando a la DDJJ** una retención de un cobro anulado
  - `comprobantes.ingreso_id` apuntando al ingreso anulado → **bloquea** volver a generar el cobro (`generarIngresoDeComprobante` chequea `_deleted` pero no `estado='anulado'`)
  - lado egreso: `comprobantes_recibidos.egreso_id` colgado y el `evento_costo_pagos` de Rendimiento sigue contando el pago
  - `plan_cobro_items.monto_cobrado` no se revierte
- **Además:** **`deleteCobroAplicacion` no tiene ni un llamador en todo el repo** → no existe forma de deshacer una aplicación.
- **Arreglo:** una `API.anularCobro(ingresoId)` que marque `_deleted` las aplicaciones, dé de baja las retenciones (levantando el candado cuando el ingreso ya no está confirmado) y limpie `comprobantes.ingreso_id`. Y que los chequeos "ya tiene cobro/egreso" excluyan los anulados.
- **Esfuerzo:** M

### A5 · La percepción sufrida se contabiliza como gasto **y además** se computa como crédito: doble conteo

- **Dónde:** `fn_asiento_auto_egreso` vs `finanzas.js:9805` (`_syncPercepciones`)
- **Qué pasa:** al guardar un comprobante con `percepcion_iva`/`percepcion_iibb`, el JS crea la fila en `creditos_fiscales` (entra al libro/DDJJ ✓). Pero el trigger solo desglosa el IVA y **no conoce las percepciones**: la línea de gasto se calcula como `v_monto_asiento - v_iva`, o sea que la percepción queda adentro del gasto.
- **Cómo falla:** factura neto $100.000 + IVA $21.000 + percepción IIBB $3.000 = $124.000. Asiento: `DEBE Gasto 103.000 / DEBE IVA 21.000 / HABER Banco 124.000`. El resultado del mes tiene $3.000 de gasto que no es gasto, y esos mismos $3.000 se descuentan de la DDJJ de IIBB por el otro lado.
- **Arreglo:** replicar en `fn_asiento_auto_egreso` el loop de retenciones que ya tiene `fn_asiento_auto_ingreso`: leer `creditos_fiscales` por `origen_comprobante_id AND tipo='percepcion'`, sumar líneas al DEBE con `1.1.12`/`1.1.13` y restarlas de la línea de gasto.
- **Esfuerzo:** M

### A6 · Todos los KPIs y reportes suman `monto` crudo — un movimiento en USD entra como si fueran pesos

- **Dónde:** `finanzas.js:6097,6105,6113,6121,6129,6148,6156` (Panel) · `6636,6642,6648` (EERR) · `6724,6730,6736` (Rent. proyecto) · `6794+` (Rent. cliente) · `lobby.js:536-539`
- **Qué pasa:** los triggers `fn_snapshot_total_ars_*` materializan `total_en_ars` correctamente en las 8 tablas, pero el único lugar del front que lo usa es `cartera_valores` (`finanzas.js:6165`, `9557`) y el reporte de movimientos extranjeros (`6513`). Todo el resto hace `Number(r.monto)`.
- **Cómo falla:** un cobro de **USD 1.000** con cotización 1.420 (= ARS 1.420.000, ya guardado) suma **$1.000** al KPI "Cobrado del mes", al EERR y a la rentabilidad del proyecto.
- **Estado:** latente — hoy prod tiene 0 movimientos no-ARS, pero el selector de moneda está vivo en los dos modales.
- **Arreglo:** `select('monto,total_en_ars')` y sumar `Number(r.total_en_ars) ?? Number(r.monto)` — el patrón que ya usa `cartera_valores`.
- **Esfuerzo:** M

### A7 · El EERR de Finanzas cuenta los anticipos como venta — **$5.000.000 de diferencia con Contabilidad**

- **Dónde:** `finanzas.js:6618-6636`
- **Qué pasa:** el reporte suma **todos** los ingresos confirmados como "Ingresos Operativos". El trigger contable clasifica por `mapeo_cuentas`: un cobro **sin factura** cae en el mapeo `default` → `2.1.06 Anticipos de clientes`, que es un **pasivo**, no un resultado.
- **Evidencia:** el ingreso `28fd52c4` del 27/07, "50%", $5.000.000, canal interno: su asiento es `1.1.01 debe 5.000.000 / 2.1.06 haber 5.000.000`. Contabilidad → EERR no lo ve; Finanzas → EERR lo muestra como $5.000.000 de ingreso. **Dos pantallas del mismo sistema, mismo período, $5M de diferencia.**
- **Arreglo:** el EERR de Finanzas debería excluir (o mostrar aparte, como "Anticipos recibidos") los ingresos sin `comprobante_id` ni `cobro_aplicaciones`. Es la misma regla que ya aplica el trigger.
- **Esfuerzo:** S

### A8 · El bloqueo de ejercicio está **inactivo**: hoy se puede postear o borrar en cualquier fecha

- **Dónde:** `fn_ejercicio_cerrado_cutoff()` → usada por `fn_asiento_periodo_bloqueado` y `fn_asiento_linea_periodo_bloqueado`
- **Qué pasa:** el cutoff sale de `SELECT MAX(ejercicio) FROM saldos_apertura WHERE bloqueado=true`. **`saldos_apertura` tiene 0 filas** → NULL → ambos triggers hacen `RETURN` inmediato. Toda la maquinaria de cierre está construida, cableada a triggers activos y sin efecto.
- **Cómo falla:** cualquier admin puede crear hoy un asiento con fecha 2019, o editar/borrar un asiento de un mes ya declarado a ARCA.
- **Arreglo:** es la Fase 7 pendiente, no un bug. Lo accionable: un badge en el tab Apertura que muestre el cutoff vigente o "Ejercicio abierto — sin bloqueo", para no creer que hay un candado que no está puesto.
- **Esfuerzo:** S (badge) / L (activar apertura 2027, ya planificado)

### A9 · EERR y Balance truncan a 1000 filas sin avisar — el Balance rompe a ~334 asientos

- **Dónde:** `contabilidad.js:4516-4540` (`_loadReporteEERR`) y `contabilidad.js:4713-4747` (`_loadReporteBalance`)
- **Qué pasa:** PostgREST corta en 1000 filas. El EERR hace `.select('id')` sobre `asientos` **sin `.range()`** y después `.in('asiento_id', ids)` sobre `asiento_lineas` **también sin `.range()`** — dos puntos de truncado. El Balance chunkea los ids de a 500, pero cada chunk de 500 asientos produce ~1500 líneas y **el resultado de cada chunk se trunca a 1000**: se pierden ~500 líneas por chunk.
- **Cómo falla:** sin error ni warning; el reporte renderiza prolijo con números incompletos. En el Balance el `descuadre` deja de ser 0 y el cartel "cuadra ✓" pasa a rojo sin explicación — o peor, compensa por casualidad y muestra un balance falso que cuadra.
- **Arreglo:** bajar `chunkSize` a 200 y paginar con el bucle `while (page.length === PAGE)` que **ya está escrito** en `contabilidad.js:2702-2710` (`_loadAsientos`). Mejor: RPC `fn_estado_resultados(desde, hasta, canal)` que agregue en Postgres.
- **Esfuerzo:** S (paginar) / M (RPC)

### A10 · Libro Mayor: toda la historia sin filtro ni orden, truncada a 1000 líneas arbitrarias

- **Dónde:** `contabilidad.js:3112-3115` — `select('*').eq('cuenta_id', ...)` sin filtro de fecha, sin `.order()`, sin `.range()`
- **Qué pasa:** trae todo el histórico y filtra por período **en el cliente**. Al superar 1000 líneas PostgREST devuelve un subconjunto y, **al no haber ORDER BY, cuál subconjunto no está definido**.
- **Cómo falla:** es el peor de los truncados porque el "Saldo anterior" se computa sumando `movimientosAntes` (`contabilidad.js:3172-3178`), que es justamente lo que se pierde primero. No da error: da un número plausible y equivocado.
- **Arreglo:** RPC `fn_libro_mayor(cuenta_id, desde, hasta, canal)` que devuelva `(saldo_anterior, movimientos[])` calculando el arrastre en SQL.
- **Esfuerzo:** M

### A11 · Los egresos no tienen mapeo genérico de respaldo: la rama de fallback es **inalcanzable por schema**

- **Dónde:** `fn_asiento_auto_egreso()`, lookup de `mapeo_cuentas`
- **Qué pasa:** el `WHERE` acepta `(campo_origen='categoria' AND valor_origen=NEW.categoria) OR (campo_origen IS NULL)`. Pero `mapeo_cuentas.campo_origen` es **NOT NULL** en prod → la segunda condición **nunca puede ser verdadera**. Los ingresos sí tienen fallback real (centinela `campo_origen='default'` → `2.1.06`); los egresos no.
- **Cómo falla:** si alguien desactiva o borra un mapeo desde el tab Mapeos (la UI lo permite), todos los egresos de esa categoría pasan a **pagarse sin generar asiento**. El `RAISE NOTICE` va al log de Postgres que nadie mira; el usuario ve "Egreso registrado ✓".
- **Estado:** las 8 categorías están mapeadas hoy y 0 egresos caen en la rama — pero el fallback que el código cree tener no existe.
- **Arreglo:** insertar la fila centinela `('egreso','default','default', 5.2.11, 'debe')` y cambiar la condición a `OR campo_origen='default'`. En el tab Mapeos, impedir borrar/desactivar el default.
- **Esfuerzo:** S

### A12 · Una venta en borrador mal cargada no se puede corregir ni borrar, y bloquea el caso para siempre

- **Dónde:** `api.js:9266` (`updateVenta`), `api.js:9340` (`deleteVenta`), `crm.js:4062`, `api.js:9362`
- **Qué pasa:** `updateVenta` solo tiene un caller interno (`anularVenta`); **`deleteVenta` no tiene ningún caller**. La ficha solo ofrece Confirmar y Anular. No hay UI para editar total, cliente, evento ni cotización.
- **Cómo falla:** Sofi confirma la venta y tipea mal el total. No la puede editar ni borrar. Si la anula, `caso.venta_id` sigue apuntando a la anulada → `crm.js:4062` esconde "Confirmar venta" y `crearVentaDesdeCaso` rebota con *"Este caso ya tiene una venta"*. **El caso queda sin forma de generar una venta correcta.**
- **Evidencia:** `api.js:9362` no filtra por `estado <> 'anulada'` ni `_deleted`. En prod ya hay una venta huérfana así: `92d8f39a`, borrador, total $0.
- **Arreglo:** (a) botón "Editar" cuando `estado='borrador'`; (b) "Descartar borrador" que llame `deleteVenta` **y limpie `crm_casos.venta_id` / `proyectos.venta_id`**; (c) ignorar ventas anuladas/borradas en el gate.
- **Esfuerzo:** M

---

## MEDIOS (selección)

| # | Hallazgo | Dónde | Impacto | Esf. |
|---|---|---|---|---|
| M1 | **Re-anular deja el asiento colgado**: el anti-doble chequea "¿existe alguna reversión?" en vez de "¿este asiento fue revertido?", y busca el original con `ORDER BY numero LIMIT 1` (el más viejo). Ciclo pagado→anulado→pagado→anulado deja un movimiento anulado aportando su importe al Balance para siempre. | `fn_revertir_asiento_*` | 0 casos hoy | S |
| M2 | **Guardar asiento manual no es atómico**: 3 requests sin transacción (UPDATE → DELETE líneas → INSERT líneas). Si falla el tercero, queda cabecera con importe y **cero líneas** → el Diario lo muestra, el Mayor/EERR/Balance no. `chk_partida_doble` no protege. | `contabilidad.js:3646-3680` | 0 casos hoy | M |
| M3 | **El asiento de transferencia hardcodea `'oficial'`** y usa `NEW.monto` en vez de `total_en_ars` → una transferencia entre cuentas internas postea en el canal equivocado. | `generar_asiento_transferencia` | 0 filas hoy | S |
| M4 | **Anular el egreso de un endoso** devuelve el cheque a la contabilidad (`1.1.07`) pero `cartera_valores.estado` sigue `'endosado'` → el cheque queda invisible, sin acción disponible en la UI. | `api.js:7846`, `fn_revertir_asiento_egreso` | — | S |
| M5 | **Los modales de Ingreso/Egreso no tienen campo Evento** → un gasto cargado a mano en Finanzas nunca puede llevar `evento_id`, y el puente Finanzas→Rendimiento solo funciona para lo que entra por OCR/OC/Rendimiento. | `finanzas.js:3445-3554`, `4260-4400` | rentabilidad de evento incompleta | S |
| M6 | **El detalle de cuenta muestra un saldo corrido que no cierra con el encabezado**: el header usa el saldo contable y la tabla recalcula sumando ingresos−egresos. Divergen por diseño cuando hay cheques en tránsito, sin ninguna explicación en pantalla. | `finanzas.js:4609`, `4642` | confusión | M |
| M7 | **`v_libro_iva_compras_extendido` no filtra canal** y usa importes sin convertir → una compra del canal interno entra al libro que se presenta a AFIP. | view | 0 casos hoy | S |
| M8 | **Libro IVA vs cuentas contables de IVA divergen por diseño** (devengado vs percibido) y ninguna pantalla muestra la brecha: crédito $374.010 vs $222.810 (**$151.200**), débito $347,10 vs $173,55. Cuadra exacto con los 2 comprobantes recibidos sin egreso + 1 emitido sin ingreso. | `contabilidad.js:4104-4161` | DDJJ a ciegas | S |
| M9 | **La reversión se postea con `CURRENT_DATE`**, no con la fecha del asiento original → anular en julio un cobro de abril deja el ingreso en abril y el negativo en julio. | `fn_revertir_asiento_*` | reportes por período | S |
| M10 | **El asiento manual ofrece cuentas por `es_grupo`, ignorando `imputable`** → apenas alguien marque una cuenta hoja como no-imputable, el selector la va a seguir ofreciendo. | `contabilidad.js:3593-3599` | 0 casos hoy | S |
| M11 | **La misma acción está trabada en la ficha de la venta y abierta en Finanzas**: borrar/editar una cuota cobrada tiene guard en `venta-detalle.js:1709` y no en `finanzas.js:5153/5230`. | ambos | corrupción | M |
| M12 | **`en_curso` y `cerrada` son estados muertos** de `ventas`: la UI los pinta y filtra, nadie los escribe. El KPI "Confirmadas" cuenta ventas ya terminadas como pipeline vivo. | `api.js:9294/9330` | KPI falso | S |
| M13 | **Anular venta deja el plan de cobro vivo** y la alerta "cuotas vencidas" sigue reclamando plata de una venta que no existe. | `api.js:9330`, `alertas.js:474` | ruido | M |
| M14 | **`clientes.ultimo_contacto` se lee en 3 lugares y no lo escribe nadie**: 0 de 265 filas tienen valor → 2 widgets del lobby y 1 alerta están permanentemente vacíos. | `lobby.js:883/893`, `alertas.js:157` | features mudas | S |
| M15 | **`venta.total` y el monto de la cotización divergen en silencio**, uno al lado del otro en la misma ficha (en prod: $23.974.904 vs $26.372.394). | `api.js:9251`, `venta-detalle.js:641/688` | confusión | S |
| M16 | **`plan_cobro.proyecto_id` sin FK**: hay un plan huérfano en prod ($8.000.000, proyecto inexistente, y `total_plan` ≠ suma de cuotas $4.000.000). | schema | — | S |
| M17 | **La ficha de la venta no muestra los créditos fiscales** aunque Fase 2 ya está en prod: el bloque está construido pero `_creditos` nunca se llena (el comentario dice que la tabla "no existe"; sí existe). | `venta-detalle.js:29/211/845` | — | M |
| M18 | **El EERR agrupa los ingresos por la primera palabra del concepto** (`r.concepto?.split(' ')[0]`) → las secciones del reporte salen de texto libre. | `finanzas.js:6633` | reporte pobre | S |
| M19 | **`v_posicion_iva_mes` filtra por estados que no pueden existir** (`aprobada`/`autorizada`, restos de La PyME). | view | pista falsa | S |
| M20 | **`eventos.js` inserta clientes salteándose `API.createClient`** → sin audit_log, sin undo, sin invalidar caché. | `eventos.js:2887` | — | S |

---

## Ramas de escape silenciosas de los triggers contables

Inventario completo de dónde un movimiento se guarda **sin generar asiento**:

| # | `fn_asiento_auto_ingreso` | Señal | ¿Alcanzable por UI? |
|---|---|---|---|
| 1 | `estado <> 'confirmado'` | — | Sí, por diseño ✓ |
| 2 | `TG_OP='UPDATE' AND OLD.estado='confirmado'` | — | **Sí → es C2** |
| 3 | `medio='cheque'` sin cuenta `1.1.07` | NOTICE | solo si borran la cuenta |
| 4 | **`cuenta_id IS NULL`** (medio ≠ cheque) | NOTICE | **Sí — el modal no valida cuenta** (`finanzas.js:3589`) |
| 5 | cuenta financiera sin `plan_cuentas` vinculada | WARNING | sí, al crear una cuenta nueva |
| 6 | sin mapeo ni default | NOTICE | solo si desactivan el default |

| # | `fn_asiento_auto_egreso` | Señal | ¿Alcanzable? |
|---|---|---|---|
| 1 | `estado <> 'pagado'` | — | por diseño ✓ |
| 2 | `TG_OP='UPDATE' AND OLD.estado='pagado'` | — | **Sí → C2** |
| 3 | endoso sin cuenta `1.1.07` | NOTICE | solo si borran la cuenta |
| 4 | **`cuenta_id IS NULL`** sin `cartera_valor_id` | NOTICE | **Sí — el modal no valida** (`finanzas.js:4465`) |
| 5 | cuenta sin `plan_cuentas` | WARNING | sí |
| 6 | sin mapeo para la categoría | NOTICE | **Sí, y sin fallback → A11** |

**Hoy los 4 escapes alcanzables están en 0 filas.** Es un fail-open esperando.
**Arreglo transversal:** exigir `cuenta_id` en ambos modales cuando el estado es final, y que las ramas 5 y 6 pasen de `NOTICE` a `RAISE EXCEPTION` — si no hay dónde imputar, que el movimiento **no se guarde**. Un cobro rechazado se vuelve a cargar; un cobro sin asiento no se descubre nunca.

---

## Estado de integridad contable en prod (2026-07-31)

| # | Verificación | Resultado | |
|---|---|---|---|
| 1 | Partida doble global | DEBE **$18.984.910** = HABER **$18.984.910** — dif **$0,00** | ✅ |
| 2 | Asientos vivos / totales | 15 / 42 | — |
| 3 | Asientos desbalanceados en cabecera | 0 | ✅ |
| 4 | Cabecera ≠ suma de líneas | 0 | ✅ |
| 5 | Asientos vivos sin líneas | 0 | ✅ |
| 6 | Líneas huérfanas | 0 | ✅ |
| 7 | Líneas con cuenta inexistente / no imputable / grupo | 0 / 0 / 0 | ✅ |
| 8 | Líneas con monto negativo o cero | 0 / 0 | ✅ |
| 9 | Ingresos confirmados | 7 · $15.201.000 | — |
| 10 | **Ingresos confirmados SIN asiento** | **0** | ✅ |
| 11 | Egresos pagados | 6 · $2.783.910 | — |
| 12 | **Egresos pagados SIN asiento** | **0** | ✅ |
| 13 | **Comprobantes emitidos SIN asiento** | **2** | ⚠️ (Fase 3 pendiente por diseño) |
| 14 | Asientos a movimiento borrado o anulado | 0 | ✅ |
| 15 | Asientos duplicados para el mismo movimiento | 0 | ✅ |
| 16 | Movimientos anulados con asiento vivo sin reversión | 0 | ✅ |
| 17 | **`saldos_mensuales` vs recálculo** | **1 cuenta con drift: −$3.200.000** | ❌ C1 |
| 18 | Series (cuenta, canal) con hueco de mes | **3** | ⚠️ |
| 19 | **Desync movimiento ↔ asiento** | **1 egreso: $486.420, 2 meses de corrimiento** | ❌ C2 |
| 20 | IVA crédito: libro vs cuenta `1.1.09` | $374.010 vs $222.810 — brecha **$151.200** | ⚠️ M8/A3 |
| 21 | IVA débito: libro vs cuenta `2.1.02` | $347,10 vs $173,55 — brecha $173,55 | ⚠️ M8 |
| 22 | `plan_cuentas` | 66 vivas · 51 imputables · 15 grupos | ✅ |
| 23 | `mapeo_cuentas` | 13 activos · las 8 categorías de egreso cubiertas | ✅ |
| 24 | Movimientos finales sin `cuenta_id` | 0 | ✅ |
| 25 | Cuentas financieras sin `plan_cuentas` vinculada | 0 | ✅ |
| 26 | `saldos_apertura` | **0 filas → bloqueo de ejercicio INACTIVO** | ❌ A8 |
| 27 | `chk_partida_doble` | **VALIDADO** + `chk_asiento_balanceado` (igualdad exacta) también | ✅ |
| 28 | RLS del motor contable | ON en las 8 tablas, 4 policies c/u | ✅ |
| 29 | Views con `security_invoker=true` | **6 de 6** (incluida `v_creditos_fiscales_periodo`) | ✅ |

**Lectura de conjunto:** el backbone está sano — la partida doble cuadra al centavo, no hay plata movida sin asiento, no hay asientos duplicados ni huérfanos, y el hardening de la Fase A está aplicado y validado. **Los dos problemas reales son de sincronización, no de contabilidad.**

---

## Falsos positivos descartados (importante — no volver a reportarlos)

- **"`plan_cuentas` tiene 8 filas y `mapeo_cuentas` 1"** → FALSO. Son **66** y **13**. Cobertura completa.
- **"`chk_partida_doble` está NOT VALID"** (CLAUDE.md §7) → **DESACTUALIZADO**: está validado, y existe un segundo CHECK más estricto sin documentar (`chk_asiento_balanceado`).
- **"Falta filtro `_deleted` en `asiento_lineas`"** → esa tabla **no tiene** esa columna. El soft delete vive en `asientos` y todas las queries lo filtran.
- **"Suma sin `Number()` concatena strings"** → PostgREST serializa `numeric` como número JSON.
- **"`query.eq()` sin reasignar no aplica el filtro"** → en postgrest-js los filtros mutan y devuelven `this`. Se aplica bien.
- **"Un cobro con factura cae en Anticipos si el servicio no tiene mapeo"** → `comprobantes.servicio` es NOT NULL con CHECK de 4 valores, **los 4 mapeados**.
- **"Hay egresos sin asiento por categoría no mapeada"** → las 8 del CHECK están mapeadas; `GASTO_DOMINIO` solo puede producir esas 8.
- **"Un cheque rechazado tras acreditarse descuadra el banco"** → `_valorAcciones` solo ofrece acciones cuando `estado === 'en_cartera'`. No alcanzable por UI.
- **"`generar_asiento_transferencia` es legacy"** → **está VIVA**. Solo `generar_asiento_ingreso`/`egreso` están sin trigger (código muerto).
- **"`registrarCobranza` confirma el ingreso antes de tener las retenciones"** → el orden pendiente→retenciones→aplicaciones→confirmado es **deliberado y correcto**.
- **"`registrarCobranza` puede guardar importes mal parseados"** → `_monto()` rechaza strings ambiguos y valida `Σ aplicado = efectivo + Σ retenido` con tolerancia 0,01. Es el camino más blindado del módulo.
- **"El toggle de canal mezcla ambos lados en algún reporte"** → no. Diario, Mayor, EERR, Balance y Asiento Manual aplican `_getCanalFilter()`; los Libros IVA fijan `oficial` **a propósito**.
- **"Doble creación de proyecto por el trigger `cotizacion_aprobada_crea_proyecto`"** → el trigger está activo pero **ningún camino vivo lo dispara sin guard** (el UPDATE de aprobación setea `estado + project_id` atómicamente, satisfaciendo el guard). Prod: 12 proyectos, 0 duplicados. **Caveat real:** `_convertirCasoAProyecto` (`crm.js:5685`) crea el proyecto sin `cotizacion_id` y sin setear `cotizaciones.project_id` → los dos guards son ciegos a él. Acoplamiento frágil y no documentado.
- **"Las cuentas de retención están corridas respecto del blueprint"** → el blueprint propone `1.1.10-1.1.13`, prod usa `1.1.11-1.1.14` porque **`1.1.10` estaba ocupada**. El trigger las busca donde están. El documento es el desactualizado.
- **"El bug de columnas rotadas de `clientes` se filtra fuera de api.js"** → barrido exhaustivo: solo `api.js:37` y `api.js:2839` leen esas 3 columnas, y ambos remapean. Los 9 accesos directos y 10 embeds fuera de api.js piden **únicamente** columnas no rotadas. Los INSERT/UPDATE escriben rotado, **consistente** con la lectura.
- **"`venta_numerador` con RLS ON y 0 policies es un bug"** → es **intencional y correcto**: `siguiente_numero_venta()` es SECURITY DEFINER con guard de rol y el `REVOKE`. Deny-all en la tabla es lo que se quiere.
- **"`vencimientos_recurrentes` está muerto"** → 0 filas, pero la UI está completa y el camino de pago usa el circuito único correctamente. Feature sin usar, no rota.
