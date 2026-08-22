import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, Loader2, Megaphone, Send, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createBroadcastImageUploadUrl,
  getBroadcastTemplateInfo,
  previewBroadcastAudience,
  sendMarketingBroadcast,
} from "@/lib/broadcasts.functions";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export function BroadcastComposerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const previewFn = useServerFn(previewBroadcastAudience);
  const sendFn = useServerFn(sendMarketingBroadcast);
  const uploadUrlFn = useServerFn(createBroadcastImageUploadUrl);
  const templateInfoFn = useServerFn(getBroadcastTemplateInfo);

  const [imageUrl, setImageUrl] = useState("");
  const [internalName, setInternalName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [catalogueUrl, setCatalogueUrl] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: templateInfo } = useQuery({
    queryKey: ["broadcast-template-info"],
    queryFn: () => templateInfoFn({ data: {} } as any),
    enabled: open,
    staleTime: 0,
  });
  const templateReady = templateInfo?.ok === true;

  const { data: audience, isLoading: audienceLoading } = useQuery({
    queryKey: ["broadcast-audience"],
    queryFn: () => previewFn({ data: {} } as any),
    enabled: open,
    staleTime: 60_000,
  });

  const imageOk = /^https:\/\/\S+$/i.test(imageUrl.trim());
  const urlOk = /^https:\/\/\S+$/i.test(catalogueUrl.trim());
  const disabled = useMemo(
    () =>
      !templateReady ||
      !imageOk ||
      !urlOk ||
      expiry.trim().length === 0 ||
      internalName.trim().length === 0 ||
      uploading,
    [templateReady, imageOk, urlOk, expiry, internalName, uploading],
  );

  const preview = useMemo(() => {
    const body = templateInfo?.ok === true ? templateInfo.bodyText : "";
    if (!body) return "";
    return body.replace(/\{\{[^}]+\}\}/, formatDate(expiry) || "…");
  }, [templateInfo, expiry]);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const signed = await uploadUrlFn({
        data: { filename: file.name, contentType: file.type || "image/jpeg" },
      });
      const res = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      setImageUrl(signed.publicUrl);
      toast.success("Header image ready");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload that image");
    } finally {
      setUploading(false);
    }
  }

  const send = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          internalName: internalName.trim(),
          expiryDate: formatDate(expiry),
          imageUrl: imageUrl.trim(),
          catalogueUrl: catalogueUrl.trim(),
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `Broadcast sent to ${res.sent} customer${res.sent === 1 ? "" : "s"}${
          res.failed ? ` (${res.failed} failed)` : ""
        }.`,
      );
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setImageUrl("");
      setInternalName("");
      setExpiry("");
      setCatalogueUrl("");
      setConfirm(false);
      onOpenChange(false);
    },
    onError: (e: any) => {
      setConfirm(false);
      toast.error(e?.message ?? "Broadcast failed");
    },
  });

  const count = audience?.count ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => (!send.isPending ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> New WhatsApp broadcast
          </DialogTitle>
          <DialogDescription>
            Sent only to customers who have opted in to marketing messages.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" /> Opted-in audience
            </span>
            {audienceLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Badge variant="secondary" className="font-mono">
                {count}
                {audience?.over ? ` (capped at ${audience.cap})` : ""}
              </Badge>
            )}
          </div>

          {templateInfo?.ok === false ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {templateInfo.error}
            </div>
          ) : null}

          {/* Header image — the approved template's IMAGE header. */}
          <div className="grid gap-2">
            <Label htmlFor="bc-header">Header (image, required)</Label>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                {uploading ? "Uploading…" : imageOk ? "Replace image" : "Upload image"}
                <input
                  id="bc-header"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void handleFile(f);
                  }}
                />
              </label>
              {imageOk ? (
                <img
                  src={imageUrl}
                  alt="Broadcast header preview"
                  className="h-12 w-12 rounded-md object-cover"
                />
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bc-name">Internal name</Label>
            <Input
              id="bc-name"
              value={internalName}
              onChange={(e) => setInternalName(e.target.value)}
              maxLength={120}
              placeholder="Spring catalogue — week 1"
            />
            <p className="text-[11px] text-muted-foreground">
              For your broadcast list only — never sent to customers.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="bc-expiry">Offer valid till</Label>
              <Input
                id="bc-expiry"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bc-catalogue">Online shopping catalogue URL</Label>
              <Input
                id="bc-catalogue"
                value={catalogueUrl}
                onChange={(e) => setCatalogueUrl(e.target.value)}
                placeholder="https://…"
                type="url"
              />
              {!urlOk && catalogueUrl.trim().length > 0 ? (
                <p className="text-[11px] text-destructive">Use a public https link.</p>
              ) : null}
            </div>
          </div>

          {preview ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Message preview</p>
              <p className="mt-1 whitespace-pre-line">{preview}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={send.isPending}
          >
            Cancel
          </Button>
          {confirm ? (
            <Button
              onClick={() => send.mutate()}
              disabled={send.isPending || disabled || count === 0}
              className="gap-2"
            >
              {send.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Confirm &amp; send to {count}
            </Button>
          ) : (
            <Button
              onClick={() => setConfirm(true)}
              disabled={disabled || count === 0}
              className="gap-2"
            >
              <Send className="h-4 w-4" /> Send broadcast
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
