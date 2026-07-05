## Changes

### 1. Customers table — align headings with values
In `src/routes/_authenticated/customers.tsx`, the header row uses `<span>` cells so text left-aligns while numeric values sit left too, but per the reference the numeric columns (Scans, Interests, Revenue) read cleaner when headings sit above their values consistently. Update the header row grid cell classes so Scans/Interests/Revenue headings use the same left padding/alignment as the data cells (both left-aligned, same column start). No layout/grid template change — just apply matching text alignment classes to header spans so each heading sits directly above its value column.

### 2. Nav order + rename
`src/lib/nav.ts`:
- Reorder: Dashboard → **Inbox** → **Items & Tags** → **Campaigns** → **Customers & Leads** → Analytics → Settings.
- Rename "Alerts & Campaigns" → **Campaigns**.

### 3. "Powder Blue" Back in Stock badge
`src/components/notifications/status-badge.tsx` + `src/routes/_authenticated/watchlists.tsx`: change `back_in_stock` from `bg-teal-500` to a powder blue (`bg-sky-200 text-sky-900` — soft, readable).

### 4. "New" customer flag (first view only)
- `src/lib/customers.functions.ts`:
  - `listCustomers`: when `segment === "all"` and no letter/search filter, sort by `created_at DESC` (already does) and include `is_new` derived from `viewed_at IS NULL` (new column).
  - New server fn `markCustomersViewed({ ids })` — sets `viewed_at = now()` for the retailer's customers.
- DB migration: add `customers.viewed_at timestamptz` nullable.
- `src/routes/_authenticated/customers.tsx`:
  - Render a small "New" pill (mint) next to the name when `is_new` is true.
  - On mount / when the "All" pill is selected, collect unseen ids from the current page and call `markCustomersViewed` after a short delay (e.g. 1.5s) so they clear on next view but remain visible & badged during this session.
  - When segment = "All" and default (page 1), newest-first ordering is already the natural sort — keep it. New customers therefore appear at the top by default.

### 5. Admin tabs for System Admin
`src/routes/_authenticated/settings.tsx` — add three new tabs, visible only to `super_admin`:
- **Category Admin** — manage product categories with nested sub-categories (Men → Shirts, Women → Dresses, etc.).
- **Subscription Plan Admin** — rename/repurpose the existing Plan Admin tab surface so the label is explicit.
- **User Admin** — manage staff users across retailers (list, disable, reset).

New files:
- `src/lib/categories.functions.ts` — `listCategories`, `createCategory({ name, parent_id? })`, `renameCategory`, `deleteCategory`. All `super_admin`-gated.
- `src/components/settings/category-admin-tab.tsx` — two-level tree UI (parents with expandable children, inline add sub-category button).
- `src/components/settings/user-admin-tab.tsx` — table of staff across retailers with basic actions (reuses `staff.functions.ts` where possible; add `super_admin` list-all fn if needed).

DB migration:
- New table `public.product_categories (id uuid pk, retailer_id uuid null, parent_id uuid null references product_categories(id) on delete cascade, name text not null, created_at timestamptz default now())` with GRANTs + RLS (super_admin full, retail_admin read own).

### Files touched
- `src/lib/nav.ts`
- `src/components/notifications/status-badge.tsx`
- `src/routes/_authenticated/watchlists.tsx`
- `src/routes/_authenticated/customers.tsx`
- `src/lib/customers.functions.ts`
- `src/routes/_authenticated/settings.tsx`
- new: `src/lib/categories.functions.ts`, `src/components/settings/category-admin-tab.tsx`, `src/components/settings/user-admin-tab.tsx`
- migration: `customers.viewed_at`, `product_categories` table

### Out of scope
- No changes to Twilio templates, billing, or existing role model beyond adding admin views for `super_admin`.
