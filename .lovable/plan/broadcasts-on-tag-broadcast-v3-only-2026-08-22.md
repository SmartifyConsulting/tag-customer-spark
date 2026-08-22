# Broadcasts on tag_broadcast_v3 only

Move WhatsApp broadcasts onto `tag_broadcast_v3` exclusively and simplify the composer to match what that template actually carries: an image header, an expiry date, and a Shop Online link.

## New composer

Fields, top to bottom:

1. **Header** — image upload only (the old "Image" field, renamed and moved to where Heading was). No pasted-URL option.
2. **Internal name** — short label so the broadcast list stays readable. Never sent to WhatsApp.
3. **Offer valid till** — date picker. Feeds the template's `{{expiry_date}}` variable.
4. **Online shopping catalogue URL** — feeds the Shop Online button.

Removed: Heading, Message, Image-by-link, and the separate Link/CTA field.

Send stays disabled until an image is uploaded, a date is chosen, and the catalogue URL is a valid `https://` link. A live preview line shows the exact wording that will go out: "Offer valid till <date>. Be sure not to miss out!"

## Template handling

- Only `tag_broadcast_v3` is used. v1 and v2 are dropped from the resolver entirely.
- The template is still read live from the messaging provider so the app matches the approved body exactly.
- The resolver now accepts a template with one URL button (v2 assumed zero buttons) and one body variable.
- If `tag_broadcast_v3` is not APPROVED on the sender, the composer shows a clear notice and sending is blocked — no fallback to older templates.

Note: a live read of the sender's template list right now returns `tag_broadcast_v2` but no `tag_broadcast_v3`, so v3 may still be propagating from review. The code handles that as the blocked state above, and broadcasts start flowing automatically once it appears as APPROVED.

## Technical detail

- `src/lib/broadcast-template.server.ts`: target name `tag_broadcast_v3`, require `APPROVED` + IMAGE header, allow 0 or 1 buttons, expose the button's URL shape and the single body placeholder. Drop the zero-variable fallback and the v1/v2 prefix match; keep the `INFOBIP_TEMPLATE_*` override.
- `src/lib/broadcasts.functions.ts`: send schema becomes `{ imageUrl, expiryDate, catalogueUrl, internalName }`; drop `heading`/`body`/`ctaUrl` from the input. Store the internal name in `broadcast_campaigns.heading`, the rendered expiry text in `body`, and the catalogue URL in `cta_url` (no schema change). Pass `{ expiry_date }` as the single template variable and the catalogue URL as the button parameter.
- `src/lib/whatsapp-templates.server.ts` / `whatsapp-service.server.ts`: pass a URL-button parameter through when the approved template declares a dynamic URL button.
- `src/components/notifications/broadcast-composer-dialog.tsx`: rebuild the form per the field list above; keep the audience count, upload flow, and confirm step.
- Broadcast list and delivery breakdown keep working; the list shows the internal name.
