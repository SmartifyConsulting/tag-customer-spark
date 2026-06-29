import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/commerce/roi")({
  beforeLoad: () => {
    throw redirect({ to: "/roi" });
  },
});
