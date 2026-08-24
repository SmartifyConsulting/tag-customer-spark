import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TaxonomyEngineTab } from "@/components/settings/taxonomy-engine-tab";
import { AttributeAdminTab } from "@/components/settings/attribute-admin-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getActiveProfile } from "@/lib/taxonomy.functions";
import { useTier } from "@/hooks/use-tier";

const FIXED_KEYS = new Set(["brand", "category", "subcategory", "department", "product"]);
// Brand, Category, Model Number, and Preview aren't a useful standalone
// workflow yet (brand/category are managed from the Taxonomy Engine tree
// itself, and Model Number has no dedicated admin need right now) — hidden
// until there's a real reason to surface them separately.
const HIDDEN_DYNAMIC_KEYS = new Set(["custom:model_number"]);

export function TaxonomyAdminSection() {
  const { hasFeature, isLoading: tierLoading } = useTier();
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

  // Every retailer already browses Inventory using whatever taxonomy
  // profile is active (a sensible built-in default if they've never
  // configured one) — that read path stays open on every tier. What's
  // gated here is only the ability to CREATE custom multi-team hierarchies
  // ("Retail, Buying, Warehouse, Marketing each browse their own way" —
  // this screen's own pitch describes a bigger operation than a Starter
  // boutique). The server functions enforce this independently; this is
  // just the locked-state UX so a Starter/Growth admin sees why, instead
  // of a raw error the first time they try to save.
  if (!tierLoading && !hasFeature("taxonomy")) {
    return (
      <div className="space-y-6">
        <PageHeader title="Taxonomy" description="Configure how products are grouped." />
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Custom taxonomy profiles are a Pro-plan feature</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Build multi-team catalogue hierarchies so Retail, Buying, Warehouse and Marketing can
            each browse the same catalogue their own way. Your Inventory page already uses a
            sensible default grouping — this unlocks customising it.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/plan" search={{ feature: "taxonomy" }}>Upgrade to Pro</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxonomy"
        description="Configure how products are grouped — defines the dynamic browser hierarchy."
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
