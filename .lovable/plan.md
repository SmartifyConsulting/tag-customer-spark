## Changes

### 1. Sidebar / header logo rework
- **`src/components/app-sidebar.tsx`**
  - Remove the small icon shown in the collapsed `SidebarHeader` (`<TagLogo variant="icon" />` branch). Always render the wordmark, sized to fill the sidebar header (`heightClass="h-[10.6rem]"` — same size currently in the top bar).
  - Auto-expand all collapsible sub-nav groups (`defaultOpen` for every item with children), not just Intelligence.
- **`src/routes/_authenticated/route.tsx`**
  - Remove the large `<TagLogo>` block from the top header (lines 67–72). Header keeps `SidebarTrigger` (mobile) + `ThemeToggle` + `UserMenu`.

### 2. Crisp white background + grey hover
- **`src/styles.css`**: Set `--background` and `--sidebar` to pure white (`oklch(1 0 0)`) in the light theme so sidebar and main area read as one crisp white surface.
- **`src/components/app-sidebar.tsx`**: Change non-active hover from `hover:bg-foreground/5` to `hover:bg-muted` (grey token) for top-level and locked items.

### 3. QR / GTIN_CLASH toast (fix "once and for all")
The generator throws a JSON `GTIN_CLASH` payload. `ProductQrPanel` handles it, but the auto-run `bulkCompleteDigitalIdentity` in `product-detail-view.tsx` surfaces it as raw JSON (screenshot).
- **`src/components/products/product-detail-view.tsx`**: When reading `res.errors`, detect `step === "qr"` messages that parse as `{ code: "GTIN_CLASH", … }`. Show a friendly toast: *"Duplicate GTIN with '<otherProductName>'. Open the QR panel below to merge."* Suppress the follow-up `image` toast when the QR step already clashed.
- No change to `qr.functions.ts` — the structured error is correct; only client presentation is fixed.

### 4. Product-image resolver error
When QR fails (e.g. GTIN clash) the code still runs `resolveAndSyncProductImage`, which errors on the half-written product state.
- **`src/lib/products.functions.ts` (`bulkCompleteDigitalIdentity`)**: If the QR step recorded a `GTIN_CLASH`, mark that product `skipped` and skip the image + enrichment steps (they can't succeed until merge). Stops cascading "image failed" toasts.
- **`src/lib/product-images.server.ts`**: Guard the initial product-row read so a missing row returns silently instead of throwing.

### 5. Tag Barcode Reader shelf card — fit on one A4
Current PDF export renders **7 pages**; it must be a single A4 sheet.
- **`src/components/settings/tag-reader-card-dialog.tsx`**: Fix the jsPDF layout so the tri-fold card renders on exactly one A4 page (landscape, `format: "a4"`, no auto page breaks). Constrain the outer card to A4 minus margins, scale the QR + logo + copy to fit each of the three folds, and remove any `addPage()` calls that fire when content overflows. After the fix, verify the exported PDF is one page (both the on-screen preview and the downloaded file).

## Out of scope
- No AI enrichment, Serper, or QR crypto/rendering changes.
- No DB migrations.

## Technical notes
- `--background` change ripples through `bg-background` consumers (main, header, sidebar-inset) — intended single-token switch.
- Sidebar wordmark at `h-[10.6rem]` already fits the expanded sidebar; collapsed (icon) mode simply shows an empty header (desktop-only, rarely used).
- One-page A4 fix is a layout/scale change in the existing jsPDF code — no new dependency.
