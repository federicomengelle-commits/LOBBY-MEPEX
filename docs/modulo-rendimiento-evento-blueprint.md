# Módulo Rendimiento por Evento — Blueprint Final

> **Fecha:** 2026-06-18 · **Estado:** SPEC OBLIGATORIA — cerrada y aprobada. Lista para ejecutar (etapas REND.1–REND.5, SQL-first). Reemplaza el borrador. Spin-off de la Fase 8 del plan maestro (ver `docs/modulo-rrhh-v2-blueprint.md` §RRHH.5, que depende de este módulo).
>
> **Mockup de referencia visual aprobado:** `mockup-rendimiento-evento.html` (raíz). ⚠️ El mockup menciona "egreso consolidado" — **OBSOLETO**: la decisión cerrada es **N egresos discriminados** (ver §1 decisión 5). El mockup vale como base visual, NO como lógica de pagos.
>
> **Fuente de verdad de schema:** `docs/schema-prod.md` (verificado 2026-06-13). Todo el DDL de abajo está groundeado contra ese snapshot + `sql/finanzas_fase_e_multimoneda.sql` (trigger de egreso **vigente**). NO se reimplementa contabilidad: se reusa la plomería de Finanzas.

---

## 1. Decisiones cerradas con Fede

| # | Decisión | Implicancia técnica |
|---|----------|---------------------|
| 1 | **Módulo propio** en categoría ADMIN & FINANZAS (nombre: "Rendimiento" / "Costos de eventos"). NO es un tab de Finanzas. | Ruta `#rendimiento`, archivo `rendimiento.js`, entrada en `data.js` categoría `admin`. Reusa egresos/comprobantes/asientos de Finanzas por detrás. |
| 2 | **Solo admin/superadmin** (orientado a superadmin/Fede). | Guard de ruta por rol + RLS `fn_role_can('finanzas', …)` en las 3 tablas. |
| 3 | **Catálogo configurable** (engranaje) que reusa maestros: jornales→`personas`, fletes/proveedores→`proveedor`; seguros/comida = ítem libre sin maestro. Guarda **tarifa/monto default** por ítem. | Tabla `evento_costo_catalogo` con FK opcional a `personas`/`proveedor` + `tarifa_default`. |
| 4 | **Autocomplete**: elegir ítem del catálogo trae su tarifa default, **editable** en la fila; si se pisa → badge "editado". | `evento_costos.monto_editado BOOLEAN`. |
| 5 | **Pagos SIEMPRE discriminados.** "Pagar seleccionados" = comodidad de 1 click que genera **N egresos separados**, NO un egreso consolidado. Soporta **adelantos y tandas** (`pendiente → parcial → pagado`). | Tabla `evento_costo_pagos` (1 pago = 1 egreso). Trigger deriva `monto_pagado`/`estado` de la línea. |
| 6 | **Proveedores que facturan**: el pago se vincula a un **comprobante recibido** (IVA) → egreso → asiento → libro IVA (cascada "heavy metal"). Jornales/comida/seguro = egreso simple sin comprobante. | `evento_costo_pagos.comprobante_recibido_id` opcional + flag `factura_iva` en catálogo. |
| 7 | **Cada egreso dispara el asiento automático + saldos.** NO reimplementar contabilidad. | Reusa `trg_asiento_auto_egreso` / `fn_asiento_auto_egreso` (versión Fase E) + cascada `trg_saldos_lineas`. |
| 8 | **Dashboard de ganancia por evento**: INGRESOS mostrando **COBRADO y FACTURADO lado a lado**, menos COSTOS (la planilla), menos MATERIALES. | KPIs en §6.2. "Facturado" = emitido al cliente (`comprobantes` emitidos), NO comprobantes recibidos de proveedores. |
| 9 | **Materiales = insumos/consumibles GASTADOS**, NO la receta de Costos (`calcular_receta` = precio de alquiler; la estructura OCTEXA se alquila y vuelve, no se consume). v1 = carga manual; imputación automática vía inventario = roadmap. | Tabla 1:1 `evento_rendimiento` (NO contamina las 5 categorías ni el flujo de pagos). |
| 10 | **3 features**: (1) Presupuesto vs real, (2) Duplicar planilla de otro evento, (3) Comparar eventos / histórico de márgenes (ranking, vista superadmin). | `evento_costos.monto_previsto` + acción duplicar (REND.5) + vista comparativa. |
| 11 | **5 categorías colapsables**: Jornales / Fletes / Proveedores / Seguros / Comida. | `CHECK (categoria IN (...))` + UI con secciones plegables. |
| 12 | **Engranaje de configuración** del catálogo. | Modal de admin del catálogo (REND.1). |
| 13 | **Contrato RRHH.5** (read-only por persona): los ítems jornal exponen `persona_id, fase, dias, tarifa, monto_pagado, egreso_id` (vía pagos). | Ver §7. RRHH agrega por `SUM`, no asume 1 fila = 1 jornada. |
| — | **NO incluir** "adelantos a rendir / fondo fijo" en v1 — solo mención como idea futura. | Ver §9. |

