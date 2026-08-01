# Detalle — Dominio OPERACIONES (Eventos · Proyectos · Rendimiento · RRHH · Taller)

> Auditoría integral 2026-07-31. Verificado contra prod (solo SELECT).
> **[×2]** = encontrado por dos agentes independientes.

---

## CRÍTICOS

### C6 · Borrar una jornada borra en cascada a toda la gente citada ese día — sin aviso, sin confirm, sin undo

- **Dónde:** `eventos.js:1346` (el 🗑 del modal "Editar jornadas") → `api.js:5611` (`setJornadas`) → FK en la base
- **Qué pasa:** el 🗑 hace `splice` sin confirmación; al Guardar, `setJornadas` ejecuta un **DELETE real** (no soft-delete, no `UndoHelpers`). La FK `asignaciones_evento_jornada_id_fkey` es **`ON DELETE CASCADE`**.
- **Cómo falla:** Leo abre las jornadas de "Feria del Libro Infantil" (4 días de armado), ve una fila que sobra, la borra y guarda. **Las 4 personas citadas ese día desaparecen.** No hay toast, no queda en `evento_historial` (solo se loguea "Jornadas actualizadas"), no hay Ctrl+Z, y la fila del modal no muestra cuánta gente cuelga de ese día.
- **Evidencia:** hoy hay **43 asignaciones colgando de un `jornada_id`** (Beauty Day 13, Campana 10, CAPPI 6…).
- **Arreglo:** mostrar el contador de personas por fila (`byJ[j.id].length`, **ya está calculado** en `_renderJornadasView`) y pedir `Confirm.action()` cuando la fila tiene gente. Idealmente FK a `ON DELETE RESTRICT`.
- **Esfuerzo:** S (confirm + contador) / M (con cambio de FK)

---

### C7 · El sync de jornales pisa la tarifa tipeada a mano — el candado `monto_editado` **no se activa nunca** [×2]

- **Dónde:** `rendimiento.js:485` y `:490` (setean el flag) · `api.js:7508` (lo consume)
- **Qué pasa:** `monto_editado` solo se pone en `true` si existe un ítem de catálogo (`catItem`) **y** su `tarifa_default` difiere de lo tipeado. **`evento_costo_catalogo` tiene 0 filas en prod** → `catalogo_id` siempre `null` → `catItem` siempre `null` → **`payload.monto_editado = false` siempre**.
  ```js
  rendimiento.js:485   if (catItem && Number(catItem.tarifa_default) !== payload.tarifa) editado = true;
  api.js:7508          const tarifa = row.monto_editado ? (parseFloat(row.tarifa) || 0) : rate;
  ```
- **Cómo falla:** Lelean edita el jornal de Adrián y pone $60.000 × 2 días = $120.000. Guarda: `monto_editado=false`. Cualquiera agrega después una persona a una jornada del evento → dispara `syncJornalesEvento` → recalcula `tarifa = rate` (el `costo_dia_referencial`, hoy **NULL en las 24 personas** → 0) → **el $120.000 se vuelve $0**. El toast dice "Jornales sincronizados: 1 nuevo · 8 actualizados", que suena a éxito.
- **Agravante:** el update **no chequea `estado` ni `egreso_id`**, así que también reescribe el monto de líneas ya "✓ Pagado" o ya migradas a Egresos → la planilla y el egreso en Finanzas dejan de coincidir. Y `dias` se pisa siempre, con flag o sin flag.
- **Caso ya sembrado en prod, listo para dispararse:** `aa252ccd… "Jornal — Adrián M. Fernández" | fase=armado | dias=2 | tarifa=100.00 | monto=200.00 | monto_editado=FALSE`
- **Arreglo:** sacar `catItem &&` del guard — si el usuario tocó el campo, es editado, haya catálogo o no; comparar contra el valor previo de la fila (`costo.tarifa`), no contra `tarifa_default`. Defensivo en `api.js:7508`: nunca recalcular una fila con `monto_pagado > 0`, `estado ∈ (pagado, parcial)` o `egreso_id` no nulo (el sync ya usa ese criterio para no *borrar*, pero no para no *reescribir*).
- **Esfuerzo:** S

---

### C8 · El taller **no puede tildar el checklist** → "Marcar listo" no se habilita nunca

- **Dónde:** `data.js:37` → `proyecto-detalle.js:95`, `:740`, `:780`
- **Qué pasa:** el rol `taller` está en `readOnlyPermissions` para `proyectos` → `_isRO = true` → `canEdit = false` → los checkboxes salen **`disabled`** y `_attachProduccionEvents` retorna antes de cablear nada.
  ```js
  proyecto-detalle.js:740 → const canEdit = !this._isRO;   // false
  proyecto-detalle.js:747 → <input type="checkbox" ... disabled>
  proyecto-detalle.js:780 → if (this._isRO) return;
  ```
  Y no hay otro lugar donde tildar: `setChecklistItemChecked` se llama **únicamente** desde `proyecto-detalle.js:802`. La vista galpón solo pinta la barra de progreso. `taller.js` — donde el taller tildaba — está borrado (commit `dbffc0d`).
