Unify the header across /about (hero), /auth, and every marketing sub-page so the logo and nav don't shift between pages.

## Target layout (all three page types)

Three-column header row, top-aligned:

```text
[ Logo top-left ]      [ Nav pills — centered ]      [ Right slot ]
```

- **Logo**: fixed size across every page. Take the current Features logo (`h-[10rem] md:h-[11rem]`) and scale +20% → `h-[12rem] md:h-[13.2rem]`. Same size on `/about`, `/auth`, and every marketing sub-page.
- **Nav pills**: centered in the header row on every page (not left-hugged), same pill styling.
- **Vertical alignment**: header uses `items-start` so the top edge of the Tag logo lines up with the top edge of the nav pill buttons. No `mt-*` offsets on the logo.
- **Right slot** varies by page:
  - Marketing sub-pages (Features, How it Works, Intelligence Engine, Intent Gap Analytics, Pricing): "Start Setup →" button.
  - `/about` hero: existing Sign in + Start Setup buttons.
  - `/auth`: empty (no right-side CTA) — but the center column still holds the nav in the same absolute position.

## Implementation

### 1. `src/components/marketing-nav.tsx`
- Restructure to remove the current `flex-1 items-center gap-8` wrapper.
- Return just the nav pill row (no wrapper, no Start Setup slot). Consumers decide where to place it and what right-side content to render.
- Move the Start Setup button out of `MarketingNav` — it becomes a separate `<MarketingCtaButton />` export in the same file so page headers can drop it into the right slot when needed.

### 2. New shared header primitive in `src/components/marketing-page.tsx` (`MarketingHeader`)
Rewrite to a 3-column grid:

```tsx
<header className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-start gap-8 px-6 py-5">
  <Link to="/about">
    <img src={heroLogo} className="h-[12rem] md:h-[13.2rem] w-auto object-contain" />
  </Link>
  <div className="flex justify-center pt-4"><MarketingNav /></div>
  <div className="flex items-start pt-4">{right}</div>
</header>
```

- `pt-4` on the nav/right columns pushes the pill row down enough that the top of the pills sits roughly at the top of the Tag logo icon — matches "top of the tag aligned with top of the buttons".
- Accept an optional `right?: ReactNode` prop; default = `<MarketingCtaButton />`.

### 3. `src/components/auth-shell.tsx`
- Replace the current header row with `<MarketingHeader right={null} />` so `/auth` uses the exact same logo size, nav position, and top alignment as every other page.
- Rest of the two-column body (hero copy + form card) unchanged.

### 4. `src/routes/about.tsx`
- Replace the hand-rolled `<header>` with `<MarketingHeader right={<>Sign in / Start Setup buttons</>} />`, preserving the existing Sign in + Start Setup behaviour but inside the shared header shell.
- Drop the custom `mt-[4cm] mr-[3cm]` / `h-[8.064rem] md:h-[10.368rem]` classes — logo now inherits the shared fixed size.

## Result
- Same logo size (`h-[12rem] md:h-[13.2rem]`) and same left position on hero, auth, and all sub-pages — no jump when navigating between them.
- Nav pills always centered in the header row.
- Logo top edge aligns with the top of the nav pill row.
- Right slot swaps per page without affecting logo or nav position.

## Out of scope
- No changes to nav link list, pill colors, or form card.
- No changes to body content below the header.
