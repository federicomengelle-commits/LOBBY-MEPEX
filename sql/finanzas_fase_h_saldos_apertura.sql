-- ════════════════════════════════════════════════════════════════════════════
--  FASE H — Saldos de apertura por ejercicio
-- ════════════════════════════════════════════════════════════════════════════
--
-- Permite cargar los saldos iniciales del ejercicio (típicamente 2027 para
-- arrancar uso real) en cuentas patrimoniales (activo / pasivo / patrimonio).
-- Las cuentas de resultado (ingreso/egreso) NO tienen apertura — se cierran
-- contra Resultado del Ejercicio al final del período.
--
-- Workflow:
--   1. Superadmin carga saldos en UI (borrador, bloqueado=false). Editable
--      cuantas veces quiera.
--   2. Cuando los saldos cuadran (Total Activo = Total Pasivo + Patrimonio),
--      clickea "Bloquear y generar asiento".
--   3. fn_generar_asiento_apertura crea un único asiento tipo='apertura'
--      con fecha = <ejercicio>-01-01, débitos en cuentas activo y créditos
--      en cuentas pasivo/patrimonio. Marca todos los saldos del ejercicio
--      como bloqueado=true.
--   4. Saldos bloqueados no se pueden editar — para corregir hay que crear
--      asientos de ajuste posteriores (la apertura queda como histórico).
-- ════════════════════════════════════════════════════════════════════════════


-- ─── H.1 Tabla saldos_apertura ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saldos_apertura (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ejercicio       INT  NOT NULL CHECK (ejercicio BETWEEN 2024 AND 2099),
    cuenta_id       UUID NOT NULL REFERENCES plan_cuentas(id),
    monto           NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (monto >= 0),
    moneda          TEXT NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS','USD','EUR')),
    cotizacion      NUMERIC(15,4) NOT NULL DEFAULT 1 CHECK (cotizacion > 0),
    monto_en_ars    NUMERIC(15,2),
    bloqueado       BOOLEAN NOT NULL DEFAULT false,
    asiento_id      UUID REFERENCES asientos(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES profiles(id),
    _deleted        BOOLEAN NOT NULL DEFAULT false
);

-- Unique por ejercicio + cuenta (excluyendo soft-delete)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_saldo_apertura_ejercicio_cuenta
    ON saldos_apertura(ejercicio, cuenta_id) WHERE _deleted = false;

CREATE INDEX IF NOT EXISTS idx_saldo_apertura_ejercicio
    ON saldos_apertura(ejercicio) WHERE _deleted = false;


-- ─── H.2 RLS — solo admin/superadmin ───────────────────────────────────
ALTER TABLE saldos_apertura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saldos_apertura_admin" ON saldos_apertura;
CREATE POLICY "saldos_apertura_admin" ON saldos_apertura FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','superadmin')))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','superadmin')));


-- ─── H.3 Trigger snapshot monto_en_ars + updated_at ────────────────────
CREATE OR REPLACE FUNCTION fn_saldo_apertura_snapshot()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cotizacion IS NULL OR NEW.cotizacion <= 0 THEN
        NEW.cotizacion := 1;
    END IF;
    NEW.monto_en_ars := COALESCE(NEW.monto, 0) * NEW.cotizacion;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saldo_apertura_snapshot ON saldos_apertura;
CREATE TRIGGER trg_saldo_apertura_snapshot
    BEFORE INSERT OR UPDATE ON saldos_apertura
    FOR EACH ROW EXECUTE FUNCTION fn_saldo_apertura_snapshot();


-- ─── H.4 Trigger: si bloqueado=true, prohibir UPDATE/DELETE del monto ──
CREATE OR REPLACE FUNCTION fn_saldo_apertura_inmutable_si_bloqueado()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo bloquea cambios al monto/moneda/cotizacion. Permite cambiar
    -- bloqueado de false a true (workflow normal), y _deleted (cleanup admin).
    IF OLD.bloqueado = true AND TG_OP = 'UPDATE' THEN
        IF NEW.monto IS DISTINCT FROM OLD.monto
           OR NEW.moneda IS DISTINCT FROM OLD.moneda
           OR NEW.cotizacion IS DISTINCT FROM OLD.cotizacion THEN
            RAISE EXCEPTION '[Apertura] Saldo del ejercicio % bloqueado — no se puede modificar monto/moneda. Crear asiento de ajuste posterior.', OLD.ejercicio;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saldo_apertura_inmutable ON saldos_apertura;
