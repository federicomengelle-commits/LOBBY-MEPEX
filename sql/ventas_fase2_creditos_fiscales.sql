-- ═══════════════════════════════════════════════════════════════════
-- CIRCUITO DE VENTA · FASE 2 — Retenciones y percepciones      2026-07-31
-- ═══════════════════════════════════════════════════════════════════
-- Spec: docs/circuito-venta-blueprint.md §8
-- Plan: docs/superpowers/plans/2026-07-29-venta-fase2-retenciones.md (Task 1)
--
-- QUÉ RESUELVE
--   Cuando un cliente nos paga, muchas veces retiene una parte y la deposita a
--   la AFIP o a Rentas en nuestro nombre. Esa plata NO se perdió: es un crédito
--   contra el impuesto que vamos a pagar. Hoy no tiene dónde caer, así que el
--   asiento del cobro cierra por lo que entró al banco y la retención queda
--   fuera de los libros. Sofi las viene anotando aparte.
--
-- UNA SOLA TABLA PARA RETENCIONES Y PERCEPCIONES
--   Son la misma naturaleza contable (un crédito fiscal a favor) y alimentan el
--   mismo libro; sólo cambia por dónde entran: la retención llega con el COBRO
--   (nos la practican a nosotros al pagarnos) y la percepción viene adentro de
--   la FACTURA DE COMPRA (nos la agrega el proveedor).
--
-- LA REGLA QUE MANDA: TODO NACE INERTE (blueprint §9.1)
--   Si nadie carga una retención, el asiento del cobro tiene que salir
--   BYTE-IDÉNTICO al de hoy. El trigger suma las retenciones del ingreso y, si
--   el total es cero, se comporta exactamente como antes. Es la condición de
--   aceptación más importante de la fase.
--
-- ⚠️ CÓDIGOS DE CUENTA — corregidos respecto del blueprint
--   §6.2 proponía `1.1.10` para Ganancias, pero en prod ese código YA EXISTE
--   ("Anticipos a proveedores"). Van 1.1.11 a 1.1.14.
--   El `orden` sigue la convención real del plan de cuentas (1.1.07→117,
--   1.1.09→119, 1.1.10→120), NO el 111-114 del plan de ejecución: con 111 las
--   cuentas nuevas se listarían ANTES de "Cheques a cobrar".
--
-- Verificado contra prod 2026-07-31 antes de escribir esto:
--   · plan_cuentas tiene las 17 columnas que se usan acá.
--   · 1.1.11 a 1.1.15 libres · 1.1.10 ocupado.
--   · `tipo` admite 'activo' · `naturaleza` admite 'deudora'.
--   · `plan_cuentas_codigo_key` UNIQUE(codigo) existe → el ON CONFLICT es válido
--     (si no existiera, el INSERT abortaría el archivo entero: todo va en una
--      sola transacción).
--   · fn_asiento_auto_ingreso en prod coincide con el cuerpo que asumía el plan.
--   · `cobro_aplicaciones` existe con (ingreso_id, comprobante_id, monto_aplicado)
--     y tiene 0 filas: el fallback de IVA que se agrega abajo no cambia nada de
--     lo ya registrado.
--   · Foto del antes: 15 asientos, debe = haber = 18.984.910.
--
-- Aditivo e idempotente. No toca ninguna fila existente.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────
-- 1 · Las 4 cuentas
-- ───────────────────────────────────────────────────────────────────
INSERT INTO public.plan_cuentas
  (codigo, nombre, tipo, nivel, codigo_padre, es_grupo, naturaleza, imputable, activa, orden)
VALUES
  ('1.1.11', 'Retenciones de Ganancias sufridas',  'activo', 3, '1.1', false, 'deudora', true, true, 121),
  ('1.1.12', 'Retenciones de IVA sufridas',        'activo', 3, '1.1', false, 'deudora', true, true, 122),
  ('1.1.13', 'Retenciones y percepciones de IIBB', 'activo', 3, '1.1', false, 'deudora', true, true, 123),
  ('1.1.14', 'Retenciones de SUSS sufridas',       'activo', 3, '1.1', false, 'deudora', true, true, 124)
