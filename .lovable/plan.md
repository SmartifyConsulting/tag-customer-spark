
## Problem

Today:
- QR encodes `/api/public/01/{gtin}` (API endpoint) — spec wants public page directly.
- Public page is `/p/{dppId}` (UUID) — spec wants `/products/{gtin}`.
- Passport rows are only created by the async tick, so "No passport found" appears between import and enrichment.
- Passport page does not log a scan or create an intent event.
- No Digital Identity Card, no progress tracker, no auto-heal.
- **Product images are inconsistent**: some rows have `image_url`, most don't; there is no priority, no placeholder, no validation, no multi-size derivatives. Passport, QR landing page, and lists can render broken/empty images.

## Solution — 7 workstreams

### 1. Schema — single migration

- `product_passports`: `status text NOT NULL DEFAULT 'published'`, `visibility text NOT NULL DEFAULT 'public'`, `keywords text[]`, `translations jsonb`, `seo_meta jsonb`, `storage_instructions text`, `preparation_instructions text`, `recycling jsonb`, `ai_confidence numeric`, `hero_image text`, `thumbnail text`, `image_gallery jsonb DEFAULT '[]'`.
- `products`: add `thumbnail_url text`, `hero_image text`, `image_status text` (one of `official`, `retailer`, `ai_suggested`, `placeholder`, `pending`), `image_source text` (e.g. `openfoodfacts`, `manufacturer_domain`, `retailer_upload`, `ai_gateway`, `placeholder`), `image_updated_at timestamptz`, `image_gallery jsonb DEFAULT '[]'` (future-ready: `{ url, role, kind: 'image'|'video'|'3d'|'ar'|'360', variants: {small,medium,large,webp}, source, license }`). Keep `image_url` as primary/original.
- `qr_scans`: `country`, `region`, `city`, `session_id`, `visitor_id`, `browser`, `os`, `utm_source/medium/campaign`. `qr_tag_id` stays nullable.
- Trigger: on product soft-delete → archive `product_qr_assets` + `product_passports`.
- Public `TO anon` SELECT policies scoped to `products.status='active'`, `product_passports.status='published' AND visibility='public'`, `product_qr_assets.status='active'`, with safe columns only.
- New storage folder convention: `products/{retailer_id}/{gtin14}/{original|thumbnail|hero|small|medium|large}.{jpg|webp}` in the existing public `product-images` bucket.

### 2. Public resolver + product page

- New route `src/routes/products.$gtin.tsx` (SSR, public).
  - Loader → new server fn `getPublicProductByGtin({ gtin })`:
    1. Validate GTIN.
    2. Publishable-key server client reads product + passport + active QR (safe columns).
    3. No product row → `{ found: false }` → "Product not found" (only real not-found case).
    4. Product exists but passport missing/failed/pending → upsert **published shell passport** (see §4) so page never says "no passport."
    5. `supabaseAdmin` fire-and-forget insert into `qr_scans` (headers → geo/UA/session/visitor cookie/UTM) + `enqueue_intent_recompute(product_id)`. Wrapped in try/catch.
    6. Return `{ found, product, passport, qr, hero_image }` — always resolves `hero_image` via §6 priority so the page never renders empty.
  - `head()`: title = product name, description = summary, `og:image` = `hero_image`.
- `resolverUrlForGtin` returns `${base}/products/${gtin14}` (no `/api/public/01/...` in QR).
- `src/routes/api/public/01.$gtin.ts`: browser GET → 301 to `/products/{gtin}`; JSON linkset now points `dpp_url` to `/products/{gtin}`.
- `src/routes/p.$dppId.tsx` → thin server-side 301 to `/products/{gtin}` (looks up by `digital_product_passport_id`).

### 3. QR generation always creates a shell passport

Refactor `src/lib/qr.functions.ts::generateForProduct`:
- After inserting `product_qr_assets`, upsert `product_passports` shell: `dpp_id` (existing or `gen_random_uuid()`), `status='published'`, `visibility='public'`, `enrichment_status='pending'`, seeded from product fields; also seeds `hero_image` and `thumbnail` from the image resolution in §6.
- Write `products.digital_product_passport_id` in the same call.
- Enqueue enrichment (existing).

Refactor `src/lib/import.functions.ts::commitProductImport`:
- After each product upsert, call `generateForProduct` directly (single code path: GTIN uniqueness, retire-on-regen, shell passport, enqueue). Invalid GTINs → `errors[]` with `"Invalid Barcode"`; product row still saved so the retailer can fix.
- Return per-row `stage` (`imported | image_resolved | qr_generated | passport_seeded | enrichment_queued`).