CREATE TRIGGER trg_saldo_apertura_inmutable
    BEFORE UPDATE ON saldos_apertura
    FOR EACH ROW EXECUTE FUNCTION fn_saldo_apertura_inmutable_si_bloqueado();


-- ─── H.5 fn_generar_asiento_apertura(p_ejercicio, p_actor) ─────────────
-- Valida cuadre y crea el asiento de apertura. Marca todos los saldos del
-- ejercicio como bloqueado=true.
--
-- Devuelve UUID del asiento generado.
-- Lanza EXCEPTION si:
--   - Ya hay saldos bloqueados (apertura ya generada)
--   - No cuadra Activo vs Pasivo+Patrimonio (tolerancia 0.5 ARS)
--   - No hay saldos cargados con monto > 0

CREATE OR REPLACE FUNCTION fn_generar_asiento_apertura(
    p_ejercicio INT,
    p_actor     UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_total_activo    NUMERIC(15,2) := 0;
    v_total_pas_patr  NUMERIC(15,2) := 0;
    v_descuadre       NUMERIC(15,2);
    v_asiento_id      UUID;
    v_orden           INT := 1;
    v_count_saldos    INT;
    v_count_bloq      INT;
    r                 RECORD;
BEGIN
    -- Validación 1: no haber ya generado apertura
    SELECT COUNT(*) INTO v_count_bloq
    FROM saldos_apertura
    WHERE ejercicio = p_ejercicio AND bloqueado = true AND _deleted = false;

    IF v_count_bloq > 0 THEN
        RAISE EXCEPTION '[Apertura] El ejercicio % ya tiene apertura generada (% saldos bloqueados).', p_ejercicio, v_count_bloq;
    END IF;

    -- Validación 2: tener al menos un saldo > 0
    SELECT COUNT(*) INTO v_count_saldos
    FROM saldos_apertura
    WHERE ejercicio = p_ejercicio AND monto > 0 AND _deleted = false;

    IF v_count_saldos = 0 THEN
        RAISE EXCEPTION '[Apertura] No hay saldos cargados para el ejercicio %.', p_ejercicio;
    END IF;

    -- Calcular totales por tipo (usando monto_en_ars para tener todo en ARS)
    SELECT COALESCE(SUM(s.monto_en_ars), 0) INTO v_total_activo
    FROM saldos_apertura s
    JOIN plan_cuentas pc ON pc.id = s.cuenta_id
    WHERE s.ejercicio = p_ejercicio AND s._deleted = false
      AND s.monto > 0 AND pc.tipo = 'activo';

    SELECT COALESCE(SUM(s.monto_en_ars), 0) INTO v_total_pas_patr
    FROM saldos_apertura s
    JOIN plan_cuentas pc ON pc.id = s.cuenta_id
    WHERE s.ejercicio = p_ejercicio AND s._deleted = false
      AND s.monto > 0 AND pc.tipo IN ('pasivo', 'patrimonio');

    v_descuadre := v_total_activo - v_total_pas_patr;

    IF ABS(v_descuadre) > 0.5 THEN
        RAISE EXCEPTION '[Apertura] El ejercicio % no cuadra: Activo=% / Pasivo+Patrimonio=% / Descuadre=%',
            p_ejercicio, v_total_activo, v_total_pas_patr, v_descuadre;
    END IF;

    -- Crear asiento de apertura
    INSERT INTO asientos (fecha, concepto, tipo, canal, total_debe, total_haber, created_by)
    VALUES (
        (p_ejercicio || '-01-01')::DATE,
        'Asiento de apertura ejercicio ' || p_ejercicio,
        'apertura',
        'oficial',
        v_total_activo,
        v_total_pas_patr,
        p_actor
    )
    RETURNING id INTO v_asiento_id;

    -- Líneas: débitos para activos
    FOR r IN
        SELECT s.id, s.monto_en_ars, pc.codigo, pc.nombre, s.cuenta_id, pc.tipo
        FROM saldos_apertura s
        JOIN plan_cuentas pc ON pc.id = s.cuenta_id
        WHERE s.ejercicio = p_ejercicio AND s._deleted = false
          AND s.monto > 0 AND pc.tipo = 'activo'
        ORDER BY pc.codigo
    LOOP
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, r.cuenta_id, 'debe', r.monto_en_ars,
                'Apertura ' || r.codigo || ' ' || r.nombre, v_orden);
        v_orden := v_orden + 1;
    END LOOP;

    -- Créditos para pasivos y patrimonio
    FOR r IN
        SELECT s.id, s.monto_en_ars, pc.codigo, pc.nombre, s.cuenta_id, pc.tipo
        FROM saldos_apertura s
        JOIN plan_cuentas pc ON pc.id = s.cuenta_id
        WHERE s.ejercicio = p_ejercicio AND s._deleted = false
          AND s.monto > 0 AND pc.tipo IN ('pasivo', 'patrimonio')
        ORDER BY pc.codigo
    LOOP
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, r.cuenta_id, 'haber', r.monto_en_ars,
                'Apertura ' || r.codigo || ' ' || r.nombre, v_orden);
        v_orden := v_orden + 1;
    END LOOP;

    -- Marcar saldos como bloqueados + vincular al asiento
    -- Bypass del trigger inmutable usando SET LOCAL en función — pero como
    -- el trigger solo bloquea cambios de monto/moneda/cotización, el UPDATE
    -- de bloqueado + asiento_id pasa sin problema.
    UPDATE saldos_apertura
    SET bloqueado = true, asiento_id = v_asiento_id
    WHERE ejercicio = p_ejercicio AND _deleted = false;

    RAISE NOTICE '[Apertura] Ejercicio % asentado. Asiento_id=%, Total=% ARS', p_ejercicio, v_asiento_id, v_total_activo;
    RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql;


