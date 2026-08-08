# Sample Purchase Data for Testing

## Overview
Sample data created for user: `info@georgiaadams.co.za` at outlet `Cape Union Mart`

## Purchases Summary

### Purchase 1 - 45 days ago
- **Receipt**: CUM-2024-08-001
- **Payment**: Card
- **Items**:
  - **Dell XPS 13** (R15,000)
    - Brand: Dell
    - Category: Electronics
    - Warranty: 24 months ✓
    - Serial: DL-XPS13-2024-001
    - Has training manual: YES
    - Status: Active warranty
  
  - **USB-C Hub 7-in-1** (R35)
    - Brand: Anker
    - Category: Electronics
    - Warranty: 12 months ✓
    - Serial: ANK-HUB7-2024-045

---

### Purchase 2 - 30 days ago
- **Receipt**: CUM-2024-08-015
- **Payment**: Card
- **Items**:
  - **Ergonomic Desk Chair Pro** (R3,200)
    - Brand: Herman Miller
    - Category: Office Furniture
    - Warranty: None ✗
    - Serial: HM-CHAIR-2024-102
    - Status: Within 30-day return window
  
  - **Coffee Maker - Programmable** (R2,500)
    - Brand: Breville
    - Category: Kitchen
    - Warranty: 12 months ✓
    - Serial: BRV-CM-2024-089
    - Has manual: YES

---

### Purchase 3 - 15 days ago
- **Receipt**: CUM-2024-08-042
- **Payment**: Cash
- **Items**:
  - **Mechanical Keyboard RGB** (R800)
    - Brand: Corsair
    - Category: Electronics
    - Warranty: None ✗
    - Serial: COR-KB-RGB-2024-234
    - Status: No warranty, within return window
  
  - **27" 4K Monitor** (R4,000)
    - Brand: LG
    - Category: Electronics
    - Warranty: 36 months ✓
    - Serial: LG-MON27-2024-567
    - Has manual: YES
    - Has warranty guide: YES
    - Status: Active extended warranty (3 years)

---

### Purchase 4 - 8 days ago
- **Receipt**: CUM-2024-08-089
- **Payment**: EFT
- **Items**:
  - **External SSD 2TB** (R1,200)
    - Brand: Samsung T7
    - Category: Electronics
    - Warranty: 24 months ✓
    - Serial: SAM-SSD2T-2024-890
    - Status: Active warranty
  
  - **Desk Lamp LED** (R450)
    - Brand: Philips Hue
    - Category: Office Lighting
    - Warranty: None ✗
    - Serial: PHI-LAMP-2024-234
    - Status: No warranty

---

### Purchase 5 - 3 days ago
- **Receipt**: CUM-2024-08-156
- **Payment**: Card
- **Items**:
  - **Wireless Mouse Pro** (R350 × 2)
    - Brand: Logitech
    - Category: Electronics
    - Warranty: 12 months ✓
    - Serial: LOG-MOUSE-2024-001
    - Quantity: 2 units
    - Has quick start guide: YES
  
  - **Monitor Stand Adjustable** (R250)
    - Brand: AmazonBasics
    - Category: Office Furniture
    - Warranty: None ✗
    - Serial: AMZ-STAND-2024-567

---

## Key Features for Testing

### Products with Warranties (6 items):
1. Dell XPS 13 (24 months) - Premium electronics
2. USB-C Hub (12 months) - Accessory
3. Coffee Maker (12 months) - Kitchen appliance
4. 27" Monitor (36 months) - Premium electronics
5. External SSD (24 months) - Storage
6. Wireless Mouse (12 months) × 2 units

### Products WITHOUT Warranties (4 items):
1. Desk Chair
2. Mechanical Keyboard
3. Desk Lamp
4. Monitor Stand

### Products with Documentation:
- **Dell XPS 13**: User Manual + Warranty Certificate
- **27" 4K Monitor**: Setup Guide + Warranty Information
- **Coffee Maker**: User Manual
- **Wireless Mouse**: Quick Start Guide

### Use Cases for Testing:

#### Warranty Expiration Alerts
- Monitor which products have expiring warranties
- LG Monitor (36 months) won't expire for ~3 years
- Keyboards and lamp have no warranty

#### Return Window Tracking
- All items within 30-day return window
- Show return window ending alerts (8-day and 3-day purchases)

#### Document Access
- Users can download manuals for products that have them
- Warranty certificates available for warranted items

#### Price Tracking
- High-value items: XPS (R15k), Monitor (R4k), Chair (R3.2k)
- Mid-range: Coffee maker (R2.5k), SSD (R1.2k)
- Budget: Keyboard (R800), Lamps/Stands (R250-450)

#### Purchase Pattern Analysis
- Multiple purchases over 45-day period
- Mix of retailers would show: furniture, electronics, kitchen
- Different payment methods: Card, Cash, EFT
- Receipt-to-digital tracking capability

---

## SQL Migration
To load this sample data, run:
```sql
-- Run the migration file:
-- supabase/migrations/seed_purchases_sample_data.sql

-- Or run via Supabase CLI:
-- supabase db push
```

---

## Future Enhancements
- Add service events (repairs, maintenance)
- Add returns/refunds for some items
- Add warranty claims history
- Add warranty transfers between users
- Add insurance information
- Add supplier/store-specific documents
