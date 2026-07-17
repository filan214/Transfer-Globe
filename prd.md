# PRD — Transfer Globe

**Global Football Transfer Market Visualizer**

| | |
|---|---|
| **Version** | 1.0 |
| **Owner** | Filan |
| **Status** | Draft |
| **Last updated** | July 2026 |

---

## 1. Overview

Transfer Globe is an interactive 3D globe that visualizes football player transfers between clubs worldwide. It borrows the visual language of [COBE](https://cobe.vercel.app) — a lightweight WebGL globe with markers and arcs — and applies it to the global transfer market: **markers are clubs, arcs are player moves**, and the whole thing tells a story about how money and talent flow across borders.

It is a portfolio piece first: a self-contained, visually striking web app that demonstrates data handling, API integration, and front-end craft, without depending on paid infrastructure.

---

## 2. Goals & Non-Goals

### Goals
- Render an interactive globe where clubs are plotted by real geographic location.
- Draw transfer arcs between clubs, with visual encoding for transfer fee (arc width/color) and direction (from → to).
- Let users filter by season/transfer window and by league.
- Show a detail panel when a club is selected: transfers in/out, net spend, biggest signing.
- Support two viewing modes: **Money Flow** (fee-weighted) and **Player Migration** (raw count).
- Ship as a free-to-host Next.js app on Vercel.

### Non-Goals (v1)
- No real-time / live match data (that's a separate idea).
- No user accounts, auth, or saved views.
- No full historical coverage — v1 targets a curated slice (e.g. Big 5 leagues, last 2–3 seasons).
- No mobile-first interaction polish beyond "it works and looks decent on a phone."

---

## 3. Target Users

- **Football fans** who enjoy transfer-window drama and want to *see* the market visually.
- **Recruiters / portfolio viewers** evaluating Filan's front-end + data skills.
- **Data-viz enthusiasts** who appreciate a clean, performant WebGL interactive.

---

## 4. Core Concept & Visual Encoding

| Visual element | Represents | Encoding |
|---|---|---|
| **Marker** (dot on globe) | A football club | Position = club location. Size = market value or transfer spend for the active window. |
| **Arc** (curved line) | A single transfer | `from` = selling club, `to` = buying club. Width = fee magnitude. Color = fee tier (or in/out relative to selected club). |
| **Marker label** (DOM element) | Club name / hover card | Anchored via COBE's CSS anchor positioning; visible when facing the camera. |
| **Glow** | Ambient globe styling | Static; tuned for theme (dark mode default). |

**Money Flow mode:** arcs weighted and colored by transfer fee — reveals capital flowing (e.g. Premier League clubs as net buyers).

**Player Migration mode:** arcs weighted by raw player count regardless of fee — reveals talent pipelines (Brazil → Portugal, West Africa → France, etc.).

---

## 5. Features

### 5.1 Globe (Core)
- Auto-rotating globe on load, pausing on user interaction.
- Draggable to rotate; scroll/pinch is out of scope for v1 (optional stretch).
- Clubs rendered as markers; transfers rendered as arcs for the active filter set.

### 5.2 Filters
- **Season / window selector** — dropdown or slider (e.g. `2024/25 Summer`, `2024/25 Winter`, `2025/26 Summer`).
- **League filter** — multi-select toggle (Big 5, or individual: Premier League, La Liga, Serie A, Bundesliga, Ligue 1). Default = all.
- **Mode toggle** — Money Flow ↔ Player Migration.

### 5.3 Club Detail Panel
Triggered by clicking a marker. Slides in from the side.
- Club name, league, crest (if available), location.
- **Transfers In** — list: player, from-club, fee.
- **Transfers Out** — list: player, to-club, fee.
- **Summary stats** — total in, total out, **net spend**, biggest signing.
- A small bar/mini-chart for spend vs. income (Recharts).

### 5.4 Legend & Info
- Legend explaining arc color/width encoding for the active mode.
- Short "About / data source" note.

### 5.5 Empty / Loading States
- Skeleton globe or spinner while data loads.
- Graceful message if a filter combination returns no transfers.

---

## 6. Data

### 6.1 Model (conceptual)

```
Club {
  id: string
  name: string
  league: string
  country: string
  lat: number
  lng: number
  crestUrl?: string
  marketValue?: number
}

Transfer {
  id: string
  playerName: string
  fromClubId: string
  toClubId: string
  fee: number | null      // null = free / loan / undisclosed
  feeType: 'fee' | 'loan' | 'free' | 'undisclosed'
  season: string          // e.g. "2024/25"
  window: 'summer' | 'winter'
}
```

### 6.2 Sources (evaluate in this order)
1. **football-data.org** — free tier, structured, good for clubs/leagues. Limited transfer data.
2. **API-Football (RapidAPI)** — has transfer endpoints; free tier has request caps.
3. **Transfermarkt** — richest transfer + fee data, but only via unofficial scrapers/wrappers. **Check ToS before any public deployment**; safer to snapshot a static dataset than to hit it live.

### 6.3 Strategy for v1
Because live transfer APIs are inconsistent, **v1 ships with a curated static JSON dataset** (a few hundred transfers across 2–3 recent windows) committed to the repo or stored as a JSON file. This guarantees the demo always works, loads fast, and has no API keys or rate limits. A live-API adapter can be added later behind the same data interface.

> **Club coordinates:** geocode once, cache as static JSON. Don't geocode at runtime.

---

## 7. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15** (App Router) | Same ecosystem as your other projects. |
| Styling | **Tailwind CSS** | Consistent with your workflow. |
| Globe | **cobe** (`cobe@latest`) | ~5KB, zero deps, the whole point. |
| Charts | **Recharts** | For the club detail mini-charts. |
| Data (v1) | Static JSON | No DB needed for v1. |
| Hosting | **Vercel** | Free, matches COBE's own demo. |

---

## 8. Architecture (v1)

```
/app
  /page.tsx           → main globe view
  /components
    Globe.tsx         → COBE wrapper, markers + arcs, rotation
    FilterBar.tsx     → season / league / mode controls
    ClubPanel.tsx     → detail side panel
    Legend.tsx
  /lib
    data.ts           → load + shape transfers/clubs
    transforms.ts     → filter, aggregate (net spend etc.), map to markers/arcs
    encoding.ts       → fee → color/width helpers
/public/data
    clubs.json
    transfers.json
```

**Data flow:** `data.ts` loads JSON → `transforms.ts` applies active filters and computes markers + arcs → `Globe.tsx` feeds them into COBE → clicking a marker sets selected club → `ClubPanel.tsx` renders its aggregated stats.

---

## 9. Milestones

| Phase | Deliverable |
|---|---|
| **M0 — Setup** | Next.js + Tailwind + COBE rendering a static globe with a few hardcoded markers. |
| **M1 — Data** | Curated `clubs.json` + `transfers.json`; geocoded coordinates; data-loading layer. |
| **M2 — Arcs & encoding** | Transfers rendered as arcs; fee → width/color encoding; Money Flow mode. |
| **M3 — Filters** | Season + league filters wired to the transform layer. Player Migration mode. |
| **M4 — Detail panel** | Click-to-select club, side panel with in/out/net-spend + mini chart. |
| **M5 — Polish** | Legend, loading/empty states, responsive pass, about note, deploy to Vercel. |

---

## 10. Success Criteria

- The globe loads in under ~2s and rotates smoothly on a mid-range laptop.
- A user can, within 30 seconds, filter to a season and click a club to understand its transfer activity.
- Both modes visibly tell different stories (money vs. migration).
- Deployed, shareable public URL suitable for a portfolio.

---

## 11. Stretch Ideas (post-v1)

- **Live API adapter** behind the same data interface.
- **Player search** — type a name, globe animates to and highlights that transfer.
- **"Biggest movers"** ticker/leaderboard for the active window.
- **Country aggregation mode** — collapse clubs into country-level flows.
- **Shareable deep links** encoding the current filter state in the URL.

---

## 12. Open Questions

1. Which specific seasons/windows to include in the v1 static dataset?
2. Big 5 only, or include a couple of "selling" leagues (Eredivisie, Primeira Liga) to make migration pipelines more visible?
3. Marker size — driven by club market value, or by window spend? (Latter is more relevant to the transfer theme.)
4. How to handle loans and free transfers visually — dashed arcs? Separate color? Excluded from Money Flow?
