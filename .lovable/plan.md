# Fix: no WhatsApp after scanning / price drop on Baby Blue Jumper

## What I found (verified against the live data and the WhatsApp provider)

1. **The WhatsApp sender number is wrong.** The account now has exactly one registered sender: `15553467608` ("Tag", CONNECTED). The app is still configured with the old Infobip demo sender ending `8970`, which no longer belongs to the account. A live test send with the current configuration came back `REJECTED_SOURCE — Invalid Source address`, and the sender's template list returns `Sender does not belong to account`.

2. **Every scan message has failed at the provider.** The last four scan notifications are all `status: failed` — the most recent one (22:30 today, template `tag_scan_v5`) with `Invalid login details`, which points at the stored API key/sender pair being stale as well.

3. **The price drop could not have alerted you even if sending worked.** The only watch on Baby Blue Jumper is `status: paused`, `notifications_enabled: false` — that is by design: the watch only goes live when you tap "Keep an eye on me" on the scan message. Since that message never arrived, the watch never activated, so the price change (785 → 400) had no active watcher to notify.

Good news: the templates themselves are fine — `tag_scan_v5`, `tag_valuechange`, `tag_interest` and `tag_lastunit` are all APPROVED with IMAGE headers on the correct sender.

## The fix

1. **Point delivery at the correct sender.** Update the stored WhatsApp sender to `15553467608` and re-save the Infobip API key so the deployed app uses the same credentials that authenticate successfully.
2. **Verify with a real send** to +27 82 801 4801 using `tag_scan_v5` with the Baby Blue Jumper photo as the header, and confirm the provider accepts it (no REJECTED status).
3. **Re-run the scan flow end-to-end**: scan the jumper, receive `tag_scan_v5`, tap "Keep an eye on me", and confirm the watch flips from `paused` to `active` with a fresh price snapshot.
4. **Re-test the price drop**: with the watch active, change the price and confirm `tag_valuechange` goes out with the old and new price.
5. **Surface send failures in the app** instead of them only living in the notification history table — show a clear warning on the Automations settings screen when the last outbound WhatsApp failed, with the provider's reason, so a broken sender is visible immediately rather than as silence.

## Technical notes

- Secrets to update: `INFOBIP_WHATSAPP_SENDER` → `15553467608`; re-enter `INFOBIP_API_KEY`.
- No code change is needed for the sender itself — `src/lib/whatsapp-infobip.server.ts` reads it from the environment.
- Step 5 touches `src/components/settings/automation-settings.tsx` plus a read of the latest failed `notification_history` row.
- The paused-until-opt-in behaviour in `src/routes/api/public/scan.barcode-interest.ts` stays as is; it is working correctly.
