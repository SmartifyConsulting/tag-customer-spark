import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users2, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { listSignups, type SignupRow } from "@/lib/signups.functions";

type Filter = "all" | "retailer" | "shopper";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SignupsTab() {
  const q = useQuery({ queryKey: ["user-admin", "signups"], queryFn: () => listSignups() });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = (q.data?.rows ?? []) as SignupRow[];
  const retailers = rows.filter((r) => r.type === "retailer").length;
  const shoppers = rows.length - retailers;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.type !== filter) return false;
      if (!term) return true;
      return [r.name, r.email, r.retailerName, r.tagId]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, search, filter]);

  return (
    <Card className="rounded-2xl border-primary/20">
      <CardHeader className="rounded-t-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <Users2 className="h-5 w-5 text-primary" /> All signups
        </CardTitle>
        <CardDescription>
          {q.isLoading
            ? "Loading accounts…"
            : `${rows.length} signups · ${retailers} retailers · ${shoppers} shoppers`}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, store…"
              className="pl-9"
            />
          </div>
          {(["all", "retailer", "shopper"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f === "all" ? "All" : f === "retailer" ? "Retailers" : "Shoppers"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : q.error ? (
          <div className="p-6 text-sm text-destructive">
            {(q.error as any)?.message ?? "Could not load signups"}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title="No signups" description="Nobody matches this filter yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Email</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Store / Tag ID</th>
                  <th className="px-4 py-2.5 font-semibold">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.email ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {r.type === "retailer" ? (
                        <Badge className="bg-primary text-primary-foreground">Retailer</Badge>
                      ) : (
                        <Badge className="bg-secondary text-secondary-foreground">Shopper</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {r.retailerName ?? r.tagId ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{fmt(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
