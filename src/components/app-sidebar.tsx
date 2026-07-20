import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TagLogo } from "./tag-logo";
import { useTier } from "@/hooks/use-tier";
import { useAuth } from "@/hooks/use-auth";
import { NAV, isNavActive, type NavItem } from "@/lib/nav";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasFeature } = useTier();
  const { primaryRole } = useAuth();
  const isActive = (item: NavItem) => isNavActive(item, pathname);

  return (
    <Sidebar collapsible="icon" className="hidden border-r-0 overflow-visible md:flex">
      <SidebarHeader className="relative flex-row items-center justify-center overflow-visible bg-sidebar p-0 py-2">
        {!collapsed && (
          <TagLogo variant="wordmark" heightClass="h-[10.608rem]" />
        )}
      </SidebarHeader>

      <SidebarContent className="px-1.5 pb-3 pt-6">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = isActive(item);
                const locked = item.feature ? !hasFeature(item.feature) : false;
                const linkProps = locked
                  ? { to: "/upgrade" as const, search: { feature: item.feature } }
                  : { to: item.url };
                const activeClass =
                  active && !locked
                    ? "bg-foreground text-background font-semibold hover:bg-foreground hover:text-background data-[active=true]:bg-foreground data-[active=true]:text-background [&_svg]:text-background"
                    : locked
                      ? "text-sidebar-foreground/50 hover:bg-muted hover:text-sidebar-foreground/80"
                      : "text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground";

                if (item.items && item.items.length > 0 && !locked) {
                  return (
                    <Collapsible key={item.url} open className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={active} tooltip={item.title} className={activeClass}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate flex-1">{item.title}</span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items
                              .filter(
                                (sub) =>
                                  !sub.hiddenForRoles ||
                                  !primaryRole ||
                                  !sub.hiddenForRoles.includes(primaryRole),
                              )
                              .map((sub) => {
                              const subActive = pathname === sub.url || pathname.startsWith(sub.url + "/");
                              return (
                                <SidebarMenuSubItem key={sub.url}>
                                  <SidebarMenuSubButton asChild isActive={subActive}>
                                    <Link to={sub.url}>{sub.title}</Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active && !locked}
                      tooltip={locked ? `${item.title} — upgrade required` : item.title}
                      className={activeClass}
                    >
                      <Link {...linkProps} className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate flex-1">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <div className="px-3 py-3 space-y-3">
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full rounded-lg border border-sidebar-border bg-sidebar px-3 py-2 text-sm placeholder:text-sidebar-foreground/40 text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">Tag</p>
              <p className="text-[11px] text-sidebar-foreground/60">Demand Intelligence</p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
