## Plan: Use default backend auth emails

You don't need to do anything — and I don't need to build anything new.

### What this means
- **Password reset, email verification, magic links** → sent automatically by the backend's built-in email service using its default sender. They already work today on your project.
- **No SMTP screen, no Resend SMTP, no DNS records** required from you.
- **Resend stays wired up** for the things we already built: customer campaign emails, staff invitations, daily AI briefing, weekly ROI report, and the test-send button in Settings → Emails. Those continue to send from `noreply@mypenguin.co.za`.

### What I'll change
- Update the warning card in **Settings → Emails** so it no longer tells you to configure SMTP. Instead it will state plainly that auth emails use the backend's default sender, and that branding them is optional (requires verifying a sender subdomain — only if you ever want them on your domain).

That's the entire change. One small UI copy edit, no backend work.

### What you should verify once
On the login page, click **Forgot password?**, enter your email, and confirm the reset email arrives (check spam the first time). If it lands, you're done.
