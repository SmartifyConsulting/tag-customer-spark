# Remove Receipts / Ownership / Sustainability, drop shopper sign-up, fix scan + import

Two pieces of work: switch off the whole Purchase + Ownership area and the Sustainability dashboard (code removed, database left untouched), and fix the scan flow so the Follow Me screen stays on screen.

## 1. Switch off Purchase, Ownership and Sustainability

Removed from the app entirely (database tables stay in place for the future separate app):

- Purchase screens: receipts, purchase search, purchase index/layout
- Ownership screens: purchases, purchase detail, returns, my products, product detail, household, warranties, documents, outlets, TAG ID, ownership index/layout
- Sustainability dashboard and its config dialog / live impact banner
- Supporting components: receipt KPIs, record-purchase dialog, ownership export (PDF), lifecycle alerts, client ownership tabs, shopper tag button, receipts-disabled card
- Supporting libraries: ownership functions/servers, sustainability functions/server/client helpers, receipts feature-flag hook

Navigation and related surfaces:

- Sidebar: the whole "Purchase" section goes; "Scanner" moves up into the remaining nav so it stays reachable. "Sustainability" is removed from the Analytics sub-menu.
- Mobile bottom nav: Receipts, Impact and Outlets entries removed for both staff and shoppers; shoppers keep My Tag and Scanner, staff keep Dashboard, Products, Customers.
- Any customer-detail or product-detail panel that embeds ownership/receipt tabs loses that panel.
- The System Administration "Receipts" global toggle card is removed along with its settings functions, since the feature no longer exists.
- Sustainability is dropped from the tier/feature list and from the pricing/upgrade feature copy.

Anyone hitting an old URL (e.g. `/ownership/purchases`, `/analytics/sustainability`) gets the normal not-found page — no redirects are added.

## 2. Fix the Follow Me screen disappearing after a scan

What happens today: on scan, the reader waits 400 ms and then sets `window.location.href` to the product passport page, which is where Follow Me lives. On the public `/tools/barcode-reader` page the detection callback has no "first code wins" guard (unlike the in-app scanner), so a second decode from the same camera frame stream can overwrite the detected code and fire a second navigation. That produces exactly the reported symptom: the product page appears for a split second and is then replaced by another screen.

Note: this cause is consistent with the code but not yet reproduced on a device, so the fix starts with hardening plus a check.

Changes:

- Public barcode reader: add a "first detection wins" ref guard, stop the camera stream immediately on detection, and guard the redirect so it can only ever run once.
- Same one-shot navigation guard applied to the in-app scanner redirect for consistency.
- Once landed on the product page, nothing else navigates — verified by walking the passport route for any remaining redirect on load.

Verification: drive the reader page in a headless browser against a milk-style GTIN, confirm a single navigation to the passport page and that the Follow Me form remains visible and submittable.

## 3. Remove the "I'm a shopper" registration option

The sign-up card currently offers a retailer/shopper toggle. The shopper side goes:

- The account-type toggle and the shopper-only WhatsApp field are removed; sign-up is retailer-only, with company details always shown.
- Sign-in is unchanged, and existing shopper accounts keep working — they just can't be created from the site anymore.

## 4. Import: stuck progress bar, speed, and a time estimate

What happens today: the import dialog sends products to the server in blocks of 25 and waits for each block. A 34-row file is two blocks, so the bar sits at "25 / 34" while the second block runs. Each block also does extra per-import work (taxonomy detection, brand linking, store creation), and after the import phase the dialog runs barcode assignment and QR generation in blocks of 10 — all before it reports success. If any one of those calls stalls or times out, the bar freezes even though the rows were already written, which is exactly why all 34 products were there after restarting the app.

Changes:

- Smaller blocks (10 rows) so the bar moves roughly three times more often, and the label shows rows written rather than rows submitted.
- Per-block timeout with automatic retry (up to two attempts), and on final failure the dialog reports which rows are affected instead of hanging silently.
- Refresh the inventory list after every block, so products appear in the app while the import is still running.
- Move the one-off heavy work — taxonomy detection and brand linking — out of every block and run it once at the end of the import phase.
- QR generation and barcode assignment become an optional background phase: the dialog reports the import as complete and lets the user close it, with tagging continuing and reportable from the inventory screen.
- Reduce per-row database round-trips in the commit path (batch the existence lookups instead of one query per row) to cut the largest share of the wall-clock time.

Time estimate on the bar: after the first block completes we know the real per-row time for this file and this connection, so the dialog shows a live "about N seconds remaining", recalculated after each block from a rolling average and displayed alongside the percentage. Before the first block completes it shows "estimating…" rather than a guessed number.

## Technical notes

- Route files under `src/routes/_authenticated/ownership.*`, `purchase.*` and `analytics.sustainability.tsx` are deleted; `src/routeTree.gen.ts` regenerates automatically.
- `src/components/ownership/*`, `src/components/sustainability/*`, `src/lib/ownership*.ts`, `src/lib/sustainability*.ts`, `src/lib/system-settings.functions.ts` and `src/hooks/use-receipts-enabled.ts` are removed, with every importer updated so the build stays clean.
- No migration is run; `purchases`, `receipts`, `owned_products`, `warranties`, `household_rooms`, `consumer_tag_ids`, `sustainability_settings` and `system_settings` remain in the database.
- Scanner fix touches `src/routes/tools.barcode-reader.tsx`, `src/routes/_authenticated/tagged.tsx` and, if needed, `src/hooks/use-barcode-scanner.ts` only.
- Shopper sign-up removal is confined to `src/components/create-account-card.tsx` (and the signup server fn's now-unused customer branch left intact).
- Import work touches `src/components/products/import-products-dialog.tsx` (chunking, retry, ETA, background tagging) and `src/lib/import.functions.ts` (batched lookups, end-of-run taxonomy/brand pass).
