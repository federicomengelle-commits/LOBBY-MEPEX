<!-- Diseño de Fase 3 del refactor Finanzas. Insumo: docs/finanzas-blast-radius-map.md (107 paths) + schema-prod.md + recon vivo. Verificar schema antes de tocar. -->

# Fase 3 — Circuito único de gastos/cobros · Diseño

> **Norte (Fede):** unificar los 5 caminos en un servicio único, SIN romper ninguna feature custom; FKs limpias, atomicidad, endpoints ida-y-vuelta inteligentes. La ganancia real = **una sola traducción de categoría + atomicidad** (hoy el link comprobante↔egreso son 2-3 round-trips JS no atómicos).

## Sub-fases (cada una = 1 checkpoint con evidencia)

| # | Qué | Riesgo | Depende de |
|---|---|---|---|
| **3a** | RPC `registrar_gasto` (server-side) + reapuntar los productores **UUID-ready** (OCR · Rendimiento · Finanzas-directo · Calendario-adm) | medio | Fase 2 corrida |
| **3b** | **Proveedores → UUID** (migración) + reapuntar **Compras** + FK real OC↔egreso (matar el string-match) | **alto** (BIGINT→UUID) | 3a |
| **3c** | `registrar_cobro` (de cero — ingresos no tiene capa de API) + comprobante emitido→ingreso + reclasificación anticipo→venta | medio | Fase 2 |
| **3d** | UI puente: "generar egreso/pago desde comprobante" + lista de recibidos sin egreso + imputación proyecto/evento en OCR/Calendario | bajo | 3a, 3c |

Orden recomendado: **3a → 3c → 3b → 3d** (el valor core primero con lo que ya es UUID; la migración pesada de proveedores después; la UI al final). Ajustable.

---

## 3a · RPC `registrar_gasto`

Generaliza `pagarCostoEvento` (que ya es ~80%). **Un único punto** que crea comprobante_recibido + egreso + (vía trigger) asiento, atómico, con links tipados.

```
registrar_gasto(
  p_categoria_dominio TEXT,        -- categoría de NEGOCIO del origen (no el enum de la tabla)
  p_monto NUMERIC, p_fecha DATE,
  p_medio TEXT, p_canal TEXT,      -- canal REAL (no hardcode 'oficial')
  p_cuenta_id UUID DEFAULT NULL,   -- tesorería (NULL permitido → silencio defensivo)
  p_estado TEXT DEFAULT 'pagado',  -- parametrizable (pendiente/pagado/programado)
  p_proyecto_id UUID DEFAULT NULL, p_evento_id UUID DEFAULT NULL,  -- imputación (rentabilidad)
  p_proveedor_id UUID DEFAULT NULL, p_empleado_id UUID DEFAULT NULL,
  p_destinatario_texto TEXT DEFAULT NULL,   -- fallback si no hay FK
  p_comprobante JSONB DEFAULT NULL,         -- {tipo,numero,cuit,razon_social,neto,iva,total,categoria?,archivo_url?}
  p_orden_compra_id BIGINT DEFAULT NULL,    -- FK real OC↔egreso (mata el ilike 'OC N%')
  p_moneda TEXT DEFAULT 'ARS', p_cotizacion NUMERIC DEFAULT 1,
  p_origen TEXT, p_origen_id TEXT           -- trazabilidad (compras/ocr/rendimiento/calendario/finanzas)
) RETURNS jsonb  -- {egreso_id, comprobante_recibido_id}
```

**Resuelve server-side:**
1. **Traducción de categoría** en 2 tablas internas (los enums son disjuntos — `egresos.categoria` 8 valores vs `comprobantes_recibidos.categoria` 6): `dominio → egresos.categoria` y `dominio → comprobantes_recibidos.categoria`. Reemplaza las 4 traducciones JS sueltas (`RENDIMIENTO_CAT_TO_*`, `_CAT_TO_EGRESO`, hardcodes). Normaliza el bug `tipo:'A'` ilegal → `factura_a`/`otro`.
2. **Atomicidad**: comprobante → egreso → `UPDATE comprobantes_recibidos.egreso_id` → (link OC) en UNA transacción. Si falla algo, no quedan links a medias.
3. **Estado y canal reales** (no hardcode).
4. **`cuenta_id` opcional** preservando el silencio defensivo (sin cuenta → movimiento registrado, trigger sale sin asiento por NOTICE, NO error).

