-- =====================================================================
-- AUDITORÍA 2026-07-31 · T0.9 — las FKs de `proyecto_id` que faltaban
-- Fecha: 2026-08-05
-- =====================================================================
-- El ítem original decía: "6 ingresos + 1 egreso vivos apuntan a proyectos
-- que no existen (resaca del `DROP TABLE proyectos` de abril). Primero
-- decidir a qué proyecto real va cada uno, y sólo si no se puede
-- reconstruir, blanquear con proyecto_id = NULL + agregar las dos FKs."
--
-- **La decisión ya está tomada y la tomó Fede el 2026-08-05**: esos
-- movimientos son los cobros semilla del 06/04 y el egreso "Tarima stand
-- Coolskin", o sea el dummy que se anuló en T5.2-bis. No hay a qué
-- proyecto reconstruirlos → se blanquea.
--
-- Alcance medido en prod:
--   ingresos   con proyecto_id inexistente : 6  (5 anulados + 1 _deleted)
--   egresos    con proyecto_id inexistente : 1
--   plan_cobro con proyecto_id inexistente : 1  → la fila se BORRÓ, ver abajo
-- Ninguno vivo y sin anular: el blanqueo no toca ningún importe en uso.
--
-- ⚠️ `ON DELETE SET NULL`, no RESTRICT. La app borra proyectos por soft
--    delete (`_deleted`) — `API.deleteProject` va por `UndoHelpers`, nunca
--    hace DELETE físico —, así que la FK sólo se ejerce en una cirugía
--    manual, y ahí SET NULL deja el movimiento vivo y sin imputar (que es
--    recuperable) en vez de frenar la operación entera. Es además la
--    convención del repo para referencias opcionales.
--    Compatible con el candado de T4.2: `fn_candado_mov_contabilizado`
--    excluye `proyecto_id` de los campos que protege en un movimiento
--    contabilizado ("re-imputar es legítimo"), así que un SET NULL
--    disparado por esta FK no lo va a rechazar.
--    Nota conceptual: esto NO habría evitado lo de abril. Un
--    `DROP TABLE proyectos CASCADE` se lleva puesta la constraint misma
--    sin tocar las filas hijas. Protege de un DELETE puntual, no de un DROP.
--
-- =====================================================================
-- ✅ `plan_cobro` — entró DESPUÉS, y el motivo del retraso fue una trampa
-- =====================================================================
-- Lo cazó el sql-reviewer y lo verifiqué contra prod. `plan_cobro` tiene
--
--     CHECK chk_plan_cobro_tiene_dueno (proyecto_id IS NOT NULL
--                                    OR venta_id IS NOT NULL)
--
-- (de `sql/ventas_fase1b_plan_cobro_nullable.sql`), y el plan huérfano
-- —`8c2b86c9-e28d-4def-8240-d1c797f9422c`— tiene **`venta_id` NULL**:
-- hoy cumple el CHECK sólo porque `proyecto_id` no es NULL, aunque apunte
-- a la nada. El CHECK valida NULL-idad, no existencia.
--
-- O sea que `UPDATE plan_cobro SET proyecto_id = NULL` deja esa fila con
-- las dos columnas en NULL → **23514** → aborta la transacción entera y
-- ni siquiera se aplican las FKs de ingresos y egresos, que están sanas.
-- Y no alcanza con filtrar por `_deleted`: un CHECK se evalúa igual sobre
-- una fila soft-deleteada (esta lo está desde T5.2-bis).
--
-- Salir de ahí pedía **borrar físicamente esa fila** (cascadea a sus
-- `plan_cobro_items`), o sea algo destructivo → se consultó.
--
-- **Fede, 2026-08-05: "es dummy también, borralo, es todo mentira."**
-- Se verificó antes de borrar que no tuviera nada colgando: 0 cobros
-- aplicados, 0 ingresos atados, y la única cuota ($4.000.000, `pendiente`,
-- $0 cobrado) ya soft-deleteada. El plan además no cuadraba consigo mismo:
-- declaraba $8.000.000 de total contra una sola cuota de $4.000.000.
-- Aplicado en la migración `auditoria_t0_9b_fk_plan_cobro_proyecto`:
--     DELETE FROM plan_cobro WHERE id = '8c2b86c9-…';
--     ALTER TABLE plan_cobro ADD CONSTRAINT fk_plan_cobro_proyecto …
-- Verificado: 0 planes huérfanos, 0 cuotas sueltas, las 3 FKs creadas.
-- =====================================================================

