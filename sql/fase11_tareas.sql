-- ═══════════════════════════════════════════════════════════════════
-- FASE 11 · CENTRO DE TAREAS — tabla `tareas` (v1)
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-06-13. DDL base del Centro de Tareas (back office transversal).
-- Ver spec en PLAN-MAESTRO §"Fase 11" + mockup `mockup-centro-tareas.html`.
--
-- Schema SUPERSET: soporta cualquiera de las decisiones de diseño abiertas
-- (granularidad, generación trigger-vs-job, claim por pool) sin rework:
--   - asignación dual: responsable_id (perfil) Y/O target_role (pool, patrón claim)
--   - origen + refs al paso/fila que la generó (para derivadas)
--   - dedupe_key + es_derivada → un generador no duplica y cierra al cerrarse la fuente
--
-- RLS v1: authenticated full (es una bandeja personal — todos los logueados tienen
--   la suya; el filtrado "mías / del equipo" se hace en la query/UI, no por RLS).
--   El acceso al MÓDULO 'tareas' (sidebar) se gobierna aparte por la matriz (Capa 1).
--   anon: sin acceso. service_role: bypassa.
--
-- Idempotente. Correr una vez; después se conecta el módulo JS.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tareas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  descripcion     text,
  -- origen / contexto
  origen          text NOT NULL DEFAULT 'manual'
                    CHECK (origen IN ('manual','paso_proyecto','asignacion','compra','finanzas','rrhh','novedad')),
  modulo          text,                    -- para deep-link (#taller, #compras, ...)
  proyecto_id     uuid,                    -- FK lógica a proyectos (nullable)
  evento_id       uuid,                    -- FK lógica a eventos (nullable)
  paso_ref_tipo   text,                    -- tipo de fila origen (checklist_item/oc/vencimiento/doc/...)
  paso_ref_id     text,                    -- id de esa fila (text: sirve para uuid o bigint)
  -- asignación dual
  responsable_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,  -- perfil concreto
  target_role     text,                    -- pool de rol (claim: el primero que la toma setea responsable_id)
  -- ciclo de vida
  estado          text NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','en_curso','hecha','cancelada','bloqueada')),
  prioridad       text NOT NULL DEFAULT 'normal'
                    CHECK (prioridad IN ('normal','alta','critica')),
  fecha_limite    date,
  -- derivadas (automáticas)
  es_derivada     boolean NOT NULL DEFAULT false,
  dedupe_key      text,                    -- clave única estable de la tarea derivada
  -- auditoría
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completada_por  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completada_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  _deleted        boolean NOT NULL DEFAULT false
);

-- Una tarea derivada viva por dedupe_key (el generador no duplica)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tareas_dedupe
  ON public.tareas (dedupe_key)
  WHERE es_derivada AND NOT _deleted;

-- Índices de la bandeja (mías / por rol / por proyecto / abiertas)
CREATE INDEX IF NOT EXISTS idx_tareas_responsable ON public.tareas (responsable_id) WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_tareas_role        ON public.tareas (target_role)    WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_tareas_proyecto    ON public.tareas (proyecto_id)    WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_tareas_estado      ON public.tareas (estado)         WHERE NOT _deleted;

-- updated_at automático
CREATE OR REPLACE FUNCTION public.fn_tareas_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_tareas_touch ON public.tareas;
CREATE TRIGGER trg_tareas_touch BEFORE UPDATE ON public.tareas
  FOR EACH ROW EXECUTE FUNCTION public.fn_tareas_touch();

-- RLS v1: authenticated full, sin anon
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tareas_rls_auth ON public.tareas;
CREATE POLICY tareas_rls_auth ON public.tareas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- DECISIONES v1 (defaults inteligentes — confirmar/ajustar con Fede):
--   - Generación: el módulo JS arranca DERIVANDO en cliente reusando `Alertas`
--     (sin trigger SQL) → menos riesgo, validamos UX. Persistir+claim de derivadas
--     = v2 (cuando se decida trigger vs job).
--   - Granularidad: 1 tarea por item de checklist pendiente (lo más accionable).
--   - Claim por pool: target_role + el primero que la "toma" setea responsable_id.
--   - Alcance v1 sugerido: taller (pasos) + compras (OCs) + rrhh (docs). Finanzas después.
-- Estas son tendencias; el schema soporta cualquier elección sin migrar.
-- ═══════════════════════════════════════════════════════════════════