---

## 2. Veredicto y alcance

**Veredicto:** módulo aprobable. El money-path (egreso → asiento → saldos → libro IVA) se **reusa entero** de Finanzas Fase E sin reimplementar nada. Las 3 tablas nuevas son una capa de planilla/orquestación encima de la plomería existente.

**Alcance v1:**
- Planilla de costos por evento (5 categorías colapsables, autocomplete con tarifa default editable).
- Pagos discriminados con adelantos/tandas; cada pago = 1 egreso; proveedores con factura → comprobante recibido.
- Dashboard de ganancia (Cobrado / Facturado / Costos / Materiales / Margen).
- Materiales por carga manual (tabla 1:1).
- 3 features: presupuesto-vs-real, duplicar planilla, comparar eventos.
- Contrato RRHH.5.

**Fuera de v1 (roadmap):** imputación automática de insumos desde inventario, adelantos-a-rendir/fondo fijo, multimoneda en la planilla (v1 asume ARS — ver §9), desglose de IVA en el asiento (deuda global, §9).

---

## 3. Modelo de datos (DDL idempotente, real-grounded)

> Tipos verificados contra `docs/schema-prod.md`: `personas.id` UUID, `proveedor.id` UUID, `eventos.id` UUID, `proyectos.id` UUID, `egresos.id` UUID, `comprobantes_recibidos.id` UUID. Las FK money-path (`egresos.empleado_id`, `egresos.evento_id`, `egresos.comprobante_recibido_id`, `comprobantes_recibidos.egreso_id`) **existen y son UUID**.

