# Switch WhatsApp delivery from Twilio to Infobip

Good news: every outbound WhatsApp send in TAG already funnels through one
file (`src/lib/whatsapp.server.ts`), and all template resolution through
`src/lib/whatsapp-service.server.ts`. The Notification Engine, daily summary,
broadcasts, watchlist dispatch and scan opt-ins call those two helpers, so
none of the business logic changes. Only the delivery layer and the inbound
webhook are replaced.

## What I need from you

1. **Infobip API key** — I'll request it via the secure secret form.
2. **Your Infobip base URL** — each account gets a personal one, shown on the
   Infobip dashboard homepage, e.g. `xyz123.api.infobip.com`.
3. **Your WhatsApp sender number** — the number registered to your Infobip
   WhatsApp account (E.164, e.g. `+27...`). During testing this can be the
   Infobip demo sender.
4. Template names you have registered/approved in Infobip. Infobip uses
   **template names + a language code** rather than Twilio Content SIDs,
   which simplifies our config.

## Changes

### 1. New delivery adapter
`src/lib/whatsapp-infobip.server.ts`:
- Free-form text → `POST {BASE_URL}/whatsapp/1/message/text`
- Media → `.../message/image`
- Approved template → `POST {BASE_URL}/whatsapp/1/message/template`
- Auth header `Authorization: App {INFOBIP_API_KEY}`.
- Normalises Infobip's response (`messages[0].messageId`, `status.groupName`)
  into the existing `{ ok, status, sid, error }` shape, and surfaces Infobip's
  own error text rather than a generic failure.

### 2. Provider switch in `whatsapp.server.ts`
`sendWhatsApp()` keeps its exact signature and result type but routes to
Infobip when `WHATSAPP_PROVIDER=infobip` (the default once the Infobip secrets
exist), falling back to the current Twilio gateway path otherwise. Nothing
that calls it needs editing.

### 3. Templates by name, not SID
`whatsapp-service.server.ts` gains an Infobip branch: instead of resolving
`TWILIO_TEMPLATE_*_SID`, it passes the template name straight through
(`price_drop`, `low_stock`, `last_one`, `back_in_stock`, `high_interest`,
`daily_summary`, `tag_product_scan`) with a language code (default `en`) and
our existing ordered variables as Infobip `placeholders`. Header image, where
a template has one, maps to the template header media URL.
`watchlist-dispatch.server.ts` and the two scan routes switch from reading
SIDs directly to `sendTemplate({ templateName })`.

### 4. Inbound + delivery webhooks
New `src/routes/api/public/webhooks/infobip.ts`:
- Inbound customer replies → reuse the same conversation/message logging the
  Twilio webhook does today (so the Inbox keeps working unchanged).
- Delivery reports (`SENT / DELIVERED / READ / REJECTED`) → update
  `notification_history` with real statuses, replacing today's simulated
  `queued → sent → delivered → read` tick.
- Secured with a shared secret we generate and you paste into the Infobip
  webhook config (Infobip has no HMAC signature, so a secret query parameter
  or custom header is the standard approach).

Webhook URL for Infobip: `https://tag-tech.co.za/api/public/webhooks/infobip`

The Twilio helper and webhook stay in place, unused, so flipping back is one
setting change.

### 5. Settings visibility
The Automations tab shows which provider is active and flags any automation
whose template name isn't configured — same behaviour as today.

## Technical notes

- Secrets: `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_WHATSAPP_SENDER`,
  `INFOBIP_WEBHOOK_SECRET`, `WHATSAPP_PROVIDER`.
- Calls go direct over HTTPS from server code — no connector gateway, which
  removes the Twilio API-key vs Auth-token confusion you hit.
- The WhatsApp 24-hour session rule is a Meta platform rule, so it still
  applies on Infobip: business-initiated messages need an approved template.
- No Twilio-style geo-permission block (`20422`) — South African destinations
  work once your sender is registered.
