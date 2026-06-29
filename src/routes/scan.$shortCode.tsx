import { createFileRoute, useParams } from "@tanstack/react-router";
import { QrCode } from "lucide-react";

export const Route = createFileRoute("/scan/$shortCode")({
  head: () => ({ meta: [{ title: "Stay in the loop — Tag" }] }),
  component: ScanLanding,
});

function ScanLanding() {
  const { shortCode } = useParams({ from: "/scan/$shortCode" });
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 inline-grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
          <QrCode className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold">Thanks for scanning!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scan <span className="font-mono">{shortCode}</span> recorded. WhatsApp opt-in coming soon — this is a placeholder.
        </p>
      </div>
    </div>
  );
}