```sql
-- ============================================================
-- MÓDULO RENDIMIENTO POR EVENTO — DDL (idempotente)
-- Ejecutar en Supabase ANTES de pushear el JS (regla orden_sql_push).
-- ============================================================

-- ------------------------------------------------------------
-- 3.1 CATÁLOGO de ítems de costo (engranaje de config)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_costo_catalogo (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre        TEXT NOT NULL,
    categoria     TEXT NOT NULL CHECK (categoria IN ('jornal','flete','proveedor','seguro','comida')),
    -- Reuso de maestros: jornal→persona_id, flete/proveedor→proveedor_id, seguro/comida→ninguno
    persona_id    UUID REFERENCES personas(id),
    proveedor_id  UUID REFERENCES proveedor(id),
    tarifa_default NUMERIC(15,2) DEFAULT 0,     -- monto/tarifa sugerida al autocompletar
    factura_iva   BOOLEAN NOT NULL DEFAULT false, -- proveedor que factura → exige comprobante recibido
    activo        BOOLEAN NOT NULL DEFAULT true,
    notas         TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    created_by    UUID REFERENCES profiles(id),
    _deleted      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_evento_costo_catalogo_cat ON evento_costo_catalogo(categoria) WHERE _deleted = false;

-- ------------------------------------------------------------
-- 3.2 LÍNEAS de costo de un evento (la planilla)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_costos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id     UUID NOT NULL REFERENCES eventos(id),
    proyecto_id   UUID REFERENCES proyectos(id),       -- centro de costo (hereda al egreso)
    catalogo_id   UUID REFERENCES evento_costo_catalogo(id),
    categoria     TEXT NOT NULL CHECK (categoria IN ('jornal','flete','proveedor','seguro','comida')),
    descripcion   TEXT NOT NULL,                        -- snapshot del nombre del ítem
    -- Reuso de maestros (snapshot en la línea para el contrato RRHH.5 / fletes):
    persona_id    UUID REFERENCES personas(id),
    proveedor_id  UUID REFERENCES proveedor(id),
    -- Campos jornal (contrato RRHH.5):
    fase          TEXT,                                 -- armado / funcionamiento / desarme
    dias          NUMERIC(6,2),                         -- jornadas trabajadas
    tarifa        NUMERIC(15,2),                        -- tarifa unitaria (snapshot, editable)
    -- Importes:
    monto         NUMERIC(15,2) NOT NULL DEFAULT 0,     -- monto REAL de la línea (ARS, v1)
    monto_previsto NUMERIC(15,2) DEFAULT 0,             -- feature presupuesto-vs-real
    monto_editado BOOLEAN NOT NULL DEFAULT false,       -- badge "editado" (pisó la tarifa default)
    -- Estado derivado por trigger desde los pagos:
    monto_pagado  NUMERIC(15,2) NOT NULL DEFAULT 0,
    estado        TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','parcial','pagado','anulado')),
    notas         TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    created_by    UUID REFERENCES profiles(id),
    _deleted      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_evento_costos_evento ON evento_costos(evento_id) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_evento_costos_persona ON evento_costos(persona_id) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_evento_costos_cat ON evento_costos(categoria) WHERE _deleted = false;

-- ------------------------------------------------------------
-- 3.3 PAGOS de una línea (1 pago = 1 egreso; soporta tandas/adelantos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_costo_pagos (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    costo_id               UUID NOT NULL REFERENCES evento_costos(id),
    monto                  NUMERIC(15,2) NOT NULL CHECK (monto > 0),
    fecha                  DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Vínculo a la plomería de Finanzas (ambos opcionales; uno por pago):
    egreso_id              UUID REFERENCES egresos(id),                 -- el egreso generado
    comprobante_recibido_id UUID REFERENCES comprobantes_recibidos(id), -- si el proveedor factura
    anulado                BOOLEAN NOT NULL DEFAULT false,
    notas                  TEXT,
    created_at             TIMESTAMPTZ DEFAULT now(),
    created_by             UUID REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_evento_costo_pagos_costo ON evento_costo_pagos(costo_id) WHERE anulado = false;

-- ------------------------------------------------------------
-- 3.4 MATERIALES por evento (1:1) — costo informativo, NO pagable
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_rendimiento (
    evento_id          UUID PRIMARY KEY REFERENCES eventos(id),
    materiales_manual  NUMERIC(15,2) NOT NULL DEFAULT 0,  -- insumos consumidos (carga manual v1)
    materiales_notas   TEXT,
    updated_at         TIMESTAMPTZ DEFAULT now(),
    updated_by         UUID REFERENCES profiles(id)
);

-- ------------------------------------------------------------
-- 3.5 TRIGGER: derivar monto_pagado / estado de la línea desde sus pagos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_costo_desde_pago()
RETURNS TRIGGER AS $$
DECLARE
    v_costo_id  UUID;
    v_pagado    NUMERIC(15,2);
    v_total     NUMERIC(15,2);
    v_estado    TEXT;
    v_anulado   BOOLEAN;
BEGIN
    v_costo_id := COALESCE(NEW.costo_id, OLD.costo_id);

    SELECT COALESCE(SUM(monto),0) INTO v_pagado
      FROM evento_costo_pagos
     WHERE costo_id = v_costo_id AND anulado = false;

    SELECT monto, estado INTO v_total, v_estado
      FROM evento_costos WHERE id = v_costo_id;

    IF v_estado = 'anulado' THEN
        RETURN COALESCE(NEW, OLD);   -- línea anulada: no recalcular estado
    END IF;

    UPDATE evento_costos
       SET monto_pagado = v_pagado,
           estado = CASE
               WHEN v_pagado <= 0 THEN 'pendiente'
               WHEN v_pagado < v_total THEN 'parcial'
               ELSE 'pagado'
           END
     WHERE id = v_costo_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_costo_desde_pago ON evento_costo_pagos;
CREATE TRIGGER trg_sync_costo_desde_pago
    AFTER INSERT OR UPDATE OR DELETE ON evento_costo_pagos
    FOR EACH ROW EXECUTE FUNCTION fn_sync_costo_desde_pago();

-- ------------------------------------------------------------
-- 3.6 RLS — patrón financiero real (4 políticas, read/write explícitos)
--      fn_role_can(p_module, p_need): p_need='read' para SELECT, 'write' para mutaciones.
--      OJO: llamar con 1 solo arg defaultea a 'read' → habilitaría escritura a lectores. NO usar FOR ALL.
-- ------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['evento_costo_catalogo','evento_costos','evento_costo_pagos','evento_rendimiento']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_rls_sel', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_rls_ins', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_rls_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_rls_del', t);

    EXECUTE format($p$CREATE POLICY %I ON %I FOR SELECT TO authenticated
        USING (fn_role_can('finanzas','read'))$p$, t||'_rls_sel', t);
    EXECUTE format($p$CREATE POLICY %I ON %I FOR INSERT TO authenticated
        WITH CHECK (fn_role_can('finanzas','write'))$p$, t||'_rls_ins', t);
    EXECUTE format($p$CREATE POLICY %I ON %I FOR UPDATE TO authenticated
        USING (fn_role_can('finanzas','write')) WITH CHECK (fn_role_can('finanzas','write'))$p$, t||'_rls_upd', t);
    EXECUTE format($p$CREATE POLICY %I ON %I FOR DELETE TO authenticated
        USING (fn_role_can('finanzas','write'))$p$, t||'_rls_del', t);
  END LOOP;
END $$;
```

