-- 1) Retailer-uploaded images are authoritative: promote images[0] to the
--    rendered fields for any product where an upload exists but the row is
--    still showing a resolver-sourced photo.
UPDATE public.products p
SET image_url     = p.images->0->>'url',
    hero_image    = p.images->0->>'url',
    thumbnail_url = p.images->0->>'url',
    image_status  = 'retailer',
    image_source  = 'retailer_upload',
    image_updated_at = now(),
    image_gallery = jsonb_build_array(jsonb_build_object(
      'url', p.images->0->>'url',
      'role', 'primary',
      'kind', 'image',
      'source', 'retailer_upload',
      'license', 'retailer'
    ))
WHERE jsonb_typeof(p.images) = 'array'
  AND jsonb_array_length(p.images) > 0
  AND p.images->0->>'url' IS NOT NULL
  AND p.image_status IN ('official','ai_suggested','placeholder','brand_logo')
  AND coalesce(p.hero_image, '') IS DISTINCT FROM (p.images->0->>'url');

UPDATE public.product_passports pp
SET hero_image = p.hero_image,
    thumbnail  = p.thumbnail_url,
    image_gallery = p.image_gallery,
    updated_at = now()
FROM public.products p
WHERE pp.product_id = p.id
  AND p.image_status = 'retailer'
  AND pp.hero_image IS DISTINCT FROM p.hero_image;

-- 2) Purge the defunct mypenguin.co.za hostname from generated QR links.
UPDATE public.product_qr_assets
SET resolver_url = regexp_replace(resolver_url, '^https?://(www\.)?mypenguin\.co\.za', 'https://tag-tech.co.za')
WHERE resolver_url ILIKE '%mypenguin.co.za%';

UPDATE public.products
SET digital_link_url = regexp_replace(digital_link_url, '^https?://(www\.)?mypenguin\.co\.za', 'https://tag-tech.co.za')
WHERE digital_link_url ILIKE '%mypenguin.co.za%';