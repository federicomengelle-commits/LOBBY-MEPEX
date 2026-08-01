-- =====================================================================
-- T0.7 · El mapeo genérico de egresos que no existe
-- Auditoría 2026-07-31 · hallazgo A11
-- =====================================================================
--
-- PROBLEMA
--   `fn_asiento_auto_egreso` busca la cuenta de gasto así:
--
--       AND ((campo_origen = 'categoria' AND valor_origen = NEW.categoria)
--            OR (campo_origen IS NULL))
--       ORDER BY CASE WHEN campo_origen IS NOT NULL THEN 1 ELSE 2 END
--
--   La segunda rama es el fallback… y **`mapeo_cuentas.campo_origen` es
--   NOT NULL** (verificado en prod). O sea: el fallback es inalcanzable por
--   schema. Nunca puede matchear. Es código que parece una red y no lo es.
--
--   Consecuencia: si el mapeo específico de una categoría no está —hoy
--   están las 8, pero el tab Mapeos deja desactivar y borrar— esos egresos
--   **se pagan sin generar asiento**, con un `RAISE NOTICE` que no lee nadie.
--   La plata sale de Finanzas y la Contabilidad ni se entera: partida doble
--   rota, en silencio, sin que ningún reporte lo muestre.
--
--   El camino de INGRESO sí tiene su red: hay un mapeo
--   `ingreso / default / default → 2.1.06 Anticipos de clientes`. El de
--   egreso quedó a medio hacer.
--
-- ESTADO EN PROD (verificado 2026-08-01)
--   Las 8 categorías del CHECK de `egresos` (proveedor · rrhh · impuesto ·
--   servicio · credito_fiscal · alquiler · logistica · otro) están las 8
--   mapeadas. O sea: hoy no hay ningún egreso huérfano. Esto es una red
--   preventiva, no la reparación de un daño consumado.
--
-- QUÉ HACE ESTE ARCHIVO
--   1. Crea el mapeo `egreso / default / default → 5.2.11 Gastos varios`,
--      espejando el que ya existe del lado de ingreso.
--   2. Corrige el lookup de `fn_asiento_auto_egreso` para que lo alcance.
--   3. Blinda los dos mapeos default con un trigger: no se pueden desactivar
--      ni borrar. (El plan proponía hacerlo en la UI del tab Mapeos; hacerlo
--      en la base es más fuerte — no se puede saltear desde la consola, y de
--      paso deja Tanda 0 sin necesidad de tocar JS.)
--
-- POR QUÉ 5.2.11 "Gastos varios"
--   Es la misma cuenta a la que ya apunta `categoria='otro'`. Un egreso sin
--   mapeo aterriza en Gastos varios: queda visible en el Estado de
--   Resultados y la partida doble cierra. Es estrictamente mejor que hoy,
--   que es "no existe el asiento".
--
-- ⚠️ VA CON UN CAMBIO DE JS (excepción a "Tanda 0 no toca la interfaz")
--   `contabilidad.js _saveMapeo()` armaba el mapeo genérico de EGRESO con
--   `campo_origen: null` — y la columna es NOT NULL. O sea: guardar un mapeo
--   genérico de egreso desde el tab Mapeos **fallaba siempre**, desde antes de
--   esta migración (la rama de ingreso sí mandaba 'default'/'default'; era una
--   asimetría entre las dos ramas del mismo switch). Hasta hoy no se notaba
--   porque no existía ninguna fila default de egreso para editar; en cuanto
--   este archivo la crea, el bug queda a un clic de distancia.
--   → `contabilidad.js?v=18` (bump en `App._APP_SCRIPTS`). Fede tiene que
--     pullear para tomarlo; el SQL funciona igual sin el pull.
--
-- IDEMPOTENTE: sí. REVERSIBLE: sí, ver el pie.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · El mapeo default de egreso
-- ---------------------------------------------------------------------
INSERT INTO mapeo_cuentas (tipo_movimiento, campo_origen, valor_origen, cuenta_contable_id, posicion, descripcion, activo, _deleted)
SELECT 'egreso', 'default', 'default', pc.id, 'debe',
       'Red de seguridad: egreso sin mapeo de categoría. NO borrar ni desactivar.',
       true, false
  FROM plan_cuentas pc
 WHERE pc.codigo = '5.2.11' AND COALESCE(pc._deleted, false) = false
   AND COALESCE(pc.activa, true) AND COALESCE(pc.es_grupo, false) = false
   AND NOT EXISTS (
       SELECT 1 FROM mapeo_cuentas m
        WHERE m.tipo_movimiento = 'egreso' AND m.campo_origen = 'default'
          AND COALESCE(m._deleted, false) = false)
 LIMIT 1;

