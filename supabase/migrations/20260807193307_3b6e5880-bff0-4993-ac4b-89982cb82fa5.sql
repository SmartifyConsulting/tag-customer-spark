CREATE TABLE public.sustainability_settings (
  retailer_id uuid PRIMARY KEY REFERENCES public.retailers(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  demo_mode boolean NOT NULL DEFAULT false,
  avg_receipt_length_cm numeric NOT NULL DEFAULT 20,
  avg_receipt_weight_g numeric NOT NULL DEFAULT 3.5,
  cost_per_receipt_cents integer NOT NULL DEFAULT 12,
  printer_maintenance_cents_per_1000 integer NOT NULL DEFAULT 3500,
  ink_cents_per_1000 integer NOT NULL DEFAULT 1500,
  electricity_cents_per_kwh integer NOT NULL DEFAULT 280,
  energy_kwh_per_1000_receipts numeric NOT NULL DEFAULT 1.2,
  co2_kg_per_kg_paper numeric NOT NULL DEFAULT 2.4,
  water_l_per_kg_paper numeric NOT NULL DEFAULT 22,
  currency text NOT NULL DEFAULT 'ZAR',
  units text NOT NULL DEFAULT 'metric',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sustainability_settings TO authenticated;
GRANT ALL ON public.sustainability_settings TO service_role;

ALTER TABLE public.sustainability_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailer members can view sustainability settings"
  ON public.sustainability_settings FOR SELECT TO authenticated
  USING (public.belongs_to_retailer(auth.uid(), retailer_id));

CREATE POLICY "Managers can insert sustainability settings"
  ON public.sustainability_settings FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE POLICY "Managers can update sustainability settings"
  ON public.sustainability_settings FOR UPDATE TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id))
  WITH CHECK (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE POLICY "Managers can delete sustainability settings"
  ON public.sustainability_settings FOR DELETE TO authenticated
  USING (public.can_manage_retailer(auth.uid(), retailer_id));

CREATE TRIGGER sustainability_settings_set_updated_at
  BEFORE UPDATE ON public.sustainability_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();