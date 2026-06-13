# Schema real de PROD — LOBBY-MEPEX

> **Snapshot de `information_schema` de Supabase.** Generado **2026-06-13 02:31 UTC** vía `sql/snapshot_schema.sql`.
> Fuente de verdad del schema (regla 12 del CLAUDE.md). Regenerar corriendo el SQL y pegando el JSON.
> Formato: `columna:tipo` (`:NOT_NULL` si no acepta null). `ARRAY` = columna de array de Postgres.

## 🔑 Hallazgos accionables (2026-06-13)

- **`cotizacion_items` NO es minimalista — tiene schema RICO ya listo para el cotizador:** `id, cotizacion_id, espacio_id, catalogo_item_id(integer), nombre, codigo, unidad, rubro, categoria, precio_unitario_base, precio_unitario_ajustado, cantidad, subtotal_linea, height_multiplier_aplicado, modifier_pct_aplicado, fee_pct_aplicado, posicion, created_at`. (Mi probe anterior dio "minimalista" porque testeé columnas que NO existen — `es_subalquilado/precio_unitario/descripcion/tipo/_deleted`. El schema real es el de arriba.) **Está VACÍA de filas**, no de columnas — el cuello de botella sigue siendo que el cotizador escriba, pero NO hace falta ALTER para el importador (B4).
- **El link cotización↔proyecto YA EXISTE:** `cotizaciones.project_id` (inglés, uuid) + `cotizaciones.event_id`. (Mi probe anterior falló porque testeé `proyecto_id` en español.) Además `proyectos.cotizacion_id` (sentido inverso). **No hace falta ALTER para linkear.**
- **Propio vs subalquilado se DERIVA, no se guarda en la línea:** `cotizacion_items.catalogo_item_id` (integer) → `catalogo_items.id` (bigint) → `catalogo_items.tipo_receta` (`propio`/`subalquilado`) + `proveedor_id_directo`. La agregación por proveedor de Fase 4 sale del JOIN, sin columna nueva. (Líneas de texto libre sin `catalogo_item_id` = no clasificables → "varios/otros".)
- **Las 4 tablas legacy `rrhh_*` siguen vivas** (para RRHH.2): `rrhh_personal`, `rrhh_asignaciones`, `rrhh_vacaciones` (personal_id, dias_totales, dias_usados), `rrhh_vacaciones_solicitudes` (personal_id, fecha_desde/hasta, estado).
- **DOS tablas de auditoría:** `audit_log` (bigint, la principal del sistema: user_id/table_name/action/details) y `audit_logs` (uuid, de Fase A contabilidad: tabla/registro_id/accion/valores_*). No confundir.
- **`saldos_apertura` existe, 0 filas** (Fase H apertura 2027 pendiente de carga). `mapeo_cuentas` = 12 filas activas (asientos automáticos andando). Cuentas dif. cambio `4.9.01`/`5.9.01` existen.
- **`logistica_remito`** (uuid: movimiento_id, item_nombre, cantidad) existe — relevante para el remito simple de Fase 4.
- **`personas` confirmada con las 7 columnas de RRHH.1** (dni, direccion, contacto_emergencia_*, cbu_alias, banco, situacion_previsional) + cuil + fecha_nacimiento.

## Verificación contable (2026-06-13)
- `plan_cuentas` 4.9.01 "Diferencia de cambio positiva" ✓ · 5.9.01 "Diferencia de cambio negativa" ✓ (ambas activas)
- `mapeo_cuentas`: **12 filas activas** — ingreso×4 (campo `servicio`: SRV-STAND/ALQUILER/EXPO/ADIC) + egreso×8 (campo `categoria`: proveedor/rrhh/impuesto/servicio/credito_fiscal/alquiler/logistica/otro)
- `saldos_apertura`: **0 filas**

---

## Tablas (negocio)

**personas** — `id:uuid:NN · profile_id:uuid · nombre:text:NN · apellido:text · tipo:varchar · roles_operativos:ARRAY · telefono:text · documento:text · costo_dia_referencial:numeric · notas:text · activo:bool · created_at:tstz · _deleted:bool · contacto:text · email:text · fecha_ingreso:date · documentacion:text · cantidad_personas:int · rol_legacy:text · fecha_nacimiento:date · cuil:varchar · dni:text · direccion:text · contacto_emergencia_nombre:text · contacto_emergencia_telefono:text · cbu_alias:text · banco:text · situacion_previsional:text`

