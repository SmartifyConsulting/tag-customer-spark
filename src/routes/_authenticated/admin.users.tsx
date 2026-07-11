import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { UserAdminTab } from "@/components/settings/user-admin-tab";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users — Tag" }] }),
  component: UsersAdminPage,
});

function UsersAdminPage() {
  const { hasRole } = useAuth();
  if (!hasRole("super_admin")) return <Navigate to="/dashboard" />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Invite staff, assign roles, and manage access to your workspace."
      />
      <UserAdminTab />
    </div>
  );
}
