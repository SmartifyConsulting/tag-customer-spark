import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ownership/purchases")({
  head: () => ({ meta: [{ title: "Purchases — Tag Ownership" }] }),
  component: () => <Outlet />,
});
