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
          const subActive =
            pathname === sub.url.split("?")[0] ||
            pathname.startsWith(sub.url.split("?")[0] + "/");
          return (
            <DropdownMenuItem key={sub.url} asChild>
              <Link
                to={sub.url.split("?")[0]}
                search={parseSearch(sub.url)}
                className={`cursor-pointer ${subActive ? "font-semibold text-[#A6446B]" : ""}`}
              >
                {sub.title}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function parseSearch(url: string): Record<string, string> | undefined {
  const q = url.split("?")[1];
  if (!q) return undefined;
  const out: Record<string, string> = {};
  for (const pair of q.split("&")) {
    const [k, v] = pair.split("=");
    if (k) out[k] = decodeURIComponent(v ?? "");
  }
  return out;
}
