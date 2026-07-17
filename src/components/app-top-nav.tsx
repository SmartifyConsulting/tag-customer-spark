import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Lock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTier } from "@/hooks/use-tier";
import { NAV, isNavActive, type NavItem } from "@/lib/nav";

// Bold, left-aligned horizontal nav for the authenticated app — replaces
// the old left sidebar so the logged-in product matches the marketing
// site's nav style. Admin's sub-pages become a dropdown since there's no
// side rail left to nest them under.
export function AppTopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasFeature } = useTier();

  return (
    <nav className="hidden items-center gap-6 md:flex">
      {NAV.map((item) => {
        const active = isNavActive(item, pathname);
        const locked = item.feature ? !hasFeature(item.feature) : false;

        if (item.items && item.items.length > 0) {
          return <AdminGroup key={item.url} item={item} active={active} pathname={pathname} />;
        }

        const linkProps = locked
          ? { to: "/upgrade" as const, search: { feature: item.feature } }
          : { to: item.url };

        return (
          <Link
            key={item.url}
            {...(linkProps as any)}
            className={[
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-bold transition-colors hover:bg-[color:var(--mint)] hover:text-white",
              active && !locked ? "bg-[color:var(--mint)] text-white" : "text-foreground",
            ].join(" ")}
          >
            {item.title}
            {locked && <Lock className="h-3.5 w-3.5 opacity-60" />}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminGroup({
  item,
  active,
  pathname,
}: {
  item: NavItem;
  active: boolean;
  pathname: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={[
          "flex items-center gap-1 rounded-full px-3 py-1.5 text-base font-bold outline-none transition-colors hover:bg-[color:var(--mint)] hover:text-white",
          active ? "bg-[color:var(--mint)] text-white" : "text-foreground",
        ].join(" ")}
      >
        {item.title}
        <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {item.items!.map((sub) => {
          const subActive = pathname === sub.url || pathname.startsWith(sub.url + "/");
          return (
            <DropdownMenuItem key={sub.url} asChild>
              <Link
                to={sub.url}
                className={`cursor-pointer ${subActive ? "font-semibold text-[color:var(--mint)]" : ""}`}
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
