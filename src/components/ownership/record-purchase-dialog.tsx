import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordPurchase, getTagIdentity } from "@/lib/ownership.functions";
import { listStores } from "@/lib/stores.functions";

type Line = {
  name: string;
  brand: string;
  category: string;
  quantity: number;
  price: string;
  warrantyMonths: number;
  serialNumber: string;
};

const emptyLine: Line = {
  name: "",
  brand: "",
  category: "Home",
  quantity: 1,
  price: "",
  warrantyMonths: 0,
  serialNumber: "",
};

const CATEGORIES = ["Home", "Electronics", "Kitchen", "Garden", "Clothing", "Automotive"];

export function RecordPurchaseDialog() {
  const [open, setOpen] = useState(false);
  const [tagId, setTagId] = useState("");
  const [storeId, setStoreId] = useState<string>("");
  const [payment, setPayment] = useState("Card");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const qc = useQueryClient();

  const storesFn = useServerFn(listStores);
  const tagFn = useServerFn(getTagIdentity);
  const recordFn = useServerFn(recordPurchase);

  const stores = useQuery({ queryKey: ["ownership", "stores"], queryFn: () => storesFn() });
  const tag = useQuery({ queryKey: ["ownership", "tag"], queryFn: () => tagFn() });

  const save = useMutation({
    mutationFn: () =>
      recordFn({
        data: {
          tagId: (tagId || (tag.data as any)?.tag_id || "").trim(),
          storeId: storeId || null,
          paymentMethod: payment,
          items: lines
            .filter((l) => l.name.trim())
            .map((l) => ({
              name: l.name.trim(),
              brand: l.brand.trim() || undefined,
              category: l.category,
              quantity: Number(l.quantity) || 1,
              unitPriceCents: Math.round(parseFloat(l.price || "0") * 100),
              warrantyMonths: Number(l.warrantyMonths) || 0,
              returnWindowDays: 30,
              serialNumber: l.serialNumber.trim() || undefined,
            })),
        },
      }),
    onSuccess: (res: any) => {
      toast.success(`Purchase recorded — receipt ${res.receiptNumber}`);
      qc.invalidateQueries({ queryKey: ["ownership"] });
      setOpen(false);
      setLines([{ ...emptyLine }]);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not record the purchase"),
  });

  const update = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const total = lines.reduce(
    (s, l) => s + (parseFloat(l.price || "0") || 0) * (Number(l.quantity) || 1),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" /> Record purchase
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record a purchase</DialogTitle>
          <DialogDescription>
            Scan or type the shopper's TAG ID at checkout, then add the basket. Anything with a
            warranty automatically becomes an owned product.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>TAG ID</Label>
            <Input
              value={tagId}
              placeholder={(tag.data as any)?.tag_id ?? "TAG-0000-AA00"}
              onChange={(e) => setTagId(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Store</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {((stores.data as any[]) ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Input value={payment} onChange={(e) => setPayment(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-12">
              <Input
                className="sm:col-span-4"
                placeholder="Product name"
                value={l.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <Input
                className="sm:col-span-2"
                placeholder="Brand"
                value={l.brand}
                onChange={(e) => update(i, { brand: e.target.value })}
              />
              <Select value={l.category} onValueChange={(v) => update(i, { category: v })}>
                <SelectTrigger className="sm:col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="sm:col-span-1"
                type="text"
                inputMode="numeric"
                placeholder="Qty"
                value={l.quantity}
                onChange={(e) => update(i, { quantity: Number(e.target.value.replace(/\D/g, "")) || 1 })}
              />
              <Input
                className="sm:col-span-2"
                type="text"
                inputMode="decimal"
                placeholder="Price"
                value={l.price}
                onChange={(e) => update(i, { price: e.target.value.replace(/[^0-9.]/g, "") })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="sm:col-span-1"
                onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Input
                className="sm:col-span-3"
                type="text"
                inputMode="numeric"
                placeholder="Warranty months"
                value={l.warrantyMonths || ""}
                onChange={(e) =>
                  update(i, { warrantyMonths: Number(e.target.value.replace(/\D/g, "")) || 0 })
                }
              />
              <Input
                className="sm:col-span-4"
                placeholder="Serial number (optional)"
                value={l.serialNumber}
                onChange={(e) => update(i, { serialNumber: e.target.value })}
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, { ...emptyLine }])}>
            <Plus className="mr-1.5 h-4 w-4" /> Add item
          </Button>
        </div>

        <DialogFooter className="items-center justify-between sm:justify-between">
          <p className="text-sm text-muted-foreground">Basket total R {total.toFixed(2)}</p>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
