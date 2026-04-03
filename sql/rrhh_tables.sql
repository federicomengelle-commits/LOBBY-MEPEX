-- =============================================
-- MEPEX — Módulo RRHH: tablas
-- =============================================
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Personal (nómina)
CREATE TABLE IF NOT EXISTS rrhh_personal (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL,
    rol TEXT,
    tipo TEXT DEFAULT 'fijo' CHECK (tipo IN ('fijo', 'eventual', 'cuadrilla')),
    cantidad_personas INT,  -- solo para tipo cuadrilla
    contacto TEXT,
    telefono TEXT,
    email TEXT,
    fecha_ingreso DATE,
    estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    documentacion TEXT,     -- DNI, ART, habilitaciones, etc.
    notas TEXT,
    _deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Asignaciones (personal → evento/proyecto)
CREATE TABLE IF NOT EXISTS rrhh_asignaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    personal_id BIGINT REFERENCES rrhh_personal(id),
    evento_id BIGINT,       -- FK a eventos_2026
    proyecto_id BIGINT,     -- FK a proyectos_2026
    rol_evento TEXT,        -- rol específico en ese evento (armador, electricista, chofer, etc.)
    fecha_desde DATE,
    fecha_hasta DATE,
    notas TEXT,
    _deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Vacaciones (config por persona)
CREATE TABLE IF NOT EXISTS rrhh_vacaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    personal_id BIGINT REFERENCES rrhh_personal(id),
    dias_totales INT DEFAULT 0,
    dias_usados INT DEFAULT 0,
    _deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Solicitudes de vacaciones
CREATE TABLE IF NOT EXISTS rrhh_vacaciones_solicitudes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    personal_id BIGINT REFERENCES rrhh_personal(id),
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NOT NULL,
    estado TEXT DEFAULT 'solicitada' CHECK (estado IN ('solicitada', 'aprobada', 'rechazada')),
    notas TEXT,
    _deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rrhh_personal_deleted ON rrhh_personal(_deleted);
CREATE INDEX IF NOT EXISTS idx_rrhh_personal_tipo ON rrhh_personal(tipo);
CREATE INDEX IF NOT EXISTS idx_rrhh_personal_estado ON rrhh_personal(estado);
CREATE INDEX IF NOT EXISTS idx_rrhh_asignaciones_personal ON rrhh_asignaciones(personal_id);
CREATE INDEX IF NOT EXISTS idx_rrhh_asignaciones_evento ON rrhh_asignaciones(evento_id);
CREATE INDEX IF NOT EXISTS idx_rrhh_asignaciones_deleted ON rrhh_asignaciones(_deleted);
CREATE INDEX IF NOT EXISTS idx_rrhh_vacaciones_personal ON rrhh_vacaciones(personal_id);
CREATE INDEX IF NOT EXISTS idx_rrhh_vac_sol_personal ON rrhh_vacaciones_solicitudes(personal_id);
CREATE INDEX IF NOT EXISTS idx_rrhh_vac_sol_estado ON rrhh_vacaciones_solicitudes(estado);

-- RLS policies (acceso para authenticated)
ALTER TABLE rrhh_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_vacaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_vacaciones_solicitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rrhh_personal_all" ON rrhh_personal FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "rrhh_asignaciones_all" ON rrhh_asignaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "rrhh_vacaciones_all" ON rrhh_vacaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "rrhh_vac_sol_all" ON rrhh_vacaciones_solicitudes FOR ALL USING (true) WITH CHECK (true);
