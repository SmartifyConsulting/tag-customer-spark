## Scope
Ten focused UI/data tweaks. No new business logic beyond what's needed for the two new store fields.

## 1. Bring back Stock functionality
- Add a **Stock** tab to the Engagement section in `src/components/section-tabs.tsx` (between Products and QR Tags), routing to `/stock`.
- Create `src/routes/_authenticated/stock.tsx`:
  - Uses the existing `products` table (already has `stock_qty` + `low_stock_threshold`).
  - Three filter chips: **All**, **Low stock**, **Out of stock**.
  - Table with product image, name, store, stock qty, threshold, status badge, and an inline "Update stock" popover that writes back via a new `updateStock` server fn (`src/lib/products.functions.ts`).
- Keep the restored `LowStockCard` on the Dashboard as it is today.
- No sidebar item change — Stock lives under Engagement tabs (matches the current 5-group IA).

## 2. Sidebar logo — 300% larger
- Add a new `xl` size to `TagLogo` wordmark variant = `h-48` (roughly 3× the current `h-16` `lg`).
- Use `variant="wordmark" size="xl"` in `AppSidebar`.
- Keep the collapsed icon variant unchanged.

## 3. Active nav item — solid green with white text
- In `src/components/app-sidebar.tsx`, replace the current tinted-mint active state (`bg-[color:var(--mint)]/15 text-[color:var(--mint)]`) with a solid `bg-[color:var(--mint)] text-white` pill and drop the left accent bar.

## 4. Align the two horizontal dividers
- Adjust `SidebarHeader` so its bottom border sits at the same Y as the top navbar's bottom border (`h-16`), while the enlarged logo sits inside via negative bottom margin / absolute positioning so it extends below without pushing the divider down.
- Net effect: the sidebar/header dividers become one continuous line across the app.

## 5. Section tab bar — darker grey
- In `src/components/section-tabs.tsx`, change the pill container from `bg-muted/50` to a noticeably darker `bg-muted` (or `bg-slate-200 dark:bg-slate-800`) so the strip is clearly visible against the page background.

## 6. Store Admin cards — show Manager + Contact number
- Migration: add `manager_name text` and `contact_phone text` to `public.stores`.
- Extend `upsertStore` validator + `StoreDialog` form with the two new fields.
- Store card in `src/routes/_authenticated/stores.tsx` shows:
  - Manager name (with `UserRound` icon) — falls back to "No manager assigned".
  - Contact number (with `Phone` icon) — clickable `tel:` link.

## 7. Hero page — logo 1.5 cm lower
- In `src/routes/index.tsx` header, add `mt-[57px]` (≈1.5 cm at 96 dpi) to the hero logo `<img>` so only the hero logo shifts down; nav buttons stay where they are.

## 8. WhatsApp logo in the chat bubble preview
- In the hero's WhatsApp preview card, replace the generic Tag icon (`logoAsset`) in the header with the official WhatsApp glyph (inline SVG in green `#25D366`) plus "WhatsApp · Tag" label.

## 9. "Recovered" tile — solid green with white text
- In the same preview card, change the Recovered tile from `bg-success/10 text-success` to `bg-[color:var(--mint)] text-white` (both the label and the amount), matching the new active-nav style.

## Technical notes
- New `updateStock` server fn uses `requireSupabaseAuth`, updates `products.stock_qty` scoped by `retailer_id`, and invalidates dashboard + stock queries.
- Migration will `GRANT` per project rules — but since it only `ALTER TABLE ADD COLUMN`, existing grants and RLS on `stores` remain in force.
- No changes to Auth, billing, or tier gating.
