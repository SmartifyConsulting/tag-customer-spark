## 1. AI model upgrades

- **`src/lib/passport.server.ts`** — swap `google/gemini-3-flash-preview` → `openai/gpt-5.5` for `callEnrichmentAI` (schema-driven DPP generation). Enable strict structured output on the provider so `generateObject` sends `json_schema`.
- **`src/lib/ai-gateway.server.ts`** — add optional `{ structuredOutputs?: boolean }` param to `createLovableAiGatewayProvider` / `getGatewayFromEnv` so passport enrichment gets strict mode without affecting other callers.
- **`src/lib/normalisation.functions.ts`** — swap `google/gemini-3-flash-preview` → `openai/gpt-5.4-mini` for the normalisation call (cheaper, high-volume, still strong).
- Update `enrichment_model` string written to `product_passports` accordingly.

## 2. Google Custom Search — auto-populate product images

Trigger points: **product create** (`products.functions.ts` create paths) and **CSV/bulk import** (`import.functions.ts`, `customer-import.functions.ts` product-side, plus `barcode-assign.functions.ts` queue). Runs only when `products.image_url` is empty.

### Credentials
Request via `add_secret` after plan approval:
- `GOOGLE_CSE_API_KEY` — from Google Cloud Console (enable Custom Search API)
- `GOOGLE_CSE_ID` — from programmablesearchengine.google.com, configured with "Search the entire web" + "Image search" enabled

### New server-only helper `src/lib/product-image-search.server.ts`
- `searchProductImage({ name, brand, gtin }): Promise<{ url, source, thumbnail } | null>`
- Query construction: prefer `"<gtin>"` if present, else `"<brand> <name>"`.
- Calls `https://www.googleapis.com/customsearch/v1?searchType=image&num=3&safe=active&imgSize=large&key=...&cx=...&q=...`
- Picks first result with valid https URL and a whitelisted MIME (jpg/png/webp).
- Downloads bytes server-side, validates content-type + size (<5MB), uploads to a new **private** Storage bucket `product-images` at path `{retailer_id}/{product_id}.{ext}`, returns the signed/public URL and source metadata.
- Returns `null` on any failure (rate limit, no result, download fail) — never throws.

### New Storage bucket
- `supabase--storage_create_bucket` `product-images`, public=true (so the DPP page and product table render directly). RLS on `storage.objects`: public SELECT for bucket, INSERT/UPDATE/DELETE only for `authenticated` scoped by first path segment = user's retailer_id.

### DB changes (single migration)
- Add columns to `products`: `image_source text` (`google_cse` | `manual` | `openfoodfacts` | null), `image_fetched_at timestamptz`, `image_search_status text` (`pending` | `found` | `not_found` | `skipped`).
- Backfill: set `image_search_status = 'skipped'` where `image_url is not null`.

### Wiring
- **`products.functions.ts` `createProduct` / `updateProduct`**: after insert, if `image_url` is null and name present, enqueue image search inline (awaited but bounded — 3s timeout via `Promise.race`). Persist result to `products.image_url`, `image_source`, `image_fetched_at`, `image_search_status`.
- **`import.functions.ts` bulk import**: after each row insert without image, call helper with same bounded timeout. On timeout or `null`, mark `image_search_status = 'not_found'` so a later batch job can retry.
- **New server fn `backfillProductImages`** in `src/lib/product-image-search.functions.ts` — batch (limit 25) processes rows where `image_url is null AND image_search_status != 'skipped'`. Guarded by `requireSupabaseAuth` + retailer scoping.
- **UI**: add "Fetch missing images" button next to existing "Generate barcodes" on `src/routes/_authenticated/products.index.tsx` (canManage-gated). Show toast with `{ processed, found, not_found }`.

### Rate-limit / cost safety
- Google CSE free tier = 100 queries/day. Helper checks a per-retailer daily counter (reuse `notification_usage_counters` pattern OR a lightweight in-memory guard with DB fallback — decision below).
- Add `google_cse_daily_count` + `google_cse_date` columns to `retailers` table; helper increments and refuses when >= 90 (leaves headroom); UI surfaces "Daily image search quota reached".

## 3. What I will NOT change
- The Open Food Facts lookup in passport enrichment (still used for structured nutrition/ingredients data).
- Existing normalisation heuristic fallback.
- Any other findings, RLS, or unrelated files.

## Files touched
- `src/lib/ai-gateway.server.ts` (add structuredOutputs flag)
- `src/lib/passport.server.ts` (model + provider)
- `src/lib/normalisation.functions.ts` (model)
- `src/lib/product-image-search.server.ts` (new)
- `src/lib/product-image-search.functions.ts` (new)
- `src/lib/products.functions.ts` (wire on create/update)
- `src/lib/import.functions.ts` (wire on bulk import)
- `src/routes/_authenticated/products.index.tsx` (toolbar button)
- One migration (columns + retailer counter + storage bucket RLS)
- Two secrets requested: `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID`

## Verification
- After approval + secrets: create a test product ("Nike Pegasus 40"), confirm image auto-fills within ~2s.
- Run backfill on existing Cape Union Mart inventory (should hit ~90/day cap gracefully).
- Trigger passport enrichment on one product, confirm `enrichment_model = 'openai/gpt-5.5'` and structured DPP fields populate.
