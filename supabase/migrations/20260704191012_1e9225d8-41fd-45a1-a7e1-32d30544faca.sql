
-- Backfill product images per-product to match name/description themes
-- Uses distinct Unsplash photos per SKU pattern

-- BEANS: coffee beans / bags
UPDATE public.products p
SET image_url = CASE
  WHEN lower(p.name) LIKE '%decaf%'      THEN 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%espresso%'   THEN 'https://images.unsplash.com/photo-1442550528053-c431ecb55509?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%ethiopia%' OR lower(p.name) LIKE '%yirgacheffe%' THEN 'https://images.unsplash.com/photo-1580933073521-dc49ac0d4e6a?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%kenya%'      THEN 'https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%brazil%'     THEN 'https://images.unsplash.com/photo-1442411397052-c67536bb84c4?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%honduras%'   THEN 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%house blend%' THEN 'https://images.unsplash.com/photo-1559525839-d9acfd02c6f7?w=800&auto=format&fit=crop&q=70'
  ELSE 'https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=800&auto=format&fit=crop&q=70'
END
FROM public.product_categories c
WHERE p.category_id = c.id AND c.name = 'Beans';

-- BREWING GEAR: dial in per gadget
UPDATE public.products p
SET image_url = CASE
  WHEN lower(p.name) LIKE '%aeropress%'   THEN 'https://images.unsplash.com/photo-1516315720917-231ef9acce48?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%v60%' OR lower(p.name) LIKE '%hario%' THEN 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%kettle%'      THEN 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%grinder%' OR lower(p.name) LIKE '%comandante%' THEN 'https://images.unsplash.com/photo-1592842232655-e5d345cbc2c1?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%scale%' OR lower(p.name) LIKE '%acaia%'        THEN 'https://images.unsplash.com/photo-1571047860521-a01ff70e0c15?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%chemex%'                                        THEN 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%moka%'                                          THEN 'https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=800&auto=format&fit=crop&q=70'
  ELSE 'https://images.unsplash.com/photo-1495197359483-d092478c170a?w=800&auto=format&fit=crop&q=70'
END
FROM public.product_categories c
WHERE p.category_id = c.id AND c.name = 'Brewing Gear';

-- MERCH: mugs, tees, hoodies, journals, caps
UPDATE public.products p
SET image_url = CASE
  WHEN lower(p.name) LIKE '%mug%'      THEN 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%hoodie%'   THEN 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%tee%' OR lower(p.name) LIKE '%t-shirt%' THEN 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%cap%'      THEN 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%journal%'  THEN 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%cup%'      THEN 'https://images.unsplash.com/photo-1494314671902-399b18174975?w=800&auto=format&fit=crop&q=70'
  ELSE 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=70'
END
FROM public.product_categories c
WHERE p.category_id = c.id AND c.name = 'Merch';

-- ACCESSORIES: belts, hats, wallets, totes, veldskoen
UPDATE public.products p
SET image_url = CASE
  WHEN lower(p.name) LIKE '%veldskoen%' OR lower(p.name) LIKE '%shoe%' THEN 'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%belt%'        THEN 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%bucket hat%' OR lower(p.name) LIKE '%beanie%' OR lower(p.name) LIKE '%hat%' THEN 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%tote%'        THEN 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%card holder%' OR lower(p.name) LIKE '%wallet%' THEN 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=70'
  ELSE 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=70'
END
FROM public.product_categories c
WHERE p.category_id = c.id AND c.name = 'Accessories';

-- BOTTOMS: pants, shorts, denim, chinos, trousers
UPDATE public.products p
SET image_url = CASE
  WHEN lower(p.name) LIKE '%denim%' OR lower(p.name) LIKE '%jean%'  THEN 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%chino%'                                  THEN 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%short%'                                  THEN 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%jogger%'                                 THEN 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%trouser%' OR lower(p.name) LIKE '%wide%' THEN 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%linen%'                                  THEN 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&auto=format&fit=crop&q=70'
  ELSE 'https://images.unsplash.com/photo-1548883354-94bcfe321cbb?w=800&auto=format&fit=crop&q=70'
END
FROM public.product_categories c
WHERE p.category_id = c.id AND c.name = 'Bottoms';

-- TOPS: shirts, tees, knits, henleys
UPDATE public.products p
SET image_url = CASE
  WHEN lower(p.name) LIKE '%henley%'                    THEN 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%wool%' OR lower(p.name) LIKE '%knit%' THEN 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%resort%' OR lower(p.name) LIKE '%shirt%' THEN 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=70'
  WHEN lower(p.name) LIKE '%tee%' OR lower(p.name) LIKE '%crew%'    THEN 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=70'
  ELSE 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&auto=format&fit=crop&q=70'
END
FROM public.product_categories c
WHERE p.category_id = c.id AND c.name = 'Tops';
