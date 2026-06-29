import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ROLES = [
  {
    role: "super_admin",
    label: "Super Administrator",
    desc: "Full platform access across all retailers — internal Tag operators only.",
    badge: "Internal",
    tone: "bg-primary/10 text-primary",
  },
  {
    role: "retail_admin",
    label: "Retail Administrator",
    desc: "Owns the workspace. Manages stores, staff, billing and integrations.",
    badge: "Org owner",
    tone: "bg-[color:var(--mint)]/15 text-[color:var(--mint)]",
  },
  {
    role: "store_manager",
    label: "Store Manager",
    desc: "Runs day-to-day for one or more stores. Can send campaigns and manage products.",
    badge: "Operator",
    tone: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  },
  {
    role: "sales_assistant",
    label: "Sales Assistant",
    desc: "Read access plus inbox replies. Can scan and tag products in-store.",
    badge: "Floor",
    tone: "bg-muted text-muted-foreground",
  },
];

export const Route = createFileRoute("/_authenticated/organisation/roles")({
  head: () => ({ meta: [{ title: "Permissions & Roles — Tag" }] }),
  component: RolesPage,
});

function RolesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Permissions & Roles"
        description="Four built-in roles map to a strict least-privilege RLS model."
        actions={
          <Button asChild variant="outline">
            <Link to="/staff">
              Manage staff <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {ROLES.map((r) => (
          <Card key={r.role} className="rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-[color:var(--mint)]" />
                  {r.label}
                </CardTitle>
                <Badge className={r.tone}>{r.badge}</Badge>
              </div>
              <CardDescription className="font-mono text-[11px]">{r.role}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
