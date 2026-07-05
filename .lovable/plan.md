## Changes

### 1. Notifications: full CRUD + selection styling
- Add **Edit** action for draft campaigns:
  - New route `src/routes/_authenticated/notifications.$campaignId.edit.tsx` reusing the composer from `notifications.new.tsx` (refactor into a shared `CampaignComposer` component). Edit only enabled for `draft` status.
  - Add `updateCampaign` server fn in `src/lib/notifications.functions.ts`.
  - Add "Edit" menu item in the list dropdown and a button on the detail page.
- Remove the orange highlight per selected/hovered row:
  - In `notifications.index.tsx`, drop `hover:bg-accent/40` on the campaign `Card` (and any active/selected accent styling), replace with neutral `hover:border-foreground/20` border-only affordance.

### 2. Badges: consistent solid pop colours
- Update `STATUS_TONE` map in `notifications.index.tsx` and the detail page to use solid semantic colours:
  - `draft` → slate, `scheduled` → blue, `sending` → amber, `sent`/`completed` → green, `cancelled` → red.
- Standardise via a new `<StatusBadge status={...} />` helper in `src/components/notifications/status-badge.tsx` using solid `bg-*` + `text-white` (no translucent tints).
- Apply the same solid-colour treatment to the `type` badge (sale/low_stock/etc.) with a fixed palette.

### 3. Merge Products + Stock + QR Tags into one unified table
- New route `src/routes/_authenticated/products.index.tsx` becomes the single "Items" page showing one row per product with columns:
  `Image · Name · SKU · Category · Price · Stock (with low-stock indicator) · QR Tag (short code + scan count + download) · Actions`.
- Fold functionality from `stock.tsx` (stock editing inline) and `qr-tags.tsx` (QR generation / download / copy link) into row actions and an expandable row / side panel.
- Delete routes: `src/routes/_authenticated/stock.tsx`, `src/routes/_authenticated/qr-tags.tsx`.
- Update `app-sidebar.tsx` "Items & Tags" match array to `["/products"]` only.
- Remove Stock/QR Tags tabs from `SECTIONS` in `section-tabs.tsx` (moot after step 4 but keep consistent).
- Update any internal `<Link to="/stock">` / `<Link to="/qr-tags">` references to `/products`.

### 4. Remove the black section-tabs bar
- Remove `<SectionTabs />` render from `src/routes/_authenticated/route.tsx`.
- Delete `src/components/section-tabs.tsx` (and remove imports).
- Sidebar becomes the sole primary navigation.

### 5. Mobile: bottom nav mirrors sidebar
- New `src/components/mobile-bottom-nav.tsx`: fixed bottom bar visible only on `< md` breakpoints, rendering the same `NAV` items from `app-sidebar.tsx` (extract `NAV` to a shared `src/lib/nav.ts` so both consume it). Icons + labels, active state highlighted, locked items route to `/upgrade`.
- Render it in `_authenticated/route.tsx` below `<Outlet />`.
- Add `pb-20 md:pb-0` to the main content wrapper so content isn't hidden under the bar.
- Hide the desktop `<AppSidebar />` on mobile (`hidden md:flex`) since the bottom nav replaces it, but keep the `SidebarTrigger` hidden on mobile too.

## Technical notes
- No DB migrations required — merge is UI-only; `products`, `qr_tags`, and stock fields already exist.
- `updateCampaign` reuses existing RLS on `notification_campaigns` (retailer-scoped update policy already present).
- Keep the existing `SidebarProvider` wrapper so desktop behaviour is unchanged.