-- ═══════════════════════════════════════════════════════════════════════════
--  TANDA 7 · TANDA E — datos y base
--  2026-08-29
--
--  Tres bloques independientes. Cada uno se puede correr solo y cada uno tiene
--  su rollback al pie. Ninguno borra filas con contenido.
--
--  Origen: docs/tanda7-ui-manifiesto.md (hallazgos 7, 22, 33 y 48).
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOQUE 1 · Hallazgo 48 — la fase que se queda con fechas fantasma
-- ───────────────────────────────────────────────────────────────────────────
--
-- `fn_evento_jornadas_sync` deriva las fechas de cada fase del MIN/MAX de sus
-- jornadas. Los tres UPDATE terminan en:
--
--     WHERE e.id = v AND s.fmin IS NOT NULL
--
-- Ese guard existe por una razón buena: el modal de "crear evento" escribe las
-- fechas a mano, sin jornadas, y sin el guard el trigger se las borraría la
-- primera vez que alguien tocara una jornada de OTRA fase.
--
-- Pero deja un agujero: si se borran TODAS las jornadas de una fase, el UPDATE
-- se saltea y **el evento se queda con las fechas viejas de una fase que ya no
-- tiene jornadas**. No hay forma de vaciar el armado de un evento: queda
-- mostrando un armado que no existe, y de ahí comen el calendario operativo, el
-- KPI "Próx. armado" y el aviso de armado a 7/2 días.
--
-- El arreglo es angosto a propósito: **sólo limpia cuando la operación fue un
-- DELETE de esa misma fase y no quedó ninguna**. El camino manual (evento con
-- fechas y sin jornadas) sigue intacto, porque ahí nunca hubo un DELETE.
--
-- ⚠️ Lo que NO hace, y por qué: no valida que el desarme sea posterior al
-- armado (hallazgo 2). Esa validación vive en la pantalla. `API.setJornadas`
-- escribe **fila por fila**, con un HTTP por jornada, así que durante una
-- edición normal existen estados intermedios inconsistentes (movés el armado
-- para adelante y todavía no moviste el desarme). Un RAISE acá rechazaría esas
-- ediciones legítimas a mitad de camino. Si alguna vez se quiere el candado en
-- la base, primero hay que hacer que `setJornadas` escriba todo en una sola
-- transacción.

CREATE OR REPLACE FUNCTION public.fn_evento_jornadas_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v UUID := COALESCE(NEW.evento_id, OLD.evento_id);
    v_fase_borrada TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD.fase ELSE NULL END;
    v_quedan INT;
