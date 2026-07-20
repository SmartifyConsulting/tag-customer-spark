## 1. Fix "permission denied for function has_role" (product image resolution)

Root cause confirmed from DB: `public.has_role(uuid, app_role)` currently grants `EXECUTE` only to `postgres`, `service_role`, `sandbox_exec` — `authenticated` is missing. The restore migration on disk was never applied to the live DB. RLS on `products` calls `has_role(...)`, so any authenticated `products` read fails with the toast in the earlier screenshot.

Fix (new migration): `GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;`

## 2. Fix resolver domain (QR codes still pointing at penguin.co.za)

`resolverUrlForGtin()` in `src/lib/passport.server.ts` reads `PUBLIC_SITE_URL` and falls back to `https://tag-customer-spark.lovable.app`. Any QR/DPP generated while `PUBLIC_SITE_URL` was `https://www.mypenguin.co.za` (and any legacy `product_qr_assets.resolver_url` stored then) still encodes that dead domain — e.g. `https://www.mypenguin.co.za/passport/02007453265`.

Actions:
- Change the fallback in `getPublicSiteBase()` to `https://tag-tech.co.za` (the live custom domain), so a missing env doesn't regress again.
- Add a `SITE_URL` (or reuse `PUBLIC_SITE_URL`) secret set to `https://tag-tech.co.za` via the secrets tool.
- Backfill migration: `UPDATE public.product_qr_assets SET resolver_url = REGEXP_REPLACE(resolver_url, '^https?://(www\.)?mypenguin\.co\.za', 'https://tag-tech.co.za'), digital_link_url = REGEXP_REPLACE(digital_link_url, '^https?://(www\.)?mypenguin\.co\.za', 'https://tag-tech.co.za') WHERE resolver_url ILIKE '%mypenguin.co.za%' OR digital_link_url ILIKE '%mypenguin.co.za%';`
- Bump `version` on each backfilled row so any cached PNG/SVG regenerates on next view (existing PNGs still encode the old URL until the user hits "Regenerate" — add a note in the panel banner that pre-domain-change codes should be reprinted).

## 3. Fix "View public page" → Product not found

The "View public page" button on the product detail links to `qr.resolver_url` (or `/passport/{gtin}`). The 404 page is our own `/passport/$gtin` route — it triggers when either the GTIN fails GS1 check-digit validation or no `products` row with that GTIN + `status='active'` exists.

Actions:
- Log the raw `gtin` param in the not-found branch so we can distinguish "bad check digit" vs "no row" during rollout.
- In `products.$productId` / QR panel, if the current product has no `gtin`, hide "View public page" (currently renders but leads here). If it has a `gtin` but no `product_qr_assets` row yet, route through `/p/{dppId}` instead when `dppId` exists, else prompt "Generate QR first".
- Update the 404 page copy to include the raw GTIN and a "Register this GTIN" CTA that opens the create/merge flow for admins.
- Verify the passport lookup query also matches on `qr_tags.gtin` (fallback), not just `products.gtin`, so a GTIN registered on a QR-only shell row still resolves.

## 4. Sidebar nav restructure (`src/lib/nav.ts` + `src/components/app-sidebar.tsx`)

`NAV` becomes:
- **Briefing** → `/dashboard` (personalised home, renamed)
- **Messages** → `/inbox`
- **Inventory** → `/admin/inventory`
- **Intelligence** (expanded by default; sub-items are the "used to be there" set):
  - Dashboard → `/intelligence` (the exec KPI view)
  - Insights → `/intelligence/insights`
  - Analytics → `/analytics`
  - ROI → `/commerce/roi`
  - Trends → `/intelligence/trends`
  - Forecasting → `/intelligence/forecasting`
- **Admin** (adds Customers tab): Taxonomy · Stores · Customers · Users — all `/admin?tab=…`
- **Pricing** — super_admin only, unchanged

Remove top-level **Customers**; redirect `/customers` → `/admin?tab=customers`. Update `src/routes/_authenticated/admin.index.tsx` to add the customers tab, reusing the existing customers view. Update `MOBILE_NAV` and `command-palette.tsx` (rename Dashboard → Briefing, move Customers under Admin).

### "Pointers to the navigation tip comments"
Extend the inline JSDoc-style comments already at the top of each `NavItem` in `src/lib/nav.ts` with explicit pointers explaining *why* an item lives where it does (e.g. "Briefing = personalised home, not the exec KPI view — that one is Intelligence → Dashboard"). Purely code-comment; no on-screen tooltips added. Say so if you actually want in-UI help pointers.

## 5. Rename Dashboard → Briefing

Rebuild `src/routes/_authenticated/dashboard.tsx`:
- `PageHeader` title "Briefing", description "Your day at a glance."
- **Tagged Products** — `<Accordion type="multiple">`, all sections collapsed. Sections: This Week (Mon 00:00 → now), Last Week, then one section per calendar month of the current year with ≥1 tagged product (newest first, non-overlapping with the two week buckets). Row = `ProductImage` thumb + name + brand + tagged-at → links to `/admin/inventory/$productId`.
- **Unread WhatsApps needing response** — inbound-only conversations with no outbound reply since the last inbound; each row links to `/inbox?conversation=…`.

New server fn `getBriefing` (auth-scoped, retailer-scoped via `requireSupabaseAuth`) in `src/lib/dashboard.functions.ts`, plus `briefingQueryOptions` in `src/lib/dashboard.ts`. Reads existing `products`, `conversations`, `conversation_messages` — no schema change.

The existing exec KPI dashboard content moves to `intelligence.index.tsx` under Intelligence → Dashboard.

## 6. Cleanup

- `command-palette.tsx`: rename Dashboard → Briefing; move Customers into "Admin" group.
- `MOBILE_NAV`: keep 4 slots but drop Customers (now under Admin) in favour of Briefing.
- Preserve tier gating (`intelligence`, `roi`) on all moved routes.
- Sidebar active-state: Briefing wins at exact `/dashboard`; Intelligence group highlights only for its non-`/dashboard` sub-paths.
