# Detalle — COHERENCIA DE NÚMEROS · ROBUSTEZ · CÓDIGO MUERTO

> Auditoría integral 2026-07-31. Todas las discrepancias vienen con **los dos números reales de prod**.

---

# PARTE A — Los números no coinciden entre pantallas

### N1 · [CRÍTICO] "Saldo disponible" pierde $3.200.000 — `saldos_mensuales` no arrastra los meses sin movimiento
- **Dónde:** `finanzas.js:4585-4591` · `lobby.js:561-571` (copia literal) · `finanzas.js:4642` (tab Cuentas)
- **Números reales HOY:** `1.1.01 interno` → UI **$5.000.000** / verdad **$8.200.000**.
  KPI "Saldo disponible": toggle **Interno** muestra **$5.050.000** (verdad $8.250.000) · toggle **Total** muestra **$9.267.090** (verdad **$12.467.090**).
  Con toggle Oficial **no se nota** — el agujero está aislado en el bucket interno. Las otras 5 combinaciones cuenta/canal reconcilian exacto.
- **Cuál está bien:** la verdad. La partida doble cuadra al centavo; **lo roto es el materializado, que es un caché, no el libro**.
- **Arreglo:** SQL, en `fn_refresh_saldo_periodo`/`_cascada`. El JS de arriba está bien escrito.

### N2 · [CRÍTICO] El Lobby está clavado en canal Oficial y no lo dice — $5.000.000 de diferencia hoy
- **Dónde:** `lobby.js:514` `_canal() { return 'oficial'; }` **hardcodeado**, vs `finanzas.js:199` `_getCanalFilter()` (toggle real, persistido en `localStorage.finanzas_vista_canal`, compartido con `contabilidad.js:40`)
- **Y encima no hay chip que lo avise:** `_layouts.superadmin.toggle=false` / `_layouts.admin.toggle=false` → **el toggle del home nunca se pinta**. CLAUDE.md documenta un toggle que en el código está apagado.
- **Números reales HOY (julio 2026):** widget `pulso-financiero` "Cobrado mes" y `kpi-margen` del Lobby = **$0**. Panel de Finanzas con toggle Interno o Total = **$5.000.000**. Mismo usuario, mismo mes, dos pantallas. "Saldo" del Lobby = **$5.703.610** vs Panel en Total = **$9.267.090**.
- **Consecuencia:** un superadmin que dejó el toggle en Total **ve el home en cero y concluye que no cobró nada**.
- **Arreglo:** o el lobby lee el mismo `localStorage`, o pinta un chip "Oficial" fijo. **Lo barato y honesto es el chip.**

### N3 · [ALTO] Aging de cobros: dos implementaciones, $30.000.000 de diferencia
- **Dónde:** `finanzas._renderAgingChart` (`if (!item.fecha_estimada) return;` → **descarta**) vs `lobby.js:542-546` (`fecha_estimada ? … : 0` → las sin fecha caen en **"0-30 días"**)
- **Números reales HOY:** de las 8 cuotas pendientes, **7 tienen `fecha_estimada` NULL**.
  Gráfico de Finanzas: 0-30 **$0** · 31-60 **$0** · 60+ **$4.000.000** → total **$4.000.000**
  Aging del Lobby: 0-30 **$30.000.000** · 30-60 **$0** · +60 **$4.000.000** → total **$34.000.000**
- **Cuál está bien: ninguno de los dos.** El delator más claro: **el KPI "Por cobrar" al lado del gráfico dice $34.000.000 y el gráfico suma $4.000.000 — Finanzas no cierra ni consigo misma.**
- **Arreglo:** helper único `agingCobros(items)` con un **cuarto bucket "Sin fecha"**. Enterrar $30M en "0-30 días" es peor que descartarlos.

### N4 · [ALTO] Las notas de crédito suman en vez de restar — tres números para el mismo IVA
- **Dónde:** `finanzas.js:6095` · `lobby.js:530` · `finanzas.js:6723` · `contabilidad.js:4368` · `api.js getRendimientoDashboard`. **Ninguno mira `tipo`.**
- **Números reales HOY (junio 2026, 1 `factura_b` de $1.000 + 1 `nota_credito_b` de $1.000, ambas `emitida`):**
  - **Facturado del mes:** Panel y Lobby dicen **$2.000**; lo correcto es **$0**
  - **IVA débito:** Libro IVA **$347,10** · cuenta contable `2.1.02` **$173,55** · correcto **$0,00**
  → **Tres pantallas, tres números, cero facturación neta.**
- **La brecha extra** ($347,10 vs $173,55) es aparte: **la NC nunca generó asiento** (los 2 comprobantes emitidos están sin asiento).
- **Arreglo:** helper `signoComprobante(tipo)` → -1 para `nota_credito_*`, usado en los 5 lugares. Y que emitir NC genere su asiento.

### N5 · [ALTO] El EERR de Finanzas y el Balance de Contabilidad difieren **$4.777.363,55**
- **Números reales HOY (histórico, canal Total):**
  - Finanzas: ingresos **$15.201.000** − egresos **$2.783.910** = **$12.417.090**
  - Contabilidad: ingresos **$10.200.826,45** − egresos **$2.561.100** = **$7.639.726,45**
- **Descomposición exacta de la diferencia:**
  | Concepto | Monto |
  |---|---|
  | Anticipo que Contabilidad manda a `2.1.06` (pasivo) y Finanzas cuenta como venta | **$5.000.000** |
  | IVA débito que Finanzas mete dentro del ingreso | **+$173,55** |
  | IVA crédito que Finanzas mete dentro del gasto | **−$222.810** |
  | **Total** | **$4.777.363,55** |
