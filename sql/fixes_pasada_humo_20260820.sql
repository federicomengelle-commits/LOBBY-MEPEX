-- =====================================================================
-- FIXES de la pasada de humo del 2026-08-20
-- =====================================================================
-- Origen: 10 casos end-to-end (stand / expo / alquiler / electricidad /
-- compra / tesorería) recorriendo los 16 eslabones del proceso MEPEX.
-- Hallazgos completos en PENDIENTES.md §H.
--
-- Los 4 arreglos son ADITIVOS y RETROCOMPATIBLES: si algo no se aplica,
-- el sistema se comporta exactamente como antes.
--
-- F1 · Electricidad como rama fiscal propia          (hallazgo H6)
-- F2 · Costo directo vs. gasto de estructura         (hallazgo H4)
-- F3 · El proyecto que nace de una cotización        (hallazgo H3)
-- F4 · Sync cuota<->cobro por el camino legacy       (hallazgo H5)
--
-- Rollback al pie.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- F1 · Electricidad como rama fiscal propia  (H6)
-- ---------------------------------------------------------------------
-- Hoy la instalación eléctrica se factura como SRV-ADIC y cae en
-- "Ventas — Servicios adicionales", mezclada con cualquier otro adicional
-- → su rentabilidad no se puede medir por separado.
-- Fede definió el 2026-08-19 que electricidad es una RAMA del negocio
-- (stand / expo / alquiler / electricidad), no un rubro.

INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, codigo_padre, es_grupo,
                          naturaleza, activa, orden, imputable)
SELECT '4.1.05', 'Ventas — Electricidad', 'ingreso', 3, '4.1', false,
       'acreedora', true, 415, true
WHERE NOT EXISTS (SELECT 1 FROM plan_cuentas WHERE codigo = '4.1.05');

-- Ampliar el CHECK de servicio (drop + add: no hay forma de "extender" un CHECK)
ALTER TABLE comprobantes DROP CONSTRAINT IF EXISTS comprobantes_servicio_check;
ALTER TABLE comprobantes ADD CONSTRAINT comprobantes_servicio_check
  CHECK (servicio = ANY (ARRAY['SRV-STAND','SRV-ALQUILER','SRV-EXPO','SRV-ELEC','SRV-ADIC']));

INSERT INTO mapeo_cuentas (tipo_movimiento, campo_origen, valor_origen,
                           cuenta_contable_id, posicion, descripcion, activo)
SELECT 'ingreso', 'servicio', 'SRV-ELEC', pc.id, 'haber',
       'Ventas de instalación eléctrica (rama propia desde 2026-08-20)', true
FROM plan_cuentas pc
WHERE pc.codigo = '4.1.05'
  AND NOT EXISTS (SELECT 1 FROM mapeo_cuentas
                   WHERE tipo_movimiento='ingreso' AND campo_origen='servicio'
                     AND valor_origen='SRV-ELEC' AND _deleted=false);

-- ---------------------------------------------------------------------
-- F2 · Costo directo vs. gasto de estructura  (H4)
-- ---------------------------------------------------------------------
-- El plan de cuentas separa 5.1.xx (costos directos) de 5.2.xx (estructura),
-- pero el mapeo no lo implementaba: un subalquiler de mobiliario para un
-- stand se contabilizaba en "5.2.02 Alquiler oficina", y los jornales de un
-- evento en "5.2.01 Sueldos". Efecto: infla el gasto fijo y subestima el
-- costo del evento — el margen sale mal por los dos lados. Además dejaba
-- huérfana la cuenta 5.1.04 "Mano de obra directa (jornales)", que existe
-- desde el diseño del plan y nunca recibió un movimiento.
--
-- Discriminante: un egreso imputado a un proyecto o a un evento es costo
-- directo; sin imputación, es estructura. No cambia cómo carga la gente.
--
-- Se agrega el campo_origen 'categoria_directo', que sólo se consulta
-- cuando hay imputación. Si no existe la fila, cae al comportamiento
-- anterior → retrocompatible.

INSERT INTO mapeo_cuentas (tipo_movimiento, campo_origen, valor_origen,
                           cuenta_contable_id, posicion, descripcion, activo)
SELECT 'egreso', 'categoria_directo', v.cat, pc.id, 'debe', v.desc_, true
FROM (VALUES
  ('rrhh',     '5.1.04', 'Jornales imputados a un proyecto/evento = mano de obra directa'),
  ('alquiler', '5.1.02', 'Subalquiler imputado a un proyecto/evento = costo directo, no alquiler de oficina')
) v(cat, codigo, desc_)
JOIN plan_cuentas pc ON pc.codigo = v.codigo AND pc._deleted = false
WHERE NOT EXISTS (SELECT 1 FROM mapeo_cuentas m
                   WHERE m.tipo_movimiento='egreso' AND m.campo_origen='categoria_directo'
                     AND m.valor_origen = v.cat AND m._deleted = false);

