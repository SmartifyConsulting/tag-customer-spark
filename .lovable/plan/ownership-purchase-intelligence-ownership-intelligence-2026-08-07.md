# Ownership: Purchase Intelligence + Ownership Intelligence

Extends TAG beyond Product Intelligence with a consumer-owned purchase and ownership record. Built retailer-first inside the existing app (same sidebar, tokens, card/badge patterns), with the data model shaped so a consumer login surface can be added later without rework.

Removed from the AI scope per your note: resale value estimates and trade-in offers.

## New navigation

A single top-level "Ownership" group in the sidebar, expanded like Intelligence:

```text
Ownership
├── Purchases
├── My Products
├── Household
├── Warranties
├── Returns
├── TAG ID
```

Digital Receipts, Manuals, Service History, Insurance and Product Health live as tabs inside the screens they belong to (Receipts as a tab on Purchases; Manuals / Service History / Documents / Health as tabs on a product profile), so the sidebar stays at the six everyday destinations.

## Phase 2 — Purchase Intelligence

**Purchases** — searchable card/table list of every purchase. Card shows product image, name, store, date, price paid, quantity, receipt status, warranty status. Filters: store, category, brand, date range, warranty expiring, returned, refunded. Search across product, brand, store, SKU and receipt number.

**Purchase detail** — summary (product, brand, retailer, date, price, qty, payment method, receipt number), the basket of everything bought on that receipt, store information with address and contact, and a lifecycle timeline: Purchased → Warranty started → Return window ends → Warranty expires.

**Digital receipt wallet** — receipt vault with search, categorise, favourite, archive, and exports for tax and insurance. Receipts render as an on-screen preview with download PDF, share, print and export.

**TAG ID** — every consumer gets a permanent ID like `TAG-8427-KJ91`, shown as QR, barcode and an NFC identifier string. The code carries only the TAG ID, no personal data. A retailer-side "record a purchase" flow lets staff scan/enter a TAG ID and attach basket lines from existing inventory.

**Returns** — start a return, see status and eligibility (driven by the return window on the purchase), and generate a return QR.

## Phase 3 — Ownership Intelligence

**My Products** — everything owned, grouped by category (Home, Electronics, Kitchen, Garden, Clothing, Automotive). Cards show image, purchase date, warranty remaining, condition and ownership status.

**Product profile** tabs: Overview (images, serial number, purchase details, ownership status), Warranty (period, remaining days, claim status; register warranty, make claim, download certificate), Manuals (user / quick start / installation / safety), Accessories (compatible product suggestions), Service History (purchase, repairs, maintenance, claims, software updates), Documents (receipt, warranty, invoice, insurance), Product Health (warranty remaining, estimated lifespan, maintenance due, recall alerts, safety notices, battery health, software updates).

**Household** — the same owned inventory organised by room (Kitchen, Lounge, Garage, Bedroom, Office, Outdoor), with per-room value totals and item counts. Doubles as the insurance/moving/estate view.

**Warranties** — cross-product list sorted by expiry with progress indicators and an expiring-soon section.

**Insurance mode** — export the whole household inventory (purchase value, current value, serial numbers, receipts, photos) as PDF, Excel or CSV.

## AI features

Using the existing AI setup: summarise receipts, detect duplicate purchases, predict replacement timing, recommend servicing, highlight expiring warranties, identify recalled products, and recommend accessories from owned products. No resale value, no trade-in.

## Data

New tables: `consumer_tag_ids` (TAG ID), `purchases`, `purchase_items`, `receipts`, `owned_products`, `warranties`, `warranty_claims`, `returns`, `service_events`, `product_documents`, `household_rooms`. All with grants and RLS scoped so retailer staff see only their own retailer's records, and rows carry the TAG ID so a future consumer login reads its own history unchanged.

Purchases are created two ways now: a retailer-side "Record purchase" dialog (scan TAG ID, pick store, add inventory lines), plus a seeded demo dataset — a realistic household of purchases across several stores and categories with receipts, warranties at different stages, one active return and one recalled item — so every screen looks real on first open.

## Technical notes

- Routes under `src/routes/_authenticated/ownership.*` following existing file/route conventions; nav entry added to `src/lib/nav.ts` with sub-items, mirroring the Intelligence group.
- All reads/writes through `createServerFn` in `src/lib/ownership.functions.ts` (+ `.server.ts` helpers), loaded via `ensureQueryData` / `useSuspenseQuery`.
- Exports (PDF/Excel/CSV) reuse the existing export helpers; QR/barcode generation reuses the current QR pipeline.
- AI calls go through the existing gateway helpers, batched server-side, never blocking page render.
- Design stays on current tokens: white surfaces, grey hovers, existing badge and card components; large imagery, timelines and progress bars added as shared components under `src/components/ownership/`.

## Build order

1. Schema, grants, RLS, seed data, TAG ID.
2. Purchases list, detail, receipt wallet, returns.
3. My Products, product profile tabs, warranties, household.
4. Exports and AI features.
