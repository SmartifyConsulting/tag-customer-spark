# Fix WhatsApp replies from Messages

## Confirmed diagnosis

- The Messages screen calls the authenticated `sendReply` server function, which sends a free-form message through the same shared Infobip adapter used elsewhere.
- The failed live reply tried `INFOBIP_API_KEY_V3` first and then `INFOBIP_API_KEY_V2`. Infobip returned `401 Invalid login details` for both before evaluating the message or WhatsApp conversation window.
- The credentials are reaching Infobip correctly from the deployed runtime and being rejected there. This is not a Messages-screen formatting or template error.

## Credential and provider cleanup

1. Make `INFOBIP_API_KEY_V2` the single Infobip credential. Remove the V3 and legacy fallback bindings and the multi-key retry loop so exactly one key is used and failures are reported plainly.
2. Delete the `INFOBIP_API_KEY_V3` secret.
3. Remove all Twilio associations and references across the app: the Twilio branch and provider switch in the WhatsApp sender, the Twilio inbound webhook route, the Twilio edge function, Twilio environment variables, and Twilio wording in settings and diagnostics. Infobip becomes the only delivery provider, with no provider selection remaining.

## Implementation

1. Strengthen the reply operation so it records and returns HTTP status, provider request ID, and key fingerprint without exposing the API key.
2. Store failed replies with their delivery error and diagnostic metadata, and do not present them as successfully sent.
3. Update the Messages thread UI to show a clear failed-delivery state with a retry action instead of only a temporary toast.
4. Make retry reuse the same message record, preventing duplicate conversation entries while preserving an audit trail of each attempt.
5. Add an authenticated Infobip connection check for super admins so the live runtime can verify authentication before staff attempt a reply.

## External resolution and verification

- Live logs show `INFOBIP_API_KEY_V2` currently returns 401 from the deployed runtime, so that key must be confirmed valid and unrestricted in Infobip. No application code can turn a provider-issued 401 into a successful send.
- Once the key is accepted, verify in order:
  1. Connection check returns 200.
  2. Reply to a customer who messaged within the last 24 hours.
  3. The message receives an Infobip message ID and displays as sent.
  4. A forced failure displays as failed and can be retried without duplicating the message.

## Technical scope

- `src/lib/whatsapp-infobip.server.ts`: single `INFOBIP_API_KEY_V2` binding, no fallback chain.
- `src/lib/whatsapp.server.ts`: Twilio branch and provider switch removed.
- `src/routes/api/public/webhooks/twilio-inbound.ts` and `supabase/functions/send-whatsapp-message`: removed.
- `src/lib/inbox.functions.ts`: delivery persistence, diagnostic return data, and idempotent retry.
- `src/routes/_authenticated/inbox.tsx` and settings automation UI: delivery states, retry control, Twilio wording removed.
- Database migration only if the message table lacks fields for delivery error, provider message ID, and diagnostic metadata.