# HANDOFF — Capa operativa: integración + pulido de pantallas + notificaciones

> **Para retomar en una charla NUEVA.** Continuar con `PROGRESO.md` (ETAPA II, entradas `[E2]`) + `PLAN-SUPERIOR.md`.
> **Arranque:** preguntar si se hace `git fetch origin && git reset --hard origin/main` (sesiones paralelas). `importar-3dsmax.js` es untracked y sobrevive.
> Fecha: **2026-07-04**. Baseline al cierre: `main` @ commits de la sesión 2026-07-04 (Tareas pulido `4dbd004` · equipos por galpón `07c093a` · comprar→stock `633a3d4`).

---

## 🎯 Objetivo (de Fede, textual)
Dejar TODA la capa operativa —**Inventario, Locaciones, Flota, Tareas, taller/galpón, Transporte**— **bien hecha, integrada y andando junta**, con **todas las pantallas pulidas**. Y construir el sistema de **notificaciones por evento y por rol** (qué cosas suceden → quién se entera, según el rol). "Que sea más fácil, más simple todo."

## 🗺️ El sistema operativo (un solo circuito)
**Compras** (comprar) → **Inventario** (stock: insumos + **equipos**) → **Locaciones** (galpones) + **Flota** (vehículos) → **Proyectos vista-galpón** (taller arma stands) → **Tareas** (bandeja diaria de cada rol) → **Eventos Transporte** (llevar al predio). Los ex módulos **Taller y Logística fueron DISUELTOS** (el rol taller vive).

## ✅ Ya hecho (NO rehacer)
- **Reorg capa operativa** (jun 2026): Taller→Proyectos galpón + Tareas; Logística→Transporte en la ficha del Evento; Equipos operativos = tab de Inventario; motor de **Rutinas** de mantenimiento en Tareas (`fn_avanzar_rutina`).
- **Regla galpón/oficina por rol** = implementada **triple** (client-side `tipo IN (taller,deposito)` + RLS policies separadas + permiso de módulo `read`). Taller ve galpones/depósitos **read-only**, NO la oficina. Admin/super ven todo. → confirmado esta sesión.
- **Sesión 2026-07-04:** Tareas pulido (`tareas.js?v=10`), equipos por galpón (`locaciones.js?v=8`/`api.js?v=70` `getEquiposByUbicacion`), **comprar→stock + recepción incompleta** (`compras.js?v=13`/`api.js?v=71` `recibirOrdenCompra`, ⛔ SQL `sql/compras_stock_recepcion.sql`), freebie alertas stock (`alertas.js?v=7`). Detalle: `PROGRESO.md` §2026-07-04 + memoria `project_capa_operativa_integracion`.
- **Fase 7** (contabilidad) cerrada de fondo el 2026-07-03 (mapeos + guard doble-conteo + candado ⛔ `sql/fase7_bloqueo_ejercicio.sql`).

## 🧭 Método
- Skill **`pulir-pantallas`** (mostrar render REAL → OK de Fede → aplicar; NUNCA mockup trucho). Si Fede dice "meterle duro con Sonnet", delegar builds a agentes Sonnet 5 y **revisar cada diff** (este repo tiene muchos falsos positivos de agentes — verificar contra `docs/schema-prod.md` + prod).
- **SQL-first** en fases con DDL. Verificar en **preview** por `preview_eval` (screenshots y PDF cuelgan el headless → usar eval + computed styles). Commit incremental + push `origin HEAD:main`. Al cierre: PROGRESO `[E2]` + descontar en PLAN-SUPERIOR + memoria.
- Árbol compartido: `git add` SOLO lo propio.

---

## 🎨 FRENTE 1 — Pulido de pantallas (catálogo con file:line)
Referencia de "pulido" = Eventos/Proyectos/Finanzas-Facturación.

