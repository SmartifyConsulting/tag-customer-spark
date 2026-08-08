# Why that test send worked — and how to make the app work the same way

## What your curl shows

Your working test used an API key ending **`66c1`**.

The key the app is currently using ends differently — its fingerprint is `28b989c2f2e5d3e7` (69 characters), the key shown in your Infobip screenshot ending `72ed`. That key returns **401 "Invalid login details"** from our servers on every call, even a plain balance check.

Everything else in your curl matches what the app already sends: same host (`k9v331.api.infobip.com`), same endpoint (`/whatsapp/1/message/template`), same sender `15553467608`, same `Authorization: App <key>` header shape.

So the difference isn't the network, the template, or the code. It's simply **a different, working key**.

## The fix

1. You give me the full working key (the one ending `66c1`) — paste it in chat and I'll store it as a secret; it won't appear in code.
2. I store it as `INFOBIP_API_KEY_V2` (the binding the app prefers) and redeploy.
3. I run the auth probe from the live site to confirm it returns 200 instead of 401.
4. I send a live `tag_scan_v5` to +27 82 801 4801 through the same runtime path the Follow Me button uses.
5. I do a real Follow Me opt-in on the live passport page and confirm the message lands and the watch is created.

## Note on template parameters

Your test template `test_whatsapp_template_en` takes one body placeholder. The production templates (`tag_scan_v5`, `tag_interest`, `tag_lastunit`) take **zero** body placeholders — that's already enforced in `whatsapp-templates.server.ts`, so no change needed there. Price-drop templates keep their named variables.

## Technical detail

- Key bindings read at runtime: `INFOBIP_API_KEY_V2`, then `INFOBIP_API_KEY` (`src/lib/whatsapp-infobip.server.ts`).
- No code change is expected — this is a credential swap plus verification. If the new key also 401s from the worker but works from a neutral machine, that reopens the network-restriction theory and I'll say so plainly rather than guessing.
