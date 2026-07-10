## Goal

Products should get a sensible category automatically, and every retailer (not just super admin) should have a proper Category Admin screen to review and correct them.

## What you'll see

1. **Automatic category on new products**
   - When a product is imported, scanned, or manually added without a category, the system picks the best matching category (or sub-category) from the retailer's existing tree.
   - If no existing category is a good fit, a new one is created (or an existing "Uncategorised" bucket is used, retailer's choice — default: create when confidence is high, otherwise place under "Uncategorised").
   - The passport enrichment step also proposes a `category_path` (e.g. `Food › Biscuits`) that feeds back into this.

2. **Category Admin as a first-class screen**
   - New nav item under **Admin → Categories** (visible to retail admins and store managers, not just super admin).
   - Existing Category Admin UI (tree with sub-categories, add/rename/delete) becomes the base of that page.
   - Adds a "Products in this category" count next to each row.
   - Adds a "Re-categorise all uncategorised" button that runs auto-categorisation across products missing a category.
   - Adds an inline "Move to…" action on each product from the Inventory row menu so a retailer can quickly fix a wrong category.

3. **Retailer can always override**
   - The existing product edit form already lets a retailer change category; we surface the AI-suggested category with a small "AI suggested" badge, and clearing/overriding it is one click.

## How it works (technical)

- New server helper `suggestCategoryForProduct` in `src/lib/categories.functions.ts`:
  - Inputs: retailer id, product name, brand, description, GTIN, existing categories tree.
  - Uses Lovable AI (`google/gemini-3-flash-preview`) with a strict JSON schema:
    `{ existing_category_id?: uuid, new_category?: { name, parent_name? }, confidence: 0-1 }`.
  - Falls back to a deterministic keyword mapper (biscuits, coffee, apparel, etc.) when AI is unavailable, and to "Uncategorised" otherwise.
- Hook it into:
  - `commitProductImport` in `src/lib/import.functions.ts` — when `category_id` is null after the current name-match step.
  - Manual product create/update in `src/lib/products.functions.ts` — same fallback path.
  - Passport enrichment — if `category_path` returned by AI is stronger than the current assignment, propose (do not overwrite) via a new `suggested_category_id` column.
- New nullable column `products.suggested_category_id uuid` + `products.category_confidence numeric` (nullable). Migration adds them with a GRANT/RLS-safe change (no new table).
- New server functions:
  - `bulkAutoCategorise({ onlyUncategorised: boolean })` — batches through products and applies suggestions.
  - `applySuggestedCategory({ productId })` and `dismissSuggestedCategory({ productId })`.
- New route `src/routes/_authenticated/admin.categories.tsx` that hosts `CategoryAdminTab` with the added counts + bulk action; nav `Admin` gains a Categories sub-link.
- Category Admin becomes visible to any user with `super_admin`, `retail_admin`, or `store_manager` role — same guard already used in Inventory.
- Inventory table gets a small pill on rows whose `suggested_category_id` differs from `category_id`, with quick "Apply" / "Dismiss" buttons.

## Files to add/change

- Add `src/routes/_authenticated/admin.categories.tsx`.
- Update `src/lib/nav.ts` (add Categories under Admin) and `src/routes/_authenticated/settings.tsx` (leave settings tab or remove — recommend keep for super admin, redirect retailers to new screen).
- Extend `src/lib/categories.functions.ts` with `suggestCategoryForProduct`, `bulkAutoCategorise`, `applySuggestedCategory`, `dismissSuggestedCategory`, and `listCategoriesWithCounts`.
- Extend `src/lib/import.functions.ts` and `src/lib/products.functions.ts` create/update paths to call the suggester.
- Extend `src/lib/passport.server.ts` to write `suggested_category_id` from `category_path` when confidence is high.
- One migration: add `suggested_category_id` and `category_confidence` to `products`.

## Out of scope

- Reorganising the existing category tree automatically.
- Multi-category-per-product.
- Re-training or fine-tuning; we rely on Lovable AI + deterministic fallback.