---

## 4. Reuso de la plomería de Finanzas (money-path)

> **Regla de oro:** este módulo **no escribe asientos ni saldos**. Solo crea `egresos` (y opcionalmente `comprobantes_recibidos`); la cascada contable es automática y ya existe. Verificado contra `sql/finanzas_fase_e_multimoneda.sql` (trigger **vigente**) — NO contra `sql/fix_trigger_asiento_auto.sql` (versión vieja/obsoleta, ignorar).

| Pieza reusada | Qué hace | Detalle real |
|---|---|---|
| `egresos` (INSERT directo) | Cada pago crea un egreso `estado='pagado'`. | Setea `categoria`, `evento_id`, `proyecto_id`, `empleado_id` (=persona en jornales), `comprobante_recibido_id`, `monto`, `medio`, `canal`, `total_en_ars`. |
| `trg_asiento_auto_egreso` → `fn_asiento_auto_egreso` | AFTER INSERT/UPDATE OF estado: al pasar a `pagado` genera el asiento de 2 líneas (DEBE gasto / HABER banco) balanceado por `monto`. | **Vigente** en `finanzas_fase_e_multimoneda.sql:356-435`. Usa `total_en_ars`. |
| `mapeo_cuentas` | Resuelve la cuenta-gasto del asiento. **Match real** (schema Fase E): `tipo_movimiento='egreso'` AND `campo_origen='categoria'` AND `valor_origen = egresos.categoria` → `cuenta_contable_id`. **NO** existe `clave='egreso_'||categoria` ni columnas `clave`/`cuenta_id` (eso era el trigger viejo). | Las 12 filas reales YA están seedeadas (`schema-prod.md` L14/L20). Las 8 de egreso cubren `valor_origen ∈ {proveedor, rrhh, impuesto, servicio, credito_fiscal, alquiler, logistica, otro}`. |
| `comprobantes_recibidos` (INSERT) | Si el proveedor factura: se crea el comprobante con `neto/iva/total/proveedor_id/categoria/canal/moneda/cotizacion`, luego el egreso lo referencia. | Vínculo bidireccional: **ambas FK existen** — `egresos.comprobante_recibido_id` Y `comprobantes_recibidos.egreso_id`; se setean las dos al vincular. |
| `v_libro_iva_compras_extendido` | El IVA del comprobante recibido entra al Libro IVA Compras AFIP. | Existe (`schema-prod.md` L155). El crédito fiscal llega al libro **aunque no al asiento** (ver deuda §9.1). |
| `trg_saldos_lineas` → `fn_refresh_saldo_cascada` | Las líneas del asiento refrescan `saldos_mensuales` con cascada a meses posteriores. | Automático, no se toca. |

