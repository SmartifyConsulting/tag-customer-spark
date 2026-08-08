-- Link info@georgiaadams.co.za to Cape Union Mart outlet

-- First, ensure Cape Union Mart exists in outlets
INSERT INTO outlets (name, location)
VALUES ('Cape Union Mart', 'South Africa')
ON CONFLICT (name) DO NOTHING;

-- Link the user to the outlet
INSERT INTO shopper_outlets (shopper_id, outlet_id)
SELECT p.id, o.id
FROM profiles p
CROSS JOIN outlets o
WHERE p.email = 'info@georgiaadams.co.za'
  AND o.name = 'Cape Union Mart'
ON CONFLICT (shopper_id, outlet_id) DO NOTHING;
