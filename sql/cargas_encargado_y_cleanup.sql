-- ─────────────────────────────────────────────────────────────
-- Cargas: encargado de carga (responsable MEPEX designado)
-- y cleanup de "vías paralelas" de asignación de personas.
-- ─────────────────────────────────────────────────────────────
--
-- Fecha: 2026-05-17
-- Decisión:
--   * La carga lleva un CHOFER (obligatorio en la práctica, propio
--     o ajeno) y opcionalmente un ENCARGADO de la carga (cualquier
--     persona con rol operativo).
--   * Las asignaciones de personas al EVENTO se hacen exclusivamente
--     desde la ficha del evento contra `asignaciones_evento`. La
--     vieja `rrhh_asignaciones` queda intacta como histórico pero la
--     UI ya no la lee ni escribe.
--   * Los "ayudantes de la carga" se eliminan del flujo. La tabla
--     `carga_personas` queda intacta para no romper FKs pero deja de
--     usarse.
--
-- Este script SOLO agrega la columna `encargado_persona_id` a `cargas`.
-- No borra nada — la limpieza efectiva ocurre en la UI.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.cargas
    ADD COLUMN IF NOT EXISTS encargado_persona_id UUID
        REFERENCES public.personas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cargas.encargado_persona_id IS
    'Responsable MEPEX designado de la carga. Persona con rol operativo. '
    'Opcional. El chofer (chofer_persona_id) es siempre obligatorio en práctica.';

CREATE INDEX IF NOT EXISTS idx_cargas_encargado
    ON public.cargas (encargado_persona_id)
    WHERE encargado_persona_id IS NOT NULL;
