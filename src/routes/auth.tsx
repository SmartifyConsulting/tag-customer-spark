import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { mapAuthError } from "@/lib/auth-errors";
import { SIGNUP_COUNTRIES } from "@/lib/countries";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Tag" }] }),
  component: AuthPage,
});

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suCompany, setSuCompany] = useState("");
  const [suCountry, setSuCountry] = useState("ZA");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: siEmail,
      password: siPassword,
    });
    if (error) {
      setLoading(false);
      const friendly = mapAuthError(error, "signin");
      setInlineError(friendly);
      toast.error(friendly);
      return;
    }
    // Provisioning AND navigating onward (to TAG Setup on a first-ever
    // confirmation, /dashboard otherwise) happens in AuthProvider's
    // onAuthStateChange handler, which fires for this sign-in the same as
    // any other — doing it here too would race it and flash the wrong
    // page first. See use-auth.tsx.
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    setLoading(true);
    const country = SIGNUP_COUNTRIES.find((c) => c.code === suCountry) ?? SIGNUP_COUNTRIES[0];
    const companyName = suCompany.trim() || `${suName}'s workspace`;
    const { data, error } = await supabase.auth.signUp({
      email: suEmail,
      password: suPassword,
      options: {
        emailRedirectTo: window.location.origin,
        // Persisted on the auth user regardless of confirmation state, so
        // `complete_signup` can still use it if it only runs later, via
        // AuthProvider's safety net, once the user actually has a session.
        data: {
          full_name: suName,
          company_name: companyName,
          billing_country: country.code,
          currency: country.currency,
          country_name: country.name,
        },
      },
    });
    if (error) {
      setLoading(false);
      const friendly = mapAuthError(error, "signup");
      setInlineError(friendly);
      toast.error(friendly);
      return;
    }

    if (!data.session) {
      // Email confirmation is required — no session yet, so provisioning
      // (and the TAG Setup redirect) happens later via AuthProvider's
      // safety net, whichever way they end up with a session: clicking
      // the confirmation link directly, or signing in here manually.
      // Supabase's own built-in confirmation email is unreliable (the same
      // reason password reset was moved off it — see send-password-reset),
      // so send a proper one through the same Resend-based function.
      const { error: confirmationError } = await supabase.functions.invoke(
        "send-signup-confirmation",
        {
          body: { email: suEmail, redirectTo: window.location.origin },
        },
      );
      setLoading(false);
      if (confirmationError) {
        const friendly = "We couldn't send the confirmation email. Please try again.";
        setInlineError(friendly);
        toast.error(friendly);
        return;
      }
      toast.success("Check your email for your secure Tag sign-in link.");
      setMode("signin");
      setSiEmail(suEmail);
      return;
    }

    // Provisioning and the TAG Setup redirect both happen in AuthProvider's
    // onAuthStateChange handler (signUp() with an immediate session fires
    // "SIGNED_IN" the same as a manual sign-in). It reads the company
    // name/country from the auth user's metadata — set above via
    // options.data — via a fallback in completeSignup, so there's no need
    // to call it again here with the form values; doing so raced
    // AuthProvider's own check and produced a flash to /dashboard first.
    setLoading(false);
    toast.success("Welcome to Tag");
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error("Google sign-in failed.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <AuthShell
      title={mode === "signin" ? "Welcome back" : "Create your Tag account"}
      subtitle={
        mode === "signin"
          ? "Reconnect with in-store shoppers and recover lost sales."
          : "Start recovering lost sales in under a minute."
      }
    >
      {mode === "signin" ? (
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="si-email">Email</Label>
            <Input
              id="si-email"
              type="email"
              autoComplete="email"
              required
              value={siEmail}
              onChange={(e) => setSiEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="si-password">Password</Label>
            <PasswordInput
              id="si-password"
              autoComplete="current-password"
              required
              value={siPassword}
              onChange={(e) => setSiPassword(e.target.value)}
            />
          </div>
          {inlineError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {inlineError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <div className="text-right">
            <Link
              to="/forgot-password"
              tabIndex={-1}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="su-name">Full name</Label>
            <Input
              id="su-name"
              type="text"
              autoComplete="name"
              required
              value={suName}
              onChange={(e) => setSuName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-email">Email</Label>
            <Input
              id="su-email"
              type="email"
              autoComplete="email"
              required
              value={suEmail}
              onChange={(e) => setSuEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-company">Company / workspace name</Label>
            <Input
              id="su-company"
              type="text"
              autoComplete="organization"
              placeholder="e.g. Cape Union Mart"
              value={suCompany}
              onChange={(e) => setSuCompany(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              If you were invited to an existing workspace, this is ignored — you'll join that one
              instead.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-country">Country</Label>
            <Select value={suCountry} onValueChange={setSuCountry}>
              <SelectTrigger id="su-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIGNUP_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-password">Password</Label>
            <PasswordInput
              id="su-password"
              autoComplete="new-password"
              required
              minLength={8}
              value={suPassword}
              onChange={(e) => setSuPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          {inlineError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {inlineError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      )}

      <div className="my-5 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        <GoogleIcon />
        {googleLoading ? "Connecting…" : "Continue with Google"}
      </Button>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {mode === "signin" ? (
          <>
            New to Tag?{" "}
            <button
              type="button"
              className="font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setInlineError(null);
                setMode("signup");
              }}
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setInlineError(null);
                setMode("signin");
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </AuthShell>
  );
}
