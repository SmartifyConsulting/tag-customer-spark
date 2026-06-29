import { queryOptions } from "@tanstack/react-query";
import { getDashboardOverview } from "./dashboard.functions";

export const dashboardOverviewQueryOptions = queryOptions({
  queryKey: ["dashboard", "overview"],
  queryFn: () => getDashboardOverview(),
  staleTime: 60_000,
});
