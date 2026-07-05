import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListSubscriptions, adminSetTier } from "@/lib/billing.functions";
import { useState } from "react";

type Row = {
  id: string;
  name: string;
  tier: "starter" | "pro" | "enterprise";
  contact_email: string | null;
  billing_email: string | null;
  subscriptions: Array<{
    plan: string;
    status: string;
    provider: string | null;
    billing_cycle: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  }> | null;
};

export function PlanAdminTab() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin-subs"], queryFn: () => adminListSubscriptions() });
  const setTier = useMutation({
    mutationFn: (v: { retailer_id: string; tier: "starter" | "pro" | "enterprise" }) =>
      adminSetTier({ data: { ...v, cycle: "monthly" } }),
    onSuccess: () => { toast.success("Tier updated"); qc.invalidateQueries({ queryKey: ["admin-subs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Billing administration</CardTitle>
        <CardDescription>Super-admin only. Force-set tier, downgrade or upgrade any workspace.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {list.isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : list.isError ? (
          <div className="p-6 text-sm text-destructive">{(list.error as Error).message}</div>
        ) : (
          <div className="divide-y">
            {(list.data as Row[] | undefined ?? []).map((r) => {
              const s = r.subscriptions?.[0];
              return (
                <PlanAdminRow key={r.id} row={r} sub={s ?? null} onSet={(tier) => setTier.mutate({ retailer_id: r.id, tier })} />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlanAdminRow({
  row, sub, onSet,
}: {
  row: Row;
  sub: NonNullable<Row["subscriptions"]>[number] | null;
  onSet: (tier: "starter" | "pro" | "enterprise") => void;
}) {
  const [tier, setTier] = useState<"starter" | "pro" | "enterprise">(row.tier);
  return (
    <div className="grid grid-cols-[1.6fr_1fr_1fr_auto] items-center gap-4 px-6 py-4 text-sm">
      <div>
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">{row.billing_email ?? row.contact_email ?? "—"}</p>
      </div>
      <div className="flex flex-col gap-1">
        <Badge className="w-fit uppercase" variant={row.tier === "starter" ? "outline" : "default"}>{row.tier}</Badge>
        <span className="text-xs text-muted-foreground">{sub?.provider ?? "no provider"} · {sub?.billing_cycle ?? "—"}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {sub?.current_period_end ? `Renews ${new Date(sub.current_period_end).toLocaleDateString()}` : "—"}
        {sub?.cancel_at_period_end && <span className="ml-2 text-warning">· cancelling</span>}
      </div>
      <div className="flex items-center gap-2">
        <Select value={tier} onValueChange={(v) => setTier(v as "starter" | "pro" | "enterprise")}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => onSet(tier)}>Set</Button>
      </div>
    </div>
  );
}
