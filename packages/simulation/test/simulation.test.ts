import { describe, expect, it } from "vitest";

import { DEFAULT_SIMULATION_INPUT, runSimulation } from "../src/index.js";

const smallInput = {
  ...DEFAULT_SIMULATION_INPUT,
  pathCount: 200,
  horizonWeeks: 4,
};

describe("runSimulation", () => {
  it("is deeply reproducible for a seed and differs for another seed", () => {
    const first = runSimulation(smallInput);
    const second = runSimulation(smallInput);
    const changed = runSimulation({ ...smallInput, seed: "different" });
    expect(first).toEqual(second);
    expect(first.metrics.terminalCapital).not.toEqual(
      changed.metrics.terminalCapital,
    );
  });

  it("matches deterministic all-win and no-stake paths", () => {
    const allWins = runSimulation({
      ...smallInput,
      winProbability: 1,
      positionFraction: 0.1,
      netWinMultiple: 2,
      tradesPerWeek: 1,
      horizonWeeks: 3,
    });
    expect(allWins.metrics.terminalCapital.median).toBeCloseTo(
      100_000 * 1.2 ** 3,
      8,
    );

    const noStake = runSimulation({ ...smallInput, positionFraction: 0 });
    expect(noStake.metrics.terminalCapital.p05).toBeCloseTo(100_000, 10);
    expect(noStake.metrics.terminalCapital.median).toBeCloseTo(100_000, 10);
    expect(noStake.metrics.terminalCapital.p95).toBeCloseTo(100_000, 10);
    expect(noStake.metrics.medianMaxDrawdown).toBe(0);
  });

  it("records practical ruin without calling a fractional loss literal zero", () => {
    const result = runSimulation({
      ...smallInput,
      winProbability: 0,
      positionFraction: 0.5,
      tradesPerWeek: 1,
      horizonWeeks: 10,
      ruinThresholdFraction: 0.1,
    });
    expect(result.metrics.probabilityOfPracticalRuin).toBe(1);
    expect(result.metrics.terminalCapital.median).toBeCloseTo(6_250, 10);
    expect(result.metrics.terminalCapital.median).toBeGreaterThan(0);
    expect(result.samplePaths[0]?.points.at(-1)?.capital).toBeCloseTo(
      6_250,
      10,
    );
  });

  it("computes drawdown pathwise and reports severe breaches", () => {
    const result = runSimulation({
      ...smallInput,
      winProbability: 0,
      positionFraction: 0.2,
      tradesPerWeek: 1,
      horizonWeeks: 2,
      severeDrawdownFraction: 0.3,
    });
    expect(result.metrics.medianMaxDrawdown).toBeCloseTo(0.36, 12);
    expect(result.metrics.probabilityOfSevereDrawdown).toBe(1);
  });

  it("approaches the analytical expectation across many paths", () => {
    const result = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      pathCount: 20_000,
      horizonWeeks: 8,
      seed: "expectation-check",
    });
    expect(result.metrics.expectedTerminalCapital).toBeCloseTo(
      result.metrics.analyticalExpectedTerminalCapital,
      -3,
    );
  });

  it("scales nominal outputs without changing percentage risk outputs", () => {
    const base = runSimulation({ ...smallInput, startingCapital: 10_000 });
    const scaled = runSimulation({ ...smallInput, startingCapital: 100_000 });
    expect(scaled.metrics.terminalCapital.median).toBeCloseTo(
      base.metrics.terminalCapital.median * 10,
      8,
    );
    expect(scaled.metrics.medianTotalReturn).toBeCloseTo(
      base.metrics.medianTotalReturn,
      12,
    );
    expect(scaled.metrics.medianMaxDrawdown).toBeCloseTo(
      base.metrics.medianMaxDrawdown,
      12,
    );
    expect(scaled.metrics.annualized.annualizedVolatility).toBeCloseTo(
      base.metrics.annualized.annualizedVolatility,
      12,
    );
  });
});
