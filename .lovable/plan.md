# TAG — Digital Receipt & Ownership Architecture Refactor

No visual redesign. Same colours, typography and components. This changes navigation, entity relationships and workflows only.

## The lifecycle everything hangs off

```text
Discover → Research → Purchase → Digital Receipt → Ownership → Warranty → Returns
```

## Who sees what

Two audiences over one backend, unchanged in spirit but corrected:

- **Retail (staff)** — Briefing, Inventory, Messages, Clients (with each client's purchases, receipts, owned products, returns, warranties), Analytics, plus the existing Product Intelligence surfaces (QR Tags, Intent Engine, Watchlists, Stores, Staff, Notifications, Settings).
- **Personal (everyone, staff included)** — Purchases, Receipts, My Products, Warranties, Household, Documents, Service History, Returns, TAG ID. Staff are customers elsewhere, so this section is always available to them too, not just to shoppers.

"Wallet ID" is dropped everywhere. The term is **TAG ID**.

## Navigation after the refactor

```text
PRODUCT          Dashboard · Products · QR Tags · Intent Engine · Watchlists
PURCHASE         Purchases · Digital Receipts · Purchase Intelligence · Receipt Search · Returns
OWNERSHIP        My Products · Warranties · Household · Product Documents · Service History · Insurance Export · TAG ID
BUSINESS         Clients · Stores · Staff · Inbox · Notifications · Analytics · Settings
```

PRODUCT and BUSINESS render only for staff roles. PURCHASE and OWNERSHIP render for everyone. Nothing existing is removed — items are regrouped, not deleted, and old URLs keep working.

## How a purchase is created

The counter flow, not a POS integration:

1. Customer shows their TAG ID (QR or barcode) at the till.
2. Staff scan it from the existing scan surface — TAG resolves the customer.
3. Staff pick the products and send the receipt.
4. That single action writes a **purchase**, a **receipt**, and an **ownership record** for each line, all linked to product, store, retailer and customer. A warranty record is created where the product carries a warranty term.

A receipt is never a standalone document — it is the join between those entities, and every screen reads it that way.

## Phasing

**Phase 1 — Navigation, TAG ID, receipts surface**
Four-section nav with role gating; rename Wallet ID → TAG ID; new TAG ID screen showing customer QR, barcode, TAG number, scan history, connected devices and receipt statistics; Digital Receipts list and Receipt Search; language changes (Activities → Ownership Timeline, Documents → Product Documents, History → Purchase History, Analytics → Purchase Intelligence).

**Phase 2 — Relationships and workflows**
Scan-TAG-ID-at-till flow creating purchase + receipt + ownership + warranty in one transaction; Ownership section on Product Detail (Purchased / Owned / Warranty remaining / Receipt available / Current value); Client profile tabs (Purchases, Receipts, Owned Products, Returns, Warranty); receipt status badges (Paper, Digital, Synced, Pending, Failed, Returned, Refunded, Warranty Registered); Household auto-grouping into Kitchen, Lounge, Bedroom, Office, Garage, Garden with drag/move between rooms.

**Phase 3 — Intelligence, search, alerts**
Retailer dashboard KPI cards (Digital Receipts Issued, Paper Receipts Avoided, Customers using TAG, Average Receipts per Customer, Digital Adoption Rate); global search across products, receipts, customers, stores, warranties, returns, owned products, receipt numbers and serial numbers; lifecycle notifications (Receipt Received, Warranty Expiring, Recall Notice, Return Window Ending, Price Drop After Purchase, Product Recall); Insurance Export and Service History.

## Technical notes

- Nav config in `src/lib/nav.ts` becomes section-grouped (`PRODUCT`/`PURCHASE`/`OWNERSHIP`/`BUSINESS`) with a `staffOnly` flag per section; `src/hooks/use-persona.ts` returns a capability set (`isStaff`) instead of an either/or persona. Sidebar and mobile bar consume the same config.
- Routes move under `/purchase/*` and `/ownership/*`; existing `/ownership/*` paths stay valid, and `/ownership/tag-id` is relabelled TAG ID. New leaves: `purchase.receipts`, `purchase.search`, `purchase.intelligence`, `ownership.documents`, `ownership.service-history`, `ownership.insurance-export`.
- Existing tables already cover the model: `purchases`, `purchase_items`, `receipts`, `owned_products`, `warranties`, `warranty_claims`, `product_returns`, `service_events`, `product_documents`, `household_rooms`, `consumer_tag_ids`. Phase 2 adds only what is missing: a receipt status enum/column, `owned_products.room_id` defaulting from a product-category → room map, and indexes for receipt-number / serial-number search.
- One server-side `recordPurchaseFromTagScan` function performs the purchase + receipt + ownership + warranty writes together, so future POS, bank or manufacturer feeds call the same entry point without any navigation change.
- Search is a single server function fanning out over the entity tables and returning a typed union, so new entity types slot in without new screens.
- Everything stays in existing shadcn components and current tokens; no new visual system.
