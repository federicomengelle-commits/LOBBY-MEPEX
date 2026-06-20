<!-- Generado por recon workflow (5 lectores + síntesis) 2026-06-20. Semilla del plan de refactor Finanzas+Contabilidad. Verificar schema vivo antes de tocar (regla 12). -->

# DOSSIER DE ALCANCE — Refactor Integral Finanzas + Contabilidad

> Semilla para sesión dedicada. Consolida 5 informes de reconocimiento (finanzas.js · contabilidad.js · La PyME · integraciones · blueprint+ARCA). Refs `archivo:línea` conservadas. Branch de trabajo: `rediseno` → push `main`. Uso real arranca **01/01/2027** (deadline natural del refactor).

---

## 1. Resumen ejecutivo

Finanzas y Contabilidad **no son módulos separables**: toda la contabilidad automática (asientos `tipo='automatico'`) nace de triggers sobre las tablas de Finanzas (`ingresos`/`egresos`), comparten el toggle A/B (canal) por la misma clave localStorage, y los `comprobantes`/`comprobantes_recibidos` alimentan a la vez el Libro IVA y el desglose de IVA del asiento. El refactor persigue tres objetivos entrelazados: **(a)** homogeneizar los 5 caminos por los que entra un movimiento (Compras, Calendario adm, OCR, Rendimiento, Finanzas directo) que hoy traducen categorías de 4 formas distintas y dejan asientos faltantes en silencio; **(b)** reemplazar **La PyME por facturación nativa ARCA** vía proxy VPS (único feature grande sin hacer del blueprint); **(c)** cerrar las deudas contables escritas-pero-no-corridas (IVA en asiento, contra-asiento al anular, integridad) **antes de bloquear el ejercicio 2027**. El feature de carga de comprobantes por foto/IA SE CONSERVA y se integra mejor al circuito.

---

## 2. Estado actual de Finanzas y Contabilidad

### Finanzas (`finanzas.js`, 10.412 líneas — CLAUDE.md dice ~8700, DESACTUALIZADO). Objeto `FinanzasModule`. 8 tabs:

| Tab | Estado | Notas |
|---|---|---|
| **panel** | Completo | KPIs mes + 3 charts (cashflow/donut/aging) + mini-cal. Saldo paralelizado (5862, fix 12.D). |
| **ingresos** | Completo | Subtabs cobros/planes. Multi-moneda. Planes con cuotas, PDF (`_generarResumenPlanPDF` 5293). |
| **egresos** | Completo | Subtabs egresos/iva_recovery. **Inserta `egresos` a pelo** (`supabaseClient.from('egresos').insert/update` 4356/4361) — NO usa `API.createEgreso`, NO toca `comprobante_recibido_id`. |
| **facturacion** | **Parcial + BUG** | Subtabs emitidos/emitir/recibidos. Emitir → La PyME (`_emitirComprobante` 7151). **Las fichas no abren — ver §4 #1.** Sin ARCA. |
| **cuentas** | Completo | Único tab que renderiza `<div id="finCuentasPanel">` (2073) — causa raíz del bug §4 #1. Saldo recalculado al vuelo (`_calcularSaldo` 4380), NO lee `saldos_mensuales`. |
| **conciliacion** | Avanzado, sin pulir | Wizard 5 pasos, `_autoMatch` (monto exacto ±2d) 9527. Sin importador CSV bancario. |
| **calendario** | Parcial | 3 fuentes; fuente 4 "Not implemented" (8278-8279). **Solapa con `calendario-adm.js`.** |
| **reportes** | Completo | 6 subtabs (EERR, rentabilidad proyecto/cliente, cashflow, IVA, mov. extranjeros). |

### Contabilidad (`contabilidad.js`, 5825 líneas). 6 tabs (Plan cuentas / Libro diario / Libro mayor / Asiento manual / Libros IVA / Reportes).
- **Schema real de `asiento_lineas`:** `tipo_movimiento` ('debe'/'haber') + `monto`. **NO existen `debe`/`haber` separadas** (múltiples agentes ya "arreglaron" esto como falso positivo — NO repetir).
- **`asientos`:** usa `concepto` (NO `descripcion`), NO tiene `estado` (vigencia por `_deleted`).
- Libro Mayor (`_loadLibroMayor` 3086) trae TODAS las líneas client-side, sin server-filter (deuda perf, necesita RPC para saldo anterior).
- EERR (`_loadReporteEERR` 4512) clasifica por **prefijo de código hardcodeado** (`4`/`5.1`/`5.2`) — frágil ante renumeración.
- Libros IVA leen directo de comprobantes, NO de asientos → **dos verdades paralelas**.

---

## 3. Acoplamiento Finanzas ↔ Contabilidad (por qué se tocan juntos)

El acoplamiento es **estructural, no incidental**:

