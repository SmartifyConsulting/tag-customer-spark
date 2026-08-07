import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ownership")({
  head: () => ({ meta: [{ title: "Ownership — Tag" }] }),
  component: () => <Outlet />,
});
