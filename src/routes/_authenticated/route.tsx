import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { Separator } from "@/components/ui/separator";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { Command as CommandIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
            <SidebarTrigger className="rounded-lg hover:bg-accent" />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <button
              onClick={() => {
                const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
                window.dispatchEvent(ev);
              }}
              className="hidden h-9 items-center gap-2.5 rounded-full border border-border bg-muted/40 px-3.5 text-xs text-muted-foreground transition-colors hover:border-[color:var(--mint)]/40 hover:bg-card sm:flex"
            >
              <CommandIcon className="h-3.5 w-3.5" /> Search anything…
              <kbd className="ml-2 rounded-md bg-[color:var(--mint)]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[color:var(--mint)]">
                ⌘K
              </kbd>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <CommandPalette />
          <main className="flex-1 px-4 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
