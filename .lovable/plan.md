## 1. "This tag isn't active" on valid QR scans

**Cause:** `/scan/$shortCode` calls `getPublicScan`, which queries the `public_scan_view` using the **publishable (anon) key**. The view is invoker-rights and anon has:
- no `GRANT SELECT` on `public_scan_view`
- no anon RLS policy on `products`, `retailers`, or `stores`

So the query returns `null` for every scan → route throws `notFound()` → the "This tag isn't active" screen appears even though the tag *and* product are active. No amount of regenerating the QR fixes it. (Confirmed against DB: all recent tags have `tag_active=true` and `product_status='active'`.)

**Fix:** switch `getPublicScan` in `src/lib/scan.functions.ts` to use `supabaseAdmin` (loaded inside the handler) instead of the publishable client. This mirrors what `/api/public/s/$shortCode` already does, keeps the read fully server-side, and doesn't require broadening any RLS. No schema change.

### Files
- `src/lib/scan.functions.ts` — replace `serverPublicClient()` with `const { supabaseAdmin } = await import("@/integrations/supabase/client.server");` inside the handler; drop the unused createClient import.

## 2. Products table — drop the Category column, rename Stock → Status

The recurring "Accessories" text in the Items & Tags table is the **Category** column value. Per the request, remove that column entirely and re-label the stock pill column as **Status** (keeping the existing `<StockPill>` which already renders "In stock / Low / Out" pills).

### Files
- `src/components/products/products-table.tsx`
  - Remove the `<TableHead>Category</TableHead>` header cell.
  - Remove the corresponding `<TableCell>{r.category?.name ?? "—"}</TableCell>` row cell.
  - Change the `Stock` header text to `Status`.

No changes to filters/toolbar (category filter still works via the sidebar) and no data-layer changes.

## Out of scope
No changes to QR generation, RLS policies, or the Category admin surface added earlier.