**profiles** — `id:uuid:NN · username:text:NN · name:text:NN · role:text:NN · initials:text:NN · created_at:tstz · custom_permissions:jsonb · active:bool · telefono:text · _deleted:bool:NN · deleted_at:tstz · last_seen_at:tstz · last_login_at:tstz · last_device:text`

**roles** — `id:text:NN · label:text:NN · description:text · is_base:bool:NN · permissions:jsonb:NN · color:text · created_at:tstz · updated_at:tstz`

**clientes** — `id:uuid:NN · created_at:tstz · nombre_empresa:text:NN · razon_social:text · cuit:text · contacto_empresa:text · telefono:text · cargo:text · correo_electronico:text · rubro:text · _deleted:bool · tipo:text · estado:text · score:int · ultimo_contacto:tstz`

**eventos** — `id:uuid:NN · created_at:tstz:NN · updated_at:tstz:NN · nombre:text:NN · fecha_evento_inicio:date · fecha_evento_fin:date · fecha_armado_inicio:date · fecha_armado_fin:date · fecha_desarme_inicio:date · fecha_desarme_fin:date · hora_armado_apertura:time · hora_armado_cierre:time · hora_evento_apertura:time · hora_evento_cierre:time · hora_desarme_apertura:time · hora_desarme_cierre:time · predio:text · color:text · notas_operativas:text · _deleted:bool:NN`

**predios** — `id:uuid:NN · created_at:tstz:NN · updated_at:tstz:NN · nombre:text:NN · ciudad:text · direccion:text · notas:text · _deleted:bool:NN`

**evento_jornadas** — `id:uuid:NN · evento_id:uuid:NN · fase:text:NN · fecha:date:NN · hora_inicio:time · hora_fin:time · orden:int · notas:text · created_at:tstz`

**evento_documentos** — `id:uuid:NN · created_at:tstz:NN · updated_at:tstz:NN · evento_id:uuid:NN · nombre:text:NN · url:text · tipo:text · _deleted:bool:NN`

**evento_historial** — `id:uuid:NN · created_at:tstz:NN · updated_at:tstz:NN · evento_id:uuid:NN · user_id:uuid · accion:text:NN · detalle:jsonb · _deleted:bool:NN`

**encuestas_evento** — `id:uuid:NN · evento_id:uuid:NN · cliente_id:uuid · token:text:NN · enviada_at:tstz · enviada_por:uuid · respondida_at:tstz · nps:int · comentario:text · created_at:tstz`

**proyectos** — `id:uuid:NN · created_at:tstz:NN · updated_at:tstz:NN · nombre:text:NN · cliente_id:uuid · evento_id:uuid · responsable_id:uuid · estado:text:NN · fecha_inicio:date · fecha_entrega:date · notas:text · _deleted:bool:NN · cotizacion_id:uuid · drive_folder_url:text · drive_folder_id:text · created_from:text · estado_taller:varchar · estado_taller_updated_at:tstz · estado_taller_updated_by:uuid · completitud_pct:int`

**proyecto_tipos** — `id:uuid:NN · proyecto_id:uuid:NN · tipo:text:NN · created_at:tstz`
**proyecto_responsables** — `id:uuid:NN · proyecto_id:uuid:NN · profile_id:uuid:NN · es_principal:bool · created_at:tstz`
**proyecto_novedades** — `id:uuid:NN · proyecto_id:uuid:NN · autor_id:uuid · tipo:varchar · mensaje:text:NN · prioridad:varchar · visible_para_taller:bool · adjuntos_urls:ARRAY · resuelta:bool · resuelta_por:uuid · resuelta_at:tstz · created_at:tstz · _deleted:bool`
**proyecto_actividad** — `id:uuid:NN · proyecto_id:uuid:NN · user_id:uuid · user_name:text · tipo:text:NN · descripcion:text · metadata:jsonb · created_at:tstz`

**asignaciones_evento** — `id:uuid:NN · evento_id:uuid:NN · persona_id:uuid:NN · fase:varchar · fecha_inicio:tstz · fecha_fin:tstz · rol:varchar · estado:varchar · aprobada_por:uuid · aprobada_at:tstz · notas:text · created_by:uuid · created_at:tstz · _deleted:bool · jornada_id:uuid` ⚠️ **fecha_inicio/fin son TIMESTAMPTZ**

