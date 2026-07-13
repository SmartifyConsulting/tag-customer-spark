## What's happening today

**Templates:** `TAXONOMY_TEMPLATES` (17 retail/wholesale templates) exist, but they only appear inside the "New profile" dialog — nothing seeds them for a new retailer, so the profile dropdown shows only the one default "Products" profile.

**Publish / Default:**
- `Publish` flags a profile as `is_published`. `getActiveProfile` picks the published one first, else default, else first — the Inventory browser reads *this* to render its category tree. It does **not** copy products or change what's in Inventory; it just switches which hierarchy the browser groups by.
- `setDefaultProfile` sets `is_default=true` on the picked row but never clears it on the others, so "set as default" silently does nothing when another row is already default.

**Barcodes:** No built-in test-data seeder. Products only exist if imported.

## Plan

### 1. Seed all sector templates as ready-to-pick profiles
- On first load of the Taxonomy admin (or on a new "Load sector templates" action), insert every `TAXONOMY_TEMPLATES` entry as a `taxonomy_profiles` row for the retailer with its levels. The current "Products · default · published" row stays as-is; the 17 templates appear alongside it in the profile dropdown so the user can pick "Fashion & Apparel", "Grocery & Supermarket", etc. and hit Publish.
- Add a small "Load sector templates" button next to "New profile" so re-seeding is explicit and idempotent (skip templates already present by name).

### 2. Fix "Set default"
- `setDefaultProfile` server fn: in a single call, clear `is_default` on all of the retailer's profiles, then set it on the chosen one. Result: switching default actually switches it.
- Same treatment for `publishProfile` when publishing (only one published profile at a time — matches how `getActiveProfile` picks it).

### 3. Clarify what Publish does (UI copy + confirmation)
- Update the CardDescription and the Publish button tooltip to say plainly: "Publishing makes this hierarchy the one used by the Inventory browser. It does not add or remove products."
- After Publish succeeds, toast: "Inventory browser now uses '{name}'."
- If Inventory still looks empty after publish, that's a product-data issue, not a publish issue — covered by step 4.

### 4. Test-barcode seeder for QR generation
Add a super-admin-only "Load sample products" action (in Admin → Categories, near the Taxonomy card, or in Inventory toolbar) that inserts ~20 real-world products with valid GTIN-13 barcodes sourced from Open Food Facts (same API the barcode scanner already uses). Each row goes through the existing digital-identity pipeline so QR + passport get generated automatically.
- Uses a fixed curated list of well-known GTINs (Coke 5449000000996, Nutella 3017620422003, etc.) so it works offline-friendly and deterministically.
- Idempotent: skips GTINs already present for the retailer.
- Result: user immediately has scannable products to test QR generation end-to-end.

### Technical notes
- New server fns in `src/lib/taxonomy.functions.ts`: `seedSectorTemplates` (loops `TAXONOMY_TEMPLATES`, inserts profile + levels if name not taken).
- Fix `setDefaultProfile` / `publishProfile` to scope-clear siblings via `retailer_id`.
- New server fn `seedSampleProducts` in `src/lib/products.functions.ts` (or new file) that fetches product data from `https://world.openfoodfoodfacts.org/api/v2/product/<gtin>.json`, inserts into `products`, then enqueues passport enrichment.
- UI wiring in `taxonomy-engine-tab.tsx` (new buttons + copy) and one entry point for sample products in Inventory toolbar (super-admin only).
- No schema changes needed.
