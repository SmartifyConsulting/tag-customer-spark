import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Tag" }] }),
  component: () => (
    <PlaceholderPage
      title="Settings"
      description="Workspace, branding, integrations, and account preferences."
      icon={SettingsIcon}
      body="Configure WhatsApp Business connection, branding for QR tags, billing, and security."
    />
  ),
});
