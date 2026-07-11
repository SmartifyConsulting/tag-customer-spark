import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Layers, GitMerge, X, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { browseTaxonomy, getActiveProfile, getProfile, listProfiles } from "@/lib/taxonomy.functions";
import { mergeTaxonomyGroups, isMergeableAttribute } from "@/lib/taxonomy-merge.functions";
import { cn } from "@/lib/utils";

const CHOSEN_PROFILE_KEY = "tag:taxonomy-browser-profile";

export function DynamicTaxonomyBrowser() {
  const qc = useQueryClient();
  const activeFn = useServerFn(getActiveProfile);
  const profileFn = useServerFn(getProfile);
  const profilesFn = useServerFn(listProfiles);
  const browseFn = useServerFn(browseTaxonomy);
  const mergeFn = useServerFn(mergeTaxonomyGroups);
  const [path, setPath] = useState<{ attribute_key: string; value: string; label: string }[]>([]);
  const [mergeMode, setMergeMode] = useState(false);
  const [target, setTarget] = useState<{ value: string; label: string; count: number } | null>(null);
  const [sources, setSources] = useState<Record<string, { label: string; count: number }>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  // Every user can pick which saved profile they browse with — independent
  // of whichever single profile an admin has "published" org-wide.
  const [chosenProfileId, setChosenProfileId] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(CHOSEN_PROFILE_KEY) : null,
  );

  const profilesQ = useQuery({ queryKey: ["taxonomy-profiles-list"], queryFn: () => profilesFn() });
  const activeQ = useQuery({ queryKey: ["taxonomy-active"], queryFn: () => activeFn(), enabled: !chosenProfileId });
  const chosenQ = useQuery({
    queryKey: ["taxonomy-profile", chosenProfileId],
    queryFn: () => profileFn({ data: { id: chosenProfileId! } }),
    enabled: !!chosenProfileId,
  });

  // Once we know the org's active profile, adopt it as the default choice
  // (without overriding whatever the user has already picked).
  useEffect(() => {
    if (chosenProfileId || !activeQ.data?.profile?.id) return;
    setChosenProfileId(activeQ.data.profile.id);
  }, [chosenProfileId, activeQ.data]);

  const handleProfileChange = (id: string) => {
    setChosenProfileId(id);
    window.localStorage.setItem(CHOSEN_PROFILE_KEY, id);
    setPath([]);
  };

  const profileId = chosenProfileId ?? activeQ.data?.profile?.id;
  const activeProfileName = chosenProfileId
    ? profilesQ.data?.profiles?.find((p: any) => p.id === chosenProfileId)?.name
    : activeQ.data?.profile?.name;
  const levels = (chosenProfileId ? chosenQ.data?.levels : activeQ.data?.levels) ?? [];

  const key = useMemo(
    () => JSON.stringify({ profileId, path: path.map((p) => ({ a: p.attribute_key, v: p.value })) }),
    [profileId, path],
  );

  const q = useQuery({
    queryKey: ["taxonomy-browse", key],
    queryFn: () =>
      browseFn({
        data: {
          profileId: profileId!,
          path: path.map((p) => ({ attribute_key: p.attribute_key, value: p.value })),
        },
      }),
    enabled: !!profileId && levels.length > 0,
  });

  const resetMerge = () => {
    setTarget(null);
    setSources({});
  };
  const exitMerge = () => {
    setMergeMode(false);
    resetMerge();
  };

  const initializing = chosenProfileId ? chosenQ.isLoading && !chosenQ.data : activeQ.isLoading;
  if (initializing) return <Skeleton className="h-40 w-full" />;

  if (!profileId || levels.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No taxonomy profile configured"
        description="An administrator can build one under Admin → Taxonomy Engine."
      />
    );
  }

  const currentLevel = levels[path.length];
  const canMerge =
    !!currentLevel &&
    isMergeableAttribute(currentLevel.attribute_key) &&
    (q.data?.groups?.length ?? 0) >= 2;

  const sourceCount = Object.keys(sources).length;
  const sourceProductCount = Object.values(sources).reduce((n, s) => n + s.count, 0);

  const handleGroupClick = (g: any) => {
    if (!mergeMode) {
      setPath((cur) => [
        ...cur,
        { attribute_key: currentLevel!.attribute_key, value: g.value, label: g.label },
      ]);
      return;
    }
    if (!target) {
      setTarget({ value: g.value, label: g.label, count: g.count });
      return;
    }
    if (g.value === target.value) return;
    setSources((cur) => {
      const next = { ...cur };
      if (next[g.value]) delete next[g.value];
      else next[g.value] = { label: g.label, count: g.count };
      return next;
    });
  };

  const doMerge = async () => {
    if (!target || sourceCount === 0 || !currentLevel) return;
    setMerging(true);
    try {
      const res = await mergeFn({
        data: {
          attribute_key: currentLevel.attribute_key as any,
          target_value: target.value,
          source_values: Object.keys(sources),
        },
      });
      toast.success(`Merged ${sourceCount} section${sourceCount === 1 ? "" : "s"} into "${target.label}" (${res.updated} products)`);
      exitMerge();
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["taxonomy-browse"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  return (
    <Card className="rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1 text-sm">
        {(profilesQ.data?.profiles?.length ?? 0) > 1 ? (
          <Select value={profileId ?? undefined} onValueChange={handleProfileChange}>
            <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs uppercase tracking-wide text-muted-foreground shadow-none">
              <SelectValue placeholder="Profile" />
            </SelectTrigger>
            <SelectContent>
              {profilesQ.data!.profiles.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{activeProfileName}</span>
        )}
        <span className="mx-2 text-muted-foreground">·</span>
        <button
          onClick={() => setPath([])}
          className="rounded px-2 py-1 font-medium hover:bg-accent"
        >
          All
        </button>
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              onClick={() => setPath((cur) => cur.slice(0, i + 1))}
              className="rounded px-2 py-1 hover:bg-accent"
            >
              {p.label}
            </button>
          </span>
        ))}
        {currentLevel && (
          <>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              Grouped by <span className="font-medium">{currentLevel.label}</span>
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canMerge && !mergeMode && (
            <Button size="sm" variant="outline" onClick={() => setMergeMode(true)} className="gap-1.5">
              <GitMerge className="h-3.5 w-3.5" /> Merge sections
            </Button>
          )}
          {mergeMode && (
            <Button size="sm" variant="ghost" onClick={exitMerge} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {mergeMode && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
          {!target ? (
            <span className="text-muted-foreground">
              Step 1 — click the section you want to <b>keep</b> (the target).
            </span>
          ) : (
            <>
              <span className="text-muted-foreground">Target:</span>
              <Badge className="bg-accent text-white">{target.label}</Badge>
              <button onClick={resetMerge} className="text-xs text-muted-foreground underline hover:text-foreground">
                Change target
              </button>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {sourceCount === 0
                  ? "Now select sections to merge into it."
                  : `${sourceCount} section${sourceCount === 1 ? "" : "s"} selected (${sourceProductCount} products).`}
              </span>
              <div className="ml-auto">
                <Button
                  size="sm"
                  disabled={sourceCount === 0}
                  onClick={() => setConfirmOpen(true)}
                  className="bg-accent text-white hover:bg-accent/90 gap-1.5"
                >
                  <GitMerge className="h-3.5 w-3.5" /> Merge into "{target.label}"
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {q.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : q.data?.products && q.data.products.length > 0 ? (
        <ul className="divide-y rounded-xl border">
          {q.data.products.map((p: any) => (
            <li key={p.id}>
              <Link
                to="/products/$productId"
                params={{ productId: p.id }}
                className="flex items-center gap-3 px-3 py-2 hover:bg-accent"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[p.brand, p.category, p.sku].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {p.stock_qty != null && (
                  <Badge variant="outline">{p.stock_qty} qty</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : q.data?.groups && q.data.groups.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.groups.map((g: any) => {
            const isTarget = mergeMode && target?.value === g.value;
            const isSource = mergeMode && !!sources[g.value];
            return (
              <li key={g.value}>
                <button
                  onClick={() => handleGroupClick(g)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border bg-card px-3 py-3 text-left transition hover:bg-accent/40",
                    isTarget && "border-accent ring-2 ring-accent bg-accent/10",
                    isSource && "border-accent/60 bg-accent/5",
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {mergeMode && (
                      <span
                        className={cn(
                          "grid h-4 w-4 shrink-0 place-items-center rounded border",
                          isTarget || isSource ? "bg-accent border-accent text-white" : "border-muted-foreground/40",
                        )}
                      >
                        {(isTarget || isSource) && <Check className="h-3 w-3" />}
                      </span>
                    )}
                    <span className="truncate font-medium">{g.label}</span>
                    {isTarget && <Badge className="bg-accent text-white text-[10px]">Target</Badge>}
                  </span>
                  <Badge variant="secondary">{g.count}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={Layers}
          title="No products at this level"
          description="Try a different branch of the hierarchy."
        />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Merge {sourceCount} section{sourceCount === 1 ? "" : "s"} into "{target?.label}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sourceProductCount} product{sourceProductCount === 1 ? "" : "s"} will be re-assigned to{" "}
              <b>{target?.label}</b>. The emptied sections will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={merging}
              onClick={(e) => {
                e.preventDefault();
                void doMerge();
              }}
              className="bg-accent text-white hover:bg-accent/90"
            >
              {merging ? "Merging…" : "Merge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
