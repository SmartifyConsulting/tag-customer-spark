import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/purchase/")({
  beforeLoad: () => {
    throw redirect({ to: "/purchase/receipts" });
  },
});