**Mapeo categoría-módulo → `egresos.categoria`** (para que `mapeo_cuentas` resuelva la cuenta):

| Categoría módulo | `egresos.categoria` | `valor_origen` que matchea |
|---|---|---|
| jornal | `rrhh` | `rrhh` ✓ existe |
| flete | `logistica` | `logistica` ✓ existe |
| proveedor | `proveedor` | `proveedor` ✓ existe |
| seguro | `servicio` | `servicio` ✓ existe |
| comida | `otro` | `otro` ✓ existe |

> **Las 5 categorías target ya están seedeadas en `mapeo_cuentas` (snapshot 2026-06-13).** No hay que crear claves nuevas — el formato `egreso_<categoria>` del borrador NO existe en prod ni debe crearse. REND.3 solo **verifica** que las 5 sigan presentes (ver §8 gate).

---

## 5. Flows

### 5.1 Agregar línea a la planilla
1. Usuario en `#rendimiento`, evento seleccionado, categoría expandida → "+ Agregar ítem".
2. Autocomplete sobre `evento_costo_catalogo` (filtrado por categoría, `activo=true`). Al elegir: prefill `descripcion`, `persona_id`/`proveedor_id`, `tarifa = tarifa_default`, `monto = tarifa_default` (o `dias × tarifa` en jornales).
3. Campos editables en la fila. Si se pisa el monto/tarifa → `monto_editado=true` → badge "editado".
4. INSERT en `evento_costos` con `created_by = Auth.getUser()?.uid`.

### 5.2 Jornal (contrato RRHH.5)
- Línea categoría `jornal`: `persona_id` (del catálogo/persona), `fase`, `dias`, `tarifa` → `monto = dias × tarifa`.
- Prefill de `tarifa` desde `personas.costo_dia_referencial` (verificado, `schema-prod.md` L27) si el ítem del catálogo no trae una.
- El egreso del pago setea `empleado_id = persona_id` y `evento_id` (el helper nuevo `API.createEgreso` DEBE pasarlos explícitamente — el insert actual de `finanzas.js` no los setea).

### 5.3 Pagar una línea (proveedor que factura → con comprobante)
1. Usuario click "Pagar" en una línea categoría `proveedor` con `factura_iva=true`.
2. Modal de pago: monto (default = saldo pendiente = `monto − monto_pagado`), fecha, medio, canal, datos del comprobante (`neto`, `iva`, `total`, `cuit`, `razon_social`).
3. **INSERT `comprobantes_recibidos`** (`proveedor_id`, `neto`, `iva`, `total`, `categoria`, `canal`, `moneda='ARS'`, `cotizacion=1`).
4. **INSERT `egresos`** (`categoria` mapeada, `evento_id`, `proyecto_id`, `comprobante_recibido_id` = el del paso 3, `monto`, `estado='pagado'`, `total_en_ars`). Setear **ambas** FK: el egreso apunta al comprobante y se hace `UPDATE comprobantes_recibidos SET egreso_id = <egreso>`.
5. **INSERT `evento_costo_pagos`** (`costo_id`, `monto`, `egreso_id`, `comprobante_recibido_id`).
6. Trigger `trg_asiento_auto_egreso` genera asiento (DEBE gasto / HABER banco). El IVA va al Libro IVA vía el comprobante.
7. Trigger `trg_sync_costo_desde_pago` recalcula `monto_pagado`/`estado` de la línea.

### 5.4 Pagar una línea simple (jornal / comida / seguro)
Igual al 5.3 pero **sin** comprobante recibido (pasos 3 y 4-comprobante omitidos). Egreso simple → asiento DEBE gasto / HABER banco.

