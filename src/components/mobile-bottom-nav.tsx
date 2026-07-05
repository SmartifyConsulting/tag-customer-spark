import { Link, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { NAV, isNavActive } from "@/lib/nav";
import { useTier } from "@/hooks/use-tier";

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasFeature } = useTier();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {NAV.map((item) => {
          const active = isNavActive(item, pathname);
          const locked = item.feature ? !hasFeature(item.feature) : false;
          const linkProps = locked
            ? { to: "/upgrade" as const, search: { feature: item.feature } }
            : { to: item.url };
          return (
            <li key={item.url} className="flex-1">
              <Link
                {...linkProps}
                className={[
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active && !locked
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <span
                  className={[
                    "relative inline-flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    active && !locked ? "bg-foreground text-background" : "",
                  ].join(" ")}
                >
                  <item.icon className="h-4 w-4" />
                  {locked && (
                    <Lock className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-background p-0.5 text-muted-foreground" />
                  )}
                </span>
                <span className="truncate leading-tight">{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
