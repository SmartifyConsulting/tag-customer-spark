import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTier } from "@/hooks/use-tier";
import { useAuth, useIsAdmin, useIsSuperAdmin } from "@/hooks/use-auth";
import { UserMenu } from "@/components/user-menu";
import { QrPreview } from "@/components/qr/qr-preview";
import { sectionsForUser, isNavActive, type NavItem } from "@/lib/nav";
import { getTagIdentity } from "@/lib/ownership.functions";
import { useIsStaff } from "@/hooks/use-persona";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasFeature } = useTier();
  const { primaryRole } = useAuth();
  const isAdmin = useIsAdmin();
  const isSuperAdmin = useIsSuperAdmin();
  const isStaff = useIsStaff();

  // Fetch shopper's tag for QR code (only for shoppers, not staff-only view)
  const tagFn = useServerFn(getTagIdentity);
  const { data: tagData } = useQuery({
    queryKey: ["tag-identity"],
    queryFn: () => tagFn(),
    enabled: !isStaff,
  });
  // A nav item whose destination gates on a role the user doesn't have
  // used to still render (and highlight active) here, then bounce the user
  // to /dashboard on click — confusing. Filter to what they can actually
  // open instead.
  const sections = sectionsForUser(isStaff).map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => (!item.adminOnly || isAdmin) && (!item.superAdminOnly || isSuperAdmin),
    ),
  }));
  const isActive = (item: NavItem) => isNavActive(item, pathname);

  return (
    <Sidebar collapsible="icon" className="hidden border-r-0 overflow-visible md:flex">
      {/* Shopper QR Code Header */}
      {!collapsed && tagData?.tag_id && !isStaff && (
        <SidebarHeader className="flex flex-col items-center gap-2 py-3 px-2">
          <div className="text-xs font-semibold text-sidebar-foreground/60">My Shopper Tag</div>
          <QrPreview value={tagData.tag_id} size={120} />
        </SidebarHeader>
      )}
      {collapsed && (
        <SidebarHeader className="bg-sidebar h-16 justify-end p-0 pb-2" />
      )}

      <SidebarContent className="px-1.5 pb-3 pt-2">
        {sections.map((section) => (
          <SidebarGroup key={section.id}>
            {!collapsed && section.id !== "purchase" && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(item);
                  const locked = item.feature ? !hasFeature(item.feature) : false;
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
                                  const subActive =
                                    pathname === sub.url || pathname.startsWith(sub.url + "/");
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
                        <Link
                          to={locked ? "/upgrade" : item.url}
                          className="flex items-center gap-2.5"
                        >
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
        ))}
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <div className="space-y-2 px-3 py-3">
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full rounded-lg border border-sidebar-border bg-sidebar px-3 py-2 text-sm placeholder:text-sidebar-foreground/40 text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <div className="pt-1">
              <UserMenu />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