- **Cómo falla:** el botón es progresivo y bien pensado (`pendiente → 🔨 Empezar armado`, `en_armado → ✅ Marcar listo` **solo si `allChecked`**). Como `allChecked` nunca es true, queda congelado para siempre en `Faltan N pasos` + Toast "Completá los pasos de producción antes de marcar listo".
- **Lo más doloroso: la base SÍ lo permite.** La policy `taller_checklist_all` es abierta, y el plan de la reorg lo dice explícito: *"`taller_proyecto_checklist` queda como está: el **tildar** del taller **funciona**; el lock fino es UI/API"* (`sql/reorg_a_nav_roles_rls.sql:37`). **El lock UI se puso y nunca se le abrió la excepción al taller.** Es una regresión de la disolución del módulo.
- **Arreglo (2 líneas):** el archivo ya tiene el patrón exacto para esta excepción — las fotos (`proyecto-detalle.js:777`: `this._ensureFotos(); // fuera del guard de RO: el taller (RO) igual sube fotos`). Replicar: `const canEdit = !this._isRO || this._isTaller;` y `if (this._isRO && !this._isTaller) return;`. `_isTaller` ya existe (`:22`, `:98`). El auto-estado `pendiente→en_armado` al primer tilde ya está escrito (`:796-801`) y `API.setEstadoTaller` ya notifica al PM.
- **Esfuerzo:** S

---

## ALTOS

### A13 · El puente asignaciones→jornales es un **no-op silencioso para `pm` y `venta`** — justo los que asignan gente [×2]

- **Dónde:** `eventos.js:1154`, `:1305`, `:1362` (los 3 callers con `.catch(()=>{})`) · `api.js:7402` · RLS de `evento_costos`
- **Qué pasa:** `evento_costos` tiene RLS `fn_role_can('finanzas','read'|'write')`. Los roles `pm`, `venta` y `taller` **no tienen la clave `finanzas`** en `roles.permissions`. `getEventoCostos` atrapa el error y devuelve `[]` (falla abierto); el INSERT rebota; `syncJornalesEvento` **devuelve** `{ok:false}` en vez de rechazar, así que los `.catch(()=>{})` ni siquiera se ejecutan — el resultado se descarta sin mirarse.
  ```
  pm → {"crm":"write","flota":"read","costos":"write","compras":"write","eventos":"write",...}  ← sin "finanzas"
  evento_costos_rls_ins  INSERT  WITH CHECK fn_role_can('finanzas','write')
  ```
- **Cómo falla:** Meli (pm) carga las 12 personas del armado. Ve el toast verde "12 agregadas". **El puente no escribió una sola línea.** Días después Lelean abre Rendimiento y la planilla de jornales está vacía. Sin forma de saberlo, salvo que ella (admin) apriete "🔄 Traer de asignaciones" a mano.
- **Arreglo:** mover el sync a un trigger `AFTER INSERT/DELETE ON asignaciones_evento` `SECURITY DEFINER` — es el lugar natural y elimina la dependencia del rol del que asigna. Alternativa: RPC `SECURITY DEFINER` con guard de `fn_role_can('eventos','write')` (+ el `REVOKE ALL … FROM PUBLIC, anon` que ya es regla). Mínimo: que el call site mire el `{ok:false}` y muestre un toast.
- **Esfuerzo:** M

### A14 · Ninguna de las 24 personas tiene tarifa cargada → **todo el costo de mano de obra vale $0** [×2]

- **Dónde:** `api.js:7469-7480` (`_getPersonasJornalMap`)
- **Qué pasa:** el puente lee `personas.costo_dia_referencial`, **NULL en las 24 filas vivas**. La columna paralela `personas.jornal_diario` (creada por `sql/eventos_jornal_sync.sql:12`) existe, está en `0.00` en las 24 y **ningún código la escribe** — el modal de RRHH escribe `costo_dia_referencial`. Dos columnas para lo mismo, la del SQL inerte.
- **Cómo falla:** el dashboard de ganancia por evento sale **inflado**: la mano de obra, de los rubros más pesados en un armado, computa $0. **14 de las 15 líneas de jornal en prod están en cero. Total de mano de obra registrada en todo el sistema: $200,00.** El módulo que reemplazó el Excel de Lelean está dando un margen falso hacia arriba.
- **Arreglo:** es carga de datos, pero el sistema debería gritarlo: si `rate === 0` para alguna persona, devolver los nombres y mostrar un toast de warning ("3 personas sin jornal cargado → líneas en $0, cargalas en RRHH → Nómina"); badge naranja en la columna Jornal de la Nómina. **Ojo al orden:** cargar las tarifas **después** de arreglar C7, o el primer sync post-carga reescribe montos ya conciliados.
- **Esfuerzo:** S (el aviso) + carga manual (el dato)

### A15 · La RLS de `personas` es `USING(true)`: cualquier logueado lee **y edita** CUIL, CBU, dirección y contacto de emergencia

- **Dónde:** policies `personas_select` / `personas_update` / `personas_insert` (`qual: true`, `{authenticated}`). El único control es `Auth.isAdminLevel()` en `rrhh.js:70`, que se saltea desde la consola.
- **Cómo falla:** un `taller` o `venta` abre F12 y corre `await supabaseClient.from('personas').select('*')` → las 24 filas con `cuil`, `cbu_alias`, `banco`, `dni`, `direccion`, `contacto_emergencia_*`, `costo_dia_referencial` y `situacion_previsional` de sus compañeros. Con `.update()` puede **cambiarle el CBU a cualquiera** — redirigir a dónde se le paga. `personas_delete` **sí** está bien cerrada (admin/superadmin), lo que muestra que fue descuido, no decisión.
- **Arreglo (con orden):** cerrarla de golpe rompe la asignación, porque `personas` la leen `eventos.js:1552` (modal de asignar, roles pm/venta/taller), `getChoferes` y `getPersonasOperativas`. Salida limpia: una **view `personas_publicas`** (id, nombre, apellido, telefono, tipo, roles_operativos, activo) con `security_invoker=true` abierta a authenticated, apuntar los consumidores operativos ahí, y dejar la tabla base solo para `rrhh`.
- **Esfuerzo:** M

