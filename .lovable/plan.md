# Fix: broadcast WhatsApps not arriving

## What the evidence shows

The service-role key diagnosis is not the cause. That key is present and working in this project, and the broadcast run actually completed end to end:

- Two broadcasts were recorded: "This is a Broadcast Test Message" and "50% Weekend Sale", both `status = sent`, 2 recipients each, 0 failures.
- All four message rows have a provider message ID, meaning the WhatsApp provider accepted each send and returned an ID.

So the app sent them. What is missing is delivery: unlike ordinary notifications (which move to `delivered`/`queued`/`failed` as delivery reports come back), all four broadcast rows are still stuck at `sent` — no delivery report ever landed for them. That pattern points at the message being dropped after acceptance, which for business-initiated WhatsApp almost always means the template itself was rejected: wrong template name, wrong language, or a header/variable shape that does not match what was approved.

The broadcast path uses template `tag_broadcast_v1`, language `en_GB`, an IMAGE header, and two variables (`heading`, `body`) — and when no broadcast image is given it silently falls back to the workspace logo. Both test broadcasts were sent with no image.

## Plan

1. **Confirm the real cause before changing anything.** Add an admin-only diagnostic that pulls the provider's delivery report for a given broadcast's message IDs and shows the exact rejection text (the app already has the report-fetch call, it is just not wired to broadcasts). Run it against the "50% Weekend Sale" broadcast. This turns "probably template rejection" into the actual provider error string.

2. **Reconcile the broadcast template with what is approved.** Using the report from step 1, correct the stored contract for `tag_broadcast_v1` — name, language code, header type, and variable count — so the payload matches the approved template exactly.

3. **Make the broadcast image compulsory.** The approved broadcast template carries an image header, and today the composer lets a broadcast go out with no image, silently falling back to the workspace logo (or failing late). Instead: the image becomes a required field in the broadcast composer — the "Send broadcast" button stays disabled until an image is supplied, with an upload option as well as a URL field, and the image is validated as a publicly reachable https URL before send. The server keeps rejecting an imageless broadcast as a safety net, with a clear message. No silent logo substitution.


4. **Surface delivery status in the UI.** The broadcast list currently only shows "sent" (accepted by the provider). Add a delivered / read / failed breakdown per broadcast, sourced from the delivery-report rows, so a silent non-delivery is visible immediately instead of looking like a success.

5. **Stop reporting silent successes.** When a broadcast's messages are all accepted but no delivery report arrives within a short window, mark the broadcast as needing attention rather than leaving it green.


## Technical notes

- Files touched: `src/lib/broadcasts.functions.ts` (report lookup, status rollup), `src/lib/whatsapp-templates.server.ts` (`tag_broadcast_v1` contract), `src/lib/whatsapp-infobip.server.ts` (reuse the existing reports call), and the broadcasts list UI.
- No schema change is expected; `notification_history` already carries `provider_message_sid`, `status` and `error`, and the delivery-report webhook already maps provider statuses onto those rows.
- No new secrets are needed, and the service-role key should not be re-entered.
