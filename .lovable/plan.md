The five sidebar items currently point at URLs that don't always match the section the SectionTabs strip recognizes, so several tabbed sub-pages aren't reachable from the sidebar (e.g. clicking "Engagement" goes to `/alerts`, which is in the Dashboard section, hiding the Customers/Products/Watchlists/Compare tabs).

Realign the sidebar so each item lands on its section's root and the full tab strip (and therefore every screen) reappears.

## Changes

**`src/components/app-sidebar.tsx`** — update the 5 `NAV` entries to use each section's `rootPath` and broaden `match` to keep the correct item active across all child routes:

1. Dashboard → `/dashboard` — match `/dashboard`, `/alerts`, `/inbox`, `/notifications`
2. Engagement → `/customers` — match `/customers`, `/products`, `/qr-tags`, `/watchlists`
3. Intelligence → `/intelligence` — match `/intelligence`, `/intent`
4. Performance & ROI → `/roi` — match `/roi`, `/commerce`, `/analytics`
5. Management → `/stores` — match `/stores`, `/staff`, `/organisation`, `/settings`

No changes to `section-tabs.tsx` (already exposes every screen). No new routes — all referenced screens already exist under `src/routes/_authenticated/`.

Result: every sidebar click reveals the correct horizontal tab strip, and every screen (Customers, Products, QR Tags, Watchlists, Compare, Intent Engine, Insights, Forecasting, Trends, ROI, Pricing, Funnel, Analytics, History, Stores, Staff, Permissions, Settings, Alerts) is reachable in two clicks.