### Taller
**taller_proyecto_checklist** (vigente) — `id:uuid:NN · proyecto_id:uuid:NN · item_key:text · checked:bool · checked_by:uuid · checked_at:tstz · notas:text · created_at:tstz · label:text · orden:int:NN · _deleted:bool:NN`
**taller_checklist** (legacy) — `id:bigint:NN · proyecto_id:uuid:NN · item_key:text:NN · checked:bool · checked_by:text · checked_at:tstz · _deleted:bool · created_at:tstz`
**taller_notas** — `id:bigint:NN · proyecto_id:uuid:NN · usuario:text:NN · texto:text:NN · created_at:tstz`
**taller_materiales** — `id:bigint:NN · proyecto_id:uuid:NN · item_nombre:text:NN · cantidad:int · notas:text · _deleted:bool · created_at:tstz`

### Logística / Cargas
**cargas** — `id:uuid:NN · evento_id:uuid:NN · fase:varchar · vehiculo_id:uuid · chofer_persona_id:uuid · fecha:date:NN · hora_carga:time · hora_estimada_llegada:time · destino_override:text · responsable_mepex_id:uuid · estado:varchar · aprobada_por:uuid · aprobada_at:tstz · remito_pdf_url:text · remito_firmado_url:text · notas:text · created_by:uuid · created_at:tstz · _deleted:bool · encargado_persona_id:uuid`
**carga_proyectos** — `id:uuid:NN · carga_id:uuid:NN · proyecto_id:uuid:NN · notas:text · created_at:tstz`
**carga_personas** — `id:uuid:NN · carga_id:uuid:NN · persona_id:uuid:NN · rol_en_carga:varchar · created_at:tstz`
**vehiculos** (Flota) — `id:uuid:NN · patente:text · descripcion:text:NN · propietario:varchar · capacidad_descriptiva:text · contacto_nombre:text · contacto_telefono:text · costo_referencial:numeric · activo:bool · notas:text · created_at:tstz · _deleted:bool · tipo:text · estado:text · chofer_habitual_id:uuid · titular:text · valor_compra:numeric · fecha_compra:date · amortizacion_meses:int`
**logistica_movimientos** (legacy) — `id:uuid:NN · evento_id:uuid · proyecto_id:uuid · vehiculo_id:uuid · chofer_id:uuid · chofer_nombre_libre:text · origen:text:NN · destino:text:NN · fecha:date · hora_programada:text · check_salida:tstz · check_llegada:tstz · check_descarga:tstz · check_retorno:tstz · estado:text · notas:text · _deleted:bool · created_at:tstz · updated_at:tstz`
**logistica_vehiculos** (legacy) — `id:uuid:NN · nombre:text:NN · tipo:text · patente:text · chofer_habitual_id:uuid · contacto:text · vtv_vencimiento:date · seguro_vencimiento:date · ultimo_service:date · estado:text · notas:text · _deleted:bool · created_at:tstz · updated_at:tstz`
**logistica_remito** — `id:uuid:NN · movimiento_id:uuid:NN · item_nombre:text:NN · cantidad:numeric · notas:text · _deleted:bool · created_at:tstz`
**produccion_mantenimiento** — `id:bigint:NN · nombre:text:NN · tipo:text · estado:text · fecha_ultimo_service:date · fecha_proximo_vencimiento:date · notas:text · _deleted:bool · created_at:tstz · vehiculo_id:uuid`

### RRHH (legacy — a retirar en RRHH.2)
**rrhh_personal** — `id:uuid:NN · nombre:text:NN · rol:text · tipo:text · cantidad_personas:int · contacto:text · telefono:text · email:text · fecha_ingreso:date · estado:text · documentacion:text · notas:text · _deleted:bool · created_at:tstz · updated_at:tstz`
**rrhh_asignaciones** — `id:uuid:NN · personal_id:uuid:NN · evento_id:uuid · proyecto_id:uuid · rol_evento:text · fecha_desde:date · fecha_hasta:date · notas:text · _deleted:bool · created_at:tstz · updated_at:tstz`
**rrhh_vacaciones** — `id:uuid:NN · personal_id:uuid:NN · dias_totales:int:NN · dias_usados:int:NN · _deleted:bool · created_at:tstz · updated_at:tstz`
**rrhh_vacaciones_solicitudes** — `id:uuid:NN · personal_id:uuid:NN · fecha_desde:date:NN · fecha_hasta:date:NN · estado:text · notas:text · _deleted:bool · created_at:tstz · updated_at:tstz`