- **Cuál está bien: Contabilidad.** Un cobro sin factura es deuda con el cliente, no resultado; y el IVA no es ni ingreso ni gasto.
- **Arreglo:** el EERR de Finanzas debería leer del plan de cuentas — **es literalmente el mismo reporte**. Parche: excluir lo mapeado a `2.1.06` y netear IVA.

### N6 · [ALTO] "Rentab. %" da 100% en 6 de 7 clientes
- **Dónde:** `finanzas.js:6816` (cliente) y `:6741` (proyecto): `cobrado > 0 ? Math.round(((cobrado - costo)/cobrado)*100) : 0`. **Costo 0 → 100%**, sin distinguir "no gastamos nada" de "no imputamos nada".
- **Números reales HOY:** Dolcemix $5.000.000 / **$0 costo → 100%** · Biofarma $2.000.000 → **100%** · AAAAC $1.500.000 → **100%** · Analia Grassi $1.200.000 → **100%** · Dermassy $500.000 → **100%** · Olavarría $1.000 → **100%**. **El único creíble es CAPPI (93%, $361.790 de costo).**
  Hay **$1.348.210 de egresos con `proyecto_id`** en la base, pero solo $361.790 caen en un proyecto con cliente y con cobros.
- **Peor:** el 100% de Dolcemix son los $5.000.000 de anticipo, **que ni siquiera es venta devengada**.
- **Arreglo:** `costo === 0` → mostrar `—` con tooltip "sin costos imputados", **nunca un porcentaje**. *(Trivial.)*

### N7 · [MEDIO] "Facturado" tiene **cuatro** definiciones distintas
| Dónde | Criterio | Canal |
|---|---|---|
| `finanzas.js:6095` + `lobby.js:530` | `estado='emitida'` | **sin filtro** (mientras Cobrado y Pagado, en la misma tarjeta, sí lo aplican) |
| `finanzas.js:6723` (Rent. por proyecto) | ídem | **sin filtro** (mientras Cobrado y Costo de esa misma tabla sí) |
| `api.js getRendimientoDashboard` | `estado NOT IN (anulada,error,rechazada)` → **incluye borradores y pendientes** | sin filtro |
| `api.js getVentaResumen` | Σ `plan_cobro_items.monto` de las cuotas con comprobante → **ni siquiera lee el total del comprobante** | — |
- **Hoy:** los 2 comprobantes están `emitida` → Panel = Rendimiento = **$2.000**. Un comprobante en borrador aparecería **solo** en Rendimiento. Y como `plan_cobro_items.comprobante_venta_id` está NULL en las 9 cuotas, **el "Facturado" de toda ficha de venta es $0 aunque haya facturas emitidas**.

### N8 · [MEDIO] El saldo del panel de la cuenta ignora el toggle; los movimientos de abajo lo respetan
- **Dónde:** `finanzas.js:4604-4606` `_calcularSaldo` → `_saldoCuentaContable(id, **null**)` = todos los canales
- **Números reales (Galicia MEPEX, toggle Oficial):** header "Saldo:" **$4.703.610** (arrastra los −$1.000.000 del canal interno) mientras el KPI del Panel cuenta esa misma cuenta en **$5.703.610**. **$1.000.000 de diferencia entre dos pantallas del mismo módulo** — y el running balance de abajo no llega a ninguno de los dos.
- **Arreglo:** pasarle `this._getCanalFilter()`. *(Un argumento.)*

### N9 · [MEDIO] "Por cobrar" excluye las cuotas facturadas; la alerta las incluye
- `finanzas.js:6147` y `lobby.js:531` → `in(['pendiente','parcial','vencido'])` · `alertas.js:482` → `in(['pendiente','parcial','**facturada**','vencido'])`
- Hoy 0 filas en `facturada` → no se ve. Pero **en el momento en que se facture una cuota, desaparece del "Por cobrar" del Panel y del Lobby mientras la campanita la sigue contando.**
- **Cuál está bien:** `alertas.js`. **Facturada es exactamente cuando más se cobra.**

### N10 · [MEDIO] Rendimiento por evento habla otro idioma que Finanzas en tres ejes
`api.js getRendimientoDashboard`: (a) **es el único lugar del sistema que usa `total_en_ars`** — todo el resto suma `monto` crudo; (b) cuenta como costo los egresos con `.neq('estado','anulado')` → **incluye pendientes y programados**, mientras Finanzas exige `estado='pagado'`; (c) **no filtra canal en ningún lado**.
Los tres están latentes, pero hay **1 egreso pendiente de $97 a un `evento_id` de distancia** de aparecer solo en Rendimiento. Con un ingreso de USD 1.000 @ 1.420: Rendimiento sumaría **$1.420.000**, Finanzas **$1.000**.

### N11 · [BAJO] `_renderRentCliente` mapea proyectos borrados
`finanzas.js:6803`: `from('proyectos').select('id, cliente_id')` **sin `.eq('_deleted', false)`** → un egreso imputado a un proyecto borrado sigue cargando costo al cliente. **Las otras dos queries del mismo método sí filtran.**

---

## Scope por rol en los widgets del Lobby

> **`taller` no ve plata en ningún widget** — correcto, verificado uno por uno.
> **El problema es otro: el home de `pm` y el de `venta` están 100% vacíos hoy, y lo dicen con mensajes que parecen buenas noticias.**

