
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;

-- voice-messages: drop overly broad policies and require ownership in folder path
DROP POLICY IF EXISTS "Anyone can view voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload voice messages" ON storage.objects;

CREATE POLICY "Authenticated users can upload to own voice folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'voice-messages'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
