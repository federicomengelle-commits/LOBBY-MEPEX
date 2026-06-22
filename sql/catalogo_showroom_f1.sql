-- =====================================================================
-- Catálogo Showroom — Fase 1: backbone de datos + fotos
-- =====================================================================
-- Eleva catalogo_items a la FUENTE DE VERDAD del showroom comercial:
--   · atributos ricos: descripcion_larga · colores · ficha_tecnica (specs)
--   · medidas fijas: frente / profundidad / alto (en cm)
--   · fotos MÚLTIPLES por ítem (tabla catalogo_item_fotos)
--   · bucket Storage público `catalogo` para servir las imágenes
--
-- NO toca NADA de costeo: precio_alquiler / tipo_receta / snapshots /
-- es_cotizable / la RPC calcular_receta quedan intactos. Solo AGREGA
-- columnas y una tabla nueva. Idempotente.
--
-- SQL-FIRST: correr esto en el SQL Editor de Supabase ANTES de pushear el JS.
--
-- RLS = espejo EXACTO de catalogo_items (tabla de referencia):
--   authenticated full + anon SELECT  → el showroom, el PDF y el cotizador
--   externo leen las fotos; el front gatea la escritura por rol (admin).
-- =====================================================================

BEGIN;

-- ─── 1. Atributos ricos + medidas en catalogo_items (aditivo) ───
ALTER TABLE public.catalogo_items
  ADD COLUMN IF NOT EXISTS descripcion_larga text,
  ADD COLUMN IF NOT EXISTS colores           text[],
  ADD COLUMN IF NOT EXISTS ficha_tecnica     jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS frente_cm         numeric,
  ADD COLUMN IF NOT EXISTS profundidad_cm    numeric,
  ADD COLUMN IF NOT EXISTS alto_cm           numeric;

COMMENT ON COLUMN public.catalogo_items.descripcion_larga IS 'Descripción rica para showroom/propuesta. La corta `descripcion` queda para listados.';
COMMENT ON COLUMN public.catalogo_items.colores       IS 'Colores disponibles (chips). Ej: {Blanco,Negro,"Madera natural"}';
COMMENT ON COLUMN public.catalogo_items.ficha_tecnica IS 'Specs flexibles: array de {label,valor}. Ej: [{"label":"Material","valor":"Aluminio"}]';

-- ─── 2. Fotos múltiples por ítem ───
CREATE TABLE IF NOT EXISTS public.catalogo_item_fotos (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id      bigint NOT NULL REFERENCES public.catalogo_items(id) ON DELETE CASCADE,
  url          text   NOT NULL,            -- URL pública del objeto (o link externo de migración)
  storage_path text,                       -- path interno en el bucket (para poder borrar el objeto)
  orden        int    NOT NULL DEFAULT 0,  -- orden de la galería
  es_principal boolean NOT NULL DEFAULT false, -- portada (el front asegura 1 sola: desmarca las otras al setear)
  alt          text,                       -- leyenda / texto alternativo
  created_at   timestamptz NOT NULL DEFAULT now(),
  _deleted     boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_catalogo_item_fotos_item
  ON public.catalogo_item_fotos(item_id) WHERE NOT _deleted;

-- ─── 3. RLS espejo de catalogo_items (auth full + anon read) ───
ALTER TABLE public.catalogo_item_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalogo_item_fotos_auth ON public.catalogo_item_fotos;
CREATE POLICY catalogo_item_fotos_auth ON public.catalogo_item_fotos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS catalogo_item_fotos_anon ON public.catalogo_item_fotos;
CREATE POLICY catalogo_item_fotos_anon ON public.catalogo_item_fotos
  FOR SELECT TO anon USING (true);

COMMIT;

-- ─── 4. Bucket Storage público `catalogo` (corre como service_role en el SQL Editor) ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalogo', 'catalogo', true,            -- PÚBLICO: URLs directas para showroom / PDF / cotizador
  10485760,                                 -- 10 MB por foto
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- read: abierto (bucket público; lo necesitan el showroom público, el PDF y el cotizador)
DROP POLICY IF EXISTS "catalogo_read" ON storage.objects;
CREATE POLICY "catalogo_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'catalogo');

-- escritura: cualquier authenticated (el front gatea por rol, igual que comprobantes/remitos)
DROP POLICY IF EXISTS "catalogo_insert" ON storage.objects;
CREATE POLICY "catalogo_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'catalogo');

DROP POLICY IF EXISTS "catalogo_update" ON storage.objects;
CREATE POLICY "catalogo_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'catalogo');

-- borrado: solo admin/superadmin
DROP POLICY IF EXISTS "catalogo_delete" ON storage.objects;
CREATE POLICY "catalogo_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'catalogo'
    AND auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
  );

-- ─── Verificación rápida (opcional) ───
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='catalogo_items' AND column_name IN
--   ('descripcion_larga','colores','ficha_tecnica','frente_cm','profundidad_cm','alto_cm');
-- SELECT * FROM storage.buckets WHERE id='catalogo';
