"use client";

import type { League, Mode, TransferWindow } from "../../lib/types";
import { LEAGUES } from "../../lib/types";
import { windowLabel } from "../../lib/transforms";

interface FilterBarProps {
  windows: TransferWindow[];
  currentWindow: TransferWindow;
  onWindowChange: (win: TransferWindow) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  leagues: League[];
  onToggleLeague: (league: League) => void;
}

export default function FilterBar({
  windows,
  currentWindow,
  onWindowChange,
  mode,
  onModeChange,
  leagues,
  onToggleLeague,
}: FilterBarProps) {
  return (
    <>
      {/* Window + mode: below the header on mobile, top right on desktop */}
      <div className="pointer-events-auto absolute inset-x-4 top-[10.5rem] z-20 flex flex-wrap gap-2 sm:inset-x-auto sm:right-6 sm:top-6 sm:justify-end">
        <div className="seg glass" role="group" aria-label="Transfer window">
          {windows.map((win) => {
            const active =
              win.season === currentWindow.season && win.window === currentWindow.window;
            const label = windowLabel(win);
            return (
              <button
                key={`${win.season}-${win.window}`}
                aria-pressed={active}
                onClick={() => onWindowChange(win)}
                className="data"
              >
                {/* "2024/25 Summer" → "24/25 Summer" on narrow screens */}
                <span className="hidden sm:inline">{label.slice(0, 2)}</span>
                {label.slice(2)}
              </button>
            );
          })}
        </div>
        <div className="seg glass" role="group" aria-label="View mode">
          <button
            aria-pressed={mode === "money"}
            onClick={() => onModeChange("money")}
            className="data"
          >
            Money flow
          </button>
          <button
            aria-pressed={mode === "migration"}
            onClick={() => onModeChange("migration")}
            className="data"
          >
            Player migration
          </button>
        </div>
      </div>

      {/* League chips: bottom center */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:bottom-6">
        <div
          className="glass flex max-w-full gap-1.5 overflow-x-auto rounded-full p-1.5"
          role="group"
          aria-label="Leagues"
        >
          {LEAGUES.map((league) => (
            <button
              key={league}
              className="chip"
              aria-pressed={leagues.includes(league)}
              onClick={() => onToggleLeague(league)}
            >
              {league}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
