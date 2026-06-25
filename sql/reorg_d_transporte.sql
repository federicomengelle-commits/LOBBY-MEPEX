-- ═══════════════════════════════════════════════════════════════════
-- REORG · FASE D — Transporte en la ficha del Evento + Remito
-- ═══════════════════════════════════════════════════════════════════
-- Companion: docs/capa-operativa-blueprint.md §3.D / §4 (Fase D).
--
-- QUÉ HACE (ADITIVO — 2 tablas nuevas + 1 columna; no borra nada):
--   · evento_transporte        = un vehículo afectado a un evento (de la Flota
--                                propios, o AJENO ad-hoc inline) + chofer + fase +
--                                fecha + destino + urls del remito.
--   · evento_transporte_items  = qué lleva ese vehículo: polimórfico
--                                proyecto|equipo|manual (los equipos salen de la
--                                tabla `equipos` de Fase B; un contenedor puede
--                                "detallar_contenido" en el remito).
--   · vehiculos.es_propio      = MEPEX (true) vs Tercero (false). Default true
--                                (la flota actual es propia; los ajenos se marcan
--                                a mano / se crean con es_propio=false).
--
-- ⚠ REQUIERE `sql/reorg_b_equipos.sql` YA CORRIDO (FK equipo_id → equipos). Si la
--   tabla `equipos` no existe, este script falla.
--
-- Las tablas legacy de logística (`cargas`/`carga_*`/`logistica_movimientos`/
--   `logistica_vehiculos`/`logistica_remito`/`remitos`) quedan INERTES — NO se
--   dropean. El módulo Logística sigue vivo hasta su desconexión (fase aparte,
--   con OK de Fede). Esta migración NO toca nada de eso.
--
-- VERIFICADO CONTRA docs/schema-prod.md: eventos.id/proyectos.id/vehiculos.id/
--   personas.id/equipos.id = uuid. gen_random_uuid() disponible.
--
-- RLS: SELECT/INSERT/UPDATE authenticated; DELETE solo admin/superadmin.
-- Idempotente. SQL-FIRST: correr ANTES de pullear el JS de Fase D.
--
-- 🔎 GATE Q20 (mirar antes de que el JS corte la lectura legacy en eventos.js):
--   SELECT count(*) FROM cargas WHERE _deleted=false;                 -- ¿transportes vivos?
--   SELECT count(*) FROM logistica_movimientos WHERE _deleted=false;  -- ¿movimientos vivos?
--   (Si hay > 0 de eventos en curso, avisame: la sección vieja se reemplaza por la nueva.)
-- ═══════════════════════════════════════════════════════════════════

-- ===== D.0 · vehiculos.es_propio (Q10 — default true; backfill manual) ======
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS es_propio boolean NOT NULL DEFAULT true;
-- (Si en la flota actual hay vehículos de TERCEROS, marcalos a mano:
--    UPDATE public.vehiculos SET es_propio=false WHERE id IN (...);  )

-- ===== D.1 · evento_transporte (cabecera = un vehículo del evento) ==========
CREATE TABLE IF NOT EXISTS public.evento_transporte (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id                uuid NOT NULL REFERENCES public.eventos(id),
  vehiculo_id              uuid REFERENCES public.vehiculos(id),     -- de la Flota (propio o ajeno guardado)
  vehiculo_adhoc_descripcion text,                                  -- ajeno "solo este viaje"
  vehiculo_adhoc_patente   text,
  vehiculo_adhoc_propietario text,
  chofer_persona_id        uuid REFERENCES public.personas(id),
  chofer_nombre            text,                                    -- chofer suelto (sin persona)
  chofer_telefono          text,
  fase                     text CHECK (fase IN ('armado','intermedio','desarme')),
  fecha                    date,
  hora_salida              time,
  destino                  text,
  notas                    text,
  remito_pdf_url           text,
  remito_firmado_url       text,
  created_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  _deleted                 boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_evento_transporte_evento ON public.evento_transporte(evento_id) WHERE _deleted=false;
CREATE INDEX IF NOT EXISTS idx_evento_transporte_fecha  ON public.evento_transporte(fecha)     WHERE _deleted=false;

-- ===== D.2 · evento_transporte_items (qué lleva cada vehículo) ==============
CREATE TABLE IF NOT EXISTS public.evento_transporte_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transporte_id       uuid NOT NULL REFERENCES public.evento_transporte(id) ON DELETE CASCADE,
  item_type           text NOT NULL CHECK (item_type IN ('proyecto','equipo','manual')),
  proyecto_id         uuid REFERENCES public.proyectos(id),
  equipo_id           uuid REFERENCES public.equipos(id),           -- existe tras Fase B
  descripcion_manual  text,
  cantidad            numeric DEFAULT 1,
  detallar_contenido  boolean DEFAULT false,                        -- canasto → desglosar manifiesto en el remito
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  _deleted            boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_evento_transporte_items_transporte ON public.evento_transporte_items(transporte_id) WHERE _deleted=false;

-- ===== D.3 · RLS (SELECT/INSERT/UPDATE authenticated; DELETE admin) =========
ALTER TABLE public.evento_transporte       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_transporte_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- evento_transporte
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte' AND policyname='et_select') THEN
    CREATE POLICY et_select ON public.evento_transporte FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte' AND policyname='et_insert') THEN
    CREATE POLICY et_insert ON public.evento_transporte FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte' AND policyname='et_update') THEN
    CREATE POLICY et_update ON public.evento_transporte FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte' AND policyname='et_delete') THEN
    CREATE POLICY et_delete ON public.evento_transporte FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','superadmin'))); END IF;
  -- evento_transporte_items
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte_items' AND policyname='eti_select') THEN
    CREATE POLICY eti_select ON public.evento_transporte_items FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte_items' AND policyname='eti_insert') THEN
    CREATE POLICY eti_insert ON public.evento_transporte_items FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte_items' AND policyname='eti_update') THEN
    CREATE POLICY eti_update ON public.evento_transporte_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evento_transporte_items' AND policyname='eti_delete') THEN
    CREATE POLICY eti_delete ON public.evento_transporte_items FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','superadmin'))); END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN: \d public.evento_transporte · SELECT count(*) FROM evento_transporte;  (0, greenfield)
-- ROLLBACK: DROP TABLE IF EXISTS public.evento_transporte_items; DROP TABLE IF EXISTS public.evento_transporte;
--           ALTER TABLE public.vehiculos DROP COLUMN IF EXISTS es_propio;
-- ═══════════════════════════════════════════════════════════════════
