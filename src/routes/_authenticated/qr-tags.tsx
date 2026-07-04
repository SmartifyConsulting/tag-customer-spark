import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { QrCode, Search, Download, MoreHorizontal, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import QRCode from "qrcode";
import { listQrTagsRegistry, toggleTagStatus } from "@/lib/qr-tags.functions";

export const Route = createFileRoute("/_authenticated/qr-tags")({
  head: () => ({ meta: [{ title: "QR Tags — Tag" }] }),
  component: QrTagsPage,
});

function QrTagsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const list = useQuery({
    queryKey: ["qrtags", search, status],
    queryFn: () => listQrTagsRegistry({ data: { search, status } }),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleTagStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qrtags"] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rows = (list.data?.rows ?? []) as any[];
  const totals = list.data?.totals ?? { active: 0, inactive: 0, scans: 0 };
  const uniqueProducts = useMemo(
    () => new Set(rows.map((r) => r.product?.id).filter(Boolean)).size,
    [rows],
  );

  const scanBase =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/s` : "/api/public/s";

  async function downloadPng(shortCode: string) {
    try {
      const url = `${scanBase}/${shortCode}`;
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        errorCorrectionLevel: "M",
        width: 800,
        color: { dark: "#031C4D", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-${shortCode}.png`;
      a.click();
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Tags"
        description="Create, manage and download QR codes."
        actions={
          <Link to="/products">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Generate QR
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Total QR Codes" value={totals.active + totals.inactive} />
        <Tile label="Scans This Month" value={totals.scans} />
        <Tile label="Unique Products" value={uniqueProducts} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search QR codes…"
            className="h-11 rounded-xl border-border bg-card pl-10 text-sm"
          />
        </div>
        <Select value="all">
          <SelectTrigger className="h-11 w-[150px] rounded-xl border-border bg-card text-sm font-medium">
            <SelectValue placeholder="All Stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="h-11 w-[150px] rounded-xl border-border bg-card text-sm font-medium">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10">
              <EmptyState
                icon={QrCode}
                title="No QR tags yet"
                description="Generate tags from the Products page."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((t) => (
                <li
                  key={t.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {t.product?.image_url ? (
                      <img
                        src={t.product.image_url}
                        className="h-11 w-11 rounded-lg object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="grid h-11 w-11 place-items-center rounded-lg bg-muted">
                        <QrCode className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {t.product?.name ?? "Product"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        #TAG-{String(t.short_code).toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {t.scans_total} scans
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => downloadPng(t.short_code)}
                    aria-label="Download QR"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-9 w-9">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          toggle.mutate({ id: t.id, is_active: !t.is_active })
                        }
                      >
                        <Switch checked={t.is_active} className="mr-2 scale-75" />
                        {t.is_active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      {t.product?.id && (
                        <DropdownMenuItem asChild>
                          <Link
                            to="/products/$productId"
                            params={{ productId: t.product.id }}
                          >
                            Open product
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        {rows.length > 0 && (
          <div className="border-t border-border py-3 text-center">
            <Link
              to="/products"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all QR codes
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-primary">
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
