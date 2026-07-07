
## Goal

Replace the current 3-tier system with the 5-tier "base + overage" model. Full per-tier detail below.

## Tier detail

### Tag Go — R149/mo
Mobile traders, flea market vendors, pop-up stalls.
- **Notifications:** 50 included / month · R1.50 per msg above 50
- **Alert types:** Sale, back-in-stock, new arrival (low-stock, promotion, custom **locked**)
- **Inbox:** Basic — read & reply only
- **Stores & products:** 1 stall or store · up to 10 products · store-level opt-in only · QR tag generation
- **Analytics:** Scan counts & active subscriber total (intent scoring, ROI engine, AI intelligence **locked**)
- **Management:** 1 user login (staff roles, multi-store **locked**)

### Tag Starter — R399/mo
Small independents finding their feet with Tag.
- **Notifications:** 150 included / month · R1.40 per msg above 150 · all 6 alert types · full inbox (assign, note, resolve, tag) · coupon code redemption
- **Stores & products:** 1 store · up to 20 products · item + store-level opt-in
- **Analytics:** Scan counts, opt-in history & active subscribers · campaign performance · basic customer list (intent scoring, ROI engine, AI intelligence **locked**)
- **Management:** 2 user logins · basic staff roles (multi-store **locked**)

### Tag Growth — R699/mo
Established independents scaling their customer base.
- **Notifications:** 300 included / month · R1.30 per msg above 300 · all 6 alert types · full inbox · coupon code redemption · scheduled campaigns · AI message assist
- **Stores & products:** 1 store · up to 50 products · item + store-level opt-in
- **Analytics:** Full campaign analytics · intent score engine · customer revenue tracking · watchlist management (ROI engine, AI daily briefing, forecasting **locked**)
- **Management:** 3 user logins · full staff roles (multi-store **locked**)

### Tag Pro — R1,299/mo
Serious independents and small multi-branch retailers.
- **Notifications:** 600 included / month · R1.20 per msg above 600 · all 6 alert types · full inbox · coupon code redemption · scheduled campaigns · AI message assist
- **Stores & products:** Up to 3 stores · unlimited products · item + store-level opt-in
- **Analytics — full suite:** Full campaign analytics · intent score engine · ROI engine · AI daily briefing · weekly ROI email report · pricing sensitivity · scan heatmap · forecasting (7 + 14 day)
- **Management:** 10 user logins · full staff roles · multi-store (up to 3) · quarterly card refresh

### Tag Enterprise — Custom / branch
Regional chains and national retailers — priced per branch.
- **Notifications:** Negotiated rate per branch · volume-based overage · all alert types · full WhatsApp inbox · coupon redemption · scheduled campaigns · AI message assist
- **Stores & products:** Unlimited stores/branches · unlimited products · item + store-level opt-in
- **Analytics — full suite +:** Everything in Pro · cross-store intelligence · cross-store transfer alerts · executive briefing suite · CFO-level ROI reporting · custom data exports · API access
- **Management & support:** Unlimited users · dedicated account manager · SLA uptime guarantee · staff training & onboarding · custom card printing · white-label option

Ideal candidates: Go — flea market / pop-up / home-based. Starter — small boutique, gift shop, independent shoe store. Growth — active boutique, homeware, jewellery, lifestyle brand. Pro — high-volume independent, 2–3 branches. Enterprise — 5+ branches, national retailers, franchise groups, shopping-centre operators.

## Scope

### 1. Tier model (`src/lib/tier.ts`, `src/lib/billing/pricing.ts`)
- `TagTier` = `"go" | "starter" | "growth" | "pro" | "enterprise"`; ranks 0…4.
- `PLANS` entries carry: `price_zar_monthly`, `price_usd_monthly`, `included_notifications`, `overage_cents_per_msg`, `max_products` (null = unlimited), `max_stores`, `staff_seats`, `alert_types: ("sale"|"back_in_stock"|"new_arrival"|"low_stock"|"promotion"|"custom")[]`, `inbox: "basic"|"full"`, `features: string[]`, `locked: string[]`, `ideal_candidate`, `custom?: true`.
- `TIER_LABEL`: Tag Go / Starter / Growth / Pro / Enterprise.
- `FEATURE_MIN_TIER`:
  - `qrGeneration` → `go`
  - `fullInbox`, `couponRedemption`, `advancedExports` → `starter`
  - `aiAssistant`, `scheduledCampaigns`, `intentEngine`, `campaignAnalytics`, `customerRevenue`, `watchlists` → `growth`
  - `roi`, `forecasting`, `weeklyBriefings`, `multiStore`, `pricingSensitivity`, `scanHeatmap`, `aiDailyBriefing` → `pro`
  - `intelligence`, `crossStore`, `executiveBriefings`, `apiAccess`, `sso`, `customExports` → `enterprise`

