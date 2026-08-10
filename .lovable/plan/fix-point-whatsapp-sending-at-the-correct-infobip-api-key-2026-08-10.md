# Fix: point WhatsApp sending at the correct Infobip API key

The app currently authenticates to Infobip with a key that is being rejected (401 "Invalid login details") from the live runtime. You've confirmed the key itself is the wrong one, and supplied the correct value.

## What will change

1. **Replace the stored Infobip credential.** Update the single credential the app uses (`INFOBIP_API_KEY_V2`) with the correct key you provided. For safety, the value gets entered through the secure secret form rather than being pasted into code — it is never written into the repo.
2. **No code changes required.** The provider layer already reads this one secret at call time (fresh binding per request), so once the value is corrected both paths — inbox replies and the public Follow Me / scan flow — use it automatically.

## Verification (done as part of this change)

- Run the read-only connection check against Infobip from the live runtime and confirm HTTP 200 instead of 401.
- Send one real `tag_scan_v5` template message to +27 82 801 4801 and confirm delivery in `notification_history`.
- Send one real inbox reply (free-form session message) and confirm it records as delivered, not "Not delivered".

If any of the three still returns 401, the remaining cause is account-side (sender/application binding on the Infobip account), and the diagnostics captured on failure will say which.

## Technical notes

- Credential name stays `INFOBIP_API_KEY_V2`; no new secret names, no fallbacks reintroduced.
- Base URL and sender remain `k9v331.api.infobip.com` and `15553467608`.
- Since you pasted the key in chat, rotate it in Infobip afterwards if you want it kept private; say the word and I'll wire the replacement in the same way.
