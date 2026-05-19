-- =============================================
-- MEPEX Lobby — Contabilidad Fase A: HARDENING
-- =============================================
-- A1: CHECK partida doble en asientos
-- A2: Trigger materializar saldos_mensuales (con cascada)
-- A3: Plan de cuentas — sumar imputable y controla_subdiario
-- A4: Tabla audit_logs + trigger en asientos
--
-- Schema real de producción (NO el del repo viejo):
--   asientos:        id, numero, fecha, concepto, tipo, canal,
--                    ingreso_id, egreso_id, comprobante_id, comprobante_recibido_id,
--                    transferencia_id, total_debe, total_haber, notas, _deleted
--                    (NO hay 'estado' — _deleted controla vigencia)
--   asiento_lineas:  id, asiento_id, cuenta_id, tipo_movimiento ('debe'|'haber'),
--                    monto, descripcion, orden
--   saldos_mensuales: id, cuenta_id, periodo (TEXT 'YYYY-MM'), canal,
--                    saldo_anterior, total_debe, total_haber, saldo_final
--
-- IMPORTANTE: idempotente. Re-ejecutar es seguro.
-- =============================================


-- ════════════════════════════════════════════════
--  A1 — CHECK partida doble en asientos
-- ════════════════════════════════════════════════
-- Se agrega como NOT VALID para no fallar si hay asientos viejos desbalanceados.
-- Para validar histórico luego: ALTER TABLE asientos VALIDATE CONSTRAINT chk_partida_doble;

DO $$
DECLARE
    v_desbalanceados INT;
BEGIN
    SELECT COUNT(*) INTO v_desbalanceados
    FROM asientos
    WHERE ABS(total_debe - total_haber) >= 0.01
      AND _deleted = false;

    IF v_desbalanceados > 0 THEN
        RAISE WARNING '[Fase A] Hay % asientos desbalanceados. Constraint NOT VALID.', v_desbalanceados;
    ELSE
        RAISE NOTICE '[Fase A] Todos los asientos están balanceados.';
    END IF;
END $$;

ALTER TABLE asientos DROP CONSTRAINT IF EXISTS chk_partida_doble;
ALTER TABLE asientos ADD CONSTRAINT chk_partida_doble
    CHECK (ABS(total_debe - total_haber) < 0.01) NOT VALID;


-- ════════════════════════════════════════════════
--  A2 — Materialización de saldos_mensuales (con cascada)
-- ════════════════════════════════════════════════

-- 2.1 — UNIQUE constraint (necesario para ON CONFLICT)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_saldos_cuenta_periodo_canal'
    ) THEN
        ALTER TABLE saldos_mensuales
            ADD CONSTRAINT uq_saldos_cuenta_periodo_canal UNIQUE (cuenta_id, periodo, canal);
    END IF;
END $$;


-- 2.2 — Función que refresca el saldo de UN periodo (cuenta + periodo + canal)
--       Incluye saldo_anterior derivado del periodo previo.
CREATE OR REPLACE FUNCTION fn_refresh_saldo_periodo(
    p_cuenta_id UUID,
    p_periodo TEXT,        -- 'YYYY-MM'
    p_canal TEXT
)
RETURNS VOID AS $$
DECLARE
    v_total_debe       NUMERIC(15,2);
    v_total_haber      NUMERIC(15,2);
    v_saldo_anterior   NUMERIC(15,2);
    v_saldo_final      NUMERIC(15,2);
    v_periodo_anterior TEXT;
BEGIN
    -- Total debe/haber del periodo (canal específico)
    SELECT
        COALESCE(SUM(CASE WHEN al.tipo_movimiento = 'debe'  THEN al.monto END), 0),
        COALESCE(SUM(CASE WHEN al.tipo_movimiento = 'haber' THEN al.monto END), 0)
    INTO v_total_debe, v_total_haber
    FROM asiento_lineas al
    JOIN asientos a ON a.id = al.asiento_id
    WHERE al.cuenta_id = p_cuenta_id
      AND TO_CHAR(a.fecha, 'YYYY-MM') = p_periodo
      AND COALESCE(a.canal, 'oficial') = p_canal
      AND a._deleted = false;

    -- Periodo anterior (1 mes antes)
    v_periodo_anterior := TO_CHAR((p_periodo || '-01')::DATE - INTERVAL '1 month', 'YYYY-MM');

    -- Saldo anterior = saldo_final del periodo anterior (0 si no existe)
    SELECT COALESCE(saldo_final, 0) INTO v_saldo_anterior
    FROM saldos_mensuales
    WHERE cuenta_id = p_cuenta_id
      AND periodo = v_periodo_anterior
      AND canal = p_canal
    LIMIT 1;

    v_saldo_anterior := COALESCE(v_saldo_anterior, 0);
    v_saldo_final := v_saldo_anterior + v_total_debe - v_total_haber;

    INSERT INTO saldos_mensuales (cuenta_id, periodo, canal, saldo_anterior, total_debe, total_haber, saldo_final, updated_at)
    VALUES (p_cuenta_id, p_periodo, p_canal, v_saldo_anterior, v_total_debe, v_total_haber, v_saldo_final, NOW())
    ON CONFLICT (cuenta_id, periodo, canal) DO UPDATE
    SET saldo_anterior = EXCLUDED.saldo_anterior,
        total_debe     = EXCLUDED.total_debe,
        total_haber    = EXCLUDED.total_haber,
        saldo_final    = EXCLUDED.saldo_final,
        updated_at     = NOW();
