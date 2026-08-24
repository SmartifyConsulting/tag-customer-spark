import { createFileRoute, redirect } from "@tanstack/react-router";

// /intent was the Interest Score page's URL before the A5 naming pass —
// kept as a redirect so existing bookmarks/links (and the older
// /intelligence/intent redirect chain) don't 404.
export const Route = createFileRoute("/_authenticated/intent")({
  beforeLoad: () => {
    throw redirect({ to: "/interest-score" });
  },
});
