# Mini QR in hero + fix scan reliability

## 1. Fix QR not being detected

`src/components/qr/qr-preview.tsx` renders the QR with `margin: 1` and `errorCorrectionLevel: "M"`. The QR spec requires a 4-module quiet zone; margin 1 is why some phone cameras (especially the built-in iOS scanner from a distance) fail to lock on. The navy `#031C4D` on white also drops contrast versus pure black.

**Changes in `qr-preview.tsx`:**
- `margin: 4` (both `toString` and `toDataURL` paths).
- `errorCorrectionLevel: "Q"` — better tolerance for print, camera glare, and small sizes.
- Keep navy for brand, but bump to `#0A1F5C` (slightly darker) for stronger luminance contrast; leave `light: "#ffffff"`.
- Same values used in the PDF render path so printed and on-screen QRs stay identical.

Also mirror the same options in `src/lib/qr-pdf.functions.ts` if it re-encodes.

## 2. Mini QR chip on the product hero

In `src/routes/_authenticated/products.$productId.tsx` (image block, lines ~121–141):
- Wrap the `aspect-square` image container with `relative`.
- Overlay a ~76×76 px (~2 cm @ 96 dpi) QR chip absolutely at bottom-right, inset 10 px. White background, 6 px padding, `rounded-md`, subtle border, soft shadow.
- Renders only when `data.qr?.short_code` exists; otherwise a small "Generate QR" button that switches the tabs to the QR panel.
- Clicking the chip scrolls to the full QR panel (`id="product-qr"` on the `<Tabs>` block) so users can still download/regenerate.

New component `src/components/qr/mini-product-qr.tsx`:
- Fetches `getPublicScanBase` (already used by `ProductQrPanel`) and builds `${base}/api/public/s/${short_code}`, matching the printable QR exactly.
- Uses the shared `QrPreview` at `size={64}` (so the whole chip lands near 76 px including padding).

## Technical details
- Files touched:
  - `src/components/qr/qr-preview.tsx` — margin/EC/colour bump.
  - `src/lib/qr-pdf.functions.ts` — mirror the same encoding options (if present).
  - `src/components/qr/mini-product-qr.tsx` — new overlay chip.
  - `src/routes/_authenticated/products.$productId.tsx` — wrap image `relative`, mount chip, add `id="product-qr"` on `<Tabs>`.
- No schema, RLS, or dependency changes.
- The new encoding options apply to freshly rendered QRs (both hero chip and panel); existing printed labels remain scannable — margin 4 + EC "Q" is strictly more robust.
