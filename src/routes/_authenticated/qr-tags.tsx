import { createFileRoute } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/qr-tags")({
  head: () => ({ meta: [{ title: "QR Tags — Tag" }] }),
  component: () => (
    <PlaceholderPage
      title="QR Tags"
      description="Generate, print, and assign QR tags to products on the shop floor."
      icon={QrCode}
      body="Customers scan these tags to opt-in to WhatsApp updates about the product they were interested in."
    />
  ),
});
