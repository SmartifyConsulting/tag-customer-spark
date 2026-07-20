## Answering your questions first

### Is `06001234567899` an international GTIN? Will this keep happening?

No. It's a placeholder/test barcode from demo seed data, not a real GS1-registered GTIN.

- The `600` prefix is the GS1 South Africa country code, so it *looks* legitimate. But the digits `1234567899` are an obvious sequential test string, and 26 completely different products (Samsung TV, Stanley Tool Box, Sunbeam Kettle …) all share it — a real GTIN maps to exactly one product globally.
- Your other clashes (`…567905`, `…567900`, `…567891` etc.) are the same pattern — deterministic demo GTINs I generated in an earlier session because the imported inventory had no GTINs. When multiple products got assigned from the same short pool, they collided.
- **Going forward this will *not* keep happening for real inventory**, because:
  - The Digital Identity flow now looks up real GTINs from the retailer's own source (Cape Union Mart URLs, Open Food Facts, product code fields) before falling back to a generated one.
  - The generator we do fall back to derives from `hashtext(product_id)` (16 hex → 13-digit GS1-valid), so two different products can no longer collide.
  - The Duplicates screen (below) lets you clear the bad GTINs once, and next enrichment run assigns clean unique ones.
- What you're seeing is a one-time cleanup problem, not an ongoing one.

### Scans — dropping the synthetic seed

Removed from the plan. Since you're really scanning Peaceful Sleep, the fact that `qr_scans` has zero rows for it means the scan pipeline itself is broken for that product. New investigation step below replaces the seed.

## Updated plan

### 1. Taxonomy — all templates visible + preview auto-loads
(unchanged from previous plan)

- Auto-seed the 19 sector templates on first render of the Taxonomy Engine tab if the retailer has none.
- Replace the profile dropdown with a **template grid**: each profile as a card, selected one highlighted, ⭐ Default badge on the current default, **Set as default** action promotes it.
- Preview panel always renders once a profile is selected; drop the "publish first" gate in `TaxonomyPreviewTab`.

### 2. Brand logo — no longer requested
(unchanged) — logo optional in `BrandAdminTab`, no "add logo" nag.

### 3. Store attribution baked into the QR code — **new**

Right now `product_qr_assets` has no `store_id`, so a scan can only ever be attributed to the retailer, never to the physical branch — which means when a customer opts in via WhatsApp from the landing page, you can't tell which store they were standing in. Fix:

- **Schema**: add `store_id uuid null` (FK → `stores(id)` on delete set null) and `store_name text null` (denormalised, so an admin renaming a store later doesn't rewrite historic assets) to `product_qr_assets`. Nullable because sole proprietors have no branch.
- **Digital Link URL**: append `?s=<store_id>` (short param) to the resolver URL when the QR is generated for a specific store. The 8-char short-code URL stays the primary target; `?s=…` is passed through the 302 redirect so the resolver route can attribute the scan.
- **Resolver route** (`/api/public/s/$shortCode`): read `?s=` from the query string, look up the store, and insert `store_id` + `store_name` onto the `qr_scans` row. If missing/invalid, fall back to the retailer's only store when there's exactly one — otherwise leave null.
- **Landing-page opt-in**: `scan.$shortCode.tsx` already collects the WhatsApp number via the opt-in button. Extend the resulting `customer_phone_opt_ins` / `customer_interests` inserts to carry `store_id` too, so sales leads route to the correct branch's staff.
- **QR generation UI** (`ProductQrPanel`): when the retailer has multiple stores, add a **Store** selector (with an "All stores / retailer-wide" option). Print one QR per selected store when generating a batch. Single-store retailers get the store auto-attached silently.
- **Duplicates screen** below also lists the current `store_id / store_name` per QR asset so you can see coverage per branch.

### 4. Peaceful Sleep scans not landing — investigate before the release goes out

Instead of seeding fake scans, add these to the same pass:

- Add structured logging to `/api/public/s/$shortCode.ts` on every failure branch (short code not found, insert error, redirect target invalid) so a real scan that doesn't record leaves a trail.
- Verify the printed/displayed QR for Peaceful Sleep points at the current domain (`tag-tech.co.za`), not the previous `mypenguin.co.za` — earlier migrations backfilled the DB, but a QR PNG that was already downloaded/printed still encodes the old URL. If so, retire and reissue.
- Check that the short-code the scanned QR carries actually exists in `qr_tags`. Most likely miss: the product was tagged before short-code storage went in, so the QR embeds a raw Digital Link (`/01/<gtin>`) which now 301-redirects to `/products/<gtin>` — a route that intentionally does **not** log a scan. If that's the cause, patch `/api/public/01/$gtin.ts` to write a `qr_scans` row before redirecting (with `store_id` from `?s=` if present).

Deliverable: one real scan on Peaceful Sleep produces one visible row in the product's Scans tab, no synthetic data anywhere.

### 5. Nav — Inventory under Briefing
(unchanged) — reorder in `src/lib/nav.ts` and `MOBILE_NAV`.

### 6. Duplicates workflow
(unchanged) — new `/admin/inventory/duplicates` screen, two sections:

- **Real duplicates** (same GTIN + same name): bulk merge onto oldest/most-complete survivor, moving scans, QR assets, passports, interests, watchlists.
- **GTIN collisions** (same GTIN, different names): **Clear GTIN on all** or **Keep one, clear the rest**. Cleared products go back to `identity_status='needs_gtin'` so the next enrichment run assigns a fresh, unique GTIN.

Product-detail toast that surfaces `GTIN_CLASH` gets clash-aware wording: "*GTIN 06001234567899 is shared with 25 unrelated products — clear the GTIN or open Duplicates to fix*", with inline **Clear GTIN** and **Open Duplicates** actions.

## Technical notes

- Migration adds `store_id`, `store_name` to `product_qr_assets` and `qr_scans` (backfilling `qr_scans.store_name` from the joined store name where `store_id` is set). Grants and RLS unchanged.
- `product_qr_assets` unique index becomes `(retailer_id, gtin, coalesce(store_id, '00000000-…')) WHERE status='active'` so the same GTIN can have one active QR per branch, matching how you'll print shelf cards.
- Short-code URL grows by ~5 chars (`?s=xxxxxxxx`) — a truncated 8-char store slug rather than the full uuid keeps the QR density unchanged.
- No synthetic data inserted anywhere.
