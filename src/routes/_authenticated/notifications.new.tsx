import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Save, Send, CalendarClock } from "lucide-react";
import {
  getNotificationOptions,
  upsertCampaign,
  enqueueCampaign,
  estimateCampaignAudience,
  type CampaignInput,
} from "@/lib/notifications.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { WhatsAppPreview } from "@/components/notifications/whatsapp-preview";
import { MessagePlaceholders } from "@/components/notifications/message-placeholders";
import { AiCampaignAssist } from "@/components/notifications/ai-campaign-assist";

export const Route = createFileRoute("/_authenticated/notifications/new")({
  head: () => ({ meta: [{ title: "New campaign — Tag" }] }),
  component: NewCampaign,
});

const TYPES = [
  { value: "sale", label: "Sale", template: { headline: "Price drop!", body: "{product} just got cheaper — grab it while it lasts.", cta: "View deal" } },
  { value: "low_stock", label: "Low stock", template: { headline: "Almost gone", body: "Only a few {product} left in your size.", cta: "Reserve mine" } },
  { value: "back_in_stock", label: "Back in stock", template: { headline: "It's back", body: "{product} is available again — don't miss it twice.", cta: "Shop now" } },
  { value: "promotion", label: "Promotion", template: { headline: "Limited promo", body: "Use code {code} for an exclusive offer on {product}.", cta: "Claim offer" } },
  { value: "custom", label: "Custom", template: { headline: "", body: "", cta: "" } },
] as const;

