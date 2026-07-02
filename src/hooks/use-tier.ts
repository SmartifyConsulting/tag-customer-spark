import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTier } from "@/lib/tier.functions";
import { hasFeature as _hasFeature, type TagTier, type TierFeatureKey } from "@/lib/tier";
import { useAuth } from "@/hooks/use-auth";

export const tierQueryKey = ["workspace-tier"] as const;

export function useTier() {
  const { session } = useAuth();
  const q = useQuery({
    queryKey: tierQueryKey,
    queryFn: () => getWorkspaceTier(),
    staleTime: 60_000,
    enabled: !!session,
    retry: false,
  });
  const tier: TagTier = (q.data?.tier ?? "starter") as TagTier;
  return {
    tier,
    isLoading: q.isLoading,
    hasFeature: (f: TierFeatureKey) => _hasFeature(tier, f),
  };
}
