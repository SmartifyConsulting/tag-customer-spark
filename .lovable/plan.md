MVP realignment with a clearer tier ladder: Starter is the recovery essentials, Pro adds scale + AI assist, Enterprise unlocks Intelligence, ROI, and weekly briefings. Deliverable this round is the matrix + scoped removals + gating plan for the follow-up build turn.

## Tier ladder at a glance

- **Starter** — the recovery loop. QR tags, opt-in, notifications, inbox, coupons, 4-KPI dashboard, one store.
- **Pro** — everything in Starter **plus**: multi-store, bulk QR + PDF export, AI campaign assistant, CSV/XLSX exports, advanced campaign analytics.
- **Enterprise** — everything in Pro **plus**: Intelligence suite, Performance & ROI, weekly AI briefings & executive summary, intent score engine, scheduled exports, API access, SSO, audit log export.

## What each tier adds over the previous

### Starter (baseline — the recovery essentials)
- Dashboard: 4 core KPIs (today's scans, customers waiting, revenue recovered, top product interest)
- Engagement: Customers, Products, QR Tags, Watchlists, Compare
- Alerts: Inbox, Notification composer, Campaign tracker
- Basic campaign performance: sent / delivered / read / redeemed / CTR
- Coupon redemption
- Watchlist automation triggers (sale / restock / price drop)
- Single store, Staff, Roles, Settings, Billing

### Pro adds (on top of Starter)
- Multi-store management
- Bulk QR generation + PDF export
- **AI campaign assistant** (write / rewrite / predict response)
- CSV and XLSX exports
- Advanced campaign analytics (segment breakdowns, cohort view)

### Enterprise adds (on top of Pro)
- **Intelligence suite** — Opportunity feed, Intent, Trends, Forecasting, Insights
- **Performance & ROI** — ROI engine, Pricing sensitivity, Funnel, Analytics history, Reports, Heatmap
- **Weekly AI briefings + executive summary**
- Intent score engine + weight tuning
- Scheduled exports
- API access, SSO, audit log export

## Full matrix

| Feature | Starter | Pro | Enterprise |
|---|:---:|:---:|:---:|
| 4-KPI dashboard | ✓ | ✓ | ✓ |
| Engagement (Customers, Products, QR Tags, Watchlists, Compare) | ✓ | ✓ | ✓ |
| Alerts (Inbox, Composer, Campaign tracker) | ✓ | ✓ | ✓ |
| Basic campaign performance | ✓ | ✓ | ✓ |
| Coupon redemption | ✓ | ✓ | ✓ |
| Watchlist automation triggers | ✓ | ✓ | ✓ |
| Staff, Roles, Settings, Billing | ✓ | ✓ | ✓ |
| Stores | 1 | Unlimited | Unlimited |
| Bulk QR / PDF export | — | ✓ | ✓ |
| AI campaign assistant | — | ✓ | ✓ |
| Advanced campaign analytics | — | ✓ | ✓ |
| Exports | — | CSV / XLSX | CSV / XLSX + scheduled |
| **Intelligence suite** | 🔒 | 🔒 | ✓ |
| **Performance & ROI** | 🔒 | 🔒 | ✓ |
| Weekly AI briefings + executive summary | 🔒 | 🔒 | ✓ |
| Intent score engine + weight tuning | 🔒 | 🔒 | ✓ |
| API access / SSO / audit log export | — | — | ✓ |

Legend: ✓ available · 🔒 visible in nav with upsell · — not shown.

## Stock-management surfaces to remove

Tag's job is recovery, not inventory. Remove/retire:

- `src/components/dashboard/low-stock-card.tsx` and its slot on the Dashboard.
- Any "low stock" KPI tile on the Dashboard overview.
- Low-stock alert type from the notification composer's built-in templates (keep "back in stock" and "restock" — those drive customer notifications, not inventory ops).
- Watchlist trigger `low_stock` — retain in DB (still used by triggers) but hide from the Watchlist creation UI; keep `on_sale`, `back_in_stock`, `price_drop_below`, `any_update`.
- Product form: hide `stock_qty` and `low_stock_threshold` inputs from the Product form dialog.
- Products table: drop the Stock column from the default view; keep it as an optional column toggle.
- Remove "Low stock" filter chip from `products-toolbar.tsx`.

Nothing dropped from the schema — UI-only surface pruning so Tag doesn't masquerade as an inventory tool.

## Tier gating plan (for the follow-up build turn)

1. **Schema**: add `retailers.tier` as enum `tag_tier` (`starter`, `pro`, `enterprise`), default `starter`. Backfill demo retailers to `enterprise` so Georgia keeps seeing everything during dev.
2. **Server**: extend the existing `resolveRetailerId` helpers with a `resolveRetailerContext` returning `{ retailerId, tier }`, and add a `TIER_FEATURES` map (single source of truth) with booleans like `intelligence`, `roi`, `aiAssistant`, `weeklyBriefings`, `intentEngine`, `bulkQr`, `advancedExports`, `apiAccess`, `multiStore`.
3. **Client hook**: `useTier()` reading from a new lightweight `getWorkspaceTier` server fn cached in React Query.
4. **Nav**: `SectionTabs` renders Intelligence and Performance & ROI tabs always, but locked tabs get a lock icon + click routes to `/upgrade?feature=<slug>` instead of the module. The sidebar entry stays visible with the same lock affordance.
5. **Upsell screen**: new route `/upgrade` (inside `_authenticated`) reads `?feature=` and renders the Starter/Pro/Enterprise comparison table above with contextual copy ("Intelligence is a Tag Enterprise feature").
6. **Route guards**: for every route under `intelligence.*`, `commerce.*`, `analytics.*`, `intent.tsx` — add `beforeLoad` tier check → `throw redirect({ to: '/upgrade', search: { feature } })` when locked. Prevents deep-link bypass.
7. **Dashboard**: Starter/Pro get 4 KPI tiles; Enterprise keeps the fuller layout. Starter/Pro also get an "Unlock Intelligence" upsell card below the KPIs.
8. **Settings**: add a read-only "Plan" row showing current tier + "Manage plan" button (stub until billing lands).
9. **Dev switch**: Settings → Workspace shows a tier picker for users with `super_admin` role so we can preview each experience without touching the DB.

## Out of scope

- Billing integration (waits on payment provider choice).
- No deletion of backend tables/functions/triggers — UI scoping only.
- No pricing amounts on the upgrade screen yet — placeholders until pricing signed off.

Approve and I'll implement it in one build pass: migration + tier context first, then nav + guards, then dashboard trim + stock-UI removal.
