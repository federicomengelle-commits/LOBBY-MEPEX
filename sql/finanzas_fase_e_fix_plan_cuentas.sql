-- =============================================
-- FIX Fase E — Crear cuentas 4.2.02 / 5.4.02
-- =============================================
-- El SQL principal falló en el seed de plan_cuentas porque mi código
-- hardcodeaba tipo='resultado_negativo' / 'resultado_positivo', pero el
-- CHECK de plan_cuentas.tipo en prod usa otros valores.
--
-- Estrategia: leer el `tipo` real de las cuentas raíz ya existentes
-- (4 y 5) y usarlo para las hijas. No asume nada del CHECK.
--
-- Idempotente: solo inserta lo que falta.
-- Ejecutar después del SQL principal de Fase E (que ya creó las ALTER
-- de las 8 tablas + triggers + función, lo único que falló fue el seed).
-- =============================================

DO $$
DECLARE
    v_tipo_pos    TEXT;
    v_tipo_neg    TEXT;
    v_existe      BOOLEAN;
    v_id_4        UUID;
    v_id_5        UUID;
    v_id_42       UUID;
    v_id_54       UUID;
    v_cuenta_id   UUID;
BEGIN
    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    -- 1) Leer tipo real de las cuentas raíz 4 y 5
    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    SELECT id, tipo INTO v_id_4, v_tipo_pos
    FROM plan_cuentas WHERE codigo = '4' AND _deleted = false LIMIT 1;

    SELECT id, tipo INTO v_id_5, v_tipo_neg
    FROM plan_cuentas WHERE codigo = '5' AND _deleted = false LIMIT 1;

    IF v_id_4 IS NULL THEN
        RAISE EXCEPTION 'Cuenta raíz "4" no existe en plan_cuentas. Crear manualmente primero.';
    END IF;
    IF v_id_5 IS NULL THEN
        RAISE EXCEPTION 'Cuenta raíz "5" no existe en plan_cuentas. Crear manualmente primero.';
    END IF;

    RAISE NOTICE '[Fase E fix] Tipos detectados: pos=%, neg=%', v_tipo_pos, v_tipo_neg;

    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    -- 2) 4.2 — Resultados financieros positivos
    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    SELECT id INTO v_id_42 FROM plan_cuentas WHERE codigo = '4.2' AND _deleted = false LIMIT 1;
    IF v_id_42 IS NULL THEN
        INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, codigo_padre, es_grupo, naturaleza, activa, imputable, orden)
        VALUES ('4.2', 'Resultados financieros positivos', v_tipo_pos, 2, '4', true, 'acreedora', true, false, 420)
        RETURNING id INTO v_id_42;
        RAISE NOTICE '[Fase E fix] Cuenta 4.2 creada (tipo=%)', v_tipo_pos;
    ELSE
        RAISE NOTICE '[Fase E fix] Cuenta 4.2 ya existía — skip.';
    END IF;

    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    -- 3) 4.2.02 — Diferencia de cambio positiva
    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    SELECT EXISTS (SELECT 1 FROM plan_cuentas WHERE codigo = '4.2.02' AND _deleted = false) INTO v_existe;
    IF NOT v_existe THEN
        INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, codigo_padre, es_grupo, naturaleza, activa, imputable, orden, notas)
        VALUES ('4.2.02', 'Diferencia de cambio positiva', v_tipo_pos, 3, '4.2', false, 'acreedora', true, true, 422,
                'Ganancia por variación cotización USD/EUR entre emisión y cobro/pago.');
        RAISE NOTICE '[Fase E fix] Cuenta 4.2.02 creada.';
    ELSE
        RAISE NOTICE '[Fase E fix] Cuenta 4.2.02 ya existía — skip.';
    END IF;

    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    -- 4) 5.4 — Resultados financieros negativos
    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    SELECT id INTO v_id_54 FROM plan_cuentas WHERE codigo = '5.4' AND _deleted = false LIMIT 1;
    IF v_id_54 IS NULL THEN
        INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, codigo_padre, es_grupo, naturaleza, activa, imputable, orden)
        VALUES ('5.4', 'Resultados financieros negativos', v_tipo_neg, 2, '5', true, 'deudora', true, false, 540)
        RETURNING id INTO v_id_54;
        RAISE NOTICE '[Fase E fix] Cuenta 5.4 creada (tipo=%)', v_tipo_neg;
    ELSE
        RAISE NOTICE '[Fase E fix] Cuenta 5.4 ya existía — skip.';
    END IF;

    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    -- 5) 5.4.02 — Diferencia de cambio negativa
    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    SELECT EXISTS (SELECT 1 FROM plan_cuentas WHERE codigo = '5.4.02' AND _deleted = false) INTO v_existe;
    IF NOT v_existe THEN
        INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, codigo_padre, es_grupo, naturaleza, activa, imputable, orden, notas)
        VALUES ('5.4.02', 'Diferencia de cambio negativa', v_tipo_neg, 3, '5.4', false, 'deudora', true, true, 542,
                'Pérdida por variación cotización USD/EUR entre emisión y cobro/pago.');
        RAISE NOTICE '[Fase E fix] Cuenta 5.4.02 creada.';
    ELSE
        RAISE NOTICE '[Fase E fix] Cuenta 5.4.02 ya existía — skip.';
    END IF;

    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    -- 6) Mapeos en mapeo_cuentas
    -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    SELECT id INTO v_cuenta_id FROM plan_cuentas WHERE codigo = '4.2.02' AND _deleted = false LIMIT 1;
    IF v_cuenta_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM mapeo_cuentas WHERE clave = 'dif_cambio_positiva' AND _deleted = false) THEN
            INSERT INTO mapeo_cuentas (clave, cuenta_id, descripcion)
            VALUES ('dif_cambio_positiva', v_cuenta_id, 'Ganancia por diferencia de cambio (moneda extranjera).');
            RAISE NOTICE '[Fase E fix] Mapeo "dif_cambio_positiva" creado.';
        END IF;
    END IF;

    SELECT id INTO v_cuenta_id FROM plan_cuentas WHERE codigo = '5.4.02' AND _deleted = false LIMIT 1;
    IF v_cuenta_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM mapeo_cuentas WHERE clave = 'dif_cambio_negativa' AND _deleted = false) THEN
            INSERT INTO mapeo_cuentas (clave, cuenta_id, descripcion)
            VALUES ('dif_cambio_negativa', v_cuenta_id, 'Pérdida por diferencia de cambio (moneda extranjera).');
            RAISE NOTICE '[Fase E fix] Mapeo "dif_cambio_negativa" creado.';
        END IF;
    END IF;
END $$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Verificación final
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO $$
DECLARE
    v_cuentas_diff INT;
    v_mapeos_diff  INT;
BEGIN
    SELECT COUNT(*) INTO v_cuentas_diff
    FROM plan_cuentas
    WHERE codigo IN ('4.2', '4.2.02', '5.4', '5.4.02') AND _deleted = false;

    SELECT COUNT(*) INTO v_mapeos_diff
    FROM mapeo_cuentas
    WHERE clave IN ('dif_cambio_positiva', 'dif_cambio_negativa') AND _deleted = false;

    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'Fase E fix completado.';
    RAISE NOTICE '  Cuentas de dif. cambio en plan_cuentas: % de 4', v_cuentas_diff;
    RAISE NOTICE '  Mapeos en mapeo_cuentas:                 % de 2', v_mapeos_diff;
    IF v_cuentas_diff = 4 AND v_mapeos_diff = 2 THEN
        RAISE NOTICE '  ✓ TODO OK. Fase E completa.';
    ELSE
        RAISE WARNING '  ⚠ Faltan elementos. Revisar.';
    END IF;
    RAISE NOTICE '═══════════════════════════════════════════';
END $$;
