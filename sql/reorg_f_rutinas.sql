-- ============================================================
--  reorg_f_rutinas.sql — Fase F: motor de RUTINAS recurrentes
--  (Centro de Tareas v2 · el "sistema nervioso" de la capa operativa)
--
--  Aditivo / idempotente. gen_random_uuid() disponible (pgcrypto).
--  Grounded vs sql/fase11_tareas.sql: la tabla `tareas` YA existe con TODAS
--  las columnas que el motor necesita (origen, dedupe_key, fecha_limite,
--  estado, target_role, responsable_id, es_derivada, _deleted, ...). Lo ÚNICO
--  que falta en `tareas` es admitir origen='rutina' en su CHECK → F.0.
--
--  Modelo (Q6 motor único): una sola tabla `rutinas` (plantilla recurrente)
--  cuyas instancias se materializan como CLAIMS en `tareas` (es_derivada=true,
--  origen='rutina', dedupe_key='rutina:<id>:<proxima_fecha>'), reusando el
--  motor de derivadas/claim ya existente. Al marcar Hecha, el front llama a
--  fn_avanzar_rutina (RPC SECURITY DEFINER) que reprograma proxima_fecha y,
--  opcionalmente, sella el activo.
--
--  Decisiones cerradas con Fede:
--   · Q21 = manual + seed transversal (sin auto-plantillas por tipo en v1).
--   · Q24 = pestaña Rutinas admin-level (gating en tareas.js; RLS write = admin).
--   · Q7  = reprog_desde por rutina (completada|programada).
--   · Q8  = seed NO-financiero (cierre/impuestos/ARCA siguen en
--           vencimientos_recurrentes; NO se duplican acá).
--   · Q3  = rutinas.activo_id es text (FK lógica polimórfica: uuid o bigint).
--   · Q25 = rutina sin responsable/rol → cae a bandeja admin (lo resuelve el front).
-- ============================================================

