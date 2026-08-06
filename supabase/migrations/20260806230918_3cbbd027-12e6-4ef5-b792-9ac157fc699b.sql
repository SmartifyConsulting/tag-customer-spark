UPDATE public.watchlists w
SET status = 'active', updated_at = now()
FROM public.customers c
WHERE c.id = w.customer_id
  AND w.status = 'paused'
  AND c.status = 'subscribed'
  AND c.whatsapp_e164 IS NOT NULL;