## 1. Scanner jumps straight to the product

`src/routes/tools.barcode-reader.tsx` currently stops at a "Detected / Look up product" card.

- On a valid detection (8–14 digits), stop the camera and navigate immediately to `/passport/{code}`.
- Keep a brief "Found 6004201004816 — opening…" state so the shopper sees what was read.
- Non-numeric / unusable codes keep the current card with a "Scan again" button.
- The passport page already handles "no match", so a bad barcode lands on its not-found state rather than a dead end.

## 2. Background flipping between black and white

`src/components/theme-provider.tsx` defaults to `system`, so the app follows the phone/OS dark-mode setting (including automatic sunset switching) — that's the ad-hoc black/white you're seeing.

- Default to **light** when nothing is stored, and only use dark if the user explicitly picks it from the theme toggle.
- Remove the `prefers-color-scheme` listener from the default path so the OS can never flip it mid-session.
- Public pages (passport, barcode reader) render light always, so a shopper's dark phone doesn't change the shelf experience.

## 3. Inbox message doesn't say which product

Today the barcode opt-in only creates a bare conversation with subject "Opted in via barcode scan" and no message row — so the Inbox has nothing to show.

In `src/routes/api/public/scan.barcode-interest.ts` (and the matching QR path in `scan.interest.ts`):
- Set the conversation subject to the product name, e.g. `Interested in Baby Blue Jumper`.
- Insert an inbound system message on the conversation: product name, barcode, store/branch, and time of scan — so the thread's first line is the scan itself.
- Tag the conversation with the branch/store name so it's filterable.
- Show the product thumbnail + name in the Inbox thread header (`src/routes/_authenticated/inbox.tsx`), driven by the existing `customer_interests` join already returned by `getConversation`.

## 4. The tag_product_scan WhatsApp template never sent

The code already prefers a Twilio Content Template for the scan message, but it reads `TWILIO_TEMPLATE_BARCODE_SCAN_SID` — that secret isn't set on this project, so it silently fell back to a freeform message. WhatsApp blocks business-initiated freeform outside a 24-hour window, which is why nothing arrived.

- Look up the `tag_product_scan` template's Content SID (the `HX…` value) through the Twilio connection and store it as `TWILIO_TEMPLATE_BARCODE_SCAN_SID`. If it can't be read automatically, I'll ask you to paste the `HX…` SID from Twilio → Content Template Builder.
- Verify the template's variable order matches what we send today (`{{1}}` = product image for the header, `{{2}}` = product name); if your template uses different placeholders, I'll align the code to it.
- Add a visible failure trail: when a template send fails, record the Twilio error on `notification_history` so it shows up instead of failing silently.
- Test end-to-end with a real scan on `6004201004816` and confirm the message lands.

### Technical notes
- Files touched: `tools.barcode-reader.tsx`, `theme-provider.tsx`, `scan.barcode-interest.ts`, `scan.interest.ts`, `inbox.functions.ts`, `inbox.tsx`.
- No schema change needed — `conversation_messages` and `customer_interests` already carry everything required.
