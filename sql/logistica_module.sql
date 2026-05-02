-- =============================================
-- MEPEX — Módulo Logística
-- Tablas: vehiculos, movimientos, remito
-- =============================================

-- ── Vehículos ──
CREATE TABLE IF NOT EXISTS logistica_vehiculos (
    id              BIGSERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    tipo            TEXT NOT NULL DEFAULT 'propio' CHECK (tipo IN ('propio', 'tercero')),
    patente         TEXT,
    contacto        TEXT,
    vtv_vencimiento DATE,
    seguro_vencimiento DATE,
    ultimo_service  DATE,
    estado          TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'en_uso', 'en_service', 'baja')),
    notas           TEXT,
    _deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Movimientos (viajes) ──
CREATE TABLE IF NOT EXISTS logistica_movimientos (
    id              BIGSERIAL PRIMARY KEY,
    evento_id       BIGINT REFERENCES eventos(id) ON DELETE SET NULL,
    proyecto_id     BIGINT REFERENCES proyectos(id) ON DELETE SET NULL,
    vehiculo_id     BIGINT REFERENCES logistica_vehiculos(id) ON DELETE SET NULL,
    chofer          TEXT,
    origen          TEXT NOT NULL,
    destino         TEXT NOT NULL,
    fecha           DATE,
    hora_programada TEXT,
    check_salida    TIMESTAMPTZ,
    check_llegada   TIMESTAMPTZ,
    check_descarga  TIMESTAMPTZ,
    check_retorno   TIMESTAMPTZ,
    estado          TEXT DEFAULT 'programado',
    notas           TEXT,
    _deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Remito de carga ──
CREATE TABLE IF NOT EXISTS logistica_remito (
    id              BIGSERIAL PRIMARY KEY,
    movimiento_id   BIGINT NOT NULL REFERENCES logistica_movimientos(id) ON DELETE CASCADE,
    item_nombre     TEXT NOT NULL,
    cantidad        INTEGER,
    notas           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ──
CREATE INDEX IF NOT EXISTS idx_log_vehiculos_deleted ON logistica_vehiculos(_deleted);
CREATE INDEX IF NOT EXISTS idx_log_movimientos_deleted ON logistica_movimientos(_deleted);
CREATE INDEX IF NOT EXISTS idx_log_movimientos_evento ON logistica_movimientos(evento_id);
CREATE INDEX IF NOT EXISTS idx_log_movimientos_fecha ON logistica_movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_log_remito_movimiento ON logistica_remito(movimiento_id);

-- ── RLS Policies ──
ALTER TABLE logistica_vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_remito ENABLE ROW LEVEL SECURITY;

-- Permitir acceso a usuarios autenticados
CREATE POLICY "logistica_vehiculos_all" ON logistica_vehiculos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logistica_movimientos_all" ON logistica_movimientos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logistica_remito_all" ON logistica_remito FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Data inicial de ejemplo ──
INSERT INTO logistica_vehiculos (nombre, tipo, patente, contacto, estado) VALUES
    ('Cargo 915', 'propio', NULL, NULL, 'disponible'),
    ('Transit', 'propio', NULL, NULL, 'disponible'),
    ('Flete Claudio', 'tercero', NULL, 'Claudio', 'disponible'),
    ('Flete Polaco', 'tercero', NULL, 'Polaco', 'disponible'),
    ('Flete Miky', 'tercero', NULL, 'Miky', 'disponible');
