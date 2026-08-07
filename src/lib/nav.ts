import {
  LayoutDashboard,
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
  ShoppingBag,
  Search,
  FileText,
  Radar,
  Eye,
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

// ─── Information architecture ───────────────────────────────────────────
// TAG is one platform with four sections, not two separate apps:
//
//   PRODUCT    — the retailer's catalogue intelligence (staff only)
//   PURCHASE   — the transaction record: purchases, digital receipts, returns
//   OWNERSHIP  — what the shopper owns after the sale: products, household,
//                warranties, documents, TAG ID
//   BUSINESS   — analytics, ROI, sustainability, admin (staff only)
//
// PURCHASE and OWNERSHIP are visible to EVERY signed-in user, because a
// staff member is also a shopper. PRODUCT and BUSINESS are staff-only.
// Don't reintroduce a binary "retail vs wallet" split of the whole nav —
// section-level gating is what lets one account do both.
export type NavSection = {
  id: "product" | "purchase" | "ownership" | "business";
  label: string;
  staffOnly?: boolean;
  items: readonly NavItem[];
};

// Back-compat: a couple of surfaces still ask "which front door is this?".
export type Persona = "retail" | "wallet";

export const PERSONA_LABEL: Record<Persona, string> = {
  retail: "TAG Retail",
  wallet: "TAG Wallet",
};

export function personaFromRoles(roles: readonly string[] | undefined): Persona {
  return roles && roles.length > 0 ? "retail" : "wallet";
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "product",
    label: "Product",
    staffOnly: true,
    items: [
      { title: "Dashboard", url: "/briefing", icon: LayoutDashboard, match: ["/briefing"] },
      {
        title: "Products",
        url: "/admin/inventory",
        icon: Boxes,
        match: ["/admin/inventory", "/products"],
      },
      { title: "Intent Engine", url: "/intelligence/intent", icon: Radar, match: ["/intelligence/intent", "/intent"] },
      { title: "Watchlists", url: "/watchlists", icon: Eye, match: ["/watchlists"] },
      { title: "Messages", url: "/inbox", icon: Inbox, match: ["/inbox"] },
    ],
  },
  {
    id: "purchase",
    label: "Purchase",
    items: [
      { title: "Purchases", url: "/ownership/purchases", icon: ShoppingBag, match: ["/ownership/purchases"] },
      { title: "Receipts", url: "/purchase/receipts", icon: ReceiptText, match: ["/purchase/receipts"] },
      { title: "Search", url: "/purchase/search", icon: Search, match: ["/purchase/search"] },
      { title: "Returns", url: "/ownership/returns", icon: Undo2, match: ["/ownership/returns"] },
    ],
  },
  {
    id: "ownership",
    label: "Ownership",
    items: [
      { title: "My Products", url: "/ownership/products", icon: Boxes, match: ["/ownership/products"] },
      { title: "Household", url: "/ownership/household", icon: Home, match: ["/ownership/household"] },
      { title: "Warranties", url: "/ownership/warranties", icon: WarrantyIcon, match: ["/ownership/warranties"] },
      { title: "Documents", url: "/ownership/documents", icon: FileText, match: ["/ownership/documents"] },
      { title: "TAG ID", url: "/ownership/tag-id", icon: Wallet, match: ["/ownership/tag-id"] },
    ],
  },
  {
    id: "business",
    label: "Business",
    staffOnly: true,
    items: [
      {
        title: "Analytics",
        url: "/intelligence",
        icon: TrendingUp,
        match: ["/intelligence", "/analytics", "/roi", "/commerce", "/dashboard"],
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
        // super_admin console at /admin/pricing.
        match: ["/upgrade"],
      },
    ],
  },
] as const;

export function sectionsForUser(isStaff: boolean): readonly NavSection[] {
  return NAV_SECTIONS.filter((s) => !s.staffOnly || isStaff);
}

// Mobile bottom nav — dropdowns don't fit on a bar, so we surface the
// everyday destinations for each audience.
export const STAFF_MOBILE_NAV: readonly Omit<NavItem, "items">[] = [
  { title: "Dashboard", url: "/briefing", icon: LayoutDashboard, match: ["/briefing"] },
  { title: "Products", url: "/admin/inventory", icon: Boxes, match: ["/admin/inventory", "/products"] },
  { title: "Receipts", url: "/purchase/receipts", icon: ReceiptText, match: ["/purchase/receipts"] },
  { title: "Impact", url: "/analytics/sustainability", icon: Leaf, match: ["/analytics/sustainability"] },
  { title: "Customers", url: "/admin?tab=customers", icon: Users, match: ["/customers"] },
] as const;

export const SHOPPER_MOBILE_NAV: readonly Omit<NavItem, "items">[] = [
  { title: "Receipts", url: "/purchase/receipts", icon: ReceiptText, match: ["/purchase/receipts"] },
  { title: "Products", url: "/ownership/products", icon: Boxes, match: ["/ownership/products"] },
  { title: "Warranties", url: "/ownership/warranties", icon: WarrantyIcon, match: ["/ownership/warranties"] },
  { title: "TAG ID", url: "/ownership/tag-id", icon: Wallet, match: ["/ownership/tag-id"] },
] as const;

export function mobileNavForUser(isStaff: boolean): readonly Omit<NavItem, "items">[] {
  return isStaff ? STAFF_MOBILE_NAV : SHOPPER_MOBILE_NAV;
}

export function isNavActive(
  item: { match: readonly string[]; exact?: boolean },
  pathname: string,
): boolean {
  return item.match.some((p) =>
    item.exact ? pathname === p : pathname === p || pathname.startsWith(p + "/"),
  );
}
