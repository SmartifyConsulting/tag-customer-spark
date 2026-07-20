import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { completeSignup } from "@/lib/signup.functions";
import { setRetailerLogoFromWebsite } from "@/lib/settings.functions";

export type AppRole = "super_admin" | "retail_admin" | "store_manager" | "sales_assistant";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Administrator",
  retail_admin: "Retail Administrator",
  store_manager: "Store Manager",
  sales_assistant: "Sales Assistant",
};

const ROLE_RANK: Record<AppRole, number> = {
  super_admin: 4,
  retail_admin: 3,
  store_manager: 2,
  sales_assistant: 1,
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeSignupFn = useServerFn(completeSignup);
  const setLogoFromWebsiteFn = useServerFn(setRetailerLogoFromWebsite);
  const provisioningAttempted = useRef(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // "SIGNED_IN" only fires for an actual sign-in action completing —
        // credentials submitted, a confirmation/magic link processed, OAuth
        // callback — never for a session silently restored on page load
        // (that's "INITIAL_SESSION"). Only that case should navigate the
        // browser onward; a session restore shouldn't hijack whatever
        // protected page the user is already looking at.
        const isFreshSignIn = event === "SIGNED_IN";
        // defer to avoid deadlock
        setTimeout(() => loadProfileAndRoles(newSession.user.id, isFreshSignIn), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      setSession(initial);
      setUser(initial?.user ?? null);
      if (initial?.user) {
        loadProfileAndRoles(initial.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derives the retailer's logo from the company website entered at signup
  // (stored in the auth user's metadata) via Clearbit — no file upload
  // needed. Best-effort: a failure here shouldn't block onboarding, since
  // the logo can always be set manually in Settings later.
  const applyLogoFromWebsite = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const website = data.user?.user_metadata?.website as string | undefined;
      if (!website) return;
      await setLogoFromWebsiteFn({ data: { website } });
    } catch {
      // Non-fatal.
    }
  };

  // `isFreshSignIn` (only true on the "SIGNED_IN" event) decides whether
  // this call navigates the browser onward. On a fresh sign-in we always
  // send the user to /dashboard; the /_authenticated onboarding gate then
  // bounces them to /setup if their retailer hasn't finished onboarding.
  // Deciding "setup vs dashboard" here (the old approach) was a one-shot,
  // race-prone guess; the DB-backed gate is the single source of truth now.
  const loadProfileAndRoles = async (userId: string, isFreshSignIn = false) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role, retailer_id").eq("user_id", userId),
    ]);
    setProfile(prof ?? null);
    let rows = (roleRows ?? []) as { role: AppRole; retailer_id: string | null }[];

    // Provision a retailer for a session that has none yet. Idempotent
    // server-side. Covers every entry path uniformly (confirmation link,
    // magic link, OAuth, manual sign-in/sign-up). The `rows.length === 0`
    // branch (fresh sign-in only) also covers the case where the
    // handle_new_user trigger row isn't visible to this query yet.
    // complete_signup() handles either state safely, and the new retailer
    // starts un-onboarded so the gate will route them into /setup.
    const noRetailerYet =
      (rows.length > 0 && rows.every((r) => !r.retailer_id)) ||
      (isFreshSignIn && rows.length === 0);
    if (!provisioningAttempted.current && noRetailerYet) {
      provisioningAttempted.current = true;
      try {
        await completeSignupFn({ data: {} });
        const { data: refreshed } = await supabase
          .from("user_roles")
          .select("role, retailer_id")
          .eq("user_id", userId);
        rows = (refreshed ?? []) as { role: AppRole; retailer_id: string | null }[];
        if (rows.some((r) => r.retailer_id)) {
          await applyLogoFromWebsite();
        }
      } catch {
        // No pending invite/metadata to provision from — leave as-is.
      }
    }

    if (isFreshSignIn) {
      navigate({ to: "/briefing", replace: true });
    }

    setRoles(rows.map((r) => r.role));
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const primaryRole = useMemo<AppRole | null>(() => {
    if (roles.length === 0) return null;
    return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
  }, [roles]);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    roles,
    primaryRole,
    loading,
    hasRole: (role) => roles.includes(role),
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Convenience helpers so nav filters and delete buttons don't have to
// duplicate the role list in every consumer.
export function useIsAdmin() {
  const { hasRole } = useAuth();
  return hasRole("super_admin") || hasRole("retail_admin") || hasRole("store_manager");
}

export function useIsSuperAdmin() {
  const { hasRole } = useAuth();
  return hasRole("super_admin");
}
