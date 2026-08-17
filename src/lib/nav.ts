import {
  LayoutDashboard,
  Users,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  Boxes,
  DollarSign,
  Radar,
  Eye,
  Tag,
  Barcode,
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
// TAG is one platform with three sections, not two separate apps:
//
//   PRODUCT    — the retailer's catalogue intelligence (staff only)
//   PURCHASE   — everything a shopper needs: products they've tagged
//                (scanned, not yet bought) and their full purchase record
//                (purchases, digital receipts, returns — all tabs of one
//                page). Warranties and documents live on the product itself,
//                reached by hyperlinking into it — there's no separate
//                Ownership section anymore.
//   BUSINESS   — analytics, ROI, admin (staff only)
//
// PURCHASE is visible to EVERY signed-in user, because a staff member is
// also a shopper. PRODUCT and BUSINESS are staff-only.
export type NavSection = {
  id: "product" | "purchase" | "business";
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
      { title: "Whatsapps", url: "/inbox", icon: MessageSquare, match: ["/inbox"] },
      {
        // Overview screen — Insights / Analytics / ROI already live there as
        // tabs, so this is a single destination with no sub-menu.
        title: "Analytics",
        url: "/intelligence",
        icon: TrendingUp,
        match: ["/intelligence", "/analytics", "/roi", "/commerce", "/dashboard"],
      },
    ],
  },
  {
    id: "purchase",
    label: "Purchase",
    items: [{ title: "Scanner", url: "/tagged", icon: Tag, match: ["/tagged"] }],
  },
  {
    id: "business",
    label: "Business",
    staffOnly: true,
    items: [
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
  { title: "Scanner", url: "/tagged", icon: Tag, match: ["/tagged"] },
  { title: "Customers", url: "/admin?tab=customers", icon: Users, match: ["/customers"] },
] as const;

export const SHOPPER_MOBILE_NAV: readonly Omit<NavItem, "items">[] = [
  { title: "My Tag", url: "/barcode-tagger", icon: Barcode, match: ["/barcode-tagger"] },
  { title: "Scanner", url: "/tagged", icon: Tag, match: ["/tagged"] },
  { title: "Whatsapps", url: "/inbox", icon: MessageSquare, match: ["/inbox"] },
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
