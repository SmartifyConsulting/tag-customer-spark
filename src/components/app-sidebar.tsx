import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  QrCode,
  Users,
  Bell,
  BarChart3,
  Store,
  UserCog,
  Settings,
  Sparkles,
  Gauge,
  Eye,
  DollarSign,
  TrendingUp,
  Activity,
  Lightbulb,
  GitCompareArrows,
  PieChart,
  ShieldCheck,
  FileBarChart2,
  History,
  Tag as TagIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { TagLogo } from "./tag-logo";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; items: readonly NavItem[] };

const NAV: readonly NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Alerts", url: "/alerts", icon: Bell },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "Overview", url: "/intelligence", icon: Sparkles },
      { title: "Intent Engine", url: "/intent", icon: Gauge },
      { title: "Forecasting", url: "/intelligence/forecasting", icon: TrendingUp },
      { title: "Trend Detection", url: "/intelligence/trends", icon: Activity },
      { title: "Demand Insights", url: "/intelligence/insights", icon: Lightbulb },
    ],
  },
  {
    label: "Products",
    items: [
      { title: "Catalogue", url: "/products", icon: Package },
      { title: "Compare", url: "/products/compare", icon: GitCompareArrows },
    ],
  },
  {
    label: "Activation",
    items: [
      { title: "QR Tags", url: "/qr-tags", icon: QrCode },
      { title: "Watchlists", url: "/watchlists", icon: Eye },
      { title: "Customers", url: "/customers", icon: Users },
    ],
  },
  {
    label: "Commerce Intelligence",
    items: [
      { title: "ROI Engine", url: "/roi", icon: DollarSign },
      { title: "Pricing Sensitivity", url: "/commerce/pricing", icon: TagIcon },
      { title: "Conversion Funnel", url: "/commerce/funnel", icon: PieChart },
    ],
  },
  {
    label: "Analytics",
    items: [
      { title: "Executive Dashboards", url: "/analytics", icon: BarChart3 },
      { title: "Historical Trends", url: "/analytics/history", icon: History },
      { title: "Reports & Exports", url: "/analytics/reports", icon: FileBarChart2 },
    ],
  },
  {
    label: "Organisation",
    items: [
      { title: "Stores", url: "/stores", icon: Store },
      { title: "Staff", url: "/staff", icon: UserCog },
      { title: "Permissions", url: "/organisation/roles", icon: ShieldCheck },
    ],
  },
  {
    label: "System",
    items: [{ title: "Settings", url: "/settings", icon: Settings }],
  },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) =>
    pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div className="flex h-20 items-center justify-center px-2">
          <TagLogo size={collapsed ? "sm" : "lg"} />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1.5 py-3">
        {NAV.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            {!collapsed && (
              <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.url);
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
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
              Tag
            </p>
            <p className="text-[11px] text-sidebar-foreground/60">
              Demand Intelligence
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
