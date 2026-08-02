-- ═══════════════════════════════════════════════════════════════════════════
-- AUDITORÍA 2026-07-31 · T4.18 — la red dura contra el doble-submit
-- ═══════════════════════════════════════════════════════════════════════════
--
-- EL BUG: 13 botones que crean plata comparten la misma forma — handler async
-- en el footer de un modal, `await` a una API que escribe, y el `Modal.close()`
-- recién después. Entre el primer click y el cierre hay una ventana en la que
-- el botón sigue vivo. Los guards de idempotencia que existen en `api.js` son
-- **read-then-write** (`if (c.ingreso_id) return {error}` → INSERT), así que
-- dos llamadas concurrentes leen las dos "todavía no existe" y escriben las dos.
--
-- Los casos caros duplican ASIENTOS CONTABLES, no solo filas. Los tres que
-- cubre este archivo:
--   · "Generar egreso" de un comprobante recibido → 2 egresos + 2 asientos
--   · "Generar cobro" de un comprobante emitido   → 2 ingresos + 2 asientos
--   · "Endosar" un cheque                          → 2 egresos + 2 comprobantes
-- (los otros dos críticos —pago de vencimiento y egreso de OC— van sólo con
--  el guard de UI; ver la nota del final sobre por qué no tienen red de DB)
--
-- ESTE ARCHIVO = la red que el front no puede dar. El guard de UI (mismo
-- commit) cierra la ventana en el caso normal; el índice único la cierra
-- SIEMPRE, incluida la doble pestaña, el reintento tras un timeout y el
-- `fetch` a mano. Es el mismo criterio que T0.8 (índices de comprobantes)
-- y T4.2 (candado contable): la integridad de la plata no se confía al DOM.
--
-- LAS TRES CLAVES, y por qué cada una es 1:1 (verificado en el código, no
-- asumido — un índice único sobre una relación N:1 rompería un flujo legítimo):
--
--  · `ingresos.comprobante_id` — lo escribe SOLO `generarIngresoDeComprobante`
--    ("el cobro generado desde esta factura"). Los cobros PARCIALES de una
--    misma factura NO usan esta columna: van por `cobro_aplicaciones`
--    (N aplicaciones → 1 comprobante). Ni el modal de Ingreso ni
--    `registrarCobranza` la setean. → 1:1 ✔
--  · `egresos.comprobante_recibido_id` — espejo, lo escribe
--    `generarEgresoDeComprobante` / `registrarGasto`. → 1:1 ✔
--  · `egresos.cartera_valor_id` — el egreso del endoso de un valor recibido.
--    `endosarValor` exige `estado='en_cartera'` y no existe "deshacer endoso"
--    en todo el repo. → 1:1 ✔
--
--  ⚠️ Matiz sobre `comprobante_recibido_id` (lo cazó el sql-reviewer): la
--  afirmación "1:1" vale para los caminos CABLEADOS de hoy, no por diseño.
--  `pagarCostoEvento` (Rendimiento) reenvía el mismo `comprobante_recibido_id`
--  en cada pago y su comentario dice "soporta tandas/adelantos (parcial)" —
--  o sea, pagar en 2 cuotas una línea nacida de una foto con comprobante
--  chocaría contra este índice. Hoy es inalcanzable: `_openPayModal` y
--  `_openBulkPayModal` no tienen ningún handler que las invoque (`_selected`
--  nunca se puebla) y el único flujo vivo —"Cerrar y migrar a Egresos"— filtra
--  `!c.egreso_id`, así que es 1:1 genuino.
--  👉 ANTES de reconectar el pago parcial de Rendimiento hay que revisar este
--     índice (o el pago parcial deja de funcionar con un 23505 crudo).
--
-- ── El predicado, y por qué NO alcanza con `_deleted = false` ──
-- ⚠️ ESTE ARCHIVO NACIÓ MAL Y EL REVIEWER LO FRENÓ. La primera versión
-- filtraba sólo por `_deleted = false`, con el argumento de que "anular y
-- volver a generar tiene que seguir funcionando". **Es falso: anular NO toca
-- `_deleted`** — sólo escribe `estado='anulado'` (la UI misma lo dice: "queda
-- como traza, no se borra"). Y como T4.2 —dos commits antes— dejó "Anular y
-- cargarlo de nuevo" como el ÚNICO camino legal para corregir un movimiento
-- contabilizado, un índice ciego al estado habría vuelto ese camino un
-- callejón sin salida: la fila anulada ocupa el lugar PARA SIEMPRE, el
-- segundo INSERT choca con 23505 y no queda forma de reparar desde la app.
-- El fix habría requerido cirugía SQL a mano, que es exactamente lo que T4.2
-- vino a evitar. Por eso el predicado excluye también los anulados: no
-- debilita nada (las dos inserciones de un doble-click nacen
-- `confirmado`/`pagado`, nunca `anulado`) y libera el lugar justo cuando
-- corresponde. `IS DISTINCT FROM` para que un `estado` NULL no lo evada.
--
-- ⚠️ ALCANCE HONESTO de eso (lo precisó el security-reviewer): el índice
-- PERMITE el re-INSERT tras anular —probado a nivel constraint— pero HOY la
-- app no llega ahí: guards más viejos, ajenos a este archivo, cortan antes.
--   · "Generar pago" sólo se ofrece si `!comp.egreso_id`, y anular no limpia
--     ese FK (sólo escribe `egresos.estado='anulado'`).
--   · Ídem "Generar cobro" con `comprobantes.ingreso_id`.
--   · El endoso: nada revierte `cartera_valores.estado` de 'endosado'.
--   · Y los 3 chequeos de `api.js` miran `_deleted`, no `estado`.
-- O sea: el predicado saca UN cerrojo de los dos. El otro es exactamente lo
-- que arregla **T4.3** (`API.anularCobro` completo), cuya spec (A4) ya pide
-- "que los chequeos 'ya tiene cobro/egreso' excluyan los anulados". Hasta
-- entonces la corrección sigue necesitando mano; lo que este archivo garantiza
-- es que el índice no sea el que lo impida.
--
-- ⚠️ DOS flujos quedan SIN red de base, sólo con el guard de UI:
--   · "Registrar pago" de un vencimiento (y son DOS pantallas gemelas: el
--     módulo `#calendario-adm` y el tab Calendario de Finanzas). El doble
--     click crea 2 egresos DISTINTOS y `vencimientos_generados.egreso_id` se
--     pisa quedándose con el último — el otro queda huérfano e invisible. No
--     hay columna sobre la cual poner un único: el vencimiento no viaja al
--     egreso.
--   · "Generar egreso en Finanzas" desde una OC (`compras.js`). Su guard de
--     idempotencia es un `ilike` sobre el TEXTO del concepto (`_egresoForOC`),
--     no una constraint. Atenuante: ese egreso nace `pendiente`, así que un
--     duplicado no postea asiento de inmediato — quedan dos líneas que un
--     humano revisa antes de pagar. Pero el hueco de doble-pestaña es real.
-- Anotado a propósito para que nadie lea este archivo y crea que la red
-- cubre los 13 botones del hallazgo.
--
-- Verificado en prod antes de escribirlo: 0 duplicados vivos en las 3 claves
-- → los índices se crean limpios, sin limpieza previa.
--
-- Idempotente: CREATE UNIQUE INDEX IF NOT EXISTS + self-audit.

BEGIN;

-- 1) Un comprobante EMITIDO no puede tener dos cobros VIVOS (anulado libera)
CREATE UNIQUE INDEX IF NOT EXISTS ux_ingresos_comprobante_vivo
    ON public.ingresos (comprobante_id)
    WHERE _deleted = false AND estado IS DISTINCT FROM 'anulado' AND comprobante_id IS NOT NULL;

