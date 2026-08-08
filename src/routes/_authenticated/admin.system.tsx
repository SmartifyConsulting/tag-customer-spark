import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { isSystemAdmin, getReceiptsEnabled, setReceiptsEnabled } from "@/lib/system-settings.functions";

export const Route = createFileRoute("/_authenticated/admin/system")({
  head: () => ({ meta: [{ title: "System Administration — Tag" }] }),
  component: SystemAdminPage,
});

function SystemAdminPage() {
  const isAdminFn = useServerFn(isSystemAdmin);
  const admin = useQuery({ queryKey: ["system-admin"], queryFn: () => isAdminFn() });

  if (admin.isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!admin.data) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Administration"
        description="Global feature switches for the whole platform. Only you can see or change these."
      />
      <ReceiptsToggleCard />
    </div>
  );
}

function ReceiptsToggleCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getReceiptsEnabled);
  const setFn = useServerFn(setReceiptsEnabled);
  const { data: enabled, isLoading } = useQuery({
    queryKey: ["system-settings", "receipts_enabled"],
    queryFn: () => getFn(),
  });

  const toggle = useMutation({
    mutationFn: (next: boolean) => setFn({ data: { enabled: next } }),
    onSuccess: (_res, next) => {
      toast.success(`Receipts ${next ? "enabled" : "disabled"} platform-wide`);
      qc.invalidateQueries({ queryKey: ["system-settings", "receipts_enabled"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update this setting"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipts</CardTitle>
        <CardDescription>
          Turns the entire Receipts feature on or off for every retailer and shopper, everywhere.
          When off, the Receipts page and nav links are hidden and the page shows as unavailable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex items-center gap-3">
            <Switch
              checked={!!enabled}
              disabled={toggle.isPending}
              onCheckedChange={(v) => toggle.mutate(v)}
            />
            <span className="text-sm font-medium">{enabled ? "Enabled" : "Disabled"}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
