import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ownership/")({
  beforeLoad: () => {
    throw redirect({ to: "/ownership/purchases" });
  },
});
