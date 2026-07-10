# Plan

## 1. Rebuild QR generation (GS1, GTIN-anchored, single-source)

Replace the current two-parallel-systems mess (`qr_tags` short codes vs `product_qr_assets`) with a single canonical **`product_qr_assets`** record per GTIN, driven by a rebuilt "Generate QR" action.

### Server: `generateProductQr` (in `src/lib/qr.functions.ts`, replaces `regenerateProductQr` semantics)

Steps performed inside the handler:

1. **Load product** (`id, name, sku, gtin, barcode_type, retailer_id`) via `requireSupabaseAuth` + role check.
2. **Validate barcode**: `gtin` present, digits only, length ∈ {8,12,13,14}, valid GS1 check digit. On failure → throw a typed error the UI shows as toast; no QR row created.
3. **Duplicate guard**: `select … from product_qr_assets where gtin = product.gtin and status = 'active'`. If one exists AND belongs to this product → return it (idempotent). If it exists on a different product → throw `"GTIN already has an active QR on another product"`.
4. **Build GS1 Digital Link** using existing `resolverUrlForGtin(gtin)` → `https://<host>/01/<gtin14>`. Never mint random codes.
5. **Render artifacts** with `qrcode`: PNG (800px, ECC Q, brand navy) and SVG. Upload to existing `qr-artifacts` bucket at `${retailer}/${productId}/${gtin}.{png,svg}` (upsert).
6. **Persist** in `product_qr_assets` (add columns via migration below): `product_id, retailer_id, gtin, digital_link_url, resolver_url, png_path, svg_path, status='active', generated_at=now(), generated_by=userId, version` (increment on regenerate).
7. **Link on product**: set `products.digital_link_url` and `products.qr_status='active'`.
8. **Enqueue passport enrichment** (existing `passport_enrichment_queue`) — unchanged.
9. Return the fresh QR row + public URLs for immediate UI hydration.

**Regenerate** = same fn with `{ force: true }`: marks current active row `status='retired'`, bumps version, writes a new active row against the same GTIN (still one active per GTIN).

### Migration
- `product_qr_assets`: add `status text default 'active' check (status in ('active','retired'))`, `generated_at timestamptz default now()`, `generated_by uuid`, `version int default 1`. Partial unique index `(gtin) where status='active'` to enforce **one active QR per GTIN**.
- `products`: add `qr_status text` (nullable; mirrors active asset), `on_promotion boolean not null default false`, `promotion_label text`.
- Keep `qr_tags` table intact for existing scan history but stop writing to it from the generation flow. Update `products.functions.ts::getProduct` to return the active `product_qr_assets` row (not `qr_tags`) as `qr`.

### UI: `ProductQrPanel` rebuild (`src/components/qr/product-qr-panel.tsx`)

Replace current panel with a permanent **QR Status card** on the product detail page (always visible, not tucked in a tab — hoist onto the detail page shell).

Two states:

**No active QR:**
- Empty state with big "Generate QR" button. On click → mutation runs `generateProductQr`; on success `queryClient.setQueryData(["product", id], …)` for instant swap (no page refresh) + toast **"GS1 QR Code successfully generated."**. On validation error toast the message and stay empty.

**Active QR present:**
- QR preview (rendered from stored SVG via public URL)
- Status pill (green "Active"), generated date, version, GTIN
- Buttons: **Download PNG**, **Download SVG**, **Print QR**, **Open Digital Passport** (→ `/p/{dppId}` in new tab), **Regenerate** (confirm dialog, calls `force:true`)
- Info line: *"This product already has an active QR Code."*

Also update `HeroQrColumn` on the product detail page to render the active QR from `product_qr_assets` instead of `qr_tags`, and remove the duplicate mini-generate UI in favour of a single scroll link to the QR Status card.

### Cleanup
- Remove the "QR code" tab from the tabs list (card is now permanent above).
- Remove `regenerateProductQr` old codepath; keep export name aliased for other callers (`bulk-qr-dialog`, PDF renderer) but point at the new fn.
- Update `commitProductImport` (bulk import) to call the same `generateProductQr` per row so imports and single-click generation stay consistent.

## 2. "On promotion" flag in Inventory

- Migration above adds `products.on_promotion` + `products.promotion_label`.
- `products.schemas.ts` + `product-form-dialog.tsx`: add a checkbox "On promotion" and optional label input.
- `products-table.tsx`: new column **Promo** rendering a crimson red star (`lucide-react` `Star` filled, `text-red-600 fill-red-600`) when `on_promotion=true`; tooltip shows `promotion_label`.
- `products-toolbar.tsx`: existing "promo" filter already wired — point it at the new boolean column instead of `sale_price_cents`.
- Product detail hero: small crimson star badge next to the product name when on promotion.

## 3. Global WhatsApp broadcast (carried over from prior plan)

Unchanged from the previous plan: add "New broadcast" on `/whatsapps` that sends to customers with `marketing_consent_at IS NOT NULL` and a valid `whatsapp_e164`, using existing WhatsApp send pipeline, backed by a new `broadcast_campaigns` table and a `sendMarketingBroadcast` server fn with role + quota checks.

## Notes
- No new short-code system; the GS1 Digital Link resolver `/01/{gtin}` and DPP page `/p/{dppId}` remain the scan targets.
- Idempotency is enforced at DB level (partial unique index), not just in code.
- All UI updates happen via React Query cache mutation → no page refresh.
