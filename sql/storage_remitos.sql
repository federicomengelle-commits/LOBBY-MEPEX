-- =============================================
-- MEPEX — Storage bucket `remitos` (Tanda 2 B1.b)
-- Fecha: 2026-05-16
-- =============================================
-- El bucket `remitos` guarda dos tipos de archivos por carga:
--
--   remitos/<carga_id>/remito.pdf       → PDF generado al aprobar (admin)
--   remitos/<carga_id>/firmado.<ext>    → Foto del remito firmado (taller, post-viaje)
--
-- IMPORTANTE: Supabase NO permite crear buckets via SQL directo. Hay que:
--   1. Ir a Dashboard → Storage → New bucket
--   2. Name: remitos
--   3. Public: OFF (privado)
--   4. File size limit: 10 MB (sobra para PDFs + JPGs comprimidos)
--   5. Allowed MIME types: dejarlo libre o restringir a:
--        application/pdf
--        image/jpeg
--        image/png
--        image/webp
--   6. Click "Save"
--   7. Luego ejecutar este SQL para las policies.
--
-- Estrategia MVP: policies abiertas a authenticated. El frontend enforce
-- "solo taller/pm/admin/superadmin ven los botones de upload/download".
-- Cuando se quiera reforzar (Tanda 3+), se puede agregar JOIN con profiles
-- o usar una función helper has_role(role TEXT).
-- =============================================


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