- **Tareas** ✅ (2026-07-04, clases `.tar-*`, `_ensureStyles`).
- **Inventario** (`inventario.js`) — **EL MÁS CRUDO.** Shell NO-estándar: mete un `<style>` con clases `.inv-*` DENTRO de `_buildShell()` (~105-966) + breadcrumb con SVG hardcodeado a mano (~936) + tabs con emoji. **Placeholder muerto VISIBLE en prod:** "Proyección de materiales — Próximamente" (`_renderDashboard` ~3241). 5 tabs (dashboard/piezas/materiales/equipos/movimientos/físico). → llevar al patrón estándar `.module-view`/`.module-subheader`/`.section-tab` + sacar el placeholder. **Bug menor:** tags `<\span>`/`<\button>` — resultó FALSO POSITIVO de agente (verificado: el código está bien).
- **Compras** (`compras.js`) — shell estándar OK, pero **sin KPIs de cabecera** en ningún tab (Proveedores/Pedidos/Órdenes arrancan en tabla). CSS mixto: la mayoría en `style.css` `.cmp-*` pero Pedidos inyecta en runtime (`_ensurePedidoStyles`). Comentario de cabecera desactualizado (~5, dice "3 tabs Proveedores/OC/Pagos").
- **Locaciones** (`locaciones.js`) — decente; la **vista operativa del taller** (`_renderOperativa` ~212) es pobre vs las cards de Eventos (sin KPIs, listado simple). Ya se le sumó el bloque de equipos (2026-07-04).
- **Flota** (`flota.js`) — shell estándar + `<style>` inline (`_injectStyles` ~577, `.flota-*`). Vista única sin tabs (master-detail tabla+panel). **Nunca pasó por pulido dedicado.** Falta **KPI/banner de vencimientos a nivel módulo** (hoy semáforo solo por-fila `_venc` ~552). Loading/empty states genéricos.

---

