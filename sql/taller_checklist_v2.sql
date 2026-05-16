-- =============================================
-- MEPEX — Taller checklist v2 (UUID, alineado a proyectos)
-- Fecha: 2026-05-16
-- =============================================
-- La tabla legacy `taller_checklist` usa `proyecto_id BIGINT`. Como
-- proyectos.id es UUID, no joinea. Creamos una tabla nueva con FK real.
-- Items del checklist (item_key): placas, iluminacion, mobiliario,
-- pisos, grafica, embalado. Los labels viven en el frontend.
--
-- `produccion_mantenimiento` (BIGSERIAL standalone) se reusa sin tocar.
-- =============================================

CREATE TABLE IF NOT EXISTS public.taller_proyecto_checklist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id     UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
    item_key        TEXT NOT NULL,
    checked         BOOLEAN DEFAULT FALSE,
    checked_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    checked_at      TIMESTAMPTZ,
    notas           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (proyecto_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_taller_checklist_proyecto
    ON public.taller_proyecto_checklist (proyecto_id);

CREATE INDEX IF NOT EXISTS idx_taller_checklist_pendientes
    ON public.taller_proyecto_checklist (proyecto_id, checked)
    WHERE checked = FALSE;

ALTER TABLE public.taller_proyecto_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "taller_checklist_all" ON public.taller_proyecto_checklist;
CREATE POLICY "taller_checklist_all" ON public.taller_proyecto_checklist
    FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ─── produccion_mantenimiento ya existe legacy (sql/taller_module.sql) ───
-- Sólo aseguramos RLS por si no estaba.
ALTER TABLE public.produccion_mantenimiento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "produccion_mantenimiento_all" ON public.produccion_mantenimiento;
CREATE POLICY "produccion_mantenimiento_all" ON public.produccion_mantenimiento
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Fin migración checklist v2 ───