1. **Toda la contabilidad automática se origina en Finanzas.** Triggers `AFTER INSERT OR UPDATE OF estado` sobre `ingresos`/`egresos` (`finanzas_fase_e_multimoneda.sql:428-435`). Contabilidad no tiene entrada propia salvo el asiento manual.
2. **Estado compartido localStorage.** Toggle A/B = misma clave `finanzas_vista_canal` en ambos (`contabilidad.js:40-45`). Cambiar el modelo de canal rompe los dos.
3. **Los comprobantes son la fuente del IVA en AMBOS lados** (Libro IVA + split de IVA del asiento). ARCA escribirá esos comprobantes → impacto directo en contabilidad.
4. **El plan de cuentas es el contrato.** `plan_cuentas.cuenta_financiera_id` liga tesorería↔cuenta contable; `mapeo_cuentas` liga categorías/medios↔cuentas de resultado. Cualquier categoría/medio nuevo en Finanzas sin su mapeo → **el asiento desaparece en silencio**.

**Cadena del asiento automático (versión VIVA, E5, 2 líneas):**
- Dispara solo en transición a `confirmado` (ingreso) / `pagado` (egreso). Guarda anti-doble por `OLD.estado`.
- `cuenta_id IS NULL` → `RAISE NOTICE` + return sin asiento (movimiento registrado, sin contabilidad). **Diseño defensivo a preservar.**
- Cuenta tesorería: `SELECT id FROM plan_cuentas WHERE cuenta_financiera_id = NEW.cuenta_id`. Sin vínculo → WARNING + sin asiento.
- Cuenta resultado: `mapeo_cuentas` por `tipo_movimiento` + `campo_origen`/`valor_origen` + `cuenta_contable_id` + `posicion` (búsqueda jerárquica: específico gana al genérico). **Estructura real — NO `clave`/`cuenta_id` del SQL obsoleto `fix_trigger_asiento_auto.sql`.**
- Monto = `COALESCE(NEW.total_en_ars, NEW.monto)` (siempre ARS).
- Saldos materializados por `trg_saldos_lineas` (cascada a meses posteriores) — `saldos_mensuales (cuenta_id, periodo TEXT 'YYYY-MM', canal, saldo_anterior, total_debe, total_haber, saldo_final)`, UNIQUE `(cuenta_id, periodo, canal)`.

**Hallazgo crítico:** `saldos_mensuales` se mantiene por trigger pero **ningún reporte la consume** (Mayor/EERR/Balance recalculan desde `asiento_lineas` en JS). Tabla materializada **sin consumidor real** → riesgo de drift silencioso. El refactor decide: cablearla (1 RPC) o retirarla.

**Riesgos de tocar uno sin el otro:**
- Finanzas sin Contabilidad (nuevas categorías/medios, ARCA escribiendo comprobantes) → asientos faltantes silenciosos o IVA mal desglosado. La operación "funciona" pero la contabilidad miente sin error.
- Contabilidad sin Finanzas (renumerar/mover cuentas) → rompe clasificación hardcodeada de EERR (`4`/`5.1`/`5.2`) y Balance (por `tipo`), `mapeo_cuentas` apunta a cuentas movidas.

---

## 4. Lista COMPLETA de fixes / bugs (numerada, priorizada)

### 🔴 P0 — Roto en prod

**1. Comprobantes (OCR y manuales) no se abren/editan/eliminan en Facturación.**
Causa raíz: `_openRecibidoPanel` (`finanzas.js:7812-7813`) y `_openFactEmitidoPanel` (7449-7450) buscan `getElementById('finCuentasPanel')`; ese elemento **solo existe en `_buildCuentasHTML` (2073)**. Los builders de Facturación (`_buildFactRecibidosHTML` 7634-7660, `_buildFactEmitidosHTML` 7277-7305) no lo incluyen → `if (!panel) return;` sale en silencio → botones Editar (7895)/Eliminar (7900) nunca llegan al DOM. Afecta TODOS los recibidos; se nota en OCR por ser la vía masiva.
**Fix:** envolver Facturación en `<div class="fin-body"><div class="fin-main">…</div><div class="fin-side-panel" id="finCuentasPanel"></div></div>` (igual que cuentas), o panel propio por vista. Sumar el id nuevo a `_closePanel` (2383, hoy solo limpia `finCuentasPanel`/`finIngresosPanel`/`finEgresosPanel`). **Fix chico, alto impacto.**

### 🟠 P1 — Coherencia de datos (pre-requisito del refactor)

**2. Unificar creación de egresos en `API.createEgreso`/`pagarCostoEvento`** en lugar del insert directo (4356/4361) → garantiza link bidireccional `comprobante_recibido_id` y consistencia con OCR/Rendimiento.

