import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Home, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { exportExcel } from "@/components/ownership/export";
import { OwnedCard } from "./ownership.products.index";
import { exportInventory, listOwnedProducts, upsertRoom } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/ownership/household")({
  head: () => ({
    meta: [
      { title: "Household — Tag Ownership" },
      {
        name: "description",
        content: "Everything you own organised by room — for insurance, moving and estate planning.",
      },
    ],
  }),
  component: HouseholdPage,
});

function HouseholdPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOwnedProducts);
  const roomFn = useServerFn(upsertRoom);
  const exportFn = useServerFn(exportInventory);
  const [newRoom, setNewRoom] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["ownership", "owned"], queryFn: () => listFn() });

  const addRoom = useMutation({
    mutationFn: () => roomFn({ data: { name: newRoom.trim(), sortOrder: 99 } }),
    onSuccess: () => {
      toast.success("Room added");
      setNewRoom("");
      qc.invalidateQueries({ queryKey: ["ownership", "owned"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not add the room"),
  });

  const rooms = ((data as any)?.rooms ?? []) as any[];
  const products = ((data as any)?.products ?? []) as any[];

  const byRoom = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of products) {
      const key = p.room?.id ?? "unassigned";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [products]);

  const totalValue = products.reduce(
    (s, p) => s + (p.current_value_cents ?? p.purchase_price_cents ?? 0),
    0,
  );

  const sections = [
    ...rooms.map((r) => ({ id: r.id, name: r.name, items: byRoom.get(r.id) ?? [] })),
    { id: "unassigned", name: "Unassigned", items: byRoom.get("unassigned") ?? [] },
  ].filter((s) => s.items.length > 0 || s.id !== "unassigned");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Household"
        description="A living room-by-room inventory of everything owned."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={async () =>
              exportExcel((await exportFn()) as any[], "tag-household.xlsx", "Household")
            }
          >
            <Download className="mr-1.5 h-4 w-4" /> Insurance export
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Rooms" value={String(rooms.length)} />
        <StatCard label="Items owned" value={String(products.length)} />
        <StatCard label="Household value" value={formatMoney(totalValue)} />
      </div>

      <div className="flex max-w-md gap-2">
        <Input placeholder="Add a room (e.g. Garage)" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} />
        <Button size="sm" disabled={newRoom.trim().length < 2 || addRoom.isPending} onClick={() => addRoom.mutate()}>
          <Plus className="mr-1.5 h-4 w-4" /> Add
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        sections.map((s) => (
          <section key={s.id} className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Home className="h-4 w-4" /> {s.name} · {s.items.length}
            </h2>
            {s.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing assigned to this room yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {s.items.map((p) => (
                  <OwnedCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
