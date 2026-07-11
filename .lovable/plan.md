## 1. Dashboard row: Scan Heatmap + Scan Trends side-by-side
- In `src/routes/_authenticated/dashboard.tsx`, place `ScanHeatmapCard` (left) and `ScanTrendsCard` (right) in a 2-col grid (`md:grid-cols-2`), each half width.
- In `src/components/dashboard/scan-heatmap-card.tsx` add a clear caption under the title: "Scans by day of week × hour — darker cells = more shopper scans" plus a small legend strip (low → high) and axis labels ("Hour of day" / "Day of week").

## 2. Fix Inventory accordion expand
- In `src/components/products/products-table.tsx` (category accordion), the click handler on the category row isn't toggling. Restore `Accordion type="multiple"` with controlled `value`/`onValueChange`, ensure `AccordionTrigger` wraps the whole row (not just chevron), and remove any `e.stopPropagation()` on inner buttons that swallows the toggle click. Verify children render products when expanded; add empty-state row when a category has 0 visible products after filters.

## 3. Configurable Product Taxonomy Engine (replaces fixed Brand→Category→Sub-cat tree)

### Data model (migration)
- New table `taxonomy_profiles`: `id, retailer_id, name, is_default, is_published, created_by, created_at, updated_at`.
- New table `taxonomy_levels`: `id, profile_id, position (int), attribute_key (text), label (text), created_at`. `attribute_key` ∈ allow-list: `department, category, subcategory, brand, supplier, range, collection, season, gender, product, variant, size, colour, price_band, status`.
- RLS: retailer-scoped via `can_manage_retailer(retailer_id)`; GRANTs to `authenticated` + `service_role`. Trigger to keep only one `is_default` per retailer.
- Seed a "Retail" default profile per retailer (levels: brand → category → subcategory → product).

### Server functions (`src/lib/taxonomy.functions.ts`, new)
- `listProfiles()`, `getProfile(id)`, `upsertProfile({id?, name, levels[]})`, `deleteProfile({id})`, `setDefaultProfile({id})`, `publishProfile({id})`.
- `getAttributeCatalog()` returns the allow-list with display labels + which are available given current data (e.g. hides `supplier` if no products carry it).
- `browseTaxonomy({profileId, path: string[]})` — the dynamic driver used by the frontend. Given the ordered levels and a path of chosen values, groups remaining products by the next level's `attribute_key` and returns `[{ value, label, count, hasChildren }]`. Leaf level returns products.

### Admin UI (`src/components/settings/taxonomy-admin-tab.tsx`, replaces current tab content)
- Profile switcher (dropdown) + New / Rename / Duplicate / Set default / Delete.
- Two-column layout:
  - **Left**: Level builder. Vertical drag-and-drop list of levels (using `@dnd-kit/sortable`, already common in shadcn stacks — add if missing). Each row shows level label, source attribute (Select), delete. "Add level" adds a new row from the attribute catalog; drag to reorder.
  - **Right**: **Live preview** — renders the same dynamic browser the frontend will use, driven by the in-memory (unsaved) level config via `browseTaxonomy` (call with `dryLevels` param so unsaved edits preview without persisting).
- Footer: `Save draft` and `Publish` (Publish flips `is_published` and marks this profile as the active navigation source).

### Frontend browser (`src/components/inventory/dynamic-taxonomy-browser.tsx`, new; wired into `src/routes/_authenticated/products.index.tsx`)
- Reads the retailer's published (or default) profile.
- Renders nested accordions generated from `profile.levels`; each expanded node calls `browseTaxonomy` with its path to fetch the next level's groups or the leaf product list.
- Breadcrumbs at top ("All › Nike › Footwear › Running"). User-switchable profile picker (Retail / Buying / Warehouse / Marketing) persisted per-user in `localStorage`.

### Migration & cleanup
- Keep existing `brands` / `categories` tables (they supply the `brand` and `category` attribute values). No data loss.
- Existing `/admin/categories` route becomes "Taxonomy" and hosts the new admin. Old `BrandAdminTab` and `CategoryAdminTab` are removed from that route (brands/categories are still manageable via a compact "Attribute values" side-panel inside Taxonomy admin for renaming/merging).

## Technical notes
- Attribute → product-column mapping lives in a single `ATTRIBUTE_MAP` in `taxonomy.functions.ts` so `browseTaxonomy` can build the right `select` + `group by` without dynamic SQL.
- `browseTaxonomy` returns counts by counting distinct product IDs after applying all ancestor filters — so counts stay accurate under any hierarchy order.
- Preview uses the same component as production browser to guarantee WYSIWYG.
- Heatmap legend is CSS-only (linear-gradient strip), no new deps.
