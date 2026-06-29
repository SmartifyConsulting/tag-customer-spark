import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Settings as SettingsIcon, Building2, CreditCard, ShieldCheck, History } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { getWorkspaceSettings, updateRetailerProfile, listAuditLog } from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Tag" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => getWorkspaceSettings() });
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => listAuditLog() });
  const r = settings.data?.retailer;
  const [form, setForm] = useState<any>(null);
  const current = form ?? r ?? { name: "", contact_email: "", logo_url: "" };

  const save = useMutation({
    mutationFn: () => updateRetailerProfile({ data: { name: current.name, contact_email: current.contact_email || null, logo_url: current.logo_url || null } }),
    onSuccess: () => { toast.success("Workspace updated"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Workspace, billing, security and integrations." />

      <Tabs defaultValue="workspace" className="space-y-6">
        <TabsList>
          <TabsTrigger value="workspace"><Building2 className="mr-1 h-4 w-4" /> Workspace</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="mr-1 h-4 w-4" /> Billing</TabsTrigger>
          <TabsTrigger value="security"><ShieldCheck className="mr-1 h-4 w-4" /> Security</TabsTrigger>
          <TabsTrigger value="audit"><History className="mr-1 h-4 w-4" /> Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Brand</CardTitle><CardDescription>Shown on QR cards, opt-in pages and WhatsApp messages.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {settings.isLoading ? <Skeleton className="h-32 w-full" /> : (
                <>
                  <div><Label>Workspace name</Label><Input value={current.name ?? ""} onChange={(e) => setForm({ ...current, name: e.target.value })} /></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><Label>Contact email</Label><Input value={current.contact_email ?? ""} onChange={(e) => setForm({ ...current, contact_email: e.target.value })} /></div>
                    <div><Label>Logo URL</Label><Input value={current.logo_url ?? ""} onChange={(e) => setForm({ ...current, logo_url: e.target.value })} /></div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <p className="text-sm font-medium">Appearance</p>
                      <p className="text-xs text-muted-foreground">Switch between light, dark, or system themes.</p>
                    </div>
                    <ThemeToggle />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Plan & subscription</CardTitle></CardHeader>
            <CardContent>
              {settings.data?.subscription ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat label="Plan" value={String(settings.data.subscription.plan).toUpperCase()} />
                  <Stat label="Status" value={<Badge>{(settings.data.subscription as any).status}</Badge>} />
                  <Stat label="Seats" value={(settings.data.subscription as any).seats} />
                  <Stat label="Renews" value={new Date((settings.data.subscription as any).current_period_end).toLocaleDateString()} />
                </div>
              ) : <EmptyState icon={CreditCard} title="No subscription yet" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Security</CardTitle><CardDescription>Row-level security is enforced across every table.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Stat label="RLS enforced" value={<Badge className="bg-emerald-500/15 text-emerald-700">On</Badge>} />
              <Stat label="Roles" value="4 levels" />
              <Stat label="Auth" value="Supabase" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Audit log</CardTitle><CardDescription>Last 200 sensitive actions in your workspace.</CardDescription></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {audit.isLoading ? (
                  <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (audit.data ?? []).length === 0 ? (
                  <div className="p-6"><EmptyState icon={History} title="No audit entries yet" /></div>
                ) : (audit.data as any[]).map((a) => (
                  <div key={a.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-6 py-3 text-sm">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{a.action}</p>
                      <p className="text-xs text-muted-foreground">{a.entity_type}</p>
                    </div>
                    <Badge variant={a.status === "success" ? "default" : "outline"} className="capitalize">{a.status}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
