import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIMULATION_INPUT,
  estimateLabWork,
  runExploration,
  runKellyComparison,
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
