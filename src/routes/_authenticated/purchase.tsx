import { createFileRoute, Outlet } from "@tanstack/react-router";

// PURCHASE section — the transaction record that sits between PRODUCT
// (catalogue intelligence) and OWNERSHIP (life after the sale).
export const Route = createFileRoute("/_authenticated/purchase")({
  head: () => ({
    meta: [
      { title: "Purchase — Tag" },
      { name: "description", content: "Digital receipts, purchases and returns in one record." },
    ],
  }),
  component: () => <Outlet />,
});
