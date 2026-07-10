## Problem
Right now the image resolver and passport enrichment only run when you open a single product's detail page (auto-heal on `getProduct`) or click "Enrich passport" per product. For a full catalogue this is painful.

## Plan: bulk "Complete digital identity" runner

Add a one-click bulk action on the Inventory screen that walks every product (or the current filtered set / selected rows) through all 5 steps in parallel batches, with a live progress toast.

### 1. New server function `bulkCompleteDigitalIdentity` (`src/lib/products.functions.ts`)
- Input: `{ productIds?: string[]; scope?: "all" | "incomplete" }` (default: `incomplete` — any product missing image, QR, passport, or enrichment).
- Auth: `requireSupabaseAuth`, scoped to caller's retailer via RLS.
- For each product (processed in parallel batches of ~5 to respect rate limits):
  1. If no active QR + valid GTIN → call `generateForProduct` (which already generates QR, publishes shell passport, resolves image, enqueues enrichment).
  2. Else if `image_status` pending/null → call `resolveAndSyncProductImage`.
  3. If passport `enrichment_status` != `complete` → call `enrichProductPassport` inline (don't just enqueue).
- Return `{ processed, succeeded, failed, errors: [{productId, step, message}] }`.
- Skips products without a valid GTIN (report as `skipped_no_gtin`).

### 2. UI: "Complete all" button in Inventory toolbar (`src/components/products/products-toolbar.tsx` + `src/routes/_authenticated/products.index.tsx`)
- Button "Complete digital identity" next to Import.
- On click → confirm dialog showing count of incomplete products → runs `bulkCompleteDigitalIdentity`.
- Streams progress via a simple loading toast ("Processing 12 / 47…") by chunking the call client-side into batches of 10 productIds and updating the toast between batches (avoids one giant long request timing out on the edge worker).
- On finish → invalidate queries; toast summary with success/skip/fail counts.

### 3. Speed up the existing cron drain (optional, small)
`src/routes/api/public/hooks.passport-tick.ts` currently limits to 20. Raise ceiling to 50 and process in `Promise.all` batches of 5 so an admin-triggered tick clears the queue faster.

### 4. Keep the per-product "Enrich passport" button
Still useful for one-offs / re-runs.

## Files to change
- `src/lib/products.functions.ts` — add `bulkCompleteDigitalIdentity`.
- `src/components/products/products-toolbar.tsx` — add button.
- `src/routes/_authenticated/products.index.tsx` — wire client-side batching + toast.
- `src/routes/api/public/hooks.passport-tick.ts` — parallelize + raise limit.

No schema changes.
