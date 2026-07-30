-- ═══════════════════════════════════════════════════════════════════
-- NOTIFICACIONES · PREFERENCIAS POR USUARIO Y CANAL          (Etapa N1)
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-07-30. Etapa N1 de docs/notificaciones-rework-plan.md.
--
-- QUÉ RESUELVE
--   Hoy las preferencias viven en el localStorage de cada navegador
--   (`mepex_notif_mute_<uid>`) y solo admiten "recibir / no recibir". Eso trae
--   dos problemas que con el push pasaron de molestos a importantes:
--     1. Lo que silenciás en la compu no aplica en el celular.
--     2. No se puede elegir POR DÓNDE llega: campanita o teléfono.
--
-- MODELO
--   Una fila por (usuario, categoría). La AUSENCIA de fila = los defaults del
--   catálogo, así que no hay que sembrar nada ni migrar a nadie: quien nunca
--   tocó una preferencia simplemente no tiene filas.
--   Las categorías son las claves de `Notifications.TIPO_CATALOG` (notifications.js):
--   logistica · asignaciones · taller · compras · inventario · comercial ·
--   eventos · tareas.
--
-- POR QUÉ EL CHECK DE `categoria` ES UNA REGEX Y NO UN ENUM
--   El catálogo vive en el front y cambia más seguido que el schema: un enum
--   obligaría una migración por cada categoría nueva y haría fallar el guardado
--   desde una pestaña vieja. Pero SIN ningún constraint tampoco puede quedar:
--   este valor lo escribe cualquier usuario autenticado (puede pegarle directo a
--   PostgREST con su JWT, salteando el JS y su TIPO_CATALOG) y en N2 lo va a leer
--   el connector de push con la SERVICE KEY. Es el mismo patrón que ya nos mordió
--   con `tarea_asignados.rol`: texto libre → concatenado en un filtro PostgREST
--   → un `)`/`&`/`"` rompe la query y la amplía.
--   La regex acota el formato a un slug sin tocar la flexibilidad, y de paso
--   fuerza minúsculas (evita que 'Tareas' y 'tareas' convivan como filas distintas).
--
-- HORARIO DE SILENCIO (D3: 21:00–07:00, solo lo urgente lo atraviesa)
--   NO se guarda acá: es una regla global, la aplica el connector de push.
--   Si algún día se hace configurable por persona, se suma columna.
--
-- Aditivo. No toca `notifications`, `alertas` ni nada existente.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.notificacion_prefs (
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  categoria  text        NOT NULL CHECK (categoria ~ '^[a-z_]{1,40}$'),
  in_app     boolean     NOT NULL DEFAULT true,   -- campanita
  push       boolean     NOT NULL DEFAULT false,  -- celular
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, categoria)
);

-- La consulta caliente es siempre "dame TODAS las preferencias de este usuario"
-- (se cachean en memoria al abrir la app), y la PK ya la cubre por prefijo.

COMMENT ON TABLE public.notificacion_prefs IS
  'Preferencias de notificación por usuario y categoría. Sin fila = defaults del catálogo (notifications.js).';

-- ─── updated_at automático ───
CREATE OR REPLACE FUNCTION public.fn_notif_prefs_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_notif_prefs_touch ON public.notificacion_prefs;
CREATE TRIGGER trg_notif_prefs_touch BEFORE UPDATE ON public.notificacion_prefs
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_prefs_touch();

-- ─── RLS: cada uno ve y edita SOLO las suyas ───
-- Sin excepción para admin: las preferencias de notificación de otro no son
-- asunto de nadie. (El superadmin igual puede ver la cobertura agregada con la
-- consulta del pie, que corre con service key desde el servidor.)
ALTER TABLE public.notificacion_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_prefs_sel ON public.notificacion_prefs;
CREATE POLICY notif_prefs_sel ON public.notificacion_prefs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notif_prefs_ins ON public.notificacion_prefs;
CREATE POLICY notif_prefs_ins ON public.notificacion_prefs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notif_prefs_upd ON public.notificacion_prefs;
CREATE POLICY notif_prefs_upd ON public.notificacion_prefs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notif_prefs_del ON public.notificacion_prefs;
CREATE POLICY notif_prefs_del ON public.notificacion_prefs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename='notificacion_prefs';   -- true
--
--   SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname='public' AND tablename='notificacion_prefs';   -- 4 filas
--
-- Prueba negativa (consola del navegador, logueado):
--   await supabaseClient.from('notificacion_prefs')
--     .insert({ user_id: '<uuid de OTRA persona>', categoria: 'tareas', push: true })
--   // → tiene que fallar por RLS. Si entra, la policy no está haciendo su trabajo.
--
-- Cobertura (para Fede, con service key desde el servidor):
--   SELECT p.name, count(*) FILTER (WHERE NOT np.in_app) AS silenciadas_campana,
--                          count(*) FILTER (WHERE np.push)    AS con_push
--     FROM profiles p LEFT JOIN notificacion_prefs np ON np.user_id = p.id
--    GROUP BY p.name ORDER BY p.name;
-- ═══════════════════════════════════════════════════════════════════
