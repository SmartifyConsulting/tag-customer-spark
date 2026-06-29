import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Users,
  Sparkles,
  TrendingUp,
  Settings2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { TagLogo } from "./tag-logo";
import { findActiveSection, SECTIONS } from "./section-tabs";

const ICONS = {
  workspace: LayoutGrid,
  engagement: Users,
  intelligence: Sparkles,
  performance: TrendingUp,
  management: Settings2,
} as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = findActiveSection(pathname);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div className="flex items-center justify-center px-2 py-4">
          <TagLogo size={collapsed ? "sm" : "lg"} />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-5">
        <SidebarMenu className="gap-2">
          {SECTIONS.map((s) => {
            const Icon = ICONS[s.key as keyof typeof ICONS];
            const isActive = activeSection?.key === s.key;
            return (
              <SidebarMenuItem key={s.key}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={s.label}
                  className={[
                    "h-11 rounded-xl px-3 text-[13px] font-medium transition-all",
                    isActive
                      ? "relative bg-[color:var(--mint)]/15 text-white shadow-[0_0_0_1px_color-mix(in_oklab,var(--mint)_45%,transparent),0_8px_22px_-12px_color-mix(in_oklab,var(--mint)_70%,transparent)] hover:bg-[color:var(--mint)]/20 hover:text-white data-[active=true]:bg-[color:var(--mint)]/15 data-[active=true]:text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-[color:var(--mint)] before:shadow-[0_0_12px_color-mix(in_oklab,var(--mint)_75%,transparent)]"
                      : "text-white/75 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  <Link
                    to={s.tabs[0].to}
                    className="flex items-center gap-3"
                  >
                    <Icon
                      className={
                        isActive
                          ? "h-[18px] w-[18px] shrink-0 text-[color:var(--mint)]"
                          : "h-[18px] w-[18px] shrink-0"
                      }
                    />
                    <span className="truncate">{s.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              Tag
            </p>
            <p className="text-[11px] text-white/55">Retail Engagement</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
