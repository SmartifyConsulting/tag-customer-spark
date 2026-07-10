import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  enrichProductPassportFn,
  getProductPassport,
} from "@/lib/passport.functions";

export function PassportTab({ productId, dppId }: { productId: string; dppId?: string | null }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getProductPassport);
  const enrichFn = useServerFn(enrichProductPassportFn);

  const { data: passport, isLoading } = useQuery({
    queryKey: ["passport", productId],
    queryFn: () => getFn({ data: { product_id: productId } }),
    refetchInterval: (q) =>
      (q.state.data as any)?.enrichment_status === "enriching" ? 4000 : false,
  });

  const enrich = useMutation({
    mutationFn: (overwrite: boolean) =>
      enrichFn({ data: { product_id: productId, overwrite } }),
    onSuccess: () => {
      toast.success("Enrichment complete");
      qc.invalidateQueries({ queryKey: ["passport", productId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Enrichment failed"),
  });

  const publicUrl = dppId ? `/p/${dppId}` : null;
  const status = (passport as any)?.enrichment_status ?? "pending";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Digital Product Passport</h3>
            <Badge variant={status === "enriched" || status === "manual" ? "default" : "secondary"}>
              {status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-enriched product data linked to your GS1 Digital Link QR code.
          </p>
        </div>
        <div className="flex gap-2">
          {publicUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> View public page
              </a>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => enrich.mutate(status === "manual" || status === "enriched")}
            disabled={enrich.isPending}
          >
            {enrich.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enriching…</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" />
                {status === "pending" || status === "failed" ? "Enrich with AI" : "Re-enrich"}
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading passport…</p>
      ) : !passport ? (
        <p className="text-sm text-muted-foreground">
          No passport yet. Click <span className="font-medium">Enrich with AI</span> to generate one.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Brand" value={(passport as any).brand} />
          <Field label="Manufacturer" value={(passport as any).manufacturer} />
          <Field label="Country of origin" value={(passport as any).country_of_origin} />
          <Field label="Category" value={(passport as any).category_path} />
          <Field label="Short description" value={(passport as any).short_description} full />
          <Field label="Marketing description" value={(passport as any).marketing_description} full />
          <Field
            label="Ingredients"
            value={((passport as any).ingredients ?? []).join(", ") || null}
            full
          />
          <Field
            label="Allergens"
            value={((passport as any).allergens ?? []).join(", ") || null}
          />
          <Field
            label="Warranty"
            value={
              (passport as any).warranty?.duration_months
                ? `${(passport as any).warranty.duration_months} months`
                : null
            }
          />
          <Field
            label="Sustainability"
            value={
              (passport as any).sustainability?.packaging ??
              ((passport as any).sustainability?.certifications ?? []).join(", ") ??
              null
            }
            full
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}
