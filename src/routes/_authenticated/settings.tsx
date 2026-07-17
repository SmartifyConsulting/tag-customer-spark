import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Settings as SettingsIcon, Building2, CreditCard, ShieldCheck, History, Mail, Send, CheckCircle2, Upload, Copy, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { getWorkspaceSettings, updateRetailerProfile, listAuditLog, uploadRetailerLogo } from "@/lib/settings.functions";
import { reseedAsCapeUnionMart } from "@/lib/reseed.functions";
import { sendTestEmail, sendDailyBriefingEmail, sendWeeklyRoiEmail } from "@/lib/email.functions";
import { BillingTab } from "@/components/settings/billing-tab";
import { PlanAdminTab } from "@/components/settings/plan-admin-tab";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Tag" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => getWorkspaceSettings() });
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => listAuditLog() });
  const { roles } = useAuth();
  const isSuperAdmin = (roles ?? []).includes("super_admin");
  const canReseed = isSuperAdmin || (roles ?? []).includes("retail_admin");
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
          {isSuperAdmin && <TabsTrigger value="plan-admin"><CreditCard className="mr-1 h-4 w-4" /> Subscription plan admin</TabsTrigger>}
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
                  <div><Label>Contact email</Label><Input value={current.contact_email ?? ""} onChange={(e) => setForm({ ...current, contact_email: e.target.value })} /></div>

                  <LogoUploader
                    logoUrl={current.logo_url ?? ""}
                    onUploaded={(url) => {
                      setForm({ ...current, logo_url: url });
                      qc.invalidateQueries({ queryKey: ["settings"] });
                    }}
                  />

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

          {canReseed && <DangerZoneCard />}
        </TabsContent>

        <TabsContent value="emails">
          <EmailsTab defaultTo={r?.contact_email ?? ""} />
        </TabsContent>

        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="plan-admin">
            <PlanAdminTab />
          </TabsContent>
        )}


        <TabsContent value="security">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Security</CardTitle><CardDescription>Row-level security is enforced across every table.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Stat label="RLS enforced" value={<Badge className="bg-success/15 text-success">On</Badge>} />
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

function DangerZoneCard() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const reseed = useMutation({
    mutationFn: () => reseedAsCapeUnionMart(),
    onSuccess: (r: any) => {
      toast.success(`Reseeded: ${r.stores} stores, ${r.brands} brands, ${r.categories} categories, ${r.products} products`);
      qc.invalidateQueries();
      setConfirmOpen(false);
      setConfirmText("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Reseed failed"),
  });

  return (
    <Card className="rounded-2xl border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>Retailer admins only. These actions cannot be undone.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-xl border border-destructive/30 p-4">
          <div>
            <p className="text-sm font-medium">Reseed as Cape Union Mart</p>
            <p className="text-xs text-muted-foreground">
              Deletes all products, categories, brands and stores for this workspace, renames it "Cape Union Mart",
              and loads a representative South African outdoor-retail catalogue and branch list.
            </p>
          </div>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Reseed data
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => { setConfirmOpen(v); if (!v) setConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete current catalogue?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every product, category, brand and store in this workspace and replaces them with the
              Cape Union Mart demo catalogue. This cannot be undone. Type <b>DELETE</b> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== "DELETE" || reseed.isPending}
              className={buttonVariants({ variant: "destructive" })}
              onClick={(e) => {
                e.preventDefault();
                reseed.mutate();
              }}
            >
              {reseed.isPending ? "Reseeding…" : "Delete and reseed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
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

// Sub-400px logos come out blurry once tinted/resized across QR cards,
// dashboard header, opt-in pages etc. — reject early with a clear reason
// instead of silently accepting something that'll look bad everywhere it's
// used. Vector SVGs are resolution-independent, so they skip this check.
const MIN_LOGO_PX = 400;

function checkImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read image"));
    };
    img.src = url;
  });
}

function LogoUploader({ logoUrl, onUploaded }: { logoUrl: string; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      return uploadRetailerLogo({
        data: { filename: file.name, contentType: file.type, base64 },
      });
    },
    onSuccess: (r) => {
      onUploaded(r.url);
      toast.success("Logo uploaded");
    },
    onError: (e: any) => toast.error(e?.message ?? "Upload failed"),
    onSettled: () => setUploading(false),
  });

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type !== "image/svg+xml") {
      try {
        const { width, height } = await checkImageDimensions(f);
        if (width < MIN_LOGO_PX || height < MIN_LOGO_PX) {
          toast.error(
            `Logo is ${width}×${height}px — needs to be at least ${MIN_LOGO_PX}×${MIN_LOGO_PX}px so it stays sharp across QR cards and the dashboard.`,
          );
          return;
        }
      } catch {
        toast.error("Couldn't read that image — try a different file.");
        return;
      }
    }
    setUploading(true);
    upload.mutate(f);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(logoUrl);
      toast.success("URL copied — paste into Twilio Content Template {{media_url}}");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">Company logo</p>
        <p className="text-xs text-muted-foreground">
          Used on QR cards, opt-in pages, WhatsApp messages, and Twilio content templates.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border bg-muted/40 overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={onPick}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
          <p className="mt-1 text-[11px] text-muted-foreground">
            PNG, WEBP or SVG with a transparent background · at least {MIN_LOGO_PX}×{MIN_LOGO_PX}px · max 2 MB
          </p>
        </div>
      </div>

      {logoUrl ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Twilio media URL</Label>
          <div className="flex gap-2">
            <Input readOnly value={logoUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" size="sm" onClick={copy}>
              <Copy className="mr-1 h-4 w-4" /> Copy URL
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={logoUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" /> Open
              </a>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Paste this URL into Twilio Content Template Builder as the media URL, or into the <code>MediaUrl</code> param when sending via the API.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Upload a logo to get a shareable URL for Twilio.</p>
      )}
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
          <CardTitle className="flex items-center gap-2">Resend <Badge className="bg-success/15 text-success"><CheckCircle2 className="mr-1 h-3 w-3" /> Connected</Badge></CardTitle>
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
            Auth emails <Badge className="bg-success/15 text-success"><CheckCircle2 className="mr-1 h-3 w-3" /> Active</Badge>
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