ON CONFLICT (codigo) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────
-- 2 · La tabla
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creditos_fiscales (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                   TEXT NOT NULL CHECK (tipo IN ('retencion','percepcion')),
    impuesto               TEXT NOT NULL CHECK (impuesto IN ('ganancias','iva','iibb','suss')),
    jurisdiccion           TEXT,
    origen_ingreso_id      UUID REFERENCES public.ingresos(id),
    origen_comprobante_id  UUID REFERENCES public.comprobantes_recibidos(id),
    cliente_id             UUID REFERENCES public.clientes(id),
    proveedor_id           UUID REFERENCES public.proveedor(id),
    numero_certificado     TEXT,
    fecha                  DATE NOT NULL,
    periodo                TEXT NOT NULL,
    base_imponible         NUMERIC(15,2),
    alicuota               NUMERIC(5,2),
    monto                  NUMERIC(15,2) NOT NULL CHECK (monto > 0),
    archivo_url            TEXT,
    estado                 TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','computado')),
    canal                  TEXT NOT NULL DEFAULT 'oficial' CHECK (canal IN ('oficial','interno')),
    notas                  TEXT,
    created_by             UUID REFERENCES public.profiles(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted               BOOLEAN NOT NULL DEFAULT false
);

-- Exactamente un origen, y coherente con el tipo. Una retención sin cobro o una
-- percepción sin factura no se puede explicar: de dónde salió es parte del dato.
DO $$ BEGIN
    ALTER TABLE public.creditos_fiscales ADD CONSTRAINT chk_cf_origen_coherente
        CHECK ( (tipo = 'retencion'  AND origen_ingreso_id     IS NOT NULL AND origen_comprobante_id IS NULL)
             OR (tipo = 'percepcion' AND origen_comprobante_id IS NOT NULL AND origen_ingreso_id     IS NULL) );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- IIBB sin jurisdicción no sirve para la DDJJ: no se sabe a qué provincia
-- imputarla. Los otros impuestos son nacionales y no la necesitan.
DO $$ BEGIN
    ALTER TABLE public.creditos_fiscales ADD CONSTRAINT chk_cf_iibb_jurisdiccion
        CHECK (impuesto <> 'iibb' OR btrim(COALESCE(jurisdiccion,'')) <> '');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mismo formato YYYY-MM que saldos_mensuales, para poder cruzarlos.
DO $$ BEGIN
    ALTER TABLE public.creditos_fiscales ADD CONSTRAINT chk_cf_periodo
        CHECK (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_cf_periodo     ON public.creditos_fiscales(periodo)               WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_cf_ingreso     ON public.creditos_fiscales(origen_ingreso_id)     WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_cf_comprobante ON public.creditos_fiscales(origen_comprobante_id) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_cf_estado      ON public.creditos_fiscales(estado)                WHERE _deleted = false;

-- updated_at
CREATE OR REPLACE FUNCTION public.fn_cf_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_cf_touch ON public.creditos_fiscales;
CREATE TRIGGER trg_cf_touch BEFORE UPDATE ON public.creditos_fiscales
  FOR EACH ROW EXECUTE FUNCTION public.fn_cf_touch();

-- ─── Candado: una retención no se toca después de confirmado el cobro ───
-- El asiento del cobro se arma UNA sola vez, cuando el ingreso pasa a
-- 'confirmado'. Nada lo resincroniza después. Sin este candado, agregar, editar
-- o borrar una retención de un cobro ya confirmado dejaba el libro diciendo una
-- cosa y el listado de créditos fiscales otra, sin ningún error: el caso real es
-- el certificado que llega una semana tarde y Sofi lo carga contra el mismo
-- cobro.
--
-- La salida correcta para corregir un cobro ya posteado es ANULARLO — eso ya
-- genera su contra-asiento (trg_revertir_asiento_*, vivo desde 2026-06-22) — y
-- volver a registrarlo bien. Este candado obliga a pasar por ahí.
--
-- Sólo aplica a retenciones: las percepciones cuelgan de un comprobante de
-- compra y no participan del asiento del ingreso.
CREATE OR REPLACE FUNCTION public.fn_cf_bloquear_si_confirmado()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_ingreso UUID := COALESCE(NEW.origen_ingreso_id, OLD.origen_ingreso_id);
    v_estado  TEXT;
BEGIN
    IF v_ingreso IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

    SELECT estado INTO v_estado FROM public.ingresos WHERE id = v_ingreso;
    IF v_estado = 'confirmado' THEN
        RAISE EXCEPTION
          'El cobro ya está confirmado y su asiento posteado: no se puede % a mano. Para corregirlo, anulá el cobro (eso genera el contra-asiento) y volvé a registrarlo.',
          CASE TG_OP WHEN 'INSERT' THEN 'agregarle una retención'
                     WHEN 'UPDATE' THEN 'modificar su retención'
                     ELSE 'borrarle una retención' END;
    END IF;
    RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_cf_bloquear_si_confirmado ON public.creditos_fiscales;
CREATE TRIGGER trg_cf_bloquear_si_confirmado
  BEFORE INSERT OR UPDATE OR DELETE ON public.creditos_fiscales
  FOR EACH ROW EXECUTE FUNCTION public.fn_cf_bloquear_si_confirmado();

-- ───────────────────────────────────────────────────────────────────
-- 3 · RLS — la matriz, igual que el resto del tier financiero
-- ───────────────────────────────────────────────────────────────────
-- Patrón calcado de sql/rls_capa2_financiero.sql: NO se usa `auth.uid() IN (...)`,
-- se lee la matriz de permisos del Panel vía fn_role_can. Así el acceso se
-- tunea desde la app sin tocar SQL.
ALTER TABLE public.creditos_fiscales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creditos_fiscales_rls_sel ON public.creditos_fiscales;
CREATE POLICY creditos_fiscales_rls_sel ON public.creditos_fiscales
  FOR SELECT TO authenticated
  USING (public.fn_role_can('finanzas','read') OR public.fn_role_can('contabilidad','read'));

DROP POLICY IF EXISTS creditos_fiscales_rls_ins ON public.creditos_fiscales;
CREATE POLICY creditos_fiscales_rls_ins ON public.creditos_fiscales
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_role_can('finanzas','write') OR public.fn_role_can('contabilidad','write'));

DROP POLICY IF EXISTS creditos_fiscales_rls_upd ON public.creditos_fiscales;
CREATE POLICY creditos_fiscales_rls_upd ON public.creditos_fiscales
  FOR UPDATE TO authenticated
  USING (public.fn_role_can('finanzas','write') OR public.fn_role_can('contabilidad','write'))
  WITH CHECK (public.fn_role_can('finanzas','write') OR public.fn_role_can('contabilidad','write'));

DROP POLICY IF EXISTS creditos_fiscales_rls_del ON public.creditos_fiscales;
CREATE POLICY creditos_fiscales_rls_del ON public.creditos_fiscales
  FOR DELETE TO authenticated
  USING (public.fn_role_can('finanzas','write') OR public.fn_role_can('contabilidad','write'));

REVOKE ALL ON TABLE public.creditos_fiscales FROM anon;

-- ───────────────────────────────────────────────────────────────────
-- 4 · Percepciones en la factura del proveedor
-- ───────────────────────────────────────────────────────────────────
-- La percepción viene ADENTRO del comprobante de compra, así que se carga ahí.
-- Aditivo y nullable: las 14 filas existentes quedan en null y el circuito de
-- compras no cambia en nada.
ALTER TABLE public.comprobantes_recibidos
    ADD COLUMN IF NOT EXISTS percepcion_iva          NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS percepcion_iibb         NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS percepcion_jurisdiccion TEXT;

-- ───────────────────────────────────────────────────────────────────
-- 5 · El trigger del cobro, con la línea de retención
-- ───────────────────────────────────────────────────────────────────
-- Partido del cuerpo REAL de prod (leído el 2026-07-31), no del que está en el
-- repo. Los únicos cambios respecto de ese cuerpo:
--   · se suman las retenciones del ingreso;
--   · el asiento cuadra sobre lo DEVENGADO (lo que entró + lo retenido), no
--     sobre lo que entró al banco;
--   · una línea de DEBE por cada impuesto retenido, a su cuenta;
--   · el IVA se prorratea sobre el total devengado.
--
-- ⚠️ CON CERO RETENCIONES EL RESULTADO ES IDÉNTICO AL DE HOY, LÍNEA POR LÍNEA.
--    v_retenciones = 0 → v_total_asiento = v_monto_asiento → el bucle de
--    retenciones no itera → mismas 2 o 3 líneas, mismos montos, mismo orden.
--
-- Por qué la pata de tesorería NO cambia: al banco entró lo que entró. La
-- retención es un activo distinto (un crédito contra el fisco), y por eso va en
-- su propia línea de debe en vez de inflar el banco.
CREATE OR REPLACE FUNCTION public.fn_asiento_auto_ingreso()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_cuenta_activo   UUID;
    v_cuenta_ingreso  UUID;
    v_cuenta_iva      UUID;
    v_asiento_id      UUID;
    v_desc            TEXT;
    v_monto_asiento   NUMERIC(15,2);
    v_servicio        TEXT := NULL;
    v_comp_iva        NUMERIC(15,2);
    v_comp_total      NUMERIC(15,2);
    v_iva             NUMERIC(15,2) := 0;
    v_retenciones     NUMERIC(15,2) := 0;   -- FASE 2
    v_total_asiento   NUMERIC(15,2);        -- FASE 2
    v_orden           INT := 1;             -- FASE 2
    r_ret             RECORD;               -- FASE 2
    v_cuenta_ret      UUID;                 -- FASE 2 · cuenta de la retención en curso
BEGIN
    IF NEW.estado IS DISTINCT FROM 'confirmado' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado = 'confirmado' THEN RETURN NEW; END IF;

    -- ── FASE 4: derivar la pata de tesorería según el instrumento. El banco se
    --    mueve recién en el clearing del valor.
    IF NEW.medio = 'cheque' THEN
        SELECT id INTO v_cuenta_activo FROM plan_cuentas WHERE codigo = '1.1.07' AND _deleted = false LIMIT 1;
        IF v_cuenta_activo IS NULL THEN
            RAISE NOTICE '[Contabilidad] Cuenta 1.1.07 no encontrada — ingreso % sin asiento.', NEW.id;
            RETURN NEW;
        END IF;
    ELSE
        IF NEW.cuenta_id IS NULL THEN
            RAISE NOTICE '[Contabilidad] Ingreso % sin cuenta_id — sin asiento.', NEW.id;
            RETURN NEW;
        END IF;
        SELECT id INTO v_cuenta_activo
        FROM plan_cuentas
        WHERE cuenta_financiera_id = NEW.cuenta_id AND _deleted = false
        LIMIT 1;
        IF v_cuenta_activo IS NULL THEN
            RAISE WARNING '[Contabilidad] Ingreso %: cuenta financiera % sin vínculo contable.', NEW.id, NEW.cuenta_id;
            RETURN NEW;
        END IF;
    END IF;

    IF NEW.comprobante_id IS NOT NULL THEN
        -- Camino de siempre: un cobro, una factura (FK legacy de `ingresos`).
        SELECT servicio, iva, total INTO v_servicio, v_comp_iva, v_comp_total
        FROM comprobantes
        WHERE id = NEW.comprobante_id AND _deleted = false;
    ELSE
        -- FASE 2 · cobranza multi-factura: el recibo se aplica a N facturas por
        -- `cobro_aplicaciones` y `ingresos.comprobante_id` queda NULL.
        --
        -- Sin esto, el caso central de la fase —cobrar una factura con IVA y una
        -- retención— posteaba el 100% a Ventas y CERO IVA débito, en silencio.
        --
        -- El IVA del cobro es la suma del IVA proporcional de cada factura según
        -- cuánto se le aplicó: Σ (aplicado_i × iva_i / total_i). Se guarda en las
        -- mismas variables para que la fórmula de prorrateo de abajo siga
        -- funcionando igual, sin ramas nuevas.
        SELECT SUM(ca.monto_aplicado * c.iva / NULLIF(c.total, 0)),
               SUM(ca.monto_aplicado)
          INTO v_comp_iva, v_comp_total
          FROM cobro_aplicaciones ca
          JOIN comprobantes c ON c.id = ca.comprobante_id AND c._deleted = false
         WHERE ca.ingreso_id = NEW.id AND ca._deleted = false;

        -- El servicio define a qué cuenta de venta va el haber. Con varias
        -- facturas se toma el de la de mayor importe aplicado: es la que manda
        -- en el cobro, y el mapeo tiene un 'default' de red si no matchea.
        SELECT c.servicio INTO v_servicio
          FROM cobro_aplicaciones ca
          JOIN comprobantes c ON c.id = ca.comprobante_id AND c._deleted = false
         WHERE ca.ingreso_id = NEW.id AND ca._deleted = false
         ORDER BY ca.monto_aplicado DESC
         LIMIT 1;
    END IF;

    SELECT cuenta_contable_id INTO v_cuenta_ingreso
    FROM mapeo_cuentas
    WHERE tipo_movimiento = 'ingreso' AND activo = true AND _deleted = false
      AND ((campo_origen = 'servicio' AND valor_origen = v_servicio) OR (campo_origen = 'default'))
    ORDER BY CASE WHEN campo_origen = 'servicio' AND valor_origen = v_servicio THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_cuenta_ingreso IS NULL THEN
        RAISE NOTICE '[Contabilidad] No hay mapeo (ni default) para ingreso %. Sin asiento.', NEW.id;
        RETURN NEW;
    END IF;

    v_monto_asiento := COALESCE(NEW.total_en_ars, NEW.monto);

    -- ── FASE 2: lo que el cliente retuvo. Si no hay nada cargado, esto es 0 y
    --    todo lo que sigue se comporta como antes de esta fase.
    SELECT COALESCE(SUM(monto), 0) INTO v_retenciones
    FROM creditos_fiscales
    WHERE origen_ingreso_id = NEW.id AND tipo = 'retencion' AND _deleted = false;

    v_total_asiento := v_monto_asiento + v_retenciones;

    -- El IVA se prorratea sobre lo DEVENGADO: con una retención, la factura vale
    -- más que lo que entró al banco, y el IVA es el de la factura.
    IF COALESCE(v_comp_iva, 0) > 0 AND COALESCE(v_comp_total, 0) > 0 THEN
        SELECT id INTO v_cuenta_iva FROM plan_cuentas WHERE codigo = '2.1.02' AND _deleted = false LIMIT 1;
        IF v_cuenta_iva IS NOT NULL THEN
            v_iva := ROUND(v_total_asiento * (v_comp_iva / v_comp_total), 2);
        ELSE
            RAISE NOTICE '[Contabilidad] Cuenta IVA débito 2.1.02 no encontrada — ingreso % sin desglose IVA.', NEW.id;
        END IF;
    END IF;

    v_desc := 'Ingreso: ' || COALESCE(NEW.concepto, 'Sin concepto');
    IF NEW.medio = 'cheque' THEN v_desc := v_desc || ' [cheque en cartera]'; END IF;
    IF v_retenciones > 0 THEN v_desc := v_desc || ' [con retenciones]'; END IF;
    IF NEW.moneda IS NOT NULL AND NEW.moneda <> 'ARS' THEN
        v_desc := v_desc || ' [' || NEW.moneda || ' ' || NEW.monto::TEXT || ' @ ' || NEW.cotizacion::TEXT || ']';
    END IF;

    INSERT INTO asientos (fecha, concepto, tipo, ingreso_id, canal, total_debe, total_haber, moneda, cotizacion)
    VALUES (NEW.fecha, v_desc, 'automatico', NEW.id, COALESCE(NEW.canal,'oficial'),
            v_total_asiento, v_total_asiento, COALESCE(NEW.moneda,'ARS'), COALESCE(NEW.cotizacion,1))
    RETURNING id INTO v_asiento_id;

    -- DEBE 1 · tesorería: lo que efectivamente entró
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_activo, 'debe', v_monto_asiento, v_desc, v_orden);
    v_orden := v_orden + 1;

    -- DEBE 2..N · una línea por impuesto retenido (FASE 2)
    -- Agrupado por impuesto: si el mismo cobro trae dos certificados de
    -- Ganancias, van juntos en una línea a la misma cuenta.
    FOR r_ret IN
        SELECT cf.impuesto, SUM(cf.monto) AS monto
          FROM creditos_fiscales cf
         WHERE cf.origen_ingreso_id = NEW.id AND cf.tipo = 'retencion' AND cf._deleted = false
         GROUP BY cf.impuesto
         ORDER BY cf.impuesto
    LOOP
        SELECT id INTO v_cuenta_ret FROM plan_cuentas
         WHERE codigo = CASE r_ret.impuesto
                          WHEN 'ganancias' THEN '1.1.11'
                          WHEN 'iva'       THEN '1.1.12'
                          WHEN 'iibb'      THEN '1.1.13'
                          WHEN 'suss'      THEN '1.1.14'
                        END
           AND _deleted = false
         LIMIT 1;
        -- Si faltara la cuenta, saltear esta línea dejaría la cabecera diciendo
        -- un total que las líneas no explican.
        --
        -- ⚠️ Y NO HAY RED DE SEGURIDAD ABAJO: `chk_partida_doble` compara
        -- total_debe contra total_haber de la MISMA fila cabecera, y las dos se
        -- setean a v_total_asiento antes de insertar ninguna línea — o sea que
        -- ese CHECK pasaría igual con la línea faltante. Tampoco hay trigger que
        -- valide la suma de `asiento_lineas` contra la cabecera. Abortar acá ES
        -- la única red; no sacar este RAISE pensando que el CHECK cubre el caso.
        IF v_cuenta_ret IS NULL THEN
            RAISE EXCEPTION
              '[Contabilidad] No encuentro la cuenta de retención de % (ingreso %). Si nunca se crearon, corré sql/ventas_fase2_creditos_fiscales.sql; si alguien la dio de baja desde Contabilidad, reactivala (_deleted=false).',
              r_ret.impuesto, NEW.id;
        END IF;
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_ret, 'debe', r_ret.monto,
                'Retención de ' || r_ret.impuesto || ' sufrida', v_orden);
        v_orden := v_orden + 1;
    END LOOP;

    -- HABER · la venta, por lo devengado neto de IVA
    INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
    VALUES (v_asiento_id, v_cuenta_ingreso, 'haber', v_total_asiento - v_iva, v_desc, v_orden);
    v_orden := v_orden + 1;

    -- HABER · IVA débito
    IF v_iva > 0 AND v_cuenta_iva IS NOT NULL THEN
        INSERT INTO asiento_lineas (asiento_id, cuenta_id, tipo_movimiento, monto, descripcion, orden)
        VALUES (v_asiento_id, v_cuenta_iva, 'haber', v_iva, 'IVA débito fiscal', v_orden);
    END IF;

    RETURN NEW;
