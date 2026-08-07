# Fix: public Follow Me route sends with a different Infobip credential

## Confirmed from the code

- Both paths do go through the same modules: the dashboard test
  (`testInfobipDelivery`) and the public route
  (`/api/public/scan/barcode-interest`) both call `sendTemplate` →
  `sendWhatsApp` → `sendInfobipWhatsApp`, with the same `tag_scan_v5` payload.
- The adapter does **not** read one credential. It reads a chain:
  `INFOBIP_API_KEY_V2` first, and silently falls back to the older
  `INFOBIP_API_KEY` when V2 is absent from that runtime's environment.
- `isInfobipConfigured()` checks only the old `INFOBIP_API_KEY` name, so the
  two names are already treated inconsistently in the same file.
- The public route records the send result in `notification_history` but does
  **not** record `result.diagnostic`, so today there is no evidence of which
  key binding that route actually used — only the dashboard test surfaces it.

## Most likely cause (to be proven, not assumed)

Environment bindings are injected per execution context. If the context that
serves `/api/public/*` does not carry `INFOBIP_API_KEY_V2`, the adapter quietly
drops to the stale `INFOBIP_API_KEY`, which is exactly the key that produced
`Invalid login details`. Same code, same adapter, different key — which matches
the symptom precisely (authenticated path always succeeds, public path always
fails). This is unproven until step 1 below prints the fingerprint from the
public route.

## Steps

1. **Prove it.** Store the safe diagnostic (`keyBinding`, `keyFingerprint`,
   `keyLength`, `apiHost`, `senderSuffix`, Infobip request id) inside the
   `notification_history.payload` for every scan confirmation, success or
   failure. Never the key itself. One real Follow Me submission then shows
   whether the public route's fingerprint is `28b989c2f2e5d3e7` (same key,
   different problem) or something else (different binding — cause confirmed).

2. **Remove the silent fallback.** The adapter stops choosing between two key
   names. It resolves one canonical credential; if that binding is missing in a
   given runtime it fails loudly with a clear "Infobip credential binding
   missing in this runtime" error instead of authenticating with a stale key.
   `isInfobipConfigured()` is corrected to test the same canonical name so the
   provider selection and the sender agree.

3. **Re-bind once, everywhere.** Re-set the working credential (the one behind
   fingerprint `28b989c2f2e5d3e7`, host `k9v331.api.infobip.com`, length 69)
   under the canonical name, and remove the superseded name so no runtime can
   resolve an old value. Deploy so preview and published both pick it up.

4. **Keep opt-in behaviour unchanged.** Customer, interest, watch, conversation
   and notification-history rows continue to be written even when the
   confirmation send fails.

## Verification

- Run one real Follow Me opt-in against the published domain
  (`tag-tech.co.za`) after the deploy.
- Require: API response `confirmationSent: true`, a `notification_history` row
  with status `queued` (not `failed`), a provider message id, and a diagnostic
  fingerprint identical to the dashboard test's.
- Confirm the row advances to `delivered` via the Infobip delivery webhook, and
  that the message arrives on WhatsApp.
- Re-check published logs for any new `Invalid login details` entry on the
  public route.

## Technical notes

- Files touched: `src/lib/whatsapp-infobip.server.ts` (canonical credential
  resolution, no fallback chain, corrected `isInfobipConfigured`) and
  `src/routes/api/public/scan.barcode-interest.ts` (persist the diagnostic in
  the history payload).
- No change to `whatsapp.server.ts`, `whatsapp-service.server.ts`, the template
  contract, or the notification engine.
