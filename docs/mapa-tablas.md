# Mapa tabla ↔ código — LOBBY-MEPEX

> **Autogenerado** por `tools/mapa-tablas.js` — NO editar a mano. Regenerar con `node tools/mapa-tablas.js`.
> Responde "¿quién lee/escribe la tabla X?" antes de tocar schema o retirar legacy.
> Nota: detecta `.from('tabla')` y `.rpc('fn')` literales; no ve queries armadas dinámicamente ni VIEWs usadas vía .from (las VIEWs aparecen como tablas).

## Tablas / VIEWs (85)

| Tabla | Archivos (líneas) |
|---|---|
| `asiento_lineas` | `contabilidad.js` (2740, 3123, 3675, 3690, 3723, 3754, 4550, 4751) |
| `asientos` | `contabilidad.js` (2686, 2714, 3140, 3619, 3660, 3697, 3743, 3798, … (+2)) |
| `asignaciones_evento` | `api.js` (3786, 3813, 3865, 3912, 3936, 3956, 3987, 4028, … (+2)) · `rrhh.js` (326) |
| `audit_log` | `admin-panel.js` (270, 271, 272, 299, 356, 1660, 1661, 1756) · `audit-log.js` (32, 111, 129, 137, 145, 152) · `lobby.js` (525) |
| `carga_personas` | `api.js` (4545, 4551) |
| `carga_proyectos` | `api.js` (4464, 4528, 4532) |
| `cargas` | `api.js` (3887, 4367, 4397, 4453, 4515, 4568, 4601, 4613, … (+2)) |
| `catalogo_items` | `api.js` (1422) · `inventario.js` (2129) |
| `categorias_config` | `api.js` (2294, 2315) |
| `clientes` | `alertas.js` (149) · `api.js` (18, 36, 397, 1807) · `finanzas.js` (2621, 5309) · `proyecto-detalle.js` (857) |
| `cobro_aplicaciones` | `api.js` (5191, 5219, 5225) |
| `compras_oc_presupuestos` | `api.js` (3604, 3622, 3630, 3631, 3640, 3650, 3651, 3653, … (+1)) |
| `compras_orden_items` | `api.js` (3597) · `compras.js` (1232, 1249, 1421) |
| `compras_ordenes` | `api.js` (3561, 3580, 3642, 3643, 3675) · `compras.js` (695, 961, 1066, 1176, 1264, 1359, 1362, 1449) |
| `compras_pagos` | `alertas.js` (256) · `compras.js` (1466, 1582, 1597, 1654) |
| `compras_pedidos` | `api.js` (3462, 3475, 3514, 3520, 3540) |
| `compras_proveedores` | ⚠️ **NINGUNO — deuda 3b.2 SALDADA.** Verificado 2026-08-02 (T6): **cero** `from('compras_proveedores')` en todo el repo. Compras usa `proveedor` (UUID); sólo quedan dos menciones en comentarios y el puente `compras_proveedor_id`. Esta fila listaba llamadores que ya no existen. |
| `comprobantes` | `api.js` (5414) · `contabilidad.js` (4118) · `finanzas.js` (5198, 5812, 6423, 6621, 7194, 7223, 7287) |
| `comprobantes_iva_recovery` | `api.js` (5015, 5049, 5058, 5066) |
| `comprobantes_recibidos` | `contabilidad.js` (4141) · `finanzas.js` (6626, 7642, 7897, 8078, 8083) |
| `conciliaciones` | `finanzas.js` (9014, 9632, 9641) |
| `costos_tipo_amortizacion` | `costos.js` (277) |
| `cotizacion_timeline` | `api.js` (1960, 1974, 1996) |
| `cotizaciones` | `alertas.js` (134) · `api.js` (1795, 1905, 2243) · `proyecto-detalle.js` (829) |
| `cuentas_financieras` | `contabilidad.js` (1992) · `finanzas.js` (2085, 2527, 2534, 2561, 2577, 2600, 5322) |
| `egresos` | `api.js` (3663, 3707) · `finanzas.js` (3644, 3846, 3877, 4063, 4084, 4354, 4359, 4393, … (+14)) |
| `email_templates` | `api.js` (2064, 2080, 2100, 2112) |
| `encuestas_evento` | `api.js` (3723, 3740, 3767) |
| `evento_documentos` | `api.js` (975, 1004, 1020) |
| `evento_historial` | `api.js` (1035, 1069) |
| `evento_jornadas` | `api.js` (4086, 4100, 4105, 4115, 4118) |
| `eventos` | `alertas.js` (189, 211) · `api.js` (224, 407, 1175, 1829) |
| `extracto_bancario_lineas` | `finanzas.js` (9445, 9664, 9686) |
| `ingresos` | `api.js` (5398) · `finanzas.js` (2700, 2964, 2995, 3150, 3175, 3497, 3505, 4385, … (+11)) |
| `insumo_precio_historial` | `api.js` (2517, 2529) |
| `insumos_base` | `alertas.js` (285) · `api.js` (1313) · `compras.js` (132) · `inventario.js` (2132, 2252) · `locaciones.js` (714) · `taller.js` (285) |
| `interacciones` | `api.js` (1083) |
| `inventario_fisico_conteo` | `inventario.js` (2778, 2791, 2840, 2960) |
| `inventario_fisico_sesiones` | `inventario.js` (2560, 2709, 3067) |
| `inventario_movimiento_items` | `inventario.js` (1619, 2122, 2246, 2392, 3049) |
| `inventario_movimientos` | `inventario.js` (1713, 2101, 2225, 2360, 2439, 3036) |
| `lista_precio_items` | `api.js` (2459, 2475, 2478, 2481, 2493) |
| `lista_precio_rubros` | `api.js` (2411, 2428, 2431, 2434, 2446) |
| `listas_precio` | `api.js` (2344) |
| `locaciones` | `inventario.js` (1737, 2574, 2657) · `locaciones.js` (202, 439, 444, 462, 482, 709) |
| `locaciones_documentos` | `alertas.js` (303) · `locaciones.js` (486, 669, 674, 691) |
| `locaciones_stock` | `inventario.js` (1579) · `locaciones.js` (719, 936, 941, 958) |
| `logistica_movimientos` | `api.js` (851, 908, 924, 940) |
| `logistica_vehiculos` | `eventos.js` (1862) |
| `mapeo_cuentas` | `contabilidad.js` (5190, 5415, 5422, 5439) |
| `notifications` | `api.js` (3293, 3361, 3398, 3404, 3445) |
| `opciones_select` | `api.js` (335) |
| `parametros_globales` | `api.js` (2752, 2782) |
| `personas` | `api.js` (4249, 4276, 4311, 4337, 4349) · `eventos.js` (1395) · `rrhh.js` (321, 744, 1050, 1054, 1073) |
| `plan_cobro` | `api.js` (5095, 5107, 5125, 5149, 5156) · `finanzas.js` (4745) |
| `plan_cobro_items` | `api.js` (5142, 5163, 5170, 5177, 5406) · `finanzas.js` (3516, 3524, 5173, 5877, 6050, 6095, 6558, 8212) |
| `plan_cuentas` | `api.js` (5330) · `contabilidad.js` (1987, 2274, 2292, 2388, 2487, 2597, 3070, 3606, … (+1)) |
| `predios` | `api.js` (96, 127) |
| `produccion_mantenimiento` | `alertas.js` (237) · `api.js` (4885, 4919, 4942, 4954) |
| `profiles` | `admin-panel.js` (1609) · `api.js` (1236, 1278, 2672, 2694, 2737) · `audit-log.js` (88) · `auth.js` (42, 148) · `proyecto-detalle.js` (860) |
| `proveedor` | `api.js` (286, 402) · `compras.js` (552) · `finanzas.js` (8945) |
| `proyecto_actividad` | `proyecto-detalle.js` (923) |
| `proyecto_novedades` | `api.js` (3197, 3232, 3308, 3320, 3334) · `taller.js` (144) |
| `proyecto_responsables` | `crm.js` (2009) · `proyecto-detalle.js` (1269, 1277) · `proyectos.js` (883) |
| `proyecto_tipos` | `proyecto-detalle.js` (1281, 1285) · `proyectos.js` (893) |
| `proyectos` | `alertas.js` (168, 195, 217) · `api.js` (163, 391, 1142, 1841, 3844, 4977) · `crm.js` (1034) · `eventos.js` (283, 403, 2622, 2661) · `finanzas.js` (2611, 5306) · `inventario.js` (1727) · `logistica.js` (828) · `proyecto-detalle.js` (110) · `proyectos.js` (300) · `taller.js` (126) |
| `pyme_sync_log` | `api.js` (2263, 2281) |
| `receta_componentes` | `api.js` (1576, 1615, 2556, 2848, 2872, 2913, 3168) · `costos.js` (305, 442, 3013) |
| `remitos` | `api.js` (4684, 4714, 4733) |
| `roles` | `admin-panel.js` (1484, 1579, 1635) · `api.js` (2728) · `auth.js` (172) · `data.js` (609) |
| `rrhh_asignaciones` | `api.js` (714, 761, 782, 797, 813) · `rrhh.js` (1092, 1205, 1338) |
| `rrhh_personal` | `eventos.js` (1878) · `rrhh.js` (1091, 1358) |
| `rrhh_vacaciones` | `rrhh.js` (1359, 1558, 1685, 1687) |
| `rrhh_vacaciones_solicitudes` | `alertas.js` (271) · `rrhh.js` (1360, 1543, 1619) |
| `saldos_apertura` | `contabilidad.js` (5744, 5751) |
| `taller_proyecto_checklist` | `alertas.js` (221) · `api.js` (4763, 4781, 4806, 4819, 4836, 4855, 4868) |
| `transferencias_internas` | `finanzas.js` (4697) |
| `v_libro_iva_compras_extendido` | `api.js` (5073) |
| `v_plan_cobro_resumen` | `api.js` (5115) |
| `v_posicion_iva_mes` | `api.js` (5083) |
| `v_saldo_comprobante` | `api.js` (5234, 5241) |
| `v_saldos_apertura_ejercicio` | `contabilidad.js` (5489) |
| `vehiculos` | `api.js` (4132, 4171, 4221, 4233) |
| `vencimientos_generados` | `finanzas.js` (5885, 6090, 6566, 8191, 8524, 8577, 8588) |
| `vencimientos_recurrentes` | `finanzas.js` (8548, 8632, 8827, 8831, 8850) |

## RPCs (3)

| Función | Archivos (líneas) |
|---|---|
| `calcular_receta` | `api.js` (3111) |
| `fn_generar_asiento_apertura` | `contabilidad.js` (5818) |
| `fn_registrar_diferencia_cambio` | `api.js` (5367) |
