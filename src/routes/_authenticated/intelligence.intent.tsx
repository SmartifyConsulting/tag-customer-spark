import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/intelligence/intent")({
  beforeLoad: () => {
    throw redirect({ to: "/intent" });
  },
});