### A16 · `ausencias`, `persona_documentos` y `vacaciones_saldos`: RLS `ALL USING(true)` — datos de salud legibles y **borrables** por cualquiera

- **Dónde:** policies `ausencias_all`, `persona_documentos_all`, `vacaciones_saldos_all` (`FOR ALL`, `qual: true`, `with_check: true`)
- **Cómo falla:** `ausencias.tipo` incluye `'enfermedad'` → datos de salud de empleados identificados, legibles por el rol `taller`. Y como es `ALL`, un `DELETE FROM ausencias` desde la consola borra el historial de licencias completo, **sin `_deleted`, sin audit**.
- **Estado:** las tablas están vacías hoy → daño potencial, no presente. **Es exactamente el momento de cerrarlo.**
- **Arreglo:** 4 policies con `fn_role_can('rrhh', …)`. Estas tres tablas **no las lee nadie fuera de `rrhh.js`** → cerrarlas no rompe nada. **Es el fix de menor riesgo de toda la auditoría y debería ir primero.**
- **Esfuerzo:** S

### A17 · Mover la fecha de armado **mata para siempre** el aviso de "faltan 7 / 2 días"

- **Dónde:** `notifyArmadoProximo` (claim `.is(col, null)`) · `api.js:812-847` (`updateEvent`, no resetea)
- **Qué pasa:** el aviso se reclama escribiendo `eventos.notif_armado_7d_at` / `notif_armado_2d_at`, y el barrido solo mira eventos con esa columna en `NULL`. `updateEvent` nunca las vuelve a poner en NULL cuando cambia `fecha_armado_inicio`.
- **Cómo falla:** Expo Retail (armado 20/08) dispara el aviso de 7 días el 13/08. El organizador corre la feria a septiembre. El 2/09 **nadie recibe el "armado en 2 días"** — el push de la matriz fila 7, el que cambia lo que hace el taller mañana — porque el claim ya está consumido. El evento entra en armado en silencio.
- **Evidencia:** 5 eventos con ambos claims consumidos (backfill 2026-07-31), 2 en NULL.
- **Arreglo:** en `_avisarCambioDeFechas` (que ya lee el "antes" y detecta el cambio), agregar `notif_armado_7d_at: null, notif_armado_2d_at: null` al patch cuando `fecha_armado_inicio` pasa a una fecha posterior a hoy.
- **Esfuerzo:** S

### A18 · El desarme multi-día se sigue colapsando a un día — y el `localStorage` tapa la columna real

- **Dónde:** `eventos.js:2816`, `:2830-2831` (escribe) · `eventos.js:364` (el merge que gana)
- **Qué pasa:** el fix del 30/07 protegió `setupEndDate` con `armadoEsMultiDia`, pero `teardownEndDate` quedó como estaba: se fuerza a `sTeardown.date` y se guarda en `localStorage` (`ev_ext_<id>`). En `_loadEvents` el merge es `{ ...e, ...this._getLocalData(e.id) }` → **el localStorage pisa la columna real `fecha_desarme_fin`** que escribió el trigger desde las jornadas.
- **Cómo falla:** un evento con desarme de 2 días. Alguien entra a "Fechas y horarios" solo a corregir una hora y guarda. **En ese navegador** el desarme pasa a 1 día para siempre — en la ficha, en el calendario operativo y en `_deriveEstado` — mientras la base sigue diciendo 2 días. Dos personas mirando la misma pantalla ven cosas distintas.
- **Arreglo:** aplicar el mismo criterio (`desarmeEsMultiDia`) y matar la clave `ev_ext_` (ya está la columna real, y `eventos.js:3275` ya tiene el cleanup escrito).
- **Esfuerzo:** S

### A19 · El transporte no sigue las fechas del evento — el camión queda reservado el día viejo

- **Dónde:** `eventos.js:2107` (input de fecha sin prefill) · `api.js:812-847`
- **Qué pasa:** `<input type="date" id="evTransFecha" value="${existing?.fecha || ''}">` — vacío al crear, sin default desde la fase elegida. Y cuando se mueve la fecha del evento, nada revisa ni avisa sobre los transportes ya cargados (`_avisarCambioDeFechas` solo consulta la tabla `eventos`).
- **Cómo falla:** se carga el camión para el armado del 10/06, la feria se corre al 17/06, el transporte sigue en 10/06, aparece en "Salidas de hoy" de Flota ese día, y el remito sale con la fecha vieja.
- **Arreglo:** prefill según la fase (armado → `setupDate`, desarme → `teardownDate`) y, en `_avisarCambioDeFechas`, listar los transportes que quedaron fuera de la nueva ventana.
- **Esfuerzo:** M

### A20 · La foto del remito firmado que sube el chofer **no se puede ver nunca más**

