-- =============================================
-- RRHH.2 — Ausencias + saldos de vacaciones + migración legacy
-- =============================================
-- Blueprint: docs/modulo-rrhh-v2-blueprint.md §3.4, §5, §6
-- Schema verificado contra prod (docs/schema-prod.md, 2026-06-13).
-- Correr en Supabase SQL Editor ANTES del push del JS (regla SQL-first).
-- Idempotente. Los DROP de tablas legacy están al final, COMENTADOS
-- (correr SOLO después de verificar en prod + con backup pg_dump hecho).
-- =============================================

-- ── 1. Tablas nuevas ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ausencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES personas(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('vacaciones','enfermedad','licencia','franco','falta')),
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NOT NULL,
    estado TEXT NOT NULL DEFAULT 'aprobada' CHECK (estado IN ('solicitada','aprobada','rechazada')),
    aprobada_por UUID REFERENCES profiles(id),
    notas TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    _deleted BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_ausencias_persona ON ausencias(persona_id) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_ausencias_fechas ON ausencias(fecha_desde, fecha_hasta) WHERE _deleted = false;

CREATE TABLE IF NOT EXISTS vacaciones_saldos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES personas(id),
    anio INT NOT NULL,
    dias_totales INT NOT NULL DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    _deleted BOOLEAN DEFAULT false,
    UNIQUE (persona_id, anio)
);

-- ── 2. RLS (módulo admin/superadmin a nivel UI; CRUD para authenticated) ──
ALTER TABLE ausencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacaciones_saldos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ausencias_all ON ausencias;
CREATE POLICY ausencias_all ON ausencias
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS vacaciones_saldos_all ON vacaciones_saldos;
CREATE POLICY vacaciones_saldos_all ON vacaciones_saldos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 3. Migración legacy → nuevo schema ────────────────────────
-- Match por personal_id = personas.id (Tanda 3.A copió rrhh_personal → personas
-- manteniendo el MISMO UUID; verificado 2026-06-13: los 3 rrhh_personal vivos
-- mapean a personas, y los 2 rrhh_vacaciones también).

-- 3a. rrhh_vacaciones → vacaciones_saldos (año vigente). dias_usados NO se migra:
--     en el modelo nuevo los usados se DERIVAN de las ausencias tipo vacaciones.
INSERT INTO vacaciones_saldos (persona_id, anio, dias_totales)
SELECT v.personal_id, EXTRACT(YEAR FROM now())::int, v.dias_totales
FROM rrhh_vacaciones v
WHERE v._deleted IS NOT TRUE
  AND EXISTS (SELECT 1 FROM personas p WHERE p.id = v.personal_id)
ON CONFLICT (persona_id, anio) DO NOTHING;

-- 3b. rrhh_vacaciones_solicitudes → ausencias tipo vacaciones (0 filas hoy,
--     incluido por completitud / idempotencia).
INSERT INTO ausencias (persona_id, tipo, fecha_desde, fecha_hasta, estado, notas)
SELECT s.personal_id, 'vacaciones', s.fecha_desde, s.fecha_hasta,
       CASE s.estado
            WHEN 'aprobada' THEN 'aprobada'
            WHEN 'rechazada' THEN 'rechazada'
            ELSE 'solicitada'
       END,
       s.notas
FROM rrhh_vacaciones_solicitudes s
WHERE s._deleted IS NOT TRUE
  AND EXISTS (SELECT 1 FROM personas p WHERE p.id = s.personal_id)
  AND NOT EXISTS (  -- evitar duplicar si se re-corre
      SELECT 1 FROM ausencias a
      WHERE a.persona_id = s.personal_id AND a.tipo = 'vacaciones'
        AND a.fecha_desde = s.fecha_desde AND a.fecha_hasta = s.fecha_hasta
  );

-- Verificación post-migración:
SELECT
  (SELECT count(*) FROM vacaciones_saldos WHERE _deleted = false) AS saldos_migrados,
  (SELECT count(*) FROM ausencias WHERE _deleted = false)         AS ausencias_total;

-- ── 4. RETIRO LEGACY — DIFERIDO (correr SOLO tras verificar + backup) ──────
-- Estado de lectores (verificado 2026-06-13):
--   rrhh_asignaciones          → SIN lectores (api.js limpiado, rrhh.js reescrito). DROPeable.
--   rrhh_vacaciones            → SIN lectores (rrhh.js usa vacaciones_saldos). DROPeable.
--   rrhh_vacaciones_solicitudes→ SIN lectores (alertas.js repuntado a ausencias). DROPeable.
--   rrhh_personal              → AÚN con lectores legacy (eventos.js _openAddMovimientoModal +
--                                api.js getEventoTransporte embed chofer). Se retira en FASE 4
--                                cuando se desmantele la Logística de movimientos. NO dropear ahora.
--
-- Cuando Fede confirme + haya backup (tools/vps/backup-supabase.sh):
-- DROP TABLE IF EXISTS rrhh_vacaciones_solicitudes;
-- DROP TABLE IF EXISTS rrhh_vacaciones;
-- DROP TABLE IF EXISTS rrhh_asignaciones;
-- (rrhh_personal queda hasta Fase 4.)
