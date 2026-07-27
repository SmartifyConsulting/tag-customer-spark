## What I found

- The QR asset for "Baby Blue Jumper" has `store_id` = null. The generator only auto-assigns a store when the retailer has exactly **one** store; this retailer has **7**, so it stays unassigned — and the existing-QR panel offers no way to pick a store (the store dropdown only appears before the first generation).

## Changes

### 1. Store identity actually gets assigned
- Add the store selector to the **existing QR** view in `product-qr-panel.tsx`, next to Regenerate: pick a branch → regenerate assigns `store_id` + `store_name` in one step (no more "regenerate with a branch selected" dead end).
- If the product record already has a `store_id`, pre-select and use it as the default instead of leaving null.
- Show the unique store identifier next to the name: `Makro Woodmead · TAG-3C9F1FF9` (short stable ID derived from the store UUID), so scans/opt-ins tie back to a uniquely identified store.
- "Store identity assigned" in the Digital Identity Build then ticks once a branch is set.

### 2. GS1 Digital Link block, neatly under the Active badge
- Move the GS1 Digital Link panel (Digital Link URL, Resolver, Copy link) into the **left column directly beneath the QR image and Active badge**, constrained to that column's width, monospace, wrapped, no overflow.

### 3. Buttons
- `Download PNG` → **PNG**, `Download SVG` → **SVG**, `Print QR` → **Print** (icons kept).

### 4. GTIN frame fits its container
- GTIN · Version / Generated / Store identity card gets min-width-0 + wrapping so the 14-digit GTIN and store line sit neatly inside the frame.

### 5. Auto-save while creating a product
- In the product create dialog, once the minimum required field (name) is filled, silently create the product as a draft and keep auto-saving edits on a short debounce, switching the dialog into edit mode against the created row. A subtle "Saving… / Saved" indicator shows state; closing the dialog no longer loses work.

### 6. Prices in rands, not cents
- All price entry and display switch to rand values: form inputs accept e.g. `249.99` (converted to/from `*_cents` at the boundary), and all UI labels/tables/cards render `R 249.99` rather than raw cent values. Database columns stay in cents (correct for money) — this is a presentation/input-conversion change across product, pricing, ROI and billing surfaces.

### 7. Briefing page TAG Barcode Reader tile
- Remove the card frame/border around the Tag Barcode Reader tile (transparent, borderless).
- Double the QR code size within that tile (100% increase), keeping the layout in line with the logo row.

## Technical notes
Files touched: `src/components/qr/product-qr-panel.tsx`, `src/components/products/product-detail-view.tsx`, `src/lib/qr.functions.ts`, `src/components/products/product-form-dialog.tsx`, `src/lib/format.ts` (rand formatting helper), price-rendering components, and `src/components/qr/tag-reader-tile.tsx`. No schema change.
