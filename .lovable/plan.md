# Two fixes: search detection + inline mini QR

## 1. Products search misses "linendrawstring" / partial words

In `src/lib/products.functions.ts` (`listProducts`) the search sends the raw string as one `ilike` pattern across `name`, `sku`, `brand`:

```ts
q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,brand.ilike.%${s}%`);
```

So typing `linen drawstring` misses a product named `Linen Drawstring Pants` unless the columns contain that exact substring in that exact order, and `linendrawstring` (no space) never matches at all.

**Fix — two layers:**

a. **Tokenize on whitespace.** Split the query into words; require EVERY token to match `name` OR `sku` OR `brand` (AND of ORs). Chain `.or(...)` once per token. This makes `linen drawstring`, `drawstring linen`, and `Linen pants` all match.

b. **Match against a space-stripped index for concatenated queries.** Add a Postgres generated column + trigram index so `linendrawstring` matches `Linen Drawstring Pants`:

```sql
alter table public.products
  add column search_blob text
  generated always as (
    lower(regexp_replace(coalesce(name,'') || ' ' || coalesce(sku,'') || ' ' || coalesce(brand,''), '\s+', '', 'g'))
  ) stored;

create extension if not exists pg_trgm;
create index if not exists products_search_blob_trgm
  on public.products using gin (search_blob gin_trgm_ops);
```

In `listProducts`, when the query has no whitespace, also OR in `search_blob.ilike.%<stripped>%`. This preserves current behaviour and handles the joined-word case without exploding row counts.

No RLS/policy changes; generated column is read-only.

## 2. Mini QR in the product hero (no scrolling)

Currently the QR lives only inside the `<Tabs>` block below the product hero. Add a small floating QR chip inside the top hero frame at `src/routes/_authenticated/products.$productId.tsx` (lines ~121–141).

**Placement & sizing:**
- Absolutely positioned inside the `aspect-square` product-image container, bottom-right, ~12px inset.
- Fixed size ~76×76 px (~2 cm at 96 dpi). White background, 6px padding, `rounded-md`, subtle border, soft shadow so it reads on any photo.
- Renders only when `data.qr?.short_code` exists; otherwise show a tiny "Generate QR" button that jumps to the QR tab.
- Clicking the chip scrolls to the full QR panel (`document.getElementById('product-qr')?.scrollIntoView`) and switches to the QR tab.

**Implementation:**
- New tiny component `MiniProductQr` in `src/components/qr/mini-product-qr.tsx`: reuses the existing `QRCode.toDataURL` path from `qr-preview.tsx` and the canonical scan URL from `getPublicScanBase` + `/api/public/s/<short_code>` so it matches the printable QR exactly.
- Wrap the image container in `relative`; render `<MiniProductQr />` as an overlay when a tag exists.
- Add `id="product-qr"` to the `Tabs` block so the chip can scroll to it.

No changes to the printable QR flow, PDF generation, or scan redirect — this is purely a UI addition on the detail page.

## Technical details
- Files touched:
  - `src/lib/products.functions.ts` — tokenized search + optional `search_blob` OR.
  - `supabase/migrations/<ts>_products_search_blob.sql` — generated column + trigram index + `pg_trgm` extension.
  - `src/routes/_authenticated/products.$productId.tsx` — wrap image in `relative`, mount overlay, add anchor id.
  - `src/components/qr/mini-product-qr.tsx` — new 76px QR chip.
- No schema privilege changes needed (existing SELECT policies already cover `products`).
- No dependency additions; `qrcode` is already used by `qr-preview.tsx`.
