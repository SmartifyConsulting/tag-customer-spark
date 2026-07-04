## Polish pass: green remnants, images, logo, sizing, tab text

**1. Remove remaining green**
- `src/components/ui/input.tsx` (search bar): audit focus ring / border tokens, swap any `ring-primary`/emerald leftovers to neutral black (`ring-foreground/20`, `border-input`).
- Global "All" filter button (likely in `src/components/section-tabs.tsx` or product/watchlist filter bars): replace green active state with black bg + cream text to match tab language.
- Grep `#00b074`, `emerald`, `green-` across `src/` and neutralize any stragglers on dashboard, product cards, badges (keep semantic success pills only where they mean "in stock").

**2. Logo refresh**
- Replace `src/assets/tag-logo-v2.png` (nav) and `src/assets/tag-logo-hero.png` (hero) with the newly attached logo via `lovable-assets create`, updating both `.asset.json` pointers.
- Favicon (`public/favicon.png`) regenerated from same source.

**3. Logo sizing**
- `src/components/tag-logo.tsx`:
  - Hero variant: reduce by 40% (e.g. `h-32 w-32` → `h-[77px] w-[77px]`; `h-[88px]` sm → `h-[53px]`).
  - Nav variant: increase by 20% (current nav size × 1.2, e.g. `h-10` → `h-12`, keeping aspect ratio).
- No layout container changes — only the image dimensions.

**4. Product images sanity pass**
- Re-run targeted SQL UPDATEs on `public.products` so `image_url` matches each product's `name`/`description`/`category` (coffee gear → espresso/beans imagery, apparel → clothing shots, etc.) instead of the broad SKU-pattern backfill. Themed Unsplash 800px URLs, one per product.

**5. Tab text color**
- `src/components/ui/tabs.tsx` + `src/components/section-tabs.tsx`: inactive tab text changes from cream (`text-background`) to pure white (`text-white`); active state (cream bg + black text) unchanged.

**Files touched:** `src/components/ui/input.tsx`, `src/components/section-tabs.tsx`, `src/components/ui/tabs.tsx`, `src/components/tag-logo.tsx`, `src/assets/tag-logo-v2.png.asset.json`, `src/assets/tag-logo-hero.png.asset.json`, `public/favicon.png`, plus a data-only product image SQL update.

**Verification:** Playwright screenshots of `/dashboard` (search + All button + nav logo), `/products` (tabs + images), and a hero page (logo size). Grep confirms no `emerald`/`green-`/`#00b074` remain in components. `SELECT count(*) FROM products WHERE image_url IS NULL` returns 0.
