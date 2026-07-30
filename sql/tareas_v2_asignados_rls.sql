-- ═══════════════════════════════════════════════════════════════════
-- TAREAS v2 · ASIGNACIÓN MÚLTIPLE + HISTORIAL + RLS REAL   (Etapa E1)
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-07-28. Ejecuta la Etapa E1 de docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md
-- (spec: docs/jordi/01-INSTRUCCIONES-CLAUDE-MODULO-TAREAS.md §4 y §5).
--
-- ⚠️ POR QUÉ ESTE ARCHIVO ES URGENTE
--   `sql/fase11_tareas.sql` dejó la RLS de `tareas` así:
--       CREATE POLICY tareas_rls_auth ON tareas FOR ALL TO authenticated
--         USING (true) WITH CHECK (true);
--   → CUALQUIER usuario logueado puede leer, editar y borrar TODAS las tareas
--     de la empresa desde la consola del navegador. Esto lo cierra.
--
-- QUÉ HACE
--   1. ALTER `tareas`: + is_urgent (gatillo del push) + categoria.
--   2. Tabla `tarea_asignados` — N roles y/o N personas por tarea (tagueo Discord).
--   3. Tabla `tarea_actividad` — historial de cambios de estado.
--   4. Funciones de visibilidad (reusan fn_user_role() de sql/rls_capa2_motor.sql).
--   5. BACKFILL de las asignaciones actuales  ← sin esto desaparecen tareas de la vista.
--   6. RLS de verdad + triggers que protegen los campos privilegiados.
--
-- NO TOCA: origen, dedupe_key, es_derivada, el claim por pool, ni las rutinas.
--   El módulo `tareas.js` sigue andando igual después de correr esto (solo va a
--   ver menos filas, que es exactamente el punto).
--
-- DECISIONES APLICADAS (cerradas con Fede 2026-07-28, ver §PARTE B del plan):
--   · D3  asignar a otros = superadmin | admin | pm  ·  marcar urgente = solo superadmin
--   · D6  ven TODO = superadmin | admin   (convención `_adminLevel` de tareas.js:137)
--         pm/venta/taller ven: lo asignado a su rol, lo asignado a ellos, y lo que crearon.
--         Para cambiarlo: es la línea marcada [D6] en fn_tarea_visible().
--
-- Idempotente (CREATE IF NOT EXISTS / OR REPLACE / DROP+CREATE de policies).
-- Rollback comentado al pie.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 0 · VERIFICACIÓN PREVIA — correr ESTO SOLO, primero, y mirar la salida
-- ───────────────────────────────────────────────────────────────────
-- Regla 12 de CLAUDE.md: el SQL del repo puede estar desfasado de prod.
-- Descomentá y corré este bloque ANTES del resto. Tiene que devolver las
-- columnas de fase11 (titulo, estado, prioridad, responsable_id, target_role,
-- fecha_limite, es_derivada, dedupe_key, created_by, _deleted...).
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='tareas'
--    ORDER BY ordinal_position;
--
--   -- ¿existe el motor de RLS que este archivo reusa?
--   SELECT proname FROM pg_proc
--    WHERE proname IN ('fn_user_role','fn_role_can') AND pronamespace='public'::regnamespace;
--
--   -- ¿cuántas tareas vivas hay hoy? (para comparar después del backfill)
--   SELECT count(*) AS vivas,
--          count(*) FILTER (WHERE responsable_id IS NOT NULL) AS con_responsable,
--          count(*) FILTER (WHERE target_role    IS NOT NULL) AS con_rol
--     FROM public.tareas WHERE NOT _deleted;
--
-- Si `fn_user_role` NO aparece → correr primero sql/rls_capa2_motor.sql.
-- ───────────────────────────────────────────────────────────────────


BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1 · ALTER `tareas`
-- ═══════════════════════════════════════════════════════════════════

-- is_urgent: el ÚNICO gatillo del push (doc 01 §7.1). Deliberadamente separado
-- de `prioridad`: la prioridad es un color en la tarjeta, el urgente interrumpe
-- un celular. Mezclarlos convierte el push en ruido y deja de ser señal.
ALTER TABLE public.tareas
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

