import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaxonomyAdminSection } from "@/components/admin/taxonomy-admin-section";
import { StoresView } from "@/components/stores/stores-view";
import { UserAdminTab } from "@/components/settings/user-admin-tab";
import { useIsAdmin } from "@/hooks/use-auth";

// Consolidated admin surface — Taxonomy, Stores, and Users are now tabs
// on one screen instead of three separate pages, cutting nav clicks and
// making it obvious that all three are admin-only.
const searchSchema = z.object({
  tab: z.enum(["taxonomy", "stores", "users"]).optional(),
});

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Tag" }] }),
  validateSearch: searchSchema,
  component: AdminPage,
});

function AdminPage() {
  const isAdmin = useIsAdmin();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  if (!isAdmin) return <Navigate to="/dashboard" />;

  const active = tab ?? "taxonomy";
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Taxonomy, stores, and user access — the settings only admins should touch."
      />
      <Tabs
        value={active}
        onValueChange={(v) =>
          navigate({ to: "/admin", search: { tab: v as "taxonomy" | "stores" | "users" } })
        }
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
        <TabsContent value="users" className="pt-4">
          <UserAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