function NewCampaign() {
  const navigate = useNavigate();
  const options = useServerFn(getNotificationOptions);
  const upsert = useServerFn(upsertCampaign);
  const enqueue = useServerFn(enqueueCampaign);
  const estimate = useServerFn(estimateCampaignAudience);

  const { data: opts } = useQuery({
    queryKey: ["notification-options"],
    queryFn: () => options(),
  });

  const [type, setType] = useState<CampaignInput["type"]>("sale");
  const [title, setTitle] = useState("New campaign");
  const [productId, setProductId] = useState<string | undefined>();
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("View deal");
  const [ctaUrl, setCtaUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [redemptionCode, setRedemptionCode] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [audience, setAudience] = useState(0);
  const [saving, setSaving] = useState<"none" | "draft" | "send" | "schedule">("none");

  // Apply template on type change
  useEffect(() => {
    const t = TYPES.find((t) => t.value === type)!;
    setHeadline((cur) => cur || t.template.headline);
    setBody((cur) => cur || t.template.body);
    setCtaLabel((cur) => cur || t.template.cta);
  }, [type]);

  // Picked product preview defaults
  const product = useMemo(
    () => opts?.products.find((p: any) => p.id === productId) ?? null,
    [opts, productId],
  );
  useEffect(() => {
    if (product?.image_url && !imageUrl) setImageUrl(product.image_url);
  }, [product, imageUrl]);

  // Audience estimation
  useEffect(() => {
    let cancelled = false;
    estimate({
      data: {
        audience_filter: productId ? { product_ids: [productId] } : {},
        product_id: productId ?? null,
      },
    }).then((r) => {
      if (!cancelled) setAudience(r.count);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [productId, estimate]);

  const renderedBody = useMemo(
    () =>
      body
        .replaceAll("{product}", product?.name ?? "this product")
        .replaceAll("{code}", redemptionCode || "SAVE10"),
    [body, product, redemptionCode],
  );

  async function persist(action: "draft" | "send" | "schedule") {
    setSaving(action);
    try {
      const payload: CampaignInput = {
        title: title.trim() || "Untitled campaign",
        type,
        product_id: productId ?? null,
        image_url: imageUrl || null,
        headline: headline.trim() || null,
        body: renderedBody || null,
        cta_label: ctaLabel || null,
        cta_url: ctaUrl || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        redemption_code: redemptionCode || null,
        audience_filter: productId ? { product_ids: [productId] } : {},
        scheduled_at: action === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        message_template: "auto",
      };
      const { id } = await upsert({ data: payload });
      if (action === "send") {
        await enqueue({ data: { id, sendNow: true } });
      } else if (action === "schedule") {
        await enqueue({ data: { id, sendNow: false } });
      }
      navigate({ to: "/notifications/$campaignId", params: { campaignId: id } });
    } finally {
      setSaving("none");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="New campaign"
        description="Compose a WhatsApp message, target interested customers, preview, then send."
        actions={
          <Button variant="outline" asChild size="sm">
            <Link to="/notifications"><ArrowLeft className="mr-1 h-4 w-4" />Back</Link>
          </Button>
        }
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value as any)}
                    className={`px-3 h-9 rounded-full text-sm border transition-colors ${
                      type === t.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:bg-accent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="title">Internal title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label>Product</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
                  <SelectContent>
                    {opts?.products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <AiCampaignAssist
              type={type}
              productId={productId}
              headline={headline}
              body={body}
              ctaLabel={ctaLabel}
              audienceSize={audience}
              onApply={({ headline: h, body: b, cta_label }) => {
                setHeadline(h);
                setBody(b);
                setCtaLabel(cta_label);
              }}
              onRecommendTime={(iso) => setScheduledAt(new Date(iso).toISOString().slice(0,16))}
            />
            <div className="space-y-1.5">
              <Label htmlFor="image">Hero image URL</Label>
              <Input
                id="image"
                placeholder="https://…"
                value={imageUrl ?? ""}
                onChange={(e) => setImageUrl(e.target.value || undefined)}
              />
              <p className="text-[11px] text-muted-foreground">
                Defaults to the product image when a product is selected.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="headline">Headline <span className="text-muted-foreground">({headline.length}/80)</span></Label>
              <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Body <span className="text-muted-foreground">({body.length}/800)</span></Label>
              <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={800} rows={5} />
              <p className="text-[11px] text-muted-foreground">
                Tokens: <code>{"{product}"}</code>, <code>{"{code}"}</code>
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <p className="text-[11px] text-muted-foreground">
                Placeholders: <code>{{"{customer_name}"}}</code>, <code>{{"{product}"}}</code>, <code>{{"{discount}"}}</code>, <code>{{"{promo_code}"}}</code>, <code>{{"{price}"}}</code>, <code>{{"{expiry}"}}</code>
              </p>
                <Label htmlFor="cta">CTA label</Label>
                <Input id="cta" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctaurl">CTA URL</Label>
                <Input id="ctaurl" placeholder="https://…" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exp">Expires at</Label>
                <Input id="exp" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">Redemption code</Label>
                <Input id="code" placeholder="SAVE10" value={redemptionCode} onChange={(e) => setRedemptionCode(e.target.value.toUpperCase())} maxLength={40} />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <Label className="text-base">Audience</Label>
                <p className="text-sm text-muted-foreground">
                  Customers interested in {product ? <span className="font-medium text-foreground">{product.name}</span> : "all products"}.
                </p>
              </div>
              <Badge variant="secondary" className="text-base px-3 py-1">{audience} recipients</Badge>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <Label className="text-base">Schedule</Label>
            <div className="grid sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="when">Send at</Label>
                <Input id="when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => persist("draft")}
                  disabled={saving !== "none"}
                >
                  {saving === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save draft</>}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => persist("schedule")}
                  disabled={saving !== "none" || !scheduledAt}
                >
                  {saving === "schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CalendarClock className="mr-2 h-4 w-4" />Schedule</>}
                </Button>
                <Button
                  onClick={() => persist("send")}
                  disabled={saving !== "none" || audience === 0}
                >
                  {saving === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-2 h-4 w-4" />Send now</>}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            WhatsApp preview
          </p>
          <WhatsAppPreview
            retailerName={opts?.retailer?.name ?? "Your store"}
            logoUrl={opts?.retailer?.logo_url ?? undefined}
            imageUrl={imageUrl}
            headline={headline}
            body={renderedBody}
            ctaLabel={ctaLabel}
            expiresAt={expiresAt ? new Date(expiresAt).toISOString() : null}
            redemptionCode={redemptionCode}
          />
        </div>
      </div>
    </div>
  );
}
