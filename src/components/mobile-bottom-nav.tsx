import { useRouterState } from "@tanstack/react-router";
import { MOBILE_NAV, isNavActive } from "@/lib/nav";

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_NAV.map((item) => {
          const active = isNavActive(item, pathname);
          return (
            <li key={item.url} className="flex-1">
              <a
                href={item.url}
                className={[
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-[#A6446B]" : "text-muted-foreground hover:text-[#A6446B]",
                ].join(" ")}
              >
                <span
                  className={[
                    "relative inline-flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    active ? "bg-[#A6446B] text-white" : "",
                  ].join(" ")}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="truncate leading-tight">{item.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
