import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { getWorkspaceTier } from "@/lib/tier.functions";
import { hasFeature, type TierFeatureKey } from "@/lib/tier";
import { tierQueryKey } from "@/hooks/use-tier";

/**
 * beforeLoad helper: throws a redirect to /upgrade if the current workspace
 * does not have access to the requested feature.
 */
export async function requireFeature(
  queryClient: QueryClient,
  feature: TierFeatureKey,
): Promise<void> {
  const { tier } = await queryClient.ensureQueryData({
    queryKey: tierQueryKey,
    queryFn: () => getWorkspaceTier(),
    staleTime: 60_000,
  });
  if (!hasFeature(tier, feature)) {
    throw redirect({ to: "/upgrade", search: { feature } });
  }
}
