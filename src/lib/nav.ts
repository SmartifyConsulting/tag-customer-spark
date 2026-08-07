import {
  LayoutDashboard,
  Tag,
  Users,
  TrendingUp,
  Inbox,
  ShieldCheck,
  Boxes,
  DollarSign,
  ReceiptText,
  Leaf,
  Home,
  ShieldCheck as WarrantyIcon,
  Undo2,
  Wallet,
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
// ─── Persona split ──────────────────────────────────────────────────────
// The platform now has two front doors over one backend:
//
//   • **TAG Retail**  — staff-facing: POS/QR management, receipt delivery,
//     store analytics, sustainability, customer engagement.
//   • **TAG Wallet**  — consumer-facing: digital receipts, purchases, my
//     products, warranties, returns, household inventory.
//
// A signed-in user with any retail role gets TAG Retail; everyone else
// (shoppers with a TAG ID and no staff role) gets TAG Wallet. Don't mix the
// two lists back together — the whole point is that each surface stays
// focused on one audience.
export type Persona = "retail" | "wallet";

export const PERSONA_LABEL: Record<Persona, string> = {
  retail: "TAG Retail",
  wallet: "TAG Wallet",
};

export function personaFromRoles(roles: readonly string[] | undefined): Persona {
  return roles && roles.length > 0 ? "retail" : "wallet";
}

export const RETAIL_NAV: readonly NavItem[] = [
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
    title: "Analytics",
    url: "/intelligence",
    icon: TrendingUp,
    match: [
      "/intelligence",
      "/analytics",
      "/roi",
      "/commerce",
      "/dashboard",
    ],
    items: [
      { title: "Overview", url: "/intelligence", match: ["/intelligence"] },
      { title: "Insights", url: "/intelligence/insights", match: ["/intelligence/insights"] },
      { title: "Analytics", url: "/analytics", match: ["/analytics"] },
      { title: "ROI", url: "/roi", match: ["/roi"] },
      { title: "Sustainability", url: "/analytics/sustainability", match: ["/analytics/sustainability"] },
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
    url: "/upgrade",
    icon: DollarSign,
    // Every retailer's own subscribe/compare-plans page — not the
    // super_admin console at /admin/pricing (that's TAG staff managing
    // every retailer's plan, a different audience entirely; pointing this
    // nav item there was what caused the "redirects to Dashboard while
    // Pricing stays highlighted" confusion for non-super-admin users).
    match: ["/upgrade"],
  },
] as const;

// TAG Wallet — the consumer surface. Ownership sub-pages are promoted to
// top-level rows here because they *are* the app for a shopper.
export const WALLET_NAV: readonly NavItem[] = [
  { title: "Receipts", url: "/ownership/purchases", icon: ReceiptText, match: ["/ownership/purchases"] },
  { title: "My Products", url: "/ownership/products", icon: Boxes, match: ["/ownership/products"] },
  { title: "Household", url: "/ownership/household", icon: Home, match: ["/ownership/household"] },
  { title: "Warranties", url: "/ownership/warranties", icon: WarrantyIcon, match: ["/ownership/warranties"] },
  { title: "Returns", url: "/ownership/returns", icon: Undo2, match: ["/ownership/returns"] },
  { title: "TAG ID", url: "/ownership/tag-id", icon: Wallet, match: ["/ownership/tag-id"] },
] as const;

export function navForPersona(persona: Persona): readonly NavItem[] {
  return persona === "wallet" ? WALLET_NAV : RETAIL_NAV;
}

// Back-compat alias — retail is the default surface.
export const NAV = RETAIL_NAV;

// Mobile bottom nav — dropdowns don't fit on a bar, so we surface four
// everyday destinations per persona.
export const RETAIL_MOBILE_NAV: readonly Omit<NavItem, "items">[] = [
  { title: "Briefing", url: "/briefing", icon: LayoutDashboard, match: ["/briefing"] },
  { title: "Messages", url: "/inbox", icon: Inbox, match: ["/inbox"] },
  { title: "Inventory", url: "/admin/inventory", icon: Tag, match: ["/admin/inventory", "/products"] },
  { title: "Impact", url: "/analytics/sustainability", icon: Leaf, match: ["/analytics/sustainability"] },
  { title: "Customers", url: "/admin?tab=customers", icon: Users, match: ["/admin", "/customers"] },
] as const;

export const WALLET_MOBILE_NAV: readonly Omit<NavItem, "items">[] = [
  { title: "Receipts", url: "/ownership/purchases", icon: ReceiptText, match: ["/ownership/purchases"] },
  { title: "Products", url: "/ownership/products", icon: Boxes, match: ["/ownership/products"] },
  { title: "Warranties", url: "/ownership/warranties", icon: WarrantyIcon, match: ["/ownership/warranties"] },
  { title: "TAG ID", url: "/ownership/tag-id", icon: Wallet, match: ["/ownership/tag-id"] },
] as const;

export function mobileNavForPersona(persona: Persona): readonly Omit<NavItem, "items">[] {
  return persona === "wallet" ? WALLET_MOBILE_NAV : RETAIL_MOBILE_NAV;
}

export const MOBILE_NAV = RETAIL_MOBILE_NAV;

export function isNavActive(
  item: { match: readonly string[]; exact?: boolean },
  pathname: string,
): boolean {
  return item.match.some((p) =>
    item.exact ? pathname === p : pathname === p || pathname.startsWith(p + "/"),
  );
}
