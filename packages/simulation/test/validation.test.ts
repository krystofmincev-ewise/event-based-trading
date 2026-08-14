import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIMULATION_INPUT,
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
      netWinMultiple: 0,
      positionFraction: 1.1,
      pathCount: 2.5,
      ruinThresholdFraction: 1,
      seed: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const joined = result.errors.join(" ");
      expect(joined).toContain("netWinMultiple");
      expect(joined).toContain("positionFraction");
      expect(joined).toContain("pathCount");
      expect(joined).toContain("ruinThresholdFraction");
      expect(joined).toContain("seed");
    }
  });
});