| Widget | Rol | Filtro | ¿Correcto? |
|---|---|---|---|
| `kpi-mis-proyectos`, `kpi-en-armado`, `kpi-montajes-7d`, `kpi-en-riesgo`, `mis-proyectos`, `carga-trabajo`, `pendientes-cliente`, `equipo-eventos` | pm | `responsable_id = uid` | **NO** — los 11 proyectos vivos tienen `responsable_id` **NULL**. Los 8 widgets dan 0 / "No tenés proyectos activos". **El home del PM está en blanco y parece "todo en orden"** |
| `cola-taller` | pm | `p.responsable_id === uid` | **NO** — mismo NULL |
| `kpi-conversion`, `kpi-cotiz-semana`, `fechas-clientes` | venta | `c.vendedorId === uid` | **NO** — las 18 cotizaciones tienen `vendedor_id` **NULL** (el cotizador no lo escribe). Conversión siempre 0% |
| `kpi-calientes`, `kpi-acciones-hoy`, `para-seguir`, `proximas-acciones`, `pipeline-temp`, `tiempo-respuesta` | venta | `getCasos({ownerId: uid})` | **NO** — los 4 casos tienen `owner_id` **NULL** → 0 filas. Los 6 widgets vacíos |
| `tile-armar-hoy` | taller | ninguno | **NO** — cuenta armados de **toda la empresa** |
| `tile-stands-taller`, `para-hacer` | taller | ninguno | **NO** — los 4 del taller ven los **mismos 5 stands**. Nadie sabe cuál es suyo |
| `agenda-proxima` | taller / venta | solo filtra si `role==='pm'` | **NO** — ven los 7 eventos de toda la empresa |
| `materiales-faltantes` | taller | `visible_para_taller=true` | **Sí** |
| `materiales-faltantes` | pm | `responsable_id === uid` | **NO** por el mismo NULL |
| `alertas-mias` | pm | `mods = null` → **todas** | **NO** — el PM ve alertas de finanzas, contabilidad y compras. **El widget se llama "Alertas de mis proyectos"** |
| `alertas-operativas` / `alertas-admin` | super / admin | por `moduleId` | **Sí** |
| Banda KPI, `pulso-financiero`, `cobros`, `pagos`, `posicion-iva`, `sueldos-mes`, `saldos-cuenta` | super / admin | rol | **Sí** — ningún rol operativo los tiene en su layout |

---

# PARTE B — Schema mismatch en runtime

> Método: **776 cadenas** `supabaseClient.from(...)` extraídas de los 56 `.js`, **779 pares (tabla, columna)** únicos cruzados contra `information_schema.columns`, y las 50 que dieron miss verificadas a mano.
> **29 embeds → los 29 tienen FK real. 8 RPCs → las 8 existen** con firma compatible.

| archivo:línea | Tabla | Lo que pide el código | Realidad en prod | Consecuencia |
|---|---|---|---|---|
| **`tareas.js:1581-1582`** | `eventos` | `.select('id, nombre, fecha_inicio')` + `.order('fecha_inicio')` | es **`fecha_evento_inicio`** | **400 en cada apertura del modal "Nueva tarea"** → el `catch` de `:1594` solo hace `console.warn` → **el desplegable "Evento" queda SIEMPRE vacío**. Ninguna tarea manual puede vincularse a un evento. **Es idéntico al caso `locaciones_documentos.tipo`** |
| **`api.js:3176`** | `categorias_config` | `.select('*').order('nombre')` | **la tabla NO EXISTE** | 400 → `getCategoriasConfig` lo traga → `[]` → `getEffectiveMargin` devuelve **margen 0** → el botón "Recalcular" de Costos escribe **`precio_cliente = costo_produccion`**. *Atenuante verificado: ningún módulo lee `precio_cliente` (el cotizador usa `precio_alquiler`) → corrompe un campo legacy* |
| `api.js:3197` | `categorias_config` | `.update(payload)` | ídem | `updateCategoriaConfig` sin caller. Código muerto, mismo agujero |
| **`alertas.js:172`** | `proyectos.estado` | 8 valores, **7 ilegales** | CHECK: `por_iniciar/en_proceso/en_taller/finalizado/rechazado` | Los 11 proyectos vivos son `por_iniciar`(6) y `en_taller`(5) — **ninguno está en la lista**. La alerta "proyecto trabado" devuelve **0 filas siempre**. **No tira 400** (un `in` con valores inexistentes es válido) → no deja rastro |
| `v_posicion_iva_mes` | `comprobantes.estado` | `ANY('aprobada','emitida','autorizada')` | solo `emitida/error/pendiente/anulada` | Ramas muertas de La PyME. `'emitida'` es legal → **la view funciona**. Basura, no bug |
| `tareas.js:458` | `proyectos.estado_taller` | incluye `'en_taller'` | ese valor es de `proyectos.**estado**` | Confusión de columnas; los otros 3 valores cubren el caso → sin impacto. Anotar |

---

# PARTE C — Errores que se tragan y **deciden algo**

> Recuento sobre las 776 llamadas: **212 propagan** · **16 solo loguean** · **26 bindean sin uso** · **522 (67%) ni siquiera desestructuran `error`**. De esas, **34 usan el resultado en un `if`/ternario/`.find`/`.length`**.