END;
$$ LANGUAGE plpgsql;


-- 2.3 — Función que refresca el periodo y CASCADEA hacia los meses siguientes
--       (porque cambia el saldo_anterior de los meses posteriores)
CREATE OR REPLACE FUNCTION fn_refresh_saldo_cascada(
    p_cuenta_id UUID,
    p_periodo_desde TEXT,
    p_canal TEXT
)
RETURNS VOID AS $$
DECLARE
    v_periodo_iter TEXT;
    v_periodo_max  TEXT;
BEGIN
    -- Refrescar el periodo origen
    PERFORM fn_refresh_saldo_periodo(p_cuenta_id, p_periodo_desde, p_canal);

    -- Encontrar el max periodo existente para esa cuenta/canal
    SELECT MAX(periodo) INTO v_periodo_max
    FROM saldos_mensuales
    WHERE cuenta_id = p_cuenta_id AND canal = p_canal;

    -- Si hay meses posteriores, refrescarlos en orden (cada uno hereda del anterior)
    IF v_periodo_max IS NOT NULL AND v_periodo_max > p_periodo_desde THEN
        v_periodo_iter := TO_CHAR((p_periodo_desde || '-01')::DATE + INTERVAL '1 month', 'YYYY-MM');
        WHILE v_periodo_iter <= v_periodo_max LOOP
            PERFORM fn_refresh_saldo_periodo(p_cuenta_id, v_periodo_iter, p_canal);
            v_periodo_iter := TO_CHAR((v_periodo_iter || '-01')::DATE + INTERVAL '1 month', 'YYYY-MM');
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- 2.4 — Trigger sobre asiento_lineas
CREATE OR REPLACE FUNCTION fn_trg_saldos_lineas()
RETURNS TRIGGER AS $$
DECLARE
    v_fecha    DATE;
    v_canal    TEXT;
    v_periodo  TEXT;
BEGIN
    -- INSERT / UPDATE → procesar NEW
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT a.fecha, COALESCE(a.canal, 'oficial')
        INTO v_fecha, v_canal
        FROM asientos a WHERE a.id = NEW.asiento_id AND a._deleted = false;

        IF v_fecha IS NOT NULL THEN
            v_periodo := TO_CHAR(v_fecha, 'YYYY-MM');
            PERFORM fn_refresh_saldo_cascada(NEW.cuenta_id, v_periodo, v_canal);
        END IF;
    END IF;

    -- DELETE / UPDATE → procesar OLD (puede ser otro asiento/cuenta)
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        SELECT a.fecha, COALESCE(a.canal, 'oficial')
        INTO v_fecha, v_canal
        FROM asientos a WHERE a.id = OLD.asiento_id;

        IF v_fecha IS NOT NULL THEN
            v_periodo := TO_CHAR(v_fecha, 'YYYY-MM');
            PERFORM fn_refresh_saldo_cascada(OLD.cuenta_id, v_periodo, v_canal);
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saldos_lineas ON asiento_lineas;
CREATE TRIGGER trg_saldos_lineas
    AFTER INSERT OR UPDATE OR DELETE ON asiento_lineas
    FOR EACH ROW EXECUTE FUNCTION fn_trg_saldos_lineas();


-- 2.5 — Trigger sobre asientos: si cambia fecha, canal o _deleted, refrescar
CREATE OR REPLACE FUNCTION fn_trg_saldos_asiento_cabecera()
RETURNS TRIGGER AS $$
DECLARE
    v_periodo_new TEXT;
    v_periodo_old TEXT;
    v_canal_new   TEXT;
    v_canal_old   TEXT;
    rec RECORD;
