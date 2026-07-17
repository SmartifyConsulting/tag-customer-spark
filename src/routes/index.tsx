import { createFileRoute, redirect } from "@tanstack/react-router";

// The root used to be a marketing/hero landing page, which meant every
// visitor (including a freshly-authenticated one, mid-redirect to Setup)
// could briefly see it flash by. The marketing content now lives at
// /about; "/" just sends everyone straight to sign in/up, which itself
// redirects an already-authenticated visitor on to /dashboard.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
