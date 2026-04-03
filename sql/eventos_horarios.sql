-- =============================================
-- Migración: Agregar horarios por fase a eventos_2026
-- =============================================
-- Cada fase (armado, evento, desarme) ahora tiene
-- horario de apertura y cierre del predio.
-- Formato: TIME sin timezone (ej: '08:00', '18:00')
-- =============================================

ALTER TABLE eventos_2026
    ADD COLUMN IF NOT EXISTS hora_armado_apertura   TIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS hora_armado_cierre     TIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS hora_evento_apertura   TIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS hora_evento_cierre     TIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS hora_desarme_apertura  TIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS hora_desarme_cierre    TIME DEFAULT NULL;

-- Comentarios descriptivos
COMMENT ON COLUMN eventos_2026.hora_armado_apertura IS 'Horario apertura del predio para armado';
COMMENT ON COLUMN eventos_2026.hora_armado_cierre IS 'Horario cierre del predio para armado';
COMMENT ON COLUMN eventos_2026.hora_evento_apertura IS 'Horario apertura del evento para público/expositores';
COMMENT ON COLUMN eventos_2026.hora_evento_cierre IS 'Horario cierre del evento';
COMMENT ON COLUMN eventos_2026.hora_desarme_apertura IS 'Horario apertura del predio para desarme';
COMMENT ON COLUMN eventos_2026.hora_desarme_cierre IS 'Horario cierre del predio para desarme';