BEGIN
    IF TG_OP = 'UPDATE' AND (
        OLD.fecha    IS DISTINCT FROM NEW.fecha    OR
        OLD.canal    IS DISTINCT FROM NEW.canal    OR
        OLD._deleted IS DISTINCT FROM NEW._deleted
    ) THEN
        v_periodo_new := TO_CHAR(NEW.fecha, 'YYYY-MM');
        v_periodo_old := TO_CHAR(OLD.fecha, 'YYYY-MM');
        v_canal_new   := COALESCE(NEW.canal, 'oficial');
        v_canal_old   := COALESCE(OLD.canal, 'oficial');

        -- Refrescar todas las cuentas tocadas en el periodo NUEVO
        FOR rec IN SELECT DISTINCT cuenta_id FROM asiento_lineas WHERE asiento_id = NEW.id LOOP
            PERFORM fn_refresh_saldo_cascada(rec.cuenta_id, v_periodo_new, v_canal_new);
        END LOOP;

        -- Si cambió fecha o canal, también refrescar el bucket VIEJO
        IF v_periodo_new <> v_periodo_old OR v_canal_new <> v_canal_old THEN
            FOR rec IN SELECT DISTINCT cuenta_id FROM asiento_lineas WHERE asiento_id = NEW.id LOOP
                PERFORM fn_refresh_saldo_cascada(rec.cuenta_id, v_periodo_old, v_canal_old);
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saldos_asiento_cabecera ON asientos;
CREATE TRIGGER trg_saldos_asiento_cabecera
    AFTER UPDATE ON asientos
    FOR EACH ROW EXECUTE FUNCTION fn_trg_saldos_asiento_cabecera();


-- 2.6 — Backfill inicial: recalcular saldos para todas las cuentas con movimientos
DO $$
DECLARE
    rec RECORD;
    v_total INT := 0;
BEGIN
    FOR rec IN
        SELECT DISTINCT
            al.cuenta_id,
            TO_CHAR(a.fecha, 'YYYY-MM')        AS periodo,
            COALESCE(a.canal, 'oficial')        AS canal
        FROM asiento_lineas al
        JOIN asientos a ON a.id = al.asiento_id
        WHERE a._deleted = false
        ORDER BY 1, 2, 3
    LOOP
        PERFORM fn_refresh_saldo_periodo(rec.cuenta_id, rec.periodo, rec.canal);
        v_total := v_total + 1;
    END LOOP;

    RAISE NOTICE '[Fase A] saldos_mensuales backfill: % buckets (cuenta×mes×canal) recalculados.', v_total;
END $$;


-- ════════════════════════════════════════════════
--  A3 — Plan de cuentas: imputable + controla_subdiario
-- ════════════════════════════════════════════════

ALTER TABLE plan_cuentas
    ADD COLUMN IF NOT EXISTS imputable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE plan_cuentas
    ADD COLUMN IF NOT EXISTS controla_subdiario TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'plan_cuentas' AND constraint_name = 'chk_controla_subdiario'
    ) THEN
        ALTER TABLE plan_cuentas ADD CONSTRAINT chk_controla_subdiario
            CHECK (controla_subdiario IS NULL OR controla_subdiario IN ('cliente', 'proveedor', 'evento', 'proyecto'));
    END IF;
END $$;

-- Backfill: hojas (NOT es_grupo) son imputables
UPDATE plan_cuentas
SET imputable = (NOT es_grupo)
WHERE imputable IS DISTINCT FROM (NOT es_grupo);

-- Sugerencias automáticas de controla_subdiario por nombre
UPDATE plan_cuentas SET controla_subdiario = 'cliente'
WHERE controla_subdiario IS NULL
  AND (LOWER(nombre) LIKE '%deudores por venta%'
    OR LOWER(nombre) LIKE '%clientes cta cte%'
    OR LOWER(nombre) LIKE '%clientes cuenta corriente%');

UPDATE plan_cuentas SET controla_subdiario = 'proveedor'
WHERE controla_subdiario IS NULL
  AND (LOWER(nombre) LIKE '%proveedores cta cte%'
    OR LOWER(nombre) LIKE '%proveedores cuenta corriente%'
    OR LOWER(nombre) LIKE '%acreedores comerciales%');

DO $$
DECLARE
    v_imputables    INT;
    v_con_subdiario INT;
