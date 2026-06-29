## Current build status

| Module | Status | Notes |
|---|---|---|
| AI Retail Intelligence | ✅ Built | `/intelligence` — daily Opportunity Feed, exec briefing, weekly consultant report, AI assist in composer, inbox summarise. |
| Intent Score Engine | ✅ Built | `recompute_product_intent` SQL, 9-signal weights, badges, per-product panel, sections card. |
| Intent Forecasting | ✅ Built | `forecast_product_intent` 7/14-day projections, trend chart, confidence. |
| Watchlists | ❌ Missing | Only `customer_interests` exists as a scan-time proxy — no customer-facing watchlist, no "notify me when X" semantics, no retailer view. |
| ROI Engine | ❌ Missing | `sales_recoveries` table exists but there is no dedicated ROI surface, attribution model, or executive ROI dashboard. |
| Customers page | ⚠️ Placeholder | |
| QR Tags page | ⚠️ Placeholder | (functionality lives only inside product detail) |
| Stores page | ⚠️ Placeholder | |
| Staff page | ⚠️ Placeholder | |
| Settings page | ⚠️ Placeholder | |

To feel enterprise-grade for major retail chains, we need to (1) ship the two missing pillars, (2) replace every placeholder with a real, polished module, and (3) apply a consistent enterprise polish pass across the platform.

---

## What I'll build

### 1. Watchlists module (new pillar)
- DB: `public.watchlists` (customer × product, trigger: `on_sale | back_in_stock | low_stock | price_drop_below`, target_price, channel, status, created_by) + `watchlist_events` audit. GRANTs + RLS scoped per retailer; customer-facing rows readable via signed link only.
- Auto-trigger: DB function fires watchlist matches when product price/stock changes → enqueues into `notification_history` as a "watchlist" campaign type.
- Customer side: add "Notify me when…" picker on `/scan/$shortCode` opt-in sheet (price drop, back in stock, low stock).
- Retailer side: `/watchlists` page — table of active watchlists, conversion funnel, top-watched products, "Trigger now" manual override, exportable.

### 2. ROI Engine (new pillar)
- DB: `roi_attributions` (campaign_id, customer_id, product_id, attributed_revenue_cents, margin_cents, cost_cents, model, window_hours). View `roi_campaign_summary` and `roi_retailer_summary`.
- Attribution: when a `sales_recovery` is recorded within an attribution window of a notification click/scan, attribute revenue to that campaign/QR tag; configurable last-touch vs first-touch.
- `/roi` page: hero KPIs (Revenue Recovered, ROI ×, Cost per Recovered Sale, Payback), campaign ROI leaderboard, product ROI, channel ROI (QR vs Notification vs Watchlist), incremental-lift chart, CSV/PDF export.
- Settings tab for attribution window + cost-per-message inputs.

### 3. Replace placeholder pages with real modules

**Customers (`/customers`)**
List/search/segment customers (opted-in, churn-risk, VIP by scans, lifetime recovered revenue). Detail drawer with timeline (scans, interests, watchlist, conversations, recoveries), consent state, GDPR/POPIA export & delete, tags.

**QR Tags (`/qr-tags`)**
Cross-product QR registry: table of every tag with product, store, scans (7/30/all), unique customers, conversion %, last scan, status. Bulk regenerate, bulk PDF, reassign-to-product, deactivate. Filters by store/category/status.

**Stores (`/stores`)**
CRUD with map pin, hours, manager assignment, per-store KPIs (scans, opt-ins, recovered revenue, top products), staff roster, leaderboard.

**Staff (`/staff`)**
Invite by email (Supabase Admin invite via server fn gated by `retail_admin`/`super_admin`), role assignment with retailer scoping, store assignments, activity stream, deactivate/transfer.

**Settings (`/settings`)** — tabbed
- Workspace (retailer name, logo upload to `retailer-logos` bucket, brand colors used in QR PDFs & WhatsApp preview)
- WhatsApp Business (phone number, sender ID, simulated provider for now)
- Branding (QR card template, footer text)
- Attribution & ROI (window, cost per message, currency)
- Intent Engine (link to existing `/intent`)
- Billing (read-only summary from `subscriptions`)
- Security (sessions, 2FA placeholder, audit-log link)
- Notifications preferences
- Danger zone (export workspace, delete)

### 4. Enterprise polish pass (every page)
- **Global command palette** (`⌘K`) — jump to any product/customer/campaign/store/page.
- **Consistent page chrome** — every page gets `PageHeader` with breadcrumbs, primary action, secondary actions, segmented filter bar, saved-view tabs.
- **Empty, loading, error states** standardised — no raw spinners; skeletons matched to layout.
- **Tables** — sticky header, column visibility, density toggle, sortable headers, CSV export, URL-synced pagination/filters (already partial in Products — extend to all).
- **Audit log surface** — `/settings/audit` viewer on top of existing `audit_logs` table with filters.
- **Keyboard shortcuts panel** (`?`).
- **Toaster** consistency, destructive confirms via AlertDialog.
- **Currency/locale** — ZAR default, formatter helper used everywhere; per-retailer currency setting.
- **Accessibility** — focus rings, aria labels on icon buttons, contrast audit in dark mode.
- **Responsive sweep** — every new page verified at mobile / tablet / desktop.
- **Sidebar** updated with Watchlists, ROI, Inbox, Intelligence grouped under "Engage" / "Grow" / "Operate" sections; collapsed-rail tooltips.

### 5. Cron / automation
- Add pg_cron: nightly `intent-tick`, nightly `daily-brief`, weekly `weekly-report`, hourly `watchlist-trigger-scan`, hourly `roi-attribution-sweep`.

---

## Technical notes

- All new tables follow the standard pattern (uuid, created_at/updated_at, created_by, status) with `GRANT … TO authenticated` + `GRANT ALL TO service_role` + RLS using existing `belongs_to_retailer` / `can_manage_retailer` helpers.
- Server logic via `createServerFn` + `requireSupabaseAuth`; admin operations (invite user, attribution sweep) gated by role checks before importing `supabaseAdmin`.
- AI calls continue through the Lovable AI gateway (`google/gemini-3-flash-preview` default, `pro` for weekly reports).
- Watchlist auto-trigger and ROI attribution use SQL triggers + `/api/public/hooks/*` endpoints for cron.
- No edits to auto-generated Supabase files. Seed data extended via migration for the new tables so demos look real.

---

## Suggested order

1. Watchlists (DB → customer opt-in UI → retailer page → trigger hook)
2. ROI Engine (DB + attribution → page → Settings tab)
3. Replace placeholders: Customers → QR Tags → Stores → Staff → Settings
4. Polish pass: command palette, sidebar grouping, table primitives, audit viewer, shortcuts, locale
5. Cron registration

I'll batch parallel work where safe and keep typecheck green after each module.