-- ===== F.0 Ampliar el CHECK de tareas.origen para admitir 'rutina' (aditivo) =====
-- Drop robusto por DEFINICIÓN (no depende del nombre auto-generado de la constraint).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.tareas'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%origen%'
  LOOP
    EXECUTE format('ALTER TABLE public.tareas DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.tareas ADD CONSTRAINT tareas_origen_check
    CHECK (origen IN ('manual','paso_proyecto','asignacion','compra','finanzas','rrhh','novedad','rutina'));
END $$;

-- ===== F.1 Tabla rutinas (plantilla recurrente) =====
CREATE TABLE IF NOT EXISTS public.rutinas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         text NOT NULL,
  descripcion    text,
  activo_tipo    text NOT NULL DEFAULT 'general',   -- flota|locacion|equipo|inventario|admin|general
  activo_id      text,                              -- FK lógica polimórfica (uuid o bigint serializado); NULL si transversal (Q3)
  activo_label   text,                              -- snapshot legible (evita JOINs)
  modulo         text NOT NULL DEFAULT 'general',
  target_role    text,
  responsable_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prioridad      text NOT NULL DEFAULT 'normal',
  frecuencia     text NOT NULL DEFAULT 'mensual',   -- mensual|trimestral|semestral|anual|dias
  intervalo_dias int,                               -- usado sólo si frecuencia='dias'
  lead_days      int  NOT NULL DEFAULT 7,           -- cuántos días antes aparece en el Centro de Tareas
  proxima_fecha  date NOT NULL,
  ultima_ejecucion date,
  reprog_desde   text NOT NULL DEFAULT 'completada',-- completada|programada (Q7)
  sello_tabla    text, sello_columna text, sello_id text,  -- sello best-effort del activo
  activa         boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  _deleted       boolean NOT NULL DEFAULT false
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='rutinas_frecuencia_chk') THEN
    ALTER TABLE public.rutinas ADD CONSTRAINT rutinas_frecuencia_chk
      CHECK (frecuencia IN ('mensual','trimestral','semestral','anual','dias'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='rutinas_reprog_chk') THEN
    ALTER TABLE public.rutinas ADD CONSTRAINT rutinas_reprog_chk
      CHECK (reprog_desde IN ('completada','programada'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='rutinas_prioridad_chk') THEN
    ALTER TABLE public.rutinas ADD CONSTRAINT rutinas_prioridad_chk
      CHECK (prioridad IN ('normal','alta','critica'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rutinas_activa ON public.rutinas(activa, proxima_fecha) WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_rutinas_activo ON public.rutinas(activo_tipo, activo_id)  WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_rutinas_role   ON public.rutinas(target_role)             WHERE NOT _deleted;

-- RLS: lectura amplia (authenticated); escritura admin/superadmin.
-- (El front gatea la pestaña Rutinas a admin-level; el RPC fn_avanzar_rutina
--  permite que taller cierre/avance su propia rutina pese a este write=admin.)
ALTER TABLE public.rutinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rutinas_select ON public.rutinas;
CREATE POLICY rutinas_select ON public.rutinas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rutinas_write ON public.rutinas;
CREATE POLICY rutinas_write ON public.rutinas FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','superadmin')));

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_rutinas_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rutinas_updated ON public.rutinas;
CREATE TRIGGER trg_rutinas_updated BEFORE UPDATE ON public.rutinas
  FOR EACH ROW EXECUTE FUNCTION public.set_rutinas_updated_at();

-- ===== F.2 RPC para avanzar rutina (SECURITY DEFINER) =====
-- Calcula la próxima fecha según frecuencia/reprog_desde, sella ultima_ejecucion
-- y, si la rutina define sello_tabla/columna/id, actualiza el activo (best-effort).
-- SECURITY DEFINER + search_path fijo: permite a taller cerrar su rutina aunque
-- rutinas_write sea admin-only, sin abrir un hueco de RLS.
CREATE OR REPLACE FUNCTION public.fn_avanzar_rutina(p_rutina_id uuid, p_fecha date DEFAULT current_date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r      public.rutinas%ROWTYPE;
  v_role text;
  v_base date;
  v_next date;
  v_done date := COALESCE(p_fecha, current_date);
BEGIN
  SELECT * INTO r FROM public.rutinas WHERE id = p_rutina_id AND NOT _deleted;
  IF NOT FOUND THEN RETURN; END IF;

  -- Autorización: la RPC es SECURITY DEFINER y se concede a todo authenticated, así que
  -- DEBE validar acá que el caller pueda cerrar ESTA rutina (sino cualquiera avanzaría
  -- cualquier rutina, sorteando rutinas_write=admin). Mismo ruteo que el front
  -- (tareas.js _gen.rutinas): admin/superadmin siempre; el resto sólo la suya (por
  -- responsable o por rol). auth.uid() IS NULL = contexto privilegiado (consola/service).
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF NOT (
       auth.uid() IS NULL
       OR v_role IN ('admin','superadmin')
       OR (r.responsable_id IS NOT NULL AND r.responsable_id = auth.uid())
       OR (r.target_role  IS NOT NULL AND r.target_role  = v_role)
     ) THEN
    RETURN;  -- no autorizado: no toca nada
  END IF;

  v_base := CASE WHEN r.reprog_desde = 'programada' THEN r.proxima_fecha ELSE v_done END;
  v_next := (CASE r.frecuencia
               WHEN 'mensual'    THEN v_base + interval '1 month'
               WHEN 'trimestral' THEN v_base + interval '3 month'
               WHEN 'semestral'  THEN v_base + interval '6 month'
               WHEN 'anual'      THEN v_base + interval '1 year'
               WHEN 'dias'       THEN v_base + (COALESCE(r.intervalo_dias,30) || ' days')::interval
               ELSE                   v_base + interval '1 month'
             END)::date;

  UPDATE public.rutinas
     SET ultima_ejecucion = v_done, proxima_fecha = v_next, updated_at = now()
   WHERE id = p_rutina_id;

  -- Sello best-effort del activo (ej. produccion_mantenimiento.fecha_proximo_vencimiento de un vehículo).
  -- %I escapa identificadores; id::text = sello_id cubre uuid y bigint. Nunca rompe el avance.
  IF r.sello_tabla IS NOT NULL AND r.sello_columna IS NOT NULL AND r.sello_id IS NOT NULL THEN
    BEGIN
      EXECUTE format('UPDATE public.%I SET %I = $1 WHERE id::text = $2', r.sello_tabla, r.sello_columna)
        USING v_next, r.sello_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_avanzar_rutina(uuid, date) TO authenticated;

-- ===== F.3 Seed transversal NO-FINANCIERO (Q8) =====
-- Idempotente (no duplica por titulo+activo_tipo). Ajustar proxima_fecha si querés
-- una rutina "due hoy" para probar; estos defaults caen a inicio de mes/trimestre.
INSERT INTO public.rutinas
  (titulo, descripcion, activo_tipo, modulo, target_role, prioridad, frecuencia, reprog_desde, lead_days, proxima_fecha)
SELECT v.* FROM (VALUES
  ('Backup de base de datos',      'Verificar backup automático / hacer backup manual', 'admin',      'general',     'admin', 'alta',   'mensual',    'programada',  3, (date_trunc('month', now())   + interval '1 month')::date),
  ('Inventario físico periódico',  'Conteo de stock físico vs sistema',                 'inventario', 'inventario',  'taller','normal', 'trimestral', 'completada', 10, (date_trunc('quarter', now()) + interval '3 month')::date)
) AS v(titulo, descripcion, activo_tipo, modulo, target_role, prioridad, frecuencia, reprog_desde, lead_days, proxima_fecha)
WHERE NOT EXISTS (
  SELECT 1 FROM public.rutinas r
  WHERE r.titulo = v.titulo AND r.activo_tipo = v.activo_tipo AND NOT r._deleted
);

-- ===== FIN reorg_f_rutinas.sql =====
-- Verificación rápida sugerida tras correr:
--   SELECT id, titulo, activo_tipo, target_role, frecuencia, proxima_fecha, activa FROM public.rutinas;
--   -- Probar el avance (ajustá un id real):  SELECT public.fn_avanzar_rutina('<uuid>'::uuid);
