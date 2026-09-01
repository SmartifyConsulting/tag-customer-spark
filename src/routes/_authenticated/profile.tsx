import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ScanLine, Upload, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QrPreview, useQrPngDownload } from "@/components/qr/qr-preview";
import { Barcode } from "@/components/tag-barcode";
import { getMyShopperTag } from "@/lib/tag-identity.functions";
import { getMyProfile, updateMyProfile, uploadMyAvatar } from "@/lib/profile.functions";
import { useAuth } from "@/hooks/use-auth";
import { useIsStaff } from "@/hooks/use-persona";

const AVATAR_MIME = new Set(["image/png", "image/webp", "image/jpeg"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : "")).toUpperCase();
}

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Profile — Tag" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const isStaff = useIsStaff();
  const qc = useQueryClient();
  const getProfileFn = useServerFn(getMyProfile);
  const updateProfileFn = useServerFn(updateMyProfile);
  const uploadAvatarFn = useServerFn(uploadMyAvatar);
  const getTagFn = useServerFn(getMyShopperTag);

  const { data, isLoading } = useQuery({ queryKey: ["profile", "me"], queryFn: () => getProfileFn() });
  const tag = useQuery({ queryKey: ["my-tag"], queryFn: () => getTagFn() });

  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    const p = (data as any)?.profile;
    if (p) {
      setFullName(p.full_name ?? "");
      setWhatsapp(p.whatsapp_e164 ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateProfileFn({ data: { fullName, whatsappE164: whatsapp } }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
      qc.invalidateQueries({ queryKey: ["tagged"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarUrl = (data as any)?.profile?.avatar_url ?? null;

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Couldn't read that file — please try again."));
        r.readAsDataURL(file);
      });
      return uploadAvatarFn({
        data: { filename: file.name, contentType: file.type, base64 },
      });
    },
    onSuccess: () => {
      toast.success("Profile picture updated");
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Couldn't upload that photo — please try again.");
    },
    onSettled: () => setAvatarUploading(false),
  });

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!AVATAR_MIME.has(file.type)) {
      toast.error("Please choose a PNG, JPG or WEBP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("That photo is too large — please choose one under 2 MB.");
      return;
    }
    setAvatarUploading(true);
    uploadAvatar.mutate(file);
  };

  const tagValue = (tag.data as any)?.tagId ?? "";
  const download = useQrPngDownload(tagValue, `${tagValue || "tag-id"}.png`);

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-8">
      <PageHeader title="Profile" description="Your details, your TAG ID, and your subscription." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Used to identify you and link items you've tagged in-store.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-[#F94300] ring-offset-2 ring-offset-background">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName || "Profile picture"} />}
                <AvatarFallback className="bg-[#F94300] text-base font-semibold text-white">
                  {fullName ? initialsFor(fullName) : <UserIcon className="h-6 w-6" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onPickAvatar}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {avatarUploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add photo"}
                </Button>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  PNG, JPG or WEBP · max 2 MB
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp number</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+27821234567"
              />
              <p className="text-xs text-muted-foreground">
                Matches items you've tagged in-store to your account.
              </p>
            </div>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TAG ID</CardTitle>
            <CardDescription>Scanned at checkout to link a purchase to you.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 p-6">
            {tag.isLoading ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : tagValue ? (
              <>
                <QrPreview value={tagValue} size={160} />
                <p className="font-mono text-lg font-semibold tracking-[0.2em]">{tagValue}</p>
                <div className="w-full">
                  <Barcode value={tagValue} />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(tagValue);
                      toast.success("TAG ID copied");
                    }}
                  >
                    <Copy className="mr-1.5 h-4 w-4" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => download()}>
                    <ScanLine className="mr-1.5 h-4 w-4" /> PNG
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your TAG ID is issued the first time a purchase is recorded against your account.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Billing &amp; subscription</CardTitle>
            <CardDescription>
              {isStaff ? "Your retailer's TAG plan." : "TAG is free for shoppers — always."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isStaff ? (
              <p className="text-sm text-muted-foreground">
                Manage your retailer's plan and billing from Business → Pricing.
              </p>
            ) : (
              <Badge variant="secondary" className="text-sm">
                Free for customers
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