- **Dónde:** `eventos.js:1780-1799` (sube) · `eventos.js:1623-1625` (solo pinta un puntito) · `api.js:6239` `getRemitoSignedUrl` — **cero callers**
- **Qué pasa:** el bucket `remitos` es privado. Se sube la foto y se guarda el path en `evento_transporte.remito_firmado_url`, pero la única función que genera signed URL no la llama nadie y la fila no tiene botón "ver". Con el PDF pasa lo mismo: `_generarRemitoTransporte` abre el blob en el momento, pero al día siguiente el único botón es "📄 Generar remito" (lo regenera de cero).
- **Cómo falla:** el cliente discute qué se entregó. La conformidad firmada está en Storage y **desde el lobby no hay forma de abrirla** — hay que entrar al dashboard de Supabase.
- **Arreglo:** hacer clickeable el chip `● firmado` → `API.getRemitoSignedUrl(path)` → `window.open`. Es cablear una función que ya existe.
- **Esfuerzo:** S

### A21 · `detectarConflictosPersona` existe pero **el flujo que asigna gente nunca la llama**

- **Dónde:** `api.js:5411` (la función) · `rrhh.js:2087` (**único** call site, en el modal de ausencias) · `eventos.js:1288-1311` (el save de asignación, sin ninguna llamada)
- **Cómo falla:** Meli pone a Braian el 12/07 en el evento A. Leo pone a Braian el 12/07 en el evento B. Nadie ve un warning. El conflicto recién aparece como celda roja en RRHH → Planificación, **una pantalla que ni Meli ni Leo pueden abrir** (RRHH es admin-level). Braian se entera el día del armado.
- **Y además la función tiene 3 huecos:** (a) no compara ni informa `fase`; (b) **`.gte('fecha_fin', desde)` descarta las filas con `fecha_fin IS NULL`** → una asignación de fin abierto es invisible al detector (hoy 0 casos, pero `createAsignacionEvento` acepta `fecha_fin: null` por default); (c) no consulta `ausencias` → asignar a alguien de vacaciones da "sin conflictos".
- **Arreglo:** en `_openAsignarJornadaModal`, una consulta bulk (`.in('persona_id', [...])`) de asignaciones + ausencias en el rango y un chip rojo "⚠ ya está en X" sobre la persona. Warning, no bloqueo. Y usar `.or('fecha_fin.is.null,fecha_fin.gte.' + desde)`.
- **Esfuerzo:** M

### A22 · La Planificación oculta a 9 de las 14 personas que realmente trabajan

- **Dónde:** `rrhh.js:1674` (`_esOperativa`), `:1625-1628` · `api.js:5788`
- **Qué pasa:** la grilla filtra `p.estado === 'activo' && this._esOperativa(p)`, y `_esOperativa` exige `roles_operativos.length > 0`. En prod **solo 7 de 24** personas tienen el array cargado. El modal de asignación (`eventos.js:1552`) en cambio lee **todas** — de ahí que se haya asignado a gente sin roles.
- **Evidencia:** los tres con más asignaciones no aparecen en la grilla: Adrián M. Fernández (5 asignaciones, `roles={}`), Emanuel Páez (4, `{}`), Antonio D. Morales / J. A. Aguirre / J. G. Hernández (3 cada uno, `{}`). **La pantalla que existe para ver quién está libre muestra 7 personas y esconde a los 9 que más trabajan.** El empty-state solo aparece si la lista queda en cero, no cuando queda incompleta.
- **Nota:** ninguno de los 4 roles usados sale del catálogo canónico → el problema es **ausencia**, no divergencia.
- **Arreglo:** mostrar igual a las personas con asignaciones en la ventana, con un chip "sin rol" clickeable; badge naranja en la columna Roles de la Nómina.
- **Esfuerzo:** S

### A23 · El taller **no puede reportar falta de material** desde ningún lado

- **Dónde:** `proyecto-detalle.js:1066` (`${!this._isRO ? '<button id="pjdNovedadNueva">' : ''}`), `:606`, `:1095`
- **Qué pasa:** con `_isRO === true` para el taller, **no hay botón**. Entra al tab Novedades, ve las que le mandaron (`visible_para_taller`) y **no tiene forma de contestar ni de avisar que falta un material**. El widget `materiales-faltantes` del Lobby le muestra faltantes que solo la oficina puede cargar.
- **Lo único que sí puede:** la Quick Action "🛒 Pedir compra" (`pedido-compra.js`), que está **muy bien hecha** (2 taps, 1 textarea con placeholder concreto, va a la campana de admin) — **ese es el patrón a copiar**. Pero no queda ligado al proyecto: `createNotification` sin `entidadId`/`proyecto_id` → no genera la novedad `falta_material`, no aparece en `materiales-faltantes` ni baja el readiness chip.
- **Arreglo:** botón "⚠️ Reportar problema" en la bigcard del Lobby y en la card del galpón → modal clon de `PedidoCompra` (1 textarea + 3 chips) → `API.createNovedad({proyectoId, tipo, prioridad:'alta', mensaje, visibleParaTaller:true})`, que **ya existe y ya hace el fan-out** a PM + admin. 1 tap + 1 frase.
- **Esfuerzo:** M

### A24 · Los ítems de la entrega firmada **nunca prellenan** para el taller (la RLS le cierra las cotizaciones)

