-- Personal profile-picture storage. Path convention: {user_id}/avatar-*.{ext}
-- so RLS can scope every write to the uploading user's own folder, unlike
-- retailer-logos/product-images which scope by retailer_id.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY avatars_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (split_part(name, '/', 1))::uuid = auth.uid()
  );

CREATE POLICY avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (split_part(name, '/', 1))::uuid = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (split_part(name, '/', 1))::uuid = auth.uid()
  );

CREATE POLICY avatars_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (split_part(name, '/', 1))::uuid = auth.uid()
  );

CREATE POLICY public_read_avatars ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');
