
## 1. New Information Architecture

Rebuild `src/components/app-sidebar.tsx` with grouped sections (collapsible group labels, mint-green active state, icon-only when collapsed):

```text
WORKSPACE
  • Dashboard                 /dashboard
  • Alerts                    /alerts          (merges Inbox + Notifications)

INTELLIGENCE
  • Overview                  /intelligence
  • Intent Score Engine       /intelligence/intent
  • Demand Forecasting        /intelligence/forecasting
  • Trend Detection           /intelligence/trends
  • Demand Insights           /intelligence/insights

PRODUCTS
  • Catalogue                 /products
  • Performance Compare       /products/compare
  (detail page already shows Intent + Forecast inline)

ACTIVATION
  • QR Tags                   /qr-tags
  • Watchlists                /watchlists
  • Customers                 /customers

COMMERCE INTELLIGENCE
  • ROI Engine                /commerce/roi
  • Pricing Sensitivity       /commerce/pricing
  • Conversion Funnel         /commerce/funnel

ANALYTICS  (read-only)
  • Executive Dashboards      /analytics
  • Historical Trends         /analytics/history
  • Reports & Exports         /analytics/reports

ORGANISATION
  • Stores                    /stores
  • Staff                     /staff
  • Permissions & Roles       /organisation/roles

SETTINGS
  • Intent Weighting          /settings/intent
  • Forecast Sensitivity      /settings/forecasting
  • Data Ingestion            /settings/ingestion
  • Integrations              /settings/integrations
  • Workspace / Billing / Security / Emails (existing tabs)
```

## 2. Module consolidation

- **Alerts** (`/_authenticated/alerts.tsx`): new shell with tabs `Inbox · Notifications · Watchlist events`, reusing existing Inbox three-pane and Notifications list components. Add redirects: `/inbox → /alerts?tab=inbox`, `/notifications → /alerts?tab=campaigns`, keep `/notifications/new` and `/notifications/$campaignId` working.
- **Intelligence hub** absorbs the standalone Intent page. `/intent` becomes a redirect to `/intelligence/intent`. Existing intelligence content is split into the four sub-routes (Intent / Forecasting / Trends / Insights), each pulling from the existing AI insight + intent server functions — no logic rewrite.
- **Commerce Intelligence**: move `/roi` under `/commerce/roi`; add lightweight Pricing Sensitivity and Conversion Funnel pages reusing existing analytics queries.
- **Analytics** is stripped to reporting only — no scoring/forecasting calls remain; charts read from already-computed columns.
- **Settings tabs reorganised**: add tabs for Intent Weighting, Forecast Sensitivity, Data Ingestion, Integrations.

## 3. Global UI overhaul

`src/styles.css` token updates:

```css
--sidebar-background: oklch(0.18 0.05 256);   /* deep navy #0a2540 */
--sidebar-foreground: oklch(0.96 0 0);
--sidebar-accent: oklch(0.68 0.16 162);       /* mint emerald #00b074 */
--sidebar-accent-foreground: oklch(0.18 0.05 256);
--radius: 0.75rem;                            /* 12px */
--shadow-card: 0 1px 2px rgb(10 37 64 / .04), 0 8px 24px -12px rgb(10 37 64 / .08);
--font-sans: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
```

- Load Plus Jakarta Sans via `<link>` in `src/routes/__root.tsx`.
- Active sidebar item: mint-green left border + soft mint background tint + white text.
- All cards, tables, dialogs, popovers standardised to `rounded-xl` with `shadow-card`.
- Top app header: align global ⌘K search, mint-tinted shortcut chip, user pill with avatar initials + role badge.

## 4. Sidebar logo

Edit `src/components/tag-logo.tsx`:
- Remove the "Tag" wordmark in all sidebar usages (`withWordmark={false}` default in sidebar).
- Scale image ~5× (h-14 expanded, h-10 collapsed). Update sidebar header height to accommodate; keep aspect ratio via `object-contain`.

## 5. Products page polish

`src/routes/_authenticated/products.index.tsx` + `ProductsTable`:
- Unified control bar: single rounded surface containing search + pill-shaped dropdowns (Status, Category, Store) with chevron-down icons.
- "On promo" / "Low stock" become Switch-style pill toggles with mint (on) / amber (low-stock) accents.
- Premium empty state component: illustrated icon block, "No products yet" headline, helper line, mint `+ Add Your First Product` primary CTA. Reused for filter-empty variant with a "Clear filters" secondary action.
- Table rows: 56px row height, thumbnail (rounded-md), SKU mono small caps, inventory count, category chip, status badges — green `Active`, amber `Low Stock`, mint `On Promo`, slate `Draft`.
- Skeleton shimmer rows on route transition (using shadcn `Skeleton`).

## 6. Sample data

The DB is already richly seeded (48 products, 150 customers, 864 scans, etc.). No new seed needed — the Products table will display 30+ real rows from the existing seed once the catalogue route renders them.

## Files touched

- `src/components/app-sidebar.tsx` — full rewrite to new IA.
- `src/components/tag-logo.tsx` — wordmark + size.
- `src/styles.css` — tokens, fonts, radius, shadow.
- `src/routes/__root.tsx` — Plus Jakarta Sans `<link>`.
- New routes: `alerts.tsx`, `intelligence.intent.tsx`, `intelligence.forecasting.tsx`, `intelligence.trends.tsx`, `intelligence.insights.tsx`, `products.compare.tsx`, `commerce.roi.tsx`, `commerce.pricing.tsx`, `commerce.funnel.tsx`, `analytics.history.tsx`, `analytics.reports.tsx`, `organisation.roles.tsx`, `settings.intent.tsx` (etc.).
- Old routes (`inbox.tsx`, `notifications.tsx`, `intent.tsx`, `roi.tsx`, `intelligence.tsx`) converted to redirects so nothing breaks.
- `ProductsTable`, `ProductsControlBar`, new `EmptyState` component.

## Out of scope (per "do NOT rebuild")

- No changes to server functions, AI logic, intent SQL, or RLS.
- No new database tables or seed data.
- Forecasting/Pricing/Funnel/Roles/History pages render from existing data sources; if a source doesn't yet exist for a sub-page it ships as a clearly-marked "Coming next" panel rather than fabricated logic.
