-- =============================================
-- MEPEX Lobby - Finanzas Fase 3
-- =============================================
-- Tabla: egresos (pagos)
-- Ejecutar manualmente en Supabase SQL Editor
-- =============================================

CREATE TABLE egresos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('proveedor', 'rrhh', 'impuesto', 'servicio', 'credito_fiscal', 'alquiler', 'logistica', 'otro')),
    subcategoria TEXT,
    destinatario TEXT,
    proveedor_id UUID,
    empleado_id UUID,
    proyecto_id UUID,
    evento_id UUID,
    concepto TEXT NOT NULL,
    monto NUMERIC(15,2) NOT NULL,
    medio TEXT NOT NULL CHECK (medio IN ('transferencia', 'efectivo', 'cheque', 'mercadopago', 'pagofacil', 'otro')),
    canal TEXT NOT NULL DEFAULT 'oficial' CHECK (canal IN ('oficial', 'interno')),
    cuenta_id UUID REFERENCES cuentas_financieras(id),
    comprobante_recibido_id UUID,
    orden_compra_id UUID,
    estado TEXT NOT NULL DEFAULT 'pagado' CHECK (estado IN ('pagado', 'pendiente', 'programado', 'anulado')),
    fecha_programada DATE,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- RLS
ALTER TABLE egresos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finanzas_admin_only" ON egresos
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
    );

-- Índices
CREATE INDEX idx_egresos_fecha ON egresos(fecha);
CREATE INDEX idx_egresos_categoria ON egresos(categoria);
CREATE INDEX idx_egresos_canal ON egresos(canal);
CREATE INDEX idx_egresos_cuenta ON egresos(cuenta_id);
CREATE INDEX idx_egresos_estado ON egresos(estado) WHERE _deleted = false;

-- Trigger updated_at
CREATE TRIGGER trg_updated_at_egresos BEFORE UPDATE ON egresos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
