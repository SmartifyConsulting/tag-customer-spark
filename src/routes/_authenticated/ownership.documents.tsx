import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, FileText, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ownership/shared";
import { listOwnershipDocuments } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/ownership/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Tag Ownership" },
      {
        name: "description",
        content: "Manuals, invoices and warranty certificates for everything you own, in one place.",
      },
      { property: "og:title", content: "Documents — Tag Ownership" },
      {
        property: "og:description",
        content: "Manuals, invoices and warranty certificates for everything you own, in one place.",
      },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const [query, setQuery] = useState("");
  const listFn = useServerFn(listOwnershipDocuments);
  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "documents"],
    queryFn: () => listFn(),
  });

  const documents = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = ((data as any[]) ?? []).filter((d) => {
      if (!term) return true;
      return [d.title, d.kind, d.product?.name, d.product?.brand]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    return rows;
  }, [data, query]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Manuals, invoices, warranty certificates and service notes — attached to the products they belong to."
      />

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents or products"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No documents yet. Upload manuals or invoices from a product in{" "}
            <Link to="/ownership/products" className="underline">
              My Products
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {documents.map((d: any) => (
            <Card key={d.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.title ?? "Document"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.product ? (
                      <Link
                        to="/ownership/products/$productId"
                        params={{ productId: d.product.id }}
                        className="hover:underline"
                      >
                        {d.product.name}
                      </Link>
                    ) : (
                      "Unlinked"
                    )}
                    {d.created_at ? ` · ${new Date(d.created_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                {d.kind && <StatusBadge tone="info">{String(d.kind).replace(/_/g, " ")}</StatusBadge>}
                {d.file_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={d.file_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-4 w-4" /> Open
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
