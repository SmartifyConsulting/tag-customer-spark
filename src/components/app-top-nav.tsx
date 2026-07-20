import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV, isNavActive, type NavItem } from "@/lib/nav";
import { useAuth } from "@/hooks/use-auth";

// Simplified nav: plain pink text items (matches reference mockup) with
// a chevron for grouped items. No mint pill background anymore.
const PINK = "text-[#A6446B]";
const PINK_HOVER = "hover:text-[#7d3350]";
const BASE = `text-sm font-semibold ${PINK} ${PINK_HOVER} transition-colors`;

export function AppTopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasRole } = useAuth();
  const isAdmin =
    hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");
  const isSuperAdmin = hasRole("super_admin");

  const visible = NAV.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.superAdminOnly && !isSuperAdmin) return false;
    return true;
  });

  return (
    <nav className="hidden items-center gap-8 md:flex">
      {visible.map((item) =>
        item.items && item.items.length > 0 ? (
          <NavDropdown key={item.title} item={item} pathname={pathname} />
        ) : (
          // Router-typed Link for the parent's own route (works for
          // /admin/pricing etc. — no search params to reconcile).
          <Link
            key={item.title}
            to={item.url}
            className={`flex items-center gap-1 ${BASE} ${
              isNavActive(item, pathname) ? "underline underline-offset-4" : ""
            }`}
          >
            {item.title}
          </Link>
        ),
      )}
    </nav>
  );
}

function NavDropdown({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(item, pathname);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex items-center gap-1 outline-none ${BASE} ${
          active ? "underline underline-offset-4" : ""
        }`}
      >
        {item.title}
        <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {item.items!.map((sub) => {
          const basePath = sub.url.split("?")[0];
          const subActive = pathname === basePath || pathname.startsWith(basePath + "/");
          // Sub-links can carry search params (e.g. /admin?tab=stores).
          // Plain <a> keeps typing simple across heterogeneous routes; a
          // full-page nav here is fine — the target route lazy-loads.
          return (
            <DropdownMenuItem key={sub.url} asChild>
              <a
                href={sub.url}
                className={`block w-full cursor-pointer ${
                  subActive ? "font-semibold text-[#A6446B]" : ""
                }`}
              >
                {sub.title}
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
