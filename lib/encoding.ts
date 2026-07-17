import type { FeeType, Mode } from "./types";

export type FeeTier = "nofee" | "low" | "mid" | "high" | "marquee";

/** Fee (€m) → tier. Loans, frees and €0 all count as "nofee". */
export function feeTier(fee: number | null): FeeTier {
  if (fee === null || fee <= 0) return "nofee";
  if (fee < 20) return "low";
  if (fee < 45) return "mid";
  if (fee < 75) return "high";
  return "marquee";
}

/** Arc stroke width in CSS px for a fee (€m) or a bundled player count. */
export function arcWidth(mode: Mode, value: number): number {
  if (mode === "money") {
    if (value <= 0) return 0.7;
    return Math.min(3.6, 0.9 + Math.sqrt(value / 150) * 2.7);
  }
  return Math.min(4.5, 1 + Math.sqrt(Math.max(0, value - 1)) * 0.9);
}

export const MARKER_SIZE_MIN = 0.016;
export const MARKER_SIZE_MAX = 0.062;

/** COBE marker size from a club's activity relative to the window's max. */
export function markerSize(activity: number, maxActivity: number): number {
  if (maxActivity <= 0 || activity <= 0) return MARKER_SIZE_MIN;
  const share = Math.sqrt(Math.min(1, activity / maxActivity));
  return MARKER_SIZE_MIN + (MARKER_SIZE_MAX - MARKER_SIZE_MIN) * share;
}

export function formatFee(fee: number | null, feeType: FeeType): string {
  if (feeType === "loan") return "Loan";
  if (feeType === "free") return "Free";
  if (fee === null) return "Undisclosed";
  const rounded = Math.round(fee * 10) / 10;
  return `€${rounded}m`;
}
