import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { BrandAdminTab } from "@/components/settings/brand-admin-tab";
import { AdminTabs } from "./admin.categories";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/brands")({
  head: () => ({ meta: [{ title: "Brands — Tag" }] }),
  component: BrandsAdminPage,
});

function BrandsAdminPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");
  if (!canManage) return <Navigate to="/dashboard" />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Manage brands and their logos. AI can fetch logos automatically from your brand's website."
      />
      <AdminTabs />
      <BrandAdminTab />
    </div>
  );
}
