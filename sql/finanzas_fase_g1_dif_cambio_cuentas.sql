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
--   - Existir nivel 1 codigo '4' tipo 'ingreso'
--   - Existir nivel 1 codigo '5' tipo 'egreso'
--   Si alguno falta, el script lanza EXCEPTION y no hace nada.
--
-- POST: ejecutar diagnóstico al final del DO $$ block (RAISE NOTICE).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Validación previa: las raíces 4 y 5 tienen que existir.
DO $$
DECLARE
    v_raiz_4 RECORD;
    v_raiz_5 RECORD;
BEGIN
    SELECT codigo, nombre, tipo INTO v_raiz_4
    FROM plan_cuentas
    WHERE codigo = '4' AND _deleted = false
    LIMIT 1;

    SELECT codigo, nombre, tipo INTO v_raiz_5
    FROM plan_cuentas
    WHERE codigo = '5' AND _deleted = false
    LIMIT 1;

    IF v_raiz_4.codigo IS NULL THEN
        RAISE EXCEPTION '[Fase G.1] No existe cuenta raíz codigo=4 en plan_cuentas. Crear primero.';
    END IF;
    IF v_raiz_5.codigo IS NULL THEN
        RAISE EXCEPTION '[Fase G.1] No existe cuenta raíz codigo=5 en plan_cuentas. Crear primero.';
    END IF;

    IF v_raiz_4.tipo <> 'ingreso' THEN
        RAISE WARNING '[Fase G.1] Cuenta raíz 4 tiene tipo=% (esperaba ingreso). 4.9.01 heredará ese tipo.', v_raiz_4.tipo;
    END IF;
    IF v_raiz_5.tipo <> 'egreso' THEN
        RAISE WARNING '[Fase G.1] Cuenta raíz 5 tiene tipo=% (esperaba egreso). 5.9.01 heredará ese tipo.', v_raiz_5.tipo;
    END IF;

    RAISE NOTICE '[Fase G.1] Raíces verificadas: 4=% (%) · 5=% (%)',
        v_raiz_4.nombre, v_raiz_4.tipo, v_raiz_5.nombre, v_raiz_5.tipo;
END $$;


-- ─── 4.9 Resultados financieros (grupo bajo Ingresos) ───
INSERT INTO plan_cuentas (codigo, codigo_padre, nombre, tipo, nivel, es_grupo, imputable, _deleted)
SELECT '4.9', '4', 'Resultados financieros', tipo, 2, true, false, false
FROM plan_cuentas WHERE codigo = '4' AND _deleted = false
ON CONFLICT (codigo) DO NOTHING;

-- ─── 4.9.01 Diferencia de cambio positiva (hoja imputable) ───
INSERT INTO plan_cuentas (codigo, codigo_padre, nombre, tipo, nivel, es_grupo, imputable, _deleted)
SELECT '4.9.01', '4.9', 'Diferencia de cambio positiva', tipo, 3, false, true, false
FROM plan_cuentas WHERE codigo = '4' AND _deleted = false
ON CONFLICT (codigo) DO NOTHING;


-- ─── 5.9 Resultados financieros (grupo bajo Egresos) ───
INSERT INTO plan_cuentas (codigo, codigo_padre, nombre, tipo, nivel, es_grupo, imputable, _deleted)
SELECT '5.9', '5', 'Resultados financieros', tipo, 2, true, false, false
FROM plan_cuentas WHERE codigo = '5' AND _deleted = false
ON CONFLICT (codigo) DO NOTHING;

-- ─── 5.9.01 Diferencia de cambio negativa (hoja imputable) ───
INSERT INTO plan_cuentas (codigo, codigo_padre, nombre, tipo, nivel, es_grupo, imputable, _deleted)
SELECT '5.9.01', '5.9', 'Diferencia de cambio negativa', tipo, 3, false, true, false
FROM plan_cuentas WHERE codigo = '5' AND _deleted = false
ON CONFLICT (codigo) DO NOTHING;


-- ─── Diagnóstico de cierre ───
DO $$
DECLARE
    v_pos RECORD;
    v_neg RECORD;
BEGIN
    SELECT codigo, nombre, tipo, imputable INTO v_pos
    FROM plan_cuentas WHERE codigo = '4.9.01' AND _deleted = false LIMIT 1;

    SELECT codigo, nombre, tipo, imputable INTO v_neg
    FROM plan_cuentas WHERE codigo = '5.9.01' AND _deleted = false LIMIT 1;

    IF v_pos.codigo IS NULL OR v_neg.codigo IS NULL THEN
        RAISE EXCEPTION '[Fase G.1] FALLA: 4.9.01 o 5.9.01 no fueron creadas.';
    END IF;

    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Fase G.1 — Cuentas dif. cambio listas.';
    RAISE NOTICE '  ✓ 4.9.01 % (tipo=%, imputable=%)', v_pos.nombre, v_pos.tipo, v_pos.imputable;
    RAISE NOTICE '  ✓ 5.9.01 % (tipo=%, imputable=%)', v_neg.nombre, v_neg.tipo, v_neg.imputable;
    RAISE NOTICE '';
    RAISE NOTICE 'Próximo: usar estos UUIDs en el front al llamar';
    RAISE NOTICE 'fn_registrar_diferencia_cambio(...) desde el JS de cobros.';
    RAISE NOTICE '═══════════════════════════════════════════';
END $$;

COMMIT;
