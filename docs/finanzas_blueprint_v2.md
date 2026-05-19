# Finanzas y Contabilidad — Blueprint v2

> **Iniciado:** 2026-05-18 · **Última actualización:** 2026-05-19
> Documento vivo. Si algo no coincide con el código, el código gana — actualizar esto.

Objetivo: rediseñar el módulo Finanzas+Contabilidad de LOBBY-MEPEX para:
- Reemplazar La PyME por facturación electrónica directa contra ARCA.
- Capturar partida doble formal con plan de cuentas argentino estándar.
- Manejar lado A (oficial) y lado B (extraoficial) en el mismo sistema con flag por movimiento.
- Soportar planes de pago avanzados, facturación parcial, cobros parciales.
- Multi-moneda ARS/USD/EUR.
- Tabla auxiliar para compras de familiares (recupero IVA sin contaminar contabilidad).
- Conciliación bancaria semi-automática (Galicia + billetera virtual + cuenta nueva).
- Centros de costo: proyecto (principal) + evento (agregador).

---

## 1 · Decisiones de fondo

| Decisión | Valor |
|---|---|
| Razón social | Una sola (MEPEX) |
| IVA | Responsable Inscripto |
| Facturación oficial | LOBBY directo contra ARCA (deprecar La PyME) |
| Moneda primaria | ARS · soporta USD/EUR con snapshot de cotización |
| Cierre contable | Mensual operativo + anual formal (31/12) |
| Plan de cuentas | Propio MEPEX (basado en estándar AR, adaptado a alquiler de stands) |
| Inicio de uso real | Enero 2027 (saldos de apertura cargados antes, ejercicio bloqueado al activar) |
| Backend ARCA | Endpoint nuevo en el proxy HTTP del VPS `195.200.1.250:3000` (mismo donde corre La PyME hoy). Usar `arcasdk` (TypeScript). |
| Asientos manuales | Permitidos para superadmin (ajustes contables) |
| Lado A/B | Flag `canal: 'oficial' | 'interno'` en cada movimiento (ya existe en BD) |
| Centros de costo | Proyecto = principal · Evento = agregador |
| UI vista económica | Solo dentro de Finanzas (admin/superadmin). NO en ficha de evento ni proyecto. |

---

## 2 · Modelo conceptual

### 2.1 Jerarquía de negocio

```
Cliente
  └── Cotización (precio sobre proyecto)
        └── Proyecto (unidad de facturación + centro de costo)
              ↓ pertenece a
              Evento (agregador, carpeta Drive, datos operativos)
```

- Una cotización aprobada genera un **plan de pagos** (cuotas) sobre el proyecto.
- Una factura cubre una o varias cuotas; una cuota puede facturarse o no individualmente.
- Eventos agrupan proyectos. Un evento puede tener 1 o N proyectos.

### 2.2 Lado A vs Lado B (oficial vs extraoficial)

- Flag `canal` enum (`'oficial'`, `'interno'`) en todas las tablas con flujo económico.
- Permisos: superadmin/admin ven ambos. Resto ve solo oficial.
- Reportes: Oficial / Real (A+B) / Solo B.
- Plan de cuentas único — no se duplican cuentas.

### 2.3 Compras de familiares (IVA recovery)

- Tabla auxiliar `comprobantes_iva_recovery` (a crear) — **NO** genera asiento contable.
- VIEW SQL que suma el IVA de la auxiliar al saldo de la cuenta `1.1.04.01 IVA crédito fiscal` para reportes gerenciales.
- Libro IVA Compras y posición IVA del mes presentan toggle: solo oficial / con virtual / ambos.
- Libro IVA Compras presentado a AFIP en F.731 incluye también las facturas de la auxiliar (son legítimas con CUIT MEPEX).

---

## 3 · Plan de pagos / facturación parcial

### 3.1 Modelo

```
Cotización ($5.000.000)
   ├── Plan de pagos (1 por cotización, puede regenerarse)
   │     ├── Cuota 1: 30% Seña ($1.500.000) · venc 15/05 · facturar=SI
   │     ├── Cuota 2: 50% Avance ($2.500.000) · venc 30/06 · facturar=SI
   │     └── Cuota 3: 20% Saldo ($1.000.000)  · venc 15/08 · facturar=SI
   │
   └── Comprobantes_venta (0 o N por cotización)
         ├── Factura A cubre cuota 1 → $1.500.000
         └── Factura A cubre cuota 2 → $2.500.000
```

### 3.2 Casos soportados

