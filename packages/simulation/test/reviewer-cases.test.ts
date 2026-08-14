import { describe, expect, it } from "vitest";

import {
  calculateKelly,
  calculateMaximumDrawdown,
  contractPriceToNetWinMultiple,
  expectedLogGrowth,
  payoutNotionalFraction,
  simulateOutcomeSequence,
} from "../src/index.js";

describe("independent reviewer exact cases", () => {
  it("maps price to net odds and keeps risk fraction distinct from payout notional", () => {
    expect(contractPriceToNetWinMultiple(0.5)).toBe(1);
    expect(
      calculateKelly(0.5, contractPriceToNetWinMultiple(0.5)).fullFraction,
    ).toBe(0);
    expect(
      calculateKelly(0.6, contractPriceToNetWinMultiple(0.5)).fullFraction,
    ).toBeCloseTo(0.2, 12);
    expect(expectedLogGrowth(0.6, 1, 0.2)).toBeCloseTo(0.0201355136, 10);

    const odds = contractPriceToNetWinMultiple(0.4);
    expect(odds).toBeCloseTo(1.5, 12);
    expect(calculateKelly(0.6, odds).fullFraction).toBeCloseTo(1 / 3, 12);
    expect(expectedLogGrowth(0.6, odds, 1 / 3)).toBeCloseTo(0.0810930216, 10);
    expect(payoutNotionalFraction(1 / 3, 0.4)).toBeCloseTo(5 / 6, 12);
  });

  it("shows positive arithmetic edge can coexist with destructive typical growth", () => {
    expect(0.6 * 0.8 + 0.4 * -0.8).toBeCloseTo(0.16, 12);
    expect(expectedLogGrowth(0.6, 1, 0.8)).toBeCloseTo(-0.291103, 6);
  });

  it("matches the requested win/loss recurrence", () => {
    const result = simulateOutcomeSequence(100, 0.25, 1.5, [true, false, true]);
    expect(result.capitals).toEqual([100, 137.5, 103.125, 141.796875]);
  });

  it("computes percentage and nominal drawdown from a path", () => {
    const drawdown = calculateMaximumDrawdown([100, 120, 90, 110, 80, 130]);
    expect(drawdown.fraction).toBeCloseTo(1 / 3, 12);
    expect(drawdown.nominal).toBe(40);
  });

  it("keeps Kelly independent of event frequency", () => {
    const onceWeekly = calculateKelly(0.6, 1);
    const conceptuallyDaily = calculateKelly(0.6, 1);
    expect(onceWeekly).toEqual(conceptuallyDaily);
  });

  it("crosses a 50% drawdown only on the fourth 20% loss", () => {
    const result = simulateOutcomeSequence(100, 0.2, 1, [
      false,
      false,
      false,
      false,
    ]);
    expect(result.capitals.at(-1)).toBeCloseTo(40.96, 12);
    expect(result.maximumDrawdown.fraction).toBeCloseTo(0.5904, 12);
    expect(
      calculateMaximumDrawdown(result.capitals.slice(0, -1)).fraction,
    ).toBeLessThan(0.5);
  });

  it("reproduces the exact two-trade distribution and pathwise drawdowns", () => {
    const scenarios = [
      { outcomes: [true, true], probability: 0.36 },
      { outcomes: [true, false], probability: 0.24 },
      { outcomes: [false, true], probability: 0.24 },
      { outcomes: [false, false], probability: 0.16 },
    ] as const;
    const results = scenarios.map((scenario) => ({
      probability: scenario.probability,
      ...simulateOutcomeSequence(100, 0.2, 1, scenario.outcomes),
    }));
    expect(results.map((result) => result.capitals.at(-1))).toEqual([
      144, 96, 96, 64,
    ]);
    expect(results.map((result) => result.maximumDrawdown.fraction)).toEqual([
      0, 0.19999999999999996, 0.19999999999999996, 0.36,
    ]);
    expect(
      results.reduce(
        (sum, result) => sum + result.probability * result.capitals.at(-1)!,
        0,
      ),
    ).toBeCloseTo(108.16, 12);
    expect(
      results.reduce(
        (sum, result) =>
          sum + result.probability * result.maximumDrawdown.fraction,
        0,
      ),
    ).toBeCloseTo(0.1536, 12);
  });
});