-- Si la cuenta 5.2.11 no existiera, el INSERT no inserta nada y el resto del
-- archivo dejaría el fallback apuntando al vacío. Cortamos acá antes que eso.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM mapeo_cuentas
                    WHERE tipo_movimiento='egreso' AND campo_origen='default'
                      AND activo AND NOT _deleted) THEN
        RAISE EXCEPTION 'T0.7 abortado: no se pudo crear el mapeo default de egreso (¿existe la cuenta 5.2.11?)';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · fn_asiento_auto_egreso · que el fallback sea alcanzable
-- ---------------------------------------------------------------------
-- Cambio ÚNICO respecto de la versión en prod: las dos líneas del lookup
-- (`campo_origen IS NULL` → `campo_origen = 'default'`, y el ORDER BY
-- correspondiente). Todo el resto —Fase 4 de cartera/cheques, desglose de
-- IVA, moneda extranjera, las 3 líneas del asiento— es copia textual.
CREATE OR REPLACE FUNCTION public.fn_asiento_auto_egreso()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_cuenta_activo  UUID;
    v_cuenta_gasto   UUID;
    v_cuenta_iva     UUID;
    v_cuenta_valor   UUID;                 -- FASE 4
    v_asiento_id     UUID;
    v_desc           TEXT;
    v_monto_asiento  NUMERIC(15,2);
    v_comp_iva       NUMERIC(15,2);
    v_comp_total     NUMERIC(15,2);
    v_iva            NUMERIC(15,2) := 0;
