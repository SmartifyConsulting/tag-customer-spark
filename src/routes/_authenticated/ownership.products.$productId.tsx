import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, FileText, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/format";
import { StatusBadge, Timeline, WarrantyProgress, daysBetween, warrantyState } from "@/components/ownership/shared";
import { exportTablePdf } from "@/components/ownership/export";
import {
  addServiceEvent,
  createWarrantyClaim,
  getOwnedProduct,
  listOwnedProducts,
  registerWarranty,
  suggestAccessories,
  updateOwnedProduct,
} from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/ownership/products/$productId")({
  head: () => ({
    meta: [
      { title: "Product profile — Tag Ownership" },
      { name: "description", content: "Warranty, manuals, accessories, service history and product health." },
    ],
  }),
  component: ProductProfile,
});

const CONDITIONS = ["new", "excellent", "good", "fair", "poor"];
const STATUSES = ["owned", "gifted", "sold", "disposed", "lost"];

function ProductProfile() {
  const { productId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getOwnedProduct);
  const roomsFn = useServerFn(listOwnedProducts);
  const updateFn = useServerFn(updateOwnedProduct);
  const registerFn = useServerFn(registerWarranty);
  const claimFn = useServerFn(createWarrantyClaim);
  const eventFn = useServerFn(addServiceEvent);
  const accessoriesFn = useServerFn(suggestAccessories);

  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "owned", productId],
    queryFn: () => getFn({ data: { id: productId } }),
  });
  const rooms = useQuery({ queryKey: ["ownership", "owned"], queryFn: () => roomsFn() });

  const [claim, setClaim] = useState("");
  const [eventTitle, setEventTitle] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ownership"] });

  const update = useMutation({
    mutationFn: (v: any) => updateFn({ data: { id: productId, ...v } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });
  const register = useMutation({
    mutationFn: (id: string) => registerFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Warranty registered");
      invalidate();
    },
  });
  const submitClaim = useMutation({
    mutationFn: (warrantyId: string) => claimFn({ data: { warrantyId, description: claim } }),
    onSuccess: () => {
      toast.success("Claim submitted");
      setClaim("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not submit the claim"),
  });
  const logEvent = useMutation({
    mutationFn: () =>
      eventFn({ data: { ownedProductId: productId, kind: "maintenance", title: eventTitle, costCents: 0 } }),
    onSuccess: () => {
      toast.success("Service event logged");
      setEventTitle("");
      invalidate();
    },
  });
  const accessories = useMutation({
    mutationFn: () => accessoriesFn({ data: { ownedProductId: productId } }),
    onError: (e: any) => toast.error(e?.message ?? "Could not fetch suggestions"),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
  const p = data as any;
  if (!p) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          That product is not available.
        </CardContent>
      </Card>
    );
  }

  const w = p.warranty;
  const state = warrantyState(w?.expires_on);
  const lifespanPct = p.estimated_lifespan_months
    ? Math.min(
        100,
        (daysBetween(new Date(p.purchased_at ?? Date.now()), new Date()) /
          (p.estimated_lifespan_months * 30.4)) *
          100,
      )
    : null;

  return (
    <div className="space-y-6">
      <Link
        to="/ownership/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> My Products
      </Link>

      <Card className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[minmax(0,320px)_1fr]">
          <div className="aspect-square w-full bg-muted md:aspect-auto">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <CardContent className="space-y-4 p-6">
            <div>
              <h1 className="text-2xl font-semibold">{p.name}</h1>
              <p className="text-sm text-muted-foreground">
                {p.brand ? `${p.brand} · ` : ""}
                {p.category}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
              <StatusBadge>{p.condition ?? "good"}</StatusBadge>
              <StatusBadge tone="info">{p.room?.name ?? "Unassigned room"}</StatusBadge>
              {p.recall_notice && <StatusBadge tone="expired">Recall notice</StatusBadge>}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Meta label="Purchased" value={p.purchased_at ? new Date(p.purchased_at).toLocaleDateString() : "—"} />
              <Meta label="Paid" value={formatMoney(p.purchase_price_cents ?? 0)} />
              <Meta label="Serial" value={p.serial_number ?? "—"} />
            </div>
            <WarrantyProgress startsOn={w?.starts_on} expiresOn={w?.expires_on} />
            <div className="grid gap-2 sm:grid-cols-3">
              <Select value={p.room_id ?? ""} onValueChange={(v) => update.mutate({ roomId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign room" />
                </SelectTrigger>
                <SelectContent>
                  {(((rooms.data as any)?.rooms ?? []) as any[]).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={p.condition ?? "good"} onValueChange={(v) => update.mutate({ condition: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={p.ownership_status ?? "owned"}
                onValueChange={(v) => update.mutate({ ownershipStatus: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </div>
      </Card>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="warranty">Warranty</TabsTrigger>
          <TabsTrigger value="manuals">Manuals</TabsTrigger>
          <TabsTrigger value="accessories">Accessories</TabsTrigger>
          <TabsTrigger value="service">Service history</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="health">Product health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <Meta label="Serial number" value={p.serial_number ?? "—"} />
              <Meta label="Ownership status" value={p.ownership_status ?? "owned"} />
              <Meta label="Retailer" value={p.item?.purchase?.store?.name ?? "—"} />
              <Meta label="Receipt" value={p.item?.purchase?.receipt_number ?? "—"} />
              <Meta label="Current value" value={formatMoney(p.current_value_cents ?? 0)} />
              <Meta label="Room" value={p.room?.name ?? "Unassigned"} />
              {p.item?.purchase?.id && (
                <Link
                  to="/ownership/purchases/$purchaseId"
                  params={{ purchaseId: p.item.purchase.id }}
                  className="text-sm font-medium underline underline-offset-4"
                >
                  Open the original purchase
                </Link>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warranty">
          <Card>
            <CardContent className="space-y-4 p-6">
              {w ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Meta label="Period" value={`${w.months ?? "—"} months`} />
                    <Meta
                      label="Remaining"
                      value={state.daysLeft !== null ? `${Math.max(0, state.daysLeft)} days` : "—"}
                    />
                    <Meta label="Status" value={w.status ?? "—"} />
                  </div>
                  <WarrantyProgress startsOn={w.starts_on} expiresOn={w.expires_on} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => register.mutate(w.id)} disabled={!!w.registered_at}>
                      <ShieldCheck className="mr-1.5 h-4 w-4" />
                      {w.registered_at ? "Registered" : "Register warranty"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        exportTablePdf(
                          "Warranty certificate",
                          [
                            {
                              product: p.name,
                              serial: p.serial_number ?? "",
                              months: w.months ?? "",
                              starts: w.starts_on,
                              expires: w.expires_on,
                            },
                          ],
                          `warranty-${p.name}.pdf`,
                        )
                      }
                    >
                      <Download className="mr-1.5 h-4 w-4" /> Certificate
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Describe the fault to make a claim"
                      value={claim}
                      onChange={(e) => setClaim(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={claim.trim().length < 3 || submitClaim.isPending}
                      onClick={() => submitClaim.mutate(w.id)}
                    >
                      Make a claim
                    </Button>
                  </div>
                  {(w.claims ?? []).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <span className="truncate pr-3">{c.description}</span>
                      <StatusBadge tone={c.status === "resolved" ? "ok" : "soon"}>{c.status}</StatusBadge>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No warranty recorded for this product.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manuals">
          <DocumentList
            documents={(p.documents ?? []).filter((d: any) =>
              ["manual", "quick_start", "installation", "safety"].includes(d.kind),
            )}
            empty="No manuals attached yet. Manuals attach automatically as brands publish them."
          />
        </TabsContent>

        <TabsContent value="accessories">
          <Card>
            <CardContent className="space-y-3 p-6">
              <Button size="sm" onClick={() => accessories.mutate()} disabled={accessories.isPending}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                {accessories.isPending ? "Thinking…" : "Suggest compatible accessories"}
              </Button>
              <div className="grid gap-3 sm:grid-cols-2">
                {(((accessories.data as any)?.accessories ?? []) as any[]).map((a, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.reason}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service">
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Log a repair, service or update"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={eventTitle.trim().length < 2 || logEvent.isPending}
                  onClick={() => logEvent.mutate()}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add
                </Button>
              </div>
              <Timeline
                steps={((p.events ?? []) as any[]).map((e) => ({
                  label: e.title,
                  date: e.occurred_at,
                  detail: e.description ?? undefined,
                  done: true,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentList documents={p.documents ?? []} empty="No documents stored for this product yet." />
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Warranty remaining</p>
                <WarrantyProgress startsOn={w?.starts_on} expiresOn={w?.expires_on} />
              </div>
              {lifespanPct !== null && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">
                    Estimated lifespan used · {Math.round(lifespanPct)}%
                  </p>
                  <Progress value={lifespanPct} />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Meta
                  label="Maintenance due"
                  value={p.maintenance_due_on ? new Date(p.maintenance_due_on).toLocaleDateString() : "None scheduled"}
                />
                <Meta label="Battery health" value={p.battery_health ? `${p.battery_health}%` : "N/A"} />
                <Meta label="Recall alerts" value={p.recall_notice ?? "None"} />
                <Meta label="Safety notices" value={p.safety_notice ?? "None"} />
                <Meta label="Software updates" value={p.software_version ?? "N/A"} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DocumentList({ documents, empty }: { documents: any[]; empty: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-6">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          documents.map((d) => (
            <a
              key={d.id}
              href={d.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{d.title}</span>
              <StatusBadge>{String(d.kind).replace("_", " ")}</StatusBadge>
            </a>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
