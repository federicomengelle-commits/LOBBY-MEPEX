-- =============================================
-- MEPEX Lobby - Costos Fase 3 (SQL defensivo)
-- =============================================
-- Refuerza la integridad del árbol BOM jerárquico:
--   * Bloquea ciclos a nivel base de datos (defense in depth).
--   * Valida rangos sanos en columnas de costeo del catálogo.
--   * Índices auxiliares para consultas recursivas.
--
-- La validación principal de ciclos vive en JS (API.validarNoCiclo) por
-- razones de UX, pero este trigger garantiza que un INSERT/UPDATE directo
-- en Supabase desde el SQL editor (o desde otro cliente) no rompa el árbol.
--
-- Ejecutar manualmente en Supabase SQL Editor.
-- =============================================

-- 1. CHECK constraints sobre catalogo_items
-- ------------------------------------------------
-- Margen subalquiler en [0, 5] (hasta 500%, igual la UI lo limita a 999)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalogo_items_margen_subalquiler_chk') THEN
        ALTER TABLE catalogo_items
            ADD CONSTRAINT catalogo_items_margen_subalquiler_chk
            CHECK (margen_subalquiler IS NULL OR (margen_subalquiler >= 0 AND margen_subalquiler <= 10));
    END IF;
END $$;

-- Margen propio en [0, 5]
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalogo_items_margen_propio_chk') THEN
        ALTER TABLE catalogo_items
            ADD CONSTRAINT catalogo_items_margen_propio_chk
            CHECK (margen_propio IS NULL OR (margen_propio >= 0 AND margen_propio <= 10));
    END IF;
END $$;

-- % indirectos fábrica en [0, 5]
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalogo_items_pct_ind_fabrica_chk') THEN
        ALTER TABLE catalogo_items
            ADD CONSTRAINT catalogo_items_pct_ind_fabrica_chk
            CHECK (pct_indirectos_fabrica IS NULL OR (pct_indirectos_fabrica >= 0 AND pct_indirectos_fabrica <= 5));
    END IF;
END $$;

-- % indirectos comercial en [0, 5]
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalogo_items_pct_ind_comercial_chk') THEN
        ALTER TABLE catalogo_items
            ADD CONSTRAINT catalogo_items_pct_ind_comercial_chk
            CHECK (pct_indirectos_comercial IS NULL OR (pct_indirectos_comercial >= 0 AND pct_indirectos_comercial <= 5));
    END IF;
END $$;

-- % reacondicionamiento en [0, 5]
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalogo_items_pct_reacondicionamiento_chk') THEN
        ALTER TABLE catalogo_items
            ADD CONSTRAINT catalogo_items_pct_reacondicionamiento_chk
            CHECK (pct_reacondicionamiento IS NULL OR (pct_reacondicionamiento >= 0 AND pct_reacondicionamiento <= 5));
    END IF;
END $$;

-- Vida útil >= 1
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalogo_items_vida_util_chk') THEN
        ALTER TABLE catalogo_items
            ADD CONSTRAINT catalogo_items_vida_util_chk
            CHECK (vida_util_usos IS NULL OR vida_util_usos >= 1);
    END IF;
END $$;

-- Mano de obra minutos >= 0
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalogo_items_mano_obra_minutos_chk') THEN
        ALTER TABLE catalogo_items
            ADD CONSTRAINT catalogo_items_mano_obra_minutos_chk
            CHECK (mano_obra_minutos IS NULL OR mano_obra_minutos >= 0);
    END IF;
END $$;


-- 2. Trigger anti-ciclo en receta_componentes
-- ------------------------------------------------
-- Recorre el árbol de descendientes del componente (cuando es item) y
-- aborta si encuentra al item padre.
--
-- IMPORTANTE: comparamos siempre con cast ::text. En esta tabla
-- componente_id puede convivir con item_id que tienen tipos distintos
-- según el origen (bigint vs text), y un comparador implícito
-- bigint = text rompe la query con "operator does not exist".
-- Castear a text cubre ambos casos sin perder semántica.
--
-- También: el trigger sólo valida si las columnas estructurales
-- (item_id, componente_id, componente_type) cambiaron en un UPDATE.
-- Sin esto, soft-deletes (UPDATE _deleted=true) volverían a correr
-- la búsqueda recursiva y podrían fallar por la misma razón de tipos.
CREATE OR REPLACE FUNCTION check_no_ciclo_receta()
RETURNS TRIGGER AS $$
DECLARE
    descendiente_existe BOOLEAN;