BEGIN
    IF NEW.estado IS DISTINCT FROM 'pagado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'pagado' THEN RETURN NEW; END IF;

    -- ── FASE 4: derivar la pata de tesorería según el instrumento. El banco se
    --    mueve recién en el clearing del valor. El resto del cuerpo queda IGUAL.
    --   (a) ENDOSO (cartera_valor_id): el egreso endosa un valor RECIBIDO → sale
    --       de cartera 1.1.07 (cheque físico o e-cheq de tercero). NO usa banco.
    IF NEW.cartera_valor_id IS NOT NULL THEN
        SELECT id INTO v_cuenta_activo FROM plan_cuentas WHERE codigo = '1.1.07' AND _deleted = false LIMIT 1;
        IF v_cuenta_activo IS NULL THEN
            RAISE NOTICE '[Contabilidad] Cuenta 1.1.07 no encontrada — endoso % sin asiento.', NEW.id;
            RETURN NEW;
        END IF;
    ELSE
        -- (normal) la tesorería sale del banco (requiere cuenta_id)
        IF NEW.cuenta_id IS NULL THEN
            RAISE NOTICE '[Contabilidad] Egreso % sin cuenta_id — sin asiento.', NEW.id;
            RETURN NEW;
        END IF;
        SELECT id INTO v_cuenta_activo
        FROM plan_cuentas
        WHERE cuenta_financiera_id = NEW.cuenta_id AND _deleted = false
        LIMIT 1;
        IF v_cuenta_activo IS NULL THEN
            RAISE WARNING '[Contabilidad] Egreso %: cuenta financiera % sin vínculo contable.', NEW.id, NEW.cuenta_id;
            RETURN NEW;
        END IF;
        --   (b) EMISIÓN: cheque/e-cheq propio (medio='cheque') → pasivo diferido 2.1.07.
        IF NEW.medio = 'cheque' THEN
            SELECT id INTO v_cuenta_valor FROM plan_cuentas WHERE codigo = '2.1.07' AND _deleted = false LIMIT 1;
            IF v_cuenta_valor IS NOT NULL THEN v_cuenta_activo := v_cuenta_valor; END IF;
        END IF;
    END IF;

    -- Match por categoría primero, después el genérico.
    -- ⚠️ El fallback va por `campo_origen = 'default'`, NO por `IS NULL`:
    --    la columna es NOT NULL, así que la versión anterior nunca matcheaba
    --    y un egreso sin mapeo se pagaba SIN asiento (A11).
    SELECT cuenta_contable_id INTO v_cuenta_gasto
    FROM mapeo_cuentas
    WHERE tipo_movimiento = 'egreso' AND activo = true AND _deleted = false
      AND ((campo_origen = 'categoria' AND valor_origen = NEW.categoria)
           OR campo_origen = 'default')
    ORDER BY CASE WHEN campo_origen = 'categoria' THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_cuenta_gasto IS NULL THEN
        RAISE NOTICE '[Contabilidad] No hay mapeo para egreso categoria=%. Egreso % sin asiento.', NEW.categoria, NEW.id;
        RETURN NEW;
    END IF;

    -- Si ganó el genérico, el asiento sale igual y balanceado — pero apuntando a
    -- una cuenta que NO es la que corresponde a esa categoría. Sin esta señal es
    -- indistinguible de un match correcto. WARNING (no NOTICE) para que quede en
    -- los logs de Supabase: significa "falta un mapeo específico", no "todo bien".
    IF NOT EXISTS (
        SELECT 1 FROM mapeo_cuentas
         WHERE tipo_movimiento = 'egreso' AND activo AND NOT _deleted
           AND campo_origen = 'categoria' AND valor_origen = NEW.categoria
    ) THEN
        RAISE WARNING '[Contabilidad] Egreso % (categoria=%) cayó al mapeo GENÉRICO. Falta el mapeo específico de esa categoría.', NEW.id, NEW.categoria;
    END IF;

    v_monto_asiento := COALESCE(NEW.total_en_ars, NEW.monto);

    IF NEW.comprobante_recibido_id IS NOT NULL THEN
        SELECT iva, total INTO v_comp_iva, v_comp_total
        FROM comprobantes_recibidos
        WHERE id = NEW.comprobante_recibido_id AND _deleted = false;
        IF COALESCE(v_comp_iva, 0) > 0 AND COALESCE(v_comp_total, 0) > 0 THEN
            SELECT id INTO v_cuenta_iva FROM plan_cuentas WHERE codigo = '1.1.09' AND _deleted = false LIMIT 1;
            IF v_cuenta_iva IS NOT NULL THEN
                v_iva := ROUND(v_monto_asiento * (v_comp_iva / v_comp_total), 2);
            ELSE
                RAISE NOTICE '[Contabilidad] Cuenta IVA crédito 1.1.09 no encontrada — egreso % sin desglose IVA.', NEW.id;
            END IF;
        END IF;
    END IF;

    v_desc := 'Egreso: ' || COALESCE(NEW.concepto, 'Sin concepto');
    IF NEW.cartera_valor_id IS NOT NULL THEN v_desc := v_desc || ' [endoso de valor]';       -- FASE 4
    ELSIF NEW.medio = 'cheque' THEN v_desc := v_desc || ' [cheque diferido]'; END IF;
    IF NEW.moneda IS NOT NULL AND NEW.moneda <> 'ARS' THEN
        v_desc := v_desc || ' [' || NEW.moneda || ' ' || NEW.monto::TEXT || ' @ ' || NEW.cotizacion::TEXT || ']';
    END IF;

    INSERT INTO asientos (fecha, concepto, tipo, egreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'),
            v_monto_asiento, v_monto_asiento, COALESCE(NEW.moneda,'ARS'), COALESCE(NEW.cotizacion,1))
    RETURNING id INTO v_asiento_id;

    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_gasto, 'debe', v_monto_asiento - v_iva, v_desc, 1);

    IF v_iva > 0 THEN
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_iva, 'debe', v_iva, 'IVA crédito fiscal', 2);
    END IF;

    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'haber', v_monto_asiento, v_desc, 3);

    RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- 3 · Blindar los mapeos default
