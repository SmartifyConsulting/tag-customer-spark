-- Direct SQL statements to insert sample purchase data
-- Run these directly against your Supabase database

-- STEP 1: Get the user ID and outlet ID (you'll need these IDs)
-- Query these first to get the actual IDs:
-- SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za';
-- SELECT id FROM outlets WHERE name = 'Cape Union Mart';

-- Replace these with actual IDs from your database:
-- SET @user_id = 'YOUR_USER_ID_HERE';
-- SET @outlet_id = 'YOUR_OUTLET_ID_HERE';

-- For this example, we'll use placeholder variables - adjust as needed

-- ============================================================================
-- INSERT SAMPLE PURCHASES
-- ============================================================================

-- Purchase 1: 45 days ago - Laptop & USB Hub
INSERT INTO purchases (shopper_id, outlet_id, purchased_at, payment_method, receipt_number)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM outlets WHERE name = 'Cape Union Mart' LIMIT 1),
  NOW() - INTERVAL '45 days',
  'Card',
  'CUM-2024-08-001'
);

-- Purchase 2: 30 days ago - Office Chair & Coffee Maker
INSERT INTO purchases (shopper_id, outlet_id, purchased_at, payment_method, receipt_number)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM outlets WHERE name = 'Cape Union Mart' LIMIT 1),
  NOW() - INTERVAL '30 days',
  'Card',
  'CUM-2024-08-015'
);

-- Purchase 3: 15 days ago - Keyboard & Monitor
INSERT INTO purchases (shopper_id, outlet_id, purchased_at, payment_method, receipt_number)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM outlets WHERE name = 'Cape Union Mart' LIMIT 1),
  NOW() - INTERVAL '15 days',
  'Cash',
  'CUM-2024-08-042'
);

-- Purchase 4: 8 days ago - External SSD & Desk Lamp
INSERT INTO purchases (shopper_id, outlet_id, purchased_at, payment_method, receipt_number)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM outlets WHERE name = 'Cape Union Mart' LIMIT 1),
  NOW() - INTERVAL '8 days',
  'EFT',
  'CUM-2024-08-089'
);

-- Purchase 5: 3 days ago - Wireless Mouse & Monitor Stand
INSERT INTO purchases (shopper_id, outlet_id, purchased_at, payment_method, receipt_number)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM outlets WHERE name = 'Cape Union Mart' LIMIT 1),
  NOW() - INTERVAL '3 days',
  'Card',
  'CUM-2024-08-156'
);

-- ============================================================================
-- INSERT OWNED PRODUCTS (ITEMS FROM PURCHASES)
-- ============================================================================

-- PURCHASE 1 ITEMS
-- Item 1: Dell XPS 13 (24 month warranty, has manual)
INSERT INTO owned_products (
  shopper_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM purchases WHERE receipt_number = 'CUM-2024-08-001' LIMIT 1),
  'Dell XPS 13 Laptop',
  'Dell',
  'Electronics',
  1500000,  -- R15,000
  1,
  24,       -- 24 month warranty
  30,
  'DL-XPS13-2024-001'
);

-- Item 2: USB-C Hub (12 month warranty)
INSERT INTO owned_products (
  shopper_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM purchases WHERE receipt_number = 'CUM-2024-08-001' LIMIT 1),
  'USB-C Hub 7-in-1',
  'Anker',
  'Electronics',
  3500,     -- R35
  1,
  12,       -- 12 month warranty
  30,
  'ANK-HUB7-2024-045'
);

-- PURCHASE 2 ITEMS
-- Item 3: Ergonomic Desk Chair (NO warranty)
INSERT INTO owned_products (
  shopper_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM purchases WHERE receipt_number = 'CUM-2024-08-015' LIMIT 1),
  'Ergonomic Desk Chair Pro',
  'Herman Miller',
  'Office Furniture',
  320000,   -- R3,200
  1,
  0,        -- NO WARRANTY
  30,
  'HM-CHAIR-2024-102'
);

