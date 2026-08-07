import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FACTOR_FIELDS,
  SUSTAINABILITY_DEFAULTS,
  sustainabilitySettingsQueryOptions,
} from "@/lib/sustainability";
import { updateSustainabilitySettings } from "@/lib/sustainability.functions";

// Admin-only configuration. Every environmental and cost figure on the
// dashboard reads these factors — nothing is hard-coded — so retailers can
// update them as reporting standards evolve.
export function SustainabilityConfigDialog() {
  const qc = useQueryClient();
  const settings = useQuery(sustainabilitySettingsQueryOptions);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const current = draft ?? settings.data ?? { ...SUSTAINABILITY_DEFAULTS };

  const save = useMutation({
    mutationFn: () =>
      updateSustainabilitySettings({
        data: {
          enabled: !!current.enabled,
          demo_mode: !!current.demo_mode,
          currency: current.currency,
          units: current.units,
          ...Object.fromEntries(
            FACTOR_FIELDS.map((f) => [f.key, Number(current[f.key] ?? SUSTAINABILITY_DEFAULTS[f.key])]),
          ),
        } as any,
      }),
    onSuccess: () => {
      toast.success("Sustainability settings saved");
      qc.invalidateQueries({ queryKey: ["sustainability"] });
      setOpen(false);
      setDraft(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const set = (k: string, v: any) => setDraft({ ...current, [k]: v });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-1.5 h-4 w-4" /> Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sustainability configuration</DialogTitle>
          <DialogDescription>
            Conversion factors and cost assumptions used for every figure on this dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Sustainability module</p>
              <p className="text-xs text-muted-foreground">Switch the dashboard and its menu item on or off.</p>
            </div>
            <Switch checked={!!current.enabled} onCheckedChange={(v) => set("enabled", v)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Demo data</p>
              <p className="text-xs text-muted-foreground">
                Show an illustrative group-scale dataset instead of live figures. Clearly badged, never mixed.
              </p>
            </div>
            <Switch checked={!!current.demo_mode} onCheckedChange={(v) => set("demo_mode", v)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FACTOR_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">
                  {f.label} <span className="text-muted-foreground">({f.suffix})</span>
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={String(current[f.key] ?? "")}
                  onChange={(e) => set(f.key, e.target.value === "" ? "" : Number(e.target.value))}
                />
                <p className="text-[11px] leading-snug text-muted-foreground">{f.help}</p>
              </div>
            ))}

            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value={current.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["ZAR", "USD", "GBP", "EUR", "NAD", "BWP", "KES", "NGN"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Units of measure</Label>
              <Select value={current.units} onValueChange={(v) => set("units", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric (kg, m, litres)</SelectItem>
                  <SelectItem value="imperial">Imperial (lb, ft, gallons)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setDraft({ ...SUSTAINABILITY_DEFAULTS, ...{ enabled: current.enabled } })}>
            Reset to defaults
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
