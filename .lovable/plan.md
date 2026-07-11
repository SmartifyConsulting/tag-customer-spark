# Delivered

## Dashboard
- Scan heatmap and Scan trends now share a 2-column row (heatmap on the left).
- Heatmap has a caption, axis labels (Hour of day / Day of week) and a gradient legend.

## Inventory browser modes
- New List / Browse toggle in the Inventory header.
- List keeps the existing category accordion + toolbar + pagination.
- Browse renders the new `DynamicTaxonomyBrowser`, driven by the active Taxonomy profile.

## Configurable Product Taxonomy Engine
- New tables: `taxonomy_profiles`, `taxonomy_levels` (RLS + retailer-scoped).
- Trigger ensures a single default profile per retailer.
- Server fns in `src/lib/taxonomy.functions.ts`:
  - `listProfiles`, `getProfile`, `upsertProfile`, `deleteProfile`, `setDefaultProfile`, `publishProfile`, `getActiveProfile`
  - `browseTaxonomy({ profileId | dryLevels, path })` — dynamic grouping engine over Brand, Category, Sub-category, Store, Size, Colour, Variant, Gender, Status, Price band, On promotion, Product.
- Admin UI (`TaxonomyEngineTab` on `/admin/categories`):
  - Multiple named profiles (e.g. Retail, Buying, Warehouse, Marketing) with Set default / Publish / Delete.
  - Drag-and-drop level ordering (`@dnd-kit/sortable`).
  - Live preview panel using the retailer's real catalogue.
- Frontend browser (`DynamicTaxonomyBrowser`) reads the published (or default) profile — no code changes needed to add new hierarchies.
