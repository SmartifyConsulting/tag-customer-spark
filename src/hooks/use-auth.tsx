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

  // `isFreshSignIn` (only true on the "SIGNED_IN" event) is what decides
  // whether this call is responsible for navigating the browser onward.
  // This is the single place that owns post-auth navigation now — auth.tsx
  // no longer does its own, so there's only one navigate() decision instead
  // of two racing ones (the second always used to win a moment later,
  // producing a visible flash to the wrong page first).
  const loadProfileAndRoles = async (userId: string, isFreshSignIn = false) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role, retailer_id").eq("user_id", userId),
    ]);
    setProfile(prof ?? null);
    let rows = (roleRows ?? []) as { role: AppRole; retailer_id: string | null }[];
    let routedToSetup = false;

    // Safety net: a session with no retailer_id yet — try provisioning
    // once. Idempotent server-side. Covers every entry path uniformly
    // (confirmation link, magic link, OAuth, manual sign-in/sign-up), so
    // it's also where "send a brand-new owner into TAG Setup" has to live.
    if (!provisioningAttempted.current && rows.length > 0 && rows.every((r) => !r.retailer_id)) {
      provisioningAttempted.current = true;
      try {
        await completeSignupFn({ data: {} });
        const { data: refreshed } = await supabase
          .from("user_roles")
          .select("role, retailer_id")
          .eq("user_id", userId);
        rows = (refreshed ?? []) as { role: AppRole; retailer_id: string | null }[];
        // Went from "no retailer at all" to "has one" in this exact call —
        // this account's very first usable moment, whether as a brand-new
        // owner or a staff invite just being attached. Don't try to tell
        // those two apart via complete_signup's return value (that
        // depends on a migration that may not be deployed yet, and this
        // redirect kept silently failing because of it) — the observable
        // before/after state alone is enough, and seeing the wizard once
        // is harmless even for an invited staff member.
        if (rows.some((r) => r.retailer_id)) {
          navigate({ to: "/setup", replace: true });
          routedToSetup = true;
          await applyLogoFromWebsite();
        }
      } catch {
        // No pending invite/metadata to provision from — leave as-is.
      }
    }

    if (isFreshSignIn && !routedToSetup) {
      navigate({ to: "/dashboard", replace: true });
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
