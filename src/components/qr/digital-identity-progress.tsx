import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { key: string; label: string; done: boolean; pending?: boolean };

type Props = {
  product: {
    gtin?: string | null;
    image_status?: string | null;
    image_source?: string | null;
    digital_product_passport_id?: string | null;
  };
  qr?: { active: boolean } | null;
  passport?: { status?: string | null; enrichment_status?: string | null } | null;
};

export function DigitalIdentityProgress({ product, qr, passport }: Props) {
  const enrichment = passport?.enrichment_status ?? "pending";
  const steps: Step[] = [
    { key: "barcode", label: "Valid GS1 barcode", done: !!product.gtin },
    {
      key: "image",
      label: "Product image resolved",
      done:
        !!product.image_status &&
        ["ready", "ai_suggested", "placeholder", "retailer", "official"].includes(
          product.image_status,
        ),
      pending: !product.image_status || product.image_status === "pending",
    },

    { key: "qr", label: "GS1 QR code generated", done: !!qr?.active },
    {
      key: "passport",
      label: "Digital passport published",
      done: passport?.status === "published",
    },
    {
      key: "enrichment",
      label: "AI enrichment complete",
      done: ["enriched", "complete", "manual"].includes(enrichment),
      pending: ["pending", "queued", "running", "enriching"].includes(enrichment),
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Digital identity</h3>
        <span className="text-xs text-muted-foreground">{completed} / {steps.length} complete</span>
      </div>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            {s.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : s.pending ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/60" />
            )}
            <span className={cn(s.done ? "" : "text-muted-foreground")}>{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
