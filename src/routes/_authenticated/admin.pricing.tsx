import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PlanAdminTab } from "@/components/settings/plan-admin-tab";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({ meta: [{ title: "Pricing — Tag" }] }),
  component: PricingAdminPage,
});

function PricingAdminPage() {
  const { hasRole } = useAuth();
  // Billing touches money, so this stays super_admin-only — tighter than
  // the retail_admin/store_manager access other Admin sub-pages allow.
  const canManage = hasRole("super_admin");
  if (!canManage) return <Navigate to="/dashboard" />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing"
        description="Every retailer's plan and subscription status. Change a tier directly, or see what they're paying via PayFast/PayPal."
      />
      <PlanAdminTab />
    </div>
  );
}
