import { createFileRoute, Navigate } from "@tanstack/react-router";

// Legacy /admin/users now lives as the Users tab of /admin.
export const Route = createFileRoute("/_authenticated/admin/users")({
  component: () => <Navigate to="/admin" search={{ tab: "users" }} />,
});