| archivo:línea | Qué decide | Qué pasa si el error se traga | Gravedad |
|---|---|---|---|
| **`api.js:5023`** `_recomputeOCGanadora` | Si hay presupuesto ganador vigente | `gan` undefined → cae al `else` → **`UPDATE compras_ordenes SET proveedor_uuid=null, proveedor_id=null, monto_total=0`**. **Un timeout te borra el proveedor y el monto de la OC.** Se dispara desde `deletePresupuesto` y `setGanadora`, o sea en el uso normal | **CRÍTICO — destructivo** |
| **`api.js:7813`** `registrarCobro` | Si sincroniza `monto_cobrado`/`estado` de la cuota | `item` falsy → se saltea el bloque → **el ingreso queda insertado y la cuota sigue "pendiente" por el total**. Devuelve **éxito** con `plan_sync:null` | **CRÍTICO — plata** |
| **`api.js:4877`** `createOrdenFromPedido` | El próximo `numero_oc` | `existing` undefined → `next=1` → **`OC-0001` de nuevo**. `numero_oc` **no tiene UNIQUE** → entra igual. **Ya pasó: prod tiene 5 OCs y solo 4 números distintos** | **ALTO — verificado en prod** |
| `api.js:4938` `createOrden` | ídem (alta desde Inventario) | ídem | ALTO |
| `api.js:2929` `createCotizacion` | El próximo `numero` COT | `last` undefined → `COT-YYYY-0001` → acá **sí hay UNIQUE** → el INSERT explota 23505 → `console.warn` → `return null`. **La cotización no se crea y el usuario no se entera del motivo** | ALTO |
| `api.js:3310` / `3357` `upsertListaRubro`/`Item` | "¿ya existe?" | `existing` undefined → rama `else` → **INSERT duplicado** en vez de UPDATE | ALTO |
| `api.js:5055` `_egresoForOC` | "¿esta OC ya tiene egreso?" | `catch { return null }` → responde "no hay" → **habilita un segundo egreso** por la misma OC | ALTO |
| `api.js:7389` `getEventoCostos` | Toda la planilla del evento | `catch → return []`. **Un rechazo de RLS (pm/venta) es indistinguible de "no hay líneas"** | ALTO |
| `api.js:7486` `syncJornalesEvento` | Si el puente corrió | **`return {ok:false}` en vez de rechazar** → los `.catch(()=>{})` de `eventos.js:1154/1305/1362` **nunca corren** → el fallo se pierde entero | ALTO |
| `api.js:8164` `duplicarPlanilla` | Cuántas líneas copiar | `src=[]` → "0 líneas duplicadas", igual que si el origen estuviera vacío | ALTO |
| `tareas.js:459/474/497/507/523/544` `_gen.*` | Qué genera cada fuente derivada | `undefined` → `return []` → **la fuente entera desaparece del Centro de Tareas sin un aviso**. Es la arquitectura exacta que dejó pasar el bug de `locaciones_documentos.tipo` | ALTO |
| `alertas.js:206/363/372` | Contadores de vencimientos | `count` undefined → la badge muestra **0 = "todo al día"** | MEDIO |
| `api.js:4660` `avisar` | Si el aviso llegó | `console.warn`, **no devuelve estado** → los 11 emisores no pueden saberlo | MEDIO |
| `finanzas.js:2707` `_loadClientesLookup` | Índice CUIT→cliente del facturador | índice vacío → **el autocompletado por CUIT al emitir factura no encuentra a nadie** | MEDIO |

### C-bis · `Auth.getUser().id` vs `.uid` — **la conciliación bancaria está 100% rota**

**`finanzas.js:11677`** → `conciliado_por: user?.id || null` sobre `conciliaciones.conciliado_por`, que es **UUID**.
Confirmado en `auth.js:242-245`: `profile.id = data.username` (`"fede"`), `profile.uid = data.id` (el UUID).
→ **`invalid input syntax for type uuid: "fede"` en el 100% de los guardados de conciliación.**
**Prod lo confirma: `conciliaciones` = 0 filas, `extracto_bancario_lineas` = 0 filas.**
Es el mismo bug que se cazó en `firmado_by` el 27/06, **todavía vivo en Conciliación**.
Latente igual: `contabilidad.js:5758` tiene el fallback `user?.uid || user?.id` — sacar el segundo término.

---

# PARTE D — Races, doble-submit y leaks

> El router (`router.js:283-288`) llama `destroy()` **solo** a 5 objetos: `CalendarioOperativo`, `CRM`, `ProyectoDetalle`, `VentasModule`, `VentaDetalle`. **Todo lo demás nunca lo recibe.**
> Patrón de referencia bien hecho: `venta-detalle.js:193-196` (`_vigente(container, token)` + `_reqId++` en `destroy()`).

### Races post-await

| archivo:línea | Secuencia que lo dispara | Qué queda mal |
|---|---|---|
| **`eventos.js:1046`** `_loadJornadasSection` | clic evento A → clic evento B antes de que resuelvan las 6 cargas | Busca `#evJornadasContent` **después** del await y `_openPanel` recrea el panel **con los mismos ids** → pinta las jornadas de A dentro de la ficha de B, y **"+ gente" queda atado al `eventoId` de A: agregás una persona al evento equivocado** |
| `eventos.js:452,498,1422,1579,1807` | ídem (docs, historial, proyectos, transporte, subalquileres) | `_attachDocsEvents(ev)` / `_attachTransporteEvents(id)` re-consultan el DOM vivo → **"+ Documento", "+ Transporte", "+ Subalquiler" crean el registro colgado del evento anterior**, sin error visible |
| `finanzas.js:4633` `_renderCuentaDetail` | Cuentas → "Movimientos" → clic en otro tab mientras calcula | El fallback `#finCuentaDetail \|\| #finanzas-content` es el detonante: **el detalle de la cuenta se pinta encima del tab nuevo** |
| `compras.js:1447` `_renderFichaOrden` | clic OC A → clic tab Proveedores | El tab dice Proveedores y el cuerpo muestra la OC A. **`this._ordenItems` queda con los ítems de A → Recepción/Recalcular de cualquier OC posterior opera sobre esa lista** |
| `compras.js:1062` `_renderFichaProveedor` | clic A → clic B | Editar/Eliminar del header apuntan a otro registro que el que se ve |
| `inventario.js:2302` | clic ítem A → clic ítem B | El panel de B muestra el historial de A y el stock de B. **Media ficha de cada uno — el más difícil de notar** |
| `rendimiento.js:140` `_loadEvento` | evento B → evento C antes de que cierren las 7 queries | Planilla y margen de **B** con el selector en **C**. **Pagar / agregar costo / cerrar evento se graban contra C con las filas de B a la vista** |
| `contabilidad.js:3082` `_loadLibroMayor` | cambiar de cuenta A a B rápido | Movimientos y saldo anterior de una cuenta bajo el encabezado de otra |
| `crm.js:2351` `_openCotPanel` | clic cotización A → B | El único hueco que quedó en CRM (`1809`, `3130`, `3178` sí guardean) |
| **`costos.js:1462`** `_openInsumoFicha` | clic insumo A → clic B mientras carga el historial | Ficha de A con `_activePanelData = B`: **"Guardar" (Ctrl+S incluido) escribe los campos visibles de A sobre el insumo B** |
| `finanzas.js:1876` `_renderTabContent` | clic tab Panel → clic tab Reportes | Las dos invocaciones se intercalan: charts sin canvas, botones sin handler. **Raíz común de los otros hallazgos de finanzas** — el arreglo de fondo es un `_tabReqId` acá |

