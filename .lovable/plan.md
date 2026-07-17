The screenshot you shared is the **/auth** sign-in page, not the /about landing page I edited last turn. The logo you're pointing at is rendered by `src/components/auth-shell.tsx`, which uses its own size class (`h-[19.2rem]`) — my previous change only touched `src/routes/about.tsx`, so this page was unaffected.

## Change

In `src/components/auth-shell.tsx`, update the desktop hero logo:

- Height: `h-[19.2rem]` → `h-[11.52rem]` (40% smaller, aspect ratio preserved via `w-auto`)
- Vertical position: add `mt-[2cm]` to shift it down 2cm

The mobile logo (shown only under `lg:hidden`, currently `h-[12.8rem]`) will be left as-is unless you want it resized too.

No other files change.