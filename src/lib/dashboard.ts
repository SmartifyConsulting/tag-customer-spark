import { queryOptions } from "@tanstack/react-query";
import { getDashboardOverview } from "./dashboard.functions";
import { getAdvancedAnalytics } from "./analytics.functions";

export const dashboardOverviewQueryOptions = queryOptions({
  queryKey: ["dashboard", "overview"],
  queryFn: () => getDashboardOverview(),
  staleTime: 60_000,
});

export function advancedAnalyticsQueryOptions(days: number) {
  return queryOptions({
    queryKey: ["dashboard", "advanced-analytics", days],
    queryFn: () => getAdvancedAnalytics({ data: { days } }),
    staleTime: 60_000,
  });
}

