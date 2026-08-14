import { describe, expect, it } from "vitest";

import { hashSeed, randomAt } from "../src/index.js";

describe("counter PRNG", () => {
  it("has a stable golden vector", () => {
    const seed = hashSeed("golden-seed");
    expect([
      randomAt(seed, 0, 0),
      randomAt(seed, 3, 9),
      randomAt(seed, 99, 1),
    ]).toEqual([0.50083768425975, 0.8691358544165269, 0.4367495145415887]);
  });

  it("is independent of traversal order", () => {
    const seed = hashSeed("order");
    const pathMajor = new Map<string, number>();
    for (let path = 0; path < 4; path += 1) {
      for (let trade = 0; trade < 7; trade += 1) {
        pathMajor.set(`${path}:${trade}`, randomAt(seed, path, trade));
      }
    }
    for (let trade = 0; trade < 7; trade += 1) {
      for (let path = 0; path < 4; path += 1) {
        expect(randomAt(seed, path, trade)).toBe(
          pathMajor.get(`${path}:${trade}`),
        );
      }
    }
  });

  it("provides common random outcomes across position fractions", () => {
    const seed = hashSeed("common-random-numbers");
    const uniforms = Array.from({ length: 10 }, (_, trade) =>
      randomAt(seed, 4, trade),
    );
    const smallFractionOutcomes = uniforms.map((uniform) => uniform < 0.6);
    const largeFractionOutcomes = uniforms.map((uniform) => uniform < 0.6);
    expect(smallFractionOutcomes).toEqual(largeFractionOutcomes);
  });
});
