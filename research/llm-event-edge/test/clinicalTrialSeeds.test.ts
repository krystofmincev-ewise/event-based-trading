import { describe, expect, it } from "vitest";

import { parseClinicalTrialSeeds } from "../src/clinicalTrialSeeds.js";

const validSeed = {
  id: "TEST:TRIAL:2026-03-01",
  eventDate: "2026-03-01",
  ticker: "TEST",
  program: "Trial",
  phase: "3",
  nctIds: ["NCT12345678"],
  readoutKind: "final-efficacy",
  sponsorReportedPrimaryEndpointMet: "yes",
  postHocPositiveOnly: false,
  sourceUrls: ["https://www.sec.gov/Archives/edgar/data/1/0001/exhibit.htm"],
  confirmatoryEligibility: "eligible",
};

describe("clinical-trial discovery seeds", () => {
  it("parses a typed, source-backed seed", () => {
    expect(parseClinicalTrialSeeds([validSeed])).toHaveLength(1);
  });

  it("rejects duplicate IDs and invalid sources", () => {
    expect(() => parseClinicalTrialSeeds([validSeed, validSeed])).toThrow(
      "unique",
    );
    expect(() =>
      parseClinicalTrialSeeds([
        { ...validSeed, id: "bad", sourceUrls: ["https://example.com"] },
      ]),
    ).toThrow("SEC exhibit");
  });
});
