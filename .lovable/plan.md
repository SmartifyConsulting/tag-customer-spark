## Resequence & rename main nav

Edit `src/lib/nav.ts` — reorder and rename the `NAV` array to this final sequence:

1. **Dashboard** → `/dashboard` (unchanged)
2. **Inventory** → `/products` (unchanged)
3. **Customers** → `/customers` (renamed from "Customers & Leads"; match list unchanged so `/watchlists` and `/intent` still highlight it)
4. **Notifications** → `/inbox` (renamed from "Inbox"; icon stays `Inbox`)
5. **Insights** → `/analytics` (renamed from "Analytics & Insights"; match list and `feature: "roi"` gate unchanged)
6. **Admin** → `/admin` — new entry for workspace/plan admin surfaces (staff, stores, organisation, plan admin). Match `/staff`, `/stores`, `/organisation`. Icon: `ShieldCheck` (lucide).
7. **Settings** → `/settings` — user/workspace settings + billing/upgrade. Match `/settings`, `/upgrade`. Icon: `Settings`.

### Split of current Settings into Admin vs Settings

The existing "Settings" entry currently claims `/stores`, `/staff`, `/organisation`, `/settings`, `/upgrade` as one match group. Split it:
- **Admin** takes `/staff`, `/stores`, `/organisation` (org/team management).
- **Settings** keeps `/settings`, `/upgrade` (personal + billing).

No route files are moved or created — only the nav grouping/highlighting changes. If the current `/settings` page contains staff/stores/organisation tabs, leave them where they are; the nav's Admin entry still deep-links to the existing `/staff`, `/stores`, `/organisation` routes that already exist.

### Propagate to other nav surfaces

- `src/components/mobile-bottom-nav.tsx` — mirror the new order/labels if it uses a local list rather than `NAV`.
- `src/components/command-palette.tsx` — update hardcoded "Customers & Leads", "Inbox", "Analytics & Insights", "Settings" labels; add "Admin" entry.
- Page `PageHeader` titles that duplicated old nav labels (Inbox → "Notifications") — update only header text.

### Out of scope

- No route path changes, no new route files, no tier/permission changes.
- No dashboard or feature-gate behavior changes.