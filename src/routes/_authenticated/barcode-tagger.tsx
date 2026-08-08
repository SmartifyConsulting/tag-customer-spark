import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QrPreview, useQrPngDownload } from "@/components/qr/qr-preview";
import { Barcode } from "@/components/ownership/shared";
import { getMyShopperTag } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/barcode-tagger")({
  head: () => ({
    meta: [
      { title: "My Tag — Tag" },
      {
        name: "description",
        content:
          "Your personal shopper QR code and barcode, generated when you signed up. Scan it at checkout.",
      },
      { property: "og:title", content: "My Tag — Tag" },
      {
        property: "og:description",
        content: "Your personal shopper QR code and barcode, generated when you signed up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BarcodeTaggerPage,
});

function BarcodeTaggerPage() {
  const tagFn = useServerFn(getMyShopperTag);
  const { data: myTag, isLoading } = useQuery({
    queryKey: ["my-shopper-tag"],
    queryFn: () => tagFn(),
  });

  const tagId = (myTag as any)?.tagId ?? "";
  const email = (myTag as any)?.email as string | undefined;
  // The QR carries only the tag ID and the account email — nothing else.
  const qrValue = tagId ? JSON.stringify({ tagId, email: email ?? undefined }) : "";
  const download = useQrPngDownload(qrValue, `${tagId || "my-tag"}.png`);

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Tag"
        description="Your personal code, generated when you signed up. Show it at checkout to link a purchase to you."
      />

      {!tagId ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Your shopper tag isn't ready yet. Refresh in a moment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <QrPreview value={qrValue} size={220} />
              <p className="font-mono text-xl font-semibold tracking-[0.15em]">{tagId}</p>
              {email && <p className="text-sm text-muted-foreground">{email}</p>}
              <div className="w-full">
                <Barcode value={tagId} />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(tagId);
                    toast.success("Tag ID copied");
                  }}
                >
                  <Copy className="mr-1.5 h-4 w-4" /> Copy
                </Button>
                <Button size="sm" variant="outline" onClick={() => download()}>
                  <Download className="mr-1.5 h-4 w-4" /> PNG
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Looking to scan a product?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  The camera lives on the Scanner tab, so it only runs while you're actually
                  scanning — never in the background.
                </p>
                <Button asChild size="sm">
                  <Link to="/tagged">
                    <ScanLine className="mr-1.5 h-4 w-4" /> Open Scanner
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>How it works at checkout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  The cashier scans this QR or barcode before payment, and the purchase is written
                  straight to your ownership record — no paper receipt required.
                </p>
                <p>
                  The code carries only your tag ID and account email. No phone number, address or
                  payment detail is ever encoded.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
