## Scope

Four modules built in sequence on top of the existing schema. WhatsApp is **simulated** end-to-end: messages move through queued → sent → delivered → read → clicked → redeemed via background jobs and inbox actions, no external provider. The landing-page form requires only WhatsApp notify consent; marketing + privacy boxes are optional and recorded.

---

## 1. Customer scan landing (`/scan/$shortCode`)

Replace the current placeholder with a conversion-tuned, mobile-first page.

- **Public loader** uses a publishable-key client to fetch a safe slice: retailer name + logo, store name, product (name, brand, description, price, sale_price, hero image, currency), and `qr_tag.id`. New narrow `TO anon` SELECT policies projected through a `public_scan_view` so we never widen base tables.
- **Layout** (one-thumb scroll):
  1. Retailer logo bar (sticky, soft shadow).
  2. Full-bleed hero image, rounded-2xl, ~16:10.
  3. Product name + brand chip.
  4. Price block — strikethrough original beside sale price in emerald when on promo; price-drop badge.
  5. 2-line description.
  6. Primary CTA: "Notify me on WhatsApp" (navy, full-width, sticky on small viewports).
  7. Trust line: "We only message you about this product. Unsubscribe anytime."
- **Notify sheet** (Drawer on mobile, Dialog on desktop):
  - Fields: Name, WhatsApp number (intl phone input with country picker, E.164 normalization), required notify-consent checkbox, optional marketing-consent checkbox, optional privacy-acceptance checkbox.
  - Zod validation; submit disabled until name + valid phone + notify consent.
- **Submission** → public server route `POST /api/public/scan/interest`:
  - Verifies the short code is active.
  - Upserts `customers` by `(retailer_id, whatsapp_e164)`; stores consent flags + timestamps.
  - Inserts `customer_interests` row linking customer ↔ product ↔ qr_tag with `status='active'`.
  - Returns `{ ok, customer_id }`. All writes via `supabaseAdmin` loaded inside the handler; input validated with Zod.
- **Success state** swaps the CTA for an emerald confirmation card: "You're on the list" + what to expect + "Browse more from {retailer}" link back to retailer landing (optional v2).
- Framer-motion fade/slide for hero and CTA; confetti pulse on success.

---

## 2. Notification engine (`/notifications`)

- **List page**: tabs for Drafts / Scheduled / Sending / Completed; cards show type badge, audience size, scheduled time, delivery funnel.
- **Composer** (`/notifications/new`, also edit):
  - Type selector chips: Sale, Low Stock, Back in Stock, Promotion, Custom — each pre-fills headline/body templates and inferred audience (e.g. Low Stock → customers interested in products below threshold).
  - Fields: hero image (Storage upload, optional), headline (60), body (rich plain text, 600), CTA label + URL, expiry datetime, redemption-code link (pick from `redemption_codes` or generate new).
  - Audience picker: product(s), store(s), interest filters → live count.
  - Schedule: "Send now" or pick datetime (tz-aware).
- **WhatsApp preview**: phone-frame mock on the right, live-binding to the form. Shows image bubble, bold headline, body, CTA button styled like WhatsApp interactive template, expiry footer.
- **Send pipeline** (simulated):
  - Save → `notification_campaigns` row with `status` (draft/scheduled/sending/completed).
  - Server fn `enqueueCampaign` fans out `notification_history` rows (one per audience customer) with `status='queued'`.
  - `pg_cron` job hits a public route `/api/public/hooks/notifications-tick` every minute: promotes queued→sent→delivered→read on staggered timers (simulated delivery rates), records timestamps. Click and redeem transitions happen when the customer (us, simulating) opens the message link → `/n/$messageId` route flips `clicked_at`, and entering the redemption code at checkout endpoint flips `redeemed_at`.
  - Funnel chart on campaign detail: Queued → Sent → Delivered → Read → Clicked → Redeemed with counts + %.

---

## 3. Customer inbox (`/inbox`)

Intercom-style three-pane layout:

