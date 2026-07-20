import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TagLogo } from "@/components/tag-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getRetailerBranding } from "@/lib/branding.functions";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { briefingQueryOptions } from "@/lib/dashboard";

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

  const themeStyle: Record<string, string> = {};
  if (brandTheme?.background) themeStyle["--background"] = brandTheme.background;
  if (brandTheme?.primary) themeStyle["--primary"] = brandTheme.primary;
  if (brandTheme?.primaryForeground) themeStyle["--primary-foreground"] = brandTheme.primaryForeground;

  return (
    <SidebarProvider style={themeStyle as any}>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-background/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="min-w-0 flex-1">
            {greetingName && (
              <p className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Hello {greetingName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <TagLogo variant="wordmark" heightClass="h-14" />
          </div>
        </header>
        <CommandPalette />
        <main className="flex-1 px-4 pb-24 pt-8 sm:px-8 sm:py-10 md:pb-10">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
