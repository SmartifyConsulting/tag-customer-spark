import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Layers } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { browseTaxonomy, getActiveProfile } from "@/lib/taxonomy.functions";

export function DynamicTaxonomyBrowser() {
  const activeFn = useServerFn(getActiveProfile);
  const browseFn = useServerFn(browseTaxonomy);
  const [path, setPath] = useState<{ attribute_key: string; value: string; label: string }[]>([]);

  const activeQ = useQuery({ queryKey: ["taxonomy-active"], queryFn: () => activeFn() });

  const profileId = activeQ.data?.profile?.id;
  const levels = activeQ.data?.levels ?? [];

  const key = useMemo(
    () => JSON.stringify({ profileId, path: path.map((p) => ({ a: p.attribute_key, v: p.value })) }),
    [profileId, path],
  );

  const q = useQuery({
    queryKey: ["taxonomy-browse", key],
    queryFn: () =>
      browseFn({
        data: {
          profileId: profileId!,
          path: path.map((p) => ({ attribute_key: p.attribute_key, value: p.value })),
        },
      }),
    enabled: !!profileId && levels.length > 0,
  });

  if (activeQ.isLoading) return <Skeleton className="h-40 w-full" />;

  if (!profileId || levels.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No taxonomy profile configured"
        description="An administrator can build one under Admin → Taxonomy Engine."
      />
    );
  }

  const currentLevel = levels[path.length];

  return (
    <Card className="rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1 text-sm">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {activeQ.data?.profile?.name}
        </span>
        <span className="mx-2 text-muted-foreground">·</span>
        <button
          onClick={() => setPath([])}
          className="rounded px-2 py-1 font-medium hover:bg-accent"
        >
          All
        </button>
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              onClick={() => setPath((cur) => cur.slice(0, i + 1))}
              className="rounded px-2 py-1 hover:bg-accent"
            >
              {p.label}
            </button>
          </span>
        ))}
        {currentLevel && (
          <>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              Grouped by <span className="font-medium">{currentLevel.label}</span>
            </span>
          </>
        )}
      </div>

      {q.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : q.data?.products && q.data.products.length > 0 ? (
        <ul className="divide-y rounded-xl border">
          {q.data.products.map((p: any) => (
            <li key={p.id}>
              <Link
                to="/products/$productId"
                params={{ productId: p.id }}
                className="flex items-center gap-3 px-3 py-2 hover:bg-accent"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[p.brand, p.category, p.sku].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {p.stock_qty != null && (
                  <Badge variant="outline">{p.stock_qty} qty</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : q.data?.groups && q.data.groups.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.groups.map((g: any) => (
            <li key={g.value}>
              <button
                onClick={() =>
                  setPath((cur) => [
                    ...cur,
                    { attribute_key: currentLevel!.attribute_key, value: g.value, label: g.label },
                  ])
                }
                className="flex w-full items-center justify-between rounded-xl border bg-card px-3 py-3 text-left transition hover:bg-accent"
              >
                <span className="truncate font-medium">{g.label}</span>
                <Badge variant="secondary">{g.count}</Badge>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Layers}
          title="No products at this level"
          description="Try a different branch of the hierarchy."
        />
      )}
    </Card>
  );
}
