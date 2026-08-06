# Restore WhatsApp delivery

## Confirmed diagnosis

- The latest Baby Blue Jumper scan reached the production barcode endpoint at 22:46 UTC.
- Infobip rejected `tag_scan_v5` with **401: Invalid login details**, before a provider message ID was created.
- The product watch is still **paused** because the initial message never arrived and its “Keep an eye on me” button could not be tapped.
- A paused watch intentionally does not send price-drop alerts.

## Plan

1. **Replace and validate the Infobip credentials**
   - Securely update both `INFOBIP_API_KEY` and `INFOBIP_BASE_URL` from the same Infobip account.
   - Keep the registered sender `15553467608`.
   - Verify authentication against Infobip before testing the app workflow.

2. **Verify the initial scan message**
   - Send a real `tag_scan_v5` template to the test phone number.
   - Confirm Infobip returns a message ID rather than `401`.
   - Confirm the app records the notification as sent, then delivered if a delivery callback is available.

3. **Restore the product watch flow**
   - Scan Baby Blue Jumper again.
   - Tap **Keep an eye on me** in WhatsApp.
   - Confirm the matching watch changes from paused to active and stores the current price and stock baseline.

4. **Verify the price-drop alert end to end**
   - Reduce the product price after activation.
   - Confirm `tag_valuechange` is submitted with the correct product, recipient, template, and product image.
   - Check both the provider response and the app’s notification history.

5. **Prevent another silent credential failure**
   - Keep the existing Automations failure banner and ensure a 401 clearly identifies the Infobip connection as invalid.
   - Do not mark a scan notification as sent unless Infobip returns a successful response and message ID.

## Required from you during implementation

The Infobip API key and account base URL must be entered through the secure secret form; they should not be pasted into chat.