### Listeners y timers que se acumulan

| archivo:línea | Qué se acumula |
|---|---|
| **`contabilidad.js:2301-2304`** | **El único acumulador ilimitado.** `_panelEscHandler` se asigna **sin remove-before-add** → abrir 12 cuentas del plan deja **11 listeners zombis irremovibles, para siempre**, cada uno llamando `_closePanel()` en cada ESC de toda la app. **Una línea de fix** |
| `notifications.js:104,105,116` | `reset()` limpia el interval pero **no** los 3 listeners anónimos → cada ciclo logout→login en la misma pestaña suma 3. Tras N sesiones, **cada vuelta de foco dispara N `refresh()` simultáneos**. Escenario real: la tablet compartida del taller |
| `admin-panel.js:362` | `setInterval` 60 s: si salís con el tab Dashboard activo, **sigue pegándole a la DB cada 60 s desde cualquier otro módulo, indefinidamente** |
| `crm.js:4465-4473` | El lightbox cuelga de `<body>`: navegar con una captura abierta deja **la imagen flotando encima del módulo siguiente** |
| `costos.js:411,412,4011,4015,4299,4313` | 6 handlers anónimos con flag once-only, **irremovibles**: una vez que entraste a `#costos`, **cada click de la app entera** corre `_closeQuickEdit()` + 4 `querySelectorAll` para siempre |
| `eventos.js`, `catalogo.js`, `inventario.js`, `finanzas.js`, `modules.js` (11 sitios) | No acumulan (remove-before-add) pero **quedan enganchados al salir del módulo**: un ESC en otro módulo ejecuta el `_closePanel()` ajeno |

> **Los dos arreglos de mejor relación impacto/riesgo:** (1) declarar `obj` + `destroy()` en el router para `finanzas`, `contabilidad`, `eventos`, `inventario`, `compras`, `costos` y `admin-panel` — cierra casi toda la columna y el timer huérfano; (2) el remove-before-add faltante en `contabilidad.js:2301`.

### Doble-submit

> Ninguna quema un CAE: la emisión unitaria (`finanzas.js:7931`) deshabilita el botón antes de cualquier `await`. **El daño está un escalón abajo, en lo que genera asientos.** Los chequeos de idempotencia de `api.js` son read-then-write → dos llamadas concurrentes pasan las dos.

| archivo:línea | Botón | Qué se duplica |
|---|---|---|
| `finanzas.js:9475` | "Generar egreso" (comprobante recibido) | **2 egresos + 2 asientos** por la misma factura |
| `finanzas.js:9506` | "Generar cobro" (comprobante emitido) | **2 ingresos + 2 asientos** |
| `finanzas.js:10550` | "Registrar pago" (vencimiento) | 2 egresos + 2 asientos; `vencimientos_generados.egreso_id` apunta a uno solo → **el otro queda huérfano e invisible** |
| `compras.js:1607` | "Generar egreso en Finanzas" (OC) | 2 egresos por la misma OC |
| `finanzas.js:9784` | "Endosar" cheque | 2 egresos + 2 comprobantes recibidos |
| `finanzas.js:12407` | "Crear registro" IVA recovery | **IVA computado dos veces en el libro** |
| `finanzas.js:11916/11935` | "Siguiente" pasos 2 y 4 de Conciliación | `_saveLineas` hace DELETE+INSERT sin transacción → **extracto duplicado** |
| `rendimiento.js:837` | "Duplicar" planilla | 2N líneas idénticas |
| `finanzas.js:5293` / `5384` | "Crear plan" / "Agregar" cuota | 2 planes por el total / 2 cuotas con el mismo `orden` |
| `compras.js:1859` / `268` | "Guardar" OC / "Crear OC" desde pedido | 2 OCs con el mismo `numero_oc` |
| `eventos.js:3015` | "Crear evento" | 2 eventos y, si el organizador es nuevo, 2 organizadores |
| `contabilidad.js:2458` / `5387` | "Guardar" cuenta / mapeo | cuentas y mapeos duplicados |
| `finanzas.js:8644` | "Emitir N en ARCA" (lote) | el flag `_loteEmitting` está **después** del `await Modal.confirm` → dos diálogos apilados (mitigado: exige confirmar dos veces) |

> Las cinco críticas comparten forma: **handler async en footer de modal, `await` a una API que crea plata, `Modal.close()` recién después.** Además del guard en el front conviene un índice único parcial sobre `egresos.comprobante_recibido_id`, `ingresos.comprobante_id` y `egresos.cartera_valor_id`.

---

# PARTE E — Versiones `?v=`: **el manifiesto está cacheado**

Los **47 módulos diferidos están todos bien**: verificado commit por commit que el último commit que tocó cada `.js` bumpeó su versión en `_APP_SCRIPTS` en el mismo commit. **Cero stale.** Y el orden respeta las dependencias.

