## 1. Settings screen — spacing + Tag Barcode Reader card

`src/routes/_authenticated/settings.tsx` (Workspace tab):

- Increase the vertical gap between the "Brand" card and the "Danger zone" card (change the wrapper from the current default spacing to `space-y-8` / `mt-8` so the two frames breathe like the reference image).
- Add a new **Tag Barcode Reader** card, positioned top-right of the Workspace tab (two-column grid on `md+`, single column on mobile: left column keeps Brand, right column stacks the new Reader card above empty space). Card contents:
  - Small heading "Tag Barcode Reader" + short description ("Print a shelf card so shoppers can scan any barcode with their phone camera").
  - Live QR preview (reuse `QrPreview` from `src/components/qr/qr-preview.tsx`) encoding the absolute URL of the new reader route: `${origin}/tools/barcode-reader`.
  - Primary button **View Tag Barcode Reader** → opens a modal showing the fold-out shelf card preview (see §2).
  - Secondary button **Download PDF** → triggers the same PDF generation directly.

## 2. Fold-out shelf card (preview + PDF)

New component `src/components/settings/tag-reader-card-dialog.tsx`:

- Dialog with an on-screen SVG preview of a landscape fold-out card, styled to match the uploaded reference (dark panel, bold "SCAN QR CODE USING PHONE CAMERA" caption, large QR, arrow accent, Tag logo top).
- Faint vertical **fold lines** rendered as dashed light-grey strokes at the two fold positions (tri-fold) so the printer knows where to score.
- Buttons: **Print** (browser print of the preview) and **Download PDF**.
- PDF generation client-side using `jspdf` (already common) — A4 landscape, three panels separated by dashed fold guides, TAG logo (import from `@/assets/Tag_logo_pink_horizontal.png`), QR rendered via `qrcode` package (`toDataURL`, already used in `qr-preview.tsx`), same URL as the Settings card.
- File name: `tag-barcode-reader-card.pdf`.

## 3. Public barcode-reader page

New route `src/routes/tools.barcode-reader.tsx` (public, no auth):

- Full-screen page: centered Tag logo (wordmark) + heading "Tag Barcode Reader" + short instructions.
- 1D barcode scanner using the existing dependency stack in `src/components/products/barcode-scanner-dialog.tsx` (reuse the same ZXing/BarcodeDetector logic factored into a reusable `<BarcodeReader onDetect={...} />` component if convenient, otherwise inline).
- On detect: show the decoded value, a "Scan again" button, and a "Look up product" link that navigates to `/passport/{gtin}` when the code looks like a GTIN.
- `head()` with proper title/description; mobile-first layout (camera view + result panel).

## 4. Hero page logo (about.tsx)

- Move the Tag wordmark **above** the H1 headline inside the hero `<section>` (currently only shown inside `MarketingHeader`).
- Render at **150%** of the current header wordmark size (use `TagLogo variant="wordmark"` with an explicit `heightClass` — e.g. current `h-[31.2rem]` header size × 1.5 is too large, so scale the intended hero baseline: use `heightClass="h-[18rem]"` centered, with `mb-6` before the H1). Exact class picked so aspect ratio is preserved (image is `w-auto object-contain`).
- Keep the header's existing logo untouched (previously fixed so it doesn't jump between pages).

## 5. In-app top-left logo (+30%)

- `src/routes/_authenticated/route.tsx` line 66: replace `<TagLogo variant="wordmark" size="sm" />` with an explicit `heightClass` that is 30% larger than the current `size="sm"` (`h-[4.8rem]` → `h-[6.24rem]`). Keep aspect ratio (image already uses `w-auto`).
- Verify the top nav row height / alignment still looks correct; nudge padding only if the taller logo forces the nav to grow.

## Technical notes

- Reader URL: derive at render time from `window.location.origin` so the QR works in preview, published, and custom-domain deployments.
- `jspdf` may need to be added (`bun add jspdf`); if already present, reuse. Logo embedded as PNG data URL (fetch the imported asset via a hidden `<img>` → canvas, or bundle a small base64).
- No backend/schema changes. No changes to auth or RLS.
- No design-system token changes; all colors via existing tokens except the shelf card art which is intentionally styled (dark panel, yellow QR frame) to match the printed reference.
