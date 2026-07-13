## Goal
Drop the grocery/Open Food Facts seeder and instead give existing products (the Cape Union Mart demo catalogue, or any retailer's products) valid scannable barcodes so QR-code generation can be tested end-to-end.

## Changes

**Remove**
- Delete `src/lib/sample-products.functions.ts` (the Coke/Nutella/etc. seeder).
- Remove the `Boxes` icon + `seedSampleProducts` import + `handleSeedSamples` state and toolbar button from `src/routes/_authenticated/products.index.tsx`.

**Add: `assignMissingBarcodes` server function** (new `src/lib/barcode-assign.functions.ts`)
- Auth: `requireSupabaseAuth`, retailer-scoped like the other functions.
- Finds all products for the caller's retailer where `gtin IS NULL`.
- For each, generates a deterministic valid **GTIN-13** in the internal-use prefix `200`–`299` (safe for in-house / non-registered barcodes), derived from a hash of the product id so re-runs are stable, with a correct mod-10 check digit.
- Updates each product with `gtin`, `barcode_type = 'GTIN-13'`, and `sku` (only when the current sku is empty).
- Upserts each into `passport_enrichment_queue` so the existing tick job generates QR + digital passport.
- Returns `{ updated, skipped, total }`.

**Wire into Inventory toolbar** (`src/routes/_authenticated/products.index.tsx`)
- Replace the removed grocery button with a `canManage`-gated **"Generate barcodes"** button that calls the new fn, shows a loading toast, then invalidates queries.
- Copy: *"Assign valid GTIN-13 barcodes to any product missing one, then queue QR generation."*

## Technical notes
- GTIN-13 check digit: sum of digits at odd positions ×1 + even positions ×3, then `(10 - sum % 10) % 10`. Standard formula.
- Prefixes `200`–`299` are reserved by GS1 for in-store / internal use, so they will not collide with real registered products.
- Nothing changes in the seed data itself — this action operates on whatever products already exist for the retailer, so it works for Cape Union Mart today and any future demo catalogue.
- After running, the existing **"Complete digital identity"** button (already in the toolbar) generates the actual QR PNGs/PDFs from these new GTINs.

## Not doing
- No fetching from Open Food Facts or any external barcode lookup — CUM products (K-Way, Capestorm, etc.) aren't in those DBs; synthetic-but-valid GTINs are the only reliable path for testing.
- No changes to the Cape Union Mart seed file itself.
