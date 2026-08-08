import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { recordPurchase, getTagIdentity, listUserOutlets } from "@/lib/ownership.functions";
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
  const [mode, setMode] = useState<"photo" | "manual">("photo");
  const [tagId, setTagId] = useState("");
  const [outletId, setOutletId] = useState<string>("");
  const [payment, setPayment] = useState("Card");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const storesFn = useServerFn(listStores);
  const tagFn = useServerFn(getTagIdentity);
  const outletsFn = useServerFn(listUserOutlets);
  const recordFn = useServerFn(recordPurchase);

  const stores = useQuery({ queryKey: ["ownership", "stores"], queryFn: () => storesFn() });
  const tag = useQuery({ queryKey: ["ownership", "tag"], queryFn: () => tagFn() });
  const outlets = useQuery({ queryKey: ["user-outlets"], queryFn: () => outletsFn() });

  const save = useMutation({
    mutationFn: () =>
      recordFn({
        data: {
          tagId: (tagId || (tag.data as any)?.tag_id || "").trim(),
          storeId: outletId || null,
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
      setPhotoFile(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not record the purchase"),
  });

  const update = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const total = lines.reduce(
    (s, l) => s + (parseFloat(l.price || "0") || 0) * (Number(l.quantity) || 1),
    0,
  );

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      extractReceiptData(file);
    }
  };

  const extractReceiptData = async (file: File) => {
    setExtracting(true);
    try {
      // TODO: Implement AI receipt extraction
      // For now, placeholder that would call an AI service to extract:
      // - Outlet/Store name
      // - Items and prices
      // - Total amount
      // - Date
      toast.info("Receipt extraction coming soon");
    } catch (e) {
      toast.error("Failed to extract receipt data");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" /> Record purchase
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Purchase Receipt</DialogTitle>
          <DialogDescription>
            Take a photo of your receipt for instant extraction, or manually enter your purchase details.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="photo">📷 Photo Receipt</TabsTrigger>
            <TabsTrigger value="manual">✏️ Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="photo" className="space-y-4">
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border p-8">
              {!photoFile ? (
                <>
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Upload receipt photo</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG or WebP</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Choose photo
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <p className="font-medium">{photoFile.name}</p>
                    {extracting && (
                      <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Extracting data...
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPhotoFile(null);
                      setLines([{ ...emptyLine }]);
                    }}
                  >
                    Change photo
                  </Button>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Outlet</Label>
                <Select value={outletId} onValueChange={setOutletId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    {((outlets.data as any[]) ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
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
          </TabsContent>
        </Tabs>

        {/* Item entry (shown in both modes after photo extraction or in manual mode) */}
        {(mode === "manual" || (mode === "photo" && (lines.length > 1 || lines[0].name))) && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium">Items</h3>
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
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, { ...emptyLine }])}>
              <Plus className="mr-1.5 h-4 w-4" /> Add item
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">Basket total R {total.toFixed(2)}</p>
          <Button onClick={() => save.mutate()} disabled={save.isPending || lines.every((l) => !l.name.trim())}>
            {save.isPending ? "Saving…" : "Save receipt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