### 5.5 Pagar seleccionados (tandas / adelantos)
- Multi-select de líneas → "Pagar seleccionados".
- **NO genera un egreso consolidado.** Itera el flow 5.3/5.4 por cada línea → **N egresos + N asientos discriminados**.
- Pago parcial: el monto del pago < saldo → línea queda `parcial`. Múltiples pagos (tandas) suman vía trigger hasta `pagado`.

### 5.6 Anular un pago / línea
- **Anular pago**: `UPDATE evento_costo_pagos SET anulado=true` → trigger recalcula la línea a `parcial`/`pendiente`.
- **Anular el egreso subyacente**: `UPDATE egresos SET estado='anulado'`. ⚠️ **Deuda real (§9.2):** el trigger de egreso **no genera contra-asiento** al anular (solo dispara en transición *a* `pagado`). El asiento original queda vivo. La UI debe **avisar** que la reversión contable es manual. El módulo gestiona su propio estado vía `anulado`/`estado='anulado'`, pero NO toca contabilidad.

### 5.7 Catálogo (engranaje, REND.1)
- Modal admin: CRUD de `evento_costo_catalogo`. Por ítem: nombre, categoría, maestro vinculado (combobox `personas` para jornal / `proveedor` para flete-proveedor / libre para seguro-comida), `tarifa_default`, `factura_iva`, `activo`.

---

## 6. UI

### 6.1 Planilla (vista principal)
- Selector de evento arriba (autocomplete sobre `eventos`).
- 5 **secciones colapsables** (Jornales / Fletes / Proveedores / Seguros / Comida), cada una con su subtotal y su botón "+ Agregar ítem".
- Filas: descripción · (jornal: persona/fase/días/tarifa) · monto · monto previsto · badge "editado" · estado (pendiente/parcial/pagado/anulado) · acciones (Pagar · Editar · Anular).
- **Presupuesto vs real** (feature 1): columna `monto_previsto` vs `monto`, con desvío (Δ y %) por línea y por categoría.
- Multi-select + "Pagar seleccionados" (genera N egresos, §5.5).
- "Duplicar planilla" (feature 2): copia las líneas de otro evento (sin pagos, estado `pendiente`) — útil en recurrentes. Etapa REND.5.

### 6.2 Dashboard de ganancia por evento
KPIs lado a lado:

| KPI | Query |
|---|---|
| **Cobrado** | `Σ ingresos.total_en_ars WHERE evento_id = <ev> AND estado='confirmado' AND _deleted=false` (`ingresos.evento_id` directo). |
| **Facturado** *(al cliente)* | `Σ comprobantes.total` de comprobantes **emitidos** (`estado='emitida'`) JOIN `proyectos` ON `proyecto_id` WHERE `proyectos.evento_id = <ev>` (⚠️ `comprobantes` filtra por `proyecto_id`, NO tiene `evento_id`). **No** son los `comprobantes_recibidos` de proveedores. |
| **Costos** | `Σ evento_costos.monto WHERE evento_id=<ev> AND estado<>'anulado' AND _deleted=false` (v1 = ARS, ver §9.3 multimoneda). |
| **Materiales** | `evento_rendimiento.materiales_manual` (carga manual v1). |
| **Margen** | `Cobrado − Costos − Materiales` (y variante vs Facturado). |

> "Cobrado y Facturado lado a lado" = lo que el cliente pagó vs lo que se le facturó. Ambos del lado ingresos. Confirmar con Fede si "facturado" debe ser exactamente esto (asumido como tal).

### 6.3 Materiales
- Card simple en el dashboard: input `materiales_manual` + `materiales_notas` (UPSERT en `evento_rendimiento`).
- **Por qué tabla aparte y NO una línea de la planilla:** los materiales ya se pagaron vía Compras; acá son **imputación de costo informativa** para el margen, no un ítem pagable con egreso/asiento. Mantener las 5 categorías de la planilla intactas (decisión 11) y no tocar 3 CHECKs.
- Roadmap: imputación automática desde `inventario_movimiento_items` (`direccion='salida'`, `item_tipo`) valuado por `catalogo_items.costo_produccion` (columnas verificadas; tabla sub-poblada en prod hoy → carga manual en v1).

