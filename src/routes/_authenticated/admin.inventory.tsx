import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pathless layout for /admin/inventory and /admin/inventory/$productId —
// the list view lives in admin.inventory.index.tsx. Without this Outlet,
// TanStack Router nests $productId under this route but has nowhere to
// render it, so drilling into a product silently re-rendered the list.
export const Route = createFileRoute("/_authenticated/admin/inventory")({
  component: () => <Outlet />,
});