### 4. Enrichment enhancements

`passport.server.ts::enrichProductPassport`:
- Extend `passportSchema` with `storage_instructions`, `preparation_instructions`, `recycling`, `seo_meta`, `keywords`, `translations` (start `{en:{...}}`).
- Aggregate `field_confidence` mean → `ai_confidence`.
- Sync image outcome from §6 into passport `hero_image`, `thumbnail`, `image_gallery`.
- Keep `status='published'` on success AND failure (shell is already public; only `enrichment_status` differs).
- pg_cron in the migration: `POST /api/public/hooks/passport-tick?limit=10` every minute, retries failed rows automatically.

### 5. Digital Identity Card + Progress Tracker

- Rebuild `src/components/qr/product-qr-panel.tsx` → `<DigitalIdentityCard />`: QR preview, QR status pill, GTIN/SKU/barcode type, passport status, AI model + confidence bar, enriched-at, scan count, last-scan, intent score, version, actions (PNG/SVG/PDF/Print/Open Product Page/Regenerate/Copy Public URL/Copy Resolver URL).
- `<DigitalIdentityProgress />` steps: **Imported → Barcode Validated → QR Generated → Passport Created → Image Resolved → AI Enriched → Published → Ready to Scan**. Each derived from row state; failed step shows red icon + inline **Retry**.
- Server support: extend `getProductQr` to return everything the card needs (`png_path`, `svg_path`, `pdf_path`, `passport_status`, `ai_confidence`, `enriched_at`, `scan_count`, `last_scanned_at`, `public_url`, `image_status`, `image_source`).

### 6. Image pipeline (new — full auto)

New server module **`src/lib/product-images.server.ts`** with a single entry point `resolveProductImage({ productId })` that returns `{ image_url, thumbnail_url, hero_image, image_gallery, image_status, image_source }` and updates the `products` row. Priority order (mirrors spec):

1. **Retailer uploaded** — anything already at `products/{retailer}/{gtin}/original.*` from an explicit upload. Status = `retailer`, source = `retailer_upload`.
2. **Retailer-supplied URL at import** — if `image_url` was provided by the retailer's file (spreadsheet/PDF), download → validate → derive sizes → store → status = `retailer`, source = `retailer_upload_import`.
3. **Manufacturer/official** — Open Food Facts (`image_url`, `image_ingredients_url`, `image_nutrition_url` already fetched by `passport.server.ts`) with `source_url` on the OFF product page. Status = `official`, source = `openfoodfacts`. Room to add GS1 GDSN / brand-owner APIs later behind the same interface.
4. **AI Suggested** — Lovable AI Gateway `openai/gpt-image-2`, `quality:"low"`, `stream:true`, prompt derived from name+brand+category, size 1024x1024. Non-stream on server (buffered). Status = `ai_suggested`, source = `ai_gateway`. Gated: only run when steps 1–3 return nothing AND the retailer's plan allows AI images (Growth+); otherwise fall to placeholder to avoid runaway credits. Marked as AI-generated in metadata (`license: 'ai-generated'`) so retailers can review.
5. **TAG Placeholder** — no external image. Render a deterministic SVG placeholder server-side (product initials + brand colour hash + category icon + product name), store as `placeholder.svg`. Status = `placeholder`, source = `placeholder`.

Pipeline steps (single helper called from import + QR gen + manual "Refresh Image" + cron):

- **Download / capture** original → temp buffer.
- **Validate** (`sharp` — installed only if not present):
  - Formats: JPEG, PNG, WebP (anything else rejected → next tier).
  - Min resolution 400×400.
  - Max file size 8 MB pre-processing.
  - Reject corrupt (sharp throws → rejected).
- **Derive sizes**: `thumbnail 200×200 webp`, `small 400 webp`, `medium 800 webp`, `large 1600 webp`, `hero 1200×628 jpg` (OG), `original` in original format.
- **Upload** to `product-images` bucket at `products/{retailer_id}/{gtin14}/…` (public bucket, upsert, versioned via query-string cache-buster).
- **Write** `products.image_url` (= original public URL), `thumbnail_url`, `hero_image`, `image_status`, `image_source`, `image_updated_at`, `image_gallery = [{ url, role:'primary', kind:'image', variants:{...}, source, license }]`.
- **Mirror** to `product_passports.hero_image`, `thumbnail`, `image_gallery`.

