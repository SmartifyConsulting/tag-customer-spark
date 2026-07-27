-- 1. Purge the defunct mypenguin.co.za hostname from every stored URL
UPDATE public.product_qr_assets
   SET resolver_url = REGEXP_REPLACE(resolver_url, '^https?://(www\.)?mypenguin\.co\.za', 'https://tag-tech.co.za'),
       digital_link_url = REGEXP_REPLACE(digital_link_url, '^https?://(www\.)?mypenguin\.co\.za', 'https://tag-tech.co.za')
 WHERE resolver_url ILIKE '%mypenguin.co.za%'
    OR digital_link_url ILIKE '%mypenguin.co.za%';

UPDATE public.products
   SET digital_link_url = REGEXP_REPLACE(digital_link_url, '^https?://(www\.)?mypenguin\.co\.za', 'https://tag-tech.co.za')
 WHERE digital_link_url ILIKE '%mypenguin.co.za%';

-- 2. Restore the real scanned barcode on Baby Blue Jumper and retire its stale QR
UPDATE public.products
   SET gtin = '6004201004816',
       barcode_type = 'EAN-13',
       digital_link_url = 'https://id.gs1.org/01/06004201004816',
       qr_status = 'inactive'
 WHERE id = '3c9f1ff9-da22-4e14-afa9-b481ebd89686';

UPDATE public.product_qr_assets
   SET status = 'retired'
 WHERE product_id = '3c9f1ff9-da22-4e14-afa9-b481ebd89686'
   AND status = 'active';