| Caso | Modelado |
|---|---|
| Cotización $5M, plan 3 cuotas, factura por cuota | 3 cuotas con `facturar=true`. Cada vencimiento dispara aviso para emitir. |
| Cotización $5M, factura única $5M + 3 cobros parciales | 1 factura por total. Plan de 3 cuotas `facturar=false` (solo programación de cobro). |
| Cotización $5M, factura parcial $2M, "vemos después" | Plan opcional. Factura con `monto != monto_cotizacion`. Cotización en estado "facturación parcial". |
| Anticipo cobrado sin factura | Cuota `facturar=false`. Cobro genera asiento contra `2.1.01.03 Anticipos recibidos`. Se aplica al facturar. |
| Cliente paga adelantado todo de golpe | Cobro se aplica a múltiples cuotas en orden (FIFO o manual). |
| Renegociación del plan | Plan viejo "cancelado" en histórico, plan nuevo generado. |

---

## 4 · Estado actual (AS-IS) — 2026-05-19

### 4.1 Lo que YA funciona

| Área | Estado |
|---|---|
| Plan de cuentas (~40 cuentas seedeadas, 3 niveles) | ✅ read-only en UI |
| `cuentas_financieras` (Galicia, billetera, caja) | ✅ |
| Ingresos/Egresos CRUD con filtros, estados, canal A/B | ✅ |
| Toggle A/B (`canal: oficial/interno`) en BD y JS, sincronizado entre módulos | ✅ |
| Triggers `fn_asiento_auto_ingreso` y `fn_asiento_auto_egreso` (Finanzas → Contabilidad automático) | ✅ |
| FK ingresos/egresos a `proyecto_id`/`evento_id`/`cliente_id` | ✅ |
| Facturación La PyME vía proxy HTTP en VPS `195.200.1.250:3000` (CAE, PDF, response) | ✅ |
| Plan de cobro + items por proyecto | ✅ base, falta integración con facturación |
| Libro mayor con saldo corrido | ✅ |
| Libro diario con paginación | ✅ |
| Reconciliación bancaria UI | ⚠️ esqueleto (matching manual) |
| Calendario vencimientos | ⚠️ esqueleto (solo lectura) |

### 4.2 Gaps vs blueprint v2

| Requerimiento | Estado | Fase plug & play |
|---|---|---|
| Bug asiento_lineas (tipo_movimiento/monto vs debe/haber) | ✅ ARREGLADO (Fase A0) | — |
| CHECK partida doble en BD | ✅ Fase A | A1 (SQL listo, ejecutar en Supabase) |
| Trigger materializar `saldos_mensuales` | ✅ Fase A | A2 (SQL listo) |
| `plan_cuentas.imputable` / `controla_subdiario` | ✅ Fase A | A3 (SQL listo) |
| Audit log de asientos | ✅ Fase A | A4 (SQL listo) |
| Tabla auxiliar compras familiares (BUSCAR_V virtual) | ❌ | Fase B |
| Plan de pagos avanzado + cobros parciales | ⚠️ parcial | Fase C |
| Facturación directa ARCA | ❌ (solo La PyME) | Fase D |
| Multi-moneda USD/EUR | ❌ | Fase E |
| Conciliación bancaria semi-automática | ⚠️ esqueleto | Fase F |
| Reportes exportables (PDF/XLSX, Libros IVA AFIP) | ❌ (tabs vacíos) | Fase G |
| Saldos de apertura + bloqueo ejercicio 2027 | ❌ | Fase H |

---

## 5 · Plan plug & play — Fases

> Cada fase es un commit chico que deja el sistema funcionando. No se reescribe lo existente.

### Fase A — Hardening (en curso · 2026-05-19)

Arreglar problemas estructurales sin agregar features. **No rompe nada.**

- **A0** ⚠️ Inicialmente se pensó que había un bug en `contabilidad.js:3669` (uso de `tipo_movimiento`/`monto` y `concepto`). Tras chequear el schema real de producción se confirmó que **el JS estaba correcto** y el bug aparente era una discrepancia entre el SQL del repo viejo y la BD real. **No hay fix de código JS.** Lección aprendida: SIEMPRE verificar `information_schema.columns` antes de "arreglar" código contra un schema asumido. Versión `contabilidad.js?v=4` (revertida).
- **A1** ✅ `CHECK chk_partida_doble` en `asientos` (NOT VALID por defecto). Para validar histórico: `ALTER TABLE asientos VALIDATE CONSTRAINT chk_partida_doble`.
- **A2** ✅ Triggers materializar `saldos_mensuales` (con cascada a meses posteriores). `fn_refresh_saldo_periodo` + `fn_refresh_saldo_cascada` + UNIQUE constraint + backfill incluido.
- **A3** ✅ `plan_cuentas`: agregar `imputable BOOLEAN` y `controla_subdiario TEXT` (`cliente`/`proveedor`/`evento`/`proyecto`). Backfill `imputable = NOT es_grupo`.
- **A4** ✅ Tabla `audit_logs` + trigger en `asientos` (INSERT/UPDATE/DELETE).

