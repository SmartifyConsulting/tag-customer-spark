## 1. Hero logo — drop by 2cm

`src/routes/index.tsx` (line 40) — add `mt-[2cm]` to the Tag logo `<img>` in the landing header so it sits 2cm lower on the hero page. No other layout changes.

## 2. WhatsApp selection — burnt orange with white text

`src/routes/_authenticated/inbox.tsx`, conversation list item (around lines 148–195):
- Swap the `isActive && "bg-primary text-primary-foreground hover:bg-primary"` styling to `bg-accent text-white hover:bg-accent` (burnt orange token `--accent = #d4842a`, forced white type).
- Update the inner name/preview/avatar/time spans so every descendant reads white when `isActive` (currently some use `text-primary-foreground` / muted variants that render off-white).
- Avatar circle when active: `bg-white/20 text-white`. Unread badge when active: `bg-white text-accent`.

No changes to the conversation pane itself.

## 3. Merge Inventory sections from the front end

Goal: from the Inventory → Browse view (dynamic taxonomy browser), let the user pick one group as the target, select one or more other groups at the same level, and merge them all into the target. "Category" example given, but the same UI must work for any grouping level the active taxonomy profile is on (Brand, Category, Sub-category, etc.).

### Backend — new server function

New file `src/lib/taxonomy-merge.functions.ts`:
- `mergeTaxonomyGroups({ attribute_key, target_value, source_values[] })` — `createServerFn` with `requireSupabaseAuth`.
- Validates `attribute_key` against the whitelist the browser already supports (`brand`, `category`, `sub_category`, `store`, `size`, `colour`, etc. — mirror the mapping in `browseTaxonomy`).
- Resolves the underlying column (e.g. `category`, `brand`, `sub_category`) and issues a single `UPDATE public.products SET <col> = target WHERE retailer_id = auth AND <col> IN (source_values)`.
- Returns `{ updated: n }`.
- RLS already scopes writes to the retailer; no schema change needed.

For `brand` (FK to a brands table) the function also re-points `brand_id` to the target brand row and optionally soft-deletes the emptied source brand rows (only if they have zero remaining products for the retailer). Category/sub-category are plain text columns → straight UPDATE.

### Frontend — merge UI inside `DynamicTaxonomyBrowser`

`src/components/products/dynamic-taxonomy-browser.tsx`:
- Add a `mergeMode` toggle button ("Merge sections") shown above the groups grid when `q.data?.groups` is present and there are ≥ 2 groups.
- When on: each group tile gets a checkbox; a sticky action bar appears with `Target: <group name>` (the currently focused / first-clicked group), a multi-select summary ("3 sections selected"), and a `Merge into "<target>"` primary button.
- Interaction: first click selects the target (highlighted, ring-accent). Subsequent clicks toggle sources. A "Change target" link resets selection.
- Confirm dialog: "Merge 3 sections into 'Baby Cereal'? 42 products will be re-categorised. This cannot be undone." → calls `mergeTaxonomyGroups` via `useServerFn`, then `queryClient.invalidateQueries({ queryKey: ["taxonomy-browse"] })` and any inventory list queries, toasts result, exits merge mode.
- Disabled state + tooltip when the current level's `attribute_key` is not mergeable (e.g. computed buckets like `price_band`) — only text/FK attributes can be merged.

No changes to the taxonomy admin, list view, or other screens.

## Technical notes

- Burnt orange = existing `--accent` token (`#d4842a`); forcing `text-white` (not `text-accent-foreground`) matches the user's request for white type regardless of theme.
- Merge is a bulk column update on `public.products` scoped by RLS; safe with the existing `authenticated` grant and retailer policies.
- Confirm dialog uses the existing `AlertDialog` component; toast via existing `sonner` setup.
- No new dependencies.