BEGIN
    -- ARMADO
    UPDATE public.eventos e SET
        fecha_armado_inicio  = s.fmin,
        fecha_armado_fin     = s.fmax,
        hora_armado_apertura = s.hini,
        hora_armado_cierre   = s.hfin
    FROM (
        SELECT MIN(fecha) fmin, MAX(fecha) fmax,
            (SELECT hora_inicio FROM public.evento_jornadas WHERE evento_id=v AND fase='armado' ORDER BY fecha ASC,  orden ASC  LIMIT 1) hini,
            (SELECT hora_fin    FROM public.evento_jornadas WHERE evento_id=v AND fase='armado' ORDER BY fecha DESC, orden DESC LIMIT 1) hfin
        FROM public.evento_jornadas WHERE evento_id=v AND fase='armado'
    ) s
    WHERE e.id=v AND s.fmin IS NOT NULL;

    -- EVENTO
    UPDATE public.eventos e SET
        fecha_evento_inicio  = s.fmin,
        fecha_evento_fin     = s.fmax,
        hora_evento_apertura = s.hini,
        hora_evento_cierre   = s.hfin
    FROM (
        SELECT MIN(fecha) fmin, MAX(fecha) fmax,
            (SELECT hora_inicio FROM public.evento_jornadas WHERE evento_id=v AND fase='evento' ORDER BY fecha ASC,  orden ASC  LIMIT 1) hini,
            (SELECT hora_fin    FROM public.evento_jornadas WHERE evento_id=v AND fase='evento' ORDER BY fecha DESC, orden DESC LIMIT 1) hfin
        FROM public.evento_jornadas WHERE evento_id=v AND fase='evento'
    ) s
    WHERE e.id=v AND s.fmin IS NOT NULL;

    -- DESARME
    UPDATE public.eventos e SET
        fecha_desarme_inicio  = s.fmin,
        fecha_desarme_fin     = s.fmax,
        hora_desarme_apertura = s.hini,
        hora_desarme_cierre   = s.hfin
    FROM (
        SELECT MIN(fecha) fmin, MAX(fecha) fmax,
            (SELECT hora_inicio FROM public.evento_jornadas WHERE evento_id=v AND fase='desarme' ORDER BY fecha ASC,  orden ASC  LIMIT 1) hini,
            (SELECT hora_fin    FROM public.evento_jornadas WHERE evento_id=v AND fase='desarme' ORDER BY fecha DESC, orden DESC LIMIT 1) hfin
        FROM public.evento_jornadas WHERE evento_id=v AND fase='desarme'
    ) s
    WHERE e.id=v AND s.fmin IS NOT NULL;

    -- Tanda 7 · hallazgo 48 — se borró la última jornada de una fase: hay que
    -- vaciar SUS fechas, porque los tres UPDATE de arriba se saltean cuando no
    -- queda ninguna. Sólo se toca la fase que perdió la jornada, y sólo si de
    -- verdad quedó en cero.
    IF v_fase_borrada IS NOT NULL THEN
        SELECT COUNT(*) INTO v_quedan
        FROM public.evento_jornadas
        WHERE evento_id = v AND fase = v_fase_borrada;

        IF v_quedan = 0 THEN
            IF v_fase_borrada = 'armado' THEN
                UPDATE public.eventos SET
                    fecha_armado_inicio = NULL, fecha_armado_fin = NULL,
                    hora_armado_apertura = NULL, hora_armado_cierre = NULL
                WHERE id = v;
            ELSIF v_fase_borrada = 'evento' THEN
                UPDATE public.eventos SET
                    fecha_evento_inicio = NULL, fecha_evento_fin = NULL,
                    hora_evento_apertura = NULL, hora_evento_cierre = NULL
                WHERE id = v;
            ELSIF v_fase_borrada = 'desarme' THEN
                UPDATE public.eventos SET
                    fecha_desarme_inicio = NULL, fecha_desarme_fin = NULL,
                    hora_desarme_apertura = NULL, hora_desarme_cierre = NULL
                WHERE id = v;
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$function$;

-- ROLLBACK bloque 1: volver a la versión anterior es sacar el bloque
-- `IF v_fase_borrada IS NOT NULL` y las dos variables declaradas. La definición
-- completa de antes está en el manifiesto de la tanda 7, sección "hallazgo 48".


-- ───────────────────────────────────────────────────────────────────────────
-- BLOQUE 2 · Hallazgo 22 — el número de OC se reusa
-- ───────────────────────────────────────────────────────────────────────────
--
-- El correlativo se calcula sobre las OC vivas, así que reusa los números de
-- las borradas. Hoy conviven OC-0001 viva (id 15) y borrada (id 4), y OC-0002
-- viva (id 16) y borrada (id 7); las próximas van a chocar con OC-0003
-- (borrada, y estaba en estado **pagada**) y OC-0004.
-- El número se imprime en el PDF que se le manda al proveedor.
--
-- El índice es PARCIAL: sólo sobre las vivas. Las borradas pueden repetir sin
-- molestar, que es lo que ya pasa, y así el índice se puede crear hoy sin tener
-- que tocar el histórico.
-- ⚠️ Esto EVITA que se dupliquen de acá en adelante; no cambia el generador del
-- correlativo. Que el próximo número no pise a una borrada es trabajo de la
-- pantalla, y con este índice al menos falla ruidosamente en vez de duplicar.

CREATE UNIQUE INDEX IF NOT EXISTS ux_compras_ordenes_numero_vivas
    ON public.compras_ordenes (numero_oc)
    WHERE COALESCE(_deleted, false) = false AND numero_oc IS NOT NULL;

-- ROLLBACK bloque 2:
--   DROP INDEX IF EXISTS public.ux_compras_ordenes_numero_vivas;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOQUE 3 · Hallazgo 33 — un proyecto con completitud que se contradice
-- ───────────────────────────────────────────────────────────────────────────
--
-- "Stand 2,00 x 2,00 en Univ. Siglo XXI" está en `estado_taller = 'pendiente'`
-- con `completitud_pct = 50` (a pendiente le corresponde 0). Es 1 de 9: dato
-- viejo de antes del fix del trigger de junio, que sólo recalcula cuando la
-- fila se toca.
-- Se corrige con la MISMA tabla de equivalencias que usa el trigger, y sólo
-- donde hoy no coinciden — si alguna fila ya está bien, no se la toca.

