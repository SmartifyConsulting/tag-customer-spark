
## 1. Barcode scan when adding a product

- Add a **"Scan barcode"** button next to the SKU field in `ProductFormDialog`.
- New `BarcodeScannerDialog` (`src/components/products/barcode-scanner-dialog.tsx`):
  - Uses native `BarcodeDetector` when available; falls back to `@zxing/browser` via dynamic `import()`.
  - `getUserMedia({ video: { facingMode: "environment" } })` in a dialog with scan-frame overlay.
  - On detect → close, callback `onDetect(code)`.
- On detect in `ProductFormDialog`:
  1. Set `sku` to scanned code.
  2. Call new `lookupBarcode({ code })` server fn in `src/lib/products.functions.ts`:
     - Local match first (`products.sku = code` in retailer) → prefill full product.
     - Else Open Food Facts (`world.openfoodfacts.org/api/v2/product/<code>.json`) for name/brand/image.
     - Returns `{ found, source, product? }`.
  3. Auto-fill only empty fields; toast the source.

## 2. Drag-and-drop placeholders into Notifications composer

- Align token ids in `message-placeholders.tsx` with composer tokens (`product`, `code`, etc.) so drops emit `{product}`-style tokens the renderer already substitutes.
- In `CampaignComposer`:
  - Refs on `headline` (Input) and `body` (Textarea).
  - `onDragOver` / `onDrop` insert `dataTransfer.getData("text/plain")` at caret (`selectionStart/End`) and update state.
  - Render `<MessagePlaceholders onInsert={insertAtActive} />` above the WhatsApp preview column.
  - Click path inserts into last-focused field.

## 3. Notifications CRUD polish

- Enable **Edit** for `draft` and `scheduled` in the list dropdown and detail header (currently drafts only).
- Replace `confirm()` delete with shadcn `AlertDialog`.
- Duplicate + Delete actions available on the detail page header.

## 4. Items & Tags: accordion by category, collapsed by default

- Group rows in `products.index.tsx` by `category.name` (fallback "Uncategorised"), render with shadcn `Accordion type="multiple"` and **no default open value**.
- Trigger shows: category name, item count badge, low-stock count badge.
- Content renders the existing `ProductsTable` filtered to the category (all row actions preserved).
- Multi-select still aggregates across categories for Bulk QR PDF.

## 5. Remove Status column; archived becomes a filter

- Drop Status column and its `StatusBadge` from `ProductsTable`.
- Toolbar: remove status Select; add **"Show archived"** switch (default off).
- Route search schema: replace `status` with `showArchived: boolean`.
- Client sends `status: "archived"` when the switch is on, else the query filters archived out.
- `ProductFormDialog`: remove Status section; new products default `active`.

## 6. Solid, consistent badges on Items & Tags

- Keep `StockPill` solid; use existing `Badge` variants (`default`, `warning`, `success`, `destructive`) for category count and low-stock chips in the accordion triggers — no ad-hoc classes.

## 7. Restore original sidebar nav labels

Update `src/lib/nav.ts` titles to match the original set (icons and routes unchanged):

- Dashboard
- Items & Tags
- **Alerts & Campaigns** (was "Alerts")
- **Customers & Leads** (was "Customers")
- **Analytics & Insights** (was "Analytics")
- Settings

Same change is picked up automatically by `AppSidebar` and `MobileBottomNav` since both read from `NAV`.

## Technical notes

- **New files**: `src/components/products/barcode-scanner-dialog.tsx`
- **Edited**: `product-form-dialog.tsx`, `products-table.tsx`, `products-toolbar.tsx`, `routes/_authenticated/products.index.tsx`, `notifications/message-placeholders.tsx`, `notifications/campaign-composer.tsx`, `routes/_authenticated/notifications.index.tsx`, `routes/_authenticated/notifications.$campaignId.tsx`, `lib/products.functions.ts`, `lib/nav.ts`.
- **Dep**: `bun add @zxing/browser` (dynamic-imported fallback only).
- **No DB migrations.**
