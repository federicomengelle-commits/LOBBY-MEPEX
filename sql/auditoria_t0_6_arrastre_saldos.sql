-- =====================================================================
-- T0.6 · El arrastre de `saldos_mensuales`
-- Auditoría 2026-07-31 · hallazgo C1  ⚠️ el que esconde $3.200.000
-- =====================================================================
--
-- PROBLEMA
--   `fn_refresh_saldo_periodo` calcula el saldo de arranque de un mes leyendo
--   **el mes literalmente anterior**:
--
--       v_periodo_anterior := TO_CHAR((p_periodo||'-01')::DATE - INTERVAL '1 month', 'YYYY-MM');
--       SELECT saldo_final ... WHERE periodo = v_periodo_anterior
--
--   Si ese mes exacto no tiene fila —porque no hubo ningún movimiento en esa
--   cuenta ese mes— el SELECT no encuentra nada, `v_saldo_anterior` queda en
--   0 y **el saldo acumulado se pierde**. No hay error, no hay warning: el
--   dinero simplemente desaparece del arrastre.
--
--   Y las filas se crean sólo cuando hay movimiento: un mes sin actividad no
--   genera fila. O sea, el bug se dispara con el caso más normal del mundo —
--   una caja que no se toca durante un mes.
--
-- EL CASO VIVO EN PROD (verificado 2026-08-01)
--   `1.1.01 Efectivo (mano)` / canal `interno`:
--       2026-04   debe 3.200.000              → saldo_final 3.200.000
--       2026-05   debe 500.000 / haber 500.000 → saldo_final 3.200.000
--       2026-06   ← NO EXISTE (mes sin movimiento)
--       2026-07   debe 5.000.000, saldo_anterior 0.00 → saldo_final 5.000.000
--                                              ↑ acá se pierden los 3.200.000
--   Correcto: 3.200.000 + 0 + 5.000.000 = **8.200.000**.
--
--   Hay 3 series con hueco de mes; las otras dos (`1.1.01/oficial` y
--   `5.2.11/oficial`) venían con saldo 0 antes del hueco, así que hoy dan bien
--   **por casualidad**. Misma bomba, sin detonar.
--
-- ⚠️ EFECTO VISIBLE PARA EL USUARIO
--   El KPI "Saldo disponible" (Finanzas → Dashboard, y el home) sale de
--   `saldos_mensuales`: `finanzas.js:4585` toma el último período por canal y
--   suma los canales. Al corregir el arrastre:
--
--       $4.999.900   →   $8.199.900        (interno 8.200.000 + oficial -100)
--
--   **No es plata nueva ni un bug nuevo**: es plata que el arrastre venía
--   escondiendo. El número correcto siempre fue 8.199.900.
--
-- QUÉ HACE ESTE ARCHIVO
--   1. `fn_refresh_saldo_periodo` arranca del ÚLTIMO período existente
--      anterior, en vez del mes literalmente anterior.
--   2. Recalcula todas las series ya existentes, en orden cronológico.
--
-- POR QUÉ EL BACKFILL NO USA `fn_refresh_saldo_cascada`
--   El plan lo proponía así, pero `cascada` itera **mes a mes** desde el
--   período de arranque hasta el máximo, y cada iteración hace un INSERT …
--   ON CONFLICT → arrancarlo desde '2026-01' fabricaría filas en cero para
--   todos los meses previos al primer movimiento de cada serie. No rompe
--   nada, pero ensucia la tabla sin necesidad. Recorrer las filas que YA
--   existen, en orden, da el mismo resultado sin inventar ninguna.
--
--   `fn_refresh_saldo_cascada` NO se toca: su iteración mes a mes ahora es
--   inofensiva (las filas que cree van a tener el arrastre correcto) y sigue
--   sirviendo para propagar un cambio hacia adelante.
--
-- IDEMPOTENTE: sí — el recálculo es determinístico, correrlo N veces
--   converge al mismo número.
-- REVERSIBLE: sí, ver el pie. Pero ojo: revertir vuelve a esconder los 3,2M.
-- NO REQUIERE JS. NO REQUIERE DEPLOY.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · El arrastre, del último período existente
-- ---------------------------------------------------------------------
-- Único cambio respecto de la versión en prod: el bloque del saldo anterior.
-- El resto (totales del período, INSERT … ON CONFLICT) es copia textual de
-- `sql/contabilidad_fase_a_hardening.sql`.
--
-- `periodo` es TEXT con formato 'YYYY-MM', que ordena lexicográficamente
-- igual que cronológicamente → `periodo < p_periodo ORDER BY periodo DESC`
-- es exactamente "el último mes con fila antes de éste".
CREATE OR REPLACE FUNCTION public.fn_refresh_saldo_periodo(p_cuenta_id uuid, p_periodo text, p_canal text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_debe     NUMERIC(15,2);
    v_total_haber    NUMERIC(15,2);
    v_saldo_anterior NUMERIC(15,2);
    v_saldo_final    NUMERIC(15,2);
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

    -- Saldo anterior = saldo_final del ÚLTIMO periodo con fila anterior a éste.
    -- (Antes buscaba el mes exacto anterior: si esa cuenta no se movía ese mes,
    --  no había fila, el saldo arrancaba en 0 y el acumulado se perdía.)
    SELECT COALESCE(saldo_final, 0) INTO v_saldo_anterior
    FROM saldos_mensuales
    WHERE cuenta_id = p_cuenta_id
      AND canal     = p_canal
      AND periodo   < p_periodo
    ORDER BY periodo DESC
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
$function$;

-- ---------------------------------------------------------------------
-- 2 · Backfill · recalcular lo existente, en orden cronológico
-- ---------------------------------------------------------------------
-- El ORDER BY es lo que hace que funcione: cada período se recalcula después
-- del que le da el arrastre. Sólo toca filas que ya existen (no inventa meses).
DO $$
DECLARE
    r     RECORD;
    n     INT := 0;
BEGIN
    FOR r IN
        SELECT cuenta_id, canal, periodo
          FROM saldos_mensuales
         ORDER BY cuenta_id, canal, periodo
    LOOP
        PERFORM fn_refresh_saldo_periodo(r.cuenta_id, r.periodo, r.canal);
        n := n + 1;
    END LOOP;
    RAISE NOTICE 'T0.6 · % buckets de saldo recalculados', n;
END $$;

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- (a) EL CASO. `1.1.01 / interno / 2026-07` debe quedar en 8.200.000:
--
-- SELECT pc.codigo, sm.canal, sm.periodo, sm.saldo_anterior, sm.saldo_final
--   FROM saldos_mensuales sm JOIN plan_cuentas pc ON pc.id = sm.cuenta_id
--  WHERE pc.codigo = '1.1.01' AND sm.canal = 'interno' ORDER BY sm.periodo;
--
-- (b) NINGUNA serie con arrastre roto. El saldo_anterior de cada fila tiene
--     que ser igual al saldo_final de la fila anterior de su serie, y la
--     primera de cada serie tiene que arrancar en 0. CERO filas:
--
-- WITH s AS (
--   SELECT cuenta_id, canal, periodo, saldo_anterior, saldo_final,
--          LAG(saldo_final) OVER (PARTITION BY cuenta_id, canal ORDER BY periodo) AS prev
--     FROM saldos_mensuales)
-- SELECT * FROM s WHERE saldo_anterior <> COALESCE(prev, 0);
--
-- (c) COHERENCIA CONTRA EL LIBRO. El saldo_final de cada serie tiene que ser
--     igual a la suma de sus asientos vivos. CERO filas:
--
-- WITH ult AS (
--   SELECT DISTINCT ON (cuenta_id, canal) cuenta_id, canal, periodo, saldo_final
--     FROM saldos_mensuales ORDER BY cuenta_id, canal, periodo DESC),
-- real AS (
--   SELECT al.cuenta_id, COALESCE(a.canal,'oficial') canal,
--          SUM(CASE WHEN al.tipo_movimiento='debe' THEN al.monto ELSE -al.monto END) suma
--     FROM asiento_lineas al JOIN asientos a ON a.id = al.asiento_id
--    WHERE a._deleted = false GROUP BY 1,2)
-- SELECT * FROM ult JOIN real USING (cuenta_id, canal)
--  WHERE ABS(ult.saldo_final - real.suma) > 0.01;
--
-- (d) EL NÚMERO QUE VE FEDE. El KPI "Saldo disponible" debe pasar de
--     $4.999.900 a $8.199.900. Se mira en Finanzas → Dashboard (y en el home).
--     No hace falta pull: el JS no cambió, sólo el dato.

-- =====================================================================
-- ROLLBACK de emergencia
-- =====================================================================
-- El cuerpo anterior de `fn_refresh_saldo_periodo` está en
--   sql/contabilidad_fase_a_hardening.sql
-- Volver a ponerlo NO revierte los saldos ya recalculados; para eso habría
-- que volver a correr el backfill con la función vieja.
-- ⚠️ Revertir esto vuelve a esconder los $3.200.000. El número correcto,
--    verificado contra el libro diario, es 8.200.000.
