
## Goal

After a product is imported and its GS1-compliant QR is generated, automatically enrich the product with AI, store the result in a **TAG Digital Product Passport (DPP)**, and make the QR resolve to a public DPP page while still exposing the original GTIN to POS scanners.

## 1. GS1 Digital Link (POS + DPP dual-purpose)

Keep the QR payload GS1-compliant so Sunrise 2027 POS scanners can extract AI (01) GTIN, but route human scans to our DPP.

- QR payload stays canonical GS1 Digital Link:
  `https://id.tag.africa/01/{gtin14}`
  (own the resolver domain so we control routing; `id.gs1.org` stays as a documented fallback format.)
- Add a resolver route `src/routes/api/public/01.$gtin.ts`:
  - Validates GTIN-14 + mod-10.
  - Looks up `products.gtin` → DPP id.
  - 302-redirects browsers to `/p/{dpp_id}` (public DPP page).
  - Returns JSON (`{ gtin, dpp_url, product }`) for `Accept: application/json` / linkset requests, matching GS1 Resolver conformance.
- Public DPP page `src/routes/p.$dppId.tsx` — SSR, no auth, rich OG tags, shows enriched content (below).
- Re-generate PNG/SVG/PDF artifacts to embed the new resolver URL; old imports get a one-off backfill.

POS behaviour is unchanged: scanners read the GS1 Digital Link, parse AI (01), get the exact original GTIN.

## 2. Digital Product Passport schema

New table `product_passports` (1:1 with `products`, keyed by `products.digital_product_passport_id`):

- Identity: `gtin`, `brand`, `manufacturer`, `country_of_origin`, `category_path`
- Content: `short_description`, `marketing_description`, `product_summary`, `consumer_faqs jsonb`
- Composition: `ingredients jsonb`, `nutrition jsonb`, `allergens text[]`
- Physical: `dimensions jsonb` (l/w/h/weight/units), `materials jsonb`
- Compliance / lifecycle: `warranty jsonb`, `sustainability jsonb` (recyclability, certifications, carbon)
- Media: `images jsonb` (array of `{url, role, source, license}`)
- Provenance: `sources jsonb` (URLs + confidence), `enriched_at`, `enrichment_status` (`pending|enriched|failed|manual`), `enrichment_model`, `version int`, `last_edited_by`

RLS:
- Retailer-scoped write via existing `belongs_to_retailer`.
- Public `TO anon SELECT` only on a `public.product_passport_public` view that projects safe columns (no cost, no internal notes).

Grants + `updated_at` trigger per project rules.

## 3. Enrichment pipeline

Server function `enrichProductPassport(product_id)` in `src/lib/passport.functions.ts` (+ `passport.server.ts` helpers):

1. Load product + any parsed import row (brand, name, GTIN, category hints).
2. **Lookup pass** (deterministic, cheap, cited): Open Food Facts by GTIN, GS1 GEPIR for brand/manufacturer, existing `lookupBarcode`. Store raw hits in `sources`.
3. **AI pass** using Lovable AI `google/gemini-3-flash-preview` with `generateObject` + Zod schema mirroring the DPP columns. Prompt includes lookup results and instructs the model to:
   - Prefer cited facts over invention.
   - Return `null` + reason for fields it cannot ground.
   - Emit per-field `confidence` (0–1).
4. **Image pass**: reuse lookup images when licensed; otherwise mark `images` empty (do not generate fake product photos by default — flag for manual upload).
5. Upsert into `product_passports`, bump `version`, set `enrichment_status`.
6. Trigger points:
   - End of `commitProductImport` for each new/updated product (fire-and-forget queue row).
   - Manual "Re-enrich" button on product detail.
   - Background sweep server route `api/public/hooks.enrichment-tick` for retries.

Queue table `passport_enrichment_queue(product_id pk, enqueued_at, attempts, last_error)` so imports stay snappy and enrichment runs async.

## 4. UI

- **Product detail** (`products.$productId.tsx`): new "Digital Product Passport" tab
  - Sections for each field group, inline edit (retail_admin+), "Re-enrich with AI" button, per-field confidence + source chips, version history dropdown.
  - QR panel shows the Digital Link URL, DPP URL, and PNG/SVG/PDF downloads (already there — update URL).
- **Import dialog**: after commit, show toast "Imported N products — enriching in background", plus a small progress area in Inventory ("3 of 12 passports ready").
- **Public DPP page** `/p/{dppId}`: brand hero, gallery, description, nutrition/allergens (if food), dimensions, warranty, sustainability, FAQs, "Scanned via TAG" footer with GTIN.

## 5. Migrations & storage

Single migration:
- `product_passports` table + view + grants + RLS + trigger.
- `passport_enrichment_queue` table + grants.
- Extend `product_qr_assets` with `resolver_url text` (new canonical URL).
- Backfill: enqueue every existing product.

No new bucket needed; enriched images (when licensed) go into existing `product-images`.

## 6. Out of scope this pass

- Batch/lot/serial AIs (10/21) in the Digital Link.
- Verifiable Credentials / EU DPP regulation signing (design leaves room via `sources` + `version`).
- Paid image generation for missing product photos.
- Multi-language passports (schema allows `locale` later).

## Technical notes

- All AI + lookups run server-side in `createServerFn` / server routes; `LOVABLE_API_KEY` stays on the server.
- Enrichment is idempotent and versioned; manual edits set `enrichment_status='manual'` and are preserved across re-enrich (AI fills only nulls unless "Overwrite" chosen).
- Resolver route conforms to the GS1 Digital Link Resolver spec (JSON linkset on `Accept: application/linkset+json`) so we can later register with GS1 as a conformant resolver — key for the Sunrise 2027 investor story.