CREATE OR REPLACE FUNCTION public.fn_asiento_auto_egreso()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_cuenta_activo UUID; v_cuenta_gasto UUID; v_cuenta_iva UUID; v_cuenta_valor UUID;
    v_asiento_id UUID; v_desc TEXT; v_monto_asiento NUMERIC(15,2);
    v_comp_iva NUMERIC(15,2); v_comp_total NUMERIC(15,2); v_iva NUMERIC(15,2) := 0;
    v_directo BOOLEAN; v_origen_usado TEXT;
BEGIN
    IF NEW.estado IS DISTINCT FROM 'pagado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'pagado' THEN RETURN NEW; END IF;

    IF NEW.cartera_valor_id IS NOT NULL THEN
        SELECT id INTO v_cuenta_activo FROM plan_cuentas WHERE codigo='1.1.07' AND _deleted=false LIMIT 1;
        IF v_cuenta_activo IS NULL THEN
            RAISE NOTICE '[Contabilidad] Cuenta 1.1.07 no encontrada — endoso % sin asiento.', NEW.id;
            RETURN NEW;
        END IF;
    ELSE
        IF NEW.cuenta_id IS NULL THEN
            RAISE NOTICE '[Contabilidad] Egreso % sin cuenta_id — sin asiento.', NEW.id;
            RETURN NEW;
        END IF;
        SELECT id INTO v_cuenta_activo FROM plan_cuentas
         WHERE cuenta_financiera_id = NEW.cuenta_id AND _deleted=false LIMIT 1;
        IF v_cuenta_activo IS NULL THEN
            RAISE WARNING '[Contabilidad] Egreso %: cuenta financiera % sin vínculo contable.', NEW.id, NEW.cuenta_id;
            RETURN NEW;
        END IF;
        IF NEW.medio = 'cheque' THEN
            SELECT id INTO v_cuenta_valor FROM plan_cuentas WHERE codigo='2.1.07' AND _deleted=false LIMIT 1;
            IF v_cuenta_valor IS NOT NULL THEN v_cuenta_activo := v_cuenta_valor; END IF;
        END IF;
    END IF;

    -- ⬇ NUEVO (F2): imputado a un proyecto o evento = costo directo
    v_directo := (NEW.proyecto_id IS NOT NULL OR NEW.evento_id IS NOT NULL);

    SELECT cuenta_contable_id, campo_origen INTO v_cuenta_gasto, v_origen_usado
    FROM mapeo_cuentas
    WHERE tipo_movimiento='egreso' AND activo=true AND _deleted=false
      AND (   (v_directo AND campo_origen='categoria_directo' AND valor_origen=NEW.categoria)
           OR (campo_origen='categoria' AND valor_origen=NEW.categoria)
           OR  campo_origen='default')
    ORDER BY CASE campo_origen
               WHEN 'categoria_directo' THEN 1
               WHEN 'categoria'         THEN 2
               ELSE 3 END
    LIMIT 1;

    IF v_cuenta_gasto IS NULL THEN
        RAISE NOTICE '[Contabilidad] No hay mapeo para egreso categoria=%. Egreso % sin asiento.', NEW.categoria, NEW.id;
        RETURN NEW;
    END IF;

    -- El WARNING mira qué mapeo se USÓ, no cuáles existen: si sólo hubiera una
    -- fila 'categoria_directo' y llegara un egreso sin imputar, el lookup cae al
    -- generico y con un EXISTS el aviso se perdía.
    IF v_origen_usado = 'default' THEN
        RAISE WARNING '[Contabilidad] Egreso % (categoria=%) cayó al mapeo GENERICO. Falta el mapeo especifico de esa categoria.', NEW.id, NEW.categoria;
    END IF;

    v_monto_asiento := COALESCE(NEW.total_en_ars, NEW.monto);

    IF NEW.comprobante_recibido_id IS NOT NULL THEN
        SELECT iva, total INTO v_comp_iva, v_comp_total FROM comprobantes_recibidos
         WHERE id = NEW.comprobante_recibido_id AND _deleted=false;
        IF COALESCE(v_comp_iva,0) > 0 AND COALESCE(v_comp_total,0) > 0 THEN
            SELECT id INTO v_cuenta_iva FROM plan_cuentas WHERE codigo='1.1.09' AND _deleted=false LIMIT 1;
            IF v_cuenta_iva IS NOT NULL THEN
                v_iva := ROUND(v_monto_asiento * (v_comp_iva / v_comp_total), 2);
            ELSE
                RAISE NOTICE '[Contabilidad] Cuenta IVA crédito 1.1.09 no encontrada — egreso % sin desglose IVA.', NEW.id;
            END IF;
        END IF;
    END IF;

    v_desc := 'Egreso: ' || COALESCE(NEW.concepto, 'Sin concepto');
    IF NEW.cartera_valor_id IS NOT NULL THEN v_desc := v_desc || ' [endoso de valor]';
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
-- F3 · El proyecto que nace de una cotización aprobada  (H3)
-- ---------------------------------------------------------------------
-- Verificado el 2026-08-20: el proyecto nacía con el nombre del EVENTO
-- (tres stands de la misma expo → tres proyectos llamados igual), sin
-- `tipo` (se perdía la rama del negocio) y sin responsable. Además
-- escribía `proyecto_tipos` desde NEW.tipo_evento, que viene NULL siempre,
-- y el `EXCEPTION WHEN OTHERS THEN NULL` se tragaba el fallo en silencio.
--
-- Cambios: nombre <tipo> <cliente> — <evento> · copia tipo_cotizacion a
-- proyectos.tipo · hereda el vendedor como responsable · el EXCEPTION
-- ahora avisa por WARNING en vez de callar.

