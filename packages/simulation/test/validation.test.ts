import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIMULATION_INPUT,
  estimateLabWork,
  runExploration,
  runKellyComparison,
  validatePositionSizingInput,
  validateSimulationInput,
} from "../src/index.js";

describe("validateSimulationInput", () => {
  it("accepts the documented defaults", () => {
    expect(validateSimulationInput(DEFAULT_SIMULATION_INPUT)).toEqual({
      success: true,
      data: DEFAULT_SIMULATION_INPUT,
    });
  });

  it("rejects invalid boundaries and untrusted values", () => {
    const result = validateSimulationInput({
      ...DEFAULT_SIMULATION_INPUT,
      contractPurchasePrice: 1,
      settlementPayout: 1,
      positionFraction: 1.1,
      pathCount: 2.5,
      eventsPerWeek: 1.5,
      ruinThresholdFraction: 1,
      seed: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const joined = result.errors.join(" ");
      expect(joined).toContain("contractPurchasePrice + roundTripCosts");
      expect(joined).toContain("positionFraction");
      expect(joined).toContain("pathCount");
      expect(joined).toContain("eventsPerWeek must be an integer");
      expect(joined).toContain("ruinThresholdFraction");
      expect(joined).toContain("seed");
    }
  });

  it("accepts a fractional Poisson mean but still rejects fractional fixed counts", () => {
    const poisson = validateSimulationInput({
      ...DEFAULT_SIMULATION_INPUT,
      opportunityArrival: "poisson",
      eventsPerWeek: 1.5,
    });
    expect(poisson.success).toBe(true);
    const fixed = validateSimulationInput({
      ...DEFAULT_SIMULATION_INPUT,
      opportunityArrival: "fixed",
      eventsPerWeek: 1.5,
    });
    expect(fixed.success).toBe(false);
  });

  it("rejects combinations that exceed the local operation budget", () => {
    const result = validateSimulationInput({
      ...DEFAULT_SIMULATION_INPUT,
      pathCount: 25_000,
      eventsPerWeek: 20,
      horizonWeeks: 104,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join(" ")).toContain("path-events exceeds");
      expect(result.errors.join(" ")).toContain(
        "reduce pathCount, eventsPerWeek, or horizonWeeks",
      );
    }
  });

  it("conservatively covers the generated grids and preserves Kelly samples", () => {
    const input = { ...DEFAULT_SIMULATION_INPUT, pathCount: 100 };
    const work = estimateLabWork(input);
    const exploration = runExploration(input);
    const comparison = runKellyComparison(input);
    const actualExplorationPathTrades =
      (exploration.sweep.length * exploration.sweepPathCount +
        exploration.heatmap.length * exploration.heatmapPathCount) *
      work.tradeCount;
    expect(work.explorationPathTrades).toBeGreaterThanOrEqual(
      actualExplorationPathTrades,
    );
    expect(
      comparison.find((point) => point.label === "No stake")?.pathCount,
    ).toBe(0);
    expect(
      comparison
        .filter((point) => point.label !== "No stake")
        .every((point) => point.pathCount === input.pathCount),
    ).toBe(true);
  });
});

describe("validatePositionSizingInput", () => {
  const valid = {
    bankroll: 10_000,
    winProbability: 0.49,
    probabilityHaircut: 0.02,
    contractPurchasePrice: 39,
    settlementPayout: 100,
    roundTripCosts: 1,
    sizingPolicy: "conservative-kelly",
    customFraction: 0,
    maximumPositionFraction: 0.02,
  };

  it("accepts a below-50% estimate when the observed price supports it", () => {
    expect(validatePositionSizingInput(valid)).toEqual({
      success: true,
      data: valid,
    });
  });

  it("rejects malformed values, invalid policies, and impossible economics", () => {
    const result = validatePositionSizingInput({
      ...valid,
      bankroll: Number.NaN,
      sizingPolicy: "auto-opposite",
      contractPurchasePrice: 99,
      roundTripCosts: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join(" ")).toContain(
        "bankroll must be a finite number",
      );
      expect(result.errors.join(" ")).toContain("sizingPolicy must be");
      expect(result.errors.join(" ")).toContain(
        "contractPurchasePrice + roundTripCosts",
      );
    }
  });
});
