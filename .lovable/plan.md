# Restore live Infobip authentication

## Confirmed current state

- The published worker is reaching Infobip, but Infobip is returning `401 Invalid login details` for recent `tag_scan_v5` sends.
- Notification history contains repeated failed scan confirmations and one successful delivered confirmation at 16:50 UTC on 7 August 2026.
- The current adapter reads `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, and `INFOBIP_WHATSAPP_SENDER` inside the send operation rather than storing their values in a module-level constant.
- The Automations provider label only checks that the three variables are present; it does not validate their values or authenticate with Infobip.

## Implementation

1. Add a safe runtime Infobip configuration diagnostic that reports only non-secret evidence: a one-way key fingerprint, normalized key length/prefix metadata, normalized API hostname, sender suffix, deployment/runtime marker, and Infobip response/request identifiers. Never log or return the API key itself.
2. Centralize runtime configuration loading in the Infobip adapter so every request obtains and normalizes the current environment bindings immediately before the provider call. Strip accidental whitespace, wrapping quotes, duplicated `App` prefixes, and malformed base-URL formatting consistently.
3. Add an authenticated super-admin test action to the Automations settings page. It will send the approved `tag_scan_v5` template through the exact same production path used by `/api/public/scan/barcode-interest`, and display the safe runtime diagnostic with the result.
4. Use the diagnostic to compare the production key fingerprint with a locally calculated fingerprint of the known-good Infobip key. If they differ, refresh the secure runtime binding and deploy once; if they match, use Infobip's request identifier and normalized request metadata to correct the remaining account/base-URL authorization mismatch rather than rotating blindly again.
5. Keep scan opt-in behavior unchanged: customer, interest, watch, conversation, and notification-history records continue to be created even if the confirmation delivery fails.

## Verification

- Run the authenticated production test send to the existing test recipient and require an Infobip `2xx` response with a provider message ID.
- Confirm the corresponding notification-history row advances from `queued` to `delivered` through the Infobip delivery webhook.
- Perform one real Follow Me/barcode opt-in against the published domain and confirm `confirmationSent: true`, a successful `tag_scan_v5` history row, and receipt on WhatsApp.
- Recheck published runtime logs to ensure no new `Invalid login details` entries occur for the verified sends.