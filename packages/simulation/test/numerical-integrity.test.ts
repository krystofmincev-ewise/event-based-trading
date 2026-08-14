import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIMULATION_INPUT,
  drawdownFromLogCapital,
  returnBetweenLogCapitals,
  runSimulation,
  updateLogCapital,
} from "../src/index.js";

describe("log-space numerical integrity", () => {
  it("keeps extreme deterministic weekly risk metrics exact after display capping", () => {
    const result = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      winProbability: 1,
      positionFraction: 1,
      contractPurchasePrice: 1,
      settlementPayout: 21,
      roundTripCosts: 0,
      eventsPerWeek: 20,
      horizonWeeks: 104,
      pathCount: 100,
    });
    expect(result.metadata.cappedPathCount).toBe(100);
    expect(
      Number.isFinite(result.metrics.annualized.annualizedVolatility),
    ).toBe(true);
    expect(result.metadata.approximatedLargeContractExecutions).toBeGreaterThan(
      0,
    );
  });

  it("measures a loss correctly while displayed capital remains capped", () => {
    let logCapital = Math.log(100);
    for (let index = 0; index < 300; index += 1) {
      logCapital = updateLogCapital(logCapital, true, 0.5, 20).logCapital;
    }
    const peakLogCapital = logCapital;
    const loss = updateLogCapital(logCapital, false, 0.5, 20);
    expect(loss.capital).toBe(Number.MAX_VALUE);
    expect(drawdownFromLogCapital(loss.logCapital, peakLogCapital)).toBeCloseTo(
      0.5,
      12,
    );
    expect(
      returnBetweenLogCapitals(loss.logCapital, peakLogCapital),
    ).toBeCloseTo(-0.5, 12);
  });

  it("does not turn finite f < 1 wealth into literal zero on underflow", () => {
    let step = updateLogCapital(Math.log(100), false, 0.5, 1);
    for (let index = 1; index < 2_000; index += 1) {
      step = updateLogCapital(step.logCapital, false, 0.5, 1);
    }
    expect(step.logCapital).toBeGreaterThan(Number.NEGATIVE_INFINITY);
    expect(step.capital).toBe(Number.MIN_VALUE);
    expect(step.literalZero).toBe(false);
    expect(step.underflowed).toBe(true);
  });

  it("labels the continuous-fraction reference as unstopped and approximate", () => {
    const result = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      startingCapital: 100_000,
      pathCount: 100,
      winProbability: 0,
      positionFraction: 0.5,
      eventsPerWeek: 1,
      horizonWeeks: 10,
      ruinThresholdFraction: 0.1,
    });
    expect(result.metrics.terminalCapital.median).toBeCloseTo(6_250, 10);
    expect(
      result.metrics.continuousFractionExpectedTerminalCapitalReference,
    ).toBeCloseTo(97.65625, 12);
    expect(result.warnings.join(" ")).toContain(
      "ignores the practical-ruin stop",
    );
    expect(result.metrics.annualized.meanPeriodicReturn).toBeCloseTo(-0.2, 12);
    expect(result.metrics.annualized.sampleObservationCount).toBe(1_000);
  });

  it("maps integer event schedules to the requested terminal week", () => {
    const result = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      pathCount: 100,
      eventsPerWeek: 2,
      horizonWeeks: 1,
    });
    expect(result.fan.at(-1)?.week).toBe(1);
    expect(result.samplePaths[0]?.points.at(-1)?.week).toBe(1);
  });

  it("caps annualized growth overflow without violating numeric result types", () => {
    const result = runSimulation({
      ...DEFAULT_SIMULATION_INPUT,
      winProbability: 1,
      positionFraction: 1,
      contractPurchasePrice: 1,
      settlementPayout: 21,
      roundTripCosts: 0,
      eventsPerWeek: 20,
      horizonWeeks: 1,
      startingCapital: 100,
      pathCount: 100,
    });
    expect(Number.isFinite(result.metrics.terminalCapital.median)).toBe(true);
    expect(result.metrics.impliedCagrFromExpectedTerminal).toBe(
      Number.MAX_VALUE,
    );
    expect(result.metrics.impliedCagrFromMedianTerminal).toBe(Number.MAX_VALUE);
    expect(result.metadata.cagrOutputCapped).toBe(true);
    expect(result.warnings.join(" ")).toContain("CAGR outputs exceeded");
  });
});
