
CREATE POLICY "qr_artifacts_manage"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'qr-artifacts')
  WITH CHECK (bucket_id = 'qr-artifacts');
