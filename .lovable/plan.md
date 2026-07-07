## Scope
Two small presentational changes.

### 1. Remove the notification counts strip
- `src/routes/_authenticated/products.index.tsx`: remove the `<NotificationCountsStrip />` render (line 178) and its import (line 28).
- Delete `src/components/products/notification-counts-strip.tsx`.

### 2. Grey out the orange unread badge in the WhatsApps inbox
- `src/routes/_authenticated/inbox.tsx`: the unread-count badge currently uses `bg-[color:var(--success)]` (which resolves to the warm gold/orange token). Change that badge's className to a neutral grey — `bg-muted text-muted-foreground` — so unread counts appear in grey instead of orange. No other inbox styling changes.

Nothing else touched — no logic, queries, or other components.