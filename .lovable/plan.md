## Additions to the existing plan

### 1. Force auto-categorisation of the 19 stuck "Uncategorised" items

The auto-run in `category-admin-tab.tsx` fires only when uncategorised items exist AND the run hasn't happened this session; several items are stuck because prior AI calls returned no confident match (product names are noisy — e.g. "Stage 1 - CERELAC Wheat with Milk", duplicate "BAKERS BLUE LABEL 200G MARIE BISCUITS CARAMEL").

Fix in `src/lib/categories.functions.ts` + `category-admin-tab.tsx`:
- `suggestCategoryForProduct` now runs on **normalised** product name (see §2) plus brand, and uses a lower confidence floor with a fallback "best guess" instead of leaving `category_id = null`.
- Add `retryUncategorised()` server fn that ignores the "already tried" flag and re-runs the classifier over every product with `category_id IS NULL`.
- Auto-invoke it once per Inventory mount when count > 0 (silent, toast on completion).

### 2. Product Normalisation AI layer (new)

Raw imports produce messy names ("Stage 1 - CERELAC Wheat with Milk", "BAKERS BLUE LABEL 200G MARIE BISCUITS CARAMEL", ALL-CAPS, size/units embedded, brand not extracted). Add a normalisation pass that structures every product before categorisation, image lookup, and display.

New file `src/lib/normalisation.functions.ts` (server fn `normaliseProduct`):
- Input: `{ raw_name, brand?, description?, gtin? }`.
- Model: `google/gemini-3-flash-preview` via existing `ai-gateway.server`.
- Output schema (Zod): `{ display_name, brand, sub_brand?, variant?, size_value?, size_unit?, pack_count?, flavour?, category_hint, keywords[] }`.
- Rules: Title Case display name, brand extracted and separated, size/pack pulled out of the name, no duplicated tokens.

Migration adds to `products`:
- `display_name text`, `normalised_brand text`, `variant text`, `size_value numeric`, `size_unit text`, `pack_count int`, `normalised_at timestamptz`, `normalisation_payload jsonb`.

Pipeline changes:
- `passport-tick` queue drain runs `normaliseProduct` before `suggestCategoryForProduct` and image resolution (better queries → better OFF/AI image hits, fixing the Cerelac-style mismatch too).
- Add "Normalisation" as a new step in `DigitalIdentityProgress` (6 steps total): Barcode → **Normalised** → Categorised → Image → QR → Enriched.
- Inventory row + product detail render `display_name` when present, falling back to raw `name`. Raw name kept for search.
- Toolbar "Complete digital identity" batch also triggers normalisation for anything with `normalised_at IS NULL`.

### 3. Brand layer in Category Admin + Inventory

New `brands` table:
```
id uuid pk, name text unique, slug text unique,
logo_path text, logo_url text,
website text, description text,
created_at, updated_at
```
Plus `products.brand_id uuid references brands(id)` (nullable; keep freeform `brand` string for legacy).

Grants + RLS: `authenticated` SELECT/INSERT/UPDATE, `anon` SELECT (brand logos are public on passport pages), `service_role` ALL.

`src/lib/brands.functions.ts`:
- `listBrands`, `upsertBrand`, `deleteBrand`, `attachBrandToProduct`.
- `resolveBrandLogo(brand_id)`: tries Clearbit Logo API (`https://logo.clearbit.com/{domain}`) when website known, then AI image search prompt via `gemini-3.1-flash-image` producing a clean logo on white, uploads to `brand-logos` bucket, stores `logo_path`/`logo_url`.
- `linkProductsToBrands()`: for every product, fuzzy-match `normalised_brand` → `brands.name`; auto-create brand row if missing then queue logo resolution.

Category imagery:
- Add `image_path text`, `image_url text` to `categories`.
- `resolveCategoryImage(category_id)`: generate stock photography via `gemini-3.1-flash-image` ("clean product-category hero of {category name}, retail catalogue style, label overlay '{name}'") → upload to `category-images` bucket.
- Both buckets created public-read in migration.

Category Admin UI (`src/components/settings/category-admin-tab.tsx` + new sibling `brand-admin-tab.tsx`):
- New third tab in `/admin` route: **Brands** (alongside Categories, Users). Add file `src/routes/_authenticated/admin.brands.tsx`.
- Categories tab: each row shows a small square category image with an "Auto-fetch image" button; inline edit for name/parent/image.
- Brands tab: table with logo thumbnail, name, website, product count; row actions Edit / Fetch logo / Delete. Bulk "Fetch missing logos" button.

Inventory display (`src/components/products/products-table.tsx`):
- Product cell renders: brand logo (24px) · `display_name` · size/variant chip.
- Category cell renders: category image thumbnail (20px) + name.
- Uncategorised header pill keeps count; add a "Brand: All ▾" filter to the toolbar populated from `brands`.

### 4. Files touched

New:
- `src/lib/normalisation.functions.ts`
- `src/lib/brands.functions.ts`
- `src/components/settings/brand-admin-tab.tsx`
- `src/routes/_authenticated/admin.brands.tsx`
- migration: normalisation columns, `brands` table + FK, category image cols, `brand-logos` + `category-images` buckets & policies.

Modified:
- `src/lib/categories.functions.ts` (retry + normalised inputs + image resolver)
- `src/lib/ai-jobs.server.ts` / `passport-tick.ts` (normalise step)
- `src/components/qr/digital-identity-progress.tsx` (6-step tracker)
- `src/components/settings/category-admin-tab.tsx` (silent auto-run, image column)
- `src/components/products/products-table.tsx` + `products-toolbar.tsx` (brand logo, display name, brand filter)
- `src/routes/_authenticated/admin.categories.tsx` (add Brands tab link)

No changes to auth, billing, or tier gating.
