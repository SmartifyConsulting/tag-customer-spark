-- Direct SQL statements to insert sample purchase data - CORRECTED
-- Run these directly against your Supabase database
-- This version uses the correct schema: tag_ref, retailer_id, store_id

-- STEP 1: Get the required IDs first
-- Query these to get the actual IDs:
-- 1. Find your retailer_id (e.g., your store's retailer):
--    SELECT id, name FROM retailers LIMIT 1;
-- 2. Find Cape Union Mart store_id:
--    SELECT id, name FROM stores WHERE name LIKE '%Cape Union%' LIMIT 1;
-- 3. Find consumer TAG ID for info@georgiaadams.co.za:
--    SELECT id FROM consumer_tag_ids WHERE customer_id = (SELECT id FROM customers WHERE email = 'info@georgiaadams.co.za' LIMIT 1) LIMIT 1;
--    OR if using profiles: SELECT id FROM consumer_tag_ids WHERE display_name LIKE '%georgia%' LIMIT 1;

-- For reference, the purchases table schema is:
-- id, retailer_id, store_id, tag_ref, purchased_at, receipt_number, payment_method, currency, total_cents, status, notes, created_by

-- ============================================================================
-- INSERT SAMPLE PURCHASES (adjust IDs as needed from queries above)
-- ============================================================================

-- Get your retailer ID (replace with actual)
-- SET @retailer_id = 'YOUR_RETAILER_ID_HERE';
-- GET @store_id = 'YOUR_CAPE_UNION_MART_STORE_ID_HERE';
-- SET @tag_ref = 'YOUR_CONSUMER_TAG_ID_HERE';

-- Purchase 1: 45 days ago - Laptop & USB Hub - Total R15,035
INSERT INTO purchases (retailer_id, store_id, tag_ref, purchased_at, receipt_number, payment_method, total_cents, currency)
VALUES (
  (SELECT id FROM retailers LIMIT 1),  -- Use your retailer ID
  (SELECT id FROM stores WHERE name ILIKE '%Cape Union%' LIMIT 1),  -- Cape Union Mart
  (SELECT id FROM consumer_tag_ids LIMIT 1),  -- Your customer TAG ref
  NOW() - INTERVAL '45 days',
  'CUM-2024-08-001',
  'Card',
  1503500,  -- R15,035
  'ZAR'
);

-- Purchase 2: 30 days ago - Office Chair & Coffee Maker - Total R5,700
INSERT INTO purchases (retailer_id, store_id, tag_ref, purchased_at, receipt_number, payment_method, total_cents, currency)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
  (SELECT id FROM stores WHERE name ILIKE '%Cape Union%' LIMIT 1),
  (SELECT id FROM consumer_tag_ids LIMIT 1),
  NOW() - INTERVAL '30 days',
  'CUM-2024-08-015',
  'Card',
  570000,  -- R5,700
  'ZAR'
);

-- Purchase 3: 15 days ago - Keyboard & Monitor - Total R4,800
INSERT INTO purchases (retailer_id, store_id, tag_ref, purchased_at, receipt_number, payment_method, total_cents, currency)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
  (SELECT id FROM stores WHERE name ILIKE '%Cape Union%' LIMIT 1),
  (SELECT id FROM consumer_tag_ids LIMIT 1),
  NOW() - INTERVAL '15 days',
  'CUM-2024-08-042',
  'Cash',
  480000,  -- R4,800
  'ZAR'
);

-- Purchase 4: 8 days ago - External SSD & Desk Lamp - Total R1,650
INSERT INTO purchases (retailer_id, store_id, tag_ref, purchased_at, receipt_number, payment_method, total_cents, currency)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
  (SELECT id FROM stores WHERE name ILIKE '%Cape Union%' LIMIT 1),
  (SELECT id FROM consumer_tag_ids LIMIT 1),
  NOW() - INTERVAL '8 days',
  'CUM-2024-08-089',
  'EFT',
  165000,  -- R1,650
  'ZAR'
);

-- Purchase 5: 3 days ago - Wireless Mouse & Monitor Stand - Total R630
INSERT INTO purchases (retailer_id, store_id, tag_ref, purchased_at, receipt_number, payment_method, total_cents, currency)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
  (SELECT id FROM stores WHERE name ILIKE '%Cape Union%' LIMIT 1),
  (SELECT id FROM consumer_tag_ids LIMIT 1),
  NOW() - INTERVAL '3 days',
  'CUM-2024-08-156',
  'Card',
  63000,  -- R630
  'ZAR'
);

-- ============================================================================
-- INSERT OWNED PRODUCTS (ITEMS FROM PURCHASES)
-- Note: owned_products requires purchase_id, so purchases must exist first
-- ============================================================================

-- PURCHASE 1 ITEMS
-- Item 1: Dell XPS 13 (24 month warranty, has manual)
INSERT INTO owned_products (
  retailer_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
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
  retailer_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
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
  retailer_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
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
  retailer_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
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
  retailer_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
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
  retailer_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
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
  retailer_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
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
  retailer_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
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
  retailer_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
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
  retailer_id, purchase_id, product_name, brand, category,
  unit_price_cents, quantity, warranty_months, return_window_days, serial_number
)
VALUES (
  (SELECT id FROM retailers LIMIT 1),
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
WHERE tag_ref = (SELECT id FROM consumer_tag_ids LIMIT 1);

-- Check owned products:
SELECT COUNT(*) as product_count FROM owned_products
WHERE purchase_id IN (SELECT id FROM purchases WHERE tag_ref = (SELECT id FROM consumer_tag_ids LIMIT 1));

-- View all products with details:
SELECT
  p.receipt_number,
  op.product_name,
  op.brand,
  op.category,
  ROUND(op.unit_price_cents / 100.0, 2) as price_rands,
  op.quantity,
  op.warranty_months,
  op.serial_number,
  p.purchased_at::date as purchase_date
FROM owned_products op
JOIN purchases p ON op.purchase_id = p.id
WHERE p.tag_ref = (SELECT id FROM consumer_tag_ids LIMIT 1)
ORDER BY p.purchased_at DESC;

-- View purchases with totals:
SELECT
  receipt_number,
  purchased_at::date as purchase_date,
  payment_method,
  (SELECT COUNT(*) FROM owned_products WHERE purchase_id = purchases.id) as item_count,
  ROUND(total_cents / 100.0, 2) as total_rands
FROM purchases
WHERE tag_ref = (SELECT id FROM consumer_tag_ids LIMIT 1)
ORDER BY purchased_at DESC;
