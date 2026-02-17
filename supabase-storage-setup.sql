-- ============================================================
-- Supabase Storage — Bucket "assets" para imágenes
-- 
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Propósito: Crear bucket público para logos, escudos, backgrounds
-- ============================================================

-- 1. Crear bucket público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets',
  'assets',
  true,                          -- Público: cualquiera puede leer via URL
  5242880,                       -- 5 MB máximo por archivo
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Política de lectura: cualquiera puede ver las imágenes (bucket público)
DROP POLICY IF EXISTS "assets_public_read" ON storage.objects;
CREATE POLICY "assets_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

-- 3. Política de upload: solo service_role puede subir
--    (el upload se hace via API route con service_role_key, no directo desde el cliente)
DROP POLICY IF EXISTS "assets_service_upload" ON storage.objects;
CREATE POLICY "assets_service_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assets'
  AND (auth.role() = 'service_role')
);

-- 4. Política de delete: solo service_role puede eliminar
DROP POLICY IF EXISTS "assets_service_delete" ON storage.objects;
CREATE POLICY "assets_service_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assets'
  AND (auth.role() = 'service_role')
);

-- 5. Política de update: solo service_role puede actualizar
DROP POLICY IF EXISTS "assets_service_update" ON storage.objects;
CREATE POLICY "assets_service_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assets'
  AND (auth.role() = 'service_role')
);
