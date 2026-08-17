# Beach-vibe rebrand: drop V1/V2/V3, new coral palette, pink logo

## What changes

### 1. Remove the demo styling versions
- Delete the V1/V2/V3 UI version switcher (palette dropdown in the app header) and the hook that reads it.
- Delete the V1/V2/V3 hero copy toggle on the sign-in screen; keep one hero.
- The logo stops switching per version and always renders the original pink Tag logo (`Tag_logo_pink_horizontal.png`), including in the app header and sidebar.
- Styling from here on is edited directly in the app's stylesheet.

### 2. New colour system (light only, crisp white everywhere)
Applied as design tokens in `src/styles.css` so every screen picks them up:

- Background / surfaces: crisp white
- Primary: Dark Coral `#C1272D`-family (DMC 349) — buttons, active nav pill, links
- Secondary / accent: Medium Tangerine `#E8A317` (DMC 741) — highlights, badges, charts
- Deep contrast: Navy Blue `#1F3A5F` (DMC 336) — headings, sidebar text, dark sections
- Neutral breaker: Light Steel Gray `#A7B3C0` (DMC 318) — used to calm the bright colours: muted surfaces, table stripes, borders, dividers, hover states, disabled/secondary text and chart neutrals
- Borders / muted: light steel gray tints on white; hovers stay a soft grey
- Charts and status colours re-mapped to coral / tangerine / navy
- Dark-mode block removed or neutralised (app is already locked to light)

### 3. Sporty / beach hero on the auth page
- The uploaded surf-shop scan photo becomes the hero visual on the sign-in / sign-up screen: full-height image panel on the left (desktop), form card on the right, with a subtle navy-to-transparent gradient overlay so the headline stays readable over the photo.
- On mobile the photo becomes a compact banner above the form.
- Hero copy keeps the current message ("Your customers are interested…") with the "SCAN. FOLLOW. ENGAGE." line picked up as a small tagline chip, set in coral/tangerine.
- Same hero treatment carries to Forgot Password and Reset Password since they share the auth shell.
- Buttons, focus rings and links across auth get the coral/tangerine treatment with rounder, sportier shapes.

## Technical notes
- Image uploaded via the asset CDN and imported as a pointer JSON; no binary committed.
- Files touched: `src/styles.css`, `src/components/auth-shell.tsx`, `src/components/hero-variants.tsx` (collapsed into one hero), `src/components/tag-logo.tsx`, `src/components/ui-version-switcher.tsx` + `src/hooks/use-ui-version.ts` (deleted), `src/routes/_authenticated/route.tsx` and `src/components/app-sidebar.tsx` (remove switcher usage).
- No backend, data or business-logic changes.

### 4. Investigate the failed login for trypticon23@gmail.com
Diagnosis only — no fix committed until the cause is confirmed:
- Check whether the account exists in the auth users list, and its confirmation, ban and last-sign-in state.
- Pull yesterday's authentication logs for that email to see the exact failure (wrong password, unconfirmed email, rate limit, provider mismatch, etc.).
- Check whether the account has a retailer role row and completed onboarding — a missing role/retailer link can bounce a valid sign-in straight back out of the app.
- Report exactly what the logs say and propose the fix (password reset, confirm email, role/retailer repair) before changing anything.
