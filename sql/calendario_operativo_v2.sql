-- ============================================
--  Calendario Operativo V2
--  Tablas de logística, documentos e historial
--  + columnas nuevas en eventos_2026
-- ============================================

-- ─── 1. ALTER eventos_2026: columnas nuevas ───

ALTER TABLE public.eventos_2026 ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.eventos_2026 ADD COLUMN IF NOT EXISTS fecha_desarme_fin date;
ALTER TABLE public.eventos_2026 ADD COLUMN IF NOT EXISTS notas_operativas text;

-- ─── 2. evento_equipo ───

CREATE TABLE IF NOT EXISTS public.evento_equipo (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id       uuid NOT NULL REFERENCES public.eventos_2026(id) ON DELETE CASCADE,
    persona_id      uuid,           -- FK a empleados, nullable para eventuales
    nombre_manual   text NOT NULL,
    rol_operativo   text NOT NULL,  -- supervisor | montajista | electricista | chofer | auxiliar
    orden           int DEFAULT 0,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evento_equipo_evento ON public.evento_equipo(evento_id);

-- ─── 3. evento_transporte ───

CREATE TABLE IF NOT EXISTS public.evento_transporte (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id       uuid NOT NULL REFERENCES public.eventos_2026(id) ON DELETE CASCADE,
    camion          text,
    chofer_nombre   text,
    chofer_id       uuid,           -- FK a empleados, nullable
    fecha_carga     timestamptz,
    fecha_salida    timestamptz,
    fecha_retorno   timestamptz,
    notas           text,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evento_transporte_evento ON public.evento_transporte(evento_id);

-- updated_at trigger (reusar handle_updated_at si ya existe)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'evento_transporte_updated_at') THEN
        CREATE TRIGGER evento_transporte_updated_at
            BEFORE UPDATE ON public.evento_transporte
            FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- ─── 4. evento_documentos ───

CREATE TABLE IF NOT EXISTS public.evento_documentos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id       uuid NOT NULL REFERENCES public.eventos_2026(id) ON DELETE CASCADE,
    tipo            text NOT NULL,  -- plano | reglamento | manual | seguro_acreditacion | otro
    nombre_archivo  text NOT NULL,
    storage_path    text,
    uploaded_at     timestamptz DEFAULT now(),
    uploaded_by     text
);

CREATE INDEX IF NOT EXISTS idx_evento_documentos_evento ON public.evento_documentos(evento_id);

-- ─── 5. evento_historial ───

