import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Bell,
  Sparkles,
  BarChart3,
  Settings,
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

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  match: readonly string[];
};

const NAV: readonly NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, match: ["/dashboard", "/alerts", "/inbox", "/notifications"] },
  { title: "Engagement", url: "/customers", icon: Bell, match: ["/customers", "/products", "/qr-tags", "/watchlists"] },
  { title: "Intelligence", url: "/intelligence", icon: Sparkles, match: ["/intelligence", "/intent"] },
  { title: "Performance & ROI", url: "/roi", icon: BarChart3, match: ["/roi", "/commerce", "/analytics"] },
  { title: "Management", url: "/stores", icon: Settings, match: ["/stores", "/staff", "/organisation", "/settings"] },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (item: NavItem) =>
    item.match.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div className="flex items-center justify-center px-2 pt-8 pb-4">
          <TagLogo size={collapsed ? "sm" : "lg"} />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1.5 pb-3 pt-[38px]">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = isActive(item);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={
                        active
                          ? "relative bg-[color:var(--mint)]/15 text-[color:var(--mint)] font-semibold hover:bg-[color:var(--mint)]/20 hover:text-[color:var(--mint)] data-[active=true]:bg-[color:var(--mint)]/15 data-[active=true]:text-[color:var(--mint)] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-[color:var(--mint)]"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      }
                    >
                      <Link to={item.url} className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
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