### CRM / Cotizaciones
**interacciones** — `id:uuid:NN · cliente_id:uuid:NN · canal:text:NN · quien:text:NN · resumen:text:NN · fecha:tstz:NN · es_automatica:bool:NN · created_at:tstz:NN · _deleted:bool`
**cotizaciones** — `id:uuid:NN · numero:text:NN · cliente_id:uuid · nombre_evento:text · tipo_evento:text · fecha_evento:date · monto_total:numeric · estado:text:NN · vendedor_id:uuid · notas_internas:text · created_at:tstz:NN · updated_at:tstz:NN · project_id:uuid · event_id:uuid · tipo_cotizacion:text · superficie:numeric · tipo_stand:text · altura:text · subtotal:numeric · iva:numeric · fecha_emision:date · full_state:jsonb · pdf_url:text · pyme_venta_id:uuid · pyme_factura_numero:text · pyme_factura_fecha:date · pyme_total:numeric · pyme_balance:numeric · pyme_estado_cobro:text · pyme_last_sync:tstz · _deleted:bool · temperatura:text`
**cotizacion_items** — `id:uuid:NN · cotizacion_id:uuid:NN · espacio_id:uuid · catalogo_item_id:int · nombre:text:NN · codigo:text · unidad:text · rubro:text · categoria:text · precio_unitario_base:numeric:NN · precio_unitario_ajustado:numeric:NN · cantidad:numeric:NN · subtotal_linea:numeric:NN · height_multiplier_aplicado:numeric:NN · modifier_pct_aplicado:numeric:NN · fee_pct_aplicado:numeric:NN · posicion:int · created_at:tstz`
**cotizacion_espacios** — `id:uuid:NN · cotizacion_id:uuid:NN · nombre:text:NN · superficie:numeric · posicion:int · created_at:tstz`
**cotizacion_notas** — `id:uuid:NN · cotizacion_id:uuid:NN · texto:text:NN · autor:text · created_at:tstz:NN`
**cotizacion_timeline** — `id:uuid:NN · cotizacion_id:uuid:NN · tipo:text:NN · descripcion:text:NN · metadata:jsonb · created_at:tstz:NN`
**cotizacion_envios** — `id:uuid:NN · cotizacion_id:uuid:NN · canal:text:NN · template_id:text · destinatario:text:NN · asunto:text · estado:text:NN · opened_at:tstz · created_at:tstz:NN`
**cotizacion_numerador** — `anio:int:NN · ultimo_numero:int:NN`
**email_templates** — `id:uuid:NN · nombre:text:NN · asunto:text:NN · cuerpo:text:NN · variables:jsonb · activo:bool:NN · created_at:tstz:NN`

