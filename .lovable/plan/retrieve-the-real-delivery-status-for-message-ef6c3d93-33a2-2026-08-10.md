# Retrieve the real delivery status for message ef6c3d93-33a2-4565-ad0e-08b624063a77

## What I can confirm right now (no guessing)

- The message ID `ef6c3d93-33a2-4565-ad0e-08b624063a77` is **not stored anywhere in the
  app database**. The Settings live-delivery test sends directly through the Infobip
  adapter and does not write a `notification_history` row, so there is no local record of
  its status.
- Every recent `notification_history` row (latest batch 18:31 UTC today, `tag_interest` /
  `tag_lastunit`) is still `status = queued`, with no `delivered_at`, no `read_at` and no
  `error`. **Not one delivery report has ever been written back.** The webhook that maps
  Infobip status callbacks onto these rows (`/api/public/webhooks/infobip`) is either not
  configured on the Infobip account, or its shared-secret query string doesn't match.
- Therefore the app currently has **no delivery visibility at all** — "Accepted by
  Infobip (HTTP 200)" is the last thing it knows about any message. That is exactly the
  gap you're hitting.

I will not state a status for that message ID from the local data, because the local data
does not contain one. It has to come from Infobip.

## How we get the actual status

Infobip keeps per-message logs for 48 hours on:

```text
GET {base}/whatsapp/1/logs?messageId=ef6c3d93-33a2-4565-ad0e-08b624063a77
GET {base}/resource/1/logs?messageId=...          (fallback, all channels)
GET {base}/whatsapp/1/reports?messageId=...       (one-shot report queue)
```

These return `status.groupName`, `status.name`, `status.description`, `error.id`,
`error.name`, `error.description` and the recipient — precisely the fields you asked for.
The API key can only be read inside the app runtime, so the lookup has to run there.

### Step 1 — Delivery-status lookup (diagnostic only, no send-path changes)

Add a read-only branch to the existing probe route
`src/routes/api/public/hooks.infobip-auth-probe.ts` (already secret-protected): when the
body carries `{ "logsFor": "<messageId>" }`, call the three endpoints above using the
same `resolveInfobipKeyBinding()` / transport the send path uses, and return the raw
status and error objects. No credentials, base URL, sender, template, or sending code is
touched.

I then run it for `ef6c3d93-…` and report verbatim: status group, status name, status
description, error code, error description, recipient, and whether it is DELIVERED /
PENDING / UNDELIVERABLE / REJECTED / EXPIRED.

### Step 2 — Verify the send request fields

The same lookup response echoes the sender (MSISDN), the destination, the template name
and language actually used. Alongside it I will pull the approved template list
(`GET /whatsapp/2/senders/15553467608/templates`) to report `tag_scan_v5`'s language and
approval status, and confirm the parameter set we send (currently: IMAGE header, zero body
placeholders).

### Step 3 — Fix the reason we're blind (only after you've seen the status)

Whatever the status turns out to be, the delivery reports must start landing in
`notification_history`. That means confirming the Infobip inbound/DLR webhook URL is set
to `https://tag-tech.co.za/api/public/webhooks/infobip?secret=<INFOBIP_WEBHOOK_SECRET>`
and, if it is already set, checking why the callbacks aren't matching. I'll propose that
as a separate step once we know the delivery status — no code changes before then, as you
asked.

## If you'd rather not add the diagnostic endpoint

The same information is available in the Infobip portal without any code change:
**Analyze → Logs** (or **Communication → Logs**), filter by Channel = WhatsApp and paste
the message ID into the search box. The log row expands to show status group, status name,
description and the error code/description. Send me that row and I'll interpret it.

## Technical notes

- New code is confined to a diagnostic branch of the existing probe route; the send path,
  credentials, sender and `tag_scan_v5` are untouched.
- Nothing secret is returned — only Infobip's own status and error fields.
- Message logs expire after 48 hours, so this lookup should be run promptly.
