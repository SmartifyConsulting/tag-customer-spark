# Troubleshoot: manual WhatsApp reply fails with "Invalid login details"

## What the evidence shows

Confirmed from live worker logs and a direct test just now:

- Your reply at 17:01 (SAST) failed with HTTP 401, provider error `UNAUTHORIZED` / "Invalid login details", key binding `INFOBIP_API_KEY_V2`, fingerprint `28b989c2…`, host `k9v331.api.infobip.com`, sender `…7608`.
- The exact same stored credential (same 69-character length, same fingerprint `28b989c2…`) authenticates successfully from the app's build runtime: `GET /whatsapp/1/senders` returns **200** with sender `15553467608` `CONNECTED`.

So the credential is correct and correctly bound. The same key is accepted from one network origin and rejected from the deployed server's origin. This is not a Messages-screen bug, not a template problem, and not a 24-hour-window problem — the request never gets past authentication.

Older log lines mentioning `INFOBIP_API_KEY_V3` are from earlier builds; the current code uses one binding only.

## Plan

1. **Capture what the deployed runtime actually sends.** Run the existing authentication probe against the live site. It reports, without revealing the key: the HTTP status Infobip returns, whether the `Authorization` header leaves the runtime intact, and the outbound IP address Infobip sees. This distinguishes "header mangled in transit" from "origin rejected by Infobip".

2. **If the header is intact (expected):** the rejection is origin-based on the Infobip side. Resolve it in the Infobip console for the key in use:
   - Developers → API keys → open the key ending `…72ed` and confirm **Allowed IP addresses** is empty (an allowlist that omits the app's outbound IP produces exactly this 401).
   - Check account-level security settings for an IP allowlist or an "API access" restriction applied to the whole account, not just the key.
   - Once cleared, no code change is needed — the reply path already reads the key per request.

3. **If Infobip cannot accept the app's outbound addresses,** route outbound sends through a fixed, allowlistable origin instead of the app's serverless network, and add that address to the Infobip allowlist. This is a delivery-path change only; the Messages screen, templates and notification rules stay as they are.

4. **Verify in this order** after whichever fix applies:
   - Connection check from Settings → Automations returns 200.
   - One manual reply in Messages to +27 82 801 4801 shows as sent, with an Infobip message ID recorded.
   - The failed reply already in the thread can be retried without creating a duplicate message.

## Notes

- Nothing in this plan changes credentials or code before step 1's evidence is in, so we do not chase a second wrong cause.
- The reply you sent is stored as failed rather than silently discarded, so it can be retried once delivery is restored.
