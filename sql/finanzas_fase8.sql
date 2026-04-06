-- =============================================
-- MEPEX Lobby - Finanzas Fase 8
-- =============================================
-- Tablas: conciliaciones, extracto_bancario_lineas
-- Ejecutar manualmente en Supabase SQL Editor
-- =============================================

-- 1. Conciliaciones
CREATE TABLE conciliaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id UUID NOT NULL REFERENCES cuentas_financieras(id),
    periodo TEXT NOT NULL,
    fecha_conciliacion DATE NOT NULL,
    saldo_banco NUMERIC(15,2) NOT NULL,
    saldo_lobby NUMERIC(15,2) NOT NULL,
    diferencia NUMERIC(15,2) NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'en_proceso' CHECK (estado IN ('en_proceso', 'conciliado', 'con_diferencia')),
    conciliado_por UUID,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 2. Líneas de extracto bancario
CREATE TABLE extracto_bancario_lineas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conciliacion_id UUID NOT NULL REFERENCES conciliaciones(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    descripcion TEXT NOT NULL,
    debito NUMERIC(15,2) DEFAULT 0,
    credito NUMERIC(15,2) DEFAULT 0,
    saldo NUMERIC(15,2),
    match_tipo TEXT CHECK (match_tipo IN ('auto', 'manual', 'sin_match', 'ignorado')),
    ingreso_id UUID,
    egreso_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS
ALTER TABLE conciliaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracto_bancario_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finanzas_admin_only" ON conciliaciones FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')));
CREATE POLICY "finanzas_admin_only" ON extracto_bancario_lineas FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')));

-- 4. Indices
CREATE INDEX idx_conciliaciones_cuenta ON conciliaciones(cuenta_id);
CREATE INDEX idx_conciliaciones_estado ON conciliaciones(estado) WHERE _deleted = false;
CREATE INDEX idx_extracto_conciliacion ON extracto_bancario_lineas(conciliacion_id);
CREATE INDEX idx_extracto_match ON extracto_bancario_lineas(match_tipo);
