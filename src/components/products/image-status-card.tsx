import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles, ImageIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { resetProductImage } from "@/lib/product-images.functions";
import { enrichProductPassportFn } from "@/lib/passport.functions";
import { ProductImage } from "@/components/products/product-image";

import { cn } from "@/lib/utils";

type Props = {
  product: {
    id: string;
    name?: string | null;
    brand?: string | null;
    image_url?: string | null;
    thumbnail_url?: string | null;
    hero_image?: string | null;
    image_status?: string | null;
    image_source?: string | null;
  };
};

const SOURCE_LABEL: Record<string, string> = {
  retailer: "Retailer upload",
  official: "Official (manufacturer)",
  ai_suggested: "AI suggested",
  brand_logo: "Brand logo",
  placeholder: "Auto placeholder",
};

const STATUS_STYLES: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ai_suggested: "bg-violet-100 text-violet-800 border-violet-200",
  brand_logo: "bg-sky-100 text-sky-800 border-sky-200",
  placeholder: "bg-amber-100 text-amber-800 border-amber-200",
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  needs_review: "bg-orange-100 text-orange-800 border-orange-200",
};

export function ImageStatusCard({ product }: Props) {
  const qc = useQueryClient();
  const reset = useServerFn(resetProductImage);
  const enrich = useServerFn(enrichProductPassportFn);
  const [busy, setBusy] = useState<"refresh" | "enrich" | null>(null);

  const status = product.image_status ?? "pending";
  const source = product.image_source ?? null;
  const isReady = status === "ready" || source === "retailer" || source === "official";
  const isPlaceholder = source === "placeholder" || status === "placeholder";

  // Clears the current image first, then re-runs the full resolver chain —
  // strictly more thorough than a bare re-run, so there's no reason to
  // offer both as separate buttons.
  const handleRefresh = async () => {
    setBusy("refresh");
    try {
      await reset({ data: { productId: product.id } });
      toast.success("Image refreshed with a fresh lookup.");
      await qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to refresh image");
    } finally {
      setBusy(null);
    }
  };
  const handleEnrich = async () => {
    setBusy("enrich");
    try {
      await enrich({ data: { product_id: product.id, overwrite: false } });
      toast.success("Passport enrichment complete.");
      await qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to enrich passport");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Product image</h3>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
            STATUS_STYLES[status] ?? STATUS_STYLES.pending,
          )}
        >
          {isReady ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="flex gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
          <ProductImage product={product} variant="thumb" />
        </div>
        <div className="flex flex-1 flex-col justify-between">
          <div className="text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Source:</span>{" "}
              {source ? (SOURCE_LABEL[source] ?? source) : "Not resolved"}
            </p>
            {isPlaceholder && (
              <p className="mt-1 text-amber-700">
                Using an auto-generated placeholder. Upload a photo or refresh to try an official /
                AI source.
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={busy !== null}>
              <RefreshCw className={cn("mr-1 h-3.5 w-3.5", busy === "refresh" && "animate-spin")} />
              Refresh image
            </Button>
            <Button size="sm" variant="ghost" onClick={handleEnrich} disabled={busy !== null}>
              <Sparkles className={cn("mr-1 h-3.5 w-3.5", busy === "enrich" && "animate-spin")} />
              Enrich passport
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