**3. Flujo comprobante_recibido → egreso editable.** Hoy el puente robusto vive FUERA de finanzas.js: `API.pagarCostoEvento` (api.js:5877-5935) setea link bidireccional (`comprobantes_recibidos.egreso_id` + `egresos.comprobante_recibido_id`); lo usan Rendimiento y OCR. El tab Egresos NO lo usa. El tab Recibidos solo tiene un dropdown manual "Vincular a egreso" (8028-8033, one-way, setea solo `egreso_id`). **Falta:** botón "Generar egreso/pago desde comprobante" (espejo de `generarEgresoDeOC`) + lista de comprobantes_recibidos sin egreso. Un comprobante OCR guardado sin tildar el checkbox queda huérfano sin forma de generarle egreso por UI.

**4. Flujo comprobante_emitido → ingreso/cobro: NO EXISTE.** `_emitirComprobante` (7151) inserta en `comprobantes` pero **nunca crea `ingreso`** ni setea `comprobantes.ingreso_id` (columna existe, no se popula). **Falta:** generar el ingreso/plan de cobro asociado + estado de cobranza del comprobante (cobrado/pendiente/parcial). En Planes sí hay vínculo cuota↔factura (`_vincularCuotaConFactura` 5192, `plan_cobro_items.comprobante_venta_id`).

### 🟡 P2 — Tesorería real (lo que falta para "ser un módulo de finanzas")

**5. Modelo de cheques/valores.** "cheque" es solo un valor de `medio` (4192). Faltan: nro, banco emisor, fecha emisión vs **fecha de cobro/acreditación**, estado (en cartera/depositado/cobrado/rechazado), propio vs terceros, endoso, cartera de cheques. Un cheque a fecha NO descuenta saldo en la fecha correcta (saldo usa `egresos.fecha`).

**6. `cuenta_id` obligatorio para egresos `pagado` (e ingresos confirmados).** Hoy es opcional ("— Sin cuenta —" 4210) → un egreso pagado sin cuenta no descuenta saldo pero sí suma a "pagado del mes", y **no genera asiento** → invisible en contabilidad. Esta brecha (movimiento sin asiento) es el riesgo de integridad más grande.

**7. Leer `saldos_mensuales` materializado** en vez de recalcular N+1 al vuelo (Panel, detalle cuenta, KPIs) → consistencia con Contabilidad + perf. Requiere RPC de saldo.

**8. Fix IVA en asiento — `sql/fix_iva_asiento.sql` (ESCRITO, NO CORRIDO).** Hoy el asiento sale con 2 líneas (confirmado en test). El fix agrega 3ª línea: DEBE gasto(neto) + DEBE IVA crédito `1.1.09` / HABER banco(total) — y para ingreso HABER venta(neto) + HABER IVA débito `2.1.02`. Split proporcional `v_iva = ROUND(monto * comp.iva/comp.total, 2)`. Idempotente, degrada a 2 líneas si las cuentas no existen.
**⚠ Confirmar antes de correr:** códigos IVA vigentes. El fix usa `1.1.09`/`2.1.02` ("verificados prod 2026-06-18"); blueprint Rendimiento referencia `1.1.04.01`. Correr `SELECT codigo,nombre FROM plan_cuentas WHERE nombre ILIKE '%IVA%'`. **Avisar a Sofi** (afecta TODO Finanzas).

**9. Anular → contra-asiento — `sql/fix_anular_contraasiento.sql` (ESCRITO, NO CORRIDO).** Hoy anular egreso/ingreso NO revierte el asiento (`API.anularPagoEvento` api.js:5938 marca anulado pero el asiento queda; rendimiento.js:660). El fix crea triggers que en transición `pagado/confirmado → anulado` generan asiento de reversión (líneas invertidas, `concepto='Reversión: ...'`), guarda anti-doble por `ILIKE 'Reversión:%'`.
**Mejora recomendada:** reemplazar el string-matching `ILIKE 'Reversión:%'` por columna explícita (`asiento_revertido_id` o `tipo='reversion'`) — frágil si editan el concepto.

**10. Auditoría de integridad egreso→comprobante→asiento→saldos→libro (pedido explícito de Fede).** Read-only ya corrida una vez: backbone SANO (0 movimientos sin asiento, 0 desbalances, 12 mapeos, 17 buckets). **Re-correr tras aplicar #8+#9.** Debe cubrir: (i) asientos huérfanos apuntando a movimientos anulados sin reversión; (ii) comprobantes con IVA cuyo asiento tiene 2 líneas (universo afectado por #8); (iii) `saldos_mensuales` vs recomputo desde `asiento_lineas`; (iv) Posición IVA vs saldo de `1.1.09`/`2.1.02` en el Mayor; (v) cobertura `mapeo_cuentas` (categorías/medios sin mapeo).

### 🟢 P3 — Limpieza / mejoras

**11. Validar CHECK partida doble histórico:** `chk_partida_doble` está `NOT VALID` (`contabilidad_fase_a_hardening.sql:46`). Correr `ALTER TABLE asientos VALIDATE CONSTRAINT chk_partida_doble` tras limpiar histórico. NO ENCONTRADO confirmación de que se haya corrido.

