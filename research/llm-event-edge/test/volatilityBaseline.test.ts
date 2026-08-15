import { describe, expect, it } from "vitest";

import {
  prequentialVolatilityProbabilities,
  probabilityAbsoluteNormalMove,
  purgedCrossFittedVolatilityProbabilities,
  standardNormalCdf,
} from "../src/volatilityBaseline.js";

describe("volatility-only baselines", () => {
  it("computes familiar standard-normal probabilities", () => {
    expect(standardNormalCdf(0)).toBeCloseTo(0.5, 6);
    expect(standardNormalCdf(1.96)).toBeCloseTo(0.975, 3);
  });

  it("assigns more tail probability to higher volatility", () => {
    expect(probabilityAbsoluteNormalMove(0.8, 10, 0.05)).toBeGreaterThan(
      probabilityAbsoluteNormalMove(0.2, 10, 0.05),
    );
  });

  it("matches the two-sided one-standard-deviation tail probability", () => {
    const annualizedVolatility = Math.sqrt(252 / 10) * 0.05;
    expect(
      probabilityAbsoluteNormalMove(annualizedVolatility, 10, 0.05),
    ).toBeCloseTo(0.31731, 4);
  });

  it("uses only outcomes settled before each decision", () => {
    const probabilities = prequentialVolatilityProbabilities([
      {
        actual: true,
        entryDate: "2026-06-01",
        settlementDate: "2026-06-15",
        volatility: 0.3,
      },
      {
        actual: false,
        entryDate: "2026-06-10",
        settlementDate: "2026-06-24",
        volatility: 0.4,
      },
      {
        actual: false,
        entryDate: "2026-06-20",
        settlementDate: "2026-07-06",
        volatility: 0.5,
      },
    ]);

    expect(probabilities[0]).toBe(0.5);
    expect(probabilities[1]).toBe(0.5);
    expect(probabilities[2]).toBe(0.75);
  });

  it("purges every training outcome whose return window overlaps the target", () => {
    const target = {
      actual: true,
      entryDate: "2026-06-10",
      settlementDate: "2026-06-24",
      volatility: 0.35,
    };
    const settledBefore = Array.from({ length: 20 }, (_, index) => ({
      actual: index % 3 === 0,
      entryDate: "2026-05-01",
      settlementDate: "2026-05-15",
      volatility: 0.2 + index / 100,
    }));
    const startsAfter = Array.from({ length: 20 }, (_, index) => ({
      actual: index % 4 === 0,
      entryDate: "2026-07-01",
      settlementDate: "2026-07-15",
      volatility: 0.3 + index / 100,
    }));
    const overlapping = Array.from({ length: 5 }, (_, index) => ({
      actual: false,
      entryDate: "2026-06-15",
      settlementDate: "2026-06-29",
      volatility: 0.5 + index / 100,
    }));
    const observations = [
      target,
      ...settledBefore,
      ...startsAfter,
      ...overlapping,
    ];
    const changedOverlapLabels = observations.map((observation, index) =>
      index > 40 ? { ...observation, actual: true } : observation,
    );

    const original = purgedCrossFittedVolatilityProbabilities(observations);
    const changed =
      purgedCrossFittedVolatilityProbabilities(changedOverlapLabels);

    expect(original).toHaveLength(observations.length);
    expect(original[0]).toBe(changed[0]);
    expect(original[0]).toBeGreaterThan(0);
    expect(original[0]).toBeLessThan(1);
  });
});
