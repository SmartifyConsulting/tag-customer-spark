import { useState } from "react";
import { motion } from "framer-motion";
import PhoneInput from "react-phone-number-input";
import { isValidPhoneNumber } from "libphonenumber-js";
import { CheckCircle2, Loader2, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import "react-phone-number-input/style.css";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shortCode: string;
  productName: string;
  retailerName: string;
};

export function NotifySheet(props: Props) {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.matchMedia("(min-width: 640px)").matches : false,
  );
  if (typeof window !== "undefined") {
    const mql = window.matchMedia("(min-width: 640px)");
    mql.addEventListener?.("change", (e) => setIsDesktop(e.matches));
  }

  const Body = <NotifyForm {...props} />;

  if (isDesktop) {
    return (
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Get notified on WhatsApp</DialogTitle>
            <DialogDescription>
              We'll ping you only about <span className="font-medium">{props.productName}</span>.
            </DialogDescription>
          </DialogHeader>
          {Body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={props.open} onOpenChange={props.onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Get notified on WhatsApp</DrawerTitle>
          <DrawerDescription>
            We'll ping you only about <span className="font-medium">{props.productName}</span>.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">{Body}</div>
      </DrawerContent>
    </Drawer>
  );
}

function NotifyForm({
  shortCode,
  productName,
  retailerName,
  onOpenChange,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
  const [notify, setNotify] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneOk = phone && isValidPhoneNumber(phone);
  const canSubmit = name.trim().length > 0 && phoneOk && notify && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/scan/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortCode,
          name: name.trim(),
          whatsapp: phone,
          notifyConsent: true,
          marketingConsent: marketing,
          privacyAccepted: privacy,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Something went wrong");
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center py-6"
      >
        <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)]">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold">You're on the list</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          {retailerName} will WhatsApp you when {productName} goes on sale, restocks, or gets a promo.
        </p>
        <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoFocus
          maxLength={120}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>WhatsApp number</Label>
        <div className="rounded-md border border-input bg-background px-3 py-2 [&_.PhoneInput]:flex [&_.PhoneInputCountry]:mr-2 [&_input]:bg-transparent [&_input]:outline-none [&_input]:flex-1 [&_input]:text-sm">
          <PhoneInput
            defaultCountry="ZA"
            international
            placeholder="Enter phone number"
            value={phone}
            onChange={setPhone}
          />
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox checked={notify} onCheckedChange={(v) => setNotify(Boolean(v))} className="mt-0.5" />
          <span>
            <span className="font-medium">Notify me on WhatsApp</span> about this product.
            <span className="block text-xs text-muted-foreground">Required to opt in.</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(Boolean(v))} className="mt-0.5" />
          <span>
            I'd like occasional marketing updates from {retailerName}.
            <span className="block text-xs text-muted-foreground">Optional.</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox checked={privacy} onCheckedChange={(v) => setPrivacy(Boolean(v))} className="mt-0.5" />
          <span>
            I've read the privacy notice.
            <span className="block text-xs text-muted-foreground">Optional but appreciated.</span>
          </span>
        </label>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={!canSubmit} className="w-full h-11 text-base">
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <MessageCircle className="mr-2 h-4 w-4" />
            Notify me
          </>
        )}
      </Button>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground justify-center">
        <ShieldCheck className="h-3 w-3" /> Secure · No spam · Unsubscribe anytime
      </p>
      <p className="hidden">
        <Sparkles className="h-3 w-3" />
      </p>
    </form>
  );
}
