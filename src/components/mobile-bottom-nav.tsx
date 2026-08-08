import { useRouterState } from "@tanstack/react-router";
import { mobileNavForUser, isNavActive } from "@/lib/nav";
import { useIsStaff } from "@/hooks/use-persona";
import { useReceiptsEnabled } from "@/hooks/use-receipts-enabled";

const RECEIPTS_URLS = new Set(["/ownership/purchases", "/purchase/receipts"]);

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { enabled: receiptsEnabled } = useReceiptsEnabled();
  const isStaff = useIsStaff();
  const items = mobileNavForUser(isStaff).filter(
    (item) => receiptsEnabled || !RECEIPTS_URLS.has(item.url),
  );

  // Staff still get the full left sidebar on desktop/tablet, so this stays
  // mobile-only for them. Shoppers have no left nav at any size, so this is
  // their nav everywhere.
  return (
    <nav
      className={[
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md",
        isStaff ? "md:hidden" : "",
      ].join(" ")}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isNavActive(item, pathname);
          return (
            <li key={item.url} className="flex-1">
              <a
                href={item.url}
                className={[
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-primary",
                ].join(" ")}
              >
                <span
                  className={[
                    "relative inline-flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    active ? "bg-primary text-primary-foreground" : "",
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
