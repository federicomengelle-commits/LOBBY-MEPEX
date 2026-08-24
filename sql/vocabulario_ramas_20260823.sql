-- ============================================================================
-- G10 · UN SOLO VOCABULARIO PARA LAS CUATRO RAMAS
-- Fecha: 2026-08-23
-- Autorizado por Fede el 2026-08-20; palabras elegidas el 2026-08-23.
--
-- LAS CUATRO PALABRAS:  Stand · Expo · Equipamiento · Energía
--   (+ Adicionales, que no es una rama sino el cajón de lo que no encaja)
--
-- QUÉ HACE
--   Alinea el `nombre` de las 5 cuentas de venta (4.1.x) con las palabras
--   elegidas, para que la rama se llame IGUAL en la cuenta contable, en la
--   etiqueta de pantalla, en la línea del CRM y en el presupuesto.
--
-- QUÉ NO HACE, A PROPÓSITO
--   · NO toca los códigos de servicio `SRV-*` ni el CHECK de `comprobantes`.
--     Quedan como identificador interno: el usuario nunca los ve (finanzas.js
--     los traduce en los 6 lugares donde se muestran) y migrarlos obligaría a
--     tocar los 2 únicos comprobantes con CAE real de AFIP. Decisión de Fede,
--     2026-08-23, sobre las tres opciones de `docs/handoff-continuar-20260820.md` §1.A.
--   · NO toca las cuentas de costo (5.1.x / 5.2.x): están por NATURALEZA del
--     gasto (materiales, proveedores, logística, mano de obra), no por rama.
--     La rama de un costo se sabe por el proyecto/evento al que se imputa.
--     Verificado el 2026-08-23 contra prod.
--   · NO migra datos de `crm_casos.linea`: los 2 casos con línea cargada
--     ("Stand Collage" = stand, "Expo Prueba 2026" = expo) ya están bien
--     clasificados. Los valores `stand` y `expo` se conservan; se SUMAN
--     `equipamiento` y `energia` desde el JS (no hay CHECK en esa columna).
--
-- SEGURIDAD DEL RENOMBRE
--   `plan_cuentas.nombre` es sólo la etiqueta. La clave del plan es `codigo`
--   y los asientos referencian `cuenta_id` (UUID). Verificado por grep el
--   2026-08-23: NINGÚN JS matchea cuentas por su nombre.
--   (El agrupador de finanzas.js:6423 matchea el CONCEPTO del ingreso, que es
--   texto libre — no el nombre de la cuenta. Se ajusta aparte, en el JS.)
--
-- IDEMPOTENTE: correrlo dos veces deja el mismo resultado.
-- ============================================================================

BEGIN;

-- ── ANTES ──────────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
    RAISE NOTICE '--- Cuentas de venta ANTES ---';
    FOR r IN SELECT codigo, nombre FROM plan_cuentas
             WHERE codigo LIKE '4.1.%' AND _deleted = FALSE ORDER BY codigo
    LOOP
        RAISE NOTICE '  % → %', r.codigo, r.nombre;
    END LOOP;
END $$;

-- ── EL RENOMBRE ────────────────────────────────────────────────────────────
UPDATE plan_cuentas SET nombre = 'Ventas — Stand'        WHERE codigo = '4.1.01' AND _deleted = FALSE;
UPDATE plan_cuentas SET nombre = 'Ventas — Equipamiento' WHERE codigo = '4.1.02' AND _deleted = FALSE;
UPDATE plan_cuentas SET nombre = 'Ventas — Expo'         WHERE codigo = '4.1.03' AND _deleted = FALSE;
UPDATE plan_cuentas SET nombre = 'Ventas — Adicionales'  WHERE codigo = '4.1.04' AND _deleted = FALSE;
UPDATE plan_cuentas SET nombre = 'Ventas — Energía'      WHERE codigo = '4.1.05' AND _deleted = FALSE;

-- ── ASERCIÓN: las 5 quedaron con el nombre nuevo ───────────────────────────
DO $$
DECLARE v_ok INT;
BEGIN
    SELECT count(*) INTO v_ok FROM plan_cuentas
    WHERE _deleted = FALSE AND (codigo, nombre) IN (
        ('4.1.01','Ventas — Stand'),
        ('4.1.02','Ventas — Equipamiento'),
        ('4.1.03','Ventas — Expo'),
        ('4.1.04','Ventas — Adicionales'),
        ('4.1.05','Ventas — Energía')
    );
    IF v_ok <> 5 THEN
        RAISE EXCEPTION 'Se esperaban 5 cuentas de venta renombradas, hay %. Abortado.', v_ok;
    END IF;
    RAISE NOTICE 'OK: las 5 cuentas de venta hablan el vocabulario nuevo.';
END $$;

-- ── ASERCIÓN: no se tocó nada más ──────────────────────────────────────────
-- El mapeo servicio→cuenta sigue apuntando a las mismas 5 cuentas (por UUID,
-- así que el renombre no puede haberlo movido). Se verifica igual: si esta
-- cuenta bajara de 5, el ruteo de facturación estaría roto.
DO $$
DECLARE v_map INT;
BEGIN
    SELECT count(*) INTO v_map
    FROM mapeo_cuentas m
    JOIN plan_cuentas p ON p.id = m.cuenta_contable_id
    WHERE m.campo_origen = 'servicio' AND m._deleted = FALSE
      AND p.codigo LIKE '4.1.%';
    IF v_map <> 5 THEN
        RAISE EXCEPTION 'Los 5 mapeos servicio→cuenta de venta deberían seguir intactos, hay %. Abortado.', v_map;
    END IF;
    RAISE NOTICE 'OK: los 5 mapeos servicio→cuenta intactos.';
END $$;

COMMIT;

-- ── DESPUÉS (correr aparte para ver el resultado) ───────────────────────────
-- SELECT p.codigo, p.nombre, m.valor_origen AS servicio
-- FROM plan_cuentas p
-- LEFT JOIN mapeo_cuentas m ON m.cuenta_contable_id = p.id
--                          AND m.campo_origen = 'servicio' AND m._deleted = FALSE
-- WHERE p.codigo LIKE '4.1.%' AND p._deleted = FALSE ORDER BY p.codigo;

-- ============================================================================
-- ROLLBACK (los nombres anteriores, tal como estaban el 2026-08-23)
-- ============================================================================
-- BEGIN;
-- UPDATE plan_cuentas SET nombre = 'Ventas — Stands'               WHERE codigo = '4.1.01' AND _deleted = FALSE;
-- UPDATE plan_cuentas SET nombre = 'Ventas — Alquileres'           WHERE codigo = '4.1.02' AND _deleted = FALSE;
-- UPDATE plan_cuentas SET nombre = 'Ventas — Estructura Expo'      WHERE codigo = '4.1.03' AND _deleted = FALSE;
-- UPDATE plan_cuentas SET nombre = 'Ventas — Servicios adicionales' WHERE codigo = '4.1.04' AND _deleted = FALSE;
-- UPDATE plan_cuentas SET nombre = 'Ventas — Electricidad'         WHERE codigo = '4.1.05' AND _deleted = FALSE;
-- COMMIT;
