import { Link } from "@tanstack/react-router";
import { LogOut, Repeat, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, ROLE_LABELS } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { listRememberedSessions } from "@/lib/session-switcher";

async function switchTo(session: { access_token: string; refresh_token: string; email: string }) {
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) {
    toast.error(`Could not switch to ${session.email} — sign in to that account again`);
    return;
  }
  window.location.reload();
}

/** Initials from the profile name, falling back to the email local part. */
function initialsFor(name: string): string {
  const source = name.includes("@") ? name.split("@")[0]!.replace(/[._-]+/g, " ") : name;
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : "")).toUpperCase();
}

export function UserMenu() {
  const { user, profile, primaryRole, signOut } = useAuth();
  if (!user) return null;
  const name = profile?.full_name || user.email || "";
  const otherSessions = listRememberedSessions().filter((s) => s.email !== user.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 px-2 py-1">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initialsFor(name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden truncate text-sm font-medium max-w-[140px] sm:inline">
            {name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium truncate">{name}</span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            {primaryRole && (
              <span className="mt-1 inline-flex w-fit rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {ROLE_LABELS[primaryRole]}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>
        {otherSessions.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Switch profile
            </DropdownMenuLabel>
            {otherSessions.map((s) => (
              <DropdownMenuItem key={s.email} onClick={() => void switchTo(s)} className="flex items-center gap-2">
                <Repeat className="h-4 w-4" /> {s.email}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
