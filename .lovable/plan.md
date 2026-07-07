## Billing tab — plan grid cleanup

Scope: `src/components/settings/billing-tab.tsx` and `src/lib/billing/pricing.ts`. Presentational changes plus a small pricing constant edit; no billing logic changes.

### 1. Remove the Tag Go plan
- In `src/lib/billing/pricing.ts`, remove `"go"` from `SELF_SERVE_PLANS` so it no longer renders in the billing grid or `/upgrade` self-serve columns.
- Leave the `go` entry in the `PLANS` map and the `PlanId` union so any existing subscription rows or historical references still resolve.
- Grid becomes 4 self-serve plans (Starter, Growth, Pro) + Enterprise = 4 columns. Update `billing-tab.tsx` grid to `md:grid-cols-2 xl:grid-cols-4`. Update `/upgrade` (`src/routes/_authenticated/upgrade.tsx`) grid similarly and drop the `go` column from the comparison `MATRIX` rows.

### 2. Remove per-card payment buttons
In `PlanCard`, drop the PayFast and PayPal `<Button>`s. `startPayfast` / `startPaypal` handlers move to `BillingTab` (see step 4). Keep the "Switch to …" secondary button for users with an active sub on a different plan.

### 3. Remove "Ideal: …" lines
- Remove the `<p>Ideal: {p.ideal_candidate}</p>` line from `PlanCard`.
- Remove the same line from `EnterpriseCard`.

### 4. Compact each plan card
- Tighten header: price `text-2xl` instead of `text-3xl`, keep tagline only on Enterprise, `CardHeader className="pb-3"` and `CardContent className="pt-0"`.
- Feature list: `text-xs`, `space-y-1`, icons `h-3.5 w-3.5`.
- Show first 5 `features`; hide `locked` items on the compact card (still visible on `/upgrade`).

### 5. Single PayFast/PayPal action bar under the grid
Below the plan grid, add one shared card:

```text
Selected plan: <name> · <cycle>
[ Pay with PayFast (ZAR R…/mo) ]  [ Pay with PayPal ($…/mo) ]
Helper: "Choose a plan above, then pay in Rand via PayFast or USD via PayPal."
```

Implementation:
- `const [selectedPlan, setSelectedPlan] = useState<PlanId>(currentTier === "enterprise" || currentTier === "go" ? "starter" : currentTier);`
- Each `PlanCard` becomes selectable via `selected` + `onSelect` props; highlight with a ring in addition to the existing `isCurrent` `border-mint`.
- Move `startPayfast` / `startPaypal` into `BillingTab`, driven by `selectedPlan` + `cycle`, with price labels from `priceCents(selectedPlan, cycle, …)` + `formatZar` / `formatUsd`.
- Keep in-card "Switch to <plan>" secondary button unchanged for active-sub plan switches.
- Enterprise card unchanged (still shows Contact sales); not selectable for PayFast/PayPal.

### 6. Leave untouched
- Current-plan card, Usage card, Invoices card.
- Monthly/Annual cycle toggle.
- All server functions and the underlying `PLANS` data (only `SELF_SERVE_PLANS` changes).
