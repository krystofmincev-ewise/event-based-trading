import { describe, expect, it } from "vitest";

import {
  calculateKelly,
  calculatePositionSizing,
  deriveContractEconomics,
  expectedLogGrowth,
  wholeContractPosition,
} from "../src/index.js";

describe("contract economics and Kelly sizing", () => {
  const sizingInput = {
    bankroll: 10_000,
    winProbability: 0.55,
    probabilityHaircut: 0.03,
    contractPurchasePrice: 49,
    settlementPayout: 100,
    roundTripCosts: 1,
    sizingPolicy: "conservative-kelly" as const,
    customFraction: 0,
    maximumPositionFraction: 0.03,
  };

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
    const decision = calculatePositionSizing(sizingInput);
    expect(decision.unconstrainedTargetFraction).toBeCloseTo(0.04, 12);
    expect(decision.targetFractionAfterPolicyCap).toBe(0.03);
    expect(decision.wholeContractCount).toBe(6);
    expect(decision.maximumLoss).toBe(300);
    expect(decision.maximumProfit).toBe(300);
    expect(decision.bindingReason).toBe("position-cap");
  });

  it("supports every sizing policy without bypassing the hard cap", () => {
    const estimated = calculatePositionSizing({
      ...sizingInput,
      sizingPolicy: "estimated-kelly",
      maximumPositionFraction: 1,
    });
    const custom = calculatePositionSizing({
      ...sizingInput,
      sizingPolicy: "custom",
      customFraction: 0.025,
      maximumPositionFraction: 1,
    });
    expect(estimated.unconstrainedTargetFraction).toBeCloseTo(0.1, 12);
    expect(estimated.wholeContractCount).toBe(20);
    expect(custom.targetFractionAfterPolicyCap).toBe(0.025);
    expect(custom.wholeContractCount).toBe(5);
    expect(custom.bindingReason).toBe("none");
  });

  it("returns no long allocation when edge is non-positive", () => {
    const decision = calculatePositionSizing({
      ...sizingInput,
      winProbability: 0.6,
      probabilityHaircut: 0,
      contractPurchasePrice: 70,
      roundTripCosts: 0,
      sizingPolicy: "estimated-kelly",
      maximumPositionFraction: 1,
    });
    expect(decision.kelly.estimated.rawFraction).toBeLessThan(0);
    expect(decision.wholeContractCount).toBe(0);
    expect(decision.actualCapitalAtRisk).toBe(0);
    expect(decision.bindingReason).toBe("non-positive-edge");
  });

  it("reports whole-contract rounding when one contract exceeds the budget", () => {
    const decision = calculatePositionSizing({
      ...sizingInput,
      bankroll: 100,
      sizingPolicy: "custom",
      customFraction: 0.25,
      maximumPositionFraction: 1,
    });
    expect(decision.dollarRiskBudget).toBe(25);
    expect(decision.wholeContractCount).toBe(0);
    expect(decision.bindingReason).toBe("whole-contract-rounding");
  });

  it("distinguishes a haircut-induced no-trade from a zero custom target", () => {
    const conservativeNoEdge = calculatePositionSizing({
      ...sizingInput,
      winProbability: 0.52,
      probabilityHaircut: 0.03,
    });
    const customZero = calculatePositionSizing({
      ...sizingInput,
      sizingPolicy: "custom",
      customFraction: 0,
    });
    expect(
      conservativeNoEdge.kelly.estimated.expectedProfitPerContract,
    ).toBeGreaterThan(0);
    expect(conservativeNoEdge.bindingReason).toBe("non-positive-edge");
    expect(customZero.bindingReason).toBe("custom-zero");
  });

  it("preserves the expected-log-growth identity", () => {
    expect(expectedLogGrowth(0.6, 1, 0.2)).toBeCloseTo(0.0201355136, 10);
    expect(expectedLogGrowth(0.8, 1, 1)).toBeNull();
  });
});
