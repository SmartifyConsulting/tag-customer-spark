# Swap in the revised Tag logo

## What changes

- Upload the newly attached tag mark (orange frame, mint face, black "tag" script + barcode, transparent background) to the CDN as a new asset pointer.
- Point the shared logo component at the new image so it appears on:
  - the hero / sign-in / sign-up page,
  - the sidebar nav header,
  - the passport / public tag-tech pages that render the Tag mark,
  - and every other place that already uses the same component (about, setup, install, barcode reader, marketing header) — they all read one source.
- Keep all current sizing: no height, width, aspect-ratio, padding or rounding changes. The new logo simply occupies the same box as the current one.

## Technical notes

- `lovable-assets create --file /mnt/user-uploads/beachtag.jpg --filename tag-logo-2026c.png > src/assets/tag-logo-2026c.png.asset.json`
- `src/components/tag-logo.tsx`: change the single asset import to the new pointer. No other edits — the `variant` / `size` / `heightClass` API and all call sites stay untouched.
- No backend, data or layout changes.

## Note

The uploaded file is a JPEG-named upload of a transparent-style mark; if the source has a checkerboard baked in rather than real transparency, the logo will show a grey checker background on navy. I'll verify transparency during upload and, if needed, convert it to a true transparent PNG before wiring it in.
