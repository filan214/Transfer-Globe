"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { Club, ClubStats, Transfer } from "../../lib/types";
import { feeTier, formatFee } from "../../lib/encoding";
import { INCOME_COLOR, SPEND_COLOR, TIER_COLORS } from "../../lib/palette";

interface ClubPanelProps {
  stats: ClubStats;
  clubById: Map<string, Club>;
  onClose: () => void;
}

const MAX_ROWS = 6;

function money(v: number): string {
  return `€${Math.round(v * 10) / 10}m`;
}

function TransferRow({
  transfer,
  counterpartId,
  clubById,
}: {
  transfer: Transfer;
  counterpartId: string;
  clubById: Map<string, Club>;
}) {
  const counterpart = clubById.get(counterpartId);
  const tier = feeTier(transfer.feeType === "fee" ? transfer.fee : null);
  return (
    <li className="flex items-baseline justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="truncate text-[13px]">{transfer.playerName}</div>
        <div className="truncate text-[11px] text-faint">{counterpart?.name ?? "—"}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: TIER_COLORS[tier] }}
        />
        <span className="data text-[12px] text-dim">
          {formatFee(transfer.fee, transfer.feeType)}
        </span>
      </div>
    </li>
  );
}

function TransferList({
  title,
  transfers,
  direction,
  clubById,
}: {
  title: string;
  transfers: Transfer[];
  direction: "in" | "out";
  clubById: Map<string, Club>;
}) {
  if (transfers.length === 0) return null;
  const shown = transfers.slice(0, MAX_ROWS);
  const hidden = transfers.length - shown.length;
  return (
    <section className="mt-4">
      <h3 className="display text-[11px] font-semibold tracking-[0.18em] text-dim">
        {title} · {transfers.length}
      </h3>
      <ul className="mt-1 divide-y" style={{ borderColor: "var(--line)" }}>
        {shown.map((t) => (
          <TransferRow
            key={t.id}
            transfer={t}
            counterpartId={direction === "in" ? t.fromClubId : t.toClubId}
            clubById={clubById}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <div className="data mt-1 text-[11px] text-faint">+ {hidden} more</div>
      )}
    </section>
  );
}

export default function ClubPanel({ stats, clubById, onClose }: ClubPanelProps) {
  const { club, transfersIn, transfersOut, spend, income, netSpend, biggestSigning } = stats;
  const hasActivity = transfersIn.length > 0 || transfersOut.length > 0;
  const chartData = [
    { name: "Spend", value: spend, color: SPEND_COLOR },
    { name: "Income", value: income, color: INCOME_COLOR },
  ];

  return (
    <aside
      className="glass panel-in pointer-events-auto absolute inset-x-2 bottom-16 z-30 max-h-[58vh] overflow-y-auto rounded-xl p-5 sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-20 sm:max-h-[calc(100vh-7.5rem)] sm:w-[340px]"
      aria-label={`${club.name} window details`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="display text-2xl font-bold leading-none tracking-wide">
            {club.name}
          </h2>
          <div className="data mt-1.5 text-[11px] text-dim">
            {club.league} · {club.country}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close club panel"
          className="rounded-md px-2 py-1 text-dim transition-colors hover:text-text"
        >
          ✕
        </button>
      </div>

      {hasActivity ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div>
              <div className="data text-[10px] uppercase tracking-wider text-faint">Spend</div>
              <div className="data text-sm font-medium">{money(spend)}</div>
            </div>
            <div>
              <div className="data text-[10px] uppercase tracking-wider text-faint">Income</div>
              <div className="data text-sm font-medium">{money(income)}</div>
            </div>
            <div>
              <div className="data text-[10px] uppercase tracking-wider text-faint">Net</div>
              <div
                className="data text-sm font-medium"
                style={{ color: netSpend > 0 ? SPEND_COLOR : netSpend < 0 ? INCOME_COLOR : undefined }}
              >
                {netSpend > 0 ? "−" : netSpend < 0 ? "+" : ""}
                {money(Math.abs(netSpend))}
              </div>
            </div>
          </div>

          {spend > 0 && income > 0 && (
            <div className="mt-3 h-[84px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 44, bottom: 4, left: 0 }}
                >
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Bar dataKey="value" barSize={10} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {chartData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v) => (typeof v === "number" ? money(v) : "")}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {biggestSigning && (
            <div
              className="mt-3 rounded-lg border px-3 py-2.5"
              style={{ borderColor: "var(--line-strong)" }}
            >
              <div className="data text-[10px] uppercase tracking-wider text-faint">
                Biggest signing
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium">{biggestSigning.playerName}</span>
                <span
                  className="data shrink-0 text-[13px] font-semibold"
                  style={{ color: TIER_COLORS[feeTier(biggestSigning.fee)] }}
                >
                  {formatFee(biggestSigning.fee, biggestSigning.feeType)}
                </span>
              </div>
              <div className="text-[11px] text-faint">
                from {clubById.get(biggestSigning.fromClubId)?.name ?? "—"}
              </div>
            </div>
          )}

          <TransferList title="In" transfers={transfersIn} direction="in" clubById={clubById} />
          <TransferList title="Out" transfers={transfersOut} direction="out" clubById={clubById} />
        </>
      ) : (
        <p className="mt-4 text-[13px] leading-relaxed text-dim">
          No transfers recorded for {club.name} in this window. Try another window
          from the top-right selector.
        </p>
      )}
    </aside>
  );
}
