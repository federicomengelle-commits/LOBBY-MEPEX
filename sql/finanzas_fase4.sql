-- =============================================
-- MEPEX Lobby — Finanzas Fase 4
-- =============================================
-- Tablas: plan_cobro, plan_cobro_items, transferencias_internas
-- Ejecutar manualmente en Supabase SQL Editor
-- =============================================

-- 1. Plan de cobro
CREATE TABLE plan_cobro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id UUID NOT NULL,
    cotizacion_id UUID,
    total_plan NUMERIC(15,2) NOT NULL,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE plan_cobro_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_cobro_id UUID NOT NULL REFERENCES plan_cobro(id) ON DELETE CASCADE,
    orden INT NOT NULL DEFAULT 1,
    concepto TEXT NOT NULL,
    monto NUMERIC(15,2) NOT NULL,
    porcentaje NUMERIC(5,2),
    fecha_estimada DATE,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'cobrado', 'parcial', 'vencido')),
    monto_cobrado NUMERIC(15,2) NOT NULL DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 2. Transferencias internas
CREATE TABLE transferencias_internas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    cuenta_origen_id UUID NOT NULL REFERENCES cuentas_financieras(id),
    cuenta_destino_id UUID NOT NULL REFERENCES cuentas_financieras(id),
    monto NUMERIC(15,2) NOT NULL,
    concepto TEXT,
    egreso_id UUID,
    ingreso_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 3. RLS
ALTER TABLE plan_cobro ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_cobro_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finanzas_admin_only" ON plan_cobro FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')));
CREATE POLICY "finanzas_admin_only" ON plan_cobro_items FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')));
CREATE POLICY "finanzas_admin_only" ON transferencias_internas FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')));

-- 4. Índices
CREATE INDEX idx_plan_cobro_proyecto ON plan_cobro(proyecto_id);
CREATE INDEX idx_plan_cobro_items_plan ON plan_cobro_items(plan_cobro_id);
CREATE INDEX idx_transferencias_fecha ON transferencias_internas(fecha);
CREATE INDEX idx_transferencias_origen ON transferencias_internas(cuenta_origen_id);
CREATE INDEX idx_transferencias_destino ON transferencias_internas(cuenta_destino_id);

-- 5. Triggers
CREATE TRIGGER trg_updated_at_plan_cobro BEFORE UPDATE ON plan_cobro
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_plan_cobro_items BEFORE UPDATE ON plan_cobro_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
