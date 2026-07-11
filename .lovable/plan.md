
## 1. Product image mismatch (CERELAC)

DB check confirms `image_status = ai_suggested` for GTIN `08941100296639` — Open Food Facts had no photo for this SA GTIN, so the resolver fell through to an AI-generated stylised image.

**Fix in `src/lib/product-images.server.ts`:**
- Try Open Food Facts with multiple GTIN normalisations (raw, leading-zero-stripped, EAN-13 from 14, UPC-12).
- If direct GTIN misses, call OFF search API (`/cgi/search.pl?search_terms=<brand+name>&json=1`) and use the top hit's `image_url`.
- Only then fall through to AI image / placeholder.

## 2. "AI enrichment complete" never ticks green

DB shows passport `enrichment_status = enriched` but `DigitalIdentityProgress` checks for `"complete"`. Pure string mismatch.

**Fix in `src/components/qr/digital-identity-progress.tsx`:** treat `enriched | complete | manual` as done, and `queued | running | enriching | pending` as in-progress. Aligns with `PassportTab`.

## 3. Replace logos with new Tag barcode logo

- Upload `user-uploads://TAGLogo-Clear.png` via `lovable-assets` to `src/assets/tag-logo-clear.png.asset.json`.
- Point `src/components/tag-logo.tsx` (both `iconAsset` and `wordmarkAsset`) at the new pointer.
- Point `src/components/auth-shell.tsx` (`heroLogo` import) at the new pointer.
- Replace `public/favicon.ico` with a new `public/favicon.png` copy of the same logo and update `src/routes/__root.tsx` links.

## 4. WhatsApp inbox — selected row text colour

In the inbox list (`src/routes/_authenticated/inbox.tsx` and its row component), when a conversation is selected (orange background), force `text-white` (and muted text `text-white/80`) on the row so text pops. Non-selected rows unchanged.

## 5. Admin: split into Users + Categories tabs, drop from Settings

- New route file `src/routes/_authenticated/admin.users.tsx` rendering existing `UserAdminTab` (super-admin gated like the categories page).
- Convert `src/routes/_authenticated/admin.categories.tsx` and the new `admin.users.tsx` into siblings under a small `admin` layout with a shared `Tabs` header (Categories | Users).
- Update `src/lib/nav.ts` Admin entry to keep landing at `/admin/categories` but ensure both routes highlight the Admin item.
- Remove the Category Admin tab from `src/routes/_authenticated/settings.tsx` (leave User Admin out of Settings too since it now lives under Admin).

## 6. Customers — default status semantics

Today every new customer defaults to `subscribed`. Change so only marketing opt-in = `subscribed`; everyone else is `registered`.

- **Migration:** add `'registered'` value to the `customer_status` enum (or accept it as a text status) and backfill: `UPDATE customers SET status='registered' WHERE marketing_consent_at IS NULL AND status='subscribed'`.
- `src/lib/customers.functions.ts` (`createCustomer`, `customerInputSchema`): default `status` to `registered` unless `marketing_consent` is true → `subscribed`. On `updateCustomer`, when marketing_consent toggles, flip status accordingly.
- Scan-side signup path (`src/routes/api/public/scan.interest.ts` or `src/lib/scan.functions.ts`): create with `registered`, only promote to `subscribed` when the marketing checkbox is ticked.
- UI: add "Registered" as a filter pill / badge variant in `src/routes/_authenticated/customers.tsx` alongside Subscribed/VIP/Dormant.

## 7. Customers table — Last scan date + alignment

Screenshot shows SCANS/INTERESTS/REVENUE headers centered but the values left-aligned.

- In `listCustomers` (`src/lib/customers.functions.ts`), also compute `last_scan_at` per customer from the same `qr_scans` fetch (`MAX(scanned_at)` in JS reduce).
- Customers table (`src/routes/_authenticated/customers.tsx` — or the extracted table component):
  - Add a `Last scan` column (right of Interests) showing `formatDistanceToNow(last_scan_at)` or `—`.
  - Add `text-center` (and `tabular-nums`) to the header **and** cell for `Scans`, `Interests`, and `Revenue`. Right-align isn't asked for; centre both to match the header.

## Out of scope

No changes to enrichment logic, QR, passport schema, or billing.
