import { describe, expect, it } from "vitest";

import { createHistogram, quantileSorted } from "../src/index.js";

describe("R-7 quantiles", () => {
  it("interpolates and handles endpoints and singleton samples", () => {
    expect(quantileSorted([0, 10, 20, 30], 0.25)).toBe(7.5);
    expect(quantileSorted([4], 0.95)).toBe(4);
    expect(quantileSorted([1, 2], 0)).toBe(1);
    expect(quantileSorted([1, 2], 1)).toBe(2);
  });
});

describe("histograms", () => {
  it("counts every value and includes the maximum in the final bin", () => {
    const histogram = createHistogram([0, 1, 2, 3, 4], 4);
    expect(histogram.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(5);
    expect(histogram.bins.at(-1)?.count).toBeGreaterThan(0);
    for (const bin of histogram.bins)
      expect(bin.upper).toBeGreaterThan(bin.lower);
  });

  it("creates a nonzero domain for a constant sample", () => {
    const histogram = createHistogram([2, 2, 2], 3);
    expect(histogram.domain[1]).toBeGreaterThan(histogram.domain[0]);
  });
});
