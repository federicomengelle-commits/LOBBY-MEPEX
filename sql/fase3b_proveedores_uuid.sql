-- ============================================================
-- FASE 3b — Unificación de proveedores a UUID (tabla única `proveedor`)
-- ============================================================
-- Hoy conviven 3 representaciones:
--   · proveedor            (UUID)  ← canónica; la usan egresos/comprobantes_recibidos/Costos
--   · compras_proveedores  (BIGINT) ← la de Compras, con campos ricos (razón social,
--                                      contacto, tel, email, calificaciones)
--   · proveedor-en-texto   (insumos_base.proveedor, comprobantes_recibidos.proveedor_nombre,
--                            egresos.destinatario)
-- compras_ordenes/compras_oc_presupuestos/compras_pagos referencian compras_proveedores (BIGINT).
--
-- META: `proveedor` (UUID) = tabla única. Se le suman los campos ricos, se backfillea
-- desde compras_proveedores (dedup por nombre), y las OCs ganan una FK UUID real.
--
-- ⚠️ ADITIVA Y REVERSIBLE: NO dropea columnas ni la tabla vieja. El proveedor_id BIGINT
-- de Compras queda como está; se agrega proveedor_uuid en paralelo. El DROP de lo viejo
-- se hace DESPUÉS, con el código ya switcheado y verificado (DROP_CHECKLIST.md).
-- Idempotente (IF NOT EXISTS / NOT EXISTS). Correr en Supabase. Pegar el output de §4.
-- ============================================================

-- ── 1. Enriquecer `proveedor` con los campos de compras_proveedores ──
ALTER TABLE proveedor
  ADD COLUMN IF NOT EXISTS razon_social        TEXT,
  ADD COLUMN IF NOT EXISTS contacto            TEXT,
  ADD COLUMN IF NOT EXISTS telefono            TEXT,
  ADD COLUMN IF NOT EXISTS email               TEXT,
  ADD COLUMN IF NOT EXISTS calif_cumplimiento  INT,
  ADD COLUMN IF NOT EXISTS calif_calidad       INT,
  ADD COLUMN IF NOT EXISTS calif_precio        INT,
  ADD COLUMN IF NOT EXISTS notas               TEXT,
  ADD COLUMN IF NOT EXISTS compras_proveedor_id BIGINT;  -- traza al origen BIGINT (mapping)

CREATE INDEX IF NOT EXISTS idx_proveedor_compras_pid ON proveedor(compras_proveedor_id);

-- ── 2. Backfill compras_proveedores → proveedor (dedup por nombre normalizado) ──
-- 2a. Linkear los que YA existen en proveedor por nombre (mergea campos ricos sin pisar)
UPDATE proveedor p SET
    compras_proveedor_id = cp.id,
    razon_social       = COALESCE(p.razon_social, cp.razon_social),
    contacto           = COALESCE(p.contacto, cp.contacto),
    telefono           = COALESCE(p.telefono, cp.telefono),
    email              = COALESCE(p.email, cp.email),
    calif_cumplimiento = COALESCE(p.calif_cumplimiento, cp.calif_cumplimiento),
    calif_calidad      = COALESCE(p.calif_calidad, cp.calif_calidad),
    calif_precio       = COALESCE(p.calif_precio, cp.calif_precio),
    notas              = COALESCE(p.notas, cp.notas)
FROM compras_proveedores cp
WHERE cp._deleted = false AND p._deleted = false
  AND p.compras_proveedor_id IS NULL
  AND lower(trim(p.nombre)) = lower(trim(cp.nombre));

-- 2b. Crear proveedor para los compras_proveedores que NO matchearon ninguno
INSERT INTO proveedor (nombre, razon_social, rubro, contacto, telefono, email,
                       calif_cumplimiento, calif_calidad, calif_precio, notas,
                       compras_proveedor_id, _deleted)
SELECT cp.nombre, cp.razon_social, cp.rubro, cp.contacto, cp.telefono, cp.email,
       cp.calif_cumplimiento, cp.calif_calidad, cp.calif_precio, cp.notas,
       cp.id, false
FROM compras_proveedores cp
WHERE cp._deleted = false
  AND NOT EXISTS (SELECT 1 FROM proveedor p WHERE p.compras_proveedor_id = cp.id);

-- ── 3. FK UUID en las OCs (en paralelo al proveedor_id BIGINT, sin pisarlo) ──
ALTER TABLE compras_ordenes        ADD COLUMN IF NOT EXISTS proveedor_uuid UUID REFERENCES proveedor(id);
ALTER TABLE compras_oc_presupuestos ADD COLUMN IF NOT EXISTS proveedor_uuid UUID REFERENCES proveedor(id);

UPDATE compras_ordenes oc SET proveedor_uuid = p.id
FROM proveedor p
WHERE p.compras_proveedor_id = oc.proveedor_id AND oc.proveedor_uuid IS NULL;

UPDATE compras_oc_presupuestos pr SET proveedor_uuid = p.id
FROM proveedor p
WHERE p.compras_proveedor_id = pr.proveedor_id AND pr.proveedor_uuid IS NULL;

-- ── 4. VERIFICACIÓN (read-only; pegar el output) ──
SELECT 'resumen' AS bloque, jsonb_build_object(
  'compras_proveedores_vivos', (SELECT count(*) FROM compras_proveedores WHERE _deleted=false),
  'proveedor_vivos',           (SELECT count(*) FROM proveedor WHERE _deleted=false),
  'proveedor_con_origen_compras',(SELECT count(*) FROM proveedor WHERE compras_proveedor_id IS NOT NULL),
  'OCs_total',                 (SELECT count(*) FROM compras_ordenes WHERE _deleted=false),
  'OCs_con_uuid',              (SELECT count(*) FROM compras_ordenes WHERE _deleted=false AND proveedor_uuid IS NOT NULL),
  'OCs_con_proveedor_id_sin_uuid',(SELECT count(*) FROM compras_ordenes WHERE _deleted=false AND proveedor_id IS NOT NULL AND proveedor_uuid IS NULL)
) AS detalle
UNION ALL
-- Posibles duplicados por nombre similar (revisar a ojo; mergear manual si hace falta)
SELECT 'posibles_duplicados_por_nombre', jsonb_agg(t) FROM (
  SELECT lower(trim(nombre)) AS nombre_norm, count(*) AS n,
         jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'origen_compras',compras_proveedor_id)) AS filas
  FROM proveedor WHERE _deleted=false
  GROUP BY lower(trim(nombre)) HAVING count(*) > 1
) t;

-- ============================================================
-- DESPUÉS (NO ahora — cuando el código de Compras ya use proveedor_uuid y esté verificado):
--   · compras_ordenes/compras_oc_presupuestos: drop proveedor_id (BIGINT)
--   · drop table compras_proveedores, compras_pagos (código muerto)
--   Registrar en docs/DROP_CHECKLIST.md.
-- ============================================================