**NO absorbe (queda en el productor JS):**
- `evento_costo_pagos` + su trigger (exclusivo de Rendimiento) → lo inserta Rendimiento *después* de llamar al RPC.
- **Transferencias internas** (`finanzas.js:4674`) — NO son gasto. Se excluyen explícito. *(Aparte: revisar que su egreso `categoria:'otro'`+`pagado` deje de generar asiento de gasto — hoy lo genera; riesgo de doble cómputo. Se trata como ajuste en 3a.)*

**Reapuntar productores (este sub-paso):** OCR `_save`, Rendimiento `pagarCostoEvento` (refactor a llamar el RPC), Finanzas-directo tab Egresos (sacar el insert a pelo `:4361`), Calendario-adm `_openPagar` + el 2º pagador de vencimientos `finanzas.js:8530` (consolidar ambos). **Compras queda para 3b** (necesita proveedores UUID).

---

## 3b · Proveedores → UUID unificado

**Target: `proveedor` (UUID) = tabla única.** Se le agregan los campos ricos de `compras_proveedores`.

**Migración (SQL-first, por pasos, reversible):**
1. ALTER `proveedor` + `razon_social, contacto, telefono, email, calif_cumplimiento, calif_calidad, calif_precio`.
2. Backfill `compras_proveedores → proveedor` (dedup por `cuit` si hay, si no por `nombre` normalizado). Construir mapping `compras_proveedores.id (bigint) → proveedor.id (uuid)`.
3. Add `proveedor_uuid UUID` a `compras_ordenes` + `compras_oc_presupuestos`; backfill vía mapping.
4. Código Compras lee/escribe `proveedor` (UUID) vía API única.
5. *(Después de verificar)* drop columnas BIGINT viejas + `compras_proveedores`. Registrar en `docs/DROP_CHECKLIST.md`.

**Endpoints ida-y-vuelta:** una sola `API.getProveedores()` / `API.upsertProveedor()` (con dedup) usada por Compras, OCR, Costos, Finanzas. Crear un proveedor desde OCR aparece en Compras y viceversa.

**FK real OC↔egreso:** `p_orden_compra_id` en el RPC (3a) + `egresos.orden_compra_id` (ya existe) → mata el `ilike('concepto','OC N%')` frágil.

---

## 3c · `registrar_cobro` + comprobante↔ingreso

Ingresos **no tiene capa de API** (asimetría con egresos) → se construye `registrar_cobro` de cero, preservando los 2 side-effects que hoy viven en JS:
- sync `plan_cobro_items.monto_cobrado` (`finanzas.js:3514`),
- `detectarYRegistrarDifCambio` (`:3537`).

**comprobante emitido → ingreso:** poblar `comprobantes.ingreso_id` (hoy nunca se setea). El cobro con factura clasifica por `servicio` (Ventas + IVA débito, Fase 2). El cobro sin factura → Anticipos `2.1.06` (Fase 2).

**Reclasificación anticipo→venta:** al emitir la factura para un monto ya anticipado → asiento `DEBE Anticipos 2.1.06 / HABER Ventas + IVA débito`. Cierra el criterio de Fase 2. *(Se activa de verdad con ARCA/Fase 6, que es la fuente de facturas.)*

`createComprobanteRecibido` + `evento_id` (hoy solo acepta `proyecto_id`) → imputación de evento.

---

## 3d · UI puente comprobante → egreso/ingreso

- **"Generar egreso/pago desde comprobante"** (espejo de `generarEgresoDeOC`) en el panel de Recibidos (que ya abre, Fase 1) → llama `registrar_gasto`.
- **Lista de comprobantes_recibidos sin egreso** (huérfanos del OCR) con acción para generarles el egreso.
- comprobante emitido → "registrar cobro" desde la ficha.
- Imputación proyecto/evento en los modales de OCR y Calendario-adm (hoy no imputan → no aparecen en rentabilidad).

---

## Fixes del blast-radius que entran acá

- `tipo:'A'` ilegal (`api.js:5889`) → normalizado en el RPC.
- `canal` real en Compras (AGREGAR columna a `compras_ordenes`) y Calendario (la plantilla ya lo tiene).
- Imputación proyecto/evento en OCR + Calendario.
- `lobby.js` es consumidor de saldo → se reapunta junto con el resto (las 3 implementaciones de saldo se unifican en Fase 4 contra `saldos_mensuales`).
- Transferencia interna excluida del RPC (y su doble-asiento revisado).

## Lo que se PRESERVA (bisturí)

OCR foto/IA (se integra mejor, no se toca el motor) · multi-moneda (`total_en_ars`) · canal A/B · silencio defensivo de los triggers · `evento_costo_pagos` de Rendimiento · plan de cobro / `cobro_aplicaciones`.
