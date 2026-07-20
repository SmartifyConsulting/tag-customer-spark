GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

UPDATE public.product_qr_assets
   SET resolver_url = REGEXP_REPLACE(resolver_url, '^https?://(www\.)?mypenguin\.co\.za', 'https://tag-tech.co.za'),
       digital_link_url = REGEXP_REPLACE(digital_link_url, '^https?://(www\.)?mypenguin\.co\.za', 'https://tag-tech.co.za'),
       version = COALESCE(version, 1) + 1
 WHERE resolver_url ILIKE '%mypenguin.co.za%'
    OR digital_link_url ILIKE '%mypenguin.co.za%';