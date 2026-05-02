-- ⚠️ La sección de proyectos (ADD updated_at + trigger) ya está
-- incluida en sql/rename_proyectos_eventos.sql. Las secciones de
-- clientes (ultimo_contacto) e insumos_base (stock_actual/minimo)
-- siguen vigentes si aún no se aplicaron.

-- =============================================
-- Badges: columnas necesarias para alertas
-- Fecha: 2026-04-04
-- =============================================

-- 1. proyectos: agregar updated_at para detectar proyectos estancados
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Trigger para auto-actualizar updated_at en cada UPDATE
CREATE OR REPLACE FUNCTION update_proyectos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proyectos_updated_at ON proyectos;
CREATE TRIGGER trg_proyectos_updated_at
  BEFORE UPDATE ON proyectos
  FOR EACH ROW
  EXECUTE FUNCTION update_proyectos_updated_at();

-- Inicializar updated_at con created_at para filas existentes
UPDATE proyectos SET updated_at = created_at WHERE updated_at IS NULL;

-- 2. clientes: agregar ultimo_contacto para badge CRM (follow-up)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS ultimo_contacto timestamptz DEFAULT NULL;

-- 3. insumos_base: agregar stock_actual y stock_minimo para badge inventario
ALTER TABLE insumos_base
  ADD COLUMN IF NOT EXISTS stock_actual numeric DEFAULT NULL;

ALTER TABLE insumos_base
  ADD COLUMN IF NOT EXISTS stock_minimo numeric DEFAULT NULL;
