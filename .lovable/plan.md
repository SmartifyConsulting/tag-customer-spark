# New Tag logo + retailer logo in the top-left

## What changes

1. **Upload the new logo** (coral/orange tag mark with barcode, transparent background) to the CDN as `tag-logo-coral.png` and make it the single logo the app uses.
2. **Hero / auth page** — the sign-up and login screen uses the new logo.
3. **Main app canvas** — the large logo shown above the greeting on the dashboard uses the new logo.
4. **Top-left of the app header** — shows the *retailer's own logo* (transparent PNG, no card or white box behind it) pulled from the store's branding settings. If a retailer hasn't uploaded a logo yet, the new Tag logo is shown instead so the header is never empty.

## Technical notes

- Create the asset pointer with `lovable-assets create --file /mnt/user-uploads/image-Photoroom_1.png --filename tag-logo-coral.png > src/assets/tag-logo-coral.png.asset.json`.
- `src/components/tag-logo.tsx`: swap `Tag_logo_pink_horizontal.png` for the new asset pointer URL; keep the existing `variant` / `size` / `heightClass` API so every call site (auth, setup, dashboard, about, marketing, barcode reader) picks it up with no other edits.
- `src/routes/_authenticated/route.tsx`: the header logo already has `branding.data?.logo_url` available from the existing `getRetailerBranding` query. Render that URL as a plain `<img>` with `object-contain`, transparent background, bounded height, and `alt` of the retailer name; fall back to `<TagLogo variant="wordmark" />` when `logo_url` is null.
- No backend or data changes — retailer logos already upload through Settings > Branding.

5. **Hero page logo alignment** — center the Tag logo horizontally over the sign-up / sign-in form so it sits on the same centre line as the card (`src/routes/auth.tsx`, the `<TagLogo variant="wordmark" size="lg" />` block), rather than being offset from it.

6. **Capture the retailer logo at sign-up** — the sign-up form currently collects no logo, so the top-left header has nothing retailer-specific to show for new accounts. Add an optional "Store logo" upload to the retailer sign-up form (transparent PNG/SVG recommended, image files only, size-limited, with a small live preview). On successful sign-up the file uploads to the existing branding storage bucket and its public URL is saved to the new retailer's `logo_url` — the same field Settings > Branding writes to. The top-left header (item 4) then renders that logo automatically, falling back to the Tag logo when the user skips the upload.