-- ---------------------------------------------------------------------
-- El tab Mapeos de Contabilidad deja borrar y desactivar cualquier fila. Si
-- alguien voltea el default, vuelve el agujero — y de la peor manera: en
-- silencio. Se bloquea en la base, no en la UI.
-- Se permite CAMBIAR a qué cuenta apunta (eso es configuración legítima);
-- lo que no se permite es dejarlo sin efecto.
--
-- ⚠️ El guard NO alcanza con mirar `activo`/`_deleted`: desde el tab Mapeos se
--    puede editar la "Regla de match" de Genérico a "Por categoría", lo que
--    convertiría la fila default en otra específica y **haría desaparecer el
--    default sin desactivar nada**. Por eso se congelan también
--    `campo_origen`, `valor_origen` y `tipo_movimiento`.
CREATE OR REPLACE FUNCTION public.fn_mapeo_default_protegido()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.campo_origen = 'default' THEN
            RAISE EXCEPTION 'El mapeo genérico de % es la red de seguridad de la contabilidad: sin él, los movimientos sin mapeo se registran sin asiento. Se puede cambiar la cuenta a la que apunta, no borrarlo.', OLD.tipo_movimiento
              USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.campo_origen = 'default' AND (
           NEW.activo = false
        OR NEW._deleted = true
        OR NEW.campo_origen    IS DISTINCT FROM 'default'
        OR NEW.valor_origen    IS DISTINCT FROM 'default'
        OR NEW.tipo_movimiento IS DISTINCT FROM OLD.tipo_movimiento
    ) THEN
        RAISE EXCEPTION 'El mapeo genérico de % no se puede desactivar, borrar ni convertir en específico. Lo único editable es la cuenta contable a la que apunta.', OLD.tipo_movimiento
          USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

-- Y que no puedan existir DOS defaults del mismo tipo: con dos filas activas,
-- el `LIMIT 1` del lookup no tiene desempate y elegiría cualquiera.
-- (El trigger es BEFORE UPDATE/DELETE, no cubre INSERT — esto sí.)
CREATE UNIQUE INDEX IF NOT EXISTS ux_mapeo_default_unico
    ON public.mapeo_cuentas (tipo_movimiento)
    WHERE campo_origen = 'default' AND activo AND NOT _deleted;

REVOKE ALL ON FUNCTION public.fn_mapeo_default_protegido() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_mapeo_default_protegido ON public.mapeo_cuentas;
CREATE TRIGGER trg_mapeo_default_protegido
    BEFORE UPDATE OR DELETE ON public.mapeo_cuentas
    FOR EACH ROW EXECUTE FUNCTION public.fn_mapeo_default_protegido();

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- (a) Existen los DOS mapeos default (ingreso y egreso). Debe dar 2 filas:
--
-- SELECT m.tipo_movimiento, pc.codigo, pc.nombre, m.posicion
--   FROM mapeo_cuentas m JOIN plan_cuentas pc ON pc.id = m.cuenta_contable_id
--  WHERE m.campo_origen = 'default' AND m.activo AND NOT m._deleted;
--
-- (b) El default no se puede voltear. Las dos tienen que fallar con 23514:
--
-- UPDATE mapeo_cuentas SET activo = false WHERE campo_origen='default';
-- DELETE FROM mapeo_cuentas WHERE campo_origen='default';
--
-- (c) Cambiar la cuenta del default SÍ tiene que poder (probar y revertir).
--
-- (d) PRUEBA FUNCIONAL — el fallback agarra de verdad. En una transacción
--     con ROLLBACK: desactivar el mapeo de una categoría, pagar un egreso de
--     esa categoría, y confirmar que el asiento se genera igual apuntando a
--     `5.2.11 Gastos varios` en vez de no generarse. (Corrida en el tracker.)

-- =====================================================================
-- ROLLBACK de emergencia
-- =====================================================================
-- DROP TRIGGER IF EXISTS trg_mapeo_default_protegido ON public.mapeo_cuentas;
-- DROP FUNCTION IF EXISTS public.fn_mapeo_default_protegido();
-- DELETE FROM mapeo_cuentas WHERE tipo_movimiento='egreso' AND campo_origen='default';
-- El cuerpo anterior de fn_asiento_auto_egreso: volver las 2 líneas del
--   lookup a `OR (campo_origen IS NULL)` y
--   `ORDER BY CASE WHEN campo_origen IS NOT NULL THEN 1 ELSE 2 END`.
-- ⚠️ Revertir devuelve el agujero: egresos pagados sin asiento, sin aviso.