### Costos / Catálogo / Inventario
**catalogo_items** — `id:bigint:NN · codigo:text · nombre:text:NN · rubro:text · categoria:text · descripcion:text · origen:text · unidad:text · costo_produccion:numeric · precio_cliente:numeric · nivel:int · favorito:bool · disponible_publico:bool · stock:int · parametrico:bool · medida_mm:int · familia:text · activo:bool · created_at:tstz · updated_at:tstz · _deleted:bool · tipo_receta:varchar:NN · margen_subalquiler:numeric · mano_obra_minutos:int · pct_indirectos_fabrica:numeric · pct_indirectos_comercial:numeric · vida_util_usos:int · pct_reacondicionamiento:numeric · margen_propio:numeric · costo_mano_obra:numeric · costo_indirectos:numeric · costo_fabricacion:numeric · costo_por_uso:numeric · precio_alquiler:numeric · ultima_recalculacion:tstz · pct_markup_estructura:numeric · vida_util_armado_override:int · snapshot_*(varios) · costo_proveedor_directo:numeric · proveedor_id_directo:uuid · es_cotizable:bool`
**insumos_base** — `id:bigint:NN · codigo:text · nombre:text:NN · clasificacion:text · categoria:text · costo_unitario:numeric · moneda:text · unidad:text · proveedor:text · notas:text · fecha_ultimo_precio:tstz · activo:bool · created_at:tstz · updated_at:tstz · _deleted:bool · stock_actual:numeric · stock_minimo:numeric · stock:numeric · tipo_amortizacion:text · vida_util_override:int · pct_reacond_override:numeric · pct_desperdicio_override:numeric`
**receta_componentes** — `id:uuid:NN · item_id:bigint:NN · componente_type:text:NN · componente_id:text:NN · cantidad:numeric:NN · unidad_uso:text · notas:text · created_at:tstz:NN · _deleted:bool · es_parametrico:bool · factor:numeric · cantidad_fija:bool · updated_at:tstz`
**costos_tipo_amortizacion** — `codigo:text:NN · nombre:text:NN · vida_util:int:NN · pct_reacond:numeric:NN · pct_desperdicio:numeric:NN · orden:int · created_at:tstz · updated_at:tstz`
**costos_params_globales** — `id:int:NN · hora_taller_ars:numeric:NN · hora_montajista_ars:numeric:NN · pct_indirectos_fabrica:numeric:NN · pct_markup_estructura:numeric:NN · pct_margen_default:numeric:NN · tipo_cambio_usd:numeric:NN · vida_util_default:int:NN · pct_reacond_default:numeric:NN · updated_at:tstz · updated_by:uuid`
**parametros_globales** — `id:int:NN · clave:varchar:NN · valor:numeric:NN · descripcion:text · unidad:varchar · actualizado_at:tstz`
**insumo_precio_historial** — `id:bigint:NN · insumo_id:bigint:NN · precio_anterior:numeric:NN · precio_nuevo:numeric:NN · variacion_porcentual:numeric · usuario:text · motivo:text · created_at:tstz`
**listas_precio** — `id:bigint:NN · nombre:text:NN · tipo:text:NN · estado:text:NN · margen_global:numeric · descripcion:text · _deleted:bool · created_at:tstz · updated_at:tstz`
**lista_precio_items** — `id:bigint:NN · lista_id:bigint:NN · item_id:bigint:NN · margen:numeric:NN · _deleted:bool · created_at:tstz`
**lista_precio_rubros** — `id:bigint:NN · lista_id:bigint:NN · rubro:text:NN · margen:numeric:NN · _deleted:bool · created_at:tstz`
**inventario_movimientos** — `id:bigint:NN · created_at:tstz · tipo:text:NN · subtipo:text · proyecto_id:uuid · usuario:text:NN · notas:text · _deleted:bool`
**inventario_movimiento_items** — `id:bigint:NN · movimiento_id:bigint:NN · direccion:text:NN · item_tipo:text:NN · item_id:bigint:NN · item_nombre:text · cantidad:numeric:NN · unidad:text · created_at:tstz`
**inventario_fisico_sesiones** — `id:bigint:NN · created_at:tstz · fecha:date:NN · locacion_id:bigint · responsable:text:NN · estado:text · notas:text · _deleted:bool`
**inventario_fisico_conteo** — `id:bigint:NN · sesion_id:bigint:NN · item_tipo:text:NN · item_id:bigint:NN · item_nombre:text · stock_teorico:numeric · stock_real:numeric · diferencia:numeric · notas:text · created_at:tstz`
**opciones_select** — `id:int:NN · campo:text:NN · valor:text:NN · color:text · orden:int · created_at:tstz · _deleted:bool`

### Locaciones / Activos
**locaciones** — `id:bigint:NN · nombre:text:NN · tipo:text:NN · direccion:text · superficie:numeric · estado:text:NN · foto_url:text · notas:text · _deleted:bool:NN · created_at:tstz:NN`
**locaciones_documentos** — `id:bigint:NN · locacion_id:bigint:NN · nombre:text:NN · tipo_doc:text:NN · fecha_vencimiento:date · archivo_url:text · notas:text · _deleted:bool:NN · created_at:tstz:NN`
**locaciones_stock** — `id:bigint:NN · locacion_id:bigint:NN · insumo_id:bigint:NN · cantidad:int:NN · estado:text:NN · notas:text · _deleted:bool:NN · created_at:tstz:NN`
**proveedor** — `id:uuid:NN · created_at:tstz · nombre:text:NN · cuit:text · rubro:text · detalle:text · domicilio_comercial:text · _deleted:bool`
**locations** (inglés, ¿legacy?) — `id:uuid:NN · created_at:tstz · name:text:NN · type:text · address:text · total_area_m2:numeric · capacity_items:int · current_occupancy:int · is_active:bool`
**inventory_items** (inglés, ¿legacy?) — `id:uuid:NN · created_at:tstz · item_code:text · name:text:NN · category:text · status:text · location_id:uuid · current_project_id:uuid · acquisition_cost:numeric · notes:text`

