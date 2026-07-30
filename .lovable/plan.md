# Notification Engine (built on the existing watchlists system)

Twilio is delivery only. All rules, thresholds and dedupe live in TAG.

> **Security note:** you pasted a raw Twilio Auth Token in chat. Please rotate it in the Twilio console — I won't store it in code. Twilio credentials are already supplied to the app through the existing connector (`TWILIO_API_KEY` + gateway), and the sender number lives in the `TWILIO_WHATSAPP_FROM` secret, which I'll update to `+17374038456` (sandbox `+14155238886` as an optional test override).

## 1. Database — extend `watchlists` (no second watch table)

New columns on `watchlists`:

| Column | Purpose |
|---|---|
| `price_when_added` | Price (cents) when the customer started watching |
| `last_known_price`, `last_known_stock` | Last values the engine observed |
| `last_notified_price`, `last_notified_stock` | Dedupe for price / stock messages |
| `last_known_intent_score`, `last_interest_notification` | Dedupe + re-arm for high interest |
| `notifications_enabled` (default true) | Customer opt-out |
| `whatsapp_number` | Snapshot at watch time; falls back to `customers.whatsapp_e164` |
| `last_price_drop_sent`, `last_low_stock_sent`, `last_last_one_sent`, `last_back_in_stock_sent`, `last_high_interest_sent` | Per-rule send stamps |

Backfilled from current product values. Existing RLS, `watchlist_events`, triggers and the `/watchlists` screen keep working.

New table `automation_settings` (one row per retailer, per automation): `automation_key`, `enabled`, `threshold`, `template_name`, timestamps. Manager-only write via `can_manage_retailer`, with GRANTs.

## 2. Watch process

On QR scan → "Watch Product": create or refresh a `watchlists` row snapshotting customer, product, WhatsApp number, price, stock, intent score, date. Confirmation copy shown to the customer:

```text
You're now watching this product.
We'll notify you if:
 • Price drops
 • Stock runs low
 • It's the last one remaining
 • It comes back into stock
 • Interest increases
```

## 3. Architecture — four separate modules

```text
Product Watch Repository   src/lib/watch-repository.server.ts   all watchlists reads/writes
Notification Engine        src/lib/notification-engine.server.ts  pure rules, no Twilio
WhatsApp Service           src/lib/whatsapp-service.server.ts   templateName + to + vars -> send
Automation Settings        src/lib/automation-settings.functions.ts + settings UI tab
```

The engine returns `Decision { rule, watchId, templateName, variables }` and calls the WhatsApp Service — never Twilio directly. The WhatsApp Service resolves a template name to its approved Content SID (from secrets), calls the existing `sendWhatsApp()`, and knows nothing about rules. Adding a sixth notification type = one new `check*` method + one settings row.

## 4. Rules

- **Price drop** — effective price < `price_when_added` and < `last_notified_price`.
- **Low stock** — stock ≤ threshold (setting, default 3). Re-arms only after stock rises back above the threshold.
- **Last one** — stock exactly 1. Sends once; re-arms only after stock increases.
- **Back in stock** — stock goes 0 → >0. Sends once; re-arms only after stock returns to 0.
- **High interest** — `products.intent_score` crosses the configured threshold. Re-arms only after it drops back below.

Every rule is skipped when the automation is disabled, `notifications_enabled` is false, the watch isn't active, or the customer isn't subscribed. Dedupe stamps are written only after a successful send.

## 5. Automation Settings page

New Settings tab listing: Price Drop, Low Stock, Last One Remaining, Back In Stock, High Interest, Daily Intent Summary. Each row: enable/disable toggle, threshold input (where applicable), template name, and a live "template not yet approved in Twilio" warning when the SID is missing.

## 6. Daily manager summary

Evening `pg_cron` job → `/api/public/hooks/daily-summary`. Per retailer, sends the `daily_summary` template to the manager's WhatsApp with: products scanned today, highest intent-score product, products with price changes, low stock, back in stock, sold out, total notifications sent.

## 7. Triggering

- Immediately after any product price/stock/intent write (product save, imports, bulk edits, intent recompute).
- Periodically via the existing tick route, catching externally-changed data.

## Technical notes

- Templates: I'll list the approved Content Templates on your Twilio account via the connector, map the ones that exist, and give you exact body text to submit for the missing ones (`price_drop`, `low_stock`, `last_one`, `back_in_stock`, `high_interest`, `daily_summary`). Missing SIDs fall back to freeform (24h window only) and are logged, never silent.
- TypeScript throughout, small components, business logic in `.server.ts` services, UI purely presentational, each flow commented.
