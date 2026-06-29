import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Sparkles, Wand2, Clock, BarChart3 } from "lucide-react";
import { writeCampaign, rewriteCampaign, predictCampaignResponse, recommendSendTime } from "@/lib/ai.functions";
import { toast } from "sonner";

type Tone = "urgent" | "friendly" | "premium" | "playful";

export function AiCampaignAssist(props: {
  type: string;
  productId?: string;
  headline: string;
  body: string;
  ctaLabel: string;
  audienceSize: number;
  onApply: (m: { headline: string; body: string; cta_label: string }) => void;
  onRecommendTime?: (iso: string) => void;
}) {
  const [tone, setTone] = useState<Tone>("friendly");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [timing, setTiming] = useState<any>(null);

  async function generate() {
    setBusy("write");
    try {
      const out = await writeCampaign({ data: { type: props.type as any, tone, hint, product_id: props.productId as any } });
      props.onApply(out as any);
      toast.success("AI draft applied");
    } catch (e: any) { toast.error(e?.message ?? "AI failed"); }
    finally { setBusy(null); }
  }
  async function rewrite() {
    setBusy("rewrite");
    try {
      const out = await rewriteCampaign({ data: { headline: props.headline, body: props.body, cta_label: props.ctaLabel, direction: tone } });
      props.onApply(out as any);
      toast.success("Rewritten");
    } catch (e: any) { toast.error(e?.message ?? "AI failed"); }
    finally { setBusy(null); }
  }
  async function predict() {
    setBusy("predict");
    try {
      const out = await predictCampaignResponse({ data: {
        type: props.type, audience_size: props.audienceSize, headline: props.headline, body: props.body,
      }});
      setPrediction(out);
    } catch (e: any) { toast.error(e?.message ?? "AI failed"); }
    finally { setBusy(null); }
  }
  async function suggestTime() {
    setBusy("time");
    try {
      const out: any = await recommendSendTime({ data: undefined });
      setTiming(out);
      props.onRecommendTime?.(out.recommended_iso);
    } catch (e: any) { toast.error(e?.message ?? "AI failed"); }
    finally { setBusy(null); }
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" /> AI assist
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Tone</Label>
          <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="playful">Playful</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Hint (optional)</Label>
          <Input className="h-8" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. emphasise weekend-only" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={generate} disabled={!!busy}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Write for me
        </Button>
        <Button size="sm" variant="outline" onClick={rewrite} disabled={!!busy || (!props.headline && !props.body)}>
          <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Rewrite
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" onClick={predict} disabled={!!busy}>
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Predict response
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 text-sm" align="start">
            {!prediction ? "Loading…" : (
              <div className="space-y-1">
                <Row label="Delivered" v={prediction.predicted_delivered_pct} />
                <Row label="Read" v={prediction.predicted_read_pct} />
                <Row label="Click-through" v={prediction.predicted_click_pct} />
                <Row label="Redemption" v={prediction.predicted_redeem_pct} />
                <p className="text-xs text-muted-foreground mt-2">{prediction.rationale}</p>
              </div>
            )}
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" onClick={suggestTime} disabled={!!busy}>
              <Clock className="h-3.5 w-3.5 mr-1.5" /> Best time
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 text-sm" align="start">
            {!timing ? "Loading…" : (
              <div className="space-y-1">
                <div className="font-medium">{new Date(timing.recommended_iso).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{timing.reason}</p>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function Row({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{Number(v).toFixed(1)}%</span>
    </div>
  );
}
