<!-- Generado por workflow finanzas-blast-radius (2026-06-20, 21 agentes, 107 paths). Insumo de Fase 3. Verificar schema vivo antes de tocar. -->

# MAPA DE BLAST-RADIUS — Fase 3 (circuito único de gastos)

> Síntesis del audit de 8 superficies + veredictos adversariales. Verificado contra código vivo (`api.js`, `finanzas.js`, `carga-comprobante.js`, `sql/finanzas_fase3.sql`, `sql/finanzas_fase5.sql`) y contra el recon de prod (`docs/finanzas-contabilidad-refactor-PLAN-EJECUCION.md §0`). Lo no verificado está marcado **[NO VERIFICADO]**.

## Hechos-ancla confirmados en esta síntesis (no asumidos)

- **`egresos.categoria` CHECK = 8 valores** (`sql/finanzas_fase3.sql:11`): `proveedor, rrhh, impuesto, servicio, credito_fiscal, alquiler, logistica, otro`.
- **`comprobantes_recibidos.categoria` CHECK = 6 valores** (`sql/finanzas_fase5.sql:54`): `material, servicio, alquiler, credito_fiscal, logistica, otro` — **NO** acepta `proveedor/rrhh/impuesto`. Taxonomía disjunta de egresos.
- **`comprobantes_recibidos.tipo` CHECK** (`sql/finanzas_fase5.sql:46-49`): `factura_a/b/c, nota_credito, nota_debito, recibo, otro`. → **el fallback `tipo: comprobante.tipo || 'A'` en `api.js:5889` es ilegal** (`'A'` ∉ enum). Bug real, confirmado.
- **12 write-sites a `egresos`** confirmados (6 INSERT + 6 UPDATE). El grep simple devuelve 7 porque dos INSERT son llamadas encadenadas multilínea (`.from('egresos')\n.insert(...)` en `finanzas.js:4674` y `:4536/8536`); ambas son inserts reales. El conteo "12" del audit **se sostiene**.
- **`saldos_mensuales`: 0 readers reales** (`grep from('saldos_mensuales')` = NONE; solo comentarios). Confirmado.
- **`cobro_aplicaciones`/`aplicarCobro`: 0 refs en `finanzas.js`**. Confirmado — backend vivo, UI muerta.

---

## 1) Touch-points a preservar — por tabla, rankeados por break-risk

### Tabla `egresos` (6 INSERT + 6 UPDATE)

