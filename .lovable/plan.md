## Executive Dashboard — Build Plan

Note on the referenced skill: `sign-up-and-authenticate` covers auth flows (forgot password, password visibility, etc.). Those are already in place from the scaffolding. The dashboard work below sits inside the authenticated layout, so the skill's rules continue to apply but no auth code changes here.

### Data layer

Single TanStack server function `getDashboardOverview()` (under `src/lib/dashboard.functions.ts`) using `requireSupabaseAuth` so RLS scopes everything to the caller's retailer automatically. Returns one serializable DTO:

```ts
{
  kpis: {
    todaysScans, customersWaiting, revenueRecoveredCents, currency,
    notificationsSent, notificationConversionPct,
    lowStockCount, onPromotionCount,
  },
  topProducts: [{ id, name, interestCount, stockQty }],
  lowStockProducts: [{ id, name, stockQty, lowStockThreshold }],
  promotionProducts: [{ id, name, discountPct, endsAt }],
  scansDaily: [{ date, count }],         // last 14 days
  scansWeekly: [{ weekStart, count }],   // last 12 weeks
  scansMonthly: [{ month, count }],      // last 12 months
  customerGrowth: [{ date, total }],     // cumulative, last 30 days
  notificationPerf: [{ date, sent, delivered, read }], // last 14 days
  recentActivity: [                       // last 15 events
    { type: 'scan'|'opt_in'|'notification'|'recovery', at, label, sublabel }
  ],
}
```

Implementation: small set of grouped SQL queries via the supabase JS client (interests grouped by created_at::date for scans; customers count where opt-in within 30d for growth; notification_history by status; sales_recoveries sum; promotion_events where status='active'; products where stock_qty <= low_stock_threshold). All scoped by `auth.uid()`'s retailer through RLS.

Conversion = `read / sent` for the trailing 14 days.

### Route + query wiring

`src/routes/_authenticated/dashboard.tsx`:
- `loader` calls `context.queryClient.ensureQueryData(dashboardOverviewQueryOptions)`.
- Component uses `useSuspenseQuery`.
- Adds `errorComponent`, `notFoundComponent`, `pendingComponent` (renders the same skeleton grid).
- `head()` sets title + meta description.

`queryOptions` keyed `['dashboard','overview']`, staleTime 60s.

### UI composition

`PageHeader` + a responsive grid built from these new components under `src/components/dashboard/`:

1. **KpiCard** — label, big value, trend delta vs. previous period, tiny sparkline (recharts AreaChart). Used 8x:
   - Today's scans, Customers waiting (active interests), Revenue recovered, Notifications sent, Notification conversion, Low stock count, On promotion count, Top product (compact variant).
2. **ScanTrendsCard** — Tabs (Daily / Weekly / Monthly) over a single `ChartContainer` AreaChart, switching dataset. Counts as the three required scan charts.
3. **CustomerGrowthCard** — Line chart, cumulative subscribers, last 30 days.
4. **TopProductsCard** — Horizontal bar chart of top 5 products by interest count, with product name + count.
5. **NotificationPerformanceCard** — Stacked bar (sent vs delivered vs read) over 14 days.
6. **LowStockCard** — List with stock pill (orange when <= threshold, red at 0) and "Notify waitlist" affordance (visual only this step).
7. **PromotionsCard** — List of active promotions with discount % and end countdown.
8. **RecentActivityCard** — Timeline list, color-coded icon per event type.

### Skeletons, empty states, animations

- `DashboardSkeleton` — mirrors the real grid using `Skeleton` blocks; used by both `pendingComponent` and `<Suspense fallback>` patterns.
- `EmptyState` — small reusable component (icon + title + helper text + optional CTA) used inside any card whose dataset is empty (e.g. no scans today, no low-stock products).
- Animations:
  - Cards animate in with `animate-fade-in` + a 60ms cascading delay via inline style.
  - KPI values count up using a tiny `useCountUp` hook (no extra dep).
  - Hover lift: `hover-scale` utility on interactive cards only (KPI + product/promotion list rows).

### Design tokens

Reuses existing tokens (Navy primary, Emerald success, Orange warning). Adds two chart-specific tokens in `src/styles.css` only if needed: `--chart-1` … `--chart-5` mapped to existing palette (primary, success, warning, muted-foreground, accent). Verifies dark mode contrast.

### Files added/changed

- `src/lib/dashboard.functions.ts` (new) — `getDashboardOverview` server fn.
- `src/lib/dashboard.ts` (new) — `dashboardOverviewQueryOptions` + shared types.
- `src/components/dashboard/kpi-card.tsx`
- `src/components/dashboard/scan-trends-card.tsx`
- `src/components/dashboard/customer-growth-card.tsx`
- `src/components/dashboard/top-products-card.tsx`
- `src/components/dashboard/notification-performance-card.tsx`
- `src/components/dashboard/low-stock-card.tsx`
- `src/components/dashboard/promotions-card.tsx`
- `src/components/dashboard/recent-activity-card.tsx`
- `src/components/dashboard/dashboard-skeleton.tsx`
- `src/components/empty-state.tsx`
- `src/hooks/use-count-up.ts`
- `src/routes/_authenticated/dashboard.tsx` — rewritten to compose the above.
- `src/styles.css` — chart token additions only if needed.

### Out of scope (deliberate)

- Wiring "Notify waitlist", clicking through to product detail, date-range picker, CSV export — placeholders/links only.
- Realtime updates; relies on 60s `staleTime` + manual refresh.
- Per-store filtering — added in a later pass when Stores UI lands.
