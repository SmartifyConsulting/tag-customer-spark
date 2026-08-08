import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReceiptsEnabled } from "@/lib/system-settings.functions";

export function useReceiptsEnabled() {
  const fn = useServerFn(getReceiptsEnabled);
  const query = useQuery({ queryKey: ["system-settings", "receipts_enabled"], queryFn: () => fn() });
  // Default to enabled while loading so the page doesn't flash a disabled
  // state on every load — the guard only matters once we know it's off.
  return { enabled: query.data ?? true, isLoading: query.isLoading };
}
