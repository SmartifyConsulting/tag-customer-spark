## Build the global WhatsApp broadcast feature

The `broadcast_campaigns` table exists but no send function, no UI. This plan wires the whole flow end-to-end.

### 1. Server function — `sendMarketingBroadcast`

New file `src/lib/broadcasts.functions.ts`:

- `listBroadcasts()` — recent broadcasts for the retailer (paged).
- `previewBroadcastAudience({ productId? })` — returns opted-in customer count so the composer can show "will send to N customers" before send.
- `sendMarketingBroadcast({ heading, body, productId?, imageUrl? })`:
  1. `requireSupabaseAuth` + `canManage` retailer check.
  2. Enforce plan quota via existing `notification_usage_counters` helpers (`src/lib/billing/overage.server.ts`); reject if quota exhausted and no overage allowed.
  3. Select customers where `marketing_opt_in = true` AND phone present AND not on suppression list, scoped to retailer.
  4. Insert one `broadcast_campaigns` row (status `sending`).
  5. For each recipient: insert `notification_history` row, send via Twilio WhatsApp (existing gateway pattern in `src/lib/notifications.functions.ts`), update row with provider SID / error.
  6. Update counters + broadcast summary (`sent`, `failed`, `finished_at`).
  7. Return `{ broadcastId, sent, failed, skipped }`.

Batching: process in chunks of 25 with `Promise.allSettled` to stay within Worker CPU limits; large audiences fall back to enqueuing (out of scope for v1 — cap at 500 recipients per call, surface a friendly error above that).

### 2. UI — WhatsApps screen ("Inbox")

- New button "New broadcast" in the WhatsApps header (`src/routes/_authenticated/inbox.tsx`).
- New component `src/components/notifications/broadcast-composer-dialog.tsx`:
  - Fields: heading, body (with existing `MessagePlaceholders` drag-drop), optional product picker, optional image URL.
  - Live audience preview using `previewBroadcastAudience`.
  - Quota bar (reuses billing usage query).
  - Confirm step: "Send to N customers?" → calls `sendMarketingBroadcast`, shows toast with sent/failed counts.

### 3. Broadcast history

- New section on WhatsApps screen listing recent broadcasts (sender, sent-at, audience size, delivered %, click-through).
- Row click opens a drawer with per-recipient status from `notification_history`.

### 4. Migration touch-ups

Verify `broadcast_campaigns` has columns: `id, retailer_id, created_by, heading, body, product_id, image_url, audience_size, sent_count, failed_count, status, started_at, finished_at, created_at`. Add anything missing + GRANTs + RLS (retailer-scoped read, retail_admin/store_manager insert). Add `marketing_opt_in` to `customers` if not already present, plus an index on `(retailer_id, marketing_opt_in)`.

### Technical notes

- Twilio call uses existing gateway pattern (`GATEWAY_URL`, `LOVABLE_API_KEY`, `TWILIO_API_KEY`, `TWILIO_WHATSAPP_FROM` secrets — all present).
- Plan cap: Growth/Pro allow broadcasts; Starter capped at 100 recipients/day; free tier disabled with upgrade CTA.
- Respect per-customer suppression + do-not-disturb window (skip 21:00–07:00 local retailer TZ) — reuses whatever `notifications.functions.ts` already does; if absent, add basic quiet-hour check.

### Out of scope (v1)

- Scheduled broadcasts (send now only).
- A/B testing.
- Template library (composer is free-form + placeholders).
