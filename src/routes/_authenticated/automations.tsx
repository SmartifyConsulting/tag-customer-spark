import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { AutomationSettings } from "@/components/settings/automation-settings";
import { useIsAdmin } from "@/hooks/use-auth";

// Automations is its own admin screen (it used to be a tab on /admin).
export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Automations — Tag" },
      {
        name: "description",
        content:
          "Configure automated WhatsApp notifications, delivery templates and live send tests for your retailer.",
      },
      { property: "og:title", content: "Automations — Tag" },
      {
        property: "og:description",
        content:
          "Configure automated WhatsApp notifications, delivery templates and live send tests for your retailer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return <Navigate to="/briefing" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        description="Automated WhatsApp notifications, approved templates and live delivery tests."
      />
      <AutomationSettings />
    </div>
  );
}
