"use client";

import type { Mode } from "../../lib/types";
import {
  MARKER_COLOR,
  MIGRATION_COLOR,
  TIER_COLORS,
  TIER_LABELS,
  TIER_ORDER,
} from "../../lib/palette";

/** Broadcast lower-third: how to read the arcs and dots. */
export default function Legend({ mode }: { mode: Mode }) {
  return (
    <div className="glass pointer-events-auto absolute bottom-16 left-4 z-20 hidden rounded-lg px-4 py-3 sm:bottom-6 sm:left-6 md:block">
      <div className="display mb-2 text-[11px] font-semibold tracking-[0.18em] text-dim">
        How to read it
      </div>
      {mode === "money" ? (
        <ul className="space-y-1.5">
          {TIER_ORDER.map((tier) => (
            <li key={tier} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="inline-block h-[3px] w-7 rounded-full"
                style={{
                  background: TIER_COLORS[tier],
                  height: tier === "marquee" ? 4 : tier === "nofee" ? 2 : 3,
                }}
              />
              <span className="data text-[11px] text-dim">{TIER_LABELS[tier]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="inline-block h-[3px] w-7 rounded-full"
              style={{ background: MIGRATION_COLOR }}
            />
            <span className="data text-[11px] text-dim">One route, width = players moved</span>
          </li>
        </ul>
      )}
      <div className="mt-2.5 flex items-center gap-2.5 border-t pt-2.5" style={{ borderColor: "var(--line)" }}>
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: MARKER_COLOR }}
        />
        <span className="data text-[11px] text-dim">Club, sized by window activity</span>
      </div>
      <div className="data mt-1.5 text-[10px] text-faint">
        Pulses travel seller → buyer · click a club
      </div>
    </div>
  );
}
