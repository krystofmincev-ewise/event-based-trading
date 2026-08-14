import { describe, expect, it } from "vitest";

import {
  calculateKelly,
  calculatePositionSizing,
  deriveContractEconomics,
  expectedLogGrowth,
  wholeContractPosition,
} from "../src/index.js";

describe("contract economics and Kelly sizing", () => {
  it("derives all-in loss, net odds, break-even probability, and Kelly", () => {
    const result = calculateKelly(0.55, 0.03, 0.49, 1, 0.01);
    expect(result.economics).toMatchObject({
      allInCost: 0.5,
      netWinProfit: 0.5,
      netWinMultiple: 1,
      breakEvenProbability: 0.5,
    });
    expect(result.estimated.rawFraction).toBeCloseTo(0.1, 12);
    expect(result.estimated.actionableFraction).toBeCloseTo(0.1, 12);
    expect(result.conservative.probability).toBeCloseTo(0.52, 12);
    expect(result.conservative.actionableFraction).toBeCloseTo(0.04, 12);
    expect(result.estimated.expectedProfitPerContract).toBeCloseTo(0.05, 12);
  });

  it("allows a positive edge below a 50% hit rate when price supports it", () => {
    const result = calculateKelly(0.45, 0, 0.39, 1, 0.01);
    expect(result.economics.breakEvenProbability).toBeCloseTo(0.4, 12);
    expect(result.estimated.expectedProfitPerContract).toBeCloseTo(0.05, 12);
    expect(result.estimated.actionableFraction).toBeGreaterThan(0);
  });

  it("clamps non-positive-edge allocations to zero", () => {
    const result = calculateKelly(0.45, 0.06, 0.49, 1, 0.01);
    expect(result.estimated.rawFraction).toBeLessThan(0);
    expect(result.estimated.actionableFraction).toBe(0);
    expect(result.conservative.actionableFraction).toBe(0);
  });

  it("rejects contract terms without positive held-to-settlement profit", () => {
    expect(() => deriveContractEconomics(0.99, 1, 0.01)).toThrow(
      /must be below settlement payout/,
    );
  });

  it("floors risk budgets to whole contract units", () => {
    expect(wholeContractPosition(100, 0.25, 9)).toEqual({
      contractCount: 2,
      capitalAtRisk: 18,
      executedFraction: 0.18,
    });
  });

  it("returns an agent-ready conservative sizing decision", () => {
    const decision = calculatePositionSizing({
      bankroll: 10_000,
      winProbability: 0.55,
      probabilityHaircut: 0.03,
      contractPurchasePrice: 49,
      settlementPayout: 100,
      roundTripCosts: 1,
      sizingPolicy: "conservative-kelly",
      customFraction: 0,
      maximumPositionFraction: 0.03,
    });
    expect(decision.unconstrainedTargetFraction).toBeCloseTo(0.04, 12);
    expect(decision.targetFractionAfterPolicyCap).toBe(0.03);
    expect(decision.wholeContractCount).toBe(6);
    expect(decision.maximumLoss).toBe(300);
    expect(decision.maximumProfit).toBe(300);
    expect(decision.bindingConstraint).toBe("position-cap");
  });

  it("preserves the expected-log-growth identity", () => {
    expect(expectedLogGrowth(0.6, 1, 0.2)).toBeCloseTo(0.0201355136, 10);
    expect(expectedLogGrowth(0.8, 1, 1)).toBeNull();
  });
});
