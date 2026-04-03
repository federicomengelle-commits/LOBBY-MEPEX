-- =============================================
-- LISTAS DE PRECIO — Módulo Costos
-- =============================================
-- Tablas para gestionar listas de precio con
-- márgenes configurables a 3 niveles:
-- global, por rubro, por item.
-- =============================================

-- 1. Listas de precio
CREATE TABLE IF NOT EXISTS listas_precio (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'custom',        -- 'general', 'agencias', 'custom'
    estado TEXT NOT NULL DEFAULT 'borrador',    -- 'activa', 'borrador'
    margen_global NUMERIC(10,2) DEFAULT 0,     -- % margen global de la lista
    descripcion TEXT DEFAULT '',
    _deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Override de margen por rubro
CREATE TABLE IF NOT EXISTS lista_precio_rubros (
    id BIGSERIAL PRIMARY KEY,
    lista_id BIGINT NOT NULL REFERENCES listas_precio(id) ON DELETE CASCADE,
    rubro TEXT NOT NULL,
    margen NUMERIC(10,2) NOT NULL DEFAULT 0,
    _deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(lista_id, rubro)
);

-- 3. Override de margen por item
CREATE TABLE IF NOT EXISTS lista_precio_items (
    id BIGSERIAL PRIMARY KEY,
    lista_id BIGINT NOT NULL REFERENCES listas_precio(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES catalogo_items(id) ON DELETE CASCADE,
    margen NUMERIC(10,2) NOT NULL DEFAULT 0,
    _deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(lista_id, item_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lista_rubros_lista ON lista_precio_rubros(lista_id);
CREATE INDEX IF NOT EXISTS idx_lista_items_lista ON lista_precio_items(lista_id);
CREATE INDEX IF NOT EXISTS idx_lista_items_item ON lista_precio_items(item_id);

-- RLS policies (authenticated access)
ALTER TABLE listas_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_precio_rubros ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_precio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read listas_precio"
    ON listas_precio FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert listas_precio"
    ON listas_precio FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update listas_precio"
    ON listas_precio FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete listas_precio"
    ON listas_precio FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read lista_precio_rubros"
    ON lista_precio_rubros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert lista_precio_rubros"
    ON lista_precio_rubros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update lista_precio_rubros"
    ON lista_precio_rubros FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete lista_precio_rubros"
    ON lista_precio_rubros FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read lista_precio_items"
    ON lista_precio_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert lista_precio_items"
    ON lista_precio_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update lista_precio_items"
    ON lista_precio_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete lista_precio_items"
    ON lista_precio_items FOR DELETE TO authenticated USING (true);

-- Seed: listas iniciales (General y Agencias)
INSERT INTO listas_precio (nombre, tipo, estado, margen_global, descripcion)
VALUES
    ('General', 'general', 'activa', 40, 'Lista de precios estándar para clientes directos'),
    ('Agencias', 'agencias', 'activa', 25, 'Lista con descuento para agencias que recotizan')
ON CONFLICT DO NOTHING;
