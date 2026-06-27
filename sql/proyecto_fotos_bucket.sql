-- =============================================
-- MEPEX — Storage bucket `proyecto-fotos` (Fotos del armado por proyecto)
-- Fecha: 2026-06-27
-- =============================================
-- Guarda las fotos que el taller saca del stand armado, por proyecto:
--
--   proyecto-fotos/<proyecto_id>/<timestamp>-<rand>.jpg
--
-- Las fotos se ven en la pestaña Producción de la ficha del proyecto.
-- Subida client-side comprimida a JPEG (máx ~1600px). Acceso via signed URL.
--
-- Calcado de sql/storage_remitos.sql. Estrategia: policies abiertas a
-- authenticated (el frontend gatea los botones); DELETE restringido a
-- admin/superadmin/pm.
-- =============================================


-- ─── Crear bucket `proyecto-fotos` privado, 8MB, solo imágenes ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'proyecto-fotos',
    'proyecto-fotos',
    false,        -- privado: acceso solo via signed URL
    8388608,      -- 8 MB por archivo
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ─── SELECT: cualquier authenticated puede leer (ver thumbnails) ───
DROP POLICY IF EXISTS "proyecto_fotos_select" ON storage.objects;
CREATE POLICY "proyecto_fotos_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'proyecto-fotos');


-- ─── INSERT: cualquier authenticated puede subir (incl. taller = el fotógrafo) ───
DROP POLICY IF EXISTS "proyecto_fotos_insert" ON storage.objects;
CREATE POLICY "proyecto_fotos_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'proyecto-fotos');


-- ─── DELETE: solo admin/superadmin/pm pueden borrar ───
DROP POLICY IF EXISTS "proyecto_fotos_delete" ON storage.objects;
CREATE POLICY "proyecto_fotos_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'proyecto-fotos'
        AND auth.uid() IN (
            SELECT id FROM public.profiles WHERE role IN ('admin','superadmin','pm')
        )
    );


-- ─── Fin policies storage proyecto-fotos ───
