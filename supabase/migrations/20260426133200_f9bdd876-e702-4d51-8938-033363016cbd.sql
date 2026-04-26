-- Replace broad SELECT policy with one that prevents listing all files.
-- Anonymous users can still fetch a specific avatar via its public URL,
-- but cannot enumerate the bucket contents.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Avatar images are publicly readable by path"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IS NOT NULL
  );