### Compras
**compras_proveedores** — `id:bigint:NN · nombre:text:NN · razon_social:text · rubro:text · contacto:text · telefono:text · email:text · calif_cumplimiento:int · calif_calidad:int · calif_precio:int · notas:text · _deleted:bool:NN · created_at:tstz:NN`
**compras_pedidos** — `id:bigint:NN · tipo:text:NN · descripcion:text · insumo_id:bigint · cantidad:numeric · unidad:text · link:text · proyecto_id:uuid · categoria_gasto:text · urgencia:text:NN · nota:text · estado:text:NN · orden_compra_id:bigint · created_by:uuid · created_at:tstz:NN · updated_at:tstz:NN · _deleted:bool:NN · items:jsonb`
**compras_ordenes** — `id:bigint:NN · proveedor_id:bigint · evento_id:uuid · proyecto_id:uuid · numero_oc:text · fecha:date · estado:text:NN · monto_total:numeric · notas:text · _deleted:bool:NN · created_at:tstz:NN · pedido_id:bigint · tipo:text · descripcion:text · link:text · cantidad:numeric · categoria_gasto:text`
**compras_orden_items** — `id:bigint:NN · orden_id:bigint:NN · nombre:text:NN · cantidad:int · precio_unitario:numeric · subtotal:numeric · notas:text · created_at:tstz:NN`
**compras_oc_presupuestos** — `id:bigint:NN · orden_id:bigint:NN · proveedor_id:bigint · proveedor_nombre:text · monto:numeric:NN · link:text · notas:text · es_ganadora:bool:NN · created_at:tstz:NN · _deleted:bool:NN`
**compras_pagos** — `id:bigint:NN · proveedor_id:bigint · orden_id:bigint · concepto:text · monto:numeric · fecha_vencimiento:date · fecha_pago:date · estado:text:NN · notas:text · _deleted:bool:NN · created_at:tstz:NN`

