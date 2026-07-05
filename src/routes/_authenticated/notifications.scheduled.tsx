import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/notifications/scheduled")({
  head: () => ({
    meta: [
      { title: "Scheduled Campaigns — Tag" },
      { name: "description", content: "View and manage your scheduled WhatsApp alerts" },
    ],
  }),
  component: ScheduledCampaignsPage,
});

function ScheduledCampaignsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Scheduled Campaigns"
        description="View upcoming alerts and manage send times"
      />

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Campaigns</CardTitle>
          <CardDescription>Alerts scheduled to send to customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto opacity-20 mb-2" />
            <p>No scheduled campaigns yet</p>
            <p className="text-sm mt-2">Schedule alerts from the Send Alert page</p>
            <Button className="mt-4">Create Campaign</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
