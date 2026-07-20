## 1. Taxonomy Engine — built-in templates, dropdown picker

**`src/components/settings/taxonomy-engine-tab.tsx`**
- Remove the **"Load sector templates"** button and its `seedTemplates` mutation/toasts. Auto-seed stays and runs silently on first render.
- Remove the **profile tile grid** (the "TEMPLATES (N)" block). The selected tile's `bg-accent` is what renders as the unreadable near-black block in the screenshot; deleting the grid removes the bug at source.
- Replace it with a compact **shadcn `Select` dropdown** at the top of the card:
  - Trigger label: "Active template".
  - Options show `Name` + inline `Default` badge when `is_default`, `Published` pill when `is_published`.
  - Selecting an option sets `selectedId` — the editor + Live Preview below load that profile (same behaviour the tiles had).
  - Ghost **"Set as default"** button beside the dropdown, visible only when the current selection isn't already default (calls existing `makeDefault`). No `bg-accent` fill anywhere.
- Keep **New profile / Publish / Unpublish / Delete** buttons unchanged.
- Update empty-state copy to drop the "Load templates" reference.

**`src/lib/taxonomy.functions.ts`** — no schema changes.
- Extend the auto-seed path so that after seeding, if no profile is marked default, it:
  1. Runs existing `suggestTemplateForRetailer` on the retailer's product sample.
  2. Finds the seeded profile matching the suggestion's source template id.
  3. Calls `setDefaultProfile`.
- Fallback (AI null or no products): mark the first "Retail" template as default. The dropdown always opens with a Default selected — zero manual steps.

## 2. Briefing redesign — infographic grid

Match the reference (`image-46.png`): compact KPI tiles top-left, a wide Scan heatmap under them, Intent cards in the middle column, Tagged products + Unread WhatsApps stacked on the right. The current page is a single 2-column stack; the redesign is a proper responsive grid so all six info blocks sit together on one screen.

**`src/routes/_authenticated/briefing.tsx`** — restructure only.
- Layout: `grid grid-cols-12 gap-6` (single column on mobile, promoting at `lg:`).
  - **Left column (cols 1–5 on lg)**
    - Row of two KPI tiles side-by-side: **Today's Scans**, **Customers Waiting** — reuse existing `KpiCard` with the same tokens the dashboard uses (`todaysScans`, `customersWaiting` already on `dashboardOverviewQueryOptions`).
    - Full-width **Scan heatmap** card below — reuse the existing dashboard heatmap component (`ScanTrendsCard` / the day×hour heatmap already rendered in the manager dashboard). No new component; just import and place it here.
  - **Middle column (cols 6–8)**
    - **High-intent products** card + **Rising intent** card stacked. Reuse `IntentSectionsCard`'s two sub-sections; if that component only renders as a single unit today, split it into `HighIntentCard` and `RisingIntentCard` presentational wrappers around the existing data so the two can stack vertically. No data change.
  - **Right column (cols 9–12)**
    - **Tagged products** accordion (existing block, unchanged data — Today / Yesterday / This week / This month buckets from item 3 below).
    - **Unread WhatsApps** card (existing block).
- All cards use the current `Card` / `CardContent` chrome with `p-4`, `space-y-*` matching the reference's calm spacing. No colour changes; no new tokens.
- Loader stays `briefingQueryOptions`; add `dashboardOverviewQueryOptions` to the loader `ensureQueryData` batch so the KPI + heatmap data are ready server-side.
- `PageHeader` stays at the top with the "Hello {store}" greeting.

No new files, no new server functions — every card already exists elsewhere in the app and is being re-composed here.

## 3. Briefing data — Today / Yesterday / This week / This month, grouped per product

**`src/lib/dashboard.functions.ts`** (`getBriefing` handler)
- Replace This Week / Last Week / month-name buckets with exactly four, in order: **Today**, **Yesterday**, **This week**, **This month**. Anything before the start of the current calendar month is excluded.
- Boundaries (local time, same style as existing `startOfWeek` helper):
  - Today: `ts >= startOfToday`
  - Yesterday: `startOfYesterday <= ts < startOfToday`
  - This week: `startOfWeek <= ts < startOfYesterday` (Monday-based)
  - This month: `startOfMonth <= ts < startOfWeek`
- Within each bucket, **group by product id** — collapse duplicate rows into one entry with `count` (times tagged in bucket) and most-recent `tagged_at`. Sort by count desc, then most-recent.
- Add `count: number` to `BriefingProduct`. `totalTagged` becomes sum of counts.

**`src/routes/_authenticated/briefing.tsx`**
- Render the four buckets in server order, empty ones omitted.
- Each row shows one unique product with a small `×N` badge on the right when `count > 1`.

## 4. Chrome tidy — remove two dividers

**`src/components/ui/sidebar.tsx`** (line ~242)
- Drop `group-data-[side=left]:border-r group-data-[side=right]:border-l` from the inner sidebar container div. `app-sidebar.tsx` sets `border-r-0` on the outer `Sidebar`, but the inner sibling div is what paints the vertical rule between nav and app canvas. Removing those utility classes on the primitive removes the line; the project only uses one Sidebar instance so no regression.

**`src/routes/_authenticated/inbox.tsx`** (line 117)
- Change `<div className="p-3 space-y-3 border-b border-border">` (wrapper around search input + `All / Unread / Mine / Open / Done` tabs) to `<div className="p-3 space-y-3">`. That is the horizontal rule under the tabs; surrounding column keeps its own borders.

## Technical notes
- No packages, no schema migration, no new server function.
- Removing the tile grid removes the black-shading bug.
- Briefing regrouping is a pure JS reshape of existing rows — no extra DB calls.
- Briefing redesign reuses `KpiCard`, `ScanTrendsCard`, `IntentSectionsCard` (splitting to two wrappers if needed) already in the codebase.

## Files touched
- `src/components/settings/taxonomy-engine-tab.tsx` — drop button + tile grid, add Select + Set-default.
- `src/lib/taxonomy.functions.ts` — auto-seed picks + marks AI-suggested default.
- `src/lib/dashboard.functions.ts` — new bucketing + per-product grouping.
- `src/routes/_authenticated/briefing.tsx` — 12-col infographic grid; render counts; loader batches KPI + briefing queries.
- `src/components/dashboard/intent-sections-card.tsx` *(only if needed)* — expose `HighIntentCard` / `RisingIntentCard` presentational splits so the Briefing middle column can stack them.
- `src/components/ui/sidebar.tsx` — drop left/right border utility classes on inner container.
- `src/routes/_authenticated/inbox.tsx` — remove `border-b border-border` on search+tabs wrapper.
