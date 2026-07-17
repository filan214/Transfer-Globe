"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Club, League, Mode, Transfer, TransferWindow } from "../../lib/types";
import { LEAGUES } from "../../lib/types";
import {
  aggregateClub,
  buildArcs,
  buildMarkers,
  filterTransfers,
  parseWindowSlug,
  windowLabel,
  windowSlug,
  listWindows,
} from "../../lib/transforms";
import ClubPanel from "./ClubPanel";
import FilterBar from "./FilterBar";
import Legend from "./Legend";

const Globe = dynamic(() => import("./Globe"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <div
          className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }}
          aria-hidden
        />
        <p className="data mt-4 text-[12px] text-dim">Warming up the globe…</p>
      </div>
    </div>
  ),
});

interface TransferGlobeAppProps {
  clubs: Club[];
  transfers: Transfer[];
}

export default function TransferGlobeApp({ clubs, transfers }: TransferGlobeAppProps) {
  const clubById = useMemo(() => new Map(clubs.map((c) => [c.id, c])), [clubs]);
  const windows = useMemo(() => listWindows(transfers), [transfers]);

  const [win, setWin] = useState<TransferWindow>(() => windows[windows.length - 1]);
  const [mode, setMode] = useState<Mode>("money");
  const [leagues, setLeagues] = useState<League[]>(LEAGUES);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const [search, setSearch] = useState("");
  const urlReady = useRef(false);

  const flyToClub = (club: Club) => {
    setSelectedClubId(club.id);
    setFocus((prev) => ({ lat: club.lat, lng: club.lng, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  // Deep links: read ?window/?mode/?club once after hydration…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromSlug = parseWindowSlug(params.get("window") ?? "");
    if (fromSlug && windows.some((w) => w.season === fromSlug.season && w.window === fromSlug.window)) {
      setWin(fromSlug);
    }
    if (params.get("mode") === "migration") setMode("migration");
    const club = clubById.get(params.get("club") ?? "");
    if (club) flyToClub(club);
    urlReady.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // …and keep the URL shareable as the state changes.
  useEffect(() => {
    if (!urlReady.current) return;
    const params = new URLSearchParams();
    const defaultWin = windows[windows.length - 1];
    if (win.season !== defaultWin.season || win.window !== defaultWin.window) {
      params.set("window", windowSlug(win));
    }
    if (mode !== "money") params.set("mode", mode);
    if (selectedClubId) params.set("club", selectedClubId);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [win, mode, selectedClubId, windows]);

  const filtered = useMemo(
    () => filterTransfers(transfers, clubById, win, leagues),
    [transfers, clubById, win, leagues],
  );
  const markers = useMemo(
    () => buildMarkers(clubs, filtered, mode, leagues),
    [clubs, filtered, mode, leagues],
  );
  const arcs = useMemo(() => buildArcs(filtered, clubById, mode), [filtered, clubById, mode]);
  const stats = useMemo(
    () => (selectedClubId ? aggregateClub(selectedClubId, filtered, clubById) : null),
    [selectedClubId, filtered, clubById],
  );

  const totalFees = useMemo(
    () => filtered.reduce((s, t) => s + (t.feeType === "fee" ? (t.fee ?? 0) : 0), 0),
    [filtered],
  );
  const totalLabel =
    totalFees >= 1000
      ? `€${(totalFees / 1000).toFixed(2)}bn`
      : `€${Math.round(totalFees)}m`;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <Globe
        markers={markers}
        arcs={arcs}
        mode={mode}
        selectedClubId={selectedClubId}
        onSelectClub={setSelectedClubId}
        focus={focus}
      />

      {/* Header */}
      <header className="pointer-events-none absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
        <div className="data text-[10px] font-medium tracking-[0.3em] text-faint">
          WHERE THE MONEY GOES
        </div>
        <h1 className="display mt-1 text-4xl font-bold leading-none tracking-wide sm:text-5xl">
          Transfer Globe
        </h1>
        <div className="data mt-2 text-[12px] text-dim">
          {windowLabel(win)} · {totalLabel} in fees · {filtered.length}{" "}
          {filtered.length === 1 ? "move" : "moves"}
        </div>
        <input
          type="search"
          list="club-search-list"
          value={search}
          placeholder="Find a club…"
          aria-label="Find a club"
          className="glass data pointer-events-auto mt-3 w-56 rounded-md px-3 py-2 text-[12px] text-text placeholder:text-faint focus:outline-2 focus:outline-gold"
          onChange={(e) => {
            setSearch(e.target.value);
            const club = clubs.find(
              (c) => c.name.toLowerCase() === e.target.value.trim().toLowerCase(),
            );
            if (club) {
              flyToClub(club);
              setSearch("");
            }
          }}
        />
        <datalist id="club-search-list">
          {[...clubs]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <option key={c.id} value={c.name} />
            ))}
        </datalist>
      </header>

      <FilterBar
        windows={windows}
        currentWindow={win}
        onWindowChange={setWin}
        mode={mode}
        onModeChange={setMode}
        leagues={leagues}
        onToggleLeague={(league) =>
          setLeagues((prev) =>
            prev.includes(league) ? prev.filter((l) => l !== league) : [...prev, league],
          )
        }
      />

      <Legend mode={mode} />

      {filtered.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
          <div className="glass max-w-sm rounded-xl px-6 py-5 text-center">
            <div className="display text-lg font-semibold tracking-wide">
              A quiet window
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-dim">
              No transfers match these filters. Select at least one league, or try
              another window from the top-right selector.
            </p>
          </div>
        </div>
      )}

      {stats && (
        <ClubPanel
          stats={stats}
          clubById={clubById}
          onClose={() => setSelectedClubId(null)}
        />
      )}

      {/* Data note */}
      <div className="data pointer-events-none absolute bottom-4 right-4 z-10 hidden text-[10px] text-faint sm:bottom-6 sm:right-6 lg:block">
        Curated sample · fees are reported figures, €m
      </div>
    </main>
  );
}
