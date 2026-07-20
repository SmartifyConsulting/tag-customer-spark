## 1. Setup wizard — remove Customers & Stores uploads, auto-detect branches

`src/routes/setup.tsx`
- Drop the `customerFile` / `customerImporting` / `storeFile` / `storeImporting` steps and all related state, refs, mutations, effects, and imports (`previewCustomerImport`, `commitCustomerImport`, `previewStoreImport`, `commitStoreImport`, `StoreImportRow`, `CustomerImportRow`).
- After the product `importing` step finishes, call a new server fn `autoDetectStoresFromProducts`, then go straight to `done`.

New helper `src/lib/stores.functions.ts` → `autoDetectStoresFromProducts`
- Read distinct `store_id` values from the retailer's `products` (with per-store counts).
- Insert a placeholder store row for every referenced `store_id` that has no matching `stores` row (name = "Branch N").
- If products reference zero stores AND `stores` is empty, insert one store named after the retailer with `notes = "Sole proprietor"`.
- Returns `{ createdCount, soleProprietor }`.

## 2. Fix "Digital Identity Build" hang at 4/7 (QR duplicate-key)

Root cause (verified): the DB index `product_qr_assets_active_gtin_uidx` is `UNIQUE (gtin) WHERE status='active'` — globally unique across all retailers. `qr.functions.ts::generateForProduct` checks GTIN uniqueness scoped per-retailer, and `assignMissingBarcodes` generates deterministic GTIN-13s that can collide across retailers. The second insert throws `duplicate key … product_qr_assets_active_gtin_uidx`, killing the bulk loop and freezing the progress bar at "Converting to QR codes".

Migration:
- Drop `product_qr_assets_active_gtin_uidx`.
- Recreate as `UNIQUE (retailer_id, gtin) WHERE status = 'active'` — matches the code's per-retailer scope.

Code hardening in `src/lib/qr.functions.ts`:
- On 23505 for this index, re-fetch any lingering active row for `(retailer_id, gtin)`, retire it, retry once.
- `bulkGenerateQrs` / wizard bulk loop already collect per-product errors — surface the count in the toast instead of aborting the whole step.

## 3. Navigation — new bold pink menu style + simplified item set

Reference: the attached image shows top-nav items styled as plain text with a small chevron for dropdowns (no pill background). Replicate that style but in the pink brand colour.

`src/components/app-top-nav.tsx`
- Remove the mint pill background. Each item becomes plain text: `text-[#A6446B] font-semibold text-sm`, hover `text-[#7d3350]`, active `underline underline-offset-4`.
- Dropdown triggers keep the `ChevronDown` icon.
- Same treatment for `MarketingNav` pills on the marketing/auth header so the whole app matches.

`src/lib/nav.ts` — simplified item set:

| Top item | Type | Children |
| --- | --- | --- |
| **Product** | dropdown | Dashboard, **Messages** *(was WhatsApps)*, Inventory, Customers |
| **Intelligence** | dropdown | Insights, Analytics, ROI, Trends |
| **Admin** | dropdown *(admin-only)* | Taxonomy, Stores, Users → `/admin?tab=…` |
| **Pricing** | flat link *(super-admin only)* | `/admin/pricing` |

- Removes the top-level **Settings** entry (still reachable via avatar menu).
- Non-admins don't see Admin; non-super-admins don't see Pricing.
- Mobile bottom nav keeps the four most-used flat links (Dashboard, Messages, Inventory, Customers).

## 4. Rename WhatsApps → Messages (label only)

The current top-level "WhatsApps" item pointing at `/inbox` becomes **Messages** everywhere it renders. Scope:
- `src/lib/nav.ts` — label change in the new Product dropdown entry.
- `src/routes/_authenticated/inbox.tsx` — page `head` title, `PageHeader` title, and any "WhatsApps" copy in the empty state / section headings.
- `src/components/command-palette.tsx` — command entry label.
- Any breadcrumb / tab / dashboard link copy that reads "WhatsApps".

Route path stays `/inbox` (no redirect needed). Underlying WhatsApp connector/provider names in server code and DB (`whatsapp_messages`, `send-whatsapp-message`, `TWILIO_WHATSAPP_FROM`) are unchanged — only the user-facing label moves.

## 5. Role gating

Admin = `super_admin | retail_admin | store_manager`. System Admin = `super_admin` only.

- `useIsAdmin()` helper in `src/hooks/use-auth.tsx`.
- Non-admins hitting `/admin/*` redirect to `/dashboard`.
- Delete buttons across Inventory, Stores, Users, Products, Customers rendered only when `isAdmin` (RLS already blocks the writes — UI polish).
- `/admin/pricing` stays super-admin-only.

## 6. Admin as one tabbed page

New `src/routes/_authenticated/admin.tsx` with `?tab=` — tabs: Taxonomy / Stores / Users.
- Taxonomy → body of current `admin.categories.tsx`.
- Stores → new `StoresView` component (extracted from `stores.tsx`) with the grid/list toggle from §7.
- Users → `UserAdminTab`.

Delete `admin.categories.tsx`, `admin.users.tsx`, `stores.tsx`. Redirect `/admin/categories`, `/admin/users`, `/stores` → `/admin?tab=…`. `admin.inventory.*` and `admin.pricing.tsx` stay as their own routes.

## 7. Stores: grid / list toggle with persistence

Inside `StoresView`, add a Grid/List `ToggleGroup` in the toolbar. Initial mode from `localStorage.getItem("stores.view")` (default `"grid"`); write on change. List mode = `<Table>` with Name, Location, Manager, Contact, Scans, Staff, Recovered, Status, Actions.

## Technical details

- Only DB change: the QR unique-index swap in §2.
- Pink text nav uses existing `#A6446B` accent — no new tokens.
- Search-param tab wiring follows existing `Route.useSearch()` + `navigate({ search })` pattern.

## Out of scope

- No redesign of Settings, Pricing, Inventory admin screens beyond delete-button gating.
- No RLS policy changes.
- No change to the WhatsApp send infrastructure — only the "WhatsApps" label becomes "Messages".
