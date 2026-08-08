import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TagLogo } from "@/components/tag-logo";
import { CommandPalette } from "@/components/command-palette";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getRetailerBranding } from "@/lib/branding.functions";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { briefingQueryOptions } from "@/lib/dashboard";
import { TagReaderTile } from "@/components/qr/tag-reader-tile";
import { UIVersionSwitcher } from "@/components/ui-version-switcher";
import { ShopperTagButton } from "@/components/ownership/shopper-tag-button";
import { UserMenu } from "@/components/user-menu";
import { useIsStaff } from "@/hooks/use-persona";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("retailer_id")
      .eq("user_id", data.user.id)
      .not("retailer_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (roleRow?.retailer_id) {
      const { data: retailer } = await supabase
        .from("retailers")
        .select("onboarding_completed_at")
        .eq("id", roleRow.retailer_id)
        .maybeSingle();
      if (retailer && !retailer.onboarding_completed_at) {
        throw redirect({ to: "/setup" });
      }
    }

    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const brandingFn = useServerFn(getRetailerBranding);
  const branding = useQuery({ queryKey: ["branding"], queryFn: () => brandingFn(), staleTime: 5 * 60_000 });
  const brandTheme = useBrandTheme(branding.data?.logo_url);
  // Greeting name shown in the top-left of the app header — same source
  // the Briefing page uses so it stays in sync ("Hello Makro Woodmead").
  const briefing = useQuery(briefingQueryOptions);
  const greetingName = briefing.data?.greetingName ?? null;
  // The reader frame belongs on the dashboard/briefing surface only.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showReaderTile = pathname === "/briefing" || pathname === "/dashboard";
  const isStaff = useIsStaff();


  const themeStyle: Record<string, string> = {};
  if (brandTheme?.background) themeStyle["--background"] = brandTheme.background;
  if (brandTheme?.primary) themeStyle["--primary"] = brandTheme.primary;
  if (brandTheme?.primaryForeground) themeStyle["--primary-foreground"] = brandTheme.primaryForeground;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Greeting banner above nav */}
      {greetingName && (
        <div className="bg-background px-4 py-4 sm:px-6">
          <div className="mx-auto w-full max-w-7xl">
            <p className="text-[14px] font-semibold tracking-tight">
              Hello {greetingName}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Your daily briefing — freshly tagged products this month, and shoppers waiting on a reply.
            </p>
          </div>
        </div>
      )}

      <SidebarProvider style={themeStyle as any} className="flex-1">
        <AppSidebar />
        <SidebarInset className="bg-background">
          <header className="grid grid-cols-3 items-center gap-3 bg-background px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3 justify-self-start">
              {isStaff && <SidebarTrigger className="md:hidden" />}
              {isStaff && showReaderTile && (
                <div className="hidden sm:block">
                  <TagReaderTile compact />
                </div>
              )}
            </div>

            <TagLogo
              variant="wordmark"
              heightClass="h-[14.798rem] sm:h-[10.608rem]"
              className="justify-self-center"
            />

            <div className="flex items-center gap-3 justify-self-end">
              {!isStaff && <ShopperTagButton />}
              {!isStaff && <UIVersionSwitcher />}
              {!isStaff && <UserMenu />}
            </div>
          </header>

          <CommandPalette />
          <main
            className={
              isStaff
                ? "flex-1 px-4 pb-24 pt-8 sm:px-8 sm:py-10 md:pb-10"
                : "flex-1 px-4 pb-24 pt-8 sm:px-8 sm:py-10"
            }
          >
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
          <MobileBottomNav />
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
