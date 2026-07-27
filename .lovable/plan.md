## What I found

**1. Barcode 6004201004816 is not stored as a barcode.** The product "Baby Blue Jumper" (the item you scanned) has:
- `sku` = `6004201004816` (the barcode you typed/scanned)
- `gtin` = `2005679202692` (an auto-generated placeholder)

The Add/Edit Product dialog has **no GTIN field at all** — the scan button writes the scanned code into **SKU**, and the system later auto-assigns a made-up GTIN. So scanning the real barcode can never find the product.

**2. The resolver really is still on the old domain.** Three currently-active QR records still carry `https://www.mypenguin.co.za/passport/...` (Coca-Cola, Nivea, Baby Blue Jumper). Newer ones correctly use `tag-tech.co.za`, so the old rows were written before the default changed and the earlier backfill missed them.

**3. Price fields** use `type="number"`, which is what renders the up/down stepper arrows.

## Plan

### A. Barcode / GTIN becomes a first-class, user-owned field
- Add a **"Barcode (GTIN)"** input to the product form, next to SKU, with checksum validation (EAN-8/12/13/14) and a friendly inline error.
- Move the **Scan** button onto that field: a scan fills the GTIN, and only fills SKU if SKU is still empty.
- Mark manually entered GTINs as authoritative: the auto-assign routine will skip any product that already has a GTIN, so it can never be overwritten again.
- Changing the GTIN on a saved product retires the old QR asset and regenerates a new one (with the store identity) so the printed code and the database stay in sync.

### B. Repair the affected data
- Set Baby Blue Jumper's GTIN to `6004201004816` (valid EAN-13) and regenerate its QR/Digital Link against `tag-tech.co.za`.

### C. Kill the old domain for good
- Rewrite every remaining `mypenguin.co.za` value in `product_qr_assets` (`resolver_url`, `digital_link_url`) and `products.digital_link_url` to `tag-tech.co.za`.
- Harden the URL builder so that even if the deployment's site-URL setting still points at the old host, any `mypenguin.co.za` value is rejected and `https://tag-tech.co.za` is used instead. Same guard applied to the short-code redirect path.

### D. Scan lookup robustness
- Make the passport/reader lookup match on the barcode regardless of leading-zero padding (13- vs 14-digit forms), and fall back to matching the SKU when no GTIN matches — so a borrowed barcode typed into SKU still resolves during testing.

### E. Pricing inputs
- Replace the stepper-style number inputs for **Price (R)** and **Sale price (R)** with plain decimal text inputs (numeric keypad on mobile, same rand→cents conversion). No arrows; the value can simply be overwritten.
- Leave Quantity / Low-stock threshold as-is unless you want those changed too.

### F. Reduce badge noise in the inventory list
- **Tagged status:** show a badge only when a product is **Tagged**. Untagged products show nothing at all (blank cell) instead of an "Untagged" chip.
- **Active status:** stop rendering the "Active" badge — active is the norm. Only non-active states (Draft / Archived) show a badge.
- **Default filter:** the inventory list defaults to **Active products only**. The status filter keeps options for Draft / Archived / All so inactive items can still be found deliberately.
- Applies to both the grid and list views, and to any product count shown alongside them.

### Technical notes
- Files: `src/components/products/product-form-dialog.tsx`, the inventory list/grid components under `src/components/products/`, `src/lib/products.functions.ts`, `src/lib/barcode-assign.functions.ts`, `src/lib/qr.functions.ts`, `src/lib/passport.server.ts`, `src/routes/passport.$gtin.tsx`, `src/routes/api/public/s.$shortCode.ts`.
- One database migration for the domain backfill and the Baby Blue Jumper GTIN correction.
