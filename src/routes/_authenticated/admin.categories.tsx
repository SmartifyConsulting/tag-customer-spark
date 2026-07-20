import { createFileRoute, Navigate } from "@tanstack/react-router";

// Legacy /admin/categories now lives as the Taxonomy tab of /admin.
export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: () => <Navigate to="/admin" search={{ tab: "taxonomy" }} />,
});
