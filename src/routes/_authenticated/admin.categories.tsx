import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { CategoryAdminTab } from "@/components/settings/category-admin-tab";
import { BrandAdminTab } from "@/components/settings/brand-admin-tab";
import { TaxonomyEngineTab } from "@/components/settings/taxonomy-engine-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Taxonomy — Tag" }] }),
  component: TaxonomyAdminPage,
});

function TaxonomyAdminPage() {
  const { hasRole } = useAuth();
  const canManage =
    hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");
  if (!canManage) return <Navigate to="/dashboard" />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxonomy"
        description="Configure how products are grouped. The Taxonomy Engine defines the dynamic browser hierarchy; Brands and Categories are the source attributes."
      />
      <TaxonomyEngineTab />
      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand">Brand</TabsTrigger>
          <TabsTrigger value="category">Category</TabsTrigger>
        </TabsList>
        <TabsContent value="brand">
          <BrandAdminTab />
        </TabsContent>
        <TabsContent value="category">
          <CategoryAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