BEGIN
    SELECT COUNT(*) INTO v_imputables    FROM plan_cuentas WHERE imputable = true AND _deleted = false;
    SELECT COUNT(*) INTO v_con_subdiario FROM plan_cuentas WHERE controla_subdiario IS NOT NULL AND _deleted = false;
    RAISE NOTICE '[Fase A] plan_cuentas: % imputables, % con subdiario.', v_imputables, v_con_subdiario;
END $$;


-- ════════════════════════════════════════════════
--  A4 — Audit logs + trigger en asientos
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabla TEXT NOT NULL,
    registro_id UUID NOT NULL,
    accion TEXT NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
    actor_id UUID REFERENCES profiles(id),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    valores_anteriores JSONB,
    valores_nuevos JSONB,
    contexto TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tabla_registro ON audit_logs(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor          ON audit_logs(actor_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_fecha          ON audit_logs(fecha DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_admin_read"           ON audit_logs;
DROP POLICY IF EXISTS "audit_insert_authenticated" ON audit_logs;

CREATE POLICY "audit_admin_read" ON audit_logs FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'superadmin'))
);

CREATE POLICY "audit_insert_authenticated" ON audit_logs FOR INSERT
    WITH CHECK (true);


-- Trigger genérico sobre asientos (usa 'concepto' del schema real)
CREATE OR REPLACE FUNCTION fn_audit_asientos()
RETURNS TRIGGER AS $$
DECLARE
    v_actor UUID;
    v_ctx TEXT;
BEGIN
    v_actor := auth.uid();

    IF TG_OP = 'INSERT' THEN
        v_ctx := 'asiento #' || COALESCE(NEW.numero::TEXT, '?') ||
                 ' tipo=' || COALESCE(NEW.tipo,'?') ||
                 ' canal=' || COALESCE(NEW.canal,'oficial');
        INSERT INTO audit_logs (tabla, registro_id, accion, actor_id, valores_nuevos, contexto)
        VALUES ('asientos', NEW.id, 'INSERT', v_actor, to_jsonb(NEW), v_ctx);

    ELSIF TG_OP = 'UPDATE' THEN
        v_ctx := 'asiento #' || COALESCE(NEW.numero::TEXT, '?') ||
                 CASE WHEN OLD._deleted IS DISTINCT FROM NEW._deleted
                      THEN ' _deleted:' || OLD._deleted::TEXT || '→' || NEW._deleted::TEXT
                      ELSE '' END ||
                 CASE WHEN OLD.concepto IS DISTINCT FROM NEW.concepto
                      THEN ' concepto cambió'
                      ELSE '' END;
        INSERT INTO audit_logs (tabla, registro_id, accion, actor_id, valores_anteriores, valores_nuevos, contexto)
        VALUES ('asientos', NEW.id, 'UPDATE', v_actor, to_jsonb(OLD), to_jsonb(NEW), v_ctx);

    ELSIF TG_OP = 'DELETE' THEN
        v_ctx := 'asiento #' || COALESCE(OLD.numero::TEXT, '?') || ' DELETE físico';
        INSERT INTO audit_logs (tabla, registro_id, accion, actor_id, valores_anteriores, contexto)
        VALUES ('asientos', OLD.id, 'DELETE', v_actor, to_jsonb(OLD), v_ctx);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_asientos ON asientos;
CREATE TRIGGER trg_audit_asientos
    AFTER INSERT OR UPDATE OR DELETE ON asientos
    FOR EACH ROW EXECUTE FUNCTION fn_audit_asientos();


-- ════════════════════════════════════════════════
--  Cierre — resumen
-- ════════════════════════════════════════════════
DO $$
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Fase A — Hardening contabilidad completada.';
    RAISE NOTICE '  A1 ✓ CHECK partida doble (NOT VALID — validar luego)';
    RAISE NOTICE '  A2 ✓ Triggers materializar saldos_mensuales + cascada + backfill';
    RAISE NOTICE '  A3 ✓ plan_cuentas.imputable + controla_subdiario';
    RAISE NOTICE '  A4 ✓ audit_logs + trigger en asientos';
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Pasos manuales pendientes:';
    RAISE NOTICE '  1. Cuando no haya asientos desbalanceados, ejecutar:';
    RAISE NOTICE '     ALTER TABLE asientos VALIDATE CONSTRAINT chk_partida_doble;';
    RAISE NOTICE '  2. Ajustar controla_subdiario en plan_cuentas para cuentas';
    RAISE NOTICE '     específicas en fases posteriores.';
END $$;
