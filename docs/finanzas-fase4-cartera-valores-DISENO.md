<!-- Diseño Fase 4 del refactor Finanzas+Contabilidad. Grounded en recon vivo 2026-06-21 (Chrome/supabaseClient). Manda: docs/finanzas-contabilidad-refactor-PLAN-EJECUCION.md §Fase 4. Branch rediseno → push main. -->

# Fase 4 — Tesorería real + cartera de valores · DISEÑO

> Recon vivo 2026-06-21. Norte (Fede): **no romper nada; unir al circuito único.** Por eso el cheque NO es un libro paralelo — es un **medio diferido** del mismo circuito `registrarGasto`/`registrarCobro`.

---

## §0 · Recon vivo (lo que ya existe — no se inventa nada)

| Pieza | Estado en prod | Consecuencia |
|---|---|---|
| `1.1.07 Cheques a cobrar` (activo, deudora, imputable) | **YA existe** | Valores **recibidos** en cartera (a cobrar). 0 cuentas nuevas. |
| `2.1.07 Cheques emitidos (diferidos)` (pasivo, acreedora) | **YA existe** | Valores **emitidos** (a pagar). 0 cuentas nuevas. |
| `fn_asiento_auto_egreso` / `_ingreso` | Vivos (Fase 2). Derivan la tesorería de `cuenta_id` → `plan_cuentas.cuenta_financiera_id`; mapeo por `categoria`(egreso)/`servicio`+`default`(ingreso); IVA `1.1.09`/`2.1.02`; silencio defensivo | El **único** cambio: cuando `medio ∈ (cheque, echeq)`, la pata de tesorería va al valor account, NO al banco. Todo lo demás (IVA, mapeo, anticipo) intacto. |
| `medio='cheque'` | Valor válido del enum (el modal ya lo ofrece). Hoy postea al banco al instante (sin diferimiento) | Forward-only: los cheques nuevos pasan a diferirse; el histórico ya posteado queda como está. |
| Reversa al anular (`trg_revertir_asiento_*`, `ILIKE 'Reversión:%'`) | Viva (Fase 0/recon) | Reversa la pata de **entrada** (egreso/ingreso anulado). El valor maneja SOLO su pata de **clearing** → no se pisan. |

---

## §1 · Modelo elegido — cheque/e-cheq = medio diferido del circuito único

> **Realidad MEPEX 2026 (Fede):** el físico está en retroceso — casi no se depositan cheques de papel. El instrumento real es el **e-cheq** (cheque electrónico), usado sobre todo para **pagar proveedores/compras**, muchas veces **endosando** un e-cheq de tercero. Por eso: e-cheq y endoso son **ciudadanos de primera** en v1, y cada valor/operación puede llevar adjunto el **comprobante que da el banco** (igual que el comprobante batch de transferencias).

**Por qué (no es un libro paralelo):** Fede pidió "unir al mismo circuito". El valor entra por `registrarCobro` (recibido) / `registrarGasto` (emitido/endoso) como cualquier cobro/pago → genera el `ingreso`/`egreso` (Panel, plan_cobro, rentabilidad siguen andando **sin tocar**). La única diferencia: el dinero **no toca el banco hasta `fecha_cobro`**.

- **e-cheq ≠ medio nuevo:** es un `tipo` del valor (`cheque` físico vs `echeq`). El `medio` sigue siendo `'cheque'` → **cero cambio de enum**, mismo ruteo contable.
- **Endoso (e-cheq de tercero → proveedor):** un egreso **linkeado al valor recibido** (`egresos.cartera_valor_id`). Su tesorería sale de **cartera `1.1.07`** (no del banco ni de `2.1.07`). Reusa toda la clasificación + IVA de `registrarGasto`. El valor pasa a `endosado`.
- **Comprobante de operación bancaria:** `cartera_valores.archivo_url` (el PDF del e-cheq/endoso) + `archivo_op_url` en egresos/ingresos/transferencias (el comprobante que da el banco, incluso el batch de varias transferencias).

