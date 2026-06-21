<!-- Plan de ejecución del refactor Finanzas+Contabilidad. Grounded en recon vivo 2026-06-20 (sql/recon_fase8_auditoria.sql). Branch rediseno → push main. Deadline natural 01/01/2027. -->

# Plan de ejecución — Refactor integral Finanzas + Contabilidad

> Semilla: `docs/finanzas-contabilidad-refactor-DOSSIER.md` (recon de código) + `docs/finanzas_blueprint_v2.md` (diseño A-H).
> **Este doc aterriza el plan en el estado VIVO de prod** (recon `sql/recon_fase8_auditoria.sql`, 2026-06-20).
> Norte de Fede: **no romper ninguna feature custom; unir las que están sueltas al mismo circuito, con endpoints ida-y-vuelta inteligentes.**

---

## §0 · Hallazgos del recon vivo (lo que reescribe el plan)

| Hallazgo | Valor en prod | Impacto en el plan |
|---|---|---|
| `fix_anular_contraasiento` | **YA CORRIDO** (triggers `trg_revertir_asiento_*` vivos, funciones existen) | La reversión al anular YA funciona. Esa deuda está saldada. |
| `fix_iva_asiento` | NO corrido (`fn_*` = 2 líneas, no menciona IVA) | Pendiente. **Universo histórico afectado = 0** (C/C2=0) → aplicar es casi sin riesgo, **sin backfill**. |
| Códigos IVA | `1.1.09` Crédito Fiscal · `2.1.02` Débito Fiscal | Exactos como asume el fix. No hay que tocar el SQL. |
| `chk_partida_doble` | `NOT VALID`, 0 desbalances | Validable YA (`VALIDATE CONSTRAINT` pasará). |
| Integridad backbone | 0 sin-asiento · 0 desbalances · 0 drift saldos · 0 reversiones faltantes · cobertura total `mapeo_cuentas` | **Nada roto que reparar.** Refactor = forward, no reparación. |
| La PyME | **0 comprobantes · 0 PDFs · 0 cotizaciones con `pyme_venta_id`** | ARCA es **greenfield**: sin migración de datos ni re-hosteo. Código muerto se ripea sin riesgo. |
| `cuentas_financieras` sin espejo | solo "TEST USD Caja" | Limpieza menor (borrar cuenta test). |
| Schema egresos/recibidos/comprobantes | confirmado (ver recon §H) | `egresos` tiene `proveedor_id`/`empleado_id`/`comprobante_recibido_id`/`orden_compra_id`. `comprobantes_recibidos` tiene `proveedor_id`+`proveedor_nombre`. |

**Conclusión:** el módulo no está "roto" — está **incompleto y disperso**. El trabajo es (a) destrabar el P0, (b) cerrar la deuda de IVA, (c) **unificar los 5 caminos en un circuito único**, (d) tesorería real con valores, (e) conciliación, (f) ARCA nativo, (g) cierre 2027.

---

## §1 · Norte de diseño — qué se PRESERVA (bisturí, no reescritura)

- Schema `asiento_lineas` = `tipo_movimiento`+`monto` (NO `debe`/`haber`).
- Estructura `mapeo_cuentas` = `campo_origen`/`valor_origen`/`cuenta_contable_id`/`posicion`.
- **Silencio defensivo de los triggers:** sin cuenta / sin mapeo → no rompe el INSERT del movimiento. Un fallo contable NO bloquea la caja.
- Sincronización del canal A/B (oficial/interno) entre Finanzas y Contabilidad.
- Multi-moneda: los asientos SIEMPRE en ARS por `total_en_ars`.
- Partida doble (CHECK + validación en asiento manual) + triggers de saldos con cascada.
- **Carga de comprobantes por foto/IA (OCR):** se conserva y se integra mejor (es la pieza que SÍ anda).
- Toda feature custom existente sigue andando entre cambio y cambio (checkpoints con evidencia).

**Cómo se unen al circuito (el corazón):** un único **servicio `registrar_gasto` (RPC server-side)** generaliza `pagarCostoEvento`. Compras / Calendario-adm / OCR / Finanzas-directo / Rendimiento dejan de traducir categorías cada uno a su manera y pasan a ser **productores** de un payload común. Así ningún camino vuelve a dejar un asiento faltante en silencio, y los comprobantes ↔ egresos/ingresos quedan linkeados bidireccionalmente.

