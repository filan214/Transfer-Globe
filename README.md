# Transfer Globe

An interactive 3D globe of football transfers. Clubs sit on the globe at their
stadium coordinates; every transfer draws an animated arc from the selling club
to the buying club, with the arc's width and color encoding the fee. Spin the
globe, switch transfer windows, filter by league, and click any club to open
its window: transfers in and out, net spend, and its biggest signing.

## Features

- **Money Flow mode** — one arc per transfer, colored by fee tier
  (< €20m → €75m+, with loans and frees in muted slate) and sized by fee.
  A pulse travels each arc from seller to buyer.
- **Player Migration mode** — arcs bundle by route and thicken with the number
  of players moved, regardless of fee.
- **Three windows** — 2024/25 Summer, 2024/25 Winter, and 2025/26 Summer,
  with headline totals for the selected window.
- **League filters** — the big five European leagues plus "Other"
  (Saudi Pro League, MLS, Brazil, Portugal, and more).
- **Club detail panel** — spend vs. income, net balance, biggest signing, and
  full in/out lists for the selected window.

## How it's built

- [Next.js 15](https://nextjs.org) (App Router) + Tailwind CSS v4
- [COBE](https://github.com/shuding/cobe) renders the WebGL globe; arcs,
  markers, tooltips, and hit-testing are drawn on a 2D canvas overlay that
  reuses COBE's own projection math, so everything stays pixel-aligned
- [Recharts](https://recharts.org) for the club panel's spend/income chart
- A curated static dataset (`public/data/`): 97 clubs and 334 real transfers
  across three windows. Fees are reported figures in €m; treat them as
  illustrative, not gospel.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
```

```bash
npm test        # vitest unit tests for the data transforms and encodings
npm run build   # production build
```

## Deploy

Static output with no server dependencies — deploys as-is to
[Vercel](https://vercel.com)'s free tier.
