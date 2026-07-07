## Nav, Dashboard, Insights refactor

### 1. Nav — rename Notifications → WhatsApps, move to slot 2

Edit `src/lib/nav.ts` — reorder to: Dashboard, **WhatsApps** (`/inbox`, Inbox icon), Inventory, Customers, Insights, Admin, Settings.

Propagate label:
- `src/components/command-palette.tsx` — "Notifications" entry → "WhatsApps".
- `src/routes/_authenticated/inbox.tsx` — `PageHeader` title and `<title>` meta → "WhatsApps".

### 2. Rename Analytics → Intelligence

- `src/routes/_authenticated/analytics.tsx` — `PageHeader` title "Analytics" → "Intelligence", meta title "Analytics — Tag" → "Intelligence — Tag".

### 3. Move Analytics content onto Dashboard

Migrate every analytics-page block into `src/routes/_authenticated/dashboard.tsx`, feeding off `getAdvancedAnalytics` in addition to the existing dashboard loader:

- Extra KPIs to append into the dashboard KPI grid (dedup with what's already there): **Unique customers**, **Returning customers**, **Avg recovery time**, **Notification CTR**, **Total customers**. Drop the analytics-page "Total scans", "Recovered revenue", "Active campaigns" tiles as duplicates of existing dashboard KPIs and of the removed Campaign section.
- Move charts into new dashboard cards: **Scan trend**, **Customer growth**, **Popular products**, **Popular stores**, **Scan heatmap** (weekday × hour).
- Add the 7d/30d/90d `Tabs` control + Export dropdown (XLSX / PDF) into the Dashboard `PageHeader.actions`, wired to `getAdvancedAnalytics({ days })`.
- Fetch pattern: introduce `advancedAnalyticsQueryOptions(days)` alongside `dashboardOverviewQueryOptions` and read both via `useSuspenseQuery`.

### 4. Move AI Opportunity Feed → Insights (Intelligence) page

- Remove `<OpportunityFeedCard />` from `dashboard.tsx`.
- Render `<OpportunityFeedCard />` at the top of `analytics.tsx`. Feature gate remains (Tag Pro).

### 5. Remove Campaign Performance

- Delete the "Campaign performance" `<Card>` and its `<table>` in `analytics.tsx`.
- Remove `<NotificationPerformanceCard />` from `dashboard.tsx` and delete `src/components/dashboard/notification-performance-card.tsx`.
- Drop `exportCSV` (campaign-only) and drop the "Campaigns" sheet + "Top campaigns" PDF section from `exportXLSX` / `exportPDF`.

### 6. Remove Dashboard cards & KPIs

- Remove `<PromotionsCard />` (On Promotion) and `<LowStockCard />` from `dashboard.tsx`; delete `src/components/dashboard/promotions-card.tsx` and `low-stock-card.tsx` if unused elsewhere.
- Remove the **Low stock products**, **On promotion**, and **Top product interest** KPI tiles from the dashboard KPI grid.
- The remaining 3-column row collapses to a single `RecentActivityCard` full-width.

### 7. Deletions and dedup

Reuse `ScanTrendsCard`, `CustomerGrowthCard`, `TopProductsCard` for the migrated charts by mapping analytics data to their existing props. Final Insights (`/analytics`) page contains only: `PageHeader "Intelligence"` and `OpportunityFeedCard`.

### Out of scope

- No changes to `getAdvancedAnalytics` server function shape, no schema changes, no tier/permission changes beyond keeping the existing `roi` gate on the Insights route.