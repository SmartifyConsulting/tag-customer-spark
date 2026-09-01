import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export type OnboardingTip = {
  id: string;
  title: string;
  body: string;
  target?: string;
  cta?: { label: string; action: () => void };
};

const SCREEN_TIPS: Record<string, OnboardingTip[]> = {
  "/dashboard": [
    {
      id: "dashboard-intro",
      title: "Welcome to Tag 👋",
      body: "Your dashboard shows real-time insights from customer scans and engagement. The Intent Score on the right shows which products customers are most interested in.",
    },
    {
      id: "dashboard-metrics",
      title: "Key Metrics",
      body: "Track scans, revenue recovered, and customer interactions all in one place. Click any metric to dive deeper into the data.",
    },
  ],
  "/products": [
    {
      id: "products-intro",
      title: "Your Product Inventory",
      body: "All your products are listed here. Click any product to edit details, add images, or set prices. Products marked as 'tagged' have been scanned at least once by a customer.",
    },
    {
      id: "products-filters",
      title: "Filter Your Products",
      body: "Use the filter buttons to view all products, or focus on tagged/untagged items. You can also sort by name, price, or stock levels.",
    },
  ],
  "/admin/customers": [
    {
      id: "customers-intro",
      title: "Your Customer Connections",
      body: "Every person who scans your QR codes appears here. You can view their purchase history, see what they're interested in, send them targeted campaigns, and add notes.",
    },
  ],
  "/admin/inventory": [
    {
      id: "inventory-intro",
      title: "Manage Your Inventory",
      body: "Upload your product catalog to get started. Use the search and filters to find exactly what you need. Once products are scanned by customers, they'll appear here.",
    },
  ],
  "/intelligence": [
    {
      id: "intelligence-intro",
      title: "AI-Powered Insights",
      body: "The Intelligence Engine analyzes customer behavior to identify trends, opportunities, and at-risk products. Use these insights to optimize your inventory and campaigns.",
    },
  ],
  "/settings": [
    {
      id: "settings-intro",
      title: "Configure Your Workspace",
      body: "Manage your team members, integrations, billing, and workspace settings. Invite staff to collaborate on Tag.",
    },
  ],
};

export function useOnboardingTips(currentPath: string) {
  const { user } = useAuth();
  const [seenTips, setSeenTips] = useState<Set<string>>(new Set());
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const storageKey = `tag-onboarding-${user?.id ?? "unknown"}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setSeenTips(new Set(JSON.parse(stored)));
      } catch {
        // Ignore parse errors
      }
    }
  }, [storageKey]);

  const tips = SCREEN_TIPS[currentPath] || [];
  const unseenTips = tips.filter((t) => !seenTips.has(t.id));

  const markTipAsSeen = (tipId: string) => {
    const updated = new Set(seenTips);
    updated.add(tipId);
    setSeenTips(updated);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(updated)));
  };

  const shouldShowTips = unseenTips.length > 0;
  const currentTip = unseenTips[currentTipIndex];

  return {
    shouldShowTips,
    currentTip,
    currentTipIndex,
    unseenTips,
    markTipAsSeen,
    nextTip: () => setCurrentTipIndex((i) => Math.min(i + 1, unseenTips.length - 1)),
    previousTip: () => setCurrentTipIndex((i) => Math.max(i - 1, 0)),
    dismissAllTips: () => {
      unseenTips.forEach((t) => markTipAsSeen(t.id));
    },
  };
}
