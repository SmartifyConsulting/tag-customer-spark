Delete two user accounts fully from the database.

## Targets
- `Gorgy Porgy` — profile id `674b6f17-51e2-4397-ae69-e4054ff12ace`
- `Gina Apples` — profile id `eb498e5c-2259-4953-bc5f-5b9d747dbad0`

## Steps
1. Run a migration (SQL-only) that, for each of the two user ids:
   - Deletes rows from `public.user_roles` where `user_id` matches.
   - Deletes rows from `public.staff` where `user_id` matches.
   - Deletes rows from `public.profiles` where `id` matches.
   - Deletes the user from `auth.users` (cascades any auth-managed rows).
2. Any other `public` tables with FKs to `auth.users`/`profiles` cascade automatically via existing `ON DELETE CASCADE`; if a FK without cascade blocks the delete, add a targeted delete for that table in the same migration.

## Not in scope
- No code changes.
- No other accounts touched (the two `Georgia Adams` profiles remain).