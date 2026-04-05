-- =============================================
-- MEPEX Lobby - Finanzas Fase 5
-- =============================================
-- Tablas: comprobantes, comprobantes_recibidos
-- Ejecutar manualmente en Supabase SQL Editor
-- =============================================

-- 1. Comprobantes emitidos (ventas → La PyME)
CREATE TABLE comprobantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN (
        'factura_a', 'factura_b', 'factura_c',
        'nota_credito_a', 'nota_credito_b',
        'nota_debito_a', 'nota_debito_b', 'recibo'
    )),
    punto_venta INT NOT NULL DEFAULT 5,
    numero TEXT,
    cliente_id UUID,
    cuit_dni TEXT NOT NULL,
    servicio TEXT NOT NULL CHECK (servicio IN ('SRV-STAND', 'SRV-ALQUILER', 'SRV-EXPO', 'SRV-ADIC')),
    descripcion TEXT,
    neto NUMERIC(15,2) NOT NULL,
    iva_alicuota NUMERIC(5,2) NOT NULL DEFAULT 21.00,
    iva NUMERIC(15,2) NOT NULL,
    total NUMERIC(15,2) NOT NULL,
    cae TEXT,
    cae_vencimiento DATE,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('emitida', 'error', 'pendiente', 'anulada')),
    error_detalle TEXT,
    pdf_url TEXT,
    proyecto_id UUID,
    ingreso_id UUID,
    lapyme_response JSONB,
    canal TEXT NOT NULL DEFAULT 'oficial',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 2. Comprobantes recibidos (compras)
CREATE TABLE comprobantes_recibidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN (
        'factura_a', 'factura_b', 'factura_c',
        'nota_credito', 'nota_debito', 'recibo', 'otro'
    )),
    numero TEXT,
    proveedor_id UUID,
    proveedor_nombre TEXT,
    cuit TEXT,
    concepto TEXT NOT NULL,
    neto NUMERIC(15,2),
    iva NUMERIC(15,2),
    total NUMERIC(15,2) NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('material', 'servicio', 'alquiler', 'credito_fiscal', 'logistica', 'otro')),
    archivo_url TEXT,
    orden_compra_id UUID,
    egreso_id UUID,
    proyecto_id UUID,
    canal TEXT NOT NULL DEFAULT 'oficial' CHECK (canal IN ('oficial', 'interno')),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 3. RLS
ALTER TABLE comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes_recibidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finanzas_admin_only" ON comprobantes FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')));
CREATE POLICY "finanzas_admin_only" ON comprobantes_recibidos FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')));

-- 4. Índices
CREATE INDEX idx_comprobantes_fecha ON comprobantes(fecha);
CREATE INDEX idx_comprobantes_cliente ON comprobantes(cliente_id);
CREATE INDEX idx_comprobantes_proyecto ON comprobantes(proyecto_id);
CREATE INDEX idx_comprobantes_estado ON comprobantes(estado) WHERE _deleted = false;
CREATE INDEX idx_comprobantes_rec_fecha ON comprobantes_recibidos(fecha);
CREATE INDEX idx_comprobantes_rec_proveedor ON comprobantes_recibidos(proveedor_id);
CREATE INDEX idx_comprobantes_rec_egreso ON comprobantes_recibidos(egreso_id);

-- 5. Triggers
CREATE TRIGGER trg_updated_at_comprobantes BEFORE UPDATE ON comprobantes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_comprobantes_rec BEFORE UPDATE ON comprobantes_recibidos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
