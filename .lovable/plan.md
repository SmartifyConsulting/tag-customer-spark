# Logo upload access + new hero image

## 1. Let system admins upload the retailer logo

What we know from checking the database and code:

- Your account (`georgia.adams@smartify.co.za`) holds both `super_admin` and `retail_admin` roles, so it should already pass the check.
- The message "You don't have permission to upload a logo" is produced by the Settings screen itself, before anything is sent to the server — it reads the signed-in user's roles from the auth hook.
- Storage rules on the logo bucket now allow any signed-in user to upload, so the block is on the app side, not the database.

Because the roles exist in the database but the screen still refuses, the likely cause is the roles list the screen reads is empty or partly loaded at the time of the check (a user with two role rows, one of them scoped to a retailer). This is unconfirmed, so the first step is to confirm it.

Steps:
- Inspect what the auth hook actually returns for a multi-role account, and confirm whether the roles list is empty/partial when the Settings page renders.
- Fix the role resolution so every role row for the user is included, and treat "still loading" as not-denied (no error message until roles are known).
- Keep the upload restricted to super admin / retail admin / store manager; other staff still see the friendly explanation.
- Verify by uploading a logo while signed in as your account.

## 2. Replace the hero image

- Register the newly uploaded surf-shop scanning photo as an app asset.
- Point the hero panel and the small-screen banner in the sign-in / sign-up shell at the new image, replacing the current one, with matching alt text.

## Technical notes

- Files touched: `src/hooks/use-auth.ts` (role list), `src/routes/_authenticated/settings.tsx` (loading-aware gate), `src/components/auth-shell.tsx` (hero image), plus a new asset pointer in `src/assets/`.
- No database migration expected; storage policies for `retailer-logos` are already in place.
