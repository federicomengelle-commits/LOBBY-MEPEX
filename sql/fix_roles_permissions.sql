-- ══════════════════════════════════════════════
-- FIX 1: Corregir roles inconsistentes en profiles
-- ══════════════════════════════════════════════

-- Sofi tiene 'finanzas' (no existe como rol) → cambiar a 'admin'
UPDATE public.profiles
SET role = 'admin'
WHERE username = 'sofi';

-- Noe tiene 'ventas' (con S) → cambiar a 'venta' (sin S, como usa el código)
UPDATE public.profiles
SET role = 'venta'
WHERE username = 'noe';

-- ══════════════════════════════════════════════
-- FIX 2: Crear tabla de roles con permisos en JSONB
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,                    -- 'superadmin', 'admin', 'venta', 'pm', 'taller', o custom
    label TEXT NOT NULL,                    -- 'Super Admin', 'Administrador', etc.
    description TEXT DEFAULT '',
    is_base BOOLEAN NOT NULL DEFAULT false, -- true = no se puede eliminar
    permissions JSONB NOT NULL DEFAULT '{}',
    -- permissions format: { "crm": "write", "catalogo": "read", "finanzas": "none" }
    -- "write" = acceso completo, "read" = solo lectura, "none" o ausente = sin acceso
    color TEXT DEFAULT '#7A8599',           -- color del badge del rol
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar los 5 roles base
INSERT INTO public.roles (id, label, description, is_base, permissions, color) VALUES
('superadmin', 'Super Admin', 'Acceso total al sistema incluyendo Admin Panel', true,
 '{"crm":"write","cotizador":"write","catalogo":"write","proyectos":"write","eventos":"write","taller":"write","logistica":"write","rrhh":"write","compras":"write","inventario":"write","locaciones":"write","finanzas":"write","costos":"write","admin-panel":"write"}',
 '#FF4757'),
('admin', 'Administrador', 'Acceso total excepto Admin Panel', true,
 '{"crm":"write","cotizador":"write","catalogo":"write","proyectos":"write","eventos":"write","taller":"write","logistica":"write","rrhh":"write","compras":"write","inventario":"write","locaciones":"write","finanzas":"write","costos":"write"}',
 '#00A9C1'),
('venta', 'Ventas', 'Área comercial + operativo con escritura', true,
 '{"crm":"write","cotizador":"write","catalogo":"read","proyectos":"write","eventos":"write"}',
 '#F28D15'),
('pm', 'Project Manager', 'Operativo completo + comercial en lectura', true,
 '{"crm":"read","catalogo":"read","proyectos":"write","eventos":"write","taller":"write","logistica":"write","inventario":"read"}',
 '#00CC88'),
('taller', 'Taller', 'Mínimo operativo', true,
 '{"proyectos":"read","eventos":"read","taller":"write","logistica":"write","inventario":"read"}',
 '#9B7DFF')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════
-- FIX 3: Agregar soft delete a profiles
-- ══════════════════════════════════════════════

-- Agregar columna _deleted para soft delete (si no existe)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS _deleted BOOLEAN NOT NULL DEFAULT false;

-- Agregar columna deleted_at (timestamp del soft delete)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ══════════════════════════════════════════════
-- FIX 4: RLS para tabla roles
-- ══════════════════════════════════════════════

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer roles (necesario para el login)
CREATE POLICY "roles_select_authenticated" ON public.roles
    FOR SELECT TO authenticated USING (true);

-- Solo superadmin puede modificar roles
-- (en la práctica el control fino se hace desde el frontend,
--  pero esto protege la tabla a nivel DB)
CREATE POLICY "roles_all_superadmin" ON public.roles
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'superadmin'
            AND profiles.active = true
        )
    );