- **Left rail**: filter chips (All, Unread, Mine, Mentions, Resolved), saved searches, tag pills, unread badge per filter.
- **Middle list**: conversations sorted by last_message_at; row shows customer avatar/initials, last snippet, unread dot, assigned-staff chip, tag chips, time-ago.
- **Right pane**: message thread with WhatsApp-style bubbles (inbound left, outbound right), composer at bottom.
  - Composer actions: Reply (logs `conversation_messages` outbound row, status='queued', no external send), Add internal note (separate `is_internal=true` row, yellow background), Assign staff (dropdown of retailer's staff), Tag (multi-select chips), Mark resolved.
  - Header: customer name, phone, status pill, quick actions.
- **Customer profile panel** (slide-over from right edge): name, phone, consent flags, lifetime scans, interests list (with product thumbnails), past campaigns received, recoveries.
- Realtime: subscribe to `conversation_messages` + `conversations` via Supabase Realtime so new inbound messages light up instantly.
- Search: full-text over messages + customer name/phone (Postgres `ilike` for v1).

Schema additions: `conversations.assigned_to`, `tags text[]`, `is_resolved`, `conversation_messages.is_internal`.

---

## 4. Advanced analytics (`/analytics`)

- **KPI strip**: Total scans, Unique customers, Returning customers, Recovered revenue, Avg recovery time, Notification CTR.
- **Charts** (Recharts):
  - Scan trend (daily/weekly/monthly toggle) with anomaly highlighting.
  - Customer growth (new vs returning stacked area).
  - Top products bar (scans + recoveries dual axis).
  - Top stores bar.
  - Campaign performance — funnel + table.
  - Heatmap: scans by weekday × hour (custom SVG grid, navy intensity scale).
- **Filters bar**: date range, store, category, product — URL-synced.
- **Exports**:
  - **CSV** + **Excel** (client-side via `xlsx`) of the filtered dataset.
  - **Branded PDF report**: server-fn `generateAnalyticsReportPdf` renders with `pdf-lib` — cover page with retailer logo + period, KPI grid, charts rendered server-side as PNG via `@napi-rs/canvas`-free path (we'll pre-render chart data as SVG strings then rasterize with `resvg-wasm` which is Worker-safe), and data tables. Returned as a download.

---

## Technical details

- **Migrations**:
  1. `public_scan_view` + `TO anon` SELECT policies on it; helper RPC `record_interest` (not used — we go through admin route for atomic upsert).
  2. Add columns: `customers.notify_consent_at`, `marketing_consent_at`, `privacy_accepted_at`; `conversations.assigned_to uuid`, `tags text[]`, `is_resolved bool`; `conversation_messages.is_internal bool`.
  3. `ALTER PUBLICATION supabase_realtime ADD TABLE conversations, conversation_messages;`
  4. `pg_cron` job for notification tick (every minute) calling the public hook.
- **Server functions** (`src/lib/*.functions.ts`):
  - `scan.functions.ts`: `getPublicScan` (public publishable client).
  - `notifications.functions.ts`: list/get/upsert/enqueue/cancel campaigns; funnel stats.
  - `inbox.functions.ts`: list conversations, get thread, post reply/note, assign, tag, resolve.
  - `analytics.functions.ts`: KPIs, trend, heatmap, top lists, export-dataset, PDF generator.
- **Public routes**:
  - `POST /api/public/scan/interest` — submit form.
  - `POST /api/public/hooks/notifications-tick` — cron-driven simulator.
  - `GET /n/$messageId` — click-tracking redirect (also public).
- **Libraries to install**: `react-phone-number-input`, `libphonenumber-js`, `xlsx`, `pdf-lib` (already present), `@resvg/resvg-wasm`, `framer-motion` (if not present), `date-fns-tz`.
- **Buckets**: reuse `product-images` for campaign hero (separate `campaign-assets` bucket created via tool, private, signed URLs at send time). Retailer logo already in `retailer-logos`.
- **RLS**: every new column inherits existing retailer-scoped policies via `belongs_to_retailer`. Public view exposes only the safe columns enumerated above.
- **Build order**: landing → notification engine (schema + composer + simulator) → inbox (schema + UI + realtime) → analytics (charts + exports). Each module ships independently typechecked.

```text
scan QR  ─►  /scan/:code  ─►  POST /api/public/scan/interest
                                      │
                                      ▼
                              customers + customer_interests
                                      │
        retailer creates campaign ────┤
                │                     ▼
        notification_campaigns ─► notification_history (queued)
                                      │  pg_cron tick
                                      ▼
                          sent → delivered → read → clicked → redeemed
                                      │
                                      ▼
                          inbox conversations + analytics rollups
```
