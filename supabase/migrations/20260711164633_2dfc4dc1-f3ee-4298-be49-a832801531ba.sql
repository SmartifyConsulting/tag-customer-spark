DROP POLICY IF EXISTS public_read_qr_assets ON public.product_qr_assets;
DROP POLICY IF EXISTS qr_tags_public_lookup ON public.qr_tags;
DROP POLICY IF EXISTS qr_artifacts_select ON storage.objects;
DROP POLICY IF EXISTS product_images_select ON storage.objects;
DROP POLICY IF EXISTS retailer_logos_select ON storage.objects;