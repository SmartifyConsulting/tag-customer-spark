# Restore the profile avatar and name in the sidebar footer

Bring back the old bottom-left profile row — a round avatar with the user's initials next to their name — and put the Tag Barcode Reader QR code directly above it.

## What changes

1. **Profile row (bottom left)**
   - The user menu trigger shows a circular avatar with initials derived from the profile name (falling back to the email), followed by the name.
   - Clicking it still opens the same dropdown (Profile, Settings, Switch profile, Sign out) — no change to that menu.

2. **QR code above the profile row**
   - The Tag Barcode Reader QR moves out of the avatar slot and sits as its own block in the sidebar footer, directly above the avatar + name row, left-aligned with it.
   - It stays a scannable, tappable link to the barcode reader.

3. **Header**
   - The same user menu appears at top right; with the avatar restored it will show initials there instead of the oversized QR, which is what it looked like before.

## Technical notes

- `src/components/user-menu.tsx`: replace `TagReaderQrBadge` in the trigger with an `Avatar` / `AvatarFallback` showing initials; keep the name span and the dropdown contents unchanged.
- `src/components/app-sidebar.tsx`: render the reader QR in `SidebarFooter` above `<UserMenu />`, aligned with the search field and profile row.
- `src/components/qr/tag-reader-tile.tsx`: unchanged component API; the sidebar uses a size appropriate for the footer rather than the 228px avatar size.