**12. Multi-moneda en transferencias** (diferencia de cambio) — hoy bloqueada entre monedas (4654-4657). Decidir si se resuelve o se mantiene la restricción explícita.

**13. Mejorar conciliación:** importador de extracto bancario real (CSV Galicia/MercadoPago), flag persistente "conciliado" en ingreso/egreso, matching configurable.

**14. Calendario:** implementar fuente 4 (comprobantes recibidos con vencimiento, 8278-8279) y **resolver el solapamiento con `calendario-adm.js`** (decidir fuente de verdad única del calendario administrativo).

**15. Borrar `compras_pagos`** (tabla `compras_module.sql:51-63` + tab + ~210 líneas JS `compras.js:1463-1672`) — código muerto, el pago real vive en el egreso de Finanzas.

**16. Eliminar SYNC La PyME muerta** (ver §5).

---

## 5. Reemplazo de La PyME

### Qué hace HOY (2 flujos desconectados)

**A — EMISIÓN (único uso productivo).** Finanzas → Facturación → Emitir → wizard 3 pasos → `_emitirComprobante` (finanzas.js:7151) → `POST {_VPS_URL}/api/lapyme/facturar` (`_VPS_URL:''` 102 = same-origin, nginx → 127.0.0.1:3000, Express `mepex-api`, `/home/mepex/api/server.js` **fuera del repo**).
- Payload: `tipo, punto_venta (default 5), cuit_dni, servicio, descripcion, neto, iva, total, iva_alicuota (default 21), periodo_*, vto_pago`.
- Respuesta tolerante a naming (`result.cae||result.CAE`, etc.) → `comprobantes` (`cae`, `cae_vencimiento`, `pdf_url`, `lapyme_response` jsonb, estado `emitida`/`error`).
- **Hardcodeados:** alícuota 21% (7081, 7128), una sola alícuota, un solo renglón, PdV 5 sin catálogo.

**B — SYNC de cobros (MUERTO en UI).** El botón "Sync PyME" (`crm.js:1414, 1667-1683`) está gateado por `typeof API.syncPymeToLobby === 'function'`, **pero `syncPymeToLobby` NO existe en ningún archivo** (el método real es `syncFromPyME` api.js:2363, nadie lo llama). Match by `customer.name` (best match por monto más cercano) → columnas `cotizaciones.pyme_*`. **Nunca corre por UI.**

**🔒 Riesgo de seguridad presente:** la API key de La PyME está hardcodeada en cleartext y servida al browser (`api.js:2332`, `lpk_live_...`). La deprecación lo resuelve de paso.

### Qué construir nativo + ARCA (los 5 aportes de La PyME a reemplazar)

| Aporte La PyME | Reemplazo nativo |
|---|---|
| Conexión WSFE + CAE | Endpoint `/api/arca/facturar` en VPS con `arcasdk` (TypeScript, afipts.com): WSAA (ticket) + WSFE (`FECAESolicitar`) |
| Numeración | `FECompUltimoAutorizado` por (PdV, tipo) — **arrancar desde AFIP, NO desde `MAX(numero)` local** |
| Catálogo tipos/PdV | `FEParamGetTiposCbte` / `FEParamGetPtosVenta`. Mapeo: FC A=1, B=6, C=11, NC A=3/B=8/C=13, ND A=2/B=7/C=12, Recibo=4 |
| PDF | **ARCA NO genera PDF** → generar local con jsPDF (precedente: `RemitoPDF` en `remito-pdf.js`) + **QR AFIP RG 4291** → Storage privado |
| Consulta de cobros (`balance`) | Modelo nativo ya existe: `plan_cobro`/`cobro_aplicaciones`/`v_saldo_comprobante`. Vincular factura→cuota (`comprobante_venta_id`) y popular `comprobantes.ingreso_id` (hoy no se setea) |

**Gaps adicionales nativos:** multi-alícuota (array `Iva` WSFE: 21%/10.5%/27%/0%/exento) + multi-ítem; Libro IVA Ventas formato AFIP CSV (vista `v_libro_iva_ventas` — NO ENCONTRADA, pendiente Fase G); decidir si emitir genera asiento de venta a crédito (Deudores/Ventas/IVA débito) o se mantiene vía `ingresos`.

### Activos que quedan huérfanos (a eliminar)
`API._pymeBaseUrl`/`_pymeApiKey`/`_pymeFetch` (2331-2348) · `getPyMESales`/`getPyMESaleById`/`getPyMECustomers`/`syncFromPyME`/`getLastPyMESync` (2350-2493) · botón Sync PyME (`crm.js:1414, 1667-1683`) · tabla `pyme_sync_log` (congelar) · columnas `cotizaciones.pyme_*` (decidir migrar a `ingresos`/`plan_cobro` o congelar read-only). **Renombrar** `comprobantes.lapyme_response` → `arca_response`; panel "Respuesta La PyME" (7543) → "Respuesta ARCA"; métrica `pymeVentaId` (`crm.js:6834`) → reapuntar a `comprobantes`.

