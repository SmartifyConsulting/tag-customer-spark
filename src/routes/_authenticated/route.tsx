import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getRetailerBranding } from "@/lib/branding.functions";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { briefingQueryOptions } from "@/lib/dashboard";
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
  const { user } = Route.useRouteContext();
  const brandingFn = useServerFn(getRetailerBranding);
  const branding = useQuery({
    queryKey: ["branding", user?.id],
    queryFn: () => brandingFn(),
    // Only fetch once we actually have a signed-in user; otherwise the
    // serverFn runs without a bearer token and throws "Unauthorized".
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const brandTheme = useBrandTheme(branding.data?.logo_url);
  // Greeting name shown in the top-left of the app header — same source
  // the Briefing page uses so it stays in sync ("Hello Makro Woodmead").
  const briefing = useQuery(briefingQueryOptions);
  const greetingName = briefing.data?.greetingName ?? null;
  const isStaff = useIsStaff();


  const themeStyle: Record<string, string> = {};
  // NOTE: the app background stays fixed — never derive it from the uploaded
  // retailer logo, that was tinting the whole canvas.
  if (brandTheme?.primary) themeStyle["--primary"] = brandTheme.primary;
  if (brandTheme?.primaryForeground) themeStyle["--primary-foreground"] = brandTheme.primaryForeground;

  return (
    <div className="flex flex-col min-h-screen">
      <SidebarProvider style={themeStyle as any} className="flex-1">
        <AppSidebar />
        <SidebarInset className="bg-background">
          <header className="flex items-center justify-between gap-3 bg-background px-4 pb-3 pt-8 sm:px-6 sm:pt-10">
            <div className="flex items-center gap-3">
              {isStaff && <SidebarTrigger className="md:hidden" />}
              {/* Greeting copy sits to the left, beside the nav — the logo
                  now lives at the top of the left nav panel instead. */}
              {greetingName && (
                <div className="min-w-0">
                  <p className="truncate font-display text-[42px] font-semibold tracking-tight">
                    Hello {greetingName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your daily briefing — freshly tagged products this month, and shoppers waiting
                    on a reply.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 sm:mr-10">
              {/* Retailer's own logo (uploaded in Settings), top-right. Shown
                  with a transparent background so it sits directly on the
                  header rather than in a card; falls back to a generic store
                  placeholder until the retailer uploads one. Always resized
                  into the same fixed circular box, regardless of the
                  uploaded image's own dimensions/shape, so wildly different
                  logo sizes/aspect ratios don't throw off the header. The
                  extra overflow-hidden wrapper (on top of rounded-full on
                  the img itself) guarantees the circular clip holds even
                  for a logo whose own bitmap fills its box edge-to-edge. */}
              {branding.data?.logo_url ? (
                <div className="h-[6.175rem] w-[6.175rem] overflow-hidden rounded-full">
                  <img
                    src={branding.data.logo_url}
                    alt={branding.data.name ?? "Retailer logo"}
                    className="h-full w-full rounded-full object-cover bg-transparent"
                  />
                </div>
              ) : (
                <div
                  className="flex h-[6.175rem] w-[6.175rem] items-center justify-center rounded-full bg-transparent text-muted-foreground/50"
                  title="No logo uploaded yet — add one in Settings"
                >
                  <Store className="h-14 w-14" />
                </div>
              )}
              {!isStaff && <UserMenu />}
            </div>
          </header>

          <CommandPalette />
          <main
            className={
              isStaff
                ? "relative z-30 flex-1 px-4 pb-24 pt-8 sm:px-6 sm:py-10 md:pb-10"
                : "relative z-30 flex-1 px-4 pb-24 pt-8 sm:px-6 sm:py-10"
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
