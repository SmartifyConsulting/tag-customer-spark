
# Tag — Phased build plan

You picked **Two phases**, **phone-based watchlists**, **staff-only redemption**, **Lovable AI (Gemini 3 Flash for live insights, Gemini 2.5 Pro for weekly reports)**.

I'll plan both phases now so the data model is coherent end-to-end, then build **Phase 1 only** in the next turn. Phase 2 builds after you approve Phase 1.

---

## PHASE 1 — AI Retail Intelligence + Intent Score (next build turn)

### 1. AI Retail Intelligence

**New surfaces**

- **Opportunity Feed** card on the Dashboard (top of page, above existing KPIs). Cards like "42 customers waiting on 6 products", "Sofa: 137 scans / 0 promos", "Discount Product A 10% → ~R26,000 recoverable".
- **AI Copilot drawer** on the notification composer:
  - **Write** (generate WhatsApp campaign from product + type)
  - **Rewrite** (tighten / change tone: urgent, friendly, premium)
  - **Predict response** (estimated open/click/redeem % for current audience)
  - **Best send time** (recommendation based on past scan/notification timing per retailer)
- **Conversation summary** button in the Inbox header → 2-line TL;DR + suggested reply.
- **Slow-movers & Hot products** strip on the Products page (AI-tagged, not just rule-based).
- **Likely-to-buy** column on the Customers page (per-customer purchase probability).
- **Executive summary** banner on Dashboard (refreshed daily).
- **Weekly Retailer Report** auto-generated every Monday 06:00 store-local; archived under `/reports`, PDF export.

**AI wiring**

- New helper `src/lib/ai-gateway.server.ts` using the canonical Lovable AI Gateway provider.
- `src/lib/ai.functions.ts` with server functions: `writeCampaign`, `rewriteCampaign`, `predictCampaignResponse`, `recommendSendTime`, `summariseConversation`, `generateOpportunityFeed`, `generateExecutiveSummary`, `generateWeeklyReport`.
- Default model `google/gemini-3-flash-preview`. Weekly report uses `google/gemini-2.5-pro`.
- All AI calls retailer-scoped via `requireSupabaseAuth` + `has_role` check.
- Structured output (`Output.object` + Zod) so the UI renders cards, not raw prose.

**Persistence**

- `ai_insights` table: id, retailer_id, kind (`opportunity` | `executive_summary` | `weekly_report` | `conversation_summary`), payload jsonb, related_entity (product/campaign/customer/conversation), score, generated_at, expires_at, status.
- `ai_recommendations` table for "discount X by 10% → R26k" with `action_type`, `entity_id`, `projected_value_cents`, `confidence`, `accepted_at` / `dismissed_at`.
- `pg_cron` jobs hitting public hook routes (anon key in `apikey` header):
  - `06:00 daily` → `/api/public/hooks/ai-daily-brief` (opportunity feed + executive summary per retailer)
  - `Monday 06:00` → `/api/public/hooks/ai-weekly-report`
  - `*/15 min` → `/api/public/hooks/notifications-tick` (already exists from previous turn)

### 2. Intent Score Engine v1

**Schema additions**

- New table `product_intent_signals` (rolling per-product aggregation, recomputed by trigger + cron):
  scans_total, scans_unique, repeat_scans, avg_time_on_page_seconds, viewers, watchlist_adds, notif_engagement, conversion_rate, add_to_cart_rate, price_impact, sample_size, updated_at.
- Add columns to `products`:
  intent_score numeric(5,2), intent_score_confidence numeric(3,2), intent_score_trend text check (`rising|falling|stable`), intent_score_updated_at timestamptz.
