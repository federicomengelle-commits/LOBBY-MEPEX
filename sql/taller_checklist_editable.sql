-- ═══════════════════════════════════════════════════════════════════
-- Taller — checklist EDITABLE por proyecto (Fase 4)
-- ═══════════════════════════════════════════════════════════════════
-- Evoluciona taller_proyecto_checklist (hoy VACÍA) de un modelo de item_key
-- fijo a checks editables: cada check es una fila con label + orden + soft
-- delete, que el encargado del taller puede tildar / agregar / renombrar /
-- quitar por proyecto (cada stand tiene su naturaleza).
--
-- Plantilla por defecto (se siembra desde la app al pasar el proyecto a taller):
--   Estructura · Pintura · Gráfica · Equipamiento · Iluminación · Listo para cargar
--
-- La identidad pasa a ser el `id` (UUID). Se quita el UNIQUE(proyecto_id,item_key)
-- porque item_key deja de ser la clave (los checks agregados a mano no tienen slug).
-- Idempotente. RLS ya está abierta a authenticated (policy taller_checklist_all).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.taller_proyecto_checklist ADD COLUMN IF NOT EXISTS label    TEXT;
ALTER TABLE public.taller_proyecto_checklist ADD COLUMN IF NOT EXISTS orden    INT NOT NULL DEFAULT 0;
ALTER TABLE public.taller_proyecto_checklist ADD COLUMN IF NOT EXISTS _deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- item_key deja de ser obligatorio (checks manuales no tienen slug de plantilla).
ALTER TABLE public.taller_proyecto_checklist ALTER COLUMN item_key DROP NOT NULL;

-- Se opera por id; el UNIQUE viejo (proyecto_id,item_key) estorba el editable.
ALTER TABLE public.taller_proyecto_checklist
    DROP CONSTRAINT IF EXISTS taller_proyecto_checklist_proyecto_id_item_key_key;

-- Índice de checks vivos por proyecto.
CREATE INDEX IF NOT EXISTS idx_tpc_proyecto_vivos
    ON public.taller_proyecto_checklist (proyecto_id) WHERE _deleted = FALSE;
