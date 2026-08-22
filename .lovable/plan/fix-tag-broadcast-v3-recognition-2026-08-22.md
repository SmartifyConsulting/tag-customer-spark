# Fix `tag_broadcast_v3` recognition

## Goal
Allow broadcasts when the live Infobip template is `tag_broadcast_v3` with status **Active – Quality pending**, while continuing to block v1, v2, missing, or genuinely inactive templates.

## Confirmed diagnosis
- The status check already treats any normalized status beginning with `ACTIVE` as sendable.
- The current composer says the template is **not registered**, rather than saying its status is not sendable. This means the failure occurs during the exact template-name lookup before status validation.
- The resolver currently allows an environment override to replace the required v3 name and compares provider names without trimming or case normalization.

## Changes
1. Pin broadcast resolution to the literal `tag_broadcast_v3`; do not allow a stale environment mapping to redirect broadcasts to v1/v2 or another name.
2. Normalize provider template names and statuses before comparison:
   - trim whitespace;
   - compare names case-insensitively;
   - normalize Unicode dash/spacing variants in statuses;
   - accept `APPROVED` and `ACTIVE...`, including `Active – Quality pending`.
3. Keep strict template-contract checks for the required image header, expiry variable, and catalogue URL button; status acceptance must not bypass payload validation.
4. Improve the blocked-state diagnostic so it reports the names/statuses returned for this sender when v3 cannot be matched, instead of incorrectly implying that no template exists.
5. Make the composer refetch template information every time it opens so a previously cached missing-template result cannot keep the button disabled.

## Verification
- Inspect the live template response through the authenticated server function.
- Confirm the composer recognizes `tag_broadcast_v3` as sendable with `Active – Quality pending` and removes the template blocker.
- Confirm v1/v2 remain unusable and the send button is gated only by the required fields and opted-in audience.
