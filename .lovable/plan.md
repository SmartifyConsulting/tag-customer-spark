# Fix: WhatsApp messages still not arriving

## What the data shows (verified, not assumed)

Every recent WhatsApp attempt is recorded as failed in notification history, all with the same provider response:

- Latest failure: 8 Aug 2026 09:35 UTC, template `tag_scan_v5`
- Provider reply: HTTP `401` / `UNAUTHORIZED` — "Invalid login details"
- Credential used: the `INFOBIP_API_KEY_V2` binding (fingerprint `28b989c2…`, 69 characters)
- API host used: `k9v331.api.infobip.com`, sender ending `7608`

So the app is reaching Infobip on every path (scan opt-in, price drop, admin test) and Infobip is rejecting the credentials before the message is ever queued. There is no app-side bug left in this chain — the message never gets past authentication.

Two things can produce this exact response, and we have not yet separated them:
1. The stored key value is not a currently valid key for that account (wrong/rotated/partly copied — 69 characters is unusual for an Infobip key).
2. The key is valid but restricted (IP allowlist / disabled scope), so it works from a normal machine but not from our hosting runtime.

## Plan

1. **Isolate key vs. restriction.** Call the Infobip account balance endpoint with the exact stored key from two places: our server runtime and an outside machine. Same host, same key, no message involved.
   - Fails in both → the key value itself is bad; go to step 2.
   - Works outside, fails in our runtime → the key is IP-restricted; go to step 3.
2. **If the key is bad:** you generate a fresh API key in Infobip (Developers > API keys) with WhatsApp send permission and no IP restriction, and confirm the Base URL shown on your Infobip home page. I store both, redeploy, and re-run the live test.
3. **If it is IP-restricted:** the allowlist has to be removed on that key (our hosting uses rotating IPs and cannot be pinned). Same re-test afterwards.
4. **Confirm the sender.** Verify the WhatsApp sender ending `7608` is the registered sender on that same Infobip account, since a sender belonging to a different account also surfaces as an auth-level rejection.
5. **Re-test end to end** once authenticated: admin live test send, then a real Follow Me opt-in on the live page, and confirm the notification history row moves to sent/delivered rather than failed.

## Notes

- No customer data is lost while this is broken: scans, interests, watches and conversations are still recorded; only the WhatsApp confirmation fails.
- Nothing in this plan changes templates or the notification rules — those were already validated against Infobip and are not the cause.
- Steps 2 and 3 need one action from you inside the Infobip dashboard; everything else I do here.
