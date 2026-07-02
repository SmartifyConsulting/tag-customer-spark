import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Bell,
  Sparkles,
  BarChart3,
  Settings,
  Lock,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { TagLogo } from "./tag-logo";
import { useTier } from "@/hooks/use-tier";
import type { TierFeatureKey } from "@/lib/tier";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  match: readonly string[];
  feature?: TierFeatureKey;
};

const NAV: readonly NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, match: ["/dashboard", "/alerts", "/inbox", "/notifications"] },
  { title: "Engagement", url: "/customers", icon: Bell, match: ["/customers", "/products", "/qr-tags", "/watchlists"] },
  { title: "Intelligence", url: "/intelligence", icon: Sparkles, match: ["/intelligence", "/intent"], feature: "intelligence" },
  { title: "Performance & ROI", url: "/roi", icon: BarChart3, match: ["/roi", "/commerce", "/analytics"], feature: "roi" },
  { title: "Management", url: "/stores", icon: Settings, match: ["/stores", "/staff", "/organisation", "/settings"] },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasFeature } = useTier();
  const isActive = (item: NavItem) =>
    item.match.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <Sidebar collapsible="icon" className="border-r-0 overflow-visible">
      <SidebarHeader className="relative h-16 flex-row items-center justify-center overflow-visible border-b border-sidebar-border/60 bg-sidebar p-0">
        {collapsed ? (
          <TagLogo variant="icon" size="sm" />
        ) : (
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2">
            <TagLogo variant="wordmark" size="xl" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-1.5 pb-3 pt-[144px]">

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = isActive(item);
                const locked = item.feature ? !hasFeature(item.feature) : false;
                const linkProps = locked
                  ? { to: "/upgrade" as const, search: { feature: item.feature } }
                  : { to: item.url };
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active && !locked}
                      tooltip={locked ? `${item.title} — upgrade required` : item.title}
                      className={
                        active && !locked
                          ? "bg-[color:var(--mint)] text-white font-semibold hover:bg-[color:var(--mint)] hover:text-white data-[active=true]:bg-[color:var(--mint)] data-[active=true]:text-white [&_svg]:text-white"
                          : locked
                            ? "text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/80"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      }
                    >
                      <Link {...linkProps} className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate flex-1">{item.title}</span>
                        {locked && <Lock className="h-3 w-3 shrink-0 opacity-70" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>


      <SidebarFooter className="border-t border-sidebar-border/60">
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">Tag</p>
            <p className="text-[11px] text-sidebar-foreground/60">Demand Intelligence</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

