import {
  LayoutDashboard,
  Settings,
  Tag,
  Users,
  TrendingUp,
  Inbox,
  ShieldCheck,
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
    title: "Inventory",
    url: "/products",
    icon: Tag,
    match: ["/products"],
  },
  {
    title: "Customers",
    url: "/customers",
    icon: Users,
    match: ["/customers", "/watchlists", "/intent"],
  },
  {
    title: "Notifications",
    url: "/inbox",
    icon: Inbox,
    match: ["/inbox"],
  },
  {
    title: "Insights",
    url: "/analytics",
    icon: TrendingUp,
    match: ["/analytics", "/intelligence", "/roi", "/commerce"],
    feature: "roi",
  },
  {
    title: "Admin",
    url: "/staff",
    icon: ShieldCheck,
    match: ["/staff", "/stores", "/organisation"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    match: ["/settings", "/upgrade"],
  },
] as const;

export function isNavActive(item: NavItem, pathname: string): boolean {
  return item.match.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
