-- =============================================
-- MEPEX Lobby - Finanzas Fase 2
-- =============================================
-- Tabla: ingresos (cobros)
-- Ejecutar manualmente en Supabase SQL Editor
-- =============================================

CREATE TABLE ingresos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    proyecto_id UUID,
    evento_id UUID,
    cliente_id UUID,
    concepto TEXT NOT NULL,
    monto NUMERIC(15,2) NOT NULL,
    medio TEXT NOT NULL CHECK (medio IN ('transferencia', 'efectivo', 'cheque', 'mercadopago', 'pagofacil', 'otro')),
    canal TEXT NOT NULL DEFAULT 'oficial' CHECK (canal IN ('oficial', 'interno')),
    cuenta_id UUID REFERENCES cuentas_financieras(id),
    comprobante_id UUID,
    plan_cobro_item_id UUID,
    estado TEXT NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('confirmado', 'pendiente', 'anulado')),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- RLS
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finanzas_admin_only" ON ingresos
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
    );

-- Índices
CREATE INDEX idx_ingresos_fecha ON ingresos(fecha);
CREATE INDEX idx_ingresos_canal ON ingresos(canal);
CREATE INDEX idx_ingresos_cuenta ON ingresos(cuenta_id);
CREATE INDEX idx_ingresos_proyecto ON ingresos(proyecto_id);
CREATE INDEX idx_ingresos_estado ON ingresos(estado) WHERE _deleted = false;

-- Trigger updated_at
CREATE TRIGGER trg_updated_at_ingresos BEFORE UPDATE ON ingresos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
