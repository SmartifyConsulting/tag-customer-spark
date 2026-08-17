# Friendly "account already exists" on sign-up

When someone tries to create an account with an email that is already registered, show a clear message box and send them straight to sign-in with their email pre-filled.

## Behaviour

1. On submit of the sign-up form, if the backend says the email is already registered, stop and replace the form with a small card:
   - Title: "You already have a Tag account"
   - Body: "An account with **{email}** already exists. Sign in instead, or reset your password if you've forgotten it."
   - Primary button: "Go to sign in" → switches to the sign-in tab/page with the email pre-filled.
   - Secondary link: "Forgot password?" → `/forgot-password`.
2. Also show a toast: "That email is already registered — please sign in."
3. Covers the silent case too: some sign-up responses succeed but return a user with no identities and no session, which means the email already exists. Treat that identically instead of showing "check your email".

## Technical notes

- `src/lib/auth-errors.ts` already maps "user already registered" / "already been registered". Add a small exported helper `isExistingAccountError(err)` so the sign-up card can branch on it rather than string-matching the message.
- `src/components/create-account-card.tsx`:
  - Add `existingEmail` state; set it when the error matches, or when `data.user && (data.user.identities?.length ?? 0) === 0 && !data.session`.
  - Render the "already exists" card when set, before the confirmation-email branch.
  - "Go to sign in" calls the existing `onSwitchToSignIn` prop when present, else navigates to `/auth`.
- `src/routes/auth.tsx`: extend the switch handler so the sign-up card can pass the email up and it lands in `siEmail` (same mechanism already used by `onEmailConfirmationSent`).

No backend or database changes.
