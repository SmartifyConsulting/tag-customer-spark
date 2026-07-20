# Plan

## 1. Taxonomy Engine — dropdown default, no manual button
- `src/components/settings/taxonomy-engine-tab.tsx`
  - Remove the "Load sector templates" button and its `seedTemplates` mutation.
  - Replace the profile tile grid (the dark-shaded cards) with a `Select` dropdown listing every profile. Show "Default" and "Published" badges inside the dropdown items.
  - Keep `Set as default` / `Publish` / `Delete` actions as a small toolbar next to the dropdown.
  - Keep auto-seed on mount (silent). After seeding, if no profile is marked default, mark the AI-suggested one (or first) as default automatically.
- `src/lib/taxonomy.functions.ts`
  - Extend `seedSectorTemplates` to, after creating profiles, ensure exactly one `is_default = true` using the existing sector-scoring / AI suggestion helper. Idempotent.

## 2. Briefing page — 12-column infographic layout
- `src/lib/dashboard.functions.ts` (`getBriefing`)
  - Re-bucket tagged products into **Today / Yesterday / This week / This month** only (drop last-week + month-by-name).
  - Group each bucket by `product_id` so repeated tags collapse to one row with a `count` badge; sort by count desc, then most-recent.
  - Return type: `buckets: { key, label, products: { id, name, image_url, gtin, count, last_tagged_at }[] }[]`.
- `src/routes/_authenticated/briefing.tsx`
  - Rebuild as a 12-column grid matching the infographic:
    ```text
    ┌────────────────────────────────────────────────────────────┐
    │  Hello {greetingName}                                       │
    ├──────────────┬──────────────┬──────────────┬───────────────┤
    │ KPI Today's  │ KPI Waiting  │ KPI Tagged   │ KPI Unread    │  (row 1, col-span-3 each)
    │  scans       │  customers   │  today       │  WhatsApps    │
    ├──────────────┴──────────────┼──────────────┴───────────────┤
    │  Scan heatmap (col-span-8)  │  High intent (col-span-4)    │  (row 2)
    │                             │  Rising intent               │
    ├─────────────────────────────┼──────────────────────────────┤
    │  Tagged products            │  Unread WhatsApps            │  (row 3)
    │  (accordion Today/Yest/     │  (list, tap → /inbox/$id)    │
    │   Week/Month, col-span-8)   │  (col-span-4)                │
    └─────────────────────────────┴──────────────────────────────┘
    ```
  - Reuse existing components: `KpiCard`, `Heatmap` (extract from `dashboard.tsx` into `src/components/dashboard/scan-heatmap.tsx`), `IntentSectionsCard` (render just `high` + `rising` in a compact 1-column mode via a new `variant="stack"` prop, or slice the same query).
  - Product rows show thumbnail + name + count badge; accordion collapsed by default with the four time buckets.
  - Loader batches `dashboardOverviewQueryOptions`, `briefingQueryOptions`, `advancedAnalyticsQueryOptions(30)`.

## 3. Chrome clean-up
- `src/components/ui/sidebar.tsx` line ~242 — drop `group-data-[side=left]:border-r group-data-[side=right]:border-l` so the vertical rule between nav and canvas disappears.
- `src/routes/_authenticated/inbox.tsx` line 117 — remove `border-b` from the search/tabs wrapper so the horizontal line under `All / Unread / Mine / Open / Done` is gone.

## Technical notes
- Extracting `Heatmap`/`HeatmapLegend` into a shared component keeps the dashboard route and the new briefing sharing one implementation.
- `getBriefing` bucketing uses local dates derived from `created_at`; "This week" = Mon-now, "This month" = 1st-now, excluding Today/Yesterday.
- The dropdown replacement in Taxonomy uses shadcn `Select` (already imported), so no new dependencies.
- No schema changes.