-- Item 4: Coffee Maker (12 month warranty, has manual)
INSERT INTO owned_products (
  shopper_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM purchases WHERE receipt_number = 'CUM-2024-08-015' LIMIT 1),
  'Coffee Maker Programmable',
  'Breville',
  'Kitchen',
  250000,   -- R2,500
  1,
  12,       -- 12 month warranty
  30,
  'BRV-CM-2024-089'
);

-- PURCHASE 3 ITEMS
-- Item 5: Mechanical Keyboard (NO warranty)
INSERT INTO owned_products (
  shopper_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM purchases WHERE receipt_number = 'CUM-2024-08-042' LIMIT 1),
  'Mechanical Keyboard RGB',
  'Corsair',
  'Electronics',
  80000,    -- R800
  1,
  0,        -- NO WARRANTY
  30,
  'COR-KB-RGB-2024-234'
);

-- Item 6: 27" 4K Monitor (36 month warranty, has manual & guide)
INSERT INTO owned_products (
  shopper_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM purchases WHERE receipt_number = 'CUM-2024-08-042' LIMIT 1),
  '27 Inch 4K Monitor',
  'LG',
  'Electronics',
  400000,   -- R4,000
  1,
  36,       -- 36 month warranty (extended!)
  30,
  'LG-MON27-2024-567'
);

-- PURCHASE 4 ITEMS
-- Item 7: External SSD 2TB (24 month warranty)
INSERT INTO owned_products (
  shopper_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM purchases WHERE receipt_number = 'CUM-2024-08-089' LIMIT 1),
  'External SSD 2TB',
  'Samsung T7',
  'Electronics',
  120000,   -- R1,200
  1,
  24,       -- 24 month warranty
  30,
  'SAM-SSD2T-2024-890'
);

-- Item 8: Desk Lamp LED (NO warranty)
INSERT INTO owned_products (
  shopper_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM purchases WHERE receipt_number = 'CUM-2024-08-089' LIMIT 1),
  'Desk Lamp LED Smart',
  'Philips Hue',
  'Office Lighting',
  45000,    -- R450
  1,
  0,        -- NO WARRANTY
  30,
  'PHI-LAMP-2024-234'
);

-- PURCHASE 5 ITEMS
-- Item 9: Wireless Mouse Pro (12 month warranty, qty 2)
INSERT INTO owned_products (
  shopper_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM purchases WHERE receipt_number = 'CUM-2024-08-156' LIMIT 1),
  'Wireless Mouse Pro',
  'Logitech',
  'Electronics',
  35000,    -- R350 each
  2,        -- 2 units
  12,       -- 12 month warranty
  30,
  'LOG-MOUSE-2024-001'
);

-- Item 10: Monitor Stand Adjustable (NO warranty)
INSERT INTO owned_products (
  shopper_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1),
  (SELECT id FROM purchases WHERE receipt_number = 'CUM-2024-08-156' LIMIT 1),
  'Monitor Stand Adjustable',
  'AmazonBasics',
  'Office Furniture',
  25000,    -- R250
  1,
  0,        -- NO WARRANTY
  30,
  'AMZ-STAND-2024-567'
);

-- ============================================================================
-- VERIFY YOUR DATA
-- ============================================================================

-- Check purchases were inserted:
SELECT COUNT(*) as purchase_count FROM purchases
WHERE shopper_id = (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1);

-- Check owned products:
SELECT COUNT(*) as product_count FROM owned_products
WHERE shopper_id = (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1);

-- View all products for the user:
SELECT
  product_name,
  brand,
  category,
  ROUND(unit_price_cents / 100.0, 2) as price_rands,
  quantity,
  warranty_months,
  serial_number
FROM owned_products
WHERE shopper_id = (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1)
ORDER BY created_at DESC;

-- View purchases with totals:
SELECT
  receipt_number,
  purchased_at::date as purchase_date,
  payment_method,
  (SELECT COUNT(*) FROM owned_products WHERE purchase_id = purchases.id) as item_count,
  ROUND((SELECT COALESCE(SUM(unit_price_cents * quantity), 0) / 100.0 FROM owned_products WHERE purchase_id = purchases.id), 2) as total_rands
FROM purchases
WHERE shopper_id = (SELECT id FROM profiles WHERE email = 'info@georgiaadams.co.za' LIMIT 1)
ORDER BY purchased_at DESC;
