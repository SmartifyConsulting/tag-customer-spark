import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { CategoryAdminTab } from "@/components/settings/category-admin-tab";
import { BrandAdminTab } from "@/components/settings/brand-admin-tab";
import { TaxonomyEngineTab } from "@/components/settings/taxonomy-engine-tab";
import { AttributeAdminTab } from "@/components/settings/attribute-admin-tab";
import { TaxonomyPreviewTab } from "@/components/settings/taxonomy-preview-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OnboardingTour } from "@/components/onboarding-tour";
import { useAuth } from "@/hooks/use-auth";
import { getActiveProfile } from "@/lib/taxonomy.functions";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Taxonomy — Tag" }] }),
  component: TaxonomyAdminPage,
});

// Brand and Category always get their dedicated, fully-featured tabs.
// Department/Sub-category are the same category tree at a different depth,
// so they don't get a separate tab. "Product" is the leaf of the hierarchy,
// not a manageable attribute. Every other visible level in the active
// profile gets a generic tab automatically.
const FIXED_KEYS = new Set(["brand", "category", "subcategory", "department", "product"]);

function TaxonomyAdminPage() {
  const { hasRole, loading: authLoading, user } = useAuth();
  const canManage =
    hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");

  const activeFn = useServerFn(getActiveProfile);
  const activeQ = useQuery({ queryKey: ["taxonomy-active"], queryFn: () => activeFn() });

  const dynamicLevels = useMemo(() => {
    const levels = (activeQ.data?.levels ?? []) as { attribute_key: string; label: string }[];
    const seen = new Set<string>();
    return levels.filter((l) => {
      if (FIXED_KEYS.has(l.attribute_key) || seen.has(l.attribute_key)) return false;
      seen.add(l.attribute_key);
      return true;
    });
  }, [activeQ.data]);

  if (authLoading) return null;
  if (!canManage) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxonomy"
        description="Configure how products are grouped. The Taxonomy Engine defines the dynamic browser hierarchy; Brands and Categories are the source attributes."
      />
      <TaxonomyEngineTab />
      <Tabs defaultValue="brand">
        <TabsList className="flex-wrap">
          <TabsTrigger value="brand">Brand</TabsTrigger>
          <TabsTrigger value="category">Category</TabsTrigger>
          {dynamicLevels.map((l) => (
            <TabsTrigger key={l.attribute_key} value={l.attribute_key}>
              {l.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="brand">
          <BrandAdminTab />
        </TabsContent>
        <TabsContent value="category">
          <CategoryAdminTab />
        </TabsContent>
        {dynamicLevels.map((l) => (
          <TabsContent key={l.attribute_key} value={l.attribute_key}>
            <AttributeAdminTab attributeKey={l.attribute_key} label={l.label} />
          </TabsContent>
        ))}
        <TabsContent value="preview">
          <TaxonomyPreviewTab />
        </TabsContent>
      </Tabs>

      <OnboardingTour
        userId={user?.id}
        tourKey="taxonomy"
        steps={[
          {
            title: "This is your Taxonomy",
            body: "The Taxonomy Engine defines the category hierarchy customers browse by — Brands and Categories are the source attributes that feed it.",
          },
          {
            title: "Brand and Category tabs",
            body: "Manage, merge, and reorganise your brand and category lists here — changes apply across your whole catalogue.",
          },
          {
            title: "Preview before you publish",
            body: "Use the Preview tab to see exactly how your taxonomy will look to shoppers before you commit to changes.",
          },
        ]}
      />
    </div>
  );
}
