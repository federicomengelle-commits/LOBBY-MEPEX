-- ═══════════════════════════════════════════════════════════════
-- FASE 1 — Unificación de PKs a UUID + saneamiento de FKs
-- ═══════════════════════════════════════════════════════════════
-- Branch: rediseno-modulos
-- Pre-requisito: backup de la DB hecho en Supabase
-- Ejecutar en: Supabase SQL Editor (copiar TODO y Run)
--
-- Decisiones aplicadas (ver AUDIT_DATA_VIVA.md y AUDIT_EVENTOS_LOGISTICA_RRHH.md):
--   1. Eliminar evento_equipo (el equipo se modela en rrhh_asignaciones).
--   2. Eliminar evento_transporte (el transporte se modela en logistica_movimientos).
--   3. Migrar PKs de logistica y rrhh a UUID.
--   4. Normalizar chofer: FK opcional a rrhh_personal en vehículos y movimientos.
--
-- NO toca: eventos, proyectos, profiles, clientes, evento_documentos,
-- evento_historial, predios.
--
-- NOTA sobre RLS: este script NO recrea RLS policies. Después de COMMIT,
-- correr el bloque RLS apropiado (los nombres de tablas son los mismos,
-- así que las policies anteriores pueden replicarse). Sin RLS, las
-- INSERT/UPDATE de la app fallarán con "row-level security policy".
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Cleanup pre-migración ──────────────────────────────────
-- Borra la única asignación de RRHH, que es huérfana
-- (apunta a un evento que ya no existe).
DELETE FROM rrhh_asignaciones;

-- ─── 2. DROP de tablas a recrear desde cero ────────────────────
-- Eliminadas por decisión de modelo: usamos rrhh_asignaciones y logistica_movimientos.
DROP TABLE IF EXISTS evento_equipo CASCADE;
DROP TABLE IF EXISTS evento_transporte CASCADE;

-- Vacías y con PK BIGSERIAL incompatible. Recreamos con UUID.
DROP TABLE IF EXISTS logistica_remito CASCADE;
DROP TABLE IF EXISTS logistica_movimientos CASCADE;
DROP TABLE IF EXISTS logistica_vehiculos CASCADE;
DROP TABLE IF EXISTS rrhh_vacaciones_solicitudes CASCADE;
DROP TABLE IF EXISTS rrhh_asignaciones CASCADE;

-- ─── 3. Migración PK rrhh_personal: BIGINT → UUID ──────────────
-- 1 sola fila viva (Diego). Patrón: rescatar fila, recrear tabla, reinsertar.

-- 3.1 Snapshot de Diego en tabla temporal
CREATE TEMP TABLE _tmp_diego AS
SELECT * FROM rrhh_personal WHERE _deleted = false;

-- 3.2 Drop tabla original (rrhh_vacaciones depende, ya fue dropeada arriba? NO,
--     rrhh_vacaciones NO se dropea, solo se la limpia y reinserta. Antes de eso,
--     hay que rescatar también las vacaciones de Diego).
CREATE TEMP TABLE _tmp_vacaciones_diego AS
SELECT * FROM rrhh_vacaciones WHERE _deleted = false;

-- 3.3 Drop rrhh_vacaciones (tiene FK a rrhh_personal, hay que rehacerla)
DROP TABLE IF EXISTS rrhh_vacaciones CASCADE;

-- 3.4 Drop y recreate rrhh_personal con UUID
DROP TABLE IF EXISTS rrhh_personal CASCADE;

CREATE TABLE rrhh_personal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    rol text,
    tipo text CHECK (tipo IN ('fijo','eventual','cuadrilla')),
    cantidad_personas integer,
    contacto text,
    telefono text,
    email text,
    fecha_ingreso date,
    estado text CHECK (estado IN ('activo','inactivo')) DEFAULT 'activo',
    documentacion text,
    notas text,
    _deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.5 Reinsertar Diego con UUID nuevo, capturar el ID generado para reusar
WITH diego_insertado AS (
    INSERT INTO rrhh_personal (
        nombre, rol, tipo, cantidad_personas, contacto, telefono, email,
        fecha_ingreso, estado, documentacion, notas, created_at
    )
    SELECT
        nombre, rol, tipo, cantidad_personas, contacto, telefono, email,
        fecha_ingreso, estado, documentacion, notas, created_at
    FROM _tmp_diego
    RETURNING id
)
-- Guardamos su id nuevo para usarlo en rrhh_vacaciones
SELECT id AS diego_uuid INTO TEMP _tmp_diego_uuid FROM diego_insertado;

-- ─── 4. Recrear rrhh_vacaciones con UUID ───────────────────────
CREATE TABLE rrhh_vacaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id uuid NOT NULL REFERENCES rrhh_personal(id) ON DELETE CASCADE,
    dias_totales integer NOT NULL DEFAULT 0,
    dias_usados integer NOT NULL DEFAULT 0,
    _deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Reinsertar la fila de Diego (28 días totales, 0 usados) con su nuevo UUID
INSERT INTO rrhh_vacaciones (personal_id, dias_totales, dias_usados, created_at)
SELECT
    (SELECT diego_uuid FROM _tmp_diego_uuid),
    v.dias_totales,
    v.dias_usados,
    v.created_at
FROM _tmp_vacaciones_diego v;

