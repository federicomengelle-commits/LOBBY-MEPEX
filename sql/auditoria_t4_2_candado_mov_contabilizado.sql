-- ═══════════════════════════════════════════════════════════════════════════
-- AUDITORÍA 2026-07-31 · T4.2 (C2) — candado sobre movimientos ya contabilizados
-- ═══════════════════════════════════════════════════════════════════════════
--
-- EL BUG (ya consumado en prod): los triggers de asiento disparan SOLO en
-- `UPDATE OF estado`. Editar monto/fecha/canal/medio/cuenta/categoría de un
-- movimiento que YA tiene asiento no toca ese asiento → Finanzas y
-- Contabilidad divergen en silencio. Caso real: egreso de $486.420 editado
-- 61 segundos después de crearse → el egreso quedó en 2026-07 y su asiento
-- #41 en 2026-04 (abril sobrestima gastos, julio los subestima, y es la
-- causa del saldo imposible de 1.1.02 Caja Oficina en −$486.420).
-- Y NINGÚN trigger observaba `_deleted`: borrar (soft) un movimiento pagado
-- lo saca de la lista pero su asiento sigue vivo descontando el saldo.
--
-- EL CANDADO (la red de fondo; la cara de UI va en finanzas.js, mismo commit):
-- BEFORE UPDATE en `ingresos` y `egresos`. Si el movimiento tiene un asiento
-- VIVO apuntándole, se rechazan:
--   · cambios de monto · fecha · canal · medio · cuenta_id · moneda ·
--     cotizacion · categoria (egresos — ingresos no tiene esa columna)
--     → todos alimentan el asiento (fecha/monto/canal directo; medio rutea
--       cheques a 1.1.07/2.1.07; categoría elige la cuenta del mapeo;
--       moneda+cotización definen total_en_ars, que es lo que se postea)
--   · `_deleted` false→true (el soft-delete que dejaba asientos huérfanos)
--   · cambios de `estado`, SALVO la única salida con traza:
--     confirmado|pagado → anulado (dispara el contra-asiento de
--     fn_revertir_asiento_*). Verificado contra prod: la reversión SOLO
--     existe para →anulado; p.ej. confirmado→pendiente dejaría el asiento
--     vivo, y anulado→confirmado→anulado rompería el anti-doble de la
--     reversión (la 2ª anulación no genera contra-asiento).
--
-- LO QUE NO BLOQUEA (verificado contra TODOS los writers del repo):
--   · concepto / notas / subcategoria / destinatario / imputación
--     (proyecto_id, cliente_id, proveedor_id, evento_id) — no viven en el
--     asiento; re-imputar es legítimo. El inline-edit de Concepto sigue.
--   · anular (finanzas.js:3221/4167, api.js:8106) — estado → anulado. ✓
--   · confirmar cobranza (api.js:7133, pendiente→confirmado) — en ese
--     momento AÚN no hay asiento (se crea AFTER ese mismo update). ✓
--   · restaurar (_deleted true→false) — vuelve a poner la fila en sync con
--     su asiento vivo; bloquearlo trabaría el undo sin ganar nada.
--   · todo movimiento SIN asiento (pendiente/programado, o legacy
--     pre-mapeo-default) — editable como siempre.
--
-- SECURITY DEFINER a propósito: el EXISTS lee `asientos`, cuya RLS es de
-- contabilidad — si corriera como invoker, un rol de finanzas sin lectura de
-- asientos vería EXISTS=false y el candado se APAGARÍA en silencio para él.
-- Con search_path fijo (regla T0.12) y sin llamadas a extensions.
-- (El REVOKE a anon es por convención T0.1 — una trigger function no es
-- invocable por PostgREST, pero que nazca cerrada.)
--
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS + self-audit.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_candado_mov_contabilizado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_cambia_datos BOOLEAN;
    v_cambia_estado_ilegal BOOLEAN;
    v_borra BOOLEAN;
    v_numero BIGINT;
BEGIN
    -- ¿Cambió algo de lo que alimenta el asiento?
    v_cambia_datos :=
           OLD.monto      IS DISTINCT FROM NEW.monto
        OR OLD.fecha      IS DISTINCT FROM NEW.fecha
        OR OLD.canal      IS DISTINCT FROM NEW.canal
        OR OLD.medio      IS DISTINCT FROM NEW.medio
        OR OLD.cuenta_id  IS DISTINCT FROM NEW.cuenta_id
        OR OLD.moneda     IS DISTINCT FROM NEW.moneda
        OR OLD.cotizacion IS DISTINCT FROM NEW.cotizacion;
    IF TG_TABLE_NAME = 'egresos' THEN
        -- Solo egresos tiene `categoria` (el mapeo de ingresos va por el
        -- servicio del comprobante). La rama no se evalúa en ingresos.
        v_cambia_datos := v_cambia_datos OR (OLD.categoria IS DISTINCT FROM NEW.categoria);
    END IF;

    -- Soft-delete de un movimiento contabilizado (false→true). true→false pasa.
    v_borra := (NEW._deleted AND NOT COALESCE(OLD._deleted, false));

    -- Cambio de estado que NO es la salida con traza (→ anulado desde final)
    v_cambia_estado_ilegal :=
        (OLD.estado IS DISTINCT FROM NEW.estado)
        AND NOT (NEW.estado = 'anulado' AND OLD.estado IN ('confirmado', 'pagado'));

    IF NOT (v_cambia_datos OR v_borra OR v_cambia_estado_ilegal) THEN
        RETURN NEW;
    END IF;

    -- Recién acá se paga el lookup: ¿hay asiento vivo apuntando a esta fila?
    IF TG_TABLE_NAME = 'ingresos' THEN
        SELECT numero INTO v_numero FROM public.asientos
         WHERE ingreso_id = OLD.id AND _deleted = false
         ORDER BY numero LIMIT 1;
    ELSE
        SELECT numero INTO v_numero FROM public.asientos
         WHERE egreso_id = OLD.id AND _deleted = false
         ORDER BY numero LIMIT 1;
    END IF;
    IF v_numero IS NULL THEN
        RETURN NEW;   -- sin asiento no hay nada que desincronizar
    END IF;

    IF v_borra THEN
        RAISE EXCEPTION 'Este movimiento ya está contabilizado (asiento #%): eliminarlo dejaría el asiento huérfano descontando el saldo. Usá Anular, que genera el contra-asiento con traza.', v_numero;
    ELSIF v_cambia_estado_ilegal THEN
        RAISE EXCEPTION 'Este movimiento ya está contabilizado (asiento #%): el único cambio de estado permitido es Anular (genera contra-asiento). Para rehacerlo: Anular y cargarlo de nuevo.', v_numero;
    ELSE
        RAISE EXCEPTION 'Este movimiento ya está contabilizado (asiento #%): monto, fecha, canal, medio, cuenta, moneda y categoría quedan bloqueados (el asiento no se actualiza solo — ya pasó con un egreso de $486.420). Para corregirlos: Anular y cargarlo de nuevo.', v_numero;
    END IF;