CREATE OR REPLACE FUNCTION public.trigger_cotizacion_aprobada_crea_proyecto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_nuevo_proyecto_id UUID;
    v_nombre TEXT;
    v_cliente TEXT;
    v_rama   TEXT;
BEGIN
    IF NEW.estado = 'aprobada' AND (OLD.estado IS NULL OR OLD.estado != 'aprobada') THEN

        IF NEW.project_id IS NOT NULL THEN
            RETURN NEW;
        END IF;

        IF EXISTS (SELECT 1 FROM proyectos
                    WHERE cotizacion_id = NEW.id AND _deleted = FALSE) THEN
            RETURN NEW;
        END IF;

        SELECT NULLIF(TRIM(nombre_empresa), '') INTO v_cliente
          FROM clientes WHERE id = NEW.cliente_id;

        -- La rama va en MAYUSCULAS, consistente con los datos ya cargados
        -- en proyectos.tipo ('STAND', 'MOBILIARIO').
        v_rama := UPPER(NULLIF(TRIM(COALESCE(NEW.tipo_cotizacion, '')), ''));

        -- Nombre útil: "<Rama> <Cliente> — <Evento>", con degradación limpia
        v_nombre := CONCAT_WS(' ',
            NULLIF(INITCAP(COALESCE(v_rama, '')), ''),
            v_cliente
        );
        IF NULLIF(TRIM(COALESCE(NEW.nombre_evento, '')), '') IS NOT NULL THEN
            v_nombre := CONCAT_WS(' — ', NULLIF(v_nombre, ''), TRIM(NEW.nombre_evento));
        END IF;
        v_nombre := NULLIF(TRIM(v_nombre), '');
        IF v_nombre IS NULL THEN
            v_nombre := 'Proyecto ' || NEW.numero;
        END IF;

        INSERT INTO proyectos (
            nombre, cliente_id, evento_id, cotizacion_id,
            estado, created_from, fecha_inicio, tipo, responsable_id
        ) VALUES (
            v_nombre, NEW.cliente_id, NEW.event_id, NEW.id,
            'por_iniciar', 'crm', CURRENT_DATE, v_rama, NEW.vendedor_id
        ) RETURNING id INTO v_nuevo_proyecto_id;

        -- OJO: acá NO se escribe `proyecto_tipos`. La versión anterior lo
        -- intentaba desde NEW.tipo_evento (siempre NULL) y se tragaba el error.
        -- Verificado el 2026-08-20 que `proyecto_tipos` es OTRA taxonomía —
        -- sus valores reales son 'stand_full', 'alquiler_equipamiento',
        -- 'infraestructura', 'iluminacion', 'grafica', 'mas_servicios': son los
        -- servicios que incluye el proyecto, no la rama del negocio. Meter la
        -- rama ahí contaminaría dos clasificaciones distintas. La rama vive en
        -- `proyectos.tipo`, que es donde la escribimos arriba.

        UPDATE cotizaciones SET project_id = v_nuevo_proyecto_id WHERE id = NEW.id;

    END IF;

    RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- F4 · Sync cuota <-> cobro también por el camino legacy  (H5)
