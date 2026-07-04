-- ============================================================
-- FASE 7 — CANDADO DE EJERCICIO CERRADO (asientos retroactivos)
-- ============================================================
-- Cuando se bloquea la apertura de un ejercicio (saldos_apertura.bloqueado=true
-- vía fn_generar_asiento_apertura), los ejercicios anteriores quedan CONGELADOS:
-- no se pueden crear/editar/eliminar asientos con fecha < 01/01 del ejercicio
-- bloqueado más alto. El asiento de apertura mismo (tipo='apertura', fecha = ese
-- 01/01) queda permitido.
--
-- Corta el agujero que hoy existe: sin esto, un asiento manual con fecha 2025 o
-- 2026 se podría postear aunque el ejercicio ya esté "cerrado", alterando el
-- pasado que la apertura ya resumió.
--
-- ⚠️ NO-OP HASTA 2027: hoy saldos_apertura = 0 filas → cutoff NULL → los triggers
--    dejan pasar TODO (comportamiento idéntico al actual). Recién muerde cuando
--    superadmin bloquee el ejercicio 2027. Sofi revisa antes de activar.
--
-- Idempotente (CREATE OR REPLACE + DROP TRIGGER IF EXISTS). Sin cambios de JS.
-- ============================================================

-- ------------------------------------------------------------
-- Helper: fecha de corte = 01/01 del ejercicio bloqueado más alto (o NULL).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ejercicio_cerrado_cutoff()
RETURNS date AS $$
    SELECT CASE WHEN MAX(ejercicio) IS NOT NULL
                THEN make_date(MAX(ejercicio), 1, 1)
           END
    FROM public.saldos_apertura
    WHERE bloqueado = true AND _deleted = false;
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------
-- A. Trigger sobre asientos (cabecera): INSERT / UPDATE / DELETE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_asiento_periodo_bloqueado()
RETURNS TRIGGER AS $$
DECLARE
    v_cutoff date := public.fn_ejercicio_cerrado_cutoff();
BEGIN
    IF v_cutoff IS NULL THEN
        RETURN COALESCE(NEW, OLD);   -- nada bloqueado → no-op
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.fecha < v_cutoff THEN
            RAISE EXCEPTION 'Ejercicio cerrado: no se puede eliminar un asiento con fecha % (anterior al %). El ejercicio ya fue bloqueado.',
                OLD.fecha, v_cutoff USING ERRCODE = 'check_violation';
        END IF;
        RETURN OLD;
    END IF;

    -- INSERT / UPDATE
    IF NEW.fecha < v_cutoff AND NOT (TG_OP = 'INSERT' AND NEW.tipo = 'apertura') THEN
        RAISE EXCEPTION 'Ejercicio cerrado: no se pueden crear/editar asientos con fecha % (anterior al %). El ejercicio ya fue bloqueado.',
            NEW.fecha, v_cutoff USING ERRCODE = 'check_violation';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.fecha < v_cutoff THEN
        RAISE EXCEPTION 'Ejercicio cerrado: no se puede editar un asiento congelado (fecha %, anterior al %).',
            OLD.fecha, v_cutoff USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asiento_periodo_bloqueado ON public.asientos;
CREATE TRIGGER trg_asiento_periodo_bloqueado
    BEFORE INSERT OR UPDATE OR DELETE ON public.asientos
    FOR EACH ROW EXECUTE FUNCTION public.fn_asiento_periodo_bloqueado();

-- ------------------------------------------------------------
-- B. Trigger sobre asiento_lineas: cubre la edición de líneas de un asiento
--    congelado que no toque la cabecera. Chequea la fecha del asiento padre.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_asiento_linea_periodo_bloqueado()
RETURNS TRIGGER AS $$
DECLARE
    v_cutoff  date := public.fn_ejercicio_cerrado_cutoff();
    v_fecha   date;
    v_tipo    text;
BEGIN
    IF v_cutoff IS NULL THEN
        RETURN COALESCE(NEW, OLD);   -- nada bloqueado → no-op
    END IF;

    SELECT fecha, tipo INTO v_fecha, v_tipo
    FROM public.asientos
    WHERE id = COALESCE(NEW.asiento_id, OLD.asiento_id);

    IF v_fecha IS NULL THEN
        RETURN COALESCE(NEW, OLD);   -- asiento padre inexistente → no bloquear
    END IF;

    -- El asiento de apertura (fecha = cutoff, tipo='apertura') queda permitido.
    IF v_fecha < v_cutoff AND v_tipo IS DISTINCT FROM 'apertura' THEN
        RAISE EXCEPTION 'Ejercicio cerrado: no se pueden modificar líneas de un asiento con fecha % (anterior al %).',
            v_fecha, v_cutoff USING ERRCODE = 'check_violation';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asiento_linea_periodo_bloqueado ON public.asiento_lineas;
CREATE TRIGGER trg_asiento_linea_periodo_bloqueado
    BEFORE INSERT OR UPDATE OR DELETE ON public.asiento_lineas
    FOR EACH ROW EXECUTE FUNCTION public.fn_asiento_linea_periodo_bloqueado();

-- ============================================================
-- TEST (correr a mano DESPUÉS de tener un ejercicio bloqueado; limpiar al final)
-- ============================================================
-- Con saldos_apertura del ejercicio 2027 en bloqueado=true (cutoff = 2027-01-01):
--   1) INSERT asiento fecha 2026-12-31 (manual)      → debe FALLAR (check_violation)
--   2) INSERT asiento fecha 2027-02-10 (manual)      → OK
--   3) UPDATE de un asiento viejo (fecha < 2027)     → debe FALLAR
--   4) INSERT asiento fecha 2027-01-01 tipo='apertura' → OK (excepción)
--   5) Confirmar un ingreso/egreso con fecha 2027-xx → OK (auto-asiento pasa)
-- Verificación de que HOY es no-op:
--   SELECT public.fn_ejercicio_cerrado_cutoff();  -- debe dar NULL (0 filas bloqueadas)