**El problema está en el archivo que CONTIENE ese manifiesto:**

| Módulo | Última modificación | `?v=` actual | ¿Bumpear? |
|---|---|---|---|
| **`app.js`** (en `index.html`) | `f275601` 2026-07-31 + cambios sin commitear | **`v=16`, puesto el 2026-07-27** | **SÍ — es el bug** |

**`app.js` se modificó en 17 commits desde que se fijó `?v=16`** (toda la Fase 1 y 2 de Ventas, Tareas v2, push VAPID, el rework de notificaciones, el fix de Eventos).
Como `_APP_SCRIPTS` vive **adentro** de `app.js`, y `app.js` se sirve desde `index.html` con un `?v=` fijo, **un navegador que cacheó `app.js?v=16` sigue usando el manifiesto del 27/07** — o sea que **ninguno de esos 30-y-pico bumps de módulo llega**.

> **Es exactamente el síntoma "pulleé y sigo viendo lo viejo": los módulos se bumpearon con disciplina y el cartel que los anuncia quedó congelado.**

**Arreglo:** `app.js?v=17` en `index.html`, y de ahí en más bumpearlo en **cada commit que toque `_APP_SCRIPTS`**.

**Además, hay trabajo sin commitear** (`git status`): `api.js`, `cobranza.js`, `creditos-fiscales.js`, `finanzas.js` modificados, y `app.js` con los bumps correspondientes (`api.js` 96→97, `cobranza.js` 1→2, `creditos-fiscales.js` 1→2, `finanzas.js` 62→63). **Está consistente entre sí — pero si Fede pullea ahora se lleva `f275601`, que sirve las versiones viejas de esos cuatro. Hay que commitear los cinco archivos juntos.**

---

# PARTE F — Código muerto y duplicado

### F1 · El motor de costeo tiene **cuatro** implementaciones, no dos

| Implementación | Cableado desde |
|---|---|
| RPC `calcular_receta` (PL/pgSQL) — **la canónica** | `api.js:3988` ← el botón "Recalcular" real |
| `calculo-receta.js:35` | `api.js:3682` ← `recalcularEnCascada` (`api.js:3874`) ← **cambiar el precio de un insumo** |
| `api.js:2709 recalcularCostoItem` | suma pelada, sin MO ni amortización ni indirectos |
| `api.js:2746 recalcularTodo` | otro topológico con la misma suma pelada |

**Dos hallazgos nuevos, peores que la divergencia ya conocida:**
1. **`recalcularPorInsumo` está definido DOS veces en el mismo object literal** — `api.js:3434` y `api.js:3888`. En JS gana el último → **la versión de 3434 (49 líneas) es código muerto silencioso**. Nadie lo sabe porque no hay linter. **Es el único duplicate-key del repo** (verificado sobre los 55 archivos).
2. **El 3er motor quedó desconectado por un typo de id:** `costos.js:3471` hace `getElementById('costosRecetaRecalc')` pero el botón renderizado es **`costosRecetaRecalcBtn`** (`costos.js:2761`) → el listener nunca se engancha. Como el otro `getElementById` de la misma función **sí** existe, la función es viva y el fallo pasa desapercibido.

Además: `recalcularEnCascada` y `recalcularPorInsumo` son **el mismo Kahn topológico copiado** — el comentario de `api.js:3902` lo admite.

### F2 · Fechas: 2 copias con **bug de zona horaria vivo**

11 formateadores. Dos grupos: los que fuerzan hora local (`+'T00:00:00'`) y **los rotos**: `compras.js:844` y `locaciones.js:359` usan `new Date('2026-07-31')` = medianoche **UTC**.
Verificado con node en `America/Buenos_Aires`: `new Date(d)` → **"30 de jul"** vs `new Date(d+'T00:00:00')` → "31 de jul".
Verificado contra prod que las columnas son `date`: `compras_ordenes.fecha`, `compras_pagos.fecha_vencimiento`, `compras_pagos.fecha_pago`, `locaciones_documentos.fecha_vencimiento`.

**Impacto real: `compras.js:1146/1423/1513` (fecha de OC), `compras.js:2085/2087` (vencimiento de pago), `locaciones.js:617` (vencimiento de contrato), `locaciones.js:950` (vencimiento de documento) muestran todo un día antes.** En Compras es plata.
*(Los `created_at` de esos mismos archivos están bien — son timestamptz.)*

### F3 · Link de WhatsApp: 3 copias, las 3 distintas

| Copia | Lógica | Resultado |
|---|---|---|
| `crm.js:3621` | `d.length <= 10 ? '54'+d : d`, no saca el 0 | **un número de 11 dígitos no recibe código de país**; `01155667788` → `wa.me/01155667788`, **link roto** |
| `eventos.js:1702` | siempre `54`, nunca el `9` | incompleto para celulares |
| `rrhh.js:593` | saca el `0`, antepone **`549`** | **la única correcta** |

**El botón WhatsApp del CRM (el más usado, comercial) es el peor de los tres.**

### F4 · Otras duplicaciones verificadas con `diff`