### Riesgos de migración
1. **PDFs históricos de La PyME** apuntan a su infraestructura → si cortan el servicio, los `pdf_url` dejan de resolver. **Mitigar:** re-hostear los PDFs históricos en Storage propio antes de cortar.
2. **Correlatividad legal:** ARCA exige correlativo sin saltos por (PdV, tipo). Arrancar desde `FECompUltimoAutorizado`, no de `MAX(numero)` local. **Probablemente haga falta dar de alta un PdV NUEVO** para webservice directo (distinto del de facturación web/La PyME). Riesgo alto de rechazo si se asume mal el punto de partida.
3. **`pyme_*` desactualizados** (sync muerta hace tiempo): no confiar como verdad de cobro. Verificar cuántas cotizaciones tienen `pyme_venta_id` no nulo antes de migrar.
4. **Match-by-name nunca fue confiable** (best match por monto/recencia) → dato derivado sospechoso.
5. **`comprobantes.ingreso_id` no se popula al emitir** → joins factura↔cobro fallan en silencio.
6. **Toggle de transición** "Emitir con La PyME / Emitir con ARCA" en el wizard durante la migración (coexistencia, blueprint).

---

## 6. Integraciones a homogeneizar

### Los 5 caminos por los que entra un GASTO (todos convergen en `egresos` → `fn_asiento_auto_egreso`)
CHECK contrato: `egresos.categoria IN ('proveedor','rrhh','impuesto','servicio','credito_fiscal','alquiler','logistica','otro')`.

| # | Camino | Puente | categoria | estado inicial | canal | Imputación | FK proveedor |
|---|---|---|---|---|---|---|---|
| A | **Compras OC** | `generarEgresoDeOC` (api.js:3881) | `'proveedor'` hardcodeada | **`pendiente`** | `oficial` hardcoded | proyecto+evento ✅ | ❌ texto |
| B | **Calendario adm** | `_openPagar` (calendario-adm.js:228) | enum completo (de plantilla) | `pagado` | `oficial` hardcoded | ❌ ninguna | n/a |
| C | **OCR comprobante** | `_save` (carga-comprobante.js:213) | `_CAT_TO_EGRESO[cat]` | `pagado` (opcional) | elegible | ❌ ninguna | ❌ texto |
| D | **Rendimiento** | `pagarCostoEvento` (api.js:5905) | `RENDIMIENTO_CAT_TO_EGRESO` | `pagado` | por cuenta | proyecto+evento ✅ | ✅ `proveedor_id`/`empleado_id` |
| E | **Finanzas directo** | tab Egresos (insert a pelo 4356) | manual | manual | manual | manual | — |

### Inconsistencias a homogeneizar
1. **CUATRO traducciones de categoría** distintas hacia el mismo enum: Compras hardcodea `'proveedor'`; Calendario usa enum completo; OCR `_CAT_TO_EGRESO` (carga-comprobante.js:22-31); Rendimiento `RENDIMIENTO_CAT_TO_EGRESO` (api.js:5682-5686). Un "alquiler" categoriza distinto según por dónde entre. **Unificar en una capa única** (o que `mapeo_cuentas` server-side decida la cuenta y el front solo mande la categoría de dominio).
2. **Estado inicial inconsistente:** Compras nace `pendiente`, los demás `pagado` → el asiento de Compras aparece en otro momento.
3. **`canal` hardcodeado** en Compras (api.js:3911) y Calendario (calendario-adm.js:230) pese a que el dato existe → rompe el toggle A/B.
4. **FK proveedor rota por tipos:** `compras_proveedores.id` BIGINT vs `egresos.proveedor_id` UUID (api.js:3877-3880). Compras y OCR guardan proveedor TEXTO; solo Rendimiento usa FK (porque `evento_costos` ya es UUID). Conviven `proveedor` (UUID legacy), `compras_proveedores` (BIGINT) y proveedor-texto. **Decisión de raíz: unificar proveedores en una tabla UUID.**
5. **Link OC↔egreso por string-matching** del N° en el concepto (`API._egresoForOC` api.js:3867-3874, `ilike('concepto','OC {n}%')`) → frágil, rompe dedup → FK real.
6. **Imputación desigual:** Compras/Rendimiento imputan proyecto/evento; Calendario/OCR no imputan nada → esos gastos no aparecen en rentabilidad. OCR debería pedir proyecto/evento (`createComprobanteRecibido` ya acepta `proyecto_id` api.js:5822 pero el modal no lo pide).
7. **Generación de vencimientos client-side en loop** (calendario-adm.js:299-321), no cron/RPC → depende de que un admin clickee "Generar". `canal`/`cuenta_sugerida_id` de la plantilla se pierden al pagar.

