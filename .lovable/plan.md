## Changes

1. **Upload new logo asset** — Use `lovable-assets create` from `/mnt/user-uploads/TagLogoNoSlogan-Photoroom-2.png` to produce `src/assets/tag-logo-hero.png.asset.json` (full Tag wordmark version).

2. **Hero page** (`src/routes/index.tsx`)
   - Replace the small header logo (`TagLogo` with `h-10 w-10`) with the new wordmark logo.
   - Scale to 500% larger than current (from h-10 → roughly h-60), preserving aspect ratio via `object-contain` and `w-auto`.

3. **Auth pages** (`src/components/auth-shell.tsx`)
   - Replace current `TagLogo` usage with the new wordmark logo image at a comparable enlarged size, maintaining aspect ratio.

4. **Sidebar logo** (`src/components/tag-logo.tsx`)
   - Keep current icon-only logo (`tag-logo-v2`) but enlarge by 40%: `lg` size from `h-28 w-28` → `h-40 w-40` (collapsed `sm` proportionally `h-16` → `h-[88px]`).

5. **Remove section labels from tab strip** (`src/components/section-tabs.tsx`)
   - Delete the left-side uppercase section label block (e.g. "WORKSPACE |") so tabs render flush.

6. **Rename Workspace → Dashboard** (`src/components/section-tabs.tsx`)
   - Change the `label: "Workspace"` to `label: "Dashboard"` (cosmetic only since label is no longer rendered, but keeps internal consistency).

7. **Dashboard greeting** (`src/routes/_authenticated/dashboard.tsx`)
   - Replace the current `PageHeader` title/subtitle with a personalized greeting using the auth profile's first name and time-of-day ("Good morning, Georgia"). Keep existing actions/content otherwise untouched.

No business logic, routing, or data changes.