CREATE TABLE IF NOT EXISTS public.evento_historial (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id       uuid NOT NULL REFERENCES public.eventos_2026(id) ON DELETE CASCADE,
    tipo            text NOT NULL,
        -- campo_editado | estado_cambio | equipo_cambio | transporte_cambio | documento | nota
    descripcion     text NOT NULL,
    metadata        jsonb,          -- { campo, valor_anterior, valor_nuevo, ... }
    usuario         text,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evento_historial_evento ON public.evento_historial(evento_id);
CREATE INDEX IF NOT EXISTS idx_evento_historial_created ON public.evento_historial(created_at DESC);

-- ─── 6. Trigger: auto-log cambios en eventos_2026 ───

CREATE OR REPLACE FUNCTION public.log_evento_cambio()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.nombre IS DISTINCT FROM NEW.nombre THEN
        INSERT INTO public.evento_historial (evento_id, tipo, descripcion, metadata)
        VALUES (NEW.id, 'campo_editado', 'Nombre actualizado',
            jsonb_build_object('campo','nombre','anterior',OLD.nombre,'nuevo',NEW.nombre));
    END IF;

    IF OLD.lugar IS DISTINCT FROM NEW.lugar THEN
        INSERT INTO public.evento_historial (evento_id, tipo, descripcion, metadata)
        VALUES (NEW.id, 'campo_editado', 'Locación actualizada',
            jsonb_build_object('campo','lugar','anterior',OLD.lugar,'nuevo',NEW.lugar));
    END IF;

    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO public.evento_historial (evento_id, tipo, descripcion, metadata)
        VALUES (NEW.id, 'estado_cambio', 'Estado cambiado a ' || COALESCE(NEW.estado, '—'),
            jsonb_build_object('campo','estado','anterior',OLD.estado,'nuevo',NEW.estado));
    END IF;

    IF OLD.color IS DISTINCT FROM NEW.color THEN
        INSERT INTO public.evento_historial (evento_id, tipo, descripcion, metadata)
        VALUES (NEW.id, 'campo_editado', 'Color actualizado',
            jsonb_build_object('campo','color','anterior',OLD.color,'nuevo',NEW.color));
    END IF;

    IF OLD.fecha_armado_inicio IS DISTINCT FROM NEW.fecha_armado_inicio
       OR OLD.fecha_armado_fin IS DISTINCT FROM NEW.fecha_armado_fin THEN
        INSERT INTO public.evento_historial (evento_id, tipo, descripcion, metadata)
        VALUES (NEW.id, 'campo_editado', 'Fechas de armado actualizadas',
            jsonb_build_object('campo','fechas_armado',
                'anterior', jsonb_build_object('inicio', OLD.fecha_armado_inicio, 'fin', OLD.fecha_armado_fin),
                'nuevo', jsonb_build_object('inicio', NEW.fecha_armado_inicio, 'fin', NEW.fecha_armado_fin)));
    END IF;

    IF OLD.fecha_evento_inicio IS DISTINCT FROM NEW.fecha_evento_inicio
       OR OLD.fecha_evento_fin IS DISTINCT FROM NEW.fecha_evento_fin THEN
        INSERT INTO public.evento_historial (evento_id, tipo, descripcion, metadata)
        VALUES (NEW.id, 'campo_editado', 'Fechas de evento actualizadas',
            jsonb_build_object('campo','fechas_evento',
                'anterior', jsonb_build_object('inicio', OLD.fecha_evento_inicio, 'fin', OLD.fecha_evento_fin),
                'nuevo', jsonb_build_object('inicio', NEW.fecha_evento_inicio, 'fin', NEW.fecha_evento_fin)));
    END IF;

    IF OLD.fecha_desarme IS DISTINCT FROM NEW.fecha_desarme
       OR OLD.fecha_desarme_fin IS DISTINCT FROM NEW.fecha_desarme_fin THEN
        INSERT INTO public.evento_historial (evento_id, tipo, descripcion, metadata)
        VALUES (NEW.id, 'campo_editado', 'Fechas de desarme actualizadas',
            jsonb_build_object('campo','fechas_desarme',
                'anterior', jsonb_build_object('inicio', OLD.fecha_desarme, 'fin', OLD.fecha_desarme_fin),
                'nuevo', jsonb_build_object('inicio', NEW.fecha_desarme, 'fin', NEW.fecha_desarme_fin)));
    END IF;

    IF OLD.notas_operativas IS DISTINCT FROM NEW.notas_operativas THEN
        INSERT INTO public.evento_historial (evento_id, tipo, descripcion, metadata)
        VALUES (NEW.id, 'nota', 'Notas operativas actualizadas',
            jsonb_build_object('campo','notas_operativas','anterior',OLD.notas_operativas,'nuevo',NEW.notas_operativas));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS evento_auto_log ON public.eventos_2026;
CREATE TRIGGER evento_auto_log
    AFTER UPDATE ON public.eventos_2026
    FOR EACH ROW EXECUTE FUNCTION public.log_evento_cambio();

-- ─── 7. RLS: policies para authenticated ───

-- evento_equipo
ALTER TABLE public.evento_equipo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evento_equipo_auth_select" ON public.evento_equipo FOR SELECT TO authenticated USING (true);
CREATE POLICY "evento_equipo_auth_insert" ON public.evento_equipo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "evento_equipo_auth_update" ON public.evento_equipo FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "evento_equipo_auth_delete" ON public.evento_equipo FOR DELETE TO authenticated USING (true);
-- anon (read-only)
CREATE POLICY "evento_equipo_anon_select" ON public.evento_equipo FOR SELECT TO anon USING (true);

-- evento_transporte
ALTER TABLE public.evento_transporte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evento_transporte_auth_select" ON public.evento_transporte FOR SELECT TO authenticated USING (true);
CREATE POLICY "evento_transporte_auth_insert" ON public.evento_transporte FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "evento_transporte_auth_update" ON public.evento_transporte FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "evento_transporte_auth_delete" ON public.evento_transporte FOR DELETE TO authenticated USING (true);
CREATE POLICY "evento_transporte_anon_select" ON public.evento_transporte FOR SELECT TO anon USING (true);

-- evento_documentos
ALTER TABLE public.evento_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evento_documentos_auth_select" ON public.evento_documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "evento_documentos_auth_insert" ON public.evento_documentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "evento_documentos_auth_update" ON public.evento_documentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "evento_documentos_auth_delete" ON public.evento_documentos FOR DELETE TO authenticated USING (true);
CREATE POLICY "evento_documentos_anon_select" ON public.evento_documentos FOR SELECT TO anon USING (true);

-- evento_historial
ALTER TABLE public.evento_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evento_historial_auth_select" ON public.evento_historial FOR SELECT TO authenticated USING (true);
CREATE POLICY "evento_historial_auth_insert" ON public.evento_historial FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "evento_historial_auth_update" ON public.evento_historial FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "evento_historial_auth_delete" ON public.evento_historial FOR DELETE TO authenticated USING (true);
CREATE POLICY "evento_historial_anon_select" ON public.evento_historial FOR SELECT TO anon USING (true);