Server functions exposed to the app:
- `uploadProductImage({ productId, file, replace? })` — auth'd; runs same validate/derive/store pipeline; status = `retailer`; audit `products.image_updated_by`.
- `refreshProductImage({ productId })` — force re-run the resolver.
- `deleteProductImage({ productId })` — clear retailer image; resolver re-runs and may fall back to placeholder.

Called automatically:
- From `commitProductImport` right after product upsert (BEFORE QR gen so the shell passport can seed hero_image).
- From `generateForProduct` if `products.image_url` is still null.
- From `enrichProductPassport` after AI enrichment (in case OFF returned an image we didn't have at import time).
- From cron passport tick (retry `image_status='pending'`).

New UI: **`<ImageStatusCard />`** in `src/components/products/image-status-card.tsx`, mounted on product detail page — shows current image (with source badge: Official / Retailer / AI Suggested / Placeholder), resolution, last updated, uploaded-by, buttons: **Upload New**, **Replace**, **Download**, **View Full Size**, **Regenerate AI Image** (if plan allows), **Reset to Auto**.

All product-list / product-detail / passport / QR landing / dashboard / search / analytics rows switch to a shared `<ProductImage />` component that:
- Uses `thumbnail_url` for lists/cards, `hero_image` for headers, `image_url` for detail zoom.
- Falls back to the SVG placeholder if the URL fails (`onError` swap).
- Never renders an empty container.

**Future-ready** — `image_gallery` is `jsonb` with `kind` discriminator (`image | 360 | video | 3d | ar`), `variants` bag, and `role` (`primary | lifestyle | packaging | thumbnail | gallery`). No schema change needed to add 360°/video/3D/AR — just new pipeline handlers.

### 7. Public product page content (`/products/$gtin`)

Reuse existing passport section layout, add: hero gallery (from `image_gallery`), brand+category chips, summary + marketing description, ingredients/nutrition/allergens, prep + storage + origin + manufacturer, sustainability + recycling + certifications, warranty, consumer FAQs accordion, related products (4 same-category with active QR), promotions (`on_promotion`), share row (WhatsApp deeplink, Save→watchlist, Copy Link), sticky mobile CTA "Notify me on price drop / back in stock".

### Technical Details

**Files**

- New: `src/routes/products.$gtin.tsx`, `src/components/qr/digital-identity-card.tsx`, `src/components/qr/digital-identity-progress.tsx`, `src/components/products/image-status-card.tsx`, `src/components/products/product-image.tsx`, `src/lib/product-images.server.ts`, `src/lib/product-images.functions.ts` (auth'd upload/refresh/delete).
- Rewrite: `src/routes/p.$dppId.tsx` → 301 stub. `src/components/qr/product-qr-panel.tsx` → replaced by Digital Identity Card.
- Edit: `src/lib/qr.functions.ts` (shell passport, extended `getProductQr`, image seed). `src/lib/passport.server.ts` (extended schema, `resolverUrlForGtin`, image sync). `src/lib/import.functions.ts` (delegate + image resolve). `src/routes/api/public/01.$gtin.ts` (redirect target). `src/routes/_authenticated/products.$productId.tsx` (mount cards). Product list/table/search components (swap `<img>` → `<ProductImage />`).
- Deps: `sharp` if not present (Cloudflare Worker-compatible check first; if unavailable in Workers use `@cf-images/webp` or `wasm-vips` — fallback plan is to invoke sharp only in a plain Node context that's already used for server functions during import; validated at build time).
- Migration: schema tweaks above + pg_cron for passport tick + anon SELECT policies + storage bucket already exists (`product-images` public).

**Backwards compatibility**

- Old `/api/public/01/{gtin}` QRs → 301 to `/products/{gtin}`.
- Old `/p/{dppId}` links → 301.
- Existing `product_qr_assets.resolver_url` values untouched (still resolve via 301).
- Existing products with `image_url` get treated as "retailer image" and are re-derived into sizes lazily on first product-detail view (background job) so nothing breaks immediately.

**Explicit non-goals (unless you want them added)**

- Real background removal (Step 5 marks "future" itself).
- 360°/video/3D/AR ingestion pipelines — schema is future-ready; capture UIs are out.
- Human-in-the-loop AI image approval workflow.
- Customer reviews.