## 🔗 FRENTE 2 — Integración (costuras, con file:line)
- **Comprar→stock** ✅ · **Equipos↔galpón** ✅ (ambos 2026-07-04).
- **Pedidos → solo insumos**: `compras_pedidos`/`compras_orden_items` linkean solo a `insumos_base`; pedir una **pieza (`catalogo_items`) o equipo** cae a texto libre. Extender el picker.
- **Progreso de producción 2×**: `taller_proyecto_checklist` se consulta en el galpón de Proyectos (`proyectos.js:348`) Y en `tareas.js._gen.taller` (~211) — 2 queries del mismo estado, sincronizadas solo en la escritura. Unificar a un helper compartido.
- ~~**3b.2 proveedores UUID**~~ ✅ **SALDADA.** Verificado 2026-08-02 (T6 de la auditoría): **cero** `from('compras_proveedores')` en todo el repo — `compras.js` ya opera sobre `proveedor` (UUID). Quedan sólo dos menciones en comentarios y el puente `compras_proveedor_id`. Esta línea decía que la migración estaba pendiente y hacía que se planificara una "pasada dedicada, all-or-nothing, riesgosa" que ya no hace falta.
- **Flota ↔ Transporte del Evento**: el chofer del transporte es **texto libre** (`eventos.js:2084`, `chofer_nombre`/`chofer_telefono`), NO linkea a `vehiculos.chofer_habitual_id`→`personas`. Y el alta de vehículo **ad-hoc** desde el modal de Transporte (`api.js:7480` `crearVehiculoAdhoc`) bypassa la ficha de Flota. → precargar chofer habitual del vehículo elegido + enriquecer campos.
- **Equipos sin alerta**: `equipos.estado='fuera_de_servicio'`/`en_reparacion` no lo consume ningún motor (ver Frente 3, gap #2).
- **`inventario_movimientos`** no traza el origen de una OC (no hay `orden_id`) — hoy `recibirOrdenCompra` pone `notas:'OC <n>'`. Si se quiere FK real, columna nueva.

---

## 🔔 FRENTE 3 — NOTIFICACIONES por evento y por rol (el pedido GRANDE de Fede)

### Infra existente = 3 mecanismos, HOY inconsistentes entre sí
1. **Notif push** — tabla `notifications` (`tipo`·`titulo`·`mensaje`·`target_role`·`target_user_id`·`entidad_tipo/id`·`link`·`prioridad`·`leida_por` jsonb·`expires_at`). Campana `notifications.js` (polling 30s + refresh on focus; filtra `target_user_id=uid OR target_role=rol OR target_role null`; superadmin ve además `admin`). Se crean con `API.createNotification` (`api.js:3916`). **Solo 1 trigger SQL** (encuesta NPS, `sql/encuesta_proyecto.sql:36`); el resto depende de que el CÓDIGO CLIENTE pase por el flujo (si alguien escribe directo a la tabla base, NO notifica).
2. **Alertas calculadas** — motor `alertas.js` (Fase 9), un generador por módulo con `_visibility` por rol, recalcula cada 5 min. Alimenta los dots del sidebar + tab "Pendientes" de la campana. Sin persistencia.
3. **Tareas derivadas** — `tareas.js._gen*`, 1 tarea claimeable por ítem, ruteadas por `target_role`.

### Qué notifica HOY (resumen; matriz completa abajo)
- **Notif push:** pedido de compra→admin · asignación propuesta/aprobada · vehículo tercero→admin · carga creada/aprobada/remito→admin+pm · proyecto pasa a taller→taller · stand listo→pm · @mención→usuario · tarea asignada→usuario/rol · encuesta NPS→pm+admin (trigger SQL).
- **Alerta + tarea:** stock bajo→admin · doc locación por vencer→admin · cotización por vencer→venta · docs RRHH/ausencias→admin.
- **Solo alerta (sin tarea):** flota VTV/seguro vencido→admin/pm/taller · pago proveedor vencido→admin · vencimientos calendario-adm→admin · proyecto trabado→admin/venta/pm.
- **Solo tarea (sin alerta):** egresos pendientes→admin.

### GAPS — eventos operativos que DEBERÍAN notificar y hoy NO (con propuesta de rol; **Fede confirma el ruteo**)
1. **OC recibida INCOMPLETA** (`compras_ordenes.recepcion_pendiente=true`, `api.js` `recibirOrdenCompra`) → notif **admin**. El flag ya existe (de esta sesión), falta el aviso. **← el gap más claro y barato (1 `createNotification`).**
2. **Equipo fuera de servicio / en reparación** (`equipos.estado`) → alerta+notif **admin+taller**. Ningún motor lo consume hoy (no hay generador `equipos` en `alertas.js` ni en `tareas.js._gen`).
3. **Flota: VTV/seguro/service por vencer** → falta la TAREA derivada (hoy solo alerta `alertas.js:237`). Agregar `_gen.flota` a `tareas.js` → **admin/taller**.
4. **Movimiento de stock que cruza el mínimo** → notif inmediata **admin** (hoy solo se detecta por polling, hasta 5 min después).
5. **Pago a proveedor vencido** (`compras_pagos`) → notif push + tarea **admin** (hoy solo alerta pasiva).
6. **Vencimientos administrativos** (calendario-adm) → notif push **admin**.
7. **Egresos pendientes/programados** → falta el generador de Alertas (tiene tarea, no alerta → inconsistente) → **admin**.
8. **Proyecto trabado ≥5d** → notif push **pm** (hoy solo alerta pasiva).
9. **Catálogo de silenciar tipos** (`notifications.js:26-36`) incompleto: faltan `pedido_compra`/`mencion`/`proyecto_listo`/`proyecto_a_taller`/`encuesta_respondida`/`tarea_asignada`/`vehiculo_tercero_creado`. Extender a medida que se sumen generadores (control de ruido).

### El trabajo de notificaciones = 2 partes
- **(a) Racionalizar la MATRIZ**: para cada evento operativo, decidir mecanismo(s) [notif push / alerta calculada / tarea derivada] + rol destino, de forma CONSISTENTE (hoy es cadáver exquisito). Traer la tabla a Fede y que confirme "este evento → a quién".
- **(b) Llenar los gaps** de arriba, prefiriendo **triggers SQL** para lo crítico (no depender del cliente). Prioridad de arranque: gap #1 (OC incompleta) → #2 (equipos) → #3 (flota tarea).

### Roles del sistema (para el ruteo): `superadmin` · `admin` (Lelean, Sofi) · `venta` (Noe) · `pm` (Meli, Leo) · `taller` (Diego, Juan, Carlos, Willy).

---

## 🐞 Fixes concretos detectados (hacer en el camino)
- **⚠️ Flota: gating read-only ROTO** (`flota.js`): `pm`/`taller` figuran `readOnlyPermissions.flota` en `data.js:36-37` pero `flota.js` **nunca llama `Data.isReadOnly`** → hoy pueden crear/editar/borrar vehículos y mantenimiento. El único gate es `_isAdmin()` (solo esconde la sección "Plata" + rutina/eliminar). Falta `_isRO = Data.isReadOnly(user.role,'flota')` + condicionar TODOS los botones de escritura (toolbar `flotaNuevo`/`flotaAjeno`, panel `edit-veh`/`add-mant`/`edit-mant`/`del-mant`), patrón de `inventario.js:1616`/`locaciones.js`. **Prioridad: es un agujero de permisos.**
- **alertas.js `stock_actual`→`stock`** ✅ (arreglado 2026-07-04; las alertas de stock bajo ahora disparan).
- **`compras_pagos`** = código muerto (tab retirado, cluster interno inalcanzable) → confirmar con Fede + borrar (`_loadPagos`/`_renderPagos` ~1472+).
- **`docs/schema-prod.md` desactualizado** (snapshot 2026-06-13, pre-reorg): NO tiene `equipos`/`equipo_contenido`/`vehiculos.es_propio`/las columnas nuevas de recepción (`compras_orden_items.insumo_id`, `compras_ordenes.recepcion_*`). Regenerar antes de tocar el modelo de datos.
- **`logistica_vehiculos`** legacy inerte (schema:68) — candidato a limpieza.

## 📌 Orden sugerido para la próxima charla
1. **Fix del gating de Flota** (rápido, cierra el agujero de permisos).
2. **Notificaciones — matriz + gaps** (el pedido grande; arrancar por el gap #1 OC incompleta, que ya tiene el flag → 1 `createNotification` + preferir trigger SQL para lo crítico). Traer la matriz a Fede para el ruteo fino.
3. **Pulido**: Inventario (el más crudo) → Flota → Compras (KPIs) → Locaciones-op.
4. **Integración fina**: pedidos→piezas/equipos · chofer transporte↔flota · progreso producción unificado. (3b.2 proveedores = pasada aparte, riesgosa.)

## ✅ Avance sesión 2026-07-04b (Flota fix + Notificaciones)
- **Paso #1 hecho:** fix del gating RO de Flota (`flota.js?v=6`, commit `c421f07`). pm/taller ya no pueden escribir; lectura intacta. Verificado en preview.
- **Paso #2 arrancado — Notificaciones:** matriz evento→rol confirmada con Fede + gaps #1–#5 construidos (`api.js?v=73`/`alertas.js?v=8`/`tareas.js?v=11`/`notifications.js?v=7`, commits `a4dd521`+`429081b`). Detalle en memoria `project_capa_operativa_integracion`. **#6/#8 push descartados** (Fede: campana solo críticas). **#7 egresos-alerta NO hecho** (badge ruidoso; confirmar).
- **Restan del handoff:** pulido de pantallas (Inventario→Flota→Compras→Locaciones-op) · integración fina (pedidos→piezas/equipos, chofer transporte↔flota, progreso producción unificado, 3b.2 proveedores).

## ⛔ Pendiente de Fede al arrancar
Correr SQL: `sql/fase7_bloqueo_ejercicio.sql` + `sql/compras_stock_recepcion.sql` + **`sql/notif_operativas.sql`** (triggers stock/equipo + flag `compras_pagos.notif_vencido_at`). Pull: contabilidad v14 · finanzas v50 · lobby v15 · **api v73 · alertas v8 · tareas v11 · notifications v7 · flota v6** · locaciones v8 · compras v13. Probar en prod: recepción de OC (escribe stock real) · OC incompleta→notif admin · equipo→fuera_de_servicio→notif admin+taller · salida de stock que cruce el mínimo→notif.

## Referencias
Memorias: `project_capa_operativa_integracion`, `project_finanzas_refactor_handoff` (3b.2), `feedback_skill_pulir_pantallas`, `feedback_taller_cero_friccion`, `feedback_autonomous_batches`. Docs: `docs/schema-prod.md` (verificar), `docs/capa-operativa-blueprint.md` (reorg + DDL equipos), skill `.claude/skills/pulir-pantallas/`.