-- ---------------------------------------------------------------------
-- Hay DOS formas de atar un cobro a una cuota: `cobro_aplicaciones` (la
-- nueva, con trigger) e `ingresos.plan_cobro_item_id` (la legacy, que
-- dependía de que api.js hiciera el UPDATE desde JavaScript). Verificado:
-- un cobro cargado por fuera de la pantalla deja la cuota en
-- monto_cobrado = 0 / estado = pendiente, sin ningún error.
--
-- NO se agrega un segundo motor: se generaliza el recálculo existente
-- para que mire las dos fuentes, y se lo dispara también desde `ingresos`.
-- Los ingresos que YA están en cobro_aplicaciones se excluyen de la suma
-- legacy para que no se cuenten dos veces.

CREATE OR REPLACE FUNCTION public.fn_recalcular_cuota_plan(p_item_id UUID)
 RETURNS VOID
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total NUMERIC(15,2);
    v_monto_cuota NUMERIC(15,2);
    v_tiene_factura BOOLEAN;
    v_nuevo_estado TEXT;
    v_fecha DATE;
BEGIN
    IF p_item_id IS NULL THEN RETURN; END IF;

    SELECT monto, comprobante_venta_id IS NOT NULL, fecha_estimada, estado
      INTO v_monto_cuota, v_tiene_factura, v_fecha, v_nuevo_estado
      FROM plan_cobro_items
     WHERE id = p_item_id AND COALESCE(_deleted, false) = false;

    IF NOT FOUND THEN RETURN; END IF;

    -- Cuota anulada: no se toca (es una decisión humana, no un cálculo)
    IF v_nuevo_estado = 'anulada' THEN RETURN; END IF;

    SELECT COALESCE(SUM(monto), 0) INTO v_total FROM (
        -- ① aplicaciones explícitas (multi-factura).
        --    Se exige que el ingreso padre siga vivo y confirmado: si el cobro
        --    se anula después, la reversión contable ya ocurre sola, pero sin
        --    este JOIN la cuota seguía figurando cobrada para siempre.
        SELECT ca.monto_aplicado AS monto
          FROM cobro_aplicaciones ca
          JOIN ingresos i2 ON i2.id = ca.ingreso_id
         WHERE ca.plan_cobro_item_id = p_item_id
           AND COALESCE(ca._deleted, false) = false
           AND i2.estado = 'confirmado'
           AND COALESCE(i2._deleted, false) = false
        UNION ALL
        -- ② cobros legacy atados directo, que no estén ya en ①
        SELECT i.monto
          FROM ingresos i
         WHERE i.plan_cobro_item_id = p_item_id
           AND COALESCE(i._deleted, false) = false
           AND i.estado = 'confirmado'
           AND NOT EXISTS (SELECT 1 FROM cobro_aplicaciones ca2
                            WHERE ca2.ingreso_id = i.id
                              AND COALESCE(ca2._deleted, false) = false)
    ) s;

    IF v_total >= v_monto_cuota - 0.01 THEN
        v_nuevo_estado := 'cobrado';
    ELSIF v_total > 0.01 THEN
        v_nuevo_estado := 'parcial';
    ELSIF v_tiene_factura THEN
        v_nuevo_estado := 'facturada';
    ELSE
        v_nuevo_estado := CASE WHEN v_fecha < CURRENT_DATE THEN 'vencido' ELSE 'pendiente' END;
    END IF;

    UPDATE plan_cobro_items
       SET monto_cobrado = v_total,
           estado        = v_nuevo_estado,
           updated_at    = NOW()
     WHERE id = p_item_id
       AND (monto_cobrado IS DISTINCT FROM v_total OR estado IS DISTINCT FROM v_nuevo_estado);
END;
$function$;

-- CREATE FUNCTION concede EXECUTE a PUBLIC, que incluye a `anon` → toda función
-- nueva invocable por PostgREST se cierra explícitamente. (Lección del circuito
-- de venta, 2026-07-28/29; mismo patrón que fn_mapeo_default_protegido.)
REVOKE ALL ON FUNCTION public.fn_recalcular_cuota_plan(UUID) FROM PUBLIC, anon;

