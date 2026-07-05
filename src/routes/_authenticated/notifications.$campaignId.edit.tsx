import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCampaign } from "@/lib/notifications.functions";
import { CampaignComposer } from "@/components/notifications/campaign-composer";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/notifications/$campaignId/edit")({
  head: () => ({ meta: [{ title: "Edit campaign — Tag" }] }),
  component: EditCampaign,
});

function EditCampaign() {
  const { campaignId } = useParams({ from: "/_authenticated/notifications/$campaignId/edit" });
  const getFn = useServerFn(getCampaign);
  const { data, isLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => getFn({ data: { id: campaignId } }),
  });

  if (isLoading || !data) return <Skeleton className="h-96 rounded-2xl" />;
  const c = data.campaign;
  return (
    <CampaignComposer
      mode="edit"
      initial={{
        id: c.id,
        title: c.title,
        type: c.type,
        product_id: c.product_id,
        headline: c.headline,
        body: c.body,
        cta_label: c.cta_label,
        cta_url: c.cta_url,
        image_url: c.image_url,
        expires_at: c.expires_at,
        redemption_code: c.redemption_code,
        scheduled_at: c.scheduled_at,
      }}
    />
  );
}
