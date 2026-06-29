
## Goal

Restructure Tag's navigation to a minimalist 5-item navy sidebar. Every existing feature is preserved — deeper items move into horizontal tabs on each section's landing page. Swap the sidebar logo for the newly uploaded `TagLogo-Photoroom.png` and double its size.

## New Navigation Mapping

| # | Sidebar item | Route | On-screen tabs |
|---|---|---|---|
| 1 | Workspace | `/workspace` | Dashboard · Alerts |
| 2 | Engagement | `/engagement` | Customers · QR Tags & Catalogue · Watchlists · Compare |
| 3 | Intelligence | `/intelligence` | Overview · Intent Engine · Demand Insights · Forecasting · Trend Detection |
| 4 | Performance & ROI | `/performance` | ROI Engine · Pricing Sensitivity · Conversion Funnel · Executive Reports · Historical Trends |
| 5 | Management | `/management` | Stores · Staff · Permissions · Settings |

No feature is removed — every current route becomes a tab destination.

## Implementation

**Logo**
- Upload `user-uploads://TagLogo-Photoroom.png` via `lovable-assets` → `src/assets/tag-logo-v2.png.asset.json`.
- Update `src/components/tag-logo.tsx` to use the new asset and double the rendered size (e.g. `h-28 w-28` for the `lg` variant used in the sidebar). Header in `app-sidebar.tsx` gets taller to accommodate.

**Sidebar (`src/components/app-sidebar.tsx`)**
- Replace 8-group `NAV` with a flat 5-item array (icons: `LayoutGrid`, `Users`, `Sparkles`, `TrendingUp`, `Settings2`).
- Remove `SidebarGroup`/`SidebarGroupLabel` accordions; render a single `SidebarMenu`.
- Active state: deep navy background, white type, prominent glowing mint-green left bar + soft `box-shadow` ring in `--mint`.
- Each item's `isActive` matches its route prefix (so any tab within still highlights the parent).

**Tabbed section shells** — new file `src/components/section-tabs.tsx` providing a reusable horizontal tab strip (underline active state, `--mint` accent, sticky under header). Then create 5 layout routes:

- `src/routes/_authenticated/workspace.tsx` — layout with `<SectionTabs>` + `<Outlet/>`.
- `src/routes/_authenticated/workspace.index.tsx` → redirects to `/workspace/dashboard`.
- `workspace.dashboard.tsx`, `workspace.alerts.tsx` re-export existing dashboard/alerts components.
- Same pattern for `engagement.*`, `intelligence.*`, `performance.*`, `management.*`.

**Backward compatibility** — existing routes (`/dashboard`, `/alerts`, `/customers`, `/qr-tags`, `/watchlists`, `/products/compare`, `/intelligence`, `/intent`, `/intelligence/insights`, `/intelligence/forecasting`, `/intelligence/trends`, `/roi`, `/commerce/pricing`, `/commerce/funnel`, `/analytics`, `/analytics/reports`, `/analytics/history`, `/stores`, `/staff`, `/organisation/roles`, `/settings`) become thin redirect routes pointing to their new tabbed home. Command palette and any internal `<Link>` targets updated to the new URLs.

**Header polish** — keep ⌘K search chip; remove now-redundant top breadcrumbs since tabs supply context.

## Out of Scope

No business logic, server function, or schema changes. Purely IA, routing, and presentation.

## Verification

- Visit `/workspace`, `/engagement`, `/intelligence`, `/performance`, `/management` — each lands on the first tab, all tabs switch correctly.
- Every legacy URL redirects to its new tab home.
- Sidebar shows exactly 5 items; new logo renders at 2× size; active item shows mint glow.