---

## §2 · Decisiones tomadas

- **Proveedores → tabla única UUID** (Fede): unificar `proveedor`(UUID) + `compras_proveedores`(BIGINT) + proveedor-en-texto. Endpoints ida-y-vuelta inteligentes (dedupe, FKs reales OC↔egreso↔comprobante).
- **Cartera de valores completa** (Fede): al entrar se discriminan (cheque propio/tercero, e-cheq, etc. + banco/nro/fechas), se administran en cartera y cambian de estado (en cartera → depositado → cobrado/rechazado/endosado). Vale para valores **recibidos** (a cobrar) y **emitidos** (a pagar).
- **ARCA directo, sin toggle La PyME** (consecuencia del recon: La PyME tiene 0 datos productivos → no hace falta coexistencia; se ripea).
- **Contra-asiento de reversión:** ya está vivo con anti-doble por `ILIKE 'Reversión:%'`. Endurecerlo a columna explícita (`asiento_revertido_id`) = **opcional** (mejora de robustez; lo hago solo si querés, no toca lo que ya anda).

---

## §3 · Fases (orden menor→mayor riesgo · checkpoint con vos en cada una)

### Fase 1 — P0: comprobantes abren/editan/eliminan en Facturación · JS puro · riesgo nulo
- Causa: `_openRecibidoPanel`/`_openFactEmitidoPanel` buscan `#finCuentasPanel`, que solo existe en la vista Cuentas → salen en silencio.
- Fix: montar el contenedor de panel lateral en las vistas de Facturación (recibidos + emitidos) + sumar su id a `_closePanel`.
- **Verifico en preview/Chrome con evidencia** (abrir un comprobante OCR → editar → eliminar). Commit + push + bump `?v=`.

### Fase 2 — Deuda contable de IVA · SQL-first · **avisar a Sofi**
- Aplicar `sql/fix_iva_asiento.sql` (códigos `1.1.09`/`2.1.02` confirmados; universo histórico 0 → sin backfill). Pasa los asientos **con comprobante con IVA** de 2→3 líneas.
- Verificar la interacción de la categoría `credito_fiscal` (cuenta `5.2.10`) con el split de IVA a `1.1.09` para que no haya doble cómputo.
- **Pre-check (blast-radius §5.8):** confirmar que `1.1.09`/`2.1.02` NO caen en el prefijo `4`/`5.1`/`5.2` del EERR (`contabilidad.js` clasifica por prefijo hardcodeado) → si cayeran, el IVA contaminaría el Estado de Resultados.
- `ALTER TABLE asientos VALIDATE CONSTRAINT chk_partida_doble` (0 desbalances → pasa).
- Re-correr `recon_fase8_auditoria.sql` → confirmar 0 desbalances post-fix.
- *(Opcional)* endurecer anti-doble de reversión a columna explícita.
- **Test forward (Chrome, con cleanup):** egreso-con-factura → 3 líneas balanceadas; egreso-sin-factura → 2 líneas; anular → reversión netea.

### Fase 3 — Circuito único de gastos + comprobante↔movimiento · el corazón del refactor
> 📍 Mapa completo (107 paths + firma del RPC + 4 traducciones reales) en `docs/finanzas-blast-radius-map.md`. Ajustes del mapa a respetar: (a) **transferencia interna** (`finanzas.js:4674`) queda EXCLUIDA del RPC y hay que decidir su asiento — hoy su egreso `categoria:otro`+`pagado` dispara el trigger de gasto → riesgo de doble cómputo; (b) **`registrar_cobro` es de cero** (ingresos NO tiene capa de API: 7 write-sites inline + sync `plan_cobro_items.monto_cobrado` + dif-cambio en JS); (c) **ampliar `createComprobanteRecibido` con `evento_id`** (hoy solo `proyecto_id`); (d) **fix bug `tipo:'A'` ilegal** (`api.js:5889`, viola el CHECK del enum); (e) **`lobby.js` es consumidor de primer orden** (`_finData`/saldo duplicados) → reapuntar; (f) los **2 pagadores de vencimiento** (`finanzas.js:8530` + `calendario-adm.js:228`) se consolidan acá, no en Fase 5; (g) **canal en Compras = AGREGAR** (la `compras_ordenes` no tiene columna de canal, no es solo "dejar de hardcodear").
- **RPC `registrar_gasto`** (generaliza `pagarCostoEvento`): `{categoria_dominio, monto, fecha, medio, canal, cuenta_id, proyecto_id, evento_id, proveedor_id, comprobante?, origen, origen_id}` → comprobante_recibido + egreso + (trigger) asiento, con links tipados. Silencio defensivo preservado.
- **Proveedores unificados a UUID** + migración SQL-first con backfill + FK real OC↔egreso (matar el string-matching `ilike('concepto','OC {n}%')`).
- Reapuntar **Compras / Calendario-adm / OCR / Finanzas-directo / Rendimiento** como productores del RPC (una sola traducción de categoría). Sacar el insert "a pelo" de `finanzas.js`.
- **Flujo comprobante→egreso/ingreso editable** (cierra el P0 a nivel funcional): "Generar egreso/pago desde comprobante" + lista de recibidos sin egreso; emitido→ingreso (poblar `comprobantes.ingreso_id`).
- Imputación proyecto/evento en OCR + Calendario (hoy no imputan → no aparecen en rentabilidad).

