## Why the tracker is stuck

Looked at the actual product `c27beabc…` in the DB:

- `image_status = pending`, `image_url` empty → the image resolver never ran on this product (its QR was generated before the resolver existed, and nothing back-fills it now).
- `passport_status = published`, `enrichment_status = pending` → the passport IS published, but the tracker still shows it unticked because **`getProduct` doesn't return the passport row** to the client — so the progress card gets `passport = null` and can't tick that step, and enrichment sits pending because nothing kicks off the background tick.

Result: 2/5 stuck, exactly as in the screenshot.

## Fix

1. **Return the passport from `getProduct`** (`src/lib/products.functions.ts`) — add a `product_passports` select (status, enrichment_status, dpp_id) and expose it as `passport` on the response. This alone unticks "Digital passport published".

2. **Auto-heal the image on product open** (`src/lib/products.functions.ts` in `getProduct`, or a lightweight `ensureProductImage` server fn called from the detail route): when `image_status` is `pending` or null, fire-and-await `resolveAndSyncProductImage` before returning. First open of any pre-existing product resolves an image (official → placeholder fallback) and marks the step done.

3. **Broaden "image done" states** (`src/components/qr/digital-identity-progress.tsx`): include `retailer` and `official` in the done set — right now only `ready | ai_suggested | placeholder` count, so an officially-resolved image would still read as not done.

4. **Kick enrichment from the product page** — add an "Enrich now" action on `ImageStatusCard` (or the identity card) that calls a new `runPassportEnrichment` server fn wrapping the existing enrichment routine for this single product, and re-queues on open if `enrichment_status = pending` and older than N minutes. This turns the spinner into a check without waiting for the cron tick.

5. **Invalidate queries after refresh/reset** already happens; after step 1 the passport data flows through the same `["product", productId]` key so the tracker updates instantly.

### Files touched
- `src/lib/products.functions.ts` — extend `getProduct` (passport join + auto image heal).
- `src/lib/passport.functions.ts` — add `runPassportEnrichment({ productId })` server fn.
- `src/components/qr/digital-identity-progress.tsx` — accept broader image_status done set.
- `src/components/products/image-status-card.tsx` — add "Enrich passport" button wired to the new fn.
- `src/routes/_authenticated/products.$productId.tsx` — pass `passport` through (already reads `data.passport`, no change needed after step 1).

No schema changes, no new tables.
