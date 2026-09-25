update public.product_passports set
 brand='Zam-Buk', manufacturer='Aspen Pharmacare', country_of_origin='South Africa',
 category_path='Health & Beauty > Lip Care > Lip Balm',
 short_description='Zam-Buk Cherry lip balm soothes and protects dry, chapped lips with a light cherry flavour.',
 marketing_description='A trusted South African favourite, Zam-Buk Cherry Lip Balm combines Zam-Buk''s classic herbal soothing care with a sweet cherry flavour. It helps moisturise, protect and relieve dry or chapped lips, and its handy pocket size makes it perfect for everyday use.',
 product_summary='Herbal-based lip balm with cherry flavour that moisturises and protects dry, chapped lips.',
 ingredients='["Petrolatum","Paraffin Wax","Eucalyptus Oil","Camphor","Thyme Oil","Flavour (Cherry)","Colourant"]'::jsonb,
 allergens=array['Contains fragrance/flavour — discontinue use if irritation occurs'],
 storage_instructions='Store in a cool, dry place below 25°C. Keep out of reach of children.',
 preparation_instructions='Apply liberally to lips as often as needed.',
 consumer_faqs='[{"question":"Can I use it every day?","answer":"Yes, apply as often as needed to keep lips soft and protected."},{"question":"Is it suitable for children?","answer":"Use under adult supervision for young children."},{"question":"Who makes Zam-Buk?","answer":"Zam-Buk is a long-standing South African brand distributed by Aspen Pharmacare."}]'::jsonb,
 keywords=array['zam-buk','zambuk','lip balm','cherry','chapped lips','lip care'],
 enrichment_status='manual', enrichment_model='manual', enriched_at=now(), updated_at=now()
 where product_id='0205315e-31fb-4921-81ce-2172704e223b';
update public.products set description='Zam-Buk Cherry Lip Balm soothes, moisturises and protects dry, chapped lips with a light cherry flavour.' where id='0205315e-31fb-4921-81ce-2172704e223b';
delete from public.passport_enrichment_queue where product_id='0205315e-31fb-4921-81ce-2172704e223b';