# Why the broadcast button is inactive — and how to fix it

## What is confirmed

The Send button is disabled unless **all** of these are true:

1. `tag_broadcast_v3` resolves as APPROVED on the WhatsApp sender
2. A header image has been uploaded
3. Internal name filled in
4. Offer valid till date chosen
5. Catalogue URL is a valid `https://` link
6. The opted-in audience count is greater than 0

Two of these are likely biting right now:

- **Audience**: a live check of the customer data shows only **one** customer across the whole account currently qualifies (marketing consent + subscribed/registered + WhatsApp number). One retailer has **zero** qualifying customers — for that account the button can never enable, regardless of the form.
- **Template status**: your screenshot shows `tag_broadcast_v3` as "Active – Quality pending". The app only accepts the literal status `APPROVED` from the provider. If the provider reports it as `ACTIVE` (or similar) rather than `APPROVED`, the app treats it as not approved and blocks sending. This one is not yet confirmed live — the template list can only be read with the sender credentials at runtime.

Today the composer gives no clue which of the six conditions is failing, which is the real usability problem.

## The fix

### 1. Show exactly why sending is blocked

Under the footer, list the unmet conditions in plain language, e.g.:
- "No customers have opted in to marketing yet" (with the count)
- "Header image not uploaded"
- "Offer valid till not set"
- "Catalogue URL must start with https://"
- "Template tag_broadcast_v3 is not approved yet (status: …)"

The template notice will include the **actual status string** returned by the provider, so the cause is visible instead of guessed.

### 2. Accept quality-pending as approved

A template in "Active – Quality pending" is sendable on WhatsApp. Treat statuses `APPROVED`, `ACTIVE`, and any status starting with `ACTIVE` as approved; keep blocking on `PENDING`, `REJECTED`, `DISABLED`, `PAUSED`.

### 3. Language tolerance

The template is registered as English (US). Resolution matches by name only, so this is already fine — no change, but the resolved language is shown in the notice so a mismatch is visible.

## Technical detail

- `src/lib/broadcast-template.server.ts`: replace the strict `status === "APPROVED"` check with an approved-status set; when the named template exists but is not sendable, return its real status in the error message; when it is absent entirely, keep the current "not registered" message.
- `src/lib/broadcasts.functions.ts` (`getBroadcastTemplateInfo`): return the raw provider status alongside the existing fields.
- `src/components/notifications/broadcast-composer-dialog.tsx`: render a "Before you can send" checklist of unmet conditions, including the audience count of 0 case, and surface the template status text.

No schema or send-payload changes; the v3 template contract (image header, `{{expiry_date}}`, Shop Online button) stays as is.