### Finanzas
**cuentas_financieras** — `id:uuid:NN · nombre:text:NN · tipo:text:NN · entidad:text · numero_cuenta:text · cbu_alias:text · canal_default:text:NN · saldo_inicial:numeric:NN · activa:bool:NN · color:text · notas:text · created_at:tstz:NN · updated_at:tstz:NN · _deleted:bool:NN · moneda:text:NN`
**ingresos** — `id:uuid:NN · fecha:date:NN · proyecto_id:uuid · evento_id:uuid · cliente_id:uuid · concepto:text:NN · monto:numeric:NN · medio:text:NN · canal:text:NN · cuenta_id:uuid · comprobante_id:uuid · plan_cobro_item_id:uuid · estado:text:NN · notas:text · created_at:tstz:NN · updated_at:tstz:NN · created_by:uuid · _deleted:bool:NN · moneda:text:NN · cotizacion:numeric:NN · total_en_ars:numeric`
**egresos** — `id:uuid:NN · fecha:date:NN · categoria:text:NN · subcategoria:text · destinatario:text · proveedor_id:uuid · empleado_id:uuid · proyecto_id:uuid · evento_id:uuid · concepto:text:NN · monto:numeric:NN · medio:text:NN · canal:text:NN · cuenta_id:uuid · comprobante_recibido_id:uuid · orden_compra_id:uuid · estado:text:NN · fecha_programada:date · notas:text · created_at:tstz:NN · updated_at:tstz:NN · created_by:uuid · _deleted:bool:NN · moneda:text:NN · cotizacion:numeric:NN · total_en_ars:numeric` ⚠️ `orden_compra_id` es **uuid** (compras_ordenes.id es bigint → no matchea, link por concepto)
**transferencias_internas** — `id:uuid:NN · fecha:date:NN · cuenta_origen_id:uuid:NN · cuenta_destino_id:uuid:NN · monto:numeric:NN · concepto:text · egreso_id:uuid · ingreso_id:uuid · created_at:tstz:NN · created_by:uuid · _deleted:bool:NN · moneda:text:NN · cotizacion:numeric:NN · total_en_ars:numeric`
**comprobantes** (emitidos) — `id:uuid:NN · fecha:date:NN · tipo:text:NN · punto_venta:int:NN · numero:text · cliente_id:uuid · cuit_dni:text:NN · servicio:text:NN · descripcion:text · neto:numeric:NN · iva_alicuota:numeric:NN · iva:numeric:NN · total:numeric:NN · cae:text · cae_vencimiento:date · estado:text:NN · error_detalle:text · pdf_url:text · proyecto_id:uuid · ingreso_id:uuid · lapyme_response:jsonb · canal:text:NN · created_at:tstz:NN · updated_at:tstz:NN · created_by:uuid · _deleted:bool:NN · moneda:text:NN · cotizacion:numeric:NN · total_en_ars:numeric`
**comprobantes_recibidos** — `id:uuid:NN · fecha:date:NN · tipo:text:NN · numero:text · proveedor_id:uuid · proveedor_nombre:text · cuit:text · concepto:text:NN · neto:numeric · iva:numeric · total:numeric:NN · categoria:text:NN · archivo_url:text · orden_compra_id:uuid · egreso_id:uuid · proyecto_id:uuid · canal:text:NN · notas:text · created_at:tstz:NN · updated_at:tstz:NN · created_by:uuid · _deleted:bool:NN · moneda:text:NN · cotizacion:numeric:NN · total_en_ars:numeric`
**comprobantes_iva_recovery** — `id:uuid:NN · fecha:date:NN · cuit:text · razon_social:text · descripcion:text · subtotal:numeric:NN · iva_21:numeric:NN · iva_10_5:numeric:NN · iva_otros:numeric:NN · iva_total:numeric · total:numeric:NN · periodo:text:NN · traido_por:text · archivo_url:text · notas:text · created_by:uuid · created_at:tstz:NN · updated_at:tstz:NN · _deleted:bool:NN · moneda:text:NN · cotizacion:numeric:NN · total_en_ars:numeric`
**plan_cobro** — `id:uuid:NN · proyecto_id:uuid:NN · cotizacion_id:uuid · total_plan:numeric:NN · notas:text · created_at:tstz:NN · updated_at:tstz:NN · _deleted:bool:NN · moneda:text:NN · cotizacion:numeric:NN · total_en_ars:numeric`
**plan_cobro_items** — `id:uuid:NN · plan_cobro_id:uuid:NN · orden:int:NN · concepto:text:NN · monto:numeric:NN · porcentaje:numeric · fecha_estimada:date · estado:text:NN · monto_cobrado:numeric:NN · notas:text · created_at:tstz:NN · updated_at:tstz:NN · _deleted:bool:NN · facturar:bool:NN · comprobante_venta_id:uuid · moneda:text:NN · cotizacion:numeric:NN · total_en_ars:numeric`
**cobro_aplicaciones** — `id:uuid:NN · ingreso_id:uuid:NN · comprobante_id:uuid:NN · plan_cobro_item_id:uuid · monto_aplicado:numeric:NN · notas:text · created_at:tstz:NN · created_by:uuid · _deleted:bool:NN`
**vencimientos_recurrentes** — `id:uuid:NN · concepto:text:NN · monto_estimado:numeric · frecuencia:text:NN · dia_mes:int · categoria_egreso:text:NN · subcategoria:text · cuenta_sugerida_id:uuid · canal:text:NN · activo:bool:NN · notas:text · created_at:tstz:NN · updated_at:tstz:NN · _deleted:bool:NN · moneda:text:NN · cotizacion:numeric:NN · monto_estimado_ars:numeric`
**vencimientos_generados** — `id:uuid:NN · recurrente_id:uuid · fecha_vencimiento:date:NN · concepto:text:NN · monto_estimado:numeric · estado:text:NN · egreso_id:uuid · notas:text · created_at:tstz:NN · _deleted:bool:NN · moneda:text:NN · cotizacion:numeric:NN · monto_estimado_ars:numeric`
**conciliaciones** — `id:uuid:NN · cuenta_id:uuid:NN · periodo:text:NN · fecha_conciliacion:date:NN · saldo_banco:numeric:NN · saldo_lobby:numeric:NN · diferencia:numeric:NN · estado:text:NN · conciliado_por:uuid · notas:text · created_at:tstz:NN · _deleted:bool:NN`
**extracto_bancario_lineas** — `id:uuid:NN · conciliacion_id:uuid:NN · fecha:date:NN · descripcion:text:NN · debito:numeric · credito:numeric · saldo:numeric · match_tipo:text · ingreso_id:uuid · egreso_id:uuid · created_at:tstz:NN`
**payments** (inglés, ¿legacy?) — `id:uuid:NN · created_at:tstz · project_id:uuid · payment_type:text · amount:numeric:NN · currency:text · status:text · due_date:date · paid_date:date · notes:text`

