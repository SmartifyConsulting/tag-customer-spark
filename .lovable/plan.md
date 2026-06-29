## Diagnosis

The data is already seeded (48 products, 150 customers, 864 scans, 670 notifications, etc.), but your demo login `info@georgiaadams.co.za` is currently a `sales_assistant` with **no retailer assigned**. Every table in the platform is protected by row-level security keyed on `retailer_id`, so an account with no retailer link sees an empty platform — exactly what you're experiencing.

## Fix

1. Promote `info@georgiaadams.co.za` to `retail_admin` of **Aurora Apparel** (the richer of the two seeded retailers — 24 products, the bulk of scans, campaigns, conversations and recoveries).
2. Also add a second `retail_admin` row for **Cape Coffee Co.** so you can switch between tenants and see both datasets through the same login.
3. Backfill her `profiles` row (full name, avatar placeholder) so the user menu and audit logs render correctly.

No schema changes, no reseeding — just a data update that flips RLS visibility on for the demo account.

## Verification

After the update, refresh `/dashboard`. You should immediately see:
- KPI tiles populated (today's scans, customers waiting, revenue recovered, etc.)
- Scan trends, customer growth, top products, notification performance charts
- Low-stock, promotions and recent activity cards filled in
- Products, Customers, Alerts, Watchlists, ROI and Analytics all populated