| Qué | Copias | Diferencia |
|---|---|---|
| `_buildToggleAB` | `contabilidad.js:148` ≡ `finanzas.js:204` (25 L) | **solo el prefijo CSS** — y dos bloques CSS gemelos |
| Cargador de logo para PDF | **7 archivos** (`catalogo`, `conforme-pdf`, `contabilidad`, `finanzas`, `pedido-pdf`, `plano-pdf`, `remito-pdf`) | idénticos |
| `_jornadaDur` + `_fmtDiaFecha` | `eventos.js:1112/1122` ≡ `calendario-operativo.js:1119/1129` | idénticos. **Es lógica de negocio** (duración de jornada, cruce de medianoche) |
| `_initials` | `proyecto-detalle.js:2393` ≡ `proyectos.js:1357` | carácter por carácter |
| Color de avatar | `crm.js:3607` vs `tareas.js:922` | mismo hash, **paleta en distinto orden** → **la misma persona cambia de color entre Tareas y CRM** |
| `_ensureEquiposStyles` | `inventario.js:1538` ≡ `locaciones.js:661` (38 L de CSS) | inyectado dos veces con ids distintos |
| Formateo de moneda | **20 implementaciones, 4 formatos** | `ventas.js:60` redondea y `venta-detalle.js:350` muestra centavos → **la misma venta se lee distinto en la lista que en su ficha**, y son del mismo sprint |
| IVA 21% | **6 hardcodeos, 3 redondeos distintos** | `crm.js:2454` redondea a pesos enteros. No hay constante, mientras el sistema ya soporta 10,5% |

### F5 · `crm.js:1294 _escHtml` — XSS vivo en ~23 atributos

| Archivo | ¿Escapa comillas? | ¿En atributos? | Riesgo |
|---|---|---|---|
| `components.js:22` `escHtml`/`escAttr` (global) | **SÍ** | — | **canónico** |
| **`crm.js:1294 _escHtml`** | **NO** — `textContent`→`innerHTML` | **SÍ, ~23 sitios** (`value=`, `title=`, `alt=`) | **🔴 EL PEOR — vector vivo.** Un cliente guardado como `" onfocus=alert(1) autofocus x="` rompe el `value` del form. **Irónico: el mismo archivo define `_escAttrSafe` (`:4579`) que delega al global** — arreglo a medias que nunca se propagó |
| `compras.js:801`, `eventos.js:3287`, `notifications.js:624` | NO | no (solo texto) | deuda latente |
| resto (12 helpers) | sí | sí | OK |

**Bonus:** `eventos.js:2331` y `:2363` interpolan `${d.nombre}` (nombre de documento) **sin escapar nada** → inyección de HTML directa desde la tabla de docs del evento.
**`_safeUrl`** existe solo en `venta-detalle.js:404` y `creditos-fiscales.js:265`. Los otros **11 sitios vivos** meten una URL de la DB en `href` sin validar esquema.

### F6 · Stubs y botones que no hacen nada

| archivo:línea | Qué promete | Qué hace |
|---|---|---|
| `inventario.js:2167` | "Registrar movimiento" | `Toast.info('próximamente')` |
| `rendimiento.js:512-721` (**210 L**) | Pagar línea / en lote / ver pagos | **Inalcanzable** — `this._selected` solo recibe `.clear()` y lecturas, **cero `.add()`** |
| `compras.js:1988-2206` (**219 L**) | Pestaña "Pagos" | Inalcanzable — no hay `data-tab="pagos"` y `compras.js:44` redirige a `ordenes` |
| `crm.js:587` / `contabilidad.js:1934` | placeholders "Próximamente" | Sin callers / `default:` de un switch que ya cubre los 8 tabs |
| `api.js:6325/6361/6374` | checklist "EDITABLE" | **Cero callers** (47 L) |
| `api.js:6239 getRemitoSignedUrl` | ver el remito firmado | **Cero callers** → la foto no se puede abrir nunca |
| `api.js:6786 deleteCobroAplicacion` · `api.js:9416 deleteVenta` | — | **Cero callers**. `deleteVenta` es **el método mejor blindado del repo** (candado de estado, de comprobantes, `UndoHelpers`) **y no lo llama nadie** |
| `api.js:988` + 15 fn de `cargas`/transporte | — | **Cero callers (439 L)** |
| `api.js:4046 recalcularTodasRecetasRPC` | recálculo masivo | Cero callers — `costos.js:3285` rehace el loop a mano |
| `data.js:130 recentActivity` | actividad del lobby | Cero lectores — mock que igual viaja al browser |

### F7 · **`modules.js` está MUERTO ENTERO** — 4.321 líneas, 212 KB

No es solo la línea 3650. `Modules.render` **no tiene ruta y no tiene un solo caller**; `refreshCurrentView` corta con `if (!this.currentModule) return` y `currentModule` solo se asigna en `render()`; `_openCreateModal` solo lo llama `app.js:548` bajo `data-action-type="create"` y **ningún `quickAction` de `data.js` usa `action:'create'`** (el sidebar se arma directo de `Data.categories`, sin localStorage).
**Acción:** sacarlo de `_APP_SCRIPTS`. Es el más barato de sacar: **una línea**.

### F8 · Restos asimétricos (lo peligroso)

| Tabla/símbolo | Muerto en | Vivo en | Qué rompe si se limpia mal |
|---|---|---|---|
| **`compras_pagos`** | `compras.js:1988-2206` — y ahí está **el único writer** | `alertas.js:265` (badge de Compras) y `api.js:4592` | Dropear rompe el badge. **Y como el único writer está muerto, la tabla no puede recibir filas nuevas** → la alerta consulta cada 5 min algo que ya nunca va a disparar |
| **`taller_proyecto_checklist`** | 3 de 7 fn de api.js | **6 call-sites vivos** (`lobby.js`, `proyectos.js`, `proyecto-detalle.js`) + `alertas.js:220` + `tareas.js:456/1100` | **Trampa de patrón.** Empieza con `taller_` pero **no es legacy** — es la fuente de la pestaña Producción, el galpón y las tareas derivadas. **Un barrido "todo lo `taller_*` afuera" rompe 5 pantallas** |
| `rrhh_personal`, `logistica_*` | `api.js:988-1103`, cero callers | nada en JS | Se pueden dropear, **pero `docs/DROP_CHECKLIST.md` las marca "BLOQUEADAS" citando `eventos.js:1878 _openAddMovimientoModal`, función que ya no existe** → el doc frena un drop que hoy es seguro |
| `cargas`/`carga_*` | 15 de 16 fn sin callers | `api.js:5904 getCargaById` ← `remito-pdf.js:177` (rama de fallback) | *[PROBABLE]* el `transId` siempre viene de `evento_transporte` → la rama no se ejercita. Loguearla unos días antes de dropear |
| **`lapyme_response`** | — | **`finanzas.js` ×9 — columna JSONB VIVA que ARCA reusó** | **Falso positivo del grep `pyme_`. Borrarla con la purga de La PyME rompe la facturación actual** |
| `inventory_items`, `locations`, `payments`, `octexa_piezas`, `pyme_sync_log`, `rrhh_asignaciones`, `rrhh_vacaciones`, `compras_proveedores` | — | — | **Cero referencias en JS.** Libres desde la app |

