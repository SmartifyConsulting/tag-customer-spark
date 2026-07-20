## What's happening

**"This GTIN already has an active QR code on another of your products"**
Your retailer has two (or more) product rows carrying the same GTIN. QR uniqueness is scoped per (retailer, GTIN), so only one product can hold the active QR — the code refuses to reassign it silently. Root cause is duplicate product rows, not the QR flow itself.

**Why enrichment / product image feel slow**
- **AI enrichment** runs in the background. When a QR is generated, the product is pushed onto `passport_enrichment_queue`. Nothing runs the job until `POST /api/public/hooks/passport-tick` is called (pg_cron or external scheduler drains it in batches of 5, up to 20/tick). If the cron isn't firing (or fires infrequently), items sit in the queue showing "pending" indefinitely.
- **Product image** is resolved inline during QR generation on a best-effort basis (retailer URL → Open Food Facts → Serper Google Images → AI). Each external call has its own network latency and any failure is swallowed so QR generation isn't blocked — that's why the image can stay on "pending" while everything else looks fine.
- **In short**: the delay is scheduler cadence + external API round-trips, not the AI model itself. Explanation only — no AI changes.

## Fix for the GTIN clash — Force merge duplicates

1. **Return structured clash info from `generateForProduct`** (`src/lib/qr.functions.ts`)
   Instead of throwing a plain string, throw an error whose message is a JSON payload the UI can parse: `{ code: "GTIN_CLASH", gtin, otherProductId, otherProductName }`. Look up the other product's name in the same query.

2. **Handle the clash in `ProductQrPanel`** (`src/components/qr/product-qr-panel.tsx`)
   - Parse the error in `onError`. If `code === "GTIN_CLASH"`, open an AlertDialog titled "Duplicate GTIN detected" naming the other product and offering **"Merge duplicates"** as primary (plus Cancel).
   - The dialog opens the existing `MergeProductsSearchDialog` prefilled: current product as survivor (target), clashing product pre-selected as source, search box pre-filled with the shared GTIN.
   - After merge succeeds, auto-retry `generate.mutate(false)` so QR is produced against the surviving row.

3. **Small refactor to `MergeProductsSearchDialog`** to accept optional `initialTargetId`, `initialSourceIds`, and `initialSearch` props (defaults preserve current behaviour).

## Sidebar highlight bug — only one item may appear "active" at a time

The reference screenshot shows **both** "Inventory" (black pill) and "Admin" (pink outline) rendered as active at the same time. That's wrong — exactly one nav item should be highlighted for the current route.

Cause: in `src/lib/nav.ts` the Admin item's `match` array includes `"/admin"`, which also matches `/admin/inventory` because `isNavActive` uses `pathname.startsWith(p + "/")`. So on `/admin/inventory/*` both Inventory (matches `/admin/inventory`) and Admin (matches `/admin`) return active.

Fix in `src/lib/nav.ts`:
- Remove `"/admin"` from Admin's `match` and replace with the specific admin sub-paths that are not also inventory: keep `"/stores"` and add tab-only routes. Since Admin's real destinations are `/admin?tab=…` (same pathname `/admin`), narrow the match to **exactly** `/admin` (no descendants) by adding an `exact?: boolean` flag on `NavItem` and honouring it in `isNavActive`:
  ```
  export function isNavActive(item, pathname) {
    return item.match.some((p) =>
      item.exact ? pathname === p : pathname === p || pathname.startsWith(p + "/"),
    );
  }
  ```
  Mark the Admin nav item `exact: true`. Inventory keeps `startsWith` behaviour so drill-downs stay highlighted.
- Also drop `"/stores"` from Admin's `match` if it doesn't collide with any other top-level item (it doesn't) — keep it, but Admin becomes active only when pathname is exactly `/admin` or exactly `/stores`.

Result: on `/admin/inventory/:id` only Inventory highlights; on `/admin?tab=users` only Admin highlights.

## Technical notes

- Error transport: TanStack server-fn errors serialise `.message` to the client, so JSON-in-message is the simplest reliable channel.
- The existing per-retailer unique index (`product_qr_assets_active_gtin_uidx`) stays as source of truth; merge archives the losing product, freeing the GTIN so the retry succeeds cleanly.
- No database migrations, no changes to AI enrichment or image resolution logic.
- Files touched: `src/lib/qr.functions.ts`, `src/components/qr/product-qr-panel.tsx`, `src/components/settings/merge-products-search-dialog.tsx`, `src/lib/nav.ts`.
