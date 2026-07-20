# Header/sidebar layout fix + Admin/Intelligence tabs + infographic recolor + Briefing reflow

Reference screenshot: big Tag logo far top-right; "Hello Makro" greeting + subtitle top-left; sidebar starts directly at nav items (Briefing highlighted) with no logo above.

## 1. Sidebar

`src/components/app-sidebar.tsx`
- Remove the big `TagLogo` from `SidebarHeader`; nav list is the first thing in the sidebar.
- Keep the search box and profile avatar in the footer as they are.

## 2. App header (top of main content)

`src/routes/_authenticated/route.tsx`
- Left: bold "Hello [Store]" title with muted subtitle "Your daily briefing — scans, waiting customers, and freshly tagged products." Store name from `briefingQueryOptions.greetingName`, no emoji.
- Right: keep the big `TagLogo` at its current larger size, aligned far right.
- Simple flex justify-between row; sidebar trigger + user menu / theme toggle stay on this bar without visual competition.

## 3. Briefing page reflow

`src/routes/_authenticated/briefing.tsx`
- Remove the in-page "Hello Makro" `PageHeader` (greeting now lives only in the app header).
- Rebuild the grid below the KPI row like this:

  ```
  Row A (KPI tiles)         Today's scans | Customers waiting | Tagged today
  Row B (12 cols)           Scan heatmap (6) | High intent (3) | Rising intent (3)
  Row C (12 cols)           Unread WhatsApps (6) | Tagged products (6)
  ```

  - Row B: heatmap expands to 6 columns; High Intent Products and Rising Intent sit as two 3-column columns to its right (they were previously below the heatmap).
  - Row C: Tagged Products moves next to Unread WhatsApps as a 6/6 split (it was previously alongside the heatmap in Row B).
  - Everything else on the page (tagged-product accordion buckets, KPI content) stays.

## 4. Remove Admin & Intelligence sidebar accordions → in-page tabs

`src/lib/nav.ts`
- Drop the `items` array from Admin so it renders as one top-level link to `/admin`.
- Drop the `items` array from Intelligence so it renders as one top-level link to `/intelligence`.
- All existing routes stay; only sidebar sub-menus are removed.

`src/components/app-sidebar.tsx`
- With `items` gone, both fall through to the plain `SidebarMenuButton` branch — no `Collapsible`, no chevron, no expanded sub-list.

### Admin tabs (`/admin`)
`src/routes/_authenticated/admin.index.tsx` already uses `Tabs` for Taxonomy / Stores / Customers / Users. Confirm every previous sidebar destination is present as a tab; add any missing tab to that existing `Tabs` block.

### Intelligence tabs (`/intelligence`)
`src/routes/_authenticated/intelligence.tsx` already renders a `Tabs` header around an `<Outlet />`. Expand the `TABS` array so every current sub-page is a tab:
- Overview → `/intelligence`
- Insights → `/intelligence/insights`
- Analytics → `/analytics`
- ROI → `/roi`
- Trends → `/intelligence/trends`
- Forecasting → `/intelligence/forecasting`

Only the tab strip is expanded; sub-page contents are unchanged.

## 5. Recolor infographic green accents to the logo colour

Logo colour is tokenised as `--mint` = `#C75984` (TAG pink). Repoint decorative greens to `var(--mint)`.

- `src/components/dashboard/kpi-card.tsx` — swap `var(--success)` accent tone to `var(--mint)`.
- `src/components/dashboard/customer-growth-card.tsx` — line stroke and legend colour from `var(--success)` to `var(--mint)`.
- `src/components/dashboard/opportunity-feed.tsx` — replace `emerald-500/600/700` classes (badges, dots, TrendingUp icon, revenue cell) with the `bg-[color:var(--mint)]/15 text-[color:var(--mint)]` pattern already used elsewhere.
- Sweep Briefing, Analytics, ROI, Trends, Forecasting for other `text-emerald-*`, `bg-emerald-*`, `--success`, `#25D366`, `--chart-2` used as brand accents and repoint to `--mint`.

Keep true status-semantic greens (WhatsApp "delivered / sent", connection-online indicators) untouched — green there means status, not brand.

## Out of scope

- No change to nav order, icons, or the mobile bottom bar.
- No change to sub-page contents under Admin or Intelligence.