### 6.4 Comparar eventos (feature 3, vista superadmin)
- Vista de ranking de rentabilidad: por evento, Cobrado / Costos / Materiales / Margen / Margen %. Orden por margen. Histórico.

---

## 7. Contrato RRHH.5 (Jornales read-only por persona)

> RRHH v2 (`docs/modulo-rrhh-v2-blueprint.md` §RRHH.5) consume este contrato. **Read-only**: RRHH no escribe en estas tablas, solo lee.

**API expuesta:** `API.getJornalesByPersona(personaId, { eventoId?, desde?, hasta? })` → líneas `evento_costos WHERE categoria='jornal' AND persona_id=<p> AND _deleted=false`, cada una con:

| Campo | Origen |
|---|---|
| `persona_id` | `evento_costos.persona_id` |
| `evento_id` / `evento_nombre` | `evento_costos.evento_id` (JOIN `eventos.nombre`) |
| `fase` | `evento_costos.fase` |
| `dias` | `evento_costos.dias` |
| `tarifa` | `evento_costos.tarifa` |
| `monto` | `evento_costos.monto` |
| `monto_pagado` | `evento_costos.monto_pagado` (derivado de pagos) |
| `estado` | `evento_costos.estado` |
| `egreso_id` | `evento_costo_pagos.egreso_id` (puede haber N pagos → N egresos; se devuelve el array) |

**Reglas de integridad:**
- Una persona PUEDE tener N filas jornal en el mismo evento/fase (recargas en distintos momentos). **RRHH agrega por `SUM(dias)` / `SUM(monto_pagado)`** y NO asume 1 fila = 1 jornada. **No** se fuerza índice único `(evento_id, persona_id, fase)` porque bloquearía recargas legítimas.
- RRHH.5 está **bloqueada por este módulo**; REND.1–REND.4 no tienen dependencias inversas.

---

## 8. Etapas (SQL-first)

> Orden obligatorio: **SQL en Supabase primero, JS después** (regla `orden_sql_push`). Cada etapa pushea a `main` tras verificar.

### REND.1 — Schema + Catálogo
- Ejecutar el DDL §3 completo (4 tablas + trigger + RLS) en Supabase.
- `data.js`: registrar módulo `rendimiento` en categoría `admin` (color `#4A90D9`).
- `rendimiento.js`: shell del módulo + modal de catálogo (engranaje, CRUD `evento_costo_catalogo`).
- `api.js`: CRUD catálogo + helper `API.createEgreso(payload)` **nuevo** (genérico; hoy solo existe `generarEgresoDeOC` que hardcodea categoría). DEBE permitir setear `evento_id`, `empleado_id`, `comprobante_recibido_id`, `categoria`, `total_en_ars`.
- **Gate de prod:** correr verificación de mapeos antes de habilitar pagos —
  ```sql
  SELECT valor_origen FROM mapeo_cuentas
   WHERE tipo_movimiento='egreso' AND campo_origen='categoria'
     AND valor_origen IN ('rrhh','logistica','proveedor','servicio','otro') AND _deleted=false;
  ```
  Deben volver las 5. Si falta alguna, seedearla con su `cuenta_contable_id` (NO crear claves `egreso_*`).

### REND.2 — Planilla + líneas
- UI planilla con 5 secciones colapsables, autocomplete con tarifa default, badge "editado".
- CRUD `evento_costos`. Columnas jornal (persona/fase/días/tarifa). `monto_previsto` (presupuesto-vs-real).

