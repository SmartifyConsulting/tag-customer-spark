import {
  LayoutDashboard,
  Bell,
  Settings,
  Tag,
  Users,
  TrendingUp,
  Inbox,
} from "lucide-react";
import type { TierFeatureKey } from "@/lib/tier";

export type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  match: readonly string[];
  feature?: TierFeatureKey;
};

export const NAV: readonly NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    match: ["/dashboard"],
  },
  {
    title: "Items & Tags",
    url: "/products",
    icon: Tag,
    match: ["/products"],
  },
  {
    title: "Alerts & Campaigns",
    url: "/notifications",
    icon: Bell,
    match: ["/notifications", "/alerts"],
  },
  {
    title: "Inbox",
    url: "/inbox",
    icon: Inbox,
    match: ["/inbox"],
  },
  {
    title: "Customers & Leads",
    url: "/customers",
    icon: Users,
    match: ["/customers", "/watchlists", "/intent"],
  },
  {
    title: "Analytics & Insights",
    url: "/analytics",
    icon: TrendingUp,
    match: ["/analytics", "/intelligence", "/roi", "/commerce"],
    feature: "roi",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    match: ["/stores", "/staff", "/organisation", "/settings", "/upgrade"],
  },
] as const;

export function isNavActive(item: NavItem, pathname: string): boolean {
  return item.match.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
