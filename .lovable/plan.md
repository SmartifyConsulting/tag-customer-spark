
## 1. Logo refresh

- Upload the new `Tag` wordmark via `lovable-assets` and write `src/assets/tag-logo-2026b.png.asset.json`.
- Point the three existing consumers at the new asset without changing rendered sizes:
  - `src/components/auth-shell.tsx` (Sign in / Forgot / Reset pages) — keep `h-48`.
  - `src/routes/index.tsx` hero — keep current `h-[144px]`.
  - `src/components/tag-logo.tsx` (sidebar wordmark `h-[230px]` + collapsed icon `h-[106px]`) — swap both `wordmarkAsset` and `iconAsset` references.
- Leave `public/favicon.png` untouched unless the user asks.

## 2. Bulk product import with GS1-compliant QR generation

### New Inventory action
- Wire the existing "Import" button on `src/routes/_authenticated/products.index.tsx` to open a new `ImportProductsDialog`.
- Dialog accepts `.xlsx`, `.xls`, `.csv`, `.pdf` (single file, ≤10 MB).

### File parsing (client → server)
- Small files (<2 MB CSV/XLSX): parse client-side with `xlsx` (already usable via `bun add`) to get raw rows for a preview grid.
- All files: upload to a private Supabase Storage bucket `product-imports/{retailer_id}/{uuid}.{ext}` (new bucket via migration).
- PDFs and messy sheets: server function reads the file and calls Lovable AI (`google/gemini-3-flash-preview`) with a structured-output schema to extract rows regardless of column order/header naming (name, description, brand, category, price, sale price, currency, stock, low-stock threshold, colour, size, barcode, barcode type).

### GTIN validation & preservation
- New util `src/lib/gs1.ts`:
  - Detect barcode type from digit length: EAN-8 (8), UPC-A (12), EAN-13 (13), ITF-14/GTIN-14 (14).
  - Validate GS1 mod-10 check digit; normalise to 14-digit GTIN for storage (left-pad zeros) while keeping the original string as `original_barcode`.
  - Reject invalid check digits with a row-level error surfaced in the preview.

### GS1 Digital Link QR encoding
- QR payload = `https://id.gs1.org/01/{gtin14}` (GS1 Digital Link canonical form; POS scanners with Digital Link support read the GTIN via AI 01).
- Optionally append `/10/{lot}` etc. later — out of scope now.
- Generate PNG (800px), SVG, and single-page PDF using the existing `qrcode` package + `pdf-lib` (server-side) and upload each to `qr-artifacts/{retailer_id}/{product_id}/qr.{png|svg|pdf}` (new public bucket, read-only anon SELECT).

### DB migration
- Extend `products` with: `original_barcode text`, `barcode_type text`, `gtin text` (unique per retailer where not null), `digital_product_passport_id uuid default gen_random_uuid()`.
- New table `product_qr_assets(product_id pk, qr_url text, png_url, svg_url, pdf_url, gs1_payload text, generated_at)`.
- Grants + RLS: retailer-scoped SELECT/INSERT/UPDATE for `authenticated`; storage bucket policies mirror pattern.

### Import pipeline (server fn `importProductCatalog`)
1. Download uploaded file from storage.
2. Parse (xlsx/csv directly, PDF → AI extraction).
3. Normalise columns via AI header-mapping (rows → canonical schema).
4. Validate barcodes; collect per-row errors.
5. Upsert products by `(retailer_id, gtin)` — update if exists, insert otherwise; never mutate a supplied GTIN.
6. For each valid product, generate QR PNG/SVG/PDF, upload, insert `product_qr_assets`.
7. Return summary `{ inserted, updated, skipped, errors[] }`.

### Import preview UI
- Two-step dialog: (1) upload + AI parse spinner, (2) editable preview grid showing detected columns mapped to fields, per-row validation state, and an "Import N valid products" button.
- Show per-row errors inline; allow user to fix header mapping before confirming.

### Product detail integration
- On `products.$productId.tsx`, replace the existing internal QR (short-code redirect) with the GS1 Digital Link QR when `product_qr_assets` exists; expose Download PNG/SVG/PDF and copy-URL buttons. Keep the internal scan-tracking QR available as a secondary "Marketing QR" tab so existing intent/scan telemetry keeps working.

### Inventory list additions
- New columns (hidden by default, toggleable): GTIN, Barcode type.

## Technical notes

- Packages to add: `xlsx` (SheetJS community edition), `pdf-parse` for PDF text extraction fallback (before handing to AI), `pdf-lib` already present.
- All AI + storage + QR generation runs in `createServerFn` handlers under `src/lib/imports.functions.ts` and `src/lib/gs1.server.ts` — never on the client.
- Storage buckets created via migration with proper GRANTs and RLS.
- Lovable AI structured output uses `Output.object({ schema })` so rows come back typed.
- GS1 compliance reference: GS1 Digital Link URI syntax v1.4 (`/01/{gtin}`); the primary identifier is always AI (01) GTIN-14.

## Out of scope for this pass

- Batch/lot/serial (AI 10/21) encoding — can be added later.
- Cross-retailer GTIN deduplication.
- ITF-14 outer-case handling as a separate SKU.
