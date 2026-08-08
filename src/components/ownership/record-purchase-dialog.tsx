import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Loader2, RotateCcw } from "lucide-react";
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

function CameraCapture({ onCapture }: { onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setStarting(true);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Camera unavailable");
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-lg bg-black sm:aspect-video sm:max-w-none">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-4 rounded-lg border-2 border-white/60" />
      {starting && (
        <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-xs">Starting camera...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 text-center text-sm text-white">
          <div>
            <p className="font-medium">Cannot access the camera</p>
            <p className="mt-1 text-xs opacity-80">Allow camera permission for this site, then reload.</p>
          </div>
        </div>
      )}
      {!starting && !error && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={capture}
            aria-label="Take photo"
            className="h-14 w-14 rounded-full border-4 border-white bg-white/30 backdrop-blur-sm transition active:scale-95"
          />
        </div>
      )}
    </div>
  );
}

export function RecordPurchaseDialog() {
  const [open, setOpen] = useState(false);
  const [tagId, setTagId] = useState("");
  const [outletId, setOutletId] = useState<string>("");
  const [payment, setPayment] = useState("Card");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
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
      setOutletId("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not record the purchase"),
  });

  const update = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const total = lines.reduce(
    (s, l) => s + (parseFloat(l.price || "0") || 0) * (Number(l.quantity) || 1),
    0,
  );

  const handleCaptured = (file: File) => {
    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
    extractReceiptData(file);
  };

  const retake = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoFile(null);
    setPhotoUrl(null);
    setLines([{ ...emptyLine }]);
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) retake();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" /> Record purchase
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Purchase Receipt</DialogTitle>
          <DialogDescription>
            Take a photo of your receipt to add it — a photo is required for every receipt.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center gap-4">
          {!photoFile ? (
            open && <CameraCapture onCapture={handleCaptured} />
          ) : (
            <div className="w-full max-w-sm space-y-3 sm:max-w-none">
              <div className="overflow-hidden rounded-lg border border-border">
                {photoUrl && (
                  <img src={photoUrl} alt="Captured receipt" className="max-h-72 w-full object-contain bg-muted" />
                )}
              </div>
              {extracting && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting data...
                </div>
              )}
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={retake}>
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Retake photo
                </Button>
              </div>
            </div>
          )}
        </div>

        {photoFile && (
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
        )}

        {/* Item entry — shown once a receipt photo has been captured */}
        {photoFile && (
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

        {photoFile && (
          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">Basket total R {total.toFixed(2)}</p>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || lines.every((l) => !l.name.trim())}
            >
              {save.isPending ? "Saving…" : "Save receipt"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