| Rank | break-risk | Path | file:line | Op | Por qué duele |
|---|---|---|---|---|---|
| 1 | **ALTO** | `pagarCostoEvento` (Rendimiento) | `api.js:5877-5935` | insert+update | Orquestador completo (~80% del RPC): comprobante→egreso→**link bidireccional** (`:5924`)→`evento_costo_pagos` (`:5928`). Único con FK `proveedor_id`/`empleado_id` condicional (`:5910-5911`) y pagos parciales. |
| 2 | **ALTO** | `createEgreso` (helper canónico) | `api.js:5777-5805` | insert | Único que setea `comprobante_recibido_id`/`empleado_id`/`total_en_ars` override. Convergencia de B/C/D. Base natural del RPC. |
| 3 | **ALTO** | `generarEgresoDeOC` (Compras) | `api.js:3881-3920` | insert | **Único `estado:'pendiente'`** (`:3909`). `categoria:'proveedor'` y `canal:'oficial'` HARDCODE (`:3902/3911`). Link OC↔egreso por **string-match** (`:3870-3872`). Inserta a pelo (`:3915`). |
| 4 | **ALTO** | Modal manual Egreso (alta) | `finanzas.js:4307-4361` | insert | Inserta a pelo (`:4361`). **Único con `estado:'programado'`+`fecha_programada`, multimoneda editable, y `credito_fiscal` con neto/iva como JSON en `notas`**. NO setea `comprobante_recibido_id`. |
| 5 | **ALTO** | Transferencia interna (pata egreso) | `finanzas.js:4674-4682` | insert | **No es gasto.** `categoria:'otro'`+`estado:'pagado'` (`:4677-4679`) → **hoy dispara `fn_asiento_auto_egreso` como si fuera gasto**. Par atómico con el ingreso `:4687`. |
| 6 | MEDIO | Pago vencimiento (Calendario-adm) | `calendario-adm.js:222-237` | insert+update | Usa `createEgreso` (`:228`). `canal:'oficial'` HARDCODE (`:230`) **pierde `canal`+`cuenta_sugerida_id` de la plantilla**. No imputa. Link tipado `vencimientos_generados.egreso_id` (`:232`). |
| 7 | MEDIO | Pago vencimiento (Calendario *interno* de Finanzas) | `finanzas.js:8530-8549` | insert | **Duplicado funcional** del #6. Inserta a pelo, `canal:'oficial'` HARDCODE (`:8543`). Hay que consolidar AMBOS. |
| 8 | MEDIO | OCR `_save` (egreso opcional) | `carga-comprobante.js:194-220` | insert+update | Egreso vía checkbox (`:211-218`). Link bidireccional (`:217`+`:219`). Respeta `canal` del select. No imputa proyecto/evento. |
| 9 | MEDIO | Modal Egreso (edición) | `finanzas.js:4356` | update | Re-categoriza/re-imputa. **NO re-evalúa el asiento** del egreso pagado → desincroniza. |
| 10 | MEDIO | Anular egreso (Finanzas) | `finanzas.js:4065` | update | `estado:'anulado'`. Disparador del trigger de reversión (ya vivo — ver §4). |
| 10 | MEDIO | Anular pago (Rendimiento) | `api.js:5944` | update | `estado:'anulado'`. **No toca `comprobantes_recibidos`** → comprobante vivo apuntando a egreso anulado. |
| 12 | BAJO | Edición inline concepto | `finanzas.js:3879` | update | **Rompe el dedup string de OC** si se edita el concepto de un egreso de Compras. |
| 12 | BAJO | Soft-delete | `finanzas.js:4086`, `:3848` | update | `_deleted:true`. Asiento queda vivo. |

### Tabla `ingresos` (asimetría clave: NO existe `API.createIngreso`)

| Rank | break-risk | Path | file:line | Op | Por qué duele |
|---|---|---|---|---|---|
| 1 | **ALTO** | Modal Ingreso (alta) | `finanzas.js:3505-3510` | insert | Único insert de negocio. Dispara `fn_asiento_auto_ingreso` (estado `confirmado`). **2 side-effects post-insert SOLO en JS**: sync `plan_cobro_items.monto_cobrado` (`:3514-3528`) + `detectarYRegistrarDifCambio` (`:3537-3549`). Sanitizador UUID `:3488-3493`. |
| 2 | **ALTO** | Modal Ingreso (edición) | `finanzas.js:3497-3501` | update | Transición `pendiente→confirmado` dispara asiento. NO re-corre dif-cambio ni sync de plan → desincroniza `monto_cobrado`. |
| 3 | MEDIO | Transferencia interna (pata ingreso) | `finanzas.js:4686-4695` | insert | `estado:'confirmado'`+`cuenta_id` → asiento auto. Par atómico con egreso `:4674`. `canal:'oficial'` HARDCODE. |
| 4 | MEDIO | Anular ingreso | `finanzas.js:3150-3153` | update | No revierte asiento (mismo patrón). |
| 5 | BAJO | Soft-delete (fila/panel) | `finanzas.js:2965`, `:3175` | update | Trigger de saldos reacciona a `_deleted`. |
| 6 | BAJO | Inline concepto | `finanzas.js:2996` | update | Sin contabilidad. |

> **Asimetría para el RPC:** egresos tiene puente (`pagarCostoEvento`); ingresos **no tiene capa de API** — toda creación es inline en `finanzas.js`. `registrar_cobro` hay que **crearlo de cero** y migrar 7 write-sites inline.

### Tabla `comprobantes` (emitidos) — 1 sola vía de emisión