**Schema real de producción** (≠ SQL del repo):
- `asientos`: id, numero, fecha, **concepto** (NO `descripcion`), tipo, canal, ingreso_id, egreso_id, comprobante_id, comprobante_recibido_id, transferencia_id, total_debe, total_haber, notas, created_at, updated_at, created_by, **_deleted**. **No tiene `estado`** (vigencia se controla por `_deleted`).
- `asiento_lineas`: id, asiento_id, cuenta_id, **tipo_movimiento** (`'debe'` o `'haber'`), **monto** (NO `debe`/`haber` separados), descripcion, orden.
- `saldos_mensuales`: id, cuenta_id, **periodo** (TEXT `YYYY-MM`), canal, saldo_anterior, total_debe, total_haber, saldo_final.

**Deploy:** ejecutar `sql/contabilidad_fase_a_hardening.sql` en Supabase SQL Editor.

**Tiempo estimado:** 3-5 días — completado el día 1.

### Fase B — Compras familiares (IVA recovery)

- Tabla `comprobantes_iva_recovery` (fecha, CUIT, razón social, descripción, subtotal, IVA 21, IVA 10.5, total, traído_por, mes_imputación).
- VIEW `v_iva_credito_extendido` que une asientos + auxiliar.
- UI: subtab dentro de Finanzas > Egresos > "Recupero IVA extracontable".
- Libros IVA Compras con toggle "oficial/virtual/ambos".

**Tiempo estimado:** 2-3 días.

### Fase C — Plan de pagos avanzado + cobros parciales ✅ (commit `795e6f1`)

**Implementado** (`sql/finanzas_fase_c_plan_pagos.sql`):
- ALTER `plan_cobro_items`: `facturar BOOLEAN DEFAULT true` + `comprobante_venta_id UUID FK comprobantes`. CHECK estado: `pendiente / facturada / parcial / cobrado / vencido / anulada`.
- Tabla `cobro_aplicaciones` (junction `ingresos.id` ↔ `comprobantes.id` ↔ `plan_cobro_items.id`, `monto_aplicado`, soft delete, RLS admin).
- VIEW `v_saldo_comprobante`: total − Σ aplicaciones = saldo + `estado_cobranza`.
- VIEW `v_plan_cobro_resumen`: total_a_facturar/facturado/cobrado/saldo_pendiente + conteos.
- Trigger `fn_sync_cuota_desde_aplicacion`: AFTER en aplicaciones recalcula `monto_cobrado`/`estado` de cuota.
- Trigger `fn_marcar_cuota_facturada`: BEFORE UPDATE marca 'facturada' al vincular comprobante.

**API**: CRUD planes/items, `vincularCuotaAComprobante`, `aplicarCobro` (multi-factura), `getSaldoComprobante`, `getSaldosComprobantesPorCliente`, `getPlanCobroResumen`.

**UI** (`finanzas.js?v=9`): columnas Facturar/Factura en tabla items, barra de progreso doble (cobrado + facturado), modal vincular cuota con factura existente, checkbox `facturar` en modal "Agregar item", botón "📄 Resumen PDF" por plan.

**PDF resumen**: A4 jsPDF, header turquesa MEPEX, tabla cuotas, totales, datos bancarios automáticos (cuentas_financieras oficial+banco), notas.

**No incluido en Fase C**: generar factura desde cuota (queda para Fase D con ARCA). Hoy se vincula factura ya emitida.

**Tiempo real**: ~3-4h efectivas.

### Fase D — ARCA directo (deprecar La PyME)

- Trámite certificado X.509 ARCA (homologación + producción).
- Endpoint nuevo `/api/arca/facturar` en el proxy HTTP del VPS `195.200.1.250:3000`. SDK: `arcasdk` (TypeScript, afipts.com).
- Endpoint consume `{ tipo, cliente, items, totales }`, llama WSAA + WSFE, devuelve `{ cae, vencimiento_cae, numero }`.
- Cambio en `finanzas.js` wizard de facturación: toggle "Emitir con La PyME" / "Emitir con ARCA" durante transición.
- Generación de PDF con QR oficial en cliente con jsPDF (igual que cotizador / remitos).
- Una vez validado en producción, deprecar el camino La PyME.