- **Dónde:** `api.js:9169-9184` (`getItemsEntregaByProyecto` lee `cotizaciones` + `cotizacion_items`) vs `sql/rls_capa2_comercial.sql:9` (*"taller NO lee `cotizaciones` ni sus hijas"*)
- **Cómo falla:** para el taller `items` vuelve siempre `[]`, el modal cae al mensaje *"No se encontraron ítems. Agregá los elementos manualmente"* y **Diego tiene que tipear a mano, en una tablet, en el predio, cada ítem del stand**: `+ Agregar ítem` → cantidad → descripción, uno por uno. Un stand de 15 ítems = **45 taps y 15 descripciones tipeadas**. Es exactamente el anti-patrón que el proyecto prohíbe.
- **Arreglo:** origen alternativo que el taller SÍ puede leer — el checklist de producción (`taller_proyecto_checklist`, policy abierta, ya en memoria como `this._checklist`). O una RPC `SECURITY DEFINER` que devuelva solo `{nombre, cantidad}` de la cotización, **sin precios**, sin violar la regla de plata.
- **Esfuerzo:** M

---

## MEDIOS (selección)

| # | Hallazgo | Dónde | Esf. |
|---|---|---|---|
| M21 | **`evento_costo_pagos` está en 0 porque el único camino vivo es un toggle que no genera nada**: "✓ Pagado" escribe un flag y explícitamente **no** crea egreso, comprobante ni asiento. Los 3 caminos que sí insertan (`_openPayModal:512`, `_openPagosModal:692`, bulk pay) son **inalcanzables** (`this._selected` nunca recibe un `.add()`). Finanzas no se entera de un peso hasta que alguien aprieta "Cerrar evento". | `rendimiento.js:344`, `:512`, `:692` | M |
| M22 | **Las asignaciones no siguen la fecha de su jornada**: mover un día actualiza `evento_jornadas.fecha` pero `asignaciones_evento.fecha_inicio/fin` quedan con la vieja. En prod: **10 asignaciones de "Feria del Libro de Campana" fechadas 2026-06-05** contra un armado que hoy es 06-10→06-12. Bonus: `_computeJornalLines` trata una asignación sin `jornada_id` como "todas las jornadas de su fase" → esas 10 facturarían 3 días. | `api.js:5601-5629` | S |
| M23 | **La encuesta cierra TODOS los stands del evento**, aunque sea de un solo proyecto (`WHERE evento_id = NEW.evento_id`). Un evento con 3 stands: el cliente del A responde y los stands B y C —uno todavía en armado— pasan a `cerrado`/100%. Además pisa `estado_taller` pero no `proyectos.estado`, y no deja rastro en `proyecto_actividad`. | `trg_encuesta_respondida_fn` | S |
| M24 | **`completitud_pct` puede divergir de `estado_taller`** y no se reconcilia nunca (el trigger solo dispara si cambia `estado_taller`; `updateProject` acepta el campo a mano). En prod: "Stand 2,00 x 2,00 en Univ. Siglo XXI" \| `pendiente` \| **50%** (el trigger daría 0). | `trg_proyectos_completitud_fn`, `api.js:754` | S |
| M25 | **Cambiar una fecha no deja rastro en ningún lado**: `logEventChange` está comentada y el trigger `log_evento_cambio` existe como función pero **no está attacheada a ninguna tabla** — y encima está rota (referencia `OLD.lugar`, `OLD.estado`, `OLD.fecha_desarme`, columnas inexistentes, e inserta con un shape que no es el real). "¿Quién movió el armado al 17?" no tiene respuesta. | `eventos.js:2821`, función zombie | S |
| M26 | **Borrar la última jornada de una fase deja las fechas del evento congeladas** (`WHERE ... AND s.fmin IS NOT NULL` ×3). Rehacer la planificación borrando todo deja el evento con la fecha vieja, y con ella el calendario, las alertas y las tareas del taller. | `fn_evento_jornadas_sync` | S |
| M27 | **`setJornadas` no es transaccional**: DELETE masivo + update/insert por fila, cada uno disparando el trigger de sync. Si falla en el medio, el evento queda con jornadas a medias **y** fechas derivadas de ese estado parcial. | `api.js:5601-5629` | M |
| M28 | **Anular una línea de jornal la vuelve inmortal**: el filtro de líneas existentes no excluye `estado='anulado'` → la línea anulada ocupa la clave `persona\|fase`, el sync la sigue actualizando y **nunca crea el reemplazo**. En prod ya hay 3 así, con sus personas todavía asignadas. | `api.js:7496`, `:7499` | S |
| M29 | **Tres vocabularios para la fase media**: `evento_jornadas` usa `evento`, `asignaciones_evento` usa `funcionamiento`, `evento_transporte` usa `intermedio`. Hoy funciona (dos traducciones separadas), pero cualquier join/filtro futuro por `fase` falla en silencio. | 3 CHECKs | M |
| M30 | **El circuito de aprobación de convocatorias es código muerto**: el único creador hardcodea `estado:'aprobada'` (y el modal lo dice al pie). El KPI "Convocatorias" dice siempre `0 · al día` y el banner nunca aparece → un admin concluye que no hay nada pendiente de revisar, cuando **no hay revisión en absoluto**. Prod: 40 asignaciones, **0 propuestas**. | `eventos.js:1299` vs `rrhh.js:1710`, `api.js:5545` | S |
| M31 | **El semáforo de documentación dice "al día" con cero documentos cargados**: `persona_documentos` vacía, el KPI calcula sobre un array vacío y renderiza `0 — al día`. La ART de los 24 operarios podría estar vencida hace un año. **Peor que no tener la card**: da una confirmación falsa sobre algo con consecuencias legales. | `rrhh.js:1422`, `:1437` | S |
| M32 | **Vacaciones se descuentan en días hábiles; la LCT las cuenta en días corridos** (art. 150). Diego con 28 días de saldo que se toma del 1 al 28/02 (28 corridos = 20 hábiles) va a ver `20/28` y "8 disponibles" cuando ya agotó el año. Para `franco`/`falta` el conteo hábil sí corresponde. *(Confirmar con Lelean: puede ser convención interna deliberada.)* | `rrhh.js:1858-1868` | S |
| M33 | **Cargar una ausencia no chequea si ya hay otra encima** (valida contra asignaciones, no contra la propia tabla) → se puede duplicar el mismo período de vacaciones y el saldo del año queda mal. El botón Guardar tampoco se deshabilita durante el await. | `rrhh.js:2078-2133` | S |
| M34 | **`createPersona` escribe `documento`, el modal de RRHH escribe `dni`** — dos columnas para lo mismo, y la ficha muestra `dni`. Una persona dada de alta desde Flota/Logística guarda el documento donde nadie lo lee. (Hoy ambas vacías: 0 y 0.) | `api.js:5810` vs `rrhh.js:1271` | S |
| M35 | **Borrar una persona deja sus asignaciones y jornales vivos y sin nombre** (soft delete de `personas` sin tocar nada más) → siguen contando en Planificación y en el costo del evento, ahora con "—". | `rrhh.js:1303-1314` | S |
| M36 | **El "remito del evento" no se guarda en ningún lado**: se genera, se abre en una pestaña y se pierde al cerrarla. (El de un transporte individual sí se sube.) | `eventos.js:1770-1778` | S |
| M37 | **El checklist dice ser editable y no lo es**: `addChecklistItem`/`renameChecklistItem`/`deleteChecklistItem` **sin un solo caller**, aunque el comentario diga "EDITABLE por proyecto". Y sus `item_key` ya están sucios en prod: `placas`→label "Muebles", `iluminacion`→"Infra", `mobiliario`→"Electricidad", varias con label NULL. | `api.js:6325`, `:6361`, `:6374` | S |
| M38 | **La RLS de `eventos` deja borrar cualquier evento a cualquier logueado** (`eventos_auth_delete USING true`), y `asignaciones_evento_update USING true` deja que un `taller` se reasigne solo. Desentona con la matriz `fn_role_can` que sí gobierna `evento_costos`. | policies | S |
| M39 | **Los checkboxes del checklist son `<input type="checkbox">` nativos sin tamaño mínimo** (~18px en Android) — es la interacción más repetida del taller. `mobile.css` no tiene ni una regla `.pjt-`, `.home-` ni `.tar-`: todo el responsive del taller vive inline en cada JS y ninguna auditoría de `mobile.css` lo va a cubrir. | `proyecto-detalle.js:745-751` | S |
| M40 | **La novedad crítica para taller no manda push**: `_fanoutNovedadNotifications` inserta directo en `notifications` y **nunca llama a `pushNotificarAviso`** (a diferencia de `avisar()`, que sí). Si la oficina marca "cambió la medida del stand, no lo cierres" con Avisar a taller, el celular de Diego **no suena**. | `api.js:4177` | S |
| M41 | **`_calcEdad` y `_calcAntiguedad` parsean fechas DATE como UTC** y pueden restar un día — el módulo tiene `_toLocalDate` justamente para eso y son las únicas dos funciones que no lo usan. | `rrhh.js:461`, `:472` | S |
| M42 | **Al taller se le muestra el NPS del cliente completo** (estrellas por aspecto, comentario) en el tab Entrega; solo se le esconde el botón "Generar encuesta". No le aporta nada operativo y puede ser incómodo. | `proyecto-detalle.js:1367-1421` | S |
| M43 | **"Seguir armando" del lobby taller lleva a `#tareas` genérico** (`data-nav="taller"`, ruta muerta que redirige) → se pierde el stand. Residuo de la disolución de `taller.js`. | `lobby.js:988` | S |
| M44 | **Los 2 tiles grandes del lobby taller no son clickeables** (`_tileBig` no emite `data-nav`), y `tile-armar-hoy` cuenta armados de **toda la empresa**, no los del taller. `para-hacer` corta en 6 sin "ver más" y no filtra por persona: los 4 del taller ven la misma lista de 12 stands. | `lobby.js:322`, `:971`, `:985`, `:599` | S |

