## Switch auth emails to Lovable's managed setup

The manual "Send Email hook" approach requires Supabase dashboard access, which isn't available on Lovable Cloud. Instead, use Lovable's built-in managed auth emails — same result (branded emails from `noreply@mypenguin.co.za` via your verified domain), no dashboard steps.

### Steps

1. **Confirm the `mypenguin.co.za` email domain** is registered on this project (check via email domain status tool). If not, run through the email domain setup dialog first.
2. **Set up email infrastructure** (`email_domain--setup_email_infra`) — creates the send queue, log, suppression list, and cron on this project's backend.
3. **Scaffold managed auth email templates** (`email_domain--scaffold_auth_email_templates`) — creates 6 branded templates (signup, recovery, magic link, invite, email-change, reauthentication) wired directly into this project's auth. This replaces the manual hook path entirely.
4. **Apply MyPenguin brand styling** to the scaffolded `.tsx` templates (navy `#031C4D`, accent `#10B981`, matching the styling from the current manual template).
5. **Remove the now-unused manual hook**: delete `supabase/functions/send-auth-email/` and its entry in `supabase/config.toml`. Keep the `SEND_EMAIL_HOOK_SECRET` secret in place (harmless, but no longer used).
6. **Test**: trigger a password reset from the app's Forgot Password page and confirm the branded email arrives from `noreply@mypenguin.co.za`.

### What you'll need to do manually

Nothing beyond confirming the plan. All steps run through Lovable tooling — no Supabase dashboard, no hook URL, no secret pasting.

### Technical notes

- Managed templates route through the shared email infrastructure (pgmq queue + cron), so retries, suppression, and bounce handling are handled for you.
- The existing `src/lib/email.server.ts` (Resend gateway for staff invites, briefings, ROI reports) stays as-is — those are transactional app emails, unrelated to auth.
- No frontend changes to `/forgot-password` or `/reset-password` — they already call `supabase.auth.resetPasswordForEmail`, which the managed hook will pick up automatically once scaffolded.
