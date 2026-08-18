# Swap the auth hero image

## What changes
- Upload the newly attached surf-shop photo (girl scanning the barcode higher up on the board) as a CDN asset.
- Point the sign-in / sign-up hero at the new image, replacing the current `auth-hero-surf.png` in `src/components/auth-shell.tsx` — both the desktop hero panel and the compact mobile banner.
- Keep the existing layout, gradient overlay, "Scan. Follow. Engage." chip, headline and body copy exactly as they are.
- Alt text updated to match the new photo.

## Technical notes
- New pointer: `src/assets/auth-hero-scan.jpg.asset.json` via `lovable-assets create`; no binary committed.
- Old `auth-hero-surf.png.asset.json` stays in place unless you want it removed too.
- No backend, data or logic changes.
