import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { listUserOutlets, listAllOutlets, addOutletToUser, removeOutletFromUser } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/ownership/outlets")({
  head: () => ({
    meta: [
      { title: "Outlets — Tag" },
      {
        name: "description",
        content: "Manage the stores and outlets you follow and visit.",
      },
    ],
  }),
  component: OutletsPage,
});

function OutletsPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const listUserFn = useServerFn(listUserOutlets);
  const { data: userOutlets, isLoading: userLoading, refetch: refetchUser } = useQuery({
    queryKey: ["user-outlets"],
    queryFn: () => listUserFn(),
  });

  const listAllFn = useServerFn(listAllOutlets);
  const { data: allOutlets, isLoading: allLoading } = useQuery({
    queryKey: ["all-outlets", searchQuery],
    queryFn: () => listAllFn({ data: { search: searchQuery || undefined } }),
    enabled: searchOpen && searchQuery.length > 0,
  });

  const addFn = useServerFn(addOutletToUser);
  const removeFn = useServerFn(removeOutletFromUser);

  async function handleAddOutlet(outletId: string) {
    try {
      await addFn({ data: { outlet_id: outletId } });
      await refetchUser();
      setSearchOpen(false);
      setSearchQuery("");
    } catch (e) {
      console.error("Failed to add outlet", e);
    }
  }

  async function handleRemoveOutlet(outletId: string) {
    try {
      await removeFn({ data: { outlet_id: outletId } });
      await refetchUser();
    } catch (e) {
      console.error("Failed to remove outlet", e);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outlets"
        description="Stores you follow and visit."
      />

      {/* Search Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search outlets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchOpen && searchQuery && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Registered Outlets</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
            >
              Close
            </Button>
          </div>

          {allLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : !allOutlets || allOutlets.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No outlets found. Try a different search.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allOutlets.map((outlet: any) => (
                <Card key={outlet.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{outlet.name}</div>
                      <div className="text-xs text-muted-foreground">{outlet.location}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddOutlet(outlet.id)}
                      className="gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Outlets */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">My Outlets</h3>

        {userLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : !userOutlets || userOutlets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <EmptyState
                icon={Search}
                title="No outlets yet"
                description="Search and add outlets to start tracking your visits."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {userOutlets.map((outlet: any) => (
              <Card key={outlet.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{outlet.name}</div>
                    <div className="text-xs text-muted-foreground">{outlet.location}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveOutlet(outlet.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
