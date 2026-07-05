import { createFileRoute } from "@tanstack/react-router";
import { CampaignComposer } from "@/components/notifications/campaign-composer";

export const Route = createFileRoute("/_authenticated/notifications/new")({
  head: () => ({ meta: [{ title: "New campaign — Tag" }] }),
  component: NewCampaign,
});

function NewCampaign() {
  return <CampaignComposer mode="new" />;
}