-- ─── 5. Recrear rrhh_asignaciones con UUID + FKs sanas ─────────
CREATE TABLE rrhh_asignaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id uuid NOT NULL REFERENCES rrhh_personal(id) ON DELETE CASCADE,
    evento_id uuid REFERENCES eventos(id) ON DELETE CASCADE,
    proyecto_id uuid REFERENCES proyectos(id) ON DELETE CASCADE,
    rol_evento text,
    fecha_desde date,
    fecha_hasta date,
    notas text,
    _deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CHECK (evento_id IS NOT NULL OR proyecto_id IS NOT NULL)
);

CREATE INDEX idx_rrhh_asignaciones_personal ON rrhh_asignaciones(personal_id) WHERE _deleted = false;
CREATE INDEX idx_rrhh_asignaciones_evento ON rrhh_asignaciones(evento_id) WHERE _deleted = false;
CREATE INDEX idx_rrhh_asignaciones_proyecto ON rrhh_asignaciones(proyecto_id) WHERE _deleted = false;

-- ─── 6. Recrear rrhh_vacaciones_solicitudes con UUID ───────────
CREATE TABLE rrhh_vacaciones_solicitudes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id uuid NOT NULL REFERENCES rrhh_personal(id) ON DELETE CASCADE,
    fecha_desde date NOT NULL,
    fecha_hasta date NOT NULL,
    estado text CHECK (estado IN ('pendiente','aprobada','rechazada')) DEFAULT 'pendiente',
    notas text,
    _deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ─── 7. Recrear logistica_vehiculos con UUID + chofer_habitual ─
CREATE TABLE logistica_vehiculos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    tipo text CHECK (tipo IN ('propio','tercero')) DEFAULT 'propio',
    patente text,
    chofer_habitual_id uuid REFERENCES rrhh_personal(id) ON DELETE SET NULL,
    contacto text,  -- texto libre para vehículos de tercero (cuando chofer_habitual_id es NULL)
    vtv_vencimiento date,
    seguro_vencimiento date,
    ultimo_service date,
    estado text CHECK (estado IN ('disponible','en_uso','en_service','baja')) DEFAULT 'disponible',
    notas text,
    _deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_logistica_vehiculos_chofer ON logistica_vehiculos(chofer_habitual_id) WHERE _deleted = false;

-- ─── 8. Recrear logistica_movimientos con UUID + FKs reales ────
CREATE TABLE logistica_movimientos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id uuid REFERENCES eventos(id) ON DELETE SET NULL,
    proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,
    vehiculo_id uuid REFERENCES logistica_vehiculos(id) ON DELETE SET NULL,
    chofer_id uuid REFERENCES rrhh_personal(id) ON DELETE SET NULL,
    chofer_nombre_libre text,  -- texto libre cuando chofer_id es NULL (terceros)
    origen text NOT NULL,
    destino text NOT NULL,
    fecha date,
    hora_programada text,
    check_salida timestamptz,
    check_llegada timestamptz,
    check_descarga timestamptz,
    check_retorno timestamptz,
    estado text,
    notas text,
    _deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_logistica_movimientos_evento ON logistica_movimientos(evento_id) WHERE _deleted = false;
CREATE INDEX idx_logistica_movimientos_vehiculo ON logistica_movimientos(vehiculo_id) WHERE _deleted = false;
CREATE INDEX idx_logistica_movimientos_chofer ON logistica_movimientos(chofer_id) WHERE _deleted = false;

-- ─── 9. Recrear logistica_remito con UUID ──────────────────────
CREATE TABLE logistica_remito (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    movimiento_id uuid NOT NULL REFERENCES logistica_movimientos(id) ON DELETE CASCADE,
    item_nombre text NOT NULL,
    cantidad numeric,
    notas text,
    _deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_logistica_remito_movimiento ON logistica_remito(movimiento_id) WHERE _deleted = false;

-- ─── 10. Cleanup de tablas temporales ──────────────────────────
DROP TABLE _tmp_diego;
DROP TABLE _tmp_vacaciones_diego;
DROP TABLE _tmp_diego_uuid;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-MIGRACIÓN — correr aparte después del COMMIT
-- ═══════════════════════════════════════════════════════════════
-- Ejecutar estas queries y verificar:
--   - rrhh_personal: 1 fila (Diego), id es UUID
--   - rrhh_vacaciones: 1 fila (28/0), personal_id matchea Diego
--   - rrhh_asignaciones: 0 filas
--   - logistica_vehiculos / movimientos / remito: 0 filas
--   - rrhh_vacaciones_solicitudes: 0 filas
--   - todas las tablas con id tipo uuid (no bigint)

-- SELECT COUNT(*), pg_typeof(id) FROM rrhh_personal GROUP BY pg_typeof(id);
-- SELECT COUNT(*), pg_typeof(id) FROM rrhh_vacaciones GROUP BY pg_typeof(id);
-- SELECT COUNT(*), pg_typeof(id) FROM rrhh_asignaciones GROUP BY pg_typeof(id);
-- SELECT COUNT(*), pg_typeof(id) FROM logistica_vehiculos GROUP BY pg_typeof(id);
-- SELECT COUNT(*), pg_typeof(id) FROM logistica_movimientos GROUP BY pg_typeof(id);
-- SELECT COUNT(*), pg_typeof(id) FROM logistica_remito GROUP BY pg_typeof(id);
