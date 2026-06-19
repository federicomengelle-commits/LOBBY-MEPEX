-- ============================================================
-- MÓDULO RENDIMIENTO POR EVENTO — DDL (idempotente)
-- Blueprint: docs/modulo-rendimiento-evento-blueprint.md §3
-- Ejecutar en Supabase ANTES de pushear/usar el JS (regla orden_sql_push).
-- Reusa la plomería de Finanzas (egresos → asiento → saldos → libro IVA).
-- NO reimplementa contabilidad.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CATÁLOGO de ítems de costo (engranaje de config)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_costo_catalogo (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre        TEXT NOT NULL,
    categoria     TEXT NOT NULL CHECK (categoria IN ('jornal','flete','proveedor','seguro','comida')),
    -- Reuso de maestros: jornal→persona_id, flete/proveedor→proveedor_id, seguro/comida→ninguno
    persona_id    UUID REFERENCES personas(id),
    proveedor_id  UUID REFERENCES proveedor(id),
    tarifa_default NUMERIC(15,2) DEFAULT 0,        -- monto/tarifa sugerida al autocompletar
    factura_iva   BOOLEAN NOT NULL DEFAULT false,  -- proveedor que factura → exige comprobante recibido
    activo        BOOLEAN NOT NULL DEFAULT true,
    notas         TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    created_by    UUID REFERENCES profiles(id),
    _deleted      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_evento_costo_catalogo_cat ON evento_costo_catalogo(categoria) WHERE _deleted = false;

-- ------------------------------------------------------------
-- 2. LÍNEAS de costo de un evento (la planilla)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_costos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id     UUID NOT NULL REFERENCES eventos(id),
    proyecto_id   UUID REFERENCES proyectos(id),       -- centro de costo (hereda al egreso)
    catalogo_id   UUID REFERENCES evento_costo_catalogo(id),
    categoria     TEXT NOT NULL CHECK (categoria IN ('jornal','flete','proveedor','seguro','comida')),
    descripcion   TEXT NOT NULL,                        -- snapshot del nombre del ítem
    persona_id    UUID REFERENCES personas(id),
    proveedor_id  UUID REFERENCES proveedor(id),
    -- Campos jornal (contrato RRHH.5):
    fase          TEXT,                                 -- armado / funcionamiento / desarme
    dias          NUMERIC(6,2),                         -- jornadas trabajadas
    tarifa        NUMERIC(15,2),                        -- tarifa unitaria (snapshot, editable)
    -- Importes (v1 = ARS; multimoneda diferido, blueprint §9.3):
    monto         NUMERIC(15,2) NOT NULL DEFAULT 0,     -- monto REAL de la línea
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
CREATE INDEX IF NOT EXISTS idx_evento_costos_evento  ON evento_costos(evento_id)  WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_evento_costos_persona ON evento_costos(persona_id) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_evento_costos_cat     ON evento_costos(categoria)  WHERE _deleted = false;

-- ------------------------------------------------------------
-- 3. PAGOS de una línea (1 pago = 1 egreso; soporta tandas/adelantos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_costo_pagos (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    costo_id               UUID NOT NULL REFERENCES evento_costos(id),
    monto                  NUMERIC(15,2) NOT NULL CHECK (monto > 0),
    fecha                  DATE NOT NULL DEFAULT CURRENT_DATE,
    egreso_id              UUID REFERENCES egresos(id),                 -- el egreso generado
    comprobante_recibido_id UUID REFERENCES comprobantes_recibidos(id), -- si el proveedor factura
    anulado                BOOLEAN NOT NULL DEFAULT false,
    notas                  TEXT,
    created_at             TIMESTAMPTZ DEFAULT now(),
    created_by             UUID REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_evento_costo_pagos_costo ON evento_costo_pagos(costo_id) WHERE anulado = false;

-- ------------------------------------------------------------
-- 4. MATERIALES por evento (1:1) — costo informativo, NO pagable
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_rendimiento (
    evento_id          UUID PRIMARY KEY REFERENCES eventos(id),
    materiales_manual  NUMERIC(15,2) NOT NULL DEFAULT 0,  -- insumos consumidos (carga manual v1)
    materiales_notas   TEXT,
    updated_at         TIMESTAMPTZ DEFAULT now(),
    updated_by         UUID REFERENCES profiles(id)
);

-- ------------------------------------------------------------
-- 5. TRIGGER: derivar monto_pagado / estado de la línea desde sus pagos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_costo_desde_pago()
RETURNS TRIGGER AS $$
DECLARE
    v_costo_id  UUID;
    v_pagado    NUMERIC(15,2);
    v_total     NUMERIC(15,2);
    v_estado    TEXT;
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
-- 6. RLS — patrón financiero real (read/write explícitos por fn_role_can)
--      p_need='read' para SELECT, 'write' para mutaciones. NO usar FOR ALL.
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

-- ------------------------------------------------------------
-- 7. PERMISO DE MÓDULO — el módulo se gatea como permiso propio 'rendimiento'.
--    El sidebar y el route guard leen Data.rolePermissions (driven by roles table).
--    Otorgar a superadmin + admin (que ya tienen 'finanzas' para la RLS).
-- ------------------------------------------------------------
UPDATE roles
   SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"rendimiento":"write"}'::jsonb
 WHERE id IN ('superadmin','admin');

-- ============================================================
-- GATES — correr ESTOS SELECT a mano y verificar el output ANTES de pagar.
-- ============================================================

-- GATE A (blueprint §8) — las 5 categorías de egreso deben estar mapeadas,
-- sino el egreso se paga SIN asiento en silencio (fn_asiento_auto_egreso sale sin error).
-- Deben volver las 5: rrhh, logistica, proveedor, servicio, otro.
--   SELECT valor_origen FROM mapeo_cuentas
--    WHERE tipo_movimiento='egreso' AND campo_origen='categoria'
--      AND valor_origen IN ('rrhh','logistica','proveedor','servicio','otro') AND _deleted=false;

-- GATE B — el CHECK de egresos.categoria DEBE aceptar esos 5 valores.
-- Si el constraint los excluye, el INSERT del pago falla. Revisar la definición:
--   SELECT conname, pg_get_constraintdef(oid) AS def
--     FROM pg_constraint
--    WHERE conrelid = 'egresos'::regclass AND contype = 'c';
-- Si hay un CHECK sobre categoria que NO incluye rrhh/logistica/servicio/otro,
-- ampliarlo (ALTER TABLE egresos DROP CONSTRAINT <name>; ADD CONSTRAINT ... CHECK (...)).
