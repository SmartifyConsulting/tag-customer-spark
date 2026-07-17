export function mapAuthError(err: unknown, context: "signin" | "signup" | "reset" = "signin"): string {
  const msg = (err as { message?: string })?.message ?? String(err ?? "");
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Email or password is incorrect.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email address to continue.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "That email is already registered. Try signing in instead.";
  }
  if (m.includes("password should be at least")) {
    return "Password must be at least 8 characters.";
  }
  if (m.includes("pwned") || m.includes("compromised") || m.includes("leaked")) {
    return "This password appeared in a public breach — please choose another.";
  }
  if (m.includes("too weak") || m.includes("weak password")) {
    return "That password is too simple — add more length, or mix in numbers and symbols.";
  }
  if (m.includes("should contain at least") || m.includes("must contain")) {
    // Supabase's own message here is already specific (e.g. "must contain
    // at least one uppercase, one number") — pass it through rather than
    // masking it with a generic one.
    return msg;
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (m.includes("network") || m.includes("failed to fetch")) {
    return "Network problem — please try again.";
  }
  if (context === "reset" && m.includes("same as")) {
    return "New password must differ from your current password.";
  }
  // Fall back to Supabase's own message rather than a generic "something
  // went wrong" — its auth error strings are already written for end users
  // (e.g. "Signups not allowed for this instance"), so surfacing them
  // directly is more useful than hiding them behind a vague catch-all.
  return msg && msg.length < 160 ? msg : "Something went wrong. Please try again.";
}
