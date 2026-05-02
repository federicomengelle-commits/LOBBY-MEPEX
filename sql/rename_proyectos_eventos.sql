-- ═══════════════════════════════════════════════════════════════════
-- Migración: rename proyectos_2026 → proyectos, eventos_2026 → eventos
-- Fix de columnas rotadas en proyectos
-- FKs reales: cliente_id, evento_id, responsable_id
-- Estandarización de tablas hijas (created_at, updated_at, _deleted)
--
-- IMPORTANTE: ejecutar este SQL DIRECTAMENTE en el SQL Editor de Supabase.
-- Los archivos sql/ del repo son documentación de migraciones, no se
-- aplican automáticamente. La data actual es dummy y se descarta.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. DROP tablas viejas con CASCADE ───
-- Drop explícito de hijas primero (por si quedaron sin FK al padre).
-- Después drop de los padres con CASCADE.
DROP TABLE IF EXISTS public.evento_historial CASCADE;
DROP TABLE IF EXISTS public.evento_documentos CASCADE;
DROP TABLE IF EXISTS public.evento_transporte CASCADE;
DROP TABLE IF EXISTS public.evento_equipo CASCADE;
DROP TABLE IF EXISTS public.proyectos_2026 CASCADE;
DROP TABLE IF EXISTS public.eventos_2026 CASCADE;
DROP TABLE IF EXISTS public.proyectos CASCADE;
DROP TABLE IF EXISTS public.eventos CASCADE;

-- ─── 2. CREATE eventos (limpia, sin sufijo) ───
CREATE TABLE public.eventos (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    nombre                   text NOT NULL,
    fecha_evento_inicio      date,
    fecha_evento_fin         date,
    fecha_armado_inicio      date,
    fecha_armado_fin         date,
    fecha_desarme_inicio     date,
    fecha_desarme_fin        date,
    hora_armado_apertura     time,
    hora_armado_cierre       time,
    hora_evento_apertura     time,
    hora_evento_cierre       time,
    hora_desarme_apertura    time,
    hora_desarme_cierre      time,
    predio                   text,
    color                    text,
    notas_operativas         text,
    _deleted                 boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_eventos_fecha_inicio ON public.eventos(fecha_evento_inicio);
CREATE INDEX idx_eventos_deleted ON public.eventos(_deleted) WHERE _deleted = false;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_eventos_updated_at
BEFORE UPDATE ON public.eventos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. CREATE proyectos (DESROTADA + FKs reales) ───
CREATE TABLE public.proyectos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    nombre          text NOT NULL,
    cliente_id      uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    evento_id       uuid REFERENCES public.eventos(id) ON DELETE SET NULL,
    responsable_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    estado          text,                       -- valores limpios: en_curso, finalizado, etc.
    tipo            text,
    fecha_inicio    date,
    fecha_fin       date,
    notas           text,
    _deleted        boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_proyectos_cliente ON public.proyectos(cliente_id);
CREATE INDEX idx_proyectos_evento ON public.proyectos(evento_id);
CREATE INDEX idx_proyectos_responsable ON public.proyectos(responsable_id);
CREATE INDEX idx_proyectos_estado ON public.proyectos(estado);
CREATE INDEX idx_proyectos_deleted ON public.proyectos(_deleted) WHERE _deleted = false;

CREATE TRIGGER trg_proyectos_updated_at
BEFORE UPDATE ON public.proyectos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. RECREAR tablas hijas de eventos (estandarizadas) ───
-- Eran: evento_equipo, evento_transporte, evento_documentos, evento_historial
-- Las eliminó el CASCADE del paso 1, las recreamos limpias.

CREATE TABLE public.evento_equipo (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    evento_id   uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
    profile_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    rol         text,
    notas       text,
    _deleted    boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_evento_equipo_evento ON public.evento_equipo(evento_id);

CREATE TRIGGER trg_evento_equipo_updated_at
BEFORE UPDATE ON public.evento_equipo
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.evento_transporte (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    evento_id       uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
    tipo            text,
    proveedor       text,
    fecha           date,
    hora            time,
    detalle         text,
    _deleted        boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_evento_transporte_evento ON public.evento_transporte(evento_id);

CREATE TRIGGER trg_evento_transporte_updated_at
BEFORE UPDATE ON public.evento_transporte
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.evento_documentos (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    evento_id   uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
    nombre      text NOT NULL,
    url         text,
    tipo        text,
    _deleted    boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_evento_documentos_evento ON public.evento_documentos(evento_id);

CREATE TRIGGER trg_evento_documentos_updated_at
BEFORE UPDATE ON public.evento_documentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.evento_historial (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    evento_id   uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
    user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    accion      text NOT NULL,
    detalle     jsonb,
    _deleted    boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_evento_historial_evento ON public.evento_historial(evento_id);

CREATE TRIGGER trg_evento_historial_updated_at
BEFORE UPDATE ON public.evento_historial
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- IMPORTANTE: este SQL elimina DEFINITIVAMENTE proyectos_2026 y
-- eventos_2026 con todas sus filas. Ejecutar solo si la data es dummy.
-- ═══════════════════════════════════════════════════════════════════
