import { useEffect, useState } from "react";

// One-time-per-user, per-page navigational tips. Once a tour is finished or
// skipped it's marked seen in localStorage under the signed-in user's id and
// never shown again — there's deliberately no "replay" affordance.
function storageKey(userId: string, tourKey: string) {
  return `tag_tour_seen:${userId}:${tourKey}`;
}

export function useOnboardingTour(userId: string | undefined, tourKey: string) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const seen = localStorage.getItem(storageKey(userId, tourKey)) === "1";
    setDismissed(seen);
  }, [userId, tourKey]);

  const dismiss = () => {
    if (userId) localStorage.setItem(storageKey(userId, tourKey), "1");
    setDismissed(true);
  };

  return { show: !!userId && !dismissed, dismiss };
}
