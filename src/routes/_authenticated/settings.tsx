import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Settings as SettingsIcon, Building2, CreditCard, ShieldCheck, History, Mail, Send, CheckCircle2 } from "lucide-react";
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
import { sendTestEmail, sendDailyBriefingEmail, sendWeeklyRoiEmail } from "@/lib/email.functions";

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
          <TabsTrigger value="emails"><Mail className="mr-1 h-4 w-4" /> Emails</TabsTrigger>
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

        <TabsContent value="emails">
          <EmailsTab defaultTo={r?.contact_email ?? ""} />
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

function EmailsTab({ defaultTo }: { defaultTo: string }) {
  const [to, setTo] = useState(defaultTo);
  const test = useMutation({
    mutationFn: () => sendTestEmail({ data: { to } }),
    onSuccess: () => toast.success(`Test email sent to ${to}`),
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });
  const briefing = useMutation({
    mutationFn: () => sendDailyBriefingEmail({ data: { to } }),
    onSuccess: () => toast.success("Daily briefing sent"),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const weekly = useMutation({
    mutationFn: () => sendWeeklyRoiEmail({ data: { to } }),
    onSuccess: () => toast.success("Weekly ROI report sent"),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Resend <Badge className="bg-emerald-500/15 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" /> Connected</Badge></CardTitle>
          <CardDescription>Sending from <span className="font-mono">noreply@mypenguin.co.za</span>. Verify <span className="font-mono">mypenguin.co.za</span> in your Resend dashboard for deliverability.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:max-w-sm">
            <Label>Send a test email to</Label>
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => test.mutate()} disabled={!to || test.isPending} className="gap-2"><Send className="h-4 w-4" /> Send test</Button>
            <Button variant="outline" onClick={() => briefing.mutate()} disabled={!to || briefing.isPending}>Send daily briefing</Button>
            <Button variant="outline" onClick={() => weekly.mutate()} disabled={!to || weekly.isPending}>Send weekly ROI report</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>What sends via Resend</CardTitle>
          <CardDescription>Triggers wired to your Resend account.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            ["Customer campaign emails", "Sent alongside WhatsApp when a campaign goes out and the customer has an email on file."],
            ["Staff invitations", "Sent when you invite a Store Manager or Sales Assistant from the Staff page."],
            ["Daily AI briefing", "Morning executive summary with scans, recovered revenue and waiting customers."],
            ["Weekly ROI report", "Sunday digest with revenue recovered, campaigns sent and conversion."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border p-4">
              <p className="text-sm font-medium">{t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Auth emails <Badge className="bg-emerald-500/15 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" /> Active</Badge>
          </CardTitle>
          <CardDescription>
            Password reset, email verification and magic links are delivered automatically by the platform's built-in email service. No configuration required.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          To verify, open the sign-in page, click <b>Forgot password?</b>, and confirm the reset email arrives (check spam on the first send).
        </CardContent>
      </Card>
    </div>
  );
}
