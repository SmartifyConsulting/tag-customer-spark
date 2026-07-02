import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { mapAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Tag" }] }),
  component: AuthPage,
});

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.6H12z" />
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPassword });
    setLoading(false);
    if (error) {
      const friendly = mapAuthError(error, "signin");
      setInlineError(friendly);
      toast.error(friendly);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: suEmail,
      password: suPassword,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: suName },
      },
    });
    setLoading(false);
    if (error) {
      const friendly = mapAuthError(error, "signup");
      setInlineError(friendly);
      toast.error(friendly);
      return;
    }
    toast.success("Welcome to Tag");
    navigate({ to: "/dashboard", replace: true });
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
            <p className="text-sm text-destructive" aria-live="polite">{inlineError}</p>
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
            <p className="text-sm text-destructive" aria-live="polite">{inlineError}</p>
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
              onClick={() => { setInlineError(null); setMode("signup"); }}
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
              onClick={() => { setInlineError(null); setMode("signin"); }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </AuthShell>
  );
}
