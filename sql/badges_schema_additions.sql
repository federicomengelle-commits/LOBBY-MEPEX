-- =============================================
-- Badges: columnas necesarias para alertas
-- Fecha: 2026-04-04
-- =============================================

-- 1. proyectos_2026: agregar updated_at para detectar proyectos estancados
ALTER TABLE proyectos_2026
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Trigger para auto-actualizar updated_at en cada UPDATE
CREATE OR REPLACE FUNCTION update_proyectos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proyectos_updated_at ON proyectos_2026;
CREATE TRIGGER trg_proyectos_updated_at
  BEFORE UPDATE ON proyectos_2026
  FOR EACH ROW
  EXECUTE FUNCTION update_proyectos_updated_at();

-- Inicializar updated_at con created_at para filas existentes
UPDATE proyectos_2026 SET updated_at = created_at WHERE updated_at IS NULL;

-- 2. clientes: agregar ultimo_contacto para badge CRM (follow-up)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS ultimo_contacto timestamptz DEFAULT NULL;

-- 3. insumos_base: agregar stock_actual y stock_minimo para badge inventario
ALTER TABLE insumos_base
  ADD COLUMN IF NOT EXISTS stock_actual numeric DEFAULT NULL;

ALTER TABLE insumos_base
  ADD COLUMN IF NOT EXISTS stock_minimo numeric DEFAULT NULL;