### F9 · CSS muerto

- **1.873 clases** definidas entre `style.css` (15.830 L), `MEPEX_COMPONENTS.css` (520 L) y `mobile.css` (665 L).
- **652 (35%) no aparecen ni una vez** en ningún `.js`/`.html`. Otras 141 quedan como *[PROBABLE]* (podrían construirse por concatenación).
- En líneas: **~36% de las reglas ≈ 6.100 líneas ≈ 140 KB** de los 391 KB de CSS.
- Top por prefijo: `.costos-*` 73 · `.taller-*` 69 · `.log-*` 60 · `.lobby-*` 58 · `.pk-*` 54 · `.pj-*` 45 · `.rh-*` 34 · `.settings-*` 26 · `.sidebar-cat-*`/`.se-*` 16 (restos del sidebar-editor borrado).
- **Los 4 pendientes anotados: CONFIRMADOS MUERTOS, pero no están en `style.css`** — viven en el `<style>` inline de `crm.js`. El último es didáctico: el JS emite **`caso-pcard-cli2`** y la regla vieja quedó al lado.
- **Hallazgo estructural: hay al menos 4.094 líneas de CSS adentro de los `.js`** (`finanzas.js` 1.659 · `inventario.js` 883 · `crm.js` 359+ · `proyectos.js` 292 · `catalogo.js` 248…). **Cualquier barrido que mire solo los 3 `.css` se pierde ~20% del CSS del proyecto.**

### F10 · Peso muerto

**Payload real:** 4.575 KB de JS propio (54 archivos) + 391 KB de CSS = **~4,9 MB sin comprimir**, todo al browser, sin bundler ni tree-shaking.

| Qué | Líneas | ~KB |
|---|---|---|
| `modules.js` completo | 4.321 | **212** |
| `api.js` — transporte/`cargas` legacy (16 fn) | 439 | 22 |
| `api.js` — motores de costeo muertos + `recalcularPorInsumo` sombreado | 187 | 9 |
| `api.js` — 6 métodos sin callers | 101 | 5 |
| `compras.js` — pestaña Pagos | 219 | 11 |
| `rendimiento.js` — paybar + 3 modales | 210 | 10 |
| placeholders + `Data.recentActivity` | 30 | 2 |
| **Subtotal JS muerto** | **~5.507** | **~271 KB** |
| CSS con clases sin emisor (~36%) | ~6.100 | ~140 KB |
| **TOTAL** | **~11.600** | **~411 KB** |

**≈ 8,3% del payload es código que no se puede ejecutar ni aplicar.** `modules.js` solo es la mitad — y es el más barato de sacar.

---

## Falsos positivos descartados

- **44 de los 50 "schema mismatch" candidatos eran artefactos del parser** (dentro de un `Promise.all([...])` la captura de cadena se pasa de largo y atribuye columnas de una query a otra tabla). Verificados a mano los 6 clústeres.
- **Taxonomías de `fase` distintas entre tablas** → parecía trampa segura, pero **`_computeJornalLines` ya la normaliza** con un `NORM` y un comentario explícito. Resuelto.
- **Columnas rotadas de `clientes`** → **auditados todos los caminos, no hay ninguno sin mapear.** La única query cruda que toca la terna es `api.js:2838`, y su comentario muestra que es consciente.
- **`contabilidad.js:2704` (totales del Libro Diario)** → **NO trunca**, ya está paginado desde la Fase 12.D.
- **`api.js:3670 updateParametroGlobal`** → **sí invalida** el caché (`delete this._cache['parametros_globales']`).
- **`lobby._hydrate` (`lobby.js:475`) no es un race** aunque tenga la forma exacta: `render()` reescribe `content.innerHTML` entero, así que el `mount` viejo es un nodo detachado.
- **El caché `_memo` del lobby no ensucia entre renders** (`ctx` se crea nuevo en cada `render()`).
- **`finanzas.js:4999-5000` y `crm.js:8247` no dividen por cero** — llevan `|| 1`.
- **`kpi-dias-caja` no da Infinity** — cortocircuita con `'∞'`.
- **Los listeners sobre nodos que se reemplazan con `innerHTML` no son leaks** — mueren con los nodos. Igual que el reporte viejo de "listeners duplicados en equipo de eventos", falso por la misma razón.
- **`calendario-operativo.js` es el único módulo no-CRM con el ciclo de teardown completo.** No tocarlo.
- **La emisión unitaria en ARCA no tiene doble-submit**, ni guardar ingreso/egreso/transferencia/comprobante/cheque.
- **Los 8 RPCs y los 29 embeds** → todos verificados contra `pg_proc` y `pg_constraint`. Cero problemas.
- **La partida doble está sana.** Todo lo de la Parte A son diferencias de **presentación y de criterio entre pantallas**, no corrupción contable — con la única excepción de `saldos_mensuales`, que es un caché.
