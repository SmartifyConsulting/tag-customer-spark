## Test the Send-Email hook

Verify the Supabase "Send Email" auth hook is wired to `send-auth-email` and delivering via Resend.

### Steps

1. Trigger a password reset for a test address by calling `supabase.auth.resetPasswordForEmail` against the deployed project (or via a quick curl to the auth REST endpoint).
2. Tail `send-auth-email` edge function logs to confirm:
   - The hook fired (request received)
   - Signature verification passed
   - Resend returned 200
3. If logs show no invocation → the hook isn't enabled/URL wrong. If signature fails → secret mismatch. If Resend errors → surface the status/body.
4. Report the outcome and what to fix, if anything.

No code changes.