-- =============================================
-- MEPEX — Módulo Compras
-- Tablas: proveedores, ordenes, orden_items, pagos
-- =============================================

-- ── Proveedores ──
CREATE TABLE IF NOT EXISTS compras_proveedores (
    id                  BIGSERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL,
    razon_social        TEXT,
    rubro               TEXT,
    contacto            TEXT,
    telefono            TEXT,
    email               TEXT,
    calif_cumplimiento  INTEGER CHECK (calif_cumplimiento BETWEEN 0 AND 5),
    calif_calidad       INTEGER CHECK (calif_calidad BETWEEN 0 AND 5),
    calif_precio        INTEGER CHECK (calif_precio BETWEEN 0 AND 5),
    notas               TEXT,
    _deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Órdenes de Compra ──
CREATE TABLE IF NOT EXISTS compras_ordenes (
    id              BIGSERIAL PRIMARY KEY,
    proveedor_id    BIGINT REFERENCES compras_proveedores(id) ON DELETE SET NULL,
    evento_id       BIGINT,
    proyecto_id     BIGINT,
    numero_oc       TEXT,
    fecha           DATE,
    estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'recibida', 'pagada')),
    monto_total     NUMERIC(12,2) DEFAULT 0,
    notas           TEXT,
    _deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Items de Orden de Compra ──
CREATE TABLE IF NOT EXISTS compras_orden_items (
    id              BIGSERIAL PRIMARY KEY,
    orden_id        BIGINT NOT NULL REFERENCES compras_ordenes(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    cantidad        INTEGER,
    precio_unitario NUMERIC(12,2),
    subtotal        NUMERIC(12,2),
    notas           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Pagos planificados ──
CREATE TABLE IF NOT EXISTS compras_pagos (
    id                  BIGSERIAL PRIMARY KEY,
    proveedor_id        BIGINT REFERENCES compras_proveedores(id) ON DELETE SET NULL,
    orden_id            BIGINT REFERENCES compras_ordenes(id) ON DELETE SET NULL,
    concepto            TEXT,
    monto               NUMERIC(12,2),
    fecha_vencimiento   DATE,
    fecha_pago          DATE,
    estado              TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
    notas               TEXT,
    _deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ──
CREATE INDEX IF NOT EXISTS idx_cmp_proveedores_deleted ON compras_proveedores(_deleted);
CREATE INDEX IF NOT EXISTS idx_cmp_ordenes_deleted ON compras_ordenes(_deleted);
CREATE INDEX IF NOT EXISTS idx_cmp_ordenes_proveedor ON compras_ordenes(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_cmp_ordenes_estado ON compras_ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_cmp_orden_items_orden ON compras_orden_items(orden_id);
CREATE INDEX IF NOT EXISTS idx_cmp_pagos_deleted ON compras_pagos(_deleted);
CREATE INDEX IF NOT EXISTS idx_cmp_pagos_proveedor ON compras_pagos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_cmp_pagos_vencimiento ON compras_pagos(fecha_vencimiento);

-- ── RLS Policies ──
ALTER TABLE compras_proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_orden_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_proveedores_all" ON compras_proveedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "compras_ordenes_all" ON compras_ordenes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "compras_orden_items_all" ON compras_orden_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "compras_pagos_all" ON compras_pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);
