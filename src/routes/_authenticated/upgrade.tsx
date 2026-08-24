import { createFileRoute, redirect } from "@tanstack/react-router";

// /upgrade was this page's URL before the A5 naming pass (renamed to
// /plan to stop colliding with the public marketing /pricing page) —
// kept as a redirect so existing bookmarks/links don't 404. Preserves
// the "feature" search param so a deep link into a specific locked
// feature (e.g. from a tier-gate redirect) still lands correctly.
export const Route = createFileRoute("/_authenticated/upgrade")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/plan", search: search as any });
  },
});
