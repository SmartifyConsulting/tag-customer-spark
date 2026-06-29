import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff — Tag" }] }),
  component: () => (
    <PlaceholderPage
      title="Staff"
      description="Invite team members and assign roles."
      icon={UserCog}
      body="Super Administrator, Retail Administrator, Store Manager, and Sales Assistant roles control access throughout Tag."
    />
  ),
});
