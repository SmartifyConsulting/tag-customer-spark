import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { TaxonomyEngineTab } from "@/components/settings/taxonomy-engine-tab";
import { AttributeAdminTab } from "@/components/settings/attribute-admin-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getActiveProfile } from "@/lib/taxonomy.functions";

const FIXED_KEYS = new Set(["brand", "category", "subcategory", "department", "product"]);
// Brand, Category, Model Number, and Preview aren't a useful standalone
// workflow yet (brand/category are managed from the Taxonomy Engine tree
// itself, and Model Number has no dedicated admin need right now) — hidden
// until there's a real reason to surface them separately.
const HIDDEN_DYNAMIC_KEYS = new Set(["custom:model_number"]);

export function TaxonomyAdminSection() {
  const activeFn = useServerFn(getActiveProfile);
  const activeQ = useQuery({ queryKey: ["taxonomy-active"], queryFn: () => activeFn() });

  const dynamicLevels = useMemo(() => {
    const levels = (activeQ.data?.levels ?? []) as { attribute_key: string; label: string }[];
    const seen = new Set<string>();
    return levels.filter((l) => {
      if (FIXED_KEYS.has(l.attribute_key) || HIDDEN_DYNAMIC_KEYS.has(l.attribute_key) || seen.has(l.attribute_key))
        return false;
      seen.add(l.attribute_key);
      return true;
    });
  }, [activeQ.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxonomy"
        description="Configure how products are grouped. The Taxonomy Engine defines the dynamic browser hierarchy."
      />
      <TaxonomyEngineTab />
      {dynamicLevels.length > 0 && (
        <Tabs defaultValue={dynamicLevels[0].attribute_key}>
          <TabsList className="flex-wrap">
            {dynamicLevels.map((l) => (
              <TabsTrigger key={l.attribute_key} value={l.attribute_key}>
                {l.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {dynamicLevels.map((l) => (
            <TabsContent key={l.attribute_key} value={l.attribute_key}>
              <AttributeAdminTab attributeKey={l.attribute_key} label={l.label} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