END;
$function$;

-- ───────────────────────────────────────────────────────────────────
-- 6 · La vista del libro
-- ───────────────────────────────────────────────────────────────────
-- ⚠️ security_invoker = true NO es opcional: es regla de facto desde el
--    2026-07-26, cuando 5 views financieras le devolvían datos a cualquier
--    anónimo porque por default una view bypassa la RLS de sus tablas.
CREATE OR REPLACE VIEW public.v_creditos_fiscales_periodo
WITH (security_invoker = true) AS
SELECT periodo, tipo, impuesto, jurisdiccion, canal,
       count(*) AS cantidad,
       SUM(monto) AS total
  FROM public.creditos_fiscales
 WHERE _deleted = false
 GROUP BY periodo, tipo, impuesto, jurisdiccion, canal;

REVOKE ALL ON public.v_creditos_fiscales_periodo FROM anon;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN  (los RAISE NOTICE no se ven en el SQL Editor → por SELECT)
-- ═══════════════════════════════════════════════════════════════════
-- 1) Las 4 cuentas, en su lugar del árbol:
--    SELECT codigo, nombre, orden FROM plan_cuentas
--     WHERE codigo LIKE '1.1.1%' AND _deleted=false ORDER BY orden;
--    -- esperado: …09 IVA CF (119), …10 Anticipos (120), …11 a …14 nuevas (121-124)
--
-- 2) La tabla, con sus 4 policies y sin anon:
--    SELECT policyname, cmd FROM pg_policies
--     WHERE schemaname='public' AND tablename='creditos_fiscales';   -- 4 filas
--
-- 3) Las 3 columnas de percepción:
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name='comprobantes_recibidos' AND column_name LIKE 'percepcion%';
--
-- 4) LA IMPORTANTE — que nada haya cambiado. Contra la foto del 2026-07-31:
--    SELECT count(*) AS asientos, SUM(total_debe) AS debe, SUM(total_haber) AS haber
--      FROM asientos WHERE _deleted=false;
--    -- esperado EXACTO: 15 · 18984910.00 · 18984910.00
--
-- 5) Y la prueba de fuego (Task 6, escenario 1): registrar un cobro normal SIN
--    retenciones por el camino de siempre y comparar el asiento contra uno
--    anterior. Tiene que salir con las mismas líneas y los mismos montos.
--
-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
-- El trigger vuelve a su versión previa corriendo la sección D de
-- sql/fase4_cartera_valores.sql (es la que está viva hoy en prod).
-- Después:
--   DROP VIEW IF EXISTS public.v_creditos_fiscales_periodo;
--   DROP TABLE IF EXISTS public.creditos_fiscales;      -- CUIDADO: borra datos
--   ALTER TABLE public.comprobantes_recibidos
--     DROP COLUMN IF EXISTS percepcion_iva,
--     DROP COLUMN IF EXISTS percepcion_iibb,
--     DROP COLUMN IF EXISTS percepcion_jurisdiccion;
--
-- ⚠️ Las 4 cuentas NO se borran con DELETE. En cuanto exista un solo asiento con
--    una retención, hay `asiento_lineas.cuenta_id` y `saldos_mensuales`
--    apuntando a ellas: borrarlas dejaría el histórico contable señalando a un
--    id inexistente. Se dan de baja como todo en este sistema, con el soft
--    delete que ya usa el resto:
--      UPDATE public.plan_cuentas SET activa = false, _deleted = true
--       WHERE codigo IN ('1.1.11','1.1.12','1.1.13','1.1.14');
--    (Sólo si nadie llegó a cargar una retención real conviene borrarlas de
--     verdad, y en ese caso el DELETE es seguro porque no hay nada apuntándolas.)
-- ═══════════════════════════════════════════════════════════════════