- New table `product_intent_history` (daily snapshot of score) for trend + forecasting.
- New table `product_intent_forecast` with predicted_score_7d, predicted_score_14d, predicted_trend, forecast_confidence, computed_at.
- New table `intent_score_weights` (per retailer override of the default weights from the spec).
- Add `viewed_at` / `dwell_ms` columns to `qr_scans` (the public scan landing already fires; we'll also POST a dwell beacon on unload).

**Computation**

- Pure SQL function `public.recompute_product_intent(_product_id uuid)` doing the normalization + weighted score in the spec (Scans 0.15 / Repeat 0.10 / Time 0.10 / Viewers 0.10 / Watchlist 0.10 / NotifEng 0.10 / Conversion 0.20 / Cart 0.10 / Price 0.05, ×100, clamp 0–100). Defaults to 50 when sample_size = 0; flags low-confidence when sample_size < 30.
- Event-driven triggers on `qr_scans`, `customer_interests`, `notification_history`, `sales_recoveries`, `products.price` change → enqueue product id into `intent_recompute_queue`.
- `pg_cron` every 5 minutes → `/api/public/hooks/intent-recompute` drains the queue (chunked, max 500 products/run) and snapshots history.

**Forecasting v2 (same phase)**

- SQL function `public.forecast_product_intent(_product_id uuid)`:
  - momentum = (score_now − score_7d_ago) / 7
  - acceleration = momentum − previous_momentum
  - predicted_7d = clamp(score_now + momentum·7 + acceleration·3, 0, 100)
  - predicted_14d = clamp(score_now + momentum·14, 0, 100)
  - confidence from sample_size + variance of last 14 days
- Runs nightly via cron; on-demand recompute when a product detail page loads.

**UI**

- **Product list**: Intent Score badge (red/amber/green) + trend arrow on each row, sortable by score.
- **Product detail**: large score gauge, signal contribution bars, AI-generated insight line, "Demand Forecast" Recharts line (history + 7/14-day projection, dashed forecast segment, confidence band).
- **Dashboard sections**: "High Intent" (>75), "Rising Intent" (top 7-day delta), "Conversion Gap" (high intent + low conversion).
- **Settings → Intent Engine** (super_admin / retail_admin only): tweak weights, forecast sensitivity (conservative / balanced / aggressive), update frequency, enable/disable forecasting.

### Phase 1 file list

```text
supabase/migrations/<ts>_phase1_intent_and_ai.sql
src/lib/ai-gateway.server.ts
src/lib/ai.functions.ts
src/lib/intent.functions.ts
src/lib/insights.functions.ts
src/routes/api/public/hooks.ai-daily-brief.ts
src/routes/api/public/hooks.ai-weekly-report.ts
src/routes/api/public/hooks.intent-recompute.ts
src/routes/api/public/scan.dwell.ts
src/components/dashboard/opportunity-feed.tsx
src/components/dashboard/executive-summary.tsx
src/components/dashboard/intent-sections.tsx
src/components/intent/intent-badge.tsx
src/components/intent/intent-gauge.tsx
src/components/intent/intent-signal-bars.tsx
src/components/intent/intent-forecast-chart.tsx
src/components/ai/ai-copilot-drawer.tsx       (notification composer)
src/components/ai/conversation-summary.tsx    (inbox)
src/routes/_authenticated/reports.tsx          (weekly report archive + PDF download)
src/routes/_authenticated/settings.intent.tsx  (weights + forecast config)
edits: dashboard.tsx, products list + detail, notifications.new.tsx, inbox.tsx, customers list
```

---

## PHASE 2 — Customer Watchlists + ROI Engine (turn after Phase 1)

### 3. Customer Watchlists (phone-based)

**Schema**

- `watchlists` (id, customer_id, name, status, channel='whatsapp', created_at).
- `watchlist_items` polymorphic: target_type (`product|brand|category|collection|price_range`), target_id, params jsonb (e.g. `{max_price: 5000, currency:'ZAR'}`), notify_on (`price_drop|back_in_stock|low_stock|weekend_promo|new_collection`).
- `customer_preferences` (paused_at, paused_until, quiet_hours, total_notifications_sent_30d).
- `watchlist_engagement` rollup (per watchlist: sent / clicked / redeemed / revenue_recovered_cents).

**Customer surfaces**

- After the scan opt-in success state, prompt: "Want updates on more {brand}? Add to watchlist". Adds an item with one tap, no login.
- `/me/$token` page (signed token sent over simulated WhatsApp magic link) → manage watchlists, pause/stop. Token in `customer_magic_tokens` (24-hour, single-use to mint a session cookie).
- WhatsApp keyword handler (inbound webhook stub): `PAUSE`, `PAUSE 7D`, `STOP`, `RESUME` → updates `customer_preferences`. Inbound messages are logged in the existing Inbox.

**Retailer surfaces**

- New sidebar item **Watchlists** (under Customers): top brands followed, top categories followed, members per item, conversion to recovery.
- Automated trigger rules:
  - Price drop ≥ 5% on a watched product → enqueue notification.
  - Stock crosses low_stock_threshold → "Only X Left" notification.
  - Back-in-stock detection (quantity 0 → >0).
  - Friday 10:00 local → Weekend Promotion notification per retailer.
  - New product in followed brand/category → New Collection alert.
- Quiet hours respected (default 21:00–08:00 local), max 1 alert per customer per 24h.

### 4. ROI Engine (hero feature)

**Schema**

- Every row inserted into `notification_history` already gets a payload; add `redemption_code` (unique per row, base32, 8 chars). Backfill existing rows.
- `sales_recoveries` already exists — extend with `notification_id` (already there), `redeemed_by_user_id`, `redeemed_at`, `store_id`, `pos_reference`, `notes`.
- `roi_summary_daily` materialized view (refresh nightly) for fast dashboards.

**Staff redemption surface**

- New top-level page `/redeem` (any staff role): big code input → server function `redeemNotificationCode` validates code, finds the message, prefills customer/product/campaign, asks for purchase value + store, writes `sales_recoveries`, flips notification status to `redeemed`.
- "Redeem at this store" button on the conversation panel and on customer detail (one-click prefill).

**ROI dashboards**

- New top-level page `/roi`:
  - Hero KPIs: Revenue recovered (period), Campaign ROI %, Revenue per notification, Avg purchase after notification, Avg recovery time.
  - **Most profitable campaigns** table (sortable, sparkline of recoveries).
  - **Store ROI** map/list. **Product ROI** table.
  - Filters: date range, store, campaign type. Export CSV/Excel/PDF reusing the analytics export wiring.
- Embed a compact "ROI today" tile on Dashboard, and per-campaign ROI on the campaign detail page (replaces the funnel-only view with funnel + revenue).

### Phase 2 file list (preview only)

```text
supabase/migrations/<ts>_phase2_watchlists_and_roi.sql
src/lib/watchlists.functions.ts
src/lib/roi.functions.ts
src/routes/api/public/wa.inbound.ts          (WhatsApp keyword webhook stub)
src/routes/api/public/hooks.watchlist-tick.ts (price drop / restock / weekend scans)
src/routes/me.$token.tsx                      (customer self-serve)
src/routes/_authenticated/watchlists.tsx
src/routes/_authenticated/redeem.tsx
src/routes/_authenticated/roi.tsx
src/components/roi/*  src/components/watchlists/*
edits: scan.$shortCode.tsx (post-success watchlist prompt), notifications.$campaignId.tsx (ROI tab), customers detail
```

---

## Technical notes (for the technical reader)

- **AI provider boundary**: `src/lib/ai-gateway.server.ts` holds the canonical `createLovableAiGatewayProvider` helper. Server functions import it dynamically inside handlers so the server-only module never reaches client bundles.
- **Structured AI output**: every AI call uses `Output.object({ schema: z.object(...) })` so the UI renders typed cards. Failures (`429`, `402`, validation) surface as visible error states with retry, not silent fallbacks.
- **Cron**: all new hooks live under `/api/public/hooks/*` (auth bypassed on published sites). Each handler verifies the `apikey` header matches the project anon key before doing anything; nothing privileged runs on a missing header. `pg_cron` uses the stable `project--<id>.lovable.app` URL.
- **Idempotency**: redemption codes are unique; `redeemNotificationCode` upserts on `(notification_id)` so re-scans don't double-count revenue. Watchlist tick uses `last_fired_at` per (watchlist_item, rule) with a 24h debounce.
- **Realtime**: existing `supabase_realtime` publication extended to include `ai_insights` and `sales_recoveries` so the Dashboard and ROI page update live.
- **RLS**: every new table reuses `belongs_to_retailer` / `can_manage_retailer` helpers. Public-facing tables (`customer_magic_tokens`, `watchlists` via token) read through a narrow security-definer function rather than broad `anon` policies.
- **Performance**: `product_intent_signals` is the read source for UI; full recompute drains a queue table populated by triggers, so the 5-min cron is cheap. The forecasting line uses `product_intent_history` aggregated server-side, not row-by-row client math.
- **Migrations**: created tables follow the four-step pattern (CREATE → GRANT → ENABLE RLS → CREATE POLICY) with `service_role` grants for cron-hit hooks.

---

## What I'll do after you approve

Build **Phase 1 only** in the next turn (AI Retail Intelligence + Intent Score + Forecasting). When Phase 1 looks right in preview, say "ship phase 2" and I'll build Watchlists + ROI.
