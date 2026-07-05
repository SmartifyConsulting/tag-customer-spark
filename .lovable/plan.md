## Restore the product info cards

The Category / Store / Stock / Colour / Size / Low-at cards shown in the screenshot are missing from the current product hero. Bring them back inside the middle (details) column of the 3-column layout in `src/routes/_authenticated/products.$productId.tsx`.

### Changes
- In the details column, immediately below the price row, render the `Fact` grid again:
  - `grid gap-3 text-sm grid-cols-2 sm:grid-cols-3`
  - Cards: Category, Store, Stock, Low at, plus Colour and Size when present.
- Keep the existing `Fact` helper (rounded border, muted background, uppercase label, value below).
- Leave the description paragraph and the Edit / Archive / Delete action row directly under the cards, unchanged.
- No changes to the image column or the QR column; the 3-column grid `md:grid-cols-[220px_minmax(0,1fr)_210px]` stays.
- No backend, schema, or styling-token changes.

### File touched
- `src/routes/_authenticated/products.$productId.tsx`
