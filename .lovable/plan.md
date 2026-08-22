# Broadcasts: send with tag_broadcast_v2 now, auto-upgrade when a variable template is approved

## What the provider actually has right now

Read live from your WhatsApp sender:

- `tag_broadcast_v2` — APPROVED, English, IMAGE header, no buttons, body is fixed text: "Dont miss out on this speacial offer!" with **zero variables**.

So v2 can carry your image, but not the heading and body you type. The app currently insists on a two-variable template, so it would refuse to send with v2 — that is why nothing goes out.

## Plan

1. **Send with v2 today.** Relax the broadcast template resolver so a zero-variable approved broadcast template is usable: image header + the approved fixed line. The image stays compulsory.

2. **Auto-upgrade with no code change.** The resolver keeps preferring the highest-numbered approved `tag_broadcast_*` template that has exactly two variables and no buttons. The moment you get `tag_broadcast_v3` approved (English, IMAGE header, no buttons, body `*{{1}}*\n\n{{2}}`), broadcasts automatically start carrying your custom heading and body — nothing to redeploy.

3. **Be honest in the composer.** When the resolved template has no variables, the composer shows a clear notice: "Your approved template sends fixed text — only the image changes. Submit tag_broadcast_v3 to send custom wording." The heading/body fields stay, but are labelled as internal campaign notes and are stored on the campaign record, not sent. When a variable template is available the notice disappears and the fields send as before.

4. **Keep the delivery truth visible.** The existing delivered / read / failed breakdown and the per-broadcast diagnostic stay as they are, so a downstream rejection is never mistaken for a success again.

5. **Live template picker in Admin > Automations.** The "Live Infobip delivery test" picker currently lists a hardcoded set of template names, so newly approved templates (like `tag_broadcast_v2`) never appear. Replace it with the live template list read from your WhatsApp sender: each entry shows the template name plus its status (Approved / Pending / Rejected), approved ones first, with a refresh button and an automatic refresh each time the Automations tab is opened. Pending or rejected templates are still selectable for testing but visibly flagged.

## Technical notes

- `src/lib/broadcast-template.server.ts`: accept `placeholderCount === 0` as a fallback tier, still ranking two-variable templates first; return the variable count to callers.
- `src/lib/broadcasts.functions.ts`: only pass `heading`/`body` variables when the resolved contract declares placeholders; always require a public https image.
- `src/components/notifications/broadcast-composer-dialog.tsx`: fetch the resolved template capability and render the fixed-text notice.
- Template picker: new admin-only server function wrapping the existing `listInfobipTemplates` helper, consumed by `src/components/settings/automation-settings.tsx` via a query with no stale cache, replacing the static `ALL_WHATSAPP_TEMPLATES` list.
- No schema change, no new secrets.

