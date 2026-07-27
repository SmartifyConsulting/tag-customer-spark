DELETE FROM public.customer_interests WHERE customer_id IN (SELECT id FROM public.customers WHERE whatsapp_e164 = '+27821234567');
DELETE FROM public.customers WHERE whatsapp_e164 = '+27821234567';