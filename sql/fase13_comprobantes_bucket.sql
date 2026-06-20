-- =====================================================================
-- Fase 13.4 — Storage bucket `comprobantes` (carga por foto/IA)
-- =====================================================================
-- Guarda el archivo original de cada comprobante recibido cargado por foto/PDF:
--   comprobantes/<uuid>/original.<ext>   → foto o PDF subido por el usuario
--
-- El path se guarda en comprobantes_recibidos.archivo_url. Bucket privado:
-- la lectura es siempre via signed URL (API.getComprobanteSignedUrl).
--
-- Crea el bucket via INSERT en storage.buckets (corre como service_role desde el
-- SQL Editor del Dashboard) + policies RLS. Mismo patrón que `remitos`.
-- Idempotente.
-- =====================================================================


-- ─── Bucket `comprobantes` privado, 15MB, imágenes + PDF ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'comprobantes',
    'comprobantes',
    false,        -- privado: acceso solo via signed URL
    15728640,     -- 15 MB por archivo (fotos de celu)
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ─── SELECT / INSERT / UPDATE: cualquier authenticated (el front gatea por rol) ───
DROP POLICY IF EXISTS "comprobantes_select" ON storage.objects;
CREATE POLICY "comprobantes_select" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'comprobantes');

DROP POLICY IF EXISTS "comprobantes_insert" ON storage.objects;
CREATE POLICY "comprobantes_insert" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'comprobantes');

DROP POLICY IF EXISTS "comprobantes_update" ON storage.objects;
CREATE POLICY "comprobantes_update" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'comprobantes');


-- ─── DELETE: solo admin/superadmin ───
DROP POLICY IF EXISTS "comprobantes_delete" ON storage.objects;
CREATE POLICY "comprobantes_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'comprobantes'
        AND auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
    );

-- ─── Fin policies storage comprobantes ───