BEGIN
    -- Solo aplica cuando el componente es otro item
    IF NEW.componente_type IS DISTINCT FROM 'item' THEN
        RETURN NEW;
    END IF;

    -- En UPDATE, si las columnas relevantes no cambian (ej: soft-delete,
    -- o cambio de cantidad/notas), saltarse la validación.
    IF TG_OP = 'UPDATE' THEN
        IF OLD.item_id IS NOT DISTINCT FROM NEW.item_id
           AND OLD.componente_id IS NOT DISTINCT FROM NEW.componente_id
           AND OLD.componente_type IS NOT DISTINCT FROM NEW.componente_type THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Auto-referencia
    IF NEW.item_id::text = NEW.componente_id::text THEN
        RAISE EXCEPTION 'Una receta no puede contenerse a sí misma (item_id=%)', NEW.item_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- Búsqueda recursiva: ¿el padre (item_id) está en los descendientes del hijo (componente_id)?
    WITH RECURSIVE descendientes AS (
        SELECT componente_id::text AS desc_id
        FROM receta_componentes
        WHERE item_id::text = NEW.componente_id::text
          AND componente_type = 'item'
          AND _deleted = false

        UNION

        SELECT rc.componente_id::text
        FROM receta_componentes rc
        JOIN descendientes d ON rc.item_id::text = d.desc_id
        WHERE rc.componente_type = 'item'
          AND rc._deleted = false
    )
    SELECT EXISTS(SELECT 1 FROM descendientes WHERE desc_id = NEW.item_id::text)
    INTO descendiente_existe;

    IF descendiente_existe THEN
        RAISE EXCEPTION 'Ciclo detectado: agregar item % como componente de % crearía un loop en el árbol BOM',
            NEW.componente_id, NEW.item_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_no_ciclo_receta ON receta_componentes;
CREATE TRIGGER trg_check_no_ciclo_receta
    BEFORE INSERT OR UPDATE ON receta_componentes
    FOR EACH ROW
    EXECUTE FUNCTION check_no_ciclo_receta();


-- 3. Índices auxiliares para consultas recursivas
-- ------------------------------------------------
-- Acelera la búsqueda de descendientes (item_id → componente_id)
CREATE INDEX IF NOT EXISTS idx_receta_componentes_item_id_active
    ON receta_componentes (item_id)
    WHERE _deleted = false AND componente_type = 'item';

-- Acelera la búsqueda de ascendientes (componente_id → item_id)
CREATE INDEX IF NOT EXISTS idx_receta_componentes_componente_id_active
    ON receta_componentes (componente_id)
    WHERE _deleted = false AND componente_type = 'item';

-- Acelera la búsqueda de recetas que usan un insumo (componente_type='insumo')
CREATE INDEX IF NOT EXISTS idx_receta_componentes_insumo_active
    ON receta_componentes (componente_id)
    WHERE _deleted = false AND componente_type = 'insumo';


-- =============================================
-- NOTAS
-- =============================================
-- * El trigger es BEFORE INSERT/UPDATE → bloquea la operación con un
--   EXCEPTION antes de que se materialice. La UI muestra el mensaje
--   crudo de Postgres si no se valida en JS primero.
-- * El check recursivo usa WITH RECURSIVE estándar SQL — funciona en
--   Postgres ≥ 8.4 (Supabase corre 15+).
-- * Los CHECK constraints usan IF NOT EXISTS via DO block para que el
--   script sea idempotente (se puede correr múltiples veces).
-- * Si necesitás permitir que se exceda algún límite (ej: margen 600%),
--   ajustá el CHECK acá. La UI ya tiene su propio max distinto.
