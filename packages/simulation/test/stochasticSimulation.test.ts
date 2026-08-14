import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIMULATION_INPUT,
  poissonFromUniform,
  runSimulation,
} from "../src/index.js";

const stochasticInput = {
  ...DEFAULT_SIMULATION_INPUT,
  opportunityArrival: "poisson" as const,
  calibrationUncertaintyEnabled: true,
  eventsPerWeek: 1.5,
  calibrationEffectiveSampleSize: 80,
  weeklyProbabilityLogitStdDev: 0.2,
  executionCostCoefficientVariation: 0.35,
  pathCount: 500,
  horizonWeeks: 12,
  seed: "stochastic-contract",
};

describe("stochastic simulation", () => {
  it("maps every Poisson draw to a non-negative whole count", () => {
    for (let index = 1; index < 10_000; index += 1) {
      const count = poissonFromUniform(2.5, index / 10_000);
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  it("is reproducible while generating dispersed whole opportunity counts", () => {
    const first = runSimulation(stochasticInput);
    const second = runSimulation(stochasticInput);
    expect(first).toEqual(second);
    expect(first.metadata.simulationModel).toBe(
      "stochastic binary whole-contract target-fraction",
    );
    expect(first.metadata.realizedOpportunityCount.p05).toBeLessThan(
      first.metadata.realizedOpportunityCount.p95,
    );
    expect(
      first.samplePaths.every((path) =>
        path.points.every((point) => Number.isInteger(point.trade)),
      ),
    ).toBe(true);
  });

  it("draws a bounded path-level probability once per path", () => {
    const result = runSimulation(stochasticInput);
    expect(result.metadata.latentWinProbability.p05).toBeGreaterThan(0);
    expect(result.metadata.latentWinProbability.p95).toBeLessThan(1);
    expect(result.metadata.latentWinProbability.p05).toBeLessThan(
      result.metadata.latentWinProbability.p95,
    );
    expect(result.warnings.join(" ")).toContain(
      "beta calibration state once per path",
    );
  });

  it("uses the explicit uncertainty switch at every finite evidence weight", () => {
    const enabled = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      calibrationUncertaintyEnabled: true,
      calibrationEffectiveSampleSize: 1_000_000,
      pathCount: 500,
      horizonWeeks: 1,
    });
    const disabled = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      calibrationUncertaintyEnabled: false,
      calibrationEffectiveSampleSize: 4,
      pathCount: 500,
      horizonWeeks: 1,
    });

    expect(enabled.metadata.latentWinProbability.p05).toBeLessThan(
      enabled.metadata.latentWinProbability.p95,
    );
    expect(disabled.metadata.latentWinProbability.p05).toBe(
      DEFAULT_SIMULATION_INPUT.winProbability,
    );
    expect(disabled.metadata.latentWinProbability.p95).toBe(
      DEFAULT_SIMULATION_INPUT.winProbability,
    );
  });

  it("retains an exact integer schedule when only probability uncertainty is enabled", () => {
    const result = runSimulation({
      ...stochasticInput,
      opportunityArrival: "fixed",
      eventsPerWeek: 2,
      executionCostCoefficientVariation: 0,
    });
    expect(result.metadata.realizedOpportunityCount).toEqual({
      p05: 24,
      p25: 24,
      median: 24,
      p75: 24,
      p95: 24,
    });
    expect(result.metadata.simulationModel).toBe(
      "stochastic binary whole-contract target-fraction",
    );
  });

  it("skips extreme cost draws that would invalidate the contract", () => {
    const result = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      opportunityArrival: "poisson",
      contractPurchasePrice: 99,
      settlementPayout: 100,
      roundTripCosts: 0.5,
      executionCostCoefficientVariation: 3,
      pathCount: 100,
      horizonWeeks: 1,
      eventsPerWeek: 1,
      seed: "cap-probe",
    });

    expect(result.metrics.expectedTerminalCapital).toBeGreaterThanOrEqual(0);
    expect(result.metadata.skippedInvalidCostOpportunityCount).toBeGreaterThan(
      0,
    );
    expect(result.warnings.join(" ")).toContain(
      "treated as unexecutable and skipped",
    );
  });

  it("preserves fractional expected opportunity counts", () => {
    const result = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      opportunityArrival: "poisson",
      eventsPerWeek: 0.1,
      horizonWeeks: 1,
      pathCount: 100,
    });
    expect(result.metadata.expectedOpportunityCount).toBe(0.1);
    expect(
      Number.isInteger(result.metadata.realizedOpportunityCount.median),
    ).toBe(true);
  });

  it("keeps probability stresses centered on the displayed probability", () => {
    const result = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      winProbability: 0.9,
      calibrationUncertaintyEnabled: true,
      calibrationEffectiveSampleSize: 4,
      weeklyProbabilityLogitStdDev: 2,
      positionFraction: 0,
      pathCount: 5_000,
      horizonWeeks: 1,
    });
    expect(result.metadata.meanLatentWinProbability).toBeCloseTo(0.9, 2);
    expect(result.metadata.meanWeeklyWinProbability).toBeCloseTo(0.9, 2);
  });

  it("warns whenever stochastic display outputs are capped", () => {
    const result = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      opportunityArrival: "poisson",
      winProbability: 1,
      positionFraction: 1,
      contractPurchasePrice: 1,
      settlementPayout: 100_000,
      roundTripCosts: 0,
      eventsPerWeek: 20,
      horizonWeeks: 1,
      pathCount: 100,
    });
    expect(result.metadata.continuousFractionReferenceCapped).toBe(true);
    expect(result.metadata.cagrOutputCapped).toBe(true);
    expect(result.warnings.join(" ")).toContain("capped");
  });
});
