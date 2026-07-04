## Part 1 — Visual refresh (colours, tabs, sidebar, logo)

### 1. Colour tokens — cream base, orange + crimson accents

Rewrite the palette in `src/styles.css` (light mode; dark mode mirrors):

```text
Page background:       #F5F1EA  cream
Foreground text:       #0d0d0d  ink black
Primary (CTAs):        #0d0d0d  black on cream
Primary foreground:    #F5F1EA  cream
Sidebar bg:            #F5F1EA  cream  (was forest green)
Sidebar foreground:    #0d0d0d  black
Sidebar active bg:     #0d0d0d  black  (with #F5F1EA cream text)
Sidebar border:        #e8e4dd  warm off-white
Accent (secondary):    #d4842a  orange — badges, chart series, highlights, illustrations
Third accent:          #9b4423  crimson — chart series, alert accents
Warning:               #e8b84a  amber (unchanged)
Success:               keep emerald for status pills
Destructive button:    keep existing token (crimson tone)
```

Orange + crimson stay **decorative only** — no CTAs are recoloured, no destructive buttons are hijacked. Forest green is removed from the sidebar, headers and cards.

### 2. Tabs — narrower, black bar, cream-selected

Edit `src/components/ui/tabs.tsx`:
- `TabsList`: `bg-muted` → `bg-foreground` (black), tighten padding (`p-0.5`), add `w-fit` so tabs stop stretching full width.
- `TabsTrigger`: idle text `text-background/70` (cream at 70%); active state `data-[state=active]:bg-background data-[state=active]:text-foreground` (cream bg + black text). Matches the sidebar selection language.

### 3. Sidebar / nav menu — cream nav, cream-on-black selection

Sidebar tokens above already flip surface to cream and selection to a black pill with cream text. Remove any lingering forest-green backdrop around the logo container in `app-sidebar.tsx` if present. No changes to structure, spacing or width.

### 4. Logo swap — new "Tag" wordmark

You uploaded the black serif "Tag" wordmark (with subtle CMYK colour fringe). I'll:
- Upload it via `lovable-assets` from `/mnt/user-uploads/Gemini_Generated_Image_vh5fmfvh5fmfvh5f-Photoroom.png`.
- Overwrite `src/assets/tag-logo-v2.png.asset.json` with the new pointer (icon slot) and `src/assets/tag-logo-hero.png.asset.json` (wordmark slot).
- `src/components/tag-logo.tsx`: keep every size class exactly (`h-32 w-32` default, `h-[88px] w-[88px]` sm, `h-16` wordmark lg, etc.); only remove the green `drop-shadow-[0_4px_18px_rgba(0,176,116,0.25)]` so the new logo reads clean on cream.
- Update the favicon (`public/favicon.png` + `<link>` in `__root.tsx`) to match; delete the old `favicon.ico`.

### 5. Product / stock / watchlist images — backfill only

Insert-tool `UPDATE public.products SET image_url = <themed Unsplash URL> WHERE image_url IS NULL` for your retailer. Watchlists + stock render from the joined product row, so they inherit images automatically.

## Part 2 — Twilio WhatsApp wiring

Sender number: **`whatsapp:+27828014801`** stored as env var `TWILIO_WHATSAPP_FROM` (set via `set_secret`, not `add_secret` — it's a fixed value you gave me). All sends go through the connector gateway (`https://connector-gateway.lovable.dev/twilio/Messages.json`) using existing `TWILIO_API_KEY` + `LOVABLE_API_KEY`.

### A. Central helper

New file `src/lib/whatsapp.server.ts` — one `sendWhatsApp({ to, body, mediaUrl? })` function. Handles E.164 formatting, `whatsapp:` prefix, x-www-form-urlencoded body, error surfacing, and logging.

### B. Password reset / auth notifications

Extend `supabase/functions/send-password-reset/index.ts`:
- After generating the recovery link, ALSO look up the user's `customers.whatsapp_e164` (or a new `profiles.whatsapp_e164` column for retailer users — see below).
- If a number exists, send WhatsApp: *"Your MyPenguin password reset link: {short link}. Expires in 1 hour. Ignore if you didn't request this."*
- Email still fires as today — WhatsApp is additive.

Requires one migration: `ALTER TABLE public.profiles ADD COLUMN whatsapp_e164 text`. Surfaced in Settings → Account for retailer users to add their number.

### C. Notification campaigns

Update `src/lib/notifications.functions.ts` (the send path used by `hooks.notifications-tick.ts`):
- Replace the current stub/placeholder send with `sendWhatsApp()` per recipient.
- Continue to write to `notification_history` with `channel = 'whatsapp'`, `provider_message_sid`, `status`.
- Media (product image) is passed as `MediaUrl` when the campaign has an `image_url`.

### D. Customer opt-in confirmation

Update `src/routes/api/public/scan.interest.ts`:
- After the interest row is upserted successfully, fire-and-await `sendWhatsApp({ to: e164, body: confirmationCopy })`.
- Copy: *"Hi {name} 👋 You're subscribed to updates for {productName} at {retailerName}. Reply STOP to unsubscribe."*
- Wrapped in try/catch so a send failure never breaks the opt-in.

### E. Inbound webhook (STOP handling)

New `src/routes/api/public/webhooks/twilio-inbound.ts` for Twilio's message-status + inbound-message callback:
- Verify Twilio signature (`x-twilio-signature` HMAC over the raw body + URL, timing-safe compare).
- On `Body ~= "STOP"`, mark `customers.status = 'unsubscribed'` and set `notify_consent_at = null`.
- On status webhooks, update `notification_history.status` (`delivered` / `read` / `failed`).
- Register the stable URL `https://project--{project-id}.lovable.app/api/public/webhooks/twilio-inbound` in the Twilio console — I'll surface this URL for you to paste in.

### F. Security defaults

Immediately after this ships, I'll remind you (once) to enable **SMS Pumping Protection** and tighten **SMS Geo Permissions** (South Africa only, unless you say otherwise) in the Twilio console to stop billing-fraud attacks.

## Files touched

- `src/styles.css` — palette tokens (light + dark)
- `src/components/ui/tabs.tsx` — narrow, black bar, cream-selected
- `src/components/app-sidebar.tsx` — verify no forest backdrop remains
- `src/components/tag-logo.tsx` — drop green shadow, keep sizes
- `src/assets/tag-logo-v2.png.asset.json`, `src/assets/tag-logo-hero.png.asset.json` — new asset pointers
- `public/favicon.png` + `src/routes/__root.tsx` head links
- Data-only UPDATE against `public.products.image_url`
- New `src/lib/whatsapp.server.ts`
- `supabase/functions/send-password-reset/index.ts` — add WhatsApp send
- `src/lib/notifications.functions.ts` — real Twilio send path
- `src/routes/api/public/scan.interest.ts` — confirmation WhatsApp
- New `src/routes/api/public/webhooks/twilio-inbound.ts`
- One migration: `profiles.whatsapp_e164`
- Set secret: `TWILIO_WHATSAPP_FROM = whatsapp:+27828014801`

## Verification

- Playwright screenshots of `/dashboard`, `/products`, `/watchlists`, `/notifications` at 1280px — cream nav, black narrow tabs, cream-selected states, new Tag logo, orange/crimson only as accents.
- `SELECT count(*) FROM products WHERE image_url IS NULL` after backfill returns 0.
- Test WhatsApp: trigger password reset → confirm your phone receives the message; scan a QR + submit interest → confirm the opt-in WhatsApp arrives; send a test campaign to one number.
- Send `STOP` from a test phone → confirm `customers.status` flips to `unsubscribed`.