END;
$function$;

-- (authenticated incluido por higiene — una trigger function no es invocable
--  igual, revienta sin OLD/NEW; convención T0.1 ampliada)
REVOKE ALL ON FUNCTION public.fn_candado_mov_contabilizado() FROM PUBLIC, anon, authenticated;

-- Nota: si algún día un writer re-vincula `comprobante_id` de un movimiento
-- ya contabilizado, sumarlo a v_cambia_datos (hoy no existe ninguno; el FK no
-- reabre el asiento posteado, pero desacoplaría comprobante↔asiento).
--
-- El nombre arranca con 'trg_a…' < 'trg_snapshot…': los BEFORE corren en
-- orden alfabético → el candado rechaza primero (fail-fast; la corrección no
-- depende del orden — una excepción BEFORE aborta la sentencia entera).
DROP TRIGGER IF EXISTS trg_a_candado_contable_ingresos ON public.ingresos;
CREATE TRIGGER trg_a_candado_contable_ingresos
    BEFORE UPDATE ON public.ingresos
    FOR EACH ROW EXECUTE FUNCTION public.fn_candado_mov_contabilizado();

DROP TRIGGER IF EXISTS trg_a_candado_contable_egresos ON public.egresos;
CREATE TRIGGER trg_a_candado_contable_egresos
    BEFORE UPDATE ON public.egresos
    FOR EACH ROW EXECUTE FUNCTION public.fn_candado_mov_contabilizado();

-- ── Self-audit: si no quedó exactamente como se espera, abortar todo ──
DO $$
DECLARE
    v_def TEXT;
    v_trigs INT;
BEGIN
    SELECT pg_get_functiondef(p.oid) INTO v_def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'fn_candado_mov_contabilizado';
    IF v_def IS NULL THEN
        RAISE EXCEPTION 'T4.2: fn_candado_mov_contabilizado no existe — abortando';
    END IF;
    IF v_def NOT ILIKE '%SECURITY DEFINER%' OR v_def NOT ILIKE '%search_path%' THEN
        RAISE EXCEPTION 'T4.2: la función quedó sin SECURITY DEFINER o sin search_path — abortando';
    END IF;

    SELECT count(*) INTO v_trigs
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND t.tgname IN ('trg_a_candado_contable_ingresos', 'trg_a_candado_contable_egresos')
       AND c.relname IN ('ingresos', 'egresos')
       AND NOT t.tgisinternal AND t.tgenabled <> 'D';
    IF v_trigs <> 2 THEN
        RAISE EXCEPTION 'T4.2: se esperaban 2 triggers habilitados y hay % — abortando', v_trigs;
    END IF;

    RAISE NOTICE 'T4.2 OK: candado contable activo en ingresos y egresos.';
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (si hiciera falta volver):
--   DROP TRIGGER IF EXISTS trg_a_candado_contable_ingresos ON public.ingresos;
--   DROP TRIGGER IF EXISTS trg_a_candado_contable_egresos  ON public.egresos;
--   DROP FUNCTION IF EXISTS public.fn_candado_mov_contabilizado();
-- No hay datos que revertir: el candado solo rechaza updates futuros.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⛔ NO EJECUTADO — reparación del caso consumado (decisión de Fede, es tocar
--    el libro diario): el asiento #41 quedó fechado 2026-04-24 mientras su
--    egreso ($486.420, CANEPA/SAENZ) fue corregido a 2026-07-03. La fecha
--    buena es la del egreso (la corrección humana fue 61 s después de crearlo).
--    El arreglo mueve el asiento a 2026-07-03; trg_saldos_asiento_cabecera
--    recalcula ambos períodos y desaparece el −$486.420 de abril en 1.1.02.
--
--    UPDATE asientos SET fecha = '2026-07-03'
--     WHERE numero = 41 AND fecha = '2026-04-24' AND _deleted = false;
--    -- verificar después:
--    -- SELECT periodo, saldo_final FROM saldos_mensuales sm
--    --   JOIN plan_cuentas pc ON pc.id = sm.cuenta_id
--    --  WHERE pc.codigo = '1.1.02' ORDER BY periodo;
-- ─────────────────────────────────────────────────────────────────────────────
