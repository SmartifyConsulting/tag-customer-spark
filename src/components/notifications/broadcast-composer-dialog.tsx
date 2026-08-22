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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createBroadcastImageUploadUrl,
  getBroadcastTemplateInfo,
  previewBroadcastAudience,
  sendMarketingBroadcast,
} from "@/lib/broadcasts.functions";

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

  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: templateInfo } = useQuery({
    queryKey: ["broadcast-template-info"],
    queryFn: () => templateInfoFn({ data: {} } as any),
    enabled: open,
    staleTime: 0,
  });
  const fixedText = templateInfo?.ok === true && templateInfo.variableCount === 0;

  const { data: audience, isLoading: audienceLoading } = useQuery({
    queryKey: ["broadcast-audience"],
    queryFn: () => previewFn({ data: {} } as any),
    enabled: open,
    staleTime: 60_000,
  });

  // The approved WhatsApp broadcast template carries an IMAGE header, so a
  // broadcast without an image is rejected by WhatsApp — block it here rather
  // than let it fail after the send.
  const imageOk = /^https:\/\/\S+$/i.test(imageUrl.trim());
  const disabled = useMemo(
    () => heading.trim().length === 0 || body.trim().length === 0 || !imageOk || uploading,
    [heading, body, imageOk, uploading],
  );

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
      toast.success("Image ready");
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
          heading: heading.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim(),
          ctaUrl: ctaUrl.trim() ? ctaUrl.trim() : null,
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
      setHeading("");
      setBody("");
      setImageUrl("");
      setCtaUrl("");
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
          {fixedText ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Your approved template sends fixed text — only the image changes.
              </p>
              {templateInfo?.ok === true && templateInfo.fixedBody ? (
                <p className="mt-1 whitespace-pre-line">“{templateInfo.fixedBody}”</p>
              ) : null}
              <p className="mt-1">
                Submit tag_broadcast_v3 (IMAGE header, body <span className="font-mono">*{"{{1}}"}*</span> then{" "}
                <span className="font-mono">{"{{2}}"}</span>, no buttons) to send custom wording — broadcasts switch
                to it automatically once approved.
              </p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="bc-heading">{fixedText ? "Heading (internal note)" : "Heading"}</Label>
            <Input
              id="bc-heading"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              maxLength={120}
              placeholder="Flash weekend sale"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bc-body">{fixedText ? "Message (internal note)" : "Message"}</Label>
            <Textarea
              id="bc-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="Hi {{name}}, this Saturday only — 30% off everything in-store."
            />
            <p className="text-[11px] text-muted-foreground">
              {body.length}/1000 characters
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="bc-image">Image (required)</Label>
              <Input
                id="bc-image"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                type="url"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground">
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                {uploading ? "Uploading…" : "Upload an image"}
                <input
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
              {!imageOk && imageUrl.trim().length > 0 ? (
                <p className="text-[11px] text-destructive">
                  Use a public https image link.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bc-cta">Link (optional)</Label>
              <Input
                id="bc-cta"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://…"
                type="url"
              />
            </div>
          </div>
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
              Confirm & send to {count}
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