---

## Cableado — el cambio de fecha del evento

Hay **dos caminos** que escriben las mismas 4 columnas, y uno le gana al otro en un momento impredecible:
- **Camino 1 — "Fechas y horarios"** del panel (`eventos.js:2757` → `API.updateEvent`)
- **Camino 2 — modal "Editar jornadas"** (`eventos.js:1355` → `API.setJornadas`) → el trigger `fn_evento_jornadas_sync` recalcula MIN/MAX y **pisa lo del camino 1**

| Origen | Debería impactar en | ¿Llega? | Nota |
|---|---|---|---|
| Cambiar `fecha_armado_inicio` (camino 1) | columna del evento | **SÍ** | |
| ídem | `fecha_armado_fin` si el armado es de 1 día | **SÍ** | guard `armadoEsMultiDia`, fix del 30/07 |
| ídem | `fecha_armado_fin` si es multi-día | **NO (a propósito)** | queda la ventana vieja → el rango puede quedar invertido |
| ídem | `evento_jornadas` (los días concretos) | **NO** | y **le van a ganar** al camino 1 en cuanto alguien las toque |
| ídem | `asignaciones_evento.fecha_inicio/fin` | **NO** | 10 filas fuera de rango hoy en prod |
| ídem | aviso `evento_fecha_cambiada` a pm+taller | **SÍ** | campanita ✓, push depende del deploy del VPS |
| ídem | aviso `evento_solapamiento` | **SÍ** | consulta la base, no el caché |
| ídem | recordatorio "faltan 7 / 2 días" | **NO** | A17 — el claim no se resetea |
| ídem | alertas "evento sin stands ≤7d" / "stands sin terminar ≤3d" | **SÍ** | se recalculan solas cada 5 min |
| ídem | tareas derivadas del taller (`fecha_limite`, prioridad) | **SÍ** | derivadas |
| ídem | estado derivado del evento | **SÍ** | |
| ídem | Calendario Operativo | **SÍ** | pero si el navegador está offline cae a un caché de `localStorage` con fechas viejas **sin marca de desactualizado** |
| ídem | `evento_transporte.fecha` | **NO** | A19 |
| ídem | `evento_historial` / `audit_log` | **NO** | M25 |
| Cambiar `fecha_desarme_inicio` | `fecha_desarme_fin` | **PARCIAL / roto** | A18 — el localStorage pisa la columna |
| Mover un día en "Editar jornadas" | `eventos.fecha_*` de esa fase | **SÍ** | trigger |
| ídem | aviso `evento_fecha_cambiada` | **NO** | el trigger no pasa por la API (el propio comentario de `api.js:864` lo advierte) |
| ídem | `asignaciones_evento.fecha_*` | **NO** | M22 |
| ídem | `evento_costos` (días de jornal) | **PARCIAL** | sí para admin, **no** para pm/venta → A13 |
| Borrar un día | asignaciones de ese día | **SÍ, destructivo** | C6 — cascada sin confirm ni undo |
| Borrar TODOS los días de una fase | fechas del evento | **NO** | M26 — quedan congeladas |

