import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Megaphone, Send, Users } from "lucide-react";
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

  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [confirm, setConfirm] = useState(false);

  const { data: audience, isLoading: audienceLoading } = useQuery({
    queryKey: ["broadcast-audience"],
    queryFn: () => previewFn({ data: {} } as any),
    enabled: open,
    staleTime: 60_000,
  });

  const disabled = useMemo(
    () => heading.trim().length === 0 || body.trim().length === 0,
    [heading, body],
  );

  const send = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          heading: heading.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
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

          <div className="grid gap-2">
            <Label htmlFor="bc-heading">Heading</Label>
            <Input
              id="bc-heading"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              maxLength={120}
              placeholder="Flash weekend sale"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bc-body">Message</Label>
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
              <Label htmlFor="bc-image">Image URL (optional)</Label>
              <Input
                id="bc-image"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                type="url"
              />
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
