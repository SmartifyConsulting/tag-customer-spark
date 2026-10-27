CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL DEFAULT 'openai',
  operation text NOT NULL,
  model text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  cost_usd numeric(12,6),
  status integer,
  retailer_id uuid,
  product_id uuid
);
CREATE INDEX ai_usage_events_created_idx ON public.ai_usage_events (created_at DESC);
GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read token ledger" ON public.ai_usage_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.user_roles (user_id, role, retailer_id)
SELECT '1928b018-7c3b-4d19-87e0-75e46ff84276', 'super_admin', 'f252c918-7e90-4b68-8713-467f7b584239'
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '1928b018-7c3b-4d19-87e0-75e46ff84276' AND role = 'super_admin');