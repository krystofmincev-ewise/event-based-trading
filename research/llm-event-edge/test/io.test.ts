import { describe, expect, it } from "vitest";

import { parseStudyConfig } from "../src/io.js";

const valid = {
  studyId: "study",
  startDate: "2026-06-15",
  endDate: "2026-08-14",
  outcomeObservationDate: "2026-08-14",
  targetCasesPerSector: 30,
  minimumMarketCapUsd: 1_200_000_000,
  maximumCandidatesPerSector: 90,
  benchmarkSymbol: "SPY",
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  analystReplicates: 2,
  forecastBatchSize: 30,
  maximumConcurrentModelCalls: 2,
};

describe("study config", () => {
  it("rejects execution settings that cannot make progress", () => {
    expect(() => parseStudyConfig({ ...valid, forecastBatchSize: 0 })).toThrow(
      "forecastBatchSize must be a positive integer",
    );
    expect(() =>
      parseStudyConfig({ ...valid, maximumConcurrentModelCalls: 0 }),
    ).toThrow("maximumConcurrentModelCalls must be a positive integer");
  });

  it("locks the graph to its supported two-analyst contract", () => {
    expect(() => parseStudyConfig({ ...valid, analystReplicates: 3 })).toThrow(
      "analystReplicates must be 2",
    );
  });
});