Dos patas contables por valor:

1. **Entrada** (la genera el trigger de egreso/ingreso que YA existe, con 1 IF nuevo):
   - Recibido (ingreso `medio=cheque` confirmado): `DEBE 1.1.07` / `HABER` venta|anticipo (+ `2.1.02` IVA). El valor queda en cartera.
   - Emitido (egreso `medio=cheque` pagado): `DEBE` gasto (+ `1.1.09` IVA) / `HABER 2.1.07`. Pasivo a pagar por cheque.
2. **Clearing** (la genera el trigger NUEVO de `cartera_valores`, al avanzar de estado en su fecha real):
   - Recibido → `cobrado`/`depositado`: `DEBE` banco(`cuenta_id`) / `HABER 1.1.07`.
   - Emitido → `debitado`: `DEBE 2.1.07` / `HABER` banco(`cuenta_id`).

El banco solo se mueve en el clearing → el **saldo disponible** (KPI) y el cashflow respetan la **fecha de cobro** automáticamente (los cheques en cartera no son caja).

---

## §2 · Schema `cartera_valores` (tabla nueva, UUID)

```
id UUID PK · sentido (recibido|emitido) · tipo (cheque|echeq|pagare|otro) · propio BOOL
banco · numero · titular · cuit_titular
monto · moneda · cotizacion · total_en_ars (trigger, como egresos/ingresos)
fecha_emision · fecha_cobro (NOT NULL — la "fecha correcta") · fecha_realizado
estado (en_cartera|depositado|cobrado|debitado|rechazado|endosado|entregado|anulado)
cuenta_id → cuentas_financieras (banco depósito/pago) · canal (oficial|interno)
proyecto_id · evento_id · cliente_id · proveedor_id
ingreso_id → ingresos · egreso_id → egresos      (la pata de entrada que lo originó)
endosado_a_proveedor_id · endoso_egreso_id        (v1.1)
asiento_clearing_id · asiento_rechazo_id          (para traza/reversa propia)
notas · created_by · created_at · _deleted
```

## §3 · Máquina de estados

```
RECIBIDO:  en_cartera ──► depositado ──► cobrado        (clearing → banco)
                       └─► cobrado
                       ├─► rechazado   (rebota: DEBE 1.1.08 Clientes / HABER 1.1.07)
                       └─► endosado    (v1.1: pagar a un proveedor con el cheque)

EMITIDO:   en_cartera ──► debitado      (se debita del banco: DEBE 2.1.07 / HABER banco)
                       ├─► entregado    (informativo)
                       └─► anulado      (DEBE 2.1.07 / HABER 2.1.01 Proveedores)
```

## §4 · Ciclo de asientos (resumen)

| Evento | Origen del asiento | DEBE | HABER |
|---|---|---|---|
| Recibir cheque/e-cheq (cobro) | trigger ingreso (1 IF nuevo) | **1.1.07** | venta/anticipo + 2.1.02 IVA |
| Acreditar/cobrar | trigger valor (nuevo) | banco (`cuenta_id`) | **1.1.07** |
| **Endosar valor recibido** (pagar a proveedor) | trigger egreso (link) | gasto + 1.1.09 IVA | **1.1.07** |
| Cheque recibido rebota | trigger valor (nuevo) | 1.1.08 Clientes | **1.1.07** |
| Emitir cheque/e-cheq propio (pago) | trigger egreso (1 IF nuevo) | gasto + 1.1.09 IVA | **2.1.07** |
| Débito del cheque emitido | trigger valor (nuevo) | **2.1.07** | banco (`cuenta_id`) |
| Cheque emitido anulado | trigger valor (nuevo) | **2.1.07** | 2.1.01 Proveedores |

Todas las patas de clearing son **transferencias de tesorería puras** (sin IVA, sin mapeo de gasto/venta) → el trigger del valor es simple. Saldos `saldos_mensuales` de 1.1.07/2.1.07/banco se mantienen solos (los triggers de saldo de Fase A disparan ante cualquier `asiento_linea`).

