# Restore WhatsApp delivery after “Follow Me”

## Confirmed diagnosis

- The latest Baby Blue Jumper opt-in was saved successfully for the customer and product.
- The latest `tag_scan_v5` attempt failed before WhatsApp accepted it: Infobip returned **“Invalid login details”** and no provider message ID.
- The product watch is still `paused` with notifications disabled, despite the current opt-in flow intending to activate it immediately.
- Therefore this is not a phone-number, barcode-matching, or template-parameter problem on the latest attempt. The active Infobip credentials are being rejected, and the saved watch state also needs repair.

## Fix plan

1. **Validate the Infobip connection directly**
   - Securely replace/reconfirm the Infobip API key and personal base URL without exposing either value.
   - Send a minimal authenticated request to Infobip first, so incorrect credentials are caught before testing a WhatsApp template.
   - Confirm the configured sender belongs to the same Infobip account as the API key.

2. **Repair the Follow Me transaction**
   - Make watch creation/update check and surface database errors instead of silently continuing.
   - Ensure every successful Follow Me submission saves the watch as `active` with `notifications_enabled = true`.
   - Repair the existing Baby Blue Jumper watch after the corrected flow is in place.

3. **Make confirmation delivery observable**
   - Record the `tag_scan_v5` confirmation outcome consistently for both QR and barcode opt-in routes.
   - Return a clear delivery failure to the Follow Me UI when Infobip rejects the request, while preserving the customer’s opt-in.
   - Keep the approved template contract unchanged: IMAGE header and zero body placeholders.

4. **End-to-end verification**
   - Submit Follow Me for Baby Blue Jumper.
   - Verify the watch is active, the delivery has a provider message ID, and the status progresses beyond failed/queued through the delivery webhook.
   - Then lower the product price and confirm `tag_valuechange` sends with exactly the approved old-price and new-price placeholders.

## Technical scope

- Infobip configuration and delivery diagnostics.
- Barcode/QR opt-in endpoints and watch persistence error handling.
- Existing watch repair and a live confirmation/price-drop test.
- No AI functionality and no unrelated application changes.