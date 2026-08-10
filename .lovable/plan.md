# Fix: Infobip credentials "missing in this runtime"

## Root cause (confirmed)

The code is looking for a secret name that no longer exists.

- The send path is server-side only (no Edge Function involved): UI → `sendTemplate` (`src/lib/whatsapp-service.server.ts`) → `sendWhatsApp` (`src/lib/whatsapp.server.ts`) → `sendInfobipWhatsApp` (`src/lib/whatsapp-infobip.server.ts`).
- Credentials are read inside `readRuntimeConfig()` in `src/lib/whatsapp-infobip.server.ts` using `process.env` (correct — server runtime, never frontend, never `import.meta.env`).
- It expects `INFOBIP_API_KEY_V2`, `INFOBIP_BASE_URL`, `INFOBIP_WHATSAPP_SENDER`.
- The configured secrets are `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_WHATSAPP_SENDER`. The `_V2` key was deleted when the key versions were cleaned up.
- `readRuntimeConfig()` returns `null` the moment any one of the three is missing, so it short-circuits before contacting Infobip. That is why the diagnostic shows HTTP 500 with every field blank (`-`) and no host or fingerprint: no request was ever made.

Same stale name is also used by the diagnostic probe route `src/routes/api/public/hooks.infobip-auth-probe.ts`.

## Changes

1. `src/lib/whatsapp-infobip.server.ts`
   - Resolve the key from the first present of `INFOBIP_API_KEY`, then `INFOBIP_API_KEY_V2`/`_V3` as legacy fallbacks, and record which binding was used in `keyBinding` / `availableBindings`.
   - Replace the single missing-credentials message with one that names exactly which of the three parts is absent (key / base URL / sender) — names only, never values.
   - `isInfobipConfigured()` uses the same resolver.
2. `src/routes/api/public/hooks.infobip-auth-probe.ts` — use the same resolver instead of the hardcoded `_V2` name.
3. Safe diagnostic logging in the adapter before each send: key present yes/no, key length, binding name used, base URL present + hostname only, sender present + last 4 digits, and the resolved request URL path. Never the key, never the full sender.

Not touched: the `tag_lastunit` template, the provider, the sender value, and the request/URL construction (base URL normalisation and `POST {base}/whatsapp/1/message/template` are already correct).

## Sender format

The code normalises the sender to digits only (strips `+` and `whatsapp:`), which is what Infobip's WhatsApp API expects for a registered sender. If `INFOBIP_WHATSAPP_SENDER` is stored as `+15553467608` it still works; the value must be the registered WhatsApp sender number, not a sender ID.

## What you do afterwards

Nothing in Supabase — there is no Edge Function in this path, so no function deploy is needed. The secrets you already saved are read at request time by the app runtime. After the code change, just retry the `tag_lastunit` send from Settings → Automations; publish when you want it live on tag-tech.co.za.

If the diagnostic then shows a real HTTP status from Infobip (401/400 with a host and fingerprint filled in), that is a genuine provider response and we troubleshoot from there — but the current blank-500 is purely the name mismatch.