-- El trigger de aplicaciones ahora delega en la función única
CREATE OR REPLACE FUNCTION public.fn_sync_cuota_desde_aplicacion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM fn_recalcular_cuota_plan(COALESCE(NEW.plan_cobro_item_id, OLD.plan_cobro_item_id));
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Y el camino legacy gana su propio disparador (misma función)
CREATE OR REPLACE FUNCTION public.fn_sync_cuota_desde_ingreso()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- si el ingreso cambió de cuota, hay que recalcular las dos
    IF TG_OP = 'UPDATE' AND OLD.plan_cobro_item_id IS DISTINCT FROM NEW.plan_cobro_item_id THEN
        PERFORM fn_recalcular_cuota_plan(OLD.plan_cobro_item_id);
    END IF;
    PERFORM fn_recalcular_cuota_plan(COALESCE(NEW.plan_cobro_item_id, OLD.plan_cobro_item_id));
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_cuota_desde_ingreso ON ingresos;
CREATE TRIGGER trg_sync_cuota_desde_ingreso
AFTER INSERT OR UPDATE OF plan_cobro_item_id, monto, estado, _deleted OR DELETE
ON ingresos
FOR EACH ROW EXECUTE FUNCTION fn_sync_cuota_desde_ingreso();

COMMIT;

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- BEGIN;
-- -- F4 · ⚠️ ORDEN OBLIGATORIO. `fn_sync_cuota_desde_aplicacion` quedó llamando a
-- --   `fn_recalcular_cuota_plan` desde su cuerpo, y su trigger sobre
-- --   `cobro_aplicaciones` sigue vivo. Postgres NO trackea esa dependencia: el
-- --   DROP pasa sin error y la próxima cobranza revienta con "function does not
-- --   exist". Por eso se restaura PRIMERO la función vieja, y `fn_recalcular_cuota_plan`
-- --   NO se dropea (dejarla huérfana no molesta a nadie; dropearla sí).
-- DROP TRIGGER IF EXISTS trg_sync_cuota_desde_ingreso ON ingresos;
-- DROP FUNCTION IF EXISTS fn_sync_cuota_desde_ingreso();
--
-- CREATE OR REPLACE FUNCTION public.fn_sync_cuota_desde_aplicacion()
--  RETURNS trigger LANGUAGE plpgsql AS $f$
-- DECLARE
--     v_item_id UUID; v_total_aplicado NUMERIC(15,2); v_monto_cuota NUMERIC(15,2);
--     v_facturar BOOLEAN; v_tiene_factura BOOLEAN; v_nuevo_estado TEXT;
-- BEGIN
--     v_item_id := COALESCE(NEW.plan_cobro_item_id, OLD.plan_cobro_item_id);
--     IF v_item_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
--     SELECT COALESCE(SUM(monto_aplicado), 0) INTO v_total_aplicado
--       FROM cobro_aplicaciones WHERE plan_cobro_item_id = v_item_id AND _deleted = false;
--     SELECT monto, facturar, comprobante_venta_id IS NOT NULL
--       INTO v_monto_cuota, v_facturar, v_tiene_factura
--       FROM plan_cobro_items WHERE id = v_item_id;
--     IF v_total_aplicado >= v_monto_cuota - 0.01 THEN v_nuevo_estado := 'cobrado';
--     ELSIF v_total_aplicado > 0.01 THEN v_nuevo_estado := 'parcial';
--     ELSIF v_tiene_factura THEN v_nuevo_estado := 'facturada';
--     ELSE SELECT CASE WHEN fecha_estimada < CURRENT_DATE THEN 'vencido' ELSE 'pendiente' END
--            INTO v_nuevo_estado FROM plan_cobro_items WHERE id = v_item_id;
--     END IF;
--     UPDATE plan_cobro_items SET monto_cobrado = v_total_aplicado,
--            estado = v_nuevo_estado, updated_at = NOW() WHERE id = v_item_id;
--     RETURN COALESCE(NEW, OLD);
-- END; $f$;
-- --   (fn_recalcular_cuota_plan queda huérfana a propósito — NO dropearla)
-- -- F3
-- --   (restaurar trigger_cotizacion_aprobada_crea_proyecto desde la definición previa;
-- --    copia guardada en PROGRESO.md, sesión 2026-08-20)
-- -- F2
-- DELETE FROM mapeo_cuentas WHERE campo_origen = 'categoria_directo';
-- --   (la función vuelve a la versión previa quitando el bloque v_directo)
-- -- F1
-- DELETE FROM mapeo_cuentas WHERE campo_origen='servicio' AND valor_origen='SRV-ELEC';
-- ALTER TABLE comprobantes DROP CONSTRAINT IF EXISTS comprobantes_servicio_check;
-- ALTER TABLE comprobantes ADD CONSTRAINT comprobantes_servicio_check
--   CHECK (servicio = ANY (ARRAY['SRV-STAND','SRV-ALQUILER','SRV-EXPO','SRV-ADIC']));
-- DELETE FROM plan_cuentas WHERE codigo='4.1.05';
-- COMMIT;
