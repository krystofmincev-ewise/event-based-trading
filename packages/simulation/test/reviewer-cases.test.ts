import { describe, expect, it } from "vitest";

import {
  calculateKelly,
  calculateMaximumDrawdown,
  deriveContractEconomics,
  expectedLogGrowth,
  simulateOutcomeSequence,
  wholeContractPosition,
} from "../src/index.js";

describe("independent reviewer exact cases", () => {
  it("maps price and costs to net odds and keeps risk budget executable", () => {
    expect(deriveContractEconomics(0.49, 1, 0.01).netWinMultiple).toBe(1);
    expect(
      calculateKelly(0.5, 0, 0.49, 1, 0.01).estimated.actionableFraction,
    ).toBe(0);
    expect(
      calculateKelly(0.6, 0, 0.49, 1, 0.01).estimated.actionableFraction,
    ).toBeCloseTo(0.2, 12);
    expect(expectedLogGrowth(0.6, 1, 0.2)).toBeCloseTo(0.0201355136, 10);

    const odds = deriveContractEconomics(0.4, 1, 0).netWinMultiple;
    expect(odds).toBeCloseTo(1.5, 12);
    expect(
      calculateKelly(0.6, 0, 0.4, 1, 0).estimated.actionableFraction,
    ).toBeCloseTo(1 / 3, 12);
    expect(expectedLogGrowth(0.6, odds, 1 / 3)).toBeCloseTo(0.0810930216, 10);
    expect(wholeContractPosition(100, 1 / 3, 0.4).contractCount).toBe(83);
  });

  it("shows positive arithmetic edge can coexist with destructive typical growth", () => {
    expect(0.6 * 0.8 + 0.4 * -0.8).toBeCloseTo(0.16, 12);
    expect(expectedLogGrowth(0.6, 1, 0.8)).toBeCloseTo(-0.291103, 6);
  });

  it("matches the requested win/loss recurrence", () => {
    const result = simulateOutcomeSequence(100, 0.25, 1.5, [true, false, true]);
    [100, 137.5, 103.125, 141.796875].forEach((expected, index) => {
      expect(result.capitals[index]).toBeCloseTo(expected, 12);
    });
  });

  it("computes percentage and nominal drawdown from a path", () => {
    const drawdown = calculateMaximumDrawdown([100, 120, 90, 110, 80, 130]);
    expect(drawdown.fraction).toBeCloseTo(1 / 3, 12);
    expect(drawdown.nominal).toBe(40);
  });

  it("keeps Kelly independent of event frequency", () => {
    const onceWeekly = calculateKelly(0.6, 0.02, 0.49, 1, 0.01);
    const conceptuallyDaily = calculateKelly(0.6, 0.02, 0.49, 1, 0.01);
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
    [144, 96, 96, 64].forEach((expected, index) => {
      expect(results[index]?.capitals.at(-1)).toBeCloseTo(expected, 12);
    });
    [0, 0.2, 0.2, 0.36].forEach((expected, index) => {
      expect(results[index]?.maximumDrawdown.fraction).toBeCloseTo(
        expected,
        12,
      );
    });
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
