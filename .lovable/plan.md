# Navy app background

Switch the app's page background from crisp white to Navy Blue, and rebalance the
surrounding tokens so text, cards and borders stay readable on navy.

## What changes (all in `src/styles.css`)

- Page background: Navy Blue `#1F3A5F` (was white)
- Body/foreground text: near-white so copy reads on navy
- Cards, popovers, dropdowns, dialogs: a slightly lighter navy surface (`#26456E`)
  with light text, so panels still separate from the page
- Muted surfaces / table stripes / hovers: soft navy tints instead of grey tints;
  muted text moves to Light Steel Gray `#A7B3C0`
- Borders, dividers and inputs: translucent steel gray on navy
- Sidebar: deep navy surface, light steel text, coral active pill (unchanged accent)
- Coral `#C1272D`, Tangerine `#E8A317` and chart colours stay as they are; the navy
  chart colour is swapped for a lighter steel/sky tone so it stays visible on navy

## Notes

- No layout, component or logic changes — token values only, so every screen picks
  the new background up automatically.
- The auth/hero screen keeps its photo panel; its form card sits on the new navy surface.
- The app stays locked to light mode; this is a navy theme, not dark-mode support.
