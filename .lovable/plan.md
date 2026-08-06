# Fix WhatsApp template rejection

## Confirmed diagnosis

Infobip is accepting the API request, but WhatsApp later rejects `tag_scan_v5` with code `7008` because the submitted media/template parameters do not match the approved template.

The current scan flow sends:
- template: `tag_scan_v5`
- language: the global configured language, defaulting to `en`
- header: an IMAGE containing the scanned product image
- body placeholders: one value containing the product name

Because the initial scan message is rejected, the customer receives nothing at all after opting in, and a later price reduction produces no alert.

## Corrected opt-in model

Opt-in happens on the web page: tapping **Follow Me** after entering the phone number IS the consent. From that moment the watch must be created **active** — no WhatsApp button tap is required to activate it.

After opting in, the customer receives only these three alerts:
- `tag_interest` — other customers show interest in the product
- `tag_valuechange` — the price drops
- `tag_lastunit` — only one unit remains

`tag_scan_v5` becomes a simple confirmation of the opt-in, not an activation gate.


## Implementation

1. **Match the approved template exactly**
   - Retrieve/confirm the live `tag_scan_v5` template definition for the registered sender, including language, header type, body variable count/order, and button payload.
   - Update the scan send to match that definition exactly rather than relying on generic numbered variables and a global language assumption.
   - Validate that the product image is a public HTTPS media URL before including it; handle the approved no-image shape explicitly if the template permits it.

2. **Activate the watch at opt-in**
   - Create the watch as `active` when Follow Me is submitted, snapshotting price and stock at that moment as the alert baseline.
   - Remove the paused-until-button-tap dependency so alerts work even if the confirmation message fails.
   - Keep the WhatsApp reply buttons working for commit, take-it-slow and unsubscribe, but they are no longer required for activation.

3. **Add explicit contracts for all TAG templates**
   - Define the expected language, header type, and ordered placeholders for `tag_scan_v5`, `tag_valuechange`, `tag_interest`, and `tag_lastunit` in one server-side template registry.
   - Build provider payloads from those contracts so a body value cannot accidentally be treated as a media parameter or sent in the wrong order.
   - Fail clearly before sending when a required template parameter is missing; do not use freeform fallback for business-initiated alerts outside WhatsApp’s 24-hour session window.
   - Restrict post-opt-in sends to the three alert templates only.

4. **Track real delivery outcomes**
   - Keep the initial API acceptance as `queued`, not `sent`.
   - Update notification history from Infobip delivery callbacks to `delivered`, `read`, or `failed`, preserving code `7008` and its description for support visibility.
   - Surface the exact provider failure reason in Automations.

5. **Verify the complete customer flow**
   - Scan the Baby Blue Jumper, enter the number, tap Follow Me, and confirm the watch is created active.
   - Confirm the `tag_scan_v5` confirmation reaches `DELIVERED` rather than only `PENDING_ENROUTE`.
   - Reduce the price and confirm `tag_valuechange` is delivered with the correct image and values.
   - Exercise the interest and last-unit builders against their approved definitions.

## Technical scope

Primary files:
- `src/lib/whatsapp-infobip.server.ts`
- `src/lib/whatsapp-service.server.ts`
- a focused server-only TAG template contract module
- `src/routes/api/public/scan.barcode-interest.ts`
- `src/lib/watch-repository.server.ts`
- `src/routes/api/public/webhooks/infobip.ts`
- `src/lib/notification-engine.server.ts`

No AI functionality or unrelated product/inventory behavior will be changed.