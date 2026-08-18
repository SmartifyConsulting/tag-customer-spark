# Layout & branding tweaks

## Left nav (`src/components/app-sidebar.tsx`)
- Raise the whole nav item list by ~1.5 cm: reduce the top padding on the sidebar content block (currently `pt-[6.6875rem]`) by about 3.5rem.
- Move the Tag logo in the sidebar header down by ~0.25 cm: add ~0.6rem of extra top padding to the sidebar header, keeping its current size.

## App header (`src/routes/_authenticated/route.tsx`)
- Enlarge the retailer logo by 60% (from the current 12-unit box to roughly a 19-unit / ~4.75rem box), keeping the rounded, transparent-background treatment and the same fallback placeholder box size.
- Shift it further left and align it vertically with the greeting text: pull it out of the far-right cluster's right edge (extra right-side spacing) and align the header row so the logo's centre line matches the "Hello …" greeting block.

## Briefing KPI row (`src/routes/_authenticated/briefing.tsx`)
- Align the "Today's scans" card with the page headings used on the Products screen: give the KPI grid the same left edge and top offset as the Products page heading block, so the card no longer sits inset relative to the section titles.

## Hero / auth page (`src/components/auth-shell.tsx`)
- Move the hero image and the "Welcome back" form frame down by ~1 cm (add ~2.4rem top padding to the content grid) while leaving the nav row and logo where they are.
- Recolour the headline text on the hero image to the same red used as the background of the "Scan. Follow. Engage." badge (the primary coral token) instead of white.
- Lighten the dark gradient overlay on the hero image so the photo reads brighter behind the text.

## Notes
- Presentation-only: no data, query, or server-function changes.
- Assumption on "align Today's scans with the Product headings": alignment means matching the left edge and top offset of the Products page heading column. Say the word if you meant a different pairing.
