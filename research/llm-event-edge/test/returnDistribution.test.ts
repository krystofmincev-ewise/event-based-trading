import { describe, expect, it } from "vitest";

import {
  parseReturnDistributionForecast,
  terminalTailProbabilities,
} from "../src/returnDistribution.js";

const valid = {
  caseId: "TEST",
  horizonSessions: 10,
  cdf: {
    pLeMinus10: 0.05,
    pLeMinus5: 0.15,
    pLeMinus2: 0.3,
    pLeZero: 0.45,
    pLePlus2: 0.6,
    pLePlus5: 0.8,
    pLePlus10: 0.95,
  },
  expectedReturn: 0.01,
  abstain: false,
};

describe("coherent return distribution forecasts", () => {
  it("parses a monotone CDF and derives directional tails", () => {
    const parsed = parseReturnDistributionForecast(valid);
    const tails = terminalTailProbabilities(parsed);
    expect(tails).toMatchObject({
      down10: 0.05,
      down5: 0.15,
      down2: 0.3,
      up2: 0.4,
    });
    expect(tails.up5).toBeCloseTo(0.2);
    expect(tails.up10).toBeCloseTo(0.05);
  });

  it("rejects threshold shopping through incoherent probabilities", () => {
    expect(() =>
      parseReturnDistributionForecast({
        ...valid,
        cdf: { ...valid.cdf, pLePlus5: 0.1 },
      }),
    ).toThrow("monotone");
  });
});
