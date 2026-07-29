## Goal

Your Twilio credentials changed, so every WhatsApp send in the app is now authenticating with stale keys. We refresh the stored connection, then prove delivery end to end.

## What's connected today

- The app talks to Twilio through the Lovable connector gateway using the workspace connection named **Tag** (Twilio, API-key auth), already linked to this project.
- All sends go through one helper (`src/lib/whatsapp.server.ts`), used by scan opt-ins, watchlist alerts, broadcasts and the inbound webhook. So one credential refresh fixes all paths.
- The sender number comes from the `TWILIO_WHATSAPP_FROM` secret.

## Steps

1. **Reconnect the Twilio connection.** I open a reconnect card in chat; you paste the new credentials. Twilio's connector expects an **API Key SID + API Key Secret + Account SID** (created in Twilio Console → Account → API keys & tokens), not the raw Auth Token. If you only have the new Account SID + Auth Token, you can generate a Main API Key in that same screen — I'll wait for you.
2. **Verify the credentials** with a non-destructive gateway credential check, so we know auth works before sending anything.
3. **Confirm the sender number.** Check that `TWILIO_WHATSAPP_FROM` still matches the WhatsApp sender on the new account; update the secret if the number changed.
4. **Send a live test message** to a phone number you give me, via the gateway, and report Twilio's exact status/error back.
5. **Test the real flow.** Scan (or open) a tagged product, opt in with that same number, and confirm the conversation-starter WhatsApp arrives and the message lands in the Inbox.

## Known blocker from last time

Twilio previously returned error **20422 – region capability not available** for South African numbers on sender `+1 571 626 7022`. If the new account has the same restriction, the test will fail with that same code. Fix in Twilio Console → Messaging → Settings → **Geo Permissions**: enable South Africa. Worth enabling before step 4.

## Also worth checking (business-initiated sends)

Outbound messages sent more than 24h after the customer's last inbound message need an approved Content Template. The app supports this via `TWILIO_TEMPLATE_CONVERSATION_STARTER_SID` and `TWILIO_TEMPLATE_BARCODE_SCAN_SID`. Template SIDs are per-account — if the new Twilio account is a different account (not just rotated keys on the same one), those SIDs are invalid and the templates must be recreated and the secrets updated. I'll check this in step 3.

## What I need from you

- The new Twilio credentials (entered in the secure reconnect card, never in chat).
- A WhatsApp number to send the test message to.
- Whether this is the **same Twilio account with rotated keys**, or a **brand-new account**.