### Tesorería como pieza central
- `cuentas_financieras` es el eje: el `cuenta_id` del egreso es **condición necesaria** para que exista el asiento.
- Vínculo tesorería↔contabilidad = `plan_cuentas.cuenta_financiera_id`. **Garantizar que toda `cuenta_financiera` activa tenga su `plan_cuentas` espejo** (hoy manual, sin enforcement).
- `transferencias_internas` no aparece en ninguno de los 4 paths (movimiento entre cuentas propias).

### Recomendación estructural
**Un único servicio "registrar gasto"** (idealmente RPC server-side): recibe `{categoria_dominio, monto, fecha, medio, canal, cuenta_id, proyecto_id, evento_id, proveedor_id, comprobante?, origen, origen_id}` y resuelve internamente mapeo + comprobante_recibido + egreso + asiento (con IVA) + links tipados. Compras/Calendario/OCR/Rendimiento pasan a ser **productores de ese payload**. `pagarCostoEvento` (Rendimiento) ya es el ~80% — es la base a generalizar.

### OCR / foto-IA (CONSERVAR)
`carga-comprobante.js` + `tools/vps/ocr-comprobante.js` + `API.ocrComprobante` (api.js:5838). Motor agnóstico Gemini|Claude, degrada a carga manual si el endpoint no responde. El humano confirma siempre. Taxonomías propias de `comprobantes_recibidos`: `tipo ∈ {factura_a/b/c, nota_credito, nota_debito, recibo, otro}`, `categoria ∈ {material, servicio, alquiler, credito_fiscal, logistica, otro}` (NO acepta `proveedor`/`rrhh`). Mapeo al egreso vía `_CAT_TO_EGRESO`.

---

## 7. ARCA SDK — plan de integración

- **SDK:** `arcasdk` (TypeScript, afipts.com) contra WSFE. Compatible Lambda/Vercel/Workers.
- **Endpoint:** `/api/arca/facturar` en el proxy VPS `195.200.1.250:3000` (pm2 `mepex-api`, Express 5 + dotenv + cors), al lado de lapyme/crm-digest/ocr. Contrato: consume `{tipo, cliente, items, totales}`, internamente WSAA + WSFE, devuelve `{cae, vencimiento_cae, numero}`.
- **Same-origin ya resuelto:** el `:3000` directo está firewalleado desde el browser (`Failed to fetch`); se rutea por **nginx `proxy_pass 127.0.0.1:3000`** y el front llama ruta **relativa**. Patrón verificado en `api.js:1011` (`CRM_DIGEST_URL:'/api/crm/digest'`). El front debe llamar `/api/arca/facturar` relativo. (Mismo fix que arregló crm-digest y lapyme — memoria `project_crm_digest_blocker`.)
- **Certificados X.509:** dos ambientes — homologación (testing) + producción. Viven server-side en el VPS (`.env`, junto a los secrets actuales). **Bloqueante real = el trámite del certificado.** Estimado blueprint: ~2 semanas incluyendo trámite.
- **Front:** toggle "La PyME / ARCA" en el wizard durante transición; PDF con QR oficial en jsPDF; una vez validado en prod → deprecar La PyME.
- **Doc:** `afip.gob.ar/ws/documentacion/ws-factura-electronica.asp`.
- **Verificado:** NO existe endpoint ARCA en `api.js` ni en SQL → Fase D no arrancó.

---

## 8. Blueprint v2 — estado A-H

Base: `docs/finanzas_blueprint_v2.md` (congelado 2026-05-19, su tabla de estados está DESACTUALIZADA para G/H/F). Estado real verificado:

| Fase | Qué hace | Estado real |
|---|---|---|
| **A — Hardening** | CHECK partida doble, `saldos_mensuales` (triggers+cascada), `plan_cuentas.imputable`/`controla_subdiario`, `audit_logs` | ✅ HECHO. Falta `VALIDATE CONSTRAINT chk_partida_doble` (NOT VALID). |
| **B — IVA recovery** | `comprobantes_iva_recovery` (no asienta), VIEW, subtab "Registros auxiliares" | ✅ HECHO |
| **C — Plan pagos avanzado** | `cobro_aplicaciones`, VIEWs saldo/resumen, triggers, PDF | ✅ HECHO. Pendiente: generar factura DESDE cuota (movido a D/ARCA). |
| **D — ARCA directo** | Facturación nativa AFIP | ❌ **PENDIENTE — único feature grande sin hacer.** Bloqueado por certificado X.509. |
| **E — Multi-moneda** | 8 tablas con `moneda`/`cotizacion`/`total_en_ars`, snapshot por trigger, dolarapi.com | ✅ HECHO + testeado end-to-end. |
| **F — Conciliación** | Fuzzy match + importador CSV bancario | ⚠️ Wizard 4-5 pasos existe; **fuzzy-match/importador CSV NO completos**. NO hay `sql/finanzas_fase_f_*.sql`. |
| **G — Reportes** | EERR/Balance PDF, Libros IVA, cashflow, dif. cambio auto | ✅ CODEADA EN MAIN (`9402b17`→`149e30c`): G.1 cuentas **4.9.01/5.9.01** · G.2 tab Mapeos auto · G.3 dif. cambio auto · G.4 mov. extranjeros · G.5 planes ME · G.6 Balance+EERR PDF. **NO re-implementar.** |
| **H — Saldos apertura 2027** | Pantalla apertura + bloqueo ejercicio | ✅ CODEADA + SQL corrido (tabla `saldos_apertura` existe, **0 filas** → pendiente CARGA de datos, no código). |