-- categoria: la del doc 01 §4.1. NO reemplaza a `modulo` (que son los 17 valores
-- para el deep-link); son ejes distintos y conviven.
ALTER TABLE public.tareas
  ADD COLUMN IF NOT EXISTS categoria text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'chk_tareas_categoria'
                    AND conrelid = 'public.tareas'::regclass) THEN
    ALTER TABLE public.tareas
      ADD CONSTRAINT chk_tareas_categoria
      CHECK (categoria IS NULL OR categoria IN ('evento','marketing','comercial','operaciones'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tareas_urgentes
  ON public.tareas (is_urgent) WHERE is_urgent AND NOT _deleted;


-- ═══════════════════════════════════════════════════════════════════
-- 2 · `tarea_asignados` — N roles y/o N personas por tarea
-- ═══════════════════════════════════════════════════════════════════
-- Por qué tabla aparte y no columnas: una tarea puede ir a @taller + @venta +
-- Walter a la vez (doc 01 §4.2). Con columnas no se puede.
CREATE TABLE IF NOT EXISTS public.tarea_asignados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id    uuid NOT NULL REFERENCES public.tareas(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('rol','usuario')),
  rol         text,                                                    -- si tipo='rol'
  usuario_id  uuid REFERENCES public.profiles(id) ON DELETE CASCADE,   -- si tipo='usuario'
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- EXACTAMENTE uno de los dos, y coherente con `tipo` (doc 01 §4.2:
  -- "agregá un CHECK a nivel base, no confíes solo en la validación del front").
  CONSTRAINT chk_tarea_asignado_exclusivo CHECK (
    (tipo = 'rol'     AND rol IS NOT NULL AND usuario_id IS NULL) OR
    (tipo = 'usuario' AND usuario_id IS NOT NULL AND rol IS NULL)
  )
);

-- `rol` acotado a los roles reales. No es cosmético: este valor termina
-- concatenado en un filtro PostgREST del connector de push, que corre con la
-- service key (bypassa RLS). Sin el CHECK, un rol con `)`/`&`/`"` guardado por
-- un pm podía ampliar esa consulta. (El connector además tiene su propio
-- allowlist — defensa en profundidad, no una sola línea de la que depender.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'chk_tarea_asignado_rol'
                    AND conrelid = 'public.tarea_asignados'::regclass) THEN
    ALTER TABLE public.tarea_asignados
      ADD CONSTRAINT chk_tarea_asignado_rol
      CHECK (rol IS NULL OR rol IN ('superadmin','admin','pm','venta','taller'));
  END IF;
END $$;

-- Anti-duplicados (doc 01 §4.2). Parciales porque la columna contraria es NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tarea_asignado_rol
  ON public.tarea_asignados (tarea_id, rol) WHERE rol IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tarea_asignado_usuario
  ON public.tarea_asignados (tarea_id, usuario_id) WHERE usuario_id IS NOT NULL;

-- El índice que más se usa: "¿esta tarea me toca?" (lo pega la RLS por fila).
CREATE INDEX IF NOT EXISTS idx_tarea_asignados_lookup
  ON public.tarea_asignados (tarea_id, usuario_id, rol);
CREATE INDEX IF NOT EXISTS idx_tarea_asignados_usuario
  ON public.tarea_asignados (usuario_id) WHERE usuario_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 3 · `tarea_actividad` — historial (doc 01 §4.3)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tarea_actividad (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id      uuid NOT NULL REFERENCES public.tareas(id) ON DELETE CASCADE,
  actor_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  estado_desde  text,
  estado_hasta  text NOT NULL,
  comentario    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarea_actividad_tarea
  ON public.tarea_actividad (tarea_id, created_at DESC);


-- ═══════════════════════════════════════════════════════════════════
-- 4 · FUNCIONES DE VISIBILIDAD Y PERMISO
-- ═══════════════════════════════════════════════════════════════════
-- Todas SECURITY DEFINER + STABLE, igual que fn_user_role()/fn_role_can().
-- Eso es lo que evita la recursión de policies que advierte el doc 01 §5.2:
-- la función lee `tarea_asignados` y `tareas` BYPASSEANDO RLS, así que una
-- policy que la llame no vuelve a disparar policies.

-- ¿Puede asignar a otros / reasignar / marcar urgente? (D3)
CREATE OR REPLACE FUNCTION public.fn_tareas_puede_asignar()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_user_role() IN ('superadmin','admin','pm');
$$;

-- Nivel admin (ve todo, borra). [D6]
CREATE OR REPLACE FUNCTION public.fn_tareas_admin_level()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_user_role() IN ('superadmin','admin');
$$;

-- ─── ¿El usuario actual ve esta tarea? (doc 01 §5.1) ───
-- Recibe las columnas de la fila por parámetro en vez de re-leer `tareas`:
-- más barato (la policy ya tiene la fila en la mano) y elimina de raíz
-- cualquier chance de recursión.
CREATE OR REPLACE FUNCTION public.fn_tarea_visible(
  p_tarea_id       uuid,
  p_created_by     uuid,
  p_responsable_id uuid,
  p_target_role    text
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    -- [D6] superadmin + admin ven todo. Para restringir a solo superadmin,
    --      cambiar fn_tareas_admin_level() por (fn_user_role() = 'superadmin').
    WHEN public.fn_tareas_admin_level() THEN true
    -- 3. la creó
    WHEN p_created_by = auth.uid() THEN true
    -- 2. es su responsable (incluye el claim de una tarea de pool)
    WHEN p_responsable_id = auth.uid() THEN true
    -- 1.bis pool legacy de fase11: target_role = su rol
    WHEN p_target_role IS NOT NULL AND p_target_role = public.fn_user_role() THEN true
    -- 1. asignada a su rol o a él en particular (tabla nueva)
    ELSE EXISTS (
      SELECT 1 FROM public.tarea_asignados a
       WHERE a.tarea_id = p_tarea_id
         AND (a.usuario_id = auth.uid() OR a.rol = public.fn_user_role())
    )
  END;
$$;

-- Versión por-id, para las policies de las tablas hijas
-- ("si no ve la tarea, no ve su historial" — doc 01 §5.2).
CREATE OR REPLACE FUNCTION public.fn_tarea_visible_por_id(p_tarea_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT public.fn_tarea_visible(t.id, t.created_by, t.responsable_id, t.target_role)
      FROM public.tareas t WHERE t.id = p_tarea_id
  ), false);
$$;

GRANT EXECUTE ON FUNCTION public.fn_tareas_puede_asignar()                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_tareas_admin_level()                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_tarea_visible(uuid, uuid, uuid, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_tarea_visible_por_id(uuid)                  TO authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- 5 · BACKFILL  ← EL PASO QUE NO SE PUEDE SALTEAR
-- ═══════════════════════════════════════════════════════════════════
-- Si se activa la RLS nueva sin esto, las tareas que hoy están asignadas por
-- `responsable_id` / `target_role` quedan sin fila en `tarea_asignados`.
-- (La policy igual las cubre por las ramas legacy, pero el Kanban de E3 lee
--  `tarea_asignados` para pintar los chips → sin backfill se ven "sin asignar".)
-- Corre como postgres, así que bypassa RLS. Idempotente por los índices únicos.
--
-- ⚠️ PARA E3 (Kanban): esto es una FOTO, no queda sincronizado. Hoy es inofensivo
--    (`tareas.js` no lee `tarea_asignados`; la rama EXISTS de fn_tarea_visible es
--    defensiva). Pero cuando el Kanban empiece a escribir asignaciones ahí, la
--    escritura tiene que ser la ÚNICA fuente — si se sigue tocando
--    `tareas.responsable_id` por un lado y `tarea_asignados` por otro, un
--    ex-responsable conserva visibilidad. Decidir en E3: o se sincroniza por
--    trigger, o `responsable_id` queda como cache de conveniencia.

INSERT INTO public.tarea_asignados (tarea_id, tipo, usuario_id)
SELECT t.id, 'usuario', t.responsable_id
  FROM public.tareas t
 WHERE t.responsable_id IS NOT NULL AND NOT t._deleted
ON CONFLICT DO NOTHING;

INSERT INTO public.tarea_asignados (tarea_id, tipo, rol)
SELECT t.id, 'rol', t.target_role
  FROM public.tareas t
 WHERE t.target_role IS NOT NULL AND NOT t._deleted
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 6 · TRIGGERS
-- ═══════════════════════════════════════════════════════════════════

-- 6.a · created_by automático. `tareas.js` a veces inserta sin él (el claim de
--       una derivada); si queda NULL, la condición "él la creó" nunca aplica.
CREATE OR REPLACE FUNCTION public.fn_tareas_set_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tareas_creator ON public.tareas;
CREATE TRIGGER trg_tareas_creator BEFORE INSERT ON public.tareas
  FOR EACH ROW EXECUTE FUNCTION public.fn_tareas_set_creator();


-- 6.b · Campos privilegiados. Una policy no puede restringir POR COLUMNA, así
--       que el guard va acá.
--       Doc 01 §5.2: "el resto NO puede cambiar asignaciones ni el flag de urgencia".
--
--       Criterio (revisión 2026-07-28): lo que el actor NO puede tocar se revierte
--       en silencio, PERO el borrado se RECHAZA con excepción. Motivo: doc 01 §6.2
--       pide "si la base rechaza, mostrá el error", y un revert mudo en el borrado
--       dejaba a `UndoHelpers.deleteRecord` escribiendo en `audit_log` un borrado
--       que nunca ocurrió, sin toast, con la tarea todavía en pantalla.
CREATE OR REPLACE FUNCTION public.fn_tareas_guard_campos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Sin sesión = service_role / SQL editor / job del servidor → no se toca nada.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  -- `created_by` es INMUTABLE para todos, siempre.
  -- Sin esto se cae medio modelo: `tareas.js` manda `created_by: uid` en cada
  -- claim (`_upsertClaim` en 'tomar'/'hecha') y en `_reasignarModal`, así que el
  -- que TOMA una tarea pasaba a figurar como su creador → (a) el PM que la delegó
  -- dejaba de verla (regla 3 de visibilidad "él la creó") justo cuando alguien
  -- empezaba a trabajarla, y (b) el que la tomó quedaba habilitado a borrarla.
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    NEW.created_by := OLD.created_by;
  END IF;

  -- Marcar urgente (= disparar push a celulares) = SOLO superadmin. [D3]
  IF NEW.is_urgent IS DISTINCT FROM OLD.is_urgent
     AND public.fn_user_role() <> 'superadmin' THEN
    NEW.is_urgent := OLD.is_urgent;
  END IF;

  IF NOT public.fn_tareas_puede_asignar() THEN
    -- No puede mover el pool de rol.
    NEW.target_role := OLD.target_role;
    -- Sí puede TOMAR una tarea LIBRE para sí (el claim, que ya existe hoy) o
    -- soltar la propia; no puede endosársela a otro ni robársela a un compañero
    -- que ya la tomó.
    IF NEW.responsable_id IS DISTINCT FROM OLD.responsable_id
       AND NEW.responsable_id IS NOT NULL
       AND (NEW.responsable_id <> auth.uid()
            OR (OLD.responsable_id IS NOT NULL AND OLD.responsable_id <> auth.uid())) THEN
      NEW.responsable_id := OLD.responsable_id;
    END IF;
  END IF;

  -- Borrado lógico: admin-level o el que la creó. Rechazo explícito (ver arriba).
  IF NEW._deleted IS DISTINCT FROM OLD._deleted
     AND NOT public.fn_tareas_admin_level()
     AND OLD.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'No tenés permiso para eliminar o restaurar esta tarea'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tareas_guard ON public.tareas;
CREATE TRIGGER trg_tareas_guard BEFORE UPDATE ON public.tareas
  FOR EACH ROW EXECUTE FUNCTION public.fn_tareas_guard_campos();


-- 6.c · Mismo guard, en el INSERT.
--       ⚠️ Sin esto quedaba abierto el agujero que este archivo dice cerrar, por
--       la puerta de atrás: el guard de 6.b solo corre en UPDATE, así que un
--       `venta` o `taller` podía CREAR de una una tarea con target_role='admin'
--       o con responsable_id = el uuid de otra persona (le aparece una tarea
--       fantasma en su bandeja). Alcanzable desde la consola Y desde el modal
--       "+ Nueva tarea", que hoy no gatea el selector de destino por rol.
CREATE OR REPLACE FUNCTION public.fn_tareas_guard_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;   -- service_role / SQL editor

  -- Nacer urgente (= push a celulares) = solo superadmin. [D3]
  IF NEW.is_urgent AND public.fn_user_role() <> 'superadmin' THEN
    NEW.is_urgent := false;
  END IF;

  IF NOT public.fn_tareas_puede_asignar() THEN
    NEW.target_role := NULL;                       -- no puede sembrar en pool ajeno
    IF NEW.responsable_id IS NOT NULL AND NEW.responsable_id <> auth.uid() THEN
      NEW.responsable_id := auth.uid();            -- se la queda él, no la endosa
    END IF;
    -- Tampoco puede fabricar una tarea "ya completada por" otro.
    IF NEW.completada_por IS NOT NULL AND NEW.completada_por <> auth.uid() THEN
      NEW.completada_por := NULL;
      NEW.completada_at  := NULL;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tareas_guard_ins ON public.tareas;
CREATE TRIGGER trg_tareas_guard_ins BEFORE INSERT ON public.tareas
  FOR EACH ROW EXECUTE FUNCTION public.fn_tareas_guard_insert();


-- 6.d · Historial automático de estado (doc 01 §6.2: "cada movimiento escribe en
--       task_activity"). Va en trigger y no en el JS para que registre también
--       los cambios que vienen de otro lado (rutinas, claims, scripts).
CREATE OR REPLACE FUNCTION public.fn_tareas_log_estado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tarea_actividad (tarea_id, actor_id, estado_desde, estado_hasta)
    VALUES (NEW.id, COALESCE(NEW.created_by, auth.uid()), NULL, NEW.estado);
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO public.tarea_actividad (tarea_id, actor_id, estado_desde, estado_hasta)
    VALUES (NEW.id, auth.uid(), OLD.estado, NEW.estado);
  END IF;
  RETURN NULL;   -- AFTER trigger
END $$;

DROP TRIGGER IF EXISTS trg_tareas_log_estado ON public.tareas;
CREATE TRIGGER trg_tareas_log_estado AFTER INSERT OR UPDATE OF estado ON public.tareas
  FOR EACH ROW EXECUTE FUNCTION public.fn_tareas_log_estado();


-- ═══════════════════════════════════════════════════════════════════
-- 7 · RLS — acá se cierra el agujero
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

-- Fuera la policy abierta de fase11.
DROP POLICY IF EXISTS tareas_rls_auth ON public.tareas;

DROP POLICY IF EXISTS tareas_sel ON public.tareas;
CREATE POLICY tareas_sel ON public.tareas FOR SELECT TO authenticated
  USING (public.fn_tarea_visible(id, created_by, responsable_id, target_role));

-- Cualquiera crea (doc 01 §5.2, default explícito de Jordi). Los guards de 6.b/6.c
-- se encargan de que no pueda nacer urgente ni asignada a otro si no corresponde.
DROP POLICY IF EXISTS tareas_ins ON public.tareas;
CREATE POLICY tareas_ins ON public.tareas FOR INSERT TO authenticated
  WITH CHECK (created_by IS NULL OR created_by = auth.uid() OR public.fn_tareas_puede_asignar());

-- Mueve de columna solo lo que ve. El WITH CHECK con la fila NUEVA evita que
-- alguien "se saque de encima" una tarea reasignándola para perderla de vista.
DROP POLICY IF EXISTS tareas_upd ON public.tareas;
CREATE POLICY tareas_upd ON public.tareas FOR UPDATE TO authenticated
  USING      (public.fn_tarea_visible(id, created_by, responsable_id, target_role))
  WITH CHECK (public.fn_tarea_visible(id, created_by, responsable_id, target_role));

DROP POLICY IF EXISTS tareas_del ON public.tareas;
CREATE POLICY tareas_del ON public.tareas FOR DELETE TO authenticated
  USING (public.fn_tareas_admin_level());


-- ─── tarea_asignados: si no ve la tarea, no ve ni toca su asignación ───
ALTER TABLE public.tarea_asignados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tarea_asignados_sel ON public.tarea_asignados;
CREATE POLICY tarea_asignados_sel ON public.tarea_asignados FOR SELECT TO authenticated
  USING (public.fn_tarea_visible_por_id(tarea_id));

DROP POLICY IF EXISTS tarea_asignados_ins ON public.tarea_asignados;
CREATE POLICY tarea_asignados_ins ON public.tarea_asignados FOR INSERT TO authenticated
  WITH CHECK (public.fn_tareas_puede_asignar() AND public.fn_tarea_visible_por_id(tarea_id));

DROP POLICY IF EXISTS tarea_asignados_del ON public.tarea_asignados;
CREATE POLICY tarea_asignados_del ON public.tarea_asignados FOR DELETE TO authenticated
  USING (public.fn_tareas_puede_asignar() AND public.fn_tarea_visible_por_id(tarea_id));
-- (sin UPDATE a propósito: una asignación se agrega o se quita, no se edita)


-- ─── tarea_actividad: lectura si ve la tarea. Se escribe SOLO por trigger ───
ALTER TABLE public.tarea_actividad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tarea_actividad_sel ON public.tarea_actividad;
CREATE POLICY tarea_actividad_sel ON public.tarea_actividad FOR SELECT TO authenticated
  USING (public.fn_tarea_visible_por_id(tarea_id));

-- SIN policy de INSERT a propósito: el historial lo escribe EXCLUSIVAMENTE el
-- trigger 6.d (SECURITY DEFINER → no pasa por policies). Una policy de insert
-- manual permitía fabricar transiciones que nunca ocurrieron ("pasé esto de
-- pendiente a hecha") y ensuciar la fuente del aviso de avance al superadmin.
-- Los comentarios en hilo están fuera de alcance de esta tanda (doc 01 §9);
-- cuando se hagan, van con una columna `fuente` que distinga sistema de manual.
-- Historial inmutable: sin INSERT, UPDATE ni DELETE para nadie (ni admin).

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- 8 · VERIFICACIÓN — correr DESPUÉS, y además probar desde la app
-- ═══════════════════════════════════════════════════════════════════
-- (a) Las 3 tablas con RLS activa y la policy abierta muerta:
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename IN ('tareas','tarea_asignados','tarea_actividad');
--   SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname='public' AND tablename='tareas' ORDER BY policyname;
--   -- NO tiene que aparecer `tareas_rls_auth`.
--
-- (b) El backfill cubrió todo lo que estaba asignado:
--   SELECT (SELECT count(*) FROM tareas WHERE NOT _deleted AND responsable_id IS NOT NULL) AS con_resp,
--          (SELECT count(*) FROM tarea_asignados WHERE tipo='usuario')                     AS filas_usuario,
--          (SELECT count(*) FROM tareas WHERE NOT _deleted AND target_role IS NOT NULL)    AS con_rol,
--          (SELECT count(*) FROM tarea_asignados WHERE tipo='rol')                         AS filas_rol;
--
-- (c) LA PRUEBA QUE IMPORTA (criterio de aceptación del doc 01 §8, se hace desde
--     la app logueado como un usuario `taller`, NO con service role — F12 → consola):
--
--       await supabaseClient.from('tareas').select('id,titulo').then(r => r.data.length)
--       // → solo las suyas / de su rol / las que creó
--
--       await supabaseClient.from('tareas').select('*').eq('id','<id de una tarea de otro rol>')
--       // → data: []   ← si devuelve la fila, la RLS NO está funcionando
--
--       await supabaseClient.from('tareas').update({is_urgent:true}).eq('id','<una que sí ve>')
--       // → guarda, pero al releerla is_urgent sigue en false (guard 6.b)
--
--     Y los 3 que agregó la revisión (los dos HIGH y el MEDIUM):
--
--       await supabaseClient.from('tareas').insert({titulo:'probe', target_role:'admin'})
--       // → se inserta con target_role NULL, NO en el pool de admin      (guard 6.c)
--
--       await supabaseClient.from('tareas').insert({titulo:'probe2', responsable_id:'<uuid de otro>'})
--       // → queda a nombre del que la creó, no del otro                  (guard 6.c)
--
--       await supabaseClient.from('tareas').update({_deleted:true}).eq('id','<una que NO creó>')
--       // → ERROR 42501 "No tenés permiso..." (rechazo explícito, no silencio)
--
--     (borrar las filas 'probe' después: DELETE FROM tareas WHERE titulo LIKE 'probe%';)
--
-- (d) Smoke del módulo: entrar a #tareas con cada rol, confirmar que la lista
--     carga, que "Tomar" y "Hecha" siguen andando y que las rutinas no se rompieron.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK (si algo sale mal, deja el sistema como estaba)
-- ═══════════════════════════════════════════════════════════════════
-- BEGIN;
--   DROP POLICY IF EXISTS tareas_sel ON public.tareas;
--   DROP POLICY IF EXISTS tareas_ins ON public.tareas;
--   DROP POLICY IF EXISTS tareas_upd ON public.tareas;
--   DROP POLICY IF EXISTS tareas_del ON public.tareas;
--   CREATE POLICY tareas_rls_auth ON public.tareas
--     FOR ALL TO authenticated USING (true) WITH CHECK (true);
--   DROP TRIGGER IF EXISTS trg_tareas_guard     ON public.tareas;
--   DROP TRIGGER IF EXISTS trg_tareas_guard_ins ON public.tareas;
--   DROP TRIGGER IF EXISTS trg_tareas_log_estado ON public.tareas;
--   DROP TRIGGER IF EXISTS trg_tareas_creator   ON public.tareas;
-- COMMIT;
-- (Las tablas nuevas y las columnas se pueden dejar: son aditivas e inertes.)
-- ═══════════════════════════════════════════════════════════════════
