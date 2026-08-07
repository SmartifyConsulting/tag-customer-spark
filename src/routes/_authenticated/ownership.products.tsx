import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ownership/products")({
  head: () => ({ meta: [{ title: "My Products — Tag Ownership" }] }),
  component: () => <Outlet />,
});
