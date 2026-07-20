import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { CategoryAdminTab } from "@/components/settings/category-admin-tab";
import { BrandAdminTab } from "@/components/settings/brand-admin-tab";
import { TaxonomyEngineTab } from "@/components/settings/taxonomy-engine-tab";
import { AttributeAdminTab } from "@/components/settings/attribute-admin-tab";
import { TaxonomyPreviewTab } from "@/components/settings/taxonomy-preview-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getActiveProfile } from "@/lib/taxonomy.functions";

const FIXED_KEYS = new Set(["brand", "category", "subcategory", "department", "product"]);

export function TaxonomyAdminSection() {
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
    </div>
  );
}
