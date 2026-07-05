import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCustomer, updateCustomer } from "@/lib/customers.functions";

type Initial = {
  id?: string;
  full_name?: string | null;
  whatsapp_e164?: string | null;
  email?: string | null;
  status?: "subscribed" | "unsubscribed" | "blocked";
  marketing_consent_at?: string | null;
  notify_consent_at?: string | null;
};

export function CustomerFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Initial;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(initial?.id);
  const createFn = useServerFn(createCustomer);
  const updateFn = useServerFn(updateCustomer);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"subscribed" | "unsubscribed" | "blocked">("subscribed");
  const [marketing, setMarketing] = useState(false);
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (!open) return;
    setFullName(initial?.full_name ?? "");
    setPhone(initial?.whatsapp_e164 ?? "");
    setEmail(initial?.email ?? "");
    setStatus((initial?.status as any) ?? "subscribed");
    setMarketing(Boolean(initial?.marketing_consent_at));
    setNotify(initial?.notify_consent_at != null || !isEdit);
  }, [open, initial, isEdit]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: fullName.trim() || null,
        whatsapp_e164: phone.trim(),
        email: email.trim() || null,
        status,
        marketing_consent: marketing,
        notify_consent: notify,
      };
      if (isEdit && initial?.id) {
        await updateFn({ data: { id: initial.id, patch: payload as any } });
      } else {
        await createFn({ data: payload as any });
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Customer updated" : "Customer added");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            Manage this shopper's contact details and consent.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="grid gap-1.5">
            <Label>WhatsApp number *</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+27821234567"
              inputMode="tel"
            />
            <p className="text-[11px] text-muted-foreground">International format, e.g. +27821234567</p>
          </div>
          <div className="grid gap-1.5">
            <Label>Email (optional)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="jane@example.com" />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="subscribed">Subscribed</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Notifications</p>
              <p className="text-xs text-muted-foreground">Allow price / stock alerts</p>
            </div>
            <Switch checked={notify} onCheckedChange={setNotify} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Marketing consent</p>
              <p className="text-xs text-muted-foreground">Allow promotional messages</p>
            </div>
            <Switch checked={marketing} onCheckedChange={setMarketing} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !phone.trim()}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Add customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
