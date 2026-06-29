
## Products Module + Per-Product QR Codes

Build a complete Products module scoped to the signed-in user's retailer, plus per-product QR generation, printable PDF cards, and scan tracking. Stripe-meets-Notion styling, reusing existing dashboard components.

### 1. Backend (database + storage)

**Storage buckets** (created via storage tool):
- `product-images` — public read, authenticated write. RLS on `storage.objects` restricts insert/update/delete to users who `belongs_to_retailer` for the path prefix `{retailer_id}/{product_id}/...`.
- `retailer-logos` — public read; admin/retail_admin write under `{retailer_id}/...`.

**Schema migration**:
- `products`: add `brand text`, `color text`, `size text`, `images jsonb default '[]'`, `promotion_start_date timestamptz`, `promotion_end_date timestamptz`. Existing fields kept.
- `retailers`: add `logo_url text` if missing.
- `product_status`: ensure `archived` value exists.
- Reuse existing `qr_tags` table; add columns if missing: `template text default 'classic'`, `short_code text unique`, `version int default 1`, `is_active boolean default true`, `regenerated_from uuid references qr_tags(id)`.
- Extend `qr_scans` (or create if absent) with: `qr_tag_id`, `product_id`, `retailer_id`, `store_id`, `scanned_at timestamptz`, `device_type text`, `user_agent text`, `ip_hash text`, `referrer text`, `customer_id` (nullable). Indexes on `(retailer_id, scanned_at desc)`, `(qr_tag_id)`, `(product_id)`.
- Indexes: `products(retailer_id, status)`, `products(retailer_id, name)`, `products(retailer_id, sku)`, `qr_tags(product_id, is_active)`.
- RLS: retailer-scoped via existing helpers. retail_admin / store_manager full CRUD on products + qr_tags; sales_assistant read-only. `qr_scans` insert open to `anon` (scan endpoint is public), select retailer-scoped.

### 2. Server functions

`src/lib/products.functions.ts` (auth required):
- `listProducts({ search, status, categoryId, storeId, promotion, lowStock, sort, page, pageSize })` — paginated rows + total + facet counts.
- `getProduct({ id })` — product + category + store + active qr_tag + analytics summary.
- `getProductFormOptions()` — categories + stores for current retailer.
- `createProduct` / `updateProduct` / `archiveProduct` / `deleteProduct` — Zod-validated.
- `createProductImageUploadUrl({ productId, filename, contentType })` — signed upload URL (admin client loaded inside handler).
- `setProductImages({ id, images })` — persist ordered array.

`src/lib/qr.functions.ts` (auth required):
- `getProductQr({ productId })` — current active tag (short_code, version, scan URL, template).
- `regenerateProductQr({ productId, template? })` — deactivates current tag, inserts new one with new `short_code` + incremented `version`, sets `regenerated_from`.
- `bulkGenerateQrs({ productIds | filter, template })` — generate/regenerate for many products in one call; returns summary.
- `listProductScans({ productId, range, page })` — paginated scan log with date/time, store, device, qr_tag version.

`src/lib/qr-pdf.functions.ts` (auth required):
- `renderQrPdf({ productIds, template, layout })` — server-side PDF using `pdf-lib` (Worker-compatible). Generates A4 pages laid out by template (see §4). Returns `{ url }` to a short-lived signed PDF in a private `qr-exports` bucket, or streams base64.

Public scan endpoint (server route, no auth):
- `src/routes/api/public/s/$shortCode.ts` — `GET`: look up active `qr_tag` by `short_code`, insert `qr_scans` row (parse UA → device_type, hash IP, capture referrer, infer store from tag), then 302 redirect to the customer-facing opt-in page `/scan/$shortCode`. Same prefix bypasses published-site auth; verifies nothing because scans are intentionally public.

### 3. Routes

- `src/routes/_authenticated/products.tsx` — pathless layout wrapper with `<Outlet />`.
- `src/routes/_authenticated/products.index.tsx` — list (`/products`).
- `src/routes/_authenticated/products.$productId.tsx` — detail (`/products/:productId`) with tabs: Overview, QR Code, Scans, Analytics.
- (Customer-facing `/scan/$shortCode` opt-in page is out of scope for this turn — endpoint exists, full opt-in lives with Customers/Notifications modules.)

Create/edit uses a Shadcn Dialog on the list page (faster, in-context) — happy to switch to dedicated routes if preferred.

URL search params (Zod + `fallback`): `search`, `status`, `category`, `store`, `promo`, `lowStock`, `sort`, `page`, `pageSize`.

### 4. UI components

`src/components/products/`:
- `ProductsTable` — thumbnail, name+SKU, brand, category, store, price (strike-through on sale), stock badge (emerald/orange/red), status badge, row actions.
- `ProductsToolbar` — debounced search, status/category/store filters, promo & low-stock toggles, "Add product", "Bulk QR PDF".
- `ProductsPagination` — page size + prev/next.
- `ProductFormDialog` — react-hook-form + Zod. Sections: Basics, Pricing, Inventory, Variants (colour/size), Promotion (date range picker), Images.
- `ProductImageUploader` — signed-URL upload, progress, reorder, primary image.
- `ProductDetailHeader` — gallery + key facts + actions.
- `ProductAnalyticsCards` — scans, unique customers interested, notifications sent, recoveries + 30-day scan area chart + recent activity.

`src/components/qr/`:
- `ProductQrPanel` (Overview tab) — current QR preview, short URL, version, copy/download PNG, Regenerate (confirm dialog), Template picker, "Download printable PDF".
- `QrTemplatePicker` — choose template: **Classic**, **Minimal**, **Bold Promo**, **Compact** (4 templates).
- `BulkQrDialog` — pick products (filter-driven or checkbox selection), template, cards-per-A4 page (1, 2, 4, 8), then download.
- `ScansTable` — date, time, store, device, QR version, short_code; CSV export.
- Loading skeletons + empty states reusing `empty-state.tsx`.

### 5. Printable QR PDF

- Server-side PDF via `pdf-lib` (Worker-compatible). A4 page size, configurable layout (1 / 2 / 4 / 8 cards per page) with crop marks between cards.
- Each card renders: retailer logo (from `retailers.logo_url`), primary product image, product name, QR code (generated with `qrcode` npm package → PNG bytes), short message.
- Default short message: *"Love this item? Scan here to receive WhatsApp updates if the price drops."* — editable per generation via `BulkQrDialog`.
- Templates differ in layout, typography, accent block, and message placement; all share the same data.
- QR payload = `https://<site>/api/public/s/<short_code>` so every scan hits the tracking endpoint.

### 6. Scan tracking

- Every redirect through `/api/public/s/$shortCode` inserts one `qr_scans` row capturing date/time, store (resolved from tag), device (UA parsing), qr_tag id + version.
- Detail page → **Scans** tab shows the log; **Analytics** tab shows scans over time + device breakdown + per-store split.

### 7. Validation & permissions

- Zod schemas in `src/lib/products.schemas.ts` (shared between form resolver and server `inputValidator`).
- Super admin / retail admin / store manager: full CRUD + QR ops. Sales assistant: read-only (action buttons hidden, server fns reject 403).

### Out of scope (this turn)

Customer-facing `/scan/$shortCode` opt-in screen, WhatsApp send pipeline, CSV/bulk product import — separate modules.