### Fase 4 — Tesorería real + cartera de valores · decisión Fede: completa
- `cuenta_id` obligatorio para egreso `pagado` / ingreso `confirmado` (cierra la única brecha futura de movimiento-sin-asiento).
- **Cartera de valores** (tabla nueva): tipo (cheque propio/tercero/e-cheq/…), banco, nro, fecha emisión, **fecha de cobro/acreditación**, estado (cartera→depositado→cobrado/rechazado/endosado/entregado), propio vs tercero, endoso. Recibidos (a cobrar) + emitidos (a pagar).
- Asientos del ciclo del valor: recibir cheque → "Valores en cartera"; depositar/acreditar → Banco. (Suma 1-2 cuentas a `plan_cuentas` + mapeo.)
- Pagar/cobrar con valor descuenta saldo en la **fecha correcta**; cashflow respeta fecha de cobro.
- Leer `saldos_mensuales` materializado (RPC de saldo) en Panel/cuenta/KPIs (consistencia + perf; la tabla está sana, F2=0).

### Fase 5 — Conciliación + calendario + limpieza
- Importador CSV (Galicia/MercadoPago) + fuzzy match + flag persistente "conciliado".
- Resolver solape `finanzas.js` calendario vs `calendario-adm.js` (fuente única) + implementar fuente 4 (recibidos con vencimiento).
- Borrar `compras_pagos` muerto (tabla + tab + ~210 líneas JS).

### Fase 6 — ARCA nativo · **bloqueado por trámite del certificado (arrancar YA en paralelo)** · greenfield
- Endpoint `/api/arca/facturar` en el VPS (`arcasdk`, WSAA+WSFE), ruta nginx relativa.
- Numeración correlativa desde `FECompUltimoAutorizado` (**PdV nuevo** para webservice) · multi-alícuota/multi-ítem · PDF + QR AFIP (jsPDF) → Storage privado.
- Vincular emitido→ingreso/cuota (poblar `comprobantes.ingreso_id`).
- Ripear código muerto La PyME (`_pymeFetch`, sync, **API key expuesta en `api.js`**) · renombrar `lapyme_response`→`arca_response`.

### Fase 7 — Cierre pre-2027
- Tab CRUD `mapeo_cuentas` + panel de cobertura (mantenible por Sofi/Lelean).
- Auditoría de integridad final (re-correr recon).
- Saldos de apertura 2027 → bloquear ejercicio (SOLO cuando todo lo anterior esté validado).

---

## §4 · Cómo trabajamos

- **Checkpoint con Fede en cada fase**, con evidencia en preview/Chrome (no "probalo vos").
- **SQL-first** en todo lo que tenga DDL/triggers: te paso el SQL para correr en Supabase ANTES de pushear el JS. **Aviso a Sofi** en todo lo que toque asientos (Fase 2).
- **Schema vivo > SQL del repo** (regla 12): verifico con `information_schema` antes de tocar.
- Bump `?v=` de cada archivo tocado en `index.html`. Commit + push por sub-bloque.
- Al cierre: regla de los 2 archivos (PROGRESO ↔ PLAN-MAESTRO §Fase 8) + rebalanceo de % + CLAUDE.md §10.

**Próximo paso inmediato tras tu OK:** Fase 1 (JS puro, riesgo nulo). En paralelo, vos arrancás el trámite del certificado ARCA (cuello de botella de Fase 6).
