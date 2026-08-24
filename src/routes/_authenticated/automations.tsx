import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationSettings } from "@/components/settings/automation-settings";
import { AutomationLogsTab } from "@/components/settings/automation-logs-tab";
import { useIsAdmin } from "@/hooks/use-auth";

const searchSchema = z.object({
  tab: z.enum(["templates", "logs"]).optional(),
});

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
  validateSearch: (s) => searchSchema.parse(s),
  component: AutomationsPage,
});

function AutomationsPage() {
  const isAdmin = useIsAdmin();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  if (!isAdmin) return <Navigate to="/briefing" />;

  const active = tab === "logs" ? "logs" : "templates";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        description="Automated WhatsApp notifications, approved templates and live delivery tests."
      />
      <Tabs
        value={active}
        onValueChange={(v) => navigate({ search: { tab: v as "templates" | "logs" } })}
      >
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="pt-4">
          <AutomationSettings />
        </TabsContent>
        <TabsContent value="logs" className="pt-4">
          <AutomationLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
