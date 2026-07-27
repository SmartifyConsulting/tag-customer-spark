## Note on the attached infographic

The image referenced ("attached info graphic elements") didn't come through — nothing was attached. I've planned the Briefing redesign against the current layout and the elements we already discussed; re-attach the graphic and I'll match it exactly during implementation.

## 1. Briefing page redesign

Restructure `src/routes/_authenticated/briefing.tsx` into a clean infographic-style grid instead of the current stacked rows:

```text
+------------------------------------------------------+
| [Tag Barcode Reader card]        Hello {Store} / logo |
+----------------+----------------+--------------------+
| Scans today    | Tagged today   | Unread WhatsApps   |
+----------------+----------------+--------------------+
| Scan activity heatmap (wide)    | Top intent list     |
+----------------------------------+--------------------+
| Tagged products (accordion: Today / Yesterday /       |
| This week / This month — grouped by product + count)  |
+------------------------------------------------------+
| Unread WhatsApps needing a reply                      |
+------------------------------------------------------+
```

- Equal-height cards, consistent padding, one card style throughout.
- KPI tiles compact in a 3-up row; charts full width beneath.
- Accordions collapsed by default.

## 2. Tag Barcode Reader frame on the Dashboard

Add a compact Tag Barcode Reader tile to the top of the Briefing/Dashboard, **left-aligned on the same row as the logo/greeting**:
- Small card showing the reader QR code plus a "Open reader" action (opens `/tools/barcode-reader`) and "Print shelf card" (opens the existing fold-out card dialog).
- Reuses the QR generation already in `tag-reader-card-dialog.tsx`, extracted into a small shared component so Settings and the Dashboard stay in sync.

## 3. Digital Identity Build — Store Identity Assigned step

Add a new checklist step to `src/components/qr/digital-identity-progress.tsx`: **"Store identity assigned"**, satisfied when the product's QR asset has a `store_id` / `store_name` attached.
- The build/bulk-complete pipeline (`src/lib/qr.functions.ts`, `src/lib/products.functions.ts`) sets the store on the QR asset from the selected store, falling back to the product's home store, and to the retailer's only store for sole proprietors.
- The step shows as incomplete (with a "Select store" prompt in the QR panel) when no store can be resolved, so scans always attribute to a branch and the opt-in phone capture is traceable.

## 4. GS1 Digital Link placement

In the product detail QR/Passport card (`src/components/qr/product-qr-panel.tsx`), move the GS1 Digital Link URL / GTIN block **below** the QR image as its own full-width row so it's no longer hidden behind the Digital Product ID frame. Long URLs wrap, with a copy button.

## 5. Teal Jumper doesn't resolve when scanned

Confirmed from the database: the stored GTIN is `2003584268734` — an auto-generated internal `200`-prefix barcode, not the real barcode you borrowed. The physically scanned code has no matching row, so lookup fails.

Fix:
- A user-entered GTIN becomes authoritative and is never re-derived or overwritten by the auto-assign / digital-identity build path.
- After a GTIN change, regenerate the Digital Link URL and QR asset so `/passport/{gtin}` matches the scanned code.
- Show a clear "no product found for {digits}" message on the passport page instead of a bare not-found.

You'll then re-enter the borrowed barcode on Teal Jumper and it will resolve.

## 6. Preview the TAG Reader in Lovable

Besides the dashboard tile, add a live phone-framed preview of `/tools/barcode-reader` inside the shelf-card dialog. Camera access needs a real device permission grant; in the Lovable preview the frame shows the reader UI with a "camera unavailable" state, which is expected.

## Technical notes

Files touched: `src/routes/_authenticated/briefing.tsx`, `src/components/qr/digital-identity-progress.tsx`, `src/components/qr/product-qr-panel.tsx`, `src/lib/qr.functions.ts`, `src/lib/products.functions.ts`, `src/components/products/product-form-dialog.tsx`, `src/components/settings/tag-reader-card-dialog.tsx`, `src/routes/_authenticated/settings.tsx`, plus a new shared reader-QR component. No database migration required.
