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
  // Hide this sub-item for these roles (e.g. exec Dashboard is meaningless
  // for a store-floor attendant).
  hiddenForRoles?: readonly AppRole[];
};

export type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  match: readonly string[];
  // Exact-only path matching (no descendant-startsWith highlight). Used
  // where a group's destinations all live at the same base pathname with
  // query params (e.g. Admin's `/admin?tab=…`) — otherwise `/admin` would
  // also light up on `/admin/inventory/*` and highlight two items at once.
  exact?: boolean;
  feature?: TierFeatureKey;
  items?: readonly NavSubItem[];
  adminOnly?: boolean;
  superAdminOnly?: boolean;
};

// ─── Left sidebar nav ───────────────────────────────────────────────────
// Pointers to keep the two dashboards / customers home from drifting again:
//
//   • **Briefing** (`/briefing`) is the personalised HOME page — tagged
//     products this week / last week / month buckets, plus unread WhatsApp
//     conversations that need a reply. It's what the user sees right after
//     signing in. It is NOT the exec KPI dashboard.
//
//   • **Intelligence → Dashboard** (`/dashboard`) is the exec KPI view
//     (scans, revenue recovered, heatmap, top products). It lives under
//     Intelligence because it's an analytics surface, not a daily action
//     surface. Do not promote it back to the top level.
//
//   • **Customers** lives under Admin now (not top-level) — it's a
//     configuration surface (bulk import, delete, edit) rather than an
//     everyday destination like Messages/Inventory. If you're tempted to
//     hoist it back to the top nav, remember why it moved: the top nav is
//     limited to daily-use destinations.
//
//   • **Inventory** is `/admin/inventory` (yes, the URL sits under /admin,
//     but the item is top-level because inventory is an every-day
//     destination). Keep it here; don't move it under Admin.
//
export const NAV: readonly NavItem[] = [
  {
    title: "Briefing",
    url: "/briefing",
    icon: LayoutDashboard,
    match: ["/briefing"],
  },
  {
    title: "Inventory",
    url: "/admin/inventory",
    icon: Boxes,
    match: ["/admin/inventory", "/products"],
  },
  { title: "Messages", url: "/inbox", icon: Inbox, match: ["/inbox"] },

  {
    title: "Intelligence",
    url: "/intelligence",
    icon: TrendingUp,
    // NOTE: `/dashboard`, `/analytics`, `/roi` all light up Intelligence in
    // the sidebar because those pages are Intelligence tabs now.
    match: [
      "/intelligence",
      "/analytics",
      "/roi",
      "/commerce",
      "/dashboard",
    ],
  },
  {
    title: "Admin",
    url: "/admin",
    icon: ShieldCheck,
    // Exact-only — see NavItem.exact above.
    match: ["/admin", "/stores", "/customers"],
    exact: true,
    adminOnly: true,
  },

  {
    title: "Pricing",
    url: "/admin/pricing",
    icon: DollarSign,
    match: ["/admin/pricing"],
    superAdminOnly: true,
  },
] as const;

// Mobile bottom nav — dropdowns don't fit on a bar, so we surface four
// everyday destinations. Briefing replaces Dashboard as the home slot.
export const MOBILE_NAV: readonly Omit<NavItem, "items">[] = [
  { title: "Briefing", url: "/briefing", icon: LayoutDashboard, match: ["/briefing"] },
  { title: "Messages", url: "/inbox", icon: Inbox, match: ["/inbox"] },
  { title: "Inventory", url: "/admin/inventory", icon: Tag, match: ["/admin/inventory", "/products"] },
  { title: "Customers", url: "/admin?tab=customers", icon: Users, match: ["/admin", "/customers"] },
] as const;

export function isNavActive(
  item: { match: readonly string[]; exact?: boolean },
  pathname: string,
): boolean {
  return item.match.some((p) =>
    item.exact ? pathname === p : pathname === p || pathname.startsWith(p + "/"),
  );
}