### 2. Database migration (single new migration)
- Widen `retailers.tier` and `subscriptions.plan` allowed values to the 5 tiers via `USING` cast; existing `starter/pro/enterprise` rows preserved (semantics of `enterprise` shift to "custom").
- New `notification_usage_counters` (retailer_id, period_start, period_end, included, sent_count, overage_cents_accrued, updated_at) + GRANTs + RLS (retailer members SELECT own, service_role ALL).
- New `notification_overage_invoices` (retailer_id, period_start, period_end, msg_over, amount_cents, currency, provider, provider_txn_id, status) + GRANTs + RLS.
- New `sales_leads` (id, retailer_id, name, email, branches, message, status, created_at) + GRANTs + RLS.

### 3. Server functions (`src/lib/billing.functions.ts`)
- `CheckoutInput` / `PaypalOrderInput` plan enum → `["go","starter","growth","pro"]`; enterprise rejected.
- `changePlan` accepts all 5; enterprise returns `{ contact_sales: true }`.
- `adminSetTier` accepts all 5.
- New `getMyUsage` → current counter row + projected overage in ZAR.
- New `contactSalesForEnterprise` → insert `sales_leads` + email via `email.server.ts`.

### 4. Overage accounting (`src/lib/billing/overage.server.ts`, new)
- `incrementNotificationUsage(retailerId, count)` called after each successful send in `whatsapp.server.ts` and `hooks.notifications-tick.ts`.
- Guard: Go/Starter block sends once counter exhausts included quota (no auto-overage); Growth/Pro accumulate overage; Enterprise metered but never blocked.
- New `hooks.billing-rollover.ts` cron endpoint: on period end, close counter, insert `notification_overage_invoices` row, email PayFast/PayPal payment link via active provider.

### 5. UI

**`src/components/settings/billing-tab.tsx`**
- 5 plan cards in a responsive grid; enterprise card dark-styled like the mockup with "Contact sales" CTA → dialog (name, branches, message) → `contactSalesForEnterprise`.
- Each card renders: price, notifications block, alert-types list, stores & products, analytics, management, ideal-candidate footer. Locked features rendered muted with a lock icon.
- New "Usage this period" panel above invoices: sent vs included progress bar + projected overage in ZAR (`getMyUsage`).

**`src/routes/_authenticated/upgrade.tsx`**
- Rebuild comparison table with 5 columns matching the mockup rows (notifications, alert types, inbox, stores & products, analytics, management, ideal candidate).

**`src/components/settings/plan-admin-tab.tsx`**
- Tier `<Select>` extended to 5 options.

### 6. Feature-gate sweep
- Update every `hasFeature` / `meetsTier` call site across `src/routes/_authenticated/*` and `src/components/**` to the new min-tier map.
- Notifications composer disables locked alert types with an inline "Upgrade to Starter" hint on Go.

### 7. Copy / labels
- Notifications UI shows "X / Y sent this period · Z overage" using new counter.

## Out of scope
- Meta Business 250-user cap logic.
- Per-branch enterprise pricing engine (sales handles offline).
- Two-way conversation cost accounting.
- Rewriting PayFast/PayPal ITN handlers — they keep working, just handle the wider plan enum.

## Technical notes
- PayFast = ZAR only; PayPal = USD only. Both accept the 4 self-serve tiers; enterprise never hits checkout functions.
- Annual pricing: monthly × 10 (≈17% off).
- All prices, caps, alert-type maps, and overage rates live in `src/lib/billing/pricing.ts` — single source of truth.
- Every new `public.*` table gets `GRANT` + RLS per project rules.
