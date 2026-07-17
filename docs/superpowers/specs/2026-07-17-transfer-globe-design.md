# Transfer Globe — Design Decisions (v1)

Companion to `prd.md`. The PRD is the authoritative spec; this doc resolves its
open questions (§12) and records one architectural deviation discovered during
design.

## Resolved open questions

1. **Seasons/windows in v1 dataset:** the three windows named in the PRD —
   `2024/25 Summer`, `2024/25 Winter`, `2025/26 Summer`. Default on load:
   `2025/26 Summer` (most recent, biggest fees).
2. **League scope:** the Big 5 are the filterable leagues. The dataset also
   includes counterparty clubs from selling/buying markets (Primeira Liga,
   Eredivisie, Saudi Pro League, Brazil, etc.) grouped as "Other" so migration
   pipelines are visible. Every transfer involves at least one Big 5 club; the
   league filter matches a transfer if **either** end is in a selected league.
3. **Marker size:** driven by the club's total gross activity (spend + sales)
   in the active window — the PRD's own preference ("more relevant to the
   transfer theme"). Clubs with no activity in the window render at minimum size.
4. **Loans / free / undisclosed transfers:** always included in **Player
   Migration** mode at full weight. In **Money Flow** mode they render at
   minimum arc width in a distinct muted color (legend explains); they don't
   contribute to net-spend fee totals but are listed in the club panel with a
   "Loan"/"Free" tag.

## Architectural note: native markers, custom arc overlay

COBE 2.0 (what we installed) natively supports per-marker colors/sizes and
arcs with per-arc color — but arc **width is global** and arcs are static, so
neither fee-magnitude width nor from→to direction can be encoded natively.
Also, v2 has no internal animation loop: the caller drives rendering with
`globe.update({phi, ...})` each frame. Design:

- **COBE renders the sphere, glow, and club markers** (per-marker size =
  window activity, per-marker color = selection state). Native arcs unused.
- **A 2D `<canvas>` overlay draws transfer arcs**: slerp great-circle points
  lifted by altitude, per-arc width (fee), per-arc color (tier/mode), animated
  dash flow encoding from→to direction, far-side culling. It reuses COBE's own
  projection math (extracted from source: `U(latLng)` → 3D, orthographic
  projection at sphere radius 0.8, same phi/theta we drive), so arcs meet
  markers exactly — no calibration.
- Click/hover selection = hit-testing projected marker positions in JS with
  the same projection. Tooltips are DOM elements positioned from it too — no
  dependency on CSS Anchor Positioning browser support.

## Everything else

As specified in the PRD: Next.js 15 App Router + Tailwind, static JSON in
`/public/data`, `lib/data.ts` → `lib/transforms.ts` → `lib/encoding.ts` flow,
Recharts mini-chart in the club panel, dark theme default, Vercel-ready.
Fees are approximate figures compiled from public reporting (noted in the
About text). Pure lib functions get vitest coverage; the WebGL/canvas layer is
verified visually.