## Cableado — el estado del proyecto

Dos ejes independientes que la UI muestra como uno: `proyectos.estado` (ciclo de vida) y `proyectos.estado_taller` (ciclo de galpón).

| Origen | Debería impactar en | ¿Llega? |
|---|---|---|
| Cambiar `estado` | `proyecto_actividad` | **SÍ** |
| Cambiar `estado` | `completitud_pct` | **NO** (el trigger solo mira `estado_taller`) |
| Cambiar `estado` → `en_taller` | visibilidad para el rol taller | **SÍ** (la RLS lo habilita exactamente ahí) |
| Cambiar `estado` → sale de `en_taller` | el taller deja de verlo **aunque lo esté armando** | **SÍ, y sin aviso** |
| Cambiar `estado_taller` | `completitud_pct` | **SÍ** (el bug histórico de leer `OLD` **está corregido**) |
| Cambiar `estado_taller` | `proyecto_actividad` | **NO** → todo el ciclo de galpón no deja rastro |
| Cambiar `estado_taller` | notificación al PM creador | **SÍ** |
| Cambiar `estado_taller` | `proyectos.estado` | **NO** — divergen libremente (en prod: `estado:en_taller` + `estado_taller:cerrado`) |
| Cambiar `estado_taller` | Lobby (KPIs, cola, barras) | **SÍ** |
| Cambiar `estado_taller` | ficha del Evento / Calendario Operativo | **PARCIAL** (listan `estado`, no `estado_taller`) |
| Tildar un paso del checklist | `estado_taller` pendiente→en_armado | **SÍ** … pero **el taller no puede tildar** (C8) |
| Tildar del 2º al 6º paso | `completitud_pct` | **NO** (solo se mueve en el salto de `estado_taller`) |
| El cliente responde la encuesta | cerrar el proyecto | **SÍ — y de más** (M23: cierra los hermanos) |
| Registrar la Entrega firmada | `estado` / `estado_taller` | **NO** — firmar la entrega no cierra nada |

---

## Estado real de los datos de RRHH en prod

**Nómina (`personas`):** 25 filas, 24 vivas, 24 activas. 23 `interna` + 1 `eventual`, **0 cuadrillas**.

De 24 personas vivas: **con tarifa 0** · con `roles_operativos` **7** (17 sin) · con CUIL 22 · con fecha de nacimiento 22 · **con teléfono 3** · con DNI 0 · con fecha de ingreso 0 · con dirección 0 · con CBU 0 · con contacto de emergencia 0 · con situación previsional 0.

> Lectura: se hizo una carga masiva desde un listado de sueldos (nombre + CUIL + nacimiento) y nadie completó el resto. Consecuencias directas: la columna "Antig." muestra `—` para todos, el botón de WhatsApp aparece en 3 filas de 24, y el jornal computa $0 en todos los eventos.

**Asignaciones:** 40 vivas, **las 40 en `aprobada`** (cero propuestas). 29 ligadas a una jornada, 11 generales. **Cero solapamientos reales** hoy. 14 personas con al menos una asignación — y **9 de esas 14 no tienen roles operativos**.

**Jornales:** 15 filas vivas en 2 eventos. **14 con tarifa 0.** Total de mano de obra de todo el sistema: **$200,00**. 3 en `estado='anulado'` bloqueando su recreación. **Cero pagos** → la cadena jornal→egreso→asiento nunca se ejercitó con un jornal real.

**Ausencias / documentación:** 0 filas las dos. UI completa y funcional — es dato faltante, no código roto. `vacaciones_saldos`: 2 filas (David 14, Diego 28).

