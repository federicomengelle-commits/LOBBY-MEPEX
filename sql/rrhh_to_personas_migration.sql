-- =============================================
-- MEPEX — Migración RRHH legacy → personas (Tanda 3.A)
-- Fecha: 2026-05-16
-- =============================================
-- 1. Expande `personas` con columnas que faltaban (vs rrhh_personal):
--    contacto, email, fecha_ingreso, documentacion, cantidad_personas, rol_legacy.
-- 2. Admite tipo='cuadrilla' además de 'interna'/'eventual'.
-- 3. Copia los registros vivos de rrhh_personal → personas manteniendo el mismo id UUID.
--
-- Mapeo:
--   nombre completo "Diego Chiesa"   → nombre='Diego', apellido='Chiesa'
--   tipo='fijo'                      → tipo='interna'
--   tipo='eventual'                  → tipo='eventual'
--   tipo='cuadrilla'                 → tipo='cuadrilla' (ahora válido)
--   rol "Armador" / "Chofer"         → roles_operativos=['armador'|'chofer'] + rol_legacy="Armador"
--   rol "Encargado" / otro           → roles_operativos=[] + rol_legacy="Encargado"
--   estado='activo'                  → activo=TRUE
--
-- IMPORTANTE: si la persona ya existe con el mismo id, ON CONFLICT DO NOTHING
-- para no pisar ediciones manuales.
--
-- La legacy `rrhh_personal` NO se borra — sigue sirviendo mientras
-- rrhh_asignaciones / rrhh_vacaciones la referencien. Migración completa de
-- esas tablas a esquema nuevo queda para otra tanda.
-- =============================================


-- ── 1. Expandir personas con columnas faltantes ──
ALTER TABLE public.personas
    ADD COLUMN IF NOT EXISTS contacto TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS fecha_ingreso DATE,
    ADD COLUMN IF NOT EXISTS documentacion TEXT,
    ADD COLUMN IF NOT EXISTS cantidad_personas INTEGER,
    ADD COLUMN IF NOT EXISTS rol_legacy TEXT;

-- ── 2. Admitir tipo='cuadrilla' ──
-- Drop+recreate del CHECK constraint.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'personas_tipo_check'
    ) THEN
        ALTER TABLE public.personas DROP CONSTRAINT personas_tipo_check;
    END IF;
END $$;

ALTER TABLE public.personas
    ADD CONSTRAINT personas_tipo_check
    CHECK (tipo IN ('interna', 'eventual', 'cuadrilla'));


-- ── 3. Migrar registros de rrhh_personal a personas ──
INSERT INTO public.personas (
    id, nombre, apellido, tipo, roles_operativos, rol_legacy,
    telefono, contacto, email, documentacion, fecha_ingreso,
    cantidad_personas, notas, activo, created_at, _deleted
)
SELECT
    rp.id,
    -- nombre: primera palabra (o todo si no tiene espacio)
    CASE
        WHEN position(' ' IN trim(rp.nombre)) > 0
        THEN split_part(trim(rp.nombre), ' ', 1)
        ELSE trim(rp.nombre)
    END AS nombre,
    -- apellido: resto después del primer espacio (o NULL)
    NULLIF(
        CASE
            WHEN position(' ' IN trim(rp.nombre)) > 0
            THEN substring(trim(rp.nombre) FROM position(' ' IN trim(rp.nombre)) + 1)
            ELSE NULL
        END, ''
    ) AS apellido,
    -- tipo: fijo → interna, sino conservar (eventual/cuadrilla)
    CASE
        WHEN rp.tipo = 'fijo' THEN 'interna'
        WHEN rp.tipo IN ('eventual', 'cuadrilla') THEN rp.tipo
        ELSE 'eventual'
    END AS tipo,
    -- roles_operativos: si el rol legacy coincide con uno de los canónicos
    -- (armador/chofer/ayudante/tecnico/azafata), se agrega al array. Sino,
    -- queda vacío pero se preserva el rol original en rol_legacy.
    CASE
        WHEN rp.rol IS NULL OR trim(rp.rol) = '' THEN ARRAY[]::TEXT[]
        WHEN lower(trim(rp.rol)) IN ('armador', 'chofer', 'ayudante', 'tecnico', 'técnico', 'azafata')
            THEN ARRAY[
                CASE WHEN lower(trim(rp.rol)) = 'técnico' THEN 'tecnico'
                     ELSE lower(trim(rp.rol)) END
            ]
        ELSE ARRAY[]::TEXT[]
    END AS roles_operativos,
    rp.rol AS rol_legacy,
    rp.telefono,
    rp.contacto,
    rp.email,
    rp.documentacion,
    rp.fecha_ingreso,
    rp.cantidad_personas,
    rp.notas,
    COALESCE(rp.estado = 'activo', TRUE) AS activo,
    rp.created_at,
    COALESCE(rp._deleted, FALSE) AS _deleted
FROM public.rrhh_personal rp
WHERE rp._deleted = FALSE
ON CONFLICT (id) DO NOTHING;


-- ── 4. Verificación ──
-- Devuelve cuántas personas hay ahora en cada tabla.
-- SELECT
--     (SELECT count(*) FROM rrhh_personal WHERE _deleted = FALSE) AS rrhh_personal_count,
--     (SELECT count(*) FROM personas WHERE _deleted = FALSE) AS personas_count;
