## Restore Stock functionality on the Dashboard

The Products module still has all stock fields (stock_qty, low_stock_threshold, low-stock toolbar filter) and the dashboard KPI `lowStockCount` is still computed. The only piece removed was the Low Stock card on the Dashboard page.

### Changes

1. **Recreate `src/components/dashboard/low-stock-card.tsx`** — restore the previous component: rounded card, warning-tinted header, list of low-stock products with "Out of stock" / "N left" badges, and an `EmptyState` fallback.

2. **`src/routes/_authenticated/dashboard.tsx`** — import `LowStockCard` and render it alongside `PromotionsCard` in the final two-column grid (Promotions | Low stock | Recent activity), matching the original layout.

No backend, schema, or business-logic changes — everything needed already exists in `dashboardOverviewQueryOptions` (`data.lowStockProducts`).
