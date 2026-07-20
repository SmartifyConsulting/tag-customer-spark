import {
  LayoutDashboard,
  Tag,
  Users,
  TrendingUp,
  Inbox,
  ShieldCheck,
  Boxes,
  DollarSign,
} from "lucide-react";
import type { TierFeatureKey } from "@/lib/tier";
import type { AppRole } from "@/hooks/use-auth";

export type NavSubItem = {
  title: string;
  url: string;
  match: readonly string[];
  // Hidden from this sub-item's parent group for these roles — e.g. the
  // executive Dashboard link is meaningless for a store-floor attendant,
  // who gets their own dashboard instead.
  hiddenForRoles?: readonly AppRole[];
};

export type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  match: readonly string[];
  feature?: TierFeatureKey;
  items?: readonly NavSubItem[];
  adminOnly?: boolean;
  superAdminOnly?: boolean;
};

// Left sidebar nav. Messages/Inventory/Customers are flat top-level items
// (no "Product" grouping label — they're everyday destinations, not a
// sub-category). Dashboard lives at the top of Intelligence instead, since
// it's an executive/analytics view — and is hidden there for sales
// assistants, who get their own store-floor dashboard.
export const NAV: readonly NavItem[] = [
  { title: "Messages", url: "/inbox", icon: Inbox, match: ["/inbox"] },
  {
    title: "Inventory",
    url: "/admin/inventory",
    icon: Boxes,
    match: ["/admin/inventory", "/products"],
  },
  { title: "Customers", url: "/customers", icon: Users, match: ["/customers"] },
  {
    title: "Intelligence",
    url: "/intelligence/insights",
    icon: TrendingUp,
    match: ["/intelligence", "/analytics", "/roi", "/commerce", "/dashboard"],
    feature: "roi",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        match: ["/dashboard"],
        hiddenForRoles: ["sales_assistant"],
      },
      { title: "Insights", url: "/intelligence/insights", match: ["/intelligence/insights"] },
      { title: "Analytics", url: "/analytics", match: ["/analytics"] },
      { title: "ROI", url: "/commerce/roi", match: ["/commerce/roi", "/roi"] },
      { title: "Trends", url: "/intelligence/trends", match: ["/intelligence/trends"] },
    ],
  },
  {
    title: "Admin",
    url: "/admin",
    icon: ShieldCheck,
    match: ["/admin", "/stores"],
    adminOnly: true,
    items: [
      { title: "Taxonomy", url: "/admin?tab=taxonomy", match: ["/admin"] },
      { title: "Stores", url: "/admin?tab=stores", match: ["/admin", "/stores"] },
      { title: "Users", url: "/admin?tab=users", match: ["/admin"] },
    ],
  },
  {
    title: "Pricing",
    url: "/admin/pricing",
    icon: DollarSign,
    match: ["/admin/pricing"],
    superAdminOnly: true,
  },
] as const;

// Flat items shown on the mobile bottom nav — dropdowns don't fit on a
// bottom bar, so we surface the four everyday destinations directly.
export const MOBILE_NAV: readonly Omit<NavItem, "items">[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, match: ["/dashboard"] },
  { title: "Messages", url: "/inbox", icon: Inbox, match: ["/inbox"] },
  { title: "Inventory", url: "/admin/inventory", icon: Tag, match: ["/admin/inventory", "/products"] },
  { title: "Customers", url: "/customers", icon: Users, match: ["/customers"] },
] as const;

export function isNavActive(item: { match: readonly string[] }, pathname: string): boolean {
  return item.match.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
