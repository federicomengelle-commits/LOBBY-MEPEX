-- =============================================
-- Notificaciones operativas — triggers + flag (2026-07-04)
-- Llena los gaps de la matriz evento→rol de la capa operativa (handoff
-- docs/handoff-capa-operativa-pulido-notificaciones.md §FRENTE 3).
-- Ruteo confirmado por Fede:
--   · Stock que cruza el mínimo (al moverse)     → push admin        [#4]
--   · Equipo fuera de servicio / en reparación    → push admin+taller [#2]
--   · Pago a proveedor recién vencido             → push admin        [#5]
-- Todo idempotente. Los pushes van a la tabla `notifications` (misma que usa
-- la campana). Patrón calcado del trigger de encuesta (sql/encuesta_proyecto.sql):
-- una fila de notif por rol destino, SIN SECURITY DEFINER.
-- ⚠️ entidad_id de notifications es UUID:
--   · equipos.id      = uuid  → se setea.
--   · insumos_base.id = bigint → se OMITE (link basta).
--   · compras_pagos.id= bigint → se OMITE.
-- =============================================


-- ─────────────────────────────────────────────
-- #4 · Stock que cruza el mínimo → push admin
-- ⚠️ SUPERADA por sql/auditoria_t3_9_stock_bajo_taller.sql (T3.9/A32):
--    la versión en prod inserta DOS filas (admin + taller). Este INSERT único
--    ya NO refleja prod — no copiar de acá.
-- Dispara SÓLO en el cruce hacia abajo (antes ≥ mínimo, ahora < mínimo), así
-- un insumo que ya estaba bajo no re-notifica en cada salida. La alerta pasiva
-- (puntito) sigue existiendo aparte en alertas.js; esto es el ping inmediato.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_notif_stock_minimo_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.stock_minimo IS NULL OR NEW.stock IS NULL THEN RETURN NEW; END IF;
    IF NEW.stock < NEW.stock_minimo
       AND (OLD.stock IS NULL OR OLD.stock >= NEW.stock_minimo) THEN
        INSERT INTO public.notifications (tipo, titulo, mensaje, target_role, entidad_tipo, link, prioridad)
        VALUES (
            'stock_minimo',
            'Stock bajo el mínimo',
            COALESCE(NEW.nombre, 'Un insumo') || ' quedó en ' || NEW.stock || ' (mínimo ' || NEW.stock_minimo || ')',
            'admin', 'insumo', '#inventario', 'alta'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notif_stock_minimo ON public.insumos_base;
CREATE TRIGGER trg_notif_stock_minimo
    AFTER UPDATE OF stock ON public.insumos_base
    FOR EACH ROW EXECUTE FUNCTION public.trg_notif_stock_minimo_fn();


-- ─────────────────────────────────────────────
-- #2 · Equipo fuera de servicio / en reparación → push admin + taller
-- Dispara al TRANSICIONAR a esos estados (no en cada re-guardado). Complementa
-- la alerta pasiva `equipos` de alertas.js (admin+taller).
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_notif_equipo_estado_fn()
RETURNS TRIGGER AS $$
DECLARE
    v_estado_label TEXT;
    v_titulo TEXT;
    v_msg TEXT;
BEGIN
    IF OLD.estado IS NOT DISTINCT FROM NEW.estado THEN RETURN NEW; END IF;
    IF NEW.estado NOT IN ('fuera_de_servicio', 'en_reparacion') THEN RETURN NEW; END IF;

    v_estado_label := CASE NEW.estado
        WHEN 'fuera_de_servicio' THEN 'fuera de servicio'
        ELSE 'en reparación' END;
    v_titulo := 'Equipo ' || v_estado_label;
    v_msg := COALESCE(NEW.nombre, 'Un equipo') || ' quedó ' || v_estado_label || '.';

    -- Admin
    INSERT INTO public.notifications (tipo, titulo, mensaje, target_role, entidad_tipo, entidad_id, link, prioridad)
    VALUES ('equipo_fuera_servicio', v_titulo, v_msg, 'admin', 'equipo', NEW.id, '#inventario',
            CASE WHEN NEW.estado = 'fuera_de_servicio' THEN 'alta' ELSE 'normal' END);
    -- Taller (lo usan)
    INSERT INTO public.notifications (tipo, titulo, mensaje, target_role, entidad_tipo, entidad_id, link, prioridad)
    VALUES ('equipo_fuera_servicio', v_titulo, v_msg, 'taller', 'equipo', NEW.id, '#inventario',
            CASE WHEN NEW.estado = 'fuera_de_servicio' THEN 'alta' ELSE 'normal' END);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notif_equipo_estado ON public.equipos;
CREATE TRIGGER trg_notif_equipo_estado
    AFTER UPDATE OF estado ON public.equipos
    FOR EACH ROW EXECUTE FUNCTION public.trg_notif_equipo_estado_fn();


-- ─────────────────────────────────────────────
-- #5 · Pago a proveedor vencido → push admin (una sola vez)
-- Condición por TIEMPO (no hay evento de cambio), así que el push lo emite el
-- cliente (API.notifyPagosVencidos, llamado desde alertas.js/compras). Esta
-- columna es el flag de dedup race-safe: el UPDATE...RETURNING claimea la fila.
-- El backfill marca los ya-vencidos como "ya avisados" para no spamear en el
-- primer refresh tras el deploy (sólo notifica cruces NUEVOS de acá en más).
-- ─────────────────────────────────────────────
ALTER TABLE public.compras_pagos
    ADD COLUMN IF NOT EXISTS notif_vencido_at timestamptz;

UPDATE public.compras_pagos
   SET notif_vencido_at = now()
 WHERE notif_vencido_at IS NULL
   AND _deleted = false
   AND estado = 'pendiente'
   AND fecha_vencimiento < CURRENT_DATE;

-- ─── Fin: notificaciones operativas ───