**Tiempo estimado:** 2 semanas (incluye trámite).

### Fase E — Multi-moneda

- ALTER tablas: agregar `moneda TEXT DEFAULT 'ARS'` y `cotizacion NUMERIC` en:
  `comprobantes`, `comprobantes_recibidos`, `ingresos`, `egresos`, `asientos`, `cobros`, `pagos`, `comprobantes_iva_recovery`.
- Campo `total_en_ars` snapshot al crear el movimiento (para reportes).
- Lógica de diferencias de cambio automática (cuentas `4.2.02` y `5.4.02` en el plan).
- Selector de moneda en wizards de facturación, cobros, pagos. Si moneda ≠ ARS, sugerir cotización del día (BCRA/MEP — opcional cachear).

**Tiempo estimado:** 4-5 días.

### Fase F — Conciliación bancaria semi-automática

- Algoritmo fuzzy match: monto exacto + fecha ±2 días + descripción (similarity).
- Importador CSV Galicia + MercadoPago + banco nuevo (formato según banco).
- UI mejorado: tabla lado-a-lado, click → match, botón "Auto-match todo".
- Para no-matches: crear movimiento nuevo o marcar "ignorado".

**Tiempo estimado:** 1 semana.

### Fase G — Reportes exportables

- Estado de Resultados PDF/XLSX por período.
- Balance General PDF/XLSX por fecha de corte.
- Libros IVA Ventas/Compras/Posición formato AFIP (CSV).
- Cash flow proyectado 30/60/90 días.
- Margen por proyecto/evento.
- Solo superadmin.

**Tiempo estimado:** 3-5 días.

### Fase H — Saldos de apertura + bloqueo ejercicio 2027

- Pantalla "Saldos al 01/01/2027" editable.
- Cada cuenta imputable tiene una fila editable con debe/haber.
- Validación: total debe = total haber.
- Botón "Bloquear y activar" (solo superadmin) → genera asiento de apertura, marca ejercicio 2027 como `abierto`, deshabilita edición de saldos.
- Ejercicios anteriores quedan en modo "consulta", no admiten asientos retroactivos.

**Tiempo estimado:** 3 días.

---

## 6 · Total estimado

**5-7 semanas calendario** si se trabaja en serie. Fases A+B y C+D paralelizables. Apuntamos a tener el sistema completo y validado para que arranque uso real el **01/01/2027**.

---

## 7 · Decisiones pendientes (a confirmar antes de fase)

- **Fase B (compras familiares)**: Fede confirmó modelo "tabla auxiliar + view virtual". No genera asiento contable. Aislado del libro diario. ✅
- **Fase D (ARCA)**: Coexistencia La PyME ↔ ARCA con toggle durante transición. ✅
- **Fase E (multi-moneda)**: cuenta nueva (reemplazo Lelean) — banco aún sin definir, no bloquea.
- **Fase H (saldos apertura)**: arranca uso real Enero 2027.

---

## 8 · Referencias técnicas

- **Auditoría inicial:** ver historial de la sesión 2026-05-18/19.
- **SQL Fase A:** [sql/contabilidad_fase_a_hardening.sql](../sql/contabilidad_fase_a_hardening.sql).
- **SDK ARCA recomendado:** [afipts.com](https://www.afipts.com/) (TypeScript, Lambda/Vercel/Workers compatible).
- **Doc oficial AFIP/ARCA WSFE:** [afip.gob.ar/ws/documentacion/ws-factura-electronica.asp](https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp).
- **Proxy VPS actual:** `http://195.200.1.250:3000/api/lapyme/facturar` (legacy) → agregar `/api/arca/facturar` en Fase D.

---

## 9 · Cambios al CLAUDE.md al cerrar

Cuando termine todo (Fase H), actualizar CLAUDE.md sección 6 — Módulos:

```
| **Finanzas** | `finanzas.js` | Completo | 8 tabs (Panel/Ingresos/Egresos/Facturación/Cuentas/Conciliación/Calendario/Reportes), facturación ARCA directa, plan de pagos avanzado, multi-moneda, conciliación semi-automática, compras familiares aisladas. Solo admin/superadmin. |
| **Contabilidad** | `contabilidad.js` | Completo | 6 tabs (Plan cuentas/Libro diario/Libro mayor/Asiento manual/Libros IVA/Reportes), partida doble formal, saldos materializados, audit log, asientos manuales válidos. Solo admin/superadmin. |
```
