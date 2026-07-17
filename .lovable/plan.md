Match the /auth page (and share the same header treatment on other marketing pages) to the two reference screenshots.

## Reference reading

- **image-33** (`/auth`): Big Tag logo pinned top-left, nav pills immediately to its right on the same row, form card ("Welcome back") on the right. No "Start Setup" button in the header (the form itself is the CTA). Left column below the header shows the hero headline + supporting copy.
- **image-34** (marketing sub-page): Same header layout — big top-left logo, nav pills, plus a black "Start Setup →" pill pushed to the far right.

Key layout facts from the references:
- Logo is ~150–170px tall, flush top-left, not indented, not shifted down.
- Nav pill row is vertically centered against the logo.
- On `/auth`, the right column contains only the sign-in card (no extra header CTA).
- On marketing sub-pages, header ends with the Start Setup button.

## Changes

### 1. `src/components/auth-shell.tsx`
- Remove the current `MarketingNav`-only header row and the in-column hero logo (`mt-[2cm] h-[11.52rem]`).
- New header row (max-w-6xl, items-center, gap-8, py-5): `<img heroLogo class="h-[10rem] w-auto object-contain" />` + `<MarketingNav />` (no `showStartSetup`).
- Two-column body below header stays: left column keeps the headline + paragraphs (no logo inside it anymore); right column keeps the form card.
- Delete the mobile-only logo block inside the form column (logo now lives in the shared header, visible on all breakpoints).
- Change grid alignment from `items-end` to `items-start` so the form card sits at the top of the right column, matching image-33.

### 2. `src/components/marketing-page.tsx` (`MarketingHeader`)
- Bump logo size to match image-34: `h-[10rem] md:h-[11rem]` (currently `h-[6.4rem] md:h-[8rem]`).
- Keep `MarketingNav showStartSetup` as-is.
- Ensures the sub-pages (Features, How it Works, Intelligence Engine, Intent Gap Analytics, Pricing) match image-34.

### 3. `src/routes/about.tsx` (hero page header)
- Current header has custom logo sizing (`mt-[4cm] mr-[3cm] h-[8.064rem] md:h-[10.368rem]`) plus its own Sign-in / Start Setup buttons.
- Reset to the shared pattern: `mt-0 mr-0 h-[10rem] md:h-[11rem]`, drop the extra margins so the logo sits flush top-left like the references. Leave the Sign in / Start Setup buttons on this page (hero has its own CTAs, distinct from image-34's single Start Setup, but that's out of scope for this change unless you want it aligned too).

## Out of scope
- No copy changes.
- No changes to the form card, nav link list, or color tokens.
- No mobile-nav restructuring beyond removing the now-duplicate mobile logo in `auth-shell`.

Confirm and I'll apply.
