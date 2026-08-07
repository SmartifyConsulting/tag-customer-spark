# TAG Ownership Refactor — Phase 2 & 3

Phase 1 (four-section nav, TAG ID, receipts surface) is in. This continues with the relationships/workflows layer, then intelligence, search and alerts. No visual redesign — same tokens and components.

## Phase 2 — Relationships and workflows

**Scan TAG ID at the till**
A single counter flow: staff scan or type a customer's TAG ID, pick store, add product lines, send. One server call writes purchase + receipt + ownership record per line + warranty where the product carries a term. The existing `recordPurchase` function is extended into `recordPurchaseFromTagScan` so future POS/bank feeds use the same entry point.

**Receipt status**
Receipts get a status: Paper, Digital, Synced, Pending, Failed, Returned, Refunded, Warranty Registered. Shown as a badge on the receipts list, purchase detail and client profile. Returned/Refunded derive from the linked return; Warranty Registered from the warranty record.

**Ownership on Product Detail**
A new Ownership section on the retailer product page: units purchased, units owned, average warranty remaining, receipts available, current estimated value.

**Client profile tabs**
Each customer gains tabs: Purchases, Receipts, Owned Products, Returns, Warranties — all reading the same records the shopper sees.

**Household rooms**
Owned products auto-group into Kitchen, Lounge, Bedroom, Office, Garage, Garden using a product-category → room map, with a move-between-rooms control and per-room value totals.

## Phase 3 — Intelligence, search, alerts

**Retailer KPIs** on the Briefing/Analytics surface: Digital Receipts Issued, Paper Receipts Avoided, Customers using TAG, Average Receipts per Customer, Digital Adoption Rate.

**Global search** — one search box across products, receipts, customers, stores, warranties, returns, owned products, receipt numbers and serial numbers, returning a typed, grouped result list.

**Lifecycle notifications** — Receipt Received, Warranty Expiring, Return Window Ending, Price Drop After Purchase, Product Recall. These reuse the existing WhatsApp/Infobip dispatcher and template rules; no new provider work.

**Service History and Insurance Export** — a chronological service/repair/claim timeline per owned product, and a full household export (purchase value, current value, serial numbers, receipts) as PDF, Excel or CSV using the existing export helpers.

## Technical notes

- Migration adds: `receipts.status` (new enum with the eight states, default `digital`), a category→room default for `owned_products.room_id` (column already exists), and indexes on `purchases.receipt_number`, `receipts.receipt_number`, `owned_products.serial_number` for search. Grants + RLS follow the existing retailer-scoped pattern.
- New/extended server functions in `src/lib/ownership.functions.ts`: `recordPurchaseFromTagScan`, `productOwnershipSummary`, `clientOwnershipTabs`, `moveOwnedProductToRoom`, `receiptKpis`.
- Global search is one server function fanning out over the entity tables and returning a typed union, wired into the existing command palette plus `/purchase/search`.
- Lifecycle alerts hook into `src/lib/notification-engine.server.ts` alongside the current watch rules; strict template-parameter validation stays.
- Product Detail ownership block goes in `src/components/products/product-detail-view.tsx`; client tabs in the customers view. Existing routes and URLs stay valid.

## Build order

1. Migration (receipt status, room defaults, search indexes).
2. TAG-scan purchase workflow + receipt status badges.
3. Product Detail ownership block + client profile tabs + household rooms.
4. KPIs, global search, lifecycle alerts, service history and insurance export.
