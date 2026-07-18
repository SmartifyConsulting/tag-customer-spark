import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import { PasswordInput } from "@/components/password-input";
import { GoogleIcon } from "@/components/google-icon";
import { lovable } from "@/integrations/lovable/index";
import { mapAuthError } from "@/lib/auth-errors";
import { SIGNUP_COUNTRIES } from "@/lib/countries";

// The full two-step sign-up wizard, extracted so it can be dropped either
// inside AuthShell's card (the dedicated /auth page) or inline as a
// centered modal on the hero page — same logic, no drift between the two
// entry points. Doesn't render its own title/border; the parent supplies
// that via AuthCardFrame.
export function CreateAccountCard({
  onSwitchToSignIn,
  onEmailConfirmationSent,
}: {
  onSwitchToSignIn?: () => void;
  onEmailConfirmationSent?: (email: string) => void;
}) {
  const navigate = useNavigate();
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suCompany, setSuCompany] = useState("");
  const [suCountry, setSuCountry] = useState("ZA");
  const [suProvince, setSuProvince] = useState("");
  const [suBranchName, setSuBranchName] = useState("");
  const [suWebsite, setSuWebsite] = useState("");

  const handleContinueToCredentialsStep = () => {
    if (!suName.trim()) {
      setInlineError("Please enter your full name.");
      return;
    }
    setInlineError(null);
    setSignupStep(2);
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
        data: {
          full_name: suName,
          company_name: companyName,
          billing_country: country.code,
          currency: country.currency,
          country_name: country.name,
          branch_name: suBranchName.trim() || undefined,
          province: suProvince.trim() || undefined,
          website: suWebsite.trim() || undefined,
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
      if (onEmailConfirmationSent) {
        onEmailConfirmationSent(suEmail);
      } else {
        setConfirmationEmail(suEmail);
      }
      return;
    }

    // Provisioning and the TAG Setup redirect both happen in AuthProvider's
    // onAuthStateChange handler (fires app-wide, regardless of which page
    // this card is mounted on).
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

  if (confirmationEmail) {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm text-foreground">
          Check <span className="font-semibold">{confirmationEmail}</span> for your secure Tag
          sign-in link.
        </p>
        <p className="text-sm text-muted-foreground">
          Didn't get it? Check your spam folder, or{" "}
          <Link to="/auth" className="font-medium text-foreground underline-offset-2 hover:underline">
            try signing in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={signupStep === 1 ? (e) => e.preventDefault() : handleSignUp}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span className={signupStep === 1 ? "text-[color:var(--mint)]" : ""}>
            1. About you
          </span>
          <span aria-hidden>—</span>
          <span className={signupStep === 2 ? "text-[color:var(--mint)]" : ""}>
            2. Login credentials
          </span>
        </div>

        {signupStep === 1 ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="su-name">Full name *</Label>
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
              <Label htmlFor="su-company">Company *</Label>
              <Input
                id="su-company"
                type="text"
                autoComplete="organization"
                placeholder="e.g. Cape Union Mart"
                value={suCompany}
                onChange={(e) => setSuCompany(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-website">Company website</Label>
              <Input
                id="su-website"
                type="text"
                autoComplete="url"
                placeholder="e.g. capeunionmart.co.za"
                value={suWebsite}
                onChange={(e) => setSuWebsite(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="su-branch">Branch name</Label>
                <Input
                  id="su-branch"
                  type="text"
                  placeholder="e.g. Sandton City"
                  value={suBranchName}
                  onChange={(e) => setSuBranchName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-province">Province / State</Label>
                <Input
                  id="su-province"
                  type="text"
                  placeholder="e.g. Gauteng"
                  value={suProvince}
                  onChange={(e) => setSuProvince(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-country">Country *</Label>
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
            {inlineError && (
              <p className="text-sm text-destructive" aria-live="polite">
                {inlineError}
              </p>
            )}
            <Button type="button" className="w-full" onClick={handleContinueToCredentialsStep}>
              Continue
            </Button>
          </>
        ) : (
          <>
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
            </div>
            {inlineError && (
              <p className="text-sm text-destructive" aria-live="polite">
                {inlineError}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setInlineError(null);
                  setSignupStep(1);
                }}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              By creating an account, you agree to Tag's{" "}
              <Link to="/terms" className="underline hover:text-foreground">
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>

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
          </>
        )}
      </form>

      {signupStep === 1 && (
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-2 hover:underline"
            onClick={() => {
              setInlineError(null);
              if (onSwitchToSignIn) onSwitchToSignIn();
              else navigate({ to: "/auth" });
            }}
          >
            Sign in
          </button>
        </p>
      )}
    </>
  );
}