BEGIN;

-- ── 1. Blanquear los huérfanos (si no, el ADD CONSTRAINT falla) ──
-- Sin filtro de `_deleted` ni de `estado` a propósito: una FK no sabe de
-- soft-delete, así que tiene que alcanzar a TODAS las filas.
-- Verificado: ni `ingresos` ni `egresos` tienen ningún CHECK que mencione
-- `proyecto_id`, así que acá no se repite lo de `plan_cobro`.
UPDATE public.ingresos SET proyecto_id = NULL
 WHERE proyecto_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id);

UPDATE public.egresos  SET proyecto_id = NULL
 WHERE proyecto_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id);

-- ── 2. Las FKs ──
-- Idempotente: Postgres no soporta `ADD CONSTRAINT IF NOT EXISTS`, así que
-- va el DROP delante. Es la convención que ya usa `sql/cotizaciones_fks.sql`
-- para este mismo patrón (blanquear huérfanos + FK a `proyectos`).
ALTER TABLE public.ingresos DROP CONSTRAINT IF EXISTS fk_ingresos_proyecto;
ALTER TABLE public.ingresos
    ADD CONSTRAINT fk_ingresos_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id) ON DELETE SET NULL;

ALTER TABLE public.egresos DROP CONSTRAINT IF EXISTS fk_egresos_proyecto;
ALTER TABLE public.egresos
    ADD CONSTRAINT fk_egresos_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id) ON DELETE SET NULL;

-- ── 3. Self-audit: aborta si quedó algún huérfano o falta alguna FK ──
DO $$
DECLARE v_huerfanos INT; v_fks INT;
BEGIN
    SELECT (SELECT COUNT(*) FROM public.ingresos i WHERE i.proyecto_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = i.proyecto_id))
         + (SELECT COUNT(*) FROM public.egresos  e WHERE e.proyecto_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = e.proyecto_id))
      INTO v_huerfanos;
    SELECT COUNT(*) INTO v_fks FROM pg_constraint
     WHERE conname IN ('fk_ingresos_proyecto','fk_egresos_proyecto');
    IF v_huerfanos > 0 THEN RAISE EXCEPTION 'Quedaron % huérfanos', v_huerfanos; END IF;
    IF v_fks <> 2     THEN RAISE EXCEPTION 'Se crearon % de 2 FKs', v_fks; END IF;
    RAISE NOTICE 'T0.9 OK — 0 huérfanos, 2 FKs creadas. La 3ra (plan_cobro) va en la migración auditoria_t0_9b_fk_plan_cobro_proyecto.';
END $$;

COMMIT;

-- =====================================================================
-- T0.9b — lo que queda abierto en este frente (la FK de plan_cobro ya está)
-- =====================================================================
-- 1. Hay **5 tablas más con `proyecto_id UUID` y ninguna FK**, verificado
--    contra prod el 2026-08-05: `comprobantes`, `comprobantes_recibidos`,
--    `cartera_valores`, `crm_casos` y `compras_ordenes`. Hoy no tienen
--    huérfanos —por eso no aparecieron en el tablero del 31/07, que contó
--    relaciones CON filas rotas, no relaciones sin constraint— pero es el
--    mismo hueco de schema que causó T0.9. Las dos primeras son las más
--    calientes: Facturación escribe ahí todos los días.
--
-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- ALTER TABLE public.ingresos   DROP CONSTRAINT IF EXISTS fk_ingresos_proyecto;
-- ALTER TABLE public.egresos    DROP CONSTRAINT IF EXISTS fk_egresos_proyecto;
-- ALTER TABLE public.plan_cobro DROP CONSTRAINT IF EXISTS fk_plan_cobro_proyecto;
--
-- El DELETE de la fila 8c2b86c9 NO se puede revertir (era un plan dummy sin
-- nada colgando; sus datos están arriba, en esta misma cabecera).
--
-- El blanqueo del paso 1 NO se revierte: los `proyecto_id` que se borran
-- apuntaban a proyectos inexistentes, así que el valor viejo no
-- significaba nada. Los ids de los movimientos están en
-- `sql/auditoria_t5_2bis_blanqueo_libro.sql`.
