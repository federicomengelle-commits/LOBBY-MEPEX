-- ═══════════════════════════════════════════════════════════════════════════
-- AUDITORÍA 2026-07-31 · T3.9 (A32) — el aviso de stock bajo también al taller
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La matriz del Paso 9 (fila 14) dice "Material bajo stock mínimo → in-app
-- TALLER". El trigger insertaba UNA sola fila con target_role='admin', y la
-- policy de SELECT de `notifications` matchea el rol LITERAL
-- (target_role = fn_user_role(), sin jerarquía salvo superadmin→admin) →
-- esa fila el taller no la ve nunca. El trigger hermano
-- (trg_notif_equipo_estado_fn) sí inserta dos filas (admin + taller):
-- la asimetría era accidente, no decisión.
--
-- Cambio único: recrear `trg_notif_stock_minimo_fn` con el segundo INSERT
-- (target_role='taller'), calcado del de equipos.
--   · El trigger NO se toca (sigue AFTER UPDATE OF stock ON insumos_base).
--   · Sin SECURITY DEFINER (la función original no lo era; el INSERT pasa
--     por la policy notifications_insert WITH CHECK(true) TO authenticated).
--   · Sin entidad_id A PROPÓSITO: insumos_base.id es BIGINT y
--     notifications.entidad_id es UUID (trampa documentada del 2026-07-30,
--     mandarlo abortaría el INSERT entero). El original ya lo omitía.
--
-- Alcance real, para no engañarse: hoy `stock_minimo` es NULL en los 80
-- insumos → el trigger no puede disparar hasta que se cargue (T5.4).
-- Este archivo va acompañado del campo "Stock mínimo" nuevo en el panel de
-- Insumos (costos.js) — sin ese campo la carga de T5.4 no se podía hacer
-- por UI (ningún formulario de la app escribía la columna).
--
-- El lado JS (mismo commit): alertas.js suma 'taller' a
-- _visibility.inventario para que la alerta calculada "stock bajo" también
-- le aparezca en la campanita del galpón.
--
-- Idempotente: CREATE OR REPLACE + self-audit antes del COMMIT.

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_notif_stock_minimo_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_msg TEXT;
BEGIN
    IF NEW.stock_minimo IS NULL OR NEW.stock IS NULL THEN RETURN NEW; END IF;
    -- Dispara solo al CRUZAR el umbral hacia abajo (no en cada update por debajo)
    IF NEW.stock < NEW.stock_minimo
       AND (OLD.stock IS NULL OR OLD.stock >= NEW.stock_minimo) THEN

        v_msg := COALESCE(NEW.nombre, 'Un insumo') || ' quedó en ' || NEW.stock
                 || ' (mínimo ' || NEW.stock_minimo || ')';

        -- Admin (como siempre)
        INSERT INTO public.notifications (tipo, titulo, mensaje, target_role, entidad_tipo, link, prioridad)
        VALUES ('stock_minimo', 'Stock bajo el mínimo', v_msg, 'admin', 'insumo', '#inventario', 'alta');

        -- Taller (T3.9/A32 — matriz Paso 9 fila 14; calcado del trigger de equipos)
        INSERT INTO public.notifications (tipo, titulo, mensaje, target_role, entidad_tipo, link, prioridad)
        VALUES ('stock_minimo', 'Stock bajo el mínimo', v_msg, 'taller', 'insumo', '#inventario', 'alta');

    END IF;
    RETURN NEW;
END;
$function$;

-- ── Self-audit: si no quedó exactamente como se espera, abortar todo ──
-- (sql-reviewer: no alcanza con LIKE sobre el texto — un INSERT comentado
--  seguiría matcheando. Se cuentan los INSERT reales por regexp y además la
--  verificación FUNCIONAL se corre aparte, post-apply, con rollback: UPDATE
--  de prueba que cruza el umbral → deben aparecer 2 filas, admin y taller.)
DO $$
DECLARE
    v_def TEXT;
    v_inserts INT;
BEGIN
    SELECT pg_get_functiondef(p.oid) INTO v_def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'trg_notif_stock_minimo_fn';

    IF v_def IS NULL THEN
        RAISE EXCEPTION 'T3.9: trg_notif_stock_minimo_fn no existe — abortando';
    END IF;
    -- Dos INSERT reales a notifications (no comentarios): las líneas que
    -- ARRANCAN con INSERT (tras espacios), fuera de línea de comentario.
    SELECT count(*) INTO v_inserts
      FROM regexp_split_to_table(v_def, E'\n') AS linea
     WHERE linea ~ '^\s*INSERT INTO public\.notifications';
    IF v_inserts <> 2 THEN
        RAISE EXCEPTION 'T3.9: se esperaban 2 INSERT vivos a notifications y hay % — abortando', v_inserts;
    END IF;
    IF v_def NOT LIKE '%''admin''%' OR v_def NOT LIKE '%''taller''%' THEN
        RAISE EXCEPTION 'T3.9: faltan los destinatarios admin+taller — abortando';
    END IF;

    -- El trigger tiene que seguir colgado de insumos_base, en public, y habilitado
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE t.tgname = 'trg_notif_stock_minimo' AND c.relname = 'insumos_base'
           AND n.nspname = 'public' AND NOT t.tgisinternal AND t.tgenabled <> 'D'
    ) THEN
        RAISE EXCEPTION 'T3.9: el trigger trg_notif_stock_minimo no está colgado/habilitado en public.insumos_base — abortando';
    END IF;

    RAISE NOTICE 'T3.9 OK: trigger con aviso a admin + taller.';
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (si hiciera falta volver): recrear la función con un solo INSERT
-- ('admin'). Esa versión vive en `sql/notif_operativas.sql` (que quedó marcada
-- como SUPERADA por este archivo). No hay datos que revertir: solo cambia qué
-- filas inserta el trigger de acá en adelante.
-- ─────────────────────────────────────────────────────────────────────────────