-- ─── H.6 VIEW v_saldos_apertura_ejercicio ──────────────────────────────
-- Resumen para el frontend: para un ejercicio dado, todas las cuentas
-- imputables patrimoniales (activo/pasivo/patrimonio) con su saldo
-- de apertura (si hay) o NULL.
CREATE OR REPLACE VIEW v_saldos_apertura_ejercicio AS
SELECT
    pc.id        AS cuenta_id,
    pc.codigo,
    pc.nombre,
    pc.tipo,
    pc.codigo_padre,
    pc.nivel,
    pc.imputable,
    s.id            AS saldo_id,
    s.ejercicio,
    COALESCE(s.monto, 0)         AS monto,
    COALESCE(s.moneda, 'ARS')    AS moneda,
    COALESCE(s.cotizacion, 1)    AS cotizacion,
    COALESCE(s.monto_en_ars, 0)  AS monto_en_ars,
    COALESCE(s.bloqueado, false) AS bloqueado,
    s.asiento_id
FROM plan_cuentas pc
LEFT JOIN saldos_apertura s
    ON s.cuenta_id = pc.id AND s._deleted = false
WHERE pc._deleted = false
  AND pc.tipo IN ('activo', 'pasivo', 'patrimonio')
  AND pc.imputable = true
ORDER BY pc.codigo;


-- ─── H.7 Diagnóstico de cierre ─────────────────────────────────────────
DO $$
DECLARE
    v_imputables INT;
    v_aperturas  INT;
BEGIN
    SELECT COUNT(*) INTO v_imputables
    FROM plan_cuentas
    WHERE _deleted = false AND imputable = true AND tipo IN ('activo','pasivo','patrimonio');

    SELECT COUNT(DISTINCT ejercicio) INTO v_aperturas
    FROM saldos_apertura WHERE _deleted = false;

    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Fase H — Saldos de apertura lista.';
    RAISE NOTICE '  Tabla saldos_apertura creada (con RLS admin/superadmin).';
    RAISE NOTICE '  Triggers: snapshot ARS, inmutabilidad post-bloqueo.';
    RAISE NOTICE '  Función fn_generar_asiento_apertura(ejercicio, actor) creada.';
    RAISE NOTICE '  VIEW v_saldos_apertura_ejercicio creada.';
    RAISE NOTICE '  Cuentas patrimoniales imputables disponibles: %', v_imputables;
    RAISE NOTICE '  Ejercicios con saldos cargados: %', v_aperturas;
    RAISE NOTICE '═══════════════════════════════════════════';
END $$;
