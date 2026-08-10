# Fix WhatsApp replies from Messages

## Confirmed diagnosis

- The Messages screen calls the authenticated `sendReply` server function, which sends a free-form message through the same shared Infobip adapter used elsewhere.
- The failed live reply tried `INFOBIP_API_KEY_V3` first and then V2. Infobip returned `401 Invalid login details` for both before evaluating the message or WhatsApp conversation window.
- The V3 key is therefore present and selected correctly in the live app, but Infobip is rejecting that credential from the deployed runtime. This is not a Messages-screen formatting or template error.

## Implementation

1. Keep Infobip as the only delivery provider; do not add a Twilio fallback.
2. Strengthen the reply operation so it records and returns the selected provider, HTTP status, provider request ID, key binding/fingerprint, and attempted bindings without exposing the API key.
3. Store failed replies with their delivery error and diagnostic metadata, and do not present them as successfully sent.
4. Update the Messages thread UI to show a clear failed-delivery state with a retry action instead of only a temporary toast.
5. Make retry use the same message record and shared Infobip adapter, preventing duplicate conversation entries while preserving an audit trail of each attempt.
6. Add an authenticated Infobip connection check for super admins so the live runtime can verify authentication before staff attempt a reply.

## External resolution and verification

- Use the captured V3 request evidence to resolve the deployed-runtime authentication rejection with Infobip. No application code can turn a provider-issued 401 into a successful send while the provider rejects the credential.
- After Infobip accepts the live runtime, verify in order:
  1. Connection check returns 200.
  2. Reply to a customer who messaged within the last 24 hours.
  3. The message receives an Infobip message ID and displays as sent.
  4. A forced failure displays as failed and can be retried without duplicating the message.

## Technical scope

- `src/lib/inbox.functions.ts`: delivery persistence, diagnostic return data, and idempotent retry.
- `src/routes/_authenticated/inbox.tsx`: sent/failed/pending states and retry control.
- Shared Infobip adapter remains the sole sender and V3 remains first priority.
- Database migration only if the existing message table lacks fields for delivery error, provider message ID, and diagnostic metadata.