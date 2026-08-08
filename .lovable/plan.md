# Infobip key screen: nothing to change here

## What the screenshot confirms

- The key shown ("Tag API Key", ending `72ed`) is the exact key the app uses — the stored value ends in the same four characters and matches the fingerprint the live worker reports.
- It is Enabled, valid until 07/08/2027, and **Allowed IP Addresses is empty** — so this key is not IP-restricted.

So: no change needed on this screen. That also rules out my earlier IP-allowlist theory at the key level.

## What that leaves

The same key returns 200 from a neutral machine and 401 ("Invalid login details") from both the published site and the preview server, on a plain balance check. Since the key bytes are identical and the key is unrestricted, the rejection has to come from something about the request as Infobip receives it from our hosting runtime — either the Authorization header is being altered in transit, or Infobip is blocking our hosting IP range at the account/security layer rather than the key layer.

## Next steps

1. Extend the existing diagnostic endpoint so the live server also calls a neutral request-echo service. That shows exactly what Authorization header value leaves our runtime and whether it arrives intact — this distinguishes "header mangled" from "Infobip refusing our IP".
2. Report the outgoing egress IP the live server uses, so it can be checked against Infobip's account-level restrictions.
3. Depending on the result:
   - Header intact and IP the only difference: the block is account-level on Infobip's side (Account settings, not the API key). You would ask Infobip support to lift the IP/network restriction for the account, quoting the egress IP.
   - Header altered: fix the send path in the app so the credential is transmitted exactly as Infobip expects.
4. Once authentication clears, re-run the live test send and a real Follow Me opt-in end to end, and confirm the `tag_scan_v5` message reaches your phone.

## Things worth checking on your side while I run step 1

- In the same key screen, scroll to **API Scopes** and confirm the WhatsApp send scopes are selected (the balance call working elsewhere suggests they are, but the list is cut off in the screenshot).
- In Infobip **Account settings / security**, check for an account-wide IP restriction separate from this key.

## Technical detail

The probe route is `src/routes/api/public/hooks/infobip-auth-probe`, guarded by the existing shared secret. It currently calls `/account/1/balance` and `/whatsapp/2/senders` and returns status codes plus a one-way key fingerprint. Step 1 adds a third, non-Infobip echo call and returns the observed egress IP and the header shape (never the key itself).
