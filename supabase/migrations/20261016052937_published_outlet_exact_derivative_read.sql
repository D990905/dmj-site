-- Applied through approved Supabase migration history version 20261016052937.
CREATE POLICY outlet_media_public_derivative_select
ON storage.objects FOR SELECT TO anon, authenticated
USING (
 bucket_id = 'outlet-media'
 AND EXISTS (
  SELECT 1 FROM public.outlet_listings l
  CROSS JOIN LATERAL jsonb_array_elements(l.media) m(value)
  WHERE l.publication = 'published'
   AND m.value->>'type' = 'image'
   AND objects.name IN (
    (m.value->>'path') || '.preview-v1-160.webp',
    (m.value->>'path') || '.preview-v1-640.webp',
    (m.value->>'path') || '.preview-v1-1280.webp'
   )
 )
);
