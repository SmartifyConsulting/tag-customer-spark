# Layout tidy-up: hero alignment, nav position, app header

## Hero / auth page (`src/components/auth-shell.tsx`)

- Vertically centre the hero image column against the sign-up frame: change the two-column grid from `items-start` to `items-center` so the surf image and the form card share a centre line (supporting copy stays under the image).
- Drop the extra top padding so both columns start from the same baseline on large screens.

## Marketing nav position (`src/components/marketing-page.tsx`, `src/components/auth-shell.tsx`)

- Push the nav pill row further down the page so its links sit top-aligned with the Tag logo above the form — roughly level with the punch hole of the tag mark.
- Implement by giving the header a taller top offset on the auth/hero layout and aligning the nav items to the top of that band, so the links read as a row anchored to the logo's punch hole rather than floating at the very top of the page.

## App header (`src/routes/_authenticated/route.tsx`)

- Remove the small retailer/Tag logo rendered in the top-left of the authenticated header (the one immediately left of the Tag Barcode Reader QR tile). The QR reader tile becomes the left-most item.
- Move the greeting text block ("Hello …" plus "Your daily briefing — freshly tagged products this month, and shoppers waiting on a reply") out of its own banner strip above the app chrome and into the left of the nav area, so it reads as left-hand column copy beside the navigation instead of a full-width band above it.

## Notes

- Presentation-only: no data, query, or server-function changes.
- Retailer branding logo stays available in Settings; only the header instance is removed.
