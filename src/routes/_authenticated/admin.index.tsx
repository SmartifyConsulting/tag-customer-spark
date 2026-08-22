import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaxonomyAdminSection } from "@/components/admin/taxonomy-admin-section";
import { StoresView } from "@/components/stores/stores-view";
import { UserAdminTab } from "@/components/settings/user-admin-tab";
import { SignupsTab } from "@/components/settings/signups-tab";
import { useIsAdmin } from "@/hooks/use-auth";

// Consolidated admin surface — Taxonomy, Stores and Users are tabs on one
// screen. Customers (/customers) and Automations (/automations) are their
// own screens now; the old ?tab= values below redirect there so existing
// links keep working.
const searchSchema = z.object({
  tab: z.enum(["taxonomy", "stores", "customers", "users", "automations"]).optional(),
});

type AdminTab = "taxonomy" | "stores" | "users";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Tag" }] }),
  validateSearch: searchSchema,
  component: AdminPage,
});

function AdminPage() {
  const isAdmin = useIsAdmin();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  if (!isAdmin) return <Navigate to="/briefing" />;
  if (tab === "customers") return <Navigate to="/customers" replace />;
  if (tab === "automations") return <Navigate to="/automations" replace />;

  const active: AdminTab = tab === "stores" || tab === "users" ? tab : "taxonomy";
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Taxonomy, stores and user access — the settings only admins should touch."
      />
      <Tabs
        value={active}
        onValueChange={(v) => navigate({ to: "/admin", search: { tab: v as AdminTab } })}
      >
        <TabsList>
          <TabsTrigger value="taxonomy">Taxonomy</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="taxonomy" className="pt-4">
          <TaxonomyAdminSection />
        </TabsContent>
        <TabsContent value="stores" className="pt-4">
          <StoresView />
        </TabsContent>
        <TabsContent value="users" className="space-y-6 pt-4">
          <SignupsTab />
          <UserAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
