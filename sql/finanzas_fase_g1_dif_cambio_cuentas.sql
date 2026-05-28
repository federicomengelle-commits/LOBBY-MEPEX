-- ════════════════════════════════════════════════════════════════════════════
--  FASE G.1 — Cuentas contables para diferencia de cambio
-- ════════════════════════════════════════════════════════════════════════════
--
-- Crea las cuentas hoja necesarias para registrar diferencia de cambio cuando
-- se cobra/paga una factura en moneda extranjera con cotización distinta a la
-- del momento de emisión. La función `fn_registrar_diferencia_cambio` (creada
-- en Fase E, E6) recibe estas cuentas como parámetro y arma el asiento.
--
-- Cuentas creadas:
--   4.9      Resultados financieros (grupo)  → si no existía
--   4.9.01   Diferencia de cambio positiva   → hoja imputable, tipo 'ingreso'
--   5.9      Resultados financieros (grupo)  → si no existía
--   5.9.01   Diferencia de cambio negativa   → hoja imputable, tipo 'egreso'
--
-- Idempotente: usa ON CONFLICT (codigo) DO NOTHING. Se puede correr N veces
-- sin efecto si ya existen.
--
-- PRE-REQUISITOS:
--   - Existir nivel 1 codigo '4' tipo 'ingreso'  con naturaleza NOT NULL
--   - Existir nivel 1 codigo '5' tipo 'egreso'   con naturaleza NOT NULL
--   Si alguno falta, el script lanza EXCEPTION y no hace nada.
--
-- Cada bloque corre con su propia transacción implícita (Supabase SQL Editor).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Validación previa con variables escalares (evita ambigüedad de RECORD) ───
DO $$
DECLARE
    v_codigo_4     TEXT;
    v_nombre_4     TEXT;
    v_tipo_4       TEXT;
    v_naturaleza_4 TEXT;
    v_codigo_5     TEXT;
    v_nombre_5     TEXT;
    v_tipo_5       TEXT;
    v_naturaleza_5 TEXT;
BEGIN
    SELECT codigo, nombre, tipo, naturaleza
      INTO v_codigo_4, v_nombre_4, v_tipo_4, v_naturaleza_4
    FROM plan_cuentas
    WHERE codigo = '4' AND _deleted = false
    LIMIT 1;

    SELECT codigo, nombre, tipo, naturaleza
      INTO v_codigo_5, v_nombre_5, v_tipo_5, v_naturaleza_5
    FROM plan_cuentas
    WHERE codigo = '5' AND _deleted = false
    LIMIT 1;

    IF v_codigo_4 IS NULL THEN
        RAISE EXCEPTION '[Fase G.1] No existe cuenta raíz codigo=4 en plan_cuentas. Crear primero.';
    END IF;
    IF v_codigo_5 IS NULL THEN
        RAISE EXCEPTION '[Fase G.1] No existe cuenta raíz codigo=5 en plan_cuentas. Crear primero.';
    END IF;
    IF v_naturaleza_4 IS NULL THEN
        RAISE EXCEPTION '[Fase G.1] Cuenta raíz 4 tiene naturaleza=NULL — corregir antes de continuar.';
    END IF;
    IF v_naturaleza_5 IS NULL THEN
        RAISE EXCEPTION '[Fase G.1] Cuenta raíz 5 tiene naturaleza=NULL — corregir antes de continuar.';
    END IF;

    IF v_tipo_4 <> 'ingreso' THEN
        RAISE WARNING '[Fase G.1] Cuenta raíz 4 tiene tipo=% (esperaba ingreso). 4.9.01 heredará ese tipo.', v_tipo_4;
    END IF;
    IF v_tipo_5 <> 'egreso' THEN
        RAISE WARNING '[Fase G.1] Cuenta raíz 5 tiene tipo=% (esperaba egreso). 5.9.01 heredará ese tipo.', v_tipo_5;
    END IF;

    RAISE NOTICE '[Fase G.1] Raíces verificadas: 4=% (tipo=%, nat=%) · 5=% (tipo=%, nat=%)',
        v_nombre_4, v_tipo_4, v_naturaleza_4,
        v_nombre_5, v_tipo_5, v_naturaleza_5;