UPDATE public.proyectos p
SET completitud_pct = CASE p.estado_taller
        WHEN 'pendiente'  THEN 0
        WHEN 'en_armado'  THEN 25
        WHEN 'listo'      THEN 50
        WHEN 'despachado' THEN 75
        WHEN 'cerrado'    THEN 100
        ELSE COALESCE(p.completitud_pct, 0)
    END
WHERE COALESCE(p._deleted, false) = false
  AND p.estado_taller IS NOT NULL
  AND COALESCE(p.completitud_pct, -1) <> CASE p.estado_taller
        WHEN 'pendiente'  THEN 0
        WHEN 'en_armado'  THEN 25
        WHEN 'listo'      THEN 50
        WHEN 'despachado' THEN 75
        WHEN 'cerrado'    THEN 100
        ELSE COALESCE(p.completitud_pct, 0)
    END;

-- ROLLBACK bloque 3: el valor previo del único proyecto afectado era
--   UPDATE public.proyectos SET completitud_pct = 50
--   WHERE id = '415840e5-e348-45ee-ae36-42b3f5025e28';
-- (Verificar antes de correr el bloque que sigue siendo el único, con la
--  consulta de comprobación de más abajo.)


-- ───────────────────────────────────────────────────────────────────────────
-- COMPROBACIÓN — correr ANTES y DESPUÉS, tiene que dar lo mismo salvo lo tocado
-- ───────────────────────────────────────────────────────────────────────────
-- SELECT 'proyectos con completitud incoherente' k, count(*)::text v
--   FROM public.proyectos p
--  WHERE COALESCE(p._deleted,false)=false AND p.estado_taller IS NOT NULL
--    AND COALESCE(p.completitud_pct,-1) <> CASE p.estado_taller
--          WHEN 'pendiente' THEN 0 WHEN 'en_armado' THEN 25 WHEN 'listo' THEN 50
--          WHEN 'despachado' THEN 75 WHEN 'cerrado' THEN 100 ELSE COALESCE(p.completitud_pct,0) END
-- UNION ALL SELECT 'numeros de OC duplicados entre vivas',
--   (SELECT count(*)::text FROM (SELECT numero_oc FROM public.compras_ordenes
--     WHERE COALESCE(_deleted,false)=false AND numero_oc IS NOT NULL
--     GROUP BY numero_oc HAVING count(*)>1) x)
-- UNION ALL SELECT 'eventos con fechas de una fase sin jornadas',
--   (SELECT count(*)::text FROM public.eventos e
--     WHERE COALESCE(e._deleted,false)=false
--       AND e.fecha_armado_inicio IS NOT NULL
--       AND NOT EXISTS (SELECT 1 FROM public.evento_jornadas j
--                        WHERE j.evento_id=e.id AND j.fase='armado'));


-- ───────────────────────────────────────────────────────────────────────────
-- LO QUE NO ENTRA ACÁ, A PROPÓSITO
-- ───────────────────────────────────────────────────────────────────────────
--
-- · Hallazgo 7 — "Silla Jacobsen" está marcada cotizable con precio $0. Es un
--   ítem real que lee el Cotizador: sacarlo de la lista o ponerle precio es una
--   decisión de Fede, no una corrección técnica. Queda para el triage.
--
-- · Hallazgo 42 — el rol `taller` lee `catalogo_items` con márgenes y las
--   cotizaciones con monto. Se cierra con privilegios por columna (la misma
--   técnica que ya protege `personas.costo_dia_referencial`), pero cambia lo
--   que ve gente que hoy está trabajando: va con Fede.
--
-- · Hallazgo 47 — la fila residual de `cobro_aplicaciones` que apunta a una
--   cuota borrada de un ingreso anulado. Es inerte (verificado: el
--   `monto_cobrado` de esa cuota es 0 y `v_plan_cobro_resumen` no la cuenta) y
--   borrar filas de un circuito contable se consulta antes.
