-- ═══════════════════════════════════════════════════════════════════
-- Migración: pipeline de cotizaciones a 5 estados limpios
--   borrador, enviada, en_negociacion, aprobada, rechazada
--
-- Mapeo de estados viejos → nuevos:
--   vista             → enviada
--   cerrada_ganada    → aprobada
--   cerrada_perdida   → rechazada
--   facturada         → aprobada  (la facturación se infiere de pyme_venta_id)
--
-- Idempotente: re-ejecutable sin efectos.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Drop CHECK constraint viejo PRIMERO
-- (si dejamos para después, el UPDATE del paso 2 falla porque
--  intenta escribir 'rechazada', que el constraint viejo no permite)
ALTER TABLE public.cotizaciones
DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;

-- 2. Migrar valores existentes a los nuevos estados
UPDATE public.cotizaciones
SET estado = CASE estado
    WHEN 'vista' THEN 'enviada'
    WHEN 'cerrada_ganada' THEN 'aprobada'
    WHEN 'cerrada_perdida' THEN 'rechazada'
    WHEN 'facturada' THEN 'aprobada'
    ELSE estado
END
WHERE estado IN ('vista', 'cerrada_ganada', 'cerrada_perdida', 'facturada');

-- 3. Crear CHECK constraint nuevo (5 estados)
ALTER TABLE public.cotizaciones
ADD CONSTRAINT cotizaciones_estado_check
CHECK (estado IN ('borrador', 'enviada', 'en_negociacion', 'aprobada', 'rechazada'));

-- 4. Verificación: distribución actual
SELECT estado, COUNT(*) AS total FROM public.cotizaciones GROUP BY estado ORDER BY estado;

COMMIT;
