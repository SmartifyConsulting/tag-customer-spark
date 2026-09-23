import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUnreadWhatsAppCount } from "@/lib/inbox.functions";
import { useIsStaff } from "@/hooks/use-persona";

// Polled rather than pushed — good enough for a nav badge, and avoids a
// realtime subscription just for a count. Re-fetches on window focus too
// (react-query default), so it's fresh whenever someone comes back to the tab.
const POLL_MS = 30_000;

export function useUnreadWhatsAppCount(): number {
  const isStaff = useIsStaff();
  const fn = useServerFn(getUnreadWhatsAppCount);
  const { data } = useQuery({
    queryKey: ["unread-whatsapp-count"],
    queryFn: () => fn(),
    enabled: isStaff,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
  });
  return data?.count ?? 0;
}