**Seed `mapeo_cuentas` ✅ HECHO** (verificado prod 2026-06-12): 12 mapeos activos (4 ingreso SRV-* + 8 egreso por categoría); asientos automáticos SE GENERAN. NO re-seedear.

**Pendiente real de Fase 8 (lo que cierra el refactor):**
1. Fase D — ARCA (bloqueado por certificado).
2. Fase F — fuzzy match + importador CSV.
3. Correr `fix_iva_asiento.sql` + `fix_anular_contraasiento.sql` (JUNTOS, hermanadas) tras confirmar códigos IVA + avisar a Sofi.
4. Auditoría de integridad re-corrida tras #3.
5. Backfill de asientos para movimientos confirmados ANTES del seed (si los hay).
6. `VALIDATE CONSTRAINT chk_partida_doble`.
7. Generar factura DESDE cuota.
8. Tab CRUD de `mapeo_cuentas` + panel de cobertura en Contabilidad (qué categorías/medios no tienen mapeo → mantenible por Sofi/Lelean).
9. Bugs/flujos nuevos del refactor (§4 #1-#7).

---

## 9. Riesgos + principios

**Principios (CLAUDE.md + memorias):**
- **SQL-first:** para fases con DDL, ejecutar SQL en Supabase primero, luego push del JS. Sino los INSERT con columnas nuevas rompen.
- **DB viva > SQL del repo (regla 12):** verificar con `information_schema.columns` antes de tocar. Las migraciones del repo están aplicadas hace tiempo y la BD se modificó a mano.
- **RLS ya aplicada (Capa 2 completa):** `rls_capa2_motor.sql` (helpers `fn_user_role`/`fn_role_can`) + `rls_capa2_financiero.sql` (ingresos/egresos/comprobantes/asientos por matriz). RLS lee la matriz del Panel. **El service-role del VPS bypassa RLS** — cualquier endpoint nuevo (ARCA) que escriba con service key debe replicar los chequeos de permiso manualmente.
- **Avisar a Sofi** por cualquier cambio que afecte asientos (fix IVA pasa los asientos de 2→3 líneas; afecta TODO Finanzas).
- **Uso real arranca 01/01/2027:** el refactor debe estar **terminado y validado ANTES de cargar la apertura** y bloquear el ejercicio (`fn_generar_asiento_apertura`, asiento `tipo='apertura'` fecha 2027-01-01). Bloquear congela saldos; corregir post-bloqueo exige asientos de ajuste. Bajo volumen actual → los cabos sueltos son latentes, no urgentes, pero deben cerrarse antes del corte.
- **No romper lo que funciona; cambios quirúrgicos.** Bug-hunting de subagentes tiene muchos falsos positivos en este repo — verificar SIEMPRE contra schema real y flujo de código.

**Riesgos técnicos a preservar (NO romper):**
- Schema real `asiento_lineas` (`tipo_movimiento`+`monto`, NO `debe`/`haber`).
- Estructura real `mapeo_cuentas` (`campo_origen`/`valor_origen`/`cuenta_contable_id`/`posicion`).
- Triggers de saldos con cascada + UNIQUE `(cuenta_id, periodo, canal)`.
- **"Silencio defensivo"** de los triggers: sin cuenta/sin mapeo → no rompe el INSERT del movimiento. Un fallo contable NO debe bloquear la operación de caja.
- Validación partida doble en asiento manual + CHECK.
- Sincronización del canal A/B entre ambos módulos.
- Multi-moneda (Fase E): los asientos SIEMPRE en ARS usando `total_en_ars` (no `monto`). Transferencias entre monedas distintas bloqueadas.

**Confusión de fuentes SQL a resolver:** existen **3 versiones de `fn_asiento_auto_*`** en `/sql` — (1) `fix_trigger_asiento_auto.sql` OBSOLETO (`mapeo_cuentas.clave`/`cuenta_id` inexistentes); (2) `finanzas_fase_e_multimoneda.sql:279-435` = **base VIVA** (2 líneas); (3) `fix_iva_asiento.sql` = más nuevo (3 líneas, NO corrido). **Verificar cuál está activa en prod antes de tocar.** `contabilidad_fase1_*.sql` fueron borrados (no reflejaban prod) — si una sesión los busca, no existen.

---

## 10. Orden de ataque sugerido (menor → mayor riesgo, recon-first tipo Fase 12)

**Fase 0 — Reconocimiento (recon-first, sin tocar código).**
- Verificar schema vivo: códigos IVA (`SELECT codigo,nombre FROM plan_cuentas WHERE nombre ILIKE '%IVA%'`), cuál `fn_asiento_auto_*` está activa en prod, columnas de `egresos`/`comprobantes_recibidos`/`comprobantes`, estado del CHECK `chk_partida_doble`, cuántas cotizaciones tienen `pyme_venta_id` no nulo.
- Re-correr auditoría de integridad read-only (§4 #10).
- Cerrar la fuente SQL viva vs obsoleta.

**Fase 1 — Quick win P0 (riesgo nulo, alto impacto).**
- Fix #1: montar `#finCuentasPanel` en Facturación + `_closePanel`. Desbloquea abrir/editar/eliminar comprobantes OCR. JS puro.

**Fase 2 — Deudas contables SQL (hermanadas, SQL-first, avisar a Sofi).**
- Correr `fix_iva_asiento.sql` + `fix_anular_contraasiento.sql` JUNTOS tras confirmar códigos IVA. Backfill si hace falta. `VALIDATE CONSTRAINT chk_partida_doble`. Re-testear egreso-con-factura (3 líneas) + anular (reversión netea). Mejorar: columna explícita de reversión en vez de `ILIKE`.

**Fase 3 — Coherencia de datos / homogeneización (P1).**
- Unificar creación de egresos en `API.createEgreso` (sacar inserts a pelo de finanzas.js 4356/4361).
- Flujo comprobante_recibido → egreso editable (#3) + comprobante_emitido → ingreso (#4).
- Decisión de raíz: unificar proveedores en tabla UUID; FK real OC↔egreso.
- Construir el servicio único "registrar gasto" (generalizar `pagarCostoEvento`); reapuntar Compras/Calendario/OCR como productores.
- Imputación proyecto/evento en OCR + Calendario.

**Fase 4 — Tesorería real (P2).**
- `cuenta_id` obligatorio para `pagado`/confirmado.
- Modelo de cheques/valores + cartera + fecha de cobro en saldo/cashflow.
- Leer `saldos_mensuales` materializado (RPC de saldo) en Panel/cuenta/KPIs + cablear Mayor/EERR/Balance a la tabla o retirarla.
- Pago desde tesorería con medio real (efectivo/cheque-valor/transferencia atada a cuenta).

**Fase 5 — Conciliación + calendario (P3).**
- Importador CSV bancario + fuzzy match + flag conciliado (Fase F).
- Resolver solapamiento `finanzas.js` calendario vs `calendario-adm.js`; implementar fuente 4.
- Borrar `compras_pagos` (tabla + tab + ~210 líneas).

**Fase 6 — ARCA (mayor riesgo, bloqueado por trámite — arrancar en paralelo desde Fase 0).**
- Trámite certificado X.509 (homologación + producción) — bloqueante, iniciar YA.
- Endpoint `/api/arca/facturar` en VPS (`arcasdk`, WSAA+WSFE), ruta nginx relativa.
- Numeración correlativa desde `FECompUltimoAutorizado` (probable PdV nuevo); multi-alícuota/multi-ítem; PDF + QR AFIP en jsPDF → Storage.
- Toggle La PyME/ARCA en wizard; vincular emitido→ingreso/cuota; popular `comprobantes.ingreso_id`.
- Re-hostear PDFs históricos de La PyME antes de cortar; eliminar SYNC La PyME muerta + API key expuesta; renombrar `lapyme_response`→`arca_response`.

**Fase 7 — Cierre / pre-2027.**
- Tab CRUD `mapeo_cuentas` + panel de cobertura (mantenible por Sofi/Lelean).
- Auditoría de integridad final.
- Cargar saldos de apertura 2027 → bloquear ejercicio (SOLO cuando todo lo anterior esté validado).

**Archivos clave para abrir:** `finanzas.js`, `contabilidad.js`, `api.js`, `carga-comprobante.js`, `rendimiento.js`, `compras.js`, `calendario-adm.js`, `tools/vps/ocr-comprobante.js`, `docs/finanzas_blueprint_v2.md`, `sql/finanzas_fase_e_multimoneda.sql` (triggers vivos), `sql/fix_iva_asiento.sql`, `sql/fix_anular_contraasiento.sql`, `sql/contabilidad_fase_a_hardening.sql`. **NO usar de referencia:** `sql/fix_trigger_asiento_auto.sql` (obsoleto), `sql/contabilidad_fase1_*.sql` (borrados).