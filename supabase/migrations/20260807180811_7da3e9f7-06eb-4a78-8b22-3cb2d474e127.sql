
-- ─────────────────────────────────────────────────────────────
-- Ownership module: Purchase Intelligence + Ownership Intelligence
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.consumer_tag_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  tag_id text NOT NULL UNIQUE,
  display_name text,
  nfc_uid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consumer_tag_ids TO authenticated;
GRANT ALL ON public.consumer_tag_ids TO service_role;
ALTER TABLE public.consumer_tag_ids ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.household_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  tag_ref uuid REFERENCES public.consumer_tag_ids(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_rooms TO authenticated;
GRANT ALL ON public.household_rooms TO service_role;
ALTER TABLE public.household_rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  tag_ref uuid REFERENCES public.consumer_tag_ids(id) ON DELETE SET NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  receipt_number text,
  payment_method text,
  currency text NOT NULL DEFAULT 'ZAR',
  total_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand text,
  sku text,
  gtin text,
  category text,
  image_url text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents bigint NOT NULL DEFAULT 0,
  line_total_cents bigint NOT NULL DEFAULT 0,
  warranty_months integer NOT NULL DEFAULT 0,
  return_window_days integer NOT NULL DEFAULT 30,
  serial_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  receipt_number text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  category text,
  pdf_url text,
  is_favourite boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.owned_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  tag_ref uuid REFERENCES public.consumer_tag_ids(id) ON DELETE CASCADE,
  purchase_item_id uuid REFERENCES public.purchase_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.household_rooms(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand text,
  category text NOT NULL DEFAULT 'Home',
  image_url text,
  serial_number text,
  condition text NOT NULL DEFAULT 'good',
  ownership_status text NOT NULL DEFAULT 'owned',
  purchased_at timestamptz,
  purchase_price_cents bigint NOT NULL DEFAULT 0,
  current_value_cents bigint NOT NULL DEFAULT 0,
  estimated_lifespan_months integer,
  maintenance_due_on date,
  recall_notice text,
  battery_health integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owned_products TO authenticated;
GRANT ALL ON public.owned_products TO service_role;
ALTER TABLE public.owned_products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  owned_product_id uuid NOT NULL REFERENCES public.owned_products(id) ON DELETE CASCADE,
  provider text,
  period_months integer NOT NULL DEFAULT 12,
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  expires_on date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  registered_at timestamptz,
  certificate_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranties TO authenticated;
GRANT ALL ON public.warranties TO service_role;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  warranty_id uuid NOT NULL REFERENCES public.warranties(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'submitted',
  description text,
  resolution text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranty_claims TO authenticated;
GRANT ALL ON public.warranty_claims TO service_role;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  purchase_item_id uuid REFERENCES public.purchase_items(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested',
  reason text,
  return_code text,
  window_ends_on date,
  refund_cents bigint NOT NULL DEFAULT 0,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_returns TO authenticated;
GRANT ALL ON public.product_returns TO service_role;
ALTER TABLE public.product_returns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.service_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  owned_product_id uuid NOT NULL REFERENCES public.owned_products(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'maintenance',
  title text NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  cost_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_events TO authenticated;
GRANT ALL ON public.service_events TO service_role;
ALTER TABLE public.service_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  owned_product_id uuid REFERENCES public.owned_products(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'manual',
  title text NOT NULL,
  url text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_documents TO authenticated;
GRANT ALL ON public.product_documents TO service_role;
ALTER TABLE public.product_documents ENABLE ROW LEVEL SECURITY;

-- ── Policies: staff read/write within their retailer; managers delete ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'consumer_tag_ids','household_rooms','purchases','purchase_items','receipts',
    'owned_products','warranties','warranty_claims','product_returns',
    'service_events','product_documents'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_select" ON public.%1$I FOR SELECT TO authenticated
        USING (public.belongs_to_retailer(auth.uid(), retailer_id));
      CREATE POLICY "%1$s_insert" ON public.%1$I FOR INSERT TO authenticated
        WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));
      CREATE POLICY "%1$s_update" ON public.%1$I FOR UPDATE TO authenticated
        USING (public.belongs_to_retailer(auth.uid(), retailer_id))
        WITH CHECK (public.belongs_to_retailer(auth.uid(), retailer_id));
      CREATE POLICY "%1$s_delete" ON public.%1$I FOR DELETE TO authenticated
        USING (public.can_manage_retailer(auth.uid(), retailer_id));
    $f$, t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at()', t);
  END LOOP;
END $$;

CREATE INDEX idx_purchases_retailer ON public.purchases(retailer_id, purchased_at DESC);
CREATE INDEX idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX idx_owned_products_retailer ON public.owned_products(retailer_id);
CREATE INDEX idx_warranties_owned ON public.warranties(owned_product_id);
CREATE INDEX idx_receipts_purchase ON public.receipts(purchase_id);

-- ─────────────────────────── Demo data ───────────────────────────
DO $$
DECLARE
  r_id uuid;
  s_id uuid;
  tag_uuid uuid;
  room_kitchen uuid; room_lounge uuid; room_garage uuid; room_bedroom uuid; room_office uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  it_drill uuid; it_tv uuid; it_kettle uuid; it_jumper uuid; it_milk uuid;
  op_drill uuid; op_tv uuid; op_kettle uuid;
  w_drill uuid; w_tv uuid; w_kettle uuid;
  prod_jumper uuid;
BEGIN
  SELECT id INTO r_id FROM public.retailers ORDER BY created_at LIMIT 1;
  IF r_id IS NULL THEN RETURN; END IF;
  SELECT id INTO s_id FROM public.stores WHERE retailer_id = r_id ORDER BY created_at LIMIT 1;
  SELECT id INTO prod_jumper FROM public.products WHERE retailer_id = r_id AND name ILIKE '%Jumper%' LIMIT 1;

  INSERT INTO public.consumer_tag_ids (retailer_id, tag_id, display_name, nfc_uid)
  VALUES (r_id, 'TAG-8427-KJ91', 'Demo Household', '04:A3:2F:9C:11:80')
  RETURNING id INTO tag_uuid;

  INSERT INTO public.household_rooms (retailer_id, tag_ref, name, sort_order) VALUES
    (r_id, tag_uuid, 'Kitchen', 1) RETURNING id INTO room_kitchen;
  INSERT INTO public.household_rooms (retailer_id, tag_ref, name, sort_order) VALUES
    (r_id, tag_uuid, 'Lounge', 2) RETURNING id INTO room_lounge;
  INSERT INTO public.household_rooms (retailer_id, tag_ref, name, sort_order) VALUES
    (r_id, tag_uuid, 'Garage', 3) RETURNING id INTO room_garage;
  INSERT INTO public.household_rooms (retailer_id, tag_ref, name, sort_order) VALUES
    (r_id, tag_uuid, 'Bedroom', 4) RETURNING id INTO room_bedroom;
  INSERT INTO public.household_rooms (retailer_id, tag_ref, name, sort_order) VALUES
    (r_id, tag_uuid, 'Office', 5) RETURNING id INTO room_office;

  -- Purchase 1: big-ticket electronics
  INSERT INTO public.purchases (retailer_id, store_id, tag_ref, purchased_at, receipt_number, payment_method, total_cents, notes)
  VALUES (r_id, s_id, tag_uuid, now() - interval '400 days', 'RCPT-100241', 'Visa •••• 4218', 1499900, 'Lounge upgrade')
  RETURNING id INTO p1;
  INSERT INTO public.purchase_items (retailer_id, purchase_id, name, brand, sku, gtin, category, image_url, quantity, unit_price_cents, line_total_cents, warranty_months, return_window_days, serial_number)
  VALUES (r_id, p1, 'Samsung 55" QLED Smart TV', 'Samsung', 'SAM-QLED55', '8801643719357', 'Electronics',
          'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80', 1, 1499900, 1499900, 24, 30, 'SN-QLED-55-778213')
  RETURNING id INTO it_tv;
  INSERT INTO public.receipts (retailer_id, purchase_id, receipt_number, issued_at, category, is_favourite)
  VALUES (r_id, p1, 'RCPT-100241', now() - interval '400 days', 'Electronics', true);

  -- Purchase 2: tools
  INSERT INTO public.purchases (retailer_id, store_id, tag_ref, purchased_at, receipt_number, payment_method, total_cents)
  VALUES (r_id, s_id, tag_uuid, now() - interval '90 days', 'RCPT-118902', 'Mastercard •••• 9931', 289900)
  RETURNING id INTO p2;
  INSERT INTO public.purchase_items (retailer_id, purchase_id, name, brand, sku, gtin, category, image_url, quantity, unit_price_cents, line_total_cents, warranty_months, return_window_days, serial_number)
  VALUES (r_id, p2, 'Bosch GSB 18V-55 Cordless Drill', 'Bosch', 'BOS-GSB18V', '4059952530512', 'Garden',
          'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80', 1, 289900, 289900, 36, 30, 'SN-BOSCH-18V-44120')
  RETURNING id INTO it_drill;
  INSERT INTO public.receipts (retailer_id, purchase_id, receipt_number, issued_at, category)
  VALUES (r_id, p2, 'RCPT-118902', now() - interval '90 days', 'Tools');

  -- Purchase 3: weekly grocery basket
  INSERT INTO public.purchases (retailer_id, store_id, tag_ref, purchased_at, receipt_number, payment_method, total_cents)
  VALUES (r_id, s_id, tag_uuid, now() - interval '6 days', 'RCPT-129440', 'Cash', 48750)
  RETURNING id INTO p3;
  INSERT INTO public.purchase_items (retailer_id, purchase_id, name, brand, category, image_url, quantity, unit_price_cents, line_total_cents, warranty_months, return_window_days)
  VALUES
    (r_id, p3, 'Full Cream Milk 2L', 'Clover', 'Kitchen', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&q=80', 2, 3999, 7998, 0, 7),
    (r_id, p3, 'Albany Superior White Bread', 'Albany', 'Kitchen', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80', 2, 2199, 4398, 0, 7),
    (r_id, p3, 'Free Range Eggs 18s', 'Nulaid', 'Kitchen', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800&q=80', 1, 8999, 8999, 0, 7),
    (r_id, p3, 'Butro Butter 500g', 'Butro', 'Kitchen', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800&q=80', 1, 9499, 9499, 0, 7),
    (r_id, p3, 'Jacobs Kronung Coffee 250g', 'Jacobs', 'Kitchen', 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80', 1, 17856, 17856, 0, 7);
  INSERT INTO public.purchase_items (retailer_id, purchase_id, name, brand, category, image_url, quantity, unit_price_cents, line_total_cents, warranty_months, return_window_days)
  VALUES (r_id, p3, 'Russell Hobbs Kettle 1.7L', 'Russell Hobbs', 'Kitchen', 'https://images.unsplash.com/photo-1594213114663-d94db9b17125?w=800&q=80', 1, 0, 0, 12, 30)
  RETURNING id INTO it_kettle;
  INSERT INTO public.receipts (retailer_id, purchase_id, receipt_number, issued_at, category)
  VALUES (r_id, p3, 'RCPT-129440', now() - interval '6 days', 'Groceries');

  -- Purchase 4: clothing (linked to a real inventory product), with an open return
  INSERT INTO public.purchases (retailer_id, store_id, tag_ref, purchased_at, receipt_number, payment_method, total_cents)
  VALUES (r_id, s_id, tag_uuid, now() - interval '10 days', 'RCPT-130118', 'Visa •••• 4218', 1404)
  RETURNING id INTO p4;
  INSERT INTO public.purchase_items (retailer_id, purchase_id, product_id, name, brand, sku, gtin, category, image_url, quantity, unit_price_cents, line_total_cents, warranty_months, return_window_days)
  VALUES (r_id, p4, prod_jumper, 'Baby Blue Jumper', 'TAG Basics', '6004201004816', '6004201004816', 'Clothing',
          (SELECT hero_image FROM public.products WHERE id = prod_jumper), 2, 702, 1404, 0, 30)
  RETURNING id INTO it_jumper;
  INSERT INTO public.receipts (retailer_id, purchase_id, receipt_number, issued_at, category)
  VALUES (r_id, p4, 'RCPT-130118', now() - interval '10 days', 'Clothing');
  INSERT INTO public.product_returns (retailer_id, purchase_id, purchase_item_id, status, reason, return_code, window_ends_on, refund_cents, requested_at)
  VALUES (r_id, p4, it_jumper, 'in_progress', 'Wrong size', 'RET-4471-QP', (now() + interval '20 days')::date, 702, now() - interval '2 days');

  -- Owned products
  INSERT INTO public.owned_products (retailer_id, tag_ref, purchase_item_id, room_id, name, brand, category, image_url, serial_number, condition, purchased_at, purchase_price_cents, current_value_cents, estimated_lifespan_months, battery_health, recall_notice)
  VALUES (r_id, tag_uuid, it_tv, room_lounge, 'Samsung 55" QLED Smart TV', 'Samsung', 'Electronics',
          'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80', 'SN-QLED-55-778213', 'good',
          now() - interval '400 days', 1499900, 899900, 96, NULL, NULL)
  RETURNING id INTO op_tv;
  INSERT INTO public.owned_products (retailer_id, tag_ref, purchase_item_id, room_id, name, brand, category, image_url, serial_number, condition, purchased_at, purchase_price_cents, current_value_cents, estimated_lifespan_months, battery_health, maintenance_due_on)
  VALUES (r_id, tag_uuid, it_drill, room_garage, 'Bosch GSB 18V-55 Cordless Drill', 'Bosch', 'Automotive',
          'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80', 'SN-BOSCH-18V-44120', 'excellent',
          now() - interval '90 days', 289900, 219900, 120, 87, (now() + interval '45 days')::date)
  RETURNING id INTO op_drill;
  INSERT INTO public.owned_products (retailer_id, tag_ref, purchase_item_id, room_id, name, brand, category, image_url, condition, purchased_at, purchase_price_cents, current_value_cents, estimated_lifespan_months, recall_notice)
  VALUES (r_id, tag_uuid, it_kettle, room_kitchen, 'Russell Hobbs Kettle 1.7L', 'Russell Hobbs', 'Kitchen',
          'https://images.unsplash.com/photo-1594213114663-d94db9b17125?w=800&q=80', 'good',
          now() - interval '6 days', 79900, 69900, 60, 'Safety notice: batch RH-2291 base plate inspection recommended')
  RETURNING id INTO op_kettle;

  -- Warranties
  INSERT INTO public.warranties (retailer_id, owned_product_id, provider, period_months, starts_on, expires_on, status, registered_at)
  VALUES (r_id, op_tv, 'Samsung SA', 24, (now() - interval '400 days')::date, (now() + interval '330 days')::date, 'active', now() - interval '399 days')
  RETURNING id INTO w_tv;
  INSERT INTO public.warranties (retailer_id, owned_product_id, provider, period_months, starts_on, expires_on, status, registered_at)
  VALUES (r_id, op_drill, 'Bosch Power Tools', 36, (now() - interval '90 days')::date, (now() + interval '1005 days')::date, 'active', now() - interval '88 days')
  RETURNING id INTO w_drill;
  INSERT INTO public.warranties (retailer_id, owned_product_id, provider, period_months, starts_on, expires_on, status)
  VALUES (r_id, op_kettle, 'Russell Hobbs', 12, (now() - interval '340 days')::date, (now() + interval '25 days')::date, 'active')
  RETURNING id INTO w_kettle;

  INSERT INTO public.warranty_claims (retailer_id, warranty_id, status, description, submitted_at)
  VALUES (r_id, w_tv, 'in_review', 'Intermittent HDMI port failure on port 2', now() - interval '12 days');

  -- Service history
  INSERT INTO public.service_events (retailer_id, owned_product_id, kind, title, description, occurred_at, cost_cents) VALUES
    (r_id, op_tv, 'purchase', 'Purchased', 'Bought in store', now() - interval '400 days', 1499900),
    (r_id, op_tv, 'software_update', 'Firmware 1432.4 installed', 'Smart hub security update', now() - interval '60 days', 0),
    (r_id, op_tv, 'warranty_claim', 'Claim submitted', 'HDMI port 2 fault', now() - interval '12 days', 0),
    (r_id, op_drill, 'purchase', 'Purchased', 'Bought in store', now() - interval '90 days', 289900),
    (r_id, op_drill, 'maintenance', 'Chuck serviced', 'Cleaned and re-greased', now() - interval '20 days', 25000),
    (r_id, op_kettle, 'purchase', 'Purchased', 'Bought in store', now() - interval '6 days', 79900);

  -- Documents
  INSERT INTO public.product_documents (retailer_id, owned_product_id, kind, title, url, source) VALUES
    (r_id, op_tv, 'manual', 'Samsung QLED User Manual', 'https://www.samsung.com/support', 'manufacturer'),
    (r_id, op_tv, 'quick_start', 'Quick Start Guide', 'https://www.samsung.com/support', 'manufacturer'),
    (r_id, op_tv, 'receipt', 'Receipt RCPT-100241', NULL, 'tag'),
    (r_id, op_drill, 'manual', 'Bosch GSB 18V-55 Manual', 'https://www.bosch-professional.com', 'manufacturer'),
    (r_id, op_drill, 'safety', 'Power Tool Safety Guide', 'https://www.bosch-professional.com', 'manufacturer'),
    (r_id, op_kettle, 'installation', 'Kettle Setup Guide', NULL, 'manufacturer');
END $$;
