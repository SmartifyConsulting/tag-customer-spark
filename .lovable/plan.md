## What I verified in your data

Baby Blue Jumper (GTIN `6004201004816`):

- Your uploaded `TealJumper.jpg` **is** saved — but only into the `images` list and `image_url`. The fields the detail page and passport actually render (`hero_image`, `thumbnail_url`, `image_gallery`) still hold the Serper-found photo, and `image_status` is still `official`. That's why the picture didn't change.
- Its active QR still points at `https://www.mypenguin.co.za/passport/06004201004816?s=...` — the `PUBLIC_SITE_URL` setting is literally still `https://www.mypenguin.co.za`.
- The opt-in endpoint looks the product up **only** by the 14-digit padded GTIN (`06004201004816`), while the row stores 13 digits (`6004201004816`) — so the phone-number submit returns "Product not found" even though the page itself loaded.

## Fixes

**1. Uploaded image becomes the authoritative image**
- `setProductImages` (src/lib/products.functions.ts) will also write `hero_image`, `thumbnail_url`, `image_gallery`, `image_status: "retailer"`, `image_source: "retailer_upload"`, `image_updated_at`, and mirror hero/thumbnail into `product_passports`.
- Because the resolver already skips rows whose status is `retailer`, a later AI/Serper refresh can no longer overwrite an upload.
- Backfill Baby Blue Jumper so its uploaded photo shows immediately everywhere.

**2. "Product not found" on the WhatsApp opt-in**
- `src/routes/api/public/scan.barcode-interest.ts` will match the GTIN the same way the passport page does: try the 14-digit, 13-digit and unpadded forms, then fall back to SKU. Shared with the passport loader via one helper so the two can't drift again.

**3. Kill the mypenguin URL for good**
- Change the `PUBLIC_SITE_URL` setting to `https://tag-tech.co.za` (the code already refuses mypenguin, but the stale value is why old QRs carry it).
- Rewrite any remaining `mypenguin.co.za` resolver URLs in `product_qr_assets` to `tag-tech.co.za`, keeping the `?s=<store>` attribution intact.

## On the public URL showing "lovable"

Your app is already on the custom domain **tag-tech.co.za**, so consumer QR/passport links will read `https://tag-tech.co.za/passport/...` once step 3 lands — no Lovable domain in anything a shopper sees. The `*.lovable.app` address stays only as an internal fallback.