### REND.3 — Pagos + cascada contable
- Modal de pago (simple y con comprobante recibido). Flows §5.3–5.5.
- INSERT `egresos` (+ `comprobantes_recibidos` si factura) → asiento automático. INSERT `evento_costo_pagos`.
- "Pagar seleccionados" = N egresos discriminados.
- Anulación de pago/línea + aviso UI de reversión contable manual (§5.6).
- **Gates bloqueantes de esta etapa (subir de "pendiente" a checklist de cierre):**
  - **(G5) Seed de mapeos verificado** (gate §REND.1) ANTES de habilitar pagos en prod — si falta, los egresos quedan **sin asiento en silencio** (`fn_asiento_auto_egreso` sale sin error). Es el riesgo operativo más alto.
  - **(G4) Deuda IVA en el asiento** (§9.1): documentar en el test de cierre que el asiento NO desglosa IVA crédito fiscal (solo va al Libro IVA). Decisión de roadmap: arreglar el trigger global `fn_asiento_auto_egreso` (3ª línea DEBE `1.1.04.01 IVA crédito fiscal` por `comprobantes_recibidos.iva`) → afecta a todo Finanzas, coordinar con Fede/Sofi. Sin esto el balance no cuadra cuando haya proveedores facturados.

### REND.4 — Dashboard
- KPIs Cobrado / Facturado / Costos / Materiales / Margen (§6.2). Card de materiales (`evento_rendimiento`).
- Contrato RRHH.5: `API.getJornalesByPersona` (§7).

### REND.5 — Features avanzados
- Duplicar planilla de otro evento (recurrentes).
- Comparar eventos / ranking de márgenes (vista superadmin, §6.4).
- Presupuesto-vs-real consolidado (si no se cubrió en REND.2).

---

## 9. Pendientes / deudas / decisiones abiertas

### 9.1 IVA NO desglosado en el asiento (deuda global REAL)
`fn_asiento_auto_egreso` (vigente, Fase E) arma solo 2 líneas: DEBE gasto / HABER banco por el `total`, **sin** línea de IVA crédito fiscal. El IVA del proveedor sí entra al **Libro IVA** vía `comprobantes_recibidos.iva` + `v_libro_iva_compras_extendido`, pero el **asiento contable queda incompleto** (el balance no cuadra el crédito fiscal). **Fix de roadmap (afecta a TODO Finanzas, no solo este módulo):** agregar 3ª línea DEBE `1.1.04.01 IVA crédito fiscal` por `comprobantes_recibidos.iva` cuando el egreso tiene comprobante. Coordinar con Fede/Sofi. **Gate de REND.3.**

### 9.2 Anular egreso no revierte el asiento (deuda global REAL)
El trigger solo dispara en transición *a* `pagado`; `estado='anulado'` no genera contra-asiento. La reversión contable es manual hoy. El módulo avisa en UI (§5.6) y gestiona su estado propio, pero NO inventa contabilidad. Fix de roadmap a nivel Finanzas.

### 9.3 Multimoneda en la planilla (diferido)
`evento_costos` v1 asume **ARS** (`monto` en moneda nativa, sin `total_en_ars`). El dashboard suma `monto` directo. Si en el futuro hay costos en USD/EUR, ALTER `evento_costos` con `moneda/cotizacion/total_en_ars` (consistente con el resto de Finanzas Fase E) y el dashboard pasa a sumar `total_en_ars`. v1 = limitación declarada.

### 9.4 Imputación automática de materiales (roadmap)
v1 = carga manual (`evento_rendimiento.materiales_manual`). Roadmap = leer `inventario_movimiento_items` (`direccion='salida'`) imputados al evento/proyecto, valuados por `catalogo_items.costo_produccion`. La tabla está sub-poblada en prod → no confiable para v1.

### 9.5 Sentido de "Facturado" (confirmar 1 pregunta con Fede)
Asumido: Facturado = emitido al cliente (`comprobantes` emitidos), del lado ingresos, lado a lado con Cobrado. Confirmar que no se refiere a "costos con factura recibida".

### 9.6 Adelantos a rendir / fondo fijo
**Fuera de v1.** Idea futura: caja de adelanto a una persona que luego rinde gastos. No se modela ahora.

### 9.7 Cross-read contabilidad en RLS
Opcional: permitir lectura a rol `contabilidad` además de `finanzas` (paridad con el resto de Finanzas). Como el módulo es admin/superadmin, no es estrictamente necesario. Definir con Fede si se quiere.

### 9.8 Bugs conocidos heredados (no del módulo)
- Columnas rotadas en `clientes` (mapeado en `api.js`).
- `mapeo_cuentas` debe estar seedeado para que los egresos generen asiento (gate REND.1/REND.3).