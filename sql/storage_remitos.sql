-- =============================================
-- MEPEX — Storage bucket `remitos` (Tanda 2 B1.b)
-- Fecha: 2026-05-16
-- =============================================
-- El bucket `remitos` guarda dos tipos de archivos por carga:
--
--   remitos/<carga_id>/remito.pdf       → PDF generado al aprobar (admin)
--   remitos/<carga_id>/firmado.<ext>    → Foto del remito firmado (taller, post-viaje)
--
-- Este archivo: crea el bucket via INSERT directo en storage.buckets
-- (funciona desde SQL Editor del Dashboard porque corre como service_role)
-- + policies de RLS sobre storage.objects.
--
-- Estrategia MVP: policies abiertas a authenticated. El frontend enforce
-- "solo taller/pm/admin/superadmin ven los botones de upload/download".
-- Cuando se quiera reforzar (Tanda 3+), se puede agregar JOIN con profiles
-- o usar una función helper has_role(role TEXT).
-- =============================================


-- ─── Crear bucket `remitos` privado, 10MB, MIME restringido ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'remitos',
    'remitos',
    false,        -- privado: acceso solo via signed URL
    10485760,     -- 10 MB por archivo
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ─── SELECT: cualquier authenticated puede leer archivos del bucket ───
DROP POLICY IF EXISTS "remitos_select" ON storage.objects;
CREATE POLICY "remitos_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'remitos');


-- ─── INSERT: cualquier authenticated puede subir al bucket ───
DROP POLICY IF EXISTS "remitos_insert" ON storage.objects;
CREATE POLICY "remitos_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'remitos');


-- ─── UPDATE: cualquier authenticated puede pisar archivos del bucket ───
-- Útil cuando se re-aprueba una carga y se regenera el PDF, o cuando se
-- vuelve a subir la foto firmada.
DROP POLICY IF EXISTS "remitos_update" ON storage.objects;
CREATE POLICY "remitos_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'remitos');


-- ─── DELETE: solo admin/superadmin pueden borrar ───
DROP POLICY IF EXISTS "remitos_delete" ON storage.objects;
CREATE POLICY "remitos_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'remitos'
        AND auth.uid() IN (
            SELECT id FROM public.profiles WHERE role IN ('admin','superadmin')
        )
    );


-- ─── Fin policies storage remitos ───
