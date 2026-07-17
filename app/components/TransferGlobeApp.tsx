"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { Club, League, Mode, Transfer, TransferWindow } from "../../lib/types";
import { LEAGUES } from "../../lib/types";
import {
  aggregateClub,
  buildArcs,
  buildMarkers,
  filterTransfers,
  windowLabel,
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
