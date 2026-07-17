import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { CreateAccountCard } from "@/components/create-account-card";
import { GoogleIcon } from "@/components/google-icon";
import { lovable } from "@/integrations/lovable/index";
import { mapAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Tag" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

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
        <>
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
            New to Tag?{" "}
            <button
              type="button"
              className="font-bold text-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setInlineError(null);
                setMode("signup");
              }}
            >
              Create an account
            </button>
          </p>
        </>
      ) : (
        <CreateAccountCard
          onSwitchToSignIn={() => setMode("signin")}
          onEmailConfirmationSent={(email) => {
            setMode("signin");
            setSiEmail(email);
          }}
        />
      )}
    </AuthShell>
  );
}
