import type {
  ArcDatum,
  Club,
  ClubStats,
  League,
  MarkerDatum,
  Mode,
  Transfer,
  TransferWindow,
} from "./types";
import { markerSize } from "./encoding";

/** Unique transfer windows present in the data, oldest first. */
export function listWindows(transfers: Transfer[]): TransferWindow[] {
  const seen = new Map<string, TransferWindow>();
  for (const t of transfers) {
    seen.set(`${t.season}|${t.window}`, { season: t.season, window: t.window });
  }
  return [...seen.values()].sort((a, b) => {
    if (a.season !== b.season) return a.season < b.season ? -1 : 1;
    if (a.window === b.window) return 0;
    return a.window === "summer" ? -1 : 1; // summer precedes winter within a season
  });
}

export function windowLabel(win: TransferWindow): string {
  const name = win.window.charAt(0).toUpperCase() + win.window.slice(1);
  return `${win.season} ${name}`;
}

/** Transfers in the given window where either end plays in a selected league. */
export function filterTransfers(
  transfers: Transfer[],
  clubById: Map<string, Club>,
  win: TransferWindow,
  leagues: League[],
): Transfer[] {
  const selected = new Set(leagues);
  return transfers.filter((t) => {
    if (t.season !== win.season || t.window !== win.window) return false;
    const from = clubById.get(t.fromClubId);
    const to = clubById.get(t.toClubId);
    return (
      (from !== undefined && selected.has(from.league)) ||
      (to !== undefined && selected.has(to.league))
    );
  });
}

function transferValue(t: Transfer, mode: Mode): number {
  return mode === "money" ? (t.feeType === "fee" ? (t.fee ?? 0) : 0) : 1;
}

/**
 * Markers for clubs involved in the filtered transfers, plus every club in a
 * selected league (at minimum size when inactive).
 */
export function buildMarkers(
  clubs: Club[],
  filtered: Transfer[],
  mode: Mode,
  leagues: League[],
): MarkerDatum[] {
  const selected = new Set(leagues);
  const activity = new Map<string, number>();
  for (const t of filtered) {
    const v = transferValue(t, mode);
    activity.set(t.fromClubId, (activity.get(t.fromClubId) ?? 0) + v);
    activity.set(t.toClubId, (activity.get(t.toClubId) ?? 0) + v);
  }
  const included = clubs.filter(
    (c) => selected.has(c.league) || activity.has(c.id),
  );
  const max = Math.max(0, ...included.map((c) => activity.get(c.id) ?? 0));
  return included.map((club) => {
    const a = activity.get(club.id) ?? 0;
    return { club, activity: a, size: markerSize(a, max) };
  });
}

/**
 * Money mode: one arc per transfer, valued by fee (0 for loans/frees).
 * Migration mode: one arc per from→to route, valued by player count.
 */
export function buildArcs(
  filtered: Transfer[],
  clubById: Map<string, Club>,
  mode: Mode,
): ArcDatum[] {
  if (mode === "money") {
    return filtered.flatMap((t) => {
      const fromClub = clubById.get(t.fromClubId);
      const toClub = clubById.get(t.toClubId);
      if (!fromClub || !toClub) return [];
      return [{ key: t.id, fromClub, toClub, transfers: [t], value: transferValue(t, "money") }];
    });
  }
  const routes = new Map<string, ArcDatum>();
  for (const t of filtered) {
    const fromClub = clubById.get(t.fromClubId);
    const toClub = clubById.get(t.toClubId);
    if (!fromClub || !toClub) continue;
    const key = `${t.fromClubId}->${t.toClubId}`;
    const route = routes.get(key);
    if (route) {
      route.transfers.push(t);
      route.value += 1;
    } else {
      routes.set(key, { key, fromClub, toClub, transfers: [t], value: 1 });
    }
  }
  return [...routes.values()];
}

/** Fee sort: paid fees descending, loans/frees last. */
function byFeeDesc(a: Transfer, b: Transfer): number {
  return (b.fee ?? -1) - (a.fee ?? -1);
}

export function aggregateClub(
  clubId: string,
  filtered: Transfer[],
  clubById: Map<string, Club>,
): ClubStats | null {
  const club = clubById.get(clubId);
  if (!club) return null;
  const transfersIn = filtered.filter((t) => t.toClubId === clubId).sort(byFeeDesc);
  const transfersOut = filtered.filter((t) => t.fromClubId === clubId).sort(byFeeDesc);
  const spend = transfersIn.reduce((s, t) => s + transferValue(t, "money"), 0);
  const income = transfersOut.reduce((s, t) => s + transferValue(t, "money"), 0);
  const biggestSigning =
    transfersIn.length > 0 && transfersIn[0].feeType === "fee" ? transfersIn[0] : null;
  return { club, transfersIn, transfersOut, spend, income, netSpend: spend - income, biggestSigning };
}
