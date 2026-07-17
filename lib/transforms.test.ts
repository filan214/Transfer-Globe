import { describe, expect, test } from "vitest";
import type { Club, Transfer } from "./types";
import {
  aggregateClub,
  buildArcs,
  buildMarkers,
  filterTransfers,
  listWindows,
  windowLabel,
} from "./transforms";

const clubs: Club[] = [
  { id: "che", name: "Chelsea", league: "Premier League", country: "England", lat: 51.48, lng: -0.19 },
  { id: "ars", name: "Arsenal", league: "Premier League", country: "England", lat: 51.55, lng: -0.11 },
  { id: "rma", name: "Real Madrid", league: "La Liga", country: "Spain", lat: 40.45, lng: -3.69 },
  { id: "ben", name: "Benfica", league: "Other", country: "Portugal", lat: 38.75, lng: -9.18 },
  { id: "san", name: "Santos", league: "Other", country: "Brazil", lat: -23.95, lng: -46.34 },
  { id: "laz", name: "Lazio", league: "Serie A", country: "Italy", lat: 41.94, lng: 12.45 },
];
const clubById = new Map(clubs.map((c) => [c.id, c]));

function t(partial: Partial<Transfer> & { id: string }): Transfer {
  return {
    playerName: "Player " + partial.id,
    fromClubId: "che",
    toClubId: "ars",
    fee: 10,
    feeType: "fee",
    season: "2025/26",
    window: "summer",
    ...partial,
  };
}

const transfers: Transfer[] = [
  t({ id: "a", fromClubId: "che", toClubId: "ars", fee: 50 }),
  t({ id: "b", fromClubId: "rma", toClubId: "che", fee: 30 }),
  t({ id: "c", fromClubId: "ben", toClubId: "san", fee: 20 }),
  t({ id: "d", fromClubId: "ben", toClubId: "san", fee: null, feeType: "loan" }),
  t({ id: "e", fromClubId: "che", toClubId: "ars", fee: null, feeType: "free" }),
  t({ id: "f", fromClubId: "che", toClubId: "rma", fee: 40, season: "2024/25", window: "winter" }),
  t({ id: "g", fromClubId: "ars", toClubId: "che", fee: 15, season: "2024/25", window: "summer" }),
];

describe("listWindows", () => {
  test("returns unique windows in chronological order", () => {
    expect(listWindows(transfers)).toEqual([
      { season: "2024/25", window: "summer" },
      { season: "2024/25", window: "winter" },
      { season: "2025/26", window: "summer" },
    ]);
  });
});

describe("windowLabel", () => {
  test("formats season and capitalized window", () => {
    expect(windowLabel({ season: "2024/25", window: "winter" })).toBe("2024/25 Winter");
  });
});

describe("filterTransfers", () => {
  const win = { season: "2025/26", window: "summer" as const };

  test("keeps only transfers in the given window", () => {
    const out = filterTransfers(transfers, clubById, win, ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Other"]);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("matches when either end is in a selected league", () => {
    const out = filterTransfers(transfers, clubById, win, ["La Liga"]);
    expect(out.map((x) => x.id)).toEqual(["b"]);
  });

  test("Other-to-Other transfers only appear when Other is selected", () => {
    const withoutOther = filterTransfers(transfers, clubById, win, ["Premier League", "La Liga"]);
    expect(withoutOther.map((x) => x.id)).toEqual(["a", "b", "e"]);
    const withOther = filterTransfers(transfers, clubById, win, ["Other"]);
    expect(withOther.map((x) => x.id)).toEqual(["c", "d"]);
  });
});

describe("buildMarkers", () => {
  const win = { season: "2025/26", window: "summer" as const };
  const filtered = filterTransfers(transfers, clubById, win, ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Other"]);

  test("money mode activity sums fees for both directions, ignoring loans/frees", () => {
    const markers = buildMarkers(clubs, filtered, "money", ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Other"]);
    const che = markers.find((m) => m.club.id === "che")!;
    expect(che.activity).toBe(80); // sold 50 (a), bought 30 (b); free (e) ignored
  });

  test("migration mode activity counts transfers including loans/frees", () => {
    const markers = buildMarkers(clubs, filtered, "migration", ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Other"]);
    const che = markers.find((m) => m.club.id === "che")!;
    expect(che.activity).toBe(3); // a, b, e
  });

  test("clubs in selected leagues appear at minimum size even with no transfers", () => {
    const markers = buildMarkers(clubs, filtered, "money", ["Serie A"]);
    const laz = markers.find((m) => m.club.id === "laz");
    expect(laz).toBeDefined();
    expect(laz!.activity).toBe(0);
    const active = buildMarkers(clubs, filtered, "money", ["Premier League"]).find((m) => m.club.id === "che")!;
    expect(laz!.size).toBeLessThan(active.size);
  });

  test("most active club gets the largest marker", () => {
    const markers = buildMarkers(clubs, filtered, "money", ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Other"]);
    const sizes = new Map(markers.map((m) => [m.club.id, m.size]));
    expect(Math.max(...markers.map((m) => m.size))).toBe(sizes.get("che"));
  });
});

describe("buildArcs", () => {
  const win = { season: "2025/26", window: "summer" as const };
  const filtered = filterTransfers(transfers, clubById, win, ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Other"]);

  test("money mode returns one arc per transfer with fee value", () => {
    const arcs = buildArcs(filtered, clubById, "money");
    expect(arcs).toHaveLength(5);
    const a = arcs.find((x) => x.key === "a")!;
    expect(a.value).toBe(50);
    expect(a.fromClub.id).toBe("che");
    expect(a.toClub.id).toBe("ars");
    const loan = arcs.find((x) => x.key === "d")!;
    expect(loan.value).toBe(0);
  });

  test("migration mode bundles transfers on the same route with count value", () => {
    const arcs = buildArcs(filtered, clubById, "migration");
    const route = arcs.find((x) => x.fromClub.id === "ben" && x.toClub.id === "san")!;
    expect(route.value).toBe(2);
    expect(route.transfers.map((x) => x.id).sort()).toEqual(["c", "d"]);
    const cheArs = arcs.find((x) => x.fromClub.id === "che" && x.toClub.id === "ars")!;
    expect(cheArs.value).toBe(2); // a + e
    expect(arcs).toHaveLength(3); // che->ars, rma->che, ben->san
  });
});

describe("aggregateClub", () => {
  const win = { season: "2025/26", window: "summer" as const };
  const filtered = filterTransfers(transfers, clubById, win, ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Other"]);

  test("computes spend, income and net spend from paid fees only", () => {
    const stats = aggregateClub("che", filtered, clubById)!;
    expect(stats.spend).toBe(30); // bought b
    expect(stats.income).toBe(50); // sold a; free (e) ignored
    expect(stats.netSpend).toBe(-20);
  });

  test("lists transfers in and out sorted by fee descending, nulls last", () => {
    const stats = aggregateClub("ars", filtered, clubById)!;
    expect(stats.transfersIn.map((x) => x.id)).toEqual(["a", "e"]);
    expect(stats.transfersOut).toHaveLength(0);
  });

  test("biggest signing is the highest incoming fee", () => {
    const stats = aggregateClub("che", filtered, clubById)!;
    expect(stats.biggestSigning?.id).toBe("b");
  });

  test("club with no transfers has empty stats", () => {
    const stats = aggregateClub("laz", filtered, clubById)!;
    expect(stats.transfersIn).toHaveLength(0);
    expect(stats.transfersOut).toHaveLength(0);
    expect(stats.netSpend).toBe(0);
    expect(stats.biggestSigning).toBeNull();
  });
});