**Tablas legacy:**
- `rrhh_personal` (3): **migrada correctamente**, mismo UUID, con más datos que el original. Único resto en código: un embed `chofer:rrhh_personal!chofer_id` dentro de `getEventoTransporte`, función **definida y nunca llamada**.
- `rrhh_vacaciones` (2): **migrada**, los saldos coinciden.
- **`rrhh_asignaciones` (5): NO migrada — acá sí hay pérdida silenciosa.** Ninguna UI la lee. Al menos 2 registros sin equivalente: *Sacha → Estetica, "Chofer", 14→17/05/2026* y *David → Estetica, "Encargado de armado", 14→17/05/2026*. En la app hoy, Estetica figura con **una sola** persona en el armado. **Quién manejó y quién fue encargado está guardado en una tabla que nadie muestra.**
- `rrhh_vacaciones_solicitudes`: 0 filas, sin lectores. Dropeable.

---

## Fricción del taller — clics de hoy vs. lo posible

Navegación base en celular: **3 taps** para cualquier módulo (☰ → acordeón de categoría, que arranca cerrado → ítem). Las Quick Actions son la excepción: 2 taps.

| Flujo | Hoy | Con la propuesta |
|---|---|---|
| Ver qué armar | 0 (pero sin filtrar por persona) | 0 + míos arriba |
| Abrir un stand | 2 (y aterrizás mal) | **1** |
| Marcar un paso del checklist | **imposible** (C8) | **1** |
| Marcar un stand listo | 4 + bloqueado | **1** |
| Sacar foto del armado | **6** | **1** |
| Reportar un problema | **imposible** (A23) | **1** |
| Entrega firmada | **7** + 15 ítems tipeados | **2** + 0 tipeados |

**Los dos cambios de mayor palanca:**
1. **Meter checkboxes + 📷 + ⚠️ en la bigcard del Lobby** (`lobby.js:981-990`). Los datos ya están todos en memoria (`getChecklistsBulk` en `:984`). Convierte el Lobby del taller de tablero informativo en superficie de acción.
2. **Para `role === 'taller'`, la ficha arranca en Producción con 4 tabs** (`proyecto-detalle.js:102`). Un tap menos en cada flujo, gratis.

**Nota de seguridad (positiva):** no se detectó **ninguna** fuga de información económica hacia el rol taller. El blindaje (permisos + RLS + condicionales `_isTaller`) está bien puesto: número de cotización oculto, ítems de entrega sin precios, alertas de finanzas cerradas. El problema es el opuesto — el candado de solo-lectura sobre `proyectos` está apretado de más y le bloqueó las dos acciones que la base **sí** le permite.

---

## Falsos positivos descartados

- **"El bug de `setupEndDate = setupDate` sigue vivo y hay datos corruptos"** → **está arreglado** desde el 30/07 y **no queda dato corrupto**: los 5 eventos con jornadas tienen su ventana de armado correcta y coincidente con el MIN/MAX de sus jornadas. El trigger las reparó. Lo que sigue roto es el **desarme** vía localStorage (A18).
- **"`trg_proyectos_completitud_fn` lee el valor OLD"** → falso, usa `NEW` directo. El fix está aplicado.
- **"Los dos triggers de `encuestas_evento` se pisan"** → no. Postgres los dispara por orden alfabético, son independientes y ninguno lee lo que el otro escribe.
- **"`fase='funcionamiento'` vs `'evento'` es un bug de datos"** → es una diferencia de CHECK deliberada, normalizada en ambos sentidos y documentada en el código.
- **"El anti-doble-conteo de `getRendimientoDashboard` está mal"** → correcto: excluye por `evento_costo_pagos.egreso_id` **y** por `evento_costos.egreso_id`, y filtra `estado != 'anulado'`. Único hueco real: si se anula un egreso ya migrado, la línea de planilla sigue contando.
- **"Queda código vivo leyendo `taller.js` / `logistica.js`"** → no existen; las únicas referencias son comentarios.
- **"`taller_checklist` legacy tiene datos huérfanos"** → **0 filas**, igual que `taller_notas`, `taller_materiales`, `logistica_remito`, `evento_documentos`, `evento_rendimiento` y `evento_costo_catalogo`.
- **"Los 2 conformes firmados apuntan a proyectos borrados"** → no, ambos vivos.
- **"Los tabs Asignación y Vacaciones de RRHH siguen contra las legacy con banner"** (CLAUDE.md §6) → **falso y desactualizado**: hoy son 5 tabs y **ninguno** toca `rrhh_*`.
- **"El código lee una columna de tarifa que no existe"** → falso en la causa: existen **las dos** (`costo_dia_referencial` y `jornal_diario`), el código y el modal leen/escriben la misma. Los jornales dan $0 porque **nadie cargó el dato**.
- **"La migración RRHH→personas perdió datos"** (falso positivo histórico) → **sigue siendo falso**, ahora verificado sobre las tres tablas. La única excepción real es `rrhh_asignaciones`, y es pérdida de *visibilidad*: las filas están intactas.
- **"El personal eventual no puede cargar documentación → riesgo de ART vencida"** → es una **decisión de producto explícita** documentada; y 23 de 24 son `interna`.
- **"`_buildTrabAnio` mezcla UTC con fechas locales"** → el corrimiento es constante para todas las claves de un `Set` cuyo `.size` es lo único que se muestra. No es bug.
- **"`anon` tiene grants sobre `personas`"** → es el grant table-level por defecto de Supabase; todas las policies están scopeadas a `{authenticated}`. **El problema es el `authenticated`, no el `anon`.**
