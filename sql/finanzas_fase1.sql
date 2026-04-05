-- =============================================
-- MEPEX Lobby — Finanzas Fase 1
-- =============================================
-- Tabla: cuentas_financieras
-- Ejecutar manualmente en Supabase SQL Editor
-- =============================================

-- 1. Tabla cuentas_financieras
CREATE TABLE cuentas_financieras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('banco', 'billetera_digital', 'caja')),
    entidad TEXT,
    numero_cuenta TEXT,
    cbu_alias TEXT,
    canal_default TEXT NOT NULL DEFAULT 'oficial' CHECK (canal_default IN ('oficial', 'interno', 'mixto')),
    saldo_inicial NUMERIC(15,2) NOT NULL DEFAULT 0,
    activa BOOLEAN NOT NULL DEFAULT true,
    color TEXT DEFAULT '#4A90D9',
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 2. RLS
ALTER TABLE cuentas_financieras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finanzas_admin_only" ON cuentas_financieras
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')
        )
    );

-- 3. Función + Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_at_cuentas
    BEFORE UPDATE ON cuentas_financieras
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Índices útiles
CREATE INDEX idx_cuentas_financieras_activa ON cuentas_financieras (activa) WHERE _deleted = false;
CREATE INDEX idx_cuentas_financieras_tipo ON cuentas_financieras (tipo) WHERE _deleted = false;
