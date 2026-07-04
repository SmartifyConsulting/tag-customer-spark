# Wire the Supabase Send-Email hook

Configure the Supabase Auth "Send Email" hook to call the deployed `send-auth-email` edge function, signed with the existing `SEND_EMAIL_HOOK_SECRET`.

## Steps

1. Deploy `send-auth-email` to make sure it's live.
2. Call the Supabase Management API to update auth config:
   - `hook_send_email_enabled = true`
   - `hook_send_email_uri = https://wgiktarhvepatqssryfg.supabase.co/functions/v1/send-auth-email`
   - `hook_send_email_secrets = v1,whsec_<base64(SEND_EMAIL_HOOK_SECRET)>` (Supabase's required format; the edge function already normalizes this same shape when verifying)
3. Trigger a test recovery email via `resetPasswordForEmail` for a test address and check edge-function logs to confirm delivery through Resend.

No frontend/UI changes.