### Contabilidad
**plan_cuentas** — `id:uuid:NN · codigo:text:NN · nombre:text:NN · tipo:text:NN · nivel:int:NN · codigo_padre:text · es_grupo:bool:NN · cuenta_financiera_id:uuid · naturaleza:text:NN · activa:bool:NN · orden:int:NN · notas:text · created_at:tstz:NN · updated_at:tstz:NN · _deleted:bool:NN · imputable:bool:NN · controla_subdiario:text`
**asientos** — `id:uuid:NN · numero:int:NN · fecha:date:NN · concepto:text:NN · tipo:text:NN · canal:text:NN · ingreso_id:uuid · egreso_id:uuid · comprobante_id:uuid · comprobante_recibido_id:uuid · transferencia_id:uuid · total_debe:numeric:NN · total_haber:numeric:NN · notas:text · created_at:tstz:NN · updated_at:tstz:NN · created_by:uuid · _deleted:bool:NN · moneda:text:NN · cotizacion:numeric:NN`
**asiento_lineas** — `id:uuid:NN · asiento_id:uuid:NN · cuenta_id:uuid:NN · tipo_movimiento:text:NN · monto:numeric:NN · descripcion:text · orden:int:NN · created_at:tstz:NN` (sin `_deleted` — soft-delete vive en `asientos`)
**mapeo_cuentas** — `id:uuid:NN · tipo_movimiento:text:NN · campo_origen:text:NN · valor_origen:text:NN · cuenta_contable_id:uuid:NN · posicion:text:NN · descripcion:text · activo:bool:NN · created_at:tstz:NN · _deleted:bool:NN`
**saldos_mensuales** — `id:uuid:NN · cuenta_id:uuid:NN · periodo:text:NN · canal:text:NN · saldo_anterior:numeric:NN · total_debe:numeric:NN · total_haber:numeric:NN · saldo_final:numeric:NN · created_at:tstz:NN · updated_at:tstz:NN`
**saldos_apertura** — `id:uuid:NN · ejercicio:int:NN · cuenta_id:uuid:NN · monto:numeric:NN · moneda:text:NN · cotizacion:numeric:NN · monto_en_ars:numeric · bloqueado:bool:NN · asiento_id:uuid · created_at:tstz:NN · updated_at:tstz:NN · created_by:uuid · _deleted:bool:NN`

### Sistema / Notifs / Auditoría
**notifications** — `id:uuid:NN · tipo:varchar:NN · titulo:text:NN · mensaje:text · target_role:varchar · target_user_id:uuid · entidad_tipo:varchar · entidad_id:uuid · link:text · prioridad:varchar · leida_por:jsonb · created_at:tstz · expires_at:tstz` ⚠️ `entidad_id` es uuid (no aceptar bigint)
**audit_log** (principal) — `id:bigint:NN · created_at:tstz · user_id:uuid · user_email:text · user_name:text · table_name:text:NN · record_id:uuid · action:text:NN · details:jsonb · module:text · ip_address:text · tipo:text`
**audit_logs** (Fase A contab.) — `id:uuid:NN · tabla:text:NN · registro_id:uuid:NN · accion:text:NN · actor_id:uuid · fecha:tstz:NN · valores_anteriores:jsonb · valores_nuevos:jsonb · contexto:text`
**pyme_sync_log** — `id:uuid:NN · tipo:text:NN · ventas_synced:int · ventas_total:int · errores:jsonb · created_at:tstz:NN`

## VIEWs
- **v_posicion_iva_mes** — `periodo · iva_debito · iva_credito_oficial · iva_credito_virtual · iva_credito_total · saldo_solo_oficial · saldo_con_virtual`
- **v_libro_iva_compras_extendido** — `origen · id · fecha · tipo · numero · cuit · razon_social · descripcion · subtotal · iva_21 · iva_10_5 · iva_otros · iva_total · total · periodo · traido_por · created_at`
- **v_saldo_comprobante** — `comprobante_id · fecha · tipo · cliente_id · proyecto_id · total · total_cobrado · saldo · estado_cobranza · canal · estado_comprobante`
- **v_plan_cobro_resumen** — `plan_id · proyecto_id · total_plan · moneda · cotizacion · total_plan_en_ars · cuotas_total · cuotas_cobradas · monto_cuotas · monto_cuotas_ars · monto_facturado · monto_cobrado`
- **v_saldos_apertura_ejercicio** — `cuenta_id · codigo · nombre · tipo · codigo_padre · nivel · imputable · saldo_id · ejercicio · monto · moneda · cotizacion · monto_en_ars · bloqueado · asiento_id`
