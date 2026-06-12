
CREATE POLICY "Owners upload to their folder in funnel-attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'funnel-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners read their files in funnel-attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'funnel-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners update their files in funnel-attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'funnel-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners delete their files in funnel-attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'funnel-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