## §5 · Cambios SQL (`sql/fase4_cartera_valores.sql`, idempotente)

1. **DDL** `cartera_valores` + índices (`fecha_cobro`, `estado`, `sentido`, parciales por moneda) + RLS (authenticated R/W, DELETE admin/superadmin) + trigger `total_en_ars`.
2. **ALTER** `asientos.cartera_valor_id` (link del asiento de clearing) · `egresos.cartera_valor_id` (endoso) · `archivo_op_url` en `egresos`/`ingresos`/`transferencias_internas` (comprobante bancario). Todo `ADD COLUMN IF NOT EXISTS`.
3. **`fn_asiento_auto_egreso`**: routing diferido — `cartera_valor_id` set (endoso) → `1.1.07`; si no, `medio='cheque'` (emisión) → `2.1.07`. **`fn_asiento_auto_ingreso`**: `medio='cheque'` → `1.1.07`. **El resto del cuerpo no cambia** (IVA, mapeo, anticipo, reversa, moneda).
4. **`fn_asiento_auto_valor`** (trigger nuevo en `cartera_valores`): genera la pata de clearing / rebote / anulación según transición de `estado`, con silencio defensivo y anti-doble (no re-postea si `asiento_clearing_id` ya está).
5. **(Guard)** `cuenta_id` obligatorio para egreso `pagado` / ingreso `confirmado` — hoy es NOTICE+skip; se mantiene defensivo (no rompe la caja), pero la UI lo exige.

> ⚠️ Toca `fn_asiento_auto_egreso/_ingreso` (como Fase 2) → **avisar a Sofi**. Cambio aditivo (1 IF), test forward con cleanup.

## §6 · UI (después de correr el SQL — SQL-first)

- **Sub-tab "Cartera de valores"** en Finanzas (lista recibidos|emitidos, filtros por estado/fecha, KPIs "en cartera / a cobrar / a pagar / vencidos").
- Acción de estado por fila: depositar → cobrar / debitar / rechazar (dispara el clearing).
- **`medio=cheque` en los modales de cobro/pago** (registrarCobro/registrarGasto): al elegir cheque, pide banco/nro/fecha_cobro/propio-tercero → crea el `ingreso`/`egreso` + la fila `cartera_valores` linkeada.
- **Panel/cashflow**: KPI "Valores en cartera" + el cashflow proyecta por `fecha_cobro`.
- **Saldo por cuenta vía RPC de `saldos_mensuales`** (consistencia + perf; la tabla está sana).

## §7 · Alcance v1 vs v1.1

- **v1:** tabla + entrada (routing cheque/e-cheq) + clearing (cobrado/depositado/debitado) + **endoso** (e-cheq de tercero → proveedor) + rebote/anulado + **adjunto del comprobante bancario** (valor + transferencias/pagos) + UI cartera + cheque/e-cheq en modales de cobro/pago + KPI Panel "valores en cartera".
- **v1.1 (después):** comprobante batch de transferencias (1 PDF ↔ N operaciones), recordatorio de vencimiento de e-cheq (se engancha al Calendario adm. de Fase 5), re-endoso (endosar un valor ya endosado).

## §8 · Decisiones tomadas (y la única que confirmo con Fede)

- **Cheque = medio del circuito único** (no libro paralelo) → coherente con Fase 3, Panel/plan_cobro intactos. *(decidido)*
- **0 cuentas nuevas** (1.1.07/2.1.07 ya están). *(recon)*
- **Reversa de clearing self-contained** en el trigger del valor (no pisa `trg_revertir_asiento_*` que maneja la pata de entrada). *(decidido; se verifica el interplay anulando un cheque end-to-end antes de cerrar)*
- ⚠️ **Confirmar con Fede:** que la pata de **entrada** del cheque devengue venta/gasto YA (al recibir/emitir el cheque), no al cobrarlo. Es lo correcto contablemente (devengado) y lo que asume este diseño. Si Fede quisiera "percibido" (devengar al cobrar), cambia el modelo.
