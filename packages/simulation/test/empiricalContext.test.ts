import { describe, expect, it } from "vitest";

import {
  DEFAULT_EMPIRICAL_SCENARIO,
  EMPIRICAL_CONTEXT,
  resolveEmpiricalScenario,
  validateEmpiricalScenarioSelection,
} from "../src/index.js";

describe("empirical context", () => {
  it("publishes all GICS-level labels plus the pharma/biotech overlay", () => {
    expect(EMPIRICAL_CONTEXT.profiles).toHaveLength(12);
    expect(EMPIRICAL_CONTEXT.profiles.map((profile) => profile.id)).toContain(
      "pharma-biotech",
    );
    expect(EMPIRICAL_CONTEXT.sampleStart).toBe("2000-01-03");
    expect(EMPIRICAL_CONTEXT.sampleEnd).toBe("2025-12-31");
  });

  it("resolves the published technology directional prior exactly", () => {
    const scenario = resolveEmpiricalScenario(DEFAULT_EMPIRICAL_SCENARIO);
    expect(scenario.context.sampleSize).toBe(6_539);
    expect(scenario.rawObservedFrequency).toBeCloseTo(0.5433552530968038, 12);
    expect(scenario.unconditionalContextFrequency).toBeCloseTo(
      (0.5433552530968038 * 6_539 + 0.5) / 6_540,
      12,
    );
    expect(scenario.scenarioProbability).toBe(
      scenario.unconditionalContextFrequency,
    );
    expect(scenario.scenarioProbabilityMinusModeledBreakEven).toBeLessThan(0);
    expect(scenario.termsProvenance.executable).toBe(false);
    expect(scenario.sizingEligibility).toBe("research-only");
  });

  it("uses directional threshold observations and size volatility scaling", () => {
    const large = resolveEmpiricalScenario({
      ...DEFAULT_EMPIRICAL_SCENARIO,
      profileId: "energy",
      horizon: 10,
      threshold: 0.05,
    });
    const small = resolveEmpiricalScenario({
      ...large.selection,
      capitalizationId: "small",
    });
    expect(large.rawObservedFrequency).toBeCloseTo(0.14977029096477795, 12);
    expect(small.effectiveMoveMultiplier).toBeGreaterThan(1);
    expect(small.unconditionalContextFrequency).toBeGreaterThan(
      large.unconditionalContextFrequency,
    );
  });

  it("preserves a raw zero count while using disclosed Jeffreys smoothing", () => {
    const scenario = resolveEmpiricalScenario({
      ...DEFAULT_EMPIRICAL_SCENARIO,
      profileId: "communication-services",
      direction: "down",
      threshold: 0.1,
      companyMoveMultiplier: 1,
    });
    expect(scenario.rawObservedFrequency).toBe(0);
    expect(scenario.unconditionalContextFrequency).toBeCloseTo(0.5 / 6_540, 12);
    expect(scenario.interpolationStatus).toBe("jeffreys-smoothed-knot");
  });

  it("keeps model lift separate from the historical prior", () => {
    const neutral = resolveEmpiricalScenario(DEFAULT_EMPIRICAL_SCENARIO);
    const lifted = resolveEmpiricalScenario({
      ...DEFAULT_EMPIRICAL_SCENARIO,
      modelProbabilityLift: 0.05,
    });
    expect(lifted.unconditionalContextFrequency).toBe(
      neutral.unconditionalContextFrequency,
    );
    expect(lifted.syntheticProbabilityScaledPrice).toBe(
      neutral.syntheticProbabilityScaledPrice,
    );
    expect(
      lifted.scenarioProbability - neutral.scenarioProbability,
    ).toBeCloseTo(0.05, 12);
  });

  it("validates scenario selections and rejects a zero-threshold absolute move", () => {
    expect(
      validateEmpiricalScenarioSelection(DEFAULT_EMPIRICAL_SCENARIO),
    ).toEqual({
      success: true,
      data: DEFAULT_EMPIRICAL_SCENARIO,
    });
    const invalid = validateEmpiricalScenarioSelection({
      ...DEFAULT_EMPIRICAL_SCENARIO,
      direction: "absolute",
      threshold: 0,
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.errors.join(" ")).toContain(
        "absolute direction requires a positive threshold",
      );
    }
  });

  it("rejects size-scaled thresholds beyond the observed catalog boundary", () => {
    const invalid = validateEmpiricalScenarioSelection({
      ...DEFAULT_EMPIRICAL_SCENARIO,
      threshold: 0.1,
      companyMoveMultiplier: 0.5,
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.errors.join(" ")).toContain("observed 10% tail boundary");
    }
  });

  it("returns a frozen, whitelisted, profile-applicable scenario manifest", () => {
    const result = validateEmpiricalScenarioSelection({
      ...DEFAULT_EMPIRICAL_SCENARIO,
      ignored: "not echoed",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toHaveProperty("ignored");

    const scenario = resolveEmpiricalScenario(result.data);
    expect(Object.isFrozen(scenario)).toBe(true);
    expect(Object.isFrozen(scenario.context)).toBe(true);
    expect(scenario.sources.map((source) => source.id)).not.toContain(
      "clinical-trials",
    );
    expect(() => {
      (scenario.context as { sampleSize: number }).sampleSize = 7;
    }).toThrow();
    expect(
      resolveEmpiricalScenario(DEFAULT_EMPIRICAL_SCENARIO).context.sampleSize,
    ).toBe(6_539);
  });
});
