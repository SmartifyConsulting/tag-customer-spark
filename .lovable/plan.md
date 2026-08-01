# Switch WhatsApp delivery from Twilio to Meta WhatsApp Cloud API

Yes — this is a contained change. Every outbound WhatsApp send in TAG already
goes through one file (`src/lib/whatsapp.server.ts`), and all template logic
goes through `src/lib/whatsapp-service.server.ts`. The Notification Engine,
daily summary, broadcasts and scan opt-ins call those helpers, so they do not
change at all. Only the delivery layer and the inbound webhook are replaced.

## What you need from Meta first

1. A Meta Business account with WhatsApp Business Platform enabled.
2. A WhatsApp Business phone number (or the free test number to start).
3. From the Meta app dashboard:
   - **Phone Number ID** (not the phone number itself)
   - **WhatsApp Business Account ID**
   - **Permanent access token** (System User token, never the temporary 24h one)
   - A **webhook verify token** you invent yourself
4. Message templates created and approved in Meta Business Manager. Meta uses
   **template names** (e.g. `price_drop`) rather than Twilio Content SIDs —
   which actually simplifies our config.

I will request these as secrets once you confirm; nothing is hardcoded.

## Changes

### 1. New delivery adapter
`src/lib/whatsapp-meta.server.ts` — posts to
`https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages` with the
permanent token. Supports text, media and template messages with positional
body parameters plus optional header image.

### 2. Provider switch in `whatsapp.server.ts`
`sendWhatsApp()` keeps its exact signature and result shape
(`{ ok, status, sid, error }`) but routes to Meta when
`WHATSAPP_PROVIDER=meta` (default once configured), falling back to Twilio if
Meta secrets are absent. Nothing that calls it needs editing.

### 3. Templates by name, not SID
`whatsapp-service.server.ts` stops resolving `TWILIO_TEMPLATE_*_SID` when in
Meta mode and passes the template name straight through
(`price_drop`, `low_stock`, `last_one`, `back_in_stock`, `high_interest`,
`daily_summary`, `tag_product_scan`). Variables map to Meta's numbered body
parameters in the same order we already use. `watchlist-dispatch.server.ts`
and the two scan routes switch to `sendTemplate({ templateName })` instead of
reading SIDs directly.

### 4. Inbound webhook
New `src/routes/api/public/webhooks/meta-whatsapp.ts`:
- `GET` — Meta's subscription handshake using the verify token.
- `POST` — verifies the `X-Hub-Signature-256` HMAC against the app secret,
  then reuses the same conversation/message-logging logic the Twilio webhook
  uses today (inbound messages, plus delivery/read status updates, which Meta
  reports natively — better than the simulated tick we run now).

Callback URL to paste into Meta: `https://tag-tech.co.za/api/public/webhooks/meta-whatsapp`

The Twilio webhook and helper stay in place, unused, so you can flip back by
changing one setting.

### 5. Settings visibility
The Automations tab shows which provider is active and warns per automation
when its template name is missing, same as today.

## Technical notes

- Secrets: `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`,
  `META_WHATSAPP_BUSINESS_ID`, `META_WHATSAPP_VERIFY_TOKEN`,
  `META_WHATSAPP_APP_SECRET`, `WHATSAPP_PROVIDER`.
- Meta calls go direct over HTTPS from server code — no connector gateway,
  which removes the Twilio API-key/Auth-token confusion you hit.
- The 24h session window rule is identical on Meta: business-initiated
  messages must use an approved template.
- No geo-permission blocking like Twilio's `20422` — South African numbers
  work as soon as the number is verified.
- Delivery-status webhooks let us replace the simulated
  `queued → sent → delivered → read` promotion with real Meta statuses.
