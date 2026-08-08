-- Create outlets and shopper_outlets tables for outlet management

-- ============================================================================
-- Create outlets table (stores/outlets registered with TAG)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  location text,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outlets TO authenticated;
GRANT ALL ON public.outlets TO service_role;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view outlets" ON public.outlets
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify outlets" ON public.outlets
  FOR INSERT, UPDATE, DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'retail_admin')
    )
  );

-- ============================================================================
-- Create shopper_outlets table (shoppers following outlets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shopper_outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopper_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  last_visited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shopper_id, outlet_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopper_outlets TO authenticated;
GRANT ALL ON public.shopper_outlets TO service_role;
ALTER TABLE public.shopper_outlets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outlets" ON public.shopper_outlets
  FOR SELECT USING (shopper_id = auth.uid());

CREATE POLICY "Users can manage their own outlets" ON public.shopper_outlets
  FOR INSERT, UPDATE, DELETE USING (shopper_id = auth.uid());

-- ============================================================================
-- Insert Cape Union Mart outlet
-- ============================================================================
INSERT INTO outlets (name, location, status)
VALUES ('Cape Union Mart', 'South Africa', 'active')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Link info@georgiaadams.co.za to Cape Union Mart
-- ============================================================================
INSERT INTO shopper_outlets (shopper_id, outlet_id)
SELECT
  p.id as shopper_id,
  o.id as outlet_id
FROM profiles p
CROSS JOIN outlets o
WHERE p.email = 'info@georgiaadams.co.za'
  AND o.name = 'Cape Union Mart'
ON CONFLICT (shopper_id, outlet_id) DO NOTHING;

-- ============================================================================
-- Verify the link was created
-- ============================================================================
SELECT
  p.email,
  o.name as outlet_name,
  so.added_at,
  so.created_at
FROM shopper_outlets so
JOIN profiles p ON so.shopper_id = p.id
JOIN outlets o ON so.outlet_id = o.id
WHERE p.email = 'info@georgiaadams.co.za';
