# Briefing, chrome, and Intelligence build-out

## 1. Briefing page (`src/routes/_authenticated/briefing.tsx`)

Row 1 (KPIs) — remove the **Unread WhatsApps** tile. Keep Scans, Waiting Customers, Tagged Today (3 tiles across).

Row 2 (was row 3) — Tagged Product accordions (8 cols) + Unread WhatsApps list (4 cols). No change to contents; only its position moves up.

Row 3 (was row 2) — Remove **Conversion Gap Products**. Reduce **Scan Heatmap** to half width (6 cols). Split the remaining 6 cols between **High Intent Products** (3 cols) and **Rising Intent** (3 cols).

Result:

```text
Row 1: [Scans] [Waiting Customers] [Tagged Today]
Row 2: [Tagged Products accordions ............ 8] [Unread WhatsApps 4]
Row 3: [Scan Heatmap .... 6] [High Intent 3] [Rising Intent 3]
```

## 2. App header / greeting

Currently the in-app top bar shows the large TagLogo on the left and the greeting to its right. Change to:

- Greeting ("Hello Makro Woodmead") on the **left**, where the logo used to sit.
- Remove the **waving hand emoji/icon** from the greeting line.
- Move the TagLogo to the **extreme right** of the top bar.

File: `src/routes/_authenticated/route.tsx` (top-bar layout) and wherever `TagLogo` currently renders in the authenticated shell.

## 3. Sidebar (`src/components/app-sidebar.tsx`)

- Remove the "TAG / Demand Intelligence" footer text block.
- Move the profile avatar (user menu) from the top bar into `SidebarFooter`, positioned **below the "Search anything…" input**.
- Sidebar header no longer needs the wordmark logo (it's moving to the top-right of the app). Keep the header minimal / collapsible-safe.

Touches `app-sidebar.tsx` and the authenticated top-bar so the `UserMenu` no longer renders there.

## 4. Build out Intelligence sub-pages

Replace the current placeholders/thin pages with real content using existing data sources.

- **Insights** (`intelligence.insights.tsx`) — already exists; audit and polish (OverallIntent + SignalContributions + OpportunityFeed already wired). No structural change unless empty states need work.
- **Analytics** (`analytics.tsx` → repurpose) — build a real analytics view: scans over time (`ScanTrendsCard`), top products (`TopProductsCard`), customer growth (`CustomerGrowthCard`), heatmap.
- **ROI** (`roi.tsx`) — exists; ensure it renders KPIs (revenue recovered, attribution counts) from `roi.functions.ts`. Add empty state.
- **Trends** (`intelligence.trends.tsx`) — expand beyond current bucket lists: add a rising/falling leaderboard with sparkline-style score deltas.
- **Forecasting** (`intelligence.forecasting.tsx`) — expand: show 7/14/30-day horizon summary tiles + the intent sections card grouped by horizon.

Each page keeps its existing `requireFeature` gate and `head()` metadata, and follows the PageHeader + Card grid pattern used elsewhere.

## Out of scope

- No backend/schema changes.
- No changes to nav order or tier gating.
- No new server functions — reuse existing dashboard/intent/ROI data helpers.