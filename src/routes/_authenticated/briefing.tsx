import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MessageSquare, PackageOpen, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { briefingQueryOptions } from "@/lib/dashboard";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/briefing")({
  head: () => ({ meta: [{ title: "Briefing — Tag" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(briefingQueryOptions),
  component: BriefingPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <p className="text-destructive">Could not load your briefing: {error.message}</p>
      <button className="mt-3 underline" onClick={reset}>
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <p className="p-6">Not found.</p>,
});

function BriefingPage() {
  const { user } = useAuth();
  const { data } = useSuspenseQuery(briefingQueryOptions);
  const first = user?.user_metadata?.full_name?.split(" ")?.[0] ?? "there";
  const greeting = data.greetingName ?? first;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hello ${greeting}`}
        description="Your daily briefing — freshly tagged products this month, and shoppers waiting on a reply."
      />


      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <PackageOpen className="h-4 w-4" /> Tagged products
              </h2>
              <span className="text-xs text-muted-foreground">
                {data.totalTagged} product{data.totalTagged === 1 ? "" : "s"} this year
              </span>
            </div>
            {data.buckets.length === 0 ? (
              <EmptyState
                icon={PackageOpen}
                title="No tagged products yet"
                description="Products appear here once they've been assigned a GTIN and QR code."
              />
            ) : (
              <Accordion type="multiple" className="w-full">
                {data.buckets.map((b) => (
                  <AccordionItem key={b.key} value={b.key}>
                    <AccordionTrigger className="text-sm">
                      <span className="flex-1 text-left font-medium">{b.label}</span>
                      <Badge variant="secondary" className="ml-2 mr-3">
                        {b.products.length}
                      </Badge>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="divide-y">
                        {b.products.map((p) => (
                          <li key={p.id}>
                            <Link
                              to="/admin/inventory/$productId"
                              params={{ productId: p.id }}
                              className="flex items-center gap-3 px-1 py-2 hover:bg-muted/40"
                            >
                              {p.image_url ? (
                                <img
                                  src={p.image_url}
                                  alt=""
                                  className="h-9 w-9 rounded object-cover"
                                />
                              ) : (
                                <div className="grid h-9 w-9 place-items-center rounded bg-muted">
                                  <ScanLine className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{p.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {p.gtin ?? "no GTIN"} ·{" "}
                                  {new Date(p.tagged_at).toLocaleDateString()}
                                </p>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <MessageSquare className="h-4 w-4" /> Unread WhatsApps
              </h2>
              <Link to="/inbox" className="text-xs text-muted-foreground hover:underline">
                Open inbox →
              </Link>
            </div>
            {data.unread.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="Inbox zero"
                description="No shoppers waiting on a reply. Nice work."
              />
            ) : (
              <ul className="divide-y">
                {data.unread.map((c) => (
                  <li key={c.conversation_id}>
                    <Link
                      to="/inbox"
                      className="flex items-start gap-3 py-3 hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className="truncate">
                            {c.customer_name || c.customer_phone || "Unknown"}
                          </span>
                          <Badge className="ml-auto shrink-0">{c.unread_count}</Badge>
                        </p>
                        {c.last_message && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {c.last_message}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(c.last_message_at).toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
