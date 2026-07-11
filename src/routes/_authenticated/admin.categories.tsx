import { createFileRoute, Link, Navigate, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { CategoryAdminTab } from "@/components/settings/category-admin-tab";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Categories — Tag" }] }),
  component: CategoriesAdminPage,
});

export function AdminTabs() {
  const location = useLocation();
  const { hasRole } = useAuth();
  const tabs = [
    { to: "/admin/categories", label: "Categories", show: true },
    { to: "/admin/users", label: "Users", show: hasRole("super_admin") },
  ].filter((t) => t.show);
  return (
    <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
      {tabs.map((t) => {
        const active = location.pathname === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md font-medium transition-colors",
              active
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

function CategoriesAdminPage() {
  const { hasRole } = useAuth();
  const canManage =
    hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");
  if (!canManage) return <Navigate to="/dashboard" />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Organise your products and manage users. AI auto-categorises new items; you always have the final say."
      />
      <AdminTabs />
      <CategoryAdminTab />
    </div>
  );
}
