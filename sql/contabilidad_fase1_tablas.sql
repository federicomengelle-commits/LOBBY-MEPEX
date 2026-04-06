-- =============================================
-- MEPEX Lobby - Contabilidad Fase 1 — TABLAS
-- =============================================
-- Tablas: plan_cuentas, asientos, asiento_lineas,
-- mapeo_cuentas, saldos_mensuales
-- Ejecutar manualmente en Supabase SQL Editor
-- =============================================

-- 1. Plan de cuentas (árbol jerárquico 3 niveles)
CREATE TABLE plan_cuentas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    nivel INT NOT NULL CHECK (nivel BETWEEN 1 AND 3),
    tipo TEXT NOT NULL CHECK (tipo IN (
        'activo', 'pasivo', 'patrimonio_neto',
        'resultado_positivo', 'resultado_negativo', 'orden'
    )),
    naturaleza TEXT NOT NULL CHECK (naturaleza IN ('deudora', 'acreedora')),
    es_grupo BOOLEAN NOT NULL DEFAULT false,
    codigo_padre TEXT REFERENCES plan_cuentas(codigo),
    cuenta_financiera_id UUID REFERENCES cuentas_financieras(id),
    activa BOOLEAN NOT NULL DEFAULT true,
    notas TEXT,
    orden INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 2. Asientos contables (cabecera)
CREATE TABLE asientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero SERIAL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    descripcion TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'manual' CHECK (tipo IN ('manual', 'automatico')),
    origen_tipo TEXT,    -- 'ingreso', 'egreso', 'transferencia', etc.
    origen_id UUID,      -- id del registro origen
    canal TEXT CHECK (canal IN ('oficial', 'interno')),
    estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'confirmado', 'anulado')),
    total_debe NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_haber NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 3. Líneas de asiento (partida doble)
CREATE TABLE asiento_lineas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asiento_id UUID NOT NULL REFERENCES asientos(id) ON DELETE CASCADE,
    cuenta_id UUID NOT NULL REFERENCES plan_cuentas(id),
    debe NUMERIC(15,2) NOT NULL DEFAULT 0,
    haber NUMERIC(15,2) NOT NULL DEFAULT 0,
    descripcion TEXT,
    orden INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Mapeo de cuentas (qué cuenta contable usar para cada tipo de movimiento)
CREATE TABLE mapeo_cuentas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT NOT NULL UNIQUE,  -- ej: 'ingreso_transferencia', 'egreso_efectivo'
    cuenta_id UUID NOT NULL REFERENCES plan_cuentas(id),
    descripcion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted BOOLEAN NOT NULL DEFAULT false
);

-- 5. Saldos mensuales (cache de saldos para reportes rápidos)
CREATE TABLE saldos_mensuales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id UUID NOT NULL REFERENCES plan_cuentas(id),
    anio INT NOT NULL,
    mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    debe NUMERIC(15,2) NOT NULL DEFAULT 0,
    haber NUMERIC(15,2) NOT NULL DEFAULT 0,
    saldo NUMERIC(15,2) NOT NULL DEFAULT 0,
    canal TEXT CHECK (canal IN ('oficial', 'interno')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(cuenta_id, anio, mes, canal)
);

-- ─── RLS ───
ALTER TABLE plan_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE asientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE asiento_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapeo_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE saldos_mensuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contabilidad_admin_only" ON plan_cuentas
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
    );

CREATE POLICY "contabilidad_admin_only" ON asientos
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
    );

CREATE POLICY "contabilidad_admin_only" ON asiento_lineas
    FOR ALL USING (
        asiento_id IN (SELECT id FROM asientos)
    );

CREATE POLICY "contabilidad_admin_only" ON mapeo_cuentas
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
    );

CREATE POLICY "contabilidad_admin_only" ON saldos_mensuales
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
    );

-- ─── Índices ───
CREATE INDEX idx_plan_cuentas_nivel ON plan_cuentas (nivel) WHERE _deleted = false;
CREATE INDEX idx_plan_cuentas_padre ON plan_cuentas (codigo_padre) WHERE _deleted = false;
CREATE INDEX idx_plan_cuentas_orden ON plan_cuentas (orden) WHERE _deleted = false;
CREATE INDEX idx_asientos_fecha ON asientos (fecha) WHERE _deleted = false;
CREATE INDEX idx_asientos_origen ON asientos (origen_tipo, origen_id) WHERE _deleted = false;
CREATE INDEX idx_asiento_lineas_asiento ON asiento_lineas (asiento_id);
CREATE INDEX idx_asiento_lineas_cuenta ON asiento_lineas (cuenta_id);
CREATE INDEX idx_saldos_mensuales_cuenta ON saldos_mensuales (cuenta_id, anio, mes);

-- ─── Triggers updated_at ───
CREATE TRIGGER trg_updated_at_plan_cuentas
    BEFORE UPDATE ON plan_cuentas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_updated_at_asientos
    BEFORE UPDATE ON asientos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_updated_at_mapeo_cuentas
    BEFORE UPDATE ON mapeo_cuentas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
