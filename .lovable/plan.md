# TAG Retail / TAG Wallet split + Sustainability Impact module

Two pieces in one plan: reorganise the app into two persona experiences that share one backend, then add a Sustainability Impact dashboard inside TAG Retail as a switchable module.

## Part 1 — Two personas, one backend

Nothing in the data model changes. What changes is which navigation and shell a signed-in user gets.

**TAG Retail** (retail_admin, store_manager, sales_assistant, super_admin)
- Briefing, Inventory / QR management, Messages & customer engagement, Analytics (Sales, Intent Engine, Customer Insights, Store Performance, Sustainability), Admin, Pricing.

**TAG Wallet** (consumers — users with no retailer role)
- Digital receipts, Purchases, My Products, Warranties, Returns, Household. These are today's `/ownership/*` screens, re-homed under a wallet shell with its own lighter navigation.

**Landing is automatic by role.** After sign-in, a user with any retailer role lands in TAG Retail; a user with none lands in TAG Wallet. A user who has both (e.g. staff who also shop) gets a small persona switcher in the header — everyone else never sees it. Deep links keep working: hitting a wallet URL as a retailer-only user redirects to the retail equivalent and vice versa.

Existing URLs stay valid via redirects so nothing already shared or bookmarked breaks.

## Part 2 — Sustainability Impact dashboard

New Analytics sub-item, visible to retail admins, group and head-office users.

**Switchable both ways:** it is a tier feature (like ROI/Intelligence) *and* a per-retailer on/off setting in Settings. Off ⇒ the nav item and route disappear for that retailer.

**Header — live impact counter.** A green banner that counts up in real time: digital receipts issued, paper receipts avoided, thermal paper saved. Values animate on load and tick as new receipts arrive.

**Date selector:** Today, This Week, This Month, This Quarter, This Year, Since Joining TAG (default), Custom range. The reporting period ("14 March 2027 – Present") prints under the title.

**KPI cards**
- Digital Receipts — total issued, % of transactions digital, daily average, growth vs previous period.
- Paper Receipts Avoided — receipts eliminated, metres of receipt roll avoided, kg of thermal paper saved.
- Environmental Impact — CO₂e avoided, water saved, energy saved.
- Cost Savings — paper cost, printer maintenance, ink/ribbon, projected annual saving.

Every derived figure carries an info icon explaining its formula and the factor used.

**Charts and tables**
- Digital vs paper adoption over time (line).
- Monthly environmental impact — paper, CO₂e, water (grouped bars).
- Store comparison table, sortable by adoption, paper reduction and sustainability score.
- Adoption funnel: Transactions → Offered → Accepted → TAG installed → Wallet activated → Auto receipts on, with conversion % between stages.
- Store heat map: every store colour-coded green / amber / red by adoption; clicking one opens that store's detail.
- Leaderboards: top stores, top cashiers, top regions, highest customer adoption, most paper saved.
- Consumer impact: participating customers, average receipts stored, % on automatic Wallet ID, average paper saved per customer.

**Retailer ESG summary card** with the since-joining totals and an Export button producing PDF, Excel and CSV.

**AI insights** panel: stores with unusually low adoption, projected savings from a 10% adoption lift, sustainability trends, adoption opportunities, and recommended campaigns.

**Configuration** (admin only): average receipt length and weight, cost per receipt, printer maintenance cost, electricity cost, carbon and water conversion factors, currency, units. Defaults ship sensible industry values; every calculation reads these, never hard-coded numbers.

**Data:** all figures compute from real receipts, purchases, stores and customers. Because live receipt volume is still small, a clearly-labelled "Demo data" toggle overlays a seeded illustrative dataset so the dashboard can be shown at full scale — never mixed silently with real numbers.

**Look:** executive and ESG-led — large KPI cards, progress rings, green sustainability accents on the existing TAG palette, fully responsive.

## Technical notes

- New `sustainability_settings` table (per-retailer conversion factors, costs, currency, units, module on/off) with GRANTs + RLS scoped to the retailer; admin-only writes.
- Receipt/paper metrics derive from `receipts`, `purchases`, `stores`, `customers`; a `sustainability.functions.ts` server-function module does the aggregation server-side with `requireSupabaseAuth`, returning plain DTOs.
- New tier feature key `sustainability`; nav gating reuses `NAV`/`useTier` plus the per-retailer setting.
- Routes: `src/routes/_authenticated/analytics.sustainability.tsx` (+ store detail child). Persona shells: retail keeps the existing `_authenticated` layout; wallet gets a sibling layout wrapping the ownership routes, with role-based redirect in `beforeLoad`.
- Exports use the existing export helpers; PDF generated client-side from the rendered summary.
- AI insights go through the Lovable AI gateway, cached per retailer/period.
- Seeded demo dataset lives in a migration behind a `is_demo` flag so it can be filtered out.
