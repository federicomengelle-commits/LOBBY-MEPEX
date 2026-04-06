-- =============================================
-- MEPEX Lobby - Finanzas Fase 6
-- =============================================
-- Tablas: vencimientos_recurrentes, vencimientos_generados
-- Ejecutar manualmente en Supabase SQL Editor
-- =============================================

-- 1. Vencimientos recurrentes (plantillas)
CREATE TABLE vencimientos_recurrentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concepto TEXT NOT NULL,
    monto_estimado NUMERIC(15,2),
    frecuencia TEXT NOT NULL CHECK (frecuencia IN ('mensual', 'bimestral', 'trimestral', 'semestral', 'anual')),
    dia_mes INT CHECK (dia_mes BETWEEN 1 AND 31),
    categoria_egreso TEXT NOT NULL,
    subcategoria TEXT,
    cuenta_sugerida_id UUID REFERENCES cuentas_financieras(id),
    canal TEXT NOT NULL DEFAULT 'oficial' CHECK (canal IN ('oficial', 'interno')),
    activo BOOLEAN NOT NULL DEFAULT true,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 2. Vencimientos generados (instancias)
CREATE TABLE vencimientos_generados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurrente_id UUID REFERENCES vencimientos_recurrentes(id),
    fecha_vencimiento DATE NOT NULL,
    concepto TEXT NOT NULL,
    monto_estimado NUMERIC(15,2),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'vencido', 'ignorado')),
    egreso_id UUID REFERENCES egresos(id),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 3. RLS
ALTER TABLE vencimientos_recurrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vencimientos_generados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finanzas_admin_only" ON vencimientos_recurrentes FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')));
CREATE POLICY "finanzas_admin_only" ON vencimientos_generados FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')));

-- 4. Indices
CREATE INDEX idx_vencimientos_gen_fecha ON vencimientos_generados(fecha_vencimiento);
CREATE INDEX idx_vencimientos_gen_estado ON vencimientos_generados(estado) WHERE _deleted = false;
CREATE INDEX idx_vencimientos_gen_recurrente ON vencimientos_generados(recurrente_id);
CREATE INDEX idx_vencimientos_rec_activo ON vencimientos_recurrentes(activo) WHERE _deleted = false;

-- 5. Triggers
CREATE TRIGGER trg_updated_at_venc_rec BEFORE UPDATE ON vencimientos_recurrentes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
