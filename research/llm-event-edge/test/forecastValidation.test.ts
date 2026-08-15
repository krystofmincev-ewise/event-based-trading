import { describe, expect, it } from "vitest";

import { parseForecastBatch } from "../src/forecastValidation.js";

const forecast = {
  caseId: "case",
  probabilityUp1d: 0.5,
  probabilityUp10d: 0.5,
  probabilityAbsolute2Percent1d: 0.4,
  probabilityAbsolute5Percent1d: 0.2,
  probabilityAbsolute5Percent10d: 0.5,
  probabilityUp40d: 0.5,
  probabilityAbsolute10Percent40d: 0.3,
  expectedReturn1d: 0,
  expectedReturn10d: 0,
  expectedReturn40d: 0,
  confidence: "low",
  abstain: false,
  thesis: "test",
  disconfirmingEvidence: "test",
};

describe("forecast validation", () => {
  it("rejects impossible nested absolute-return probabilities", () => {
    expect(() =>
      parseForecastBatch({
        forecasts: [
          {
            ...forecast,
            probabilityAbsolute2Percent1d: 0.2,
            probabilityAbsolute5Percent1d: 0.4,
          },
        ],
      }),
    ).toThrow("cannot exceed");
  });
});
