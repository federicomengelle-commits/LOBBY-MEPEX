-- ═══════════════════════════════════════════════════════════════════
-- CONFORME DE RECEPCIÓN DEL STAND (acta de entrega con firma digital)
-- ═══════════════════════════════════════════════════════════════════
-- Fase 4 · operativa. El encargado abre el stand (proyecto) en su terminal/tablet,
-- repasa el checklist de lo que se entrega, y el responsable que RECIBE firma
-- digitalmente (canvas) el conforme — comprometiéndose a devolver todo en orden.
-- Genera un acta PDF (se regenera on-demand desde estos datos, no se archiva el PDF).
--
-- QUÉ HACE (ADITIVO — 1 tabla nueva; no borra ni toca nada existente):
--   · proyecto_conformes = un acta de recepción (o devolución) de un proyecto/stand.
--       items_snapshot = foto de los ítems al momento de firmar (jsonb).
--       firma_data     = PNG dataURL de la firma trazada en el canvas (base64,
--                        chico ~5-20KB; sin bucket de Storage para v1).
--       tipo           = 'recepcion' (entrega) | 'devolucion' (cierre). v1 usa
--                        recepcion; devolucion queda lista para sumar después.
--
-- VERIFICADO CONTRA docs/schema-prod.md: proyectos.id = uuid. gen_random_uuid() ok.
-- RLS: SELECT/INSERT/UPDATE authenticated; DELETE solo admin/superadmin (calcado
--   de sql/reorg_d_transporte.sql). Idempotente.
-- SQL-FIRST: correr ANTES de pullear el JS (eventos/api/proyecto-detalle nuevos).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.proyecto_conformes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     uuid NOT NULL REFERENCES public.proyectos(id),
  tipo            text NOT NULL DEFAULT 'recepcion' CHECK (tipo IN ('recepcion','devolucion')),
  receptor_nombre text NOT NULL,
  receptor_doc    text,                                  -- DNI / cargo / relación (opcional)
  items_snapshot  jsonb NOT NULL DEFAULT '[]'::jsonb,    -- [{nombre, cantidad, ok}]
  observaciones   text,
  firma_data      text,                                  -- PNG dataURL (base64) de la firma
  firmado_at      timestamptz NOT NULL DEFAULT now(),
  firmado_by      uuid,                                  -- profile del encargado que operó la terminal
  created_at      timestamptz NOT NULL DEFAULT now(),
  _deleted        boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_proyecto_conformes_proyecto ON public.proyecto_conformes(proyecto_id) WHERE _deleted=false;

ALTER TABLE public.proyecto_conformes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proyecto_conformes' AND policyname='pc_select') THEN
    CREATE POLICY pc_select ON public.proyecto_conformes FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proyecto_conformes' AND policyname='pc_insert') THEN
    CREATE POLICY pc_insert ON public.proyecto_conformes FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proyecto_conformes' AND policyname='pc_update') THEN
    CREATE POLICY pc_update ON public.proyecto_conformes FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proyecto_conformes' AND policyname='pc_delete') THEN
    CREATE POLICY pc_delete ON public.proyecto_conformes FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','superadmin'))); END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN: \d public.proyecto_conformes · SELECT count(*) FROM proyecto_conformes;  (0, greenfield)
-- ROLLBACK: DROP TABLE IF EXISTS public.proyecto_conformes;
-- ═══════════════════════════════════════════════════════════════════
