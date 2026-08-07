import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Nfc, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QrPreview, useQrPngDownload } from "@/components/qr/qr-preview";
import { Barcode } from "@/components/ownership/shared";
import { getTagIdentity } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/ownership/tag-id")({
  head: () => ({
    meta: [
      { title: "TAG ID — Tag Ownership" },
      {
        name: "description",
        content: "A permanent shopper identifier scanned at checkout. No personal data inside the code.",
      },
    ],
  }),
  component: TagIdPage,
});

function TagIdPage() {
  const getFn = useServerFn(getTagIdentity);
  const { data, isLoading } = useQuery({ queryKey: ["ownership", "tag"], queryFn: () => getFn() });
  const tag = data as any;
  const value = tag?.tag_id ?? "";
  const download = useQrPngDownload(value, `${value || "tag-id"}.png`);

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="TAG ID"
        description="A permanent identifier that links a shopper to every purchase they make — at any retailer."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <QrPreview value={value} size={220} />
            <p className="font-mono text-2xl font-semibold tracking-[0.2em]">{value}</p>
            <div className="w-full">
              <Barcode value={value} />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(value);
                  toast.success("TAG ID copied");
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => download()}>
                <ScanLine className="mr-1.5 h-4 w-4" /> PNG
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>How it works at checkout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                The cashier scans this QR or barcode before payment. The purchase is written to the
                shopper's ownership record — no paper receipt required.
              </p>
              <p>
                The code carries only the TAG ID. No name, phone number, address or payment detail is
                ever encoded, so a photographed code reveals nothing personal.
              </p>
              <p className="flex items-center gap-2 text-foreground">
                <Nfc className="h-4 w-4" /> NFC identifier:{" "}
                <span className="font-mono">tag:{value.toLowerCase()}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Household</p>
                <p className="font-medium">{tag?.display_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Issued</p>
                <p className="font-medium">
                  {tag?.created_at ? new Date(tag.created_at).toLocaleDateString() : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
