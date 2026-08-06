# Scan → Opt-in → Product alerts on WhatsApp

Make the barcode scan send the `tag_scan_v5` template, treat its "Keep an eye on me"
button as the opt-in, and only then send the three follow-up alert templates.

## The journey

```text
Customer scans barcode
        │
        ▼
tag_scan_v5  (product photo header, product name)
   [Keep an eye on me]
        │  tapped
        ▼
Watch created + consent recorded
        │
        ├── price drops        → tag_valuechange
        ├── others show intent → tag_interest
        └── 1 unit left        → tag_lastunit
```

## What changes

1. **Scan message.** The barcode opt-in endpoint currently sends the `barcode_scan`
   template. It will send `tag_scan_v5` instead, with the scanned product's photo as
   the image header.

2. **No alerts before the button.** Today a scan immediately creates an active watch.
   That becomes a *pending* watch: recorded against the customer and product, but with
   notifications off, so no price/interest/last-unit message can go out yet. The
   customer's interest still shows in the Inbox and dashboards exactly as now.

3. **Button tap = opt-in.** The Infobip webhook will recognise the "Keep an eye on me"
   button reply, find the product from the scan message that was sent to that number,
   activate the watch, snapshot the current price and stock as the baseline, and log the
   consent. A confirmation line is added to the customer's conversation so staff can see
   they opted in.

4. **Alert templates renamed.** The existing notification rules keep their logic and
   de-duplication; only the template they send changes:
   - price drop → `tag_valuechange`
   - other interest in the product → `tag_interest`
   - stock hits 1 → `tag_lastunit`

5. **Variable order.** `tag_valuechange` is sent as: 1 = reduced price (e.g. R 350.00),
   2 = product name, 3 = the price at scan time. `tag_interest` and `tag_lastunit` will
   be sent with the product name, and all three carry the product photo as the header.
   If Infobip rejects a send because a placeholder count differs, that is the signal the
   template expects a different order and I will correct it against the rejection.

## Technical notes

- `src/routes/api/public/scan.barcode-interest.ts`: send template `tag_scan_v5`;
  create the watch through `createOrRefreshWatch` with `notifications_enabled: false`
  and status `paused`.
- `src/routes/api/public/webhooks/infobip.ts`: add a button-payload branch matching
  "Keep an eye on me" (case/punctuation-insensitive). Resolve the product from the most
  recent `notification_history` row of type `barcode_scan`/`tag_scan_v5` for that
  customer, then flip the watch to `active`, set `notifications_enabled`,
  `price_when_added`, `last_known_stock`, and stamp `notify_consent_at`.
- `src/lib/automation.ts` / `automation.server.ts` defaults and
  `src/lib/notification-engine.server.ts`: map rules `price_drop → tag_valuechange`,
  `high_interest → tag_interest`, `last_one → tag_lastunit`. Retailer-level template
  overrides in `automation_settings` continue to win.
- `checkPriceDrop` variable block reordered to `{1: new price, 2: product name,
  3: price_when_added}`; header image switches from retailer logo to product photo for
  these three rules.
- No schema changes needed — `watchlists` already has `notifications_enabled`, status,
  and the snapshot/dedupe columns.
