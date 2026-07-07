## Scope

Frontend / presentation changes only, plus one feature-gate flag flip and removing the Campaigns route.

### 1. Nav rename — "Items & Tags" → "Inventory"

- `src/lib/nav.ts`: change `title` on the products entry to `"Inventory"`.
- `src/components/mobile-bottom-nav.tsx`, `src/components/command-palette.tsx`: update any hardcoded label to match.
- `src/routes/_authenticated/products.index.tsx`: `PageHeader` title → `"Inventory"`, head meta title → `"Inventory — Tag"`.

### 2. Inventory table — column changes

`src/components/products/products-table.tsx`:

- Remove the **Status** column (drops the `StockPill` cell + header). Delete the now-unused `StockPill` component.
- Rename the stock column header to **Qty** and render just the numeric `stock_qty` (tabular-nums). Low/out styling kept as text colour only (amber / rose).
- Add **Size** and **Colour** columns sourced from `r.size` / `r.color` (already on the product row from `listProducts` — verify during build; if missing, extend the select in `src/lib/products.functions.ts` and the `ProductRow` type only).
- Final column order: checkbox · Product · Price · Qty · Size · Colour · QR · Interest · actions.

### 3. Add notification counts strip to Inventory

Above the accordion in `products.index.tsx`, render a compact row of 4 pills mirroring the uploaded reference — **Queued · Sent · Read · Clicked** — scoped to the current workspace / filtered set.

- New server fn `getInventoryNotificationCounts` in `src/lib/products.functions.ts` (or a new `inventory-stats.functions.ts`) aggregating `notification_history` rows by status columns (`queued_at`/`sent_at`/`read_at`/`clicked_at`).
- Small new component `src/components/products/notification-counts-strip.tsx` — 4 chips with count + label, matching the reference style (grey/blue/amber/orange dots, count above label).

### 4. Lock AI Opportunity Feed to Tag Pro

- `src/lib/tier.ts`: add/adjust `FEATURE_MIN_TIER.opportunityFeed = "pro"`.
- `src/components/dashboard/opportunity-feed.tsx`: wrap in a `<FeatureGate feature="opportunityFeed">` (or existing `hasFeature` check via `useTier`) — render a locked-state card with "Upgrade to Tag Pro" CTA linking to `/upgrade?feature=opportunityFeed` for lower tiers.

### 5. Remove Campaigns screen

The app doesn't have campaigns — only stock/price change alerts.

- Delete route files: `src/routes/_authenticated/notifications.tsx`, `notifications.index.tsx`, `notifications.new.tsx`, `notifications.scheduled.tsx`, `notifications.$campaignId.tsx`, `notifications.$campaignId.edit.tsx`, `_authenticated/alerts.tsx`.
- Delete unused components under `src/components/notifications/` that were campaign-composer specific (`campaign-composer.tsx`, `ai-campaign-assist.tsx`, `message-placeholders.tsx`). Keep `status-badge.tsx` and `whatsapp-preview.tsx` if referenced elsewhere (verify with rg during build).
- `src/lib/nav.ts`: remove the "Campaigns" nav entry. Mobile nav + command palette follow.
- Any `<Link to="/notifications">` etc. references — remove or repoint to `/inbox`.
- Backing data (`notification_campaigns` table, `notifications.functions.ts` server fns) stays for now — only the UI is removed.

### 6. Update "Campaign Performance" frame → "Notification Performance"

`src/components/dashboard/notification-performance-card.tsx`:

- Retitle to **"Notification performance"** with copy: "Stock-back and price-drop alerts sent to customers who scanned these items."
- Replace campaign-centric columns (campaign title, type) with per-alert-type rows: **Back in stock**, **Price drop**, **Low stock**, **New arrival**, **Promotion**, **Custom** — showing Sent · Delivered · Read · Clicked · Redeemed · CTR.
- Feed from existing `campaignPerformance` in `getAdvancedAnalytics` regrouped by `type` instead of `id` (adjust the aggregation server-side in `src/lib/analytics.functions.ts`).
- Also flows into the dashboard equivalent via `dashboard.functions.ts` — same regroup.

### 7. Signal Contributions card on Dashboard

New card `src/components/dashboard/signal-contributions-card.tsx`, added to `src/routes/_authenticated/dashboard.tsx` (below KPIs, above Opportunity Feed).

- Nine signal bars matching the reference: **Scans · Repeat scans · Time on page · Unique viewers · Watchlist · Notif engagement · Conversion rate · Cart rate · Price impact**.
- Layout: 3-column grid on desktop, each row = label · thin progress bar · % on the right. Amber accent matching screenshot.
- Data: extend `dashboard.functions.ts` (or new `getSignalContributions` server fn) computing each signal's contribution weight to the workspace's overall intent score, plus a per-product breakdown array.
- **Drill-in**: clicking a signal row opens a sheet/dialog `signal-detail-sheet.tsx` listing top products contributing to that signal (product name · thumb · that signal's value · contribution %) with a link through to `/products/$id`.

### Out of scope

- No pricing/tier changes beyond the Opportunity Feed flag.
- Campaign backing tables and server functions remain — only the UI is removed so the data path for future re-use stays intact.
- No schema migrations.

## Technical notes

- Verify `ProductRow` already carries `size` and `color` in the `listProducts` select — the schema has them (`products.schemas.ts`), so most likely just add to the `.select(...)` in `src/lib/products.functions.ts` and to the `ProductRow` type.
- `FeatureGate` pattern: reuse whatever pattern `NAV` items with `feature:` use in `app-sidebar.tsx` — surface the same `hasFeature(tier, "opportunityFeed")` check inside the card.
- Signal Contributions computation lives server-side to avoid shipping raw scan data to the client; drill-in fetches on demand.
