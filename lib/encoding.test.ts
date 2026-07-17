import { describe, expect, test } from "vitest";
import {
  arcWidth,
  feeTier,
  formatFee,
  markerSize,
  MARKER_SIZE_MAX,
  MARKER_SIZE_MIN,
} from "./encoding";

describe("feeTier", () => {
  test("maps fees to tiers at the documented boundaries", () => {
    expect(feeTier(null)).toBe("nofee");
    expect(feeTier(0)).toBe("nofee");
    expect(feeTier(10)).toBe("low");
    expect(feeTier(20)).toBe("mid");
    expect(feeTier(44.9)).toBe("mid");
    expect(feeTier(45)).toBe("high");
    expect(feeTier(75)).toBe("marquee");
    expect(feeTier(144)).toBe("marquee");
  });
});

describe("arcWidth", () => {
  test("money mode: monotonic in fee and clamped", () => {
    const w0 = arcWidth("money", 0);
    const w20 = arcWidth("money", 20);
    const w80 = arcWidth("money", 80);
    const w200 = arcWidth("money", 200);
    expect(w0).toBeLessThan(w20);
    expect(w20).toBeLessThan(w80);
    expect(w80).toBeLessThanOrEqual(w200);
    expect(w200).toBeLessThanOrEqual(4);
    expect(w0).toBeGreaterThan(0);
  });

  test("migration mode: monotonic in count and clamped", () => {
    const w1 = arcWidth("migration", 1);
    const w3 = arcWidth("migration", 3);
    const w99 = arcWidth("migration", 99);
    expect(w1).toBeLessThan(w3);
    expect(w3).toBeLessThanOrEqual(w99);
    expect(w99).toBeLessThanOrEqual(5);
  });
});

describe("markerSize", () => {
  test("scales between min and max by share of max activity", () => {
    expect(markerSize(0, 100)).toBe(MARKER_SIZE_MIN);
    expect(markerSize(100, 100)).toBe(MARKER_SIZE_MAX);
    const mid = markerSize(25, 100);
    expect(mid).toBeGreaterThan(MARKER_SIZE_MIN);
    expect(mid).toBeLessThan(MARKER_SIZE_MAX);
  });

  test("handles zero max activity", () => {
    expect(markerSize(0, 0)).toBe(MARKER_SIZE_MIN);
  });
});

describe("formatFee", () => {
  test("formats paid fees, loans and frees", () => {
    expect(formatFee(75, "fee")).toBe("€75m");
    expect(formatFee(46.9, "fee")).toBe("€46.9m");
    expect(formatFee(null, "loan")).toBe("Loan");
    expect(formatFee(null, "free")).toBe("Free");
  });
});