-- 2) Un comprobante RECIBIDO no puede tener dos pagos VIVOS
CREATE UNIQUE INDEX IF NOT EXISTS ux_egresos_comprobante_recibido_vivo
    ON public.egresos (comprobante_recibido_id)
    WHERE _deleted = false AND estado IS DISTINCT FROM 'anulado' AND comprobante_recibido_id IS NOT NULL;

-- 3) Un valor de cartera no se endosa dos veces
CREATE UNIQUE INDEX IF NOT EXISTS ux_egresos_cartera_valor_vivo
    ON public.egresos (cartera_valor_id)
    WHERE _deleted = false AND estado IS DISTINCT FROM 'anulado' AND cartera_valor_id IS NOT NULL;

-- ── Self-audit ──
DO $$
DECLARE
    v_idx INT;
BEGIN
    SELECT count(*) INTO v_idx
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname IN ('ux_ingresos_comprobante_vivo',
                         'ux_egresos_comprobante_recibido_vivo',
                         'ux_egresos_cartera_valor_vivo');
    IF v_idx <> 3 THEN
        RAISE EXCEPTION 'T4.18: se esperaban 3 índices y hay % — abortando', v_idx;
    END IF;

    -- Los 3 tienen que excluir los anulados: sin eso, "Anular y cargarlo de
    -- nuevo" (el único camino que deja T4.2) queda bloqueado para siempre.
    IF (SELECT count(*) FROM pg_indexes
         WHERE schemaname='public'
           AND indexname IN ('ux_ingresos_comprobante_vivo',
                             'ux_egresos_comprobante_recibido_vivo',
                             'ux_egresos_cartera_valor_vivo')
           AND indexdef ILIKE '%anulado%') <> 3 THEN
        RAISE EXCEPTION 'T4.18: algún índice no excluye los anulados — abortando (bloquearía el ciclo anular→regenerar de T4.2)';
    END IF;

    RAISE NOTICE 'T4.18 OK: 3 índices únicos parciales activos (cobro, pago, endoso), con los anulados excluidos.';
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK:
--   DROP INDEX IF EXISTS public.ux_ingresos_comprobante_vivo;
--   DROP INDEX IF EXISTS public.ux_egresos_comprobante_recibido_vivo;
--   DROP INDEX IF EXISTS public.ux_egresos_cartera_valor_vivo;
-- Sin datos que revertir.
--
-- QUÉ VE EL USUARIO SI EL ÍNDICE ATAJA UN DOBLE-SUBMIT: el segundo INSERT
-- falla con 23505 (unique_violation) y la UI muestra el error de Postgres.
-- Es feo pero honesto — y es el segundo click, el que no debía existir. El
-- guard de UI del mismo commit hace que en la práctica casi nunca se vea.
-- ─────────────────────────────────────────────────────────────────────────────
