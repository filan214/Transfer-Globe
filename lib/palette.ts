import type { FeeTier } from "./encoding";

/**
 * "Night match broadcast" palette. Money is fire: pale gold → amber → orange →
 * hot red as fees climb. Loans/frees sit outside the fire family in slate.
 * Migration mode is a single teal — players, not money.
 * Ramp validated (dark surface): monotonic lightness, CVD ΔE ≥ 9, contrast ≥ 3:1.
 */
export const TIER_COLORS: Record<FeeTier, string> = {
  nofee: "#5B6B85",
  low: "#FBE896",
  mid: "#F0A030",
  high: "#E96E33",
  marquee: "#D6335C",
};

export const TIER_LABELS: Record<FeeTier, string> = {
  nofee: "Loan / free",
  low: "< €20m",
  mid: "€20–45m",
  high: "€45–75m",
  marquee: "€75m+",
};

export const TIER_ORDER: FeeTier[] = ["marquee", "high", "mid", "low", "nofee"];

export const MIGRATION_COLOR = "#35C4B5";
export const MARKER_COLOR = "#FFD9A0";
export const SELECTED_COLOR = "#FFFFFF";

export const SPEND_COLOR = "#D6335C";
export const INCOME_COLOR = "#35C4B5";

/** COBE wants 0–1 rgb triples. */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
