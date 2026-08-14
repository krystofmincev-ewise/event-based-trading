import { describe, expect, it } from "vitest";

import { calculateKelly, expectedLogGrowth } from "../src/index.js";

describe("calculateKelly", () => {
  it("matches the even-money identity 2p - 1", () => {
    const result = calculateKelly(0.6, 1);
    expect(result.rawFraction).toBeCloseTo(0.2, 12);
    expect(result.fullFraction).toBeCloseTo(0.2, 12);
    expect(result.halfFraction).toBeCloseTo(0.1, 12);
    expect(result.quarterFraction).toBeCloseTo(0.05, 12);
  });

  it("clamps no-edge and negative-edge allocations to zero", () => {
    expect(calculateKelly(1 / 3, 2).fullFraction).toBeCloseTo(0, 12);
    expect(calculateKelly(0.2, 2).rawFraction).toBeLessThan(0);
    expect(calculateKelly(0.2, 2).fullFraction).toBe(0);
  });

  it("handles deterministic endpoints", () => {
    expect(calculateKelly(0, 3)).toMatchObject({
      rawFraction: -1 / 3,
      fullFraction: 0,
    });
    expect(calculateKelly(1, 3)).toMatchObject({
      rawFraction: 1,
      fullFraction: 1,
    });
    expect(expectedLogGrowth(0.8, 1, 1)).toBeNull();
  });

  it("rejects an invalid payout", () => {
    expect(() => calculateKelly(0.5, 0)).toThrow(/positive/);
  });
});