END $$;


-- ─── 4.9 Resultados financieros (grupo bajo Ingresos) ───
INSERT INTO plan_cuentas (codigo, codigo_padre, nombre, tipo, naturaleza, nivel, es_grupo, imputable, _deleted)
SELECT '4.9', '4', 'Resultados financieros', tipo, naturaleza, 2, true, false, false
FROM plan_cuentas WHERE codigo = '4' AND _deleted = false
ON CONFLICT (codigo) DO NOTHING;

-- ─── 4.9.01 Diferencia de cambio positiva (hoja imputable) ───
INSERT INTO plan_cuentas (codigo, codigo_padre, nombre, tipo, naturaleza, nivel, es_grupo, imputable, _deleted)
SELECT '4.9.01', '4.9', 'Diferencia de cambio positiva', tipo, naturaleza, 3, false, true, false
FROM plan_cuentas WHERE codigo = '4' AND _deleted = false
ON CONFLICT (codigo) DO NOTHING;


-- ─── 5.9 Resultados financieros (grupo bajo Egresos) ───
INSERT INTO plan_cuentas (codigo, codigo_padre, nombre, tipo, naturaleza, nivel, es_grupo, imputable, _deleted)
SELECT '5.9', '5', 'Resultados financieros', tipo, naturaleza, 2, true, false, false
FROM plan_cuentas WHERE codigo = '5' AND _deleted = false
ON CONFLICT (codigo) DO NOTHING;

-- ─── 5.9.01 Diferencia de cambio negativa (hoja imputable) ───
INSERT INTO plan_cuentas (codigo, codigo_padre, nombre, tipo, naturaleza, nivel, es_grupo, imputable, _deleted)
SELECT '5.9.01', '5.9', 'Diferencia de cambio negativa', tipo, naturaleza, 3, false, true, false
FROM plan_cuentas WHERE codigo = '5' AND _deleted = false
ON CONFLICT (codigo) DO NOTHING;


-- ─── Diagnóstico de cierre con variables escalares ───
DO $$
DECLARE
    v_pos_codigo     TEXT;
    v_pos_nombre     TEXT;
    v_pos_tipo       TEXT;
    v_pos_naturaleza TEXT;
    v_pos_imputable  BOOLEAN;
    v_neg_codigo     TEXT;
    v_neg_nombre     TEXT;
    v_neg_tipo       TEXT;
    v_neg_naturaleza TEXT;
    v_neg_imputable  BOOLEAN;
BEGIN
    SELECT codigo, nombre, tipo, naturaleza, imputable
      INTO v_pos_codigo, v_pos_nombre, v_pos_tipo, v_pos_naturaleza, v_pos_imputable
    FROM plan_cuentas WHERE codigo = '4.9.01' AND _deleted = false LIMIT 1;

    SELECT codigo, nombre, tipo, naturaleza, imputable
      INTO v_neg_codigo, v_neg_nombre, v_neg_tipo, v_neg_naturaleza, v_neg_imputable
    FROM plan_cuentas WHERE codigo = '5.9.01' AND _deleted = false LIMIT 1;

    IF v_pos_codigo IS NULL OR v_neg_codigo IS NULL THEN
        RAISE EXCEPTION '[Fase G.1] FALLA: 4.9.01 o 5.9.01 no fueron creadas.';
    END IF;

    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Fase G.1 — Cuentas dif. cambio listas.';
    RAISE NOTICE '  4.9.01 % (tipo=%, nat=%, imputable=%)', v_pos_nombre, v_pos_tipo, v_pos_naturaleza, v_pos_imputable;
    RAISE NOTICE '  5.9.01 % (tipo=%, nat=%, imputable=%)', v_neg_nombre, v_neg_tipo, v_neg_naturaleza, v_neg_imputable;
    RAISE NOTICE 'Próximo: el JS ya las usa via getCuentasDifCambio() en api.js.';
    RAISE NOTICE '═══════════════════════════════════════════';
END $$;
