import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TagLogo } from "@/components/tag-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { Separator } from "@/components/ui/separator";
import { CommandPalette } from "@/components/command-palette";
import { Command as CommandIcon } from "lucide-react";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getRetailerBranding } from "@/lib/branding.functions";
import { useBrandTheme } from "@/hooks/use-brand-theme";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Onboarding gate: if this user's retailer hasn't finished the Setup
    // Wizard yet, send them there before rendering any authenticated page.
    // This is a persistent, DB-backed check (retailers.onboarding_completed_at)
    // that runs on every authenticated load — so a new user can never slip
    // past setup due to a timing race or a reload, which was the old
    // one-shot-redirect bug. /setup lives outside this route, so redirecting
    // to it can't loop.
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
          {/* The sidebar's own logo is fitted to its 16rem width, so it can't
              also be the +70%-larger mark that was requested — that size only
              fits in this wide bar next to it. */}
          <div className="hidden shrink-0 pt-3 md:block">
            <TagLogo variant="wordmark" heightClass="h-[10.608rem]" />
          </div>
          <button
            onClick={() => {
              const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
              window.dispatchEvent(ev);
            }}
            className="hidden h-9 items-center gap-2.5 rounded-full border border-border bg-muted/40 px-3.5 text-xs text-muted-foreground transition-colors hover:border-[color:var(--mint)]/40 hover:bg-card lg:flex"
          >
            <CommandIcon className="h-3.5 w-3.5" /> Search anything…
            <kbd className="ml-2 rounded-md bg-[color:var(--mint)]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[color:var(--mint)]">
              ⌘K
            </kbd>
          </button>
          <Separator orientation="vertical" className="mx-1 hidden h-5 lg:block" />
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <UserMenu />
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
