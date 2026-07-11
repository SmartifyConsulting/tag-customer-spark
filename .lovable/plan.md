# Fixes & Consolidation

## 1. Signal analytics back on Insights
`SignalContributionsCard` is imported into `/intelligence/insights` but users report it is not visible. Likely causes: `getSignalContributions` returning empty (no `contributions` array) so the card collapses silently, or the query erroring quietly.
- Add explicit empty-state and error-state rendering to `signal-contributions-card.tsx` so the card is always visible above the AI Opportunity Feed.
- Verify `getSignalContributions` in `src/lib/dashboard.functions.ts` returns the expected `{ contributions: [...] }` shape; if the payload key drifted, restore it and add a small fallback (compute from `intent_score_weights`) so the panel never renders blank.

## 2. Hero logo 350% larger
In `src/routes/index.tsx` the hero has no logo — only the header logo at `h-16 md:h-20`. Add the Tag logo as a prominent element inside the hero left column, sized ~350% of the current header logo (`h-56 md:h-72`), placed above the "Retail engagement, reimagined" pill.

## 3. Merge Brand + Category + Sub-category into one Taxonomy admin
- Create `src/components/settings/taxonomy-admin-tab.tsx`: a single tree view with three levels — **Brand → Category → Sub-category** — plus product counts per node. Inline create/rename/delete/merge at every level. A "Merge duplicates" action detects same-slug categories/brands and consolidates them (reassigns products, deletes the loser).
- Update `src/routes/_authenticated/admin.categories.tsx` to render only the new `TaxonomyAdminTab` and drop the tab strip.
- Delete `src/routes/_authenticated/admin.brands.tsx` and `src/components/settings/brand-admin-tab.tsx`; keep `category-admin-tab.tsx` only if still referenced elsewhere, otherwise delete.
- Update `src/lib/nav.ts` label from "Categories" to "Taxonomy" (route stays `/admin/categories` to avoid breaking links; Users tab remains a sibling under `/admin/users`).
- Add a `mergeCategories` and `mergeBrands` server function in `categories.functions.ts` / `brands.functions.ts` (SECURITY DEFINER-safe: `retailer_id` scoped, uses `can_manage_retailer`).

## 4. Auto-link products also auto-fetches brand logos (remove logo wizard)
- Extend `linkProductsToBrands` in `src/lib/brands.functions.ts`: after creating/linking a brand, if `logo_url` is null, run `tryClearbit(website)` then AI fallback inline. Any brand still missing a logo after link is left blank — no manual wizard button.
- Remove the per-row "Logo" (Sparkles) button and the `resolveBrandLogo` mutation UI from the taxonomy tree (the server function stays available but is no longer surfaced).
- The single Taxonomy toolbar keeps an "Auto-link & fetch logos" button that calls the enhanced `linkProductsToBrands`.

## Technical notes
- Signal card: wrap render in `data?.contributions?.length ? <grid/> : <EmptyState/>` and surface `q.error` via toast + inline message.
- Taxonomy tree data source: reuse `listCategoriesWithCounts` and `listBrands`, combine client-side into a single tree keyed by brand → category (parents) → sub-category (children); product count comes from existing counts maps.
- Merge server fns: `UPDATE products SET category_id = winner WHERE category_id = loser`, then `DELETE FROM categories WHERE id = loser` (and same for brands with `brand_id`). All within retailer scope.
