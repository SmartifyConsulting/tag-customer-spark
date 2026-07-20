## Additions to the in-flight plan

### 1. Sidebar polish
- Remove the horizontal divider(s) rendered between the logo, groups, and footer in the left nav (`src/components/app-sidebar.tsx` — the `<SidebarSeparator />` / border-t utilities).
- Force the **Intelligence** group open on every render so its sub-items (Dashboard · Insights · Analytics · ROI · Trends · Forecasting) are always visible. Today the group uses `defaultOpen` derived from active route, which collapses it whenever the user isn't on an Intelligence page. Switch to a controlled `open` prop keyed to a constant `true` (or store per-user preference in localStorage but default to open).

### 2. Briefing greeting
- Change the header on `/briefing` from "Hello {first name}" to "Hello {store name}" (e.g. "Hello Makro Woodmead").
- Data source: the retailer's single active store (`stores.name`). When more than one store exists, use the retailer name (`retailers.name`) as the fallback so the greeting is still branded rather than personal.
- Fetch inside the existing briefing loader/server fn — no new server function needed, just extend the returned shape with `greetingName`.

### 3. Sample product spreadsheet
Generate `/mnt/documents/tag-sample-inventory.xlsx` with ~40 real, unique, high-signal products that will resolve cleanly through the enrichment + image pipeline. Emphasis on:

- **Valid, real GTINs** (verified check digits, one product per GTIN — no `06001234567899` placeholders).
- **Well-known FMCG / beauty / health lines** that Open Food Facts and Serper reliably index (so image + description resolution has a high hit rate on the first pass).
- Category mix aligned with a typical SA retailer (skincare, personal care, food staples, snacks, household, baby, OTC pharma, small electronics accessories) so the Taxonomy Engine's auto-detection has clear signals.

Columns will match the existing importer contract (verified against `src/lib/import.functions.ts` before generation): `sku, name, brand, gtin, category, price, currency, stock_qty, description`. Each row will be a real product/GTIN pair such as:

```text
Nivea Soft Moisturising Creme 200ml     4005808180080
Colgate Total Original 100ml            8718951288874
Sunlight Dishwashing Liquid 750ml       6001087005500
Ouma Rusks Buttermilk 500g              6001275000107
Jungle Oats Original 1kg                6001056000018
Peaceful Sleep Mosquito Repellent 150g  6001378016307
… (~40 rows)
```

Deliver the file with `<presentation-artifact>` so you can download it and drop it straight into the importer.

### Technical notes
- No schema changes; nav + greeting are pure frontend edits.
- Spreadsheet generation uses the xlsx skill (openpyxl) locally — no runtime code shipped.
- Existing in-flight plan items (taxonomy grid auto-seed, store attribution on QR, duplicates screen) remain unchanged.
