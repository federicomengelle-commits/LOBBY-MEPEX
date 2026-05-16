-- =============================================
-- MEPEX — Asignaciones evento + notif encuesta + roles ampliados (Tanda 3 +)
-- Fecha: 2026-05-16
-- =============================================
-- Cubre:
--   1. Tabla `asignaciones_evento` (UUID, persona ↔ evento ↔ fase) que el
--      blueprint pedía y nunca creé.
--   2. Trigger AFTER UPDATE en encuestas_evento → notif a admin + PM cuando
--      el cliente responde la encuesta (matriz §5 del blueprint).
--   3. Documentación de los roles operativos canónicos ampliados (no es SQL
--      ejecutable — el set vive en el frontend, pero lo dejo acá como ref).
-- =============================================


-- ─────────────────────────────────────────────
-- 1. asignaciones_evento — persona en evento por fase
-- ─────────────────────────────────────────────
-- Diferencia con `carga_personas`:
--   * carga_personas → ayudantes de UN VIAJE específico (corto plazo, 1 día).
--   * asignaciones_evento → persona afectada al EVENTO en una fase
--     (armado / funcionamiento / desarme), con rango de fechas (varios días).
--
-- Ejemplo: Diego va al evento Cumbre como "encargado de armado" todo el
-- período 18-22 mayo. Eso es 1 asignacion_evento. Si además va de chofer
-- en el viaje del 19 mayo a las 09:30, eso es 1 carga_personas (o más bien
-- chofer en cargas).
CREATE TABLE IF NOT EXISTS public.asignaciones_evento (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id       UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
    persona_id      UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
    fase            VARCHAR(20) DEFAULT 'armado'
        CHECK (fase IN ('armado', 'funcionamiento', 'desarme')),
    fecha_inicio    TIMESTAMPTZ,
    fecha_fin       TIMESTAMPTZ,
    rol             VARCHAR(40),   -- rol específico en este evento (ej "encargado_armado", "armador")
    estado          VARCHAR(20) DEFAULT 'propuesta'
        CHECK (estado IN ('propuesta', 'aprobada', 'confirmada', 'cancelada')),
    aprobada_por    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    aprobada_at     TIMESTAMPTZ,
    notas           TEXT,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    _deleted        BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_evento_ev
    ON public.asignaciones_evento (evento_id, fase) WHERE _deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_asignaciones_evento_persona
    ON public.asignaciones_evento (persona_id, fecha_inicio, fecha_fin)
    WHERE _deleted = FALSE AND estado IN ('propuesta', 'aprobada', 'confirmada');
CREATE INDEX IF NOT EXISTS idx_asignaciones_evento_estado
    ON public.asignaciones_evento (estado, created_at DESC)
    WHERE _deleted = FALSE AND estado = 'propuesta';

-- RLS abierto a authenticated; DELETE solo admin/superadmin.
ALTER TABLE public.asignaciones_evento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asignaciones_evento_select" ON public.asignaciones_evento;
CREATE POLICY "asignaciones_evento_select" ON public.asignaciones_evento
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "asignaciones_evento_insert" ON public.asignaciones_evento;
CREATE POLICY "asignaciones_evento_insert" ON public.asignaciones_evento
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "asignaciones_evento_update" ON public.asignaciones_evento;
CREATE POLICY "asignaciones_evento_update" ON public.asignaciones_evento
    FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "asignaciones_evento_delete" ON public.asignaciones_evento;
CREATE POLICY "asignaciones_evento_delete" ON public.asignaciones_evento
    FOR DELETE TO authenticated USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
    );


-- ─────────────────────────────────────────────
-- 2. Trigger: notif al PM + admin cuando se responde la encuesta
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_encuesta_notif_fn()
RETURNS TRIGGER AS $$
DECLARE
    v_evento_nombre TEXT;
    v_cliente_nombre TEXT;
    v_link TEXT;
    v_nps_label TEXT;
BEGIN
    -- Solo si recién se respondió (pasó de NULL a NOT NULL)
    IF NEW.respondida_at IS NULL OR OLD.respondida_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Datos del evento + cliente para el mensaje
    SELECT nombre INTO v_evento_nombre FROM public.eventos WHERE id = NEW.evento_id;
    SELECT COALESCE(nombre_empresa, razon_social) INTO v_cliente_nombre
        FROM public.clientes WHERE id = NEW.cliente_id;

    v_nps_label := CASE
        WHEN NEW.nps >= 9 THEN 'Promotor'
        WHEN NEW.nps >= 7 THEN 'Pasivo'
        ELSE 'Detractor'
    END;
    v_link := '#eventos?ev=' || NEW.evento_id;

    -- Notif PM
    INSERT INTO public.notifications (tipo, titulo, mensaje, target_role, entidad_tipo, entidad_id, link, prioridad)
    VALUES (
        'encuesta_respondida',
        '⭐ Cliente respondió encuesta: NPS ' || NEW.nps || ' (' || v_nps_label || ')',
        COALESCE(v_cliente_nombre, '') || ' · ' || COALESCE(v_evento_nombre, ''),
        'pm',
        'encuesta',
        NEW.id,
        v_link,
        CASE WHEN NEW.nps < 7 THEN 'alta' ELSE 'normal' END
    );

    -- Notif admin (mismo contenido)
    INSERT INTO public.notifications (tipo, titulo, mensaje, target_role, entidad_tipo, entidad_id, link, prioridad)
    VALUES (
        'encuesta_respondida',
        '⭐ Cliente respondió encuesta: NPS ' || NEW.nps || ' (' || v_nps_label || ')',
        COALESCE(v_cliente_nombre, '') || ' · ' || COALESCE(v_evento_nombre, ''),
        'admin',
        'encuesta',
        NEW.id,
        v_link,
        CASE WHEN NEW.nps < 7 THEN 'alta' ELSE 'normal' END
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_encuesta_notif ON public.encuestas_evento;
CREATE TRIGGER trg_encuesta_notif
    AFTER UPDATE ON public.encuestas_evento
    FOR EACH ROW EXECUTE FUNCTION public.trg_encuesta_notif_fn();


-- ─────────────────────────────────────────────
-- 3. Documentación: roles canónicos operativos ampliados
-- ─────────────────────────────────────────────
-- El campo personas.roles_operativos[] usa estos valores canónicos
-- (en lowercase, sin acentos, sin espacios):
--
--   armador               → arma stands en taller
--   chofer                → conduce camión/flete
--   ayudante              → ayudante general
--   electricista          → instalación eléctrica
--   montajista            → montaje en venue
--   encargado_armado      → coordina equipo de armado
--   tecnico               → soporte técnico (sonido/iluminación/AV)
--   azafata               → personal de evento (recepción/atención)
--   colaborador           → colaborador externo genérico
--
-- El frontend (rrhh.js + logistica.js) muestra esos como multi-select
-- y los filtra para el tab Personas (solo gente con al menos uno de
-- estos roles aparece en Logística). El campo `rol_legacy` guarda el
-- string original libre (descriptivo) para no perder info.

-- ─── Fin migración ───