| Rank | break-risk | Path | file:line | Op | Por qué duele |
|---|---|---|---|---|---|
| 1 | **ALTO** | `_emitirComprobante` (La PyME) | `finanzas.js:7217` (éxito) / `:7246` (error) | insert | A pelo. `canal:'oficial'`, PdV 5, IVA 21% HARDCODE. **Nunca crea ingreso ni popula `comprobantes.ingreso_id`** (gap). Inserta record `estado:'error'`+`error_detalle` al fallar (`:7246`) = **feature de auditoría a preservar**. |
| 2 | MEDIO | `vincularCuotaAComprobante` | `api.js:5392-5394` | update (plan_cobro_items) | Único link emitido→cobro (`comprobante_venta_id`). Trigger `fn_marcar_cuota_facturada`. |
| 3 | BAJO | `softDelete` genérico | `api.js:5659-5663` | update | Whitelist acepta `comprobantes`. **[NO VERIFICADO]** caller directo. |

### Tabla `comprobantes_recibidos` — 3 vías de INSERT

| Rank | break-risk | Path | file:line | Op | Por qué duele |
|---|---|---|---|---|---|
| 1 | **ALTO** | `createComprobanteRecibido` (helper) | `api.js:5808-5833` | insert | Convergencia de OCR+Rendimiento. Acepta `proyecto_id`+`egreso_id`. **NO acepta `evento_id`** (no está en el row) → para imputar evento hay que ampliar la API, no solo el modal. |
| 2 | **ALTO** | OCR `_save` | `carga-comprobante.js:195-219` | insert+update | Crea SIEMPRE comprobante; egreso opcional; link bidireccional; bucket privado + degradación elegante. Comprobante huérfano si no se tilda egreso (gap §4#3). |
| 3 | MEDIO | `_showRecibidoModal` (CRUD manual) | `finanzas.js:8106` (insert) / `:8101` (update) | insert+update | A pelo. Multimoneda. Link **one-way** (solo `egreso_id`). ⚠ **Inalcanzable hoy** por bug P0 del panel (Fase 1). |
| 4 | MEDIO | Soft-delete recibido | `finanzas.js:7920` | update | No desvincula egreso ni revierte asiento. Inalcanzable hoy (P0). |

### Tabla `asientos` / `asiento_lineas` (motor — el blast-radius real pasa acá)

| break-risk | Touch-point | file:line | Por qué |
|---|---|---|---|
| **ALTO transversal** | Trigger `fn_asiento_auto_ingreso/egreso` (versión viva 2 líneas) | `sql/finanzas_fase_e_multimoneda.sql:279-435` | **Contrato que TODO movimiento debe cumplir** (ver §3). Silencio defensivo + multimoneda (`total_en_ars`). |
| **ALTO transversal** | Las 3 columnas `asiento_lineas.cuenta_id` + `tipo_movimiento` + `monto` | — | Sostienen Mayor/EERR/Balance simultáneamente. **NO renombrar.** |
| **ALTO** | Trigger reversión `trg_revertir_asiento_*` | `sql/fix_anular_contraasiento.sql:22-109` | **YA CORRIDO en prod** (recon §0). Anti-doble por `ILIKE 'Reversión:%'` (frágil). El RPC de anular debe usar `UPDATE estado='anulado'`, NO delete. |
| MEDIO | Materialización `saldos_mensuales` (cascada) | `sql/contabilidad_fase_a_hardening.sql:69-234` | Bucket `(cuenta_id, periodo, canal)`. Cascada O(meses futuros) por línea. **0 readers** → drift latente, no rompe lectura hoy. |
| BAJO | Asiento manual | `contabilidad.js:3686-3716` | Demuestra el contrato `tipo_movimiento`/`monto` para escritores de líneas. |

### Lectores transversales (rompen si el RPC cambia strings/columnas)

- **Strings de estado exactos** (`egreso 'pagado'` / `ingreso 'confirmado'` / `comprobante 'emitida'`): KPIs `finanzas.js:5800-5895`, `_calcularSaldo` `finanzas.js:4380-4422`, **`lobby.js:517-557` (consumidor oculto, NO en dossier)**, dashboard `api.js:5991-6024`.
- **3 implementaciones DUPLICADAS de saldo por cuenta**: `finanzas.js:4380`, `finanzas.js:5862`, `lobby.js:548`. Migrar a `saldos_mensuales` → reapuntar las 3 a la vez.
- **EERR contable clasifica por prefijo HARDCODE** `4`/`5.1`/`5.2` (`contabilidad.js:4572-4584`): las cuentas IVA del fix (`1.1.09`/`2.1.02`) caen fuera → OK, pero verificar antes de Fase 2.
- **VIEWs `v_saldo_comprobante`/`v_plan_cobro_resumen`** (`api.js:5302-5455`): rompen si ARCA renombra columnas de `comprobantes`. `v_saldo_comprobante` usa `c.total` (NO `total_en_ars`) → gap multimoneda **[NO VERIFICADO en SQL de la VIEW]**.

---

## 2) Features custom en riesgo y cómo preservarlas

| Feature | Dónde vive | Cómo preservarla al pasar al RPC |
|---|---|---|
| **OCR foto/IA** | `carga-comprobante.js` + `api.js:5838` (`ocrComprobante`) + `tools/vps/ocr-comprobante.js` (**FUERA del repo**, en VPS) | El RPC debe mantener: egreso **opcional** (checkbox), comprobante-primero-egreso-después, modo manual degradado, humano confirma siempre, bucket privado. **El enum de `tipo` lo fuerza el prompt del VPS** (`ocr-comprobante.js:28-39`) → cambiar la taxonomía obliga a tocar el VPS **y redeployar**, no basta el repo. |
| **Rendimiento (pagos parciales)** | `pagarCostoEvento` `api.js:5877` + `evento_costo_pagos` + `trg_sync_costo_desde_pago` | Separar el **núcleo** (comprobante→egreso→asiento→links) del **side-effect específico** (`evento_costo_pagos` insert `:5928`). El RPC genérico **NO debe asumir** esa tabla; Rendimiento la inserta como productor después de llamar al RPC. Preservar FK `proveedor_id`/`empleado_id` condicional por categoría. |
| **Compras OC** | `generarEgresoDeOC` `api.js:3881` + `_egresoForOC` `:3867` | RPC debe **nacer `pendiente`** (parametrizar estado). **Migrar el link string-match a FK real `orden_compra_id`** (la columna es UUID, hoy se omite por mismatch con `compras_ordenes.id` BIGINT → depende de la unificación de proveedores §2 del plan). Dedup por FK, no por `ilike`. |
| **Calendario-adm** | `calendario-adm.js:222` + `vencimientos_generados.egreso_id` | **Oportunidad de fix:** leer `canal` y `cuenta_sugerida_id` de la plantilla (`vencimientos_recurrentes`, `:259-260`) en vez de hardcodear. Consolidar con el **segundo pagador** (`finanzas.js:8530`) en un solo flujo. |
| **Multi-moneda** | `createEgreso` override `total_en_ars` `:5801`; modal manual `_readMonedaFields`; `createComprobanteRecibido` `moneda/cotizacion` | RPC acepta `moneda`+`cotizacion`; `total_en_ars` lo materializa el trigger `fn_snapshot_total_ars_monto` (no recalcular en RPC salvo override explícito). Asientos SIEMPRE en `total_en_ars`. |
| **Canal A/B** | Todos los lectores leen `*.canal`; el asiento hereda `COALESCE(NEW.canal,'oficial')` | RPC **DEBE propagar `canal` del payload al egreso/comprobante** → de ahí al asiento → a `saldos_mensuales` (canal es parte de la PK del bucket). Hoy Compras/Calendario/transferencia lo hardcodean → **ya rompen parcialmente el toggle**; el RPC es la chance de arreglarlo (excepto Compras, que **no tiene fuente de canal** — ver stale claims). |
| **Plan de cobro** | side-effects JS `finanzas.js:3514-3528` (sync `monto_cobrado`) + `detectarYRegistrarDifCambio` `:3537` | `registrar_cobro` debe **re-implementar server-side** ambos side-effects (hoy se perderían si solo se centraliza el INSERT). `cobro_aplicaciones`/multi-factura están **muertos en UI** → no es feature viva, es schema sin consumidor (decidir si revivir o ignorar). |
| **`credito_fiscal` como JSON en `notas`** (modal manual) | `finanzas.js:4332-4340` | **Deuda de datos no documentada en dossier**: el crédito fiscal cargado por el modal manual queda **fuera de `comprobantes_recibidos` y del Libro IVA**. El RPC debería migrarlo a comprobante real, o preservar el JSON como fallback explícito. |
| **Record de comprobante `error`** | `_emitirComprobante` `finanzas.js:7246` | ARCA (Fase 6) debe mantener el rastro de facturas fallidas. |

---

## 3) Diseño recomendado del RPC `registrar_gasto`

**Base a generalizar = `pagarCostoEvento` (`api.js:5877`), NO `createEgreso`.** `createEgreso` es solo el insert del egreso; `pagarCostoEvento` ya orquesta el ciclo completo correcto (comprobante→egreso→link bidireccional→asiento) respetando canal y multimoneda.

### Firma propuesta

```
registrar_gasto(
  -- núcleo del gasto
  p_categoria_dominio   TEXT,      -- categoría del ORIGEN (jornal/flete/material/proveedor/alquiler/servicio/impuesto/rrhh/otro/…)
  p_origen              TEXT,      -- 'rendimiento'|'compras'|'ocr'|'calendario'|'finanzas_directo'
  p_monto               NUMERIC,
  p_fecha               DATE,
  p_estado              TEXT DEFAULT 'pagado',   -- parametrizable: Compras manda 'pendiente'
  p_canal               TEXT DEFAULT 'oficial',
  p_medio               TEXT DEFAULT 'transferencia',
  p_cuenta_id           UUID DEFAULT NULL,       -- sin cuenta → registrado sin asiento (silencio defensivo)
  -- imputación (cierra rentabilidad)
  p_proyecto_id         UUID DEFAULT NULL,
  p_evento_id           UUID DEFAULT NULL,
  -- proveedor / persona (FK real, una sola representación)
  p_proveedor_id        UUID DEFAULT NULL,
  p_empleado_id         UUID DEFAULT NULL,
  p_destinatario_texto  TEXT DEFAULT NULL,       -- fallback si no hay FK
  -- comprobante embebido (opcional)
  p_comprobante         JSONB DEFAULT NULL,      -- {tipo,numero,cuit,razon_social,neto,iva,total,categoria?,archivo_url?}
  -- multimoneda
  p_moneda              TEXT DEFAULT 'ARS',
  p_cotizacion          NUMERIC DEFAULT 1,
  -- link de origen (reemplaza string-matching)
  p_orden_compra_id     UUID DEFAULT NULL,       -- Compras: FK real, mata el ilike
  p_notas               TEXT DEFAULT NULL
) RETURNS jsonb  -- {egreso_id, comprobante_recibido_id}
```

### Qué resuelve server-side (la ganancia real = **atomicidad** + **una sola traducción**)

1. **Traducción de categoría centralizada.** El front manda `p_categoria_dominio` (de su origen); el RPC resuelve **ambas taxonomías** internamente — derivado de las **4 traducciones reales** encontradas:

   | Origen | `→ egresos.categoria` | `→ comprobantes_recibidos.categoria` | Fuente |
   |---|---|---|---|
   | Rendimiento | `RENDIMIENTO_CAT_TO_EGRESO` (jornal→rrhh, flete→logistica, proveedor→proveedor, seguro→servicio, comida→otro) | `RENDIMIENTO_CAT_TO_RECIBIDO` (jornal→otro, flete→logistica, proveedor→material, seguro→servicio, comida→otro) | `api.js:5682`/`:5685` |
   | OCR | `_CAT_TO_EGRESO` (material→proveedor; resto identidad) | identidad (`_CATS` UI) | `carga-comprobante.js:31` |
   | Compras | hardcode `'proveedor'` (passthrough) | n/a (no crea comprobante) | `api.js:3902` |
   | Calendario / Finanzas-directo | passthrough enum completo (`categoria_egreso` plantilla / select) | n/a | `calendario-adm.js:229` / `finanzas.js:4309` |

   → El RPC mantiene **2 tablas de mapeo server-side** (dominio→egreso, dominio→recibido) porque los enums son **disjuntos** (egreso tiene `proveedor/rrhh/impuesto`; recibido tiene `material`; no coinciden). **Normalizar el fallback ilegal `'A'`** (`api.js:5889`) a `'factura_a'` u `'otro'`.

2. **Atomicidad transaccional.** Hoy el link bidireccional son 2-3 round-trips JS no atómicos (`carga-comprobante.js:217`+`:219`; `api.js:5905`+`:5924`). Si falla el 2º update → link a medias. El RPC hace comprobante→egreso→`UPDATE comprobantes_recibidos.egreso_id`→(FK OC) en una transacción.

3. **Estado parametrizable** (`pagado`/`pendiente`/`programado`) en vez de hardcode.

4. **`cuenta_id` opcional preservando el silencio defensivo** — sin cuenta, el movimiento se registra y el trigger sale sin asiento (NOTICE), NO error.

### Lo que el RPC **NO** debe absorber (mantener en el productor JS)

- **`evento_costo_pagos` + `trg_sync_costo_desde_pago`** (`api.js:5928`): exclusivo de Rendimiento. Lo inserta Rendimiento *después* de llamar al RPC.
- **Transferencias internas** (`finanzas.js:4674`): **NO** son gasto. Decidir explícitamente que el RPC **no las cubre** — y resolver que su egreso `categoria:'otro'`+`pagado` **deje de generar asiento de gasto** (hoy SÍ lo genera vía `fn_asiento_auto_egreso`). Riesgo real de doble-contabilización si el RPC las trata como gasto.

---

## 4) Claims del dossier que están STALE

| # | Claim del dossier | Realidad | Evidencia |
|---|---|---|---|
| 1 | §6 modela **5 write-paths** a egresos | Hay **≥12** (6 insert + 6 update). No listados: transferencia interna (`finanzas.js:4674`), **2º pagador de vencimientos** (`finanzas.js:8530`), update edición (`:4356`), inline concepto (`:3879`), anular/soft-delete. El RPC como insert único **no cubre los UPDATE ni la transferencia**. | grep `from('egresos')` = 12 sitios |
| 2 | §4#2 "sacar inserts a pelo de finanzas.js (4356/4361)" | Son **4** inserts directos en `finanzas.js`, no 2: + transferencia (`:4674`) + venc (`:8530`). | confirmado en código |
| 3 | §3 asume **versión 2-líneas viva** en prod; `fix_iva` "escrito no corrido" | **`fix_iva` confirmado NO corrido** por el recon (`PLAN §0`: `fn_*` = 2 líneas). La parte stale es la del audit que dudaba: el recon **resuelve la ambigüedad**. ✅ versión 2-líneas es la viva. | `PLAN-EJECUCION.md:16` |
| 4 | §9.2 "anular no revierte asiento" (deuda abierta) | **STALE / SALDADA**: `fix_anular_contraasiento` **YA CORRIDO** en prod (`trg_revertir_asiento_*` vivos). La reversión funciona. El audit lo trata como pendiente en varios paths (`api.js:5944`, `finanzas.js:4065`) — esos UPDATEs **ya disparan** la reversión. | `PLAN-EJECUCION.md:15` |
| 5 | §4#4 / Fase D asume **migración La PyME** | **STALE**: La PyME = **0 comprobantes, 0 PDFs, 0 cotizaciones** en prod → ARCA es **greenfield**, sin migración ni coexistencia. | `PLAN-EJECUCION.md:20,47` |
| 6 | §6 "_CAT_TO_EGRESO en carga-comprobante.js:22-31" | Está **solo en `:31`**. `:22-25` son `_TIPOS`, `:26-29` son `_CATS`. Map correcto: solo `material→proveedor` remapea, resto identidad. | `carga-comprobante.js:22-31` |
| 7 | §6#3 "canal hardcodeado en Compras pese a que el dato existe" | **Impreciso para Compras**: `compras_ordenes` **no tiene columna de canal** → no hay de dónde sacarlo. El reproche aplica a Calendario (la plantilla SÍ tiene `canal`, `:259`) pero **Compras necesita AGREGAR** el dato, no solo dejar de hardcodear. | `api.js:3900-3914` vs `calendario-adm.js:259` |
| 8 | §6#6 "OCR debería pedir proyecto/evento (createComprobanteRecibido acepta proyecto_id)" | Correcto + matiz no dicho: **`createComprobanteRecibido` NO acepta `evento_id`** (`api.js:5808-5829`, no está en el row). Para imputar evento al comprobante hay que **ampliar la API**, no solo el modal. | `api.js:5808-5829` |
| 9 | §finanzas "comprobantes_recibidos.tipo enum cerrado validado" | No menciona el **bug latente real**: `pagarCostoEvento` inserta `tipo: comprobante.tipo || 'A'` (`api.js:5889`); `'A'` ∉ CHECK → viola constraint si `tipo` llega vacío. | `api.js:5889` vs `sql/finanzas_fase5.sql:46-49` |
| 10 | "comprobante_emitido→ingreso cableado" / tab ingresos "Completo" | El modal de ingreso **no tiene `comprobante_id` ni `evento_id`** (aparecen solo en el sanitizer `finanzas.js:3488`, nunca se asignan). Desde el WRITE de ingresos **no hay link a comprobante ni imputación a evento**. | `finanzas.js:3473-3488` |
| 11 | Fase C / "cobro multi-factura HECHO" | `cobro_aplicaciones`/`aplicarCobro` = **0 refs en `finanzas.js`**. Schema vivo, **UI muerta**. El cobro real = insert directo + sync inline de `plan_cobro_items`. | grep = 0 matches |
| 12 | §4#10.iv "Posición IVA vs Mayor 1.1.09/2.1.02" como check existente | **No existe en código hoy**: `_renderIVAPosicion` (`contabilidad.js:4364-4435`) calcula 100% desde comprobantes, nunca lee `asiento_lineas`. Es check **nuevo**, no auditoría de algo cableado. | `contabilidad.js:4372-4378` |
| 13 | CLAUDE.md "finanzas.js ~8700 líneas" | Stale (ya corregido en dossier a ~10.4k). El path manual vive en `:4307-4373`, consistente con >10k. | — |

**Verificaciones positivas (NO stale, confirmadas):** Libro Mayor sin server-filter (`contabilidad.js:3116`); EERR por prefijo 4/5.1/5.2 (`:4572`); Libros IVA leen comprobantes no asientos (`:4108-4165`); `saldos_mensuales` sin consumidor; las 3 taxonomías disjuntas.

---

## 5) Ajustes concretos al plan de 7 fases

El plan (`docs/finanzas-contabilidad-refactor-PLAN-EJECUCION.md`) está **bien alineado** con el recon — su §0 ya absorbió las stale claims #4 y #5. Ajustes que el mapa sugiere:

1. **Fase 3 — ampliar el alcance del "sacar inserts a pelo".** El plan §70 dice "sacar el insert a pelo de finanzas.js" (singular). Son **4 inserts directos** (`:4361`, `:4356` update, `:4674` transferencia, `:8530` venc) + el de Compras (`api.js:3915`). Enumerarlos explícitamente.

2. **Fase 3 — tratar la transferencia interna como caso excluido explícito.** Agregar bullet: *"El egreso/ingreso de transferencia (`finanzas.js:4674`/`:4687`) NO pasa por `registrar_gasto`. Decidir si genera asiento de movimiento entre cuentas o ninguno — hoy `fn_asiento_auto_egreso` lo trata como gasto (`categoria:'otro'`+`pagado`)."* Es break-risk ALTO no mencionado.

3. **Fase 3 — consolidar los DOS pagadores de vencimientos.** El plan §83 menciona el solape calendario en **Fase 5**, pero el INSERT duplicado (`finanzas.js:8530` vs `calendario-adm.js:228`) es un write-path de gasto → debe reapuntarse al RPC en **Fase 3**, no esperar a Fase 5.

4. **Fase 3 — `registrar_cobro` es trabajo de cero, no "generalizar".** El plan habla de `registrar_gasto`. Agregar que ingresos **no tiene helper de API**: hay que crear `registrar_cobro` server-side re-implementando 2 side-effects que hoy viven en JS (sync `plan_cobro_items.monto_cobrado` `:3514`, `detectarYRegistrarDifCambio` `:3537`) + migrar 7 write-sites inline. Esfuerzo asimétrico vs egresos.

5. **Fase 3 — incluir `evento_id` en `createComprobanteRecibido`.** El plan §72 pide "imputación proyecto/evento en OCR". El comprobante recibido hoy **solo soporta proyecto** (`api.js:5808-5829`). Agregar ALTER + ampliar la API, no solo el modal.

6. **Fase 3 — normalizar el fallback `'A'` ilegal** (`api.js:5889`) dentro del RPC. Bug que viola CHECK; mencionarlo como item explícito.

7. **Fase 3 — `lobby.js` es consumidor de primer orden.** El plan no lo nombra. Agregar a la lista de "reapuntar lectores": cualquier cambio de estado/columna obliga a tocar `lobby.js:517-557` (`_finData` duplica el panel) + widgets `:780-804` (sueldos depende de `categoria==='rrhh'` exacto). Y las **3 implementaciones duplicadas de saldo** (`finanzas.js:4380`/`:5862` + `lobby.js:548`) deben migrarse juntas a `saldos_mensuales` en **Fase 4** (no quedar 2 vivas y 1 nueva).

8. **Fase 2 — verificación pre-fix del EERR.** Antes de correr `fix_iva`, confirmar que las cuentas `1.1.09`/`2.1.02` **no** caen en el prefijo 4/5.1/5.2 del EERR (`contabilidad.js:4572`). El recon dice que existen con tipo correcto; el mapa lo ratifica como check obligatorio. El plan ya lo cubre parcialmente (§61, doble cómputo `credito_fiscal`) — sumar el check del prefijo EERR.

9. **`credito_fiscal` JSON-en-notas** (`finanzas.js:4332-4340`): deuda de datos no listada. Encaja en Fase 3 (flujo comprobante↔egreso) — migrar a comprobante real para que entre al Libro IVA. Agregar bullet.

10. **Fase 6 — confirmar gap multimoneda de `v_saldo_comprobante`** (usa `total`, no `total_en_ars`). **[NO VERIFICADO en el SQL de la VIEW]** — al renombrar columnas de `comprobantes` para ARCA, revisar ambas VIEWs.

---

**Lo que quedó sin verificar (declarado):**
- Cuál versión del trigger `fn_asiento_auto_*` corre en prod: el recon (`PLAN §0`) dice 2-líneas, pero NO ejecuté `SELECT prosrc FROM pg_proc` — me apoyo en el recon, no en consulta directa.
- Caller directo de `softDelete('comprobantes')` (`api.js:5662`): la whitelist lo habilita, no encontré invocación.
- Schema vivo de las VIEWs `v_saldo_comprobante`/`v_plan_cobro_resumen` (gap `total` vs `total_en_ars`): salido del audit, no releído del SQL.
- `tools/vps/ocr-comprobante.js`: está **fuera del repo deployable** (en `/home/mepex/api`) — el contrato de `tipo` se infiere del audit + consistencia con el enum JS, no del archivo VPS.