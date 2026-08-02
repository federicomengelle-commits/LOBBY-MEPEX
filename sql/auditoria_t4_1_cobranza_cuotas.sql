-- ═══════════════════════════════════════════════════════════════════════════
-- AUDITORÍA 2026-07-31 · T4.1 (C3+C4) — cobranza ↔ cuotas: una sola fuente
-- de verdad para `monto_cobrado` (el trigger), con backfill previo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- LOS DOS BUGS (van juntos A PROPÓSITO — gate del tracker):
--
--  · C3: el recibo de cobranza arma las aplicaciones solo con comprobante_id,
--    sin plan_cobro_item_id → fn_sync_cuota_desde_aplicacion corta en la
--    primera línea y la cuota queda `pendiente` con la plata ya adentro.
--  · C4: el camino legacy (registrarCobro con syncPlanItem) hace un
--    read-modify-write INCREMENTAL de monto_cobrado sin dejar fila en
--    cobro_aplicaciones. El trigger escribe la MISMA columna con semántica
--    ABSOLUTA (SUM de aplicaciones vivas). Arreglar C3 solo ceba la bomba:
--    la primera aplicación real sobre una cuota cobrada por el camino viejo
--    hace que el trigger recalcule desde cero y BORRE lo cobrado.
--
-- ESTE ARCHIVO (la parte SQL; el JS va en el mismo commit):
--  A. `cobro_aplicaciones.comprobante_id` pasa a NULLABLE — una cuota sin
--     factura (p.ej. la 36241d3e, cobrada como anticipo) también necesita su
--     fila de aplicación. El trigger no usa esa columna (verificado).
--  B. Backfill: para cada cuota con monto_cobrado > 0 y CERO aplicaciones
--     vivas (hoy en prod: exactamente UNA — 36241d3e, $5.000.000, pagada por
--     el ingreso 28fd52c4 confirmado y vivo, relación 1:1 verificada), se
--     inserta la aplicación que el camino legacy nunca dejó. El INSERT
--     dispara el trigger, que recalcula monto_cobrado/estado — y el
--     self-audit ABORTA TODO si algún valor queda distinto del que había
--     (la migración debe ser invisible: mismo monto, mismo estado).
--
-- El lado JS del mismo commit:
--  · api.js registrarCobranza: cada aplicación se reparte entre las cuotas
--    documentadas por esa factura (comprobante_venta_id), por orden (C3).
--  · api.js registrarCobro: el RMW muere; en su lugar inserta la aplicación
--    y deja que el trigger escriba monto_cobrado/estado (C4).
--
-- Idempotente: el ALTER es no-op si ya está nullable; el backfill filtra por
-- "sin aplicaciones vivas" (segunda corrida no encuentra candidatas).

BEGIN;

-- ── A. comprobante_id nullable ──
ALTER TABLE public.cobro_aplicaciones ALTER COLUMN comprobante_id DROP NOT NULL;

-- ── B. Backfill de las cuotas cobradas por el camino legacy ──
-- Foto previa (para el self-audit): cuotas cobradas sin respaldo de aplicaciones.
CREATE TEMP TABLE _t41_pre ON COMMIT DROP AS
SELECT q.id, q.monto_cobrado, q.estado
  FROM public.plan_cobro_items q
 WHERE q._deleted = false
   AND COALESCE(q.monto_cobrado, 0) > 0
   AND NOT EXISTS (SELECT 1 FROM public.cobro_aplicaciones ca
                    WHERE ca.plan_cobro_item_id = q.id AND ca._deleted = false);

-- La aplicación que faltaba: el monto es el monto_cobrado legacy (la verdad
-- que hay que preservar), el ingreso es el que ya apunta a la cuota vía
-- ingresos.plan_cobro_item_id (confirmado y vivo). Si una cuota tuviera MÁS
-- de un ingreso confirmado apuntándole, se insertaría de más y el self-audit
-- de abajo abortaría todo — ese caso requiere reparto a mano.
INSERT INTO public.cobro_aplicaciones
    (ingreso_id, comprobante_id, plan_cobro_item_id, monto_aplicado, notas, created_by)
SELECT i.id,
       i.comprobante_id,          -- NULL si el cobro fue sin factura (anticipo)
       q.id,
       p.monto_cobrado,
       'Backfill T4.1 (auditoría 31/07): cuota cobrada por el camino legacy, sin fila de aplicación',
       i.created_by
  FROM _t41_pre p
  JOIN public.plan_cobro_items q ON q.id = p.id
  JOIN public.ingresos i ON i.plan_cobro_item_id = q.id
       AND i._deleted = false AND i.estado = 'confirmado';

-- ── Self-audit: la migración tiene que ser INVISIBLE ──
DO $$
DECLARE
    v_backfilled INT;
    v_rotas INT;
    v_sin_respaldo INT;
BEGIN
    SELECT count(*) INTO v_backfilled FROM _t41_pre;

    -- 1) Ninguna cuota backfilleada puede haber cambiado de monto_cobrado ni
    --    de estado (el trigger recalculó al insertar; si difiere, la relación
    --    ingreso↔cuota no era 1:1 y hay que mirar a mano).
    SELECT count(*) INTO v_rotas
      FROM _t41_pre p
      JOIN public.plan_cobro_items q ON q.id = p.id
     WHERE q.monto_cobrado IS DISTINCT FROM p.monto_cobrado
        OR q.estado IS DISTINCT FROM p.estado;
    IF v_rotas > 0 THEN
        RAISE EXCEPTION 'T4.1: % cuota(s) cambiaron de monto/estado con el backfill — abortando TODO, revisar a mano', v_rotas;
    END IF;

    -- 2) No puede quedar ninguna cuota cobrada sin aplicación de respaldo
    --    (si el ingreso legacy no existe/está anulado, el JOIN no insertó nada
    --    y ese caso también es revisión manual).
    SELECT count(*) INTO v_sin_respaldo
      FROM public.plan_cobro_items q
     WHERE q._deleted = false AND COALESCE(q.monto_cobrado, 0) > 0
       AND NOT EXISTS (SELECT 1 FROM public.cobro_aplicaciones ca
                        WHERE ca.plan_cobro_item_id = q.id AND ca._deleted = false);
    IF v_sin_respaldo > 0 THEN
        RAISE EXCEPTION 'T4.1: quedan % cuota(s) cobradas sin aplicación de respaldo — abortando TODO', v_sin_respaldo;
    END IF;

    -- 3) La columna quedó nullable
    IF EXISTS (SELECT 1 FROM pg_attribute
                WHERE attrelid = 'public.cobro_aplicaciones'::regclass
                  AND attname = 'comprobante_id' AND attnotnull) THEN
        RAISE EXCEPTION 'T4.1: comprobante_id sigue NOT NULL — abortando';
    END IF;

    RAISE NOTICE 'T4.1 OK: % cuota(s) backfilleadas, monto/estado idénticos, comprobante_id nullable.', v_backfilled;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (si hiciera falta volver):
--   UPDATE cobro_aplicaciones SET _deleted = true
--    WHERE notas LIKE 'Backfill T4.1%';           -- el trigger recalcula solo
--   ALTER TABLE cobro_aplicaciones ALTER COLUMN comprobante_id SET NOT NULL;
--   -- ⚠️ el SET NOT NULL solo si no quedó ninguna fila con NULL (las del
--   --    backfill de cuotas sin factura lo usan).
-- ─────────────────────────────────────────────────────────────────────────────
